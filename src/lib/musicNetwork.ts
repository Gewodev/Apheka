import {isTauri,invoke} from '@tauri-apps/api/core';
export type MusicConnection={mode:'system'|'direct'|'custom';proxyUrl:string};
const key='apheka_music_network_v1';
function read():MusicConnection{try{const value=JSON.parse(localStorage.getItem(key)||'{}');return {mode:['system','direct','custom'].includes(value.mode)?value.mode:'system',proxyUrl:typeof value.proxyUrl==='string'?value.proxyUrl:''};}catch{return {mode:'system',proxyUrl:''};}}
let connection=read();
const listeners=new Set<()=>void>();
export const musicConnection={getTransportOptions:read,getSnapshot:()=>connection,subscribe:(callback:()=>void)=>{listeners.add(callback);return()=>listeners.delete(callback);},save:(value:MusicConnection)=>{let proxyUrl=value.proxyUrl.trim();if(value.mode==='custom'){const url=new URL(proxyUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Usa la dirección HTTP o HTTPS del proxy, sin usuario ni contraseña.');proxyUrl=url.href;}connection={mode:value.mode,proxyUrl};localStorage.setItem(key,JSON.stringify(connection));listeners.forEach(callback=>callback());window.dispatchEvent(new Event('apheka:music-network-change'));}};
export async function catalogFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 if(!isTauri())return fetch(input,init);
 const request=input instanceof Request?input:undefined,url=request?.url||String(input),signal=init?.signal||request?.signal;
 if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
 const body=init?.body??(request&&request.method!=='GET'&&request.method!=='HEAD'?await request.clone().arrayBuffer():undefined);
 const data=body==null?null:Array.from(new Uint8Array(await new Response(body).arrayBuffer()));
 const headers=Object.fromEntries([...new Headers(init?.headers||request?.headers).entries()].filter(([name])=>['accept','accept-language','content-type','origin','referer','user-agent','x-origin','x-goog-visitor-id'].includes(name)||name.startsWith('x-youtube-client-')));
 const activeConnection=read();
 const requestId=crypto.randomUUID();
 if(signal?.aborted)throw new DOMException('Cancelado','AbortError');
 const operation=invoke<{status:number;body:string;contentType:string}>('music_catalog_request',{requestId,url,method:init?.method||request?.method||'GET',headers,body:data,proxyMode:activeConnection.mode,proxyUrl:activeConnection.mode==='custom'?activeConnection.proxyUrl:undefined});
 let abort:(()=>void)|undefined;
 try{const result=await Promise.race([operation,new Promise<never>((_,reject)=>{if(signal){abort=()=>{void invoke('cancel_music_catalog_request',{requestId}).catch(()=>{});reject(new DOMException('Cancelado','AbortError'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}})]);if(signal?.aborted)throw new DOMException('Cancelado','AbortError');if(result.status>=400&&!(result.status===404&&(url.startsWith('https://lrclib.net/api/')||url.startsWith('https://api.lyrics.ovh/v1/'))))throw Error('El catálogo rechazó temporalmente la consulta (HTTP '+result.status+'). Revisa la conexión o inténtalo más tarde.');return new Response([204,205,304].includes(result.status)?null:result.body,{status:result.status,headers:{'content-type':result.contentType}});}finally{if(abort)signal?.removeEventListener('abort',abort);}
}
export function musicConnectionError(error:unknown){const text=error instanceof Error?error.message:String(error);if(/conex|proxy|HTTPS|HTTP 4|tiempo|catálogo rechazó/.test(text))return text.slice(0,220);return 'No se pudo consultar el catálogo. Puedes revisar la conexión o volver a intentarlo.';}
