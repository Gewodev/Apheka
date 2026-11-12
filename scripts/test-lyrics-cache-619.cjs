const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();let mode='sync',calls=0;
 await page.route('https://lrclib.net/api/**',route=>{calls++;if(mode==='offline')return route.abort();const row={id:619,trackName:'Tema',artistName:'Artista',duration:180,plainLyrics:'Una primera línea\nUna segunda línea',syncedLyrics:mode==='sync'?'[00:00.00]Una primera línea\n[00:04.00]Una segunda línea':null};return route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('/search?')?[row]:row)});});
 await page.route('https://api.lyrics.ovh/**',route=>route.fulfill({contentType:'application/json',body:'{"lyrics":"Solo texto sin tiempos"}'}));
 await page.goto('http://127.0.0.1:1422');
 const load=(title,duration,online=true,force=false)=>page.evaluate(async({title,duration,online,force})=>{const {loadLyrics}=await import('/src/lib/lyrics.ts');return loadLyrics(title,'Artista',duration,online,new AbortController().signal,force);},{title,duration,online,force});
 const first=await load('Artista - Tema (Official Audio)',0);assert.equal(first.lines.length,2);assert.equal(first.recordingDuration,180);
 const before=calls;assert.equal((await load('Tema',181)).sourceId,619);assert.equal(calls,before,'known recording reuses timing after real duration arrives');
 mode='plain';const refresh=await load('Tema',180,true,true);assert.equal(refresh.lines.length,2,'plain response cannot downgrade verified timing');
 await page.reload();mode='offline';const persisted=await load('Tema (Official Audio)',180,false);assert.equal(persisted.lines.length,2,'timing survives reload and offline');
 const wrongVersion=await load('Tema',210,false);assert.equal(wrongVersion,null,'different recording length never borrows timing');
 const match=await page.evaluate(async()=>{const {lyricsCacheMatches}=await import('/src/lib/lyrics.ts');return lyricsCacheMatches('["Tema","Otro",180]',null,'Tema','Artista',180);});assert.equal(match,false);
 console.log('PASS lyrics cache: normalized identity, unknown-to-real duration, no downgrade on refresh, reload/offline, wrong recording rejected');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
