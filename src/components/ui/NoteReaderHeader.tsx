import React,{useEffect,useRef,useState} from 'react';
import {Edit3,Folder,Maximize2,Minimize2,Minus,MoreHorizontal,PictureInPicture2,Pin,Trash2,X} from 'lucide-react';
type Props={title:string;folder?:string;pinned?:boolean;expanded?:boolean;floating?:boolean;onClose:()=>void;onEdit:()=>void;onExpand:()=>void;onFloat?:()=>void;onMinimize?:()=>void;onPin?:()=>void;onMove?:()=>void;onDelete?:()=>void};
export default function NoteReaderHeader(p:Props){
 const [menu,setMenu]=useState(false),root=useRef<HTMLElement>(null);
 useEffect(()=>{if(!menu)return;const close=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setMenu(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[menu]);
 return <header ref={root} className="note-reader-header" onKeyDown={event=>{if(event.key==='Escape'&&menu){event.stopPropagation();setMenu(false);root.current?.querySelector<HTMLButtonElement>('[aria-label="Más acciones de nota"]')?.focus();}}}>
  <div className="note-reader-location"><span><Folder size={14}/>{p.folder||'Sin carpeta'}</span><div className="note-reader-controls">
   <button type="button" className="btn-primary note-reader-edit" title="Editar" aria-label="Editar nota" onClick={p.onEdit}><Edit3 size={15}/><span>Editar</span></button>
   {p.onMinimize&&<button type="button" aria-label="Minimizar nota flotante" title="Minimizar" onClick={p.onMinimize}><Minus size={16}/></button>}
   <button type="button" aria-label="Más acciones de nota" title="Más acciones" aria-expanded={menu} onClick={()=>setMenu(value=>!value)}><MoreHorizontal size={17}/></button>
   <button type="button" aria-label={p.floating?'Cerrar nota flotante':'Cerrar vista previa de nota'} title="Cerrar" onClick={p.onClose}><X size={17}/></button>
  </div></div>
  <div className="note-reader-heading"><h2 title={p.title}>{p.title||'Nota sin título'}</h2></div>
  {menu&&<div className="note-reader-actions" role="menu" aria-label="Acciones de la nota">
   {p.onFloat&&<button type="button" role="menuitem" onClick={()=>{setMenu(false);p.onFloat?.();}}><PictureInPicture2 size={16}/>Abrir lectura flotante</button>}
   <button type="button" role="menuitem" onClick={()=>{setMenu(false);p.onExpand();}}>{p.expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}{p.expanded?'Restaurar ancho':'Ampliar lectura'}</button>
   {p.onPin&&<button type="button" role="menuitem" onClick={()=>{setMenu(false);p.onPin?.();}}><Pin size={16}/>{p.pinned?'Desfijar nota':'Fijar nota'}</button>}
   {p.onMove&&<button type="button" role="menuitem" onClick={()=>{setMenu(false);p.onMove?.();}}><Folder size={16}/>Mover a carpeta</button>}
   {p.onDelete&&<button type="button" role="menuitem" className="note-reader-delete" onClick={()=>{setMenu(false);p.onDelete?.();}}><Trash2 size={16}/>Eliminar nota</button>}
  </div>}
 </header>;
}
