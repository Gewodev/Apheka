export type ActivityDay={date:string;weekday:number;minute:number};
export type HabitReminderConfig={enabled:boolean;lead:60|120;fallback:number};
export const HABIT_REMINDER_KEY='apheka_habit_reminder';
export const HABIT_ACTIVITY_KEY='apheka_habit_activity';
export function activityPoint(now:Date):ActivityDay{
 const day=new Date(now);const minute=now.getHours()*60+now.getMinutes();if(minute<240)day.setDate(day.getDate()-1);
 return {date:`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`,weekday:day.getDay(),minute:minute<240?minute+1440:minute};
}
export function estimateDayEnd(history:ActivityDay[],weekday:number,fallback:number){
 const valid=history.filter(d=>d&&typeof d==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&Number.isFinite(d.minute)&&d.minute>=240&&d.minute<1680);
 const same=valid.filter(d=>d.weekday===weekday),sample=same.length>=3?same:valid;
 if(sample.length<3)return {minute:fallback,learned:false,samples:sample.length};
 const sorted=sample.map(d=>d.minute).sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
 return {minute:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,learned:true,samples:sample.length};
}
export function readHabitReminder():HabitReminderConfig{try{const v=JSON.parse(localStorage.getItem(HABIT_REMINDER_KEY)||'null');return {enabled:true,lead:v?.lead===120?120:60,fallback:Number.isFinite(v?.fallback)?Math.max(240,Math.min(1679,v.fallback)):1320};}catch{return {enabled:true,lead:60,fallback:1320};}}
