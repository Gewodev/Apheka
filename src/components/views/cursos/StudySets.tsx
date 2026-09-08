import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Pencil, Trash2, BookOpen, ClipboardCheck, Shuffle, Check, ChevronLeft,
  Upload, Timer, RotateCcw, Search, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { TopicFlashcard } from '../../../store/AppContext';

// Tarjeta de estudio: TopicFlashcard + groupName (carpeta/set dentro del tema, persistido como campo extra)
export type SetCard = TopicFlashcard & { groupName?: string };
export type StudySetsMode = 'cards' | 'test' | 'match' | 'rush';

interface StudySetsProps {
  open: boolean;
  topicTitle: string;
  groupName: string | null; // null = todas las tarjetas del tema
  accent: string;
  flashcards: SetCard[];
  onChange: (next: SetCard[]) => void;
  onClose: () => void;
}

type Phase = 'home' | 'cards' | 'test' | 'match' | 'rush';

const CARD_COLOR = '#8B5CF6';
const TEST_COLOR = '#F59E0B';
const MATCH_COLOR = '#10B981';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

// Intervalos SRS idénticos al repaso del tema (Cursos.tsx)
const SRS_MS = { again: 10 * 60 * 1000, hard: 24 * 3600 * 1000, good: 3 * 24 * 3600 * 1000, easy: 7 * 24 * 3600 * 1000 } as const;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Parser idéntico al import masivo de Cursos: "pregunta - respuesta" por línea (o tabulador / "- " inicial)
const parseBulk = (text: string): { q: string; a: string }[] =>
  text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const sep = line.indexOf(' - ') !== -1 ? ' - ' : line.indexOf('\t') !== -1 ? '\t' : line.indexOf('-') === 0 ? '' : ' - ';
    if (!sep) return { q: line, a: '' };
    const i = line.indexOf(sep);
    return { q: line.slice(0, i).trim(), a: line.slice(i + sep.length).trim() };
  }).filter(c => c.q);

const DifficultyDot = ({ d }: { d: SetCard['difficulty'] }) => (
  <span style={{
    width: 7, height: 7, borderRadius: 99, flexShrink: 0,
    background: d === 'facil' ? '#10B981' : d === 'dificil' ? '#EF4444' : '#F59E0B',
  }} />
);

const StatPill = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
  <div style={{ padding: '12px 16px', borderRadius: 14, border: `1px solid ${color}26`, background: `${color}0a`, minWidth: 104 }}>
    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 6 }}>{label}</div>
  </div>
);

