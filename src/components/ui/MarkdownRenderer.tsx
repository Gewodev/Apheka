import { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

marked.use({ gfm: true, breaks: true });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderKatex(src: string, displayMode: boolean): string {
  try {
    return katex.renderToString(src, { throwOnError: false, displayMode, output: 'html' });
  } catch {
    return `<code class="charvis-md-math-error">${escapeHtml(src)}</code>`;
  }
}

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, form, link, meta, base').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on') || ['href', 'src'].includes(n)) {
        const v = (attr.value || '').trim().toLowerCase();
        if (n === 'href' && !v.startsWith('http') && !v.startsWith('/') && !v.startsWith('#') && !v.startsWith('mailto')) {
          el.removeAttribute(attr.name);
          return;
        }
        if (n === 'src' && !v.startsWith('data:image') && !v.startsWith('http') && !v.startsWith('/') && !v.startsWith('blob:')) {
          el.removeAttribute(attr.name);
          return;
        }
      }
      if (n.startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

/**
 * Convierte markdown + matemáticas (KaTeX) a HTML seguro y estilizado.
 * Soporta: negritas, cursivas, subrayado (legacy <u>), tachado, listas,
 * tablas, bloques de código, citas, enlaces, imágenes, fórmulas $…$ y $$…$$.
 */
export default function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      let text = content;

      const codeBlocks: { lang: string; code: string }[] = [];
      const inlineCodes: string[] = [];
      const mathB: string[] = [];
      const mathI: string[] = [];

      // 1) Proteger bloques de código
      text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
        codeBlocks.push({ lang, code });
        return `\u241FCODE${codeBlocks.length - 1}\u241F`;
      });

      // 2) Proteger código inline
      text = text.replace(/`([^`]+)`/g, (_m, c: string) => {
        inlineCodes.push(c);
        return `\u241FICODE${inlineCodes.length - 1}\u241F`;
      });

      // 3) Matemáticas en bloque
      text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, x: string) => {
        mathB.push(x.trim());
        return `\u241FMATHB${mathB.length - 1}\u241F`;
      });

      // 4) Matemáticas inline
      text = text.replace(/\$([^$\n]+?)\$/g, (_m, x: string) => {
        mathI.push(x.trim());
        return `\u241FMATHI${mathI.length - 1}\u241F`;
      });

      // 5) Markdown (GFM)
      let html = marked.parse(text) as string;

      // 6) Restaurar matemáticas
      html = html.replace(/\u241FMATHI(\d+)\u241F/g, (_m, i: string) => renderKatex(mathI[+i], false));
      html = html.replace(/\u241FMATHB(\d+)\u241F/g, (_m, i: string) => renderKatex(mathB[+i], true));
      // Bloque de matemáticas suelto en su propio <p>: quitar el wrapper
      html = html.replace(/<p>(<span class="katex-display">[\s\S]*?<\/span>)<\/p>/g, '$1');

      // 7) Restaurar código (escapado)
      html = html.replace(/\u241FICODE(\d+)\u241F/g, (_m, i: string) => `<code>${escapeHtml(inlineCodes[+i])}</code>`);
      html = html.replace(/\u241FCODE(\d+)\u241F/g, (_m, i: string) => {
        const { lang, code } = codeBlocks[+i];
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
        return `<pre><code${cls}>${escapeHtml(code)}</code></pre>`;
      });

      return sanitize(html);
    } catch {
      return escapeHtml(content);
    }
  }, [content]);

  return <div className={`charvis-md ${className || ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
