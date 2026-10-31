import {useAppSlice} from "../../store/AppContext";
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,X,Info,CheckCircle,AlertCircle} from 'lucide-react';
import {format} from 'date-fns';
import {useApp,fmtClock} from '../../store/AppContext';

export default function NotificationBell(){
 const {notifications,removeNotification,clearNotifications,settings}=useAppSlice(["notifications","removeNotification","clearNotifications","settings"]);
 const [open,setOpen]=useState(false),[position,setPosition]=useState({top:0,left:0});
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;setPosition({top:Math.max(12,Math.min(r.bottom+10,innerHeight-360)),left:Math.max(12,Math.min(r.right-360,innerWidth-372))});};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const close=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);trigger.current?.focus({preventScroll:true});}};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
 },[open]);
 const icons={success:<CheckCircle size={16}/>,error:<AlertCircle size={16}/>,info:<Info size={16}/>};
 return <><button ref={trigger} className="notification-trigger" aria-label="Notificaciones" aria-expanded={open} aria-controls="notification-panel" onClick={()=>setOpen(!open)}><Bell size={17}/>{notifications.length>0&&<span>{notifications.length>9?'9+':notifications.length}</span>}</button>
 {open&&createPortal(<div ref={panel} id="notification-panel" role="dialog" aria-label="Notificaciones" className="notification-panel" style={position}>
  <div className="notification-panel-header"><h2>Notificaciones</h2><div>{notifications.length>0&&<button onClick={clearNotifications}>Limpiar</button>}<button aria-label="Cerrar notificaciones" onClick={()=>setOpen(false)}><X size={16}/></button></div></div>
  <div className="notification-list">{notifications.length===0?<p className="notification-empty">No tienes avisos pendientes.</p>:[...notifications].reverse().map(n=><article key={n.id} className={`notification-item notification-${n.type}`}>
   <span aria-hidden="true">{icons[n.type as keyof typeof icons]||icons.info}</span><div><p>{n.message}</p><time>{(()=>{try{return fmtClock(format(new Date(n.timestamp),'HH:mm'),settings.timeFormat)}catch{return '—'}})()}</time></div><button aria-label={`Eliminar aviso: ${n.message}`} onClick={()=>removeNotification(n.id)}><X size={14}/></button>
  </article>)}</div></div>,document.body)}</>;
}
