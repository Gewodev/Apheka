import {useMemo} from 'react';
import {useAppSlice} from '../store/AppContext';
import {canPlayOffline} from './musicAvailability';
import {isLibraryTrack,nextMusicSelection} from './musicRadio';
/** Resolve membership once per library revision, rather than scanning it for every ID. */
export function useMusicTransport(){
 const a=useAppSlice(['tracks','currentTrackId','musicQueue','setMusicQueue','queueSource','playTrack','settings','shuffleMode','repeatMode','trackHistory','playCounts']);
 const available=useMemo(()=>new Set(a.tracks.filter(t=>(!a.settings.musicOffline||canPlayOffline(t))&&(!a.shuffleMode||isLibraryTrack(t))).map(t=>t.id)),[a.tracks,a.settings.musicOffline,a.shuffleMode]);
 const library=useMemo(()=>a.tracks.filter(isLibraryTrack).map(t=>t.id),[a.tracks]);
 const pool=useMemo(()=>(a.queueSource?.pool||library).filter(id=>available.has(id)),[library,a.queueSource,available]),at=pool.indexOf(a.currentTrackId||'');
 const upcoming=useMemo(()=>{const scope=new Set(pool);return [...new Set(a.musicQueue)].filter(id=>available.has(id)&&scope.has(id)&&id!==a.currentTrackId);},[a.musicQueue,pool,a.currentTrackId,available]);
 const next=()=>{const result=nextMusicSelection({tracks:a.tracks,currentId:a.currentTrackId,queue:a.musicQueue,sourcePool:a.queueSource?.pool,shuffle:a.shuffleMode,repeat:a.repeatMode,history:a.trackHistory,counts:a.playCounts,offline:a.settings.musicOffline},true);if(result.id){a.setMusicQueue(result.queue);a.playTrack(result.id,true);}};
 // History is a playback trail, not a library filter. A discovery preview can be
 // the actual previous recording even while the next songs come from a playlist.
 const previousId=a.trackHistory.find(id=>id!==a.currentTrackId&&a.tracks.some(t=>t.id===id&&(!a.settings.musicOffline||canPlayOffline(t))))||pool[at-1];
 return {next,previous:()=>{if(previousId)a.playTrack(previousId,true);},upcoming,hasNext:upcoming.length>0||(a.repeatMode==='all'&&pool.length>0),hasPrevious:!!previousId};
}
