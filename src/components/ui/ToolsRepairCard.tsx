import React,{useState} from 'react';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {Wrench,RefreshCw} from 'lucide-react';
export default function ToolsRepairCard(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  return <section className="bento-card mcp-settings" aria-labelledby="download-tools-heading">
    <div className="mcp-card-heading"><span className="mcp-mark"><Wrench size={19}/></span><div><h3 id="download-tools-heading">Herramientas de descarga</h3><p>Incluidas una sola vez con la aplicación.</p></div></div>
    <p className="mcp-description">La reproducción de archivos locales no ejecuta ffmpeg ni yt-dlp. Estas herramientas se utilizan para descargar y convertir. No se vuelven a instalar ni se descargan al abrir APHEKA.</p>
    <div className="mcp-actions"><button disabled={busy||!isTauri()} onClick={()=>{if(busy)return;setBusy(true);setMessage('');setError('');void invoke<string>('download_yt_dlp').then(setMessage).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}><RefreshCw size={16}/>{busy?'Comprobando…':'Comprobar descargador'}</button></div>
    <p className="mcp-muted">Úsalo solo si falla una descarga. Si el descargador ya funciona, se conserva; si falta o está dañado, se recupera una única copia.</p>
    {message&&<p role="status" className="mcp-feedback is-success">{message}</p>}{error&&<p role="alert" className="mcp-feedback">{error}</p>}
  </section>;
}
