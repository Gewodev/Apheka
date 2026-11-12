const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(localStorage.getItem('design_seed'))return;localStorage.setItem('design_seed','1');
  const now=new Date().toISOString();
  const courses=[['c1','Ingeniería de software','#e11d48'],['c2','Matemática aplicada','#8b5cf6'],['c3','Diseño de sistemas','#10b981']].map(([id,name,color],i)=>({id,name,color,progress:i*20,totalTasks:4,completedTasks:i,hoursStudied:2+i,sortOrder:i}));
  const tasks=['Preparar la propuesta del proyecto','Revisar los casos de uso','Documentar la arquitectura'].map((title,i)=>({id:'t'+i,title,course:courses[i].name,courseColor:courses[i].color,status:i===1?'progreso':'inicio',priority:i===0?'high':'medium',urgent:false,important:false,createdAt:now,subtasks:[{id:'s'+i,title:'Definir el resultado esperado',completed:false}],files:[],notes:'Recopilar las decisiones y los materiales necesarios antes de la próxima sesión.',apuntes:'',studyTime:0,dueDate:'2026-10-19'}));
  const notes=['Decisiones de arquitectura','Ideas para la próxima iteración','Lecturas y referencias','Plan de investigación'].map((title,i)=>({id:'n'+i,title,content:'<h2>Un sistema claro</h2><p>Separar responsabilidades permite entender cada decisión y mejorar la experiencia sin añadir complejidad.</p>',course:courses[i%3].name,courseColor:courses[i%3].color,createdAt:now,updatedAt:now,isPinned:i===0,tags:['Proyecto','Investigación']}));
  localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),courses,tasks,notes,settings:{userName:'María'}}));
 });
 await page.goto('http://127.0.0.1:1420',{waitUntil:'domcontentloaded'});
 const nav=async(name)=>{await page.getByRole('button',{name,exact:true}).first().click();await page.locator('[data-apheka-view] .page-container').first().waitFor();await page.waitForTimeout(800);await page.locator('[data-apheka-view] .page-container').first().evaluate(el=>el.scrollTop=0)};
 const shot=async(name)=>{await page.screenshot({path:'docs/apheka-v2-'+name+'.png',fullPage:true})};
 for(const name of ['Inicio','Tareas','Notas','Música','Cursos','Estudio']){await nav(name);await shot(name==='Música'?'musica':name.toLowerCase());}
 await nav('Tareas');await page.getByText('Preparar la propuesta del proyecto',{exact:true}).first().click();await page.getByRole('dialog',{name:'Detalle de tarea'}).waitFor();await shot('tarea-detalle');
 assert.ok(await page.getByLabel('Curso de la tarea').isVisible());
 await page.getByRole('dialog',{name:'Detalle de tarea'}).getByTitle('Cerrar',{exact:true}).click();
 await nav('Notas');await page.getByLabel('Decisiones de arquitectura',{exact:true}).dblclick();await page.waitForTimeout(700);await shot('nota-editor');
 await nav('Cursos');await page.getByRole('button',{name:'Abrir curso Ingeniería de software',exact:true}).click();await page.getByText('Ingeniería de software',{exact:true}).last().waitFor();await page.waitForTimeout(1500);await shot('curso-detalle');
 await nav('Ajustes');
 for(const name of ['Perfil','Apariencia','Estudio','Música','Sistema','Sonidos y Alertas']){
  await page.getByRole('navigation',{name:'Categorías de ajustes'}).getByRole('button',{name,exact:true}).click();await page.waitForTimeout(400);
  await page.locator('.apheka-settings').evaluate(el=>el.scrollTop=0);await shot('ajustes-'+name.toLowerCase().replaceAll(' ','-'));
  assert.equal(await page.locator('.settings-category-nav [aria-current]').count(),1);
 }
 await page.getByRole('navigation',{name:'Categorías de ajustes'}).getByRole('button',{name:'Apariencia',exact:true}).click();
 assert.ok(await page.getByRole('navigation',{name:'Opciones de la categoría'}).getByRole('button').count()>1);
 await page.getByLabel('Buscar opción en esta sección').fill('zzzxxy');await page.getByText('No hay coincidencias en esta categoría.',{exact:true}).waitFor();
 await page.getByLabel('Buscar opción en esta sección').fill('');
 await page.setViewportSize({width:1200,height:800});await page.locator('.apheka-settings').evaluate(el=>el.scrollTop=0);await shot('ajustes-compacto');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await page.getByRole('button',{name:'Claro Fondo claro limpio',exact:true}).click();await page.waitForTimeout(400);await shot('ajustes-claro');
 assert.equal(await page.getByRole('button',{name:'Claro Fondo claro limpio',exact:true}).getAttribute('aria-pressed'),'true');
 console.log('PASS all views, task inspector, note editor, course detail, six settings categories, search and compact layout');console.log('ERRORS',errors);assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
