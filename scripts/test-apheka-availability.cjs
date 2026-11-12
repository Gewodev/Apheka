const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const NativeDate=Date;const fixed=new NativeDate(2026,9,12,14,0).getTime();
  class TestDate extends NativeDate {constructor(...args){if(!args.length)super(fixed);else super(...args);}static now(){return fixed;}}
  window.Date=TestDate;
  if(localStorage.getItem('availability_seed'))return;localStorage.setItem('availability_seed','1');
  const task=(id,title,status,dueDate)=>({id,title,status,dueDate,course:'Ingeniería',courseColor:'#e11d48',priority:'none',urgent:false,important:false,createdAt:new Date().toISOString(),subtasks:[],files:[],notes:'',apuntes:'',studyTime:0});
  localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),courses:[{id:'c1',name:'Ingeniería',color:'#e11d48',progress:0,totalTasks:3,completedTasks:1,hoursStudied:0}],tasks:[task('t1','Tarea vigente','inicio','2026-10-19'),task('t2','Tarea vencida','inicio','2026-10-11'),task('t3','Tarea completada','completado','2026-10-19')],plannedSessions:[{id:'s1',courseId:'c1',title:'Sesión pasada',date:'2026-10-12',startTime:'10:00',durationMinutes:25,type:'estudio',completed:false,createdAt:new Date().toISOString()}]}));
 });
 await page.goto('http://127.0.0.1:1420',{waitUntil:'domcontentloaded'});
 const nav=async(name)=>{await page.getByRole('button',{name,exact:true}).first().click();await page.waitForTimeout(700);};
 await nav('Planificador');await page.getByRole('button',{name:'Nuevo Evento',exact:true}).click();
 assert.ok(await page.getByRole('button',{name:'Tarea vinculada al evento',exact:true}).isDisabled(),'elapsed timed event cannot get a new link');
 await page.getByLabel('Todo el día',{exact:true}).check();await page.getByRole('button',{name:'Tarea vinculada al evento',exact:true}).click();
 assert.ok(await page.getByRole('option',{name:'Tarea vigente',exact:true}).isVisible());
 assert.equal(await page.getByRole('option',{name:'Tarea vencida',exact:true}).count(),0);assert.equal(await page.getByRole('option',{name:'Tarea completada',exact:true}).count(),0);
 await page.getByRole('option',{name:'Tarea vigente',exact:true}).click();await page.getByLabel('Fecha del evento',{exact:true}).fill('2026-10-11');
 assert.ok(await page.getByRole('button',{name:'Tarea vinculada al evento',exact:true}).isDisabled());await page.keyboard.press('Escape');
 await nav('Tareas');await page.getByText('Tarea vencida',{exact:true}).first().click();
 assert.ok(await page.getByRole('button',{name:'Actualiza la tarea para estudiar',exact:true}).isDisabled());
 await page.getByRole('dialog',{name:'Detalle de tarea'}).getByTitle('Cerrar',{exact:true}).click();
 await page.getByRole('button',{name:'Agregar tarea',exact:true}).click();await page.locator('#new-task-title').fill('Tarea CRUD verificada');
 await page.getByRole('button',{name:'Curso de la nueva tarea',exact:true}).click();await page.getByRole('option',{name:'Ingeniería',exact:true}).click();
 await page.getByRole('button',{name:'Prioridad de la nueva tarea',exact:true}).click();await page.getByRole('option',{name:'Alta',exact:true}).click();await page.getByRole('button',{name:'Crear tarea',exact:true}).click();
 await page.getByText('Tarea CRUD verificada',{exact:true}).first().click();await page.getByRole('dialog',{name:'Detalle de tarea'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Curso de la tarea',exact:true}).innerText(),'Ingeniería');assert.equal(await page.getByRole('button',{name:'Prioridad de la tarea',exact:true}).innerText(),'Alta');
 await page.getByLabel('Título de la tarea',{exact:true}).fill('Tarea CRUD editada');await page.getByRole('dialog',{name:'Detalle de tarea'}).getByTitle('Cerrar',{exact:true}).click();await page.reload();await page.getByText('Tarea CRUD editada',{exact:true}).first().waitFor();
 await nav('Planificador');await page.getByText('Sesión pasada',{exact:true}).first().click();assert.ok(await page.getByRole('button',{name:'Reprograma para estudiar',exact:true}).isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS task eligibility, expired event/session actions, searchable task creation and edited task persistence');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
