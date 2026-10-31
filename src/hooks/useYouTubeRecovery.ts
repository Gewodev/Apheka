import {rememberUnavailableRecording} from '../lib/recordingAvailability';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Track} from '../store/AppContext';
import {extractYouTubeId} from '../lib/ytEngine';
import {recoverYouTubeRecording} from '../lib/youtubePlayback';
type Options={track?:Track;url:string|null;onUrl:(url:string)=>void;onStop:()=>void;onNotice:(text:string)=>void};
export function useYouTubeRecovery(options:Options){
 const current=useRef(options);current.current=options;
 const [generation,setGeneration]=useState(0),failed=useRef(new Set<string>()),retried=useRef(new Set<string>()),job=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{failed.current.clear();retried.current.clear();},[options.track?.id]);
 useEffect(()=>()=>{job.current?.abort();job.current=null;clearTimeout(timer.current);timer.current=undefined;},[options.track?.id,options.url]);
 const onError=useCallback((event:any)=>{
  const config=current.current,id=extractYouTubeId(config.url||''),actual=event.target?.getVideoData?.()?.video_id,code=Number(event.data);
  if(!id||actual&&actual!==id)return;
  if(job.current||timer.current)return;
  const stillCurrent=()=>current.current.url===config.url&&current.current.track?.id===config.track?.id;
  if((code===5||code===153)&&!retried.current.has(id+':'+code)){
   retried.current.add(id+':'+code);
   timer.current=setTimeout(()=>{timer.current=undefined;if(!stillCurrent())return;
    if(code===153){setGeneration(value=>value+1);return;}
    try{event.target.loadVideoById({videoId:id,startSeconds:Math.max(0,event.target.getCurrentTime?.()||0)});}catch{setGeneration(value=>value+1);}
   },500);return;
  }
  const stop=()=>{if(!stillCurrent())return;current.current.onStop();current.current.onNotice(code===153?'YouTube no pudo verificar el reproductor. Vuelve a intentar la canción.':code===100?'Esta grabación ya no está disponible en YouTube.':code===101||code===150?'El propietario de esta grabación no permite reproducirla dentro de aplicaciones.':'No se pudo iniciar esta grabación. Comprueba la conexión y vuelve a intentarlo.');};
  rememberUnavailableRecording(id,code);
  failed.current.add(id);
  if(!config.track||![100,101,150].includes(code)||failed.current.size>=2){stop();return;}
  const controller=new AbortController();job.current=controller;
  void recoverYouTubeRecording(config.track,failed.current,controller.signal).then(url=>{if(controller.signal.aborted||!stillCurrent())return;if(url)current.current.onUrl(url);else stop();}).catch(()=>{if(!controller.signal.aborted)stop();}).finally(()=>{if(job.current===controller)job.current=null;});
 },[]);
 return {onError,generation};
}
