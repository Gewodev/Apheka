import {rememberUnavailableRecording} from '../lib/recordingAvailability';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Track} from '../store/AppContext';
import {extractYouTubeId} from '../lib/ytEngine';
import {recoverYouTubeRecording} from '../lib/youtubePlayback';
type Options={track?:Track;getTrack?:()=>Track|undefined;url:string|null;onUrl:(url:string)=>void;onStop:()=>void;onNotice:(text:string)=>void;onFallback?:()=>boolean};
export function useYouTubeRecovery(options:Options){
 const current=useRef(options);current.current=options;const trackId=options.getTrack?.()?.id ?? options.track?.id;
 const [generation,setGeneration]=useState(0),failed=useRef(new Set<string>()),retried=useRef(new Set<string>()),job=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{failed.current.clear();retried.current.clear();},[trackId]);
 useEffect(()=>()=>{job.current?.abort();job.current=null;clearTimeout(timer.current);timer.current=undefined;},[trackId,options.url]);
 const onError=useCallback((event:any)=>{
  const config=current.current,id=extractYouTubeId(config.url||''),actual=event.target?.getVideoData?.()?.video_id,code=Number(event.data);
  if(!id||actual&&actual!==id)return;
  if(job.current||timer.current)return;
  const liveId=(config.getTrack?.()?.id ?? config.track?.id);
  const stillCurrent=()=>current.current.url===config.url&&(current.current.getTrack?.()?.id ?? current.current.track?.id)===liveId;
  if((code===5||code===153)&&!retried.current.has(id+':'+code)){
   retried.current.add(id+':'+code);
   timer.current=setTimeout(()=>{timer.current=undefined;if(!stillCurrent())return;
    if(code===153){setGeneration(value=>value+1);return;}
    try{event.target.loadVideoById({videoId:id,startSeconds:Math.max(0,event.target.getCurrentTime?.()||0)});}catch{setGeneration(value=>value+1);}
   },500);return;
  }
  // Si el motor puede seguir con otra cancion, se hace sin avisar: el aviso
  // solo aparece cuando no queda nada que reproducir.
  const stop=(message?:string)=>{
   if(!stillCurrent())return;
   const handled=current.current.onFallback?.()===true;
   current.current.onStop();
   if(handled||!message)return;
   current.current.onNotice(message);
  };
  rememberUnavailableRecording(id,code);
  failed.current.add(id);
  const message=code===153?'YouTube no pudo verificar el reproductor. Vuelve a intentar la canción.':code===100?'Esta grabación ya no está disponible en YouTube.':code===101||code===150?'El propietario de esta grabación no permite reproducirla dentro de aplicaciones.':'No se pudo iniciar esta grabación. Comprueba la conexión y vuelve a intentarlo.';
  const liveTrack=config.getTrack?.()??config.track;
  if(!liveTrack||![100,101,150].includes(code)||failed.current.size>=2){stop(message);return;}
  const controller=new AbortController();job.current=controller;
  void recoverYouTubeRecording(liveTrack,failed.current,controller.signal).then(url=>{if(controller.signal.aborted||!stillCurrent())return;if(url)current.current.onUrl(url);else stop(message);}).catch(()=>{if(!controller.signal.aborted)stop(message);}).finally(()=>{if(job.current===controller)job.current=null;});
 },[]);
 return {onError,generation};
}
