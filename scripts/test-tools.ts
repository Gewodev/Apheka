// Test doctor #2: logica de las 8 herramientas + buscador difuso
import { parseLines } from '../src/lib/deckParse.ts';
import { fuzzyMatch, normalizeSearch } from '../src/lib/fuzzy.ts';

const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);
let pass = 0, fail = 0;
const t = (name: string, cond: boolean, extra?: string) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra ? '-> ' + JSON.stringify(extra).slice(0, 200) : ''); }
};

// ── FLASHCARDS ──
const f1 = parseLines('flashcardsDeck', 'Mitosis - Division celular' + NL);

t('flashcards: parsea par', f1.ok.length === 1 && f1.ok[0].q === 'Mitosis' && f1.ok[0].a === 'Division celular', f1.ok);
const f2 = parseLines('flashcardsDeck', 'A - 1' + NL + 'linea invalida sin separador' + NL + 'B - 2');
t('flashcards: cuenta invalidas', f2.ok.length === 2 && f2.bad === 1, f2);

// ── PRUEBA ──
const q1 = parseLines('quizDeck', 'Capital de Peru? | Lima | Quito | Bogota');
t('quiz: 3 alternativas (1 correcta + 2 distractores)', q1.ok.length === 1 && q1.ok[0].options.length === 3 && q1.ok[0].options[q1.ok[0].correct] === 'Lima', q1.ok);
const q2 = parseLines('quizDeck', 'P? | A');
t('quiz: minimo 2 alternativas ok', q2.ok.length === 1 && q2.ok[0].options.length === 1 && q2.ok[0].correct === 0, q2.ok);
const q3 = parseLines('quizDeck', 'P? | A | B | C | D | E');
t('quiz: maximo 4 alternativas (recorta E)', q3.ok[0].options.length === 4, q3.ok);

// ── EMPAREJAR ──
const m1 = parseLines('matchDeck', '1492 - Descubrimiento' + NL + 'F=ma - Newton');
t('match: parejas', m1.ok.length === 2 && m1.ok[0].a === '1492', m1.ok);
const m2 = parseLines('matchDeck', 'solo - una');
t('match: una pareja cuenta', m2.ok.length === 1, m2.ok);

// ── COMPLETAR ──
const c1 = parseLines('clozeDeck', 'La mitosis produce [dos] celulas');
t('cloze: extrae hueco', c1.ok.length === 1 && c1.ok[0].answers[0] === 'dos' && c1.ok[0].text.includes('[dos]'), c1.ok);
const c2 = parseLines('clozeDeck', 'Enunciado sin huecos');
t('cloze: sin huecos es invalida', c2.ok.length === 0 && c2.bad === 1, c2);

// ── FEYNMAN ──
const fe1 = parseLines('feynmanDeck', 'Fuerza | En fisica una fuerza altera el movimiento. | Cambia el movimiento; se mide en newtons');
t('feynman: 3 partes con fuente', fe1.ok.length === 1 && fe1.ok[0].source.length > 10 && fe1.ok[0].points.length === 2, fe1.ok);
const fe2 = parseLines('feynmanDeck', 'Fuerza - Cambia el movimiento; newtons');
t('feynman: formato antiguo compatible', fe2.ok.length === 1 && !fe2.ok[0].source && fe2.ok[0].points.length === 2, fe2.ok);

// ── V/F ──
const v1 = parseLines('vfDeck', 'La mitosis es division - V' + NL + 'El agua hierve a 50C - F');
t('vf: V y F parseadas', v1.ok.length === 2 && v1.ok[0].answer === true && v1.ok[1].answer === false, v1.ok);
const v2 = parseLines('vfDeck', 'Afirmacion - QUIZAS');
t('vf: valor invalido rechazado', v2.ok.length === 0 && v2.bad === 1, v2);

// ── SECUENCIAS ──
const s1 = parseLines('seqDeck', 'Fases > Profase > Metafase > Anafase');
t('seq: 3 pasos', s1.ok.length === 1 && s1.ok[0].steps.length === 3, s1.ok);
const s2 = parseLines('seqDeck', 'Solo un paso');
t('seq: 1 paso es invalido', s2.ok.length === 0 && s2.bad === 1, s2);

// ── CATEGORIZAR ──
const k1 = parseLines('catDeck', 'Ballena - Mamifero' + NL + 'Salmón - Pez');
t('cat: elementos', k1.ok.length === 2 && k1.ok[0].cat === 'Mamifero', k1.ok);

// ── FUZZY (buscador) ──
t('fuzzy: exacto', fuzzyMatch('Lima', 'Lima'));
t('fuzzy: tildes', fuzzyMatch('matematicas', 'Matemáticas'));
t('fuzzy: errata leve', fuzzyMatch('mitosiss', 'mitosis'));
t('fuzzy: vacio no explota', typeof fuzzyMatch('', 'x') === 'boolean');
t('normalizeSearch: diacriticos', normalizeSearch('Canción Única') === 'cancion unica');

console.log('RESULTADO: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
