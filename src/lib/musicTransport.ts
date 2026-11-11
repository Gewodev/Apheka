import {useMemo,useEffect,useState} from 'react';
import {useAppSlice} from '../store/AppContext';
import {canPlayOffline,canPlayTrack} from './musicAvailability';
import {isLibraryTrack,nextMusicSelection,renewMusicCycle} from './musicRadio';
/** Resolve membership once per library revision, rather than scanning it for every ID. */
export function useMusicTransport(){
 const a=useAppSlice(['tracks','currentTrackId','musicQueue','setMusicQueue','queueSource','playTrack','settings','shuffleMode','repeatMode','trackHistory','playCounts','musicTraversal']);
 const [availabilityRevision,setAvailabilityRevision]=useState(0);useEffect(()=>{const update=()=>setAvailabilityRevision(value=>value+1);window.addEventListener('apheka:recording-unavailable',update);return()=>window.removeEventListener('apheka:recording-unavailable',update);},[]);
 const available=useMemo(()=>new Set(a.tracks.filter(t=>canPlayTrack(t,a.settings.musicOffline)).map(t=>t.id)),[a.tracks,a.settings.musicOffline,availabilityRevision]);
 const library=useMemo(()=>a.tracks.filter(isLibraryTrack).map(t=>t.id),[a.tracks]);
 const pool=useMemo(()=>(a.queueSource?.pool||library).filter(id=>available.has(id)),[library,a.queueSource,available]),at=pool.indexOf(a.currentTrackId||'');
 const upcoming=useMemo(()=>{const scope=new Set(pool);return [...new Set(a.musicQueue)].filter(id=>available.has(id)&&scope.has(id)&&id!==a.currentTrackId);},[a.musicQueue,pool,a.currentTrackId,available]);
 useEffect(()=>{if(a.repeatMode==='all'&&a.currentTrackId&&pool.length&&!upcoming.length){const cycle=renewMusicCycle({tracks:a.tracks,currentId:a.currentTrackId,queue:[],sourcePool:a.queueSource?.pool,shuffle:a.shuffleMode,repeat:a.repeatMode,history:a.trackHistory,counts:a.playCounts,offline:a.settings.musicOffline});if(cycle.some(id=>id!==a.currentTrackId))a.setMusicQueue(cycle);}},[a.currentTrackId,a.repeatMode,pool,upcoming.length]);
 const forwardId=a.musicTraversal.forward.find(id=>id!==a.currentTrackId&&available.has(id));
 const next=()=>{if(forwardId){a.playTrack(forwardId,true,'forward');return;}const result=nextMusicSelection({tracks:a.tracks,currentId:a.currentTrackId,queue:a.musicQueue,sourcePool:a.queueSource?.pool,shuffle:a.shuffleMode,repeat:a.repeatMode,history:a.trackHistory,counts:a.playCounts,offline:a.settings.musicOffline},true);if(result.id){a.setMusicQueue(result.queue);a.playTrack(result.id,true);}};
 // History is a playback trail, not a library filter. A discovery preview can be
 // the actual previous recording even while the next songs come from a playlist.
 const previousId=[...a.musicTraversal.back].reverse().find(id=>id!==a.currentTrackId&&available.has(id))||(!a.musicTraversal.back.length&&!a.musicTraversal.forward.length?a.trackHistory.find(id=>id!==a.currentTrackId&&available.has(id))||pool[at-1]:undefined);
 return {next,previous:()=>{if(previousId)a.playTrack(previousId,true,'back');},upcoming:[...new Set([...a.musicTraversal.forward.filter(id=>available.has(id)),...upcoming])],hasNext:!!forwardId||upcoming.length>0||(a.repeatMode==='all'&&pool.length>0),hasPrevious:!!previousId};
}
