import {useCallback,useEffect,useRef,useState} from 'react';

/** Measure only mounted elements whose size actually changes, never on a timer. */
export function useObservedSize<T extends HTMLElement>(){
 const [size,setSize]=useState<{w:number;h:number}|null>(null);
 const observer=useRef<ResizeObserver|null>(null),frame=useRef(0),element=useRef<T|null>(null);
 const stop=useCallback(()=>{observer.current?.disconnect();observer.current=null;cancelAnimationFrame(frame.current);},[]);
 const ref=useCallback((node:T|null)=>{
  stop();element.current=node;
  if(!node)return;
  const measure=()=>{
   if(element.current!==node||!node.isConnected)return;
   const rect=node.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);
   if(w>50&&h>50)setSize(previous=>previous?.w===w&&previous.h===h?previous:{w,h});
  };
  const schedule=()=>{cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(measure);};
  observer.current=new ResizeObserver(schedule);observer.current.observe(node);measure();
 },[stop]);
 useEffect(()=>()=>stop(),[stop]);
 return {ref,size,element};
}
