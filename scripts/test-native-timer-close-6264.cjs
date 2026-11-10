const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pointer = () => JSON.parse(execFileSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/read-native-pointer.ps1'], {encoding:'utf8'}));
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
  const page = browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('1422'));
  assert.ok(page, 'isolated native QA page');
  const errors = [], samples = [];
  page.on('pageerror',e=>errors.push(e.message));
  assert.match(await page.evaluate(async()=>{const {appDataDir}=await import('/node_modules/@tauri-apps/api/path.js');return appDataDir();}), /com\.apheka\.qa/);
  // Keep the native process running for a physical Windows input check afterwards.
  await page.goto('http://127.0.0.1:1422/scripts/apheka-timer-close-preview.html');
  if(process.env.APHEKA_QA_PREPARE==='1') {
    await page.evaluate(async()=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');await getCurrentWindow().maximize();await getCurrentWindow().setFocus();});
    await browser.close();return;
  }
  for (const mode of ['maximized','fullscreen','restored']) {
    await page.evaluate(async mode=>{
      const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');
      const w=getCurrentWindow();await w.setFullscreen(mode==='fullscreen');
      if(mode==='maximized')await w.maximize();else if(mode==='restored')await w.unmaximize();
    },mode);
    await page.waitForTimeout(300);
    for (let iteration=0;iteration<3;iteration++) {
      const created = page.context().waitForEvent('page');
      await page.getByRole('button',{name:'Abrir contador',exact:true}).click();
      const timer = await created;
      timer.on('pageerror',e=>errors.push(e.message));
      await timer.getByTitle('Cerrar timer',{exact:true}).waitFor();
      const closed = timer.waitForEvent('close');
      await timer.getByTitle('Cerrar timer',{exact:true}).click();
      await closed;
      await page.waitForTimeout(550);
      const focused = await page.evaluate(async()=>{const {getCurrentWindow}=await import('/node_modules/@tauri-apps/api/window.js');return getCurrentWindow().isFocused();});
      const state = pointer();
      const foregroundQa = /Owa_Studio\\src-tauri\\target\\debug\\owa-studio\.exe$/i.test(state.foregroundProcess);
      const cursorChecked = foregroundQa && state.foreground === state.underRoot;
      if(cursorChecked) {
        assert.equal(focused,true,'main returns to foreground after actual X close');
        assert.equal(state.flags,1,'Windows reports the native cursor visible');
        assert.notEqual(state.cursor,0,'native cursor handle exists');
        assert.equal(await page.evaluate(()=>document.hasFocus()),true,'WebView content regains focus');
      }
      assert.notEqual(await page.evaluate(()=>getComputedStyle(document.elementFromPoint(80,80)).cursor),'none');
      await page.getByRole('button',{name:'Comprobar clic',exact:true}).click();
      assert.ok((await page.locator('output').innerText()).includes(String(samples.length+1)));
      samples.push({mode,iteration,focused,foregroundQa,cursorChecked,...(cursorChecked?{flags:state.flags,cursor:state.cursor}:{reason:'Other desktop activity; no claim about physical cursor visibility'})});
    }
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('release/qa-6264-native-timer-close.json',JSON.stringify({samples,errors,scope:'Actual Windows/Tauri/WebView2 windows and FloatingTimer X handler, with responsive controls. Win32 visibility checked only when QA really owns foreground and pointer; otherwise explicitly skipped. Does not guarantee hardware cursor/GPU rendering.'},null,2));
  console.log('PASS 9 actual timer X closes: maximized, fullscreen and restored; responsive controls, no runtime errors; foreground cursor checks='+samples.filter(s=>s.cursorChecked).length);
  // Disconnect without closing the app; the physical input check follows.
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
