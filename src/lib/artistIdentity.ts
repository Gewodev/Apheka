/** Match complete credited names, including collaborations, without substring identity guesses. */
export const artistKey=(name:string)=>name.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/\s*[-–]\s*topic\s*$/i,'').replace(/[–—]/g,'-').replace(/[^\p{L}\p{N}-]+/gu,' ').replace(/\s*-\s*/g,'-').trim();
export function creditedArtist(credits:string,name:string){
 const key=artistKey(name);if(!key)return false;
 const whole=artistKey(credits);if(whole===key)return true;
 return credits.split(/[,;]/).some(credit=>artistKey(credit)===key||credit.split(/\s*(?:\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bcon\b|\band\b|\bx\b|&|\by\b)\s*/i).some(part=>artistKey(part)===key));
}
export type SavedMusicArtist={id:string;name:string;profileImage?:string;catalogId?:string;origin?:'catalog';trackIds?:string[];catalogTrackIds?:string[];catalogSelection?:'all'|'selected';excludedTrackIds?:string[]};
export function pinnedArtists(artists:SavedMusicArtist[]){
 const names=new Set<string>();return artists.filter(artist=>{const key=artist.catalogId||artistKey(artist.name);if(!key||names.has(key)||(!artist.origin&&!artist.profileImage&&!artist.catalogId))return false;names.add(key);return true;});
}

export function libraryArtistMatch(track:{artist:string;artistCatalogIds?:string[]},artist:SavedMusicArtist){return track.artistCatalogIds?.length&&artist.catalogId?track.artistCatalogIds.includes(artist.catalogId):creditedArtist(track.artist,artist.name);}

export function artistCollectionMatch(track:{id:string;artist:string;artistCatalogIds?:string[];artistCollectionIds?:string[];librarySaved?:boolean},artist:SavedMusicArtist){
 if(artist.excludedTrackIds?.includes(track.id))return false;
 if(artist.trackIds?.includes(track.id))return true;
 if(artist.catalogSelection==='selected'&&artist.catalogTrackIds&&!artist.catalogTrackIds.includes(track.id))return false;
 return (track.librarySaved!==false||!!artist.catalogId&&!!track.artistCollectionIds?.includes(artist.catalogId))&&!!libraryArtistMatch(track,artist);
}
