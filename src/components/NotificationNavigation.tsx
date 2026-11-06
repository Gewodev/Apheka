import {useEffect} from 'react';
import {isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {useAppSnapshot} from '../store/AppContext';
import type {NotificationTarget} from '../lib/notifications';
export default function NotificationNavigation(){
 const snapshot=useAppSnapshot();
 useEffect(()=>{if(!isTauri())return;let disposed=false,remove:(()=>void)|undefined;
  void listen<NotificationTarget>('apheka:notification-open',({payload:target})=>{
   if(disposed||!target)return;const app=snapshot();
   switch(target.kind){
    case 'task':if(target.id)app.setFocusedTaskId(target.id);app.setNavigateTo('tareas');break;
    case 'event':case 'session':if(target.date&&/^\d{4}-\d{2}-\d{2}$/.test(target.date))sessionStorage.setItem('apheka_planner_focus_date',target.date);if(target.id)app.setFocusedEventId(target.id);app.setNavigateTo('flujo');break;
    case 'study':app.setNavigateTo('estudio');break;
    case 'tasks':app.setNavigateTo('tareas');break;
    case 'settings':app.setNavigateTo('ajustes');break;
    case 'downloads':sessionStorage.setItem('apheka_music_studio_default','"downloads"');app.setNavigateTo('musica');break;
    case 'music':app.setNavigateTo('musica');break;
   }
  }).then(unlisten=>{if(disposed)unlisten();else remove=unlisten;}).catch(error=>console.warn('No se pudo escuchar la apertura de avisos',error));
  return()=>{disposed=true;remove?.();};
 },[snapshot]);return null;
}
