import {musicConnection} from '../../lib/musicNetwork';
import {invoke} from '@tauri-apps/api/core';
import {flushSync} from 'react-dom';
import {isExternalPlaylist,matchesPlaylistSong,playlistLibraryMatch} from '../../lib/playlistImport';
import {mediaLink,youtubeLink} from '../../lib/mediaSource';
import {searchMusicCatalog} from '../../lib/youtubeMusic';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Clock,Download,KeyRound,Link2,ListMusic,Plus,Search,Sparkles,X} from 'lucide-react';
import {useAppSlice} from '../../store/AppContext';
import {validateUrl,isTauri,type YouTubeMetadata,type YouTubePlaylist} from '../../lib/musicApi';
import toast from 'react-hot-toast';
import './music-downloads.css';
const isVideoLink=(value:string)=>/^(?:https?:\/\/|(?:www\.|music\.|m\.)?youtube\.com\/|youtu\.be\/)/i.test(value);
const target=(item:YouTubeMetadata)=>item.webpage_url||(/^https?:/.test(item.url||'')?item.url:'')||(/^[A-Za-z0-9_-]{11}$/.test(item.id)?'https://www.youtube.com/watch?v='+item.id:'');
const clock=(seconds:number)=>{const total=Math.max(0,Math.round(seconds||0));return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');};
export default function MusicLinkImport(){
 const a=useAppSlice(['addToDownloadQueue','addTrack','addPlaylist','playlists','tracks']),[collection,setCollection]=useState<YouTubePlaylist|null>(null),[listName,setListName]=useState(''),[token,setToken]=useState(''),[progress,setProgress]=useState(''),[previewPage,setPreviewPage]=useState(0),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[items,setItems]=useState<YouTubeMetadata[]>([]),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const reset=()=>{request.current?.abort();setBusy(false);setItems([]);setSelected([]);setCollection(null);setProgress('');setPreviewPage(0);setError('');};
 const clear=()=>{reset();setQuery('');};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');setItems([]);setSelected([]);setCollection(null);
  try{const value=query.trim();let entries:YouTubeMetadata[];
   if(isVideoLink(value)){const link=mediaLink(value);if(!link)throw Error('El enlace no es válido.');if(!isTauri())throw Error('Los enlaces se revisan desde West de escritorio.');const connection=musicConnection.getTransportOptions();const data=isExternalPlaylist(link.href)?await invoke<YouTubePlaylist>('read_external_playlist',{url:link.href,accessToken:token||undefined,proxyMode:connection.mode,proxyUrl:connection.mode==='custom'?connection.proxyUrl:undefined}):await validateUrl(link.href);if(controller.signal.aborted)return;if('entries'in data){setCollection(data as YouTubePlaylist);setListName(data.title);entries=(data as YouTubePlaylist).entries;}else entries=[data as YouTubeMetadata];setToken('');}
   else{if(value.length<2)throw Error('Escribe al menos dos letras para buscar una canción.');const result=await searchMusicCatalog(value,'song',controller.signal);entries=result.songs.map(song=>({id:song.id,title:song.title,channel:song.artist,duration:song.duration,thumbnail:song.cover,webpage_url:'https://www.youtube.com/watch?v='+song.id})) as YouTubeMetadata[];}
   if(controller.signal.aborted)return;const valid=[...new Map(entries.filter(item=>!!item.id&&!!target(item)).map(item=>[item.id,item])).values()];setItems(valid);setSelected(valid.map(target));if(!valid.length)setError('No se encontraron canciones disponibles para esta búsqueda.');
  }catch(error){if(!controller.signal.aborted)setError(String(error).replace(/^Error: /,''));}finally{if(!controller.signal.aborted)setBusy(false);}
 };
 const createCollection=async()=>{
  if(!collection||!selected.length||busy)return;if(a.playlists.some(p=>p.name.trim().toLocaleLowerCase()===listName.trim().toLocaleLowerCase())){setError('Ya existe una lista con ese nombre. Cambia el nombre para importar.');return;}
  const controller=new AbortController();request.current=controller;setBusy(true);setError('');const ids:string[]=[],resolved=new Map<string,YouTubeMetadata>();let missing=0,checked=0;
  const chosen=items.filter(item=>selected.includes(target(item)));const started=Date.now();
  try{for(const item of chosen){controller.signal.throwIfAborted();setProgress(`${++checked} de ${chosen.length} · comprobando canciones`);
   const local=playlistLibraryMatch(item,a.tracks);if(local){ids.push(local.id);continue;}
   let match=item;if(!youtubeLink(target(item))){if(Date.now()-started>90000){missing++;continue;}const result=await searchMusicCatalog(item.title+' '+item.channel,'song',controller.signal);const song=result.songs.find(song=>matchesPlaylistSong(item,song));if(!song){missing++;continue;}match={...item,id:song.id,webpage_url:'https://www.youtube.com/watch?v='+song.id,thumbnail:song.cover,duration:song.duration};}
   resolved.set(target(match),match);await new Promise(resolve=>setTimeout(resolve,0));
  }
  controller.signal.throwIfAborted();flushSync(()=>{for(const item of resolved.values())ids.push(a.addTrack({title:item.title,artist:item.channel||'',duration:item.duration||0,source:'youtube',url:target(item),coverUrl:item.thumbnail,isFavorite:false,listenedTime:0,librarySaved:false}));});
  if(!ids.length){setError('No hay coincidencias verificables para crear esta lista. No se agregó ninguna canción.');return;}
  a.addPlaylist(listName.trim(),[...new Set(ids)],collection.thumbnail||undefined);setItems([]);setSelected([]);setCollection(null);setQuery('');toast.success(`Lista creada con ${new Set(ids).size} canciones`);if(missing)setError(`${missing} canciones no se agregaron porque no hubo una coincidencia verificable dentro del tiempo de consulta.`);
  }catch(error){if(!controller.signal.aborted)setError(String(error).replace(/^Error: /,''));}finally{if(!controller.signal.aborted){setBusy(false);setProgress('');}}
 };
 const diagnostics=collection?.diagnostics as {provider?:string;transport?:string;pages?:number;elapsedMs?:number;totalKnown?:boolean;note?:string}|undefined;
 const page=useMemo(()=>items.slice(previewPage*60,previewPage*60+60),[items,previewPage]);
 const analysis=useMemo(()=>{
  const total=items.length,seconds=items.reduce((sum,item)=>sum+(item.duration||0),0);
  const downloadable=items.filter(item=>youtubeLink(target(item))).length;
  const artists=new Set(items.map(item=>(item.channel||'').trim().toLocaleLowerCase()).filter(Boolean));
  return {total,seconds,downloadable,artists:artists.size,selected:selected.length};
 },[items,selected]);
 const queueDownload=(item:YouTubeMetadata)=>{
  const url=target(item);if(!url||!youtubeLink(url)){toast.error('Esta canción no se puede descargar desde este origen.');return;}
  a.addToDownloadQueue({title:item.title,artist:item.channel||'',url,type:'video',totalItems:1,thumbnail:item.thumbnail,duration:item.duration});
  toast.success('Descarga añadida a la cola');
 };
 const isSpotify=query.includes('open.spotify.com');
 return <section className="music-link-import" aria-label="Buscar o importar canciones">
  <form className="music-import-form" onSubmit={submit}>
   <div className="music-import-field">
    <Search size={18} aria-hidden="true"/>
    <input aria-label="Buscar canción o pegar enlace" placeholder="Pega el enlace de una lista o escribe una canción" value={query} onChange={e=>{reset();setQuery(e.target.value);}} maxLength={2000}/>
    {query&&<button type="button" className="music-import-clear" aria-label="Limpiar búsqueda" onClick={clear}><X size={15}/></button>}
   </div>
   <button type="submit" className="btn-primary music-import-submit" disabled={busy||!query.trim()}>{busy?'Analizando…':isVideoLink(query.trim())?'Analizar enlace':'Buscar'}</button>
  </form>
  <p className="music-import-hint"><Link2 size={13}/> YouTube Music, Deezer y Spotify. Al analizar un enlace se revisa la lista completa y cada canción se puede descargar por separado. No necesitas clave de Spotify para listas públicas.</p>
  {busy&&<div className="music-import-progress" role="status"><span className="music-import-spinner" aria-hidden="true"/>{progress||'Consultando el catálogo…'}<button className="btn-ghost" onClick={reset}>Cancelar</button></div>}
  {error&&<p role="alert" className="music-import-error">{error}</p>}
  {items.length>0&&<div className="music-link-preview">
   {diagnostics&&<p className="playlist-diagnostics" role="status">Fuente: {diagnostics.provider} · {diagnostics.transport==='custom'?'proxy configurado':diagnostics.transport==='direct'?'conexión directa':'conexión del sistema'} · {items.length} canciones · {((diagnostics.elapsedMs||0)/1000).toFixed(1)} s{diagnostics.note&&<span className="playlist-public-note">{diagnostics.note}</span>}</p>}
   {collection&&<header className="playlist-import-heading">
    {collection.thumbnail&&<img src={collection.thumbnail} alt=""/>}
    <div><label>Nombre de tu lista<input aria-label="Nombre de la lista importada" value={listName} maxLength={100} onChange={e=>setListName(e.target.value)}/></label><p>{items.length} canciones disponibles{collection.playlist_count>items.length?` de ${collection.playlist_count}. El servicio no entregó todas las canciones.`:''}</p></div>
   </header>}
   <div className="music-import-analysis" aria-label="Análisis de la lista">
    <span><ListMusic size={14}/><strong>{analysis.total}</strong> canciones</span>
    <span><Sparkles size={14}/><strong>{analysis.artists}</strong> artistas</span>
    <span><Clock size={14}/><strong>{clock(analysis.seconds)}</strong> de duración</span>
    <span><Download size={14}/><strong>{analysis.downloadable}</strong> descargables</span>
   </div>
   <ul className="music-import-songs">
    {page.map(item=>{const url=target(item),canDownload=!!url&&youtubeLink(url),checked=selected.includes(url);return <li key={url} data-selected={checked}>
     <label className="music-import-song">
      <input type="checkbox" checked={checked} onChange={e=>setSelected(value=>e.target.checked?[...value,url]:value.filter(v=>v!==url))}/>
      {item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy"/>:<span className="music-import-song-art" aria-hidden="true"><ListMusic size={16}/></span>}
      <span className="music-import-song-text"><strong>{item.title}</strong><small>{item.channel||'Artista desconocido'}{item.duration?` · ${clock(item.duration)}`:''}</small></span>
     </label>
     <button type="button" className="music-import-download" disabled={!canDownload} title={canDownload?'Descargar esta canción':'Este origen no permite descargar la canción'} aria-label={'Descargar '+item.title} onClick={()=>queueDownload(item)}><Download size={15}/><span>Descargar</span></button>
    </li>;})}
   </ul>
   {items.length>60&&<nav className="music-pagination" aria-label="Páginas de la lista a importar"><button disabled={previewPage===0} onClick={()=>setPreviewPage(p=>p-1)}>Anterior</button><span>{previewPage*60+1}–{Math.min(items.length,previewPage*60+60)} de {items.length}</span><button disabled={(previewPage+1)*60>=items.length} onClick={()=>setPreviewPage(p=>p+1)}>Siguiente</button></nav>}
   <footer className="music-import-footer">
    <span>{analysis.selected} seleccionadas</span>
    <div>
     {collection&&<button className="btn-secondary" disabled={busy||!selected.length||!listName.trim()} onClick={createCollection}><Plus size={15}/>Crear lista propia</button>}
     {items.every(item=>youtubeLink(target(item)))&&<button className="btn-secondary music-import-save" disabled={busy||!selected.length} onClick={()=>{for(const item of items.filter(item=>selected.includes(target(item))))a.addTrack({title:item.title,artist:item.channel||'',duration:item.duration||0,source:'youtube',url:target(item),coverUrl:item.thumbnail,isFavorite:false,listenedTime:0,librarySaved:true});clear();toast.success('Añadidas a tu biblioteca');}}><Plus size={15}/>Guardar en biblioteca</button>}
     {items.every(item=>youtubeLink(target(item)))&&<button className="btn-primary" disabled={busy||!selected.length} onClick={()=>{for(const item of items.filter(item=>selected.includes(target(item))))a.addToDownloadQueue({title:item.title,artist:item.channel||'',url:target(item),type:'video',totalItems:1,thumbnail:item.thumbnail,duration:item.duration});clear();toast.success('Añadidas a Descargas');}}><Download size={15}/>Descargar selección</button>}
    </div>
   </footer>
  </div>}
 </section>;
}
