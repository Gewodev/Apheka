const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});
 const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.find(p=>p.url().includes('127.0.0.1:1422'))||pages[0];assert.ok(page,'QA webview exists');
 await page.goto('http://127.0.0.1:1422/scripts/apheka-mcp-preview.html?view=playback');await page.waitForFunction(()=>window.__mcpApp?.hydrated);
 const graphics=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('graphics_status'));assert.equal(graphics.active,'compatible');await page.evaluate(()=>{localStorage.removeItem('apheka_compatible_pointer_v2');window.dispatchEvent(new Event('apheka:pointer-preference'));window.__pointerMoves=[];window.addEventListener('pointermove',e=>window.__pointerMoves.push([e.clientX,e.clientY]),{passive:true});});
 await page.evaluate(async()=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');const w=getCurrentWindow();await w.show();await w.setFocus();});
 const toggle=page.getByRole('button',{name:'Pantalla completa QA',exact:true}),exit=page.getByRole('button',{name:'Salir QA',exact:true});
 const check=async(label)=>{
  await toggle.click();await page.waitForFunction(()=>document.documentElement.dataset.fullscreen==='true');
  assert.equal(await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|is_fullscreen')),true);
  await page.mouse.move(250,220);await page.mouse.move(650,380,{steps:10});await page.waitForTimeout(100);
  assert.equal(await page.locator('.apheka-compatible-pointer').isVisible(),false,'normal system cursor remains in use');
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.elementFromPoint(650,380)).cursor),'none');
  assert.ok(await page.evaluate(()=>window.__pointerMoves.some(p=>p[0]===650&&p[1]===380)));
  await page.screenshot({path:'docs/apheka-6.10-native-'+label+'.png'});
  await exit.click();await page.waitForFunction(()=>document.documentElement.dataset.fullscreen==='false');
  assert.equal(await page.locator('.apheka-compatible-pointer').isVisible(),false);
 };
 await check('silent');
 await page.evaluate(async()=>{
  const bytes=new Uint8Array(44+8000*2*60),v=new DataView(bytes.buffer),s=(offset,text)=>[...text].forEach((c,i)=>bytes[offset+i]=c.charCodeAt(0));
  s(0,'RIFF');v.setUint32(4,bytes.length-8,true);s(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,bytes.length-44,true);
  window.__qaFile=new File([bytes],'Cursor QA.wav',{type:'audio/wav'});
  window.__mcpApp.addTrack({title:'Cursor nativo QA',artist:'QA',duration:60,source:'local',url:'Cursor QA.wav',isFavorite:false,listenedTime:0});
 });
 await page.waitForFunction(()=>window.__mcpApp.tracks.some(t=>t.title==='Cursor nativo QA'));
 await page.evaluate(async()=>{const track=window.__mcpApp.tracks.find(t=>t.title==='Cursor nativo QA');const {addTrackFileToDB}=await import('/src/lib/musicDb.ts');await addTrackFileToDB(track.id,window.__qaFile);const b=document.createElement('button');b.textContent='Reproducir prueba nativa';b.onclick=()=>window.__mcpApp.playTrack(track.id);document.body.append(b);});
 await page.getByRole('button',{name:'Reproducir prueba nativa',exact:true}).click();await page.waitForFunction(()=>!window.__qaAudio.paused&&window.__qaAudio.currentTime>.1);
 const source=await page.evaluate(()=>window.__qaAudio.src);await check('audio');assert.equal(await page.evaluate(()=>window.__qaAudio.paused),false);assert.equal(await page.evaluate(()=>window.__qaAudio.src),source);
 await page.evaluate(()=>window.__qaAudio.pause());
 console.log('PASS actual Windows WebView2: compatible composition, native cursor, no software overlay, fullscreen input and continuous local audio');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
