import {useEffect,useMemo,useState} from 'react';
import {Music} from 'lucide-react';
import {convertFileSrc,isTauri} from '@tauri-apps/api/core';
type ArtworkTrack={title:string;coverImage?:string;coverUrl?:string;catalogId?:string;source?:string;url?:string};
/** Metadata first, then the exact video's thumbnail. Never substitute unrelated art. */
export default function SongArtwork({track}:{track:ArtworkTrack}){
 const sources=useMemo(()=>{
  const id=(track.catalogId||'').replace(/^ytm:/,'');
  const video=track.source==='youtube'&&/^[\w-]{11}$/.test(id)?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:undefined;
  return [...new Set([track.coverImage,track.coverUrl,video].filter((v):v is string=>!!v).map(v=>isTauri()&&/^(?:[A-Za-z]:[\\/]|\\\\)/.test(v)?convertFileSrc(v):v))];
 },[track.coverImage,track.coverUrl,track.catalogId,track.source]);
 const [index,setIndex]=useState(0);useEffect(()=>setIndex(0),[sources]);
 return <span className="song-artwork" aria-hidden="true">{sources[index]?<img src={sources[index]} alt="" loading="lazy" decoding="async" onError={()=>setIndex(i=>i+1)}/>:<Music size={22} strokeWidth={1.2}/>}</span>;
}
