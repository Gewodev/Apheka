export const SCHEDULE_COMMAND_EVENT='apheka:toggle-schedule-preview';
export const SCHEDULE_SHORTCUT_EVENT='apheka:schedule-shortcut';
export const SCHEDULE_SHORTCUTS=['Ctrl+Shift+H','Ctrl+Alt+H','Alt+H','Desactivado'] as const;
export function readScheduleShortcut():string {try{const v=localStorage.getItem('apheka_schedule_shortcut');return SCHEDULE_SHORTCUTS.includes(v as any)?v!:'Ctrl+Shift+H';}catch{return 'Ctrl+Shift+H';}}
export function saveScheduleShortcut(value:string){if(!SCHEDULE_SHORTCUTS.includes(value as any))return;localStorage.setItem('apheka_schedule_shortcut',value);window.dispatchEvent(new Event(SCHEDULE_SHORTCUT_EVENT));}
export function matchesScheduleShortcut(event:KeyboardEvent,value:string){
 if(event.repeat||event.isComposing||event.metaKey||event.getModifierState('AltGraph')||event.code!=='KeyH')return false;
 return value==='Ctrl+Shift+H'?event.ctrlKey&&event.shiftKey&&!event.altKey:value==='Ctrl+Alt+H'?event.ctrlKey&&event.altKey&&!event.shiftKey:value==='Alt+H'?event.altKey&&!event.ctrlKey&&!event.shiftKey:false;
}
