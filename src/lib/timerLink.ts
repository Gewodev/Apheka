export interface TimerLink { activeTaskId: string | null; activePlannedSessionId: string | null; activeSubtaskId?: string | null }
export function normalizeTimerLink(value: unknown): TimerLink {
  const data = value && typeof value === 'object' ? value as Partial<TimerLink> : {};
  const task = typeof data.activeTaskId === 'string' && data.activeTaskId ? data.activeTaskId : null;
  // Repair legacy records with two competing links deterministically.
  return { ...(task && typeof data.activeSubtaskId === "string" && data.activeSubtaskId ? {activeSubtaskId:data.activeSubtaskId} : {}), activeTaskId: task, activePlannedSessionId: task ? null : typeof data.activePlannedSessionId === 'string' && data.activePlannedSessionId ? data.activePlannedSessionId : null };
}
export function changeTimerLink(current: TimerLink, kind: 'task' | 'session', id: string | null): TimerLink {
  if (id) return { activeTaskId: kind === 'task' ? id : null, activePlannedSessionId: kind === 'session' ? id : null };
  return normalizeTimerLink({ ...current, [kind === 'task' ? 'activeTaskId' : 'activePlannedSessionId']: null });
}

export function linkedStudyTitle(task: {title:string;subtasks?:{id:string;title:string}[]} | undefined, subtaskId?:string|null):string|undefined {
 if(!task)return undefined;
 const sub=task.subtasks?.find(s=>s.id===subtaskId);
 return sub ? `${sub.title.trim()} | ${task.title}` : task.title;
}
