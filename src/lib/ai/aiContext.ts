// ═══════════════════════════════════════════════════
//  OWA BRAIN — Context Engine
// ═══════════════════════════════════════════════════
// Builds a lightweight snapshot of the app state for the AI.
// Only sends what's relevant — never the full database.

import type { Task, Note, Course, Track, Habit, PlannedSession } from '../../store/AppContext';

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

  // Timer/Study
  timerActive: boolean;
  sessionType: string;
  sessionTime: number;
  dailyStudyTime: number;
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
  settings: { userName: string };
  currentTrackId: string | null;
  isPlayingMusic: boolean;
  isTimerActive: boolean;
  sessionType: string;
  sessionTime: number;
  dailyStudyTime: number;
  pomodoroSessions: number;
  selectedCourseId?: string | null;
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
    timerActive: params.isTimerActive,
    sessionType: params.sessionType,
    sessionTime: params.sessionTime,
    dailyStudyTime: params.dailyStudyTime,
    pomodoroSessions: params.pomodoroSessions,
    currentTrack,
    isPlayingMusic: params.isPlayingMusic,
    trackCount: params.tracks.length,
    plannedToday,
    habits,
    noteCount: activeNotes.length,
  };
}
