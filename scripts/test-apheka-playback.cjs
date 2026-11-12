const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1422';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('owa_player_expanded','1');const Native=window.AudioContext;window.__audioContexts=0;window.AudioContext=class extends Native{constructor(...args){super(...args);window.__audioContexts++;}};});
 await page.goto(base+'/scripts/apheka-mcp-preview.html?view=playback');await page.waitForFunction(()=>window.__mcpApp?.hydrated);
 await page.evaluate(async()=>{
   const bytes=new Uint8Array(44+8000*2*60),v=new DataView(bytes.buffer),s=(offset,text)=>[...text].forEach((c,i)=>bytes[offset+i]=c.charCodeAt(0));
   s(0,'RIFF');v.setUint32(4,bytes.length-8,true);s(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,bytes.length-44,true);
   window.__qaFile=new File([bytes],'Prueba.wav',{type:'audio/wav'});
   window.__mcpApp.addTrack({id:'playback-qa',title:'Audio de prueba',artist:'QA',duration:60,source:'local',url:'Prueba.wav',isFavorite:false,listenedTime:0});
 });
 await page.waitForFunction(()=>window.__mcpApp.tracks.length===1);await page.evaluate(async()=>{const {addTrackFileToDB}=await import('/src/lib/musicDb.ts');await addTrackFileToDB(window.__mcpApp.tracks[0].id,window.__qaFile);});
 await page.getByRole('button',{name:'Reproducir prueba QA',exact:true}).click();await page.waitForFunction(()=>!window.__qaAudio.paused&&window.__qaAudio.currentTime>0.1).catch(async e=>{console.error(await page.evaluate(()=>({src:window.__qaAudio.src,ready:window.__qaAudio.readyState,error:window.__qaAudio.error?.message,playing:window.__mcpApp.isPlayingMusic,current:window.__mcpApp.currentTrackId,tracks:window.__mcpApp.tracks})));throw e;});
 const before=await page.evaluate(()=>({src:window.__qaAudio.src,time:window.__qaAudio.currentTime}));
 for(let i=0;i<3;i++){
   await page.getByRole('button',{name:'Pantalla completa QA',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement!==null);await page.mouse.move(620,320);await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>window.__qaAudio.paused),false);assert.notEqual(await page.evaluate(()=>getComputedStyle(document.elementFromPoint(620,320)).cursor),'none');
   await page.getByRole('button',{name:'Salir QA',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement===null);
 }
 const after=await page.evaluate(()=>({src:window.__qaAudio.src,time:window.__qaAudio.currentTime}));assert.equal(after.src,before.src,'fullscreen never reloads the audio source');assert.ok(after.time>before.time,'playback continues across transitions');
 await page.getByRole('button',{name:'Desplegar reproductor',exact:true}).click();await page.getByRole('button',{name:'Pausar música',exact:true}).click();await page.waitForFunction(()=>window.__qaAudio.paused);await page.getByRole('button',{name:'Reproducir música',exact:true}).click();await page.waitForFunction(()=>!window.__qaAudio.paused);assert.ok(await page.evaluate(()=>window.__qaAudio.currentTime)>before.time);
 await page.getByRole('button',{name:'Portada QA',exact:true}).click();await page.locator('.now-playing-view').waitFor();assert.equal(await page.locator('.now-playing-view canvas').count(),0,'no continuous aura canvas');assert.equal(await page.evaluate(()=>window.__audioContexts),0,'playback never creates a WebAudio analyser');await page.screenshot({path:'docs/apheka-6.10-playback.png'});await page.getByRole('button',{name:'Cerrar portada ampliada',exact:true}).click();
 const call=async args=>{const r=await page.evaluate(args=>window.__mcpRequest('apheka_music',args),args);assert.equal(r.isError,false,JSON.stringify(r));return r.structuredContent.result;};
 const firstId=await page.evaluate(()=>window.__mcpApp.currentTrackId);
 await page.evaluate(()=>window.__mcpApp.addTrack({title:'Segunda prueba',artist:'QA',duration:60,source:'local',url:'Segunda.wav',isFavorite:false,listenedTime:0}));await page.waitForFunction(()=>window.__mcpApp.tracks.length===2);
 const secondId=await page.evaluate(async()=>{const t=window.__mcpApp.tracks.find(t=>t.title==='Segunda prueba');const {addTrackFileToDB}=await import('/src/lib/musicDb.ts');await addTrackFileToDB(t.id,window.__qaFile);return t.id;});
 await call({action:'queue',trackIds:[secondId]});await call({action:'next'});await page.waitForFunction(id=>window.__mcpApp.currentTrackId===id&&!window.__qaAudio.paused,secondId);assert.equal(await page.evaluate(()=>window.__mcpApp.musicQueue.length),0);
 await call({action:'seek',value:0.25});await page.waitForFunction(()=>window.__qaAudio.currentTime>=15);await call({action:'pause'});await page.waitForFunction(()=>window.__qaAudio.paused);assert.ok(await page.evaluate(()=>Math.abs(window.__mcpApp.musicProgress-window.__qaAudio.currentTime/window.__qaAudio.duration)<.001),'pause publishes the exact position');
 await call({action:'pause'});assert.equal(await page.evaluate(()=>window.__qaAudio.paused),true,'pause is idempotent');await call({action:'play'});await page.waitForFunction(()=>!window.__qaAudio.paused);assert.ok(await page.evaluate(()=>window.__qaAudio.currentTime)>=15);
 await call({action:'previous'});await page.waitForFunction(id=>window.__mcpApp.currentTrackId===id&&!window.__qaAudio.paused,firstId);await call({action:'stop'});await page.waitForFunction(()=>window.__qaAudio.paused&&window.__mcpApp.currentTrackId===null);

 await page.route('https://bad-audio.apheka.test/**',route=>route.fulfill({contentType:'audio/mpeg',body:'invalid audio fixture'}));
 await page.evaluate(()=>{for(let i=0;i<3;i++)window.__mcpApp.addTrack({title:'Broken '+i,artist:'QA',duration:60,source:'audius',url:'https://bad-audio.apheka.test/'+i,isFavorite:false,listenedTime:0});});
 await page.waitForFunction(()=>window.__mcpApp.tracks.filter(t=>t.title.startsWith('Broken ')).length===3);
 await page.evaluate(([first,second])=>{window.__mcpApp.updateSettings({musicOffline:true});window.__mcpApp.setMusicQueue([window.__mcpApp.tracks.find(t=>t.title==='Broken 0').id,second]);window.__mcpApp.playTrack(first);},[firstId,secondId]);
 await page.waitForFunction(id=>window.__mcpApp.currentTrackId===id&&!window.__qaAudio.paused,firstId);
 await page.evaluate(()=>window.__qaAudio.dispatchEvent(new Event('ended')));await page.waitForFunction(id=>window.__mcpApp.currentTrackId===id&&!window.__qaAudio.paused,secondId);
 await page.evaluate(()=>{window.__mcpApp.updateSettings({musicOffline:false});window.__qaFailures=0;window.__qaAudio.addEventListener('error',()=>window.__qaFailures++);});await page.waitForTimeout(100);
 await page.evaluate(()=>{const ids=window.__mcpApp.tracks.filter(t=>t.title.startsWith('Broken ')).map(t=>t.id);window.__mcpApp.setQueueSource({pool:ids,name:'Failure QA'});window.__mcpApp.setMusicQueue(ids.slice(1));window.__mcpApp.playTrack(ids[0]);});
 await page.waitForFunction(()=>window.__qaFailures>=3&&!window.__mcpApp.isPlayingMusic);const failures=await page.evaluate(()=>window.__qaFailures);await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.__qaFailures),failures,'invalid queue must stop instead of refilling forever');assert.equal(failures,3);
 assert.deepEqual(errors,[]);console.log('PASS actual local audio: IndexedDB file, player click, 3 fullscreen cycles, continuous source/time, visible CSS pointer pause/resume, offline queue filtering and bounded 3-track failure recovery');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
