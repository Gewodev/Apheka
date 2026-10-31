import React,{useState} from 'react';
import {Minus,Plus,X} from 'lucide-react';
import {finishForMinutes} from '../../lib/sessionFinish';
type Timing={seconds:number;deadline:number;fixedEnd?:boolean};
export default function SessionFinishControl({seconds,onApply,onClose}:{seconds:number;onApply:(timing:Timing)=>void;onClose:()=>void}){
 const [timing,setTiming]=useState<Timing>(()=>finishForMinutes(Math.round(seconds/60)));
 const minutes=timing.seconds/60,change=(m:number)=>{if(Number.isFinite(m))setTiming(finishForMinutes(Math.round(m)));};
 return <div className="session-finish-control"><header><strong>Pomodoro</strong><button aria-label="Cerrar duración" onClick={onClose}><X size={16}/></button></header><div className="session-duration-value"><button aria-label="Reducir duración un minuto" disabled={minutes<=1} onClick={()=>change(Math.ceil(minutes)-1)}><Minus size={16}/></button><div><input type="number" aria-label="Minutos del pomodoro" min="1" max="120" step="1" value={Math.round(minutes*10)/10} onChange={e=>change(Number(e.target.value))}/><span>min</span></div><button aria-label="Aumentar duración un minuto" disabled={minutes>=120} onClick={()=>change(Math.floor(minutes)+1)}><Plus size={16}/></button></div><input className="session-duration-slider" aria-label="Ajustar duración del pomodoro" type="range" min="1" max="120" step="1" value={Math.round(minutes)} onChange={e=>change(Number(e.target.value))}/><button className="btn-primary" onClick={()=>onApply(timing)}>Aplicar</button></div>;
}
