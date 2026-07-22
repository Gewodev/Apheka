import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, ReactNode, Dispatch, SetStateAction } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { copyFile, mkdir, exists, readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { get, set, del } from 'idb-keyval';
import { extractAudioMetadata } from '../lib/audioMetadata';
import { format, parseISO, subDays, addDays } from 'date-fns';
import { appDataDir, appCacheDir, join, extname } from '@tauri-apps/api/path';
import { saveAllTracks, loadAllTracks, copyAudioToStorage, removeAudioFromStorage, clearAllAudioFiles, exportMusicLibrary as exportMusicToDir, importMusicLibrary as importMusicFromDir, saveTrackMetadata, getAllTracksMetadata, deleteTrackMetadata, clearAllTracksMetadata, addTrackFileToDB, getTrackFileFromDB, deleteTrackFileFromDB, clearAllTrackFiles, storeTrackFileInDB } from '../lib/musicDb';

export const globalAudio = new Audio();
globalAudio.volume = 0.7;

// Audio analyser for reactive visualizations
let _audioAnalyserCtx: AudioContext | null = null;
let _audioAnalyserNode: AnalyserNode | null = null;

let _audioAnalyserSourceNode: MediaElementAudioSourceNode | null = null;

export async function initAudioAnalyser() {
  if (_audioAnalyserCtx && _audioAnalyserSourceNode) {
    if (!_audioAnalyserNode) {
      _audioAnalyserNode = _audioAnalyserCtx.createAnalyser();
      _audioAnalyserNode.fftSize = 256;
      _audioAnalyserNode.smoothingTimeConstant = 0.85;
    }
    if (_audioAnalyserCtx.state === 'suspended') {
      try { await _audioAnalyserCtx.resume(); } catch {}
    }
    try { _audioAnalyserSourceNode.connect(_audioAnalyserNode); } catch {}
    return;
  }
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch {}
    }
    _audioAnalyserCtx = ctx;

    const onStateChange = () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    ctx.onstatechange = onStateChange;

    _audioAnalyserNode = ctx.createAnalyser();
    _audioAnalyserNode.fftSize = 256;
    _audioAnalyserNode.smoothingTimeConstant = 0.85;

    const source = ctx.createMediaElementSource(globalAudio);
    source.connect(ctx.destination);
    source.connect(_audioAnalyserNode);
    _audioAnalyserSourceNode = source;
  } catch (e) {
    console.warn('Audio analyser unavailable:', e);
  }
}

export function disposeAudioAnalyser() {
  if (_audioAnalyserNode) {
    try { _audioAnalyserNode.disconnect(); } catch {}
    _audioAnalyserNode = null;
  }
}

export function getAudioLevel(): number {
  if (!_audioAnalyserNode || !_audioAnalyserCtx) return 0;
  if (_audioAnalyserCtx.state === 'suspended') {
    _audioAnalyserCtx.resume().catch(() => {});
  }
  const data = new Uint8Array(_audioAnalyserNode.frequencyBinCount);
  _audioAnalyserNode.getByteFrequencyData(data);
  const sum = data.reduce((a, b) => a + b, 0);
  return sum / data.length / 255;
}

export function getAudioFrequencyData(): Uint8Array {
  if (!_audioAnalyserNode) return new Uint8Array(128);
  const data = new Uint8Array(_audioAnalyserNode.frequencyBinCount);
  _audioAnalyserNode.getByteFrequencyData(data);
  return data;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CORE TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface ImportState {
  active: boolean;
  current: number;
  total: number;
  fileName: string;
  phase: 'loading_file' | 'extracting_metadata' | 'validating_audio' | 'saving_to_db' | 'finished';
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
  priority: 'high' | 'medium' | 'low' | 'none';
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  estimatedMinutes?: number;
  subtasks: SubTask[];
  files: TaskFile[];
  notes: string;       // rich text / description
  apuntes: string;     // local inline notes (task detail panel)
  studyTime: number;   // seconds studied on this task
  sortOrder?: number;
}

export interface NoteAttachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'audio' | 'file';
  dataUrl: string;
  size: number;
}

export interface Note {
  id: string;
  title: string;
  subtitle?: string;
  content: string;     // HTML rich text content
  course: string;
  courseColor: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isCoursePrivate?: boolean; // New field for private course notes
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
  coverImage?: string;
  coverColor?: string;
  sortOrder?: number;
  attachments?: NoteAttachment[];
  deletedAt?: string;
}

export interface NoteFolder {
  id: string;
  name: string;
  color: string;
  courseId?: string;    // auto-created from course
  isManual: boolean;
  description?: string;
  sortOrder?: number;
}

export interface Habit {
  id: string;
  name: string;
  completedOn: string[]; // Array of 'YYYY-MM-DD' date strings
  isArchived?: boolean;
  order?: number;
}

export interface SubjectGroup {
  id: string;
  name: string;
  image?: string;
  createdAt: number;
}

export interface SubjectMaterial {
  id: string;
  type: 'concept' | 'key-data' | 'formula' | 'meaning' | 'quiz' | 'procedure' | 'resource';
  createdAt: number;
  columnIndex: number;
  name?: string;       // resource/formula name
  title?: string;      // concept/key-data/procedure title
  content?: string;    // concept/key-data/procedure content
  word?: string;       // meaning word
  meaning?: string;    // meaning definition
  question?: string;   // quiz question
  answer?: string;     // quiz answer
  description?: string;// procedure description
  clarification?: string;// formula clarification
  image?: string;      // supportive base64 image (formula, procedure)
  dataUrl?: string;    // resource file data URL (base64)
  fileType?: string;   // resource mime type
}

export interface SubjectTopic {
  id: string;
  title: string;
  status: 'pending' | 'studying' | 'done';
  createdAt: number;
  reviewLevel: number; // 0 to 5
  nextReview: number;  // timestamp
  groupId?: string;    // linked SubjectGroup id
  materials: SubjectMaterial[];
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
  teacherName?: string;
  room?: string;
  code?: string;
  googleDriveFolderId?: string;
  topics?: string[];
  groups?: SubjectGroup[];
  studyTopics?: SubjectTopic[];
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

export interface Playlist {
  id: string;
  name: string;
  coverImage?: string;
  trackIds: string[];
  createdAt: number;
  isPublic?: boolean;
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
  perception?: number;  // 1-10 self-rating after session
  volmeter?: number;    // 1-20 self-rating
  evaluatedAt?: string; // ISO date when evaluated
  isDistraction?: boolean;
  subjects?: string[];  // course IDs studied during session
  mode?: 'rendimiento' | 'tiempo';
  discomfort?: number;  // 0-10 self-rated distraction
}

export interface DailyPerformance {
  date: string;           // YYYY-MM-DD
  score: number;          // 0-20 composite
  grade: 'C' | 'B' | 'A' | 'AD';
  totalMinutes: number;
  sessionCount: number;
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
  backgroundSize?: 'cover' | 'contain' | 'fill' | 'tile';
  profilePhoto?: string;  // base64
  notifications: boolean;
  soundEffects: boolean;
  event_pomodoro?: boolean;
  event_break?: boolean;
  event_task?: boolean;
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
  floatingBgMode: 'app' | 'custom';
  floatingFont: string;
  floatingHideInFocus: boolean;
  floatingAnimationType: string;
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
  coverBgMode?: 'auto' | 'black' | 'gray' | 'theme';
  timeFormat?: '24h' | '12h';
  studyGoals?: Record<string, number>; // day of week -> minutes, e.g. { "monday": 120, "tuesday": 180 }
  // Music settings
  downloadFormat?: 'mp3' | 'm4a';
  audioQuality?: string;
  includeCover?: boolean;
  autoRetryOnError?: boolean;
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
  habits: Habit[];
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
  dailyPerformances: DailyPerformance[];
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
  showRestPrompt: boolean;
  setShowRestPrompt: Dispatch<SetStateAction<boolean>>;
  handlePomodoroBannerClick: () => void;
  importState: ImportState;
  artists: { id: string; name: string; profileImage?: string }[];
  trackHistory: string[];
  playCounts: Record<string, number>;
  musicQueue: string[];
  queueSource: { pool: string[]; name?: string } | null;
  musicVolume: number;
  musicProgress: number;
  musicDuration: number;
  musicListeningTime: number;
  dailyMusicTime: Record<string, number>;
  weeklyMusicTime: number;
  monthlyMusicTime: number;
  shuffleMode: boolean;
  repeatMode: 'none' | 'all' | 'one';
  currentTrackId: string | null;
  coverModalTrackId: string | null;
  youtubeVideoUrl: string | null;
  isPlayingMusic: boolean;
}

export type ViewId = 'inicio' | 'tareas' | 'apuntes' | 'estudio' | 'cursos' | 'analiticas' | 'chat' | 'ajustes' | 'musica' | 'flujo' | 'canvas';

interface AppContextType extends AppState {
  setSessionType: (val: 'pomodoro' | 'chrono') => void;
  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'apuntes' | 'studyTime'> & { notes?: string; apuntes?: string; files?: TaskFile[]; subtasks?: SubTask[] }) => void;
  clearAllTasks: () => void;
  deleteCompletedTasks: () => void;
  deleteOldCompletedTasks: () => void;
  reorderTasks: (taskIds: string[]) => void;
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
  updateNoteVisual: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  permanentlyDeleteNote: (id: string) => void;
  addNoteFolder: (folder: Omit<NoteFolder, 'id'>) => void;
  deleteNoteFolder: (id: string) => void;
  reorderFolders: (folderIds: string[]) => void;
  reorderNotes: (noteIds: string[]) => void;
  updateNoteFolder: (id: string, updates: Partial<NoteFolder>) => void;
  duplicateNote: (noteId: string) => string | null;
  // Courses
  addCourse: (course: Omit<Course, 'id' | 'sortOrder'>) => string;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  reorderCourses: (courseIds: string[]) => void;
  // Events
  addEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;
  // Habits
  addHabit: (name: string) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  setHabits: Dispatch<SetStateAction<Habit[]>>;
  // Music
  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  toggleTrackFavorite: (id: string) => void;
  importLocalTracks: (paths: string[]) => Promise<void>;
  setCoverModalTrackId: Dispatch<SetStateAction<string | null>>;
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
  setQueueSource: (source: { pool: string[]; name?: string } | null) => void;
  clearCurrentTrack: () => void;
  clearAllMusicData: () => void;
  exportMusicLibrary: (destDir: string) => Promise<number>;
  importMusicLibrary: (srcDir: string) => Promise<number>;
  addArtist: (name: string, profileImage?: string) => void;
  updateArtist: (id: string, updates: { name?: string; profileImage?: string }) => void;
  deleteArtist: (id: string) => void;
  // Playlists
  playlists: Playlist[];
  addPlaylist: (name: string, trackIds: string[], coverImage?: string, isPublic?: boolean) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
  // Timer / Study
  addStudySession: (session: Omit<StudySession, 'id'>) => string | null;
  updateStudySession: (id: string, updates: Partial<StudySession>) => void;
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
  dailyPerformances: DailyPerformance[];
  setDailyPerformances: Dispatch<SetStateAction<DailyPerformance[]>>;
  // Downloads
  addToDownloadQueue: (item: Omit<DownloadItem, 'id' | 'progress' | 'status' | 'completedItems'>) => string;
  updateDownloadProgress: (id: string, progress: number) => void;
  updateDownloadStatus: (id: string, status: DownloadItem['status'], errorMessage?: string) => void;
  removeFromDownloadQueue: (id: string) => void;
  clearCompletedDownloads: () => void;
  // Navigation
  navigateTo: ViewId | null;
  setNavigateTo: (view: ViewId | null) => void;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
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
  event_pomodoro: true,
  event_break: true,
  event_task: true,
  dailyGoal: 240,
  pomodoroTime: 25 * 60,
  shortBreakTime: 5 * 60,
  longBreakTime: 15 * 60,
  pomodoroGoal: 4,
  fontFamily: 'Inter',
  floatingBgColor: '#020203',
  floatingClockType: 'led',
  floatingShowAnimation: false,
  floatingBgMode: 'app',
  floatingFont: 'led',
  floatingHideInFocus: false,
  floatingAnimationType: 'plant',
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
  coverBgMode: 'auto',
  playerBarBgColor: '',
  playerBarTrackHeight: 3,
  useThreeColors: false,
  timeFormat: '24h',
  downloadFormat: 'mp3',
  audioQuality: '3',
  includeCover: true,
  autoRetryOnError: true,
};

