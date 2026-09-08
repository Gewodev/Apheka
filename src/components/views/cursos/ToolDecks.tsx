import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { parseLines, shuffle, analyzeExplanation, adaptiveOrder, loadStats, saveStats, type DeckStat } from '../../../lib/deckParse';
import { createPortal } from 'react-dom';
import {
  X, HelpCircle, Shuffle, Check, ChevronLeft, ChevronRight, Plus,
  RotateCcw, Timer, Lightbulb, Pencil, AlertTriangle, Sparkles, Copy,
  Minus, ArrowLeft, ArrowRight, Eye, EyeOff, TrendingUp, CheckSquare, Layers, ClipboardList, Mic, ListOrdered, Shapes,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ═══════════════ Modelo: cada herramienta es UN bloque del tema ══════════════
export type ToolDeckMode = 'flashcardsDeck' | 'quizDeck' | 'matchDeck' | 'clozeDeck' | 'feynmanDeck' | 'vfDeck' | 'seqDeck' | 'catDeck';

export interface DeckCard { q: string; a: string }
export interface DeckQuestion { q: string; options: string[]; correct: number }
export interface DeckPair { a: string; b: string }
export interface DeckCloze { text: string; answers: string[] }
export interface DeckFeynman { concept: string; source?: string; points: string[] }
export interface DeckVF { text: string; answer: boolean }
export interface DeckSeq { name?: string; steps: string[] }
export interface DeckCat { item: string; cat: string }

export const DECK_META: Record<ToolDeckMode, { icon: any; label: string; color: string; hint: string; placeholder: string }> = {
  flashcardsDeck: {
    icon: Layers, label: 'Flashcards', color: '#8B5CF6',
    hint: 'Una tarjeta por línea: pregunta - respuesta. Todo vive dentro de un solo bloque.',
    placeholder: 'Mitosis - Proceso de división celular en dos células hijas\nBatalla de Ayacucho - Combate final de la independencia hispanoamericana\nH₂O - Molécula de agua: dos hidrógenos y un oxígeno',
  },
  quizDeck: {
    icon: HelpCircle, label: 'Prueba', color: '#F59E0B',
    hint: 'Una pregunta por línea, separando con barras |. Mínimo 2 alternativas, máximo 4.',
    placeholder: '¿Capital de Perú? | Lima | Quito | Bogotá | La Paz\n¿Quién formuló la relatividad? | Einstein | Newton | Bohr | Tesla\n¿Símbolo del hierro? | Fe | H | O | Au',
  },
  matchDeck: {
    icon: Shuffle, label: 'Emparejar', color: '#10B981',
    hint: 'Una pareja por línea: término - definición, fecha - evento, identidad - fórmula… (4 a 10 parejas).',
    placeholder: '1492 - Descubrimiento de América\nF = m·a - Segunda ley de Newton\nFotosíntesis - Conversión de luz en energía química',
  },
  clozeDeck: {
    icon: Pencil, label: 'Completar', color: '#3B82F6',
    hint: 'Un enunciado por línea, poniendo cada respuesta entre corchetes donde va el hueco: así [así] se genera.',
    placeholder: 'La mitosis produce [dos] células hijas idénticas\nLa Segunda Guerra Mundial terminó en [1945]\nEl símbolo del potasio es [K]',
  },
  feynmanDeck: {
    icon: Lightbulb, label: 'Feynman', color: '#EC4899',
    hint: 'Una línea por concepto: concepto | párrafo fuente | punto clave 1; punto clave 2; punto 3. El texto fuente alimenta la detección de coincidencias cuando expliques con tu voz.',
    placeholder: 'Fuerza | En física, una fuerza es toda interacción capaz de cambiar el movimiento de un cuerpo, deformarlo o modificar su estado de reposo. Se mide en newtons y su efecto depende de la masa y la aceleración del objeto, según la segunda ley de Newton. | Cambia el movimiento; se mide en newtons; F = m·a',
  },
  vfDeck: {
    icon: CheckSquare, label: 'Verdadero o Falso', color: '#06B6D4',
    hint: 'Una afirmación por línea: afirmación - V o F (acepta Verdadero/Falso). Mezcla ambas.',
    placeholder: 'La mitosis genera dos células idénticas - V\nEl agua hierve a 50 °C a nivel del mar - F\nLa Revolución Francesa comenzó en 1789 - V',
  },
  seqDeck: {
    icon: ListOrdered, label: 'Secuencias', color: '#F97316',
    hint: 'Una secuencia por línea con sus pasos en orden, separados por " > ". Al estudiar, los pasos llegan mezclados y debes tocarlos en orden.',
    placeholder: 'Fases de la mitosis > Profase > Metafase > Anafase > Telofase\nPasos del método científico > Observación > Hipótesis > Experimento > Conclusión',
  },
  catDeck: {
    icon: Shapes, label: 'Categorizar', color: '#A855F7',
    hint: 'Una línea por elemento: elemento - categoría. Las categorías se detectan solas y el juego te pide clasificar cada elemento.',
    placeholder: 'Ballena - Mamífero\nSalmón - Pez\nÁguila - Ave\nRana - Anfibio\nDelfín - Mamífero',
  },
};

const MT_SYMBOLS: [RegExp, string][] = [
  [new RegExp('\\\\times', 'g'), '×'],
  [new RegExp('\\\\div(?!i)', 'g'), '÷'],
  [new RegExp('\\\\cdot', 'g'), '·'],
  [new RegExp('\\\\pm', 'g'), '±'],
  [new RegExp('\\\\pi\\\\b', 'g'), 'π'],
  [new RegExp('\\\\alpha', 'g'), 'α'],
  [new RegExp('\\\\beta', 'g'), 'β'],
  [new RegExp('\\\\theta', 'g'), 'θ'],
  [new RegExp('\\\\lambda', 'g'), 'λ'],
  [new RegExp('\\\\mu', 'g'), 'μ'],
  [new RegExp('\\\\leq|\\\\le\\\\b', 'g'), '≤'],
  [new RegExp('\\\\geq|\\\\ge\\\\b', 'g'), '≥'],
  [new RegExp('\\\\neq|\\\\ne\\\\b', 'g'), '≠'],
  [new RegExp('\\\\approx', 'g'), '≈'],
  [new RegExp('\\\\infty', 'g'), '∞'],
  [new RegExp('\\\\int', 'g'), '∫'],
  [new RegExp('\\\\sum', 'g'), 'Σ'],
  [new RegExp('\\\\partial', 'g'), '∂'],
  [new RegExp('\\\\degree', 'g'), '°'],
  [new RegExp('\\\\sqrt', 'g'), '√'],
  [new RegExp('\\\\bsqrt\\\\b', 'g'), '√'],
  [new RegExp('\\\\rightarrow', 'g'), '→'],
  [new RegExp('\\\\Delta', 'g'), 'Δ'],
  [new RegExp('\\\\Omega', 'g'), 'Ω'],
];

export function MT({ t }: { t: string }) {
  if (!t) return null;
  let s = String(t);
  MT_SYMBOLS.forEach(([r, v]) => { s = s.replace(r, v); });
  const nodes: React.ReactNode[] = [];
  const re = new RegExp('\\^([^{}}]+)|_[{]([^}]+)[}]|\\^([^\s\^_]+)|_([^\s\^_]+)', 'g');
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) nodes.push(<React.Fragment key={k++}>{s.slice(last, m.index)}</React.Fragment>);
    if (m[1] || m[3]) nodes.push(<sup key={k++} style={{ fontSize: '0.7em', verticalAlign: 'super' }}>{m[1] || m[3]}</sup>);
    else nodes.push(<sub key={k++} style={{ fontSize: '0.7em', verticalAlign: 'sub' }}>{m[2] || m[4]}</sub>);
    last = re.lastIndex;
  }
  if (last < s.length) nodes.push(<React.Fragment key={k++}>{s.slice(last)}</React.Fragment>);
  return <>{nodes}</>;
}

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

