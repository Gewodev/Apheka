// ── Lógica pura de los nodos de herramienta (testeable sin UI) ──
export type ToolDeckModePure = 'flashcardsDeck' | 'quizDeck' | 'matchDeck' | 'clozeDeck' | 'feynmanDeck' | 'vfDeck' | 'seqDeck' | 'catDeck';
export type DeckStat = { r: number; w: number };

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const STOPWORDS = new Set(['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'una', 'para', 'con', 'no', 'su', 'al', 'es', 'lo', 'como', 'mas', 'o', 'pero', 'sus', 'le', 'ya', 'fue', 'este', 'esta', 'ha', 'si', 'porque', 'son', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'me', 'mi', 'tu', 'the', 'of', 'and', 'to', 'in', 'is', 'it', 'that', 'this']);

export function analyzeExplanation(transcript: string, source: string, points: string[]): { pct: number; struct: number; keywords: { w: string; hit: boolean }[]; pointsCov: boolean[] } {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/gi, ' ').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
  const tw = new Set(norm(transcript || ''));
  const kwMap = new Map<string, number>();
  norm((points || []).join(' ')).forEach(w => kwMap.set(w, (kwMap.get(w) || 0) + 3));
  norm(source || '').forEach(w => kwMap.set(w, (kwMap.get(w) || 0) + 1));
  const keywords = Array.from(kwMap.entries()).filter(([w]) => w.length > 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  const matched = keywords.filter(w => tw.has(w));
  const pct = keywords.length > 0 ? Math.round((matched.length / keywords.length) * 100) : 0;
  const bigrams = (ws: string[]) => { const st = new Set<string>(); for (let i = 0; i < ws.length - 1; i++) st.add(ws[i] + ' ' + ws[i + 1]); return st; };
  const twList = Array.from(tw);
  const srcBig = bigrams(norm(source || ''));
  const myBig = bigrams(twList);
  const struct = myBig.size > 0 && srcBig.size > 0 ? Math.round((Array.from(myBig).filter(b => srcBig.has(b)).length / Math.min(myBig.size, 40)) * 100) : 0;
  const pointsCov = (points || []).map(p => {
    const pw = norm(p);
    return pw.length > 0 && pw.filter(w => tw.has(w)).length / pw.length >= 0.4;
  });
  return { pct, struct: Math.min(100, struct), keywords: keywords.map(w => ({ w, hit: tw.has(w) })), pointsCov };
}

const statsKey = (id: string) => `owa_deck_stats_${id}`;
export const loadStats = (id: string): Record<string, DeckStat> => { try { return JSON.parse(localStorage.getItem(statsKey(id)) || '{}'); } catch { return {}; } };
export const saveStats = (id: string, s: Record<string, DeckStat>) => { try { localStorage.setItem(statsKey(id), JSON.stringify(s)); } catch { } };

export function adaptiveOrder(count: number, stats: Record<string, DeckStat>): number[] {
  const idx = Array.from({ length: count }, (_, i) => i);
  return idx.sort((a, b) => {
    const wa = stats[a] ? stats[a].w * 2 - stats[a].r + (stats[a].w + stats[a].r === 0 ? 0.5 : 0) : 1;
    const wb = stats[b] ? stats[b].w * 2 - stats[b].r + (stats[b].w + stats[b].r === 0 ? 0.5 : 0) : 1;
    return wb - wa + (Math.random() - 0.5) * 0.1;
  });
}

// Parseo tolerante por línea según la herramienta
export function parseLines(mode: ToolDeckModePure, text: string): { ok: any[]; bad: number } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let bad = 0;
  const ok: any[] = [];
  for (const line of lines) {
    if (mode === 'quizDeck') {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const [q, correct, ...wrong] = parts;
        const options = shuffle([correct, ...wrong.slice(0, 3)]);
        ok.push({ q, options, correct: options.indexOf(correct) });
      } else bad++;
    } else if (mode === 'clozeDeck') {
      const answers = [...line.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim()).filter(Boolean);
      if (answers.length > 0) ok.push({ text: line, answers }); else bad++;
    } else if (mode === 'feynmanDeck') {
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const concept = parts[0];
          const source = parts.length >= 3 ? parts[1] : '';
          const pointsRaw = parts.length >= 3 ? parts.slice(2).join('; ') : parts[1];
          const points = pointsRaw.split(/[;;]/).map(p => p.trim()).filter(Boolean);
          if (concept && points.length) { ok.push({ concept, source, points }); continue; }
        }
      }
      const sep = line.indexOf(' - ') !== -1 ? ' - ' : line.indexOf('	') !== -1 ? '	' : '';
      if (sep) {
        const i = line.indexOf(sep);
        const concept = line.slice(0, i).trim();
        const points = line.slice(i + sep.length).split(/[;;]/).map(p => p.trim()).filter(Boolean);
        if (concept && points.length > 0) { ok.push({ concept, source: '', points }); continue; }
      }
      bad++;
    } else if (mode === 'vfDeck') {
      const i = Math.max(line.lastIndexOf(' - '), line.lastIndexOf(' — '));
      if (i > 0) {
        const text = line.slice(0, i).trim();
        const raw = line.slice(i + 3).trim().toUpperCase();
        const isTrue = raw === 'V' || raw === 'VERDADERO' || raw === 'TRUE';
        const isFalse = raw === 'F' || raw === 'FALSO' || raw === 'FALSE';
        if (text && (isTrue || isFalse)) { ok.push({ text, answer: isTrue }); continue; }
      }
      bad++;
    } else if (mode === 'seqDeck') {
      const parts = line.split('>').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) { ok.push({ name: parts[0], steps: parts.slice(1) }); continue; }
      if (parts.length === 2) { ok.push({ name: '', steps: parts }); continue; }
      bad++;
    } else if (mode === 'catDeck') {
      const sep = line.indexOf(' - ') !== -1 ? ' - ' : line.indexOf('	') !== -1 ? '	' : '';
      if (sep) {
        const i = line.indexOf(sep);
        const item = line.slice(0, i).trim(), cat = line.slice(i + sep.length).trim();
        if (item && cat) { ok.push({ item, cat }); continue; }
      }
      bad++;
    } else {
      const sep = line.indexOf(' - ') !== -1 ? ' - ' : line.indexOf('	') !== -1 ? '	' : '';
      if (sep) {
        const i = line.indexOf(sep);
        const a = line.slice(0, i).trim(), b = line.slice(i + sep.length).trim();
        if (a && b) { if (mode === 'flashcardsDeck') ok.push({ q: a, a: b }); else ok.push({ a, b }); continue; }
      }
      bad++;
    }
  }
  return { ok, bad };
}
