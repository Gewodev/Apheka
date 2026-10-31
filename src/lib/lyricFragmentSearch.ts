import {musicText} from './musicSearch';
import {loadLyrics} from './lyrics';
import type {MusicSong} from './youtubeMusic';

export function lyricFragment(query:string){return query.replace(/^\s*(?:letra|lyrics)\s*:\s*/i,'').replace(/^["“]|["”]$/g,'').trim();}
export function canSearchLyricFragment(query:string){const words=musicText(lyricFragment(query)).split(' ').filter(Boolean);return words.length>=(/^\s*(?:letra|lyrics)\s*:|^["“]/i.test(query)?3:4)&&words.length<=30;}
/** A candidate is accepted only when its actual lyric contains the remembered phrase. */
export function matchesLyricFragment(query:string,lyrics:string){
 const phrase=musicText(lyricFragment(query));if(!canSearchLyricFragment(query))return false;
 return (' '+musicText(lyrics)+' ').includes(' '+phrase+' ');
}
export async function verifyLyricCandidates(query:string,songs:MusicSong[],signal:AbortSignal){
 const matches:MusicSong[]=[],candidates=songs.slice(0,4);
 const bounded=AbortSignal.any([signal,AbortSignal.timeout(8500)]);
 for(let start=0;start<candidates.length&&!bounded.aborted;start+=2){
  const rows=await Promise.allSettled(candidates.slice(start,start+2).map(async song=>{
   const lyrics=await loadLyrics(song.title,song.artist,song.duration,true,bounded);
   const text=lyrics?.plain||lyrics?.lines.map(line=>line.text).join('\n')||'';
   return matchesLyricFragment(query,text)?song:null;
  }));
  for(const row of rows)if(row.status==='fulfilled'&&row.value)matches.push(row.value);
 }
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 return matches;
}
