import type {Track} from '../store/AppContext';
export const isLibraryTrack=(track:Track)=>track.librarySaved!==false;
export const playableLibrary=(tracks:Track[],offline=false)=>tracks.filter(t=>isLibraryTrack(t)&&(!offline||t.source==='local'||!!t.localAudioPath));
export function radioTracks(tracks:Track[],sourcePool?:string[]){
 const library=tracks.filter(isLibraryTrack);if(!sourcePool)return library;
 const ids=new Set(sourcePool),selected=tracks.filter(track=>ids.has(track.id));
 return selected;
}
/** Weighted sampling without replacement, recent-history distance and artist variety. */
export function libraryRadioOrder(tracks:Track[],currentId:string|null,history:string[]=[],counts:Record<string,number>={},offline=false,random= Math.random,includeUnsaved=false):string[]{
 const pool=tracks.filter(t=>(includeUnsaved||isLibraryTrack(t))&&(!offline||t.source==='local'||!!t.localAudioPath)&&t.id!==currentId),recent=new Set(history.slice(0,Math.min(8,Math.max(0,pool.length-1))));
 const ranked=pool.map(t=>({track:t,score:-Math.log(Math.max(.000001,Math.min(.999999,1-random())))/(1/Math.sqrt(1+Math.max(0,counts[t.id]||0))*(t.isFavorite?1.2:1)*(recent.has(t.id)?.18:1))})).sort((a,b)=>a.score-b.score);
 const result:string[]=[];let artist=tracks.find(t=>t.id===currentId)?.artist;
 while(ranked.length){let index=ranked.findIndex(item=>item.track.artist!==artist);if(index<0)index=0;const [item]=ranked.splice(index,1);result.push(item.track.id);artist=item.track.artist;}
 return result;
}
export type MusicSequence={tracks:Track[];currentId:string|null;queue:string[];sourcePool?:string[];shuffle:boolean;repeat:'none'|'all'|'one';history?:string[];counts?:Record<string,number>;offline?:boolean};
/** A new cycle contains every eligible song exactly once, including the previous last song. */
export function renewMusicCycle(state:MusicSequence){
 const tracks=radioTracks(state.tracks,state.sourcePool),scope=new Set(tracks.map(t=>t.id));
 let order=libraryRadioOrder(tracks,null,state.history,state.counts,state.offline,Math.random,!!state.sourcePool);
 const previous=(state.history||[]).filter(id=>scope.has(id)).slice(0,order.length).reverse();
 if(order.length>1&&order.join('|')===previous.join('|'))order=[...order.slice(1),order[0]];
 if(order.length>1&&order[0]===state.currentId)order=[...order.slice(1),order[0]];
 return order;
}
export function nextMusicSelection(state:MusicSequence,manual=false):{id:string|null;queue:string[]}{
 const scope=state.sourcePool?new Set(state.sourcePool):null;
 const playable=new Set(state.tracks.filter(t=>(!scope||scope.has(t.id))&&(!state.offline||t.source==='local'||!!t.localAudioPath)&&(!state.shuffle||!!scope||isLibraryTrack(t))).map(t=>t.id));
 const queue=[...new Set(state.queue)].filter(id=>playable.has(id)&&id!==state.currentId);
 const current=state.tracks.find(track=>track.id===state.currentId);
 if(!manual&&state.repeat==='one'&&current&&(!state.offline||current.source==='local'||!!current.localAudioPath))return {id:current.id,queue};
 if(queue.length)return {id:queue[0],queue:queue.slice(1)};
 if(state.shuffle){if(state.repeat==='none')return {id:null,queue:[]};const radio=renewMusicCycle(state);return {id:radio[0]||null,queue:radio.slice(1)};}
 const pool=(state.sourcePool||playableLibrary(state.tracks,!!state.offline).map(t=>t.id)).filter(id=>playable.has(id)),at=pool.indexOf(state.currentId||'');
 if(state.sourcePool){if(state.repeat!=='all')return {id:null,queue:[]};const order=renewMusicCycle(state);return {id:order[0]||null,queue:order.slice(1)};}
 return {id:pool[at+1]||(state.repeat==='all'?pool[0]:null)||null,queue:[]};
}
