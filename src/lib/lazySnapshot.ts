/** Retain the newest state immediately; materialize it only for a durable write/close. */
export function lazyJsonSnapshot(){
 let value:string|null=null,build:(()=>string)|undefined;
 return {get current(){if(build){value=build();build=undefined;}return value;},set current(next:string|null){build=undefined;value=next;},defer(next:()=>string){build=next;}};
}
