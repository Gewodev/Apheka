import {useEffect,useRef,useState} from 'react';
import {charvisConfig,type CharvisRequest} from '../lib/charvis';
/** Merge one-second audio overlap without repeating words in the draft. */
export function mergeVoiceText(previous:string,next:string){
 const clean=next.trim();if(!clean)return previous;const a=previous.trim().split(/\s+/),b=clean.split(/\s+/),normalize=(v:string)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();let overlap=0;
 for(let size=Math.min(24,a.length,b.length);size>0;size--)if(a.slice(-size).map(normalize).join(' ')===b.slice(0,size).map(normalize).join(' ')){overlap=size;break;}
 const addition=b.slice(overlap).join(' ');return previous+(previous.trim()&&addition?' ':'')+addition;
}
export function useCharvisVoice(request:CharvisRequest,onSegment:(text:string)=>void){
 const [recording,setRecording]=useState(false),[paused,setPaused]=useState(false),[transcribing,setTranscribing]=useState(false),[error,setError]=useState(''),[needsRetry,setNeedsRetry]=useState(false);
 const callback=useRef(onSegment);callback.current=onSegment;
 const level=useRef(0),mounted=useRef(true),starting=useRef(false),active=useRef(false),recorder=useRef<MediaRecorder|null>(null),media=useRef<MediaStream|null>(null),context=useRef<AudioContext|null>(null),meter=useRef<ReturnType<typeof setInterval>|undefined>(undefined),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),job=useRef<AbortController|null>(null),pending=useRef<Blob|null>(null),generation=useRef(0);
 const release=()=>{clearInterval(meter.current);clearTimeout(timer.current);level.current=0;media.current?.getTracks().forEach(track=>track.stop());media.current=null;void context.current?.close().catch(()=>{});context.current=null;};
 const process=async()=>{if(!pending.current||job.current)return;const blob=pending.current,token=generation.current,controller=new AbortController();job.current=controller;setTranscribing(true);setNeedsRetry(false);setError('');try{const response=await request(charvisConfig.getSnapshot().voiceProvider,'transcribe',{prompt:'Transcribe fielmente en español. Conserva nombres propios, números y unidades; no añadas contenido ausente.'},controller.signal,new Uint8Array(await blob.arrayBuffer()),blob.type);if(token!==generation.current||controller.signal.aborted)return;if(typeof response.text!=='string'||!response.text.trim())throw Error('No se reconoció voz en la grabación.');callback.current(response.text.trim());pending.current=null;}catch(cause){if(!controller.signal.aborted&&mounted.current){setNeedsRetry(true);setError((cause instanceof Error?cause.message:'No se pudo transcribir.')+' El audio se conserva para reintentar.');}}finally{if(job.current===controller)job.current=null;if(mounted.current)setTranscribing(false);}};
 const stop=()=>{active.current=false;const rec=recorder.current;if(rec&&rec.state!=='inactive')rec.stop();release();if(mounted.current){setRecording(false);setPaused(false);}};
 const cancel=()=>{generation.current++;pending.current=null;job.current?.abort();job.current=null;stop();if(mounted.current){setNeedsRetry(false);setTranscribing(false);setError('');}};
 const pause=()=>{const rec=recorder.current;if(rec?.state==='recording'){rec.pause();level.current=0;setPaused(true);}};
 const resume=()=>{const rec=recorder.current;if(rec?.state==='paused'){rec.resume();setPaused(false);}};
 const start=async(source:'microphone'|'system')=>{
  if(active.current||starting.current||job.current)return;if(pending.current){setError('Reintenta o cancela la grabación pendiente antes de iniciar otra.');return;}starting.current=true;const token=++generation.current;setError('');
  try{await charvisConfig.ready();if(!navigator.mediaDevices||typeof MediaRecorder==='undefined')throw Error('La captura de audio no está disponible aquí. Adjunta un archivo de audio.');
   if(token!==generation.current||!mounted.current)return;const stream=source==='microphone'?await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}):await navigator.mediaDevices.getDisplayMedia({audio:true,video:true});if(token!==generation.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());return;}if(!stream.getAudioTracks().length){stream.getTracks().forEach(t=>t.stop());throw Error('Selecciona una pantalla o pestaña y comparte su audio.');}media.current=stream;
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type)),rec=new MediaRecorder(new MediaStream(stream.getAudioTracks()),mime?{mimeType:mime}:undefined),chunks:BlobPart[]=[];let bytes=0;recorder.current=rec;active.current=true;
   rec.ondataavailable=event=>{if(token!==generation.current)return;if(event.data.size){bytes+=event.data.size;if(bytes>18*1024*1024){setError('La grabación alcanzó el límite de tamaño.');stop();return;}chunks.push(event.data);}};
   rec.onstop=()=>{if(token!==generation.current)return;const blob=new Blob(chunks,{type:rec.mimeType});if(blob.size){pending.current=blob;void process();}else setError('La grabación no contiene audio.');};rec.onerror=()=>{setError('La captura se interrumpió.');stop();};
   try{const ctx=new AudioContext(),analyser=ctx.createAnalyser();context.current=ctx;analyser.fftSize=256;ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);const values=new Uint8Array(analyser.fftSize);meter.current=setInterval(()=>{if(document.hidden||rec.state!=='recording'){level.current=0;return;}analyser.getByteTimeDomainData(values);let sum=0;for(const n of values)sum+=((n-128)/128)**2;level.current=Math.min(1,Math.sqrt(sum/values.length)*4);},100);}catch{/* Audio capture remains functional when a level meter is unavailable. */}
   rec.start(1000);setRecording(true);setPaused(false);stream.getAudioTracks().forEach(track=>track.addEventListener('ended',stop,{once:true}));timer.current=setTimeout(stop,180000);
  }catch(cause){release();setError(cause instanceof Error?cause.message:'No se pudo abrir el micrófono.');}finally{starting.current=false;}
 };
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel();};},[]);
 return {level,recording,paused,transcribing,error,needsRetry,retry:()=>void process(),start,pause,resume,stop,cancel,clearError:()=>setError('')};
}
