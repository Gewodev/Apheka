import {useEffect,useState} from 'react';
import {paletteFromImage} from '../lib/imagePalette';
type Palette=Awaited<ReturnType<typeof paletteFromImage>>;
const cache=new Map<string,Palette>(),pending=new Map<string,Promise<Palette>>();
function load(src:string){let task=pending.get(src);if(!task){task=paletteFromImage(src,true).then(value=>{if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(src,value);return value;}).finally(()=>pending.delete(src));pending.set(src,task);}return task;}
export function useCoverPalette(src?:string){
 const [palette,setPalette]=useState(()=>src?cache.get(src):undefined);
 useEffect(()=>{let live=true;setPalette(src?cache.get(src):undefined);if(src&&!cache.has(src))void load(src).then(value=>{if(live)setPalette(value);}).catch(()=>{});return()=>{live=false;};},[src]);
 return palette;
}
