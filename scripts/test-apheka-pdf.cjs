const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1422';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.isTauri=true;window.__pdfCalls=[];window.__TAURI_INTERNALS__={invoke:async(cmd,args)=>{if(cmd==='detect_installed_browsers')return ['Chrome','Edge','Firefox','Brave','Opera'].map(name=>({id:name.toLowerCase(),name,exe:'C:\\Browsers\\'+name+'.exe'}));if(cmd==='plugin:fs|exists')return args.path?.startsWith('C:\\Browsers\\')||false;if(cmd==='plugin:fs|stat')return {isFile:true,isDirectory:false,size:1000};if(cmd==='open_url_in_browser'){window.__pdfCalls.push(args);return;}throw Error(cmd);}};});
 await page.goto(base+'/scripts/apheka-pdf-preview.html');
 for(const fixture of ['PDF real','PDF heredado'])for(const name of ['Chrome','Edge','Firefox','Brave','Opera']){
   await page.getByRole('button',{name:fixture,exact:true}).click();
   const row=page.getByTitle(new RegExp('^'+name+' —'));if(!await row.count())await page.getByText('Abrir con',{exact:false}).first().click();
   await row.click();await page.waitForFunction(()=>window.__pdfCalls.length>0);
   const call=await page.evaluate(()=>window.__pdfCalls.pop());assert.equal(call.url,'C:\\Mis cursos\\Álgebra #1.pdf');assert.equal(call.exe,'C:\\Browsers\\'+name+'.exe');
 }
 // Browser chosen as PDF default is distinct from the ordinary link browser.
 await page.getByRole('button',{name:'PDF real',exact:true}).click();
 const chrome=page.getByTitle(/^Chrome —/);if(!await chrome.count())await page.getByText('Abrir con',{exact:false}).first().click();
 await chrome.hover();await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
 await page.getByRole('button',{name:'Para todos los cursos',exact:true}).click();await page.waitForFunction(()=>localStorage.getItem('owa_default_pdfapp_global_v1')==='browser:chrome');
 await page.waitForFunction(()=>window.__pdfCalls.length>0);await page.evaluate(()=>window.__pdfCalls=[]);
 await page.getByRole('button',{name:'PDF heredado',exact:true}).click();await page.getByText('Abrir',{exact:true}).click();await page.waitForFunction(()=>window.__pdfCalls.length>0);
 const defaultCall=await page.evaluate(()=>window.__pdfCalls.pop());assert.equal(defaultCall.exe,'C:\\Browsers\\Chrome.exe');assert.equal(defaultCall.url,'C:\\Mis cursos\\Álgebra #1.pdf');
 assert.equal(await page.evaluate(()=>localStorage.getItem('owa_default_browser_global_v1')),null,'PDF preference does not alter link browser');
 assert.deepEqual(errors,[]);console.log('PASS PDF menu: Chrome, Edge, Firefox, Brave and Opera receive the real saved path; legacy asset URLs are decoded before native opening');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
