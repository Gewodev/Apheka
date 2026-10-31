/** Only explicit IFrame API availability errors, never network or browser failures. */
const KEY='apheka_unavailable_recordings_v1';
type Entry={id:string;code:number;until:number};
let entries:Entry[]|undefined;
function load(){if(!entries){try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');entries=Array.isArray(value)?value.filter(row=>/^[\w-]{11}$/.test(row?.id)&&[100,101,150].includes(row?.code)&&Number.isFinite(row?.until)).slice(0,100):[];}catch{entries=[];}}return entries!;}
export function recordingUnavailable(id:string,now=Date.now()){return load().some(row=>row.id===id&&row.until>now);}
export function rememberUnavailableRecording(id:string,code:number,now=Date.now()){
 if(!/^[\w-]{11}$/.test(id)||![100,101,150].includes(code))return;
 entries=[{id,code,until:now+(code===100?86400000:7*86400000)},...load().filter(row=>row.id!==id&&row.until>now)].slice(0,100);
 try{localStorage.setItem(KEY,JSON.stringify(entries));}catch{}
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('apheka:recording-unavailable',{detail:{id}}));
}
