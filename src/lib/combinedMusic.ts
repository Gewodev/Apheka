import {recordingUnavailable} from './recordingAvailability';
import {canSearchLyricFragment,lyricFragment,verifyLyricCandidates} from './lyricFragmentSearch';
import {musicRecommendationSeeds,rankMusicRecommendations,rankMusicSearch} from './musicPreferences';
import type {Track} from '../store/AppContext';
import {searchMusicCatalog,searchLyricCatalog,musicRecommendations,type MusicResult,type MusicSong} from './youtubeMusic';
import {loadCatalog,type CatalogTrack} from './musicCatalog';
import {cleanMusicQuery,curateSongs} from './musicSearch';
export type DiscoverSong=MusicSong|CatalogTrack;
export const eligibleAudius=(item:CatalogTrack)=>item.verified===true&&!item.remix&&item.duration>=30&&item.duration<=1200&&!!item.cover&&!/podcast|spoken|audiobook|sound effect/i.test(item.genre||'');
export function mergeMusic(primary:MusicSong[],secondary:CatalogTrack[],query=''):DiscoverSong[]{
 const originals=curateSongs(primary.filter(song=>!recordingUnavailable(song.id)),query),independent=curateSongs(secondary.filter(eligibleAudius),query),limit=originals.length?Math.max(1,Math.ceil(originals.length/4)):12;
 // Provider priority is maintained when a recording exists in both catalogs.
 return curateSongs<DiscoverSong>([...originals,...independent.slice(0,limit)],query);
}
export async function discoverMusic(query:string,kind:'all'|'song'|'artist'|'album',preferences:{tracks:Track[];history?:string[];playCounts?:Record<string,number>},signal:AbortSignal,onPartial?:(value:MusicResult&{items:DiscoverSong[]})=>void):Promise<MusicResult&{items:DiscoverSong[]}>{
 const clean=cleanMusicQuery(query),seed=musicRecommendationSeeds(preferences)[0];
 const explicit=/^\s*(?:letra|lyrics)\s*:|^["“]/i.test(query)&&canSearchLyricFragment(query);
 if(explicit){const songs=await verifyLyricCandidates(query,await searchLyricCatalog(lyricFragment(query),signal),signal);return {songs,items:songs,artists:[],albums:[]};}
 const primary=clean?searchMusicCatalog(clean,kind,signal):musicRecommendations(preferences.tracks,preferences.history,preferences.playCounts,signal);
 let primaryError:unknown;
 const value=await primary.catch(error=>{primaryError=error;return {songs:[],artists:[],albums:[]};});if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 // A full primary page needs no extra network request or secondary-provider wait.
 const originals=mergeMusic(value.songs,[],clean);
 if(originals.length>=10)return {...value,items:clean?rankMusicSearch(originals,clean,preferences):rankMusicRecommendations(originals,preferences)};
 if(originals.length)onPartial?.({...value,items:clean?rankMusicSearch(originals,clean,preferences):rankMusicRecommendations(originals,preferences)});
 const extra=(kind==='all'||kind==='song')&&(clean||seed)?await loadCatalog(clean||seed!,'',0,false,AbortSignal.any([signal,AbortSignal.timeout(2000)])).then(result=>result.items).catch(()=>[]):[];
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 if(primaryError&&!extra.some(eligibleAudius))throw primaryError;
 const items=mergeMusic(value.songs,extra,clean);
 if(!items.length&&canSearchLyricFragment(query)){const songs=await verifyLyricCandidates(query,await searchLyricCatalog(lyricFragment(query),signal),signal);return {songs,items:songs,artists:[],albums:[]};}
 return {...value,items:clean?rankMusicSearch(items,clean,preferences):rankMusicRecommendations(items,preferences)};
}

