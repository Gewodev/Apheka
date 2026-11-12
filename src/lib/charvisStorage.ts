import {get,set} from 'idb-keyval';
import {invoke,isTauri} from '@tauri-apps/api/core';
type Envelope={__charvisEncrypted:1;mode:'windows-dpapi'|'aes-gcm';data:string;iv?:string};
const encode=(bytes:Uint8Array)=>{let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);};
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
let keyPromise:Promise<CryptoKey>|undefined;
function browserKey(){return keyPromise||(keyPromise=(async()=>{const saved=await get<CryptoKey>('apheka_charvis_browser_key');if(saved)return saved;const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await set('apheka_charvis_browser_key',key);return key;})());}
const stringify=(value:unknown)=>JSON.stringify(value,(_key,v)=>v instanceof Uint8Array?{__charvisBytes:encode(v)}:v);
const parse=(value:string)=>JSON.parse(value,(_key,v)=>v&&typeof v==='object'&&typeof v.__charvisBytes==='string'&&Object.keys(v).length===1?decode(v.__charvisBytes):v);
export async function protectedSet(key:string,value:unknown){
 const plain=stringify(value);let envelope:Envelope;
 if(isTauri())envelope={__charvisEncrypted:1,mode:'windows-dpapi',data:await invoke<string>('charvis_vault',{operation:'seal',value:plain})};
 else{const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await browserKey(),new TextEncoder().encode(plain));envelope={__charvisEncrypted:1,mode:'aes-gcm',iv:encode(iv),data:encode(new Uint8Array(data))};}
 await set(key,envelope);
}
export async function protectedGet<T>(key:string):Promise<T|undefined>{
 const saved=await get<T|Envelope>(key);if(saved===undefined)return undefined;
 if((saved as Envelope)?.__charvisEncrypted!==1){await protectedSet(key,saved);return saved as T;}
 const item=saved as Envelope;let plain:string;
 if(item.mode==='windows-dpapi'){if(!isTauri())throw Error('Este historial está protegido por la cuenta de Windows de POUH.');plain=await invoke('charvis_vault',{operation:'open',value:item.data});}
 else{const key=await get<CryptoKey>('apheka_charvis_browser_key');if(!key)throw Error('Falta la clave local del historial de este navegador.');plain=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(item.iv!)},key,decode(item.data)));}
 return parse(plain) as T;
}
