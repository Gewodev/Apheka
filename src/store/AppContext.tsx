import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, Dispatch, SetStateAction } from 'react';
import { emit } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import toast from 'react-hot-toast';

const globalAudio = new Audio();
globalAudio.volume = 0.7;

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
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
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
  anchoredImages?: { id: string; name: string; url: string; date: string; tag: string }[];
  resources?: { id: string; title: string; url: string; type: string; date: string }[];
  flashcards?: { id: string; question: string; answer: string; difficulty: 'facil' | 'bueno' | 'dificil'; lastReviewed: string; nextReview: string }[];
  description?: string;
  level?: string;
  credits?: string;
  teacher?: string;
  code?: string;
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

export interface Track {
  id: string;
  title: string;
  artist: string;
  collaborators?: string[];
  duration: number;   // seconds
  source: 'local' | 'youtube' | 'spotify';
  url?: string;       // file path or youtube url
  coverImage?: string;
  coverUrl?: string;
  isFavorite: boolean;
  listenedTime: number; // seconds
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
  // ...existing fields
  chronoGoal: number; // seconds, default 25 * 60
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

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

// ════════════════════════════════════════════════════
//  APP STATE
// ════════════════════════════════════════════════════

interface AppState {
  roundsCompleted: number;
  tasks: Task[];
  notes: Note[];
  noteFolders: NoteFolder[];
  courses: Course[];
  events: ScheduleEvent[];

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
  sessionType: 'pomodoro' | 'chrono';
  // Pause tracking and time distribution
  accumulatedPauseTime: number;
  pauseStartTime: number | null;
  distractionCount: number;
  focusPomodoroTime: number;
  focusChronoTime: number;
  breakTime: number;
  // Music Player
  currentTrackId: string | null;
  youtubeVideoUrl: string | null;
  isPlayingMusic: boolean;
  musicVolume: number;
  musicProgress: number;
  musicDuration: number;
  musicListeningTime: number;
  shuffleMode: boolean;
  repeatMode: 'none' | 'all' | 'one';
  trackHistory: string[];
  playCounts: Record<string, number>;
  musicQueue: string[];
  artists: { id: string; name: string; profileImage?: string }[];
  // Downloads
  downloadQueue: DownloadItem[];
  // Integrations
  googleConnected: boolean;
  calendarSyncEnabled: boolean;
  lastCalendarSync: string | null;
  showCompletion: boolean;
}

type ViewId = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'musica' | 'planificacion' | 'investigacion' | 'ajustes' | 'curso_detalle';

interface AppContextType extends AppState {
  setSessionType: (val: 'pomodoro' | 'chrono') => void;
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
  addCourse: (course: Omit<Course, 'id' | 'sortOrder'>) => string;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  reorderCourses: (courseIds: string[]) => void;
  // Events
  addEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;
  // Music
  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  toggleTrackFavorite: (id: string) => void;
  // Music Player
  playTrack: (id: string) => void;
  toggleMusicPlayback: () => void;
  setIsPlayingMusic: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMusicVolume: (volume: number) => void;
  setMusicProgress: (progress: number) => void;
  setShuffleMode: (mode: boolean) => void;
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;
  setMusicQueue: (queue: string[]) => void;
  clearAllMusicData: () => void;
  addArtist: (name: string) => void;
  updateArtist: (id: string, updates: { name?: string; profileImage?: string }) => void;
  deleteArtist: (id: string) => void;
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
  setIsTimerActive: Dispatch<SetStateAction<boolean>>;
  setSessionTime: Dispatch<SetStateAction<number>>;
  setDailyStudyTime: Dispatch<SetStateAction<number>>;
  setWeeklyStudyTime: Dispatch<SetStateAction<Record<string, number>>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setPomodoroSessions: Dispatch<SetStateAction<number>>;
  setShowCompletion: Dispatch<SetStateAction<boolean>>;
  setRoundsCompleted: Dispatch<SetStateAction<number>>;
  setAccumulatedPauseTime: Dispatch<SetStateAction<number>>;
  setPauseStartTime: Dispatch<SetStateAction<number | null>>;
  setDistractionCount: Dispatch<SetStateAction<number>>;
  setFocusPomodoroTime: Dispatch<SetStateAction<number>>;
  setFocusChronoTime: Dispatch<SetStateAction<number>>;
  setBreakTime: Dispatch<SetStateAction<number>>;
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
  // Integrations
  setGoogleConnected: (v: boolean) => void;
  setCalendarSyncEnabled: (v: boolean) => void;
  setLastCalendarSync: (v: string | null) => void;
  triggerCalendarSync: () => Promise<void>;
  importGoogleEvents: () => Promise<number>;
  triggerTasksSync: () => Promise<void>;
  importGoogleTasks: () => Promise<number>;
  searchYouTubeMusic: (query: string) => Promise<{ videoId: string; title: string; channel: string; thumbnail: string }[]>;
  searchVideos: (query: string) => Promise<{ videoId: string; title: string; channel: string; thumbnail: string }[]>;
  importClassroomCourses: () => Promise<void>;
  exportNotesToGoogleDoc: () => Promise<string | null>;
  exportStatsToGoogleSheets: () => Promise<string | null>;
  loadGoogleProfile: () => Promise<{ displayName: string; givenName: string; photoUrl: string; email: string } | null>;
  triggerDriveBackup: () => Promise<string | null>;
  searchStudyResources: (topic: string) => Promise<{ title: string; url: string; description: string }[]>;
  createStudyQuiz: (courseName: string, topics: string[]) => Promise<string | null>;
  initFirebaseNotifications: () => Promise<string | null>;
  syncAllToCloud: () => Promise<void>;
  // Notifications
  notifications: AppNotification[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotifications: () => void;
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
  chronoGoal: 25 * 60,
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
  const [sessionType, setSessionType] = useState<'pomodoro' | 'chrono'>('pomodoro');
  const [showCompletion, setShowCompletion] = useState(false);
  const [roundsCompleted, setRoundsCompleted] = useState(0);

  // Pause tracking and time distribution
  const [accumulatedPauseTime, setAccumulatedPauseTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [distractionCount, setDistractionCount] = useState(0);
  const [focusPomodoroTime, setFocusPomodoroTime] = useState(0);
  const [focusChronoTime, setFocusChronoTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState<string | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [musicProgress, setMusicProgress] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [shuffleMode, _setShuffleMode] = useState(false);
  const [repeatMode, _setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev.slice(-49), { id, message, type, timestamp: Date.now() }]);
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const setShuffleMode = useCallback((mode: boolean) => {
    _setShuffleMode(mode);
    if (mode) _setRepeatMode('none');
  }, []);
  const setRepeatMode = useCallback((mode: 'none' | 'all' | 'one') => {
    _setRepeatMode(mode);
    if (mode !== 'none') _setShuffleMode(false);
  }, []);
   const [trackPlayDurations, setTrackPlayDurations] = useState<Record<string, number>>({});
   const [currentTrackStartTime, setCurrentTrackStartTime] = useState<number | null>(null);
   const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
   const [trackHistory, setTrackHistory] = useState<string[]>([]);
   const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [musicQueue, setMusicQueue] = useState<string[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const autoPlayRef = useRef(false);
  const currentBlobUrlRef = useRef<string | null>(null);
  const [musicListeningTime, setMusicListeningTime] = useState(0);
  const [musicListeningDate, setMusicListeningDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Reset listening time daily
  useEffect(() => {
    const check = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== musicListeningDate) {
        setMusicListeningTime(0);
        setMusicListeningDate(today);
      }
    }, 30000); // check every 30s
    return () => clearInterval(check);
  }, [musicListeningDate]);

  // Increment listening time every second while music plays
  useEffect(() => {
    if (!isPlayingMusic) return;
    const interval = setInterval(() => {
      setMusicListeningTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlayingMusic]);

   const currentTrackIdRef = useRef(currentTrackId);
   const tracksRef = useRef(tracks);
   const shuffleModeRef = useRef(shuffleMode);
   const repeatModeRef = useRef(repeatMode);
   const musicQueueRef = useRef(musicQueue);
   const playTrackRef = useRef<(id: string) => void>(() => {});
   const musicVolumeRef = useRef(musicVolume);

   useEffect(() => { currentTrackIdRef.current = currentTrackId; }, [currentTrackId]);
   useEffect(() => { tracksRef.current = tracks; }, [tracks]);
   useEffect(() => { shuffleModeRef.current = shuffleMode; }, [shuffleMode]);
   useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
   useEffect(() => { musicQueueRef.current = musicQueue; }, [musicQueue]);
   useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);

   const [navigateTo, setNavigateTo] = useState<ViewId | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [lastCalendarSync, setLastCalendarSync] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.tracks) setTracks(data.tracks);
        if (data.trackHistory) setTrackHistory(data.trackHistory);
        if (data.playCounts) setPlayCounts(data.playCounts);
        if (data.musicQueue) setMusicQueue(data.musicQueue);
        if (data.artists) setArtists(data.artists);
        if (data.shuffleMode !== undefined) _setShuffleMode(data.shuffleMode);
        if (data.repeatMode) _setRepeatMode(data.repeatMode);
        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
        if (data.noteFolders) setNoteFolders(data.noteFolders);
        if (data.courses) setCourses(data.courses);
        if (data.events) setEvents(data.events);
        if (data.studySessions) setStudySessions(data.studySessions);
        if (data.settings) setSettings({ ...defaultSettings, ...data.settings });
        if (data.sessionTime) setSessionTime(data.sessionTime);
        if (data.sessionType) setSessionType(data.sessionType);
        if (data.weeklyStudyTime) setWeeklyStudyTime(data.weeklyStudyTime);
        if (data.dailyStudyTime) setDailyStudyTime(data.dailyStudyTime);
        if (data.pomodoroSessions) setPomodoroSessions(data.pomodoroSessions);
        if (data.musicVolume !== undefined) setMusicVolume(data.musicVolume);
        if (data.currentTrackId) setCurrentTrackId(data.currentTrackId);
        if (data.musicListeningTime !== undefined) {
          const today = new Date().toISOString().slice(0, 10);
          if (data.musicListeningDate === today) {
            setMusicListeningTime(data.musicListeningTime);
          }
        }
        if (data.accumulatedPauseTime !== undefined) setAccumulatedPauseTime(data.accumulatedPauseTime);
        setPauseStartTime(null);
        if (data.distractionCount !== undefined) setDistractionCount(data.distractionCount);
        if (data.focusPomodoroTime !== undefined) setFocusPomodoroTime(data.focusPomodoroTime);
        if (data.focusChronoTime !== undefined) setFocusChronoTime(data.focusChronoTime);
        if (data.breakTime !== undefined) setBreakTime(data.breakTime);
        // Always start paused
        setIsPlayingMusic(false);
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
  const isRestRef = useRef(isRest);
  isRestRef.current = isRest;
  const sessionTypeRef = useRef(sessionType);
  sessionTypeRef.current = sessionType;
  const accumulatedPauseTimeRef = useRef(accumulatedPauseTime);
  accumulatedPauseTimeRef.current = accumulatedPauseTime;
  const pauseStartTimeRef = useRef(pauseStartTime);
  pauseStartTimeRef.current = pauseStartTime;
  const distractionCountRef = useRef(distractionCount);
  distractionCountRef.current = distractionCount;
  const pomodoroSessionsRef = useRef(pomodoroSessions);
  pomodoroSessionsRef.current = pomodoroSessions;
  const sessionsCountRef = useRef(studySessions.length);
  sessionsCountRef.current = studySessions.length;

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
            isRest: isRestRef.current,
            sessionType: sessionTypeRef.current,
            pomodoroTime: settings.pomodoroTime,
            shortBreakTime: settings.shortBreakTime,
            accumulatedPauseTime: accumulatedPauseTimeRef.current,
            pauseStartTime: pauseStartTimeRef.current,
            distractionCount: distractionCountRef.current,
            pomodoroSessions: pomodoroSessionsRef.current,
            pomodoroGoal: settings.pomodoroGoal,
            sessionsCount: sessionsCountRef.current,
          }));
          return next;
        });

        const rest = isRestRef.current;
        const type = sessionTypeRef.current;

        if (rest) {
          setBreakTime(prev => prev + 1);
        } else {
          setDailyStudyTime(prev => prev + 1);
          const today = new Date().toISOString().split('T')[0];
          setWeeklyStudyTime(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));

          if (type === 'pomodoro') {
            setFocusPomodoroTime(prev => prev + 1);
          } else {
            setFocusChronoTime(prev => prev + 1);
          }

          const currentTaskId = activeTaskIdRef.current;
          if (currentTaskId) {
            setTasks(prev => prev.map(t => t.id === currentTaskId ? { ...t, studyTime: t.studyTime + 1 } : t));
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      emit('timer:sync', JSON.stringify({
        sessionTime: sessionTimeRef.current,
        isTimerActive: false,
        activeTaskId: activeTaskIdRef.current,
        isRest: isRestRef.current,
        sessionType: sessionTypeRef.current,
        pomodoroTime: settings.pomodoroTime,
        shortBreakTime: settings.shortBreakTime,
        accumulatedPauseTime: accumulatedPauseTimeRef.current,
        pauseStartTime: pauseStartTimeRef.current,
        distractionCount: distractionCountRef.current,
        pomodoroSessions: pomodoroSessionsRef.current,
        pomodoroGoal: settings.pomodoroGoal,
        sessionsCount: sessionsCountRef.current,
      }));
    }
  }, [isTimerActive, settings.pomodoroTime, settings.shortBreakTime]);

  // Sync timer state instantly when isRest, isTimerActive, or sessionType changes
  useEffect(() => {
    emit('timer:sync', JSON.stringify({
      sessionTime: sessionTimeRef.current,
      isTimerActive: isTimerActive,
      activeTaskId: activeTaskIdRef.current,
      isRest: isRest,
      sessionType: sessionType,
      pomodoroTime: settings.pomodoroTime,
      shortBreakTime: settings.shortBreakTime,
      accumulatedPauseTime: accumulatedPauseTime,
      pauseStartTime: pauseStartTime,
      distractionCount: distractionCount,
      pomodoroSessions: pomodoroSessions,
      pomodoroGoal: settings.pomodoroGoal,
      sessionsCount: studySessions.length,
    }));
  }, [isRest, isTimerActive, sessionType, settings.pomodoroTime, settings.shortBreakTime, accumulatedPauseTime, pauseStartTime, distractionCount, pomodoroSessions, settings.pomodoroGoal, studySessions.length]);

  const prevIsTimerActiveRef = useRef(isTimerActive);
  useEffect(() => {
    if (prevIsTimerActiveRef.current !== isTimerActive) {
      if (!isTimerActive) {
        // Active -> Paused
        setPauseStartTime(Date.now());
      } else {
        // Paused -> Active
        if (pauseStartTime) {
          const pauseSecs = Math.floor((Date.now() - pauseStartTime) / 1000);
          if (pauseSecs > 0) {
            setAccumulatedPauseTime(prev => prev + pauseSecs);
            if (pauseSecs > 600) {
              setDistractionCount(prev => prev + 1);
              addNotification('Distracción detectada (pausa mayor a 10 min)', 'info');
            }
          }
        }
        setPauseStartTime(null);
      }
      prevIsTimerActiveRef.current = isTimerActive;
    }
  }, [isTimerActive, pauseStartTime, addNotification]);

  // Debounced save
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tasks, notes, noteFolders, courses, events, tracks, studySessions,
        settings, sessionTime, sessionType, weeklyStudyTime, dailyStudyTime, pomodoroSessions,
        trackHistory, playCounts, musicQueue, musicVolume, shuffleMode, repeatMode, artists,
        currentTrackId, musicListeningTime, musicListeningDate,
        accumulatedPauseTime, pauseStartTime, distractionCount,
        focusPomodoroTime, focusChronoTime, breakTime,
      }));
    }, 300);
    return () => clearTimeout(t);
  }, [
    tasks, notes, noteFolders, courses, events, tracks, studySessions, settings, sessionTime,
    weeklyStudyTime, dailyStudyTime, pomodoroSessions, trackHistory, playCounts, musicQueue,
    musicVolume, artists, musicListeningTime, musicListeningDate,
    accumulatedPauseTime, pauseStartTime, distractionCount,
    focusPomodoroTime, focusChronoTime, breakTime,
  ]);

  // Pause audio when closing window
  useEffect(() => {
    const handleBeforeUnload = () => {
      globalAudio.pause();
      globalAudio.src = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
    const newId = Date.now().toString();
    setCourses(prev => {
      const newCourse: Course = { ...course, id: newId, sortOrder: prev.length };
      // Auto-create folder
      setNoteFolders(pf => [...pf, { id: `f-${newCourse.id}`, name: course.name, color: course.color, courseId: newCourse.id, isManual: false }]);
      return [...prev, newCourse];
    });
    return newId;
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
  const addTrack = useCallback((track: Omit<Track, 'id'>) => {
    const id = crypto.randomUUID();
    setTracks(prev => [...prev, { ...track, id }]);
    return id;
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  const toggleTrackFavorite = useCallback((id: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
  }, []);

  const clearAllMusicData = useCallback(() => {
    setTracks([]);
    setTrackHistory([]);
    setPlayCounts({});
    setMusicQueue([]);
    setArtists([]);
    setCurrentTrackId(null);
    setIsPlayingMusic(false);
    setMusicProgress(0);
    setMusicDuration(0);
    setMusicListeningTime(0);
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.src = '';
    }
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const playTrack = useCallback((id: string) => {
    globalAudio.pause();
    if (currentTrackStartTime !== null && currentTrackId) {
      const endTime = Date.now() / 1000;
      const durationPlayed = endTime - currentTrackStartTime;
      setTrackPlayDurations(prev => {
        const currentDuration = prev[currentTrackId!] || 0;
        return { ...prev, [currentTrackId!]: currentDuration + durationPlayed };
      });
    }
    setCurrentTrackId(id);
    setCurrentTrackStartTime(Date.now() / 1000);
    setIsPlayingMusic(true);

    const track = tracks.find(t => t.id === id);
    if (!track || !track.url) {
      setYoutubeVideoUrl(null);
      setIsPlayingMusic(false);
      return;
    }

    // YouTube → ReactPlayer
    if (track.url.includes('youtube.com/') || track.url.includes('youtu.be/')) {
      setYoutubeVideoUrl(track.url);
      setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
      setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      return;
    }
    setYoutubeVideoUrl(null);

    // Direct audio: local files use readFile + Blob URL, remote files use url directly
    const setupAudio = async () => {
      try {
        if (track.source === 'local' && track.url) {
          // Revoke previous blob URL to avoid memory leak
          if (currentBlobUrlRef.current) {
            URL.revokeObjectURL(currentBlobUrlRef.current);
            currentBlobUrlRef.current = null;
          }
          const data = await readFile(track.url);
          const blob = new Blob([data]);
          const blobUrl = URL.createObjectURL(blob);
          currentBlobUrlRef.current = blobUrl;
          globalAudio.src = blobUrl;
        } else {
          globalAudio.src = track.url || '';
        }
        globalAudio.load();
        autoPlayRef.current = true;
      } catch {
        setIsPlayingMusic(false);
      }
    };
    setupAudio();

    // Auto-populate musicQueue when empty (fill with remaining tracks in library order)
    setMusicQueue(prev => {
      if (prev.length > 0) return prev;
      const currentIdx = tracks.findIndex(t => t.id === id);
      if (currentIdx === -1) return prev;
      return tracks.slice(currentIdx + 1).map(t => t.id);
    });

    setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
    setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, [tracks, currentTrackId, currentTrackStartTime, setTrackPlayDurations, setIsPlayingMusic, setTrackHistory, setPlayCounts, setMusicQueue]);

  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  const toggleMusicPlayback = useCallback(() => {
    const currentTrack = currentTrackIdRef.current ? tracksRef.current.find(t => t.id === currentTrackIdRef.current) : null;
    const isYouTubeTrack = currentTrack && (currentTrack.url?.includes('youtube.com/') || currentTrack.url?.includes('youtu.be/'));

    if (isYouTubeTrack) {
      if (!youtubeVideoUrl) setYoutubeVideoUrl(currentTrack!.url!);
      setIsPlayingMusic(prev => !prev);
      return;
    }

    // Cancel any pending canplay auto-play
    autoPlayRef.current = false;

    if (globalAudio.paused) {
      setIsPlayingMusic(true);
      setCurrentTrackStartTime(Date.now() / 1000);
      // Fade in from 0 to target volume over ~100ms
      const targetVol = musicVolumeRef.current;
      globalAudio.volume = 0;
      globalAudio.play().then(() => {
        const steps = 8;
        const stepMs = 12;
        let i = 0;
        const ramp = setInterval(() => {
          i++;
          globalAudio.volume = Math.min(targetVol, (i / steps) * targetVol);
          if (i >= steps) clearInterval(ramp);
        }, stepMs);
      }).catch(() => setIsPlayingMusic(false));
    } else {
      if (currentTrackStartTime !== null && currentTrackIdRef.current) {
        const endTime = Date.now() / 1000;
        const durationPlayed = endTime - currentTrackStartTime;
        setTrackPlayDurations(prev => {
          const cid = currentTrackIdRef.current;
          if (!cid) return prev;
          const currentDuration = prev[cid] || 0;
          return { ...prev, [cid]: currentDuration + durationPlayed };
        });
      }
      setCurrentTrackStartTime(null);
      // Fade out from current volume to 0 over ~100ms, then pause
      const steps = 8;
      const stepMs = 12;
      const startVol = globalAudio.volume;
      let i = 0;
      const ramp = setInterval(() => {
        i++;
        globalAudio.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
          clearInterval(ramp);
          globalAudio.pause();
          globalAudio.volume = musicVolumeRef.current; // reset for next play
          setIsPlayingMusic(false);
        }
      }, stepMs);
    }
  }, [youtubeVideoUrl, currentTrackId, currentTrackStartTime, musicVolume, setTrackPlayDurations, setIsPlayingMusic]);

  const setMusicProgressCb = useCallback((progress: number) => {
    setMusicProgress(progress);
    if (globalAudio.duration && isFinite(progress)) {
      globalAudio.currentTime = progress * globalAudio.duration;
    }
  }, []);

  const setMusicVolumeCb = useCallback((volume: number) => {
    setMusicVolume(volume);
    globalAudio.volume = volume;
  }, []);

  // Music audio engine: init events
  useEffect(() => {
    globalAudio.volume = musicVolume;
    const audio = globalAudio;
    let canplayTimeout: any = null;

    const onTimeUpdate = () => {
      if (audio.duration) setMusicProgress(audio.currentTime / audio.duration);
    };
    const onDurationChange = () => {
      const dur = audio.duration;
      if (isFinite(dur) && dur > 0) {
        setMusicDuration(dur);
        const cid = currentTrackIdRef.current;
        if (cid) {
          setTracks(prev => prev.map(t => t.id === cid ? { ...t, duration: Math.round(dur) } : t));
        }
      }
    };
    const onEnded = () => {
      if (currentTrackIdRef.current && tracksRef.current.length > 0) {
        const currentIdx = tracksRef.current.findIndex(t => t.id === currentTrackIdRef.current);
        if (repeatModeRef.current === 'one') {
          playTrackRef.current(currentTrackIdRef.current);
          return;
        }
        let nextId: string | null = null;
        if (shuffleModeRef.current) {
          const others = tracksRef.current.filter(t => t.id !== currentTrackIdRef.current);
          if (others.length > 0) nextId = others[Math.floor(Math.random() * others.length)].id;
        } else if (repeatModeRef.current === 'all' || musicQueueRef.current.length > 0) {
          if (musicQueueRef.current.length > 0) {
            const [next] = musicQueueRef.current;
            setMusicQueue(musicQueueRef.current.slice(1));
            nextId = next;
          } else if (currentIdx < tracksRef.current.length - 1) {
            nextId = tracksRef.current[currentIdx + 1].id;
          } else if (repeatModeRef.current === 'all') {
            nextId = tracksRef.current[0].id;
          }
        } else {
          if (currentIdx < tracksRef.current.length - 1) nextId = tracksRef.current[currentIdx + 1].id;
        }
        if (nextId) playTrackRef.current(nextId);
        else setIsPlayingMusic(false);
      } else {
        setIsPlayingMusic(false);
      }
    };
    const onError = () => { setIsPlayingMusic(false); };
    const onCanPlay = () => {
      if (canplayTimeout) { clearTimeout(canplayTimeout); canplayTimeout = null; }
      if (autoPlayRef.current && audio.paused) {
        autoPlayRef.current = false;
        const targetVol = musicVolumeRef.current;
        audio.volume = 0;
        audio.play().then(() => {
          const steps = 8;
          const stepMs = 12;
          let i = 0;
          const ramp = setInterval(() => {
            i++;
            audio.volume = Math.min(targetVol, (i / steps) * targetVol);
            if (i >= steps) clearInterval(ramp);
          }, stepMs);
        }).catch(() => setIsPlayingMusic(false));
      }
      autoPlayRef.current = false;
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);

    // canplay timeout fallback: if src was set but canplay doesn't fire in 3s, try play anyway
    const srcObserver = setInterval(() => {
      if (autoPlayRef.current && audio.src && audio.paused) {
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          autoPlayRef.current = false;
          const targetVol = musicVolumeRef.current;
          audio.volume = 0;
          audio.play().then(() => {
            const steps = 8;
            const stepMs = 12;
            let i = 0;
            const ramp = setInterval(() => {
              i++;
              audio.volume = Math.min(targetVol, (i / steps) * targetVol);
              if (i >= steps) clearInterval(ramp);
            }, stepMs);
          }).catch(() => setIsPlayingMusic(false));
        }
      }
    }, 500);

    return () => {
      if (canplayTimeout) clearTimeout(canplayTimeout);
      clearInterval(srcObserver);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
    };
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
    setAccumulatedPauseTime(0);
    setPauseStartTime(null);
    setDistractionCount(0);
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

  // ── INTEGRATIONS ──
  const triggerCalendarSync = useCallback(async () => {
    try {
      const { syncAppEventsToGoogle } = await import('../lib/google/calendar');
      const { synced } = await syncAppEventsToGoogle(
        events.map(e => ({ id: e.id, title: e.title, description: e.description, date: e.date, startTime: e.startTime, endTime: e.endTime, color: e.color }))
      );
      setLastCalendarSync(new Date().toISOString());
    } catch (e) {
      console.error('Calendar sync failed:', e);
    }
  }, [events, setEvents]);

  const triggerDriveBackup = useCallback(async (): Promise<string | null> => {
    try {
      const { backupAppData } = await import('../lib/google/drive');
      const url = await backupAppData({
        tasks, notes, noteFolders, courses, events, studySessions, settings,
      });
      return url;
    } catch (e) {
      console.error('Drive backup failed:', e);
      return null;
    }
  }, [tasks, notes, noteFolders, courses, events, studySessions, settings]);

  const importGoogleEventsCb = useCallback(async (): Promise<number> => {
    try {
      const { importGoogleEvents: importEvents } = await import('../lib/google/calendar');
      const { imported } = await importEvents();
      for (const ev of imported) {
        addEvent({ title: ev.title, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, color: ev.color, description: '', allDay: false, tags: [], files: [], recurring: 'none' });
      }
      return imported.length;
    } catch (e) { console.error('Import events failed:', e); return 0; }
  }, [addEvent]);

  const triggerTasksSync = useCallback(async () => {
    try {
      const { syncAppTasksToGoogle } = await import('../lib/google/tasks');
      const { synced } = await syncAppTasksToGoogle(
        tasks.map(t => ({ id: t.id, title: t.title, description: t.notes || '', status: t.status === 'completado' ? 'completed' as const : t.status === 'progreso' ? 'in_progress' as const : 'pending' as const, dueDate: t.dueDate }))
      );
      if (synced > 0) toast.success(`${synced} tareas sincronizadas con Google Tasks`);
    } catch (e) { console.error('Tasks sync failed:', e); }
  }, [tasks]);

  const importGoogleTasksCb = useCallback(async (): Promise<number> => {
    try {
      const { importGoogleTasks: importTasks } = await import('../lib/google/tasks');
      const { imported } = await importTasks();
      for (const t of imported) {
        addTask({
          title: t.title, course: '', courseColor: '', priority: 'medium',
          urgent: false, important: false,
          dueDate: t.dueDate,
        });
      }
      return imported.length;
    } catch (e) { console.error('Import tasks failed:', e); return 0; }
  }, [addTask]);

  const searchYouTubeMusicCb = useCallback(async (query: string) => {
    try {
      const { searchStudyMusic } = await import('../lib/google/youtube');
      return await searchStudyMusic(query);
    } catch (e) { console.error('YouTube search failed:', e); return []; }
  }, []);

  const searchVideosCb = useCallback(async (query: string) => {
    try {
      const { searchVideos } = await import('../lib/google/youtube');
      return await searchVideos(query);
    } catch (e) { console.error('Video search failed:', e); return []; }
  }, []);

  const importClassroomCoursesCb = useCallback(async () => {
    try {
      const { importClassroomCourses } = await import('../lib/google/classroom');
      const { courses: imported } = await importClassroomCourses();
      for (const c of imported) {
        const exists = courses.find(x => x.id === c.id || x.name === c.name);
        if (!exists) addCourse({ name: c.name, color: c.color || '#6366f1', progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0 });
      }
    } catch (e) { console.error('Classroom import failed:', e); }
  }, [courses, addCourse]);

  const exportNotesToGoogleDocCb = useCallback(async (): Promise<string | null> => {
    try {
      const { exportNotesToDoc } = await import('../lib/google/docs');
      const url = await exportNotesToDoc(
        notes.map(n => ({ title: n.title, content: n.content, folder: noteFolders.find(f => f.id === n.folderId)?.name }))
      );
      toast.success('Notas exportadas a Google Docs');
      return url;
    } catch (e) { console.error('Export notes failed:', e); return null; }
  }, [notes, noteFolders]);

  const exportStatsToGoogleSheetsCb = useCallback(async (): Promise<string | null> => {
    try {
      const { exportStatsToSheet } = await import('../lib/google/docs');
      const headers = ['Día', 'Minutos Estudio', 'Tareas Completadas', 'Pomodoros'];
      const today = new Date().toISOString().split('T')[0];
      const data = [[today, Math.floor(sessionTime / 60), tasks.filter(t => t.status === 'completado').length, pomodoroSessions]];
      const url = await exportStatsToSheet(headers, data);
      toast.success('Estadísticas exportadas a Google Sheets');
      return url;
    } catch (e) { console.error('Export stats failed:', e); return null; }
  }, [sessionTime, tasks, pomodoroSessions]);

  const loadGoogleProfileCb = useCallback(async () => {
    try {
      const { getProfile } = await import('../lib/google/people');
      return await getProfile();
    } catch (e) { console.error('Load profile failed:', e); return null; }
  }, []);

  const searchStudyResourcesCb = useCallback(async (topic: string) => {
    try {
      const { searchStudyResources } = await import('../lib/google/customsearch');
      return await searchStudyResources(topic);
    } catch (e) { console.error('Search failed:', e); return []; }
  }, []);

  const createStudyQuizCb = useCallback(async (courseName: string, topics: string[]) => {
    try {
      const { createStudyQuiz } = await import('../lib/google/forms');
      return await createStudyQuiz(courseName, topics);
    } catch (e) { console.error('Create quiz failed:', e); return null; }
  }, []);

  const initFirebaseNotificationsCb = useCallback(async (): Promise<string | null> => {
    try {
      const { initFirebase, requestNotificationPermission } = await import('../lib/firebase');
      const ok = initFirebase();
      if (!ok) return null;
      return await requestNotificationPermission();
    } catch (e) { console.error('Firebase init failed:', e); return null; }
  }, []);

  const syncAllToCloudCb = useCallback(async () => {
    try {
      const { syncAllToSupabase } = await import('../lib/supabase');
      const user = await (await import('../lib/supabase')).getCurrentUser();
      if (!user) { console.log('No user, skipping sync'); return; }
      await syncAllToSupabase({
        tasks: tasks.map(t => ({ ...t })),
        notes: notes.map(n => ({ ...n })),
        events: events.map(e => ({ ...e })),
        studySessions: studySessions.map(s => ({ ...s })),
      });
    } catch (e) { console.error('Cloud sync failed:', e); }
  }, [tasks, notes, events, studySessions]);

  const value: AppContextType = {
    tasks, notes, noteFolders, courses, events, tracks, studySessions,
    settings, sessionTime, sessionType, weeklyStudyTime, dailyStudyTime, pomodoroSessions,
    activeTaskId, timerLocked, isTimerActive, roundsCompleted, showCompletion,
    currentTrackId, youtubeVideoUrl, isPlayingMusic, musicVolume, musicProgress, musicDuration, musicListeningTime, shuffleMode, repeatMode,
    trackHistory, playCounts, musicQueue, downloadQueue, artists,
    googleConnected, calendarSyncEnabled, lastCalendarSync,
    addTask, updateTask, deleteTask, toggleTaskStatus, clearAllTasks,
    addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, incrementTaskStudyTime,
    addNote, updateNote, deleteNote, addNoteFolder, deleteNoteFolder,
    addCourse, updateCourse, deleteCourse, reorderCourses,
    addEvent, updateEvent, deleteEvent,
    addTrack, updateTrack, deleteTrack, toggleTrackFavorite,
    playTrack, toggleMusicPlayback, setIsPlayingMusic, setMusicVolume: setMusicVolumeCb, setMusicProgress: setMusicProgressCb,
    setShuffleMode, setRepeatMode, setMusicQueue, clearAllMusicData,
    addArtist: useCallback((name: string) => {
      setArtists(prev => {
        if (prev.some(a => a.name.toLowerCase() === name.toLowerCase())) return prev;
        return [...prev, { id: Date.now().toString(), name }];
      });
    }, []),
    updateArtist: useCallback((id: string, updates: { name?: string; profileImage?: string }) => {
      setArtists(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }, []),
    deleteArtist: useCallback((id: string) => {
      setArtists(prev => prev.filter(a => a.id !== id));
    }, []),
    addToDownloadQueue, updateDownloadProgress, updateDownloadStatus,
    removeFromDownloadQueue, clearCompletedDownloads,
    addStudySession, incrementSessionTime, incrementDailyStudyTime,
    incrementPomodoroSessions, resetPomodoroSessions, setActiveTaskId, setTimerLocked,
    linkTaskToTimer, unlinkTaskFromTimer, toggleTimer, resetTimer,
    setIsTimerActive, setSessionTime, setDailyStudyTime, setWeeklyStudyTime,
    setTasks, setPomodoroSessions, setShowCompletion, setRoundsCompleted, isRest, setIsRest,
    setSessionType,
    navigateTo, setNavigateTo,
    updateSettings: updateSettingsCb,
    setGoogleConnected, setCalendarSyncEnabled, setLastCalendarSync,
    triggerCalendarSync, importGoogleEvents: importGoogleEventsCb,
    triggerTasksSync, importGoogleTasks: importGoogleTasksCb,
    searchYouTubeMusic: searchYouTubeMusicCb, searchVideos: searchVideosCb, importClassroomCourses: importClassroomCoursesCb,
    exportNotesToGoogleDoc: exportNotesToGoogleDocCb, exportStatsToGoogleSheets: exportStatsToGoogleSheetsCb,
    loadGoogleProfile: loadGoogleProfileCb,
    searchStudyResources: searchStudyResourcesCb,
    createStudyQuiz: createStudyQuizCb,
    initFirebaseNotifications: initFirebaseNotificationsCb,
    syncAllToCloud: syncAllToCloudCb,
    triggerDriveBackup,
    notifications, addNotification, clearNotifications,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
