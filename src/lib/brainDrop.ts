/** Track pointer coordinates only during an intentional drag, never at idle. */
export const BRAIN_DROP_MIME='application/x-owa-brain-anchor';
export type BrainAnchor={entity:'tasks'|'notes'|'courses';id:string};
let active:BrainAnchor|null=null,position:{x:number;y:number}|null=null,over=false;
const point=(event:PointerEvent)=>{position={x:event.clientX,y:event.clientY};const panel=document.querySelector('.charvis-sidebar'),rect=panel?.getBoundingClientRect(),next=!!rect&&position.x>=rect.left&&position.x<=rect.right&&position.y>=rect.top&&position.y<=rect.bottom;if(next!==over){over=next;window.dispatchEvent(new CustomEvent('apheka:charvis-drag',{detail:{over}}));}};
export function beginBrainDrag(entity:BrainAnchor['entity'],id:string){cancelBrainDrag();if(!document.querySelector('.charvis-sidebar'))return;active={entity,id};window.addEventListener('pointermove',point,{passive:true});}
export function cancelBrainDrag(){active=null;position=null;over=false;window.removeEventListener('pointermove',point);window.dispatchEvent(new CustomEvent('apheka:charvis-drag',{detail:{over:false}}));}
export function finishBrainDrag(){const anchor=active,accepted=over;cancelBrainDrag();if(anchor&&accepted){window.dispatchEvent(new CustomEvent('apheka:charvis-anchor',{detail:anchor}));return true;}return false;}
