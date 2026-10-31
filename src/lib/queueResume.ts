import {dailyMusicOrder} from './dailyMusicOrder';
type Source={pool:string[];name?:string};
type Intent={source:Source|null;manual:boolean};
const KEY='apheka_queue_intent_v1';
export function readQueueIntent(storage:Pick<Storage,'getItem'>=localStorage):Intent{
 try{const value=JSON.parse(storage.getItem(KEY)||'null'),source=value?.source;return {manual:value?.manual===true,source:source&&Array.isArray(source.pool)?{name:typeof source.name==='string'?source.name.slice(0,200):undefined,pool:[...new Set<string>(source.pool.filter((id:unknown)=>typeof id==='string').slice(0,2000))]}:null};}catch{return {source:null,manual:false};}
}
export function rememberQueueSource(source:Source|null){try{localStorage.setItem(KEY,JSON.stringify({source,manual:false}));}catch{}}
export function markQueueManual(){try{localStorage.setItem(KEY,JSON.stringify({...readQueueIntent(),manual:true}));}catch{}}
export function resumeLibraryQueue(ids:readonly string[],currentId:string|null,saved:readonly string[],intent:Intent,seed:string,allIds:readonly string[]=ids){
 if(intent.source?.name==='Descubrir'){const valid=new Set(allIds),pool=[...new Set(intent.source.pool)].filter(id=>valid.has(id)),allowed=new Set(pool);return {queue:[...new Set(saved)].filter(id=>allowed.has(id)&&id!==currentId),source:{pool,name:'Descubrir'}};}
 const valid=new Set(ids),clean=(values:readonly string[])=>[...new Set(values)].filter(id=>valid.has(id)&&id!==currentId);
 const custom=!!intent.source&&!['Tu biblioteca','Mis canciones','Descubrir'].includes(intent.source.name||'');
 const pool=custom?intent.source!.pool.filter(id=>valid.has(id)):intent.manual&&intent.source?intent.source.pool.filter(id=>valid.has(id)):Array.from(valid);
 if(custom||intent.manual)return {queue:clean(saved).filter(id=>pool.includes(id)),source:{pool,name:custom?intent.source!.name:'Tu biblioteca'}};
 // A daily library display must not rewrite the queue the user was listening to.
 const restored=clean(saved);if(restored.length)return {queue:restored,source:{pool:currentId&&valid.has(currentId)?[currentId,...pool.filter(id=>id!==currentId)]:pool,name:'Tu biblioteca'}};
 let queue=dailyMusicOrder(pool.filter(id=>id!==currentId).map(id=>({id})),seed).map(row=>row.id);
 // Even a coincidental identical draw must not repeat the same automatic opening.
 const previous=clean(saved);if(queue.length>1&&queue.slice(0,5).join('|')===previous.slice(0,5).join('|'))queue=[...queue.slice(1),queue[0]];
 return {queue,source:{pool:currentId&&valid.has(currentId)?[currentId,...queue]:queue,name:'Tu biblioteca'}};
}
