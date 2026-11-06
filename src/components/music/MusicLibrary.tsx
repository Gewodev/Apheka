import {libraryRadioOrder} from '../../lib/musicRadio';
import {flushSync} from 'react-dom';
import {dailyMusicOrder} from '../../lib/dailyMusicOrder';
import {useLocalDay} from '../../hooks/useLocalDay';
import MusicTrackDialog from './MusicTrackDialog';
import {isLibraryTrack} from '../../lib/musicRadio';
import {useMemo,useState,useEffect,useRef} from 'react';
import { Play, Pause, Heart, Search, Music, MoreHorizontal, ChevronLeft, ChevronRight, LayoutGrid, List, FolderOpen, Upload } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useAppSlice, type Track } from '../../store/AppContext';
import { canPlayOffline,canPlayTrack } from '../../lib/musicAvailability';
const art = (track: Track) => track.coverImage || track.coverUrl;
export default function MusicLibrary({ workspaceId = 'default',favoritesOnly=false }: {
    workspaceId?: string;favoritesOnly?:boolean;
}) {
    const storageKey = 'apheka_music_library_' + workspaceId+(favoritesOnly?'_favorites':'');
    const libraryDay=useLocalDay();
    const [saved] = useState(() => { try {
        return JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    }
    catch {
        return {};
    } });
    const a = useAppSlice(['tracks', 'playTrack', 'currentTrackId', 'isPlayingMusic', 'toggleMusicPlayback', 'toggleTrackFavorite','setQueueSource','setRepeatMode','setMusicQueue','queueSource','musicQueue','trackHistory','playCounts','settings', 'importLocalZeroCopy', 'hydrated','removeDuplicateTracks','cleanupMissingLocalFiles','normalizeMusicFilenames']), [query, setQuery] = useState<string>(typeof saved.query === 'string' ? saved.query : ''), [filter, setFilter] = useState<string>(['all', 'favorites', 'offline', 'online'].includes(saved.filter) ? saved.filter : 'all'), [artist, setArtist] = useState<string>(typeof saved.artist === 'string' ? saved.artist : ''), [grid, setGrid] = useState(!!saved.grid), [page,setPage]=useState(1), [selected, setSelected] = useState<Track | null>(null), [saving,setSaving]=useState(false);
    useEffect(() => { sessionStorage.setItem(storageKey, JSON.stringify({ query, filter, artist, grid })); }, [query, filter, artist, grid, storageKey]);
    const scoped = useMemo(() => dailyMusicOrder(a.tracks.filter(t=>isLibraryTrack(t)&&(!favoritesOnly||t.isFavorite)&&(filter!=='favorites'||t.isFavorite)&&(filter!=='offline'||canPlayOffline(t))&&(filter!=='online'||!canPlayOffline(t))&&(!artist||t.artist===artist)),libraryDay),[a.tracks,filter,artist,favoritesOnly,libraryDay]);
    const tracks=useMemo(()=>scoped.filter(t=>(t.title+' '+t.artist).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[scoped,query]);
    const artists=useMemo(()=>[...new Set(a.tracks.filter(isLibraryTrack).map(t=>t.artist))].filter(Boolean).sort(),[a.tracks]);
    const scopeName=(favoritesOnly?'Favoritas':'Mis canciones')+(filter!=='all'||artist?' · Filtradas':'');
    const scopeKey=JSON.stringify([filter,artist,favoritesOnly]);
    const previousFilter=useRef(scopeKey);
    useEffect(()=>{
        const changedFilter=previousFilter.current!==scopeKey;previousFilter.current=scopeKey;
        if(!a.queueSource?.name?.startsWith(favoritesOnly?'Favoritas':'Mis canciones'))return;
        const eligible=scoped.filter(t=>canPlayTrack(t,a.settings.musicOffline)),ids=eligible.map(t=>t.id),allowed=new Set(ids),prior=new Set(a.queueSource.pool);
        if(!changedFilter&&prior.size===allowed.size&&ids.every(id=>prior.has(id)))return;
        const kept=a.musicQueue.filter(id=>allowed.has(id)&&id!==a.currentTrackId),added=eligible.filter(t=>changedFilter||!prior.has(t.id));
        a.setQueueSource({pool:ids,name:scopeName});a.setMusicQueue([...new Set([...kept,...libraryRadioOrder(added,a.currentTrackId,a.trackHistory,a.playCounts,a.settings.musicOffline)])]);
    },[scopeKey,scoped,a.queueSource,a.musicQueue,a.currentTrackId]);
    const importFiles = async (folder = false) => {
        if (!isTauri()) {
            toast('Importa tus archivos desde APHEKA de escritorio.');
            return;
        }
        try {
            const paths = await open(folder ? { directory: true, multiple: false, title: 'Carpeta de música' } : { multiple: true, title: 'Importar canciones', filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'opus', 'aac'] }] });
            if (!paths)
                return;
            const count = await a.importLocalZeroCopy(Array.isArray(paths) ? paths : [paths], folder);
            toast.success(count + ' canciones añadidas');
        }
        catch {
            toast.error('No se pudo importar. Tus canciones actuales siguen disponibles.');
        }
    };
    const pageSize=grid?10:9,pageCount=Math.max(1,Math.ceil(tracks.length/pageSize)),currentPage=Math.min(page,pageCount),pageStart=(currentPage-1)*pageSize;
    const play = (t: Track) => {
        if(!canPlayTrack(t,a.settings.musicOffline)){toast('Esta grabación no está disponible para reproducir.');return;}
        const eligible=scoped.filter(track=>canPlayTrack(track,a.settings.musicOffline)),ids=eligible.map(track=>track.id),sameScope=a.queueSource?.name===scopeName&&a.queueSource.pool.length===ids.length&&a.queueSource.pool.every(id=>ids.includes(id));
        flushSync(()=>{if(favoritesOnly)a.setRepeatMode('all');if(!sameScope){a.setQueueSource({pool:ids,name:scopeName});a.setMusicQueue(libraryRadioOrder(eligible,t.id,a.trackHistory,a.playCounts,a.settings.musicOffline));}});
        if(t.id===a.currentTrackId&&sameScope){a.toggleMusicPlayback();return;}
        a.playTrack(t.id,true);
    };
    return <section className="music-library" aria-label="Mis canciones"><header className="music-section-heading"><span className="music-library-count">{tracks.length} {tracks.length===1?'canción':'canciones'}</span><div><button className="btn-secondary" disabled={!a.hydrated} onClick={() => void importFiles(true)}><FolderOpen size={16}/>Carpeta</button><button className="btn-primary" disabled={!a.hydrated} onClick={() => void importFiles()}><Upload size={16}/>Importar</button><details className="music-library-maintenance"><summary aria-label="Organizar biblioteca" title="Organizar biblioteca"><MoreHorizontal size={17}/></summary><div>{([['normalizeMusicFilenames','Normalizar nombres'],['removeDuplicateTracks','Quitar duplicados'],['cleanupMissingLocalFiles','Limpiar referencias ausentes']] as const).map(([method,label])=><button type="button" className="btn-secondary" key={method} disabled={saving} onClick={async()=>{setSaving(true);try{const count=await a[method]();toast.success(count+' canciones actualizadas');}catch{toast.error('No se pudo completar la operación.');}finally{setSaving(false);}}}>{label}</button>)}</div></details></div></header><div className="music-library-controls"><label className="music-local-search"><Search size={16}/><input aria-label="Buscar en mis canciones" placeholder="Buscar título o artista" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label><select aria-label="Filtrar mis canciones" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">Todas</option><option value="favorites">Favoritas</option><option value="offline">Sin conexión</option><option value="online">En línea</option></select><select aria-label="Artista de mis canciones" value={artist} onChange={e => { setArtist(e.target.value); setPage(1); }}><option value="">Todos los artistas</option>{artists.map(v => <option key={v}>{v}</option>)}</select><div className="music-view-toggle" role="group" aria-label="Vista de mis canciones"><button aria-label="Vista de lista musical" aria-pressed={!grid} onClick={() => {setGrid(false);setPage(1);}}><List size={17}/></button><button aria-label="Vista de portadas" aria-pressed={grid} onClick={() => {setGrid(true);setPage(1);}}><LayoutGrid size={17}/></button></div></div><div className={grid ? 'music-songs-grid' : 'music-songs-list'}>{tracks.slice(pageStart,pageStart+pageSize).map((track, index) => <article key={track.id} data-current={track.id === a.currentTrackId}><button className="music-song-art" aria-label={'Reproducir ' + track.title} disabled={!a.hydrated} onClick={() => play(track)}>{art(track) ? <img src={art(track)} alt="" loading="lazy" decoding="async"/> : <Music size={22} strokeWidth={1.2}/>}<span>{track.id === a.currentTrackId && a.isPlayingMusic ? <Pause size={19}/> : <Play size={19}/>}</span></button><button className="music-song-name" onClick={() => play(track)}><strong>{track.title}</strong><small>{track.artist || 'Sin artista'}</small></button><span className="music-song-duration">{Math.floor((track.duration || 0) / 60)}:{String(Math.floor((track.duration || 0) % 60)).padStart(2, '0')}</span><button className="music-song-favorite" aria-label={(track.isFavorite ? 'Quitar favorita: ' : 'Guardar favorita: ') + track.title} aria-pressed={track.isFavorite} onClick={() => a.toggleTrackFavorite(track.id)}><Heart size={16} fill={track.isFavorite ? 'currentColor' : 'none'}/></button><button className="music-song-more" aria-label={'Opciones de ' + track.title} onClick={() => { setSelected(track); }}><MoreHorizontal size={17}/></button></article>)}</div>{!tracks.length && <div className="music-empty"><Music size={34} strokeWidth={1.1}/><h3>{query || filter !== 'all' || artist ? 'No hay coincidencias.' : 'Un espacio para tu música.'}</h3><p>{query ? 'Prueba otro título o artista.' : 'Importa archivos o guarda canciones desde Descubrir.'}</p></div>}{pageCount>1&&<nav className="music-pagination" aria-label="Páginas de mis canciones"><span>{pageStart+1}–{Math.min(pageStart+pageSize,tracks.length)} de {tracks.length}</span><button aria-label="Página anterior de canciones" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={17}/></button><span>{currentPage} / {pageCount}</span><button aria-label="Página siguiente de canciones" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}><ChevronRight size={17}/></button></nav>}{selected && <MusicTrackDialog key={selected.id} trackId={selected.id} onClose={()=>setSelected(null)}/>}</section>;
}
