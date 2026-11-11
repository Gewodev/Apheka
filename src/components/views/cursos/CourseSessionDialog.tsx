import StudySessionControls from '../../ui/StudySessionControls';
import {useAppSlice} from '../../../store/AppContext';
import {taskLinkUnavailable} from '../../../lib/linkEligibility';
import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronUp,ChevronDown,Minus, Plus, X} from 'lucide-react';

import PlanSelectDropdown from '../../ui/PlanSelectDropdown';

export type CourseSessionDraft = {
  taskId?:string;
  title:string; date:string; startTime:string; durationMinutes:number; intensity:number;
  type:string; groupId:string; topicId:string; repeat:'none'|'daily'|'weekly'|'custom_days'; repeatDays:number[]; repeatUntil:string;
};
export default function CourseSessionDialog({initialValue,editing,course,groups,topics,onSave,onClose}:{
  initialValue:CourseSessionDraft; editing:boolean; course:{name:string;color:string};
  groups:{id:string;name:string}[]; topics:{id:string;title:string;groupId?:string}[];
  onSave:(value:CourseSessionDraft)=>void; onClose:()=>void;
}){
  const [draft,setDraft]=useState(initialValue),root=useRef<HTMLFormElement>(null),title=useRef<HTMLInputElement>(null);
  const {tasks}=useAppSlice(['tasks']);
  const taskOptions=tasks.filter(t=>t.course===course.name&&(!taskLinkUnavailable(t)||t.id===draft.taskId));
  const change=<K extends keyof CourseSessionDraft>(key:K,value:CourseSessionDraft[K])=>setDraft(previous=>({...previous,[key]:value}));
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;title.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  const duration=(minutes:number)=>change('durationMinutes',Math.max(5,Math.min(240,Math.round(minutes/5)*5)));
  const valid=!!draft.title.trim()&&!!draft.date&&(draft.repeat!=='custom_days'||draft.repeatDays.length>0)&&(!draft.repeatUntil||draft.repeat==='none'||draft.repeatUntil>=draft.date);
  return createPortal(<div className="course-session-backdrop desktop-edit-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <form ref={root} className="course-session-dialog course-session-scaled workspace-dialog" style={{'--session-color':course.color} as React.CSSProperties} role="dialog" aria-modal="true" aria-labelledby="course-session-title"
      onSubmit={event=>{event.preventDefault();if(valid)onSave({...draft,title:draft.title.trim()});}}
      onKeyDown={event=>{
        if(event.key==='Escape'){event.stopPropagation();onClose();}
        if(event.key!=='Tab'||!root.current?.contains(event.target as Node))return;
        const fields=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(field=>field.getClientRects().length);
        const first=fields[0],last=fields[fields.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}>
      <header><div><h2 id="course-session-title">{editing?'Editar sesión':'Nueva sesión de estudio'}</h2><div className="course-session-subhead"><input type="date" aria-label="Fecha de la sesión" required value={draft.date} onChange={event=>change('date',event.target.value)}/><span className="course-session-course">{course.name}</span></div></div><button type="button" className="course-session-close" aria-label="Cerrar sesión de estudio" onClick={onClose}><X size={17}/></button></header>
      <div className="course-session-fields">
        <label className="course-session-field">Título<input ref={title} required maxLength={240} value={draft.title} placeholder="Ej: Repasar capítulo 3" onChange={event=>change('title',event.target.value)}/></label>
        <StudySessionControls startTime={draft.startTime} duration={draft.durationMinutes} intensity={draft.intensity} onStart={value=>change('startTime',value)} onDuration={value=>change('durationMinutes',value)} onIntensity={value=>change('intensity',value)}/>
        <label className="course-session-field">Tarea vinculada<select aria-label="Tarea de la sesión" value={draft.taskId||''} onChange={e=>change('taskId',e.target.value||undefined)}><option value="">Sin tarea vinculada</option>{taskOptions.map(task=><option key={task.id} value={task.id}>{task.title}{taskLinkUnavailable(task)?' · revisar fecha o estado':''}</option>)}</select></label>
        <div className="course-session-field"><span>Repetir</span><div className="course-session-presets" role="group" aria-label="Repetir sesión">{([['none','No repite'],['daily','Cada día'],['weekly','Cada semana'],['custom_days','Días propios']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={draft.repeat===value} onClick={()=>change('repeat',value)}>{label}</button>)}</div>
          {draft.repeat==='custom_days'&&<div className="course-session-presets" role="group" aria-label="Días de repetición">{['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((day,index)=><button type="button" key={day} aria-label={day} aria-pressed={draft.repeatDays.includes(index)} onClick={()=>change('repeatDays',draft.repeatDays.includes(index)?draft.repeatDays.filter(value=>value!==index):[...draft.repeatDays,index])}>{['L','M','X','J','V','S','D'][index]}</button>)}</div>}
          {draft.repeat!=='none'&&<label className="course-session-until">Hasta<input type="date" aria-label="Repetir hasta" min={draft.date} value={draft.repeatUntil} onChange={event=>change('repeatUntil',event.target.value)}/></label>}
        </div>
        <div className="course-session-field"><span>Vincular a</span><PlanSelectDropdown label="Agrupación de la sesión" value={draft.groupId} onChange={value=>setDraft(previous=>({...previous,groupId:value,topicId:''}))} options={groups.map(group=>({id:group.id,label:group.name}))} noneLabel="Sin agrupación" color={course.color}/>
          {draft.groupId&&topics.some(topic=>topic.groupId===draft.groupId)&&<PlanSelectDropdown label="Tema de la sesión" value={draft.topicId} onChange={value=>change('topicId',value)} options={topics.filter(topic=>topic.groupId===draft.groupId).map(topic=>({id:topic.id,label:topic.title}))} noneLabel="Sin tema" color={course.color}/>}
        </div>
      </div>
      <footer><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn-primary" disabled={!valid}>{editing?'Guardar cambios':'Planificar'}</button></footer>
    </form>
  </div>,document.body);
}
