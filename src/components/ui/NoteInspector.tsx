import {useMemo} from 'react';
import {CalendarClock,FileText,Folder,Hash,History,RotateCcw} from 'lucide-react';
import type {Note} from '../../store/AppContext';
type Version={timestamp:string;preview:string;wordCount:number;content?:string};
const date=(value:string)=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Sin fecha':parsed.toLocaleString('es',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
export function NoteMetadata({note,folder}:{note:Note;folder?:string}){
 const text=useMemo(()=>new DOMParser().parseFromString(note.content||'','text/html').body.textContent||'',[note.content]);
 const words=text.trim()?text.trim().split(/\s+/).length:0;
 return <section className="note-metadata" aria-label="Metadatos de la nota">
  <div className="note-metadata-location"><Folder size={18}/><div><small>Ubicación</small><strong>{folder||note.course||'Sin carpeta'}</strong></div></div>
  <dl className="note-metadata-counts"><div><dt><FileText size={15}/>Palabras</dt><dd>{words.toLocaleString('es')}</dd></div><div><dt>Caracteres</dt><dd>{text.length.toLocaleString('es')}</dd></div><div><dt>Páginas estimadas</dt><dd>{Math.max(1,Math.ceil(words/250))}</dd></div><div><dt>Lectura</dt><dd>{Math.max(1,Math.ceil(words/200))}<small> min</small></dd></div></dl>
  <dl className="note-metadata-dates"><div><dt><CalendarClock size={15}/>Creada</dt><dd>{date(note.createdAt)}</dd></div><div><dt>Última edición</dt><dd>{date(note.updatedAt)}</dd></div></dl>
  <div className="note-metadata-tags"><h3><Hash size={15}/>Etiquetas</h3>{note.tags?.length?<div>{note.tags.map(tag=><span key={tag}>{tag}</span>)}</div>:<p>Sin etiquetas.</p>}</div>
 </section>;
}
export function NoteHistory({note,onRestore}:{note:Note;onRestore:(html:string)=>void}){
 const versions=useMemo(()=>{try{const rows=JSON.parse(localStorage.getItem('owa_note_versions_'+note.id)||'[]');return Array.isArray(rows)?rows.filter((v):v is Version=>!!v&&typeof v.timestamp==='string'&&typeof v.preview==='string').slice(0,10):[];}catch{return [];}},[note.id,note.updatedAt,note.content]);
 return <section className="note-history" aria-label="Historial de la nota"><header><History size={17}/><span>{versions.length} versiones guardadas</span></header>{versions.length?<ol>{versions.map((version,index)=><li key={version.timestamp+'-'+index}><div className="note-history-heading"><time>{date(version.timestamp)}</time>{index===0&&<span>Reciente</span>}</div><p>{version.preview||'Sin texto'}</p><footer><small>{Number(version.wordCount)||0} palabras</small>{version.content&&<button type="button" className="btn-secondary" disabled={version.content===note.content} onClick={()=>onRestore(version.content!)}><RotateCcw size={14}/>{version.content===note.content?'Versión actual':'Restaurar'}</button>}</footer></li>)}</ol>:<p className="note-history-empty">Las versiones aparecerán al guardar cambios en la nota.</p>}<div className="note-history-created"><CalendarClock size={15}/><span>Nota creada<time>{date(note.createdAt)}</time></span></div></section>;
}
