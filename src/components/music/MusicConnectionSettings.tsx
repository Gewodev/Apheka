import {useEffect,useState,useSyncExternalStore} from 'react';
import {ShieldCheck} from 'lucide-react';
import {musicConnection,musicConnectionError,type MusicConnection} from '../../lib/musicNetwork';
export default function MusicConnectionSettings(){
 const saved=useSyncExternalStore(musicConnection.subscribe,musicConnection.getSnapshot);
 const [draft,setDraft]=useState<MusicConnection>(saved),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>setDraft(saved),[saved]);
 const save=()=>{try{musicConnection.save(draft);setFailed(false);setMessage('Conexión guardada.');return true;}catch(error){setFailed(true);setMessage(musicConnectionError(error));return false;}};
 const check=async()=>{setBusy(true);setMessage('Comprobando el catálogo…');try{const {searchMusicCatalog}=await import('../../lib/youtubeMusic');const result=await searchMusicCatalog('Best Friend Rex Orange County','song',AbortSignal.timeout(25000),true);if(!result.songs.length)throw Error('El servicio respondió, pero no devolvió canciones.');setFailed(false);setMessage('Conexión disponible.');}catch(error){setFailed(true);setMessage(musicConnectionError(error));}finally{setBusy(false);}};
 return <section className="music-connection-settings" aria-label="Conexión del catálogo">
  <header><div className="music-connection-summary"><ShieldCheck size={19}/><h3>{saved.mode==='system'?'Conexión automática':'Conexión personalizada'}</h3></div><p>Las búsquedas usan HTTPS y la configuración de red de tu equipo.</p></header>
  
  <details><summary>Opciones de red</summary><div>
   <div className="music-connection-modes" role="group" aria-label="Conexión de búsqueda">{([['system','Automática'],['direct','Directa'],['custom','Proxy']] as const).map(([mode,label])=><button type="button" key={mode} aria-pressed={draft.mode===mode} disabled={busy} onClick={()=>{setDraft(v=>({...v,mode}));setMessage('');}}>{label}</button>)}</div>
   {draft.mode==='custom'&&<label>Dirección del proxy<input aria-label="Dirección del proxy musical" type="url" placeholder="http://127.0.0.1:8080" value={draft.proxyUrl} onChange={e=>setDraft(v=>({...v,proxyUrl:e.target.value}))} autoComplete="off" spellCheck={false}/></label>}
   <footer><button type="button" className="btn-secondary" disabled={busy} onClick={save}>Guardar conexión</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>{if(save())void check();}}>{busy?'Comprobando…':'Comprobar conexión'}</button></footer>
  </div></details>
  {message&&<p role={failed?'alert':'status'}>{message}</p>}
 </section>;
}
