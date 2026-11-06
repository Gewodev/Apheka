import {recordingUnavailable} from './recordingAvailability';
import type {Track} from '../store/AppContext';
export const canPlayOffline=(track:Track|undefined)=>!!track&&(track.source==='local'||!!track.localAudioPath);

/** Only a confirmed provider restriction excludes a recording; network errors do not. */
export function canPlayTrack(track:Track|undefined,offline=false){
 if(!track)return false;if(canPlayOffline(track))return true;if(offline)return false;
 if(track.source==='youtube'){const id=(track.catalogId?.replace(/^ytm:/,'')||track.url?.match(/(?:[?&]v=|youtu\.be\/)([\w-]{11})/)?.[1]||'');return /^[\w-]{11}$/.test(id)&&!recordingUnavailable(id);}
 return !!track.url;
}
