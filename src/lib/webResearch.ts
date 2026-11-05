import {invoke,isTauri} from '@tauri-apps/api/core';
import {createStore,get as legacyGet,del} from 'idb-keyval';
import {protectedGet as get,protectedSet as set} from './charvisStorage';
export type ResearchSource={id:string;title:string;url:string;domain:string;snippet:string;provider:string;accessedAt:number;status:'result'|'read'|'unavailable';readError?:string;text?:string;truncated?:boolean};
export type SearchOptions={domains?:string[];limit?:number};
export type WebReply={url:string;status:number;contentType:string;body:string};
export type WebRequest=(url:string,mode:'search'|'read',signal:AbortSignal,body?:string)=>Promise<WebReply>;
export const requestWeb:WebRequest=async(url,mode,signal,body)=>{
 signal.throwIfAborted();if(!isTauri()){const response=await fetch(url,{method:body?'POST':'GET',body,headers:body?{'content-type':'application/x-www-form-urlencoded'}:undefined,signal});if(!response.ok)throw Error('La fuente no respondió a la consulta.');return {url:response.url||url,status:response.status,contentType:response.headers.get('content-type')||'text/html',body:await response.text()};}
 const requestId=crypto.randomUUID();let rejectAbort:(error:unknown)=>void=()=>{};const cancel=()=>{void invoke('charvis_web_cancel',{requestId}).catch(()=>{});rejectAbort(new DOMException('Consulta cancelada','AbortError'));};
 const operation=invoke<WebReply>('charvis_web_request',{url,mode,method:body?'POST':'GET',body,requestId});signal.addEventListener('abort',cancel,{once:true});
 try{return await Promise.race([operation,new Promise<never>((_,reject)=>{rejectAbort=reject;if(signal.aborted)cancel();})]);}finally{signal.removeEventListener('abort',cancel);}
};
const cacheStore=createStore('apheka-charvis-research','cache');
type Cached={time:number;items:ResearchSource[]};let cache:Record<string,Cached>={},ready:Promise<void>|undefined;
const load=()=>ready||(ready=get<Record<string,Cached>>('apheka_charvis_research_cache').then(async(value)=>{cache=value||await legacyGet<Record<string,Cached>>('results',cacheStore)||{};if(!value&&Object.keys(cache).length){await set('apheka_charvis_research_cache',cache);await del('results',cacheStore);}}).catch(()=>{}));
async function save(key:string,items:ResearchSource[]){if(!items.length)return;cache[key]={time:Date.now(),items};let size=0;cache=Object.fromEntries(Object.entries(cache).sort((a,b)=>b[1].time-a[1].time).slice(0,32).filter(([,entry])=>{size+=entry.items.reduce((sum,item)=>sum+(item.text?.length||0)+item.snippet.length+item.title.length,0);return size<=512000;}));await set('apheka_charvis_research_cache',cache).catch(()=>{});}
const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function canonicalWebUrl(raw:string){try{let url=new URL(raw.startsWith('//')?'https:'+raw:raw);if(url.hostname.endsWith('duckduckgo.com')&&url.searchParams.has('uddg'))url=new URL(url.searchParams.get('uddg')!);if(url.hostname==='wikipedia.org'||url.hostname.endsWith('.wikipedia.org')||url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(url.hostname)||/\.(local|internal|localhost)$/i.test(url.hostname))return null;url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^(fbclid|gclid|msclkid)$/i.test(key))url.searchParams.delete(key);return url.href;}catch{return null;}}
export function sourceId(url:string){let value=2166136261;for(const char of url)value=Math.imul(value^char.charCodeAt(0),16777619);return 'src-'+(value>>>0).toString(16);}
function source(title:string,url:string,snippet:string,provider:string):ResearchSource|null{const clean=canonicalWebUrl(url);if(!clean||!title.trim())return null;return {id:sourceId(clean),title:title.trim().slice(0,240),url:clean,domain:new URL(clean).hostname.replace(/^www\./,''),snippet:snippet.replace(/\s+/g,' ').trim().slice(0,900),provider,accessedAt:Date.now(),status:'result'};}
export function parseSearchHtml(html:string,provider:'DuckDuckGo'|'Bing'){
 const doc=new DOMParser().parseFromString(html.slice(0,2*1024*1024),'text/html'),rows:ResearchSource[]=[];
 if(provider==='DuckDuckGo'){for(const row of doc.querySelectorAll('.result,.web-result')){const a=row.querySelector<HTMLAnchorElement>('a.result__a,a.result-link');if(!a)continue;const item=source(a.textContent||'',a.getAttribute('href')||'',row.querySelector('.result__snippet')?.textContent||'',provider);if(item)rows.push(item);}}
 else for(const row of doc.querySelectorAll('li.b_algo')){const a=row.querySelector<HTMLAnchorElement>('h2 a');if(!a)continue;let href=a.getAttribute('href')||'';try{const url=new URL(href),encoded=url.searchParams.get('u');if(url.hostname.endsWith('bing.com')&&encoded?.startsWith('a1'))href=atob(encoded.slice(2).replace(/-/g,'+').replace(/_/g,'/'));}catch{/* Keep only directly valid targets below. */}const item=source(a.textContent||'',href,row.querySelector('.b_caption p,p')?.textContent||'',provider);if(item&&!new URL(item.url).hostname.endsWith('bing.com'))rows.push(item);}
 return rows;
}
export function rankWebResults(items:ResearchSource[],query:string,options:SearchOptions={}){
 const stop=new Set(['sobre','investiga','investigar','informacion','busca','buscar','cuales','como','para','con','del','las','los','que','una','por']);
 const terms=normalize(query).split(/[^\p{L}\p{N}]+/u).filter(term=>term.length>2&&!stop.has(term)),unique=new Map<string,ResearchSource>();
 for(const item of items){if(!canonicalWebUrl(item.url))continue;if(options.domains?.length&&!options.domains.some(d=>item.domain===d||item.domain.endsWith('.'+d)))continue;const previous=unique.get(item.url);if(!previous||item.snippet.length>previous.snippet.length)unique.set(item.url,item);}
 const ranked=[...unique.values()].map((item,index)=>{const title=normalize(item.title),excerpt=normalize(item.snippet),match=terms.reduce((sum,term)=>sum+(title.includes(term)?3:excerpt.includes(term)?1:0),0),institution=/(?:^|\.)(?:gob|gov|edu|ac)(?:\.|$)/i.test(item.domain)||/^(?:pubmed.ncbi.nlm.nih.gov|doi.org|arxiv.org|who.int|un.org|unicef.org|worldbank.org)$/.test(item.domain),social=/(?:^|\.)(?:pinterest|tiktok|facebook|instagram)\./.test(item.domain);return {item,match,score:match+(institution?2.5:0)-(social?3:0)+(item.snippet.length>=60?.5:0)+Math.max(0,8-index)*.1};}).sort((a,b)=>b.score-a.score);
 const relevant=ranked.some(row=>row.match>0)?ranked.filter(row=>row.match>0):ranked.slice(0,2),counts=new Map<string,number>();
 return relevant.filter(row=>{const count=counts.get(row.item.domain)||0;if(count>=2)return false;counts.set(row.item.domain,count+1);return true;}).slice(0,Math.max(1,Math.min(8,options.limit||4))).map(row=>row.item);
}
export async function searchWeb(query:string,options:SearchOptions,signal:AbortSignal,request:WebRequest=requestWeb,onStage?:(stage:string)=>void){
 const clean=query.replace(/\s+/g,' ').trim().slice(0,400);if(!clean)throw Error('Escribe qué quieres investigar.');const domains=(options.domains||[]).map(d=>d.toLowerCase().replace(/^www\./,'')).filter(d=>/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)).slice(0,5),key=JSON.stringify(['search',normalize(clean),domains,options.limit||8]);await load();signal.throwIfAborted();if(cache[key]&&Date.now()-cache[key].time<30*60*1000)return {query:clean,sources:rankWebResults(cache[key].items,clean,{...options,domains}),cached:true};
 const overall=AbortSignal.any([signal,AbortSignal.timeout(22000)]),searchQuery=clean+' -site:wikipedia.org'+(domains.length?' ('+domains.map(d=>'site:'+d).join(' OR ')+')':''),items:ResearchSource[]=[];let answered=false;
 onStage?.('Buscando fuentes');
 try{const result=await request('https://html.duckduckgo.com/html/','search',AbortSignal.any([overall,AbortSignal.timeout(7500)]),new URLSearchParams({q:searchQuery,kl:'es-es'}).toString());answered=true;items.push(...parseSearchHtml(result.body,'DuckDuckGo'));}catch{signal.throwIfAborted();}
 if(items.length<4&&!overall.aborted){onStage?.('Contrastando resultados');const found=await Promise.allSettled([
  request('https://www.bing.com/search?'+new URLSearchParams({q:searchQuery,count:'10'}),'search',AbortSignal.any([overall,AbortSignal.timeout(7500)])).then(result=>parseSearchHtml(result.body,'Bing')),

 ]);for(const answer of found)if(answer.status==='fulfilled'){answered=true;items.push(...answer.value);}}
 signal.throwIfAborted();onStage?.('Ordenando fuentes');const sources=rankWebResults(items,clean,{...options,domains});if(!sources.length&&!answered)throw Error('No se pudo consultar la web en esta red. Las fuentes guardadas siguen disponibles.');await save(key,sources);return {query:clean,sources,cached:false,note:sources.length?'Son resultados de búsqueda. Lee cada fuente antes de atribuirle información detallada.':'No se encontraron fuentes para esta consulta; no se generaron resultados ficticios.'};
}
export function extractWebPage(html:string,url:string,contentType='text/html'){
 const canonical=canonicalWebUrl(url);if(!canonical)throw Error('Enlace público no válido.');let title=new URL(canonical).hostname,text:string;
 if(contentType.startsWith('text/plain'))text=html;else{const doc=new DOMParser().parseFromString(html,'text/html');title=doc.querySelector('title')?.textContent?.trim()||title;for(const node of doc.querySelectorAll('script,style,noscript,svg,iframe,nav,header,footer,form,button,[aria-hidden=true]'))node.remove();const content=doc.querySelector('article,main,[role=main]')||doc.body;for(const node of content.querySelectorAll('p,h1,h2,h3,h4,li,section,div,br'))node.append('\n');text=content.textContent||'';}
 text=text.replace(/[\t ]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();if(text.length<100||/^(just a moment|access denied|verify you are human)/i.test(text))throw Error('La página no entregó texto legible. Puede requerir acceso o bloquear lectores automáticos.');const item=source(title,canonical,text.slice(0,400),'Lectura web')!;return {...item,status:'read' as const,text:text.slice(0,24000),truncated:text.length>24000};
}
export async function readWebPage(url:string,signal:AbortSignal,request:WebRequest=requestWeb){
 const clean=canonicalWebUrl(url);if(!clean)throw Error('Enlace público no válido.');await load();signal.throwIfAborted();const key='read:'+clean,hit=cache[key];
 if(hit&&Date.now()-hit.time<(hit.items[0]?.status==='unavailable'?120000:30*60*1000))return {...hit.items[0],cached:true};
 try{const response=await request(clean,'read',AbortSignal.any([signal,AbortSignal.timeout(12000)]));signal.throwIfAborted();const value=extractWebPage(response.body,response.url,response.contentType);await save(key,[value]);return {...value,cached:false};}
 catch(cause){signal.throwIfAborted();const reason=cause instanceof Error?cause.message:String(cause),item:ResearchSource={id:sourceId(clean),title:new URL(clean).hostname,url:clean,domain:new URL(clean).hostname.replace(/^www\./,''),snippet:'',provider:'Lectura web',accessedAt:Date.now(),status:'unavailable',readError:/legible|acceso|bloquear|403|401/i.test(reason)?'Esta fuente no permite extraer su texto. Usa otra fuente accesible; el extracto de búsqueda no equivale a haberla leído.':'No se pudo completar esta lectura dentro del tiempo disponible. Usa otra fuente o vuelve a intentarlo más tarde.'};await save(key,[item]);return {...item,cached:false};}
}
