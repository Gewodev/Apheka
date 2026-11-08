import type {AppContextType,Track} from '../store/AppContext';
import {songTrack,type MusicSong} from './youtubeMusic';

type ArtistStore=Pick<AppContextType,'tracks'|'addTrack'|'updateTrack'>;
/** Playback metadata is shared; membership in Mis canciones requires a separate user action. */
export async function storeArtistCollection(snapshot:()=>ArtistStore,artistId:string,rows:MusicSong[],signal:AbortSignal){
 const ids:string[]=[],known=new Map<string,Track>();
 for(const track of snapshot().tracks){if(track.catalogId)known.set(track.catalogId,track);if(track.url)known.set(track.url,track);}
 for(let offset=0;offset<rows.length;offset+=20){
  signal.throwIfAborted();
  for(const row of rows.slice(offset,offset+20)){
   signal.throwIfAborted();const data=songTrack(row),existing=known.get(data.catalogId!)||known.get(data.url!);
   const artistCollectionIds=[...new Set([...(existing?.artistCollectionIds||[]),artistId])];
   const artistCatalogIds=[...new Set([...(existing?.artistCatalogIds||[]),...(data.artistCatalogIds||[])])];
   let track:Track;
   if(existing){
    const updates={artistCollectionIds,artistCatalogIds,...(row.playCount===undefined?{}:{catalogPlayCount:row.playCount})};
    if(!existing.artistCollectionIds?.includes(artistId)||artistCatalogIds.length!==(existing.artistCatalogIds?.length||0)||row.playCount!==undefined&&row.playCount!==existing.catalogPlayCount)await snapshot().updateTrack(existing.id,updates,true);
    track={...existing,...updates};
   }else{
    const added={...data,librarySaved:false,artistCollectionIds,artistCatalogIds,...(row.playCount===undefined?{}:{catalogPlayCount:row.playCount})};
    track={...added,id:snapshot().addTrack(added)};
   }
   known.set(data.catalogId!,track);known.set(data.url!,track);ids.push(track.id);
  }
  if(offset+20<rows.length)await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 return [...new Set(ids)];
}