const defaultFolders: NoteFolder[] = [
  { id: 'f1', name: 'Matemáticas', color: '#6366f1', courseId: '1', isManual: false, sortOrder: 0 },
  { id: 'f2', name: 'Física', color: '#10b981', courseId: '2', isManual: false, sortOrder: 1 },
  { id: 'f3', name: 'Historia', color: '#f59e0b', courseId: '3', isManual: false, sortOrder: 2 },
  { id: 'f4', name: 'Inglés', color: '#ec4899', courseId: '4', isManual: false, sortOrder: 3 },
  { id: 'f5', name: 'Computación', color: '#06b6d4', courseId: '5', isManual: false, sortOrder: 4 },
];

const STORAGE_KEY = 'owa_studio_data';
const MUSIC_STATS_KEY = 'owa_music_stats';
const MUSIC_TRACKS_KEY = 'owa_music_tracks';

const AppContext = createContext<AppContextType | null>(null);
export { AppContext };

export function fmtClock(hhmm: string, format?: '24h' | '12h'): string {
  if (format === '24h' || !format) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

export function fmtTimeRange(start: string, end: string, format?: '24h' | '12h'): string {
  return `${fmtClock(start, format)} – ${fmtClock(end, format)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>(defaultFolders);
  const [courses, setCourses] = useState<Course[]>(defaultCourses);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
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
  const [showRestPrompt, setShowRestPrompt] = useState(false);

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
  const [dailyPerformances, setDailyPerformances] = useState<DailyPerformance[]>([]);

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [coverModalTrackId, setCoverModalTrackId] = useState<string | null>(null);
  const coverModalTrackIdRef = useRef(coverModalTrackId);
  useEffect(() => { coverModalTrackIdRef.current = coverModalTrackId; }, [coverModalTrackId]);
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
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [trackHistory, setTrackHistory] = useState<string[]>([]);
  const setShuffleMode = useCallback((mode: boolean) => {
    _setShuffleMode(mode);
    if (mode) {
      _setRepeatMode('none');
      // Always reshuffle from full pool (respecting queueSource context)
      const pool = queueSourceRef.current?.pool ?? tracksRef.current.map(t => t.id);
      const rest = pool.filter(tid => tid !== currentTrackIdRef.current);
      setMusicQueue(weightedShuffle(rest, playCounts));
    }
  }, [playCounts]);
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
  // Weighted shuffle: less-played tracks get higher probability (unplayed ≈ 1.0, played 3x ≈ 0.25)
  const weightedShuffle = (arr: string[], counts: Record<string, number>): string[] => {
    const a = [...arr];
    const result: string[] = [];
    while (a.length > 0) {
      const weights = a.map(tid => 1 / ((counts[tid] || 0) + 1));
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) { idx = i; break; }
      }
      result.push(a[idx]);
      a.splice(idx, 1);
    }
    return result;
  };
   const [trackPlayDurations, setTrackPlayDurations] = useState<Record<string, number>>({});
   const [currentTrackStartTime, setCurrentTrackStartTime] = useState<number | null>(null);
   const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
   const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const [musicQueue, setMusicQueue] = useState<string[]>([]);
  const [queueSource, setQueueSource] = useState<{ pool: string[]; name?: string } | null>(null);
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

  const weeklyMusicTime = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    let total = 0;
    for (let i = 0; i <= dayOfWeek; i++) {
      const dateStr = format(addDays(subDays(today, dayOfWeek), i), 'yyyy-MM-dd');
      total += dailyMusicTime[dateStr] || 0;
    }
    return total;
  }, [dailyMusicTime]);

  const monthlyMusicTime = useMemo(() => {
    const monthKey = format(new Date(), 'yyyy-MM');
    let total = 0;
    for (const [dateStr, seconds] of Object.entries(dailyMusicTime)) {
      if (dateStr.startsWith(monthKey)) {
        total += seconds;
      }
    }
    return total;
  }, [dailyMusicTime]);

  // Reset listening time daily
  useEffect(() => {
    const check = setInterval(() => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      if (today !== musicListeningDate) {
        setMusicListeningTime(0);
        setMusicListeningDate(today);
      }
    }, 30000);
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
   const playlistsRef = useRef(playlists);
   const shuffleModeRef = useRef(shuffleMode);
   const repeatModeRef = useRef(repeatMode);
   const musicQueueRef = useRef(musicQueue);
   const queueSourceRef = useRef(queueSource);
   const playTrackRef = useRef<(id: string) => void>(() => {});
  const trackHistoryRef = useRef(trackHistory);
  const playCountsRef = useRef(playCounts);
  const musicVolumeRef = useRef(musicVolume);
   const autoPlayRef = useRef(false);
   const activePlaySessionIdRef = useRef<string | null>(null);
   const currentBlobUrlRef = useRef<string | null>(null);
   const loadedTrackIdRef = useRef<string | null>(null);
   const loadingTrackIdRef = useRef<string | null>(null);
   const isPlayingMusicRef = useRef(isPlayingMusic);
  const currentTrackStartTimeRef = useRef<number | null>(null);
  const intentionalPauseRef = useRef(false);
  const fadeRampRef = useRef<number | null>(null);
  const restoreSeekRef = useRef<number | null>(null);
  
  useLayoutEffect(() => { currentTrackIdRef.current = currentTrackId; }, [currentTrackId]);
  useEffect(() => { trackHistoryRef.current = trackHistory; }, [trackHistory]);
  useEffect(() => { playCountsRef.current = playCounts; }, [playCounts]);
    useEffect(() => { tracksRef.current = tracks; }, [tracks]);
    useEffect(() => { playlistsRef.current = playlists; }, [playlists]);
    useEffect(() => { shuffleModeRef.current = shuffleMode; }, [shuffleMode]);
   useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
    useEffect(() => { musicQueueRef.current = musicQueue; }, [musicQueue]);
    useEffect(() => { queueSourceRef.current = queueSource; }, [queueSource]);
    useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);
  useLayoutEffect(() => { isPlayingMusicRef.current = isPlayingMusic; }, [isPlayingMusic]);
  useEffect(() => { currentTrackStartTimeRef.current = currentTrackStartTime; }, [currentTrackStartTime]);
  const resumePlaybackRef = useRef<{ trackId: string; progress: number; isPlaying: boolean } | null>(null);
  const resumeSeekFlagRef = useRef(false);
  const resumeStayPausedRef = useRef(false);
  const wasPlayingBeforeHiddenRef = useRef(false);

  // Dev-only: suppress benign Tauri IPC errors that appear during hot-reload
  const consoleFilterRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const origErr = console.error;
    const origWarn = console.warn;
    const origLog = console.log;
    const FILTER_PATTERNS = [
      "[TAURI] Couldn't find callback id",
      "does not conform to the required format",
      "forbidden path",
      "Updating a style property during rerender",
    ];
    const shouldSuppress = (args: any[]) =>
      typeof args[0] === 'string' && FILTER_PATTERNS.some(p => args[0].includes(p));
    console.error = (...args: any[]) => { if (!shouldSuppress(args)) origErr.apply(console, args); };
    console.warn = (...args: any[]) => { if (!shouldSuppress(args)) origWarn.apply(console, args); };
    console.log = (...args: any[]) => { if (!shouldSuppress(args)) origLog.apply(console, args); };
    consoleFilterRef.current = () => {
      console.error = origErr;
      console.warn = origWarn;
      console.log = origLog;
    };
    return () => { consoleFilterRef.current?.(); };
  }, []);

  // Resume playback after tracks are loaded
  useEffect(() => {
    if (resumePlaybackRef.current && tracks.length > 0) {
      const rp = resumePlaybackRef.current;
      resumePlaybackRef.current = null;
      const track = tracks.find(t => t.id === rp.trackId);
      if (track) {
        resumeSeekFlagRef.current = true;
        restoreSeekRef.current = rp.progress;
        resumeStayPausedRef.current = !rp.isPlaying;
        playTrackRef.current(rp.trackId);
      }
    }
  }, [tracks]);

   const [navigateTo, setNavigateTo] = useState<ViewId | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [lastCalendarSync, setLastCalendarSync] = useState<string | null>(null);

  // Load from IndexedDB / localStorage
  useEffect(() => {
    async function loadData() {
      let oldTracks: Track[] | undefined;
      let loadedData: any = null;
      try {
        let stored: string | null | undefined = await get(STORAGE_KEY);
        if (!stored) {
          stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            await set(STORAGE_KEY, stored);
            localStorage.removeItem(STORAGE_KEY);
          }
        }
        if (stored) {
          const data = JSON.parse(stored);
          loadedData = data;
          oldTracks = data.tracks;
          if (data.trackHistory) setTrackHistory(data.trackHistory);
          if (data.playCounts) setPlayCounts(data.playCounts);
          if (data.musicQueue) setMusicQueue(data.musicQueue);
          if (data.artists) setArtists(data.artists);
          if (data.playlists) setPlaylists(data.playlists);
          if (data.shuffleMode !== undefined) _setShuffleMode(data.shuffleMode);
          if (data.repeatMode) _setRepeatMode(data.repeatMode);
          if (data.tasks) setTasks(data.tasks);
          if (data.habits) setHabits(data.habits);
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
          if (data.isRest) {
            setIsRest(true);
            const savedRestStart = localStorage.getItem('owa_rest_start_time');
            if (savedRestStart) restStartTimeRef.current = Number(savedRestStart);
          }
          if (data.weeklyStudyTime) setWeeklyStudyTime(data.weeklyStudyTime);
          const today = format(new Date(), 'yyyy-MM-dd');
          if (data.dailyStudyTime !== undefined && data.dailyStudyDate === today) {
            setDailyStudyTime(data.dailyStudyTime);
          }
          if (data.pomodoroSessions) setPomodoroSessions(data.pomodoroSessions);
          if (data.musicVolume !== undefined) setMusicVolume(data.musicVolume);
          if (data.currentTrackId) setCurrentTrackId(data.currentTrackId);
          if (data.musicProgress !== undefined) {
            setMusicProgress(data.musicProgress);
            if (data.currentTrackId) restoreSeekRef.current = data.musicProgress;
          }
          if (data.musicDuration !== undefined) setMusicDuration(data.musicDuration);
          // Fallback: sync localStorage backup (written on every track change and beforeunload)
          try {
            const savedId = localStorage.getItem('owa_current_track_id');
            if (savedId && !data.currentTrackId) {
              setCurrentTrackId(savedId);
            }
            const savedProgress = localStorage.getItem('owa_music_progress');
            if (savedProgress && data.musicProgress === undefined) {
              const p = parseFloat(savedProgress);
              setMusicProgress(p);
              if (savedId && savedId !== data.currentTrackId) restoreSeekRef.current = p;
            }
          } catch {}
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
          if (data.dailyPerformances) setDailyPerformances(data.dailyPerformances);
          setIsPlayingMusic(data.isPlayingMusic || false);
          if (data.downloadPath) setDownloadPathState(data.downloadPath);
        }
      } catch (e) {
        console.error('Error loading data:', e);
      }
      // Load tracks from IndexedDB (AETHER pattern: individual records)
      try {
        const musicTracks = await getAllTracksMetadata();
        if (musicTracks.length > 0) {
          setTracks(musicTracks);
          // Resume playback if track exists (restore position always)
          if (loadedData && loadedData.currentTrackId) {
            const trackStillExists = musicTracks.some(t => t.id === loadedData.currentTrackId);
            if (trackStillExists) {
              resumePlaybackRef.current = {
                trackId: loadedData.currentTrackId,
                progress: loadedData.musicProgress || 0,
                isPlaying: false,
              };
            }
          }
        } else {
          // Fallback: try old idb-keyval bulk storage for migration
          const legacyTracks = await loadAllTracks();
          if (legacyTracks.length > 0) {
            setTracks(legacyTracks);
            // Migrate each track to new individual storage
            for (const t of legacyTracks) {
              await saveTrackMetadata(t).catch(() => {});
            }
          } else if (oldTracks && oldTracks.length > 0) {
            // Fallback: migrate tracks from old localStorage
            setTracks(oldTracks);
            for (const t of oldTracks) {
              await saveTrackMetadata(t).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error('Error loading music tracks:', e);
      }
      // Load music stats from dedicated key (survives track operations)
      try {
        const statsRaw = await get(MUSIC_STATS_KEY);
        if (statsRaw) {
          const statsData = JSON.parse(statsRaw);
          if (statsData.musicListeningTime !== undefined) {
            const today = format(new Date(), 'yyyy-MM-dd');
            if (statsData.musicListeningDate === today) {
              setMusicListeningTime(statsData.musicListeningTime);
            }
          }
          if (statsData.dailyMusicTime) {
            setDailyMusicTime(prev => {
              if (Object.keys(prev).length > 0) return prev;
              return statsData.dailyMusicTime;
            });
          }

        }
      } catch {}
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
  const isTimerActiveRef = useRef(isTimerActive);
  isTimerActiveRef.current = isTimerActive;
  const isRestRef = useRef(isRest);
  const restStartTimeRef = useRef(-1);
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
            const isRestNow = isRestRef.current;
            const typeNow = sessionTypeRef.current;
            emit('timer:sync', JSON.stringify({
              sessionTime: next,
              isTimerActive: true,
              activeTaskId: activeTaskIdRef.current,
              isRest: isRestNow,
              sessionType: typeNow,
              pomodoroTime: settings.pomodoroTime,
              shortBreakTime: settings.shortBreakTime,
              longBreakTime: settings.longBreakTime,
              accumulatedPauseTime: accumulatedPauseTimeRef.current,
              pauseStartTime: pauseStartTimeRef.current,
              distractionCount: distractionCountRef.current,
              pomodoroSessions: pomodoroSessionsRef.current,
              pomodoroGoal: settings.pomodoroGoal,
              sessionsCount: sessionsCountRef.current,
              restStartTime: isRestNow ? restStartTimeRef.current : 0,
              pomodoroComplete: !isRestNow && typeNow === 'pomodoro' && next >= settings.pomodoroTime,
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
          setDailyStudyDate(prev => {
            if (prev && prev !== today) {
              setDailyStudyTime(0);
            }
            return today;
          });
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
        longBreakTime: settings.longBreakTime,
        accumulatedPauseTime: accumulatedPauseTimeRef.current,
        pauseStartTime: pauseStartTimeRef.current,
        distractionCount: distractionCountRef.current,
        pomodoroSessions: pomodoroSessionsRef.current,
        pomodoroGoal: settings.pomodoroGoal,
        sessionsCount: sessionsCountRef.current,
        restStartTime: restStartTimeRef.current,
        pomodoroComplete: false,
      }));
    }
  }, [isTimerActive, settings.pomodoroTime, settings.shortBreakTime]);

  // Catch up timer when page becomes visible after being hidden (laptop sleep, tab switch)
  const hiddenTimerRef = useRef<{ sessionTime: number; timestamp: number } | null>(null);
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTimerRef.current = { sessionTime: sessionTimeRef.current, timestamp: Date.now() };
      } else if (hiddenTimerRef.current && isTimerActiveRef.current) {
        const elapsed = Math.floor((Date.now() - hiddenTimerRef.current.timestamp) / 1000);
        if (elapsed > 1) {
          const expected = hiddenTimerRef.current.sessionTime + elapsed;
          const current = sessionTimeRef.current;
          if (expected > current) {
            sessionTimeRef.current = expected;
            const today = format(new Date(), 'yyyy-MM-dd');
            if (isRestRef.current) {
              setBreakTime(prev => prev + (expected - current));
              setDailyBreakTime(prev => ({ ...prev, [today]: (prev[today] || 0) + (expected - current) }));
            } else {
              setDailyStudyTime(prev => prev + (expected - current));
              setWeeklyStudyTime(prev => ({ ...prev, [today]: (prev[today] || 0) + (expected - current) }));
              if (sessionTypeRef.current === 'pomodoro') {
                setFocusPomodoroTime(prev => prev + (expected - current));
                setDailyFocusPomodoro(prev => ({ ...prev, [today]: (prev[today] || 0) + (expected - current) }));
              } else {
                setFocusChronoTime(prev => prev + (expected - current));
                setDailyFocusChrono(prev => ({ ...prev, [today]: (prev[today] || 0) + (expected - current) }));
              }
              const currentTaskId = activeTaskIdRef.current;
              if (currentTaskId) {
                setTasks(prev => prev.map(t => t.id === currentTaskId ? { ...t, studyTime: t.studyTime + (expected - current) } : t));
              }
            }
            setSessionTime(expected);
            emit('timer:sync', JSON.stringify({
              sessionTime: expected,
              isTimerActive: isTimerActiveRef.current,
              activeTaskId: activeTaskIdRef.current,
              isRest: isRestRef.current,
              sessionType: sessionTypeRef.current,
              pomodoroTime: settings.pomodoroTime,
              shortBreakTime: settings.shortBreakTime,
              longBreakTime: settings.longBreakTime,
              accumulatedPauseTime: accumulatedPauseTimeRef.current,
              pauseStartTime: pauseStartTimeRef.current,
              distractionCount: distractionCountRef.current,
              pomodoroSessions: pomodoroSessionsRef.current,
              pomodoroGoal: settings.pomodoroGoal,
              sessionsCount: sessionsCountRef.current,
              restStartTime: restStartTimeRef.current,
              pomodoroComplete: !isRestRef.current && sessionTypeRef.current === 'pomodoro' && expected >= settings.pomodoroTime,
            }));
          }
        }
        hiddenTimerRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings.pomodoroTime, settings.shortBreakTime, settings.longBreakTime, settings.pomodoroGoal]);

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
      longBreakTime: settings.longBreakTime,
      accumulatedPauseTime: accumulatedPauseTime,
      pauseStartTime: pauseStartTime,
      distractionCount: distractionCount,
      pomodoroSessions: pomodoroSessions,
      pomodoroGoal: settings.pomodoroGoal,
      sessionsCount: studySessions.length,
      restStartTime: restStartTimeRef.current,
      pomodoroComplete: !isRest && sessionType === 'pomodoro' && sessionTime >= settings.pomodoroTime,
    }));
  }, [isRest, isTimerActive, sessionType, settings.pomodoroTime, settings.shortBreakTime, settings.longBreakTime, accumulatedPauseTime, pauseStartTime, distractionCount, pomodoroSessions, settings.pomodoroGoal, studySessions.length, sessionTime]);

  // Freeze restStartTimeRef when rest starts, reset when rest ends
  useEffect(() => {
    if (isRest) {
      if (restStartTimeRef.current === -1) {
        restStartTimeRef.current = sessionTimeRef.current;
        localStorage.setItem('owa_rest_start_time', String(restStartTimeRef.current));
      }
    } else {
      restStartTimeRef.current = -1;
      localStorage.removeItem('owa_rest_start_time');
    }
  }, [isRest]);

  // Global pomodoro completion detection — works even when not in Estudio
  const pomodoroCompletedRef = useRef(false);
  const completionSessionTimeRef = useRef(0);
  useEffect(() => {
    if (isTimerActive && !isRest && sessionType === 'pomodoro' && sessionTime >= settings.pomodoroTime && !pomodoroCompletedRef.current) {
      pomodoroCompletedRef.current = true;
      completionSessionTimeRef.current = sessionTimeRef.current;
      setShowRestPrompt(true);
    }
    if (sessionTime < settings.pomodoroTime) {
      pomodoroCompletedRef.current = false;
      completionSessionTimeRef.current = 0;
    }
  }, [sessionTime, isTimerActive, isRest, sessionType, settings.pomodoroTime]);

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
  }, [isTimerActive, pauseStartTime, addNotification, isRest]);

  // Debounced save
  useEffect(() => {
    const t = setTimeout(() => {
      set(STORAGE_KEY, JSON.stringify({
        tasks, habits, notes, noteFolders, courses, events, studySessions,
        settings, sessionTime, sessionType, isRest, isTimerActive, weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions,
        trackHistory, playCounts, musicQueue, musicVolume, shuffleMode, repeatMode, artists, playlists,
        currentTrackId, isPlayingMusic: isPlayingMusic && !globalAudio.paused, musicListeningTime, musicListeningDate, dailyMusicTime,
        musicProgress, musicDuration, downloadPath,
        accumulatedPauseTime, pauseStartTime, distractionCount,
        focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
        dailyFocusPomodoro, dailyFocusChrono, dailyPerformances,
      })).catch((e: any) => console.error("Error saving data:", e));
      set(MUSIC_STATS_KEY, JSON.stringify({
        musicListeningTime, musicListeningDate, dailyMusicTime,
      })).catch((e: any) => console.error("Error saving music stats:", e));
    }, 300);
    debounceTimerRef.current = t;
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; };
  }, [
    tasks, habits, notes, noteFolders, courses, events, studySessions, settings, sessionTime,
    weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions, trackHistory, playCounts, musicQueue,
    musicVolume, artists, playlists, currentTrackId, isPlayingMusic, musicListeningTime, musicListeningDate, dailyMusicTime,
    musicProgress, musicDuration, downloadPath,
    accumulatedPauseTime, pauseStartTime, distractionCount,
    focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
    dailyFocusPomodoro, dailyFocusChrono,
  ]);

  // Sync settings to floating timer window
  useEffect(() => {
    const appBgColor = settings.useThreeColors && settings.surfaceColor
      ? settings.surfaceColor
      : settings.theme === 'claro' ? '#f8fafc'
      : settings.theme === 'vibrante' ? '#0c0a1a'
      : settings.theme === 'sistema'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? '#0a0a0c' : '#f8fafc')
        : '#0a0a0c';
    const payload = {
      floatingBgMode: settings.floatingBgMode,
      floatingBgColor: settings.floatingBgColor,
      floatingFont: settings.floatingFont,
      floatingHideInFocus: settings.floatingHideInFocus,
      floatingAnimationType: settings.floatingAnimationType,
      timerFocusColor: settings.timerFocusColor,
      timerBreakColor: settings.timerBreakColor,
      timerLongBreakColor: settings.timerLongBreakColor,
      timerChronoColor: settings.timerChronoColor,
      appBgColor,
      accentColor: settings.accentColor,
    };
    emit('settings:sync', JSON.stringify(payload));
  }, [settings.floatingBgMode, settings.floatingBgColor, settings.floatingFont, settings.floatingHideInFocus, settings.floatingAnimationType, settings.timerFocusColor, settings.timerBreakColor, settings.timerLongBreakColor, settings.timerChronoColor, settings.backgroundImagePath, settings.backgroundImage, settings.useThreeColors, settings.surfaceColor, settings.theme]);

  // Respond to settings and timer sync requests from floating timer
  useEffect(() => {
    const unlistenSettings = listen('settings:sync:request', () => {
      const appBgColor = settings.useThreeColors && settings.surfaceColor
        ? settings.surfaceColor
        : settings.theme === 'claro' ? '#f8fafc'
        : settings.theme === 'vibrante' ? '#0c0a1a'
        : settings.theme === 'sistema'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? '#0a0a0c' : '#f8fafc')
          : '#0a0a0c';
      const payload = {
        floatingBgMode: settings.floatingBgMode,
        floatingBgColor: settings.floatingBgColor,
        floatingFont: settings.floatingFont,
        floatingHideInFocus: settings.floatingHideInFocus,
        floatingAnimationType: settings.floatingAnimationType,
        timerFocusColor: settings.timerFocusColor,
        timerBreakColor: settings.timerBreakColor,
        timerLongBreakColor: settings.timerLongBreakColor,
        timerChronoColor: settings.timerChronoColor,
        appBgColor,
        accentColor: settings.accentColor,
      };
      emit('settings:sync', JSON.stringify(payload));
      emit('timer:sync', JSON.stringify({
        sessionTime: sessionTimeRef.current,
        isTimerActive,
        activeTaskId: activeTaskIdRef.current,
        isRest: isRestRef.current,
        sessionType: sessionTypeRef.current,
        pomodoroTime: settings.pomodoroTime,
        shortBreakTime: settings.shortBreakTime,
        longBreakTime: settings.longBreakTime,
        restStartTime: restStartTimeRef.current,
        accumulatedPauseTime: accumulatedPauseTimeRef.current,
        pauseStartTime: pauseStartTimeRef.current,
        distractionCount: distractionCountRef.current,
        pomodoroSessions: pomodoroSessionsRef.current,
        pomodoroGoal: settings.pomodoroGoal,
        sessionsCount: studySessions.length,
        pomodoroComplete: !isRestRef.current && sessionTypeRef.current === 'pomodoro' && sessionTimeRef.current >= settings.pomodoroTime,
      }));
    });
    const unlistenTimer = listen('timer:sync:request', () => {
      emit('timer:sync', JSON.stringify({
        sessionTime: sessionTimeRef.current,
        isTimerActive,
        activeTaskId: activeTaskIdRef.current,
        isRest: isRestRef.current,
        sessionType: sessionTypeRef.current,
        pomodoroTime: settings.pomodoroTime,
        shortBreakTime: settings.shortBreakTime,
        longBreakTime: settings.longBreakTime,
        restStartTime: restStartTimeRef.current,
        accumulatedPauseTime: accumulatedPauseTimeRef.current,
        pauseStartTime: pauseStartTimeRef.current,
        distractionCount: distractionCountRef.current,
        pomodoroSessions: pomodoroSessionsRef.current,
        pomodoroGoal: settings.pomodoroGoal,
        sessionsCount: studySessions.length,
        pomodoroComplete: !isRestRef.current && sessionTypeRef.current === 'pomodoro' && sessionTimeRef.current >= settings.pomodoroTime,
      }));
    });
    return () => { unlistenSettings.then(fn => fn()); unlistenTimer.then(fn => fn()); };
  }, [settings.floatingBgMode, settings.floatingBgColor, settings.floatingFont, settings.floatingHideInFocus, settings.floatingAnimationType, settings.timerFocusColor, settings.timerBreakColor, settings.timerLongBreakColor, settings.timerChronoColor, settings.longBreakTime, settings.theme, settings.useThreeColors, settings.surfaceColor]);

  // Pause audio when closing window
  useEffect(() => {
    const handleBeforeUnload = () => {
      globalAudio.pause();
      if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
      const savedIsPlaying = false;
      saveBeforeUnloadRef.current?.(savedIsPlaying);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const saveBeforeUnloadRef = useRef<((overrideIsPlaying?: boolean) => void) | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  saveBeforeUnloadRef.current = (overrideIsPlaying?: boolean) => {
    // Compute live audio progress directly from the audio element
    const liveProgress = globalAudio.duration && isFinite(globalAudio.duration) && globalAudio.duration > 0
      ? globalAudio.currentTime / globalAudio.duration
      : musicProgress;
    const savedPlaying = overrideIsPlaying !== undefined ? overrideIsPlaying : isPlayingMusic;
    set(STORAGE_KEY, JSON.stringify({
      tasks, habits, notes, noteFolders, courses, events, studySessions,
      settings, sessionTime, sessionType, isRest, isTimerActive: false, weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions,
      trackHistory, playCounts, musicQueue, musicVolume, shuffleMode, repeatMode, artists, playlists,
      currentTrackId, isPlayingMusic: savedPlaying, musicListeningTime, musicListeningDate, dailyMusicTime,
      musicProgress: liveProgress, musicDuration, downloadPath,
      accumulatedPauseTime, pauseStartTime, distractionCount,
      focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
      dailyFocusPomodoro, dailyFocusChrono,
    })).catch((e: any) => console.error("Error saving data on unload:", e));
    try {
      localStorage.setItem('owa_current_track_id', currentTrackIdRef.current || '');
      localStorage.setItem('owa_music_progress', String(liveProgress));
      localStorage.setItem('owa_music_duration', String(musicDuration));
    } catch {}
  };

  // â”€â”€ TASKS â”€â”€
  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'apuntes' | 'studyTime'> & { notes?: string; apuntes?: string; files?: TaskFile[]; subtasks?: SubTask[] }) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      status: 'inicio',
      subtasks: task.subtasks || [],
      files: task.files || [],
      notes: task.notes || '',
      apuntes: task.apuntes || '',
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

  const reorderTasks = useCallback((taskIds: string[]) => {
    setTasks(prev => {
      const result = taskIds.map((id, i) => {
        const t = prev.find(x => x.id === id);
        return t ? { ...t, sortOrder: i } : null;
      }).filter(Boolean) as Task[];
      const remaining = prev.filter(t => !taskIds.includes(t.id));
      return [...result, ...remaining];
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
    setNotes(prev => {
      const note = prev.find(n => n.id === id);
      if (!note) return prev;
      return prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n);
    });
  }, []);

  const updateNoteVisual = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev => {
      const note = prev.find(n => n.id === id);
      if (!note) return prev;
      return prev.map(n => n.id === id ? { ...n, ...updates } : n);
    });
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, deletedAt: new Date().toISOString() } : n));
  }, []);

  const restoreNote = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, deletedAt: undefined } : n));
  }, []);

  const permanentlyDeleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNoteFolder = useCallback((folder: Omit<NoteFolder, 'id'>) => {
    setNoteFolders(prev => [...prev, { ...folder, id: Date.now().toString(), sortOrder: prev.length }]);
  }, []);

  const deleteNoteFolder = useCallback((id: string) => {
    setNoteFolders(prev => prev.filter(f => f.id !== id));
    setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: undefined, course: 'Sin carpeta', courseColor: 'var(--text-muted)' } : n));
  }, []);

  const reorderFolders = useCallback((folderIds: string[]) => {
    setNoteFolders(prev => {
      const result = folderIds.map((id, i) => {
        const f = prev.find(x => x.id === id);
        return f ? { ...f, sortOrder: i } : null;
      }).filter(Boolean) as NoteFolder[];
      const remaining = prev.filter(f => !folderIds.includes(f.id));
      return [...result, ...remaining];
    });
  }, []);

  const reorderNotes = useCallback((noteIds: string[]) => {
    setNotes(prev => {
      const result = noteIds.map((id, i) => {
        const n = prev.find(x => x.id === id);
        return n ? { ...n, sortOrder: i } : null;
      }).filter(Boolean) as Note[];
      const remaining = prev.filter(n => !noteIds.includes(n.id));
      return [...result, ...remaining];
    });
  }, []);

  const updateNoteFolder = useCallback((id: string, updates: Partial<NoteFolder>) => {
    setNoteFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const duplicateNote = useCallback((noteId: string): string | null => {
    const original = notes.find(n => n.id === noteId);
    if (!original) return null;
    const now = new Date().toISOString();
    const newId = Date.now().toString();
    const { id, createdAt, updatedAt, ...rest } = original;
    const baseTitle = rest.title.replace(/\s*\(Copia(?: \d+)?\)\s*$/i, '').trim();
    const copies = notes.filter(n => n.title.startsWith(baseTitle) && n.title.match(/\(Copia(?: \d+)?\)/i));
    const copyNums = copies.map(n => {
      const m = n.title.match(/\(Copia\s*(\d+)\)/i);
      return m ? parseInt(m[1], 10) : 1;
    }).sort((a, b) => b - a);
    const nextNum = copyNums.length > 0 ? copyNums[0] + 1 : '';
    const newTitle = `${baseTitle} (Copia${nextNum ? ` ${nextNum}` : ''})`;
    setNotes(prev => [...prev, { ...rest, id: newId, title: newTitle, createdAt: now, updatedAt: now }]);
    return newId;
  }, [notes]);

  // ── COURSES ──
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
    setCourses(prev => {
      const old = prev.find(c => c.id === id);
      if (old && updates.name && updates.name !== old.name) {
        const oldName = old.name;
        setTasks(pt => pt.map(t => t.course === oldName ? { ...t, course: updates.name!, courseColor: updates.color || t.courseColor } : t));
        setNotes(pn => pn.map(n => n.course === oldName ? { ...n, course: updates.name! } : n));
      }
      return prev.map(c => c.id === id ? { ...c, ...updates } : c);
    });
    if (updates.name || updates.color) {
      setNoteFolders(prev => prev.map(f =>
        f.courseId === id ? { ...f, ...(updates.name && { name: updates.name }), ...(updates.color && { color: updates.color }) } : f
      ));
    }
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

  // ── HABITS ──
  const addHabit = useCallback((name: string) => {
    const newHabit: Habit = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: name.trim(),
      completedOn: [],
      order: habits.length,
    };
    setHabits(prev => [...prev, newHabit]);
  }, [habits.length]);

  const updateHabit = useCallback((id: string, updates: Partial<Habit>) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  }, []);

  // â”€â”€ MUSIC â”€â”€
  const addTrack = useCallback((track: Omit<Track, 'id'>) => {
    const id = crypto.randomUUID();
    const newTrack: Track = { ...track, id };
    setTracks(prev => [...prev, newTrack]);
    saveTrackMetadata(newTrack).catch((e: any) => console.error('Error saving track:', e));
    return id;
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const updatedList = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      const updated = updatedList.find(t => t.id === id);
      if (updated) {
        saveTrackMetadata(updated).catch((e: any) => console.error('Error saving track metadata:', e));
      }
      return updatedList;
    });
  }, []);

  const deleteTrack = useCallback((id: string) => {
    if (currentTrackId === id) {
      setCurrentTrackId(null);
      setIsPlayingMusic(false);
      setMusicProgress(0);
      globalAudio.pause();
      globalAudio.src = '';
    }
    setTracks(prev => prev.filter(t => t.id !== id));
    deleteTrackMetadata(id).catch((e: any) => console.error('Error deleting track metadata:', e));
    deleteTrackFileFromDB(id).catch(() => {});
    removeAudioFromStorage(id).catch(() => {});
  }, [currentTrackId]);

  const toggleTrackFavorite = useCallback((id: string) => {
    setTracks(prev => {
      const updatedList = prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t);
      const updated = updatedList.find(t => t.id === id);
      if (updated) {
        saveTrackMetadata(updated).catch((e: any) => console.error('Error saving track metadata:', e));
      }
      return updatedList;
    });
  }, []);

  const clearAllMusicData = useCallback(() => {
    setTracks([]);
    setMusicQueue([]);
    setCurrentTrackId(null);
    setIsPlayingMusic(false);
    setMusicProgress(0);
    setMusicDuration(0);
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.src = '';
    }
    clearAllTracksMetadata().catch((e: any) => console.error('Error clearing track metadata:', e));
    clearAllTrackFiles().catch((e: any) => console.error('Error clearing track files:', e));
    clearAllAudioFiles().catch(() => {});
    // Persist stats immediately so they survive a crash/force-close before beforeunload
    set(MUSIC_STATS_KEY, JSON.stringify({
      musicListeningTime, musicListeningDate, dailyMusicTime,
    })).catch((e: any) => console.error('Error saving music stats after clear:', e));
    // Preserve all stats: dailyMusicTime, musicListeningTime, trackHistory, playCounts, artists
  }, [musicListeningTime, musicListeningDate, dailyMusicTime]);

  const exportMusicLibrary = useCallback(async (destDir: string): Promise<number> => {
    return exportMusicToDir(tracksRef.current, destDir);
  }, []);

  const importMusicLibrary = useCallback(async (srcDir: string): Promise<number> => {
    const result = await importMusicFromDir(srcDir);
    setTracks(result.tracks);
    for (const track of result.tracks) {
      await saveTrackMetadata(track).catch((e: any) => console.error('Error saving imported track:', e));
    }
    return result.imported;
  }, []);

  const playAudioInstance = useCallback((sessionId: string | null) => {
    if (!sessionId || activePlaySessionIdRef.current !== sessionId) return;
    if (!globalAudio.src) { setIsPlayingMusic(false); return; }
    
    if (globalAudio.ended) globalAudio.currentTime = 0;
    if (!globalAudio.paused) return;
    
    // If resuming paused state, don't auto-play
    if (resumeStayPausedRef.current) {
      resumeStayPausedRef.current = false;
      setIsPlayingMusic(false);
      return;
    }
    
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
  useLayoutEffect(() => {
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
        // Phase 1: Loading/Reading file (ONCE — avoid Windows Defender collisions)
        updateProgress('loading_file', 10);
        let fileData: Uint8Array | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const raw = await readFile(path);
            if (raw && (!(raw instanceof Uint8Array) || raw.length > 0)) {
              fileData = raw instanceof Uint8Array ? raw : new Uint8Array(raw as any);
              break;
            }
          } catch {
            if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          }
        }
        if (!fileData) throw new Error('No se pudo leer el archivo (bloqueado por seguridad)');
        updateProgress('loading_file', 100);

        // Phase 2: Metadata Parsing (pass pre-read buffer)
        updateProgress('extracting_metadata', 10);
        const meta = await extractAudioMetadata(path, fileData);
        updateProgress('extracting_metadata', 100);

        // Phase 3: Duration from metadata (already extracted)
        updateProgress('validating_audio', 10);
        const duration = meta.duration || 0;
        updateProgress('validating_audio', 100);

        const trackExists = tracksRef.current.some(t => t.url === path);
        if (trackExists) {
          imported++;
          continue;
        }

        const trackTitle = meta.title || name.replace(/\.[^/.]+$/, "");
        const trackArtist = meta.artist || '';
        const trackDuration = duration || 0;
        const trackCoverImage = meta.coverUrl || undefined;

        // Generate ID and append to tracks
        const trackId = crypto.randomUUID();
        const newTrack: Track = {
          id: trackId,
          title: trackTitle,
          artist: trackArtist,
          duration: Math.round(trackDuration),
          source: 'local',
          url: path,
          coverImage: trackCoverImage,
          isFavorite: false,
          listenedTime: 0
        };

        // Phase 4: Save to storage (use pre-read buffer — no extra disk I/O)
        updateProgress('saving_to_db', 10);
        const storedPath = await copyAudioToStorage(path, trackId, fileData).catch(() => path);
        newTrack.url = storedPath;
        // AETHER pattern: also store File in IndexedDB for reliable blob URL playback
        await storeTrackFileInDB(trackId, path, fileData).catch(() => {});
        await saveTrackMetadata(newTrack);
        updateProgress('saving_to_db', 100);

        setTracks(prev => [...prev, newTrack]);

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
    // Auto-detect group context when playing a track outside the current pool
    const currentPool = queueSourceRef.current?.pool;
    if (currentPool && !currentPool.includes(id)) {
      const allTracks = tracksRef.current;
      const t = allTracks.find(tr => tr.id === id);
      if (t) {
        // Check playlists first — if track is in a playlist, use it
        const inPlaylist = playlistsRef.current.find(pl => pl.trackIds.includes(id));
        if (inPlaylist) {
          const pool = inPlaylist.trackIds.filter(tid => allTracks.some(tr => tr.id === tid));
          setQueueSource({ pool, name: inPlaylist.name });
        } else {
          // Check artist — group all songs from same artist
          const artistTracks = allTracks.filter(tr => tr.artist === t.artist);
          if (artistTracks.length > 1) {
            setQueueSource({ pool: artistTracks.map(tr => tr.id), name: t.artist });
          } else {
            // Solo track — check favorites, otherwise full library
            if (t.isFavorite) {
              const favIds = allTracks.filter(tr => tr.isFavorite).map(tr => tr.id);
              setQueueSource({ pool: favIds, name: 'Favoritas' });
            } else {
              setQueueSource(null);
            }
          }
        }
      } else {
        setQueueSource(null);
      }
    }

    // Same track already loaded — just resume (no reload)
    if (loadedTrackIdRef.current === id) {
      if (!globalAudio.paused) {
        setIsPlayingMusic(true);
        return;
      }
      // Verify audio has a valid, playable source before reusing cached state
      if (globalAudio.src && globalAudio.src !== '' && globalAudio.readyState >= 2) {
        if (globalAudio.ended) globalAudio.currentTime = 0;
        setIsPlayingMusic(true);
        setCurrentTrackStartTime(Date.now() / 1000);
        const playSessionId = crypto.randomUUID();
        activePlaySessionIdRef.current = playSessionId;
        playAudioInstance(playSessionId);
        return;
      }
      // Source invalid or not ready — force a full reload
      loadedTrackIdRef.current = null;
      loadingTrackIdRef.current = null;
    }

    // Same track currently being loaded async — just mark to auto-play
    if (loadingTrackIdRef.current === id) {
      autoPlayRef.current = true;
      setIsPlayingMusic(true);
      return;
    }

    const playSessionId = crypto.randomUUID();
    activePlaySessionIdRef.current = playSessionId;
    loadingTrackIdRef.current = id;

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
    intentionalPauseRef.current = true;
    globalAudio.pause();
    intentionalPauseRef.current = false;

    loadedTrackIdRef.current = null;
    if (!resumeSeekFlagRef.current) restoreSeekRef.current = null;
    resumeSeekFlagRef.current = false;
    setCurrentTrackId(id);
    setCurrentTrackStartTime(Date.now() / 1000);
    setIsPlayingMusic(!resumeStayPausedRef.current);
    setMusicProgress(0);
    setMusicDuration(0);
    try { localStorage.setItem('owa_current_track_id', id); } catch {}

    const track = tracks.find(t => t.id === id);
    if (!track || !track.url) {
      setYoutubeVideoUrl(null);
      return;
    }

    // YouTube → ReactPlayer
    if (track.url.includes('youtube.com/') || track.url.includes('youtu.be/')) {
      setYoutubeVideoUrl(track.url);
      if (resumeStayPausedRef.current) {
        resumeStayPausedRef.current = false;
        setIsPlayingMusic(false);
      } else {
        setIsPlayingMusic(true);
      }
      setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
      setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      loadedTrackIdRef.current = id;
      loadingTrackIdRef.current = null;
      return;
    }
    setYoutubeVideoUrl(null);

    // Remove only the played track from queue (keep earlier and later tracks)
    setMusicQueue(prev => {
      const idx = prev.indexOf(id);
      if (idx >= 0) return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      return prev;
    });

    // Audio playback: try convertFileSrc first (streaming), fallback to readFile + Blob
    const setupAudio = async () => {
      try {
        if (!track.url) return;

        if (track.source === 'local') {
          let srcUrl: string | null = null;

          // Strategy 1 (AETHER pattern): load File from IndexedDB + blob URL
          try {
            const file = await getTrackFileFromDB(id);
            if (file) {
              srcUrl = URL.createObjectURL(file);
              currentBlobUrlRef.current = srcUrl;
            }
          } catch {
            srcUrl = null;
          }

          // Strategy 2: convertFileSrc (streaming)
          if (!srcUrl) {
            try {
              srcUrl = convertFileSrc(track.url);
              if (!srcUrl) srcUrl = null;
            } catch {
              srcUrl = null;
            }
          }

          // Strategy 3: readFile + Blob URL
          if (!srcUrl) {
            try {
              const data = await readFile(track.url);
              if (loadingTrackIdRef.current !== id) {
                if (srcUrl?.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
                return;
              }
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
              }
            } catch (readErr) {
              console.warn('[Audio] readFile also failed:', readErr);
            }
          }

          if (!srcUrl) return;

          if (loadingTrackIdRef.current !== id) {
            if (srcUrl.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
            return;
          }

          loadingTrackIdRef.current = null;
          loadedTrackIdRef.current = id;
          globalAudio.src = srcUrl;
          globalAudio.load();

          // If resuming in paused state, set source but don't auto-play
          if (resumeStayPausedRef.current) {
            resumeStayPausedRef.current = false;
            setIsPlayingMusic(false);
          } else {
            // Play immediately while still in user gesture context.
            // If not enough data loaded yet, canplay event will retry.
            autoPlayRef.current = true;
            const playSessionId = activePlaySessionIdRef.current;
            globalAudio.play().then(() => {
              if (activePlaySessionIdRef.current === playSessionId) {
                setIsPlayingMusic(true);
              }
            }).catch(() => {
              // Not enough data yet — canplay handler will retry
            });
          }
        } else {
          // Remote URL: use directly
          if (loadingTrackIdRef.current !== id) return;
          loadingTrackIdRef.current = null;
          loadedTrackIdRef.current = id;
          globalAudio.src = track.url;
          globalAudio.load();

          // If resuming in paused state, set source but don't auto-play
          if (resumeStayPausedRef.current) {
            resumeStayPausedRef.current = false;
            setIsPlayingMusic(false);
          } else {
            autoPlayRef.current = true;
            const playSessionId = activePlaySessionIdRef.current;
            globalAudio.play().then(() => {
              if (activePlaySessionIdRef.current === playSessionId) {
                setIsPlayingMusic(true);
              }
            }).catch(() => {
              // canplay handler will retry
            });
          }
        }
      } catch (e) {
        console.warn('Playback setup failed:', e);
      }
    };
    setupAudio();

    // Refill queue to always have 5 upcoming tracks, excluding recently played
    setMusicQueue(prev => {
      const after = prev.filter(tid => tid !== id);
      if (after.length >= 5) return after;
      const history = trackHistoryRef.current;
      const pool = queueSourceRef.current?.pool ?? tracksRef.current.map(t => t.id);
      // 85% distance: exclude history entries until most of pool is played
      const threshold = Math.floor(pool.length * 0.85);
      const excludeIds = new Set(history.length < threshold ? history : []);
      excludeIds.add(id);
      const available = pool.filter(tid => !excludeIds.has(tid) && !after.includes(tid));
      if (shuffleModeRef.current) {
        const shuffled = weightedShuffle(available, playCountsRef.current);
        return [...after, ...shuffled].slice(0, 5);
      }
      const currentIdx = pool.indexOf(id);
      const ordered = pool.slice(currentIdx + 1)
        .filter(tid => !excludeIds.has(tid) && !after.includes(tid));
      return [...after, ...ordered].slice(0, 5);
    });

    setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
    setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, [tracks, currentTrackId, currentTrackStartTime, setTrackPlayDurations, setIsPlayingMusic, setTrackHistory, setPlayCounts]);
  playTrackRef.current = playTrack;

  const toggleMusicPlayback = useCallback(() => {
    const cid = currentTrackIdRef.current;
    const track = cid ? tracksRef.current.find(t => t.id === cid) : null;
    
    if (!track && tracksRef.current.length > 0) {
      // No current track — play the first one
      playTrackRef.current(tracksRef.current[0].id);
      return;
    }
    if (!track) return;

    const isYT = track.url?.includes('youtube.com/') || track.url?.includes('youtu.be/');
    if (isYT) {
      if (!youtubeVideoUrl) setYoutubeVideoUrl(track.url!);
      setIsPlayingMusic(prev => !prev);
      return;
    }

    const audio = globalAudio;
    const hasSrc = !!audio.src;

    if (!hasSrc || audio.ended) {
      // Audio has no source or ended — (re)load and play
      autoPlayRef.current = false;
      if (isPlayingMusicRef.current) {
        activePlaySessionIdRef.current = null;
        setIsPlayingMusic(false);
      } else {
        playTrackRef.current(cid!);
      }
      return;
    }

    const playSessionId = crypto.randomUUID();
    activePlaySessionIdRef.current = playSessionId;

    if (audio.paused) {
      // Clear any pending fade-out
      if (fadeRampRef.current !== null) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; }
      audio.volume = musicVolumeRef.current;
      // Audio still loading — defer to canplay
      if (audio.readyState < 2 && hasSrc) {
        // Toggle off if already waiting for canplay
        if (autoPlayRef.current) {
          autoPlayRef.current = false;
          setIsPlayingMusic(false);
          return;
        }
        autoPlayRef.current = true;
        setIsPlayingMusic(true);
        return;
      }
      autoPlayRef.current = false;
      setIsPlayingMusic(true);
      setCurrentTrackStartTime(Date.now() / 1000);
      playAudioInstance(playSessionId);
    } else {
      // Save listening time before pausing
      if (currentTrackStartTimeRef.current !== null && cid) {
        const endTime = Date.now() / 1000;
        const durationPlayed = endTime - currentTrackStartTimeRef.current;
        setTrackPlayDurations(prev => {
          const currentDuration = prev[cid!] || 0;
          return { ...prev, [cid!]: currentDuration + durationPlayed };
        });
      }
      setCurrentTrackStartTime(null);
      autoPlayRef.current = false;
      // Fade out
      const steps = 8;
      const stepMs = 12;
      const startVol = audio.volume;
      // Clear any existing fade before starting new one
      if (fadeRampRef.current !== null) { clearInterval(fadeRampRef.current); }
      intentionalPauseRef.current = true;
      let i = 0;
      fadeRampRef.current = window.setInterval(() => {
        i++;
        audio.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
          if (fadeRampRef.current !== null) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; }
          intentionalPauseRef.current = true;
          // Save progress directly from audio element before pausing
          const liveProgress = globalAudio.duration && isFinite(globalAudio.duration) && globalAudio.duration > 0
            ? globalAudio.currentTime / globalAudio.duration : 0;
          setMusicProgress(liveProgress);
          audio.pause();
          audio.volume = musicVolumeRef.current;
          activePlaySessionIdRef.current = null;
          setIsPlayingMusic(false);
          intentionalPauseRef.current = false;
        }
      }, stepMs);
    }
  }, [youtubeVideoUrl, setTrackPlayDurations, setIsPlayingMusic]);

  const setMusicProgressCb = useCallback((progress: number) => {
    setMusicProgress(progress);
    if (globalAudio.duration && isFinite(progress)) {
      globalAudio.currentTime = progress * globalAudio.duration;
    }
  }, []);

  const clearCurrentTrack = useCallback(() => {
    setCurrentTrackId(null);
    setYoutubeVideoUrl(null);
    const liveProgress = globalAudio.duration && isFinite(globalAudio.duration) && globalAudio.duration > 0
      ? globalAudio.currentTime / globalAudio.duration : 0;
    setMusicProgress(liveProgress);
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
          globalAudio.play().catch(() => {
            setTimeout(() => globalAudio.play().catch(() => {}), 100);
          });
          return;
        }
        let nextId: string | null = null;
        const q = musicQueueRef.current;
        const cid = currentTrackIdRef.current;
        const hasSource = !!queueSourceRef.current;
        if (q.length > 0) {
          const [next] = q;
          setMusicQueue(q.slice(1));
          nextId = next;
        } else if (hasSource || shuffleModeRef.current || repeatModeRef.current === 'all') {
          const sourcePool = queueSourceRef.current?.pool ?? tracksRef.current.map(t => t.id);
          let refilled: string[];
          if (shuffleModeRef.current) {
            const rest = sourcePool.filter(tid => tid !== cid);
            refilled = weightedShuffle(rest.length > 0 ? rest : sourcePool, playCountsRef.current);
          } else {
            const idx = sourcePool.indexOf(cid);
            const startIdx = idx >= 0 ? (idx + 1) % sourcePool.length : 0;
            refilled = [];
            for (let i = 0; i < sourcePool.length; i++) {
              refilled.push(sourcePool[(startIdx + i) % sourcePool.length]);
            }
          }
          if (refilled.length > 0) {
            setMusicQueue(refilled.slice(1));
            nextId = refilled[0];
          }
        }
        if (nextId) {
          setMusicQueue(prev => {
            if (prev.length >= 5) return prev;
            const history = trackHistoryRef.current;
            const pool = queueSourceRef.current?.pool ?? tracksRef.current.map(t => t.id);
            const threshold = Math.floor(pool.length * 0.85);
            const excludeIds = new Set(history.length < threshold ? history : []);
            excludeIds.add(nextId);
            const available = pool.filter(tid => !excludeIds.has(tid) && !prev.includes(tid));
            const final = available.length > 0 ? available : pool.filter(tid => tid !== nextId && !prev.includes(tid));
            const shuffled = shuffleModeRef.current ? weightedShuffle(final, playCountsRef.current) : final;
            return [...prev, ...shuffled].slice(0, 5);
          });
        }
        if (nextId) {
          playTrackRef.current(nextId);
          if (coverModalTrackIdRef.current) setCoverModalTrackId(nextId);
        } else setIsPlayingMusic(false);
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
        loadedTrackIdRef.current = null;
        setIsPlayingMusic(false);
        // Enterprise behaviour: skip to next in queue (like Spotify/Apple Music)
        const nextInQueue = musicQueueRef.current?.[0];
        if (nextInQueue) {
          playTrackRef.current?.(nextInQueue);
        }
      }
    };
    const onStalled = () => {
      if (isPlayingMusicRef.current && !globalAudio.paused) {
        console.warn('Audio stalled, attempting recovery');
        globalAudio.play().catch(() => {});
      }
    };
    const onCanPlay = () => {
      const seek = restoreSeekRef.current;
      if (seek !== null) {
        restoreSeekRef.current = null;
        globalAudio.currentTime = seek * globalAudio.duration;
      }
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
      if (document.hidden) {
        // Tab hidden → save listening time, pause audio
        wasPlayingBeforeHiddenRef.current = !globalAudio.paused;
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
        activePlaySessionIdRef.current = null;
        if (!globalAudio.paused) {
          intentionalPauseRef.current = true;
          globalAudio.pause();
          intentionalPauseRef.current = false;
        }
      } else {
        // Tab visible again — resume if we were playing
        if (wasPlayingBeforeHiddenRef.current && currentTrackIdRef.current && loadedTrackIdRef.current) {
          const playSessionId = activePlaySessionIdRef.current;
          globalAudio.play().then(() => {
            if (activePlaySessionIdRef.current === playSessionId && activePlaySessionIdRef.current) {
              setIsPlayingMusic(true);
              setCurrentTrackStartTime(Date.now() / 1000);
            }
          }).catch(() => {
            if (activePlaySessionIdRef.current === playSessionId && activePlaySessionIdRef.current) {
              setIsPlayingMusic(false);
              setCurrentTrackStartTime(null);
            }
          });
        }
        wasPlayingBeforeHiddenRef.current = false;
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

  function getGradeForScore(score: number): 'AD' | 'A' | 'B' | 'C' {
    if (score >= 18) return 'AD';
    if (score >= 14) return 'A';
    if (score >= 11) return 'B';
    return 'C';
  }

  function recalcDailyPerformance(today: string) {
    const daySessions = studySessions.filter(s =>
      s.startedAt.slice(0, 10) === today && s.type !== 'break'
    );
    if (daySessions.length === 0) return;
    const totalMinutes = daySessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0);
    const avgPerception = daySessions.reduce((sum, s) => sum + (s.perception || 5), 0) / daySessions.length;
    const avgDiscomfort = daySessions.reduce((sum, s) => sum + (s.discomfort || 0), 0) / daySessions.length;
    const goalMin = settings.studyGoals?.[
      ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
    ] || settings.dailyGoal || 240;
    const studyTimeScore = Math.min(10, (totalMinutes / Math.max(1, goalMin)) * 10);
    const score = Math.max(0, Math.min(20, Math.round((avgPerception * 1.5) + studyTimeScore - (avgDiscomfort * 0.5))));
    const grade = getGradeForScore(score);
    setDailyPerformances(prev => {
      const idx = prev.findIndex(p => p.date === today);
      const entry: DailyPerformance = { date: today, score, grade, totalMinutes, sessionCount: daySessions.length };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = entry;
        return copy;
      }
      return [...prev, entry];
    });
  }

  const addStudySession = useCallback((session: Omit<StudySession, 'id'>): string | null => {
    const key = `${session.type}-${session.duration}-${Math.floor(Date.now() / 2000)}`;
    if (key === lastSessionKeyRef.current) return null;
    lastSessionKeyRef.current = key;
    const id = Date.now().toString();
    const newSession = { ...session, id };
    setStudySessions(prev => {
      const updated = [...prev, newSession];
      return updated;
    });
    setTimeout(() => recalcDailyPerformance(new Date().toISOString().slice(0, 10)), 0);
    return id;
  }, [studySessions, settings.dailyGoal, settings.studyGoals]);

  const updateStudySession = useCallback((id: string, updates: Partial<StudySession>) => {
    setStudySessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setTimeout(() => recalcDailyPerformance(new Date().toISOString().slice(0, 10)), 0);
  }, []);

  const incrementSessionTime = useCallback(() => {
    setSessionTime(prev => prev + 1);
  }, []);

  const incrementDailyStudyTime = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setDailyStudyDate(prev => {
      if (prev && prev !== today) {
        setDailyStudyTime(0);
      }
      return today;
    });
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

  const handlePomodoroBannerClick = useCallback(() => {
    const actualDuration = completionSessionTimeRef.current || sessionTimeRef.current;
    if (actualDuration < 1) return;
    if (isRestRef.current) { setShowRestPrompt(false); return; }
    addStudySession({
      type: 'pomodoro',
      startedAt: new Date(Date.now() - actualDuration * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      duration: actualDuration,
      taskId: activeTaskIdRef.current || undefined,
      courseId: undefined,
      pauseCount: distractionCountRef.current,
      pauseDuration: accumulatedPauseTimeRef.current,
    });
    incrementPomodoroSessions();
    setIsRest(true);
    setSessionTime(0);
    setIsTimerActive(true);
    setShowRestPrompt(false);
  }, [addStudySession, incrementPomodoroSessions, setSessionTime, setIsTimerActive]);

  // Listen for timer:startRest from FloatingTimer window
  useEffect(() => {
    const unlisten = listen('timer:startRest', () => {
      handlePomodoroBannerClick();
      setNavigateTo('estudio');
    });
    return () => { unlisten.then(fn => fn()); };
  }, [handlePomodoroBannerClick, setNavigateTo]);

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

  // ── Task deadline notifications ──
  const notifiedDueTasksRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const oneDayMs = 86_400_000;
      tasks.forEach(t => {
        if (t.status === 'completado' || !t.dueDate) return;
        const due = new Date(t.dueDate).getTime();
        if (isNaN(due)) return;
        const diff = due - now;
        // Within 1 day AND not already notified
        if (diff > 0 && diff <= oneDayMs && !notifiedDueTasksRef.current.has(t.id)) {
          notifiedDueTasksRef.current.add(t.id);
          const dueStr = new Date(t.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          import('../lib/notifications').then(m => m.notifyTaskDueSoon(t.title, dueStr));
        }
      });
    };
    check();
    const interval = setInterval(check, 1_800_000);
    return () => clearInterval(interval);
  }, [tasks]);

  const value: AppContextType = {
    tasks, habits, notes, noteFolders, courses, events, tracks, studySessions,
    settings, sessionTime, sessionType, weeklyStudyTime, dailyStudyTime, pomodoroSessions,
    activeTaskId, timerLocked, isTimerActive, roundsCompleted, showCompletion,
    showRestPrompt, setShowRestPrompt, handlePomodoroBannerClick,
    currentTrackId, coverModalTrackId, youtubeVideoUrl, isPlayingMusic, isAudioLoading, musicVolume, musicProgress, musicDuration, musicListeningTime, dailyMusicTime, weeklyMusicTime, monthlyMusicTime, shuffleMode, repeatMode,
    trackHistory, playCounts, musicQueue, queueSource, downloadQueue, artists,
    googleConnected, calendarSyncEnabled, lastCalendarSync, importState,
    addTask, updateTask, deleteTask, toggleTaskStatus, clearAllTasks, deleteCompletedTasks, deleteOldCompletedTasks, reorderTasks,
    addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, incrementTaskStudyTime,
    addNote, updateNote, updateNoteVisual, deleteNote, restoreNote, permanentlyDeleteNote, addNoteFolder, deleteNoteFolder, reorderFolders, reorderNotes, updateNoteFolder, duplicateNote,
    addCourse, updateCourse, deleteCourse, reorderCourses,
    addEvent, updateEvent, deleteEvent,
    addHabit, updateHabit, deleteHabit, setHabits,
    addTrack, updateTrack, deleteTrack, toggleTrackFavorite, importLocalTracks,
    playTrack, toggleMusicPlayback, setIsPlayingMusic, clearCurrentTrack, setMusicVolume: setMusicVolumeCb, setMusicProgress: setMusicProgressCb,
    setShuffleMode, setRepeatMode, setMusicQueue, setQueueSource, clearAllMusicData,
    exportMusicLibrary, importMusicLibrary,
    setCoverModalTrackId,
    addArtist: useCallback((name: string, profileImage?: string) => {
      setArtists(prev => {
        if (prev.some(a => a.name.toLowerCase() === name.toLowerCase())) return prev;
        return [...prev, { id: Date.now().toString(), name, ...(profileImage ? { profileImage } : {}) }];
      });
    }, []),
    updateArtist: useCallback((id: string, updates: { name?: string; profileImage?: string }) => {
      setArtists(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }, []),
    deleteArtist: useCallback((id: string) => {
      setArtists(prev => prev.filter(a => a.id !== id));
    }, []),
    playlists,
    addPlaylist: useCallback((name: string, trackIds: string[], coverImage?: string, isPublic?: boolean) => {
      setPlaylists(prev => {
        if (prev.some(p => p.name.toLowerCase() === name.toLowerCase())) return prev;
        return [...prev, { id: crypto.randomUUID(), name: name.trim(), trackIds, coverImage, isPublic, createdAt: Date.now() }];
      });
    }, []),
    updatePlaylist: useCallback((id: string, updates: Partial<Playlist>) => {
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }, []),
    deletePlaylist: useCallback((id: string) => {
      setPlaylists(prev => prev.filter(p => p.id !== id));
    }, []),
    addToDownloadQueue, updateDownloadProgress, updateDownloadStatus,
    removeFromDownloadQueue, clearCompletedDownloads, downloadPath, setDownloadPathCtx: setDownloadPathCb,
    addStudySession, updateStudySession, incrementSessionTime, incrementDailyStudyTime,
    incrementPomodoroSessions, resetPomodoroSessions, setActiveTaskId, setTimerLocked,
    linkTaskToTimer, unlinkTaskFromTimer, toggleTimer, resetTimer,
    setIsTimerActive, setSessionTime, setDailyStudyTime, setWeeklyStudyTime,
    setTasks, setPomodoroSessions, setShowCompletion, setRoundsCompleted, isRest, setIsRest,
    setSessionType, accumulatedPauseTime, pauseStartTime, distractionCount, focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime, dailyFocusPomodoro, dailyFocusChrono,
    setAccumulatedPauseTime, setPauseStartTime, setDistractionCount, setFocusPomodoroTime, setFocusChronoTime, setBreakTime, setDailyFocusPomodoro, setDailyFocusChrono,
    dailyPerformances, setDailyPerformances,
    navigateTo, setNavigateTo,
    focusedTaskId, setFocusedTaskId,
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




