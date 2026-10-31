import {record,text,choice,onlyFields,number,bool,type McpArgs} from './mcpCatalog';

export const DECK_CONTRACTS = {
  flashcardsDeck: {key:'cards',fields:'q*, a*'},
  quizDeck: {key:'questions',fields:'q*, options*:2..4 distinct strings, correct*:zero-based index'},
  matchDeck: {key:'pairs',fields:'a*, b* (at least 2 pairs)'},
  clozeDeck: {key:'items',fields:'text*:sentence with [answers], answers*:matching bracketed words'},
  feynmanDeck: {key:'concepts',fields:'concept*, source, points*:string[]'},
  vfDeck: {key:'items',fields:'text*, answer*:boolean'},
  seqDeck: {key:'seqs',fields:'name, steps*:2..30 strings in correct order'},
  catDeck: {key:'items',fields:'item*, cat*'},
} as const;
export const LEGACY_TOOL_TYPES = {
  quizzes:'quiz',blurting:'concept',feynman:'meaning',matching:'quiz',cloze:'key-data',categorization:'concept',mnemonics:'key-data',
  spacedRep:'procedure',leitner:'quiz',interleaving:'procedure',selfExplain:'meaning',elaborate:'concept',dualCoding:'resource',
  cornell:'concept',memoryPalace:'meaning',chunking:'procedure',retrievalGrid:'key-data',errorAnalysis:'key-data',timeline:'concept',
  mindmap:'resource',teach:'procedure',sq3r:'procedure',concrete:'concept',summarize:'concept',rubberDuck:'procedure',
} as const;
export const STUDY_TOOL_MODES = [...Object.keys(DECK_CONTRACTS),...Object.keys(LEGACY_TOOL_TYPES)];
const strings=(value:unknown,min=1,max=30) => {
  if(!Array.isArray(value)||value.length<min||value.length>max)throw new Error(`Se necesitan entre ${min} y ${max} textos.`);
  return value.map(v=>text(v,'Contenido',10000));
};
/** Strictly validate what runners consume; do not silently drop malformed study content. */
export function deckContent(mode:string,value:unknown):string {
  const contract=DECK_CONTRACTS[mode as keyof typeof DECK_CONTRACTS];
  if(!contract)throw new Error('Este modo usa campos de material, no un mazo.');
  const data=record(value);onlyFields(data,[contract.key]);
  const entries=data[contract.key];
  if(!Array.isArray(entries)||entries.length<(mode==='matchDeck'?2:1)||entries.length>500)throw new Error('Mazo: entre 1 y 500 elementos; Emparejar necesita al menos 2.');
  const normalized=entries.map(value=>{
    const e=record(value),out:McpArgs={};
    const fields=mode==='flashcardsDeck'?['q','a']:mode==='quizDeck'?['q','options','correct']:mode==='matchDeck'?['a','b']:mode==='clozeDeck'?['text','answers']:mode==='feynmanDeck'?['concept','source','points']:mode==='vfDeck'?['text','answer']:mode==='seqDeck'?['name','steps']:['item','cat'];
    onlyFields(e,fields);
    for(const key of fields) {
      if(e[key]===undefined&&['name','source'].includes(key))continue;
      if(['options','answers','points','steps'].includes(key))out[key]=strings(e[key],['options','steps'].includes(key)?2:1,key==='options'?4:30);
      else if(key==='correct') {const n=number(e[key],key,0,3);if(!Number.isInteger(n))throw new Error('correct debe ser un índice entero.');out[key]=n;}
      else if(key==='answer')out[key]=bool(e[key],key);
      else out[key]=text(e[key],key,10000,['source','name'].includes(key));
    }
    if(mode==='quizDeck'&&((out.correct as number)>=(out.options as string[]).length||new Set(out.options as string[]).size!==(out.options as string[]).length))throw new Error('Cuestionario: alternativas distintas e índice correcto dentro de la lista.');
    if(mode==='clozeDeck') {
      const actual=[...String(out.text).matchAll(/\[([^\]]+)\]/g)].map(m=>m[1].trim());
      if(JSON.stringify(actual)!==JSON.stringify(out.answers))throw new Error('Completar: answers debe coincidir con los huecos [entre corchetes], en orden.');
    }
    return out;
  });
  const content=JSON.stringify({[contract.key]:normalized});
  if(content.length>100000)throw new Error('Divide este mazo en bloques de hasta 100.000 caracteres.');
  return content;
}
export function studyToolMode(value:unknown):string {return choice(value,STUDY_TOOL_MODES,'toolMode');}
export function publicSourceUrl(value:unknown):string|undefined {
  if(typeof value!=='string')return;
  try {const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.hostname==='asset.localhost'||u.username||u.password)return;return u.href;}catch{return;}
}
export function sourceUrl(value:unknown):string {
  const url=publicSourceUrl(text(value,'URL de la fuente',4000));
  if(!url)throw new Error('Fuente: utiliza un enlace http(s) sin credenciales ni rutas internas.');
  return url;
}
