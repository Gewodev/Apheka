const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('apheka_charvis_v1',JSON.stringify({provider:'groq',models:{groq:'qa'},webEnabled:true})));
  await page.goto('http://127.0.0.1:1423/scripts/charvis-623-preview.html');
  const input=page.getByRole('textbox',{name:'Mensaje para Charvis'});
  await page.waitForFunction(()=>window.__charvisApp?.().hydrated);
  await input.fill('Texto breve');
  const short=await input.boundingBox();
  assert.ok(short.height<50,'Compact initial line');
  await input.evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true})));
  assert.equal(await input.inputValue(),'Texto breve');
  assert.equal(await page.evaluate(()=>window.__charvisRequests.length),0,'IME Enter must not send');
  await input.fill(Array.from({length:30},(_,i)=>'Línea '+i).join('\n'));
  assert.ok((await input.boundingBox()).height<=178,'Bounded growing field');
  assert.equal(await input.evaluate(el=>el.scrollHeight>el.clientHeight),true,'Long text scrolls inside composer');
  await input.fill('Texto breve');
  assert.ok((await input.boundingBox()).height<50,'Shrinks after editing');
  await page.getByRole('button',{name:'Añadir al chat',exact:true}).click();
  const files=page.getByRole('menuitem',{name:'Archivos e imágenes',exact:true});
  assert.ok((await files.boundingBox()).width>140,'Attachment menu keeps full-width rows');
  await page.getByRole('button',{name:'Añadir al chat',exact:true}).click();
  await input.press('Enter');
  await page.getByText('He recibido el material. Puedo ayudarte a organizarlo.',{exact:true}).waitFor();
  assert.equal(await input.inputValue(),'');
  assert.equal(await page.evaluate(()=>window.__charvisRequests.filter(call=>call.payload.messages?.some(message=>message.role==='user'&&message.content==='Texto breve')).length),1);
  assert.deepEqual(errors,[]);
  console.log('PASS horizontal compact composer, bounded growth/shrink, IME guard, full attachment menu and one Enter send; controlled provider');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
