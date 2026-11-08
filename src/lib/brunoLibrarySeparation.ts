import {artistKey,creditedArtist,type SavedMusicArtist} from './artistIdentity';
import type {Track} from '../store/AppContext';

export const BRUNO_SEPARATION_KEY='apheka_bruno_library_separation_6262';
/** User-approved legacy cleanup: keep favorites and every local/downloaded recording. */
export function brunoLibrarySeparation(tracks:Track[],artists:SavedMusicArtist[]){
 const bruno=artists.filter(artist=>artistKey(artist.name)==='bruno mars');
 const catalogIds=new Set(bruno.flatMap(artist=>artist.catalogId?[artist.catalogId]:[]));
 const linkedIds=new Set(bruno.flatMap(artist=>[...(artist.trackIds||[]),...(artist.catalogTrackIds||[])]));
 return tracks.flatMap(track=>{
  const named=creditedArtist(track.artist,'Bruno Mars');
  const linked=named||linkedIds.has(track.id)||track.artistCatalogIds?.some(id=>catalogIds.has(id))||track.artistCollectionIds?.some(id=>catalogIds.has(id));
  const local=track.source==='local'||!!(track.localAudioPath||track.filePath||track.audioFile)||/^(?:file:|blob:|asset:|[a-z]:[\\/])/i.test(track.url||'');
  if(!linked||track.librarySaved===false||track.isFavorite||local)return [];
  // A wrong old channel association is removed from the library, not promoted into the artist.
  const artistCollectionIds=named?[...new Set([...(track.artistCollectionIds||[]),...catalogIds])]:track.artistCollectionIds?.filter(id=>!catalogIds.has(id));
  return [{...track,librarySaved:false,artistCollectionIds}];
 });
}
