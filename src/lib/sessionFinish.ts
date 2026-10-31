export function finishForMinutes(minutes:number,now=Date.now()){
 const seconds=Math.round(Math.max(1,Math.min(120,minutes))*60);
 return {seconds,deadline:now+seconds*1000};
}
export function finishForTime(time:string,now=Date.now()){
 if(!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))throw Error('Elige una hora válida.');
 const [hour,minute,second=0]=time.split(':').map(Number),end=new Date(now);end.setHours(hour,minute,second,0);
 if(end.getTime()<=now)end.setDate(end.getDate()+1);
 const seconds=Math.round((end.getTime()-now)/1000);
 if(seconds<1||seconds>7200)throw Error('El final debe estar dentro de las próximas dos horas.');
 return {seconds,deadline:end.getTime(),fixedEnd:true};
}
export const exactClock=(deadline:number)=>{const d=new Date(deadline);return [d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');};
