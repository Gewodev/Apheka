// ── Motor LaTeX ligero: convierte $...$ y $$...$$ pegados de internet a HTML real ──
// Sin dependencias: fracciones apiladas, raíces, trig, griegas, super/subíndices y símbolos.

const SYM: Record<string, string> = {
  '\\cos': 'cos', '\\sin': 'sin', '\\tan': 'tan', '\\cot': 'cot', '\\sec': 'sec', '\\csc': 'csc',
  '\\arccos': 'arccos', '\\arcsin': 'arcsin', '\\arctan': 'arctan', '\\ln': 'ln', '\\log': 'log', '\\exp': 'exp',
  '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\Delta': 'Δ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\omega': 'ω', '\\Omega': 'Ω', '\\phi': 'φ', '\\varphi': 'φ',
  '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥', '\\neq': '≠', '\\ne': '≠', '\\approx': '≈',
  '\\Rightarrow': '⇒', '\\rightarrow': '→', '\\to': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
  '\\infty': '∞', '\\int': '∫', '\\sum': 'Σ', '\\prod': 'Π', '\\partial': '∂', '\\nabla': '∇',
  '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆', '\\cup': '∪', '\\cap': '∩',
  '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\pm': '±', '\\mp': '∓', '\\degree': '°', '\\circ': '∘',
  '\\triangle': '△', '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥', '\\equiv': '≡', '\\propto': '∝',
  '\\sqrt{}': '√', '\\langle': '⟨', '\\rangle': '⟩', '\\{': '{', '\\}': '}',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Render recursivo del núcleo LaTeX (sin los $ delimitadores)
export function latexToHtml(raw: string): string {
  const s0 = typeof raw === 'string' ? raw : String(raw ?? '');
  return conv(stripDelims(s0));
}

function stripDelims(s: string): string {
  let t = s.trim();
  while (t.startsWith('$')) t = t.slice(1);
  while (t.endsWith('$')) t = t.slice(0, -1);
  return t;
}

// Motor recursivo consciente de llaves: resuelve \frac{\sqrt{5}}{3} y \mathbf{...\text{...}}
// que el motor de regex planas no podía anidar sin romper.
function conv(s: string): string {
  let out = '';
  let i = 0;
  const readGroup = (i: number): [string, number] => {
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) break; }
    }
    return [conv(s.slice(i + 1, j)), Math.min(j + 1, s.length)];
  };
  const readToken = (i: number): [string, number] => {
    if (s[i] === '{') return readGroup(i);
    if (s[i] === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (m) return [conv(m[0]), i + m[0].length];
    }
    return [esc(s[i] || ''), i + 1];
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (!m) { i++; continue; }
      const cmd = m[1];
      i += m[0].length;
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        const [num, i1] = readGroup(i);
        const [den, i2] = readGroup(i1);
        out += `<span class="owa-frac"><span class="owa-frac-top">${num}</span><span class="owa-frac-bot">${den}</span></span>`;
        i = i2; continue;
      }
      if (cmd === 'sqrt') {
        let j = i, rest = '';
        if (s[j] === '[') { const e = s.indexOf(']', j); if (e > -1) { rest = s.slice(j + 1, e); j = e + 1; } }
        const [body, i1] = readGroup(j);
        out += `<span style="white-space:nowrap">√<span class="owa-sqrt-in">${body}</span>${rest ? `<sup style="font-size:.62em">${rest}</sup>` : ''}</span>`;
        i = i1; continue;
      }
      if (cmd === 'text' || cmd === 'mathrm' || cmd === 'operatorname') {
        const [body, i1] = readGroup(i);
        out += `<span class="owa-math-up">${body}</span>`;
        i = i1; continue;
      }
      if (cmd === 'mathbf' || cmd === 'boldsymbol') {
        const [body, i1] = readGroup(i);
        out += `<b class="owa-math-up">${body}</b>`;
        i = i1; continue;
      }
      if (cmd === 'hat') {
        const [body, i1] = readGroup(i);
        out += `${body}\u0302`;
        i = i1; continue;
      }
      if (cmd === 'left' || cmd === 'right' || cmd === 'displaystyle' || cmd === 'limits' || cmd === 'big' || cmd === 'Big' || cmd === 'bigl' || cmd === 'bigr') { continue; }
      if (SYM['\\' + cmd] !== undefined) { out += SYM['\\' + cmd]; continue; }
      if (['cos','sin','tan','sec','csc','cot','log','ln','exp','lim','arcsin','arccos','arctan','min','max'].includes(cmd)) {
        out += `${esc(cmd)}\u2009`; continue;
      }
      out += esc(cmd); continue;
    }
    if (ch === '^' || ch === '_') {
      const [tok, i1] = readToken(i + 1);
      out += ch === '^' ? `<sup>${tok}</sup>` : `<sub>${tok}</sub>`;
      i = i1; continue;
    }
    if (ch === '{') {
      const [g, i1] = readGroup(i);
      out += g; i = i1; continue;
    }
    if (ch === '~') { out += '\u00A0'; i++; continue; }
    if (ch === '&') { out += '&amp;'; i++; continue; }
    if (ch === '<') { out += '&lt;'; i++; continue; }
    if (ch === '>') { out += '&gt;'; i++; continue; }
    out += ch; i++;
  }
  return out;
}

