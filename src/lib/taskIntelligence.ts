import type {Task,Course,StudySession,PlannedSession} from '../store/AppContext';

export type TaskQuadrant='do'|'plan'|'resolve'|'later';
export type TaskAssessment={
 taskId:string;deadline:number|null;remainingMinutes:number;estimated:boolean;
 urgency:number;urgent:boolean;important:boolean;quadrant:TaskQuadrant;
 label:string;color:string;score:number;reasons:string[];invalidDate:boolean;
};
type Context={now?:number;dailyGoal?:number;courses?:Course[];studySessions?:StudySession[];plannedSessions?:PlannedSession[]};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const positive=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:0;
const fold=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const taskIsActive=(task:Task)=>task.status!=='completado'&&!(task as Task&{deletedAt?:string}).deletedAt;

/** Date-only deadlines last through the local day, never expire at midnight's start. */
export function taskDeadline(value?:string):number|null{
 if(!value)return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
 if(!match)return null;
 const [,y,m,d,h,min,sec,zone]=match;
 const year=+y,month=+m,day=+d;
 const check=new Date(year,month-1,day);
 if(check.getFullYear()!==year||check.getMonth()!==month-1||check.getDate()!==day||+(h||0)>23||+(min||0)>59||+(sec||0)>59)return null;
 const time=zone?Date.parse(value):new Date(year,month-1,day,h===undefined?23:+h,min===undefined?59:+min,sec===undefined?(h===undefined?59:0):+sec,h===undefined?999:0).getTime();
 return Number.isFinite(time)?time:null;
}

/** Transparent scheduling heuristic. Attachment bodies are never opened or sent anywhere. */
export function assessTasks(tasks:Task[],context:Context={}):Map<string,TaskAssessment>{
 const now=context.now??Date.now(),budget=clamp(positive(context.dailyGoal)||240,30,720);
 const logged=new Map<string,number>(),lastCourse=new Map<string,number>();
 for(const session of context.studySessions||[]){
  if(session.type==='break'||session.isDistraction)continue;
  const stamp=Date.parse(session.startedAt);
  if(!Number.isFinite(stamp)||stamp>now)continue;
  if(session.taskId)logged.set(session.taskId,(logged.get(session.taskId)||0)+positive(session.duration)/60);
  if(session.courseId)lastCourse.set(session.courseId,Math.max(lastCourse.get(session.courseId)||0,stamp));
 }
 const courses=new Map((context.courses||[]).map(course=>[course.name,course]));
 const work=tasks.map(task=>{
  const subtasks=task.subtasks||[],pending=subtasks.filter(sub=>!sub.done).length,files=task.files||[];
  const text=fold([task.title,(task.notes||'').replace(/<[^>]*>/g,' ').slice(0,4000),...subtasks.map(sub=>sub.title)].join(' '));
  const assessment=/\b(examen|exam|parcial|final|evaluacion|exposicion|defensa)\b/.test(text);
  const project=/\b(proyecto|investigacion|ensayo|informe|tesis|monografia|laboratorio)\b/.test(text);
  const count=Number(/\b(\d{1,3})\s*(ejercicios|problemas|paginas|capitulos)\b/.exec(text)?.[1]||0);
  const supplied=positive(task.estimatedMinutes),estimated=!supplied;
  // Counts are bounded metadata signals, not a claim to understand a file's contents.
  const inferred=clamp(30+(assessment?45:0)+(project?60:0)+pending*12+Math.min(files.length,4)*6+Math.min(count,60)*3,20,480);
  const total=supplied||inferred,studied=Math.max(positive(task.studyTime)/60,logged.get(task.id)||0);
  const progress=Math.max(clamp(studied/total,0,1),subtasks.length?(subtasks.length-pending)/subtasks.length:0);
  const remaining=taskIsActive(task)?Math.max(5,Math.ceil(total*(1-progress))):0;
  return {task,deadline:taskDeadline(task.dueDate),remaining,estimated,pending,assessment,project,studied};
 });
 const dated=work.filter(row=>taskIsActive(row.task)&&row.deadline!==null).sort((a,b)=>a.deadline!-b.deadline!);
 // Equal deadlines receive the same cumulative workload; a stable ID cannot change urgency.
 const cumulative=new Map<string,{minutes:number;count:number}>();let sum=0,count=0;
 for(let i=0;i<dated.length;){let end=i;while(end<dated.length&&dated[end].deadline===dated[i].deadline){sum+=dated[end].remaining;count++;end++;}for(let j=i;j<end;j++)cumulative.set(dated[j].task.id,{minutes:sum,count});i=end;}
 const committed=(context.plannedSessions||[]).filter(session=>!session.completed).map(session=>({time:taskDeadline(session.date+'T'+(session.startTime||'12:00')),minutes:positive(session.durationMinutes),courseId:session.courseId})).filter(row=>row.time!==null&&row.time>now).sort((a,b)=>a.time!-b.time!);
 const result=new Map<string,TaskAssessment>();
 for(const row of work){
  const {task,deadline,remaining,estimated,pending,assessment,project}=row,active=taskIsActive(task),hours=deadline===null?Infinity:(deadline-now)/3600000;
  const course=courses.get(task.course),pressure=cumulative.get(task.id);
  let urgency=0;const reasons:string[]=[];
  if(!active)reasons.push('Tarea completada o eliminada.');
  else if(deadline===null)reasons.push(task.dueDate?'La fecha necesita corregirse; no se inventa un plazo.':'Sin fecha de entrega: no se presupone urgencia.');
  else{
   urgency=hours<=0?100:hours<=24?85:hours<=72?65:hours<=168?38:15;
   reasons.push(hours<=0?'Entrega vencida.':hours<24?'Entrega en menos de 24 horas.':`Entrega en ${Math.ceil(hours/24)} días.`);
   // Existing sessions in other courses compete for the same study budget.
   const otherBookings=committed.reduce((total,s)=>total+(s.time!<=deadline&&s.courseId!==course?.id?s.minutes:0),0);
   const capacity=Math.max(15,hours/24*budget-Math.min(otherBookings,Math.max(0,hours/24*budget*.6)));
   const load=(pressure?.minutes||remaining)/capacity;
   urgency=Math.max(urgency,load>=1?90:load>=.7?73:load>=.45?56:0);
   if((pressure?.count||0)>1)reasons.push(`${pressure!.count} tareas activas comparten este plazo o uno anterior.`);
   if(load>=.7)reasons.push('Poco margen para el trabajo pendiente según tu meta diaria.');
   if(otherBookings>0)reasons.push('Hay sesiones de otros cursos reservadas antes de la entrega.');
  }
  if(active){reasons.push(`${remaining} min pendientes${estimated?' (estimación por texto y recursos)':' según duración y progreso'}.`);if(pending)reasons.push(`${pending} subtareas por terminar.`);}
  const urgent=active&&urgency>=65;
  const important=active&&(task.priority==='high'||task.priority==='medium'&&(urgent||assessment||project&&remaining>=90));
  if(active)reasons.push(task.priority==='high'?'Importancia alta elegida por ti.':task.priority==='low'?'Prioridad baja: se conserva como no importante.':task.priority==='medium'?`Prioridad media, ${important?'importante por plazo o alcance':'sin señales suficientes de importancia alta'}.`:'Sin prioridad de importancia asignada.');
  const quadrant:TaskQuadrant=important?(urgent?'do':'plan'):(urgent?'resolve':'later');
  const label=!active?'Completada':deadline===null?'Sin plazo':hours<=0?'Vencida':urgency>=85?'Urgencia alta':urgent?'Urgente':urgency>=45?'Atención':'Con margen';
  const color=!active?'#729989':deadline===null?'var(--border-strong)':hours<=0?'#d4767c':urgency>=85?'#c98976':urgent?'#bda36c':'#78968c';
  // A small course balance signal only breaks near-ties, never overrides a deadline.
  const last=course?lastCourse.get(course.id):undefined,balance=last?clamp((now-last)/86400000,0,7):0;
  const score=active?urgency*.7+(important?23:task.priority==='medium'?10:task.priority==='low'?3:0)+(task.status==='progreso'?3:0)+Math.min(remaining/90,3)+balance*.3:0;
  result.set(task.id,{taskId:task.id,deadline,remainingMinutes:remaining,estimated,urgency,urgent,important,quadrant,label,color,score,reasons,invalidDate:!!task.dueDate&&deadline===null});
 }
 return result;
}

