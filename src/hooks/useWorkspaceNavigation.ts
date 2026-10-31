import {useCallback,useEffect,useState} from 'react';
import type {WorkspaceView} from '../lib/desktopWorkspace';
type Route={view:WorkspaceView;courseId:string|null;noteId?:string;taskId?:string};
const views=new Set(['inicio','estudio','tareas','notas','musica','planificacion','cursos','curso_detalle','ajustes']);
export function readWorkspaceRoute():Route {
 try{const current=JSON.parse(localStorage.getItem('apheka_route_v2')||'null');if(current&&views.has(current.view))return current;
 const old=JSON.parse(localStorage.getItem('apheka_desktops_v1')||'null'),active=old?.desktops?.find((d:any)=>d.id===old.activeId);
 const view=active?.view||localStorage.getItem('owa_active_view_v1')||'inicio';return {view:views.has(view)?view:'inicio',courseId:active?.courseId||localStorage.getItem('owa_selected_course_id'),noteId:active?.noteId,taskId:active?.taskId};
 }catch{return {view:'inicio',courseId:null};}
}
export function useWorkspaceNavigation(){const [current,setCurrent]=useState(readWorkspaceRoute);
 useEffect(()=>{try{localStorage.setItem('apheka_route_v2',JSON.stringify(current));localStorage.setItem('owa_active_view_v1',current.view);}catch{}},[current]);
 const setView=useCallback((view:WorkspaceView)=>{window.dispatchEvent(new Event('apheka:flush-editors'));setCurrent(route=>route.view===view?route:{...route,view});},[]);
 const update=useCallback((patch:Partial<Route>)=>setCurrent(route=>Object.entries(patch).every(([key,value])=>route[key as keyof Route]===value)?route:{...route,...patch}),[]);
 return {current,view:current.view,setView,update};
}