const ToolButton = ({ icon: Icon, label, sub, color, onClick, disabled }: {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
  label: string; sub: string; color: string; onClick: () => void; disabled?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 14,
      border: `1px solid ${color}30`, background: `${color}0d`, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1, textAlign: 'left', transition: `all 180ms ${EASE}`, minWidth: 0,
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = `${color}1a`; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
    onMouseLeave={e => { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.transform = 'translateY(0)'; }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}16`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} style={{ color }} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </div>
  </button>
);

export default function StudySets({ open, topicTitle, groupName, accent, flashcards, onChange, onClose }: StudySetsProps) {
  const [phase, setPhase] = useState<Phase>('home');

  // --- estudio (tarjetas) ---
  const [deck, setDeck] = useState<SetCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ done: 0, again: 0, easy: 0 });

  // --- test ---
  type TestQ = { card: SetCard; options: string[]; correct: string; picked: string | null };
  const [testQs, setTestQs] = useState<TestQ[]>([]);
  const [testIdx, setTestIdx] = useState(0);
  const [testDone, setTestDone] = useState(false);
  const [testWrongIds, setTestWrongIds] = useState<string[]>([]);

  // --- emparejar ---
  type Tile = { key: string; cardId: string; text: string; kind: 'q' | 'a' };
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Tile | null>(null);
  const [wrongPair, setWrongPair] = useState<string[]>([]);
  const [matchStart, setMatchStart] = useState<number | null>(null);
  const [matchTime, setMatchTime] = useState(0);
  const [matchFails, setMatchFails] = useState(0);
  const [matchDone, setMatchDone] = useState(false);

  // --- contrarreloj (estilo Quizizz) ---
  const [rushQs, setRushQs] = useState<TestQ[]>([]);
  const [rushIdx, setRushIdx] = useState(0);
  const [rushTime, setRushTime] = useState(60);
  const [rushScore, setRushScore] = useState(0);
  const [rushStreak, setRushStreak] = useState(0);
  const [rushRight, setRushRight] = useState(0);
  const [rushOver, setRushOver] = useState(false);
  const rushBestKey = `owa_sets_rush_best::${topicTitle}::${groupName || 'todas'}`;
  const [rushBest, setRushBest] = useState<number>(() => { try { return Number(localStorage.getItem(rushBestKey)) || 0; } catch { return 0; } });

  // --- CRUD ---
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fq, setFq] = useState('');
  const [fa, setFa] = useState('');
  const [fd, setFd] = useState<SetCard['difficulty']>('bueno');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    setFlipped(false); setIdx(0); setStats({ done: 0, again: 0, easy: 0 });
    setTestQs([]); setTestIdx(0); setTestDone(false); setTestWrongIds([]);
    setMatched(new Set()); setPicked(null); setWrongPair([]); setMatchStart(null);
    setMatchTime(0); setMatchFails(0); setMatchDone(false);
    setRushQs([]); setRushIdx(0); setRushTime(60); setRushScore(0); setRushStreak(0); setRushRight(0); setRushOver(false);
  }, []);

  // Al abrir: siempre entra al resumen; si piden test/match sin tarjetas, el botón correspondiente se deshabilita.
  useEffect(() => {
    if (open) { setPhase('home'); resetSession(); setQuery(''); setFormOpen(false); setBulkOpen(false); setConfirmDelId(null); }
  }, [open, resetSession]);

  const cards = useMemo(() => {
    const list = groupName ? flashcards.filter(f => { const gn = f.groupName || ''; return gn === groupName || gn.startsWith(groupName + '/'); }) : flashcards;
    return [...list].sort((a, b) => a.nextReview - b.nextReview);
  }, [flashcards, groupName]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(c => c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q));
  }, [cards, query]);

  const dueCount = useMemo(() => cards.filter(c => c.nextReview <= Date.now()).length, [cards]);
  const hardCount = useMemo(() => cards.filter(c => c.difficulty === 'dificil').length, [cards]);

  // ---------- CRUD ----------
  const openAdd = () => { setEditingId(null); setFq(''); setFa(''); setFd('bueno'); setFormOpen(true); setBulkOpen(false); };
  const openEdit = (c: SetCard) => { setEditingId(c.id); setFq(c.question); setFa(c.answer); setFd(c.difficulty); setFormOpen(true); setBulkOpen(false); };

  // IMPORTANTE: toda mutación opera sobre `flashcards` (el tema completo) — nunca sobre `cards`
  // (la lista filtrada del set), o se perderían las tarjetas de los demás grupos.
  const saveCard = () => {
    if (!fq.trim() || !fa.trim()) { toast.error('Pregunta y respuesta son obligatorias'); return; }
    const now = Date.now();
    if (editingId) {
      onChange(flashcards.map(c => c.id === editingId ? { ...c, question: fq.trim(), answer: fa.trim(), difficulty: fd } : c));
      toast.success('Tarjeta actualizada');
    } else {
      const created: SetCard = {
        id: Math.random().toString(36).slice(2) + now.toString(36),
        question: fq.trim(), answer: fa.trim(), difficulty: fd,
        lastReviewed: now, nextReview: now,
        ...(groupName ? { groupName } : {}),
      };
      onChange([...flashcards, created]);
      toast.success('Tarjeta añadida al set');
    }
    setFormOpen(false); setEditingId(null); setFq(''); setFa('');
  };

  const deleteCard = (id: string) => {
    onChange(flashcards.filter(c => c.id !== id));
    setConfirmDelId(null);
    toast.success('Tarjeta eliminada');
  };

  const addBulk = () => {
    const parsed = parseBulk(bulkText).filter(c => c.a);
    if (parsed.length === 0) { toast.error('Formato: pregunta - respuesta (una por línea)'); return; }
    const now = Date.now();
    const created: SetCard[] = parsed.map((c, i) => ({
      id: Math.random().toString(36).slice(2) + (now + i).toString(36),
      question: c.q, answer: c.a, difficulty: 'bueno' as const,
      lastReviewed: now, nextReview: now,
      ...(groupName ? { groupName } : {}),
    }));
      onChange([...flashcards, ...created]);
      setBulkText(''); setBulkOpen(false);
      toast.success(`${created.length} tarjetas importadas`);
  };

  // ---------- Estudio ----------
  const startCards = () => {
    if (cards.length === 0) return;
    setDeck(shuffle(cards));
    resetSession(); setPhase('cards');
  };

  const grade = (g: 'again' | 'hard' | 'good' | 'easy') => {
    const card = deck[idx];
    if (!card) return;
    const now = Date.now();
    onChange(flashcards.map(c => c.id === card.id ? {
      ...c,
      difficulty: g === 'again' ? 'dificil' : g === 'easy' ? 'facil' : c.difficulty === 'facil' ? 'bueno' : c.difficulty,
      lastReviewed: now, nextReview: now + SRS_MS[g],
    } : c));
    setStats(s => ({ done: s.done + 1, again: s.again + (g === 'again' ? 1 : 0), easy: s.easy + (g === 'easy' ? 1 : 0) }));
    if (g === 'again') {
      setDeck(d => [...d, card]); // re-encola al final
    }
    if (idx + 1 >= deck.length && g !== 'again') { setFlipped(false); return; }
    setFlipped(false);
    setIdx(i => i + 1);
  };

  // ---------- Test ----------
  // Genera una pregunta de opción múltiple desde una tarjeta (distractores del resto del set)
  const makeMcq = (card: SetCard, pool: SetCard[]): TestQ => {
    const others = shuffle(pool.filter(c => c.id !== card.id)).map(c => c.answer);
    const distractors: string[] = [];
    for (const o of others) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(o) && o !== card.answer) distractors.push(o);
    }
    return { card, options: shuffle([card.answer, ...distractors]), correct: card.answer, picked: null };
  };

  const buildTest = (source?: SetCard[]) => {
    const pool = (source && source.length > 0 ? source : cards);
    if (pool.length < 2) { toast.error('Necesitas al menos 2 tarjetas'); return; }
    const picked = shuffle(pool).slice(0, Math.min(8, pool.length));
    setTestQs(picked.map(card => makeMcq(card, pool)));
    setTestIdx(0); setTestDone(false); setTestWrongIds([]); setPhase('test');
  };

  // ---------- Contrarreloj ----------
  const startRush = () => {
    if (cards.length < 2) { toast.error('Necesitas al menos 2 tarjetas'); return; }
    setRushQs(shuffle(cards).slice(0, Math.min(8, cards.length)).map(card => makeMcq(card, cards)));
    setRushIdx(0); setRushTime(60); setRushScore(0); setRushStreak(0); setRushRight(0); setRushOver(false);
    setRushBest(() => { try { return Number(localStorage.getItem(rushBestKey)) || 0; } catch { return 0; } });
    setPhase('rush');
  };

  // Cuenta atrás + registro del récord
  useEffect(() => {
    if (phase !== 'rush' || rushOver) return;
    if (rushTime <= 0) {
      setRushOver(true);
      try {
        const prev = Number(localStorage.getItem(rushBestKey)) || 0;
        if (rushScore > prev) localStorage.setItem(rushBestKey, String(rushScore));
      } catch {}
      return;
    }
    const iv = setTimeout(() => setRushTime(t => t - 1), 1000);
    return () => clearTimeout(iv);
  }, [phase, rushTime, rushOver, rushScore, rushBestKey]);

  const pickRush = (q: TestQ, opt: string) => {
    if (q.picked || rushOver) return;
    const isRight = opt === q.correct;
    setRushQs(prev => prev.map((x, i) => i === rushIdx ? { ...x, picked: opt } : x));
    if (isRight) {
      setRushStreak(s => Math.min(5, s + 1));
      setRushScore(sc => sc + 100 * Math.min(5, rushStreak + 1));
      setRushRight(r => r + 1);
    } else {
      setRushStreak(0);
      setRushTime(t => Math.max(1, t - 3));
    }
    setTimeout(() => {
      if (rushIdx + 1 >= rushQs.length) {
        // Ronda extra con nuevas preguntas mientras quede tiempo
        setRushQs(prev => [...prev, ...shuffle(cards.filter(c => c.id !== q.card.id)).slice(0, Math.min(8, cards.length)).map(card => makeMcq(card, cards))]);
        setRushIdx(i => i + 1);
      } else {
        setRushIdx(i => i + 1);
      }
    }, isRight ? 240 : 500);
  };

  const pickOption = (q: TestQ, opt: string) => {
    if (q.picked) return;
    const isRight = opt === q.correct;
    setTestQs(prev => prev.map((x, i) => i === testIdx ? { ...x, picked: opt } : x));
    if (!isRight) setTestWrongIds(w => [...w, q.card.id]);
    setTimeout(() => {
      if (testIdx + 1 >= testQs.length) setTestDone(true);
      else setTestIdx(i => i + 1);
    }, 650);
  };

  // ---------- Emparejar ----------
  const startMatch = () => {
    if (cards.length < 2) { toast.error('Necesitas al menos 2 tarjetas'); return; }
    const pool = shuffle(cards).slice(0, Math.min(6, cards.length));
    const t: Tile[] = shuffle(pool.flatMap(c => ([
      { key: c.id + '-q', cardId: c.id, text: c.question, kind: 'q' as const },
      { key: c.id + '-a', cardId: c.id, text: c.answer, kind: 'a' as const },
    ])));
    resetSession(); setTiles(t); setPhase('match');
  };

  // cronómetro del emparejar
  useEffect(() => {
    if (phase !== 'match' || matchStart === null || matchDone) return;
    const iv = setInterval(() => setMatchTime(Math.floor((Date.now() - matchStart) / 1000)), 500);
    return () => clearInterval(iv);
  }, [phase, matchStart, matchDone]);

  const clickTile = (t: Tile) => {
    if (matched.has(t.cardId) || wrongPair.length > 0) return;
    if (matchStart === null) setMatchStart(Date.now());
    if (!picked) { setPicked(t); return; }
    if (picked.key === t.key) { setPicked(null); return; }
    if (picked.cardId === t.cardId && picked.kind !== t.kind) {
      const next = new Set(matched); next.add(t.cardId); setMatched(next); setPicked(null);
      if (next.size === Math.min(6, cards.length)) {
        setMatchDone(true);
        // Repaso ligero: marca las emparejadas como repasadas
        const now = Date.now();
        onChange(flashcards.map(c => next.has(c.id) ? { ...c, lastReviewed: now, nextReview: now + SRS_MS.good } : c));
      }
    } else {
      setWrongPair([picked.key, t.key]); setMatchFails(f => f + 1); setPicked(null);
      setTimeout(() => setWrongPair([]), 450);
    }
  };

  if (!open) return null;

  const setLabel = groupName || 'Todas las tarjetas del tema';

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100020, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 'min(880px, 100%)', maxHeight: '88vh', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
        animation: `studySetsIn 260ms ${EASE}`,
      }}>
        {/* ---------- Header ---------- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {phase !== 'home' && (
            <button onClick={() => { setPhase('home'); resetSession(); }}
              style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ChevronLeft size={14} />
            </button>
          )}
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {phase === 'match' ? <Shuffle size={15} style={{ color: MATCH_COLOR }} />
              : phase === 'rush' ? <Timer size={15} style={{ color: '#E11D48' }} />
              : phase === 'test' ? <ClipboardCheck size={15} style={{ color: TEST_COLOR }} />
              : <BookOpen size={15} style={{ color: CARD_COLOR }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
              {phase === 'cards' ? 'Estudiando' : phase === 'test' ? 'Prueba' : phase === 'match' ? 'Emparejar' : phase === 'rush' ? 'Contrarreloj' : 'Set de estudio'} · {topicTitle}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{setLabel}</div>
          </div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <style>{`@keyframes studySetsIn { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>

        {/* ---------- Body ---------- */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 24px' }}>
          {/* ===== HOME ===== */}
          {phase === 'home' && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <StatPill label="Tarjetas" value={cards.length} color={accent} />
                <StatPill label="Por repasar" value={dueCount} color="#F59E0B" />
                <StatPill label="Difíciles" value={hardCount} color="#EF4444" />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                <ToolButton icon={BookOpen} label="Estudiar" sub="Tarjetas con repetición espaciada" color={CARD_COLOR} onClick={startCards} disabled={cards.length === 0} />
                <ToolButton icon={ClipboardCheck} label="Prueba" sub="Opción múltiple generada del set" color={TEST_COLOR} onClick={() => buildTest()} disabled={cards.length < 2} />
                <ToolButton icon={Shuffle} label="Emparejar" sub="Une término con definición contra reloj" color={MATCH_COLOR} onClick={startMatch} disabled={cards.length < 2} />
                <ToolButton icon={Timer} label="Contrarreloj" sub="60s · racha x5 · récord guardado" color="#E11D48" onClick={startRush} disabled={cards.length < 2} />
              </div>

              {/* Lista + CRUD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                  <Search size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en el set…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
                <button onClick={() => { setBulkOpen(b => !b); setFormOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: `1px solid ${accent}30`, background: `${accent}0d`, cursor: 'pointer', color: accent, fontSize: 11, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>
                  <Upload size={12} /> Importar
                </button>
                <button onClick={openAdd}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: `1px solid ${accent}30`, background: `${accent}14`, cursor: 'pointer', color: accent, fontSize: 11, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                  <Plus size={13} /> Tarjeta
                </button>
              </div>

              {bulkOpen && (
                <div style={{ marginBottom: 12, padding: 14, borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Importar en bloque</div>
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={5}
                    placeholder={'Mitosis - Proceso de división celular en dos células hijas\nFotosíntesis - Conversión de luz en energía química'}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Una tarjeta por línea: <b>pregunta - respuesta</b>. Se añadirán al set actual.</span>
                    <button onClick={addBulk}
                      style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${accent}40`, background: `${accent}18`, color: accent, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                      Añadir {parseBulk(bulkText).filter(c => c.a).length > 0 ? `(${parseBulk(bulkText).filter(c => c.a).length})` : ''}
                    </button>
                  </div>
                </div>
              )}

              {formOpen && (
                <div style={{ marginBottom: 12, padding: 14, borderRadius: 14, border: `1px solid ${CARD_COLOR}30`, background: `${CARD_COLOR}08` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: CARD_COLOR, marginBottom: 10 }}>{editingId ? 'Editar tarjeta' : 'Nueva tarjeta'}</div>
                  <input value={fq} onChange={e => setFq(e.target.value)} placeholder="Pregunta / término"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
                  <textarea value={fa} onChange={e => setFa(e.target.value)} rows={2} placeholder="Respuesta / definición"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 12.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['facil', 'bueno', 'dificil'] as const).map(d => (
                        <button key={d} onClick={() => setFd(d)}
                          style={{ padding: '5px 11px', borderRadius: 8, border: `1px solid ${fd === d ? CARD_COLOR + '50' : 'var(--border-subtle)'}`, background: fd === d ? `${CARD_COLOR}18` : 'transparent', color: fd === d ? CARD_COLOR : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600, textTransform: 'capitalize' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setFormOpen(false); setEditingId(null); }}
                        style={{ padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Cancelar</button>
                      <button onClick={saveCard}
                        style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${CARD_COLOR}40`, background: `${CARD_COLOR}20`, color: CARD_COLOR, cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Check size={12} /> {editingId ? 'Guardar' : 'Añadir'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {visible.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, border: `1.5px dashed ${accent}30`, background: `${accent}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Plus size={20} style={{ color: accent, opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>
                    {cards.length === 0 ? 'Este set está vacío' : 'Sin resultados'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade tarjetas una a una o impórtalas en bloque.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visible.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', transition: 'border-color 150ms' }}>
                      <DifficultyDot d={c.difficulty} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.question}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.answer}</div>
                      </div>
                      {confirmDelId === c.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>¿Eliminar?</span>
                          <button onClick={() => deleteCard(c.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #EF444450', background: '#EF444414', color: '#EF4444', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Sí</button>
                          <button onClick={() => setConfirmDelId(null)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>No</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: 0.55 }}>
                          <button onClick={() => openEdit(c)} title="Editar" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}><Pencil size={12} /></button>
                          <button onClick={() => setConfirmDelId(c.id)} title="Eliminar" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF444440'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== ESTUDIAR (tarjetas) ===== */}
          {phase === 'cards' && (
            deck.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>No hay tarjetas.</div>
            ) : idx >= deck.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `${CARD_COLOR}12`, border: `1px solid ${CARD_COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={26} style={{ color: CARD_COLOR }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Sesión completada</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{stats.done} tarjetas repasadas · {stats.again} a repetir · {stats.easy} marcadas fáciles</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={startCards} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1px solid ${CARD_COLOR}40`, background: `${CARD_COLOR}14`, color: CARD_COLOR, cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
                    <RotateCcw size={13} /> Repetir sesión
                  </button>
                  <button onClick={() => { setPhase('home'); resetSession(); }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>Volver al set</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (idx / deck.length) * 100)}%`, height: '100%', borderRadius: 99, background: CARD_COLOR, transition: 'width 300ms ' + EASE }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx + 1} / {deck.length}</span>
                </div>
                <div onClick={() => setFlipped(f => !f)}
                  style={{
                    width: 'min(620px, 100%)', minHeight: 250, borderRadius: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '34px 40px', textAlign: 'center', gap: 12, transition: 'border-color 160ms, background 160ms',
                    border: flipped ? `1px solid ${MATCH_COLOR}44` : `1px solid ${CARD_COLOR}44`,
                    background: flipped ? `linear-gradient(150deg, ${MATCH_COLOR}0c, var(--bg-elevated))` : `linear-gradient(150deg, ${CARD_COLOR}10, var(--bg-elevated))`,
                  }}>
                  <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: flipped ? MATCH_COLOR : CARD_COLOR }}>
                    {flipped ? 'Respuesta' : 'Pregunta'}
                  </span>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.55, maxWidth: 520 }}>{flipped ? deck[idx]?.answer : deck[idx]?.question}</div>
                  <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 6 }}>{flipped ? 'Clic para volver a la pregunta' : 'Clic para revelar la respuesta'}</span>
                </div>
                {flipped && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {([
                      { g: 'again', label: 'Otra vez', sub: '10 min', color: '#EF4444' },
                      { g: 'hard', label: 'Difícil', sub: '1 día', color: '#F59E0B' },
                      { g: 'good', label: 'Bien', sub: '3 días', color: '#3B82F6' },
                      { g: 'easy', label: 'Fácil', sub: '7 días', color: '#10B981' },
                    ] as const).map(b => (
                      <button key={b.g} onClick={() => grade(b.g)}
                        style={{ minWidth: 104, padding: '10px 15px', borderRadius: 11, border: `1px solid ${b.color}30`, background: `${b.color}0d`, cursor: 'pointer', transition: 'all 130ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${b.color}1c`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${b.color}0d`; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: b.color }}>{b.label}</div>
                        <div style={{ fontSize: 8.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Próximo en {b.sub}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* ===== PRUEBA ===== */}
          {phase === 'test' && !testDone && testQs[testIdx] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {testQs.map((q, i) => (
                  <div key={q.card.id} style={{
                    flex: 1, height: 4, borderRadius: 99,
                    background: q.picked ? (q.picked === q.correct ? MATCH_COLOR : '#EF4444') : i === testIdx ? TEST_COLOR : 'var(--border-subtle)',
                    transition: 'background 250ms',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, textAlign: 'center', padding: '8px 10px 0' }}>{testQs[testIdx].card.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560, width: '100%', margin: '0 auto' }}>
                {testQs[testIdx].options.map(opt => {
                  const q = testQs[testIdx];
                  const isPicked = q.picked === opt;
                  const isCorrect = opt === q.correct;
                  const reveal = q.picked !== null;
                  const color = reveal && isCorrect ? MATCH_COLOR : isPicked ? '#EF4444' : 'var(--text-primary)';
                  const borderColor = reveal && isCorrect ? `${MATCH_COLOR}50` : isPicked ? '#EF444450' : 'var(--border-subtle)';
                  return (
                    <button key={opt} onClick={() => pickOption(q, opt)} disabled={reveal}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderRadius: 12, textAlign: 'left',
                        border: `1px solid ${borderColor}`, background: reveal && isCorrect ? `${MATCH_COLOR}0c` : isPicked ? '#EF44440c' : 'var(--bg-elevated)',
                        cursor: reveal ? 'default' : 'pointer', color, transition: 'all 150ms', fontSize: 12.5, fontWeight: 500,
                      }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${reveal && isCorrect ? MATCH_COLOR + '60' : isPicked ? '#EF444460' : 'var(--border-subtle)'}`,
                        fontSize: 9, fontWeight: 700,
                      }}>{reveal && isCorrect ? '✓' : isPicked ? '✕' : ''}</span>
                      <span style={{ flex: 1 }}>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === 'test' && testDone && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: testWrongIds.length === 0 ? MATCH_COLOR : TEST_COLOR, fontFamily: "'Inter Tight', sans-serif" }}>
                {Math.round(((testQs.length - testWrongIds.length) / Math.max(testQs.length, 1)) * 100)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{testQs.length - testWrongIds.length} de {testQs.length} correctas</div>
              {testWrongIds.length > 0 && (
                <div style={{ width: 'min(560px, 100%)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Para repasar</div>
                  {testQs.filter(q => testWrongIds.includes(q.card.id)).map(q => (
                    <div key={q.card.id} style={{ padding: '9px 13px', borderRadius: 11, border: '1px solid #EF444430', background: '#EF444408' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{q.card.question}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Respuesta: <b style={{ color: MATCH_COLOR }}>{q.card.answer}</b></div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {testWrongIds.length > 0 && (
                  <button onClick={() => buildTest(cards.filter(c => testWrongIds.includes(c.id)))}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1px solid ${TEST_COLOR}40`, background: `${TEST_COLOR}14`, color: TEST_COLOR, cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
                    <RotateCcw size={13} /> Reintentar fallos
                  </button>
                )}
                <button onClick={() => buildTest()} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>Nuevo test</button>
                <button onClick={() => { setPhase('home'); resetSession(); }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>Volver al set</button>
              </div>
            </div>
          )}

          {/* ===== EMPAREJAR ===== */}
          {phase === 'match' && (
            matchDone ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `${MATCH_COLOR}12`, border: `1px solid ${MATCH_COLOR}34`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Timer size={24} style={{ color: MATCH_COLOR }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¡Completado!</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{matchTime}s · {matchFails} errores</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={startMatch} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1px solid ${MATCH_COLOR}40`, background: `${MATCH_COLOR}14`, color: MATCH_COLOR, cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
                    <RotateCcw size={13} /> Jugar de nuevo
                  </button>
                  <button onClick={() => { setPhase('home'); resetSession(); }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>Volver al set</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Empareja cada término con su definición</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}><Timer size={12} /> {matchTime}s {matchFails > 0 && `· ${matchFails} errores`}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                  {tiles.map(t => {
                    const isMatched = matched.has(t.cardId);
                    const isPicked = picked?.key === t.key;
                    const isWrong = wrongPair.includes(t.key);
                    return (
                      <button key={t.key} onClick={() => clickTile(t)} disabled={isMatched}
                        style={{
                          padding: '13px 13px', borderRadius: 12, textAlign: 'left', minHeight: 64, display: 'flex', flexDirection: 'column', gap: 4,
                          border: isMatched ? `1px solid ${MATCH_COLOR}50` : isWrong ? '1px solid #EF444460' : isPicked ? `1px solid ${accent}70` : '1px solid var(--border-subtle)',
                          background: isMatched ? `${MATCH_COLOR}0c` : isWrong ? '#EF444412' : isPicked ? `${accent}10` : 'var(--bg-elevated)',
                          cursor: isMatched ? 'default' : 'pointer', transition: 'all 140ms', opacity: isMatched ? 0.55 : 1,
                          transform: isWrong ? 'translateX(2px)' : 'none',
                        }}>
                        <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.kind === 'q' ? accent : 'var(--text-tertiary)' }}>
                          {t.kind === 'q' ? 'Término' : 'Definición'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{t.text}</span>
                      </button>
                    );
                  })}
                </div>
                {cards.length > 6 && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>Ronda con {Math.min(6, cards.length)} pares al azar de {cards.length} tarjetas</div>}
              </div>
            )
          )}
          {/* ===== CONTRARRELOJ ===== */}
          {phase === 'rush' && !rushOver && rushQs[rushIdx] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#E11D48', fontFamily: "'Inter Tight', sans-serif", fontVariantNumeric: 'tabular-nums' }}>{rushScore} pts</span>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                  <div style={{ width: `${(rushTime / 60) * 100}%`, height: '100%', borderRadius: 99, background: rushTime <= 10 ? '#EF4444' : 'var(--accent)', transition: 'width 900ms linear' }} />
                </div>
                {rushStreak > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 9px', borderRadius: 99 }}>x{rushStreak} racha</span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: rushTime <= 10 ? '#EF4444' : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", fontVariantNumeric: 'tabular-nums' }}>{rushTime}s</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, textAlign: 'center', padding: '6px 10px 0' }}>{rushQs[rushIdx].card.question}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxWidth: 640, width: '100%', margin: '0 auto' }}>
                {rushQs[rushIdx].options.map(opt => {
                  const q = rushQs[rushIdx];
                  const isPicked = q.picked === opt;
                  const isCorrect = opt === q.correct;
                  const reveal = q.picked !== null;
                  return (
                    <button key={opt} onClick={() => pickRush(q, opt)} disabled={reveal}
                      style={{
                        padding: '11px 14px', borderRadius: 11, textAlign: 'left',
                        border: `1px solid ${reveal && isCorrect ? MATCH_COLOR + '50' : isPicked ? '#EF444450' : 'var(--border-subtle)'}`,
                        background: reveal && isCorrect ? `${MATCH_COLOR}0e` : isPicked ? '#EF44440c' : 'var(--bg-elevated)',
                        cursor: reveal ? 'default' : 'pointer', transition: 'all 140ms', fontSize: 12, fontWeight: 500,
                        color: reveal && isCorrect ? MATCH_COLOR : isPicked ? '#EF4444' : 'var(--text-primary)', minHeight: 44,
                      }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === 'rush' && rushOver && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', gap: 10 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#E11D48', fontFamily: "'Inter Tight', sans-serif" }}>{rushScore} pts</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{rushRight} aciertos · récord: {Math.max(rushBest, rushScore)} pts {rushScore >= rushBest && rushScore > 0 ? '· ¡Nuevo récord!' : ''}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={startRush} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(225,29,72,0.4)', background: 'rgba(225,29,72,0.12)', color: '#E11D48', cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
                  <RotateCcw size={13} /> Otra ronda
                </button>
                <button onClick={() => { setPhase('home'); resetSession(); }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>Volver al set</button>
              </div>
            </div>
          )}

        </div>

        {/* footer info */}
        {phase === 'home' && cards.length === 0 && groupName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px 14px', color: 'var(--text-tertiary)', fontSize: 10.5 }}>
            <AlertTriangle size={12} style={{ color: '#F59E0B', flexShrink: 0 }} />
            Las tarjetas que añadas quedarán dentro del grupo «{groupName}».
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
