import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function DurationControl({label,value,min,max,step=1,unit='min',onChange,presets=[],description,showRange=true}: {
 label:string; value:number; min:number; max:number; step?:number; unit?:string; onChange:(value:number)=>void; presets?:number[]; description?:string; showRange?:boolean;
}) {
 const [draft,setDraft]=useState(String(value));
 const skipBlur=useRef(false);
 useEffect(()=>{setDraft(String(value));},[value]);
 const apply=(next:number)=>{const result=Math.max(min,Math.min(max,Math.round(next)));setDraft(String(result));if(result!==value)onChange(result);};
 const commit=()=>{if(draft===String(value))return;const parsed=Number(draft);if(!draft.trim()||!Number.isFinite(parsed)){setDraft(String(value));return;}apply(parsed);};
 const adjust=(delta:number)=>{const base=draft.trim()&&Number.isFinite(Number(draft))?Number(draft):value;apply(base+delta);};
 const percent=Math.max(0,Math.min(100,(value-min)/(max-min)*100));
 return <div className="duration-control">
  <div className="duration-control-heading"><div><label>{label}</label>{description && <p>{description}</p>}</div>
   <div className="duration-value-block">
    <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} step={step} value={draft} onChange={event=>setDraft(event.target.value)} onBlur={()=>{if(skipBlur.current){skipBlur.current=false;return;}commit();}}
      onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();skipBlur.current=true;event.currentTarget.blur();}if(event.key==='Escape'){event.stopPropagation();setDraft(String(value));skipBlur.current=true;event.currentTarget.blur();}if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();adjust((event.key==='ArrowUp'?step:-step)*(event.shiftKey?5:1));}}}/>
    <span>{unit}</span><div className="duration-arrows">
     <button type="button" aria-label={`Aumentar ${label}`} disabled={value>=max} onMouseDown={event=>event.preventDefault()} onClick={event=>adjust(step*(event.shiftKey?5:1))}><ChevronUp size={14}/></button>
     <button type="button" aria-label={`Reducir ${label}`} disabled={value<=min} onMouseDown={event=>event.preventDefault()} onClick={event=>adjust(-step*(event.shiftKey?5:1))}><ChevronDown size={14}/></button>
    </div>
   </div>
  </div>
  {showRange && <input className="duration-range" type="range" aria-label={`${label}: barra de ajuste`} min={min} max={max} step={step} value={value} onChange={event=>apply(Number(event.target.value))} style={{'--duration-progress':`${percent}%`} as React.CSSProperties}/>}
  {presets.length>0 && <div className="duration-presets">{presets.filter(preset=>preset>=min&&preset<=max).map(preset=><button type="button" key={preset} aria-label={`${label}: ${preset} ${unit}`} aria-pressed={value===preset} onClick={()=>apply(preset)}>{preset}<span>{unit}</span></button>)}</div>}
 </div>;
}
