import {invoke,isTauri} from '@tauri-apps/api/core';
import type {Task} from '../store/AppContext';
import {studyTaskCandidates,type TaskAssessment} from './taskIntelligence';
export type JevAdvice={taskId:string;minutes:number;confidence:number;source:string};
export function jevCandidate(task:Task,assessment?:TaskAssessment){return {id:task.id,title:task.title.slice(0,400),course:(task.course||'').slice(0,100),deadline:task.dueDate||null,remainingMinutes:Math.min(10080,assessment?.remainingMinutes||task.estimatedMinutes||60),priority:task.priority,urgent:assessment?.urgent||false,pendingSubtasks:(task.subtasks||[]).filter(sub=>!sub.done).length,resourceCount:(task.files||[]).length};}
export async function suggestTaskDuration(task:Task,assessment?:TaskAssessment):Promise<JevAdvice>{
 const local={taskId:task.id,minutes:Math.max(15,Math.min(90,Math.ceil((assessment?.remainingMinutes||task.estimatedMinutes||30)/5)*5)),confidence:0,source:'Estimación local'};
 if(!isTauri())return local;
 const status=await invoke<{configured:boolean}>('jev_status').catch(()=>({configured:false}));
 if(!status.configured)return local;
 const answer=await invoke<JevAdvice>('jev_decide',{request:{purpose:'duration',candidates:[jevCandidate(task,assessment)]}});
 if(answer.taskId!==task.id||!Number.isFinite(answer.minutes)||answer.minutes<5||answer.minutes>120||!Number.isFinite(answer.confidence)||answer.confidence<.7)throw Error('La respuesta no es válida. Se conserva tu duración.');
 return answer;
}

export async function suggestStudyTask(tasks:Task[],assessments:Map<string,TaskAssessment>):Promise<JevAdvice|null>{
 if(!isTauri())return null;
 const pool=studyTaskCandidates(tasks,assessments).slice(0,6);
 if(!pool.length)return null;
 const status=await invoke<{configured:boolean}>('jev_status').catch(()=>({configured:false}));if(!status.configured)return null;
 const candidates=pool.map(row=>jevCandidate(tasks.find(task=>task.id===row.taskId)!,row));
 const answer=await invoke<JevAdvice>('jev_decide',{request:{purpose:'task_choice',candidates}});
 if(!pool.some(row=>row.taskId===answer.taskId)||!Number.isFinite(answer.confidence)||answer.confidence<.7||answer.confidence>1)throw Error('Se conserva la selección local.');
 return answer;
}
