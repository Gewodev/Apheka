/**
 * Find another public recording of the same song when the first one cannot be
 * used (the owner does not allow it in external apps, the file is gated or the
 * recording is unavailable).
 *
 * The search never evades a restriction: the blocked recording is never reused,
 * only a different public recording of the same song is looked for, and the
 * identity of the song is always verified (title, credited artist and duration).
 */

import {musicText} from './musicSearch';
import {recordingUnavailable} from './recordingAvailability';

export interface SongIdentity {
  title: string;
  artist: string;
  duration?: number;
}

export interface CandidateSong extends SongIdentity {
  id: string;
  cover?: string;
  duration: number;
}

const clean=(value:string)=>musicText(String(value||'').replace(/\s*-\s*Topic$/i,'').trim());

/** Title without the usual "official", "lyrics" or "remastered" decorations. */
export const titleKey=(value:string)=>clean(String(value||'')
  .replace(/\s*[([][^)\]]*(?:official|oficial|music video|lyrics?|audio|remaster(?:ed)?|hd|hq)[^)\]]*[)\]]/gi,''))
  .replace(/\s*-\s*\d{4}\s*remaster.*$/i,'');

/** Credits split into the names they really contain. */
export function artistNames(value:string){
  return String(value||'').split(/[,;]|\s+(?:feat|ft|featuring|with|con|&)\s+/i)
    .map(part=>clean(part)).filter(part=>part.length>1);
}

const durationFits=(candidate:number|undefined,wanted:number|undefined)=>{
  if(!candidate||!wanted)return true;
  const difference=Math.abs(candidate-wanted);
  return difference<=8||difference/ Math.max(candidate,wanted)<=0.12;
};

/**
 * Accept a candidate when it is the same song. `exact` is the same title and
 * the same credited artist; `loose` also accepts the artist appearing among
 * the credits of the recording (collaborations and remasters).
 */
export function matchesSameSong(candidate:SongIdentity,wanted:SongIdentity):'exact'|'loose'|false{
  if(titleKey(candidate.title)!==titleKey(wanted.title))return false;
  if(!durationFits(candidate.duration,wanted.duration))return false;
  const candidateNames=artistNames(candidate.artist),wantedNames=artistNames(wanted.artist);
  if(!wantedNames.length||!candidateNames.length)return false;
  if(candidateNames.some(name=>wantedNames.includes(name)))return 'exact';
  const loose=candidateNames.some(name=>wantedNames.some(other=>name.includes(other)||other.includes(name)));
  return loose?'loose':false;
}

/** Best candidate for the same song, preferring the strongest match. */
export function pickAlternative<T extends CandidateSong>(candidates:T[],wanted:SongIdentity,excluded:Set<string>=new Set()){
  let best:{song:T;rank:'exact'|'loose'}|null=null;
  for(const candidate of candidates){
    if(!candidate?.id||excluded.has(candidate.id)||recordingUnavailable(candidate.id))continue;
    const rank=matchesSameSong(candidate,wanted);
    if(!rank)continue;
    if(!best||rank==='exact'&&best.rank==='loose')best={song:candidate,rank};
  }
  return best?.song??null;
}
