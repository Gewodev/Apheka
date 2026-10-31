import {useEffect,useRef,useState} from 'react';
import {Minus,Plus} from 'lucide-react';
/** Total task workload, distinct from the capped duration of each study block. */
export default function TaskDurationField({value,onChange,compact=false}:{value:number;onChange:(value:number)=>void;compact?:boolean}){
 const [draft,setDraft]=useState(String(value)),skip=useRef(false);
 useEffect(()=>setDraft(String(value)),[value]);
 const apply=(n:number)=>{if(!Number.isFinite(n))return;const next=Math.max(1,Math.min(10080,Math.round(n)));setDraft(String(next));if(next!==value)onChange(next);};
 const commit=()=>{if(skip.current){skip.current=false;return;}if(!draft.trim()){setDraft(String(value));return;}apply(Number(draft));};
 return <div className="task-duration-field" data-compact={compact} data-divided={value>120}><label>{compact?'Tiempo de estudio':'Duración estimada de la tarea'}</label><div className="task-duration-editor"><button type="button" aria-label="Reducir tiempo de estudio" disabled={value<=1} onMouseDown={e=>e.preventDefault()} onClick={()=>apply(value-5)}><Minus size={13}/></button><input aria-label={compact?'Tiempo de estudio':'Duración estimada de la tarea'} type="number" inputMode="numeric" min={1} max={10080} step={5} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();skip.current=true;e.currentTarget.blur();}else if(e.key==='Escape'){e.stopPropagation();setDraft(String(value));skip.current=true;e.currentTarget.blur();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();apply(value+(e.key==='ArrowUp'?5:-5));}}}/><span>min</span><button type="button" aria-label="Aumentar tiempo de estudio" disabled={value>=10080} onMouseDown={e=>e.preventDefault()} onClick={()=>apply(value+5)}><Plus size={13}/></button></div>{!compact&&<small>Máximo 120 min por bloque</small>}{compact&&value>120&&<small>{Math.ceil(value/120)} bloques como mínimo</small>}</div>;
}
