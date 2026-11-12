const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  if(sessionStorage.getItem('task620'))return;sessionStorage.setItem('task620','1');
  const now=new Date(),day=n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const make=(id,title,priority,due)=>({id,title,priority,dueDate:day(due),course:'Física',courseColor:'#78968c',status:'inicio',urgent:false,important:false,createdAt:now.toISOString(),estimatedMinutes:45,subtasks:[],files:[],notes:'',apuntes:'',studyTime:0});
  localStorage.setItem('apheka_route_v2',JSON.stringify({view:'tareas'}));localStorage.setItem('owa_tasks_view','calendar');
  localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),settings:{notifications:false},courses:[{id:'c',name:'Física',color:'#78968c',sortOrder:0,progress:0,totalTasks:5,completedTasks:0,hoursStudied:0}],tasks:[make('a','Entrega importante','high',1),make('b','Proyecto futuro','high',45),make('c','Entrega menor','low',1),make('d','Lectura opcional','low',45),{...make('e','Ya terminada','high',1),status:'completado',completedAt:now.toISOString()}]}));
 });
 const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1423';await p.goto(base);
 await p.getByRole('button',{name:'Urgencia',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Calendario',exact:true}).count(),0);
 assert.equal(await p.getByRole('button',{name:'Urgencia',exact:true}).getAttribute('aria-pressed'),'true','migrated saved calendar preference');
 const quadrants=p.locator('.task-urgency-matrix>section');assert.equal(await quadrants.count(),4);
 for(const [q,id]of [['do','a'],['plan','b'],['resolve','c'],['later','d']])assert.equal(await p.locator(`[data-quadrant=${q}] [data-task-id=${id}]`).count(),1);
 const boxes=await quadrants.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y}}));assert.ok(boxes[0].x<boxes[1].x&&boxes[0].y===boxes[1].y&&boxes[2].y>boxes[0].y);
 await p.getByRole('button',{name:'En proceso: Entrega importante',exact:true}).click();assert.equal(await p.getByRole('button',{name:'En proceso: Entrega importante',exact:true}).getAttribute('aria-pressed'),'true');
 await p.getByRole('button',{name:'Completada: Lectura opcional',exact:true}).click();assert.equal(await p.locator('.task-urgency-matrix [data-task-id=d]').count(),0);
 await p.getByRole('button',{name:'Tablero',exact:true}).click();assert.equal(await p.locator('.task-kanban-column').count(),3);
 assert.equal(await p.getByRole('region',{name:'En proceso',exact:true}).locator('[data-task-id=a]').count(),1);
 await p.getByRole('button',{name:'Pendiente: Lectura opcional',exact:true}).click();assert.equal(await p.getByRole('region',{name:'Pendiente',exact:true}).locator('[data-task-id=d]').count(),1);
 for(const width of [1440,900]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`release/qa-tasks-620-board-${width}.png`});}
 await p.setViewportSize({width:1440,height:960});await p.getByRole('button',{name:'Lista',exact:true}).click();assert.equal(await p.locator('.task-ranked-row[data-task-id=a][data-urgent=true]').count(),1);
 await p.getByRole('button',{name:'Elegir qué estudiar',exact:true}).click();const picker=p.getByRole('dialog',{name:'Qué estudiar ahora',exact:true});await picker.getByRole('button',{name:'Empezar sesión',exact:true}).waitFor();await p.waitForTimeout(150);assert.equal(await picker.locator('.task-picker-open').innerText(),'Entrega importante');await picker.getByRole('button',{name:'Cerrar selector de tareas',exact:true}).click();
 await p.locator('.task-ranked-row[data-task-id=a]').getByText('Entrega importante',{exact:true}).click();const detail=p.getByRole('dialog',{name:'Detalle de tarea',exact:true});await detail.waitFor();const separator=detail.getByRole('separator',{name:'Ancho del detalle de tarea',exact:true});await separator.focus();await separator.press('Home');assert.ok((await detail.boundingBox()).width>=499);
 const duration=detail.getByRole('spinbutton',{name:'Tiempo previsto de la tarea',exact:true});await duration.fill('35');await duration.press('Tab');await detail.getByRole('button',{name:/Pomodoro/}).click();
 await p.getByRole('button',{name:'Pausar temporizador',exact:true}).waitFor();await p.waitForTimeout(600);
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('owa_studio_data')));assert.equal(saved.settings.pomodoroTime,2100);assert.equal(saved.sessionType,'pomodoro');assert.equal(saved.tasks.find(t=>t.id==='a').estimatedMinutes,35);
 assert.deepEqual(errors,[]);console.log('PASS matrix positions/automatic importance, legacy view migration, board states, list urgency, 900/1440 layout, weighted picker, inspector minimum, duration save and real linked Pomodoro');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
