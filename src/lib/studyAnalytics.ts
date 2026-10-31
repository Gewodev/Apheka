export interface AnalyticsSession {
  type: string;
  startedAt: string;
  duration: number;
  pauseDuration?: number;
  isDistraction?: boolean;
}
export const seconds = (value: number | undefined): number => Number.isFinite(value) ? Math.max(0, value!) : 0;
export function productiveSessions<T extends AnalyticsSession>(sessions: T[]): T[] {
  return sessions.filter(s => (s.type === 'pomodoro' || s.type === 'chrono') && !s.isDistraction && seconds(s.duration) > 0 && Number.isFinite(Date.parse(s.startedAt)));
}
function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function generateWeekData(sessions: AnalyticsSession[], now = new Date()) {
  const focus = productiveSessions(sessions);
  const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  return Array.from({length:7}, (_, i) => {
    const date = new Date(now); date.setDate(date.getDate() - (6-i));
    const key = localDay(date);
    const day = focus.filter(s => localDay(new Date(s.startedAt)) === key);
    return {day:names[date.getDay()], date:key, sessions:day.length,
      productive:Math.round(day.reduce((sum,s)=>sum+seconds(s.duration),0)/60),
      paused:Math.round(day.reduce((sum,s)=>sum+seconds(s.pauseDuration),0)/60)};
  });
}
export function generateHourData(sessions: AnalyticsSession[]) {
  const focus = productiveSessions(sessions);
  return Array.from({length:24}, (_,i)=>{
    const items=focus.filter(s=>new Date(s.startedAt).getHours()===i);
    const duration=items.reduce((sum,s)=>sum+seconds(s.duration),0);
    const paused=items.reduce((sum,s)=>sum+seconds(s.pauseDuration),0);
    return {hour:`${String(i).padStart(2,'0')}:00`,completions:items.length,
      avgDuration:items.length?Math.round(duration/items.length/60):0,
      efficiency:items.length?Math.round(duration/(duration+paused)*100):null};
  });
}
