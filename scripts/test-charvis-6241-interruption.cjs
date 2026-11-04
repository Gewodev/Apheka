const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>localStorage.setItem('apheka_charvis_v1',JSON.stringify({provider:'groq',models:{groq:'qa'}})));
  await page.goto('http://127.0.0.1:1423/scripts/charvis-623-preview.html');
  await page.waitForFunction(()=>window.__charvisApp?.().hydrated);
  const input=page.getByRole('textbox',{name:'Mensaje para Charvis'});
  await page.evaluate(()=>window.__failStream=true);await input.fill('Prueba de corte');
  await page.getByRole('button',{name:'Enviar a Charvis',exact:true}).click();
  await page.getByText('Texto recibido antes del corte.',{exact:true}).waitFor();
  await page.getByText('La respuesta se interrumpió. Se conservó el texto recibido.',{exact:true}).waitFor();
  await page.waitForFunction(async()=>{const {loadChatWorkspace,readChatThread}=await import('/src/lib/charvisWorkspace.ts');const index=await loadChatWorkspace();return index.threads.length&&JSON.stringify(await readChatThread(index.threads[0].id)).includes('Texto recibido antes del corte.');});
  await page.evaluate(()=>{window.__failStream=false;window.__holdStream=true;});
  await input.fill('Prueba de parada');await page.getByRole('button',{name:'Enviar a Charvis',exact:true}).click();
  await page.locator('.charvis-stream-answer').waitFor();
  await page.getByRole('button',{name:'Detener consulta de Charvis',exact:true}).click();
  await page.getByText('Texto recibido antes de detener.',{exact:true}).waitFor();
  await page.getByText('Respuesta detenida.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__charvisRequests.length),2,'No retry of interrupted requests');
  console.log('PASS partial response retained and persisted after connection failure or Stop, explicit interruption labels and no automatic retry; controlled provider');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
