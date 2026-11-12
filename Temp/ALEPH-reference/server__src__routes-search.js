import { Router } from 'express';
import { requireAuth } from './auth.js';

const router = Router();
router.use(requireAuth);

// Simple TTL cache for web search results
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100;
const searchCache = new Map();

// Trusted domains for credibility scoring (can be expanded)
const TRUSTED_DOMAINS = new Set([
  // Academic/educational
  'edu', 'ac.uk', 'ac.jp', 'ac.au',
  // Government
  'gov', 'gob', 'gouv',
  // International organizations
  'un.org', 'who.int', 'unesco.org', 'worldbank.org', 'imf.org',
  // Reputable news sources (examples)
  'bbc.com', 'reuters.com', 'ap.org', 'nytimes.com', 'washingtonpost.com',
  'theguardian.com', 'lemonde.fr', 'deutschland.de',
  // Scientific publications
  'nature.com', 'science.org', 'nejm.org', 'thelancet.com',
  // Tech references
  'w3.org', 'rfc-editor.org', 'ieee.org', 'acm.org'
]);

/**
 * Calculate a simple credibility score for a domain
 * @param {string} domain - The domain to score
 * @returns {number} - Score between 0 and 1
 */
function getCredibilityScore(domain) {
  // Check for exact trusted domain matches
  if (TRUSTED_DOMAINS.has(domain)) return 1.0;
  
  // Check for subdomains of trusted domains
  for (const trusted of TRUSTED_DOMAINS) {
    if (domain.endsWith('.' + trusted)) return 0.9;
  }
  
  // Check for common TLDs that tend to be more credible
  const credibleTLDs = ['.edu', '.gov', '.org'];
  for (const tld of credibleTLDs) {
    if (domain.endsWith(tld)) return 0.7;
  }
  
  // Default score for .com, .net, etc.
  if (domain.endsWith('.com') || domain.endsWith('.net')) return 0.5;
  
  // Lower score for less common or potentially questionable TLDs
  return 0.3;
}

/**
 * Extract date from snippet or result (simplified implementation)
 * @param {string} snippet - The text snippet to search for dates
 * @returns {Date|null} - Parsed date or null if not found
 */
function extractDateFromSnippet(snippet) {
  if (!snippet) return null;
  
  // Look for patterns like "January 1, 2023" or "2023-01-01"
  const datePatterns = [
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, // YYYY-MM-DD
    /\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b/, // MM/DD/YYYY or DD/MM/YYYY
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
  ];
  
  for (const pattern of datePatterns) {
    const match = snippet.match(pattern);
    if (match) {
      try {
        // Simple parsing - in production would use a proper date parser
        return new Date(match[0]);
      } catch (e) {
        // Continue trying other patterns
      }
    }
  }
  
  return null;
}

/**
 * Check if a result is within the recency period
 * @param {Object} result - The search result object
 * @param {number} maxDays - Maximum age in days
 * @returns {boolean} - True if within recency period
 */
function isWithinRecency(result, maxDays) {
  if (!maxDays || maxDays <= 0) return true; // No recency filter
  
  // Try to extract date from various fields
  let date = null;
  
  // Check if result already has a date field
  if (result.date) {
    date = result.date instanceof Date ? result.date : new Date(result.date);
  }
  
  // Try to extract from snippet
  if (!date && result.snippet) {
    date = extractDateFromSnippet(result.snippet);
  }
  
  // Try to extract from title
  if (!date && result.title) {
    date = extractDateFromSnippet(result.title);
  }
  
  if (!date) return true; // If we can't determine date, include it (don't filter out)
  
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= maxDays;
}

function makeCacheKey(query, options) {
  if (!options || Object.keys(options).length === 0) return query;
  const optStr = JSON.stringify(options);
  return `${query}|${optStr}`;
}

function cacheGet(query, options) {
  const key = makeCacheKey(query, options);
  const item = searchCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  return item.results;
}

