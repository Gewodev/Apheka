const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  if(sessionStorage.getItem('task620'))return;sessionStorage.setItem('task620','1');
  const now=new Date(),day=n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const make=(id,title,priority,due)=>({id,title,priority,dueDate:day(due),course:'Física',courseColor:'#78968c',status:'inicio',urgent:false,important:false,createdAt:now.toISOString(),estimatedMinutes:35,subtasks:[],files:[],notes:'',apuntes:'',studyTime:0});
  localStorage.setItem('apheka_route_v2',JSON.stringify({view:'tareas'}));localStorage.setItem('owa_tasks_view','calendar');
  localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),settings:{notifications:false},courses:[{id:'c',name:'Física',color:'#78968c',sortOrder:0,progress:0,totalTasks:5,completedTasks:0,hoursStudied:0}],tasks:[make('a','Entrega importante','high',1),make('b','Proyecto futuro','high',45),make('c','Entrega menor','low',1),make('d','Lectura opcional','low',45),{...make('e','Ya terminada','high',1),status:'completado',completedAt:now.toISOString()}]}));
 });


await p.goto(process.env.APHEKA_QA_URL||'http://127.0.0.1:1423');await p.getByRole('button',{name:'Agregar tarea',exact:true}).click();const modal=p.getByRole('dialog',{name:'Nueva tarea',exact:true}),minutes=modal.getByRole('spinbutton',{name:'Duración estimada de la tarea'});await minutes.fill('120');assert.equal(await modal.locator('.task-long-duration-hint').count(),0);await minutes.fill('121');assert.equal(await modal.locator('.task-long-duration-hint').count(),1);await minutes.fill('90');assert.equal(await modal.locator('.task-long-duration-hint').count(),0);assert.deepEqual(errors,[]);console.log('PASS subdivision hint appears only for durations over 120 minutes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
