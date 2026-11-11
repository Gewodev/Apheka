import type {Track} from '../store/AppContext';
import type {YouTubeMetadata} from './musicApi';
const words=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\b(official|oficial|video|audio|lyrics|lyric|letra|hd|4k)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function matchesPlaylistSong(expected:Pick<YouTubeMetadata,'title'|'channel'|'duration'>,candidate:{title:string;artist:string;duration:number}){
 const title=words(expected.title),actual=words(candidate.title);if(!title||title!==actual)return false;
 const credits=expected.channel.split(/[,;]|\bfeat\.?\b|\bft\.?\b/i).map(words).filter(Boolean),artist=words(candidate.artist);
 if(!credits.length||!credits.every(credit=>(` ${artist} `).includes(` ${credit} `)))return false;
 return !expected.duration||!candidate.duration||Math.abs(expected.duration-candidate.duration)<=Math.max(5,expected.duration*.06);
}
export function playlistLibraryMatch(item:YouTubeMetadata,tracks:Track[]){return tracks.find(t=>matchesPlaylistSong(item,t));}
export const isExternalPlaylist=(url:string)=>{try{return ['open.spotify.com','deezer.com','www.deezer.com'].includes(new URL(url).hostname);}catch{return false;}};
