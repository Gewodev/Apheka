import {productiveSessions,seconds} from './studyAnalytics.ts';
type Course={id:string;name:string;hoursStudied?:number};
type Task={id:string;course:string;studyTime?:number};
type Session={type:string;startedAt:string;duration:number;isDistraction?:boolean;courseId?:string;taskId?:string;subjects?:string[]};
/** Reconcile saved sessions and task counters without counting the same second twice. */
export function courseStudySeconds(courses:Course[],tasks:Task[],sessions:Session[]):Record<string,number>{
  const totals:Record<string,number>=Object.fromEntries(courses.map(c=>[c.id,0]));
  const loggedByTask=new Map<string,number>(),evidence=new Set<string>();
  const byName=new Map(courses.map(c=>[c.name,c.id])),byTask=new Map(tasks.map(t=>[t.id,t]));
  for(const s of productiveSessions(sessions)){
    const duration=seconds(s.duration);
    if(s.taskId)loggedByTask.set(s.taskId,(loggedByTask.get(s.taskId)||0)+duration);
    const taskCourse=s.taskId?byName.get(byTask.get(s.taskId)?.course||''):undefined;
    const ids=s.courseId?(s.courseId in totals?[s.courseId]:[]):taskCourse?[taskCourse]:[...new Set((s.subjects||[]).filter(id=>id in totals))];
    for(const id of ids){totals[id]+=duration/ids.length;evidence.add(id);}
  }
  for(const t of tasks){const id=byName.get(t.course);if(!id)continue;if(seconds(t.studyTime)>0||loggedByTask.has(t.id))evidence.add(id);totals[id]+=Math.max(0,seconds(t.studyTime)-(loggedByTask.get(t.id)||0));}
  for(const c of courses)if(!evidence.has(c.id))totals[c.id]=seconds(c.hoursStudied)*3600;
  return totals;
}
