const assert=require('node:assert/strict');const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:156,height:112}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let sequence=0;window.isTauri=true;window.__qa={closes:0,drags:0};window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'floating-timer'},currentWebview:{label:'floating-timer'}},transformCallback:()=>++sequence,invoke:async(cmd)=>{if(cmd==='close_floating_timer'){window.__qa.closes++;if(window.__qa.closes===1)throw Error('Controlled failure');return;}if(cmd==='plugin:window|start_dragging'){window.__qa.drags++;return;}if(cmd==='plugin:event|listen')return++sequence;if(cmd==='plugin:event|emit'||cmd==='plugin:event|unlisten')return;throw Error(cmd);}};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};});
 await page.goto((process.env.APHEKA_QA_URL||'http://127.0.0.1:1423')+'/scripts/apheka-floating-component-preview.html');
 const close=page.getByRole('button',{name:'Cerrar timer',exact:true});await close.click();await page.getByRole('alert').waitFor();
 assert.equal(await page.evaluate(()=>window.__qa.closes),1);assert.equal(await page.evaluate(()=>window.__qa.drags),0);
 await close.click();await page.waitForFunction(()=>window.__qa.closes===2);assert.equal(await page.getByRole('alert').count(),0);
 await close.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__qa.closes),3);
 assert.deepEqual(errors,[]);fs.writeFileSync('release/qa-6265-close-retry.json',JSON.stringify({checks:['Close failure is visible and retryable','Retry clears the error','X never starts native dragging','Keyboard Enter activates the same close command'],errors,scope:'Real FloatingTimer component in Edge, controlled IPC failure'},null,2));console.log('PASS close failure/retry, drag isolation and keyboard close');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
