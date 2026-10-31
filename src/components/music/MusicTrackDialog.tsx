import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Music,Pencil,ListPlus,ListMusic,Image,Trash2,ArrowLeft} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import MusicPlaylistPicker from './MusicPlaylistPicker';
import toast from 'react-hot-toast';
export default function MusicTrackDialog({trackId,onClose}:{trackId:string;onClose:()=>void}){
 const a=useAppSlice(['tracks','updateTrack','deleteTrack','setMusicQueue','musicQueue','setCoverModalTrackId']),track=a.tracks.find(t=>t.id===trackId);
 const [mode,setMode]=useState<'menu'|'edit'|'lists'>('menu'),[title,setTitle]=useState(track?.title||''),[artist,setArtist]=useState(track?.artist||''),[busy,setBusy]=useState(false),[remove,setRemove]=useState(false);
 const dialog=useRef<HTMLFormElement>(null),input=useRef<HTMLInputElement>(null);useDialogFocus(dialog,true,()=>{if(!busy)onClose();});
 useEffect(()=>{if(!track)onClose();},[track?.id]);
 useLayoutEffect(()=>{if(mode==='edit')input.current?.focus();},[mode]);
 if(!track)return null;
 const cover=track.coverImage||track.coverUrl;
 return createPortal(<div className="desktop-edit-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><form ref={dialog} className="music-song-dialog music-track-actions" role="dialog" aria-modal="true" aria-label="Opciones de canción" aria-busy={busy} onSubmit={async e=>{e.preventDefault();if(mode!=='edit'||busy||!title.trim())return;setBusy(true);try{await a.updateTrack(trackId,{title:title.trim(),artist:artist.trim()},true);toast.success('Canción actualizada');onClose();}catch{toast.error('No se pudieron guardar los cambios.');}finally{setBusy(false);}}}>
 <header><div>{mode!=='menu'&&<button type="button" aria-label="Volver a opciones de canción" disabled={busy} onClick={()=>{setMode('menu');setRemove(false);}}><ArrowLeft size={17}/></button>}<h2>{mode==='edit'?'Editar canción':mode==='lists'?'Añadir a una lista':'Opciones de canción'}</h2></div><button type="button" disabled={busy} aria-label="Cerrar opciones de canción" onClick={onClose}><X size={18}/></button></header>
 <div className="music-action-identity">{cover?<img src={cover} alt=""/>:<div><Music size={23}/></div>}<div><strong>{track.title}</strong><span>{track.artist||'Sin artista'}</span></div></div>
 {mode==='menu'?<><div className="music-action-list"><button type="button" onClick={()=>setMode('edit')}><Pencil size={17}/><span>Editar título y artista</span></button><button type="button" onClick={()=>setMode('lists')}><ListPlus size={17}/><span>Añadir a una lista</span></button><button type="button" onClick={()=>{a.setMusicQueue([...a.musicQueue.filter(id=>id!==trackId),trackId]);toast.success('Añadida a la cola');onClose();}}><ListMusic size={17}/><span>A continuación</span></button><button type="button" onClick={()=>{onClose();a.setCoverModalTrackId(trackId);}}><Image size={17}/><span>Portada</span></button></div>{remove?<div className="music-inline-confirm"><span>¿Eliminar esta canción de la biblioteca?</span><div><button type="button" className="btn-secondary" onClick={()=>setRemove(false)}>Cancelar</button><button type="button" className="btn-secondary" onClick={()=>{a.deleteTrack(trackId);onClose();}}>Eliminar canción</button></div></div>:<button type="button" className="music-delete-song" onClick={()=>setRemove(true)}><Trash2 size={16}/>Eliminar canción</button>}</>:mode==='edit'?<><label>Título<input ref={input} aria-label="Título de canción" value={title} onChange={e=>setTitle(e.target.value)} maxLength={300} disabled={busy}/></label><label>Artista<input aria-label="Artista de canción" value={artist} onChange={e=>setArtist(e.target.value)} maxLength={200} disabled={busy}/></label><footer><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy||!title.trim()}>{busy?'Guardando…':'Guardar cambios'}</button></footer></>:<MusicPlaylistPicker trackId={trackId} resolveTrack={()=>trackId} onClose={onClose}/>}
 </form></div>,document.body);
}
