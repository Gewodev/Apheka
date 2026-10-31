import React,{useEffect,useRef,useState} from 'react';
import {ImagePlus,Loader2,Move,X} from 'lucide-react';

export default function BannerField({value,onChange,onEdit}:{value?:string;onChange:(value?:string)=>void;onEdit:(value:string)=>void}) {
 const input=useRef<HTMLInputElement>(null),revision=useRef(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{revision.current++;},[]);
 const load=async(file?:File)=>{
  if(!file)return;
  const version=++revision.current;setError('');
  if(!/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(file.type)||file.size>20*1024*1024){setError('Elige una imagen PNG, JPG o WebP de hasta 20 MB.');return;}
  setLoading(true);
  let url='';
  try{
   url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   const scale=Math.min(1,1920/image.naturalWidth,1080/image.naturalHeight);
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext('2d');if(!context)throw new Error();
   context.drawImage(image,0,0,canvas.width,canvas.height);
   if(revision.current===version)onChange(canvas.toDataURL('image/webp',.9));
  }catch{if(revision.current===version)setError('No se pudo cargar esta imagen. Prueba con otro archivo.');}
  finally{if(url)URL.revokeObjectURL(url);if(revision.current===version)setLoading(false);}
 };
 return <section className="course-banner-field" aria-label="Banner del curso">
  <div className="course-banner-label"><label>Banner</label><span>Opcional</span></div>
  <button type="button" className={`course-banner-preview ${value?'has-image':''}`} onClick={()=>input.current?.click()} disabled={loading} aria-label={value?'Cambiar banner del curso':'Subir banner del curso'}>
   {value?<img src={value} alt="Banner del curso"/>:<><ImagePlus size={26}/><strong>Una imagen para tu curso</strong><span>Elige un archivo y se aplicará directamente</span></>}
   {loading&&<span className="banner-loading"><Loader2 size={22} className="animate-spin"/>Cargando imagen</span>}
  </button>
  <div className="course-banner-actions"><button type="button" onClick={()=>input.current?.click()} disabled={loading}><ImagePlus size={15}/>{value?'Cambiar imagen':'Elegir imagen'}</button>{value&&<><button type="button" onClick={()=>onEdit(value)}><Move size={15}/>Ajustar encuadre</button><button type="button" aria-label="Quitar banner del curso" onClick={()=>onChange(undefined)}><X size={15}/></button></>}</div>
  <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" aria-label="Archivo de banner del curso" onChange={e=>{void load(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/>
  {error&&<p className="field-error" role="alert">{error}</p>}
 </section>;
}
