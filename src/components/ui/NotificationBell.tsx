import {useAppSlice} from "../../store/AppContext";
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,X,Info,CheckCircle,AlertCircle,Download,RefreshCw,Loader2} from 'lucide-react';
import {format} from 'date-fns';
import {useApp,fmtClock} from '../../store/AppContext';
import {applyUpdate,relaunchApp} from '../../lib/appUpdate';

export default function NotificationBell(){
 const {notifications,removeNotification,clearNotifications,settings,addNotification}=useAppSlice(["notifications","removeNotification","clearNotifications","settings","addNotification"]);
 const [open,setOpen]=useState(false),[position,setPosition]=useState({top:0,left:0}),[busy,setBusy]=useState(false);
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
 const runAction=async(action:{label:string;kind:'relaunch'|'open-url'|'update';url?:string;sha256?:string})=>{
  if(busy)return;
  if(action.kind==='relaunch'){await relaunchApp();return;}
  if(action.kind==='update'){
    if(!action.url||!action.sha256)return;
    setBusy(true);
    const result=await applyUpdate(action.url,action.sha256);
    setBusy(false);
    addNotification(result.message,result.ok?'info':'error');
    return;
  }
  const url=action.url;if(!url)return;
  try{const {openUrl}=await import('@tauri-apps/plugin-opener');await openUrl(url);}catch{try{window.open(url,'_blank','noopener');}catch{/* the browser refused to open it */}}
 };
 const icons={success:<CheckCircle size={16}/>,error:<AlertCircle size={16}/>,info:<Info size={16}/>};
 return <><button ref={trigger} className="notification-trigger" aria-label="Notificaciones" aria-expanded={open} aria-controls="notification-panel" onClick={()=>setOpen(!open)}><Bell size={17}/>{notifications.length>0&&<span>{notifications.length>9?'9+':notifications.length}</span>}</button>
 {open&&createPortal(<div ref={panel} id="notification-panel" role="dialog" aria-label="Notificaciones" className="notification-panel" style={position}>
  <div className="notification-panel-header"><h2>Notificaciones</h2><div>{notifications.length>0&&<button onClick={clearNotifications}>Limpiar</button>}<button aria-label="Cerrar notificaciones" onClick={()=>setOpen(false)}><X size={16}/></button></div></div>
  <div className="notification-list">{notifications.length===0?<p className="notification-empty">No tienes avisos pendientes.</p>:[...notifications].reverse().map(n=><article key={n.id} className={`notification-item notification-${n.type}`}>
   <span aria-hidden="true">{icons[n.type as keyof typeof icons]||icons.info}</span><div><p>{n.message}</p>{n.action&&<button className="notification-action" disabled={busy} onClick={()=>void runAction(n.action!)}>{busy?<Loader2 size={13} className="spin"/>:n.action.kind==='relaunch'?<RefreshCw size={13}/>:<Download size={13}/>}<span>{busy?'Actualizando…':n.action.label}</span></button>}<time>{(()=>{try{return fmtClock(format(new Date(n.timestamp),'HH:mm'),settings.timeFormat)}catch{return '—'}})()}</time></div><button aria-label={`Eliminar aviso: ${n.message}`} onClick={()=>removeNotification(n.id)}><X size={14}/></button>
  </article>)}</div></div>,document.body)}</>;
}
