import {artistKey} from './artistIdentity';
/** Keep real versions distinct; remove promotional labels, not the song's words. */
export const recordingTitle=(value:string)=>artistKey(value.replace(/\s*[([]\s*(?:feat\.?|ft\.?|featuring|with|con)\s+[^)\]]*[)\]]/gi,'').replace(/\s*[([][^)\]]*(?:official|oficial|audio|lyrics?|visualizer|video|remaster(?:ed)?\s*\d*)[^)\]]*[)\]]/gi,'').replace(/\s*[-–—]\s*(?:official|oficial|audio|lyrics?|visualizer|video).*$/i,'')).replace(/\s+/g,' ').trim();
export const partitionedRecording=(title:string)=>/\b(?:parte|part|pt|cap[ií]tulo)\s*[.:#-]?\s*\d+\b|\b(?:snippet|fragmento|tiktok|shorts?|full album|album completo|reacci[oó]n|karaoke|cover|sped up|slowed|8d audio|tributo|tribute|podcast)\b/i.test(title);
export function uniqueArtistRecordings<T extends {title:string;duration:number;playCount?:number}>(songs:T[]){
 const result:T[]=[];
 for(const song of songs){if(partitionedRecording(song.title))continue;const key=recordingTitle(song.title),index=result.findIndex(other=>recordingTitle(other.title)===key&&(!song.duration||!other.duration||Math.abs(other.duration-song.duration)<=8));if(index<0)result.push(song);else if((song.playCount||0)>(result[index].playCount||0))result[index]=song;}
 return result;
}
