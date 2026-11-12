const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();
  await page.route('**/__persistence-test',r=>r.fulfill({contentType:'text/html',body:'<html><body>Isolated persistence tests</body></html>'}));
  await page.goto('http://127.0.0.1:1420/__persistence-test');
  const result=await page.evaluate(async()=>{
   const db=await import('/node_modules/.vite/deps/idb-keyval.js');
   const event={id:'test',title:'Persistencia',date:'2026-10-12',startTime:'09:00',repeat:'none'};
   localStorage.setItem('owa_planner_v3',JSON.stringify({events:[],classes:[],updatedAt:200}));
   await db.set('owa_planner_v3',JSON.stringify({events:[event],classes:[],updatedAt:100}));
   const planner=await import('/src/lib/plannerStore.ts');
   if((await planner.loadPlanner()).events.length!==0)throw Error('Older longer array resurrected deleted event');
   await Promise.all([planner.savePlanner([event],[]),planner.savePlanner([],[])]);
   if(JSON.parse(await db.get('owa_planner_v3')).events.length!==0)throw Error('Writes reordered');
   const featured=await import('/src/lib/featuredEvent.ts');
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(){throw new DOMException('Simulated full storage','QuotaExceededError')};
   try{await planner.savePlanner([event],[]);await featured.setFeaturedEvent(event)}finally{Storage.prototype.setItem=original}
   if((await db.get('owa_featured_v2')).id!=='test')throw Error('Featured durable fallback failed');
   if(JSON.parse(await db.get('owa_planner_v3')).events[0].id!=='test')throw Error('Planner durable fallback failed');
   const backup=await import('/src/lib/owaBackup.ts');
   await db.set('owa_studio_data',JSON.stringify({_savedAt:100,tasks:[{id:'old'}],events:[event]}));
   localStorage.setItem('owa_studio_data',JSON.stringify({_savedAt:200,tasks:[],events:[]}));
   const exported=await backup.collectBackup();
   if(exported.idb.value.tasks.length!==0||exported.stateEvents.length!==0)throw Error('Backup selected stale state');
   await planner.savePlanner([],[]);await featured.setFeaturedEvent(null);
   const restored=await backup.applyBackup(exported);
   if(!restored.ok)throw Error(restored.message);
   if((await planner.loadPlanner()).events.length!==1||featured.readFeatured().id!=='test')throw Error('Backup did not restore planner and pin');
   if((await db.get('owa_studio_data')).events.length!==0)throw Error('Empty events were not restored');
   return 'PASS deletion freshness, queued writes, storage quota fallback, latest snapshot backup and restore';
  });
  console.log(result);
  await page.reload();
  const recovered=await page.evaluate(async()=>{const p=await import('/src/lib/plannerStore.ts');const f=await import('/src/lib/featuredEvent.ts');await f.hydrateFeatured();return [(await p.loadPlanner()).events.length,f.readFeatured().id]});
  assert.deepEqual(recovered,[1,'test']);console.log('PASS durable recovery after reload');
  const failed=await page.evaluate(async()=>{
   const backup=await import('/src/lib/owaBackup.ts');
   const write=Storage.prototype.setItem;const transaction=IDBDatabase.prototype.transaction;
   Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')};
   IDBDatabase.prototype.transaction=function(){throw new DOMException('Unavailable','InvalidStateError')};
   try {
    const result=await backup.applyBackup({format:'owa-studio-backup',version:2,localStorage:{},idb:{key:'owa_studio_data',value:{tasks:[],events:[]}},plannerV3:null,stateEvents:[]});
    return {ok:result.ok,marker:sessionStorage.getItem('owa_restore_pending')};
   } finally {Storage.prototype.setItem=write;IDBDatabase.prototype.transaction=transaction}
  });
  assert.deepEqual(failed,{ok:false,marker:null});console.log('PASS failed restoration reports failure and releases the save guard');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
