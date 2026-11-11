import React from 'react';
import {CheckSquare,ArrowUpRight} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {taskDeadline} from '../../lib/taskIntelligence';
export default function SessionTaskLink({taskId,onOpen}:{taskId?:string;onOpen?:()=>void}){
 const a=useAppSlice(['tasks','setFocusedTaskId','setNavigateTo']);if(!taskId)return null;
 const task=a.tasks.find(t=>t.id===taskId);if(!task)return <section className="session-task-link"><p>La tarea vinculada ya no está disponible.</p></section>;
 const deadline=taskDeadline(task.dueDate),days=deadline===null?null:Math.ceil((deadline-Date.now())/86400000);
 const status=task.status==='completado'?'Completada':days===null?'Sin fecha de entrega':deadline!<Date.now()?'Vencida · hace '+Math.max(1,Math.ceil((Date.now()-deadline!)/86400000))+' días':days<=1?'Entrega hoy':'Entrega en '+days+' días';
 return <section className="session-task-link" data-overdue={deadline!==null&&deadline<Date.now()}><span><CheckSquare size={15}/>Tarea vinculada</span><button onClick={()=>{onOpen?.();a.setFocusedTaskId(task.id);a.setNavigateTo('tareas');}}><strong>{task.title}</strong><ArrowUpRight size={16}/></button><p>{status}{deadline!==null?' · '+new Date(deadline).toLocaleDateString('es-PE'):''}</p></section>;
}
