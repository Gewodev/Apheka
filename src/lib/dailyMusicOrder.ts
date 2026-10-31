/** Stable for one local day and independent of playback, pagination and filter state. */
export function localMusicDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function dailyMusicOrder<T extends {id:string}>(tracks:readonly T[],day:string):T[]{
 const hash=(id:string)=>{let value=2166136261;for(const char of day+':'+id){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}value^=value>>>16;value=Math.imul(value,0x85ebca6b);value^=value>>>13;return value>>>0;};
 const ranks=new Map(tracks.map(track=>[track.id,hash(track.id)]));
 return [...tracks].sort((a,b)=>ranks.get(a.id)!-ranks.get(b.id)!||a.id.localeCompare(b.id));
}
