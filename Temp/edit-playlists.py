from pathlib import Path
p=Path('src/components/music/MusicLinkImport.tsx');s=p.read_text('utf-8');s="import {invoke} from '@tauri-apps/api/core';\nimport {flushSync} from 'react-dom';\nimport {isExternalPlaylist,matchesPlaylistSong,playlistLibraryMatch} from '../../lib/playlistImport';\n"+s
s=s.replace("['addToDownloadQueue','addTrack']","['addToDownloadQueue','addTrack','addPlaylist','playlists','tracks']")
s=s.replace("[query,setQuery]=useState('')","[collection,setCollection]=useState<YouTubePlaylist|null>(null),[listName,setListName]=useState(''),[token,setToken]=useState(''),[progress,setProgress]=useState(''),[query,setQuery]=useState('')")
s=s.replace("setSelected([]);setError('');};","setSelected([]);setCollection(null);setProgress('');setError('');};")
s=s.replace("setItems([]);setSelected([]);\n  try","setItems([]);setSelected([]);setCollection(null);\n  try")
s=s.replace("const data=await validateUrl(link.href);entries='entries'in data?(data as YouTubePlaylist).entries:[data as YouTubeMetadata];","const data=isExternalPlaylist(link.href)?await invoke<YouTubePlaylist>('read_external_playlist',{url:link.href,accessToken:token||undefined}):await validateUrl(link.href);if('entries'in data){setCollection(data as YouTubePlaylist);setListName(data.title);entries=(data as YouTubePlaylist).entries;}else entries=[data as YouTubeMetadata];setToken('');")
s=s.replace("const valid=entries.filter(item=>!!item.id&&!!target(item)).slice(0,200);","const valid=[...new Map(entries.filter(item=>!!item.id&&!!target(item)).map(item=>[item.id,item])).values()];")
needle=' return <section'
fn=''' const createCollection=async()=>{
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
'''
s=s.replace(needle,fn+needle)
s=s.replace('placeholder="Canción, artista o enlace de audio o vídeo"','placeholder="Canción o enlace de lista · YouTube Music, Deezer, Spotify"')
s=s.replace('</form>{error&&','</form>{query.includes(\'open.spotify.com\')&&<details><summary>Autorización de Spotify</summary><p>Requiere un token de acceso con permiso de lectura para esta lista. Se usa solo en esta consulta y no se guarda.</p><input type="password" aria-label="Token de acceso de Spotify" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></details>}{busy&&<div className="music-import-progress" role="status">{progress||\'Consultando el catálogo…\'}<button className="btn-ghost" onClick={reset}>Cancelar</button></div>}{error&&')
s=s.replace('<div className="music-link-preview"><div>','<div className="music-link-preview">{collection&&<header className="playlist-import-heading">{collection.thumbnail&&<img src={collection.thumbnail} alt=""/>}<div><label>Nombre de tu lista<input aria-label="Nombre de la lista importada" value={listName} maxLength={100} onChange={e=>setListName(e.target.value)}/></label><p>{items.length} canciones disponibles{collection.playlist_count>items.length?` de ${collection.playlist_count}. El servicio no entregó todas las canciones.`:\'\'}</p></div></header>}<div>')
s=s.replace('<footer><span>{selected.length} seleccionadas</span>','<footer><span>{selected.length} seleccionadas</span>{collection&&<button className="btn-primary" disabled={busy||!selected.length||!listName.trim()} onClick={createCollection}><Plus size={15}/>Crear lista propia</button>}')
s=s.replace('disabled={!selected.length}', 'disabled={busy||!selected.length}')
p.write_text(s,'utf-8')
p=Path('src/components/music/MusicPlaylists.tsx');s=p.read_text('utf-8').replace('GripVertical,','Heart,').replace("'setRepeatMode']","'setRepeatMode','toggleTrackFavorite']")
# Only the collection page occupies the width; navigation remains in the top back button.
start=s.index('{list&&<nav className="playlist-collection-nav"');end=s.index('<div className="playlist-collection-content">',start)
s=s[:start]+s[end:]
s=s.replace('<header className="playlist-detail-heading">','<button className="playlist-back btn-ghost" onClick={()=>choose(null)}><ChevronLeft size={15}/>Todas las listas</button><header className="playlist-detail-heading">')
s=s.replace('<GripVertical size={15} aria-hidden="true"/>','')
s=s.replace('<button className="playlist-reorder" aria-label={\'Subir ', '<button className="playlist-reorder" aria-label={\'Subir ')
s=s.replace('<button aria-label={\'Quitar \'+track.title', '<button aria-label={(track.isFavorite?\'Quitar de favoritas \':\'Marcar favorita \')+track.title} aria-pressed={track.isFavorite} onClick={()=>a.toggleTrackFavorite(track.id)}><Heart size={16} fill={track.isFavorite?\'currentColor\':\'none\'}/></button><button aria-label={\'Quitar \'+track.title')
p.write_text(s,'utf-8')
