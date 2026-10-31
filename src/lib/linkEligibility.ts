import { localDate, nextOccurrence } from './eventOccurrence.ts';

interface TaskCandidate { status: string; dueDate?: string; deletedAt?: string; }
interface SessionCandidate { id: string; date: string; startTime?: string; durationMinutes: number; completed: boolean; repeat?: string; repeatDays?: number[]; repeatUntil?: string; exceptions?: string[]; }

export function taskLinkUnavailable(task: TaskCandidate | undefined, now = new Date()): string | null {
  if (!task || task.deletedAt) return 'Esta tarea ya no existe.';
  if (task.status === 'completado') return 'Esta tarea está completada.';
  if (task.dueDate) {
    const deadline = new Date(task.dueDate.includes('T') ? task.dueDate : task.dueDate + 'T23:59:59.999').getTime();
    if (!Number.isFinite(deadline)) return 'Esta tarea no tiene una fecha válida.';
    if (deadline < now.getTime()) return 'Esta tarea venció. Actualiza su fecha para vincularla.';
  }
  return null;
}
export function sessionLinkUnavailable(session: SessionCandidate | undefined, now = new Date()): string | null {
  if (!session) return 'Esta sesión ya no existe.';
  if (session.completed) return 'Esta sesión está completada.';
  const today = localDate(now);
  const currentDate = new Date(session.date + 'T12:00:00').getTime();
  if (!Number.isFinite(currentDate)) return 'Esta sesión no tiene una fecha válida.';
  const hasOccurrenceToday = session.date === today && !session.exceptions?.includes(today);
  const end = session.startTime ? new Date(session.date + 'T' + session.startTime).getTime() + Math.max(0,session.durationMinutes)*60000 : new Date(session.date + 'T23:59:59.999').getTime();
  if (hasOccurrenceToday && Number.isFinite(end) && end >= now.getTime()) return null;
  if (nextOccurrence(session, now)) return null;
  return 'Esta sesión ya pasó. Reprograma su fecha para vincularla.';
}

export function eventLinkUnavailable(event: {date: string; allDay: boolean; endTime: string}, now = new Date()): string | null {
  const end = new Date(event.date + 'T' + (event.allDay ? '23:59:59.999' : event.endTime)).getTime();
  return !Number.isFinite(end) || end < now.getTime() ? 'Este evento ya pasó. Actualiza su fecha para añadir un vínculo.' : null;
}
