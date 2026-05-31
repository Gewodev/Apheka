import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, Dispatch, SetStateAction } from 'react';
import { emit } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { copyFile, mkdir, exists, readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { get, set } from 'idb-keyval';
import { extractMp3Metadata } from '../lib/mp3Metadata';
import { format, parseISO, subDays } from 'date-fns';
import { appDataDir, appCacheDir, join, extname } from '@tauri-apps/api/path';

const globalAudio = new Audio();
globalAudio.volume = 0.7;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CORE TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface ImportState {
  active: boolean;
  current: number;
  total: number;
  fileName: string;
  phase: 'loading_file' | 'extracting_metadata' | 'validating_audio' | 'finished';
  phaseProgress: number;
  overallProgress: number;
}

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
  type: 'pomodoro' | 'chrono' | 'break';
  startedAt: string;
  endedAt?: string;
  duration: number;    // seconds
  taskId?: string;
  courseId?: string;
  pauseCount: number;  // for concentration calc
  pauseDuration: number; // seconds
}

export interface Settings {
  // ...existing fields
  chronoGoal: number; // seconds, default 25 * 60
  theme: 'claro' | 'oscuro' | 'sistema' | 'vibrante';
  accentColor: string;
  userName: string;
  backgroundImage?: string;
  backgroundImagePath?: string;
  uiOpacity?: number;
  backgroundBrightness?: number; // 50-200, default 100
  backgroundBlur?: number;       // 0-20, default 0 (backdrop blur on panels)
  backgroundOverlay?: number;    // 0-100, default 0 (dark overlay opacity)
  profilePhoto?: string;  // base64
  notifications: boolean;
  soundEffects: boolean;
  dailyGoal: number;        // minutes
  pomodoroTime: number;     // seconds
  shortBreakTime: number;   // seconds
  longBreakTime: number;    // seconds
  pomodoroGoal: number;     // sessions before long break
  fontFamily: string;
  heatmapStartDate?: string;
  timerFocusColor?: string;
  timerBreakColor?: string;
  timerLongBreakColor?: string;
  timerChronoColor?: string;
  floatingBgColor: string;
  floatingClockType: 'led' | 'digital';
  floatingShowAnimation: boolean;
  dailyGoalHistory?: Record<string, number>;
  initialDailyGoal?: number;
  selectedThemePreset?: string | null;
  secondaryColor?: string;
  surfaceColor?: string;
  playerBarEnabled?: boolean;
  playerBarCharacterSource?: 'url' | 'draw';
  playerBarCharacterUrl?: string;
  playerBarCharacterDraw?: string;
  playerBarFrameSpeeds?: string;
  playerBarTrackColor?: string;
  playerBarCharacterSize?: number;
  playerBarBgUrl?: string;
  playerBarTrackImage?: string;
  playerBarTrackSource?: 'url' | 'draw';
  playerBarTrackUrl?: string;
  playerBarTrackDraw?: string;
  playerBarTrackFrameSpeeds?: string;
  // Character styling
  playerBarCharacterBorderColor?: string;
  playerBarCharacterBorderWidth?: number;
  playerBarCharacterShadow?: number;
  playerBarCharacterOffsetY?: number;
  playerBarCharacterBorderRadius?: number;
  // Bar container styling
  playerBarBorderRadius?: number;
  playerBarBorderColor?: string;
  playerBarBorderWidth?: number;
  playerBarHeight?: 'compact' | 'normal' | 'large';
  playerBarBgColor?: string;
  // Progress track styling
  playerBarTrackHeight?: number;
  // 3-color system
  useThreeColors?: boolean;
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  APP STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  
  sessionType: 'pomodoro' | 'chrono';
  // Pause tracking and time distribution
  accumulatedPauseTime: number;
  pauseStartTime: number | null;
  distractionCount: number;
  focusPomodoroTime: number;
  focusChronoTime: number;
  breakTime: number;
  dailyBreakTime: Record<string, number>;
  dailyFocusPomodoro: Record<string, number>;
  dailyFocusChrono: Record<string, number>;
  // Music Player
  isAudioLoading: boolean;
  // Downloads
  downloadQueue: DownloadItem[];
  downloadPath: string;
  setDownloadPathCtx: (path: string) => void;
  // Integrations
  googleConnected: boolean;
  calendarSyncEnabled: boolean;
  lastCalendarSync: string | null;
  showCompletion: boolean;
  importState: ImportState;
  artists: { id: string; name: string; profileImage?: string }[];
  trackHistory: string[];
  playCounts: Record<string, number>;
  musicQueue: string[];
  musicVolume: number;
  musicProgress: number;
  musicDuration: number;
  musicListeningTime: number;
  dailyMusicTime: Record<string, number>;
  shuffleMode: boolean;
  repeatMode: 'none' | 'all' | 'one';
  currentTrackId: string | null;
  youtubeVideoUrl: string | null;
  isPlayingMusic: boolean;
}

export type ViewId = 'inicio' | 'tareas' | 'apuntes' | 'estudio' | 'cursos' | 'analiticas' | 'chat' | 'ajustes' | 'musica' | 'flujo' | 'canvas';

