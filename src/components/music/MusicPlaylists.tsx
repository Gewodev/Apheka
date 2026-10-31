import {libraryRadioOrder} from '../../lib/musicRadio';
import MusicTrackDialog from './MusicTrackDialog';
import {isLibraryTrack} from '../../lib/musicRadio';
import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Plus, Play, Music, Trash2, Pencil, X, Search, GripVertical, ListMusic, MoreHorizontal } from 'lucide-react';
import { createPortal, flushSync } from 'react-dom';
import { useAppSlice, type Track, type Playlist } from '../../store/AppContext';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { canPlayOffline } from '../../lib/musicAvailability';
import toast from 'react-hot-toast';
const songCount=(count:number)=>count===1?'1 canción':count+' canciones';
const duration = (tracks: Track[]) => Math.round(tracks.reduce((n, t) => n + (t.duration || 0), 0) / 60) + ' min';
function Cover({ list, tracks }: {
    list: Playlist;
    tracks: Track[];
}) { const images = list.coverImage ? [list.coverImage] : tracks.map(t => t.coverImage || t.coverUrl).filter((v): v is string => !!v).slice(0, 4); return <div className="playlist-mosaic" data-mosaic={images.length >= 4}>{images.length ? images.slice(0, images.length >= 4 ? 4 : 1).map((src, i) => <img key={i} src={src} alt="" loading="lazy"/>) : <Music size={36} strokeWidth={1.2}/>}</div>; }
export default function MusicPlaylists({ storageKey = 'apheka_playlist' }: {
    storageKey?: string;
}) {
    const a = useAppSlice(['tracks', 'playlists', 'addPlaylist', 'updatePlaylist', 'deletePlaylist', 'playTrack', 'setMusicQueue', 'setQueueSource', 'settings', 'currentTrackId', 'shuffleMode', 'trackHistory', 'playCounts','setRepeatMode']), [selected, setSelected] = useState<string | null>(() => sessionStorage.getItem(storageKey)), [edit, setEdit] = useState<{
        id?: string;
        name: string;
        ids: string[];cover?:string;
    } | null>(null), [query, setQuery] = useState(''), [listQuery,setListQuery]=useState(''),[trackQuery,setTrackQuery]=useState(''),[actionTrack,setActionTrack]=useState<string|null>(null), [confirm, setConfirm] = useState(false), dragged = useRef<string | null>(null), dialog = useRef<HTMLFormElement>(null);
    useDialogFocus(dialog, !!edit, () => setEdit(null));
    const trackById=useMemo(()=>new Map(a.tracks.map(track=>[track.id,track])),[a.tracks]);
    const list = a.playlists.find(p => p.id === selected), tracks = useMemo(() => list?.trackIds.map(id => trackById.get(id)).filter((t): t is Track => !!t) || [], [list,trackById]);
    const choose = (id: string | null) => {
        setSelected(id);
        if (id)
            sessionStorage.setItem(storageKey, id);
        else
            sessionStorage.removeItem(storageKey);
        setConfirm(false);setTrackQuery('');
    };
    const play = (start?: string) => {
        const valid = tracks.filter(t => !a.settings.musicOffline || canPlayOffline(t)), ids = valid.map(t => t.id), index = start ? ids.indexOf(start) : 0;
        if (index < 0 || !ids.length) {
            toast('No hay canciones disponibles en este modo.');
            return;
        }
        flushSync(() => { a.setRepeatMode('all');a.setQueueSource({ pool: ids, name: list?.name || 'Lista' }); a.setMusicQueue(a.shuffleMode?libraryRadioOrder(tracks,ids[index],a.trackHistory,a.playCounts,a.settings.musicOffline,Math.random,true):ids.slice(index + 1)); });
        a.playTrack(ids[index]);
    };
    const move = (id: string, to: number) => {
        if (!list)
            return;
        const ids = [...list.trackIds], from = ids.indexOf(id);
        if (from < 0 || to < 0 || to >= ids.length)
            return;
        ids.splice(from, 1);
        ids.splice(to, 0, id);
        a.updatePlaylist(list.id, { trackIds: ids });
    };
    const save = (e: React.FormEvent) => {
        e.preventDefault();
        if (!edit?.name.trim())
            return;
        const name = edit.name.trim();
        if (a.playlists.some(p => p.id !== edit.id && p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            toast.error('Ya existe una lista con ese nombre.');
            return;
        }
        if (edit.id)
            a.updatePlaylist(edit.id, { name, trackIds: [...new Set(edit.ids)],coverImage:edit.cover||undefined });
        else
            a.addPlaylist(name, [...new Set(edit.ids)],edit.cover);
        setEdit(null);
    };
    return <section className="music-playlists" data-detail={!!list} aria-label="Listas de reproducción">{list&&<nav className="playlist-collection-nav" aria-label="Biblioteca de listas"><label className="playlist-nav-search"><Search size={15}/><input aria-label="Buscar listas de reproducción" placeholder="Buscar listas" value={listQuery} onChange={e=>setListQuery(e.target.value)}/></label><button aria-pressed={!list} onClick={()=>choose(null)}><ChevronLeft size={15}/>Todas las listas</button>{a.playlists.filter(pl=>pl.name.toLocaleLowerCase().includes(listQuery.toLocaleLowerCase())).map(pl=><button key={pl.id} aria-pressed={list?.id===pl.id} onClick={()=>choose(pl.id)}><Cover list={pl} tracks={pl.trackIds.map(id=>trackById.get(id)).filter((t):t is Track=>!!t)}/><span>{pl.name}</span><small>{pl.trackIds.filter(id=>trackById.has(id)).length}</small></button>)}</nav>}<div className="playlist-collection-content">{!list ? <><header className="music-section-heading"><label className="playlist-gallery-search"><Search size={16}/><input aria-label="Buscar listas de reproducción" placeholder="Buscar una lista" value={listQuery} onChange={e=>setListQuery(e.target.value)}/></label><button className="btn-primary" onClick={() => { setQuery(''); setEdit({ name: '', ids: [] }); }}><Plus size={16}/>Crear lista</button></header><div className="playlist-gallery">{a.playlists.filter(pl=>pl.name.toLocaleLowerCase().includes(listQuery.toLocaleLowerCase())).map(pl => { const songs = pl.trackIds.map(id => trackById.get(id)).filter((t): t is Track => !!t); return <button key={pl.id} className="playlist-tile" onClick={() => choose(pl.id)}><Cover list={pl} tracks={songs}/><div className="playlist-tile-info"><strong title={pl.name}>{pl.name}</strong><div className="playlist-tile-meta"><span>{songCount(songs.length)}</span><small>{duration(songs)}</small></div></div><ChevronRight className="playlist-tile-arrow" size={16} aria-hidden="true"/></button>; })}</div>{a.playlists.length>0&&!a.playlists.some(pl=>pl.name.toLocaleLowerCase().includes(listQuery.toLocaleLowerCase()))&&<p className="music-service-message">No hay listas con ese nombre.</p>}{!a.playlists.length && <div className="music-empty"><Music size={34} strokeWidth={1.2}/><h3>Dale un lugar a tus canciones.</h3><p>Crea una lista vacía o empieza con tus canciones guardadas.</p></div>}</> : <><header className="playlist-detail-heading"><Cover list={list} tracks={tracks}/><div><h2>{list.name}</h2><p>{songCount(tracks.length)} · {duration(tracks)}</p><div><button className="btn-primary" disabled={!tracks.length} onClick={() => play()}><Play size={16}/>Reproducir</button><button className="btn-secondary" onClick={() => { setQuery(''); setEdit({ id: list.id, name: list.name, ids: [...list.trackIds],cover:list.coverImage }); }}><Plus size={16}/>Añadir canciones</button><button className="btn-ghost" aria-label="Renombrar lista" onClick={() => { setQuery(''); setEdit({ id: list.id, name: list.name, ids: [...list.trackIds],cover:list.coverImage }); }}><Pencil size={16}/></button><button className="btn-ghost" aria-label="Eliminar lista" onClick={() => setConfirm(v => !v)}><Trash2 size={16}/></button></div></div></header>{confirm && <div className="music-inline-confirm" role="alert"><span>Se eliminará la lista. Las canciones seguirán en tu biblioteca.</span><button className="btn-secondary" onClick={() => setConfirm(false)}>Cancelar</button><button className="btn-secondary" onClick={() => { a.deletePlaylist(list.id); choose(null); }}>Eliminar lista</button></div>}<label className="playlist-detail-search"><Search size={16}/><input aria-label="Buscar en esta lista" placeholder="Buscar en esta lista" value={trackQuery} onChange={e=>setTrackQuery(e.target.value)}/></label><div className="playlist-track-list">{tracks.map((track, index) => (track.title+' '+track.artist).toLocaleLowerCase().includes(trackQuery.toLocaleLowerCase())&& <article key={track.id} data-current={track.id === a.currentTrackId} draggable onDragStart={e => { dragged.current = track.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', track.id); }} onDragEnd={() => { dragged.current = null; }} onDragOver={e => {
                    if (dragged.current)
                        e.preventDefault();
                }} onDrop={e => {
                    e.preventDefault();
                    if (dragged.current)
                        move(dragged.current, index);
                    dragged.current = null;
                }}><GripVertical size={15} aria-hidden="true"/><button className="playlist-track-title" aria-label={'Reproducir ' + track.title + ' de la lista'} onClick={() => play(track.id)}><span>{index + 1}</span>{(track.coverImage||track.coverUrl)&&<img className="playlist-track-art" src={track.coverImage||track.coverUrl} alt="" loading="lazy"/>}<div><strong>{track.title}</strong><small>{track.artist}</small></div></button><span className="playlist-track-length">{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}</span><button className="playlist-reorder" aria-label={'Subir ' + track.title} disabled={index === 0} onClick={() => move(track.id, index - 1)}><ArrowUp size={14}/></button><button className="playlist-reorder" aria-label={'Bajar ' + track.title} disabled={index === tracks.length - 1} onClick={() => move(track.id, index + 1)}><ArrowDown size={14}/></button><button aria-label={'Quitar ' + track.title + ' de la lista'} onClick={() => a.updatePlaylist(list.id, { trackIds: list.trackIds.filter(id => id !== track.id) })}><X size={15}/></button><button className="music-song-more" aria-label={'Opciones de '+track.title+' en la lista'} onClick={()=>setActionTrack(track.id)}><MoreHorizontal size={17}/></button></article>)}</div>{!tracks.length && <div className="music-empty"><h3>Empieza tu selección.</h3><p>Añade canciones desde tu biblioteca o guarda alguna en Descubrir.</p></div>}</>}{actionTrack&&<MusicTrackDialog key={actionTrack} trackId={actionTrack} onClose={()=>setActionTrack(null)}/>} {edit && createPortal(<div className="desktop-edit-backdrop"><form ref={dialog} className="playlist-editor" role="dialog" aria-modal="true" aria-label={edit.id ? 'Editar lista' : 'Crear lista'} onSubmit={save}><header><h2>{edit.id ? 'Editar lista' : 'Crear lista'}</h2><button type="button" aria-label="Cerrar edición de lista" onClick={() => setEdit(null)}><X size={18}/></button></header><label>Nombre<input autoFocus aria-label="Nombre de la lista" maxLength={80} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label><div className="playlist-cover-editor"><Cover list={{id:edit.id||'new',name:edit.name,trackIds:edit.ids,coverImage:edit.cover,createdAt:Date.now()}} tracks={edit.ids.map(id=>trackById.get(id)).filter((t):t is Track=>!!t)}/><label className="btn-secondary">Elegir portada<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Portada de la lista" hidden onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>5*1024*1024){toast.error('La portada supera 5 MB.');return;}try{const image=await createImageBitmap(file);const canvas=document.createElement('canvas');const size=Math.min(800,image.width,image.height);canvas.width=canvas.height=size;canvas.getContext('2d')!.drawImage(image,(image.width-Math.min(image.width,image.height))/2,(image.height-Math.min(image.width,image.height))/2,Math.min(image.width,image.height),Math.min(image.width,image.height),0,0,size,size);image.close();setEdit(current=>current?{...current,cover:canvas.toDataURL('image/webp',.88)}:current);}catch{toast.error('No se pudo leer esa imagen. Elige una portada válida.');}}}/></label>{edit.cover&&<button className="btn-ghost" type="button" onClick={()=>setEdit({...edit,cover:undefined})}>Usar mosaico</button>}</div><label className="playlist-search"><Search size={16}/><input aria-label="Buscar canciones para la lista" placeholder="Buscar en mis canciones" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="playlist-song-picker">{a.tracks.filter(t => isLibraryTrack(t)&& (t.title + ' ' + t.artist).toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 100).map(t => <label key={t.id}><input type="checkbox" checked={edit.ids.includes(t.id)} onChange={e => setEdit({ ...edit, ids: e.target.checked ? [...edit.ids, t.id] : edit.ids.filter(id => id !== t.id) })}/><span><strong>{t.title}</strong><small>{t.artist}</small></span></label>)}{!a.tracks.length && <p>Guarda canciones desde Descubrir o importa tus archivos. También puedes crear la lista vacía.</p>}</div><footer><span>{edit.ids.length} seleccionadas</span><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" disabled={!edit.name.trim()}>Guardar lista</button></footer></form></div>, document.body)}</div></section>;
}
