import {useEffect,useRef,useState} from 'react';
import {Download} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {usePanelWidth,PanelResizeHandle} from '../../hooks/usePanelWidth';
import WorkspaceHeader from '../ui/WorkspaceHeader';
import MusicLibrary from '../music/MusicLibrary';
import MusicQueuePanel from '../music/MusicQueuePanel';
import MusicDiscover from '../music/MusicDiscover';
import MusicPlaylists from '../music/MusicPlaylists';
import MusicArtists from '../music/MusicArtists';
import MusicDownloads from '../music/MusicDownloads';
import MusicListeningRoom from '../music/MusicListeningRoom';
import '../music/music-studio.css';
type Area='descubrir'|'biblioteca'|'playlists'|'downloads'|'escuchando'|'artistas'|'favoritas';
const areas:Area[]=['descubrir','biblioteca','playlists','downloads','escuchando','artistas','favoritas'];
export default function Musica({workspaceId='default'}:{workspaceId?:string}){
 const {setNavigateTo}=useAppSlice(['setNavigateTo']);
 const storageKey='apheka_music_studio_'+workspaceId;
 const [area,setArea]=useState<Area>(()=>{try{const value=JSON.parse(sessionStorage.getItem(storageKey)||'null');return areas.includes(value)?value:'biblioteca';}catch{return 'biblioteca';}}),previous=useRef<Area>(area==='escuchando'?'biblioteca':area),resize=usePanelWidth('apheka_music_inspector',340,280,440,'left',380);
 const navigate=(value:Area)=>{if(value!=='escuchando')previous.current=value;setArea(value);sessionStorage.setItem(storageKey,JSON.stringify(value));};
 useEffect(()=>{const open=()=>navigate('escuchando'),network=()=>{localStorage.setItem('owa_settings_category_v1','musica');setNavigateTo('ajustes');window.dispatchEvent(new Event('apheka:open-music-network-settings'));};window.addEventListener('apheka:music-room',open);window.addEventListener('apheka:music-connection',network);return()=>{window.removeEventListener('apheka:music-room',open);window.removeEventListener('apheka:music-connection',network);};},[storageKey]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('apheka:music-room-visible',{detail:area==='escuchando'}));return()=>{window.dispatchEvent(new CustomEvent('apheka:music-room-visible',{detail:false}));};},[area]);
 const contentArea=area==='escuchando'?previous.current:area;
 return <div className="page-container music-studio music-unified" style={{height:'100%',minHeight:0,overflowY:'auto',display:'flex',flexDirection:'column'}}><WorkspaceHeader title="Música"><div className="music-studio-toolbar"><nav aria-label="Apartados de música">{([['descubrir','Descubrir'],['biblioteca','Mis canciones'],['artistas','Artistas'],['playlists','Listas'],['favoritas','Favoritas']] as [Area,string][]).map(([key,label])=><button key={key} aria-current={contentArea===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>)}</nav><div className="music-toolbar-actions"><button aria-label="Descargas de música" title="Descargas" aria-pressed={contentArea==='downloads'} onClick={()=>navigate('downloads')}><Download size={18}/></button></div></div></WorkspaceHeader><div className="music-studio-body" data-inspector={contentArea!=='downloads'}><main className="music-studio-content">{contentArea==='descubrir'?<MusicDiscover/>:contentArea==='artistas'?<MusicArtists/>:contentArea==='playlists'?<MusicPlaylists storageKey={'apheka_playlist_'+workspaceId}/>:contentArea==='downloads'?<MusicDownloads/>:<MusicLibrary key={contentArea==='favoritas'?'favoritas':'biblioteca'} workspaceId={workspaceId} favoritesOnly={contentArea==='favoritas'}/>}</main>{contentArea!=='downloads'&&<aside ref={resize.ref} className="music-studio-inspector" aria-label="Panel de música"><PanelResizeHandle control={resize} label="Ancho del panel musical"/><MusicQueuePanel suspended={area==='escuchando'}/></aside>}</div>{area==='escuchando'&&<MusicListeningRoom onBack={()=>navigate(previous.current==='escuchando'?'biblioteca':previous.current)}/>}</div>;
}
