import katex from 'katex';

// ── Renderizador de LaTeX para apuntes ───────────────────────────────────────
// Convierte $$...$$ (bloque) y $...$ (inline) copiados de internet en matemática
// renderizada (KaTeX), manteniendo el resto del HTML intacto.

let katexCssLoaded = false;
export function ensureKatexCss() {
  if (katexCssLoaded || typeof document === 'undefined') return;
  if (!document.querySelector('link[data-katex]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'katex/katex.min.css'; // resuelto por Vite desde node_modules
    // Vite: usar import estático es más fiable; este fallback no debería ejecutarse
    link.setAttribute('data-katex', '1');
    document.head.appendChild(link);
  }
  katexCssLoaded = true;
}

function renderTex(tex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'html',
    });
  } catch {
    return null;
  }
}

// Convierte el LaTeX presente en los NODOS DE TEXTO de un HTML en matemática KaTeX.
// No toca atributos ni el contenido ya renderizado.
export function renderLatexInHTML(html: string): string {
  if (!html || (html.indexOf('$') === -1 && html.indexOf('\\(') === -1 && html.indexOf('\\[') === -1)) return html;
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const targets: { node: Text; html: string }[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue || '';
      if (t.indexOf('$') === -1 && t.indexOf('\\(') === -1 && t.indexOf('\\[') === -1) continue;
      const out = renderLatexInText(t);
      if (out.changed) targets.push({ node: n as Text, html: out.html });
    }
    for (const { node, html: replacement } of targets) {
      const span = doc.createElement('span');
      span.setAttribute('data-latex-rendered', '1');
      span.innerHTML = replacement;
      node.parentNode?.replaceChild(span, node);
    }
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

// Núcleo: recorre un texto y sustituye $$…$$, \(…\), \[…\] y $…$ por KaTeX
function renderLatexInText(text: string): { changed: boolean; html: string } {
  let out = '';
  let changed = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const rest = text.slice(i);
    // Bloque $$...$$
    if (rest.startsWith('$$')) {
      const end = rest.indexOf('$$', 2);
      if (end > 2) {
        const tex = rest.slice(2, end).trim();
        const html = renderTex(tex, true);
        if (html) {
          out += `<span class="owa-latex-block" style="display:block;text-align:center;margin:10px 0;overflow-x:auto;">${html}</span>`;
          changed = true; i += end + 2; continue;
        }
      }
    }
    // Inline \( ... \) o \[ ... \]
    if (rest.startsWith('\\(') || rest.startsWith('\\[')) {
      const close = rest.startsWith('\\(') ? '\\)' : '\\]';
      const end = rest.indexOf(close, 2);
      if (end > 2) {
        const tex = rest.slice(2, end).trim();
        const html = renderTex(tex, rest.startsWith('\\['));
        if (html) {
          out += html;
          changed = true; i += end + 2; continue;
        }
      }
    }
    // Inline $...$ (no vacío, sin $ interior, cierre real)
    if (rest[0] === '$' && rest[1] !== '$') {
      const end = findInlineEnd(rest);
      if (end > 1) {
        const tex = rest.slice(1, end).trim();
        const html = renderTex(tex, false);
        if (html) {
          out += html;
          changed = true; i += end + 1; continue;
        }
      }
    }
    out += text[i];
    i += 1;
  }
  return { changed, html: out };
}

// Encuentra el cierre de $...$ evitando falsos positivos con cantidades ($5) —
// exige que después del cierre haya fin, espacio o puntuación, y que el tex no esté vacío.
function findInlineEnd(rest: string): number {
  for (let j = 1; j < rest.length; j++) {
    const ch = rest[j];
    if (ch === '$') {
      const next = rest[j + 1];
      if (next === undefined || /[\s.,;:!?)\]}]/.test(next)) return j;
    }
  }
  return -1;
}
