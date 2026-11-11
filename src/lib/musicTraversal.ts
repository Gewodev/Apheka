export type MusicTraversal={back:string[];forward:string[]};
export type MusicTravel='back'|'forward';
/** Actual visits, separate from the recommendation history and future queue. */
export function visitMusic(state:MusicTraversal,current:string|null,target:string,direction?:MusicTravel):MusicTraversal{
 if(!current||current===target)return state;
 if(direction==='back'){
  const at=state.back.lastIndexOf(target);
  return {back:at<0?[]:state.back.slice(0,at),forward:[current,...state.forward].slice(0,100)};
 }
 if(direction==='forward'){
  const at=state.forward.indexOf(target);
  return {back:[...state.back,current].slice(-100),forward:at<0?[]:state.forward.slice(at+1)};
 }
 return {back:[...state.back,current].slice(-100),forward:[]};
}
