import {catalogFetch} from './musicNetwork';
import {createStore,get,set} from 'idb-keyval';
import type {Track} from '../store/AppContext';
const store=createStore('apheka-music-services','cache');
export type CatalogTrack={id:string;title:string;artist:string;duration:number;cover:string;url:string;permalink:string;downloadable?:boolean;verified?:boolean;genre?:string;remix?:boolean};
const HTTPS=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==='https:'?url.href:'';}catch{return '';}};
export function parseCatalog(value:unknown):CatalogTrack[]{
  const data=(value as {data?:unknown})?.data;if(!Array.isArray(data))throw Error('El catálogo devolvió un formato inesperado.');
  const ids=new Set<string>();return data.slice(0,40).flatMap(t=>{
    if(!t||typeof t.id!=='string'||!/^[-\w]{1,64}$/.test(t.id)||ids.has(t.id)||t.is_streamable!==true||t.access?.stream===false||(t.is_stream_gated&&t.access?.stream!==true)||t.is_delete||!Number.isFinite(t.duration)||t.duration<=0||t.duration>86400||typeof t.title!=='string')return [];
    const link=typeof t.permalink==='string'?t.permalink:'';
    ids.add(t.id);return [{id:t.id,title:t.title.slice(0,300),artist:String(t.user?.name||'Artista de Audius').slice(0,200),duration:t.duration,cover:HTTPS(t.artwork?.['480x480']||t.artwork?.['150x150']),url:'https://api.audius.co/v1/tracks/'+encodeURIComponent(t.id)+'/stream?app_name=West',permalink:HTTPS(link.startsWith('/')?'https://audius.co'+link:link),verified:t.user?.is_verified===true,genre:String(t.genre||'').slice(0,80),remix:!!t.remix_of?.tracks?.length,downloadable:t.is_downloadable===true&&t.is_download_gated!==true&&t.access?.download!==false}];
  });
}
export function catalogTrack(item:CatalogTrack):Omit<Track,'id'>{return {title:item.title,artist:item.artist,duration:item.duration,source:'audius',genre:item.genre,catalogId:item.id,url:item.url,coverUrl:item.cover,isFavorite:false,listenedTime:0};}
export async function getCatalogTrack(id:string,signal:AbortSignal){if(!/^[-\w]{1,64}$/.test(id))throw Error('Identificador de catálogo no válido.');const response=await catalogFetch('https://api.audius.co/v1/tracks/'+encodeURIComponent(id)+'?app_name=West',{signal});if(!response.ok)throw Error('La canción ya no está disponible.');const value=await response.json(),item=parseCatalog({data:[value.data]})[0];if(!item)throw Error('Esta grabación no permite reproducción directa.');return item;}
export async function loadCatalog(query:string,genre:string,offset:number,offline:boolean,signal:AbortSignal){
  const key=JSON.stringify([query.trim().slice(0,200),genre,offset]);
  const cache=await get<Record<string,{time:number;items:CatalogTrack[]}>>('catalog',store).catch(()=>undefined)||{};
  const found=cache[key];if(found&&(offline||Date.now()-found.time<600000))return {items:found.items,cached:true};
  if(offline)throw Error('Esta colección todavía no está en la caché. Tu biblioteca local sigue disponible sin conexión.');
  const params=new URLSearchParams({app_name:'West',limit:'24',offset:String(offset)});if(query.trim())params.set('query',query.trim().slice(0,200));else{params.set('time','week');if(genre)params.set('genre',genre);}
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),12000),abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  try{const response=await catalogFetch('https://api.audius.co/v1/tracks/'+(query.trim()?'search':'trending')+'?'+params,{signal:timeout.signal});if(!response.ok)throw Error('El catálogo no está disponible ahora ('+response.status+').');const items=parseCatalog(await response.json());if(signal.aborted)throw new DOMException('Cancelado','AbortError');cache[key]={time:Date.now(),items};const entries=Object.entries(cache).sort((a,b)=>b[1].time-a[1].time).slice(0,10);await set('catalog',Object.fromEntries(entries),store).catch(()=>{});return {items,cached:false};}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
