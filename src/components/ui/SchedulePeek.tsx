import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {get} from 'idb-keyval';
import {CalendarDays,X,ChevronLeft,ChevronRight} from 'lucide-react';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import {readScheduleShortcut,matchesScheduleShortcut,SCHEDULE_COMMAND_EVENT,SCHEDULE_SHORTCUT_EVENT} from '../../lib/scheduleShortcut';
type ImageItem={id:string;title:string;dataUrl:string};
function Panel({onClose,onConfigure}:{onClose:()=>void;onConfigure:()=>void}){
 const ref=useRef<HTMLElement>(null),[images,setImages]=useState<ImageItem[]>([]),[index,setIndex]=useState(0),[loading,setLoading]=useState(true);
 useDialogFocus(ref,true,onClose);
 useEffect(()=>{let live=true;(async()=>{try{let items=await get<ImageItem[]>('owa_sched_images_v3');if(!items?.length){try{items=JSON.parse(localStorage.getItem('owa_sched_images_v3')||'[]');}catch{}}if(live){setImages(Array.isArray(items)?items:[]);const saved=Number(localStorage.getItem('owa_sched_active_image_idx')||0);setIndex(Math.max(0,Math.min(Number.isFinite(saved)?saved:0,(items?.length||1)-1)));}}finally{if(live)setLoading(false);}})().catch(()=>{});return()=>{live=false;};},[]);
 const image=images[index];
 return createPortal(<div className="schedule-peek-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} className="schedule-peek" role="dialog" aria-modal="true" aria-label="Horario rápido" tabIndex={-1}>
 <header><div><span><CalendarDays size={16}/>Horario</span><h2>{image?.title||'Tu horario a mano'}</h2></div><button aria-label="Cerrar horario" onClick={onClose}><X size={18}/></button></header>
 <div className="schedule-peek-body">{loading?<p>Cargando horario…</p>:image?<img src={image.dataUrl} alt={image.title||'Horario'} decoding="async"/>:<div className="schedule-peek-empty"><CalendarDays size={30}/><h3>Aún no hay un horario</h3><p>Añade tu imagen desde Planificador → Horario.</p><button className="btn-secondary" onClick={()=>{onClose();onConfigure();}}>Ir al planificador</button></div>}</div>
 {images.length>1&&<footer><button aria-label="Horario anterior" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ChevronLeft size={16}/></button><span>{index+1} de {images.length}</span><button aria-label="Horario siguiente" disabled={index===images.length-1} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={16}/></button></footer>}
 </section></div>,document.body);
}
export default function SchedulePeek({onConfigure}:{onConfigure:()=>void}){
 const [open,setOpen]=useState(false),[shortcut,setShortcut]=useState(readScheduleShortcut);
 useEffect(()=>{const changed=()=>setShortcut(readScheduleShortcut()),toggle=()=>setOpen(v=>!v);window.addEventListener(SCHEDULE_COMMAND_EVENT,toggle);window.addEventListener(SCHEDULE_SHORTCUT_EVENT,changed);return()=>{window.removeEventListener(SCHEDULE_COMMAND_EVENT,toggle);window.removeEventListener(SCHEDULE_SHORTCUT_EVENT,changed);};},[]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.defaultPrevented||!matchesScheduleShortcut(event,shortcut))return;if((event.target as Element)?.closest?.('input,textarea,[contenteditable=true],select'))return;if(document.querySelector('[role=dialog][aria-modal=true]:not(.schedule-peek)'))return;event.preventDefault();setOpen(v=>!v);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[shortcut]);
 return open?<Panel onClose={()=>setOpen(false)} onConfigure={onConfigure}/>:null;
}
