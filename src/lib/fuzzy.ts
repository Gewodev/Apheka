// ═══════════════════════════════════════════════════
//  CHARVIS — Búsqueda difusa ultra-sensible (todas las vistas)
//  Tolerante a tildes, mayúsculas, erratas y coincidencias parciales:
//  no hace falta escribir la palabra completa ni perfecta — con que una
//  parte del texto coincida (o casi coincida) el resultado aparece.
// ═══════════════════════════════════════════════════

/** Normaliza: quita tildes/diacríticos y pasa a minúsculas. */
export function normalizeSearch(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Distancia de Levenshtein (ediciones mínimas entre dos cadenas). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** ¿`needle` aparece como subsecuencia de `hay` saltando pocas letras? (tolerancia de erratas) */
function subseqMatch(hay: string, needle: string, maxSkips: number): boolean {
  if (needle.length === 0) return true;
  if (needle.length > hay.length + maxSkips) return false;
  let hi = 0;
  let skips = 0;
  for (let ni = 0; ni < needle.length; ni++) {
    const c = needle[ni];
    while (hi < hay.length && hay[hi] !== c) {
      hi++;
      skips++;
      if (skips > maxSkips) return false;
    }
    if (hi >= hay.length) return false;
    hi++;
  }
  return true;
}

/** ¿Un token de la búsqueda coincide de forma difusa con un token del texto? */
function tokenFuzzy(hayToken: string, needleToken: string): boolean {
  if (!needleToken) return false;
  if (hayToken.includes(needleToken)) return true;
  const maxEdits = Math.max(1, Math.floor(needleToken.length / 3));
  const lenDiff = Math.abs(hayToken.length - needleToken.length);
  if (lenDiff <= maxEdits && levenshtein(hayToken, needleToken) <= maxEdits) return true;
  return subseqMatch(hayToken, needleToken, maxEdits + 1);
}

/**
 * Búsqueda difusa principal: cada token de la búsqueda debe encajar (difuso)
 * en algún token del texto, o el texto completo debe contener la búsqueda.
 * Los tokens "de relleno" que no coinciden con nada (p.ej. "songs" en
 * "brunnou marss songs") se dejan de lado con tal de que al menos la mitad
 * de los tokens (mínimo 1) hayan encajado.
 */
export function fuzzyMatch(hay: string, needle: string): boolean {
  const h = normalizeSearch(hay);
  const n = normalizeSearch(needle);
  if (!n) return true;
  if (h.includes(n)) return true;

  // Búsqueda pegada sobre el texto sin espacios (ej. "brunomars" → "Bruno Mars")
  const hCompact = h.replace(/\s+/g, '');
  const nCompact = n.replace(/\s+/g, '');
  if (hCompact.includes(nCompact)) return true;

  const hayTokens = h.split(/\s+/).filter(Boolean);
  const needleTokens = n.split(/\s+/).filter(Boolean);
  if (needleTokens.length === 0) return true;

  let matched = 0;
  for (const nt of needleTokens) {
    if (hayTokens.some(ht => tokenFuzzy(ht, nt))) matched++;
  }
  const needed = Math.max(1, Math.ceil(needleTokens.length / 2));
  return matched >= needed;
}