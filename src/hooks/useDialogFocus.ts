import {useEffect,useRef,type RefObject} from 'react';
const dialogStack:HTMLElement[]=[];
export function useDialogFocus(ref:RefObject<HTMLElement|null>,active:boolean,onClose:()=>void){
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{if(!active)return;const previous=document.activeElement as HTMLElement|null,root=ref.current;if(!root)return;const selectors='button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
    (root.querySelector<HTMLElement>('[autofocus],input,textarea')||root.querySelector<HTMLElement>(selectors))?.focus({preventScroll:true});
    dialogStack.push(root);
    const key=(event:KeyboardEvent)=>{if(dialogStack[dialogStack.length-1]!==root)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close.current();}if(event.key==='Tab'){const fields=[...root.querySelectorAll<HTMLElement>(selectors)].filter(el=>el.getClientRects().length),first=fields[0],last=fields[fields.length-1];if(!fields.length){event.preventDefault();return;}if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus();}}};
    document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);const wasTop=dialogStack[dialogStack.length-1]===root,index=dialogStack.lastIndexOf(root);if(index>=0)dialogStack.splice(index,1);if(wasTop&&previous?.isConnected)previous.focus({preventScroll:true});};
  },[active,ref]);
}
