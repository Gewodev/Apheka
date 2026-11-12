import assert from 'node:assert/strict';
import {parseAssistantPack,assistantNoteHtml,buildAssistantSkillPrompt} from '../src/lib/assistantPack.ts';
import {courseStudySeconds} from '../src/lib/courseStudy.ts';
const valid={format:'apheka.study.v1',title:'Álgebra',notes:[{title:'Vectores',content:'Un vector\n\nEjemplo <script>alert(1)</script>'}],tasks:[{title:'Practicar'}],flashcards:[{question:'¿Qué es un vector?',answer:'Un elemento de un espacio vectorial.'}]};
const pack=parseAssistantPack('```json\n'+JSON.stringify(valid)+'\n```');assert.equal(pack.tasks[0].estimatedMinutes,25);assert.equal(pack.notes.length,1);
assert.equal(assistantNoteHtml('Hola\n\n<iframe>'),'\u003cp>Hola</p><p>&lt;iframe&gt;</p>');
assert.equal(parseAssistantPack(JSON.stringify({...valid,notes:[valid.notes[0],valid.notes[0]]})).notes.length,1);
for(const bad of [{...valid,commands:['rm']},{...valid,notes:[{title:'',content:'x'}]},{...valid,tasks:[{title:'x',estimatedMinutes:-1}]},{...valid,flashcards:[{question:'x',answer:''}]},{format:'apheka.study.v1',title:'Vacío'},{...valid,notes:Array(41).fill(valid.notes[0])}])assert.throws(()=>parseAssistantPack(JSON.stringify(bad)));
assert.throws(()=>parseAssistantPack('x'.repeat(220001)));assert.throws(()=>parseAssistantPack('Aquí tienes '+JSON.stringify(valid)));
for(const client of ['ChatGPT','Claude','Gemini','Copilot','Otro asistente o IDE']){const prompt=buildAssistantSkillPrompt(client,'mixed','Preparar examen','Matemáticas');assert.ok(prompt.includes(client));assert.ok(prompt.includes('apheka.study.v1'));assert.ok(prompt.includes('yo revisaré e importaré'));}
const courses=[{id:'c',name:'Álgebra',hoursStudied:9},{id:'d',name:'Historia',hoursStudied:2}];
const sessions=[{type:'chrono',startedAt:'2026-10-24T10:00:00Z',duration:600,courseId:'c',taskId:'t'},{type:'break',startedAt:'2026-10-24T10:00:00Z',duration:1000,courseId:'c'},{type:'chrono',startedAt:'2026-10-24T10:00:00Z',duration:800,courseId:'c',isDistraction:true}];
assert.deepEqual(courseStudySeconds(courses,[{id:'t',course:'Álgebra',studyTime:660}],sessions),{c:660,d:7200});
assert.equal(courseStudySeconds(courses,[{id:'t',course:'Álgebra',studyTime:NaN}],sessions).c,600);
assert.equal(courseStudySeconds(courses,[],[{type:'chrono',startedAt:'bad-date',duration:600,courseId:'c'}]).c,32400,'legacy counter retained without reliable history');
assert.deepEqual(courseStudySeconds(courses,[],[{type:'chrono',startedAt:'2026-10-24T10:00:00Z',duration:600,subjects:['c','d','c']}]),{c:300,d:300});
console.log('PASS assistant packs: formats, limits, escaping, duplicates, client prompts; course time: saved/live reconciliation, invalid counters, rest/distraction exclusion and shared sessions');
