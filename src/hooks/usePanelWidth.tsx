import React,{useLayoutEffect,useRef,useCallback} from 'react';

export function usePanelWidth(key:string,initial:number,min:number,max:number,edge:'left'|'right'='right',reserve=280){
  const ref=useRef<HTMLDivElement>(null),handle=useRef<HTMLDivElement>(null),stop=useRef<()=>void>(()=>{}),preferred=useRef(initial),actual=useRef(initial),observerRef=useRef<ResizeObserver|null>(null);
  const apply=useCallback((value:number)=>{
    const host=ref.current;if(!host)return;
    const available=Math.max(100,(host.parentElement?.clientWidth||max+reserve)-reserve);
    actual.current=Math.round(Math.max(Math.min(min,available),Math.min(max,available,value)));
    host.style.setProperty('--panel-width',actual.current+'px');handle.current?.setAttribute('aria-valuenow',String(actual.current));
  },[min,max,reserve]);
  const attach=useCallback((node:HTMLDivElement|null)=>{ref.current=node;observerRef.current?.disconnect();if(node){apply(preferred.current);const parent=node.parentElement;if(parent){observerRef.current=new ResizeObserver(()=>apply(preferred.current));observerRef.current.observe(parent);}}},[apply,key]);
  const save=()=>{try{localStorage.setItem('apheka_panel_'+key,String(preferred.current));}catch{}};
  useLayoutEffect(()=>{
    try{const saved=Number(localStorage.getItem('apheka_panel_'+key));if(Number.isFinite(saved)&&saved>=min&&saved<=max)preferred.current=saved;}catch{}
    apply(preferred.current);
    return()=>{observerRef.current?.disconnect();stop.current();};
  },[key,initial,min,max,reserve]);
  const onPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;event.preventDefault();stop.current();
    const target=event.currentTarget,startX=event.clientX,start=actual.current,oldCursor=document.body.style.cursor,oldSelect=document.body.style.userSelect;
    let frame=0,next=start;document.body.style.cursor='col-resize';document.body.style.userSelect='none';ref.current?.setAttribute('data-panel-resizing','true');
    target.setPointerCapture?.(event.pointerId);
    const paint=()=>{frame=0;apply(next);};
    const move=(e:PointerEvent)=>{next=start+(e.clientX-startX)*(edge==='left'?-1:1);if(!frame)frame=requestAnimationFrame(paint);};
    const finish=()=>{cancelAnimationFrame(frame);apply(next);preferred.current=actual.current;save();document.body.style.cursor=oldCursor;document.body.style.userSelect=oldSelect;ref.current?.removeAttribute('data-panel-resizing');if(target.hasPointerCapture?.(event.pointerId))target.releasePointerCapture(event.pointerId);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);window.removeEventListener('blur',finish);stop.current=()=>{};};
    stop.current=finish;window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);window.addEventListener('blur',finish);
  };
  const onKeyDown=(event:React.KeyboardEvent<HTMLDivElement>)=>{let next=actual.current;if(event.key==='ArrowLeft')next-=12;else if(event.key==='ArrowRight')next+=12;else if(event.key==='Home')next=min;else if(event.key==='End')next=max;else return;event.preventDefault();apply(next);preferred.current=actual.current;save();};
  const reset=()=>{preferred.current=initial;apply(initial);save();};
  return {ref:attach,handle,onPointerDown,onKeyDown,reset,edge,min,max,initial};
}
export function PanelResizeHandle({control,label}:{control:ReturnType<typeof usePanelWidth>;label:string}){
  return <div ref={control.handle} className={'panel-resize-handle is-'+control.edge} role="separator" aria-label={label} aria-orientation="vertical" aria-valuemin={control.min} aria-valuemax={control.max} aria-valuenow={control.initial} tabIndex={0} onPointerDown={control.onPointerDown} onKeyDown={control.onKeyDown} onDoubleClick={control.reset}/>;
}
