import {Timer,TimerReset} from 'lucide-react';
import type {Task} from '../../../store/AppContext';
import type {TaskAssessment} from '../../../lib/taskIntelligence';
import {taskLinkUnavailable} from '../../../lib/linkEligibility';
import {nextStudyStep,studyBlockMinutes} from '../../../lib/taskStudyPlan';
export default function TaskStudyControls({task,assessment,onStart}:{task:Task;assessment?:TaskAssessment;onDuration:(minutes:number)=>void;onStart:(mode:'pomodoro'|'chrono',minutes:number)=>void}){
 const minutes=studyBlockMinutes(task,nextStudyStep(task)),blocked=taskLinkUnavailable(task);
 return <div className="task-study-mode-actions task-study-actions-compact"><button type="button" className="btn-primary" disabled={!!blocked} title={blocked||`Estudiar ${minutes} minutos con pomodoro`} onClick={()=>onStart('pomodoro',minutes)}><Timer size={16}/>Pomodoro</button><button type="button" className="btn-secondary" disabled={!!blocked} title={blocked||'Iniciar cronómetro vinculado'} onClick={()=>onStart('chrono',minutes)}><TimerReset size={16}/>Cronómetro</button></div>;
}
