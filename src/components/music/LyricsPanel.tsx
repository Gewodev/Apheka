import LyricsPlaybackClock from './LyricsPlaybackClock';
import {useCoverPalette} from '../../hooks/useCoverPalette';
import React,{memo,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {EyeOff,RefreshCw} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {loadLyrics,type Lyrics} from '../../lib/lyrics';
import './music-services.css';

const LyricLine=memo(function LyricLine({text,isActive,disabled,onSeek}:{text:string;isActive:boolean;disabled:boolean;onSeek:(time:number)=>void}){
  const handle=useCallback(()=>onSeek(0),[onSeek]);
  return (
    <button data-active={isActive} disabled={disabled} onClick={handle} className={isActive?'lyrics-line-active':'lyrics-line'}>
      {text}
    </button>
  );
});

function LyricsPanel({onHide,suspended=false}:{onHide?:()=>void;suspended?:boolean}){
  const a=useAppSlice(['tracks','currentTrackId','musicDuration','youtubeVideoUrl','setMusicProgress','settings','updateSettings','updateTrack','isPlayingMusic']);
  const track=a.tracks.find(t=>t.id===a.currentTrackId),[lyrics,setLyrics]=useState<Lyrics|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[active,setActive]=useState(-1);
  const palette=useCoverPalette(track?.coverImage||track?.coverUrl);
  const [visible,setVisible]=useState(()=>!document.hidden);
  useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  const retryTrack=useRef<string|null>(null);
  const scroller=useRef<HTMLDivElement>(null),online=!a.settings.musicOffline,duration=Math.round(a.musicDuration||track?.duration||0),offset=Math.max(-30,Math.min(30,track?.lyricsOffsetSeconds||0)),size=24,seekDuration=a.musicDuration||duration;
  const lookupIdentity=useRef('');
  useEffect(()=>{
    const identity=JSON.stringify([track?.id,track?.title,track?.artist]);
    const changed=lookupIdentity.current!==identity;
    lookupIdentity.current=identity;
    if(changed){setLyrics(null);setActive(-1);}
    setError('');
    if(!track){setBusy(false);return;}
    const controller=new AbortController();
    setBusy(changed);
    void loadLyrics(track.title,track.artist,duration,online,controller.signal,retryTrack.current===track.id).then(value=>{
      if(!controller.signal.aborted)setLyrics(value);
    }).catch(e=>{
      if(!controller.signal.aborted)setError('No se pudo consultar la letra. Vuelve a intentarlo cuando tengas conexión.');
    }).finally(()=>{
      if(!controller.signal.aborted)setBusy(false);
    });
    retryTrack.current=null;
    return()=>controller.abort();
  },[track?.id,track?.title,track?.artist,duration,online,retry]);

  const recenter=useCallback((smooth=false)=>{
    const el=scroller.current;if(!el)return;
    el.style.setProperty('--lyrics-edge-space',Math.ceil(el.clientHeight/2)+'px');
    const line=el.querySelector<HTMLElement>('[data-active=true]')||el.querySelector<HTMLElement>('button');
    if(!line)return;
    const box=el.getBoundingClientRect(),verse=line.getBoundingClientRect();
    const top=Math.max(0,el.scrollTop+verse.top-box.top-(el.clientHeight-verse.height)/2);
    el.scrollTo({top,behavior:smooth&&!window.matchMedia('(prefers-reduced-motion:reduce)').matches?'smooth':'instant'});
  },[]);
  const resumeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const resumeFollowing=useCallback(()=>{clearTimeout(resumeTimer.current);resumeTimer.current=setTimeout(()=>recenter(true),900);},[recenter]);
  useLayoutEffect(()=>{
    const el=scroller.current;if(!el)return;let live=true,frame=0;
    const align=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(live)recenter();});};
    recenter();const observer=new ResizeObserver(align);observer.observe(el,{box:'border-box'});
    window.addEventListener('resize',align);document.fonts?.addEventListener('loadingdone',align);
    void document.fonts?.ready.then(()=>{if(live)align();});
    return()=>{live=false;observer.disconnect();window.removeEventListener('resize',align);document.fonts?.removeEventListener('loadingdone',align);cancelAnimationFrame(frame);clearTimeout(resumeTimer.current);};
  },[lyrics,busy,track?.id,recenter]);
  const previousVerse=useRef({track:'',index:-1});
  useLayoutEffect(()=>{
    const previous=previousVerse.current;
    const continuous=previous.track===track?.id&&previous.index>=0&&active===previous.index+1;
    recenter(continuous);
    previousVerse.current={track:track?.id||'',index:active};
  },[active,busy,lyrics,track?.id,recenter]);

  const songTitle=track?.title||'';
  const songArtist=track?.artist||'';

  return (
    <section className="lyrics-pane" data-ambient={!suspended&&visible&&a.isPlayingMusic}
      style={{
        "--lyrics-text-size":size+"px",
        "--lyrics-solid":"oklch(32% .055 "+([...(track?.id||'')].reduce((sum,char)=>(sum*31+char.charCodeAt(0))%360,0))+")",
        "--album-surface":palette?.surfaceColor,
        "--album-accent":palette?.accentColor,
        "--album-secondary":palette?.secondaryColor,
        "--lyrics-wash":'oklch(65% .09 '+([...(track?.id||'')].reduce((sum,char)=>sum+char.charCodeAt(0),0)%360)+')',
        "--text-primary":"#f1f3f1",
        "--text-secondary":"#c2cbcc"
      } as React.CSSProperties}
      aria-label="Letra de la canción"
    >
      {track&&lyrics&&!suspended&&<LyricsPlaybackClock trackId={track.id} youtube={!!a.youtubeVideoUrl} enabled={visible&&a.isPlayingMusic} lines={lyrics.lines} duration={a.musicDuration||duration} offset={offset} onActive={setActive}/>}
      <header><div><h3>Letra</h3></div>{(!lyrics&&!busy)&&<button className="btn-ghost" title="Volver a buscar la letra" aria-label="Volver a buscar la letra" disabled={!track||busy||!online} onClick={()=>{retryTrack.current=track?.id||null;setRetry(v=>v+1);}}><RefreshCw size={15}/></button>}</header>
      {track&&<div className="lyrics-track"><strong>{songTitle}</strong><span>{songArtist}</span></div>}
      {!track?<p className="music-service-message">Elige una canción. Su letra aparecerá aquí si está disponible.</p>:busy?<p className="music-service-message" role="status">Buscando la letra…</p>:error?<p role="alert" className="music-service-message">{error}</p>:lyrics?.instrumental?<div className="lyrics-plain lyrics-placeholder"><p className="lyrics-placeholder-line">(Instrumental)</p><p className="music-service-message">Esta grabación no tiene letra.</p></div>:lyrics?.lines.length?<div ref={scroller} className="lyrics-lines" onWheel={resumeFollowing} onTouchMove={resumeFollowing} onKeyDown={event=>{if(["ArrowDown","ArrowUp","PageDown","PageUp","Home","End"].includes(event.key))resumeFollowing();}} >
        {lyrics.lines.map((line,i)=>{
          const text=(line.text||'').trim()||' ';
          return <LyricLine key={i} text={text} isActive={active===i} disabled={!seekDuration} onSeek={(t)=>a.setMusicProgress(Math.max(0,Math.min(1,(t+offset)/seekDuration)))} />;
        })}
      </div>:lyrics?.plain?<div className="lyrics-plain"><small className="lyrics-no-timing">Esta fuente no incluye tiempos sincronizados.</small>{lyrics.plain.split(/\r?\n/).map((line,index)=><p key={index}>{line||'\u00a0'}</p>)}</div>:<div className="lyrics-plain lyrics-placeholder"><p className="lyrics-placeholder-line">(Música)</p><p className="music-service-message">{online?'No se encontró una letra para esta grabación.':'La letra se buscará automáticamente cuando vuelva la conexión.'}</p></div>}
      {track&&!busy&&(!lyrics||lyrics.instrumental||!!error)&&<div className="lyrics-recovery">{online&&<button type="button" onClick={()=>{retryTrack.current=track.id;setRetry(value=>value+1);}}>Volver a buscar</button>}<button type="button" onClick={()=>{void a.updateTrack(track.id,{lyricsHidden:true},true);onHide?.();}}><EyeOff size={14}/>Ocultar en esta canción</button></div>}
    </section>
  );
}

export default React.memo(LyricsPanel);
