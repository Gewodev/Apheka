const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage(),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.goto((process.env.APHEKA_QA_URL||'http://127.0.0.1:1422')+'/scripts/performance-preview.html?view=resize');
  await p.waitForFunction(()=>document.getElementById('size-qa')?.textContent==='{"w":300,"h":200}');
  await p.locator('#resize-qa').evaluate(el=>{el.style.width='480px';el.style.height='260px';});
  await p.waitForFunction(()=>document.getElementById('size-qa').textContent==='{"w":480,"h":260}');
  // A hidden app must not keep updating decorative clocks. Resume at real time.
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  const paused=await p.locator('#clock-qa').innerText();
  await p.waitForTimeout(2150);
  assert.equal(await p.locator('#clock-qa').innerText(),paused);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  const resumed=Number(await p.locator('#clock-qa').innerText());
  assert.ok(resumed>Number(paused)+2000);
  assert.ok(await p.evaluate(time=>Math.abs(Date.now()-time)<200,resumed));
  assert.deepEqual(errors,[]);
  console.log('PASS observer survives StrictMode, follows real element resizing; hidden clocks stop and resume at actual time');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
