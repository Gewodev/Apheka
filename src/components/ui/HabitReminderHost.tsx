import {useEffect} from 'react';
import {useAppSnapshot} from '../../store/AppContext';
import {activityPoint,estimateDayEnd,HABIT_ACTIVITY_KEY,readHabitReminder} from '../../lib/habitRhythm';
import {canNotifyItem,sendNativeNotification} from '../../lib/notifications';
export default function HabitReminderHost(){const snapshot=useAppSnapshot();useEffect(()=>{
 let lastWrite=0;let history:ReturnType<typeof activityPoint>[]=[];
 try{const value=JSON.parse(localStorage.getItem(HABIT_ACTIVITY_KEY)||'[]');if(Array.isArray(value))history=value.filter(d=>d&&typeof d==='object'&&typeof d.date==='string'&&Number.isFinite(d.minute)&&Number.isInteger(d.weekday)).slice(-40);}catch{}
 const record=()=>{if(!readHabitReminder().enabled||document.hidden||Date.now()-lastWrite<300000)return;lastWrite=Date.now();const point=activityPoint(new Date());history=[...history.filter(d=>d.date!==point.date),point].slice(-40);try{localStorage.setItem(HABIT_ACTIVITY_KEY,JSON.stringify(history));}catch{}};
 const check=()=>{const app=snapshot(),config=readHabitReminder();if(!config.enabled||app.settings.notifications===false)return;
  const now=activityPoint(new Date()),past=history.filter(d=>d.date<now.date),end=estimateDayEnd(past,now.weekday,config.fallback);
  if(now.minute<end.minute-config.lead||now.minute>end.minute+60||!app.habits.some(h=>!h.isArchived&&!h.completedOn.includes(now.date)))return;
  if(canNotifyItem('habit-reminder-'+now.date,26*3600000))void sendNativeNotification('Un momento para tus hábitos','Registra lo que hiciste hoy antes de cerrar tu jornada.',{kind:'habits',date:now.date});
 };
 for(const name of ['pointerdown','keydown','wheel'])window.addEventListener(name,record,{passive:true});
 const timer=window.setInterval(check,60000);check();
 return()=>{clearInterval(timer);for(const name of ['pointerdown','keydown','wheel'])window.removeEventListener(name,record);};
 },[snapshot]);return null;}
