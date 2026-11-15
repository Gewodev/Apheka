import React,{useState} from 'react';
import {Droplets,Dumbbell,Minus,Plus,Sparkles} from 'lucide-react';
import {useAppSlice} from '../../../store/AppContext';

/**
 * Medidores diarios de agua y ejercicio. La activacion de estas metricas vive
 * en Ajustes (categoria Planificador); aqui solo se registra el progreso.
 */
export default function HabitModes({date}:{date:string}){
  const a=useAppSlice(['habits','updateHabit']);
  const modes=[{kind:'water' as const,label:'Agua',unit:'vasos',step:1,goal:8,max:30,icon:<Droplets size={18}/>,hint:'Vasos de agua registrados hoy'},{kind:'exercise' as const,label:'Ejercicio',unit:'min',step:5,goal:30,max:300,icon:<Dumbbell size={18}/>,hint:'Minutos de ejercicio registrados hoy'}];
  const update=(habitId:string,amount:number)=>{
   const habit=a.habits.find(h=>h.id===habitId);if(!habit)return;
   const goal=Math.max(1,habit.dailyGoal||8),amountOn={...habit.amountOn,[date]:Math.max(0,Math.min(1440,amount))};
   const entries=Object.entries(amountOn).sort(([x],[y])=>y.localeCompare(x)).slice(0,90);
   a.updateHabit(habitId,{amountOn:Object.fromEntries(entries),completedOn:amountOn[date]>=goal?[...new Set([...habit.completedOn,date])]:habit.completedOn.filter(d=>d!==date)});
  };
  return <section className="habit-modes" aria-label="Medidores de agua y ejercicio">
   <div className="habit-metric-grid">
    {a.habits.filter(h=>h.metricKind&&!h.isArchived).map(h=>{
     const water=h.metricKind==='water',mode=modes.find(m=>m.kind===h.metricKind)!;
     const goal=Math.max(1,h.dailyGoal||mode.goal),value=h.amountOn?.[date]||0,step=mode.step;
     const done=value>=goal,percent=Math.min(100,Math.round(value/goal*100));
     return <article key={h.id} data-kind={h.metricKind} data-complete={done} style={{'--habit-fill':`${percent}%`} as React.CSSProperties}>
      <div className="habit-meter" aria-hidden="true">{water?<Droplets size={30}/>:<Dumbbell size={30}/>}<span className="habit-meter-fill"/></div>
      <div className="habit-metric-body">
       <strong>{h.name}</strong>
       <p><output>{value}</output><span className="habit-metric-goal">/ {goal} {mode.unit}</span>{done&&<span className="habit-metric-done"><Sparkles size={12}/>Completado</span>}</p>
       <div className="habit-progress" role="progressbar" aria-label={'Progreso de '+h.name} aria-valuenow={value} aria-valuemin={0} aria-valuemax={goal}><span style={{width:percent+'%'}}/></div>
       <label className="habit-goal">Meta personal<input aria-label={'Meta de '+h.name} type="number" min="1" max={water?30:300} value={goal} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=(water?30:300)){a.updateHabit(h.id,{dailyGoal:n,completedOn:value>=n?[...new Set([...h.completedOn,date])]:h.completedOn.filter(d=>d!==date)});}}}/><span>{mode.unit}</span></label>
      </div>
      <div className="habit-metric-actions">
       <button type="button" aria-label={'Restar '+h.name} title={'Restar '+step+' '+mode.unit} onClick={()=>update(h.id,value-step)} disabled={value===0}><Minus size={15}/></button>
       <button type="button" className="habit-metric-add" aria-label={'Registrar '+h.name} title={'Añadir '+step+' '+mode.unit} onClick={()=>update(h.id,value+step)}><Plus size={15}/><span>{step}</span></button>
      </div>
     </article>;
    })}
   </div>
   {!a.habits.some(h=>h.metricKind&&!h.isArchived)&&<p className="habit-empty">Activa el agua o el ejercicio en Ajustes · Planificador para registrar tu cantidad diaria y aprender de tu ritmo.</p>}
  </section>;
}
