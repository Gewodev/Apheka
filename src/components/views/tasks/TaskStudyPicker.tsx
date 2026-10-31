import {suggestStudyTask} from '../../../lib/jev';
import {nextStudyStep,studyBlockMinutes} from '../../../lib/taskStudyPlan';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {BookOpen,Clock,Play,Shuffle,X} from 'lucide-react';
import type {Task} from '../../../store/AppContext';
import {chooseStudyTask,type TaskAssessment} from '../../../lib/taskIntelligence';
import {taskLinkUnavailable} from '../../../lib/linkEligibility';
import {useDialogFocus} from '../../../hooks/useDialogFocus';

type Props={tasks:Task[];assessments:Map<string,TaskAssessment>;onClose:()=>void;onOpen:(id:string)=>void;onStudy:(id:string)=>void;onCourse:(task:Task)=>void;hasCourse:(task:Task)=>boolean};
export default function TaskStudyPicker({tasks,assessments,onClose,onOpen,onStudy,onCourse,hasCourse}:Props){
 const root=useRef<HTMLDivElement>(null),recent=useRef<string[]>([]);
 const makeSpin=()=>{
  const id=chooseStudyTask(tasks,assessments,Math.random,Date.now(),recent.current),eligible=tasks.filter(task=>!taskLinkUnavailable(task));
  const result=tasks.find(task=>task.id===id),rows=result?Array.from({length:18},(_,i)=>i===17?result:eligible[i%eligible.length]):[];
  return {id,rows,source:'Cálculo local',token:Date.now()+Math.random()};
 };
 const [spin,setSpin]=useState(makeSpin),[busy,setBusy]=useState(true),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
 const selected=tasks.find(task=>task.id===spin.id),assessment=spin.id?assessments.get(spin.id):undefined,blocked=taskLinkUnavailable(selected);
 useDialogFocus(root,true,onClose);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion:reduce)'),change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{
  let active=true;const started=performance.now();let timer:ReturnType<typeof setTimeout>|undefined;
  void suggestStudyTask(tasks,assessments).catch(()=>null).then(answer=>{
   if(!active)return;
   if(answer)setSpin(current=>({...current,id:answer.taskId,source:'Jev',rows:current.rows.map((row,i)=>i===current.rows.length-1?tasks.find(task=>task.id===answer.taskId)!:row)}));
   const delay=reduced||!spin.id?0:Math.max(0,1750-(performance.now()-started));timer=setTimeout(()=>{if(active)setBusy(false);},delay);
  });return()=>{active=false;clearTimeout(timer);};
 },[spin.token,reduced]);
 const again=()=>{if(spin.id)recent.current=[spin.id,...recent.current].slice(0,3);setBusy(true);setSpin(makeSpin());};
 return createPortal(<div className="task-picker-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}><div ref={root} className="task-study-picker" role="dialog" aria-modal="true" aria-labelledby="task-picker-title"><header><div><Shuffle size={18}/><h2 id="task-picker-title">Qué estudiar ahora</h2></div><button type="button" className="btn-ghost" aria-label="Cerrar selector de tareas" onClick={onClose}><X size={18}/></button></header>
  {!spin.id?<div className="task-picker-empty"><BookOpen size={28}/><p>No hay tareas disponibles para iniciar una sesión.</p><span>Las completadas y las fechas vencidas no entran en la selección. Puedes revisar sus datos en Tareas.</span></div>:<><div className="task-picker-reel-window" data-spinning={busy&&!reduced} role="button" tabIndex={busy?-1:0} aria-disabled={busy} aria-label={selected?'Abrir tarea '+selected.title:'Selección de tarea'} style={{'--task-color':selected?.courseColor||'var(--accent)'} as React.CSSProperties} onClick={()=>{if(!busy&&selected)onOpen(selected.id);}} onKeyDown={event=>{if(!busy&&selected&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onOpen(selected.id);}}}><div key={spin.token} aria-hidden="true" className="task-picker-reel" style={{'--reel-end':`-${(spin.rows.length-1)*92}px`,transform:`translateY(-${(spin.rows.length-1)*92}px)`} as React.CSSProperties}>{spin.rows.map((task,i)=><div key={i} className="task-picker-reel-row"><small>{task.course||'Sin curso'}</small><strong>{task.title}</strong></div>)}</div></div>
  <div className="task-picker-result" aria-live="polite" aria-atomic="true">{busy?<p role="status">Eligiendo entre tus prioridades…</p>:selected&&assessment?<><div className="task-picker-meta"><span style={{color:assessment.color}}>{assessment.label}</span><span><Clock size={13}/>{assessment.remainingMinutes} min pendientes</span></div>{spin.source==='Jev'&&<small>Sugerencia de Jev, dentro de tus prioridades actuales.</small>}<ul>{assessment.reasons.slice(0,3).map(reason=><li key={reason}>{reason}</li>)}</ul>{blocked&&<p className="task-picker-warning">{blocked}</p>}</>:<p>Esta tarea cambió o ya no está disponible. Elige de nuevo.</p>}</div>
  {!busy&&selected&&nextStudyStep(selected)&&<div className="task-picker-next-step"><span>Subtarea · {studyBlockMinutes(selected,nextStudyStep(selected))} min</span><strong>{nextStudyStep(selected)!.title}</strong></div>}
  <footer><button type="button" className="btn-secondary" onClick={again} disabled={busy}><Shuffle size={15}/>Otra opción</button><div><button type="button" className="btn-secondary" disabled={busy||!selected||!hasCourse(selected)} onClick={()=>selected&&onCourse(selected)}>Ir al curso</button><button type="button" className="btn-primary" disabled={busy||!!blocked} onClick={()=>selected&&onStudy(selected.id)}><Play size={15}/>Empezar sesión</button></div></footer></>}
 </div></div>,document.body);
}
