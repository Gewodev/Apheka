import katex from 'katex';

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const excluded = 'pre,code,script,style,textarea,svg,math,.katex,[data-latex-source],[data-latex-rendered]';
const superChars = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ';
const subChars = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎';
const normalChars = '0123456789+-=()ni';

// Normalize mathematical Unicode only inside an identified formula.
function normalizeMath(source: string): string {
  return source.replace(/[−–]/g, '-').replace(/⁡/g, '').replace(/[\u{1D400}-\u{1D7FF}]/gu, c => c.normalize('NFKD'))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, s => '^{'+[...s].map(c => normalChars[superChars.indexOf(c)]).join('')+'}')
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]+/g, s => '_{'+[...s].map(c => normalChars[subChars.indexOf(c)]).join('')+'}');
}

export function ensureKatexCss() { /* Bundled locally by Vite. */ }

// Recover TeX from copied KaTeX/MathJax before the normal paste sanitizer
// removes presentation markup. Never trust HTML from the clipboard itself.
export function prepareMathClipboard(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of Array.from(doc.querySelectorAll('[data-latex-source],.katex-display,.katex,mjx-container,math'))) {
    if (!doc.body.contains(el)) continue;
    const source = el.getAttribute('data-latex-source') || el.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (!source) continue;
    const delimiter = el.getAttribute('data-latex-display') === '1' || el.classList.contains('katex-display') || el.getAttribute('display') === 'block' ? '$$' : '$';
    el.replaceWith(doc.createTextNode(delimiter + source + delimiter));
  }
  return doc.body.innerHTML;
}

export function renderFormula(source: string, display = false): string | null {
  const tex = source.trim();
  if (!tex || tex.length > 24000 || /\\(?:href|url|includegraphics|htmlClass|htmlId|htmlStyle|htmlData)\b/.test(tex)) return null;
  try {
    const html = katex.renderToString(normalizeMath(tex), {
      displayMode: display, throwOnError: true, strict: 'ignore', trust: false,
      output: 'htmlAndMathml', maxExpand: 1000, maxSize: 20,
    });
    return '<span class="owa-math-'+(display ? 'block' : 'inline')+'" data-latex-source="'+escapeHtml(tex)+'" data-latex-display="'+(display ? '1' : '0')+'" contenteditable="false" title="Doble clic para editar la fórmula">'+html+'</span>';
  } catch { return null; } // Preserve incomplete/unsupported source for editing.
}

function escaped(text: string, index: number): boolean {
  let backslashes = 0;
  while (index > 0 && text[--index] === '\\') backslashes++;
  return backslashes % 2 === 1;
}

export function renderMathText(text: string): { changed: boolean; html: string } {
  let html = '', changed = false, last = 0, i = 0;
  while (i < text.length) {
    let open = '', close = '', display = false;
    if (text.startsWith('$$', i)) { open = close = '$$'; display = true; }
    else if (text.startsWith('\\[', i)) { open = '\\['; close = '\\]'; display = true; }
    else if (text.startsWith('\\(', i)) { open = '\\('; close = '\\)'; }
    else if (text[i] === '$' && !/\s/.test(text[i + 1] || ' ')) { open = close = '$'; }
    if (!open) { i++; continue; }
    if (escaped(text, i)) { i += open.length; continue; }
    let end = text.indexOf(close, i + open.length);
    while (end !== -1 && escaped(text, end)) end = text.indexOf(close, end + close.length);
    if (end === -1) { i += open.length; continue; }
    const source = text.slice(i + open.length, end);
    const currency = open === '$' && (/\n/.test(source) || /^\d[\d.,]*\s+[^\\^_=+<>]*$/.test(source));
    const rendered = currency ? null : renderFormula(source, display);
    if (rendered) {
      html += escapeHtml(text.slice(last, i)) + rendered;
      i = end + close.length; last = i; changed = true;
    } else { i = end + close.length; }
  }
  if (!changed) {
    const trimmed = text.trim();
    if (/^\\(?:begin\{(?:align\*?|aligned|gather\*?|equation\*?|matrix|[bpvV]?matrix|cases)\}|(?:frac|dfrac|tfrac|sqrt|sum|prod|int|lim|vec|mathbf|mathbb|alpha|beta|gamma|theta|pi)\b)/.test(trimmed)) {
      const rendered = renderFormula(trimmed, trimmed.startsWith('\\begin'));
      if (rendered) return { changed: true, html: escapeHtml(text.slice(0, text.indexOf(trimmed))) + rendered + escapeHtml(text.slice(text.indexOf(trimmed) + trimmed.length)) };
    }
  }
  return { changed, html: html + escapeHtml(text.slice(last)) };
}

export function renderLatexInHTML(html: string): string {
  if (!html || !/[\\$]/.test(html)) return html;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.parentElement?.closest(excluded) && /[\\$]/.test(node.data)) targets.push(node);
    }
    let changed = false;
    for (const node of targets) {
      const result = renderMathText(node.data);
      if (!result.changed) continue;
      const template = doc.createElement('template'); template.innerHTML = result.html;
      node.replaceWith(template.content); changed = true;
    }
    return changed ? doc.body.innerHTML : html;
  } catch { return html; }
}

// Only the current text node changes; IME and other document blocks stay intact.
export function renderMathAtCaret(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0), node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node) || node.parentElement?.closest(excluded)) return false;
  const before = (node as Text).data.slice(0, range.startOffset);
  if (!/(?:\$|\\\)|\\\])\s*$/.test(before)) return false;
  const result = renderMathText(before);
  if (!result.changed) return false;
  const template = document.createElement('template'); template.innerHTML = result.html;
  const tail = document.createTextNode((node as Text).data.slice(range.startOffset) || '\u200b');
  template.content.append(tail); node.parentNode?.replaceChild(template.content, node);
  const caret = document.createRange(); caret.setStart(tail, 0); caret.collapse(true);
  selection.removeAllRanges(); selection.addRange(caret); return true;
}

export function editMathSource(target: EventTarget | null, editor: HTMLElement): boolean {
  const formula = (target as Element | null)?.closest?.('[data-latex-source]');
  if (!formula || !editor.contains(formula)) return false;
  const display = formula.getAttribute('data-latex-display') === '1';
  const delimiter = display ? '$$' : '$';
  const node = document.createTextNode(delimiter+(formula.getAttribute('data-latex-source') || '')+delimiter);
  formula.replaceWith(node); editor.focus();
  const range = document.createRange(); range.selectNodeContents(node);
  const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  return true;
}

