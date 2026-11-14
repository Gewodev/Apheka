const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stub = () => {
  window.__nativeCalls = [];
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => { window.__nativeCalls.push({ command, args }); return null; },
    transformCallback: (cb) => cb,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const report={steps:[],skipped:[]},errors=[];let page;const step=async(name,fn)=>{await fn();report.steps.push(name);fs.writeFileSync('release/qa-6270-media.json',JSON.stringify({...report,errors},null,2));console.log('PASS',name);};
try{page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{if(localStorage.getItem('qa6270media'))return;localStorage.setItem('qa6270media','1');const now=new Date();const tracks=[{id:'music0',title:'Tema uno',artist:'Artista uno',source:'local',duration:180,url:'C:/qa/audio1.mp3',coverUrl:'https://fixture.test/cover.svg',isFavorite:true,librarySaved:true,listenedTime:0},{id:'music1',title:'Tema dos',artist:'Artista uno',source:'local',duration:200,url:'C:/qa/audio2.mp3',isFavorite:false,librarySaved:true,listenedTime:0},{id:'music2',title:'Tema tres',artist:'Artista dos',source:'local',duration:220,url:'C:/qa/audio3.mp3',isFavorite:false,librarySaved:true,listenedTime:0}];localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),settings:{notifications:false},tracks,playlists:[{id:'list0',name:'Mi lista',trackIds:['music0','music1','music2'],createdAt:now.toISOString()}],musicQueue:['music1','music2'],currentTrackId:'music0',musicProgress:0.25,musicDuration:180,musicVolume:0.6,queueSource:{pool:['music0','music1','music2'],name:'Mi lista'}}));localStorage.setItem('apheka_queue_intent_v1',JSON.stringify({source:{pool:['music0','music1','music2'],name:'Mi lista'},manual:true}));});
await page.addInitScript(stub);
await page.goto('http://127.0.0.1:1426/scripts/runtime-6267.html');await page.waitForFunction(()=>window.__qaApp?.().hydrated);
await page.waitForTimeout(1200);

await step('native flyout receives the song that is really loaded',async()=>{
 const calls=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='media_controls_update').map(c=>c.args.payload));
 assert.ok(calls.length>0,'the native session must be updated');
 const last=calls[calls.length-1];
 assert.equal(last.title,'Tema uno',JSON.stringify(last));
 assert.equal(last.artist,'Artista uno');
 assert.equal(last.album,'West');
 assert.ok(last.duration>0,JSON.stringify(last));
 assert.ok('cover' in last,JSON.stringify(last));
});
await step('queue and playlist survive a restart without being emptied',async()=>{
 const before=await page.evaluate(()=>({queue:window.__qaApp().musicQueue,current:window.__qaApp().currentTrackId,source:window.__qaApp().queueSource}));
 assert.ok(before.queue.length>=2,JSON.stringify(before));
 await page.reload();await page.waitForFunction(()=>window.__qaApp?.().hydrated);await page.waitForTimeout(1500);
 const after=await page.evaluate(()=>({queue:window.__qaApp().musicQueue,current:window.__qaApp().currentTrackId,source:window.__qaApp().queueSource,progress:window.__qaApp().musicProgress,duration:window.__qaApp().musicDuration}));
 assert.equal(after.current,'music0',JSON.stringify(after));
 assert.ok(after.queue.length>=2,'the queue must survive the restart: '+JSON.stringify(after));
 assert.ok(after.queue.includes('music1')&&after.queue.includes('music2'),JSON.stringify(after));
 assert.ok(Math.abs(after.progress-0.25)<0.02,'the position must survive: '+JSON.stringify(after));
 assert.ok(after.duration>0,JSON.stringify(after));
});
await step('native flyout is coherent again after the restart',async()=>{
 const calls=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='media_controls_update').map(c=>c.args.payload));
 const last=calls[calls.length-1];
 assert.equal(last.title,'Tema uno',JSON.stringify(last));
 assert.ok(Math.abs(last.position-45)<6,'the flyout position must match the restored song: '+JSON.stringify(last));
 const cleared=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='media_controls_clear').length);
 assert.equal(cleared,0,'the session must not be cleared while a song is loaded');
});
await step('changing the song updates the flyout with the new one',async()=>{
 await page.evaluate(()=>window.__qaApp().playTrack('music2'));
 await page.waitForTimeout(600);
 const calls=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='media_controls_update').map(c=>c.args.payload));
 const last=calls[calls.length-1];
 assert.equal(last.title,'Tema tres',JSON.stringify(last));
 assert.equal(last.artist,'Artista dos');
});
await step('the cover travels only when it changes',async()=>{
 const calls=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='media_controls_update').map(c=>c.args.payload));
 const withCover=calls.filter(c=>'cover' in c);
 assert.ok(withCover.length>=1,'the first snapshot must carry the artwork');
 assert.ok(withCover.every(c=>typeof c.cover==='string'),'the cover is always a string when it travels');
});
assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync('release/qa-6270-media.json',JSON.stringify(report,null,2));}catch(e){if(page)await page.screenshot({path:'release/qa-6270-media-failure.png'});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
