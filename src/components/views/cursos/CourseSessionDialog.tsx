import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronUp,ChevronDown,Minus, Plus, X} from 'lucide-react';

import PlanSelectDropdown from '../../ui/PlanSelectDropdown';

export type CourseSessionDraft = {
  title:string; date:string; startTime:string; durationMinutes:number; intensity:number;
  type:string; groupId:string; topicId:string; repeat:'none'|'daily'|'weekly'|'custom_days'; repeatDays:number[]; repeatUntil:string;
};
const intensityColors=['#c76771','#cd7e58','#c6934f','#c6a650','#b3ae5f','#97ad70','#7ca885','#699f97','#6695a9','#708bac'];
function SessionTimeStepper({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [hour,minute]=value.split(':').map(Number),safeHour=Number.isFinite(hour)?hour:9,safeMinute=Number.isFinite(minute)?minute:0;
 const set=(hours:number,minutes:number)=>onChange(String(Math.max(0,Math.min(23,hours))).padStart(2,'0')+':'+String(Math.max(0,Math.min(59,minutes))).padStart(2,'0'));
 return <div className="session-time-steppers" role="group" aria-label="Hora de inicio de la sesión">{([['Hora',safeHour,23],['Minuto',safeMinute,59]] as const).map(([label,number,max],index)=><React.Fragment key={label}>{index===1&&<span className="session-time-separator">:</span>}<div><button type="button" aria-label={'Aumentar '+label.toLowerCase()+' de inicio'} onClick={()=>index===0?set((number+1)%24,safeMinute):set(safeHour,(number+5)%60)}><ChevronUp size={14}/></button><input aria-label={label+' de inicio de la sesión'} inputMode="numeric" type="number" min="0" max={max} value={String(number).padStart(2,'0')} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=max)index===0?set(n,safeMinute):set(safeHour,n);}}/><button type="button" aria-label={'Reducir '+label.toLowerCase()+' de inicio'} onClick={()=>index===0?set((number+23)%24,safeMinute):set(safeHour,(number+55)%60)}><ChevronDown size={14}/></button></div></React.Fragment>)}</div>;
}
export default function CourseSessionDialog({initialValue,editing,course,groups,topics,onSave,onClose}:{
  initialValue:CourseSessionDraft; editing:boolean; course:{name:string;color:string};
  groups:{id:string;name:string}[]; topics:{id:string;title:string;groupId?:string}[];
  onSave:(value:CourseSessionDraft)=>void; onClose:()=>void;
}){
  const [draft,setDraft]=useState(initialValue),root=useRef<HTMLFormElement>(null),title=useRef<HTMLInputElement>(null);
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
        const fields=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')].filter(field=>field.getClientRects().length);
        const first=fields[0],last=fields[fields.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}>
      <header><div><h2 id="course-session-title">{editing?'Editar sesión':'Nueva sesión de estudio'}</h2><div className="course-session-subhead"><input type="date" aria-label="Fecha de la sesión" required value={draft.date} onChange={event=>change('date',event.target.value)}/><span className="course-session-course">{course.name}</span></div></div><button type="button" className="course-session-close" aria-label="Cerrar sesión de estudio" onClick={onClose}><X size={17}/></button></header>
      <div className="course-session-fields">
        <label className="course-session-field">Título<input ref={title} required maxLength={240} value={draft.title} placeholder="Ej: Repasar capítulo 3" onChange={event=>change('title',event.target.value)}/></label>
        <div className="course-session-time-row"><div className="course-session-field"><span>Hora de inicio</span><SessionTimeStepper value={draft.startTime} onChange={value=>change('startTime',value)}/></div><section className="course-session-field course-session-duration" aria-label="Duración de la sesión"><span>Duración</span><div className="session-duration-stepper"><button type="button" aria-label="Reducir duración de sesión" disabled={draft.durationMinutes<=5} onClick={()=>duration(draft.durationMinutes-5)}><Minus size={14}/></button><output>{draft.durationMinutes}<small>min</small></output><button type="button" aria-label="Aumentar duración de sesión" disabled={draft.durationMinutes>=240} onClick={()=>duration(draft.durationMinutes+5)}><Plus size={14}/></button></div><div className="course-session-presets session-duration-presets" role="group" aria-label="Duraciones sugeridas">{[15,25,30,45,60].map(minutes=><button type="button" key={minutes} aria-label={minutes+' minutos'} aria-pressed={draft.durationMinutes===minutes} onClick={()=>duration(minutes)}>{minutes}</button>)}</div></section></div>
        <section className="session-intensity-field"><header><span>Intensidad esperada</span><output>{draft.intensity<=3?'Suave':draft.intensity<=6?'Media':draft.intensity<=8?'Intensa':'Máxima'}</output></header><div className="session-intensity-scale" role="radiogroup" aria-label="Intensidad esperada">{intensityColors.map((color,index)=><button key={index} type="button" role="radio" aria-checked={draft.intensity===index+1} aria-label={'Intensidad '+(index+1)+' de 10'} data-filled={index<draft.intensity} style={{'--intensity-color':color} as React.CSSProperties} onClick={()=>change('intensity',index+1)} onKeyDown={event=>{if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const value=event.key==='Home'?1:event.key==='End'?10:Math.max(1,Math.min(10,draft.intensity+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)));change('intensity',value);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[value-1]?.focus();}}} tabIndex={draft.intensity===index+1?0:-1}/>)}</div><div className="session-intensity-labels"><span>Suave</span><span>Máxima</span></div></section>
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
