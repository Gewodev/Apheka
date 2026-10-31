import React,{useEffect,useRef,useState} from 'react';
import {clockAngles,clockValue,timeAtDial} from '../../lib/analogClock';
import {deadlineForClock} from '../../lib/timerSchedule';

export default function PomodoroClock({value,minutes,onChange}:{value:string;minutes:number;onChange:(time:string)=>void}) {
 const [now,setNow]=useState(()=>new Date());
 const svgRef=useRef<SVGSVGElement>(null);
 const drag=useRef<'hour'|'minute'|null>(null);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);
 const result=deadlineForClock(value,now);
 const target=result.deadline?new Date(result.deadline):new Date(now.getTime()+minutes*60000);
 const current=clockAngles(now),end=clockAngles(target);
 const move=(event:React.PointerEvent<SVGElement>)=>{
  if(!drag.current||!svgRef.current)return;
  const box=svgRef.current.getBoundingClientRect();
  const angle=Math.atan2(event.clientX-box.x-box.width/2,-(event.clientY-box.y-box.height/2))*180/Math.PI;
  onChange(clockValue(timeAtDial(angle,drag.current,now,target)));
 };
 const start=(hand:'hour'|'minute',event:React.PointerEvent<SVGElement>)=>{event.preventDefault();drag.current=hand;event.currentTarget.setPointerCapture(event.pointerId);move(event);};
 const key=(hand:'hour'|'minute',event:React.KeyboardEvent)=>{
  if(!['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  const direction=['ArrowUp','ArrowRight'].includes(event.key)?1:-1;
  const next=new Date(Math.max(now.getTime()+60000,Math.min(now.getTime()+120*60000,target.getTime()+direction*(hand==='hour'?60:1)*60000)));
  onChange(clockValue(next));
 };
 const hand=(which:'hour'|'minute',length:number)=> <g role="slider" tabIndex={0} aria-label={which==='hour'?'Aguja de las horas':'Aguja de los minutos'} aria-valuemin={1} aria-valuemax={120} aria-valuenow={Math.max(1,Math.round((target.getTime()-now.getTime())/60000))} aria-valuetext={`Finalizar a las ${clockValue(target)}`} className="pomodoro-clock-hand" transform={`rotate(${end[which]} 100 100)`} onPointerDown={e=>start(which,e)} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>key(which,e)}>
   <line x1="100" y1="107" x2="100" y2={100-length} stroke="transparent" strokeWidth="22"/>
   <line x1="100" y1="107" x2="100" y2={100-length} stroke="var(--accent)" strokeWidth={which==='hour'?4:2.5} strokeLinecap="round"/>
   <circle cx="100" cy={100-length} r="5" fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="1.5"/>
 </g>;
 return <div className="pomodoro-wall-clock">
  <svg ref={svgRef} viewBox="0 0 200 200" aria-label="Reloj para elegir la hora de finalización">
   <circle cx="100" cy="100" r="96" fill="var(--bg-base)" stroke="var(--workspace-line)"/>
   {Array.from({length:60},(_,i)=><line key={i} x1="100" y1={i%5===0?12:16} x2="100" y2={i%5===0?21:19} transform={`rotate(${i*6} 100 100)`} stroke="var(--text-tertiary)" opacity={i%5===0?.8:.35}/>)}
   {[12,3,6,9].map((n,i)=><text key={n} x={100+Math.sin(i*Math.PI/2)*70} y={104-Math.cos(i*Math.PI/2)*70} textAnchor="middle" fill="var(--text-secondary)" fontSize="12" fontFamily="var(--font-primary)">{n}</text>)}
   <g opacity=".35" pointerEvents="none"><line x1="100" y1="100" x2="100" y2="57" transform={`rotate(${current.hour} 100 100)`} stroke="var(--text-secondary)" strokeWidth="3"/><line x1="100" y1="100" x2="100" y2="35" transform={`rotate(${current.minute} 100 100)`} stroke="var(--text-secondary)" strokeWidth="2"/></g>
   {hand('hour',43)}{hand('minute',65)}<circle cx="100" cy="100" r="4" fill="var(--accent)" pointerEvents="none"/>
  </svg>
  <div className="pomodoro-clock-caption"><span>Ahora <strong>{clockValue(now)}</strong></span><span>Termina <strong>{clockValue(target)}</strong></span></div>
  <p>Mueve las agujas para elegir el final. Hasta 2 horas.</p>
 </div>;
}
