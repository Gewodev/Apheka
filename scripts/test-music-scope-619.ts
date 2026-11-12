import assert from 'node:assert/strict';
import {nextMusicSelection,radioTracks,libraryRadioOrder} from '../src/lib/musicRadio.ts';
const tracks=['a','b','c','outside'].map(id=>({id,title:id,artist:id,duration:180,source:'local' as const,isFavorite:false,listenedTime:0}));
const selected=radioTracks(tracks,['a','b','c']);assert.deepEqual(selected.map(t=>t.id),['a','b','c']);
for(let i=0;i<100;i++){
 const queue=libraryRadioOrder(selected,'a');assert.deepEqual(new Set(queue),new Set(['b','c']));
 const next=nextMusicSelection({tracks,currentId:'c',queue:[],sourcePool:['a','b','c'],shuffle:true,repeat:'all'});
 assert.ok(['a','b'].includes(next.id!));assert.equal(next.queue.includes('outside'),false);
}
assert.equal(nextMusicSelection({tracks,currentId:'c',queue:[],sourcePool:['a','b','c'],shuffle:true,repeat:'none'}).id,null);
assert.equal(nextMusicSelection({tracks,currentId:'c',queue:[],sourcePool:['a','b','c'],shuffle:true,repeat:'one'}).id,'c');
assert.deepEqual(radioTracks(tracks,[]),[]);
console.log('PASS playlist radio scope, one complete queue, repeat all within selected source, repeat one and stop at end');
