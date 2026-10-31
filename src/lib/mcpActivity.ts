import {useSyncExternalStore} from 'react';
export type McpActivity = {id:string;name:string;time:number;status:'ok'|'error'|'cancelled'};
let activity:McpActivity[]=[];
let describeAt=0,overviewAt=0;
const listeners=new Set<()=>void>();
export function recordMcpActivity(entry:McpActivity) {if(entry.status==='ok'){if(entry.name==='apheka_describe')describeAt=entry.time;if(entry.name==='apheka_overview')overviewAt=entry.time;}activity=[entry,...activity].slice(0,12);listeners.forEach(fn=>fn());}
export function mcpVerifiedAt(){return Math.min(describeAt,overviewAt);}
export function useMcpActivity() {return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>activity);}