const readDeck = (content?: string): any => { try { return JSON.parse(content || '{}'); } catch { return {}; } };
const deckItemCount = (mode: ToolDeckMode, content?: string): number => {
  const d = readDeck(content);
  if (mode === 'flashcardsDeck') return (d.cards || []).length;
  if (mode === 'quizDeck') return (d.questions || []).length;
  if (mode === 'matchDeck') return (d.pairs || []).length;
  if (mode === 'clozeDeck' || mode === 'vfDeck' || mode === 'catDeck') return (d.items || []).length;
  if (mode === 'seqDeck') return (d.seqs || []).length;
  return (d.concepts || []).length;
};

// ═════════════════ Generador de prompt especializado ═════════════════════════
function buildPrompt(mode: ToolDeckMode, tema: string, nivel: string, n: number, exclude: string[]): string {
  const fmt: Record<ToolDeckMode, string> = {
    flashcardsDeck: 'pregunta - respuesta',
    quizDeck: 'pregunta | alternativa correcta | incorrecta | incorrecta | incorrecta (usa mínimo 2 y máximo 4 alternativas)',
    matchDeck: 'término - definición',
    clozeDeck: 'enunciado con cada respuesta entre corchetes, así: La mitosis produce [dos células hijas]',
    feynmanDeck: 'concepto | párrafo fuente (texto real y específico de 80 a 120 palabras sobre el concepto) | punto clave 1; punto clave 2; punto clave 3 (entre 3 y 5)',
    vfDeck: 'afirmación - V (si es verdadera) o F (si es falsa)',
    seqDeck: 'nombre de la secuencia > paso 1 > paso 2 > paso 3 (mínimo 2 pasos, en el orden correcto)',
    catDeck: 'elemento - categoría',
  };
  const objetivo: Record<ToolDeckMode, string> = {
    flashcardsDeck: `${n} tarjetas de estudio (pregunta y respuesta corta y precisa)`,
    quizDeck: `${n} preguntas de alternativa con 1 correcta y 3 distractores plausibles pero claramente incorrectos`,
    matchDeck: `${n} parejas precisas y no ambiguas`,
    clozeDeck: `${n} enunciados con huecos de concepto clave (respuestas de 1 a 4 palabras)`,
    feynmanDeck: `${n} conceptos, cada uno con un párrafo fuente real, específico y riguroso (80 a 120 palabras) y entre 3 y 5 puntos esenciales`,
    vfDeck: `${n} afirmaciones de verdadero o falso, mezcladas, precisas y sin trampas evidentes`,
    seqDeck: `${n} secuencias ordenadas de pasos, etapas o eventos (entre 3 y 6 pasos cada una)`,
    catDeck: `${n} elementos con su categoría correcta, usando entre 2 y 4 categorías en total`,
  };
  let p = `Actúa como creador experto de material de estudio. Genera exactamente ${objetivo[mode]} sobre "${tema}" (nivel ${nivel}), en español.\n\n`;
  p += `REGLA DE ALCANCE: aborda EXCLUSIVAMENTE el tema "${tema}" tal como se nombra. No des historia, contexto previo ni temas relacionados que el título no pida directamente. Sé exacto, amplio únicamente dentro del tema y responde de frente a lo que el tema plantea.\n\n`;
  p += `FORMATO DE RESPUESTA OBLIGATORIO — una entrada por línea, exactamente así:\n${fmt[mode]}\n\n`;
  p += 'Reglas: sin numeración, sin viñetas, sin markdown, sin títulos, sin explicaciones adicionales. Responde SOLO con las líneas en el formato indicado.';
  if (exclude.length > 0) p += `\n\nNo incluyas ni repitas estos temas que ya existen:\n${exclude.map(e => `- ${e}`).join('\n')}`;
  return p;
}

