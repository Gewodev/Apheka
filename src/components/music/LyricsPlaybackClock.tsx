import {useEffect,useRef} from 'react';
import {globalAudio,useAppSlice} from '../../store/AppContext';
import {generalYtControl} from '../../lib/ytEngine';
import {lyricIndex,type LyricLine} from '../../lib/lyrics';

/** Both lyric views read the same playback clock, including seeks while paused. */
export default function LyricsPlaybackClock({lines,duration,offset,onActive,enabled,youtube,trackId}:{
  lines:LyricLine[];duration:number;offset:number;onActive:(index:number)=>void;
  enabled:boolean;youtube:boolean;trackId:string;
}) {
  const {musicProgress}=useAppSlice(['musicProgress']);
  const progress=useRef(musicProgress);progress.current=musicProgress;
  const updateRef=useRef<()=>void>(()=>{}),previous=useRef(-2);
  useEffect(()=>{
    const update=()=>{
      let seconds:number;
      if(youtube){
        try { const time=generalYtControl.getTime?.();seconds=Number.isFinite(time)?time!:progress.current*duration; }
        catch { seconds=progress.current*duration; }
      } else seconds=globalAudio.currentTime;
      const index=lyricIndex(lines,Math.max(0,Number.isFinite(seconds)?seconds:0)-offset);if(index!==previous.current){previous.current=index;onActive(index);}
    };
    previous.current=-2;updateRef.current=update;update();
    const events=['timeupdate','seeking','seeked','loadedmetadata','play','pause','emptied'] as const;
    if(!youtube)for(const event of events)globalAudio.addEventListener(event,update);
    const timer=enabled?window.setInterval(update,250):undefined;
    return()=>{
      if(timer!==undefined)clearInterval(timer);
      if(!youtube)for(const event of events)globalAudio.removeEventListener(event,update);
      updateRef.current=()=>{};
    };
  },[lines,duration,offset,onActive,enabled,youtube,trackId]);
  useEffect(()=>{updateRef.current();},[musicProgress]);
  return null;
}
