const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.APHEKA_QA_URL||'http://127.0.0.1:1422')+'/scripts/apheka-release-preview.html',{waitUntil:'domcontentloaded'});
 const dialog=page.getByRole('dialog',{name:'Tu espacio de estudio, actualizado.',exact:true});await dialog.waitFor();
 const box=await dialog.boundingBox();assert.ok(box.x>=24&&box.y>=24&&box.x+box.width<=1176&&box.y+box.height<=776);assert.ok(await dialog.getByText('Hecho por Gewodev',{exact:true}).isVisible());assert.equal(await dialog.locator('li').count(),5);
 const action=dialog.getByRole('button',{name:'Continuar estudiando',exact:true});await action.focus();await page.keyboard.press('Tab');assert.ok(await action.evaluate(el=>el===document.activeElement));await page.screenshot({path:'docs/apheka-6.8-actualizacion.png'});
 await page.evaluate(()=>document.documentElement.dataset.theme='claro');await page.screenshot({path:'docs/apheka-6.8-actualizacion-clara.png'});await page.keyboard.press('Enter');await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__noticeAcknowledged),true);assert.deepEqual(errors,[]);console.log('PASS update notice bounds, changelog, Gewodev credit, keyboard focus and acknowledgement');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
