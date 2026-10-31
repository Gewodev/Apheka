import {recordingUnavailable} from './recordingAvailability';
import type {Track} from '../store/AppContext';
import {searchMusicCatalog,type MusicSong} from './youtubeMusic';
import {musicText} from './musicSearch';
import {extractYouTubeId} from './ytEngine';
const replacements=new Map<string,string>();
export const resolvedYouTubeUrl=(url:string)=>replacements.get(url)||url;
const artist=(value:string)=>musicText(value.replace(/\s*-\s*Topic$/i,''));
const title=(name:string,performer:string)=>{
 let value=name.replace(/\s*[([][^)\]]*(?:official|oficial|music video|lyrics?|audio)[^)\]]*[)\]]/gi,'').trim();
 const parts=value.match(/^(.+?)\s+[–—-]\s+(.+)$/);if(parts&&artist(parts[1])===artist(performer))value=parts[2];
 return musicText(value);
};
export function sameYouTubeRecording(song:MusicSong,track:Pick<Track,'title'|'artist'|'duration'>){
 return !!song.cover&&artist(song.artist)===artist(track.artist)&&title(song.title,song.artist)===title(track.title,track.artist)&&(!track.duration||!song.duration||Math.abs(song.duration-track.duration)<=3);
}
/** Only another public music-catalog recording with the same identity; never evade restrictions. */
export async function recoverYouTubeRecording(track:Track,failed:Set<string>,signal:AbortSignal){
 const original=track.url;if(!original)return null;
 const query=title(track.title,track.artist)+' '+track.artist;
 const result=await searchMusicCatalog(query,'song',signal,true);
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 const alternative=result.songs.find(song=>!failed.has(song.id)&&!recordingUnavailable(song.id)&&song.id!==extractYouTubeId(original)&&sameYouTubeRecording(song,track));
 if(!alternative)return null;
 const url='https://www.youtube.com/watch?v='+alternative.id;
 if(replacements.size>=40)replacements.delete(replacements.keys().next().value!);
 replacements.set(original,url);return url;
}
