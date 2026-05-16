import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { emit } from '@tauri-apps/api/event';

// ════════════════════════════════════════════════════
//  CORE TYPES
// ════════════════════════════════════════════════════

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskFile {
  id: string;
  name: string;
  path: string;
  type: string; // 'pdf' | 'image' | 'doc' | 'other' | 'video' | 'link'
  size?: number;
  thumbnailUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  course: string;
  courseColor: string;
  status: 'inicio' | 'progreso' | 'completado';
  priority: 'high' | 'medium' | 'low';
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  estimatedMinutes?: number;
  subtasks: SubTask[];
  files: TaskFile[];
  notes: string;       // rich text / description
  studyTime: number;   // seconds studied on this task
}

export interface Note {
  id: string;
  title: string;
  content: string;     // HTML rich text content
  course: string;
  courseColor: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}

export interface NoteFolder {
  id: string;
  name: string;
  color: string;
  courseId?: string;    // auto-created from course
  isManual: boolean;
}

export interface Course {
  id: string;
  name: string;
  color: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  hoursStudied: number;
  coverImage?: string;  // base64 or blob url
  coverUrl?: string;
  sortOrder: number;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  date: string;        // ISO date
  startTime: string;
  endTime: string;
  allDay: boolean;
  course?: string;
  color: string;
  tags: string[];
  files: TaskFile[];
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface Playlist {
  id: string;
  name: string;
  coverImage?: string; // base64 or blob url
  coverUrl?: string;
  trackIds: string[];
  createdAt: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;   // seconds
  source: 'local' | 'youtube' | 'spotify';
  url?: string;       // file blob url or youtube url
  coverImage?: string;
  coverUrl?: string;
  isFavorite: boolean;
}

export interface DownloadItem {
  id: string;
  title: string;
  artist: string;
  url: string;
  type: 'video' | 'playlist' | 'search';
  progress: number;
  status: 'queued' | 'downloading' | 'completed' | 'error' | 'cancelled';
  totalItems: number;
  completedItems: number;
  thumbnail?: string;
  duration?: number;
  errorMessage?: string;
  outputPath?: string;
}

export interface StudySession {
  id: string;
  type: 'pomodoro' | 'chrono';
  startedAt: string;
  endedAt?: string;
  duration: number;    // seconds
  taskId?: string;
  courseId?: string;
  pauseCount: number;  // for concentration calc
}

export interface Settings {
  theme: 'claro' | 'oscuro' | 'sistema';
  accentColor: string;
  userName: string;
  profilePhoto?: string;  // base64
  notifications: boolean;
  soundEffects: boolean;
  dailyGoal: number;        // minutes
  pomodoroTime: number;     // seconds
  shortBreakTime: number;   // seconds
  longBreakTime: number;    // seconds
  pomodoroGoal: number;     // sessions before long break
  fontFamily: string;
}

// ════════════════════════════════════════════════════
//  APP STATE
// ════════════════════════════════════════════════════

interface AppState {
  tasks: Task[];
  notes: Note[];
  noteFolders: NoteFolder[];
  courses: Course[];
  events: ScheduleEvent[];
  playlists: Playlist[];
  tracks: Track[];
  studySessions: StudySession[];
  settings: Settings;
  sessionTime: number;
  weeklyStudyTime: Record<string, number>; // 'YYYY-MM-DD' -> seconds
  dailyStudyTime: number;
  pomodoroSessions: number;
  activeTaskId: string | null;       // currently linked task to timer
  timerLocked: boolean;              // prevent switching during active session
  isTimerActive: boolean;
  isRest: boolean;
  setIsRest: (val: boolean) => void;
  // Music Player
  currentTrackId: string | null;
  isPlayingMusic: boolean;
  musicVolume: number;
  musicProgress: number;
  // Downloads
  downloadQueue: DownloadItem[];
}

type ViewId = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'musica' | 'planificacion' | 'ajustes';

interface AppContextType extends AppState {
  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'studyTime'>) => void;
  clearAllTasks: () => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  addSubTask: (taskId: string, title: string) => void;
  toggleSubTask: (taskId: string, subId: string) => void;
  deleteSubTask: (taskId: string, subId: string) => void;
  addTaskFile: (taskId: string, file: Omit<TaskFile, 'id'>) => void;
  removeTaskFile: (taskId: string, fileId: string) => void;
  incrementTaskStudyTime: (taskId: string) => void;
  // Notes
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addNoteFolder: (folder: Omit<NoteFolder, 'id'>) => void;
  deleteNoteFolder: (id: string) => void;
  // Courses
  addCourse: (course: Omit<Course, 'id' | 'sortOrder'>) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  reorderCourses: (courseIds: string[]) => void;
  // Events
  addEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;
  // Music
  addPlaylist: (playlist: Omit<Playlist, 'id' | 'createdAt'>) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
  addTrack: (track: Omit<Track, 'id'>) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  toggleTrackFavorite: (id: string) => void;
  // Music Player
  playTrack: (id: string) => void;
  toggleMusicPlayback: () => void;
  setMusicVolume: (volume: number) => void;
  setMusicProgress: (progress: number) => void;
  // Timer / Study
  addStudySession: (session: Omit<StudySession, 'id'>) => void;
  incrementSessionTime: () => void;
  incrementDailyStudyTime: () => void;
  incrementPomodoroSessions: () => void;
  resetPomodoroSessions: () => void;
  setActiveTaskId: (taskId: string | null) => void;
  setTimerLocked: (locked: boolean) => void;
  linkTaskToTimer: (taskId: string) => void;
  unlinkTaskFromTimer: () => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  // Downloads
  addToDownloadQueue: (item: Omit<DownloadItem, 'id' | 'progress' | 'status' | 'completedItems'>) => string;
  updateDownloadProgress: (id: string, progress: number) => void;
  updateDownloadStatus: (id: string, status: DownloadItem['status'], errorMessage?: string) => void;
  removeFromDownloadQueue: (id: string) => void;
  clearCompletedDownloads: () => void;
  // Navigation
  navigateTo: ViewId | null;
  setNavigateTo: (view: ViewId | null) => void;
  // Settings
  updateSettings: (updates: Partial<Settings>) => void;
}

