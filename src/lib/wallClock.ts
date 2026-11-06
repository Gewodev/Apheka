/** One visible, second-aligned clock shared by all clock faces. */
let now=Date.now(),timer:ReturnType<typeof setTimeout>|undefined;
const listeners=new Set<()=>void>();
function tick(){if(timer)clearTimeout(timer);timer=undefined;if(document.hidden||!listeners.size)return;now=Date.now();listeners.forEach(fn=>fn());timer=setTimeout(tick,1000-now%1000);}
export const wallClock={getSnapshot:()=>now,subscribe:(listener:()=>void)=>{listeners.add(listener);if(listeners.size===1){document.addEventListener('visibilitychange',tick);tick();}return()=>{listeners.delete(listener);if(!listeners.size){clearTimeout(timer);timer=undefined;document.removeEventListener('visibilitychange',tick);}};}};
