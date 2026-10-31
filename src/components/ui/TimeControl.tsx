import React, {useEffect,useState,useRef} from 'react';
import {ChevronDown,ChevronUp,X} from 'lucide-react';
import {clockMinutes,shiftClock} from '../../lib/timeControl';

export default function TimeControl({label,value,onChange,clearable=true,presets=['09:00','12:00','18:00']}:{label:string;value:string;onChange:(value:string)=>void;clearable?:boolean;presets?:string[]}) {
 const [draft,setDraft]=useState(value);const skipBlur=useRef(false);useEffect(()=>setDraft(value),[value]);
 const apply=(next:string)=>{setDraft(next);onChange(next);};
 const commit=()=>{if(draft===value)return;if(clockMinutes(draft)!==null||(clearable&&!draft))apply(draft);else setDraft(value);};
 const adjust=(delta:number)=>apply(shiftClock(draft,delta));
 return <div className="time-control">
  <div className="time-control-main"><input type="time" aria-label={label} value={draft} onChange={event=>{setDraft(event.target.value);if(clockMinutes(event.target.value)!==null)onChange(event.target.value);}} onBlur={()=>{if(skipBlur.current){skipBlur.current=false;return;}commit();}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();skipBlur.current=true;event.currentTarget.blur();}if(event.key==='Escape'){setDraft(value);skipBlur.current=true;event.stopPropagation();event.currentTarget.blur();}}}/>
   <div className="time-control-arrows"><button type="button" aria-label={`Adelantar ${label} 15 minutos`} disabled={clockMinutes(draft)===1439} onMouseDown={event=>event.preventDefault()} onClick={()=>adjust(15)}><ChevronUp size={16}/></button><button type="button" aria-label={`Retroceder ${label} 15 minutos`} disabled={clockMinutes(draft)===0} onMouseDown={event=>event.preventDefault()} onClick={()=>adjust(-15)}><ChevronDown size={16}/></button></div>
   {clearable&&value&&<button className="time-control-clear" type="button" aria-label="Quitar hora límite" onClick={()=>apply('')}><X size={15}/></button>}
  </div>
  <div className="time-control-presets" role="group" aria-label={`Horas sugeridas para ${label}`}>{presets.map(time=><button type="button" key={time} aria-label={`${label}: ${time}`} aria-pressed={value===time} onClick={()=>apply(time)}>{time}</button>)}</div>
 </div>;
}
