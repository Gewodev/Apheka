const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1422';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.__copied=value}});if(sessionStorage.getItem('assistant-seed'))return;sessionStorage.setItem('assistant-seed','1');localStorage.setItem('owa_active_view_v1','ajustes');localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),courses:[{id:'c',name:'Matemáticas',color:'#788f9d',progress:0,totalTasks:0,completedTasks:0,hoursStudied:0,studyTopics:[],groups:[]}],settings:{notifications:false}}));});
 await page.goto(base);await page.getByRole('button',{name:'Conectores IA',exact:true}).click();
 assert.equal(await page.getByLabel('Asistente o IDE',{exact:true}).count(),1,'direct MCP connection is the primary flow');
 await page.getByText('Traer una respuesta de IA sin conexión',{exact:false}).click();
 await page.getByLabel('Mi asistente',{exact:true}).selectOption('Claude');await page.getByLabel('Qué quiero preparar',{exact:true}).selectOption('mixed');await page.getByLabel('Guardar en',{exact:true}).selectOption('c');
 await page.getByLabel('Qué necesitas estudiar',{exact:true}).fill('Vectores y álgebra');await page.getByRole('button',{name:'Copiar instrucciones para mi IA'}).click();const copied=await page.evaluate(()=>window.__copied);assert.ok(copied.includes('Claude'));assert.ok(copied.includes('Matemáticas'));assert.ok(copied.includes('apheka.study.v1'));
 await page.locator('#assistant-study-title').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/apheka-6.7.6-assistant.png'});
 const response={format:'apheka.study.v1',title:'Vectores',notes:[{title:'Apunte de IA',content:'Definición\n\n<script>alert(1)</script>'}],tasks:[{title:'Práctica de IA',priority:'medium',estimatedMinutes:25}],flashcards:[{question:'¿Qué es un vector?',answer:'Un elemento de un espacio vectorial.'}]};
 const paste=async()=>{await page.getByRole('textbox',{name:'Respuesta de mi asistente',exact:true}).fill(JSON.stringify(response));await page.getByRole('button',{name:'Revisar contenido',exact:true}).click();};
 await paste();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_studio_data')).notes?.length||0),0,'preview never writes');
 await page.getByRole('button',{name:'Añadir a APHEKA',exact:true}).click();await page.getByRole('status').filter({hasText:'Añadidos:'}).waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_studio_data')));assert.equal(saved.notes.length,1);assert.ok(saved.notes[0].content.includes('&lt;script&gt;'));assert.equal(saved.tasks[0].course,'Matemáticas');assert.equal(saved.courses[0].studyTopics[0].flashcards.length,1);
 await paste();await page.getByRole('button',{name:'Añadir a APHEKA',exact:true}).click();await page.getByText('Este contenido ya estaba guardado.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('owa_studio_data')).notes.length),1);
 await page.getByRole('textbox',{name:'Respuesta de mi asistente',exact:true}).fill('{"format":"bad"}');await page.getByRole('button',{name:'Revisar contenido',exact:true}).click();assert.ok(await page.getByRole('alert').isVisible());assert.equal(await page.getByRole('button',{name:'Añadir a APHEKA',exact:true}).count(),0);
 for(const width of [900,1200]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.deepEqual(errors,[]);console.log('PASS simple assistant: client-specific prompt, preview, real notes/tasks/cards, persistence, deduplication, escaped content and malformed-response rejection');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
