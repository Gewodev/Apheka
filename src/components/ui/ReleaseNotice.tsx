import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {ArrowUpRight,Check} from 'lucide-react';
import WestWordmark from './WestWordmark';

type Notice={version:string;installationId:string;previousName:string;previousVersion:string};
export default function ReleaseNotice(){
 const [notice,setNotice]=useState<Notice|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!isTauri())return;let active=true;invoke<Notice|null>('get_release_notice').then(n=>{if(active)setNotice(n);}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{if(!notice)return;const previous=document.activeElement as HTMLElement|null;button.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[notice]);
 const close=async()=>{if(!notice||busy)return;setBusy(true);try{await invoke('acknowledge_release',{installationId:notice.installationId});setNotice(null);}catch{setError('No se pudo registrar la confirmación. Puedes volver a intentarlo.');}finally{setBusy(false);}};
 if(!notice)return null;
 const legacy=['OWA Studio','APHEKA','POHU','POUH'].includes(notice.previousName);
 return createPortal(<div className="release-notice-backdrop"><section className="release-notice" role="dialog" aria-modal="true" aria-labelledby="release-heading" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();void close();}if(e.key==='Tab'){e.preventDefault();button.current?.focus();}}}>
  <div className="release-notice-brand"><WestWordmark/><span>Versión {notice.version}</span></div>
  <h2 id="release-heading">Tu espacio de estudio, actualizado.</h2>
  <p>{legacy?'West continúa con todos tus datos.':`Actualización de ${notice.previousName || 'West'}${notice.previousVersion?` ${notice.previousVersion}`:''}.`} Tus cursos, notas, música y actividad permanecen en su carpeta de datos.</p>
  <ul>{["West en la app, el ejecutable y el instalador, conservando tus datos.","Cursor estable en pantalla completa: composición compatible por defecto y refresco nativo del puntero.","Controles multimedia de Windows: título, artista, portada, reproducción y salto de canción.","Descargas rediseñadas: enlace pegado legible, lista analizada en detalle y descarga por canción.","Apuntes en mosaico adaptable, sin el botón «Leer apunte» que ocupaba espacio.","Recordatorio de fin de jornada siempre activo: aprende de tu jornada sin activarlo.","Hábitos de agua y ejercicio con metas personales y mejor acabado visual."].map(text=><li key={text}><Check size={16}/><span>{text}</span></li>)}</ul>
  {error&&<p role="alert" className="field-error">{error}</p>}
  <footer><span>Hecho por Gewodev</span><button ref={button} disabled={busy} onClick={()=>void close()}>{busy?'Guardando…':'Continuar estudiando'}<ArrowUpRight size={17}/></button></footer>
 </section></div>,document.body);
}
