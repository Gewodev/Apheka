/** One observer per scroll container, released when its final preview leaves. */
const groups=new Map<Element|null,{observer:IntersectionObserver;callbacks:Map<Element,()=>void>}>();
export function observePreview(element:Element,ready:()=>void){
 if(typeof IntersectionObserver==='undefined'){ready();return()=>{};}
 const root=element.closest('.course-notes-scroll');
 let group=groups.get(root);
 if(!group){const callbacks=new Map<Element,()=>void>();const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const callback=callbacks.get(entry.target);if(callback){callbacks.delete(entry.target);observer.unobserve(entry.target);callback();}}if(!callbacks.size){observer.disconnect();groups.delete(root);}},{root,rootMargin:'600px 0px'});group={observer,callbacks};groups.set(root,group);}
 group.callbacks.set(element,ready);group.observer.observe(element);
 const own=group;
 return()=>{own.observer.unobserve(element);own.callbacks.delete(element);if(!own.callbacks.size){own.observer.disconnect();if(groups.get(root)===own)groups.delete(root);}};
}
