/** A compositor-drawn fallback for Windows devices whose hardware cursor freezes over media. */
export const POINTER_PREFERENCE='pohu_compatible_pointer_v3';
export const POINTER_PREFERENCE_EVENT='apheka:pointer-preference';
export function compatiblePointerEnabled() {
  try{return localStorage.getItem(POINTER_PREFERENCE)==='on';}catch{return false;}
}

export function createCompatiblePointer() {
  let enabled=false,visible=false,frame=0,x=0,y=0,lastTarget:Element|null=null,cursor='default';
  const overlay=document.createElement('div');
  overlay.className='apheka-compatible-pointer';overlay.setAttribute('aria-hidden','true');
  overlay.style.cssText='position:fixed;left:0;top:0;width:26px;height:28px;z-index:2147483647;pointer-events:none;display:none;contain:layout style paint;';
  const style=document.createElement('style');
  style.textContent='html[data-apheka-software-pointer] *,html[data-apheka-software-pointer]{cursor:none!important}';
  const paths:Record<string,string>={
    default:'<path d="M3 2v21l5.5-5.2 4.3 9 4-2-4.4-8.5H21Z"/>',
    pointer:'<path d="M9 13V4a2 2 0 0 1 4 0v8-3a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v4-1a2 2 0 0 1 4 0v6c0 4-3 7-7 7h-2c-3 0-5-2-7-5L4 17a2 2 0 0 1 3-3l2 2Z"/>',
    text:'<path d="M7 3h10M12 3v22M7 25h10" fill="none"/>',
    move:'<path d="M13 2v24M2 14h22M9 6l4-4 4 4M9 22l4 4 4-4M6 10l-4 4 4 4M20 10l4 4-4 4" fill="none"/>',
    'not-allowed':'<circle cx="13" cy="14" r="10"/><path d="m6 7 14 14" fill="none"/>',
  };
  const hide=()=>{visible=false;overlay.style.display='none';delete document.documentElement.dataset.aphekaSoftwarePointer;};
  const paint=()=>{
    frame=0;
    if(!enabled||!visible||document.visibilityState==='hidden')return;
    // Avoid global style invalidation and computed-style reads on every hovered element.
    const target=document.elementFromPoint(x,y);
    if(target!==lastTarget){
      lastTarget=target;
      cursor=target?.closest('button,a[href],[role="button"],select,input[type=range]')?'pointer':'default';
      if(target?.closest('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),[contenteditable="true"]'))cursor='text';
    }
    const effective=/grab|resize|move/.test(document.body.style.cursor)?document.body.style.cursor:cursor;
    const kind=/text/.test(effective)?'text':/pointer/.test(effective)?'pointer':/grab|resize|move/.test(effective)?'move':/not-allowed|no-drop/.test(effective)?'not-allowed':'default';
    if(overlay.dataset.cursor!==kind){
      overlay.dataset.cursor=kind;
      overlay.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 30" width="26" height="28" fill="#f4f5f6" stroke="#22252b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${paths[kind]}</svg>`;
    }
    const offset=kind==='text'||kind==='move'?12:kind==='pointer'?10:3;
    overlay.style.transform=`translate3d(${x-offset}px,${y-(kind==='text'||kind==='move'?14:2)}px,0)`;
    overlay.style.display='block';if(!document.documentElement.hasAttribute('data-apheka-software-pointer'))document.documentElement.dataset.aphekaSoftwarePointer='true';
  };
  const move=(event:PointerEvent)=>{
    if(!enabled)return;
    if(event.pointerType!=='mouse'||document.visibilityState!=='visible'){hide();return;}
    x=event.clientX;y=event.clientY;visible=true;
    if(!frame)frame=requestAnimationFrame(paint);
  };
  const leave=(event:PointerEvent)=>{if(!event.relatedTarget)hide();};
  const visibility=()=>{if(document.visibilityState!=='visible')hide();};
  document.body.append(overlay);document.head.append(style);
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerover',move,{passive:true});window.addEventListener('pointerdown',move,{passive:true});
  window.addEventListener('blur',hide);window.addEventListener('pagehide',hide);
  document.addEventListener('pointerout',leave);document.addEventListener('pointercancel',hide);
  document.addEventListener('contextmenu',hide);document.addEventListener('visibilitychange',visibility);
  return {
    isEnabled:()=>enabled,
    setEnabled(value:boolean){if(enabled===value)return;enabled=value;lastTarget=null;if(!value){hide();cancelAnimationFrame(frame);frame=0;}},
    dispose(){enabled=false;hide();cancelAnimationFrame(frame);overlay.remove();style.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerover',move);window.removeEventListener('pointerdown',move);window.removeEventListener('blur',hide);window.removeEventListener('pagehide',hide);document.removeEventListener('pointerout',leave);document.removeEventListener('pointercancel',hide);document.removeEventListener('contextmenu',hide);document.removeEventListener('visibilitychange',visibility);},
  };
}