interface AppContextType extends AppState {
  setSessionType: (val: 'pomodoro' | 'chrono') => void;
  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'studyTime'> & { notes?: string; files?: TaskFile[]; subtasks?: SubTask[] }) => void;
  clearAllTasks: () => void;
  deleteCompletedTasks: () => void;
  deleteOldCompletedTasks: () => void;
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
  importLocalTracks: (paths: string[]) => Promise<void>;
  // Music Player
  isAudioLoading: boolean;
  playTrack: (id: string) => void;
  toggleMusicPlayback: () => void;
  setIsPlayingMusic: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMusicVolume: (volume: number) => void;
  setMusicProgress: (progress: number) => void;
  setShuffleMode: (mode: boolean) => void;
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;
  setMusicQueue: (queue: string[]) => void;
  clearCurrentTrack: () => void;
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
  setIsRest: Dispatch<SetStateAction<boolean>>;
  setAccumulatedPauseTime: Dispatch<SetStateAction<number>>;
  setPauseStartTime: Dispatch<SetStateAction<number | null>>;
  setDistractionCount: Dispatch<SetStateAction<number>>;
  setFocusPomodoroTime: Dispatch<SetStateAction<number>>;
  setFocusChronoTime: Dispatch<SetStateAction<number>>;
  setBreakTime: Dispatch<SetStateAction<number>>;
  setDailyFocusPomodoro: Dispatch<SetStateAction<Record<string, number>>>;
  setDailyFocusChrono: Dispatch<SetStateAction<Record<string, number>>>;
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
  importClassroomAssignments: () => Promise<number>;
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
  removeNotification: (id: string) => void;
  toastMessage: { message: string; type: 'success' | 'error' | 'info' } | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DEFAULTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  uiOpacity: 0.85,
  notifications: true,
  soundEffects: true,
  dailyGoal: 240,
  pomodoroTime: 25 * 60,
  shortBreakTime: 5 * 60,
  longBreakTime: 15 * 60,
  pomodoroGoal: 4,
  fontFamily: 'Inter',
  floatingBgColor: '#020203',
  floatingClockType: 'led',
  floatingShowAnimation: false,
  selectedThemePreset: null,
  secondaryColor: '#3B82F6',
  surfaceColor: '#1a1a22',
  playerBarEnabled: false,
  playerBarCharacterSource: 'url',
  playerBarCharacterUrl: '',
  playerBarCharacterDraw: '',
  playerBarFrameSpeeds: '',
  playerBarTrackColor: '#E11D48',
  playerBarCharacterSize: 40,
  playerBarBgUrl: '',
  playerBarTrackImage: '',
  playerBarTrackSource: 'url',
  playerBarTrackUrl: '',
  playerBarTrackDraw: '',
  playerBarTrackFrameSpeeds: '',
  playerBarCharacterBorderColor: '',
  playerBarCharacterBorderWidth: 0,
  playerBarCharacterShadow: 6,
  playerBarCharacterOffsetY: 0,
  playerBarCharacterBorderRadius: 50,
  playerBarBorderRadius: 12,
  playerBarBorderColor: '',
  playerBarBorderWidth: 0,
  playerBarHeight: 'normal',
  playerBarBgColor: '',
  playerBarTrackHeight: 3,
  useThreeColors: false,
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
export { AppContext };

