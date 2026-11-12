const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:1420',{waitUntil:'domcontentloaded'});
 const nav=async(name)=>{await page.getByRole('button',{name,exact:true}).first().click();await page.waitForTimeout(500);};
 const categories=page.getByRole('navigation',{name:'Categorías de ajustes'});
 await nav('Ajustes');await categories.getByRole('button',{name:'Estudio',exact:true}).click();
 const focus=page.getByRole('spinbutton',{name:'Enfoque',exact:true});await focus.fill('44');await focus.press('ArrowUp');assert.equal(await focus.inputValue(),'45');await focus.press('Tab');assert.equal(await focus.inputValue(),'45');
 await page.getByRole('button',{name:'Aumentar Enfoque',exact:true}).click();assert.equal(await focus.inputValue(),'46');await page.getByRole('button',{name:'Reducir Enfoque',exact:true}).click();assert.equal(await focus.inputValue(),'45');
 await focus.fill('999');await focus.press('Escape');assert.equal(await focus.inputValue(),'45');
 await focus.fill('999');await focus.press('Tab');assert.equal(await focus.inputValue(),'120');assert.ok(await page.getByRole('button',{name:'Aumentar Enfoque',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Enfoque: 25 min',exact:true}).click();assert.equal(await focus.inputValue(),'25');
 await page.getByRole('spinbutton',{name:'Descanso corto',exact:true}).fill('10');await page.getByRole('spinbutton',{name:'Descanso corto',exact:true}).press('Tab');await page.reload();
 assert.equal(await page.getByRole('spinbutton',{name:'Descanso corto',exact:true}).inputValue(),'10');
 await page.screenshot({path:'docs/apheka-v3-tiempos-compacto.png',fullPage:true});
 await page.getByLabel('Ocultar tiempo durante el enfoque',{exact:true}).check();await page.getByRole('button',{name:'Animación: Ondas',exact:true}).click();await page.getByLabel('Vista previa del flotante',{exact:true}).screenshot({path:'docs/apheka-v3-flotante-previa.png'});await page.reload();assert.ok(await page.getByLabel('Ocultar tiempo durante el enfoque',{exact:true}).isChecked());assert.equal(await page.getByRole('button',{name:'Animación: Ondas',exact:true}).getAttribute('aria-pressed'),'true');
 await nav('Estudio');await page.locator('.pomodoro-timer-panel').click({button:'right'});const menu=page.getByRole('dialog',{name:'Duración del pomodoro',exact:true});await menu.waitFor();
 await menu.getByRole('spinbutton',{name:'Duración del pomodoro',exact:true}).fill('35');await menu.getByRole('spinbutton',{name:'Duración del pomodoro',exact:true}).press('Tab');
 assert.equal(await menu.getByRole('spinbutton',{name:'Duración del pomodoro',exact:true}).inputValue(),'35');await page.screenshot({path:'docs/apheka-v3-pomodoro-menu.png',fullPage:true});await page.keyboard.press('Escape');assert.equal(await menu.count(),0);
 await page.getByRole('heading',{name:'Estudio',exact:true}).click({button:'right'});await menu.waitFor();await page.keyboard.press('Escape');
 for(const collapsed of [false,true]){
  if(collapsed)await page.getByRole('button',{name:'Contraer menú',exact:true}).click();
  for(const name of ['Inicio','Planificador','Cursos','Notas','Tareas','Música','Ajustes']){
   await nav(name);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,name+' fits with collapsed='+collapsed);
   if(name==='Planificador'){
    const rect=await page.locator('.planner-workspace-toolbar').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=1200);
    const actions=await page.getByRole('button',{name:'Nueva sesión',exact:true}).boundingBox();assert.ok(actions.x+actions.width<=1200,'creation actions fit');
   }
   if(collapsed&&['Inicio','Planificador','Notas'].includes(name))await page.screenshot({path:'docs/apheka-v3-menu-cerrado-'+name.toLowerCase()+'.png',fullPage:true});
  }
 }
 await page.getByRole('button',{name:'Expandir menú',exact:true}).click();assert.ok(await page.locator('.apheka-lettermark').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS duration entry, arrows, bounds, Escape, presets, persistence, pomodoro context menu and seven views with sidebar open/closed');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
