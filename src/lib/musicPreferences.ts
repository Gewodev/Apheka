import type {Track} from '../store/AppContext';
import {cleanMusicQuery,musicRelevance,musicText} from './musicSearch';

export type MusicSearchMemory={query:string;artists:string[];count:number;lastAt:number};
export const MUSIC_SEARCH_MEMORY='apheka_music_searches_v1';
const MAX_SEARCHES=40;
type StorageReader=Pick<Storage,'getItem'>;
type StorageWriter=StorageReader&Pick<Storage,'setItem'>;
const artistKey=(name:string)=>musicText(name.replace(/\s*-\s*Topic$/i,''));
const knownArtist=(name:string)=>!!artistKey(name)&&!['unknown artist','unknown','artista desconocido','various artists','varios artistas','artista de audius'].includes(artistKey(name));
const storage=()=>{try{return typeof window!=='undefined'?window.localStorage:undefined;}catch{return undefined;}};

/** Local, bounded history survives restarts; malformed entries never become preferences. */
export function readMusicSearchMemory(source:StorageReader|undefined=storage()):MusicSearchMemory[]{
  try{
    const value=JSON.parse(source?.getItem(MUSIC_SEARCH_MEMORY)||'[]');if(!Array.isArray(value))return [];
    const seen=new Set<string>();
    return value.flatMap(row=>{
      if(!row||typeof row.query!=='string'||!Number.isFinite(row.lastAt)||row.lastAt<=0)return [];
      const query=row.query.trim().slice(0,200),key=cleanMusicQuery(query);if(key.length<3||seen.has(key))return [];seen.add(key);
      return [{query,artists:Array.isArray(row.artists)?row.artists.filter((name:unknown):name is string=>typeof name==='string'&&knownArtist(name)).slice(0,4).map((name:string)=>name.slice(0,120)):[],count:Math.max(1,Math.min(1000,Number(row.count)||1)),lastAt:Math.min(Date.now(),row.lastAt)}];
    }).sort((a,b)=>b.lastAt-a.lastAt).slice(0,MAX_SEARCHES);
  }catch{return [];}
}

export function rememberMusicSearch(query:string,artists:string[],target:StorageWriter|undefined=storage(),now=Date.now()):void{
  const clean=cleanMusicQuery(query);if(clean.length<3||!target)return;
  const previous=readMusicSearchMemory(target),same=previous.find(row=>cleanMusicQuery(row.query)===clean);
  // A completed search replaces a recent typed prefix, rather than filling history with fragments.
  const rest=previous.filter(row=>{const key=cleanMusicQuery(row.query);return key!==clean&&!(now-row.lastAt<600000&&clean.startsWith(key+' '));});
  const row:MusicSearchMemory={query:query.trim().slice(0,200),artists:[...new Set(artists.filter(knownArtist))].slice(0,4),count:Math.min(1000,(same?.count||0)+1),lastAt:now};
  try{target.setItem(MUSIC_SEARCH_MEMORY,JSON.stringify([row,...rest].slice(0,MAX_SEARCHES)));}catch{/* Preference persistence must never interrupt playback. */}
}

type Preferences={tracks:Track[];history?:string[];playCounts?:Record<string,number>};
/** Familiar artists break relevance ties; a preference never outranks the requested title/artist. */
export function rankMusicSearch<T extends {title:string;artist:string;duration:number;playCount?:number;genre?:string}>(songs:T[],query:string,preferences:Preferences,searches=readMusicSearchMemory()):T[]{
 const artists=artistPreferences(preferences,searches,Date.now());
 return songs.map((song,index)=>({song,index,relevance:musicRelevance(query,song.title,song.artist),taste:artists.get(artistKey(song.artist))?.score||0}))
 .sort((a,b)=>b.relevance-a.relevance||b.taste-a.taste||(b.song.playCount||0)-(a.song.playCount||0)||a.index-b.index).map(row=>row.song);
}
function artistPreferences(preferences:Preferences,searches:MusicSearchMemory[],now:number){
  const artists=new Map<string,{name:string;score:number}>(),recent=new Map<string,number>();(preferences.history||[]).slice(0,30).forEach((id,index)=>{if(!recent.has(id))recent.set(id,index);});
  const add=(name:string,score:number)=>{if(!knownArtist(name)||score<=0)return;const key=artistKey(name),previous=artists.get(key);artists.set(key,{name:name.replace(/\s*-\s*Topic$/i,'').trim(),score:(previous?.score||0)+score});};
  for(const track of preferences.tracks){
    const index=recent.get(track.id),count=Math.max(0,preferences.playCounts?.[track.id]||0),minutes=Math.max(0,track.listenedTime||0)/60;
    add(track.artist,(track.librarySaved!==false?1:0)+(track.isFavorite?6:0)+Math.min(6,Math.log2(1+minutes))+Math.min(4,Math.log2(1+count))+(index===undefined?0:3/Math.sqrt(index+1)));
  }
  for(const search of searches){const freshness=1/(1+Math.max(0,now-search.lastAt)/7776000000);for(const name of search.artists)add(name,.6*freshness*Math.min(3,Math.log2(1+search.count)));}
  return artists;
}

