import React,{useEffect,useState} from 'react';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {Download,Loader2,Check,TriangleAlert} from 'lucide-react';

type AsrStatus={ready:boolean;root:string;missing:string[];bytes:number};
const human=(bytes:number)=>bytes>=1024*1024?(bytes/1024/1024).toFixed(0)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';

export default function LocalDictationCard(){
  const [status,setStatus]=useState<AsrStatus|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[done,setDone]=useState(false);
  const read=async()=>{try{const value=await invoke<AsrStatus>('asr_status');setStatus(value);}catch{setStatus(null);}};
  useEffect(()=>{if(!isTauri())return;void read();
    let stop:(()=>void)|undefined;
    void import('@tauri-apps/api/event').then(({listen})=>listen<{done:number;total:number}>('asr-prepare-progress',({payload})=>{if(payload&&payload.total)setProgress(Math.round(payload.done/payload.total*100));})).then(unlisten=>{stop=unlisten;}).catch(()=>{});
    return()=>{stop?.();};
  },[]);
  const prepare=async()=>{if(busy)return;setBusy(true);setError('');setDone(false);setProgress(0);
    try{await invoke<AsrStatus>('asr_prepare');await read();setDone(true);}
    catch(cause){setError(String(cause).replace(/^Error:\s*/,''));}
    finally{setBusy(false);}};
  if(!isTauri())return null;
  const ready=status?.ready===true;
  return <section className="bento-card mcp-settings" aria-labelledby="local-dictation-heading">
    <div className="mcp-card-heading"><span className="mcp-mark">{ready?<Check size={19}/>:<Download size={19}/>}</span><div><h3 id="local-dictation-heading">Dictado local en español</h3><p>Reconocimiento de voz dentro del equipo, sin enviar audio a ningún servidor.</p></div></div>
    <p className="mcp-description">El motor de voz se prepara una sola vez y se conserva en tu carpeta de datos. No se descarga al abrir APHEKA ni pesa en el instalador; el audio se decodifica con ffmpeg, que ya viene incluido.</p>
    {ready&&<p className="mcp-feedback is-success">Dictado local preparado. Se usa de forma automática al transcribir.</p>}
    {!ready&&status&&<p className="mcp-muted">Faltan {status.missing.length} archivos del motor de voz ({human(status.bytes)}). Al prepararlos se descargan una vez y se verifican con su huella.</p>}
    {!status&&!busy&&<p className="mcp-muted">No se pudo consultar el estado del dictado local.</p>}
    {busy&&<p role="status" className="mcp-feedback">Preparando el motor de voz… {progress>0?progress+'%':''}</p>}
    <div className="mcp-actions"><button className="btn-secondary" disabled={busy||ready} onClick={()=>void prepare()}>{busy?<Loader2 size={16} className="spin"/>:<Download size={16}/>}{busy?'Preparando…':ready?'Ya preparado':'Preparar dictado local'}</button></div>
    {done&&<p role="status" className="mcp-feedback is-success">Listo. El dictado local ya está disponible.</p>}
    {error&&<p role="alert" className="mcp-feedback"><TriangleAlert size={14}/> {error}</p>}
  </section>;
}
