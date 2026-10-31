import {isLibraryTrack} from '../lib/musicRadio';
import {type CSSProperties, useEffect, useRef, useState} from 'react';
import {Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, ChevronUp, ChevronDown, Music, Shuffle, Repeat2, Headphones} from 'lucide-react';
import {useAppSlice} from '../store/AppContext';
import {useMusicTransport} from '../lib/musicTransport';
import MusicTimeline from './music/MusicTimeline';

export default function GlobalPlayer({sidebarCollapsed: _collapsed}: {sidebarCollapsed: boolean}) {
  const a = useAppSlice(['tracks', 'currentTrackId', 'isPlayingMusic', 'toggleMusicPlayback', 'musicVolume', 'setMusicVolume', 'toggleTrackFavorite', 'shuffleMode', 'setShuffleMode', 'repeatMode', 'setRepeatMode']);
  const transport = useMusicTransport();
  const track = a.tracks.find(t => t.id === a.currentTrackId);
  const [inRoom, setInRoom] = useState(false);
  const [expanded, setExpanded] = useState(() => localStorage.getItem('owa_player_expanded') === '1');
  const previousVolume = useRef(a.musicVolume || .5);
  useEffect(() => {
    const update = (event: Event) => setInRoom(!!(event as CustomEvent).detail);
    window.addEventListener('apheka:music-room-visible', update);
    return () => window.removeEventListener('apheka:music-room-visible', update);
  }, []);
  useEffect(() => { if (a.musicVolume > 0) previousVolume.current = a.musicVolume; }, [a.musicVolume]);
  const toggle = () => setExpanded(value => {
    localStorage.setItem('owa_player_expanded', value ? '0' : '1');
    return !value;
  });
  const openRoom = (lyrics = false) => {
    if (!track) return;
    sessionStorage.setItem('apheka_room_lyrics', String(lyrics));
    window.dispatchEvent(new CustomEvent('apheka:open-music-room', {detail: {lyrics}}));
  };
  const repeatLabel = a.repeatMode === 'one' ? 'Repetir canción' : a.repeatMode === 'all' ? 'Repetir colección' : 'Repetición desactivada';
  const visible = expanded && !inRoom;
  return <>
    {!inRoom && !expanded && <div className="player-reveal-zone"><button className="integrated-player-handle" aria-label={expanded ? 'Contraer reproductor' : 'Desplegar reproductor'} aria-expanded={expanded} aria-controls="apheka-bottom-player" data-open={expanded} data-playing={a.isPlayingMusic} onClick={toggle} title={expanded ? 'Contraer reproductor' : 'Desplegar reproductor'}>
      <span aria-hidden="true"/>{expanded ? <ChevronDown size={20} strokeWidth={1.6}/> : <ChevronUp size={20} strokeWidth={1.6}/>}<span aria-hidden="true"/>
    </button></div>}
    <section id="apheka-bottom-player" className="integrated-player" aria-label="Reproductor musical" aria-hidden={!visible} inert={!visible} data-expanded={visible}>
      <div className="integrated-player-main">
        <div className="integrated-player-identity">
          <button className="integrated-player-cover" aria-label="Abrir canción" title="Abrir portada" disabled={!track} onClick={() => openRoom()}>
            {track?.coverImage || track?.coverUrl ? <img key={track.coverImage || track.coverUrl} src={track.coverImage || track.coverUrl} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <Music size={23}/>}
          </button>
          <div className="integrated-player-caption">
            <button className="integrated-player-name" disabled={!track} title={track ? track.title + ' · ' + track.artist : 'Elige una canción'} onClick={() => openRoom(true)}>
              <strong>{track?.title || 'Tu música'}</strong><span>{track?.artist || 'Elige una canción'}</span>
            </button>
            <button className="integrated-player-like" aria-label="Favorita" title={track?.isFavorite ? 'Quitar de favoritas' : 'Añadir a favoritas'} disabled={!track} aria-pressed={!!track?.isFavorite} onClick={() => track && a.toggleTrackFavorite(track.id)}><Heart size={16} fill={track?.isFavorite ? 'currentColor' : 'none'}/></button>
          </div>
        </div>
        <div className="integrated-player-center">
          <div className="integrated-player-transport">
            <button aria-label="Reproducción aleatoria" title="Reproducción aleatoria" disabled={!track} aria-pressed={a.shuffleMode} onClick={() => a.setShuffleMode(!a.shuffleMode)}><Shuffle size={17}/></button>
            <button aria-label="Canción anterior" title="Canción anterior" disabled={!transport.hasPrevious} onClick={transport.previous}><SkipBack size={19}/></button>
            <button className="integrated-play" aria-label={a.isPlayingMusic ? 'Pausar música' : 'Reproducir música'} title={a.isPlayingMusic ? 'Pausar' : 'Reproducir'} disabled={!track&&!a.tracks.some(isLibraryTrack)} onClick={a.toggleMusicPlayback}>{a.isPlayingMusic ? <Pause size={21} fill="currentColor"/> : <Play size={21} fill="currentColor"/>}</button>
            <button aria-label="Siguiente canción" title="Siguiente canción" disabled={!transport.hasNext} onClick={transport.next}><SkipForward size={19}/></button>
            <button aria-label="Repetición" aria-description={repeatLabel} data-repeat={a.repeatMode} title={repeatLabel} disabled={!track} aria-pressed={a.repeatMode !== 'none'} onClick={() => a.setRepeatMode(a.repeatMode === 'none' ? 'all' : a.repeatMode === 'all' ? 'one' : 'none')}><Repeat2 size={17}/>{a.repeatMode === 'one' && <small>1</small>}</button>
          </div>
          <div className="integrated-player-seek"><MusicTimeline fallbackDuration={track?.duration || 0}/></div>
        </div>
        <div className="integrated-player-actions">
          <div className="integrated-player-volume">
            <button aria-label={a.musicVolume ? 'Silenciar música' : 'Activar sonido'} title={a.musicVolume ? 'Silenciar' : 'Activar sonido'} onClick={() => a.setMusicVolume(a.musicVolume ? 0 : previousVolume.current)}>{a.musicVolume ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
            <input aria-label="Volumen musical" style={{'--range-fill': a.musicVolume * 100 + '%'} as CSSProperties} type="range" min="0" max="1" step=".01" value={a.musicVolume} onChange={e => a.setMusicVolume(Number(e.target.value))}/>
          </div>
          <button aria-label="Abrir sala de escucha" title="Abrir sala de escucha" disabled={!track} onClick={() => openRoom()}><Headphones size={18}/></button>
          <button className="integrated-player-collapse" aria-label="Contraer reproductor" title="Ocultar reproductor" aria-controls="apheka-bottom-player" onClick={toggle}><ChevronDown size={16} strokeWidth={1.6}/></button>
        </div>
      </div>
    </section>
  </>;
}
