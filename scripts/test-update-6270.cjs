const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stub=()=>{
  window.__nativeCalls=[];
  window.__TAURI_INTERNALS__={
    invoke:async(command,args)=>{
      window.__nativeCalls.push({command,args});
      if(command==='update_state')return {installed:'6.28.0',channel:null};
      if(String(command).includes('version'))return '6.27.0';
      return null;
    },
    transformCallback:(cb)=>cb,
    metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
  };
};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const report={steps:[],errors:[]},errors=[];let page;const step=async(name,fn)=>{await fn();report.steps.push(name);fs.writeFileSync('release/qa-6270-update.json',JSON.stringify({...report,errors},null,2));console.log('PASS',name);};
try{page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('qa6270update','1');localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),settings:{notifications:true},tracks:[],habits:[],notes:[],courses:[],tasks:[]}));});
await page.addInitScript(stub);
await page.goto('http://127.0.0.1:1426/scripts/runtime-6267.html');await page.waitForFunction(()=>window.__qaApp?.().hydrated);
await page.waitForTimeout(2500);

await step('a newer build raises a notice in the notification panel',async()=>{
 const calls=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='update_state').length);
 assert.ok(calls>0,'the update check must run on start');
 const badge=page.locator('.notification-trigger span');
 await badge.waitFor({timeout:8000});
 const count=await badge.innerText();
 assert.ok(Number(count)>=1,'the bell must show the pending notice: '+count);
 await page.locator('.notification-trigger').click();
 const item=page.locator('.notification-item').first();
 await item.waitFor();
 const text=await item.innerText();
 assert.ok(text.includes('6.28.0'),text);
 assert.ok(text.includes('Reiniciar'),text);
 await page.screenshot({path:'release/qa-6270-actualizacion.png'});
});
await step('the notice offers the update action and runs it',async()=>{
 const action=page.locator('.notification-action').first();
 await action.waitFor();
 assert.equal((await action.innerText()).trim(),'Reiniciar ahora');
 await action.click();
 await page.waitForFunction(()=>window.__nativeCalls.some(c=>c.command==='relaunch_app'),null,{timeout:8000});
});
await step('the same version is not announced twice',async()=>{
 const before=await page.evaluate(()=>window.__nativeCalls.filter(c=>c.command==='update_state').length);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(600);
 const notices=await page.locator('.notification-item').filter({hasText:'6.28.0'}).count();
 assert.equal(notices,1,'the same version must be announced once: '+notices);
 assert.ok(before>0);
});
assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync('release/qa-6270-update.json',JSON.stringify(report,null,2));}catch(e){if(page)await page.screenshot({path:'release/qa-6270-update-failure.png'});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
