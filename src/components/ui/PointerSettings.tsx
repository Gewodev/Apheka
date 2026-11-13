import React,{useEffect,useState} from 'react';
import {MousePointer2} from 'lucide-react';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {compatiblePointerEnabled,POINTER_PREFERENCE,POINTER_PREFERENCE_EVENT} from '../../lib/compatiblePointer';

type Mode='standard'|'compatible'|'software';
type Graphics={active:Mode;selected:Mode;restartRequired:boolean};
export default function PointerSettings(){
  const [enabled,setEnabled]=useState(compatiblePointerEnabled),[error,setError]=useState(''),[graphics,setGraphics]=useState<Graphics|null>(null),[busy,setBusy]=useState(false);
  const supported=isTauri()&&/Windows/i.test(navigator.userAgent);
  useEffect(()=>{if(!supported)return;let active=true;invoke<Graphics>('graphics_status').then(value=>{if(active)setGraphics(value);}).catch(()=>{if(active)setError('No se pudo consultar el modo gráfico. Vuelve a abrir este apartado.');});return()=>{active=false;};},[supported]);
  return <section className="bento-card mcp-settings" aria-labelledby="pointer-settings-heading">
    <div className="mcp-card-heading"><span className="mcp-mark"><MousePointer2 size={19}/></span><div><h3 id="pointer-settings-heading">Rendimiento y pantalla completa</h3><p>Cursor visible en pantalla completa y composición de la ventana.</p></div></div>
    <label className="mcp-prompt-label">Modo gráfico<select aria-label="Modo gráfico" disabled={!supported||!graphics||busy} value={graphics?.selected||'compatible'} onChange={e=>{const mode=e.target.value as Mode;setBusy(true);setError('');void invoke<Graphics>('graphics_set_mode',{mode}).then(setGraphics).catch(()=>setError('No se pudo guardar el modo gráfico.')).finally(()=>setBusy(false));}}><option value="compatible">Compatibilidad con el cursor (recomendada)</option><option value="standard">Composición del sistema</option><option value="software">Diagnóstico sin aceleración gráfica</option></select></label>
    <p className="mcp-muted">La compatibilidad con el cursor es el modo por defecto: mantiene la aceleración por GPU y evita que el puntero dibujado se congele en pantalla completa mientras se mueve. Si prefieres la composición del sistema, puedes cambiarla aquí. El diagnóstico sin GPU puede aumentar el trabajo del procesador.</p>
    {graphics?.restartRequired&&<p role="status" className="mcp-feedback">Modo guardado. Cierra APHEKA y vuelve a abrirla para aplicarlo.</p>}
    <details className="mcp-details"><summary>Cursor alternativo, solo si lo necesitas</summary><label className="mcp-permission" style={{marginTop:16}}><input type="checkbox" checked={enabled} disabled={!supported} onChange={e=>{
      try{localStorage.setItem(POINTER_PREFERENCE,e.target.checked?'on':'off');setEnabled(e.target.checked);setError('');window.dispatchEvent(new Event(POINTER_PREFERENCE_EVENT));}catch{setError('No se pudo guardar la preferencia.');}
    }}/><span><strong>Dibujar un cursor en la interfaz</strong><small>Alternativa manual, desactivada por defecto. El modo normal usa exclusivamente el cursor de Windows, sin dibujar otro cursor al escribir ni al pulsar controles.</small></span></label></details>
    {error&&<p role="alert" className="mcp-feedback">{error}</p>}
  </section>;
}
