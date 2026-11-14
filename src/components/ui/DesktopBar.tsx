import { canPlayOffline } from '../../lib/musicAvailability';
import React, { useEffect, useRef, useState } from 'react';
import { Menu, Plus, Search, Columns2, MoreHorizontal, X, Music, Pause, Play, SkipForward, Volume2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useAppSlice } from '../../store/AppContext';
import type { DesktopState, Companion } from '../../lib/desktopWorkspace';
import type { useAutoDock } from '../../hooks/useAutoDock';
import { useAutoDock as useAutoBar } from '../../hooks/useAutoDock';
import WestWordmark from './WestWordmark';
const TopMusic = React.memo(function TopMusic({ onOpen }: {
    onOpen: () => void;
}) {
    const a = useAppSlice(['hydrated', 'tracks', 'currentTrackId', 'isPlayingMusic', 'toggleMusicPlayback', 'musicQueue', 'setMusicQueue', 'playTrack', 'queueSource', 'settings', 'musicVolume', 'setMusicVolume']);
    const track = a.tracks.find(t => t.id === a.currentTrackId), [volume, setVolume] = useState(false);
    const next = () => { const valid = (id: string) => id !== track?.id && a.tracks.some(t => t.id === id && (!a.settings.musicOffline || canPlayOffline(t))); const queue = a.musicQueue.filter(valid), pool = (a.queueSource?.pool || a.tracks.map(t => t.id)).filter(valid), id = queue[0] || pool[0]; if (id) {
        a.setMusicQueue(queue.filter(v => v !== id));
        a.playTrack(id);
    } };
    return <div className="desktop-now-playing" aria-label="Reproducción actual">{track ? <><button className="desktop-now-art" onClick={onOpen} aria-label="Abrir música actual">{track.coverImage || track.coverUrl ? <img src={track.coverImage || track.coverUrl} alt=""/> : <Music size={16}/>}</button><button className="desktop-now-name" onClick={onOpen}><strong>{track.title}</strong><span>{track.artist}</span></button><button aria-label={a.isPlayingMusic ? 'Pausar desde la barra' : 'Reanudar desde la barra'} disabled={!a.hydrated} onClick={a.toggleMusicPlayback}>{a.isPlayingMusic ? <Pause size={15}/> : <Play size={15}/>}</button><button aria-label="Siguiente canción desde la barra" disabled={!a.hydrated} onClick={next}><SkipForward size={16}/></button><div className="desktop-volume"><button aria-label="Volumen de la barra" aria-expanded={volume} onClick={() => setVolume(v => !v)}><Volume2 size={15}/></button>{volume && <div><input type="range" aria-label="Volumen de reproducción" min="0" max="100" value={Math.round(a.musicVolume * 100)} onChange={e => a.setMusicVolume(Number(e.target.value) / 100)}/></div>}</div></> : <button className="desktop-music-empty" onClick={onOpen}><Music size={15}/><span>Un sonido para tu espacio</span></button>}</div>;
});
type Props = {
    state: DesktopState;
    dock: ReturnType<typeof useAutoDock>;
    onActivate: (id: string) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
    onRename: (id: string, name: string) => void;
    onCompanion: (value: Companion) => void;
    onSearch: () => void;
    onMusic: () => void;
};
export default function DesktopBar({ state, dock, onActivate, onAdd, onRemove, onRename, onCompanion, onSearch, onMusic }: Props) {
    const { settings } = useAppSlice(['settings']), bar = useAutoBar(), automatic = !!settings.desktopBarAutoHide, hidden = automatic && !bar.open;
    useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'F10') {
        e.preventDefault();
        bar.show();
        requestAnimationFrame(() => bar.root.current?.querySelector<HTMLButtonElement>('button')?.focus());
    } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [bar.show]);
    const current = state.desktops.find(d => d.id === state.activeId)!, [edit, setEdit] = useState<{
        id: string;
        name: string;
    } | null>(null), dialog = useRef<HTMLFormElement>(null);
    useDialogFocus(dialog, !!edit, () => setEdit(null));
    return <><div className="desktop-bar-host" data-autohide={automatic} data-hidden={hidden}>{automatic && <button className="desktop-bar-edge" aria-label="Mostrar barra superior" title="Mostrar barra · F10" onPointerEnter={bar.show} onPointerLeave={bar.leave} onFocus={bar.show} onClick={bar.show}/>}<header ref={bar.root} className="desktop-bar" inert={hidden} aria-hidden={hidden} onPointerEnter={bar.cancel} onPointerLeave={bar.leave} onFocusCapture={bar.show} onBlurCapture={bar.leave}><div className="desktop-bar-start"><button ref={dock.trigger} className="desktop-nav-trigger" aria-label="Abrir navegación" aria-controls="apheka-navigation-dock" aria-expanded={dock.open} onClick={dock.toggle}><Menu size={18}/></button><div className="desktop-small-brand"><WestWordmark /></div><nav className="desktop-spaces" aria-label="Escritorios de West">{state.desktops.map((d, i) => <button key={d.id} aria-current={state.activeId === d.id ? 'page' : undefined} aria-label={'Escritorio ' + (i + 1) + ': ' + d.name} title={'Cambiar a ' + d.name + ' · Ctrl+Alt+' + (i + 1)} onClick={() => onActivate(d.id)} onDoubleClick={() => setEdit({ id: d.id, name: d.name })} onContextMenu={e => { e.preventDefault(); setEdit({ id: d.id, name: d.name }); }}><span>{i + 1}</span><strong>{d.name}</strong></button>)}<button aria-label="Añadir escritorio" disabled={state.desktops.length >= 5} onClick={onAdd}><Plus size={15}/></button></nav></div><TopMusic onOpen={onMusic}/><div className="desktop-bar-end"><button aria-label="Buscar o capturar" className="desktop-command-button" onClick={onSearch}><Search size={16}/><span>Buscar</span><kbd>Ctrl Espacio</kbd></button><button aria-label="Dividir escritorio" title="Mostrar u ocultar panel acompañante" aria-pressed={current.companion !== 'none'} onClick={() => onCompanion(current.companion === 'none' ? 'timer' : 'none')}><Columns2 size={17}/></button>{current.companion !== 'none' && <select aria-label="Panel acompañante" value={current.companion} onChange={e => onCompanion(e.target.value as Companion)}><option value="timer">Sesión</option><option value="notes">Notas</option><option value="tasks">Tareas</option><option value="lyrics">Letra</option></select>}<button aria-label="Configurar escritorio" title="Renombrar o cerrar este escritorio" onClick={() => setEdit({ id: current.id, name: current.name })}><MoreHorizontal size={17}/></button></div>{edit && createPortal(<div className="desktop-edit-backdrop" onKeyDown={e => { if (e.key === 'Escape')
        setEdit(null); }}><form ref={dialog} className="desktop-edit-dialog" role="dialog" aria-modal="true" aria-label="Configurar escritorio" onSubmit={e => { e.preventDefault(); if (edit.name.trim()) {
        onRename(edit.id, edit.name);
        setEdit(null);
    } }}><header><h2>Tu espacio de trabajo</h2><button type="button" aria-label="Cerrar configuración de escritorio" onClick={() => setEdit(null)}><X size={18}/></button></header><label>Nombre del escritorio<input autoFocus maxLength={28} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label><p>Cada escritorio recuerda su apartado y su panel acompañante. La música y tu sesión siguen activas al cambiar.</p><footer><button type="button" className="btn-secondary" disabled={state.desktops.length <= 1} onClick={() => { onRemove(edit.id); setEdit(null); }}>Cerrar escritorio</button><button className="btn-primary" disabled={!edit.name.trim()}>Guardar</button></footer></form></div>, document.body)}</header></div></>;
}
