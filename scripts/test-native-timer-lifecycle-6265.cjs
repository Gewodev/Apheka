const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const pointer=()=>JSON.parse(execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/read-native-pointer.ps1'],{encoding:'utf8'}));
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9224');
 const qaPort=process.env.APHEKA_QA_PORT||'1423';
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes(':'+qaPort));
 assert.ok(page);const errors=[],samples=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  assert.match(await page.evaluate(async()=>{const {appDataDir}=await import('/node_modules/@tauri-apps/api/path.js');return appDataDir();}),/com\.apheka\.qa/);
  await page.goto('http://127.0.0.1:'+qaPort+'/scripts/apheka-timer-lifecycle-preview.html');
  await page.waitForFunction(()=>window.__timerQa?.hydrated);
  await page.evaluate(async()=>{
   const {invoke}=await import('/node_modules/@tauri-apps/api/core.js');await invoke('close_floating_timer');
   window.__timerQa.setSessionType('chrono');window.__timerQa.setSessionTime(120);window.__timerQa.setIsTimerActive(true);
  });
  const exists=()=>page.evaluate(async()=>{const {WebviewWindow}=await import('/node_modules/@tauri-apps/api/webviewWindow.js');return !!await WebviewWindow.getByLabel('floating-timer');});
  const open=async()=>{
   assert.equal(await exists(),false);
   const created=page.context().waitForEvent('page');
   await page.getByTitle('Ventana flotante del timer',{exact:true}).click();
   const timer=await created;timer.on('pageerror',e=>errors.push(e.message));
   await timer.getByRole('button',{name:'Cerrar timer',exact:true}).waitFor();
   await timer.getByText('Concentrado',{exact:true}).waitFor();
   const instance=await timer.evaluate(()=>window.__qaTimerInstance=crypto.randomUUID());
   return {timer,instance};
  };
  const absent=async(timer)=>{
   await page.waitForFunction(async()=>{const {WebviewWindow}=await import('/node_modules/@tauri-apps/api/webviewWindow.js');return !await WebviewWindow.getByLabel('floating-timer');});
   assert.equal(timer.isClosed(),true,'old WebView target destroyed, not hidden');
  };
  const record=async(mode,action,closeMs)=>{
   await page.waitForTimeout(380);
   const fullscreen=await page.evaluate(async()=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');return getCurrentWindow().isFullscreen();});
   assert.equal(fullscreen,mode==='fullscreen','native fullscreen remains correct after closing');
   const state=pointer();const foregroundQa=/Owa_Studio\\src-tauri\\target\\debug\\owa-studio\.exe$/i.test(state.foregroundProcess);
   const cursorChecked=foregroundQa&&state.foreground===state.underRoot;
   if(cursorChecked){assert.equal(state.flags,1);assert.notEqual(state.cursor,0);}
   const sessionTime=await page.evaluate(()=>window.__timerQa.sessionTime);
   assert.ok(sessionTime>=120,'closing or recreating must not reset the study clock');
   await page.evaluate(()=>{window.__qaMoves=[];window.addEventListener('pointermove',e=>{window.__qaMoves.push([e.clientX,e.clientY]);},{once:true});});
   await page.mouse.move(260,280);const moves=await page.evaluate(()=>window.__qaMoves);assert.ok(moves.length>0,'pointer movement still reaches the full-screen renderer');
   samples.push({mode,action,fullscreen,closeMs,sessionTime,pointerInput:true,cursorChecked,...(cursorChecked?{flags:state.flags,cursor:state.cursor}:{reason:'Pointer or foreground outside QA; hardware cursor assertion skipped'})});
  };
  let lastInstance;
  for(const mode of (process.env.APHEKA_QA_FULLSCREEN_ONLY==='1'?['fullscreen']:['maximized','fullscreen','restored'])){
   await page.evaluate(async mode=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');const w=getCurrentWindow();await w.setFullscreen(mode==='fullscreen');if(mode==='maximized')await w.maximize();else if(mode==='restored')await w.unmaximize();},mode);
   await page.waitForTimeout(150);
   await page.waitForFunction(async expected=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');return await getCurrentWindow().isFullscreen()===expected;},mode==='fullscreen');
   if(process.env.APHEKA_QA_FULLSCREEN_ONLY==='1')await page.evaluate(async()=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');await getCurrentWindow().setFocus();});
   for(let iteration=0;iteration<(process.env.APHEKA_QA_FULLSCREEN_ONLY==='1'?6:2);iteration++){
    let {timer,instance}=await open();assert.notEqual(instance,lastInstance);lastInstance=instance;
    // The real Estudio toggle must destroy the currently open timer.
    let started=performance.now();let closed=timer.waitForEvent('close');await page.getByTitle('Ventana flotante del timer',{exact:true}).click();await closed;await absent(timer);await record(mode,'study-toggle',Math.round(performance.now()-started));
    ({timer,instance}=await open());assert.notEqual(instance,lastInstance);lastInstance=instance;
    // A closeRequested listener must not turn the X into a hidden/stale window.
    await timer.evaluate(async()=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');await getCurrentWindow().onCloseRequested(e=>e.preventDefault());});
    started=performance.now();closed=timer.waitForEvent('close');await timer.getByRole('button',{name:'Cerrar timer',exact:true}).click();await closed;await absent(timer);await record(mode,'timer-x',Math.round(performance.now()-started));
   }
  }
  await open();
  await page.evaluate(async()=>{const {invoke}=await import('/node_modules/@tauri-apps/api/core.js');await Promise.all(Array.from({length:6},()=>invoke('close_floating_timer')));});
  assert.equal(await exists(),false);checks.push('Six concurrent closes are idempotent and leave no timer label');
  const fresh=await open();await page.evaluate(async()=>{const {invoke}=await import('/node_modules/@tauri-apps/api/core.js');await invoke('close_floating_timer');});await absent(fresh.timer);
  checks.push('Reopen creates a fresh WebView after confirmed destruction');
  await page.evaluate(()=>window.__timerQa.setIsTimerActive(false));
  assert.deepEqual(errors,[]);
  checks.push('Actual Estudio and FloatingTimer components exercised, timer progression preserved');
  fs.writeFileSync(process.env.APHEKA_QA_FULLSCREEN_ONLY==='1'?'release/qa-6265-fullscreen.json':'release/qa-6265-native-lifecycle.json',JSON.stringify({checks,samples,errors,scope:'Real Windows/Tauri lifecycle through actual Estudio toggle and FloatingTimer X; registry absence and closed WebView targets verified. Native cursor state checked only over the QA foreground; GPU pixels not guaranteed. Close timings include automation/IPC overhead.'},null,2));
  console.log('PASS 12 destroy/recreate cycles, canceled close requests bypassed, 6 concurrent closes; native visibility checks='+samples.filter(s=>s.cursorChecked).length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
