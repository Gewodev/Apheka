import {cleanLyricText,lyricDefects,alignLyricText} from './lyricsText';
import {catalogFetch} from './musicNetwork';
import {musicText} from './musicSearch';
import {createStore,get,set} from 'idb-keyval';
const store=createStore('apheka-music-services','cache');
type Cached={time:number;revision?:number;value:Lyrics|null};
let cache:Record<string,Cached>={};let cacheReady:Promise<void>|null=null;
const readCache=()=>cacheReady||(cacheReady=get<Record<string,Cached>>('lyrics',store).then(value=>{cache=value||{};}).catch(()=>{}));
export type LyricLine={time:number;text:string};
export type Lyrics={plain:string;lines:LyricLine[];instrumental:boolean;source:'LRCLIB'|'Lyrics.ovh';sourceId:number;fetchedAt:number;recordingDuration?:number};
export function parseLrc(value:string):LyricLine[]{
 const offset=Number(value.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000,lines:LyricLine[]=[];
 for(const raw of cleanLyricText(value).slice(0,120000).split(/\r?\n/)){const stamps=[...raw.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];const text=raw.replace(/\[[^\]]*\]/g,'').replace(/<\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?>/g,'').trim();for(const stamp of stamps){const time=Number(stamp[1])*60+Number(stamp[2])+Number('0.'+(stamp[3]||0))+offset;if(Number.isFinite(time))lines.push({time:Math.max(0,time),text});}}
 return lines.sort((a,b)=>a.time-b.time).slice(0,2000);
}
export function lyricIndex(lines:LyricLine[],seconds:number){let low=0,high=lines.length-1,result=-1;while(low<=high){const mid=(low+high)>>1;if(lines[mid].time<=seconds+.08){result=mid;low=mid+1;}else high=mid-1;}return result;}
const cleanTitle=(value:string)=>value.replace(/\s*[([][^)\]]*(?:official|oficial|music video|lyrics?|audio|video oficial)[^)\]]*[)\]]/gi,'').trim().slice(0,300);
/** Imported file names often include an artist prefix that is not part of the title. */
export function lyricsLookupIdentity(title:string,artist:string){
 const performer=artist.replace(/\s*-\s*Topic$/i,'').trim().slice(0,200);let track=cleanTitle(title);
 const parts=track.match(/^(.+?)\s+[–—-]\s+(.+)$/);
 if(parts&&musicText(parts[1])===musicText(performer))track=parts[2].trim();
 return {track,performer};
}
/** Title and artist identity must agree; never synchronize a different recording. */
export function lyricsCandidate(row:any,title:string,artist:string,duration:number){
 if(!row||typeof row.trackName!=='string'||typeof row.artistName!=='string')return false;
 const t=musicText(cleanTitle(title)),r=musicText(cleanTitle(row.trackName)),a=musicText(artist),b=musicText(row.artistName);
 const sameArtist=a===b||a.startsWith(b+' ')||b.startsWith(a+' ');
 return t===r&&sameArtist&&(!duration||!Number(row.duration)||Math.abs(Number(row.duration)-duration)<=2);
}
export function lyricsCacheMatches(key:string,value:Lyrics|null,title:string,artist:string,duration:number){
 try{const [oldTitle,oldArtist,oldDuration]=JSON.parse(key);if(typeof oldTitle!=='string'||typeof oldArtist!=='string')return false;
 const old=lyricsLookupIdentity(oldTitle,oldArtist),current=lyricsLookupIdentity(title,artist),known=value?.recordingDuration||Number(oldDuration)||0;
 return musicText(old.track)===musicText(current.track)&&musicText(old.performer)===musicText(current.performer)&&(!duration||!!known&&Math.abs(known-duration)<=2);
 }catch{return false;}
}
async function fetchLyrics(title:string,artist:string,duration:number,online:boolean,signal:AbortSignal,force=false):Promise<Lyrics|null>{
 const {track,performer}=lyricsLookupIdentity(title,artist);
 const key=JSON.stringify([musicText(track),musicText(performer),Math.round(duration||0)]);
 await readCache();const rawHit=cache[key],hit=rawHit&&(rawHit.revision||0)>=5&&lyricDefects([rawHit.value?.plain||'',...(rawHit.value?.lines||[]).map(line=>line.text)].join('\n'))===0?rawHit:undefined;
 const saved=Object.entries(cache).filter(([id,row])=>(row.revision||0)>=5&&!!row.value?.lines.length&&lyricDefects(row.value.lines.map(line=>line.text).join('\n'))===0&&lyricsCacheMatches(id,row.value,title,artist,duration)).map(([,row])=>row).sort((a,b)=>b.time-a.time)[0];
 if(saved&&lyricDefects(saved.value?.plain||'')===0&&(!online||!force&&Date.now()-saved.time<30*86400000))return saved.value;
 if(hit&&(!online||(!force&&(hit.revision===5)&&Date.now()-hit.time<(hit.value?.lines.length?30*86400000:hit.value?.instrumental?86400000:hit.value?900000:300000))))return hit.value;
 if(!online)return null;if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 const overall=AbortSignal.any([signal,AbortSignal.timeout(24000)]);let successful=false,lastError:unknown;
 const lookup=async(url:string)=>{try{const response=await catalogFetch(url,{signal:AbortSignal.any([overall,AbortSignal.timeout(6500)])});if(!response.ok&&response.status!==404)throw Error('No se pudo consultar la letra.');successful=true;return response.ok?await response.json():null;}catch(error){if(signal.aborted)throw new DOMException('Cancelado','AbortError');lastError=error;return null;}};
 const params=new URLSearchParams({track_name:track,artist_name:performer});if(duration>0)params.set('duration',String(Math.round(duration)));
 const exact=await lookup('https://lrclib.net/api/get?'+params);
 let data=lyricsCandidate(exact,track,performer,duration)?exact:null;
 if(!data||(!data.syncedLyrics&&!data.instrumental)||lyricDefects(String(data.syncedLyrics||data.plainLyrics||''))>0){
  const found=await lookup('https://lrclib.net/api/search?'+new URLSearchParams({q:track+' '+performer}));
  if(Array.isArray(found))data=found.filter(row=>lyricsCandidate(row,track,performer,duration)).sort((a,b)=>lyricDefects(String(a.syncedLyrics||a.plainLyrics||''))-lyricDefects(String(b.syncedLyrics||b.plainLyrics||''))||Number(!!b.syncedLyrics)-Number(!!a.syncedLyrics)||Math.abs(Number(a.duration||duration)-duration)-Math.abs(Number(b.duration||duration)-duration))[0]||data;
 }
 let value:Lyrics|null=null;
 if(data&&(data.syncedLyrics||data.plainLyrics||data.instrumental))value={plain:cleanLyricText(String(data.plainLyrics||'')).slice(0,120000),lines:alignLyricText(parseLrc(String(data.syncedLyrics||'')),String(data.plainLyrics||'')),instrumental:data.instrumental===true,source:'LRCLIB',sourceId:Number(data.id)||0,fetchedAt:Date.now(),recordingDuration:Number(data.duration)||duration||undefined};
 if(!value&&track&&performer){const fallback=await lookup('https://api.lyrics.ovh/v1/'+encodeURIComponent(performer)+'/'+encodeURIComponent(track));if(typeof fallback?.lyrics==='string'&&fallback.lyrics.trim())value={plain:cleanLyricText(fallback.lyrics).slice(0,120000),lines:[],instrumental:false,source:'Lyrics.ovh',sourceId:0,fetchedAt:Date.now()};}
 if(value&&lyricDefects(value.lines.map(line=>line.text).join('\n'))>0){if(value.plain&&lyricDefects(value.plain)===0)value={...value,lines:[]};else value=null;}
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 // A temporary plain-text response or outage must not replace validated timing.
 if(!value?.lines.length&&saved?.value)return saved.value;
 if(!successful&&!value){if(hit?.value)return hit.value;throw lastError||Error('No se pudo conectar con las fuentes de letras.');}
 cache[key]={time:Date.now(),value,revision:5};cache=Object.fromEntries(Object.entries(cache).sort((a,b)=>b[1].time-a[1].time).slice(0,100));await set('lyrics',cache,store).catch(()=>{});return value;
}


