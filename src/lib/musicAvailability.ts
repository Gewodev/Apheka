import type {Track} from '../store/AppContext';
export const canPlayOffline=(track:Track|undefined)=>!!track&&(track.source==='local'||!!track.localAudioPath);
