import {invoke,isTauri} from '@tauri-apps/api/core';
import {CHARVIS_PROVIDERS,charvisConfig} from './charvis';
import {get,set} from 'idb-keyval';
/** Move old plaintext credentials into the OS vault only after a successful write. */
export async function migrateLegacyCharvis(){
 if(!isTauri())return;
 let states:Record<string,any>;try{states=JSON.parse(localStorage.getItem('owa_charvis_providers_v1')||'{}');}catch{return;}
 for(const provider of CHARVIS_PROVIDERS){const old=states[provider.id];if(!old||typeof old.apiKey!=='string'||!old.apiKey.trim())continue;
  try{const status=await invoke<{configured:boolean}>('charvis_credential',{provider:provider.id,action:'status'});if(!status.configured)await invoke('charvis_credential',{provider:provider.id,action:'save',apiKey:old.apiKey});delete old.apiKey;old.validatedAt=null;localStorage.setItem('owa_charvis_providers_v1',JSON.stringify(states));const current=charvisConfig.getSnapshot();if(!current.models[provider.id]&&typeof old.model==='string')charvisConfig.save({models:{...current.models,[provider.id]:old.model}});}catch{/* Retain the legacy entry if secure storage fails; never lose the user's key. */}
 }
}
export async function loadCharvisHistory(){
 const saved=await get<any[]>('apheka_charvis_history_v1');if(Array.isArray(saved))return saved;
 try{const old=JSON.parse(localStorage.getItem('owa_brain_messages_v1')||'[]');if(!Array.isArray(old))return [];const converted=old.filter(item=>item&&item.id!=='welcome'&&['user','assistant'].includes(item.role)&&typeof item.content==='string').slice(-100).map(item=>({id:item.id||crypto.randomUUID(),message:{role:item.role,content:item.content.slice(0,60000)}}));if(converted.length){await set('apheka_charvis_history_v1',converted);localStorage.removeItem('owa_brain_messages_v1');}return converted;}catch{return [];}
}