// ¿El segmento $…$ trae LaTeX de verdad? (evita convertir dinero: "cuesta $5 y $8")
const HAS_LATEX = { test: (s: string): boolean => {
  if (!s) return false;
  if (s.includes('\\')) return /[a-zA-Z]/.test(s.slice(s.lastIndexOf('\\')));
  return s.includes('^') || s.includes('_');
} };

// Convierte TEXTO PLANO (pegado de una IA o web) con $...$ / $$...$$ a HTML de apuntes.
// Cada línea se vuelve un <p>; los $$...$$ se vuelven bloques de ecuación centrados.
export function latexTextToHtml(plain: string): string {
  const lines = plain.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (let line of lines) {
    const t = line.trim();
    if (!t) { out.push('<p><br></p>'); continue; }
    // Bloques $$...$$ (pueden haber varios por línea)
    if (t.includes('$$')) {
      let html = '';
      let rest = t;
      const blockRe = /\$\$([\s\S]+?)\$\$/g;
      let last = 0, m: RegExpExecArray | null, any = false;
      while ((m = blockRe.exec(rest)) !== null) {
        if (HAS_LATEX.test(m[1])) {
          if (m.index > last) html += `<p>${inline(rest.slice(last, m.index))}</p>`;
          html += `<div class="owa-math-block">${latexToHtml(m[1])}</div>`;
          last = m.index + m[0].length; any = true;
        }
      }
      if (any) {
        if (last < rest.length) html += `<p>${inline(rest.slice(last))}</p>`;
        out.push(html);
        continue;
      }
    }
    out.push(`<p>${inline(t)}</p>`);
  }
  return out.join('');
}

function inline(text: string): string {
  let s = esc(text);
  // Negritas markdown del chat: **texto**
  while (true) {
    const a = s.indexOf('**');
    if (a === -1) break;
    const b = s.indexOf('**', a + 2);
    if (b === -1) break;
    s = s.slice(0, a) + '<b>' + s.slice(a + 2, b) + '</b>' + s.slice(b + 2);
  }
  // URLs → enlaces (por tokens, sin regex)
  s = s.split(' ').map(tok => (tok.startsWith('http://') || tok.startsWith('https://'))
    ? '<a href="' + tok + '" target="_blank" rel="noopener">' + tok + '</a>'
    : tok).join(' ');
  // $...$ por índices (sin regex con escapes): solo si hay LaTeX real dentro
  let out = '';
  let i = 0;
  while (i < s.length) {
    const d1 = s.indexOf('$', i);
    if (d1 === -1) { out += s.slice(i); break; }
    const d2 = s.indexOf('$', d1 + 1);
    if (d2 === -1) { out += s.slice(i); break; }
    const inner = s.slice(d1 + 1, d2);
    if (HAS_LATEX.test(inner)) {
      out += s.slice(i, d1) + '<span class="owa-math-inline">' + latexToHtml(inner) + '</span>';
      i = d2 + 1;
    } else {
      out += s.slice(i, d2 + 1);
      i = d2 + 1;
    }
  }
  return out;
}

// Renderiza los segmentos $..$ y $$..$$ dentro de un HTML ya limpio, sin tocar etiquetas:
// solo convierte cuando el interior no trae < ni > y sí hay comandos LaTeX reales.
export function upgradeLatexInText(html: string): string {
  if (!html || !html.includes('$')) return html;
  let out = '';
  let i = 0;
  while (i < html.length) {
    const d1 = html.indexOf('$', i);
    if (d1 === -1) { out += html.slice(i); break; }
    if (html[d1 + 1] === '$') {
      const d2 = html.indexOf('$$', d1 + 2);
      if (d2 === -1) { out += html.slice(i); break; }
      const inner = html.slice(d1 + 2, d2);
      if (!inner.includes('<') && !inner.includes('>') && HAS_LATEX.test(inner)) {
        out += html.slice(i, d1) + '<div class="owa-math-block">' + latexToHtml(inner) + '</div>';
        i = d2 + 2;
      } else {
        out += html.slice(i, d1 + 2);
        i = d1 + 2;
      }
      continue;
    }
    const d2 = html.indexOf('$', d1 + 1);
    if (d2 === -1) { out += html.slice(i); break; }
    const inner = html.slice(d1 + 1, d2);
    if (!inner.includes('<') && !inner.includes('>') && !inner.includes('\n') && HAS_LATEX.test(inner)) {
      out += html.slice(i, d1) + '<span class="owa-math-inline">' + latexToHtml(inner) + '</span>';
      i = d2 + 1;
    } else {
      out += html.slice(i, d2 + 1);
      i = d2 + 1;
    }
  }
  return out;
}
