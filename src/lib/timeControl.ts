export function clockMinutes(value:string):number|null {
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return null;
 const [hour,minute]=value.split(':').map(Number);return hour*60+minute;
}
export function clockFromMinutes(value:number):string {
 const minutes=Number.isFinite(value)?Math.max(0,Math.min(1439,Math.round(value))):0;
 return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
export function shiftClock(value:string,delta:number):string {return clockFromMinutes((clockMinutes(value)??540)+delta);}
export function sessionTimingError(date:string,start:string,duration:number,until?:string):string|null {
 const parsed=new Date(date+'T12:00:00');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.getFullYear()!==Number(date.slice(0,4))||parsed.getMonth()+1!==Number(date.slice(5,7))||parsed.getDate()!==Number(date.slice(8,10)))return 'Selecciona una fecha válida.';
 const minutes=clockMinutes(start);if(minutes===null)return 'Selecciona una hora de inicio válida.';
 if(!Number.isFinite(duration)||duration<5||duration>240)return 'La duración debe estar entre 5 y 240 minutos.';
 if(minutes+duration>1440)return 'La sesión debe terminar dentro del mismo día. Ajusta su hora o duración.';
 if(until&&until<date)return 'El final de la repetición no puede ser anterior a la sesión.';
 return null;
}