function cacheSet(query, results, options) {
  const key = makeCacheKey(query, options);
  if (searchCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (simple FIFO)
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
  searchCache.set(key, { timestamp: Date.now(), results });
}

const decodeEntities = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchHtml(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es,en;q=0.8' } });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Variante POST: DuckDuckGo html responde mejor a formularios (evita
// la pantalla de "anomalía" que bloquea muchas peticiones GET desde datacenter).
async function fetchHtmlPost(url, params, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html',
        'Accept-Language': 'es,en;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://duckduckgo.com/',
        'Origin': 'https://duckduckgo.com',
      },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Valida que una URL sea http(s) real y navegable (no redirectors internos).
function isCleanUrl(href) {
  if (!/^https?:\/\//.test(href)) return false;
  try {
    const u = new URL(href);
    if (/^(www\.)?bing\.com$/.test(u.hostname) && u.pathname.startsWith('/ck/')) return false;
    return true;
  } catch { return false; }
}

function parseHtmlEndpoint(html, max) {
  const snippets = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => decodeEntities(m[1]));
  const results = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && results.length < max) {
    let href = m[1];
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (!isCleanUrl(href)) continue;
    let domain = '';
    try { domain = new URL(href).hostname.replace(/^www\./, ''); } catch { continue; }
    results.push({ title: decodeEntities(m[2]), url: href, snippet: snippets[results.length] || '', domain });
  }
  return results;
}

function parseLiteEndpoint(html, max) {
  const snippets = [...html.matchAll(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decodeEntities(m[1]));
  const results = [];
  const re = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && results.length < max) {
    let href = m[1];
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (href.startsWith('//')) href = `https:${href}`;
    if (!isCleanUrl(href)) continue;
    let domain = '';
    try { domain = new URL(href).hostname.replace(/^www\./, ''); } catch { continue; }
    results.push({ title: decodeEntities(m[2]), url: href, snippet: snippets[results.length] || '', domain });
  }
  return results;
}

async function instantAnswers(query, max) {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=maverick`, {
    headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  const push = (title, url, snippet) => {
    if (!isCleanUrl(url)) return;
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      out.push({ title: decodeEntities(title), url, snippet: decodeEntities(snippet || ''), domain });
    } catch { /* url inválida */ }
  };
  if (data.AbstractURL && data.Abstract) push(data.Heading || query, data.AbstractURL, data.Abstract);
  // Results[]: respuestas directas de la API (p. ej. definiciones, sitios oficiales)
  for (const r of data.Results || []) {
    if (out.length >= max) break;
    if (r.FirstURL && r.Text) push(r.Text.slice(0, 110), r.FirstURL, r.Text);
  }
  for (const t of data.RelatedTopics || []) {
    if (out.length >= max) break;
    if (t.FirstURL && t.Text) push(t.Text.slice(0, 110), t.FirstURL, t.Text);
    for (const sub of t.Topics || []) {
      if (out.length >= max) break;
      if (sub.FirstURL && sub.Text) push(sub.Text.slice(0, 110), sub.FirstURL, sub.Text);
    }
  }
  return out.slice(0, max);
}

async function wikipedia(query, max) {
  const out = [];
  for (const lang of ['es', 'en']) {
    if (out.length >= max) break;
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=opensearch&format=json&limit=${max}&search=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'MAVERICK/1.0 (asistente de chat)' }, signal: AbortSignal.timeout(8000),
      });
      const [, titles, , urls] = await res.json();
      (titles || []).forEach((title, i) => {
        if (urls[i] && out.length < max) out.push({ title, url: urls[i], snippet: '', domain: `${lang}.wikipedia.org` });
      });
    } catch { /* siguiente idioma */ }
  }
  return out;
}

// Búsqueda web gratuita con cadena de respaldos por motor y reintento con
// consulta simplificada. Orden: DDG HTML → DDG Lite → Bing → Instant Answers →
// Wikipedia → SearXNG → Mojeek → Marginalia → Stack Exchange → HackerNews.

// Limpia la consulta para el segundo intento (sin puntuación/ruido, máx 10 palabras).
function simplifyQuery(q) {
  return q
    .replace(/["'«»“”„]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 10)
    .join(' ');
}

// Bing HTML: los enlaces vienen envueltos en /ck/a?...&u=a1<base64url>.
function decodeBingHref(href) {
  const ck = /[?&]u=a1([A-Za-z0-9\-_]+)/.exec(href);
  if (ck) {
    try {
      const decoded = Buffer.from(ck[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      if (/^https?:\/\//.test(decoded)) return decoded;
    } catch { /* fallback al href original */ }
  }
  return href;
}

async function bing(q, max) {
  const html = await fetchHtml(`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=${max + 2}`);
  const out = [];
  const liRe = /<li class="b_algo"[\s\S]*?<\/li>/g;
  let m;
  while ((m = liRe.exec(html)) && out.length < max) {
    const block = m[0];
    const a = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!a) continue;
    const href = decodeBingHref(a[1]);
    // Si el enlace sigue envuelto en el redirector de Bing (/ck/a), no es
    // una fuente navegable: se descarta para no mostrar URLs rotas.
    if (!isCleanUrl(href)) continue;
    const p = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    let domain = '';
    try { domain = new URL(href).hostname.replace(/^www\./, ''); } catch { continue; }
    out.push({ title: decodeEntities(a[2]), url: href, snippet: p ? decodeEntities(p[1]) : '', domain });
  }
  return out;
}

// SearXNG: metabuscador open-source. Se prueban varias instancias públicas
// (algunas bloquean bots o rate-limitan; falla en silencio y sigue la cadena).
const SEARX_INSTANCES = [
  'https://search.inetol.net',
  'https://searx.tiekoetter.com',
  'https://searx.be',
  'https://priv.au',
];

function parseSearxHtml(html, max) {
  const out = [];
  const re = /<article[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(html)) && out.length < max) {
    const block = m[1];
    const a = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!a || !isCleanUrl(a[1])) continue;
    const p = /<p[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    let domain = '';
    try { domain = new URL(a[1]).hostname.replace(/^www\./, ''); } catch { continue; }
    out.push({ title: decodeEntities(a[2]), url: a[1], snippet: p ? decodeEntities(p[1]) : '', domain });
  }
  return out;
}

async function searxng(query, max) {
  for (const base of SEARX_INSTANCES) {
    try {
      const html = await fetchHtml(`${base}/search?q=${encodeURIComponent(query)}`);
      const results = parseSearxHtml(html, max);
      if (results.length) return results;
    } catch { /* siguiente instancia */ }
  }
  return [];
}

// Mojeek: buscador independiente open-source con índice propio (sin Google/Bing).
async function mojeek(q, max) {
  const html = await fetchHtml(`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`);
  const out = [];
  const re = /<h2[^>]*>\s*<a[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>(?:[^<]|<(?!\/h2))*(?:<p class="s">([\s\S]*?)<\/p>)?/g;
  let m;
  while ((m = re.exec(html)) && out.length < max) {
    if (!isCleanUrl(m[1])) continue;
    let domain = '';
    try { domain = new URL(m[1]).hostname.replace(/^www\./, ''); } catch { continue; }
    out.push({ title: decodeEntities(m[2]), url: m[1], snippet: m[3] ? decodeEntities(m[3]) : '', domain });
  }
  return out;
}

// Marginalia: buscador open-source centrado en contenido no comercial.
// API pública gratuita; si la clave/API no responde, falla en silencio.
async function marginalia(query, max) {
  for (const key of ['public', 'test']) {
    try {
      const res = await fetch(`https://api.marginalia.nu/${key}/search/${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'MAVERICK/1.0 (asistente de chat)' }, signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const out = [];
      for (const r of data.results || []) {
        if (out.length >= max) break;
        if (!r.url || !isCleanUrl(r.url)) continue;
        let domain = '';
        try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
        out.push({ title: decodeEntities(r.title || query), url: r.url, snippet: decodeEntities(r.description || ''), domain });
      }
      if (out.length) return out;
    } catch { /* siguiente clave */ }
  }
  return [];
}

