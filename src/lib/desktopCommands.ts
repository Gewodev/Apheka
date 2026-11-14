import {readDesktops,type Companion,type DesktopState} from './desktopWorkspace';
export type DesktopCommand={action:'list'|'activate'|'create'|'rename'|'close'|'set_companion';id?:string;name?:string;companion?:Companion};
type Handler=(command:DesktopCommand)=>DesktopState;
const host=globalThis as typeof globalThis & {__aphekaDesktopCommands?:{handler:Handler|null}};
const registry=host.__aphekaDesktopCommands ||= {handler:null};
export function registerDesktopCommands(handler:Handler){registry.handler=handler;return()=>{if(registry.handler===handler)registry.handler=null;};}
export function desktopSnapshot(){if(registry.handler)return registry.handler({action:'list'});try{return readDesktops(localStorage.getItem('apheka_desktops_v1'));}catch{return readDesktops(null);}}
export function commandDesktop(command:DesktopCommand){if(!registry.handler)throw Error('Abre la ventana principal de West para modificar los escritorios.');return registry.handler(command);}
