const fs=require('node:fs');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1366,height:768}});
  await p.addInitScript(()=>{
   const data={_savedAt:Date.now(),settings:{notifications:false},courses:[{id:'perf-course',name:'Curso de rendimiento',color:'#73958b',sortOrder:0,progress:0,totalTasks:0,completedTasks:0,hoursStudied:0}],tasks:Array.from({length:150},(_,i)=>({id:'t'+i,title:'Tarea '+i,status:'pending',priority:'none',subtasks:[],files:[],course:'Curso de rendimiento'}))};
   localStorage.setItem('owa_studio_data',JSON.stringify(data));
   window.__intervals=[];
   const interval=window.setInterval;
   window.setInterval=(fn,delay,...args)=>{window.__intervals.push(delay);return interval(fn,delay,...args);};
  });
  const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1422';
  await p.goto(base+'/scripts/performance-preview.html');
  await p.waitForFunction(()=>window.__getApp?.().hydrated);
  await p.waitForTimeout(1000);
  const updates=await p.evaluate(async()=>{
   window.__commits=[];
   for(let i=1;i<=20;i++){window.__getApp().setMusicProgressRaw(i/25);await new Promise(r=>setTimeout(r,30));}
   return {commits:window.__commits.length,renderMs:window.__commits.reduce((sum,c)=>sum+c.duration,0)};
  });
  await p.evaluate(()=>window.__commits=[]);
  await p.waitForTimeout(2300);
  const idle=await p.evaluate(()=>({commits:window.__commits.length,renderMs:window.__commits.reduce((sum,c)=>sum+c.duration,0)}));
  await p.goto(base+'/scripts/performance-preview.html?view=course');
  await p.waitForFunction(()=>window.__getApp?.().hydrated);
  const course400msPolls=await p.evaluate(()=>window.__intervals.filter(delay=>delay===400).length);
  const report={audioProgressUpdates:20,homeDuringAudioProgress:updates,homeIdle2300ms:idle,course400msPolls};
  fs.writeFileSync(process.argv[2]||'release/performance-workspace.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
