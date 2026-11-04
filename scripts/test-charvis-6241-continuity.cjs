const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/scripts/continuity-6241.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Continuity QA</title>'}));
  await page.goto('http://127.0.0.1:1423/scripts/continuity-6241.html');
  const results=await page.evaluate(async()=>{
   const {readChatResponse,chatPayload,completeChatTurns}=await import('/src/lib/charvis.ts');
   const {runCharvisAgent}=await import('/src/lib/charvisAgent.ts');
   const {saveChatThread,readChatThread}=await import('/src/lib/charvisWorkspace.ts');
   const {get}=await import('/node_modules/.vite/deps/idb-keyval.js');
   const signature='opaque/SIGNED+bytes==';
   const toolMessage=()=>({choices:[{message:{content:null,extra_content:{google:{thought_signature:'message-signature'}},tool_calls:[{id:'g1',type:'function',function:{name:'apheka_create',arguments:JSON.stringify({entity:'tasks',data:{title:'Repasar energía'}})},extra_content:{google:{thought_signature:signature}}}]}}]});
   const assistant=readChatResponse(toolMessage(),'gemini');
   const result={role:'tool',tool_call_id:'g1',name:'apheka_create',content:'{"id":"task-1"}'};
   const replay=chatPayload('gemini','qa',[assistant,result]);
   const switched=chatPayload('groq','qa',[assistant,result]);
   const closed=completeChatTurns([assistant,{role:'user',content:'Continúa'}]);
   const now=Date.now(),id='qa-'+crypto.randomUUID();
   await saveChatThread({id,title:'Continuidad',createdAt:now,updatedAt:now},[{id:'e1',message:assistant},{id:'e2',message:result}]);
   const restored=await readChatThread(id),encrypted=await get('apheka_charvis_thread_'+id);
   let modelCalls=0,writes=0,received=[],messages=[],statuses=[];
   const makeOptions=(request,access='full',approve=async()=>true)=>({provider:'gemini',model:'qa',messages:[{role:'user',content:'Crea una tarea y confírmala'}],signal:new AbortController().signal,request,execute:async(name)=>{if(name==='apheka_create'){writes++;return {id:'task-1',saved:true};}return {};},approve,onMessage:message=>messages.push(message),onAction:(action,status)=>statuses.push(status),localContext:'2026-11-04',personalization:{access}});
   await runCharvisAgent(makeOptions(async(_provider,_operation,payload)=>{received.push(payload);return modelCalls++===0?toolMessage():{choices:[{message:{content:'Creé la tarea Repasar energía.'}}]};}));
   const success=messages.at(-1)?.content==='Creé la tarea Repasar energía.'&&writes===1&&modelCalls===2&&received[1].messages.some(m=>m.role==='tool'&&m.name==='apheka_create')&&received[1].messages.find(m=>m.tool_calls)?.tool_calls[0].extra_content.google.thought_signature===signature;
   messages=[];writes=0;modelCalls=0;let failure=false;
   try{await runCharvisAgent(makeOptions(async()=>{if(modelCalls++===0)return toolMessage();throw Error('HTTP 400: controlled failure after write');}));}catch{failure=true;}
   const failureSummary=failure&&writes===1&&String(messages.at(-1)?.content).includes('Se completaron estas acciones:')&&String(messages.at(-1)?.content).includes('Crear un elemento');
   messages=[];writes=0;modelCalls=0;
   await runCharvisAgent(makeOptions(async()=>{modelCalls++;return toolMessage();},'review',async()=>false));
   const cancelled=writes===0&&modelCalls===1&&String(messages.at(-1)?.content).includes('No se aplicaron cambios.');
   return {
    exactSignature:replay.messages[0].tool_calls[0].extra_content.google.thought_signature===signature,
    messageMetadata:replay.messages[0].extra_content.google.thought_signature==='message-signature',
    noCrossProviderMetadata:!switched.messages[0].extra_content&&!switched.messages[0].tool_calls[0].extra_content,
    cancelledCallHasName:closed[1].name==='apheka_create'&&closed[1].tool_call_id==='g1',
    encryptedPersistence:encrypted.__charvisEncrypted===1&&!JSON.stringify(encrypted).includes(signature)&&restored[0].message.tool_calls[0].extra_content.google.thought_signature===signature,
    responseAfterAction:success,confirmedFailureSummary:failureSummary,cancelledWithoutWrite:cancelled
   };
  });
  for(const [name,passed] of Object.entries(results))assert.equal(passed,true,name);
  console.log('PASS Gemini signatures across tools and encrypted reload, provider isolation, named cancelled results, response after action, honest failure/cancellation summaries; controlled provider responses');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
