import assert from 'node:assert/strict';
import { renderFormula, renderMathText } from '../src/lib/latex.ts';
for (const source of ['\\frac{\\sqrt{5}}{3}', '\\cos^2 x - 3\\sin^2 x', '\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}', '\\int_0^1 x^2\\,dx=\\frac13', '𝑥² + H₂O = α']) {
  const html = renderFormula(source);
  assert.ok(html?.includes('class="katex"'), source);
  assert.ok(html.includes('data-latex-source='), 'source retained for editing');
}
assert.equal(renderMathText('Cuesta $5 y $8 más').changed, false);
assert.equal(renderMathText('Texto normal: acción, 中文 y العربية.').changed, false);
assert.equal(renderMathText('$\\frac{1}{$').changed, false);
assert.equal(renderMathText('$\\comandoInexistente{x}$').changed, false);
assert.ok(renderMathText('Antes $a < b$ después').html.includes('&lt;'), 'HTML escaped');
assert.equal((renderMathText('$x$ y $y$').html.match(/class="katex"/g) || []).length, 2);
assert.equal(renderFormula('\\href{javascript:alert(1)}{x}'), null, 'unsupported unsafe command preserved');
console.log('PASS math engine: nested fractions, matrices, integrals, Unicode, retained source, currency/prose, invalid input and escaping');

