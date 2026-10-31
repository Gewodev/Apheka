import React,{useEffect,useRef,useState} from 'react';
import {Check,Minus,Plus,RotateCcw,X} from 'lucide-react';
import {bannerFrame,BANNER_ASPECT,normalizeBannerCrop,type BannerCrop} from '../../lib/bannerCrop';
import {useDialogFocus} from '../../hooks/useDialogFocus';

export default function ImageEditorModal({src,title='Editar imagen',initialCrop,onConfirm,onCancel}:{src:string;title?:string;initialCrop?:BannerCrop;onConfirm:(dataUrl:string,crop:BannerCrop)=>void;onCancel:()=>void}){
 const [crop,setCrop]=useState(()=>normalizeBannerCrop(initialCrop)),[size,setSize]=useState({width:0,height:0}),[width,setWidth]=useState(560),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const stage=useRef<HTMLDivElement>(null),image=useRef<HTMLImageElement|null>(null),drag=useRef<{id:number;clientX:number;clientY:number;x:number;y:number}|null>(null);
 const dialog=useRef<HTMLElement>(null);useDialogFocus(dialog,true,()=>{if(!busy)onCancel();});
 useEffect(()=>{let active=true;setSize({width:0,height:0});setError('');setBusy(false);setCrop(normalizeBannerCrop(initialCrop));const img=new Image();if(/^https?:/i.test(src))img.crossOrigin='anonymous';img.onload=()=>{if(active){image.current=img;setSize({width:img.naturalWidth,height:img.naturalHeight});}};img.onerror=()=>{if(active)setError('No se pudo cargar la imagen. Puedes cancelar y conservar el banner actual.');};img.src=src;return()=>{active=false;image.current=null;};},[src,initialCrop?.zoom,initialCrop?.x,initialCrop?.y]);
 useEffect(()=>{const element=stage.current;if(!element)return;const measure=()=>setWidth(element.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
 const height=width/BANNER_ASPECT,frame=size.width?bannerFrame(width,height,size.width,size.height,crop):null;
 const zoom=(value:number)=>setCrop(previous=>normalizeBannerCrop({...previous,zoom:value}));
 const apply=()=>{if(!image.current||!size.width||busy)return;setBusy(true);setError('');try{const canvas=document.createElement('canvas');canvas.width=1120;canvas.height=490;const context=canvas.getContext('2d');if(!context)throw Error();const frame=bannerFrame(canvas.width,canvas.height,size.width,size.height,crop);context.drawImage(image.current,frame.left,frame.top,frame.width,frame.height);onConfirm(canvas.toDataURL('image/webp',.92),normalizeBannerCrop(crop));}catch{setError('No se pudo aplicar el encuadre. El banner anterior permanece intacto.');setBusy(false);}};
 return <div className="banner-editor-backdrop desktop-edit-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}><section ref={dialog} className="banner-editor-dialog workspace-dialog image-editor-dialog" role="dialog" aria-label={title} aria-modal="true" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();if(!busy)onCancel();}}}>
  <header><h3>{title}</h3><button type="button" aria-label="Cerrar editor de banner" disabled={busy} onClick={onCancel}><X size={18}/></button></header>
  <div ref={stage} className="banner-editor-stage" aria-label="Encuadre del banner" style={{aspectRatio:BANNER_ASPECT}} tabIndex={0}
   onKeyDown={event=>{if(!frame||!event.key.startsWith('Arrow'))return;event.preventDefault();const delta=event.shiftKey ? .1 : .025;setCrop(previous=>normalizeBannerCrop({...previous,x:previous.x+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0),y:previous.y+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)}));}}
   onPointerDown={event=>{if(!frame||busy)return;drag.current={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:crop.x,y:crop.y};event.currentTarget.setPointerCapture(event.pointerId);}}
   onPointerMove={event=>{const start=drag.current;if(!start||!frame||event.pointerId!==start.id)return;setCrop(previous=>normalizeBannerCrop({...previous,x:frame.limitX?start.x+(event.clientX-start.clientX)/frame.limitX:0,y:frame.limitY?start.y+(event.clientY-start.clientY)/frame.limitY:0}));}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onDoubleClick={()=>setCrop(previous=>({...previous,x:0,y:0}))}>
   {frame&&<img src={src} alt="Vista previa del encuadre" draggable={false} style={{width:frame.width,height:frame.height,left:frame.left,top:frame.top}}/>}
   {!frame&&!error&&<span>Cargando imagen…</span>}
  </div>
  <div className="banner-editor-tools"><button type="button" aria-label="Alejar banner" disabled={crop.zoom<=1||busy} onClick={()=>zoom(crop.zoom-.1)}><Minus size={16}/></button><input type="range" aria-label="Ampliación del banner" min="1" max="3" step=".01" value={crop.zoom} disabled={!frame||busy} onChange={event=>zoom(Number(event.target.value))}/><button type="button" aria-label="Acercar banner" disabled={crop.zoom>=3||busy} onClick={()=>zoom(crop.zoom+.1)}><Plus size={16}/></button><button type="button" aria-label="Restablecer encuadre" disabled={busy} onClick={()=>setCrop(normalizeBannerCrop())}><RotateCcw size={16}/></button></div>
  <p className="banner-editor-hint">Arrastra para ajustar la posición. La imagen original se conserva.</p>{error&&<p role="alert" className="field-error">{error}</p>}
  <footer><button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="btn-primary" disabled={!frame||busy} onClick={apply}>{busy?'Procesando…':<><Check size={15}/>Aplicar imagen</>}</button></footer>
 </section></div>;
}
