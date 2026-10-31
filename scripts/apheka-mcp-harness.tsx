import AnimatedWallpaper from '../src/components/AnimatedWallpaper';
import React,{useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useApp} from '../src/store/AppContext';
import McpBridge,{type McpTransport} from '../src/components/McpBridge';
import GlobalPlayer from '../src/components/GlobalPlayer';
import NowPlayingView from '../src/components/NowPlayingView';
import {useFullscreenLifecycle,windowFullscreen} from '../src/hooks/useWindowFullscreen';
import {globalAudio} from '../src/store/AppContext';
import Notas from '../src/components/views/Notas';
import Cursos from '../src/components/views/Cursos';
let handler:((request:any)=>void)|undefined,sequence=0;
const pending=new Map<string,(result:any)=>void>();
const claimed=new Set<string>();
const port:McpTransport={
  async listen(callback){handler=callback;return()=>{if(handler===callback)handler=undefined;};},
  async invoke<T>(command:string,args:any):Promise<T>{
    if(command==='mcp_register')return undefined as T;
    if(command==='mcp_claim'){const valid=pending.has(args.requestId)&&!claimed.has(args.requestId);claimed.add(args.requestId);return valid as T;}
    if(command==='mcp_resolve'){pending.get(args.requestId)?.(args.result);pending.delete(args.requestId);return undefined as T;}
    throw new Error(command);
  },
};
const reportPlaybackError=()=>{};
function PlaybackQa(){const app=useApp();useFullscreenLifecycle(reportPlaybackError);return <><button onClick={()=>app.playTrack(app.tracks[0]?.id)}>Reproducir prueba QA</button><button onClick={()=>void windowFullscreen.toggle()}>Pantalla completa QA</button><button onClick={()=>void windowFullscreen.exit()}>Salir QA</button><button onClick={()=>app.setCoverModalTrackId(app.currentTrackId)}>Portada QA</button><GlobalPlayer sidebarCollapsed={false}/><NowPlayingView sidebarCollapsed={false} activeView="musica"/></>;}
function Workspace({view,courseId}:{view?:string;courseId?:string}){const app=useApp();useLayoutEffect(()=>{(window as any).__mcpApp=app;(window as any).__qaAudio=globalAudio;});return <><McpBridge transport={port}/>{view==='wallpaper'?<AnimatedWallpaper/>:null}{view==='playback'?<PlaybackQa/>:null}{view==='notes'?<Notas/>:view==='course'?<Cursos initialCourseId={courseId}/>:null}</>;}
export async function mountMcp(view?:string,courseId?:string){const host=document.getElementById('root')!;createRoot(host).render(<React.StrictMode><AppProvider><Workspace view={view} courseId={courseId}/></AppProvider></React.StrictMode>);}
export function request(name:string,args:any={},options:{expired?:boolean;approval?:boolean}={}) {
  const requestId='qa-'+(++sequence);
  return new Promise<any>(resolve=>{pending.set(requestId,resolve);handler!({requestId,name,arguments:args,write:!['apheka_search_music','apheka_describe','apheka_overview','apheka_get','apheka_list','apheka_settings_get','apheka_read_resource','apheka_read_content'].includes(name),needsApproval:options.approval??['apheka_delete','apheka_timer_reset','apheka_subtask_remove'].includes(name),expiresAt:Date.now()+(options.expired?-1:55000)});});
}
