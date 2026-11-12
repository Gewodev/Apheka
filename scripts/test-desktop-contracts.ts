import assert from 'node:assert/strict';
import {createSelectionStore} from '../src/lib/selectionStore.ts';
import {PlaybackRecovery} from '../src/lib/playbackRecovery.ts';
import {diagramGraph,diagramSvg} from '../src/lib/noteDiagram.ts';
import {parseLrc,lyricIndex} from '../src/lib/lyrics.ts';
import {parseCatalog} from '../src/lib/musicCatalog.ts';

let calls=0,version=1;
const notes=[{id:'one'}],store=createSelectionStore({notes,progress:0,action:()=>version});
store.subscribe(()=>calls++);const action=store.getSnapshot().action;
version=2;store.commit({notes,progress:0,action:()=>version});
assert.equal(calls,0);assert.equal(store.getSnapshot().action,action);assert.equal(action(),2,'stable action delegates to latest closure');
store.commit({notes,progress:.5,action:()=>3});assert.equal(calls,1);assert.equal(store.getSnapshot().notes,notes);assert.equal(action(),3);
store.commit({notes:[...notes],progress:.5,action:()=>4});assert.equal(calls,2);

const recovery=new PlaybackRecovery();assert.equal(recovery.failure('one',1).action,'ignore');
assert.deepEqual(recovery.failure('one',2),{action:'retry',delay:500});assert.deepEqual(recovery.failure('one',2),{action:'retry',delay:1000});
assert.equal(recovery.failure('one',2).action,'advance');assert.equal(recovery.canAdvance('one'),false);
assert.equal(recovery.failure('two',4).action,'advance');assert.equal(recovery.failure('three',3).action,'advance');assert.equal(recovery.canAdvance('four'),false);
recovery.played();assert.equal(recovery.canAdvance('one'),true);assert.equal(recovery.failure('one',2,false).action,'advance');

assert.equal(diagramGraph('A -> B -> C\nC -> A').nodes.length,3,'cycles terminate');
assert.throws(()=>diagramGraph(Array.from({length:33},(_,i)=>'Node '+i).join('\n')));
assert.throws(()=>diagramGraph('x'.repeat(6001)));
const svg=diagramSvg({aphekaDiagram:1,source:'<script>evil</script> -> Safe & sound',positions:{}},'apheka-diagram-test');
assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.equal((svg.match(/<tspan /g)||[]).length,2);
assert.throws(()=>diagramSvg({aphekaDiagram:1,source:'A',positions:{}},'bad" id'));
assert.ok(Number.isFinite(diagramGraph('A',{n0:{x:NaN,y:Infinity}}).width));

const lrc=parseLrc('[offset:-1000]\n[00:02.50][00:04.500]One\n[00:06]Two');
assert.deepEqual(lrc,[{time:1.5,text:'One'},{time:3.5,text:'One'},{time:5,text:'Two'}]);
assert.equal(lyricIndex(lrc,0),-1);assert.equal(lyricIndex(lrc,3.5),1);assert.equal(lyricIndex(lrc,99),2);
const valid={id:'safe',is_streamable:true,duration:60,title:'Title',user:{name:'Artist'},permalink:42};
const items=parseCatalog({data:[valid,{...valid},{...valid,id:'blocked',access:{stream:false}},{...valid,id:'gated',is_stream_gated:true},{...valid,id:'../bad'},{...valid,id:'no-time',duration:Infinity}]});
assert.equal(items.length,1);assert.equal(items[0].permalink,'');assert.match(items[0].url,/^https:\/\/api.audius.co\/v1\/tracks\/safe\/stream/);
assert.throws(()=>parseCatalog({data:'invalid'}));
console.log('PASS desktop contracts: stable latest actions, immutable snapshots, bounded playback recovery, safe/cyclic diagrams, LRC timing and catalog validation');
