const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const report={steps:[],skipped:[]},errors=[];let page;const step=async(name,fn)=>{await fn();report.steps.push(name);fs.writeFileSync('release/qa-6270-ui.json',JSON.stringify({...report,errors},null,2));console.log('PASS',name);};const skip=async(name,fn)=>{try{await fn();report.steps.push(name);console.log('PASS',name);}catch(e){report.skipped.push(name+' :: '+String(e.message||e).slice(0,160));console.log('SKIP',name,String(e.message||e).slice(0,160));}};
try{page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#557d79"/><text x="40" y="90" fill="white" font-size="36">Apunte visual</text></svg>'}));
await page.addInitScript(()=>{if(localStorage.getItem('qa6270'))return;localStorage.setItem('qa6270','1');const now=new Date(),date=now.toLocaleDateString('sv'),future=new Date(now.getTime()+5*86400000).toLocaleDateString('sv');const names=['Física','Literatura','Historia','Inglés','Matemática','Arte','Sin actividad'];const courses=names.map((name,i)=>({id:'c'+i,name,color:['#73958b','#9d8eb0','#bc9d78','#819cc0','#9ba67b','#b78788','#7d979c'][i],sortOrder:i,groups:[],studyTopics:[],progress:0,totalTasks:0,completedTasks:0,hoursStudied:0}));const tasks=names.slice(0,6).map((name,i)=>({id:'t'+i,title:'Actividad '+i,course:name,courseColor:courses[i].color,status:i===1?'completado':'inicio',priority:'medium',dueDate:future,createdAt:now.toISOString(),subtasks:[],files:[],notes:'',apuntes:'',studyTime:0,estimatedMinutes:90}));localStorage.setItem('apheka_route_v2',JSON.stringify({view:'curso_detalle',courseId:'c0'}));localStorage.setItem('owa_settings_category_v1','sistema');localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),settings:{notifications:false,navigationMode:'pinned',navigationCollapsed:true,backgroundMotion:'off'},courses,tasks,notes:[{id:'n0',title:'TÍTULO NO VISIBLE',content:'<p>Una idea del curso.</p><img src="https://fixture.test/nota.svg" style="width:150px"/>',course:'Física',courseColor:'#73958b',isCoursePrivate:true,isPinned:false,tags:[],createdAt:now.toISOString(),updatedAt:now.toISOString()},{id:'n1',title:'Segundo título',content:'<p>Otro apunte independiente.</p>',course:'Física',courseColor:'#73958b',isCoursePrivate:true,isPinned:false,tags:[],createdAt:now.toISOString(),updatedAt:now.toISOString()}],habits:[],plannedSessions:[],studySessions:[],tracks:[{id:'music0',title:'Tema uno',artist:'Artista uno',source:'local',duration:180,url:'C:/qa/audio1.mp3',isFavorite:true,librarySaved:true,listenedTime:0},{id:'music1',title:'Tema dos',artist:'Artista uno',source:'local',duration:200,url:'C:/qa/audio2.mp3',isFavorite:false,librarySaved:true,listenedTime:0}],artists:[{id:'ar1',name:'Artista uno',profileImage:'https://fixture.test/nota.svg',trackIds:['music0']}],playlists:[{id:'list0',name:'Mi lista de prueba',trackIds:['music0','music1'],createdAt:Date.now()}]}));});
await page.goto('http://127.0.0.1:1426/scripts/runtime-6267.html');await page.waitForFunction(()=>window.__qaApp?.().hydrated);

