const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1422';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   if(sessionStorage.getItem('grid-seeded'))return;sessionStorage.setItem('grid-seeded','1');
   localStorage.setItem('owa_active_view_v1','cursos');localStorage.removeItem('owa_sidebar_collapsed');
   localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:Date.now(),courses:Array.from({length:12},(_,i)=>({id:'grid-'+i,name:'Asignatura '+(i+1)+' · Fundamentos y práctica profesional',color:'#788f9d',progress:0,totalTasks:2,completedTasks:0,hoursStudied:i,groups:[],studyTopics:[]})),settings:{notifications:false}}));
  });
  await page.goto(base);await page.locator('.course-workspace-tile').last().waitFor();
  const inspect=async(label)=>{
   const data=await page.locator('.course-workspace-tile').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
   for(let i=0;i<data.length;i++)for(let j=i+1;j<data.length;j++){
    const a=data[i],b=data[j],overlapX=Math.min(a.right,b.right)-Math.max(a.x,b.x),overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
    assert.ok(overlapX<=1||overlapY<=1,`${label}: courses ${i}/${j} overlap ${overlapX.toFixed(1)}×${overlapY.toFixed(1)}; ${JSON.stringify([a,b])}`);
   }
   assert.equal(await page.locator('.course-workspace-tile').first().evaluate(el=>{const scroll=el.closest('.page-container');return scroll.scrollWidth>scroll.clientWidth+1;}),false,label+' horizontal overflow');
  };
  for(const width of [800,900,1000,1100,1200,1440]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(550);await inspect(width+' initial');
   for(let cycle=0;cycle<4;cycle++){
    if(await page.locator('#apheka-navigation-dock').getAttribute('data-open')==='true')await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();await page.locator('.course-workspace-tile').first().hover();
    const toggle=page.getByRole('button',{name:'Abrir navegación',exact:true});await toggle.click();
    for(let frame=0;frame<14;frame++){await inspect(width+' transition '+cycle+'/'+frame);await page.waitForTimeout(25);}
    await page.waitForTimeout(550);await inspect(width+' settled '+cycle);
   }
  }
  await page.screenshot({path:'docs/course-grid-6.9.png'});
  if(await page.locator('#apheka-navigation-dock').getAttribute('data-open')==='true')await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();
  // Reordering still persists, and a normal click after resizing opens the course.
  const tiles=page.locator('.course-workspace-tile');const firstName=await tiles.first().getAttribute('aria-label');
  const a=await tiles.first().boundingBox(),b=await tiles.nth(1).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.waitForTimeout(400);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.waitForTimeout(250);await page.mouse.up();await page.waitForTimeout(500);
  assert.notEqual(await tiles.first().getAttribute('aria-label'),firstName,'drag must reorder the grid');await inspect('after drag');
  await page.reload();await tiles.last().waitFor();assert.notEqual(await tiles.first().getAttribute('aria-label'),firstName,'order must survive reload');
  await tiles.first().click();await page.locator('.cursos-root-view').waitFor();assert.deepEqual(errors,[]);
  console.log('PASS course grid: 12 cards, six widths with auto-hidden dock, 24 sidebar transitions sampled in motion, hover, drag reorder, persistence and navigation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
