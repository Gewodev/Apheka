import {mediaLink,youtubeLink} from '../../lib/mediaSource';
import {searchMusicCatalog} from '../../lib/youtubeMusic';
import {useEffect,useRef,useState} from 'react';
import {Download,Plus,Search} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {validateUrl,isTauri,type YouTubeMetadata,type YouTubePlaylist} from '../../lib/musicApi';
import toast from 'react-hot-toast';
const isVideoLink=(value:string)=>/^(?:https?:\/\/|(?:www\.|music\.|m\.)?youtube\.com\/|youtu\.be\/)/i.test(value);
const target=(item:YouTubeMetadata)=>item.webpage_url||(/^https?:/.test(item.url||'')?item.url:'')||(/^[A-Za-z0-9_-]{11}$/.test(item.id)?'https://www.youtube.com/watch?v='+item.id:'');
export default function MusicLinkImport(){
 const a=useAppSlice(['addToDownloadQueue','addTrack']),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[items,setItems]=useState<YouTubeMetadata[]>([]),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const reset=()=>{request.current?.abort();setBusy(false);setItems([]);setSelected([]);setError('');};
 const clear=()=>{reset();setQuery('');};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');setItems([]);setSelected([]);
  try{const value=query.trim();let entries:YouTubeMetadata[];
   if(isVideoLink(value)){const link=mediaLink(value);if(!link)throw Error('El enlace no es válido.');if(!isTauri())throw Error('Los enlaces se revisan desde APHEKA de escritorio.');const data=await validateUrl(link.href);entries='entries'in data?(data as YouTubePlaylist).entries:[data as YouTubeMetadata];}
   else{if(value.length<2)throw Error('Escribe al menos dos letras para buscar una canción.');const result=await searchMusicCatalog(value,'song',controller.signal);entries=result.songs.map(song=>({id:song.id,title:song.title,channel:song.artist,duration:song.duration,thumbnail:song.cover,webpage_url:'https://www.youtube.com/watch?v='+song.id})) as YouTubeMetadata[];}
   if(controller.signal.aborted)return;const valid=entries.filter(item=>!!item.id&&!!target(item)).slice(0,200);setItems(valid);setSelected(valid.map(target));if(!valid.length)setError('No se encontraron canciones disponibles para esta búsqueda.');
  }catch(error){if(!controller.signal.aborted)setError(String(error).replace(/^Error: /,''));}finally{if(!controller.signal.aborted)setBusy(false);}
 };
 return <section className="music-link-import" aria-label="Buscar o importar canciones"><form onSubmit={submit}><Search size={18}/><input aria-label="Buscar canción o pegar enlace" placeholder="Canción, artista o enlace de audio o vídeo" value={query} onChange={e=>{reset();setQuery(e.target.value);}} maxLength={2000}/><button type="submit" className="btn-secondary" disabled={busy||!query.trim()}><Search size={16}/>{busy?'Buscando…':isVideoLink(query.trim())?'Revisar enlace':'Buscar'}</button></form>{error&&<p role="alert">{error}</p>}{items.length>0&&<div className="music-link-preview"><div>{items.map(item=><label key={target(item)}><input type="checkbox" checked={selected.includes(target(item))} onChange={e=>setSelected(value=>e.target.checked?[...value,target(item)]:value.filter(v=>v!==target(item)))}/>{item.thumbnail&&<img src={item.thumbnail} alt="" loading="lazy"/>}<span><strong>{item.title}</strong><small>{item.channel}</small></span></label>)}</div><footer><span>{selected.length} seleccionadas</span>{items.every(item=>youtubeLink(target(item)))&&<button className="btn-secondary" disabled={!selected.length} onClick={()=>{for(const item of items.filter(item=>selected.includes(target(item))))a.addTrack({title:item.title,artist:item.channel||'',duration:item.duration||0,source:'youtube',url:target(item),coverUrl:item.thumbnail,isFavorite:false,listenedTime:0,librarySaved:true});clear();toast.success('Añadidas a tu biblioteca');}}><Plus size={15}/>Guardar en biblioteca</button>}<button className="btn-primary" disabled={!selected.length} onClick={()=>{for(const item of items.filter(item=>selected.includes(target(item))))a.addToDownloadQueue({title:item.title,artist:item.channel||'',url:target(item),type:'video',totalItems:1,thumbnail:item.thumbnail,duration:item.duration});clear();toast.success('Añadidas a Descargas');}}><Download size={15}/>Descargar selección</button></footer></div>}</section>;
}
