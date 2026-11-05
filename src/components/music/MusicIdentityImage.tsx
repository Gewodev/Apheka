import {useEffect,useState} from 'react';
import {Music2,UserRound} from 'lucide-react';
/** A stable image slot, including absent and failed remote covers. */
export default function MusicIdentityImage({src,name,kind='artist'}:{src?:string;name:string;kind?:'artist'|'song'}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
 const Icon=kind==='artist'?UserRound:Music2;
 return <span className={'music-identity-image music-identity-'+kind} aria-hidden="true" title={name}>{src&&!failed?<img src={src} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<Icon size={kind==='artist'?44:19} strokeWidth={1.3}/>}</span>;
}
