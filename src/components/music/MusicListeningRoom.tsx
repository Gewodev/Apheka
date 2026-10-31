import {createPortal} from 'react-dom';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import React,{useRef,useState,useEffect} from 'react';
import {Music,Play,Pause,Heart,X,SkipForward,SkipBack,Volume2,VolumeX} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {useCoverPalette} from '../../hooks/useCoverPalette';
import {useMusicTransport} from '../../lib/musicTransport';
import LyricsPanel from './LyricsPanel';
import MusicTimeline from './MusicTimeline';
export default function MusicListeningRoom({onBack}:{onBack:()=>void}){
 const [lyrics,setLyrics]=useState(()=>sessionStorage.getItem('apheka_room_lyrics')==='true');
 useEffect(()=>{const update=()=>setLyrics(sessionStorage.getItem('apheka_room_lyrics')==='true');window.addEventListener('apheka:music-room',update);return()=>window.removeEventListener('apheka:music-room',update);},[]);
 const a=useAppSlice(['tracks','currentTrackId','isPlayingMusic','toggleMusicPlayback','toggleTrackFavorite','musicVolume','setMusicVolume','updateTrack']);
 const track=a.tracks.find(t=>t.id===a.currentTrackId),cover=track?.coverImage||track?.coverUrl,palette=useCoverPalette(cover),transport=useMusicTransport(),frame=useRef(0),dialog=useRef<HTMLElement>(null);
 useEffect(()=>{const root=document.querySelector('.single-environment') as HTMLElement|null;if(root)root.inert=true;return()=>{if(root)root.inert=false;};},[]);
 useDialogFocus(dialog,true,onBack);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 const [visible,setVisible]=useState(()=>!document.hidden);
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 useEffect(()=>{if(track?.lyricsHidden)setLyrics(false);},[track?.id,track?.lyricsHidden]);
 return createPortal(<section ref={dialog} className="music-listening-room quiet-room" role="dialog" aria-modal="true" aria-label="Sala de escucha" data-lyrics={lyrics} data-ambient={!!cover&&visible&&a.isPlayingMusic} style={{'--album-surface':palette?.surfaceColor||'var(--bg-elevated-raw)','--album-secondary':palette?.secondaryColor||palette?.accentColor,'--album-accent':palette?.accentColor||'var(--text-primary)','--room-text':palette?'#edf0f1':'var(--text-primary)','--room-secondary':palette?'#bdc8cd':'var(--text-secondary)'} as React.CSSProperties}>
 <div className="room-color-drift" aria-hidden="true"/><button className="room-close" aria-label="Cerrar sala de escucha" onClick={onBack}><X size={19}/></button>
 <div className="quiet-room-body"><div className="quiet-room-track"><button className="quiet-room-cover" aria-label={lyrics?'Ocultar letra':'Mostrar letra'} aria-pressed={lyrics} onClick={()=>{if(track?.lyricsHidden)void a.updateTrack(track.id,{lyricsHidden:false},true);setLyrics(value=>{sessionStorage.setItem('apheka_room_lyrics',String(!value));return !value;});}}>{cover?<img src={cover} alt={'Portada de '+track?.title}/>:<Music size={64}/>}</button>
 <div className="quiet-room-details"><h2>{track?.title||'Elige una canción'}</h2><p>{track?.artist}</p>{track&&<><MusicTimeline fallbackDuration={track.duration||0}/><div className="listening-controls"><button aria-label="Anterior en sala de escucha" disabled={!transport.hasPrevious} onClick={transport.previous}><SkipBack size={23}/></button><button className="listening-play" aria-label={a.isPlayingMusic?'Pausar en sala de escucha':'Reproducir en sala de escucha'} onClick={a.toggleMusicPlayback}>{a.isPlayingMusic?<Pause size={23}/>:<Play size={23}/>}</button><button aria-label="Siguiente en sala de escucha" disabled={!transport.hasNext} onClick={transport.next}><SkipForward size={23}/></button><button aria-label="Favorita en la sala de escucha" aria-pressed={track.isFavorite} onClick={()=>a.toggleTrackFavorite(track.id)}><Heart size={20} fill={track.isFavorite?'currentColor':'none'}/></button><div className="room-volume"><button aria-label={a.musicVolume?"Silenciar en la sala":"Activar sonido en la sala"} onClick={()=>a.setMusicVolume(a.musicVolume?0:.5)}>{a.musicVolume?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><input aria-label="Volumen en la sala" style={{'--range-fill':a.musicVolume*100+'%'} as React.CSSProperties} type="range" min="0" max="1" step=".01" value={a.musicVolume} onChange={e=>a.setMusicVolume(Number(e.target.value))}/></div></div></>}</div>
 </div>{lyrics&&<div className="quiet-room-lyrics"><LyricsPanel key={track?.id} onHide={()=>setLyrics(false)}/></div>}</div></section>,document.body);
}
