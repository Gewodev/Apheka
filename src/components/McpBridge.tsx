import React,{useEffect,useRef,useState} from 'react';
import {createPortal,flushSync} from 'react-dom';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {ShieldCheck,X} from 'lucide-react';
import {useApp,useAppSnapshot} from '../store/AppContext';
import {MCP_TOOLS,record} from '../lib/mcpCatalog';
import {recordMcpActivity} from '../lib/mcpActivity';
import {peekPlanner} from '../lib/plannerStore';
import './ui/mcp.css';
type Request={requestId:string;name:string;arguments:Record<string,unknown>;write:boolean;needsApproval:boolean;expiresAt:number};
type Approval={request:Request;respond:(accepted:boolean)=>void};
export interface McpTransport {listen(handler:(request:Request)=>void):Promise<()=>void>;invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>}
const nativeTransport:McpTransport={listen:handler=>listen<Request>('apheka:mcp-request',event=>handler(event.payload)),invoke};
function McpBridge({transport}:{transport?:McpTransport}={}) {
  const getApp=useAppSnapshot(),[approval,setApproval]=useState<Approval|null>(null);
  useEffect(()=>{
    if(!transport&&!isTauri())return;
    const port=transport||nativeTransport;
    let disposed=false,stop:(()=>void)|undefined,queue=Promise.resolve(),rejectApproval:(()=>void)|undefined,currentGate:{cancelled:boolean}|undefined;
    const handle=async(request:Request)=>{
      let status:'ok'|'error'|'cancelled'='error';
      const gate={cancelled:false};currentGate=gate;
      const assertActive=()=>{if(disposed||gate.cancelled||Date.now()>=request.expiresAt)throw new Error('Solicitud cancelada o expirada antes de aplicar el cambio.');};
      try {
        if(disposed||Date.now()>=request.expiresAt)throw new Error('La solicitud ya expiró.');
        if(request.needsApproval) {
          const accepted=await new Promise<boolean>(resolve=>{
            let finished=false;
            const respond=(value:boolean)=>{if(finished)return;finished=true;clearTimeout(timer);rejectApproval=undefined;if(!disposed)setApproval(null);resolve(value);};
            const timer=setTimeout(()=>respond(false),Math.max(0,request.expiresAt-Date.now()-500));
            rejectApproval=()=>respond(false);setApproval({request,respond});
          });
          if(!accepted){status='cancelled';throw new Error('Operación no confirmada en POUH. No se ha ejecutado.');}
        }
        if(disposed || !await port.invoke<boolean>('mcp_claim',{requestId:request.requestId}))throw new Error('La conexión se cerró o la solicitud expiró antes de ejecutarse.');
        const {runMcpTool}=await import('../lib/mcpActions');
        assertActive();
        flushSync(()=>window.dispatchEvent(new Event('apheka:flush-editors')));
        if(request.needsApproval&&request.write){await getApp().persistWorkspace();const {collectBackup}=await import('../lib/owaBackup');const {set}=await import('idb-keyval');await set('apheka_mcp_safety_backup',await collectBackup());assertActive();}
        const value=await runMcpTool({app:()=>getApp(),mutate:action=>{assertActive();flushSync(action);},assertActive},request.name,record(request.arguments));
        if(request.write) {
          // A remote edit must update an open contentEditable before its next flush.
          flushSync(()=>window.dispatchEvent(new CustomEvent('apheka:mcp-committed',{detail:{name:request.name,args:request.arguments}})));
          await getApp().persistWorkspace();
        }
        await port.invoke('mcp_resolve',{requestId:request.requestId,result:{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:{result:value},isError:false}});
        status='ok';
      } catch(error) {
        await port.invoke('mcp_resolve',{requestId:request.requestId,result:{isError:true,content:[{type:'text',text:error instanceof Error?error.message:'No se pudo completar la operación. Consulta el estado antes de repetirla.'}]}}).catch(()=>{});
      } finally {currentGate=undefined;if(!disposed)recordMcpActivity({id:request.requestId,name:request.name,time:Date.now(),status});}
    };
    void port.listen(request=>{queue=queue.catch(()=>{}).then(()=>handle(request));}).then(unlisten=>{
      if(disposed){unlisten();return;}stop=unlisten;return port.invoke('mcp_register',{tools:MCP_TOOLS});
    }).catch(()=>{});
    const cancel=()=>{if(currentGate)currentGate.cancelled=true;rejectApproval?.();};window.addEventListener('apheka:mcp-disabled',cancel);
    return()=>{disposed=true;stop?.();rejectApproval?.();window.removeEventListener('apheka:mcp-disabled',cancel);};
  },[]);
  return approval?<McpApproval approval={approval}/>:null;
}
function McpApproval({approval}:{approval:Approval}) {
  const app=useApp();
  const root=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null);
  const {request,respond}=approval;
  const args=request.arguments;
  const parent=app.courses.find(c=>c.id===args.courseId),parentTopic=parent?.studyTopics?.find(t=>t.id===args.topicId);
  const collection=({tasks:app.tasks,notes:app.notes,note_folders:app.noteFolders,courses:app.courses,habits:app.habits,planned_sessions:app.plannedSessions,planner_events:peekPlanner()?.events||[],playlists:app.playlists,artists:app.artists,groups:parent?.groups||[],topics:parent?.studyTopics||[],tools:parentTopic?.materials?.filter(m=>m.toolMode)||[],sources:parentTopic?.materials?.filter(m=>m.type==='resource')||[],tags:parent?.topicTagDefs||[],materials:parentTopic?.materials||[],flashcards:parentTopic?.flashcards||[]} as Record<string,any[]>)[String(args.entity)];
  const target=collection?.find(item=>item.id===args.id)||(['apheka_note_purge','apheka_note_restore'].includes(request.name)?app.notes.find(note=>note.id===args.id):undefined)||app.tasks.find(t=>t.id===args.taskId)?.subtasks.find(s=>s.id===args.subtaskId);
  useEffect(()=>{const before=document.activeElement as HTMLElement;cancel.current?.focus();return()=>{if(before?.isConnected)before.focus({preventScroll:true});};},[approval]);
  return createPortal(<div className="mcp-approval-backdrop"><div ref={root} role="dialog" aria-modal="true" aria-labelledby="mcp-approval-title" className="mcp-approval" onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();respond(false);}
    if(event.key==='Tab'){const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('button')];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1]?.focus();}else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus();}}
  }}>
    <div className="mcp-card-heading"><ShieldCheck size={22}/><h2 id="mcp-approval-title">Confirmar cambio desde la IA</h2><button aria-label="Cancelar solicitud" onClick={()=>respond(false)}><X size={18}/></button></div>
    <p>{request.name==='apheka_timer_reset'?'Se solicita reiniciar la sesión de estudio actual.':'Se solicita eliminar un elemento. Esta acción puede afectar sus elementos vinculados.'}</p>
    <dl className="mcp-request-summary"><dt>Función</dt><dd>{MCP_TOOLS.find(t=>t.name===request.name)?.title||request.name}</dd>{target&&<><dt>Elemento</dt><dd>{target.title||target.name}</dd></>}{['entity','courseId','topicId','id','taskId','subtaskId'].filter(key=>request.arguments[key]).map(key=><React.Fragment key={key}><dt>{key==='entity'?'Apartado':key}</dt><dd>{String(request.arguments[key])}</dd></React.Fragment>)}</dl>
    <p className="mcp-muted">Solo esta solicitud. La confirmación vence si no respondes.</p>
    <footer><button ref={cancel} onClick={()=>respond(false)}>Cancelar</button><button className="mcp-confirm" onClick={()=>respond(true)}>Confirmar acción</button></footer>
  </div></div>,document.body);
}

export default React.memo(McpBridge);