function PromptPanel({ mode, accent, defaults, exclude }: { mode: ToolDeckMode; accent: string; defaults: { tema: string }; exclude: string[] }) {
  const [tema, setTema] = useState(defaults.tema);
  const [nivel, setNivel] = useState('intermedio');
  const [n, setN] = useState(10);
  const [useExclude, setUseExclude] = useState(exclude.length > 0);
  const [copied, setCopied] = useState(false);
  const prompt = buildPrompt(mode, tema.trim() || defaults.tema, nivel, n, useExclude ? exclude : []);
  const copy = () => {
    navigator.clipboard.writeText(prompt)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1700); })
      .catch(() => toast.error('No se pudo copiar'));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={11} style={{ color: accent }} /> Generar contenido
      </div>
      <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Tema a investigar"
        style={{ width: '100%', boxSizing: 'border-box', height: 34, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 12, padding: '0 12px', outline: 'none' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={nivel} onChange={e => setNivel(e.target.value)}
          style={{ flex: 1, height: 34, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 12, padding: '0 10px', outline: 'none', cursor: 'pointer', colorScheme: 'dark' }}>
          <option value="básico">Básico</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzado">Avanzado</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 34, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', padding: '0 6px' }}>
          <button onClick={() => setN(v => Math.max(3, v - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>−</button>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
          <button onClick={() => setN(v => Math.min(30, v + 1))} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>+</button>
        </div>
      </div>
      {exclude.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={useExclude} onChange={e => setUseExclude(e.target.checked)} style={{ accentColor: accent }} />
          Sin considerar los {exclude.length} tema(s) ya creados
        </label>
      )}
      <button onClick={copy}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 9, border: 'none', background: copied ? '#10B981' : accent, color: '#0B0C0F', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", transition: 'background 200ms' }}>
        {copied ? <><Check size={13} /> ¡Copiado!</> : <><Copy size={12} /> Copiar prompt</>}
      </button>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Envíalo a cualquier IA y pega su respuesta en el campo de abajo.</div>
    </div>
  );
}

// ═════════════════════ Wizard de creación / edición (2 pasos) ════════════════
export function DeckEditorModal({ mode, accent, initialName, initialColor, initialContent, onClose, onSave }: {
  mode: ToolDeckMode; accent: string; initialName?: string; initialColor?: string; initialContent?: string;
  onClose: () => void; onSave: (name: string, color: string, content: string) => void;
}) {
  const meta = DECK_META[mode];
  const isEdit = !!initialContent;
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
  const [name, setName] = useState(initialName || '');
  const [color, setColor] = useState(initialColor || meta.color);
  const [text, setText] = useState(() => {
    if (!initialContent) return '';
    const d = readDeck(initialContent);
    if (mode === 'flashcardsDeck') return (d.cards as DeckCard[] || []).map(c => `${c.q} - ${c.a}`).join('\n');
    if (mode === 'quizDeck') return (d.questions as DeckQuestion[] || []).map(qq => `${qq.q} | ${qq.options[qq.correct]} | ${qq.options.filter((_, i) => i !== qq.correct).join(' | ')}`).join('\n');
    if (mode === 'matchDeck') return (d.pairs as DeckPair[] || []).map(p => `${p.a} - ${p.b}`).join('\n');
    if (mode === 'clozeDeck') return (d.items as DeckCloze[] || []).map(c => c.text).join('\n');
    if (mode === 'vfDeck') return (d.items as DeckVF[] || []).map(it => `${it.text} - ${it.answer ? 'V' : 'F'}`).join('\n');
    if (mode === 'seqDeck') return (d.seqs as DeckSeq[] || []).map(s => s.steps.join(' > ')).join('\n');
    if (mode === 'catDeck') return (d.items as DeckCat[] || []).map(it => `${it.item} - ${it.cat}`).join('\n');
    return (d.concepts as DeckFeynman[] || []).map(c => c.source ? `${c.concept} | ${c.source} | ${c.points.join('; ')}` : `${c.concept} - ${c.points.join('; ')}`).join('\n');
  });
  const [showPrompt, setShowPrompt] = useState(false);
  const parsed = useMemo(() => parseLines(mode, text), [mode, text]);
  const minCount = mode === 'matchDeck' ? 2 : 1;
  const valid = parsed.ok.length >= minCount;
  // Conceptos ya existentes para el prompt de edición (no repetir)
  const existingNames = useMemo(() => {
    if (!isEdit) return [];
    return parsed.ok.map((e: any) => e.q || e.a || e.concept || e.text || '').filter(Boolean).slice(0, 40);
  }, [isEdit, parsed]);

  const ICON = meta.icon;
  // Paleta para ciclar haciendo clic sobre el icono de la herramienta
  const PALETTE = [meta.color, '#E11D48', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#E8E8EA'];
  const cycleColor = () => {
    const i = PALETTE.indexOf(color);
    setColor(PALETTE[(i + 1) % PALETTE.length]);
  };
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100030, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(560px, 94vw)', maxHeight: '90vh', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 30px 90px rgba(0,0,0,0.55)', animation: `deckIn 240ms ${EASE}` }}>
        <style>{`@keyframes deckIn { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
        {/* Header compacto: icono (clic = color) al costado del nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 20px 13px', borderBottom: '1px solid var(--border-subtle)', background: `linear-gradient(180deg, ${color}06, transparent)` }}>
          <button onClick={cycleColor} title="Cambiar color del bloque (clic para ciclar)"
            style={{ width: 52, height: 52, borderRadius: 14, background: `${color}12`, border: `1.5px solid ${color}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: `all 200ms ${EASE}` }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            <ICON size={23} style={{ color }} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 3 }}>Herramienta · {meta.label}</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del bloque" autoFocus={step === 1}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Inter Tight', sans-serif", borderBottom: '1px dashed var(--border-subtle)', padding: '2px 0' }} />
          </div>
          {step === 2 && (
            <button onClick={() => setShowPrompt(v => !v)} title="Generar contenido"
              style={{ width: 34, height: 34, borderRadius: 10, border: showPrompt ? `1px solid ${color}55` : '1px solid var(--border-subtle)', background: showPrompt ? `${color}12` : 'transparent', color: showPrompt ? color : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ClipboardList size={15} />
            </button>
          )}
        </div>

        {step === 1 ? (
          <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setStep(2)} disabled={!name.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 22px', borderRadius: 10, border: 'none', background: name.trim() ? color : 'var(--border-subtle)', color: name.trim() ? '#0B0C0F' : 'var(--text-muted)', cursor: name.trim() ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", opacity: name.trim() ? 1 : 0.6 }}>
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 22px 20px', overflowY: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: parsed.bad > 0 ? '#F59E0B' : 'var(--text-tertiary)' }}>
                {parsed.ok.length} entrada(s){parsed.bad > 0 ? ` · ${parsed.bad} con formato inválido` : ''}
              </span>
            </div>
            {showPrompt && (
              <div style={{ position: 'absolute', top: 8, right: 22, zIndex: 30, width: 'min(430px, 92vw)', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.55)', animation: `deckIn 180ms ${EASE}` }}>
                <PromptPanel mode={mode} accent={color} defaults={{ tema: name }} exclude={existingNames} />
              </div>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} rows={11} placeholder={meta.placeholder}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, color: 'var(--text-primary)', fontSize: 12.5, lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { if (!valid) { toast.error(parsed.ok.length === 0 ? 'Añade al menos una entrada' : `Mínimo ${minCount} parejas para emparejar`); return; } onSave(name.trim() || meta.label, color, JSON.stringify(mode === 'flashcardsDeck' ? { cards: parsed.ok } : mode === 'quizDeck' ? { questions: parsed.ok } : mode === 'matchDeck' ? { pairs: parsed.ok } : mode === 'clozeDeck' ? { items: parsed.ok } : mode === 'vfDeck' ? { items: parsed.ok } : mode === 'seqDeck' ? { seqs: parsed.ok } : mode === 'catDeck' ? { items: parsed.ok } : { concepts: parsed.ok })); }}
                disabled={!valid}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, border: 'none', background: valid ? color : 'var(--border-subtle)', color: valid ? '#0B0C0F' : 'var(--text-muted)', cursor: valid ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                <Check size={13} /> Guardar bloque
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ═════════════════════ EJECUTOR (dentro del panel o ventana) ═════════════════
interface DeckRunnerProps {
  mat: { id: string; toolMode?: string; name?: string; title?: string; content?: string };
  accent: string;
  onClose: () => void;
}

export function DeckRunner({ mat, accent, onClose }: DeckRunnerProps) {
  const mode = (mat.toolMode || 'flashcardsDeck') as ToolDeckMode;
  const meta = DECK_META[mode];
  const data = readDeck(mat.content);
  const blockColor = (mat as any).color || meta.color;

  const body =
    mode === 'flashcardsDeck' ? <FlashcardsRun cards={(data.cards || []) as DeckCard[]} matId={mat.id} color={blockColor} accent={accent} /> :
    mode === 'quizDeck' ? <QuizRun questions={(data.questions || []) as DeckQuestion[]} matId={mat.id} color={blockColor} accent={accent} /> :
    mode === 'matchDeck' ? <MatchRun pairs={(data.pairs || []) as DeckPair[]} matId={mat.id} color={blockColor} accent={accent} /> :
    mode === 'clozeDeck' ? <ClozeRun items={(data.items || []) as DeckCloze[]} matId={mat.id} color={blockColor} accent={accent} /> :
    mode === 'vfDeck' ? <VFRun items={(data.items || []) as DeckVF[]} matId={mat.id} color={blockColor} accent={accent} /> :
    mode === 'seqDeck' ? <SeqRun seqs={(data.seqs || []) as DeckSeq[]} matId={mat.id} color={blockColor} accent={accent} /> :
    mode === 'catDeck' ? <CatRun items={(data.items || []) as DeckCat[]} matId={mat.id} color={blockColor} accent={accent} /> :
    <FeynmanRun concepts={(data.concepts || []) as DeckFeynman[]} matId={mat.id} color={blockColor} accent={accent} />;

  // ── Dentro del panel: fondo con el icono difuminado + nombre gigante tenue ──
  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Fondo: icono grande difuminado + nombre gigante tenue */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <meta.icon size={360} style={{ color: blockColor, opacity: 0.09, filter: 'blur(1.5px)', position: 'absolute' }} />
        <span style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 92, fontWeight: 700, letterSpacing: '0.04em', color: blockColor, opacity: 0.06, whiteSpace: 'nowrap', fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase' }}>{meta.label}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px 26px', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
        {body}
      </div>
    </div>
  );
}


// ── Panel de estadísticas final (compartido) ─────────────────────────────────
function StatsPanel({ right, wrong, weakest, color, onAgain, onWrongOnly, onClose }: {
  right: number; wrong: number; weakest: string[]; color: string;
  onAgain: () => void; onWrongOnly?: () => void; onClose: () => void;
}) {
  const total = right + wrong;
  const pctRound = total > 0 ? Math.round((right / total) * 100) : 0;
  const ringColor = pctRound >= 70 ? '#10B981' : pctRound >= 40 ? color : '#EF4444';
  const C = 2 * Math.PI * 52;
  const verdict = pctRound >= 70 ? 'Excelente dominio' : pctRound >= 40 ? 'Vas por buen camino' : 'Necesitas repasar';
  return (
    <div style={{ width: '100%', maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Resumen: anillo + veredicto a la izquierda, contadores a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 26, alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
          <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-subtle)" strokeWidth="7" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={`${(pctRound / 100) * C} ${C}`} style={{ transition: 'stroke-dasharray 700ms ' + EASE }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.03em', lineHeight: 1 }}>{pctRound}%</span>
            <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginTop: 6 }}>aciertos</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Resultado de la sesión</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ringColor, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.15 }}>{verdict}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 130px', padding: '13px 18px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.28)', background: 'rgba(16,185,129,0.06)' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#10B981', fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>{right}</div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginTop: 5 }}>Conseguidas</div>
            </div>
            <div style={{ flex: '1 1 130px', padding: '13px 18px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#EF4444', fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>{wrong}</div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginTop: 5 }}>Falladas</div>
            </div>
          </div>
        </div>
      </div>
      {/* Para reforzar: lista a ancho completo */}
      {weakest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={11} /> Para reforzar
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 7 }}>
            {weakest.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><MT t={w} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Acciones a ancho completo */}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <button onClick={onAgain} style={{ flex: '1 1 190px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 18px', borderRadius: 12, border: `1px solid ${color}40`, background: `${color}12`, color, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", transition: `all 160ms ${EASE}` }}
          onMouseEnter={e => { e.currentTarget.style.background = `${color}20`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.transform = 'none'; }}>
          <RotateCcw size={14} /> Repetir (adaptativo)
        </button>
        {onWrongOnly && wrong > 0 && (
          <button onClick={onWrongOnly} style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
            Solo las falladas
          </button>
        )}
        <button onClick={onClose} style={{ flex: '1 1 130px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          Terminar
        </button>
      </div>
    </div>
  );
}

function EmptyRun({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10 }}>
      <AlertTriangle size={24} style={{ color, opacity: 0.5 }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

// ── FLASHCARDS: clásica + autoevaluación + adaptativo ────────────────────────
function FlashcardsRun({ cards, matId, color, accent }: { cards: DeckCard[]; matId: string; color: string; accent: string }) {
  const [stats, setStats] = useState<Record<string, DeckStat>>(() => loadStats(matId));
  const [queue, setQueue] = useState<number[]>(() => adaptiveOrder(cards.length, loadStats(matId)));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState({ right: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [wrongList, setWrongList] = useState<number[]>([]);
  const card = cards[queue[pos]];
  if (!card) return <EmptyRun label="Este bloque no tiene tarjetas" color={color} />;

  const grade = (ok: boolean) => {
    const idx = queue[pos];
    const s = { ...stats, [idx]: { r: (stats[idx]?.r || 0) + (ok ? 1 : 0), w: (stats[idx]?.w || 0) + (ok ? 0 : 1) } };
    setStats(s); saveStats(matId, s);
    if (ok) setSession(v => ({ ...v, right: v.right + 1 }));
    else { setSession(v => ({ ...v, wrong: v.wrong + 1 })); setWrongList(l => l.includes(idx) ? l : [...l, idx]); }
    setFlipped(false);
    setTimeout(() => {
      if (pos + 1 >= queue.length) { setDone(true); return; }
      // Lo fallado se re-encola al final de la misma sesión
      if (!ok) setQueue(q => [...q, idx]);
      setPos(p => p + 1);
    }, 180);
  };
  const move = (d: number) => { setFlipped(false); setTimeout(() => setPos(p => Math.min(queue.length - 1, Math.max(0, p + d))), flipped ? 150 : 0); };
  // Navegación con teclado: izquierda/derecha cambian de tarjeta, Espacio voltea
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const weakest = wrongList.slice(0, 4).map(i => cards[i]?.q || '').filter(Boolean);

  if (done) {
    return <StatsPanel right={session.right} wrong={session.wrong} weakest={weakest} color={color}
      onAgain={() => { const q = adaptiveOrder(cards.length, stats); setQueue(q); setPos(0); setSession({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onWrongOnly={() => { const q = shuffle(wrongList); setQueue(q); setPos(0); setSession({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onClose={() => { }} />;
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ width: `${((pos + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 300ms ' + EASE }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{pos + 1} / {queue.length}</span>
        <button onClick={() => { const q = shuffle(queue); setQueue(q); setPos(0); setFlipped(false); }} title="Mezclar"
          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shuffle size={12} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center' }}>
        <button onClick={() => move(-1)} disabled={pos === 0} title="Anterior"
          style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: pos === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: pos === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: pos === 0 ? 0.4 : 1, transition: 'all 160ms ' + EASE }}>
          <ArrowLeft size={18} />
        </button>
        <div onClick={() => setFlipped(f => !f)}
          style={{
            width: '100%', minHeight: 400, borderRadius: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '44px 52px', textAlign: 'center', gap: 16, transition: 'border-color 180ms, background 180ms, transform 180ms ' + EASE,
            border: `1px solid ${flipped ? '#10B98140' : color + '3c'}`,
            background: flipped ? 'linear-gradient(155deg, rgba(16,185,129,0.06), var(--bg-elevated))' : `linear-gradient(155deg, ${color}0c, var(--bg-elevated))`,
          }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: flipped ? '#10B981' : color }}>
            {flipped ? 'Respuesta' : 'Pregunta'}
          </span>
          <div style={{ fontSize: 29, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.5, maxWidth: 700, fontFamily: "'Inter Tight', sans-serif" }}><MT t={flipped ? card.a : card.q} /></div>
        </div>
        <button onClick={() => move(1)} disabled={pos >= queue.length - 1} title="Siguiente"
          style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${color}40`, background: `${color}10`, color, cursor: pos >= queue.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: pos >= queue.length - 1 ? 0.4 : 1, transition: 'all 160ms ' + EASE }}>
          <ArrowRight size={18} />
        </button>
      </div>
      {/* Autoevaluación elegante bajo la tarjeta */}
      {flipped && (
        <div style={{ display: 'flex', gap: 10, width: 'min(660px, 100%)', animation: `deckIn 200ms ${EASE}` }}>
          <button onClick={() => grade(true)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: 13, border: '1px solid rgba(16,185,129,0.32)', background: 'rgba(16,185,129,0.07)', color: '#10B981', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", transition: `all 160ms ${EASE}` }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.07)'; e.currentTarget.style.transform = 'none'; }}>
            <Check size={14} /> Lo conseguiste
          </button>
          <button onClick={() => grade(false)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: 13, border: '1px solid rgba(239,68,68,0.32)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", transition: `all 160ms ${EASE}` }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.13)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.transform = 'none'; }}>
            <X size={14} /> No lo conseguiste
          </button>
        </div>
      )}
    </div>
  );
}

// ── PRUEBA: pregunta grande arriba + alternativas abajo ──────────────────────
function QuizRun({ questions, matId, color, accent }: { questions: DeckQuestion[]; matId: string; color: string; accent: string }) {
  const valid = questions.filter(q => q.q && q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length);
  const [seed, setSeed] = useState(0);
  const stats0 = useRef(loadStats(matId));
  const order = useMemo(() => { stats0.current = loadStats(matId); return adaptiveOrder(valid.length, stats0.current); }, [seed, valid.length, matId]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [wrongList, setWrongList] = useState<number[]>([]);
  const [liveStats, setLiveStats] = useState<Record<string, DeckStat>>(() => loadStats(matId));
  const q = valid[order[idx]];
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.correct;
    const s = { ...liveStats, [order[idx]]: { r: (liveStats[order[idx]]?.r || 0) + (ok ? 1 : 0), w: (liveStats[order[idx]]?.w || 0) + (ok ? 0 : 1) } };
    setLiveStats(s); saveStats(matId, s);
    if (ok) setScore(v => ({ ...v, right: v.right + 1 }));
    else { setScore(v => ({ ...v, wrong: v.wrong + 1 })); setWrongList(l => l.includes(order[idx]) ? l : [...l, order[idx]]); }
    setTimeout(() => {
      if (idx + 1 >= order.length) setDone(true);
      else { setIdx(x => x + 1); setPicked(null); }
    }, 850);
  };
  const weakest = wrongList.slice(0, 4).map(i => valid[i]?.q || '').filter(Boolean);
  if (valid.length === 0) return <EmptyRun label="Este bloque no tiene preguntas válidas" color={color} />;
  if (done) {
    return <StatsPanel right={score.right} wrong={score.wrong} weakest={weakest} color={color}
      onAgain={() => { setSeed(s => s + 1); setIdx(0); setPicked(null); setScore({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onWrongOnly={() => { setWrongList([]); setIdx(0); setPicked(null); setScore({ right: 0, wrong: 0 }); setDone(false); setOrder2(wrongList); }}
      onClose={() => { }} />;
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ width: `${((idx + 1) / order.length) * 100}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 300ms ' + EASE }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {order.length}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}10`, border: `1px solid ${color}26`, padding: '3px 10px', borderRadius: 99 }}>{score.right} aciertos</span>
      </div>
      <div style={{ borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 38px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}><MT t={q.q} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, width: '100%' }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct;
          const isPicked = picked === i;
          const reveal = picked !== null;
          const state = reveal && isCorrect ? 'ok' : isPicked ? 'bad' : 'idle';
          const c = state === 'ok' ? '#10B981' : state === 'bad' ? '#EF4444' : 'var(--text-primary)';
          return (
            <button key={i} onClick={() => pick(i)} disabled={reveal}
              style={{
                minHeight: 122, borderRadius: 15, padding: '20px 22px', textAlign: 'left', position: 'relative',
                border: `1px solid ${state === 'ok' ? '#10B98155' : state === 'bad' ? '#EF444455' : 'var(--border-subtle)'}`,
                background: state === 'ok' ? 'rgba(16,185,129,0.08)' : state === 'bad' ? 'rgba(239,68,68,0.07)' : 'var(--bg-deep)',
                color: c, cursor: reveal ? 'default' : 'pointer', transition: `all 180ms ${EASE}`,
                display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between',
                opacity: reveal && !isCorrect && !isPicked ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!reveal) { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
              onMouseLeave={e => { if (!reveal) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none'; } }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.55 }}><MT t={opt} /></div>
              {state !== 'idle' && (
                <span style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: state === 'ok' ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.14)' }}>
                  {state === 'ok' ? <Check size={13} color="#10B981" /> : <X size={13} color="#EF4444" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
  function setOrder2(list: number[]) { /* sustituido por seed-based rerun */ setSeed(s => s + 1); }
}

// ── VERDADERO O FALSO: afirmación grande + dos bloques de respuesta ──────────
function VFRun({ items, matId, color, accent }: { items: DeckVF[]; matId: string; color: string; accent: string }) {
  const valid = items.filter(it => it.text && typeof it.answer === 'boolean');
  const [seed, setSeed] = useState(0);
  const order = useMemo(() => adaptiveOrder(valid.length, loadStats(matId)), [seed, valid.length, matId]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [wrongList, setWrongList] = useState<number[]>([]);
  const it = valid[order[idx]];
  const answer = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    const ok = v === it.answer;
    const st = loadStats(matId);
    st[order[idx]] = { r: (st[order[idx]]?.r || 0) + (ok ? 1 : 0), w: (st[order[idx]]?.w || 0) + (ok ? 0 : 1) };
    saveStats(matId, st);
    if (ok) setScore(s => ({ ...s, right: s.right + 1 }));
    else { setScore(s => ({ ...s, wrong: s.wrong + 1 })); setWrongList(l => l.includes(order[idx]) ? l : [...l, order[idx]]); }
    setTimeout(() => {
      if (idx + 1 >= order.length) setDone(true);
      else { setIdx(x => x + 1); setPicked(null); }
    }, 800);
  };
  const weakest = wrongList.slice(0, 4).map(i => valid[i]?.text.slice(0, 80) || '').filter(Boolean);
  if (valid.length === 0) return <EmptyRun label="Este bloque no tiene afirmaciones" color={color} />;
  if (done) {
    return <StatsPanel right={score.right} wrong={score.wrong} weakest={weakest} color={color}
      onAgain={() => { setSeed(s => s + 1); setIdx(0); setPicked(null); setScore({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onWrongOnly={() => { setWrongList([]); setIdx(0); setPicked(null); setScore({ right: 0, wrong: 0 }); setDone(false); }}
      onClose={() => { }} />;
  }
  const state = picked === null ? 'idle' : picked === it.answer ? 'ok' : 'bad';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ width: `${((idx + 1) / order.length) * 100}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 300ms ' + EASE }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {order.length}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}10`, border: `1px solid ${color}26`, padding: '3px 10px', borderRadius: 99 }}>{score.right} aciertos</span>
      </div>
      <div style={{ borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', flex: 1, minHeight: 165, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 42px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.55, fontFamily: "'Inter Tight', sans-serif" }}><MT t={it.text} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {([true, false] as const).map(v => {
          const isThis = picked === v;
          const isCorrect = it.answer === v;
          const reveal = picked !== null;
          const st = reveal && isCorrect ? 'ok' : isThis ? 'bad' : 'idle';
          const c = st === 'ok' ? '#10B981' : st === 'bad' ? '#EF4444' : 'var(--text-primary)';
          return (
            <button key={String(v)} onClick={() => answer(v)} disabled={reveal}
              style={{
                height: 72, borderRadius: 14, border: `1px solid ${st === 'ok' ? '#10B98155' : st === 'bad' ? '#EF444455' : 'var(--border-subtle)'}`,
                background: st === 'ok' ? 'rgba(16,185,129,0.08)' : st === 'bad' ? 'rgba(239,68,68,0.07)' : 'var(--bg-deep)',
                color: c, cursor: reveal ? 'default' : 'pointer', transition: `all 180ms ${EASE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif",
                opacity: reveal && !isCorrect && !isThis ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!reveal) e.currentTarget.style.borderColor = `${accent}55`; }}
              onMouseLeave={e => { if (!reveal) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
              {st === 'ok' && <Check size={15} color="#10B981" />}
              {st === 'bad' && <X size={15} color="#EF4444" />}
              {v ? 'Verdadero' : 'Falso'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── EMPAREJAR: primero se presentan 4s, luego se voltean y empieza ───────────
function MatchRun({ pairs, matId, color, accent }: { pairs: DeckPair[]; matId: string; color: string; accent: string }) {
  const [seed, setSeed] = useState(0);
  const tiles = useMemo(() => {
    const ps = shuffle(pairs).slice(0, 10);
    return shuffle(ps.flatMap((p, i) => ([
      { key: i + '-a', pairId: i, text: p.a, kind: 'a' as const },
      { key: i + '-b', pairId: i, text: p.b, kind: 'b' as const },
    ])));
  }, [seed, pairs]);
  const total = tiles.length / 2;
  const [phase, setPhase] = useState<'preview' | 'play'>('preview');
  const [previewLeft, setPreviewLeft] = useState(4);
  const [flippedKeys, setFlippedKeys] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<number>>(new Set());
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);

  // Fase de presentación: 4s con todo boca arriba para memorizar
  useEffect(() => {
    if (phase !== 'preview') return;
    if (previewLeft <= 0) { setPhase('play'); setFlippedKeys([]); return; }
    const t = setTimeout(() => setPreviewLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, previewLeft]);

  useEffect(() => {
    if (phase !== 'play' || done) return;
    const iv = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase, done]);

  const flip = (t: { key: string; pairId: number }) => {
    if (phase !== 'play' || done || matchedIds.has(t.pairId) || flippedKeys.includes(t.key) || wrongKeys.length > 0) return;
    const next = [...flippedKeys, t.key];
    setFlippedKeys(next);
    if (next.length < 2) return;
    setAttempts(a => a + 1);
    const first = tiles.find(x => x.key === next[0])!;
    const second = tiles.find(x => x.key === next[1])!;
    if (first.pairId === second.pairId) {
      const m = new Set(matchedIds); m.add(first.pairId); setMatchedIds(m); setFlippedKeys([]);
      const st = loadStats(matId);
      st[first.pairId] = { r: (st[first.pairId]?.r || 0) + 1, w: st[first.pairId]?.w || 0 };
      saveStats(matId, st);
      if (m.size === total) setDone(true);
    } else {
      setWrongKeys(next);
      setTimeout(() => { setWrongKeys([]); setFlippedKeys([]); }, 750);
    }
  };
  if (total < 2) return <EmptyRun label="Añade al menos 2 parejas para jugar" color={color} />;
  if (done) {
    return <StatsPanel right={total} wrong={attempts - total < 0 ? 0 : attempts - total} weakest={[]} color={color}
      onAgain={() => { setSeed(s => s + 1); setPhase('preview'); setPreviewLeft(4); setFlippedKeys([]); setMatchedIds(new Set()); setWrongKeys([]); setAttempts(0); setSeconds(0); setDone(false); }}
      onClose={() => { }} />;
  }
  const isOpen = (pairId: number, key: string) => phase === 'preview' || matchedIds.has(pairId) || flippedKeys.includes(key);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {phase === 'preview' ? <><Eye size={12} style={{ color }} /> Memoriza las parejas… se voltearán en {previewLeft}s</> : <><EyeOff size={12} /> Voltea las fichas y une cada pareja</>}
        </span>
        {phase === 'play' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              <Timer size={10} style={{ color: 'var(--text-muted)' }} /> {seconds}s
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, border: '1px solid rgba(16,185,129,0.28)', background: 'rgba(16,185,129,0.07)', fontSize: 10.5, fontWeight: 700, color: '#10B981', fontVariantNumeric: 'tabular-nums' }}>
              {matchedIds.size}/{total} parejas
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {attempts} intentos
            </span>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 9, flex: 1, alignContent: 'stretch', gridAutoRows: '1fr' }}>
        {tiles.map(t => {
          const open = isOpen(t.pairId, t.key);
          const isWrong = wrongKeys.includes(t.key);
          const isMatched = matchedIds.has(t.pairId);
          return (
            <button key={t.key} onClick={() => flip(t)} disabled={phase === 'preview' || isMatched}
              style={{ minHeight: 112, height: '100%', perspective: 900, background: 'transparent', border: 'none', padding: 0, cursor: phase === 'preview' ? 'default' : isMatched ? 'default' : 'pointer' }}>
              <div style={{
                transform: open ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 460ms cubic-bezier(0.2,0.8,0.25,1)',
                transformStyle: 'preserve-3d', position: 'relative', minHeight: 112, height: '100%',
              }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 13, backfaceVisibility: 'hidden', border: `1px solid ${isWrong ? '#EF444460' : 'var(--border-subtle)'}`, background: isWrong ? 'rgba(239,68,68,0.08)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text-muted)', opacity: 0.4 }}>OWA</span>
                </div>
                <div style={{
                  borderRadius: 13, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0, padding: '12px 14px',
                  border: `1px solid ${isMatched ? '#10B98155' : accent + '42'}`,
                  background: isMatched ? 'rgba(16,185,129,0.08)' : `${accent}0b`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: isMatched ? 0.72 : 1,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}><MT t={t.text} /></span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SECUENCIAS: los pasos llegan mezclados y los tocas en orden ──────────────
function SeqRun({ seqs, matId, color, accent }: { seqs: DeckSeq[]; matId: string; color: string; accent: string }) {
  const valid = seqs.filter(s => s.steps && s.steps.length >= 2);
  const [seed, setSeed] = useState(0);
  const order = useMemo(() => adaptiveOrder(valid.length, loadStats(matId)), [seed, valid.length, matId]);
  const [idx, setIdx] = useState(0);
  const [tiles, setTiles] = useState<string[]>([]);
  const [pickedCount, setPickedCount] = useState(0);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [wrongList, setWrongList] = useState<number[]>([]);
  const seq = valid[order[idx]];

  useEffect(() => {
    if (!seq) return;
    setTiles(shuffle(seq.steps));
    setPickedCount(0); setWrongTile(null);
  }, [seq?.steps[0] + '|' + (seq?.steps.length || 0), seed]);

  if (valid.length === 0) return <EmptyRun label="Este bloque no tiene secuencias" color={color} />;
  if (done) {
    const weakest = wrongList.slice(0, 4).map(i => valid[i]?.steps.join(' → ').slice(0, 90) || '').filter(Boolean);
    return <StatsPanel right={score.right} wrong={score.wrong} weakest={weakest} color={color}
      onAgain={() => { setSeed(s => s + 1); setIdx(0); setScore({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onClose={() => { }} />;
  }
  if (!seq) return null;

  const tap = (ti: number) => {
    if (wrongTile !== null || pickedCount >= seq.steps.length) return;
    if (tiles[ti] === seq.steps[pickedCount]) {
      const next = pickedCount + 1;
      setPickedCount(next);
      if (next >= seq.steps.length) {
        const st = loadStats(matId);
        st[order[idx]] = { r: (st[order[idx]]?.r || 0) + 1, w: st[order[idx]]?.w || 0 };
        saveStats(matId, st);
        setScore(s => ({ ...s, right: s.right + 1 }));
        setTimeout(() => { if (idx + 1 >= order.length) setDone(true); else setIdx(i => i + 1); }, 800);
      }
    } else {
      setWrongTile(ti);
      setScore(s => ({ ...s, wrong: s.wrong + 1 }));
      const st = loadStats(matId);
      st[order[idx]] = { r: st[order[idx]]?.r || 0, w: (st[order[idx]]?.w || 0) + 1 };
      saveStats(matId, st);
      if (!wrongList.includes(order[idx])) setWrongList(l => [...l, order[idx]]);
      setTimeout(() => setWrongTile(null), 500);
    }
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ width: `${((idx + 1) / order.length) * 100}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 300ms ' + EASE }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {order.length}</span>
      </div>
      <div style={{ borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '20px 26px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color, marginBottom: 6 }}>Toca los pasos en el orden correcto</div>
        <div style={{ fontSize: 17, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{pickedCount} de {seq.steps.length} colocados</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', alignContent: 'center' }}>
        {tiles.map((t, ti) => {
          const lockedIdx = seq.steps.indexOf(t);
          const isLocked = lockedIdx > -1 && lockedIdx < pickedCount;
          const isWrong = wrongTile === ti;
          const c = isLocked ? '#10B981' : isWrong ? '#EF4444' : 'var(--text-primary)';
          return (
            <button key={t + ti} onClick={() => tap(ti)} disabled={isLocked}
              style={{
                padding: '15px 20px', borderRadius: 12, textAlign: 'center',
                border: `1px solid ${isLocked ? '#10B98150' : isWrong ? '#EF444455' : 'var(--border-subtle)'}`,
                background: isLocked ? 'rgba(16,185,129,0.08)' : isWrong ? 'rgba(239,68,68,0.08)' : 'var(--bg-deep)',
                color: c, cursor: isLocked ? 'default' : 'pointer', transition: `all 170ms ${EASE}`, fontSize: 13, fontWeight: 500,
                opacity: isLocked ? 0.8 : 1,
              }}
              onMouseEnter={e => { if (!isLocked) e.currentTarget.style.borderColor = `${accent}55`; }}
              onMouseLeave={e => { if (!isLocked) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
              {isLocked && <span style={{ marginRight: 6, fontWeight: 700 }}>{lockedIdx + 1}.</span>}
              <MT t={t} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── CATEGORIZAR: clasifica cada elemento en su categoría ─────────────────────
function CatRun({ items, matId, color, accent }: { items: DeckCat[]; matId: string; color: string; accent: string }) {
  const valid = items.filter(it => it.item && it.cat);
  const [seed, setSeed] = useState(0);
  const order = useMemo(() => adaptiveOrder(valid.length, loadStats(matId)), [seed, valid.length, matId]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [wrongList, setWrongList] = useState<number[]>([]);
  const cats = useMemo(() => Array.from(new Set(valid.map(it => it.cat))).slice(0, 6), [valid]);
  const it = valid[order[idx]];

  const pick = (c: string) => {
    if (picked !== null || !it) return;
    setPicked(c);
    const ok = c === it.cat;
    const st = loadStats(matId);
    st[order[idx]] = { r: (st[order[idx]]?.r || 0) + (ok ? 1 : 0), w: (st[order[idx]]?.w || 0) + (ok ? 0 : 1) };
    saveStats(matId, st);
    if (ok) setScore(s => ({ ...s, right: s.right + 1 }));
    else { setScore(s => ({ ...s, wrong: s.wrong + 1 })); if (!wrongList.includes(order[idx])) setWrongList(l => [...l, order[idx]]); }
    setTimeout(() => {
      if (idx + 1 >= order.length) setDone(true);
      else { setIdx(x => x + 1); setPicked(null); }
    }, 800);
  };
  if (valid.length === 0) return <EmptyRun label="Este bloque no tiene elementos" color={color} />;
  if (done) {
    const weakest = wrongList.slice(0, 4).map(i => valid[i]?.item || '').filter(Boolean);
    return <StatsPanel right={score.right} wrong={score.wrong} weakest={weakest} color={color}
      onAgain={() => { setSeed(s => s + 1); setIdx(0); setPicked(null); setScore({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onClose={() => { }} />;
  }
  if (!it) return null;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ width: `${((idx + 1) / order.length) * 100}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 300ms ' + EASE }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {order.length}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}10`, border: `1px solid ${color}26`, padding: '3px 10px', borderRadius: 99 }}>{score.right} aciertos</span>
      </div>
      <div style={{ borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center', gap: 12 , flex: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>¿A qué categoría pertenece?</span>
        <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}><MT t={it.item} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
        {cats.map(c => {
          const isCorrect = c === it.cat;
          const isPicked = picked === c;
          const reveal = picked !== null;
          const st = reveal && isCorrect ? 'ok' : isPicked ? 'bad' : 'idle';
          const col = st === 'ok' ? '#10B981' : st === 'bad' ? '#EF4444' : 'var(--text-primary)';
          return (
            <button key={c} onClick={() => pick(c)} disabled={reveal}
              style={{
                minHeight: 92, borderRadius: 15, border: `1px solid ${st === 'ok' ? '#10B98155' : st === 'bad' ? '#EF444455' : 'var(--border-subtle)'}`,
                background: st === 'ok' ? 'rgba(16,185,129,0.08)' : st === 'bad' ? 'rgba(239,68,68,0.07)' : 'var(--bg-deep)',
                color: col, cursor: reveal ? 'default' : 'pointer', transition: `all 170ms ${EASE}`, fontSize: 15, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                opacity: reveal && !isCorrect && !isPicked ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!reveal) e.currentTarget.style.borderColor = `${accent}55`; }}
              onMouseLeave={e => { if (!reveal) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
              {st === 'ok' && <Check size={14} color="#10B981" />}
              {st === 'bad' && <X size={14} color="#EF4444" />}
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── COMPLETAR: enunciados con huecos ─────────────────────────────────────────
function ClozeRun({ items, matId, color, accent }: { items: DeckCloze[]; matId: string; color: string; accent: string }) {
  const [stats, setStats] = useState<Record<string, DeckStat>>(() => loadStats(matId));
  const [queue, setQueue] = useState<number[]>(() => adaptiveOrder(items.length, loadStats(matId)));
  const [pos, setPos] = useState(0);
  const [values, setValues] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [session, setSession] = useState({ right: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [wrongList, setWrongList] = useState<number[]>([]);
  const item = items[queue[pos]];
  if (!item) return <EmptyRun label="Este bloque no tiene enunciados" color={color} />;
  const parts = item.text.split(/\[([^\]]+)\]/g); // texto, respuesta, texto, respuesta…
  const next = () => {
    setChecked(false); setValues([]);
    setTimeout(() => {
      if (pos + 1 >= queue.length) setDone(true); else setPos(p => p + 1);
    }, 0);
  };
  const check = () => {
    const ok = item.answers.every((a, i) => (values[i] || '').trim().toLowerCase() === a.trim().toLowerCase());
    const s = { ...stats, [queue[pos]]: { r: (stats[queue[pos]]?.r || 0) + (ok ? 1 : 0), w: (stats[queue[pos]]?.w || 0) + (ok ? 0 : 1) } };
    setStats(s); saveStats(matId, s);
    if (ok) setSession(v => ({ ...v, right: v.right + 1 }));
    else { setSession(v => ({ ...v, wrong: v.wrong + 1 })); setWrongList(l => l.includes(queue[pos]) ? l : [...l, queue[pos]]); }
    setChecked(true);
  };
  const weakest = wrongList.slice(0, 4).map(i => items[i]?.text.slice(0, 80) || '').filter(Boolean);
  if (done) {
    return <StatsPanel right={session.right} wrong={session.wrong} weakest={weakest} color={color}
      onAgain={() => { const q = adaptiveOrder(items.length, stats); setQueue(q); setPos(0); setSession({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onWrongOnly={() => { setQueue(shuffle(wrongList)); setPos(0); setSession({ right: 0, wrong: 0 }); setDone(false); setWrongList([]); }}
      onClose={() => { }} />;
  }
  let gapIdx = 0;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ width: `${((pos + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 300ms ' + EASE }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{pos + 1} / {queue.length}</span>
      </div>
      <div style={{ borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '32px 38px', fontSize: 18, fontWeight: 300, lineHeight: 2.3, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", minHeight: 190, flex: 1 }}>
        {parts.map((p, i) => {
          if (i % 2 === 0) return <span key={i}><MT t={p} /></span>;
          const gi = gapIdx++;
          const isOk = checked && (values[gi] || '').trim().toLowerCase() === item.answers[gi]?.trim().toLowerCase();
          return (
            <input key={i} value={values[gi] || ''} onChange={e => setValues(v => { const c = [...v]; c[gi] = e.target.value; return c; })}
              onKeyDown={e => { if (e.key === 'Enter' && !checked) check(); }}
              disabled={checked}
              placeholder={' '.repeat(Math.max(6, (item.answers[gi] || '').length))}
              style={{
                width: Math.max(90, (item.answers[gi] || '').length * 12 + 38), height: 40, margin: '0 4px', verticalAlign: 'middle',
                borderRadius: 8, border: `1px solid ${checked ? (isOk ? '#10B98166' : '#EF444466') : accent + '45'}`,
                background: checked ? (isOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)') : 'var(--bg-deep)',
                color: checked ? (isOk ? '#10B981' : '#EF4444') : 'var(--text-primary)',
                fontSize: 14, fontWeight: 500, textAlign: 'center', outline: 'none', padding: '0 10px', fontFamily: 'inherit',
              }} />
          );
        })}
      </div>
      {checked && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {item.answers.map((a, i) => (
            <span key={i} style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Respuesta: <b style={{ color: '#10B981' }}>{a}</b></span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {!checked ? (
          <button onClick={check} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 26px', borderRadius: 11, border: 'none', background: color, color: '#0B0C0F', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            <Check size={14} /> Comprobar
          </button>
        ) : (
          <button onClick={next} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 26px', borderRadius: 11, border: `1px solid ${color}40`, background: `${color}12`, color, cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>
            Siguiente <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── FEYNMAN: concepto a la izquierda, tu explicación a la derecha, resultado abajo ──
function FeynmanRun({ concepts, matId, color, accent }: { concepts: DeckFeynman[]; matId: string; color: string; accent: string }) {
  const [stats, setStats] = useState<Record<string, DeckStat>>(() => loadStats(matId));
  const [queue, setQueue] = useState<number[]>(() => adaptiveOrder(concepts.length, loadStats(matId)));
  const [pos, setPos] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState<ReturnType<typeof analyzeExplanation> | null>(null);
  const [listening, setListening] = useState(false);
  const [session, setSession] = useState({ right: 0, mid: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const recRef = useRef<any>(null);
  const autoRef = useRef<any>(null);
  const item = concepts[queue[pos]];
  if (!item) return <EmptyRun label="Este bloque no tiene conceptos" color={color} />;

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Este dispositivo no soporta reconocimiento de voz'); return; }
    if (listening) { try { recRef.current?.stop(); } catch { } setListening(false); return; }
    try {
      const r = new SR();
      r.lang = 'es-ES'; r.interimResults = true; r.continuous = true;
      r.onresult = (e: any) => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        setExplanation(t.trim());
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recRef.current = r;
      setExplanation('');
      r.start();
      setListening(true);
    } catch { toast.error('No se pudo iniciar el micrófono'); }
  };

  const compare = () => {
    try { recRef.current?.stop(); } catch { }
    setListening(false);
    const r = analyzeExplanation(explanation, item.source || '', item.points);
    setResult(r);
  };

  // Siguiente: registra la evaluación del algoritmo, borra lo hablado y avanza (lo fallado se re-encola)
  const nextItem = () => {
    if (!result) return;
    clearTimeout(autoRef.current);
    const g: 'right' | 'mid' | 'wrong' = result.pct >= 55 ? 'right' : result.pct >= 28 ? 'mid' : 'wrong';
    const idx = queue[pos];
    const s = { ...stats, [idx]: { r: (stats[idx]?.r || 0) + (g === 'right' ? 1 : 0), w: (stats[idx]?.w || 0) + (g === 'wrong' ? 1 : g === 'mid' ? 0.5 : 0) } };
    setStats(s); saveStats(matId, s);
    if (g === 'right') setSession(v => ({ ...v, right: v.right + 1 }));
    else if (g === 'mid') setSession(v => ({ ...v, mid: v.mid + 1 }));
    else setSession(v => ({ ...v, wrong: v.wrong + 1 }));
    setExplanation(''); setResult(null);
    if (g === 'wrong') setQueue(q => [...q, idx]);
    if (pos + 1 >= queue.length && g !== 'wrong') setDone(true); else setPos(p => p + 1);
  };



  if (done) {
    const weakest = concepts.map((c, i) => ({ c: c.concept, s: stats[i] ? stats[i].w : 0 })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.c);
    return <StatsPanel right={session.right} wrong={session.wrong} weakest={weakest} color={color}
      onAgain={() => { const q = adaptiveOrder(concepts.length, stats); setQueue(q); setPos(0); setSession({ right: 0, mid: 0, wrong: 0 }); setDone(false); }}
      onClose={() => { }} />;
  }

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: 14, width: '100%' }}>
      {/* IZQUIERDA: concepto arriba · resultados y coincidencias abajo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '20px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color, marginBottom: 7 }}>Explica este concepto</div>
          <div style={{ fontSize: 19, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: "'Inter Tight', sans-serif" }}><MT t={item.concept} /></div>
        </div>
        {result ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ borderRadius: 13, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: result.pct >= 55 ? '#10B981' : result.pct >= 28 ? '#F59E0B' : '#EF4444', fontFamily: "'Inter Tight', sans-serif" }}>{result.pct}%</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                coincidencia con las<br />palabras clave del bloque
              </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: 99 }}>
              Estructura {result.struct}%
            </span>
            </div>
            {/* Coincidencia contrastada: keywords acertadas vs faltantes */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Palabras clave</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {result.keywords.map(k => (
                  <span key={k.w} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, border: `1px solid ${k.hit ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)'}`, background: k.hit ? 'rgba(16,185,129,0.09)' : 'var(--bg-elevated)', color: k.hit ? '#10B981' : 'var(--text-muted)' }}>
                    {k.hit ? '✓ ' : '○ '}{k.w}
                  </span>
                ))}
              </div>
            </div>
            {/* Puntos esenciales integrados con la cobertura */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Puntos esenciales</div>
              {item.points.map((p, i) => {
                const cov = result.pointsCov[i];
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 9, marginBottom: 4, background: cov ? 'rgba(16,185,129,0.06)' : 'var(--bg-elevated)', border: `1px solid ${cov ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cov ? '#10B981' : 'var(--text-muted)', flexShrink: 0 }}>{cov ? '✓' : '○'}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.5 }}><MT t={p} /></span>
                  </div>
                );
              })}
            </div>
            {item.source && (
              <details style={{ borderRadius: 11, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', padding: '9px 13px' }}>
                <summary style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}>Texto fuente</summary>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 7 }}><MT t={item.source} /></div>
              </details>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 140, borderRadius: 13, border: `1.5px dashed ${color}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 }}>
            <TrendingUp size={17} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>Tus resultados y coincidencias aparecerán aquí al comparar</span>
          </div>
        )}
      </div>
      {/* DERECHA: todo lo que hablaste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>Tu explicación</span>
          {listening && <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: '#EF4444', animation: 'pulse 1.2s ease-in-out infinite' }} /> Escuchando…</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 180 }}>
          <button onClick={toggleMic} title={listening ? 'Detener dictado' : 'Dictar tu explicación con la voz'}
            style={{ width: 46, borderRadius: 12, flexShrink: 0, alignSelf: 'stretch', border: `1px solid ${listening ? '#EF444455' : color + '38'}`, background: listening ? 'rgba(239,68,68,0.1)' : `${color}0c`, color: listening ? '#EF4444' : color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 180ms' }}>
            {listening ? <span style={{ width: 12, height: 12, borderRadius: 3, background: '#EF4444', animation: 'pulse 1.2s ease-in-out infinite' }} /> : <Mic size={17} />}
          </button>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder={listening ? 'Escuchando… explica el concepto con tus palabras' : 'Escribe o dicta tu explicación (mínimo 15 caracteres)'}
            style={{ flex: 1, boxSizing: 'border-box', background: 'var(--bg-deep)', border: `1px solid ${listening ? '#EF444440' : 'var(--border-subtle)'}`, borderRadius: 12, padding: 12, color: 'var(--text-primary)', fontSize: 12.5, lineHeight: 1.7, fontFamily: 'inherit', resize: 'none', outline: 'none' }} />
        </div>
        {!result ? (
          <button onClick={compare} disabled={explanation.trim().length < 15}
            style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 26px', borderRadius: 11, border: 'none', background: explanation.trim().length >= 15 ? color : 'var(--border-subtle)', color: explanation.trim().length >= 15 ? '#0B0C0F' : 'var(--text-muted)', cursor: explanation.trim().length >= 15 ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            <Eye size={13} /> Comparar y evaluar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignSelf: 'center' }}>
            <button onClick={nextItem}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 11, border: 'none', background: color, color: '#0B0C0F', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
              Siguiente <ChevronRight size={13} />
            </button>
            <button onClick={() => { clearTimeout(autoRef.current); setResult(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 11, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <RotateCcw size={12} /> Repetir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
