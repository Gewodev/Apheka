import {useAppSlice} from "../../store/AppContext";
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useApp, fmtClock } from '../../store/AppContext';
import LiveClock from './LiveClock';

function WorkspaceClock({now,className=''}:{now?:Date;className?:string}) {
 const {settings}=useAppSlice(["settings"]);
 const face=(date:Date)=>{
  const formatted=fmtClock(format(date,'HH:mm'),settings.timeFormat);
  const period=formatted.match(/(am|pm)$/)?.[1];
  return <><div className="workspace-clock-face"><time className="workspace-clock-digits" dateTime={date.toISOString()}>{formatted.replace(/(am|pm)$/,'')}</time>{period&&<span className="workspace-clock-period">{period}</span>}<span className="workspace-clock-seconds" aria-hidden="true">{format(date,'ss')}</span></div><span className="workspace-clock-date">{format(date,"EEE, d 'de' MMM",{locale:es})}</span></>;
 };
 return <div className={`workspace-clock ${className}`}>{now?face(now):<LiveClock>{face}</LiveClock>}</div>;
}

export default React.memo(WorkspaceClock);
