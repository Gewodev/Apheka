/** Match complete credited names, including collaborations, without substring identity guesses. */
export const artistKey=(name:string)=>name.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/\s*[-–]\s*topic\s*$/i,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function creditedArtist(credits:string,name:string){
 const key=artistKey(name);if(!key)return false;
 const whole=artistKey(credits);if(whole===key)return true;
 return credits.split(/[,;]/).some(credit=>artistKey(credit)===key||credit.split(/\s*(?:\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bcon\b|\band\b|\bx\b|&|\by\b)\s*/i).some(part=>artistKey(part)===key));
}
export type SavedMusicArtist={id:string;name:string;profileImage?:string;catalogId?:string;origin?:'catalog';trackIds?:string[]};
export function pinnedArtists(artists:SavedMusicArtist[]){
 const names=new Set<string>();return artists.filter(artist=>{const key=artistKey(artist.name);if(!key||names.has(key)||(!artist.origin&&!artist.profileImage&&!artist.catalogId))return false;names.add(key);return true;});
}
