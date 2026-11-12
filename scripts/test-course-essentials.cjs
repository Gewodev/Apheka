const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const notebook=process.argv.includes('--notebook');
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.addInitScript(notebook=>{
   if(sessionStorage.getItem('essential-qa'))return;
   sessionStorage.setItem('essential-qa','1');
   const now=new Date().toISOString();
   if(notebook)localStorage.setItem('owa_course_route_ce',JSON.stringify({tab:'notas',view:'overview',toolGroup:'todos'}));
   localStorage.setItem('apheka_route_v2',JSON.stringify({view:'curso_detalle',courseId:'ce'}));
   localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),settings:{notifications:false},courses:[{id:'ce',name:'Curso de escritura',color:'#73958b',sortOrder:0,progress:0,totalTasks:0,completedTasks:0,hoursStudied:0}],notes:[{id:'ne',title:'Apunte esencial',content:'<h2>Título existente</h2><p>Una idea del curso.</p>',course:'Curso de escritura',courseColor:'#73958b',isCoursePrivate:true,isPinned:false,tags:[],createdAt:now,updatedAt:now}]}));
  },notebook);
  await p.goto(process.env.APHEKA_QA_URL||'http://127.0.0.1:1422');
  await p.getByText('Una idea del curso.',{exact:true}).first().click();
  const block=p.locator(notebook?'.course-note-surface':'.course-note-block').filter({hasText:'Una idea del curso.'});
  if(!notebook)await block.getByTitle('Editar',{exact:true}).click();
  const editor=block.getByRole('textbox',{name:'Contenido del apunte',exact:true});
  const toolbar=block.getByRole('toolbar',{name:'Formato de la nota',exact:true});
  await toolbar.waitFor();
  assert.equal(await toolbar.getByRole('button').count(),4);
  for(const label of ['Deshacer','Rehacer','Estilo de párrafo','Más formatos','Insertar en la nota','Superíndice','Subíndice'])assert.equal(await block.getByRole('button',{name:label,exact:true}).count(),0);
  assert.equal(await editor.locator('h2').innerText(),'Título existente');
  const select=async()=>{await editor.evaluate(el=>{el.focus();const range=document.createRange();range.selectNodeContents(el.querySelector('p'));getSelection().removeAllRanges();getSelection().addRange(range);});await p.waitForTimeout(50);};
  await select();await toolbar.getByRole('button',{name:'Negrita (Ctrl+B)',exact:true}).click();
  assert.equal(await editor.locator('b,strong').count(),1);
  await toolbar.getByRole('button',{name:'Lista con viñetas',exact:true}).click();
  assert.equal(await editor.locator('ul li').count(),1);
  await p.waitForTimeout(900);
  await editor.press('Control+z');
  assert.equal(await editor.locator('ul').count(),0);
  await editor.press('Control+y');
  assert.equal(await editor.locator('ul li').count(),1);
  await editor.press('Control+End');await editor.press('Enter');await p.keyboard.insertText('Acción, α y dos  espacios.');
  for(const width of [1440,900]){
   await p.setViewportSize({width,height:900});
   const bounds=await toolbar.boundingBox(),remove=await block.getByTitle('Eliminar',{exact:true}).boundingBox(),close=await block.getByRole('button',{name:'Cerrar apunte',exact:true}).boundingBox();
   assert.ok(Math.abs(bounds.y+16-remove.y-16)<3,'delete and formatting share one row');
   assert.ok(Math.abs(remove.y-close.y)<3,'close shares same row');
   assert.ok(bounds.height<=40,'one compact toolbar row');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.screenshot({path:`release/qa-course-essentials-${notebook?'notebook-':''}${width}.png`});
  }
  await p.waitForTimeout(900);await p.reload();
  await p.getByText('Una idea del curso.',{exact:true}).first().click();
  const reloaded=p.getByRole('textbox',{name:'Contenido del apunte',exact:true});
  assert.ok((await reloaded.innerText()).replaceAll('\u00a0',' ').includes('Acción, α y dos  espacios.'));
  assert.equal(await reloaded.locator('h2').innerText(),'Título existente');
  assert.equal(await reloaded.locator('ul li').count()>0,true);
  assert.deepEqual(errors,[]);
  console.log('PASS four essential course controls in same header as delete/close, Ctrl+Z/Y, formatting, undo/redo, existing headings, Unicode/spaces, save/reload, 900/1440 layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
