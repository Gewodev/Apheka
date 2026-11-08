import {useEffect,useState} from 'react';
import {searchArtistSongs} from '../lib/artistCatalog';
import type {MusicEntity,MusicSong} from '../lib/youtubeMusic';

export function useArtistSongSearch(artist:MusicEntity|null,query:string,offline=false){
 const [songs,setSongs]=useState<MusicSong[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setSongs([]);setError('');setBusy(false);
  if(!artist||query.trim().length<2||offline)return()=>controller.abort();
  const timer=setTimeout(()=>{
   setBusy(true);
   void searchArtistSongs(artist,query.trim(),controller.signal).then(rows=>{if(!controller.signal.aborted)setSongs(rows);})
    .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:String(cause));})
    .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  },350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[artist?.id,query,offline]);
 return {songs,busy,error};
}
