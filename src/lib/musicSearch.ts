export const musicText=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const connectors=new Set(['de','by','por','cancion','song','tema','official','oficial','audio']);
export const cleanMusicQuery=(query:string)=>musicText(query).split(' ').filter(word=>!connectors.has(word)).join(' ');
/** Parse only popularity supplied by the catalog, including localized compact counts. */
export function musicPlayCount(value:unknown):number{
 if(typeof value==='number')return Number.isFinite(value)?Math.max(0,value):0;
 if(typeof value!=='string')return 0;
 const match=value.toLowerCase().replace(/\u00a0/g,' ').match(/(\d[\d.,\s]*?)\s*(mil millones|billions?|b|millones|millions?|m|mil|thousands?|k)(?:\s|$)|([\d][\d.,\s]*)/);
 if(!match)return 0;if(match[3])return Number(match[3].replace(/\D/g,''))||0;
 const unit=match[2],factor=/^(mil millones|b)/.test(unit)?1e9:/^(millones|million|m$)/.test(unit)?1e6:1e3;
 const number=Number(match[1].replace(/\s/g,'').replace(',','.'));return Number.isFinite(number)?Math.round(number*factor):0;
}
export function wordDistance(a:string,b:string){if(Math.abs(a.length-b.length)>2)return 99;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next[j+1]=Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1));row=next;}return row[b.length];}
/** Every meaningful query term must match: a correct title cannot hide a wrong artist. */
export function musicRelevance(query:string,title:string,artist:string){
 const q=cleanMusicQuery(query),t=cleanMusicQuery(title),a=cleanMusicQuery(artist);
 if(!q)return 1;if(a===q||t===q)return 100;if(a.startsWith(q)||t.startsWith(q))return 90;
 const tokens=q.split(' '),words=(a+' '+t).split(' ');let score=0;
 for(const token of tokens){if(words.includes(token))score+=12;else if(token.length>=4&&words.some(word=>wordDistance(token,word)<=1))score+=8;else return 0;}
 return 50+score/tokens.length;
}
export function requestedRecording(query:string,title:string,album=''){
 const q=musicText(query),text=musicText(title+' '+album);
 const variants=['karaoke','tribute','slowed','sped up','nightcore','8d','cover','remix','podcast','interview','entrevista','tutorial','reaction','reaccion','sound effect','efecto de sonido','audiobook','audiolibro','full album','album completo','compilation','compilacion'];
 return !variants.some(variant=>new RegExp('(?:^| )'+variant+'(?: |$)').test(text)&&!q.includes(variant));
}
export function curateSongs<T extends {title:string;artist:string;duration:number;cover:string;album?:string}>(items:T[],query=''){
 const ranked=items.filter(item=>item.artist.trim()&&item.duration>=20&&item.duration<=7200&&requestedRecording(query,item.title,item.album)&&(!query||musicRelevance(query,item.title,item.artist)>0))
 .map((item,index)=>({item,index,score:musicRelevance(query,item.title,item.artist)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const result:T[]=[];for(const {item} of ranked){const name=musicText(item.title.replace(/\([^)]*(?:remaster|official)[^)]*\)/gi,'')),artist=musicText(item.artist.replace(/\s*-\s*Topic$/i,''));if(!result.some(other=>musicText(other.title.replace(/\([^)]*(?:remaster|official)[^)]*\)/gi,''))===name&&musicText(other.artist.replace(/\s*-\s*Topic$/i,''))===artist&&Math.abs(other.duration-item.duration)<=5))result.push(item);}
 return result;
}

