import {ViewActivity} from '../../lib/viewActivity';
import React,{useCallback,useContext,useRef,useSyncExternalStore} from 'react';
import {wallClock} from '../../lib/wallClock';
export default function LiveClock({children}:{children:(now:Date)=>React.ReactNode}){const active=useContext(ViewActivity),last=useRef(wallClock.getSnapshot()),subscribe=useCallback((fn:()=>void)=>active?wallClock.subscribe(fn):()=>{},[active]);const now=useSyncExternalStore(subscribe,()=>active?(last.current=wallClock.getSnapshot()):last.current);return <>{children(new Date(now))}</>;}
