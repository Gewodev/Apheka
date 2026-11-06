import {recordingTitle,partitionedRecording,uniqueArtistRecordings} from './recordingIdentity';
import {catalogFetch} from './musicNetwork';
import {artistKey,creditedArtist} from './artistIdentity';
import type {MusicEntity,MusicSong} from './youtubeMusic';
const titleKey=recordingTitle;
const cache=new Map<string,{at:number;titles:Set<string>}>();
const pending=new Map<string,Promise<Set<string>>>();
/** Metadata only. A second catalog may corroborate titles, never invent channel identity. */
export async function corroboratedTitles(artist:MusicEntity,anchors:MusicSong[],signal?:AbortSignal){
 const key=artist.id,hit=cache.get(key);if(hit&&Date.now()-hit.at<86400000)return hit.titles;
 let task=pending.get(key);if(!task){task=(async()=>{const response=await catalogFetch('https://itunes.apple.com/search?'+new URLSearchParams({term:artist.name,entity:'song',attribute:'artistTerm',country:'MX',limit:'200'}),{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Catálogo temporalmente no disponible.');const data=await response.json(),groups=new Map<number,Set<string>>();
  for(const item of data.results||[]){if(!item.artistId||!item.trackName||!creditedArtist(item.artistName,artist.name))continue;const set=groups.get(item.artistId)||new Set<string>();set.add(titleKey(item.trackName));groups.set(item.artistId,set);}
  const known=new Set(anchors.map(song=>titleKey(song.title))),ranked=[...groups.values()].map(titles=>({titles,overlap:[...known].filter(title=>titles.has(title)).length})).sort((a,b)=>b.overlap-a.overlap);
  const titles=ranked[0]?.overlap>=2&&ranked[0].overlap>(ranked[1]?.overlap||0)?ranked[0].titles:new Set<string>();if(cache.size>=24)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),titles});return titles;
 })().catch(()=>{const titles=new Set<string>();if(cache.size>=24)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now()-86100000,titles});return titles;}).finally(()=>pending.delete(key));pending.set(key,task);}
 const result=await task;signal?.throwIfAborted();return result;
}
export function artistSongMatches(song:MusicSong,artist:MusicEntity,titles?:Set<string>){
 const ids=song.artistIds?.length?song.artistIds:song.artistId?[song.artistId]:[];
 const credited=ids.includes(artist.id),corroborated=creditedArtist(song.artist,artist.name)&&!!titles?.has(titleKey(song.title));
 // No substring matching, view-count guesses, cover/remix uploads, or a different homonym's channel.
 if(!credited&&!corroborated)return false;
 if(partitionedRecording(song.title))return false;
 if(song.playCount!==undefined&&song.playCount<1000)return false;
 // Complete provider credit IDs prove collaborations even when a second catalog is incomplete.
 // Text-only legacy associations still need corroboration above; absent counts are not invented.
 return true;
}
export async function filterArtistCatalog(artist:MusicEntity,songs:MusicSong[],signal?:AbortSignal){
 const anchors=songs.filter(song=>artistSongMatches(song,artist));
 const titles=await corroboratedTitles(artist,anchors,signal);
 return uniqueArtistRecordings(songs.filter(song=>artistSongMatches(song,artist,titles))).sort((a,b)=>(b.playCount||0)-(a.playCount||0));
}