type PendingLyrics={promise:Promise<Lyrics|null>;controller:AbortController;users:number;done:boolean};
const pendingLyrics=new Map<string,PendingLyrics>();
/** Shared requests keep both player views in sync without duplicate traffic. */
export async function loadLyrics(title:string,artist:string,duration:number,online:boolean,signal:AbortSignal,force=false):Promise<Lyrics|null>{
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 const key=JSON.stringify([title.trim().toLocaleLowerCase(),artist.trim().toLocaleLowerCase(),Math.round(duration||0),online,force]);
 let job=pendingLyrics.get(key);
 if(!job){const controller=new AbortController();job={controller,users:0,done:false,promise:fetchLyrics(title,artist,duration,online,controller.signal,force)};const entry=job;pendingLyrics.set(key,entry);void entry.promise.finally(()=>{entry.done=true;if(pendingLyrics.get(key)===entry)pendingLyrics.delete(key);}).catch(()=>{});}
 const entry=job;entry.users++;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(value:Lyrics|null,error?:unknown)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);entry.users--;if(!entry.users&&!entry.done){entry.controller.abort();if(pendingLyrics.get(key)===entry)pendingLyrics.delete(key);}if(error)reject(error);else resolve(value);};
  const abort=()=>finish(null,new DOMException('Cancelado','AbortError'));
  signal.addEventListener('abort',abort,{once:true});entry.promise.then(value=>finish(value),error=>finish(null,error));
 });
}