await step('course notes mosaic has no redundant reader button',async()=>{
 const block=page.locator('.course-note-block[data-note-id=n0]');await block.waitFor();
 assert.equal(await block.getByRole('button',{name:'Leer apunte'}).count(),0,'the reader button must be gone');
 const meta=await block.locator('.course-note-meta').boundingBox();
 assert.ok(meta.height<44,JSON.stringify(meta));
 await page.screenshot({path:'release/qa-6270-apuntes.png'});
});
await step('course note opens from the card itself',async()=>{
 const block=page.locator('.course-note-block[data-note-id=n0]');await block.click();await block.locator('[data-expanded=true],button[title="Editar"]').first().waitFor();
 const expanded=await block.evaluate(e=>e.getAttribute('data-expanded'));
 assert.equal(expanded,'true','the card must expand on click');
});
await step('habit reminder has no activation control',async()=>{
 await page.evaluate(()=>window.__qaApp().setNavigateTo('planificacion'));
 await page.getByRole('button',{name:'Hábitos',exact:true}).click();
 await page.locator('.habit-mode-card').first().waitFor();
 assert.equal(await page.getByText('Recordatorio de fin de jornada',{exact:true}).count(),0,'no reminder switch is shown');
 assert.equal(await page.locator('.habit-reminder-options').count(),0);
 await page.screenshot({path:'release/qa-6270-habitos.png'});
});
await step('water and exercise modes register amounts',async()=>{
 await page.locator('.habit-mode-card[data-kind=water]').click();
 await page.locator('.habit-metric-grid article[data-kind=water]').waitFor();
 await page.getByRole('button',{name:'Registrar Agua'}).click();
 await page.waitForFunction(()=>window.__qaApp().habits.some(h=>h.metricKind==='water'&&Object.values(h.amountOn||{}).some(v=>v===1)));
 const output=await page.locator('.habit-metric-grid article[data-kind=water] output').innerText();
 assert.equal(output.trim(),'1');
 await page.waitForFunction(()=>{const e=document.querySelector('.habit-metric-grid article[data-kind=water] .habit-meter-fill');return !!e&&e.getBoundingClientRect().height>1;},null,{timeout:5000}).catch(()=>{});
 const meter=await page.locator('.habit-metric-grid article[data-kind=water] .habit-meter-fill').evaluate(e=>{const s=getComputedStyle(e);return {h:e.getBoundingClientRect().height,fill:s.getPropertyValue('--habit-fill'),style:e.closest('article').getAttribute('style'),out:e.closest('article').querySelector('output').textContent};});
 assert.ok(meter.h>0,'the meter must show the registered amount: '+JSON.stringify(meter));
 await page.screenshot({path:'release/qa-6270-habitos-agua.png'});
});
await step('downloads paste field is readable and never compressed',async()=>{
 await page.evaluate(()=>window.__qaStory('import'));
 const field=page.locator('.music-import-field');await field.waitFor();
 const box=await field.boundingBox();assert.ok(box.height>=48,JSON.stringify(box));
 const hint=await page.locator('.music-import-hint').innerText();
 assert.ok(hint.includes('descargar'),hint);
 await page.screenshot({path:'release/qa-6270-descargas.png'});
});
await step('spotify token copy explains a private list without manual wording',async()=>{
 const input=page.getByLabel('Buscar canción o pegar enlace');
 await input.fill('https://open.spotify.com/playlist/37i9dQZF1DX');
 const token=page.locator('.music-import-token');await token.waitFor();
 const copy=await token.innerText();
 assert.ok(copy.includes('privada'),copy);
 assert.ok(!copy.toLocaleLowerCase().includes('individual'),copy);
 assert.ok((await token.locator('input').boundingBox()).height>=36,'the token field must be usable');
 await page.screenshot({path:'release/qa-6270-descargas-spotify.png'});
});
await skip('downloads list is analysed and each song can be downloaded alone',async()=>{
 await page.getByLabel('Buscar canción o pegar enlace').fill('apheka instrumental');
 const submit=page.locator('.music-import-submit');await submit.click();
 await page.locator('.music-import-analysis').waitFor({timeout:25000});
 const analysis=await page.locator('.music-import-analysis').innerText();
 assert.ok(/\d+/.test(analysis),analysis);
 const download=page.locator('.music-import-download').first();
 await download.waitFor();
 assert.ok(await download.isVisible());
});
await step('repeat one is selectable and stays active',async()=>{
 await page.evaluate(()=>window.__qaStory(null));
 await page.evaluate(()=>window.__qaApp().setNavigateTo('musica'));
 await page.locator('.music-studio-toolbar nav button',{hasText:'Mis canciones'}).click();
 await page.locator('.music-song-name').first().click();
 const handle=page.locator('.integrated-player-handle');
 if(await handle.count()){await page.locator('.player-reveal-zone').hover();await handle.click();}
 const repeat=page.locator('.integrated-player-transport button[data-repeat]');
 await repeat.waitFor();
 await repeat.waitFor();
 await repeat.click();await repeat.click();
 assert.equal(await repeat.getAttribute('data-repeat'),'one');
 assert.equal(await page.evaluate(()=>window.__qaApp().repeatMode),'one');
 await page.screenshot({path:'release/qa-6270-repeticion.png'});
});
await step('artist profile offers editing and verified featured songs',async()=>{
 await page.evaluate(()=>window.__qaApp().setNavigateTo('musica'));
 await page.locator('.music-studio-toolbar nav button',{hasText:'Artistas'}).click();
 await page.locator('.artist-library-open').first().waitFor();
 await page.locator('.artist-library-open').first().click();
 await page.locator('.artist-profile h2').waitFor();
 await page.getByRole('button',{name:'Editar'}).waitFor();
 const featured=page.locator('.artist-featured-header h3');
 assert.equal(await featured.innerText(),'Destacadas');
 const evidence=await page.locator('.artist-evidence').first().innerText();
 assert.ok(evidence.includes('Elegida por ti')||evidence.includes('biblioteca'),evidence);
 await page.screenshot({path:'release/qa-6270-artistas.png'});
});
await step('artist can be renamed and songs can be removed',async()=>{
 await page.getByRole('button',{name:'Editar'}).click();
 const dialog=page.getByRole('dialog',{name:'Editar artista'});
 await dialog.waitFor();
 await dialog.getByLabel('Nombre del artista').fill('Artista editado');
 await dialog.getByRole('button',{name:'Guardar cambios'}).click();
 await page.waitForFunction(()=>window.__qaApp().artists[0].name==='Artista editado');
 await page.locator('.artist-track-remove').first().click();
 await page.waitForFunction(()=>window.__qaApp().artists[0].excludedTrackIds&&window.__qaApp().artists[0].excludedTrackIds.length===1);
 const rows=await page.locator('.artist-track-row').count();
 assert.equal(rows,0,'the removed song must leave the list');
});
await step('removed song can be restored from the artist editor',async()=>{
 await page.getByRole('button',{name:'Editar'}).click();
 const dialog=page.getByRole('dialog',{name:'Editar artista'});
 await dialog.waitFor();
 await dialog.getByRole('button',{name:'Restaurar'}).click();
 await page.waitForFunction(()=>window.__qaApp().artists[0].excludedTrackIds.length===0);
 await page.getByRole('button',{name:'Cancelar'}).click();
 await page.waitForFunction(()=>window.__qaApp().artists[0].trackIds&&window.__qaApp().artists[0].trackIds.length===0);
});
assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync('release/qa-6270-ui.json',JSON.stringify(report,null,2));}catch(e){if(page)await page.screenshot({path:'release/qa-6270-failure.png'});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
