const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(localStorage.getItem('test_seed'))return;localStorage.setItem('test_seed','1');
  const now=new Date().toISOString();const saved={_savedAt:Date.now(),tasks:['t1','t2'].map((id,i)=>({id,title:'Tarea de prueba '+(i+1),course:'Ingeniería',courseColor:'#E11D48',status:'inicio',priority:'none',urgent:false,important:false,createdAt:now,subtasks:[],files:[],notes:'',apuntes:'',studyTime:0})),
   courses:[{id:'c1',name:'Ingeniería',color:'#E11D48',progress:0,totalTasks:2,completedTasks:0,hoursStudied:0,sortOrder:0}],
   notes:[{id:'n1',title:'Diseño de sistemas',content:'<h2>Responsabilidades claras</h2><p>Cada módulo tiene una fuente de verdad. Las transiciones deben ser explícitas y verificables.</p>',course:'Ingeniería',courseColor:'#E11D48',createdAt:now,updatedAt:now,isPinned:false,tags:['Diseño']}],
   plannedSessions:[{id:'s1',courseId:'c1',title:'Sesión de prueba',date:new Date().toLocaleDateString('en-CA'),startTime:'23:00',durationMinutes:25,type:'estudio',completed:false,createdAt:now}]};
  localStorage.setItem('owa_studio_data',JSON.stringify(saved));
 });
 await page.goto('http://127.0.0.1:1420',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Tareas',exact:true}).first().click();
 await page.getByText('Tarea de prueba 1',{exact:true}).first().click();

 await page.getByTitle('Estudiar esta tarea',{exact:true}).last().click();
 await page.getByTitle('Desvincular tarea',{exact:true}).waitFor();
 await page.getByTitle('Desvincular tarea',{exact:true}).click();
 await page.getByRole('button',{name:'Desvincular',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('owa_timer_link_v1'));return [s.activeTaskId,s.activePlannedSessionId]}),[null,null]);
 console.log('PASS X clears task link');
 for(const n of [1,2]){
  await page.getByRole('button',{name:'Tareas',exact:true}).first().click();
  await page.getByText('Tarea de prueba '+n,{exact:true}).first().click();
  await page.getByRole('button',{name:/^ESTUDIAR$|Cambiar a esta tarea/i}).last().click();
  await page.getByTitle('Desvincular tarea',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_timer_link_v1')).activeTaskId),'t'+n);
 }
 console.log('PASS same task relinks and different task replaces');
 await page.reload();await page.getByTitle('Desvincular tarea',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_timer_link_v1')).activeTaskId),'t2');console.log('PASS task link survives reload');
 await page.getByRole('button',{name:'Planificador',exact:true}).click();
 await page.getByText('Sesión de prueba',{exact:true}).first().click();
 await page.getByRole('button',{name:'Cambiar a esta sesión',exact:true}).click();
 await page.getByTitle('Desvincular sesión',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('owa_timer_link_v1'));return [s.activeTaskId,s.activePlannedSessionId]}),[null,'s1']);
 await page.getByTitle('Desvincular sesión',{exact:true}).click();
 await page.getByRole('button',{name:'Desvincular',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('owa_timer_link_v1'));return [s.activeTaskId,s.activePlannedSessionId]}),[null,null]);
 await page.getByRole('button',{name:'Planificador',exact:true}).click();
 await page.getByText('Sesión de prueba',{exact:true}).first().click();
 await page.getByRole('button',{name:'Empezar sesión',exact:true}).click();
 await page.getByTitle('Desvincular sesión',{exact:true}).waitFor();
 await page.reload();await page.getByTitle('Desvincular sesión',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_timer_link_v1')).activePlannedSessionId),'s1');
 console.log('PASS planned session replaces task, unlinks, relinks and survives reload');
 for(const name of ['Estudio','Tareas','Notas','Música','Cursos','Ajustes']){
  await page.getByRole('button',{name,exact:true}).first().click();
  await page.locator('[data-apheka-view] .page-container').first().waitFor({state:'visible'});
  await page.waitForTimeout(1800);await page.screenshot({path:`docs/apheka-${name==='Música'?'musica':name.toLowerCase()}.png`,fullPage:true});
  console.log('VIEW',name,(await page.locator('body').innerText()).slice(-300));
 }
 await page.evaluate(()=>localStorage.setItem('owa_timer_link_v1',JSON.stringify({activeTaskId:'deleted-task',activePlannedSessionId:null,updatedAt:0})));
 await page.reload();
 await page.getByRole('button',{name:'Estudio',exact:true}).first().click();
 await page.getByTitle('Desvincular sesión',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_timer_link_v1')).activeTaskId),'deleted-task');
 // The durable record must win even while the obsolete mirror still exists.
 assert.equal(await page.getByTitle('Desvincular tarea',{exact:true}).count(),0);
 console.log('PASS durable session beats an obsolete orphaned local link');
 const restoreResult=await page.evaluate(async()=>{
  const backupModule=await import('/src/lib/owaBackup.ts');
  const backup=await backupModule.collectBackup();
  const state=typeof backup.idb.value==='string'?JSON.parse(backup.idb.value):backup.idb.value;
  state.tasks=[{...state.tasks[0],id:'restored-task',title:'Tarea restaurada al cerrar'}];
  backup.idb.value=state;
  const result=await backupModule.applyBackup(backup);
  window.dispatchEvent(new Event('beforeunload'));
  await new Promise(resolve=>setTimeout(resolve,600));
  const db=await import('/node_modules/.vite/deps/idb-keyval.js');
  const raw=await db.get('owa_studio_data');
  const stored=typeof raw==='string'?JSON.parse(raw):raw;
  return {ok:result.ok,title:stored.tasks[0].title};
 });
 assert.deepEqual(restoreResult,{ok:true,title:'Tarea restaurada al cerrar'});
 await page.reload();await page.getByRole('button',{name:'Tareas',exact:true}).first().click();
 await page.getByText('Tarea restaurada al cerrar',{exact:true}).first().waitFor();
 console.log('PASS restored data survives delayed save, close handler and reload');
 console.log('ERRORS',errors);assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});



