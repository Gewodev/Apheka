import {MCP_TOOLS,record} from './mcpCatalog';
import {charvisSystem,chatPayload,completeChatTurns,readChatResponse,type ChatMessage,type ToolCall,type CharvisRequest} from './charvis';
export type CharvisAction={call:ToolCall;args:Record<string,unknown>;title:string;write:boolean};
type AgentOptions={provider:string;model:string;messages:ChatMessage[];signal:AbortSignal;request:CharvisRequest;execute:(name:string,args:Record<string,unknown>)=>Promise<unknown>;approve:(actions:CharvisAction[])=>Promise<boolean>;onMessage:(message:ChatMessage)=>void;onAction:(action:CharvisAction,status:'running'|'done'|'rejected'|'error')=>void;localContext:string};
function requireActive(signal:AbortSignal){signal.throwIfAborted();}
export async function runCharvisAgent(options:AgentOptions){
 const o=options,read=new Set<string>();let totalCalls=0;
 const system:ChatMessage={role:'system',content:charvisSystem+'\nFecha y contexto local: '+o.localContext};
 // Keep complete user turns. Never slice into a tool-call/result sequence.
 const turns=completeChatTurns(o.messages),starts=turns.map((m,i)=>m.role==='user'?i:-1).filter(i=>i>=0).slice(-6);let first=starts.shift()??0;
 while(turns.length-first>70&&starts.length)first=starts.shift()!;
 const history=[system,...turns.slice(first)];
 // Contracts and counts are fresh once per turn, not a polling subscription.
 for(const name of ['apheka_describe','apheka_overview']){requireActive(o.signal);const data=await o.execute(name,{});system.content+=`\n${name}: ${JSON.stringify(data).slice(0,40000)}`;}
 for(let round=0;round<8;round++){
  requireActive(o.signal);const response=await o.request(o.provider,'chat',chatPayload(o.provider,o.model,history),o.signal);requireActive(o.signal);
  const assistant=readChatResponse(response);history.push(assistant);o.onMessage(assistant);
  if(!assistant.tool_calls?.length)return;
  const actions:CharvisAction[]=assistant.tool_calls.map(call=>{const tool=MCP_TOOLS.find(t=>t.name===call.function.name);let args:Record<string,unknown>;try{args=record(JSON.parse(call.function.arguments));}catch{throw Error('El modelo devolvió argumentos que no son JSON. No se aplicó la acción.');}return {call,args,title:tool?.title||call.function.name,write:tool?.annotations.readOnlyHint===false};});
  totalCalls+=actions.length;if(totalCalls>32)throw Error('Se alcanzó el límite de acciones de este turno. Revisa los resultados antes de continuar.');
  const writes=actions.filter(a=>a.write);let accepted=false;
  if(writes.length){accepted=await o.approve(writes);requireActive(o.signal);}
  for(const action of actions){
   requireActive(o.signal);const {call,args}=action,tool=MCP_TOOLS.find(t=>t.name===call.function.name);let output:unknown;
   try{
    if(!tool)throw Error('Herramienta desconocida. Consulta describe.');
    if(action.write&&!accepted){o.onAction(action,'rejected');output={cancelled:true,message:'El usuario no confirmó este cambio. No reintentes sin que lo solicite.'};}
    else{
     if(['apheka_update','apheka_delete','apheka_move'].includes(call.function.name)&&!read.has(JSON.stringify([args.entity,args.courseId||'',args.topicId||'',args.id])))throw Error('Lee primero el elemento con apheka_get y sus IDs reales antes de modificarlo.');
     if(['apheka_subtask','apheka_subtask_remove'].includes(call.function.name)&&!read.has(JSON.stringify(['tasks','','',args.taskId])))throw Error('Lee primero la tarea con apheka_get antes de cambiar sus subtareas.');
     o.onAction(action,'running');output=await o.execute(call.function.name,args);requireActive(o.signal);
     if(call.function.name==='apheka_get')read.add(JSON.stringify([args.entity,args.courseId||'',args.topicId||'',args.id]));
     o.onAction(action,'done');
    }
   }catch(error){if(o.signal.aborted)throw error;output={error:error instanceof Error?error.message:String(error)};o.onAction(action,'error');}
   const result:ChatMessage={role:'tool',tool_call_id:call.id,content:JSON.stringify(output).slice(0,60000)};history.push(result);o.onMessage(result);
  }
  if(writes.length&&!accepted)return;
 }
 throw Error('Charvis alcanzó el límite de 8 consultas. Se conservan los cambios confirmados y el historial.');
}
