// Test doctor: casos reales pegados desde una IA (el peor caso del usuario)
import { latexToHtml, latexTextToHtml } from '../src/lib/latexRender.ts';

const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);

let pass = 0, fail = 0;
const t = (name: string, cond: boolean, extra?: string) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra ? '-> ' + extra.slice(0, 220) : ''); }
};

const r1 = latexToHtml(BS + 'frac{' + BS + 'sqrt{5}}{3}');
t('frac anidada con sqrt se renderiza', r1.includes('owa-frac') && r1.includes('owa-sqrt') && !r1.includes(BS + 'frac'), r1);

const r2 = latexToHtml(BS + 'cos^2 x - 3' + BS + 'sin^2 x');
t('cos^2 y sin^2 con sup', r2.includes('<sup>2</sup>') && r2.includes('cos') && !r2.includes(BS + 'cos'), r2);

const r3 = latexToHtml('f(x) = ' + BS + 'cos^2 x - 3' + BS + 'sin^2 x');
t('funcion completa sin residuos LaTeX', !r3.includes(BS), r3);

const sample = [
  'Dada la funcion $f(x) = \\cos^2 x - 3\\sin^2 x$ para $0 \\le x \\le \\pi$.',
  '$$\\cos^2 x - 3\\sin^2 x = 0$$',
  '$$\\tan x = \\frac{1}{\\sqrt{3}}$$',
  '$$r = \\sqrt{64} = \\mathbf{8 \\text{ cm}}$$',
  '$$\\frac{b}{\\sin \\theta} = \\frac{a}{\\sin 2\\theta}$$',
].join(NL);

const r4 = latexTextToHtml(sample);
const nb = (r4.match(/owa-math-block/g) || []).length;
t('bloques $$ -> owa-math-block', nb === 4, 'bloques=' + nb);
t('inline $..$ -> owa-math-inline', r4.includes('owa-math-inline'), r4);
t('sin residuos frac ni sqrt', !r4.includes(BS + 'frac') && !r4.includes(BS + 'sqrt'), r4);
t('mathbf -> <b>', /<b[ >]/.test(r4), 'r4: ' + r4.slice(0, 300));
t('le y pi convertidos', r4.includes('≤') && r4.includes('π'), r4);
t('negritas markdown -> <b>', latexTextToHtml('**demo**').includes('<b>demo</b>'));

const r5 = latexTextToHtml('Hola, esto es una nota normal.');
t('texto normal intacto', r5.includes('Hola, esto es una nota normal.'), r5);

const r6 = latexTextToHtml('Cuesta $5 y $8 mas');
t('$ de dinero sin LaTeX no se toca', !r6.includes('owa-math'), r6);

const r7 = latexToHtml(BS + 'frac{1}{');
t('frac incompleto no rompe', typeof r7 === 'string', r7);

console.log('RESULTADO: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
