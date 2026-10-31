import type {Task,SubTask} from '../store/AppContext';

/** A task estimate is total work; a study block is always at most two hours. */
export const MAX_STUDY_BLOCK=120;
export function taskMinutes(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(10080,Math.round(n))):60;}
export function distributeSubtaskMinutes(total:number,subtasks:SubTask[]):SubTask[]{
 if(!subtasks.length)return subtasks;
 const minutes=taskMinutes(total),base=Math.floor(minutes/subtasks.length),extra=minutes%subtasks.length;
 return subtasks.map((sub,i)=>({...sub,estimatedMinutes:Math.max(1,base+(i<extra?1:0))}));
}
export function suggestTaskSteps(total:number,title:string,existing:SubTask[]=[]):SubTask[]{
 const minutes=taskMinutes(total),count=Math.ceil(minutes/MAX_STUDY_BLOCK),steps=[...existing];
 for(let i=steps.length;i<count;i++)steps.push({id:crypto.randomUUID(),title:`${title.trim()||'Trabajo'} · parte ${i+1}`,done:false});
 return distributeSubtaskMinutes(minutes,steps);
}
export function nextStudyStep(task:Task){return task.subtasks.find(sub=>!sub.done&&sub.title.trim());}
export function prepareTaskSteps(total:number,title:string,subtasks:SubTask[]){
 if(subtasks.length&&subtasks.every(s=>Number.isInteger(s.estimatedMinutes)&&s.estimatedMinutes!>0&&s.estimatedMinutes!<=120)&&subtasks.reduce((sum,s)=>sum+s.estimatedMinutes!,0)===total)return subtasks;
 return total>120?suggestTaskSteps(total,title,subtasks):distributeSubtaskMinutes(total,subtasks);
}
export function appendTaskStep(task:Task,sub:SubTask){
 const existing=task.subtasks.map(s=>({...s,estimatedMinutes:s.estimatedMinutes||studyBlockMinutes(task,s)})),assigned=existing.reduce((sum,s)=>sum+s.estimatedMinutes,0);
 const estimatedMinutes=Math.max(1,Math.min(120,taskMinutes(task.estimatedMinutes)>assigned?taskMinutes(task.estimatedMinutes)-assigned:25));
 const subtasks=[...existing,{...sub,estimatedMinutes}];return {subtasks,estimatedMinutes:subtasks.reduce((sum,s)=>sum+s.estimatedMinutes,0)};
}
export function studyBlockMinutes(task:Task,sub?:SubTask){
 const pending=task.subtasks.filter(s=>!s.done),estimate=sub?.estimatedMinutes??(sub?Math.ceil(taskMinutes(task.estimatedMinutes)/Math.max(1,pending.length)):taskMinutes(task.estimatedMinutes));
 return Math.max(1,Math.min(MAX_STUDY_BLOCK,estimate));
}
