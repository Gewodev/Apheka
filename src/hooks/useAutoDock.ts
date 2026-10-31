import {useCallback,useEffect,useRef,useState} from 'react';
export function useAutoDock(){
  const [open,setOpen]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),root=useRef<HTMLElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
  const cancel=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);
  const show=useCallback(()=>{cancel();setOpen(true);},[cancel]);
  const hide=useCallback(()=>{cancel();setOpen(false);},[cancel]);
  const leave=useCallback(()=>{cancel();timer.current=setTimeout(()=>{if(!root.current?.contains(document.activeElement))setOpen(false);},170);},[cancel]);
  useEffect(()=>()=>cancel(),[cancel]);
  useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();trigger.current?.focus({preventScroll:true});}},outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))hide();};document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);};},[open,hide]);
  return {open,show,hide,leave,cancel,root,trigger,toggle:()=>open?hide():show()};
}
