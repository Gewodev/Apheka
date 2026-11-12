const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1422';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.addInitScript(()=>{
  window.isTauri=true;let running=false,writes=false;const secret='Bearer QA-PRIVATE-TOKEN';
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.__rejectClipboard)throw Error("Clipboard denied");window.__copied=text;}}});
  window.__TAURI_INTERNALS__={invoke:async(cmd,args,options)=>{
   if(cmd==='mcp_start'){running=true;writes=args.options.allowWrites;}
   if(cmd==='mcp_stop')running=false;
   if(['mcp_start','mcp_status'].includes(cmd))return {running,allowWrites:writes,url:'http://127.0.0.1:38476/mcp',toolCount:22,pending:0};
   if(cmd==='mcp_connection')return {local:{mcpServers:{apheka:{command:'C:\\APHEKA estable\\owa-studio.exe',args:['--mcp']}}},http:{mcpServers:{apheka:{url:'http://127.0.0.1:38476/mcp',headers:{Authorization:secret}}}}};
   if(cmd==='plugin:dialog|save')return 'D:\\QA\\connector.json';
   if(cmd==='plugin:fs|write_text_file'){window.__exported={path:decodeURIComponent(options.headers.path),text:new TextDecoder().decode(args)};return;}
   throw Error(cmd);
  }};
 });
 await page.goto(base+'/scripts/apheka-connector-preview.html');
 await page.getByRole('checkbox',{name:/Permitir cambios/}).check();await page.waitForTimeout(5200);assert.equal(await page.getByRole('checkbox',{name:/Permitir cambios/}).isChecked(),true,'polling preserves pre-activation choice');
 await page.getByRole('button',{name:'Preparar conexión y copiar prompt',exact:true}).click();await page.getByRole('button',{name:'Desactivar',exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__copied)).includes('owa-studio.exe'));assert.ok(!(await page.evaluate(()=>window.__copied)).includes('QA-PRIVATE-TOKEN'));assert.equal(await page.getByText('Conexión verificada',{exact:true}).count(),0,'activation does not pretend the client connected');
 await page.getByText('Configuración avanzada y exportación',{exact:true}).click();
 for(const id of ['custom','claude-desktop','claude-code','codex','cursor','vscode','gemini','chatgpt']){
  await page.getByLabel('Asistente o IDE',{exact:true}).selectOption(id);
  await page.getByRole('button',{name:'Copiar prompt de conexión',exact:true}).click();const handoff=await page.evaluate(()=>window.__copied);assert.ok(handoff.includes('owa-studio.exe'));assert.ok(handoff.includes('apheka_describe'));assert.ok(!handoff.includes('QA-PRIVATE-TOKEN'));
  await page.getByRole('button',{name:id==='chatgpt'?'Copiar backend stdio':'Copiar configuración',exact:true}).click();
  const config=await page.evaluate(()=>window.__copied);assert.ok(config.includes('owa-studio.exe'));assert.ok(config.includes('--mcp'));
  if(id==='codex')assert.ok(config.startsWith('[mcp_servers.'));else assert.ok(JSON.parse(config)[id==='vscode'?'servers':'mcpServers']);
 }
 await page.getByLabel('Asistente o IDE',{exact:true}).selectOption('custom');await page.getByText('Personalizar mi complemento',{exact:true}).click();await page.getByLabel('Nombre de tu asistente o IDE',{exact:true}).fill('Mi IA');await page.getByLabel('Nombre del complemento',{exact:true}).fill('Mi complemento');await page.getByLabel('Transporte compatible',{exact:true}).selectOption('http');
 await page.getByRole('button',{name:'Guardar perfil',exact:true}).click();assert.ok((await page.evaluate(()=>localStorage.getItem('apheka_mcp_profiles'))).includes('Mi complemento'));
 await page.getByRole('button',{name:'Copiar configuración',exact:true}).click();assert.ok((await page.evaluate(()=>window.__copied)).includes('QA-PRIVATE-TOKEN'));
 assert.ok(!(await page.locator('body').innerText()).includes('QA-PRIVATE-TOKEN'),'secret is hidden in the preview');
 await page.getByRole('button',{name:'Copiar prompt de conexión',exact:true}).click();assert.ok(!(await page.evaluate(()=>window.__copied)).includes('QA-PRIVATE-TOKEN'));
 assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('QA-PRIVATE-TOKEN'),'token is never saved in browser preferences');
 await page.getByRole('button',{name:'Exportar JSON',exact:true}).click();await page.waitForFunction(()=>window.__exported);const exported=await page.evaluate(()=>window.__exported);assert.ok(JSON.stringify(exported).includes('connector.json'),JSON.stringify(exported));
 await page.evaluate(async()=>{const {recordMcpActivity}=await import('/src/lib/mcpActivity.ts');for(const name of ['apheka_describe','apheka_overview',...Array(14).fill('apheka_list')])recordMcpActivity({id:crypto.randomUUID(),name,time:Date.now(),status:'ok'});});await page.getByText('Conexión verificada',{exact:true}).waitFor();
 await page.evaluate(()=>window.__rejectClipboard=true);await page.getByRole('button',{name:'Copiar prompt de conexión',exact:true}).click();const manual=await page.getByLabel('Prompt de conexión preparado',{exact:true}).inputValue();assert.ok(manual.includes('apheka_describe'));assert.ok(manual.includes('Mi IA'));assert.ok(!manual.includes('QA-PRIVATE-TOKEN'));await page.getByText(/Selecciona y copia el prompt/).waitFor();await page.evaluate(()=>window.__rejectClipboard=false);
 await page.getByRole('button',{name:'Desactivar',exact:true}).click();await page.getByRole('button',{name:'Preparar conexión y copiar prompt',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Copiar configuración',exact:true}).isDisabled(),true);
 await page.screenshot({path:'docs/apheka-6.17-connection.png'});
 console.log('PASS native connector panel: eight real-path config copies, read/write choice, private HTTP copy, masked preview, secret-free prompt/preferences, export and stop');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