// ════════════════════════════════════════════════════
//  DEFAULTS
// ════════════════════════════════════════════════════

const defaultCourses: Course[] = [
  { id: '1', name: 'Matemáticas', color: '#6366f1', progress: 72, totalTasks: 25, completedTasks: 18, hoursStudied: 12.5, sortOrder: 0 },
  { id: '2', name: 'Física', color: '#10b981', progress: 58, totalTasks: 18, completedTasks: 10, hoursStudied: 8.3, sortOrder: 1 },
  { id: '3', name: 'Historia', color: '#f59e0b', progress: 85, totalTasks: 12, completedTasks: 10, hoursStudied: 6.2, sortOrder: 2 },
  { id: '4', name: 'Inglés', color: '#ec4899', progress: 90, totalTasks: 20, completedTasks: 18, hoursStudied: 5.8, sortOrder: 3 },
  { id: '5', name: 'Computación', color: '#06b6d4', progress: 45, totalTasks: 15, completedTasks: 7, hoursStudied: 4.5, sortOrder: 4 },
];

const defaultSettings: Settings = {
  theme: 'oscuro',
  accentColor: '#E11D48',
  userName: 'MaxCB',
  notifications: true,
  soundEffects: true,
  dailyGoal: 240,
  pomodoroTime: 25 * 60,
  shortBreakTime: 5 * 60,
  longBreakTime: 15 * 60,
  pomodoroGoal: 4,
  fontFamily: 'Inter',
};

const defaultFolders: NoteFolder[] = [
  { id: 'f1', name: 'Matemáticas', color: '#6366f1', courseId: '1', isManual: false },
  { id: 'f2', name: 'Física', color: '#10b981', courseId: '2', isManual: false },
  { id: 'f3', name: 'Historia', color: '#f59e0b', courseId: '3', isManual: false },
  { id: 'f4', name: 'Inglés', color: '#ec4899', courseId: '4', isManual: false },
  { id: 'f5', name: 'Computación', color: '#06b6d4', courseId: '5', isManual: false },
];

