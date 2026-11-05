// Actual application modules, with only OS transport and persistence substituted.
// These checks exercise contracts and identity rules; they are not performance benchmarks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const stored=new Map(),modules=new Map();let nativeCalls=0,localCalls=0,clock=Date.now(),metadataCalls=0,reads=0;
const native={isTauri:()=>true,Channel:class{},invoke:async(command)=>{if(command==='charvis_local_transcribe'){localCalls++;return {text:'Dictado local'};}if(command==='charvis_request'){nativeCalls++;throw Error('(HTTP 429) [retry-after=2]');}return null;}};
const memory={protectedGet:async key=>{reads++;return stored.get(key);},protectedSet:async(key,value)=>{stored.set(key,value);}};
const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const root=path.resolve(__dirname,'..');
function load(file){file=path.resolve(root,file);if(!path.extname(file))file+='.ts';if(modules.has(file))return modules.get(file).exports;const module={exports:{}};modules.set(file,module);
 const requireLocal=name=>{if(name==='@tauri-apps/api/core')return native;if(name==='idb-keyval')return {createStore:()=>({}),get:async()=>undefined,set:async()=>{},del:async()=>{}};if(name.endsWith('charvisStorage'))return memory;if(name.endsWith('musicNetwork'))return {catalogFetch:async()=>{metadataCalls++;return new Response(JSON.stringify({results:[{artistId:1,artistName:'Sous-Sol',trackName:'Voy Despacito'},{artistId:1,artistName:'Sous-Sol',trackName:'Mi Pantalla'},{artistId:1,artistName:'Sous-Sol',trackName:'Soy'}]}),{headers:{'content-type':'application/json'}});}};if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name));throw Error('Unexpected dependency: '+name);};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const context={exports:module.exports,module,require:requireLocal,console,localStorage,window:{addEventListener(){}},navigator:{userAgent:'QA'},crypto:globalThis.crypto,URL,URLSearchParams,Response,Headers,Request,AbortSignal,AbortController,DOMException,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,btoa,atob,setTimeout,clearTimeout,Date:class extends Date{static now(){return clock;}}};
 vm.runInNewContext(source,context,{filename:file});return module.exports;
}
(async()=>{
 const identity=load('src/lib/artistIdentity.ts'),catalog=load('src/lib/artistCatalog.ts');
 assert.notEqual(identity.artistKey('Sous-Sol'),identity.artistKey('Sous Sol'));
 assert.equal(identity.creditedArtist('Bad Bunny, Jhay Cortez','Bad Bunny'),true);assert.equal(identity.creditedArtist('Bad Bunny Tribute','Bad Bunny'),false);
 assert.equal(identity.pinnedArtists([{id:'a',name:'Echo',catalogId:'UCa'},{id:'b',name:'Echo',catalogId:'UCb'}]).length,2);
 const artist={id:'UCmexico',name:'Sous-Sol',kind:'artist',cover:'x',artist:''},base={duration:180,cover:'x',provider:'youtube',artist:'Sous-Sol',playCount:100000};
 const songs=[{...base,id:'a',title:'Voy Despacito',artistIds:['UCmexico']},{...base,id:'b',title:'Mi Pantalla',artistIds:['UCmexico','UCfriend']},{...base,id:'c',title:'Soy',artist:'Majo Puente, Sous-Sol',artistIds:['UCfriend']},{...base,id:'d',title:'Wrong Song',artistIds:['UCwrong']},{...base,id:'e',title:'Low views',artistIds:['UCmexico'],playCount:2}];
 assert.equal((await catalog.filterArtistCatalog(artist,songs)).map(x=>x.id).join(','),'a,b,c');await catalog.filterArtistCatalog(artist,songs);assert.equal(metadataCalls,1);
 assert.equal(catalog.artistSongMatches({...songs[0],playCount:undefined},artist),true,'Unknown views must not be invented as zero');
 const web=load('src/lib/webResearch.ts');let requests=0;const request=async()=>{requests++;throw Error('HTTP 403');};
 const a=await web.readWebPage('https://example.org/private',new AbortController().signal,request);await web.readWebPage('https://example.org/private',new AbortController().signal,request);assert.equal(a.status,'unavailable');assert.equal(a.text,undefined);assert.equal(requests,1);
 assert.equal(web.canonicalWebUrl('https://es.wikipedia.org/wiki/Test'),null);
 const source=(title,domain)=>({id:domain,title,url:'https://'+domain+'/one',domain,snippet:'Información detallada de la consulta y sus datos disponibles para corroborar.',provider:'QA',accessedAt:clock,status:'result'});
 const ranked=web.rankWebResults([source('Fotos de vacaciones','random.test'),source('Incendios forestales en Junín','gob.pe'),source('Incendios Junín','instagram.com')],'incendios Junín');assert.equal(ranked[0].domain,'gob.pe');assert.ok(!ranked.some(s=>s.domain==='random.test'));
 const api=load('src/lib/charvis.ts');for(let i=0;i<2;i++)try{await api.requestCharvis('gemini','chat',{model:'qa',messages:[]});}catch{}assert.equal(nativeCalls,1);assert.equal(api.providerRetryDelay('gemini'),2000);
 assert.equal((await api.requestCharvis('gemini','transcribe',{},undefined,new Uint8Array([1,2]))).text,'Dictado local');assert.equal(localCalls,1,'Offline dictation must ignore a provider quota');clock+=2100;try{await api.requestCharvis('gemini','chat',{model:'qa',messages:[]});}catch{}assert.equal(nativeCalls,2);
 const {runCharvisAgent}=load('src/lib/charvisAgent.ts');let round=0,searches=0;const events=[];
 const common={provider:'groq',model:'qa',signal:new AbortController().signal,approve:async()=>true,onAction:()=>{},onMessage:m=>events.push(m),localContext:'{}',personalization:{access:'full'}};
 await runCharvisAgent({...common,messages:[{role:'user',content:'Investiga'}],request:async()=>++round<=5?{choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'c'+round,type:'function',function:{name:'charvis_web_search',arguments:JSON.stringify({query:'q'+round})}}]}}]}:{choices:[{message:{role:'assistant',content:'Listo'}}]},execute:async name=>{if(name==='charvis_web_search')searches++;return {sources:[]};}});
 assert.equal(searches,3);assert.ok(events.some(m=>m.role==='tool'&&m.content.includes('budget')));
 let writes=0;round=0;const args={entity:'tasks',data:{title:'Una sola tarea'}};
 await runCharvisAgent({...common,resume:true,messages:[{role:'user',content:'Crea una tarea'},{role:'assistant',content:null,tool_calls:[{id:'done',type:'function',function:{name:'apheka_create',arguments:JSON.stringify(args)}}]},{role:'tool',tool_call_id:'done',content:'{"id":"saved"}'}],request:async()=>++round===1?{choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'repeat',type:'function',function:{name:'apheka_create',arguments:JSON.stringify(args)}}]}}]}:{choices:[{message:{role:'assistant',content:'La tarea está creada.'}}]},execute:async name=>{if(name==='apheka_create')writes++;return {};}});assert.equal(writes,0,'Retry must reuse a confirmed mutation result');
 const workspaceKey='apheka_charvis_workspace_v2';stored.set(workspaceKey,{version:1,threads:[],projects:[{id:'project',name:'Material',createdAt:clock,materials:[{id:'file',name:'Libro',__charvisStoredAttachment:1}]}]});stored.set('apheka_charvis_file_file',{id:'file',name:'Libro',text:'Contenido extenso'});
 const workspace=load('src/lib/charvisWorkspace.ts'),index=await workspace.loadChatWorkspace();assert.equal(index.projects[0].materials[0].text,undefined);const before=reads;assert.equal((await workspace.loadProjectMaterials('project')).materials[0].text,'Contenido extenso');assert.equal(reads,before+1);
 console.log('PASS artist IDs, homonyms, collaborations, corroborated titles, unknown/low views; blocked-read cache; relevance and Wikipedia exclusion; 429 cooldown; offline voice routing; research budget; no repeated confirmed writes; deferred project file loading. Actual modules, controlled OS/network fixtures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