function getAudioDuration(fileUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(fileUrl);
    audio.muted = true;
    audio.volume = 0;
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 10000);
    
    function cleanup() {
      clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
      audio.load();
    }
    
    function onLoadedMetadata() {
      const dur = audio.duration;
      cleanup();
      resolve(isFinite(dur) ? dur : 0);
    }
    
    function onError() {
      cleanup();
      resolve(0);
    }
    
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    audio.load();
  });
}

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
  const [dailyStudyDate, setDailyStudyDate] = useState('');
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
  const [dailyBreakTime, setDailyBreakTime] = useState<Record<string, number>>({});
  const [dailyFocusPomodoro, setDailyFocusPomodoro] = useState<Record<string, number>>({});
  const [dailyFocusChrono, setDailyFocusChrono] = useState<Record<string, number>>({});

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState<string | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [musicProgress, setMusicProgress] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [shuffleMode, _setShuffleMode] = useState(false);
  const [repeatMode, _setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev.slice(-49), { id, message, type, timestamp: Date.now() }]);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ message, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const setShuffleMode = useCallback((mode: boolean) => {
    _setShuffleMode(mode);
    if (mode) {
      _setRepeatMode('none');
      // Populate shuffled queue
      setMusicQueue(prev => {
        if (prev.length > 0) return prev;
        const rest = tracksRef.current.filter(t => t.id !== currentTrackIdRef.current).map(t => t.id);
        return shuffleArray(rest);
      });
    }
  }, []);
  const setRepeatMode = useCallback((mode: 'none' | 'all' | 'one') => {
    _setRepeatMode(mode);
    if (mode !== 'none') _setShuffleMode(false);
  }, []);
  // Shuffle utility (Fisher-Yates)
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
   const [trackPlayDurations, setTrackPlayDurations] = useState<Record<string, number>>({});
   const [currentTrackStartTime, setCurrentTrackStartTime] = useState<number | null>(null);
   const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
   const [trackHistory, setTrackHistory] = useState<string[]>([]);
   const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [musicQueue, setMusicQueue] = useState<string[]>([]);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [downloadPath, setDownloadPathState] = useState(() => localStorage.getItem('owa_download_path') || '');
  const [importState, setImportState] = useState<ImportState>({
    active: false,
    current: 0,
    total: 0,
    fileName: '',
    phase: 'finished',
    phaseProgress: 100,
    overallProgress: 100,
  });
  const [musicListeningTime, setMusicListeningTime] = useState(0);
  const [musicListeningDate, setMusicListeningDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dailyMusicTime, setDailyMusicTime] = useState<Record<string, number>>({});

  // Reset listening time daily
  useEffect(() => {
    const check = setInterval(() => {
      const today = format(new Date(), 'yyyy-MM-dd');
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
      const today = format(new Date(), 'yyyy-MM-dd');
      setDailyMusicTime(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
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
  const autoPlayRef = useRef(false);
  const activePlaySessionIdRef = useRef<string | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const isPlayingMusicRef = useRef(isPlayingMusic);
  const currentTrackStartTimeRef = useRef<number | null>(null);
  const intentionalPauseRef = useRef(false);
  const wakeResumeLockRef = useRef(false);
  
  useEffect(() => { currentTrackIdRef.current = currentTrackId; }, [currentTrackId]);
   useEffect(() => { tracksRef.current = tracks; }, [tracks]);
   useEffect(() => { shuffleModeRef.current = shuffleMode; }, [shuffleMode]);
   useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
   useEffect(() => { musicQueueRef.current = musicQueue; }, [musicQueue]);
   useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);
  useEffect(() => { isPlayingMusicRef.current = isPlayingMusic; }, [isPlayingMusic]);
  useEffect(() => { currentTrackStartTimeRef.current = currentTrackStartTime; }, [currentTrackStartTime]);

   const [navigateTo, setNavigateTo] = useState<ViewId | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [lastCalendarSync, setLastCalendarSync] = useState<string | null>(null);

  // Load from IndexedDB / localStorage
  useEffect(() => {
    async function loadData() {
      try {
        let stored = await get(STORAGE_KEY);
        if (!stored) {
          stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            await set(STORAGE_KEY, stored);
            localStorage.removeItem(STORAGE_KEY);
          }
        }
        if (stored) {
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
          if (data.settings) {
            // Migration: dailyGoalHistory keys might have been stored in UTC (from old code using toISOString)
            if (data.settings.dailyGoalHistory) {
              const rawHistory = data.settings.dailyGoalHistory as Record<string, number>;
              const fixed: Record<string, number> = {};
              for (const key of Object.keys(rawHistory)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                  fixed[key] = rawHistory[key];
                } else {
                  // Try to fix: it was stored as ISO date string
                  try {
                    const localDate = format(parseISO(key), 'yyyy-MM-dd');
                    fixed[localDate] = rawHistory[key];
                  } catch {
                    fixed[key] = rawHistory[key];
                  }
                }
              }
              data.settings.dailyGoalHistory = fixed;
            }
            setSettings({ ...defaultSettings, ...data.settings });
          }
          if (data.sessionTime) setSessionTime(data.sessionTime);
          if (data.sessionType) setSessionType(data.sessionType);
          if (data.weeklyStudyTime) setWeeklyStudyTime(data.weeklyStudyTime);
          const today = format(new Date(), 'yyyy-MM-dd');
          if (data.dailyStudyTime !== undefined && data.dailyStudyDate === today) {
            setDailyStudyTime(data.dailyStudyTime);
          }
          if (data.pomodoroSessions) setPomodoroSessions(data.pomodoroSessions);
          if (data.musicVolume !== undefined) setMusicVolume(data.musicVolume);
          if (data.currentTrackId) setCurrentTrackId(data.currentTrackId);
          if (data.musicProgress !== undefined) setMusicProgress(data.musicProgress);
          if (data.musicDuration !== undefined) setMusicDuration(data.musicDuration);
          if (data.musicListeningTime !== undefined) {
            const today = format(new Date(), 'yyyy-MM-dd');
            if (data.musicListeningDate === today) {
              setMusicListeningTime(data.musicListeningTime);
            }
          }
          if (data.dailyMusicTime) setDailyMusicTime(data.dailyMusicTime);
          if (data.accumulatedPauseTime !== undefined) setAccumulatedPauseTime(data.accumulatedPauseTime);
          setPauseStartTime(null);
          if (data.distractionCount !== undefined) setDistractionCount(data.distractionCount);
          if (data.focusPomodoroTime !== undefined) setFocusPomodoroTime(data.focusPomodoroTime);
          if (data.focusChronoTime !== undefined) setFocusChronoTime(data.focusChronoTime);
          if (data.breakTime !== undefined) setBreakTime(data.breakTime);
          if (data.dailyBreakTime) setDailyBreakTime(data.dailyBreakTime);
          if (data.dailyFocusPomodoro) setDailyFocusPomodoro(data.dailyFocusPomodoro);
          if (data.dailyFocusChrono) setDailyFocusChrono(data.dailyFocusChrono);
          setIsPlayingMusic(false);
          if (data.downloadPath) setDownloadPathState(data.downloadPath);
        }
      } catch (e) {
        console.error('Error loading data:', e);
      }
      // Sync with Rust backend for default path
      try {
        const { getDownloadPath } = await import('../lib/musicApi');
        const rustPath = await getDownloadPath();
        if (rustPath) {
          setDownloadPathState(prev => prev || rustPath);
        }
      } catch { /* not in Tauri */ }
    }
    loadData();
  }, []);

  // Auto-play saved track after data loads
  const autoPlayedRef = useRef(false);
  const savedTrackIdRef = useRef<string | null>(null);
  const savedProgressRef = useRef(0);

  useEffect(() => {
    if (currentTrackId && tracks.length > 0 && !autoPlayedRef.current && tracks.find(t => t.id === currentTrackId)) {
      autoPlayedRef.current = true;
      savedTrackIdRef.current = currentTrackId;
      savedProgressRef.current = musicProgress;
      // Use setTimeout to let React batch state updates
      const tid = currentTrackId;
      const prog = musicProgress;
      setTimeout(() => {
        playTrack(tid);
        if (prog > 0) {
          setTimeout(() => { globalAudio.currentTime = prog; }, 600);
        }
      }, 100);
    }
  }, [tracks, currentTrackId]);

  // Refs to avoid stale closures in timer interval
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;

  // Midnight reset (local time): auto-reset dailyStudyTime when date changes
  useEffect(() => {
    const checkDay = () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      setDailyStudyDate(prev => {
        if (prev !== today) {
          setDailyStudyTime(0);
          return today;
        }
        return prev;
      });
    };
    checkDay();
    const t = setInterval(checkDay, 30000);
    return () => clearInterval(t);
  }, []);
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
          const today = format(new Date(), 'yyyy-MM-dd');
          setDailyBreakTime(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
        } else {
          const today = format(new Date(), 'yyyy-MM-dd');
          setDailyStudyDate(today);
          setDailyStudyTime(prev => prev + 1);
          setWeeklyStudyTime(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));

          if (type === 'pomodoro') {
            setFocusPomodoroTime(prev => prev + 1);
            setDailyFocusPomodoro(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
          } else {
            setFocusChronoTime(prev => prev + 1);
            setDailyFocusChrono(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
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
      set(STORAGE_KEY, JSON.stringify({
        tasks, notes, noteFolders, courses, events, tracks, studySessions,
        settings, sessionTime, sessionType, weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions,
        trackHistory, playCounts, musicQueue, musicVolume, shuffleMode, repeatMode, artists,
        currentTrackId, musicListeningTime, musicListeningDate, dailyMusicTime,
        musicProgress, musicDuration, downloadPath,
        accumulatedPauseTime, pauseStartTime, distractionCount,
        focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
        dailyFocusPomodoro, dailyFocusChrono,
      })).catch((e: any) => console.error("Error saving data:", e));
    }, 300);
    return () => clearTimeout(t);
  }, [
    tasks, notes, noteFolders, courses, events, tracks, studySessions, settings, sessionTime,
    weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions, trackHistory, playCounts, musicQueue,
    musicVolume, artists, musicListeningTime, musicListeningDate, dailyMusicTime,
    musicProgress, musicDuration, downloadPath,
    accumulatedPauseTime, pauseStartTime, distractionCount,
    focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
    dailyFocusPomodoro, dailyFocusChrono,
  ]);

  // Pause audio when closing window
  useEffect(() => {
    const handleBeforeUnload = () => {
      globalAudio.pause();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // â”€â”€ TASKS â”€â”€
  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'studyTime'> & { notes?: string; files?: TaskFile[]; subtasks?: SubTask[] }) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      status: 'inicio',
      subtasks: task.subtasks || [],
      files: task.files || [],
      notes: task.notes || '',
      studyTime: 0
    };
    setTasks(prev => [...prev, newTask]);
    setCourses(prev => prev.map(c => c.name === task.course ? { ...c, totalTasks: c.totalTasks + 1 } : c));
  }, []);

  const clearAllTasks = useCallback(() => {
    setTasks([]);
    setCourses(prev => prev.map(c => ({ ...c, totalTasks: 0, completedTasks: 0 })));
  }, []);

  const deleteCompletedTasks = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completado'));
    addNotification('Tareas completadas eliminadas', 'success');
  }, []);

  const deleteOldCompletedTasks = useCallback(() => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    setTasks(prev => {
      const toDelete = prev.filter(t => t.status === 'completado' && t.completedAt && new Date(t.completedAt) < twoMonthsAgo);
      if (toDelete.length > 0) {
        setTimeout(() => addNotification(`${toDelete.length} tareas antiguas eliminadas automáticamente`, 'info'), 100);
      }
      return prev.filter(t => !(t.status === 'completado' && t.completedAt && new Date(t.completedAt) < twoMonthsAgo));
    });
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

  // â”€â”€ NOTES â”€â”€
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

  // â”€â”€ COURSES â”€â”€
  const addCourse = useCallback((course: Omit<Course, 'id' | 'sortOrder'> & { id?: string }) => {
    const newId = course.id || Date.now().toString();
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

  // â”€â”€ EVENTS â”€â”€
  const addEvent = useCallback((event: Omit<ScheduleEvent, 'id'>) => {
    setEvents(prev => [...prev, { ...event, id: Date.now().toString() }]);
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<ScheduleEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  // â”€â”€ MUSIC â”€â”€
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

  const playAudioInstance = useCallback((sessionId: string | null) => {
    if (!sessionId || activePlaySessionIdRef.current !== sessionId) return;
    
    if (globalAudio.ended) globalAudio.currentTime = 0;
    // Guard: if already playing or pending resume, skip duplicate call
    if (!globalAudio.paused) return;
    globalAudio.play().then(() => {
      if (activePlaySessionIdRef.current !== sessionId) {
        intentionalPauseRef.current = true;
        globalAudio.pause();
        intentionalPauseRef.current = false;
        return;
      }
      setIsPlayingMusic(true);
    }).catch((err) => {
      console.warn('[Audio] play() failed:', err.name, err.message);
      if (activePlaySessionIdRef.current === sessionId) {
        setIsPlayingMusic(false);
      }
    });
  }, []);

  const playAudioInstanceRef = useRef(playAudioInstance);
  useEffect(() => {
    playAudioInstanceRef.current = playAudioInstance;
  }, [playAudioInstance]);

  const importLocalTracks = useCallback(async (selectedPaths: string[]) => {
    if (!selectedPaths || selectedPaths.length === 0) return;

    setImportState({
      active: true,
      current: 0,
      total: selectedPaths.length,
      fileName: '',
      phase: 'loading_file',
      phaseProgress: 0,
      overallProgress: 0,
    });

    let imported = 0;
    
    for (let i = 0; i < selectedPaths.length; i++) {
      const path = selectedPaths[i];
      const name = path.split(/[/\\]/).pop() || 'Unknown';
      
      const updateProgress = (phase: ImportState['phase'], phaseProgress: number) => {
        const itemBudget = 100 / selectedPaths.length;
        const currentItemBase = (i * 100) / selectedPaths.length;
        const overallProgress = Math.round(currentItemBase + (phaseProgress * itemBudget) / 100);
        setImportState(prev => ({
          ...prev,
          current: i + 1,
          fileName: name,
          phase,
          phaseProgress,
          overallProgress,
        }));
      };

      try {
        // Phase 1: Loading/Reading file
        updateProgress('loading_file', 10);
        const readInterval = setInterval(() => {
          setImportState(prev => {
            if (prev.phase === 'loading_file' && prev.phaseProgress < 80) {
              const nextVal = prev.phaseProgress + 10;
              const itemBudget = 100 / selectedPaths.length;
              const currentItemBase = (prev.current - 1 * 100) / prev.total; // wait, prev is safe
              return { ...prev, phaseProgress: nextVal };
            }
            return prev;
          });
        }, 80);

        const data = await readFile(path);
        clearInterval(readInterval);
        updateProgress('loading_file', 100);

        // Phase 2: Metadata Parsing
        updateProgress('extracting_metadata', 10);
        const meta = path.toLowerCase().endsWith('.mp3') 
          ? await extractMp3Metadata(path) 
          : { title: undefined, artist: undefined, collaborators: [] as string[], coverUrl: undefined };
        updateProgress('extracting_metadata', 100);

        // Phase 3: Audio Validation & Duration Extraction
        updateProgress('validating_audio', 10);
        const assetUrl = convertFileSrc(path);
        const duration = await getAudioDuration(assetUrl);
        
        updateProgress('validating_audio', 100);

        const trackExists = tracksRef.current.some(t => t.url === path);
        if (trackExists) {
          imported++;
          continue;
        }

        const trackTitle = meta.title || name.replace(/\.[^/.]+$/, "");
        const trackArtist = meta.artist || 'Artista Local';
        const trackCollaborators = meta.collaborators || [];
        const trackDuration = duration || 0;
        const trackCoverImage = meta.coverUrl || undefined;

        // Generate ID and append to tracks
        const trackId = crypto.randomUUID();
        setTracks(prev => [...prev, {
          id: trackId,
          title: trackTitle,
          artist: trackArtist,
          collaborators: trackCollaborators,
          duration: Math.round(trackDuration),
          source: 'local',
          url: path,
          coverImage: trackCoverImage,
          isFavorite: false,
          listenedTime: 0
        }]);

        imported++;
      } catch (err) {
        console.error("Error importing track:", path, err);
        addNotification(`Error al procesar: ${name}`, 'error');
      }
    }

    setImportState({
      active: false,
      current: 0,
      total: 0,
      fileName: '',
      phase: 'finished',
      phaseProgress: 100,
      overallProgress: 100,
    });
    
    addNotification(`${imported} cancion(es) importada(s) correctamente`, 'success');
  }, []);

  const playTrack = useCallback((id: string) => {
    // If same track already loaded, just resume (no reload needed)
    if (loadedTrackIdRef.current === id) {
      if (!globalAudio.paused) {
        setIsPlayingMusic(true);
        return;
      }
      // Guard: prevent duplicate play calls during wake-up
      if (wakeResumeLockRef.current || activePlaySessionIdRef.current) {
        setIsPlayingMusic(true);
        return;
      }
      // Loaded but paused - resume without re-reading file
      if (globalAudio.ended) globalAudio.currentTime = 0;
      setMusicProgress(0);
      setIsPlayingMusic(true);
      setCurrentTrackStartTime(Date.now() / 1000);
      const playSessionId = crypto.randomUUID();
      activePlaySessionIdRef.current = playSessionId;
      playAudioInstance(playSessionId);
      return;
    }

    const playSessionId = crypto.randomUUID();
    activePlaySessionIdRef.current = playSessionId;

    // Save current track's played duration before switching
    if (currentTrackStartTime !== null && currentTrackId) {
      const endTime = Date.now() / 1000;
      const durationPlayed = endTime - currentTrackStartTime;
      setTrackPlayDurations(prev => {
        const currentDuration = prev[currentTrackId!] || 0;
        return { ...prev, [currentTrackId!]: currentDuration + durationPlayed };
      });
    }

    // Cancel any pending auto-play and clean up previous blob
    autoPlayRef.current = false;
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    globalAudio.pause();

    loadedTrackIdRef.current = null;
    setCurrentTrackId(id);
    setCurrentTrackStartTime(Date.now() / 1000);
    setIsPlayingMusic(false);
    setMusicProgress(0);
    setMusicDuration(0);

    const track = tracks.find(t => t.id === id);
    if (!track || !track.url) {
      setYoutubeVideoUrl(null);
      return;
    }

    // YouTube â†’ ReactPlayer
    if (track.url.includes('youtube.com/') || track.url.includes('youtu.be/')) {
      setYoutubeVideoUrl(track.url);
      setIsPlayingMusic(true);
      setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
      setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      loadedTrackIdRef.current = id;
      return;
    }
    setYoutubeVideoUrl(null);

    // Audio playback: try readFile + Blob, fallback to convertFileSrc
    const setupAudio = async () => {
      try {
        if (!track.url) return;

        if (track.source === 'local') {
          let srcUrl: string | null = null;

          try {
        // Strategy 1: readFile + Blob URL (no range requests)
        const data = await readFile(track.url);
        console.log(`[Audio] readFile: ${data.length} bytes for ${track.title}`);
        if (activePlaySessionIdRef.current !== playSessionId) return;
        if (data && data.length > 100) {
          const ext = track.url.split('.').pop()?.toLowerCase() || '';
          const mimeMap: Record<string, string> = {
            mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
            ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
            wma: 'audio/x-ms-wma', opus: 'audio/opus',
          };
          const mime = mimeMap[ext] || 'audio/mpeg';
          const blob = new Blob([data], { type: mime });
          srcUrl = URL.createObjectURL(blob);
          currentBlobUrlRef.current = srcUrl;
          console.log(`[Audio] Blob URL created: ${srcUrl}`);
        }
          } catch (readErr) {
            console.warn('[Audio] readFile failed, trying convertFileSrc:', readErr);
          }

          // Strategy 2: convertFileSrc if readFile didn't produce a valid URL
          if (!srcUrl) {
            console.log('[Audio] Falling back to convertFileSrc');
            srcUrl = convertFileSrc(track.url);
          }

          if (activePlaySessionIdRef.current !== playSessionId) {
            if (srcUrl && srcUrl.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
            return;
          }

          loadedTrackIdRef.current = id;
          autoPlayRef.current = true;
          globalAudio.src = srcUrl;
          console.log('[Audio] set src to', srcUrl);
          globalAudio.load();
        } else {
          // Remote URL: use directly
          if (activePlaySessionIdRef.current !== playSessionId) return;
          loadedTrackIdRef.current = id;
          autoPlayRef.current = true;
          globalAudio.src = track.url;
          globalAudio.load();
        }
      } catch (e) {
        if (activePlaySessionIdRef.current === playSessionId) {
          console.warn('Playback setup failed:', e);
        }
      }
    };
    setupAudio();

    setMusicQueue(prev => {
      if (prev.length > 0) return prev;
      const currentIdx = tracks.findIndex(t => t.id === id);
      if (currentIdx === -1) return prev;
      const rest = tracks.slice(currentIdx + 1).map(t => t.id);
      return shuffleMode ? shuffleArray(rest) : rest;
    });

    setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
    setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, [tracks, currentTrackId, currentTrackStartTime, setTrackPlayDurations, setIsPlayingMusic, setTrackHistory, setPlayCounts]);

  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  const toggleMusicPlayback = useCallback(() => {
    const currentTrack = currentTrackIdRef.current ? tracksRef.current.find(t => t.id === currentTrackIdRef.current) : null;
    if (!currentTrack) return;
    
    const isYouTubeTrack = currentTrack.url?.includes('youtube.com/') || currentTrack.url?.includes('youtu.be/');

    if (isYouTubeTrack) {
      if (!youtubeVideoUrl) setYoutubeVideoUrl(currentTrack.url!);
      setIsPlayingMusic(prev => !prev);
      return;
    }

    // Cancel any pending auto-play
    autoPlayRef.current = false;

    // If the track is not loaded yet: cancel loading if playing, start if paused
    if (loadedTrackIdRef.current !== currentTrack.id) {
      if (isPlayingMusic) {
        activePlaySessionIdRef.current = null;
        setIsPlayingMusic(false);
      } else {
        playTrack(currentTrack.id);
      }
      return;
    }

    const playSessionId = crypto.randomUUID();
    activePlaySessionIdRef.current = playSessionId;

    if (globalAudio.paused) {
      setIsPlayingMusic(true);
      setCurrentTrackStartTime(Date.now() / 1000);
      playAudioInstance(playSessionId);
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
      intentionalPauseRef.current = true;
      const ramp = setInterval(() => {
        i++;
        globalAudio.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
          clearInterval(ramp);
    intentionalPauseRef.current = true;
    globalAudio.pause();
    intentionalPauseRef.current = false;
          globalAudio.volume = musicVolumeRef.current; // reset for next play
          setIsPlayingMusic(false);
          intentionalPauseRef.current = false;
        }
      }, stepMs);
    }
  }, [youtubeVideoUrl, currentTrackId, currentTrackStartTime, isPlayingMusic, musicVolume, setTrackPlayDurations, setIsPlayingMusic]);

  const setMusicProgressCb = useCallback((progress: number) => {
    setMusicProgress(progress);
    if (globalAudio.duration && isFinite(progress)) {
      globalAudio.currentTime = progress * globalAudio.duration;
    }
  }, []);

  const clearCurrentTrack = useCallback(() => {
    setCurrentTrackId(null);
    setYoutubeVideoUrl(null);
    setIsPlayingMusic(false);
    globalAudio.pause();
    globalAudio.src = '';
  }, []);

  const setMusicVolumeCb = useCallback((volume: number) => {
    setMusicVolume(volume);
    globalAudio.volume = volume;
  }, []);

  // Music audio engine: init events
  useEffect(() => {
    globalAudio.volume = musicVolume;
    const audio = globalAudio;

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
        if (repeatModeRef.current === 'one') {
          globalAudio.currentTime = 0;
          globalAudio.play().catch(() => {});
          return;
        }
        let nextId: string | null = null;
        const q = musicQueueRef.current;
        const cid = currentTrackIdRef.current;
        if (q.length > 0) {
          const [next] = q;
          setMusicQueue([...q.slice(1), cid]);
          nextId = next;
        } else if (shuffleModeRef.current || repeatModeRef.current === 'all') {
          const rest = tracksRef.current.filter(t => t.id !== cid).map(t => t.id);
          const refilled = shuffleModeRef.current ? shuffleArray(rest) : rest;
          if (refilled.length > 0) {
            setMusicQueue(refilled.slice(1));
            nextId = refilled[0];
          }
        }
        if (nextId) playTrackRef.current(nextId);
        else setIsPlayingMusic(false);
      } else {
        setIsPlayingMusic(false);
      }
    };
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const onError = () => {
      const cid = currentTrackIdRef.current;
      if (!cid) { setIsPlayingMusic(false); return; }
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        retryCount++;
        const delay = Math.min(500 * Math.pow(2, retryCount - 1), 3000);
        console.warn(`Audio playback error for track ${cid}, retry ${retryCount}/3 in ${delay}ms`);
        retryTimer = setTimeout(() => {
          if (currentTrackIdRef.current === cid && isPlayingMusicRef.current) {
            globalAudio.load();
            globalAudio.play().catch(() => {});
          }
        }, delay);
      } else {
        console.warn('Audio playback error, max retries reached for track:', cid);
        setIsPlayingMusic(false);
      }
    };
    const onStalled = () => {
      if (isPlayingMusicRef.current && !globalAudio.paused) {
        console.warn('Audio stalled, attempting recovery');
        globalAudio.play().catch(() => {});
      }
    };
    const onCanPlay = () => {
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        playAudioInstanceRef.current(activePlaySessionIdRef.current);
      }
    };
    const onPauseExternal = () => {
      if (intentionalPauseRef.current) return;
      // Browser paused audio externally (lid close, sleep, etc.)
      if (currentTrackStartTimeRef.current !== null && currentTrackIdRef.current) {
        const endTime = Date.now() / 1000;
        const durationPlayed = endTime - currentTrackStartTimeRef.current;
        setTrackPlayDurations(prev => {
          const cid = currentTrackIdRef.current;
          if (!cid) return prev;
          const currentDuration = prev[cid] || 0;
          return { ...prev, [cid]: currentDuration + durationPlayed };
        });
      }
      setCurrentTrackStartTime(null);
      setIsPlayingMusic(false);
    };
    const onPlayExternal = () => {
      if (!currentTrackStartTimeRef.current) {
        setCurrentTrackStartTime(Date.now() / 1000);
      }
      setIsPlayingMusic(true);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('pause', onPauseExternal);
    audio.addEventListener('play', onPlayExternal);

    // sync state when tab becomes visible again (lid open, tab switch)
    const onVisibilityChange = () => {
      if (!document.hidden && currentTrackIdRef.current) {
        const currentTrack = tracksRef.current.find(t => t.id === currentTrackIdRef.current);
        const isYouTube = currentTrack?.url?.includes('youtube.com/') || currentTrack?.url?.includes('youtu.be/');

        if (isYouTube) {
          // YouTube uses ReactPlayer which handles its own resume
          // Just sync the state flag if needed
          if (isPlayingMusicRef.current) {
            setIsPlayingMusic(true);
          }
        } else {
          // Native audio — browser may have paused it during suspend
          if (audio.paused && isPlayingMusicRef.current && !wakeResumeLockRef.current) {
            wakeResumeLockRef.current = true;
            // Save duration played before pause
            if (currentTrackStartTimeRef.current !== null) {
              const endTime = Date.now() / 1000;
              const durationPlayed = endTime - currentTrackStartTimeRef.current;
              setTrackPlayDurations(prev => {
                const cid = currentTrackIdRef.current;
                if (!cid) return prev;
                const currentDuration = prev[cid] || 0;
                return { ...prev, [cid]: currentDuration + durationPlayed };
              });
            }
            // Resume after a short delay to let audio system recover
            setTimeout(() => {
              if (currentTrackIdRef.current && isPlayingMusicRef.current && audio.paused) {
                if (audio.ended) audio.currentTime = 0;
                audio.play().then(() => {
                  setCurrentTrackStartTime(Date.now() / 1000);
                }).catch(() => {
                  // Audio may need reload — gracefully stop
                  setIsPlayingMusic(false);
                }).finally(() => {
                  wakeResumeLockRef.current = false;
                });
              } else {
                wakeResumeLockRef.current = false;
              }
            }, 200);
          } else if (!audio.paused && !isPlayingMusicRef.current) {
            setIsPlayingMusic(true);
            setCurrentTrackStartTime(Date.now() / 1000);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('pause', onPauseExternal);
      audio.removeEventListener('play', onPlayExternal);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, []);

  // â”€â”€ STUDY SESSIONS â”€â”€
  const lastSessionKeyRef = useRef<string>('');
  const addStudySession = useCallback((session: Omit<StudySession, 'id'>) => {
    // Dedup: prevent duplicate sessions created within 2s with same type+duration
    const key = `${session.type}-${session.duration}-${Math.floor(Date.now() / 2000)}`;
    if (key === lastSessionKeyRef.current) return;
    lastSessionKeyRef.current = key;
    setStudySessions(prev => [...prev, { ...session, id: Date.now().toString() }]);
  }, []);

  const incrementSessionTime = useCallback(() => {
    setSessionTime(prev => prev + 1);
  }, []);

  const incrementDailyStudyTime = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setDailyStudyDate(today);
    setDailyStudyTime(prev => prev + 1);
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

  // â”€â”€ DOWNLOADS â”€â”€
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

  const setDownloadPathCb = useCallback((path: string) => {
    setDownloadPathState(path);
    localStorage.setItem('owa_download_path', path);
    try {
      import('../lib/musicApi').then(m => m.setDownloadPath(path)).catch(() => {});
    } catch { /* not in Tauri */ }
  }, []);

  // â”€â”€ SETTINGS â”€â”€
  const updateSettingsCb = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => {
      const today = format(new Date(), 'yyyy-MM-dd');
      let extra: Partial<Settings> = {};
      if (updates.dailyGoal !== undefined && updates.dailyGoal !== prev.dailyGoal) {
        extra = {
          dailyGoalHistory: { ...prev.dailyGoalHistory, [today]: updates.dailyGoal },
          initialDailyGoal: prev.initialDailyGoal ?? prev.dailyGoal,
        };
      }
      return { ...prev, ...updates, ...extra };
    });
  }, []);

  // â”€â”€ INTEGRATIONS â”€â”€
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
      if (synced > 0) addNotification(`${synced} tareas sincronizadas con Google Tasks`, 'success');
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
        if (!exists) addCourse({ id: c.id, name: c.name, color: c.color || '#6366f1', progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0 });
      }
    } catch (e) { console.error('Classroom import failed:', e); }
  }, [courses, addCourse]);

  const importClassroomAssignmentsCb = useCallback(async (): Promise<number> => {
    try {
      const { importClassroomAssignments } = await import('../lib/google/classroom');
      let count = 0;
      for (const course of courses) {
        try {
          const { assignments } = await importClassroomAssignments(course.id);
          for (const a of assignments) {
            const exists = tasks.find(t => t.title === a.title && t.course === course.name);
            if (!exists) {
              // Extract file url if present and build a list item
              const filesList = a.url ? [{ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: 'Enlace a Classroom', path: a.url, type: 'link' }] : [];
              addTask({
                title: a.title,
                course: course.name,
                courseColor: course.color,
                priority: 'medium',
                urgent: false,
                important: false,
                dueDate: a.dueDate,
                notes: a.description || '',
                files: filesList
              });
              count++;
            }
          }
        } catch (err) {
          // Skip local-only or failed courses silently
        }
      }
      return count;
    } catch (e) {
      console.error('Classroom assignments import failed:', e);
      return 0;
    }
  }, [courses, tasks, addTask]);

  const exportNotesToGoogleDocCb = useCallback(async (): Promise<string | null> => {
    try {
      const { exportNotesToDoc } = await import('../lib/google/docs');
      const url = await exportNotesToDoc(
        notes.map(n => ({ title: n.title, content: n.content, folder: noteFolders.find(f => f.id === n.folderId)?.name }))
      );
      addNotification('Notas exportadas a Google Docs', 'success');
      return url;
    } catch (e) { console.error('Export notes failed:', e); return null; }
  }, [notes, noteFolders]);

  const exportStatsToGoogleSheetsCb = useCallback(async (): Promise<string | null> => {
    try {
      const { exportStatsToSheet } = await import('../lib/google/docs');
      const headers = ['Día', 'Minutos Estudio', 'Tareas Completadas', 'Pomodoros'];
      const today = format(new Date(), 'yyyy-MM-dd');
      const data = [[today, Math.floor(sessionTime / 60), tasks.filter(t => t.status === 'completado').length, pomodoroSessions]];
      const url = await exportStatsToSheet(headers, data);
      addNotification('Estadísticas exportadas a Google Sheets', 'success');
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
    currentTrackId, youtubeVideoUrl, isPlayingMusic, isAudioLoading, musicVolume, musicProgress, musicDuration, musicListeningTime, dailyMusicTime, shuffleMode, repeatMode,
    trackHistory, playCounts, musicQueue, downloadQueue, artists,
    googleConnected, calendarSyncEnabled, lastCalendarSync, importState,
    addTask, updateTask, deleteTask, toggleTaskStatus, clearAllTasks, deleteCompletedTasks, deleteOldCompletedTasks,
    addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, incrementTaskStudyTime,
    addNote, updateNote, deleteNote, addNoteFolder, deleteNoteFolder,
    addCourse, updateCourse, deleteCourse, reorderCourses,
    addEvent, updateEvent, deleteEvent,
    addTrack, updateTrack, deleteTrack, toggleTrackFavorite, importLocalTracks,
    playTrack, toggleMusicPlayback, setIsPlayingMusic, clearCurrentTrack, setMusicVolume: setMusicVolumeCb, setMusicProgress: setMusicProgressCb,
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
    removeFromDownloadQueue, clearCompletedDownloads, downloadPath, setDownloadPathCtx: setDownloadPathCb,
    addStudySession, incrementSessionTime, incrementDailyStudyTime,
    incrementPomodoroSessions, resetPomodoroSessions, setActiveTaskId, setTimerLocked,
    linkTaskToTimer, unlinkTaskFromTimer, toggleTimer, resetTimer,
    setIsTimerActive, setSessionTime, setDailyStudyTime, setWeeklyStudyTime,
    setTasks, setPomodoroSessions, setShowCompletion, setRoundsCompleted, isRest, setIsRest,
    setSessionType, accumulatedPauseTime, pauseStartTime, distractionCount, focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime, dailyFocusPomodoro, dailyFocusChrono,
    setAccumulatedPauseTime, setPauseStartTime, setDistractionCount, setFocusPomodoroTime, setFocusChronoTime, setBreakTime, setDailyFocusPomodoro, setDailyFocusChrono,
    navigateTo, setNavigateTo,
    updateSettings: updateSettingsCb,
    setGoogleConnected, setCalendarSyncEnabled, setLastCalendarSync,
    triggerCalendarSync, importGoogleEvents: importGoogleEventsCb,
    triggerTasksSync, importGoogleTasks: importGoogleTasksCb,
    searchYouTubeMusic: searchYouTubeMusicCb, searchVideos: searchVideosCb, importClassroomCourses: importClassroomCoursesCb,
    importClassroomAssignments: importClassroomAssignmentsCb,
    exportNotesToGoogleDoc: exportNotesToGoogleDocCb, exportStatsToGoogleSheets: exportStatsToGoogleSheetsCb,
    loadGoogleProfile: loadGoogleProfileCb,
    searchStudyResources: searchStudyResourcesCb,
    createStudyQuiz: createStudyQuizCb,
    initFirebaseNotifications: initFirebaseNotificationsCb,
    syncAllToCloud: syncAllToCloudCb,
    triggerDriveBackup,
    notifications, addNotification, removeNotification, clearNotifications, toastMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}