/** At most three catalog requests, shared with the existing search cache. */
export function musicRecommendationSeeds(preferences:Preferences,searches=readMusicSearchMemory(),now=Date.now()):string[]{
  const artists=[...artistPreferences(preferences,searches,now).values()].sort((a,b)=>b.score-a.score);
  const queries=searches.map(row=>({query:row.query,score:(2+Math.min(4,Math.log2(1+row.count)))/(1+Math.max(0,now-row.lastAt)/7776000000)})).sort((a,b)=>b.score-a.score);
  const seeds:string[]=[],seen=new Set<string>();const add=(value?:string)=>{if(!value)return;const key=cleanMusicQuery(value);if(key&&!seen.has(key)){seen.add(key);seeds.push(value);}};
  add(artists[0]?.name);add(queries[0]?.query);
  const remaining=[...artists.slice(1).map(row=>({query:row.name,score:row.score})),...queries.slice(1)].sort((a,b)=>b.score-a.score);
  for(const row of remaining){if(seeds.length>=3)break;add(row.query);}
  return seeds;
}

/** Taste affects discovery only. Explicit search relevance remains authoritative. */
export function rankMusicRecommendations<T extends {title:string;artist:string;duration:number;playCount?:number;genre?:string}>(songs:T[],preferences:Preferences,searches=readMusicSearchMemory(),now=Date.now()):T[]{
  const genres=new Map<string,number>();
  for(const track of preferences.tracks){const genre=musicText(track.genre||'');if(genre)genres.set(genre,(genres.get(genre)||0)+1+(track.isFavorite?3:0)+Math.min(4,Math.log1p(preferences.playCounts?.[track.id]||0)));}
  const artists=artistPreferences(preferences,searches,now),saved=new Map<string,Track>(),recent=new Map<string,number>();
  const recording=(title:string,artist:string)=>cleanMusicQuery(title)+'|'+artistKey(artist);
  for(const track of preferences.tracks)saved.set(recording(track.title,track.artist),track);
  const byId=new Map(preferences.tracks.map(track=>[track.id,track]));
  (preferences.history||[]).slice(0,12).forEach((id,index)=>{const track=byId.get(id);if(track&&!recent.has(recording(track.title,track.artist)))recent.set(recording(track.title,track.artist),index);});
  const ranked=songs.map((song,index)=>{
    const key=recording(song.title,song.artist),owned=saved.get(key),recentIndex=recent.get(key);
    let score=Math.log1p(artists.get(artistKey(song.artist))?.score||0)*5+Math.min(4,Math.log10(1+Math.max(0,song.playCount||0)))*.9-(owned?.librarySaved!==false&&owned?3:0)-(recentIndex===undefined?0:8/(recentIndex+1));
    if(song.genre)score+=Math.min(3,Math.log1p(genres.get(musicText(song.genre))||0));
    for(const search of searches){if(musicRelevance(search.query,song.title,song.artist)>0)score+=3*Math.min(3,Math.log2(1+search.count))/(1+Math.max(0,now-search.lastAt)/7776000000);}
    return {song,index,score,key:artistKey(song.artist)};
  });
  const result:T[]=[],used=new Map<string,number>();let last='';
  while(ranked.length){
    let best=0,bestScore=-Infinity;
    for(let i=0;i<ranked.length;i++){const item=ranked[i],score=item.score-(used.get(item.key)||0)*3-(item.key===last?9:0);if(score>bestScore){best=i;bestScore=score;}}
    const [next]=ranked.splice(best,1);result.push(next.song);last=next.key;used.set(last,(used.get(last)||0)+1);
  }
  return result;
}
