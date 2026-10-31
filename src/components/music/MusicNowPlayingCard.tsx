import {useCoverPalette} from '../../hooks/useCoverPalette';
import type {CSSProperties} from 'react';
import {isLibraryTrack} from '../../lib/musicRadio';
import {Play,Pause,SkipBack,SkipForward,Music} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {useMusicTransport} from '../../lib/musicTransport';
import MusicTimeline from './MusicTimeline';
export default function MusicNowPlayingCard(){
 const a=useAppSlice(['tracks','currentTrackId','isPlayingMusic','toggleMusicPlayback','playTrack']),transport=useMusicTransport(),track=a.tracks.find(t=>t.id===a.currentTrackId),cover=track?.coverImage||track?.coverUrl,palette=useCoverPalette(cover);
 return <section style={{'--widget-surface':palette?.surfaceColor,'--widget-accent':palette?.accentColor} as CSSProperties} className="music-current-widget" data-empty={!track} aria-label="Canción en reproducción"><div><button aria-label="Ampliar canción del panel" disabled={!track} onClick={()=>{sessionStorage.setItem('apheka_room_lyrics','false');window.dispatchEvent(new CustomEvent('apheka:open-music-room',{detail:{lyrics:false}}));}}>{cover?<img src={cover} alt=""/>:<Music size={26}/>}</button><div><strong>{track?.title||'Tu próxima canción'}</strong><span>{track?.artist||'Elige música para acompañarte'}</span></div></div><MusicTimeline fallbackDuration={track?.duration||0}/><div className="music-widget-transport"><button aria-label="Anterior en el panel" disabled={!transport.hasPrevious} onClick={transport.previous}><SkipBack size={17}/></button><button aria-label={a.isPlayingMusic?'Pausar en el panel':'Reanudar en el panel'} disabled={!track&&!a.tracks.some(isLibraryTrack)} onClick={()=>{if(track)a.toggleMusicPlayback();else{const first=a.tracks.find(isLibraryTrack);if(first)a.playTrack(first.id);}}}>{a.isPlayingMusic?<Pause size={19}/>:<Play size={19}/>}</button><button aria-label="Siguiente en el panel" disabled={!transport.hasNext} onClick={transport.next}><SkipForward size={17}/></button></div></section>;
}
