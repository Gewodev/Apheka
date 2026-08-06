// ═══════════════════════════════════════════════════
//  OWA BRAIN — Context Engine
// ═══════════════════════════════════════════════════
// Builds a lightweight snapshot of the app state for the AI.
// Only sends what's relevant — never the full database.

import type { Task, Note, Course, Track, Habit, PlannedSession, ScheduleEvent } from '../../store/AppContext';

export interface AppContextSnapshot {
  currentView: string;
  currentDate: string;
  userName: string;

  // Courses
  courses: { id: string; name: string; color: string }[];
  activeCourse: {
    id: string;
    name: string;
    color: string;
    groupCount: number;
    topicCount: number;
  } | null;

  // Tasks
  pendingTasks: {
    id: string;
    title: string;
    course: string;
    priority: string;
    status: string;
    dueDate?: string;
  }[];
  completedTaskCount: number;

  // Events (calendario)
  eventsUpcoming: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    allDay: boolean;
    course?: string;
  }[];

  // Notes (recientes con preview)
  recentNotes: {
    id: string;
    title: string;
    course: string;
    preview: string;
  }[];

  // Timer/Study
  timerActive: boolean;
  sessionType: string;
  sessionTime: number;
  timerTotal: number;
  timerRemaining: number;
  dailyStudyTime: number;
  weeklyStudyTime: number;
  pomodoroSessions: number;

  // Music
  currentTrack: { id: string; title: string; artist: string } | null;
  isPlayingMusic: boolean;
  trackCount: number;

  // Planned sessions
  plannedToday: {
    id: string;
    title: string;
    durationMinutes: number;
    type: string;
    completed: boolean;
  }[];

  // Habits
  habits: { id: string; name: string; completedToday: boolean }[];

  // Notes
  noteCount: number;
}

interface BuildContextParams {
  currentView: string;
  tasks: Task[];
  notes: Note[];
  courses: Course[];
  tracks: Track[];
  habits: Habit[];
  plannedSessions: PlannedSession[];
  events?: ScheduleEvent[];
  weeklyStudyTime?: Record<string, number>;
  settings: { userName: string; pomodoroTime?: number };
  currentTrackId: string | null;
  isPlayingMusic: boolean;
  isTimerActive: boolean;
  sessionType: string;
  sessionTime: number;
  dailyStudyTime: number;
  pomodoroSessions: number;
  selectedCourseId?: string | null;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * Build a context snapshot optimized for token usage.
 * Only includes essential data the AI needs to reason about.
 */
export function buildContextSnapshot(params: BuildContextParams): AppContextSnapshot {
  const today = new Date().toISOString().split('T')[0];
  const todayFull = new Date().toLocaleString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Find active course
  let activeCourse: AppContextSnapshot['activeCourse'] = null;
  if (params.selectedCourseId) {
    const c = params.courses.find(co => co.id === params.selectedCourseId);
    if (c) {
      activeCourse = {
        id: c.id,
        name: c.name,
        color: c.color,
        groupCount: c.groups?.length || 0,
        topicCount: c.studyTopics?.length || 0,
      };
    }
  }

  // Pending tasks (not completed), sorted by priority
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
  const pending = params.tasks
    .filter(t => t.status !== 'completado')
    .sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

  // Current track
  let currentTrack: AppContextSnapshot['currentTrack'] = null;
  if (params.currentTrackId) {
    const t = params.tracks.find(tr => tr.id === params.currentTrackId);
    if (t) {
      currentTrack = { id: t.id, title: t.title, artist: t.artist };
    }
  }

  // Planned sessions today
  const plannedToday = params.plannedSessions
    .filter(s => s.date === today)
    .map(s => ({
      id: s.id,
      title: s.title,
      durationMinutes: s.durationMinutes,
      type: s.type,
      completed: s.completed,
    }));

  // Habits with today status
  const habits = params.habits
    .filter(h => !h.isArchived)
    .map(h => ({
      id: h.id,
      name: h.name,
      completedToday: h.completedOn.includes(today),
    }));

  // Active notes (not deleted)
  const activeNotes = params.notes.filter(n => !n.deletedAt);

  // Recent notes with content preview (contexto de lectura rápida)
  const recentNotes = [...activeNotes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)
    .map(n => ({
      id: n.id,
      title: n.title || 'Sin título',
      course: n.course,
      preview: stripHtml(n.content).slice(0, 220),
    }));

  // Upcoming events (próximos 5 desde hoy)
  const todayStart = new Date(today + 'T00:00:00').getTime();
  const eventsUpcoming = (params.events || [])
    .filter(e => {
      const t = new Date(e.date + 'T00:00:00').getTime();
      return !isNaN(t) && t >= todayStart;
    })
    .sort((a, b) => {
      const ta = new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
      const tb = new Date(`${b.date}T${b.startTime || '00:00'}`).getTime();
      return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
    })
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      startTime: e.startTime,
      allDay: e.allDay,
      course: e.course,
    }));

  // Minutos estudiados esta semana
  const weeklyStudyTime = params.weeklyStudyTime
    ? Object.values(params.weeklyStudyTime).reduce((a, b) => a + (Number(b) || 0), 0)
    : 0;

  // Tiempo de la sesión de estudio: total y lo que FALTA (lo que ve el usuario
  // en pantalla). El pomodoro cuenta tiempo transcurrido; el usuario percibe el
  // tiempo restante, así que se lo damos también al modelo.
  const pomodoroMinutes = Number(params.settings.pomodoroTime) || 25;
  const timerTotal = params.sessionType === 'pomodoro' ? pomodoroMinutes * 60 : params.sessionTime;
  const timerRemaining = params.sessionType === 'pomodoro'
    ? Math.max(0, timerTotal - params.sessionTime)
    : 0;

  return {
    currentView: params.currentView,
    currentDate: todayFull,
    userName: params.settings.userName,
    courses: params.courses.map(c => ({ id: c.id, name: c.name, color: c.color })),
    activeCourse,
    pendingTasks: pending.map(t => ({
      id: t.id,
      title: t.title,
      course: t.course,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
    })),
    completedTaskCount: params.tasks.filter(t => t.status === 'completado').length,
    eventsUpcoming,
    recentNotes,
    timerActive: params.isTimerActive,
    sessionType: params.sessionType,
    sessionTime: params.sessionTime,
    timerTotal,
    timerRemaining,
    dailyStudyTime: params.dailyStudyTime,
    weeklyStudyTime,
    pomodoroSessions: params.pomodoroSessions,
    currentTrack,
    isPlayingMusic: params.isPlayingMusic,
    trackCount: params.tracks.length,
    plannedToday,
    habits,
    noteCount: activeNotes.length,
  };
}
