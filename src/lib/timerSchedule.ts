export function remainingToDeadline(deadline:number,now=Date.now()):number {
  return Number.isFinite(deadline) ? Math.max(0,Math.ceil((deadline-now)/1000)) : 0;
}
export function deadlineForClock(time:string,now=new Date()):{deadline:number|null;seconds:number;error:string|null} {
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return {deadline:null,seconds:0,error:'Selecciona una hora válida.'};
  const [hours,minutes]=time.split(':').map(Number);const target=new Date(now);target.setHours(hours,minutes,0,0);
  if(target.getTime()<=now.getTime() && now.getHours()>=22 && hours<2) target.setDate(target.getDate()+1);
  const seconds=remainingToDeadline(target.getTime(),now.getTime());
  if(seconds<=0)return {deadline:null,seconds:0,error:'Esa hora ya pasó. Elige una hora futura.'};
  if(seconds>7200)return {deadline:null,seconds:0,error:'La hora debe estar dentro de las próximas dos horas.'};
  return {deadline:target.getTime(),seconds,error:null};
}