const STORAGE_KEY = 'owa_studio_data';

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>(defaultFolders);
  const [courses, setCourses] = useState<Course[]>(defaultCourses);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sessionTime, setSessionTime] = useState(0);
  const [weeklyStudyTime, setWeeklyStudyTime] = useState<Record<string, number>>({});
  const [dailyStudyTime, setDailyStudyTime] = useState(0);
  const [pomodoroSessions, setPomodoroSessions] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerLocked, setTimerLocked] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isRest, setIsRest] = useState(false);

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [musicProgress, setMusicProgress] = useState(0);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [navigateTo, setNavigateTo] = useState<ViewId | null>(null);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
        if (data.noteFolders) setNoteFolders(data.noteFolders);
        if (data.courses) setCourses(data.courses);
        if (data.events) setEvents(data.events);
        if (data.playlists) setPlaylists(data.playlists);
        if (data.tracks) setTracks(data.tracks);
        if (data.studySessions) setStudySessions(data.studySessions);
        if (data.settings) setSettings({ ...defaultSettings, ...data.settings });
        if (data.sessionTime) setSessionTime(data.sessionTime);
        if (data.weeklyStudyTime) setWeeklyStudyTime(data.weeklyStudyTime);
        if (data.dailyStudyTime) setDailyStudyTime(data.dailyStudyTime);
        if (data.pomodoroSessions) setPomodoroSessions(data.pomodoroSessions);
      } catch (e) {
        console.error('Error loading data:', e);
      }
    }
  }, []);

  // Refs to avoid stale closures in timer interval
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;
  const sessionTimeRef = useRef(sessionTime);
  sessionTimeRef.current = sessionTime;

  // Timer interval with sync
  useEffect(() => {
    if (isTimerActive) {
      const interval = setInterval(() => {
        setSessionTime(prev => {
          const next = prev + 1;
          sessionTimeRef.current = next;
          emit('timer:sync', JSON.stringify({
            sessionTime: next,
            isTimerActive: true,
            activeTaskId: activeTaskIdRef.current,
          }));
          return next;
        });
        setDailyStudyTime(prev => prev + 1);
        const today = new Date().toISOString().split('T')[0];
        setWeeklyStudyTime(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));

        const currentTaskId = activeTaskIdRef.current;
        if (currentTaskId) {
          setTasks(prev => prev.map(t => t.id === currentTaskId ? { ...t, studyTime: t.studyTime + 1 } : t));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      emit('timer:sync', JSON.stringify({
        sessionTime: sessionTimeRef.current,
        isTimerActive: false,
        activeTaskId: activeTaskIdRef.current,
        isRest: false,
      }));
    }
  }, [isTimerActive]);

  // Debounced save
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tasks, notes, noteFolders, courses, events, playlists, tracks, studySessions,
        settings, sessionTime, weeklyStudyTime, dailyStudyTime, pomodoroSessions,
      }));
    }, 300);
    return () => clearTimeout(t);
  }, [tasks, notes, noteFolders, courses, events, playlists, tracks, studySessions, settings, sessionTime, weeklyStudyTime, dailyStudyTime, pomodoroSessions]);

  // ── TASKS ──
  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'studyTime'>) => {
    const newTask: Task = { ...task, id: Date.now().toString(), createdAt: new Date().toISOString(), status: 'inicio', subtasks: [], files: [], notes: '', studyTime: 0 };
    setTasks(prev => [...prev, newTask]);
    setCourses(prev => prev.map(c => c.name === task.course ? { ...c, totalTasks: c.totalTasks + 1 } : c));
  }, []);

  const clearAllTasks = useCallback(() => {
    setTasks([]);
    setCourses(prev => prev.map(c => ({ ...c, totalTasks: 0, completedTasks: 0 })));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task) {
        setCourses(pc => pc.map(c => c.name === task.course ? { ...c, totalTasks: Math.max(0, c.totalTasks - 1), completedTasks: task.status === 'completado' ? Math.max(0, c.completedTasks - 1) : c.completedTasks } : c));
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const toggleTaskStatus = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      let newStatus: Task['status'] = t.status;
      if (t.status === 'inicio') newStatus = 'progreso';
      else if (t.status === 'progreso') newStatus = 'completado';
      else newStatus = 'inicio';
      if (newStatus === 'completado' && t.status !== 'completado') {
        setCourses(pc => pc.map(c => c.name === t.course ? { ...c, completedTasks: c.completedTasks + 1 } : c));
      } else if (t.status === 'completado' && newStatus !== 'completado') {
        setCourses(pc => pc.map(c => c.name === t.course ? { ...c, completedTasks: Math.max(0, c.completedTasks - 1) } : c));
      }
      return { ...t, status: newStatus, completedAt: newStatus === 'completado' ? new Date().toISOString() : undefined };
    }));
  }, []);

  const addSubTask = useCallback((taskId: string, title: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: Date.now().toString(), title, done: false }] } : t));
  }, []);

  const toggleSubTask = useCallback((taskId: string, subId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) } : t));
  }, []);

  const deleteSubTask = useCallback((taskId: string, subId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) } : t));
  }, []);

  const addTaskFile = useCallback((taskId: string, file: Omit<TaskFile, 'id'>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, files: [...t.files, { ...file, id: Date.now().toString() }] } : t));
  }, []);

  const removeTaskFile = useCallback((taskId: string, fileId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t));
  }, []);

  const incrementTaskStudyTime = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, studyTime: t.studyTime + 1 } : t));
  }, []);

  // ── NOTES ──
  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const id = Date.now().toString();
    setNotes(prev => [...prev, { ...note, id, createdAt: now, updatedAt: now }]);
    return id;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNoteFolder = useCallback((folder: Omit<NoteFolder, 'id'>) => {
    setNoteFolders(prev => [...prev, { ...folder, id: Date.now().toString() }]);
  }, []);

  const deleteNoteFolder = useCallback((id: string) => {
    setNoteFolders(prev => prev.filter(f => f.id !== id));
  }, []);

  // ── COURSES ──
  const addCourse = useCallback((course: Omit<Course, 'id' | 'sortOrder'>) => {
    setCourses(prev => {
      const newCourse: Course = { ...course, id: Date.now().toString(), sortOrder: prev.length };
      // Auto-create folder
      setNoteFolders(pf => [...pf, { id: `f-${newCourse.id}`, name: course.name, color: course.color, courseId: newCourse.id, isManual: false }]);
      return [...prev, newCourse];
    });
  }, []);

  const updateCourse = useCallback((id: string, updates: Partial<Course>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => {
      const course = prev.find(c => c.id === id);
      if (course) {
        setTasks(pt => pt.filter(t => t.course !== course.name));
        setNotes(pn => pn.filter(n => n.course !== course.name));
        setNoteFolders(pf => pf.filter(f => f.courseId !== id));
      }
      return prev.filter(c => c.id !== id);
    });
  }, []);

  const reorderCourses = useCallback((courseIds: string[]) => {
    setCourses(prev => {
      const result = courseIds.map((id, i) => {
        const c = prev.find(x => x.id === id);
        return c ? { ...c, sortOrder: i } : null;
      }).filter(Boolean) as Course[];
      return result.length === courseIds.length ? result : prev;
    });
  }, []);

  // ── EVENTS ──
  const addEvent = useCallback((event: Omit<ScheduleEvent, 'id'>) => {
    setEvents(prev => [...prev, { ...event, id: Date.now().toString() }]);
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<ScheduleEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  // ── MUSIC ──
  const addPlaylist = useCallback((playlist: Omit<Playlist, 'id' | 'createdAt'>) => {
    setPlaylists(prev => [...prev, { ...playlist, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
  }, []);

  const updatePlaylist = useCallback((id: string, updates: Partial<Playlist>) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const addTrack = useCallback((track: Omit<Track, 'id'>) => {
    setTracks(prev => [...prev, { ...track, id: Date.now().toString() }]);
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
    setPlaylists(prev => prev.map(p => ({ ...p, trackIds: p.trackIds.filter(tid => tid !== id) })));
  }, []);

  const toggleTrackFavorite = useCallback((id: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
  }, []);

  const playTrack = useCallback((id: string) => {
    setCurrentTrackId(id);
    setIsPlayingMusic(true);
  }, []);

  const toggleMusicPlayback = useCallback(() => {
    setIsPlayingMusic(prev => !prev);
  }, []);

  // ── STUDY SESSIONS ──
  const addStudySession = useCallback((session: Omit<StudySession, 'id'>) => {
    setStudySessions(prev => [...prev, { ...session, id: Date.now().toString() }]);
  }, []);

  const incrementSessionTime = useCallback(() => {
    setSessionTime(prev => prev + 1);
  }, []);

  const incrementDailyStudyTime = useCallback(() => {
    setDailyStudyTime(prev => prev + 1);
    const today = new Date().toISOString().split('T')[0];
    setWeeklyStudyTime(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
  }, []);

  const incrementPomodoroSessions = useCallback(() => {
    setPomodoroSessions(prev => prev + 1);
  }, []);

  const resetPomodoroSessions = useCallback(() => {
    setPomodoroSessions(0);
  }, []);

  const linkTaskToTimer = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
    setTimerLocked(true);
  }, []);

  const unlinkTaskFromTimer = useCallback(() => {
    setActiveTaskId(null);
    setTimerLocked(false);
  }, []);

  const toggleTimer = useCallback(() => {
    setIsTimerActive(prev => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsTimerActive(false);
    setSessionTime(0);
    setIsRest(false);
  }, []);

  // ── DOWNLOADS ──
  const addToDownloadQueue = useCallback((item: Omit<DownloadItem, 'id' | 'progress' | 'status' | 'completedItems'>): string => {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newItem: DownloadItem = {
      ...item,
      id,
      progress: 0,
      status: 'queued',
      completedItems: 0,
    };
    setDownloadQueue(prev => [...prev, newItem]);
    return id;
  }, []);

  const updateDownloadProgress = useCallback((id: string, progress: number) => {
    setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, progress } : d));
  }, []);

  const updateDownloadStatus = useCallback((id: string, status: DownloadItem['status'], errorMessage?: string) => {
    setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, status, errorMessage: errorMessage || d.errorMessage } : d));
  }, []);

  const removeFromDownloadQueue = useCallback((id: string) => {
    setDownloadQueue(prev => prev.filter(d => d.id !== id));
  }, []);

  const clearCompletedDownloads = useCallback(() => {
    setDownloadQueue(prev => prev.filter(d => d.status === 'downloading' || d.status === 'queued'));
  }, []);

  // ── SETTINGS ──
  const updateSettingsCb = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const value: AppContextType = {
    tasks, notes, noteFolders, courses, events, playlists, tracks, studySessions,
    settings, sessionTime, weeklyStudyTime, dailyStudyTime, pomodoroSessions,
    activeTaskId, timerLocked, isTimerActive,
    currentTrackId, isPlayingMusic, musicVolume, musicProgress, downloadQueue,
    addTask, updateTask, deleteTask, toggleTaskStatus, clearAllTasks,
    addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, incrementTaskStudyTime,
    addNote, updateNote, deleteNote, addNoteFolder, deleteNoteFolder,
    addCourse, updateCourse, deleteCourse, reorderCourses,
    addEvent, updateEvent, deleteEvent,
    addPlaylist, updatePlaylist, deletePlaylist,
    addTrack, updateTrack, deleteTrack, toggleTrackFavorite,
    playTrack, toggleMusicPlayback, setMusicVolume, setMusicProgress,
    addToDownloadQueue, updateDownloadProgress, updateDownloadStatus,
    removeFromDownloadQueue, clearCompletedDownloads,
    addStudySession, incrementSessionTime, incrementDailyStudyTime,
    incrementPomodoroSessions, resetPomodoroSessions,
    setActiveTaskId, setTimerLocked, linkTaskToTimer, unlinkTaskFromTimer,
    toggleTimer, resetTimer, isRest, setIsRest,
    navigateTo, setNavigateTo,
    updateSettings: updateSettingsCb,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
