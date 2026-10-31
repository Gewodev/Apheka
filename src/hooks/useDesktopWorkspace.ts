import {useCallback,useEffect,useState} from 'react';
import {activateDesktop,addDesktop,removeDesktop,patchDesktop,readDesktops,type Desktop,type WorkspaceView} from '../lib/desktopWorkspace';
const flush=()=>window.dispatchEvent(new Event('apheka:flush-editors'));
export function useDesktopWorkspace(){
  const [state,setState]=useState(()=>{try{return readDesktops(localStorage.getItem('apheka_desktops_v1'),(localStorage.getItem('owa_active_view_v1')||'inicio') as WorkspaceView,localStorage.getItem('owa_selected_course_id'));}catch{return readDesktops(null);}});
  const current=state.desktops.find(d=>d.id===state.activeId)!;
  useEffect(()=>{try{localStorage.setItem('apheka_desktops_v1',JSON.stringify(state));}catch{}},[state]);
  const setView=useCallback((view:WorkspaceView)=>setState(s=>patchDesktop(s,{view})),[]);
  const update=useCallback((patch:Partial<Pick<Desktop,'name'|'view'|'courseId'|'noteId'|'taskId'|'companion'>>,id?:string)=>setState(s=>patchDesktop(s,patch,id)),[]);
  const activate=useCallback((id:string)=>{flush();setState(s=>activateDesktop(s,id));},[]);
  const add=useCallback((name?:string)=>{flush();const id=crypto.randomUUID();setState(s=>name?patchDesktop(addDesktop(s,id),{name},id):addDesktop(s,id));return id;},[]);
  const remove=useCallback((id:string)=>{flush();setState(s=>removeDesktop(s,id));},[]);
  return {state,current,view:current.view,setView,update,activate,add,remove};
}
