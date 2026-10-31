export const WORKSPACE_VIEWS=['inicio','estudio','tareas','notas','musica','planificacion','cursos','ia','ajustes','curso_detalle'] as const;
export type WorkspaceView=typeof WORKSPACE_VIEWS[number];
export const COMPANIONS=['none','timer','notes','tasks','lyrics'] as const;
export type Companion=typeof COMPANIONS[number];
export type Desktop={id:string;name:string;view:WorkspaceView;courseId:string|null;noteId:string|null;taskId:string|null;companion:Companion};
export type DesktopState={version:1;activeId:string;desktops:Desktop[]};
const isView=(value:unknown):value is WorkspaceView=>WORKSPACE_VIEWS.includes(value as WorkspaceView);
export function initialDesktops(view:WorkspaceView='inicio',courseId:string|null=null):DesktopState{
  view=isView(view)?view:'inicio';if(view==='curso_detalle'&&!courseId)view='cursos';
  return {version:1,activeId:'desk-1',desktops:[{id:'desk-1',name:'Estudio',view,courseId,noteId:null,taskId:null,companion:'none'},{id:'desk-2',name:'Organizar',view:'tareas',courseId:null,noteId:null,taskId:null,companion:'none'},{id:'desk-3',name:'Ideas',view:'notas',courseId:null,noteId:null,taskId:null,companion:'none'}]};
}
export function readDesktops(raw:string|null,view:WorkspaceView='inicio',courseId:string|null=null):DesktopState{
  try{const value=JSON.parse(raw||'null');if(value?.version!==1||!Array.isArray(value.desktops))return initialDesktops(view,courseId);
    const ids=new Set<string>(),desktops:Desktop[]=[];
    for(const d of value.desktops.slice(0,5)){if(!d||typeof d.id!=='string'||!/^[-\w]{1,80}$/.test(d.id)||ids.has(d.id)||!isView(d.view))continue;ids.add(d.id);const course=typeof d.courseId==='string'&&d.courseId.length<=256?d.courseId:null;
      desktops.push({id:d.id,name:typeof d.name==='string'&&d.name.trim()?d.name.trim().slice(0,28):'Escritorio '+(desktops.length+1),view:d.view==='curso_detalle'&&!course?'cursos':d.view,courseId:course,noteId:typeof d.noteId==='string'&&d.noteId.length<=256?d.noteId:null,taskId:typeof d.taskId==='string'&&d.taskId.length<=256?d.taskId:null,companion:COMPANIONS.includes(d.companion)?d.companion:'none'});}
    if(!desktops.length)return initialDesktops(view,courseId);return {version:1,activeId:ids.has(value.activeId)?value.activeId:desktops[0].id,desktops};
  }catch{return initialDesktops(view,courseId);}
}
export function patchDesktop(state:DesktopState,patch:Partial<Pick<Desktop,'name'|'view'|'courseId'|'noteId'|'taskId'|'companion'>>,id=state.activeId):DesktopState{
  patch=Object.fromEntries(Object.entries(patch).filter(([,value])=>value!==undefined));
  if(patch.view!==undefined&&!isView(patch.view))return state;
  if(patch.companion!==undefined&&!COMPANIONS.includes(patch.companion))return state;
  const current=state.desktops.find(d=>d.id===id);if(!current)return state;
  if(patch.name!==undefined){const name=patch.name.trim().slice(0,28);if(!name)return state;patch={...patch,name};}
  if(Object.entries(patch).every(([key,value])=>current[key as keyof Desktop]===value))return state;
  return {...state,desktops:state.desktops.map(d=>d.id===id?{...d,...patch}:d)};
}
export function activateDesktop(state:DesktopState,id:string):DesktopState{return state.activeId===id||!state.desktops.some(d=>d.id===id)?state:{...state,activeId:id};}
export function addDesktop(state:DesktopState,id:string):DesktopState{if(state.desktops.length>=5||state.desktops.some(d=>d.id===id)||!/^[-\w]{1,80}$/.test(id))return state;return {...state,activeId:id,desktops:[...state.desktops,{id,name:'Escritorio '+(state.desktops.length+1),view:'inicio',courseId:null,noteId:null,taskId:null,companion:'none'}]};}
export function removeDesktop(state:DesktopState,id:string):DesktopState{if(state.desktops.length<=1||!state.desktops.some(d=>d.id===id))return state;const desktops=state.desktops.filter(d=>d.id!==id);return {...state,activeId:state.activeId===id?desktops[0].id:state.activeId,desktops};}
