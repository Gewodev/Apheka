export const COMMAND_SHORTCUT_EVENT='pohu:command-shortcuts';
const KEY='pohu_command_shortcuts';
export const COMMAND_KEYS=['Desactivado',...['N','O','T','E','S','P','C','M','A','J','L'].map(key=>'Ctrl+Alt+'+key)];
export function readCommandShortcuts():Record<string,string>{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter(([id,key])=>id.length<30&&typeof key==='string'&&COMMAND_KEYS.includes(key))) as Record<string,string>:{};}catch{return {};}}
export function saveCommandShortcut(id:string,key:string){const values=readCommandShortcuts();if(!COMMAND_KEYS.includes(key))throw Error('Elige un atajo de la lista.');if(key!=='Desactivado'&&Object.entries(values).some(([other,value])=>other!==id&&value===key))throw Error('Ese atajo ya pertenece a otro comando.');localStorage.setItem(KEY,JSON.stringify({...values,[id]:key}));window.dispatchEvent(new Event(COMMAND_SHORTCUT_EVENT));}
export function shortcutCommand(event:KeyboardEvent,values:Record<string,string>){if(event.defaultPrevented||event.repeat||event.isComposing||event.getModifierState('AltGraph')||!event.ctrlKey||!event.altKey||event.shiftKey||event.metaKey)return null;return Object.entries(values).find(([,key])=>key!=='Desactivado'&&event.code==='Key'+key.slice(-1))?.[0]||null;}

