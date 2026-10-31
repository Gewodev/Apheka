import { renderFormula, renderLatexInHTML, renderMathText } from './latex';

export function latexToHtml(raw: string): string {
  const source = String(raw ?? '').trim().replace(/^\$\$?|\$\$?$/g, '');
  return renderFormula(source) || source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function latexTextToHtml(plain: string): string {
  if (plain.includes('```')) return plain.split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g).filter(Boolean).map(part => {
    if (!part.startsWith('```')) return latexTextToHtml(part);
    const code = part.replace(/^```[^\n]*\n/, '').replace(/```$/, '');
    const el = document.createElement('code'); el.textContent = code;
    return '<pre>' + el.outerHTML + '</pre>';
  }).join('');
  const result = renderMathText(plain.replace(/\r\n?/g, '\n'));
  const doc = new DOMParser().parseFromString(result.html, 'text/html');
  const out: string[] = [];
  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) out.push((node.textContent || '').split('\n').map(line => {
      const el = document.createElement('span'); el.textContent = line;
      return el.innerHTML.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    }).join('<br>'));
    else out.push((node as Element).outerHTML);
  }
  return '<p>'+out.join('')+'</p>';
}

export const upgradeLatexInText = renderLatexInHTML;

