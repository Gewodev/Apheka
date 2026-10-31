/** Stable actions and immutable snapshots for narrowly subscribed workspace panels. */
export function createSelectionStore<T extends object>(initial:T){
  let raw=initial,snapshot:T;
  const actions=new Map<keyof T,unknown>(),listeners=new Set<()=>void>();
  const normalize=(value:T)=>Object.fromEntries((Object.keys(value) as (keyof T)[]).map(key=>{
    if(typeof value[key]!=='function')return [key,value[key]];
    if(!actions.has(key))actions.set(key,(...args:unknown[])=>Reflect.apply(raw[key] as (...args:unknown[])=>unknown,undefined,args));
    return [key,actions.get(key)];
  })) as T;
  snapshot=normalize(initial);
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},commit(value:T){
    raw=value;const next=normalize(value);
    if((Object.keys(next) as (keyof T)[]).every(key=>Object.is(next[key],snapshot[key])))return;
    snapshot=next;listeners.forEach(listener=>listener());
  }};
}
