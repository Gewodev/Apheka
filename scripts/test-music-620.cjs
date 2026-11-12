const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage();await p.route('https://lrclib.net/api/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({id:620,trackName:'Mi canción',artistName:'Intérprete',duration:180,plainLyrics:'Quiero caminar junto al mar y regresar.',syncedLyrics:'[00:00.00]Quiero caminar junto al mar y regresar.'})}));await p.goto(process.env.APHEKA_QA_URL||'http://127.0.0.1:1423');
 const result=await p.evaluate(async()=>{
  const daily=await import('/src/lib/dailyMusicOrder.ts'),queue=await import('/src/lib/queueResume.ts'),available=await import('/src/lib/recordingAvailability.ts'),fragment=await import('/src/lib/lyricFragmentSearch.ts');
  const tracks=Array.from({length:20},(_,i)=>({id:'t'+i})),ids=tracks.map(t=>t.id),original=ids.join();
  const today=daily.dailyMusicOrder(tracks,'2026-10-29').map(t=>t.id),same=daily.dailyMusicOrder(tracks,'2026-10-29').map(t=>t.id),tomorrow=daily.dailyMusicOrder(tracks,'2026-10-30').map(t=>t.id);
  const first=queue.resumeLibraryQueue(ids,'t0',[],{source:null,manual:false},'boot:1'),second=queue.resumeLibraryQueue(ids,'t0',first.queue,{source:first.source,manual:false},'boot:2');
  const manual=queue.resumeLibraryQueue(ids,'t0',['t9','t2','t8','deleted','t9','t0'],{source:{pool:ids.filter(id=>id!=='t8'),name:'Tu biblioteca'},manual:true},'boot:3');
  const playlist=queue.resumeLibraryQueue(ids,'t0',['t5','t2','t1'],{source:{pool:['t0','t1','t2'],name:'Concentración'},manual:false},'boot:4');
  queue.rememberQueueSource({pool:ids,name:'Tu biblioteca'});queue.markQueueManual();const intent=queue.readQueueIntent();
  const now=Date.now();available.rememberUnavailableRecording('blocked620a',150,now);available.rememberUnavailableRecording('network620a',5,now);available.rememberUnavailableRecording('browser620a',153,now);
  const block={known:available.recordingUnavailable('blocked620a',now),expired:available.recordingUnavailable('blocked620a',now+8*86400000),network:available.recordingUnavailable('network620a',now),browser:available.recordingUnavailable('browser620a',now)};
  const song={id:'valid620aaa',title:'Mi canción',artist:'Intérprete',duration:180,cover:'https://example.com/cover',provider:'youtube'};
  // Verify a real lyrics response, not title overlap; do not send personal data.
  const matched=await fragment.verifyLyricCandidates('letra: caminar junto al mar',[song],AbortSignal.timeout(9000));
  return {today,same,tomorrow,unmutated:tracks.map(t=>t.id).join()===original,first,second,manual,playlist,intent,block,matched:matched.map(s=>s.id),exact:fragment.matchesLyricFragment('letra: Junto al mar','Caminábamos junto al mar, al amanecer.'),unrelated:fragment.matchesLyricFragment('letra: junto al sol','Caminábamos junto al mar.')};
 });
 assert.deepEqual(result.today,result.same);assert.notDeepEqual(result.today,result.tomorrow);assert.equal(result.unmutated,true);
 assert.notDeepEqual(result.first.queue.slice(0,5),result.second.queue.slice(0,5));assert.equal(result.first.queue.includes('t0'),false);assert.equal(new Set(result.first.queue).size,19);
 assert.deepEqual(result.manual.queue,['t9','t2']);assert.deepEqual(result.playlist.queue,['t2','t1']);assert.equal(result.intent.manual,true);
 assert.deepEqual(result.block,{known:true,expired:false,network:false,browser:false});assert.equal(result.exact,true);assert.equal(result.unrelated,false);
 assert.deepEqual(result.matched,['valid620aaa']);console.log('PASS stable daily rotation, automatic restart variation, manual queue/playlist preservation, no duplicates/current/deleted entries, exact recording-only restrictions with expiry and verified lyric-fragment match');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