/** Only currently eligible, near-best candidates may be suggested by local or remote decisions. */
export function studyTaskCandidates(tasks:Task[],assessments:Map<string,TaskAssessment>,now=Date.now()):TaskAssessment[]{
 const ranked=tasks.filter(task=>taskIsActive(task)&&(!task.dueDate||(taskDeadline(task.dueDate)??-Infinity)>=now)&&(!(task.subtasks||[]).length||task.subtasks.some(s=>!s.done&&s.title.trim()))).map(task=>assessments.get(task.id)).filter((a):a is TaskAssessment=>!!a&&Number.isFinite(a.score)).sort((a,b)=>b.score-a.score||a.taskId.localeCompare(b.taskId));
 if(!ranked.length)return [];
 const best=ranked[0];return ranked.filter(a=>a.score>=best.score-12&&(!best.urgent||a.urgent)&&(!best.important||a.important)).slice(0,24);
}
/** Draw only from a near-best band. Randomness helps decide, not defeat priorities. */
export function chooseStudyTask(tasks:Task[],assessments:Map<string,TaskAssessment>,random=Math.random,now=Date.now(),recent:readonly string[]=[]):string|null{
 const candidates=studyTaskCandidates(tasks,assessments,now);if(!candidates.length)return null;
 const fresh=candidates.filter(a=>!recent.includes(a.taskId)),other=candidates.filter(a=>a.taskId!==recent[0]);
 const pool=fresh.length?fresh:other.length?other:candidates;
 const byId=new Map(tasks.map(task=>[task.id,task])),lastCourse=byId.get(recent[0])?.course;
 const differentCourse=!!lastCourse&&pool.some(a=>byId.get(a.taskId)?.course!==lastCourse);
 const weights=pool.map(a=>Math.exp((a.score-candidates[0].score)/10)*(differentCourse&&byId.get(a.taskId)?.course===lastCourse ? .72 : 1)*(byId.get(a.taskId)?.status==='progreso'?1.08:1));
 const total=weights.reduce((a,b)=>a+b,0),value=random(),draw=clamp(Number.isFinite(value)?value:0,0,1-Number.EPSILON)*total;
 let accumulated=0;for(let i=0;i<pool.length;i++){accumulated+=weights[i];if(draw<accumulated)return pool[i].taskId;}return pool[pool.length-1].taskId;
}
