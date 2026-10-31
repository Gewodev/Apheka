import {useEffect,useRef} from 'react';
/** Keep the preview from covering the second click of a document-open gesture. */
export function useNotePreviewClick(select:()=>void,open:()=>void){
  const latest=useRef({select,open});latest.current={select,open};const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
  useEffect(()=>cancel,[]);
  return {onClick:(event:{detail:number})=>{cancel();if(event.detail>1)return;if(!event.detail)latest.current.select();else timer.current=setTimeout(()=>{timer.current=null;latest.current.select();},240);},onDoubleClick:()=>{cancel();latest.current.open();}};
}
