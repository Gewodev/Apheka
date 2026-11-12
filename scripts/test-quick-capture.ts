import assert from 'node:assert/strict';
import {parseCapture} from '../src/lib/quickCapture.ts';
const now=new Date(2026,11,31,12);
assert.deepEqual(parseCapture('/tarea Repasar capítulo fecha:mañana prioridad:alta curso:"Álgebra I"',now),{kind:'task',title:'Repasar capítulo',dueDate:'2027-01-01',priority:'high',courseName:'Álgebra I'});
for(const [prefix,kind] of [['nota','note'],['idea','idea'],['referencia','reference'],['diario','journal']])assert.equal(parseCapture('/'+prefix+' Texto').kind,kind);
assert.equal(parseCapture('Busca esta idea').kind,'search');assert.throws(()=>parseCapture('/tarea Imposible fecha:2026-02-31'));assert.equal(parseCapture('/tarea Leer prioridad:baja').priority,'low');assert.equal(parseCapture('/tarea Leer fecha:hoy',now).dueDate,'2026-12-31');
assert.equal(parseCapture('/nota Dos  espacios').title,'Dos  espacios');console.log('PASS typed capture: command types, local dates/year boundary, invalid dates, priorities, quoted courses and preserved text spacing');
