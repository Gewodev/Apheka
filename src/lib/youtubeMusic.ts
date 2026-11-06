import {filterArtistCatalog} from './artistCatalog';
import {creditedArtist,artistKey} from './artistIdentity';
import {recordingUnavailable} from './recordingAvailability';
import {musicRecommendationSeeds} from './musicPreferences';
import {catalogFetch} from './musicNetwork';
import type {Track} from '../store/AppContext';
import {musicRelevance,cleanMusicQuery,curateSongs,musicPlayCount} from './musicSearch';
export type MusicSong={id:string;title:string;artist:string;artistId?:string;artistIds?:string[];album?:string;albumId?:string;duration:number;cover:string;provider:'youtube';playCount?:number};
export type MusicEntity={id:string;name:string;artist:string;cover:string;listeners?:number;kind:'artist'|'album'};
export type MusicResult={songs:MusicSong[];artists:MusicEntity[];albums:MusicEntity[];continuation?:string;correction?:string};
let session:Promise<any>|undefined;
const searchInFlight=new Map<string,Promise<MusicResult>>();
const sessions=new Map<string,any>(),cache=new Map<string,{time:number;value:MusicResult}>();
async function transport(input:RequestInfo|URL,init?:RequestInit){
 const request=input instanceof Request?input:undefined,url=request?.url||String(input),signal=init?.signal||request?.signal;
 const timeout=AbortSignal.timeout(20000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const body=init?.body??(request&&request.method!=='GET'&&request.method!=='HEAD'?await request.clone().arrayBuffer():undefined);
 const target=url.includes('/youtubei/')?url.replace('https://www.youtube.com/','https://music.youtube.com/'):url,headers=new Headers(init?.headers||request?.headers);
 headers.set('Origin','https://music.youtube.com');headers.set('Referer','https://music.youtube.com/');headers.set('User-Agent',navigator.userAgent);
 const options={...init,method:init?.method||request?.method,headers,body,signal:combined};
 try{const response=await catalogFetch(target,options);if(response.status===403)throw Error('El catálogo rechazó la consulta (HTTP 403).');return response;}catch(error){
  const reason=error instanceof Error?error.message:String(error);
  if(combined.aborted||!target.startsWith('https://music.youtube.com/youtubei/')||/429/.test(reason)||!/403|conectar|HTTPS|fetch|network/i.test(reason))throw error;
  // Only an alternate official endpoint; keep the selected proxy and TLS checks.
  const alternate=new Headers(headers);alternate.set('Origin','https://www.youtube.com');alternate.set('Referer','https://www.youtube.com/');
  return catalogFetch(target.replace('https://music.youtube.com/','https://www.youtube.com/'),{...options,headers:alternate});
 }
}

// The provider's prebundled browser entry preserves initialization order of
// circular namespace exports when Rollup creates the production chunks.
async function client(){if(!session)session=import('youtubei.js/web.bundle').then(async({Innertube,Log})=>{Log.setLevel(Log.Level.ERROR);return Innertube.create({lang:'es',location:'PE',retrieve_player:false,generate_session_locally:true,fetch:transport});}).catch(error=>{session=undefined;throw error;});return session;}
const title=(value:any)=>typeof value==='string'?value:String(value?.toString?.()||'');
const catalogPlays=(node:any)=>{const text=title(node.views)||(node.flex_columns||[]).map((column:any)=>title(column.title)).find((text:string)=>/reproducciones|views|plays|escuchas|streams/i.test(text))||'';return /\d/.test(text)?musicPlayCount(text):undefined;};
const cover=(value:any)=>{const images=Array.isArray(value)?value:Array.isArray(value?.contents)?value.contents.flatMap((item:any)=>Array.isArray(item.image)?item.image:item.url?[item]:[]):Array.isArray(value?.image)?value.image:[];return [...images].sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url?.replace(/=w\d+[^?]*/, '=w600-h600-l90-rj')||'';};
export function normalizeMusicNodes(nodes:any[]):MusicResult{
 const songs=new Map<string,MusicSong>(),artists=new Map<string,MusicEntity>(),albums=new Map<string,MusicEntity>();
 for(const n of nodes){const kind=n.item_type,artist=(n.artists||[]).map((v:any)=>v.name).filter(Boolean).join(', '),id=n.id||n.endpoint?.payload?.browseId,name=title(n.title||n.name),image=cover(n.thumbnails||n.thumbnail),duration=Number(n.duration?.seconds||0);
 if(kind==='song'&&n.is_playable!==false&&n.is_available!==false&&(!n.playability_status?.status||n.playability_status.status==='OK')&&!recordingUnavailable(id)&&/^[\w-]{11}$/.test(id||'')&&name&&artist&&image&&duration>=20&&duration<=7200)songs.set(id,{id,title:name,artist,artistId:n.artists?.[0]?.channel_id,artistIds:(n.artists||[]).map((a:any)=>a.channel_id||a.id).filter((id:unknown)=>typeof id==='string'),album:n.album?.name,albumId:n.album?.id,duration,cover:image,provider:'youtube',playCount:catalogPlays(n)});
 if(kind==='artist'&&id&&name&&n.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType!=='MUSIC_PAGE_TYPE_USER_CHANNEL')artists.set(id,{id,name,artist:'',cover:image,listeners:/\d/.test(title(n.subtitle||n.subscribers))?musicPlayCount(title(n.subtitle||n.subscribers)):undefined,kind:'artist'});
 if(kind==='album'&&id&&name)albums.set(id,{id,name,artist,cover:image,kind:'album'});
 // Artist cards are returned separately from regular song shelves.
 if(n.type==='MusicCardShelf'&&n.on_tap?.payload?.browseId?.startsWith('UC')){const aid=n.on_tap.payload.browseId;artists.set(aid,{id:aid,name,artist:'',cover:cover(n.thumbnail),kind:'artist'});}
 }
 return {songs:[...songs.values()],artists:[...artists.values()],albums:[...albums.values()]};
}
async function parsed(page:any,query='',fragment=false):Promise<MusicResult>{const {YTNodes}=await import('youtubei.js/web.bundle'),memo=page.page?.contents_memo||page.contents_memo;const nodes=[...(memo?.getType(YTNodes.MusicResponsiveListItem)||[]),...(memo?.getType(YTNodes.MusicTwoRowItem)||[]),...(memo?.getType(YTNodes.MusicCardShelf)||[]),...(Array.isArray(page.contents)?page.contents:[])];const result=normalizeMusicNodes(nodes);
 if(query){result.songs=curateSongs(result.songs,fragment?'':query);result.artists=result.artists.filter(a=>musicRelevance(query,a.name,'')>0).sort((a,b)=>musicRelevance(query,b.name,'')-musicRelevance(query,a.name,''));result.albums=result.albums.filter(a=>musicRelevance(query,a.name,a.artist)>0);}
 result.correction=title(page.did_you_mean?.corrected_query||page.showing_results_for?.corrected_query)||undefined;
 if(page.has_continuation&&page.getContinuation){const key=crypto.randomUUID();if(sessions.size>=10)sessions.delete(sessions.keys().next().value!);sessions.set(key,{page,query});result.continuation=key;}
 return result;
}
async function searchCatalogOperation(query:string,kind:'all'|'song'|'artist'|'album'='all',signal?:AbortSignal,refresh=false):Promise<MusicResult>{query=cleanMusicQuery(query);const key=kind+':'+query.trim(),hit=cache.get(key);if(hit&&!refresh&&Date.now()-hit.time<600000)return hit.value;const yt=await client();if(signal?.aborted)throw new DOMException('Cancelado','AbortError');const page=await yt.music.search(query.trim().slice(0,200),{type:kind});if(signal?.aborted)throw new DOMException('Cancelado','AbortError');const value=await parsed(page,query);if(kind==='all'){const songResult=await searchMusicCatalog(query,'song',signal);value.songs=songResult.songs;value.continuation=songResult.continuation;value.artists.sort((a,b)=>musicRelevance(query,b.name,'')-musicRelevance(query,a.name,'')||value.songs.filter(s=>s.artistId===b.id).length-value.songs.filter(s=>s.artistId===a.id).length);}if(cache.size>=20)cache.delete(cache.keys().next().value!);cache.set(key,{time:Date.now(),value});return value;}
/** Share identical lookups; cancelling one subscriber never cancels another. */
export async function searchMusicCatalog(query:string,kind:'all'|'song'|'artist'|'album'='all',signal?:AbortSignal,refresh=false):Promise<MusicResult>{
 query=cleanMusicQuery(query);if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
 const key=kind+':'+query;let task=searchInFlight.get(key);
 if(!task){task=searchCatalogOperation(query,kind,undefined,refresh);searchInFlight.set(key,task);const current=task;void task.finally(()=>{if(searchInFlight.get(key)===current)searchInFlight.delete(key);}).catch(()=>{});}
 if(!signal)return task;
 return new Promise((resolve,reject)=>{const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Cancelado','AbortError'));};signal.addEventListener('abort',abort,{once:true});task!.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)abort();else resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});if(signal.aborted)abort();});
}
const continuationResults=new Map<string,Promise<MusicResult>>();
export async function moreMusicCatalog(key:string){
 let pending=continuationResults.get(key);if(pending)return pending;
 const saved=sessions.get(key);if(!saved)throw Error('Repite la búsqueda para cargar más resultados.');
 pending=(async()=>{const result=await parsed(await saved.page.getContinuation(),saved.query);if(saved.artist){result.songs=await filterArtistCatalog(saved.artist,result.songs);if(result.continuation){const next=sessions.get(result.continuation);if(next)next.artist=saved.artist;}}return result;})();
 if(continuationResults.size>=30)continuationResults.delete(continuationResults.keys().next().value!);continuationResults.set(key,pending);void pending.catch(()=>continuationResults.delete(key));return pending;
}
const artistCollections=new Map<string,{at:number;value:MusicResult}>();
export async function musicCollection(entity:MusicEntity,signal?:AbortSignal){
 signal?.throwIfAborted();if(!/^(UC|MPR)[\w-]{4,100}$/.test(entity.id))throw Error('Colección no válida.');
 const cached=entity.kind==='artist'?artistCollections.get(entity.id):undefined;if(cached&&Date.now()-cached.at<300000&&(!cached.value.continuation||sessions.has(cached.value.continuation)||continuationResults.has(cached.value.continuation)))return cached.value;
 const yt=await client(),page=await yt.actions.execute('/browse',{browseId:entity.id,client:'YTMUSIC',parse:true}),result=await parsed(page);
 if(entity.kind==='artist'){
  const {YTNodes}=await import('youtubei.js/web.bundle');
  // The artist's complete top-song playlist includes joint releases. The small
  // profile shelf and the first search page are previews, not the discography.
  const shelf=page.contents_memo?.getType(YTNodes.MusicShelf)?.find((row:any)=>row.endpoint?.payload?.browseId?.startsWith('VL'));
  let complete:MusicResult|undefined;try{if(shelf){signal?.throwIfAborted();complete=await parsed(await yt.music.getPlaylist(shelf.endpoint.payload.browseId));}}catch{signal?.throwIfAborted();}
  const songs=await searchMusicCatalog(entity.name,'song',signal);signal?.throwIfAborted();
  result.songs=await filterArtistCatalog(entity,[...new Map([...result.songs,...(complete?.songs||[]),...songs.songs].map(song=>[song.id,song])).values()],signal);
  result.continuation=complete?.continuation||songs.continuation;
  if(result.continuation){const next=sessions.get(result.continuation);if(next)next.artist=entity;}
  if(artistCollections.size>=12)artistCollections.delete(artistCollections.keys().next().value!);artistCollections.set(entity.id,{at:Date.now(),value:result});
 }else{
  const {YTNodes}=await import('youtubei.js/web.bundle'),memo=page.contents_memo,header=memo?.getType(YTNodes.MusicResponsiveHeader)?.[0]||memo?.getType(YTNodes.MusicDetailHeader)?.[0],runs=header?.strapline_text_one?.runs||header?.subtitle?.runs||[],artists=runs.filter((run:any)=>run.endpoint?.payload?.browseId?.startsWith('UC')).map((run:any)=>({name:run.text,channel_id:run.endpoint.payload.browseId}));
  const rows=(memo?.getType(YTNodes.MusicResponsiveListItem)||[]).filter((row:any)=>row.duration?.seconds&&/^[\w-]{11}$/.test(row.id||''));
  result.songs=normalizeMusicNodes(rows.map((row:any)=>({item_type:'song',id:row.id,title:row.title,artists:row.artists?.length?row.artists:row.authors?.length?row.authors:artists.length?artists:entity.artist?[{name:entity.artist}]:[],duration:row.duration,thumbnails:[{url:entity.cover,width:600}],album:{id:entity.id,name:entity.name}}))).songs;
 }
 result.songs=curateSongs(result.songs);return result;
}
export async function verifiedMusicSong(catalogId:string){const id=catalogId.replace(/^ytm:/,'');for(const {value} of cache.values()){const song=value.songs.find(s=>s.id===id);if(song)return song;}throw Error('Busca primero la canción para confirmar su identificador de catálogo.');}
let trendsPending:Promise<MusicResult>|undefined;
async function musicTrends(){
 const hit=cache.get('trends:PE');if(hit&&Date.now()-hit.time<900000)return hit.value;
 if(!trendsPending)trendsPending=(async()=>{
  const yt=await client(),explore=await yt.music.getExplore();let result=await parsed(explore);
  // Follow only a charts endpoint actually advertised by the provider.
  const charts=explore.top_buttons?.find((button:any)=>/charts|trending/i.test(button.endpoint?.payload?.browseId||''));
  if(charts?.endpoint)try{const chart=await parsed(await charts.endpoint.call(yt.actions,{client:'YTMUSIC',parse:true}));if(chart.songs.length)result={...chart,songs:curateSongs([...chart.songs,...result.songs])};}catch{/* Explore remains available when the chart is temporarily unavailable. */}
  cache.set('trends:PE',{time:Date.now(),value:result});return result;
 })().finally(()=>{trendsPending=undefined;});
 return trendsPending;
}
export async function musicRecommendations(tracks:Track[],history:string[]=[],playCounts:Record<string,number>={},signal?:AbortSignal){
 const seeds=musicRecommendationSeeds({tracks,history,playCounts});
 const trends=seeds.length?new Promise<MusicResult>(resolve=>{const empty={songs:[],artists:[],albums:[]},timer=setTimeout(()=>resolve(empty),1500);void musicTrends().then(value=>{clearTimeout(timer);resolve(value);},()=>{clearTimeout(timer);resolve(empty);});}):musicTrends();
 const responses=await Promise.allSettled([...seeds.map(name=>searchMusicCatalog(name,'song',signal)),trends]);
 if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
 if(responses.every(response=>response.status==='rejected'))throw Error('No se pudo consultar el catálogo.');
 const songs=new Map<string,MusicSong>();for(const response of responses)if(response.status==='fulfilled')for(const song of response.value.songs)songs.set(song.id,song);
 if(!songs.size&&responses.some(response=>response.status==='rejected'))throw Error('No se pudo consultar el catálogo.');
 return {songs:curateSongs([...songs.values()]).slice(0,60),artists:[],albums:[]} as MusicResult;
}
export function songTrack(item:MusicSong):Omit<Track,'id'>{return {title:item.title,artist:item.artist,duration:item.duration,source:'youtube',catalogId:'ytm:'+item.id,artistCatalogIds:item.artistIds?.length?item.artistIds:item.artistId?[item.artistId]:undefined,url:'https://www.youtube.com/watch?v='+item.id,coverUrl:item.cover,isFavorite:false,listenedTime:0};}


if(typeof window!=='undefined')window.addEventListener('apheka:music-network-change',()=>{session=undefined;sessions.clear();cache.clear();searchInFlight.clear();});

export {transport as musicCatalogTransport};

/** Song-category search for a lyric fragment; final acceptance requires actual lyric verification. */
export async function searchLyricCatalog(phrase:string,signal:AbortSignal){
 const yt=await client();if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 const page=await yt.music.search(phrase.slice(0,200),{type:'song'});
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 return (await parsed(page,phrase,true)).songs.filter(song=>!recordingUnavailable(song.id));
}

export async function discoverArtists(preferences:{tracks:Track[];history?:string[];playCounts?:Record<string,number>},query:string,signal:AbortSignal):Promise<MusicResult>{
 const sameName=(a:string,b:string)=>artistKey(a).replace(/-/g,' ')===artistKey(b).replace(/-/g,' ');const explicit=query.trim(),seeds=explicit?[explicit]:musicRecommendationSeeds(preferences).slice(0,3),artists=new Map<string,MusicEntity>(),songs=new Map<string,MusicSong>();let succeeded=false;
 const add=(page:MusicResult)=>{succeeded=true;for(const song of page.songs)songs.set(song.id,song);for(const artist of page.artists)if(/^UC[\w-]{4,100}$/.test(artist.id)&&artist.name.trim())artists.set(artist.id,artist);};
 // Artist-category results already identify catalog profiles. Song-credit aliases
 // are verified on opening the profile, not used to hide discovery results.
 const lookups=await Promise.allSettled(seeds.map(seed=>searchMusicCatalog(seed,'artist',signal)));signal.throwIfAborted();for(const [index,page] of lookups.entries())if(page.status==='fulfilled')add(explicit?page.value:{...page.value,artists:page.value.artists.filter(artist=>sameName(artist.name,seeds[index])||creditedArtist(seeds[index],artist.name))});
 if(explicit&&!artists.size){try{add(await searchMusicCatalog(explicit,'all',signal));}catch{signal.throwIfAborted();}}
 if(!explicit){let trend:MusicResult|undefined;try{trend=await musicTrends();signal.throwIfAborted();add(trend);}catch{signal.throwIfAborted();}
  const names=[...new Set([...(trend?.songs||[]),...(trend?.albums||[])].flatMap(song=>song.artist.split(/,|;| feat\.? | ft\.? /i)).map(name=>name.trim()).filter(Boolean))].filter(name=>!seeds.some(seed=>artistKey(seed)===artistKey(name))).slice(0,5);
  if(artists.size<12){const extra=await Promise.allSettled(names.map(name=>searchMusicCatalog(name,'artist',signal)));signal.throwIfAborted();for(const [index,page] of extra.entries())if(page.status==='fulfilled')add({...page.value,artists:page.value.artists.filter(artist=>sameName(artist.name,names[index])||creditedArtist(names[index],artist.name))});}
 }
 if(!succeeded)throw Error('No se pudo consultar el catálogo de artistas. Revisa la conexión o vuelve a intentarlo.');
 const exact=explicit?[...artists.values()].filter(artist=>sameName(artist.name,explicit)):[],exactKnown=exact.filter(artist=>artist.listeners===undefined||artist.listeners>=1000);const list=(exact.length?(exactKnown.length?exactKnown:exact):[...artists.values()]).filter(artist=>explicit||artist.listeners===undefined||artist.listeners>=1000);if(!explicit)list.sort((a,b)=>Number(seeds.some(seed=>artistKey(seed)===artistKey(b.name)))-Number(seeds.some(seed=>artistKey(seed)===artistKey(a.name)))||(b.listeners||0)-(a.listeners||0));if(explicit)list.sort((a,b)=>Number(artistKey(b.name)===artistKey(explicit))-Number(artistKey(a.name)===artistKey(explicit))||musicRelevance(explicit,b.name,'')-musicRelevance(explicit,a.name,''));
 return {songs:[...songs.values()],artists:list.slice(0,18),albums:[]};
}
