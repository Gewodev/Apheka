const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  await page.addInitScript(()=>localStorage.setItem('apheka_charvis_v1',JSON.stringify({provider:'groq',models:{groq:'qa'}})));
  await page.route('**/scripts/retrieval-6241.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Retrieval QA</title>'}));
  await page.goto('http://127.0.0.1:1423/scripts/retrieval-6241.html');
  const checks=await page.evaluate(async()=>{
   const {retrieveCharvisContext}=await import('/src/lib/charvisRetrieval.ts');
   const text='Material introductorio sin el dato concreto. '.repeat(240)+'El coeficiente de restitución del EVA medido es 0,72. Marcador EVA_DATUM_072.';
   const sources=[{id:'physics',name:'Ensayo de restitución',text,readTool:'charvis_read_project_material',selector:{id:'physics'}},{id:'history',name:'Historia de España',text:'Fuentes primarias sobre la Guerra Civil española y la Segunda República.',readTool:'charvis_read_project_material',selector:{id:'history'}}];
   const result=await retrieveCharvisContext('¿Qué coeficiente de restitución se midió para EVA?',sources,new AbortController().signal);
   const budget=await retrieveCharvisContext('energía',Array.from({length:12},(_,i)=>({id:'large'+i,name:'Energía '+i,text:'Energía y unidades. '.repeat(15000),readTool:'charvis_read_project_material',selector:{id:'large'+i}})),new AbortController().signal);
   const cancelled=new AbortController();cancelled.abort();let rejected=false;try{await retrieveCharvisContext('restitución',sources,cancelled.signal);}catch{rejected=true;}
   const {saveChatIndex,saveChatThread}=await import('/src/lib/charvisWorkspace.ts');const now=Date.now();
   await saveChatIndex([], [{id:'physics',name:'Física',createdAt:now,materials:[{id:'physics-file',name:'Ensayo EVA.md',text}]},{id:'foreign',name:'Proyecto ajeno',createdAt:now,materials:[{id:'secret',name:'Clave ajena.md',text:'FOREIGN_PROJECT_SHOULD_NOT_BE_SENT'}]}]);
   await saveChatThread({id:'thread',title:'Restitución EVA',projectId:'physics',createdAt:now,updatedAt:now},[{id:'u',message:{role:'user',content:'Quiero revisar el ensayo de EVA.'}},{id:'a',message:{role:'assistant',content:'Revisemos el material.'}}]);
   localStorage.setItem('apheka_charvis_active_thread','thread');
   return {relevantTail:result.fragments.some(fragment=>fragment.text.includes('EVA_DATUM_072')&&fragment.offset>4000),noUnrelated:result.fragments.every(fragment=>fragment.sourceId==='physics'),bounded:budget.scannedCharacters<=480000&&budget.fragments.length<=4&&budget.fragments.every(fragment=>fragment.text.length<=1200)&&budget.truncatedSourceIds.length>0,cancelled:rejected};
  });
  for(const [name,value]of Object.entries(checks))assert.equal(value,true,name);
  await page.goto('http://127.0.0.1:1423/scripts/charvis-623-preview.html');
  await page.waitForFunction(()=>window.__charvisApp?.().hydrated);
  const input=page.getByRole('textbox',{name:'Mensaje para Charvis'});await input.waitFor();
  assert.equal(await page.locator('.charvis-web-toggle').count(),0,'No web toggle in an established chat');
  await input.fill('¿Qué coeficiente de restitución se midió para EVA?');await page.getByRole('button',{name:'Enviar a Charvis',exact:true}).click();
  await page.getByText('He recibido el material. Puedo ayudarte a organizarlo.',{exact:true}).waitFor();
  const payload=await page.evaluate(()=>JSON.stringify(window.__charvisRequests));
  assert.ok(payload.includes('EVA_DATUM_072')&&payload.includes('retrievedContext'));
  assert.equal(payload.includes('FOREIGN_PROJECT_SHOULD_NOT_BE_SENT'),false);
  await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.fonts.check('16px Manrope')),true);
  console.log('PASS relevant local passages beyond initial prefix, bounded lexical retrieval, cancellation, actual request integration, project isolation, local font and hidden web toggle in established chat; controlled provider');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