// Stack Exchange API: gratuita sin clave (cuota diaria por IP), ideal para
// consultas técnicas y de programación. Devuelve vacío si no hay coincidencias.
async function stackexchange(query, max) {
  const res = await fetch(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&pagesize=${max}&site=stackoverflow&filter=withbody&q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'MAVERICK/1.0 (asistente de chat)' }, signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  for (const it of data.items || []) {
    if (out.length >= max) break;
    if (!it.link || !it.title || !isCleanUrl(it.link)) continue;
    let domain = '';
    try { domain = new URL(it.link).hostname.replace(/^www\./, ''); } catch { continue; }
    const snippet = String(it.body || '').replace(/<[^>]+>/g, ' ').slice(0, 220);
    out.push({ title: decodeEntities(it.title), url: it.link, snippet: decodeEntities(snippet), domain });
  }
  return out;
}

// HackerNews vía API Algolia: gratuita, sin clave, discusiones técnicas.
// Devuelve vacío si no hay coincidencias (filtro natural para consultas no técnicas).
async function hackernews(query, max) {
  const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${max}&tags=(story,comment)`, {
    headers: { 'User-Agent': 'MAVERICK/1.0 (asistente de chat)' }, signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  for (const h of data.hits || []) {
    if (out.length >= max) break;
    const url = h.url || (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : '');
    const text = h.title || h.story_title || h.comment_text || '';
    if (!url || !text || !isCleanUrl(url)) continue;
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    out.push({ title: decodeEntities(text.slice(0, 110)), url, snippet: decodeEntities(String(h.comment_text || h.story_text || '').replace(/<[^>]+>/g, ' ').slice(0, 220)), domain });
  }
  return out;
}

async function webSearchOnce(query, max, options = {}) {
  // Check cache first
  const cached = cacheGet(query, options);
  if (cached !== null) {
    return cached;
  }

  let results = [];
  // 1) DDG html por POST (el mejor formato de resultados, evita anomalías GET)
  try {
    results = parseHtmlEndpoint(await fetchHtmlPost('https://html.duckduckgo.com/html/', { q: query }), max);
  } catch { /* ignore */ }
  // 2) DDG html por GET
  if (!results.length) {
    try {
      results = parseHtmlEndpoint(await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`), max);
    } catch { /* ignore */ }
  }
  // 3) DDG lite (estructura distinta, suele pasar cuando html está bloqueado)
  if (!results.length) {
    try {
      results = parseLiteEndpoint(await fetchHtml(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`), max);
    } catch { /* ignore */ }
  }
  // 4) DDG Instant Answer API (ampliada: Abstract + Results + RelatedTopics)
  if (!results.length) {
    try {
      results = await instantAnswers(query, max);
    } catch { /* ignore */ }
  }
  // 5) Wikipedia (es/en)
  if (!results.length) {
    try {
      results = await wikipedia(query, max);
    } catch { /* ignore */ }
  }
  // 6) Bing como último recurso, solo con enlaces ya decodificados y válidos
  if (!results.length) {
    try {
      results = await bing(query, max);
    } catch { /* ignore */ }
  }
  // 7) SearXNG (instancias públicas, open-source)
  if (!results.length) {
    try {
      results = await searxng(query, max);
    } catch { /* ignore */ }
  }
  // 8) Mojeek (índice independiente open-source)
  if (!results.length) {
    try {
      results = await mojeek(query, max);
    } catch { /* ignore */ }
  }
  // 9) Marginalia (API pública open-source, contenido no comercial)
  if (!results.length) {
    try {
      results = await marginalia(query, max);
    } catch { /* ignore */ }
  }
  // 10) Stack Exchange (técnica/programación)
  if (!results.length) {
    try {
      results = await stackexchange(query, max);
    } catch { /* ignore */ }
  }
  // 11) HackerNews (discusiones técnicas)
  if (!results.length) {
    try {
      results = await hackernews(query, max);
    } catch { /* ignore */ }
  }

  // Defensa final: ninguna fuente con URL inválida o redirector interno.
  results = results.filter((r) => r && isCleanUrl(r.url));

  // Apply filters if options are provided
  if (options && (options.recencyDays !== undefined || options.domainWhitelist)) {
    results = results.filter(result => {
      // Apply domain whitelist filter
      if (options.domainWhitelist && options.domainWhitelist.length > 0) {
        try {
          const domain = new URL(result.url).hostname;
          const matchesWhitelist = options.domainWhitelist.some(allowed => 
            domain === allowed || domain.endsWith('.' + allowed)
          );
          if (!matchesWhitelist) return false;
        } catch (e) {
          // If URL is invalid, exclude the result
          return false;
        }
      }
      
      // Apply recency filter
      if (!isWithinRecency(result, options.recencyDays)) {
        return false;
      }
      
      return true;
    });
  }

  // Add credibility scores to results
  if (options && options.includeCredibility !== false) {
    results = results.map(result => {
      try {
        const domain = new URL(result.url).hostname;
        const credibilityScore = getCredibilityScore(domain);
        return {
          ...result,
          credibilityScore
        };
      } catch (e) {
        // If URL is invalid, still return result with low credibility
        return {
          ...result,
          credibilityScore: 0.1
        };
      }
    });
  }

  // Cache only non-empty results to avoid caching temporary failures
  if (results.length) {
    cacheSet(query, results, options);
  }
  return results;
}

// Cadena resiliente: intento completo → pausa → reintento con consulta
// simplificada → pausa → último intento original. Casi nunca devuelve vacío.
export async function webSearch(query, max = 8, options = {}) {
  const simplified = simplifyQuery(query);
  const attempts = [query, simplified, query].filter((v, i, a) => v && a.indexOf(v) === i);
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 900));
    try {
      const results = await webSearchOnce(attempts[i], max, options);
      if (results.length) return results;
    } catch { /* siguiente intento */ }
  }
  return [];
}

router.post('/', async (req, res) => {
  const query = String(req.body?.query || '').slice(0, 300).trim();
  if (!query) return res.status(400).json({ error: 'invalid_input', message: 'Consulta vacía.' });
  
  // Extract options from request body
  const { recencyDays, domainWhitelist, includeCredibility } = req.body;
  const options = {};
  if (recencyDays !== undefined) options.recencyDays = recencyDays;
  if (domainWhitelist) options.domainWhitelist = Array.isArray(domainWhitelist) ? domainWhitelist : [domainWhitelist];
  if (includeCredibility !== undefined) options.includeCredibility = includeCredibility;
  
  try {
    const results = await webSearch(query, 8, options);
    res.json({ query, results, optionsApplied: Object.keys(options).length > 0 ? options : null });
  } catch (e) {
    console.error('search', e);
    res.status(502).json({ error: 'search_failed', message: 'La búsqueda web no está disponible ahora mismo.' });
  }
});

export default router;
