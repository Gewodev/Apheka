export function clockValue(date: Date): string {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
export function clockAngles(date: Date) {
  return { hour: (date.getHours()%12)*30 + date.getMinutes()/2, minute: date.getMinutes()*6 };
}
// Pick a future minute on the dial, bounded to the two-hour session window.
// The closest candidate to the current selection avoids jumping an hour mid-drag.
export function timeAtDial(angle: number, hand: 'hour'|'minute', now: Date, selected: Date): Date {
  const normalized=((angle%360)+360)%360;
  const desired=hand==='minute'?Math.round(normalized/6)%60:Math.round(normalized/30)%12;
  const start=new Date(now); start.setSeconds(0,0);
  let best:Date|null=null; let score=Infinity;
  for(let minute=1;minute<=120;minute++) {
    const candidate=new Date(start.getTime()+minute*60000);
    const actual=hand==='minute'?candidate.getMinutes():candidate.getHours()%12;
    const size=hand==='minute'?60:12;
    const distance=Math.min(Math.abs(actual-desired),size-Math.abs(actual-desired));
    const minuteDistance=Math.abs(candidate.getMinutes()-selected.getMinutes());
    const value=distance*1e12+(hand==='hour'?minuteDistance*1e9:0)+Math.abs(candidate.getTime()-selected.getTime());
    if(value<score){score=value;best=candidate;}
  }
  return best!;
}
