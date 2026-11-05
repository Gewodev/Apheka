import type {SavedMusicArtist} from '../lib/artistIdentity';
import {artistKey} from '../lib/artistIdentity';
import {readQueueIntent,rememberQueueSource,resumeLibraryQueue} from '../lib/queueResume';
import {prepareTaskSteps,appendTaskStep,taskMinutes} from '../lib/taskStudyPlan';
import {isLibraryTrack,libraryRadioOrder,nextMusicSelection,radioTracks} from '../lib/musicRadio';
import {resolvedYouTubeUrl} from '../lib/youtubePlayback';
import {useNetworkOnline} from '../lib/networkState';
import {canPlayOffline} from '../lib/musicAvailability';
import {seconds as studySeconds} from '../lib/studyAnalytics';
import {reorderNoteSubset} from '../lib/noteOrder';
import { remainingToDeadline } from '../lib/timerSchedule';
import { taskLinkUnavailable, sessionLinkUnavailable } from '../lib/linkEligibility';
import { snapshotScore, isStateSnapshot } from '../lib/stateSnapshot';
import { normalizeTimerLink, changeTimerLink, linkedStudyTitle } from '../lib/timerLink';
import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, useSyncExternalStore, ReactNode, Dispatch, SetStateAction } from 'react';
import {createSelectionStore} from '../lib/selectionStore';
import {PlaybackRecovery} from '../lib/playbackRecovery';
import { emit as nativeEmit, listen as nativeListen } from '@tauri-apps/api/event';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { copyFile, mkdir, exists, readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { get, set, del } from 'idb-keyval';
import { extractAudioMetadata } from '../lib/audioMetadata';
import { format, parseISO, subDays, addDays } from 'date-fns';
import { appDataDir, appCacheDir, join, extname } from '@tauri-apps/api/path';
import { saveAllTracks, loadAllTracks, copyAudioToStorage, removeAudioFromStorage, clearAllAudioFiles, exportMusicLibrary as exportMusicToDir, importMusicLibrary as importMusicFromDir, saveTrackMetadata, getAllTracksMetadata, deleteTrackMetadata, clearAllTracksMetadata, addTrackFileToDB, getTrackFileFromDB, deleteTrackFileFromDB, clearAllTrackFiles, storeTrackFileInDB, buildAudioFileName, toDisplayName, renameAudioInStorage, getMusicDir } from '../lib/musicDb';
import { generalYtControl } from '../lib/ytEngine';
import { normalizeEditorHtml } from '../lib/editorHtml';

// Browser preview has no native event bridge. Desktop keeps its real implementation.
const emit: typeof nativeEmit = (event, payload) => isTauri() ? nativeEmit(event, payload) : Promise.resolve();
const listen: typeof nativeListen = (event, handler, options) => isTauri() ? nativeListen(event, handler, options) : Promise.resolve(() => {});

const audioHost=globalThis as typeof globalThis & {__aphekaAudio?:HTMLAudioElement};
if(!audioHost.__aphekaAudio){audioHost.__aphekaAudio=new Audio();audioHost.__aphekaAudio.volume=.7;}
export const globalAudio = audioHost.__aphekaAudio;

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
//  CORE TYPES
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
  estimatedMinutes?: number;
}

export interface TaskFile {
  id: string;
  name: string;
  path: string;
  type: string; // 'pdf' | 'image' | 'doc' | 'other' | 'video' | 'link'
  materialType?: string; // 'resource' | 'formula' | 'concept' | 'key-data' | 'meaning' | 'quiz' | 'procedure'
  size?: number;
  thumbnailUrl?: string;
}

export interface Task {
  id: string;
  sourceNoteId?: string;
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
  googleTaskId?: string; // mapeo a Google Tasks (sync bidireccional)
}

export interface NoteAttachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'audio' | 'file';
  dataUrl: string;
  size: number;
}

export interface Note {
  noteType?: 'note' | 'idea' | 'reference' | 'journal';
  journalDate?: string;
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
  tagIds?: string[];   // topic tag references (topicTagDefs)
  groupName?: string;
  generalOnly?: boolean;
  topicOnly?: boolean;
  color?: string;
  toolMode?: string;   // study tool that created this material (specialized editing)
}

export interface TopicFlashcard {
  groupName?: string;
  id: string;
  question: string;
  answer: string;
  difficulty: 'facil' | 'bueno' | 'dificil';
  lastReviewed: number;
  nextReview: number;
  tagIds?: string[];   // topic tag references (topicTagDefs)
}

export interface TopicRecording {
  id: string;
  name: string;
  dataUrl: string;
  duration: number;
  createdAt: number;
  tagIds?: string[];   // topic tag references (topicTagDefs)
}

export interface SubjectTopic {
  id: string;
  title: string;
  status: 'pending' | 'studying' | 'done';
  createdAt: number;
  reviewLevel: number; // 0 to 10 (speedometer scale, migrated from 0â€“5)
  nextReview: number;  // timestamp
  groupId?: string;    // linked SubjectGroup id
  toolGroups?: string[];
  materials: SubjectMaterial[];
  flashcards?: TopicFlashcard[];
  recordings?: TopicRecording[];
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
  coverOriginal?: string;
  coverCrop?: {zoom:number;x:number;y:number};
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
  topicTagDefs?: { id: string; name: string; color: string }[];
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
  googleEventId?: string; // mapeo a Google Calendar (sync bidireccional)
}

// Puente entre el Planificador (store localStorage propio) y la sincronización
// con Google Calendar. Los eventos del planificador se registran aquí para
// participar en el sync bidireccional sin abandonar su store local.
export interface PlanEventBridge {
  id: string;
  title: string;
  description: string;
  date: string;        // ISO date
  startTime: string;
  endTime: string;
  allDay?: boolean;
  color: string;
  googleEventId?: string;
}

export interface Track {
  genre?: string;
  librarySaved?: boolean; // false only for a preview not explicitly saved to the library
  localAudioPath?: string;
  catalogId?: string;
  artistCatalogIds?: string[];
  lyricsOffsetSeconds?: number;
  lyricsHidden?: boolean;
  id: string;
  title: string;
  artist: string;
  collaborators?: string[];
  duration: number;   // seconds
  source: 'local' | 'youtube' | 'spotify' | 'audius';
  url?: string;       // file path or youtube url
  coverImage?: string;
  coverUrl?: string;
  isFavorite: boolean;
  listenedTime: number; // seconds
  filePath?: string;  // ruta original de donde se importó (referencia/dedup)
  audioFile?: string; // nombre del archivo dentro de la carpeta de música propia
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
  format?: 'mp3'|'m4a'|'mp4';
  videoQuality?: '720'|'1080'|'best';
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
  title?: string;      // free-study label (lo que estudiaste)
  taskId?: string;
  subtaskId?: string;
  taskTitle?: string;
  plannedSessionId?: string; // linked planned session (Cursos cronograma)
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

export interface PlannedSession {
  id: string;
  courseId: string;
  date: string;           // YYYY-MM-DD
  title: string;
  startTime?: string;     // HH:MM
  groupId?: string;
  topicId?: string;
  durationMinutes: number;
  type: string;   // 'estudio' | 'repaso' | 'ejercicio' | 'lectura' | 'otro' | custom
  completed: boolean;
  intensity?: number;   // expectativa 1-10 de la sesión
  sortOrder?: number;   // orden manual del usuario en el cronograma (persistente)
  repeat?: 'none' | 'daily' | 'weekly' | 'custom_days';
  repeatDays?: number[];  // 0=Mon..6=Sun si custom_days
  repeatUntil?: string;   // límite de repetición (YYYY-MM-DD)
  exceptions?: string[];  // fechas excluidas (editadas como "solo esta sesión")
  createdAt: string;
}

export interface Settings {
  // ...existing fields
  chronoGoal: number; // seconds, default 25 * 60
  theme: 'claro' | 'oscuro' | 'sistema' | 'vibrante';
  navigationMode?: 'auto' | 'pinned';
  navigationCollapsed?: boolean;
  appearanceMode?: 'colors' | 'image';
  autoWallpaperTheme?: boolean;
  paletteImageKey?: string;
  desktopBarAutoHide?: boolean;
  accentColor: string;
  userName: string;
  backgroundImage?: string;
  backgroundImagePath?: string;
  backgroundVideoPath?: string;
  backgroundMotion?: 'off' | 'smart';
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
  pomodoroEndAt?: number; // Absolute end time, consumed when a new focus session starts.
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
  playerBarTrackHeight?: number;
  // 3-color system
  useThreeColors?: boolean;
  coverBgMode?: 'auto' | 'black' | 'gray' | 'theme';
  timeFormat?: '24h' | '12h';
  studyGoals?: Record<string, number>; // day of week -> minutes, e.g. { "monday": 120, "tuesday": 180 }
  // Music settings
  downloadFormat?: 'mp3' | 'm4a' | 'mp4';
  downloadVideoQuality?: '720'|'1080'|'best';
  audioQuality?: string;
  includeCover?: boolean;
  autoRetryOnError?: boolean;
  musicOffline?: boolean;
  lyricsLookup?: boolean;
  musicDownloadBudgetMB?: number;
  lyricsTextSize?: number;
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  APP STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
}

export type ViewId = 'inicio' | 'tareas' | 'apuntes' | 'estudio' | 'cursos' | 'ia' | 'analiticas' | 'chat' | 'ajustes' | 'musica' | 'flujo' | 'canvas';

interface AppContextType extends AppState {
  persistWorkspace: () => Promise<void>;
  setSessionType: (val: 'pomodoro' | 'chrono') => void;
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
  flushNoteContent: (noteId: string, content: string, title?: string) => void;
  addCourse: (course: Omit<Course, 'id' | 'sortOrder'>) => string;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  reorderCourses: (courseIds: string[]) => void;
  addEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;
  addHabit: (name: string) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  setHabits: Dispatch<SetStateAction<Habit[]>>;
  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>, skipRename?: boolean) => Promise<void>;
  deleteTrack: (id: string) => void;
  toggleTrackFavorite: (id: string) => void;
  importLocalTracks: (paths: string[]) => Promise<void>;
  scanFolderForAudio: (folderPath: string) => Promise<Track[]>;
  checkLocalFileExists: (track: Track) => Promise<boolean>;
  cleanupMissingLocalFiles: () => Promise<{ removed: number }>;
  importLocalZeroCopy: (paths: string[], isFolder?: boolean) => Promise<number>;
  removeDuplicateTracks: () => Promise<number>;
  normalizeMusicFilenames: () => Promise<number>;
  setCoverModalTrackId: Dispatch<SetStateAction<string | null>>;
  isAudioLoading: boolean;
  currentTrackId: string | null;
  coverModalTrackId: string | null;
  youtubeVideoUrl: string | null;
  setYoutubeVideoUrl: (url: string | null) => void;
  isPlayingMusic: boolean;
  musicVolume: number;
  musicProgress: number;
  musicDuration: number;
  setMusicDuration: (d: number) => void;
  setMusicProgressRaw: (p: number) => void;
  musicListeningTime: number;
  dailyMusicTime: Record<string, number>;
  weeklyMusicTime: number;
  monthlyMusicTime: number;
  shuffleMode: boolean;
  repeatMode: 'none' | 'all' | 'one';
  trackHistory: string[];
  playCounts: Record<string, number>;
  musicQueue: string[];
  queueSource: { pool: string[]; name?: string } | null;
  artists: SavedMusicArtist[];
  downloadQueue: DownloadItem[];
  downloadPath: string;
  setDownloadPathCtx: (path: string) => void;
  importState: ImportState;
  playTrack: (id: string, preserveQueue?: boolean) => void;
  toggleMusicPlayback: () => void;
  setIsPlayingMusic: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMusicVolume: (volume: number) => void;
  setMusicProgress: (progress: number) => void;
  setShuffleMode: (mode: boolean) => void;
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;
  setMusicQueue: (queue: string[] | ((prev: string[]) => string[])) => void;
  setQueueSource: (source: { pool: string[]; name?: string } | null) => void;
  clearCurrentTrack: () => void;
  clearAllMusicData: () => void;
  exportMusicLibrary: (destDir: string) => Promise<number>;
  importMusicLibrary: (srcDir: string) => Promise<number>;
  addArtist: (name: string, profileImage?: string, catalogId?:string) => void;
  updateArtist: (id: string, updates: Partial<Pick<SavedMusicArtist,'name'|'profileImage'|'trackIds'>>) => void;
  deleteArtist: (id: string) => void;
  playlists: Playlist[];
  addPlaylist: (name: string, trackIds: string[], coverImage?: string, isPublic?: boolean) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
  sessionTime: number;
  sessionType: 'pomodoro' | 'chrono';
  weeklyStudyTime: Record<string, number>;
  dailyStudyTime: number;
  pomodoroSessions: number;
  activeTaskId: string | null;
  activeSubtaskId: string | null;
  activePlannedSessionId: string | null;
  setActivePlannedSessionId: (id: string | null) => void;
  linkPlannedSessionToTimer: (id: string) => void;
  unlinkPlannedSessionFromTimer: () => void;
  timerLocked: boolean;
  isTimerActive: boolean;
  isRest: boolean;
  showCompletion: boolean;
  showRestPrompt: boolean;
  setShowRestPrompt: Dispatch<SetStateAction<boolean>>;
  handlePomodoroBannerClick: () => void;
  accumulatedPauseTime: number;
  pauseStartTime: number | null;
  distractionCount: number;
  focusPomodoroTime: number;
  focusChronoTime: number;
  breakTime: number;
  dailyBreakTime: Record<string, number>;
  dailyFocusPomodoro: Record<string, number>;
  dailyFocusChrono: Record<string, number>;
  plannedSessions: PlannedSession[];
  addStudySession: (session: Omit<StudySession, 'id'>) => string | null;
  updateStudySession: (id: string, updates: Partial<StudySession>) => void;
  deleteStudySession: (id: string) => void;
  addPlannedSession: (session: Omit<PlannedSession, 'id' | 'createdAt'>) => void;
  updatePlannedSession: (id: string, updates: Partial<PlannedSession>) => void;
  deletePlannedSession: (id: string) => void;
  reorderPlannedSessions: (orderedIds: string[]) => void;
  incrementSessionTime: () => void;
  incrementDailyStudyTime: () => void;
  incrementPomodoroSessions: () => void;
  resetPomodoroSessions: () => void;
  setActiveTaskId: (taskId: string | null) => void;
  linkTaskToTimer: (taskId: string, subtaskId?: string) => void;
  startSubtaskStudy: (taskId: string, subtaskId: string) => boolean;
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
  addToDownloadQueue: (item: Omit<DownloadItem, 'id' | 'progress' | 'status' | 'completedItems'>) => string;
  updateDownloadProgress: (id: string, progress: number) => void;
  updateDownloadStatus: (id: string, status: DownloadItem['status'], errorMessage?: string) => void;
  removeFromDownloadQueue: (id: string) => void;
  clearCompletedDownloads: () => void;
  navigateTo: ViewId | null;
  setNavigateTo: (view: ViewId | null) => void;
  courseDeepLink: { courseId: string; groupId?: string; topicId?: string } | null;
  setCourseDeepLink: (link: { courseId: string; groupId?: string; topicId?: string } | null) => void;
  navigateToCourse: (courseId: string, groupId?: string, topicId?: string) => void;
  hydrated: boolean;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  focusedEventId: string | null;
  setFocusedEventId: (id: string | null) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  googleConnected: boolean;
  calendarSyncEnabled: boolean;
  lastCalendarSync: string | null;
  setGoogleConnected: (v: boolean) => void;
  setCalendarSyncEnabled: (v: boolean) => void;
  setLastCalendarSync: (v: string | null) => void;
  triggerCalendarSync: () => Promise<void>;
  syncCalendarTwoWay: () => Promise<{ created: number; updated: number; pushed: number; deleted: number; errors: number }>;
  importGoogleEvents: () => Promise<number>;
  planEvents: PlanEventBridge[];
  setPlanEvents: Dispatch<SetStateAction<PlanEventBridge[]>>;
  planSyncTick: number;
  planSyncImports: PlanEventBridge[];
  syncPlanEventToGoogle: (ev: PlanEventBridge) => Promise<string | null>;
  deletePlanEventFromGoogle: (googleEventId: string) => Promise<void>;
  triggerTasksSync: () => Promise<void>;
  syncTasksTwoWay: () => Promise<{ created: number; updated: number; pushed: number; deleted: number; errors: number }>;
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
  notifications: AppNotification[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
  toastMessage: { message: string; type: 'success' | 'error' | 'info' } | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DEFAULTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const defaultCourses: Course[] = [];

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
  fontFamily: 'IBM Plex Sans',
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

const defaultFolders: NoteFolder[] = [];


const STORAGE_KEY = 'owa_studio_data';
const MUSIC_STATS_KEY = 'owa_music_stats';
const MUSIC_TRACKS_KEY = 'owa_music_tracks';

const AppContext = createContext<AppContextType | null>(null);
const AppSliceContext=createContext<ReturnType<typeof createSelectionStore<AppContextType>>|null>(null);
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
  return `${fmtClock(start, format)} — ${fmtClock(end, format)}`;
}

// Repairs legacy data that was double-encoded (UTF-8 bytes read as cp1252),
// e.g. "â€“" back to "–". Only touches strings that actually contain mojibake.
export function fixMojibake(raw: string): string {
  if (!raw.includes('Ã') && !raw.includes('â€')) return raw;
  try {
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0) & 0xff);
    const fixed = new TextDecoder('utf-8').decode(bytes);
    return fixed.includes('\uFFFD') ? raw : fixed;
  } catch {
    return raw;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const networkOnline=useNetworkOnline();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>(defaultFolders);
  const [courses, setCourses] = useState<Course[]>(defaultCourses);
  const coursesLiveRef=useRef(courses);coursesLiveRef.current=courses;
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [planEvents, setPlanEvents] = useState<PlanEventBridge[]>(() => {
    try {
      const d = JSON.parse(localStorage.getItem('owa_planner_v3') || '{}');
      const raw = (d.events || []) as any[];
      return raw.map(p => ({
        id: p.id, title: p.title || '', description: p.description || '',
        date: p.date, startTime: p.startTime || '', endTime: p.endTime || '',
        allDay: !!p.allDay, color: p.color || 'var(--accent)', googleEventId: p.googleEventId,
      }));
    } catch { return []; }
  });
  const [planSyncTick, setPlanSyncTick] = useState(0);
  const [planSyncImports, setPlanSyncImports] = useState<PlanEventBridge[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const lastBackupTsRef = useRef(0);
  const lastDiskBackupTsRef = useRef(0);
  const diskWritesRef=useRef<Promise<void>>(Promise.resolve());
  const persistWorkspaceDisk=useCallback((json:string)=>{
    const write=diskWritesRef.current.catch(()=>{}).then(async()=>{
      const path=await join(await appDataDir(),'owa_studio_data.json');
      if(sessionStorage.getItem('owa_restore_pending'))return;
      await writeFile(path,new TextEncoder().encode(json));
    });
    diskWritesRef.current=write;return write;
  },[]);
  const mirrorQuotaWarnedRef = useRef(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sessionTime, setSessionTime] = useState(0);
  const [weeklyStudyTime, setWeeklyStudyTime] = useState<Record<string, number>>({});
  const [dailyStudyTime, setDailyStudyTime] = useState(0);
  const [dailyStudyDate, setDailyStudyDate] = useState('');
  const [pomodoroSessions, setPomodoroSessions] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('owa_timer_link_v1');
      if (!raw) return null;
      const d = JSON.parse(raw);
      return typeof d.activeTaskId === 'string' && d.activeTaskId ? d.activeTaskId : null;
    } catch { return null; }
  });
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(() => {
    try {return normalizeTimerLink(JSON.parse(localStorage.getItem("owa_timer_link_v1") || "null")).activeSubtaskId || null;} catch {return null;}
  });
  const [activePlannedSessionId, setActivePlannedSessionId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('owa_timer_link_v1');
      if (!raw) return null;
      const d = JSON.parse(raw);
      return normalizeTimerLink(d).activePlannedSessionId;
    } catch { return null; }
  });
  const timerLocked = !!(activeTaskId || activePlannedSessionId);
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
  useEffect(()=>{if(hydrated)setSettings(previous=>previous.musicOffline===!networkOnline?previous:{...previous,musicOffline:!networkOnline});},[networkOnline,hydrated]);
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
    shuffleModeRef.current=mode;
    if (mode) {
      const selected=radioTracks(tracksRef.current,queueSourceRef.current?.pool);const source={pool:selected.map(t=>t.id),name:queueSourceRef.current?.name||'Tu biblioteca'};queueSourceRef.current=source;setQueueSource(source);
      // Library radio ignores unsaved discovery previews.
      const radio=libraryRadioOrder(selected,currentTrackIdRef.current,trackHistoryRef.current,playCounts,playbackSettingsRef.current.musicOffline,Math.random,!!queueSourceRef.current?.pool);
      musicQueueRef.current=radio;setMusicQueue(radio);
    }else{const valid=new Set(tracksRef.current.map(track=>track.id)),current=currentTrackIdRef.current;const queue=musicQueueRef.current.filter(id=>valid.has(id)&&id!==current);musicQueueRef.current=queue;setMusicQueue(queue);}
  }, [playCounts]);
   const setRepeatMode = useCallback((mode: 'none' | 'all' | 'one') => {
    _setRepeatMode(mode);repeatModeRef.current=mode;
    repeatOnePlayedRef.current = false;

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
  // Weighted shuffle: less-played tracks get higher probability (unplayed â‰ˆ 1.0, played 3x â‰ˆ 0.25)
  const weightedShuffle=(ids:string[],counts:Record<string,number>)=>{const allowed=new Set(ids);return libraryRadioOrder(tracksRef.current.filter(t=>allowed.has(t.id)),currentTrackIdRef.current,trackHistoryRef.current,counts,playbackSettingsRef.current.musicOffline);};
   const [trackPlayDurations, setTrackPlayDurations] = useState<Record<string, number>>({});
   const [currentTrackStartTime, setCurrentTrackStartTime] = useState<number | null>(null);
   const [artists, setArtists] = useState<SavedMusicArtist[]>([]);
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
   const playTrackRef = useRef<(id: string, preserveQueue?: boolean) => void>(() => {});
   const trackHistoryRef = useRef(trackHistory);
   const playCountsRef = useRef(playCounts);
   const repeatOnePlayedRef = useRef(false);
  const musicVolumeRef = useRef(musicVolume);
   const autoPlayRef = useRef(false);
   const activePlaySessionIdRef = useRef<string | null>(null);
   const currentBlobUrlRef = useRef<string | null>(null);
   const loadedTrackIdRef = useRef<string | null>(null);
   const loadingTrackIdRef = useRef<string | null>(null);
   const isPlayingMusicRef = useRef(isPlayingMusic);
   const playbackSettingsRef=useRef(settings);
   useLayoutEffect(()=>{playbackSettingsRef.current=settings;},[settings]);
  const currentTrackStartTimeRef = useRef<number | null>(null);
  const intentionalPauseRef = useRef(false);
  const fadeRampRef = useRef<number | null>(null);
  const restoreSeekRef = useRef<number | null>(null);
  
  useLayoutEffect(() => { currentTrackIdRef.current = currentTrackId; }, [currentTrackId]);
  useEffect(() => { trackHistoryRef.current = trackHistory; }, [trackHistory]);
  useEffect(() => { playCountsRef.current = playCounts; }, [playCounts]);
    useEffect(() => { tracksRef.current = tracks; }, [tracks]);
    const libraryMembership=useMemo(()=>tracks.filter(isLibraryTrack).map(t=>t.id).join('|'),[tracks]);
    const previousLibraryMembershipRef=useRef(new Set<string>());
    useEffect(()=>{
      const library=tracksRef.current.filter(isLibraryTrack).map(t=>t.id);
      const added=library.filter(id=>!previousLibraryMembershipRef.current.has(id));previousLibraryMembershipRef.current=new Set(library);
      const previous=queueSourceRef.current;
      if(!previous||!['Mis canciones','Tu biblioteca'].includes(previous.name||''))return;
      const valid=new Set(library),current=currentTrackIdRef.current;
      const pool=[...new Set([...previous.pool.filter(id=>valid.has(id)||id===current),...library])];
      const additions=added.filter(id=>id!==current);
      const queue=[...new Set([...musicQueueRef.current.filter(id=>valid.has(id)&&id!==current),...additions])];
      const source={...previous,pool};queueSourceRef.current=source;setQueueSource(source);musicQueueRef.current=queue;setMusicQueue(queue);
    },[libraryMembership,settings.musicOffline]);
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
      "Espejo local omitido",
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
  const navigateToRef = useRef<ViewId | null>(null);
  useEffect(() => { navigateToRef.current = navigateTo; }, [navigateTo]);
  const [courseDeepLink, setCourseDeepLink] = useState<{ courseId: string; groupId?: string; topicId?: string } | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(() => localStorage.getItem('owa_calendar_sync_enabled') === '1');
  const [lastCalendarSync, setLastCalendarSync] = useState<string | null>(null);

  const setCalendarSyncEnabledPersist = useCallback((v: boolean) => {
    setCalendarSyncEnabled(v);
    localStorage.setItem('owa_calendar_sync_enabled', v ? '1' : '0');
  }, []);

  // Load from IndexedDB / localStorage
  useEffect(() => {
    async function loadData() {
      let oldTracks: Track[] | undefined;
      let loadedData: any = null;
      let stored: string | null | undefined = null;
      let source = '';
      let storageReadFailed = false;
      try {
        const hasRealData = (raw: string | null | undefined): raw is string => {
          if (!raw) return false;
          try {
            const d = JSON.parse(fixMojibake(raw));
            if (!d || typeof d !== 'object') return false;
            return isStateSnapshot(d);
          } catch { return false; }
        };
        let sources: { name: string; read: () => Promise<string | null> }[] = [
          { name: 'idb', read: async () => { try { const data = await get(STORAGE_KEY); return data == null ? null : typeof data === 'string' ? data : JSON.stringify(data); } catch { storageReadFailed = true; return null; } } },
          { name: 'local', read: async () => localStorage.getItem(STORAGE_KEY) },
          { name: 'backup', read: async () => localStorage.getItem('owa_studio_data_backup') },
        ];
        if (isTauri()) {
          sources.push({
            name: 'disk',
            read: async () => {
              try {
                const diskPath = await join(await appDataDir(), 'owa_studio_data.json');
                const bytes = await readFile(diskPath);
                return new TextDecoder().decode(bytes);
              } catch { return null; }
            },
          });
        }
        // Puntuación de frescura: la fecha ISO más reciente de cualquier dato del
        // snapshot. La capa MÁS FRESCA gana: si IDB quedó viejo (cuota excedida en
        // un guardado silencioso) o la app se cerró antes del debounce, las sesiones
        // recientes se restauran desde localStorage/backup/disco en vez de perderse.
        const freshScore = (raw: string): number => {
          try { return snapshotScore(JSON.parse(fixMojibake(raw))); } catch { return 0; }
        };
        const candidates: { name: string; raw: string; score: number }[] = [];
        for (const src of sources) {
          const raw = await src.read();
          if (hasRealData(raw)) {
            const r = raw as string;
            candidates.push({ name: src.name, raw: r, score: freshScore(r) });
          }
        }
        candidates.sort((a, b) => b.score - a.score);
        const winner = candidates[0];
        if (!winner && storageReadFailed) {
          addNotification('No se pudieron cargar tus datos. Cierra y vuelve a abrir APHEKA para reintentar. No se ha sobrescrito el almacenamiento.', 'error');
          return;
        }
        if (winner) {
          stored = winner.raw;
          source = winner.name;
        }
        if (stored && source !== 'idb') { await set(STORAGE_KEY, stored).catch(() => { }); }
        if (stored) {
          const data = JSON.parse(fixMojibake(stored));
          loadedData = data;
          oldTracks = data.tracks;
          if (data.trackHistory) setTrackHistory(data.trackHistory);
          if (data.playCounts) setPlayCounts(data.playCounts);
          if (data.musicQueue) setMusicQueue(data.musicQueue);
          if (data.artists) setArtists(data.artists);
          if (data.playlists) setPlaylists(data.playlists);
          if (data.shuffleMode !== undefined) _setShuffleMode(data.shuffleMode);
          if (data.repeatMode) _setRepeatMode(data.repeatMode);
          // Sanitize: drop corrupt entries (undefined items crash renders with "reading 'id'")
          const cleanArr = (arr: any) => (Array.isArray(arr) ? arr : []).filter((x: any) => x && typeof x === 'object');
          ['tasks', 'notes', 'noteFolders', 'events', 'studySessions', 'plannedSessions'].forEach(k => { if (data[k] !== undefined) data[k] = cleanArr(data[k]); });
          // Backfill: tareas legacy sin arreglos rompen el panel (files/subtasks .length/.map)
          if (data.tasks) data.tasks = (data.tasks as any[]).map((t: any) => ({
            ...t,
            status: t.status || 'inicio',
            subtasks: Array.isArray(t.subtasks) ? t.subtasks.filter((s: any) => s && typeof s === 'object') : [],
            files: Array.isArray(t.files) ? t.files.filter((f: any) => f && typeof f === 'object') : [],
          }));
          if (data.tasks) setTasks(data.tasks);
          if (data.habits) setHabits(data.habits);
          if (data.notes) setNotes(data.notes);
          if (data.noteFolders) setNoteFolders(data.noteFolders);
          if (data.courses) {
            // Sanitize: drop corrupt entries FIRST (null/undefined course entries crash every .find/.map)
            const cleanArray = (arr: any) => (Array.isArray(arr) ? arr : []).filter((x: any) => x && typeof x === 'object');
            const cleanMaterials = (mats: any) => (Array.isArray(mats) ? mats : []).filter((m: any) => m && typeof m === 'object');
            data.courses = cleanArray(data.courses);
            // Migration: topic reviewLevel scale was 0-5, now a 0-10 speedometer
            if (!localStorage.getItem('owa_review_scale_10')) {
              data.courses = data.courses.map((c: any) => ({
                ...c,
                studyTopics: cleanArray(c.studyTopics).map((t: any) => ({ ...t, reviewLevel: Math.min(10, (t.reviewLevel || 0) * 2) })),
              }));
              localStorage.setItem('owa_review_scale_10', '1');
            }
            // Sanitize: drop corrupt entries (undefined topics/groups/materials crash renders)
            data.courses = data.courses.map((c: any) => ({
              ...c,
              studyTopics: cleanArray(c.studyTopics).map((t: any) => ({ ...t, materials: cleanMaterials(t.materials) })),
              groups: cleanArray(c.groups).map((g: any) => ({ ...g, materials: cleanMaterials(g.materials) })),
            }));
            setCourses(data.courses);
          }
          if (data.events) setEvents(data.events);
          if (data.studySessions) {
            // Cura duplicados históricos: mismo origen + solapamiento > 1 min = un solo registro
            const arr = [...(data.studySessions as any[])].filter((s: any) => s && typeof s === 'object' && s.startedAt);
            const kept: any[] = [];
            for (const s of arr.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())) {
              const flag = s.isDistraction ? 'd' : 'r';
              const st = new Date(s.startedAt).getTime();
              const en = st + (s.duration || 0) * 1000;
              const idx = kept.findIndex(k => {
                if ((k.isDistraction ? 'd' : 'r') !== flag) return false;
                if ((k.type === 'break') !== (s.type === 'break')) return false;
                if ((k.taskId ?? '') !== (s.taskId ?? '')) return false;
                if ((k.plannedSessionId ?? '') !== (s.plannedSessionId ?? '')) return false;
                const ks = new Date(k.startedAt).getTime();
                const ke = ks + (k.duration || 0) * 1000;
                return ks < en - 60000 && st < ke - 60000;
              });
              if (idx >= 0) {
                if ((s.duration || 0) > (kept[idx].duration || 0)) kept[idx] = s;
              } else kept.push(s);
            }
            setStudySessions(kept as any);
          }
          if (data.plannedSessions) setPlannedSessions(data.plannedSessions);
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
          if (data.youtubeVideoUrl) {
            if (Number.isFinite(data.musicProgress) && data.musicProgress > 0) generalYtControl.pendingSeek={url:data.youtubeVideoUrl,ratio:Math.min(1,data.musicProgress)};
            setYoutubeVideoUrl(data.youtubeVideoUrl);
          }
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
          if (source === 'local' || source === 'backup') {
            addNotification('Se restauraron tus datos desde la copia de seguridad local.', 'info');
          }
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
      // Restauración recién aplicada: ya se cargó lo restaurado, se retira el
      // marcador anti-pisado para que el auto-guardado vuelva a funcionar.
      try { sessionStorage.removeItem('owa_restore_pending'); } catch { /* noop */ }
      setHydrated(true);
    }
    loadData();
  }, []);

  // Refs to avoid stale closures in timer interval
  const activeSubtaskIdRef = useRef(activeSubtaskId);
  activeSubtaskIdRef.current = activeSubtaskId;
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;
  const activePlannedSessionIdRef = useRef(activePlannedSessionId);
  activePlannedSessionIdRef.current = activePlannedSessionId;

  const [timerLinkHydrated, setTimerLinkHydrated] = useState(false);
  const timerLinkRevision = useRef(0);
  const timerLinkWrites = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    const version = timerLinkRevision.current;
    void get('owa_timer_link_v1').then(saved => {
      if (timerLinkRevision.current !== version || !saved) return;
      let local: any = null;
      try { local = JSON.parse(localStorage.getItem('owa_timer_link_v1') || 'null'); } catch {}
      if (local && (local.updatedAt || 0) >= (saved.updatedAt || 0)) return;
      const link = normalizeTimerLink(saved);
      activeTaskIdRef.current = link.activeTaskId;
      activePlannedSessionIdRef.current = link.activePlannedSessionId;
      setActiveTaskId(link.activeTaskId);
      activeSubtaskIdRef.current=link.activeSubtaskId || null;
      setActiveSubtaskId(link.activeSubtaskId || null);
      setActivePlannedSessionId(link.activePlannedSessionId);
    }).catch(() => {}).finally(() => setTimerLinkHydrated(true));
  }, []);

  useEffect(() => {
    if (!isTimerActive || isRest || sessionType !== 'pomodoro' || sessionTime !== 0 || !settings.pomodoroEndAt) return;
    const remaining = remainingToDeadline(settings.pomodoroEndAt);
    setSettings(prev => ({ ...prev, pomodoroTime: remaining || 1500, pomodoroEndAt: undefined }));
    if (!remaining) {
      setIsTimerActive(false);
      addNotification('La hora configurada ya pasó. Elige otra hora o una duración.');
    }
  }, [isTimerActive, isRest, sessionType, sessionTime, settings.pomodoroEndAt]);

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
  const addStudySessionRef = useRef<(session: Omit<StudySession, 'id'>) => string | null>(() => null);

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
              activeTaskTitle: linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),
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
            setTasks(prev => prev.map(t => t.id === currentTaskId ? { ...t, studyTime: studySeconds(t.studyTime) + 1 } : t));
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      emit('timer:sync', JSON.stringify({
        sessionTime: sessionTimeRef.current,
        isTimerActive: false,
        activeTaskId: activeTaskIdRef.current,
              activeTaskTitle: linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),
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
                setTasks(prev => prev.map(t => t.id === currentTaskId ? { ...t, studyTime: studySeconds(t.studyTime) + (expected - current) } : t));
              }
            }
            setSessionTime(expected);
            emit('timer:sync', JSON.stringify({
              sessionTime: expected,
              isTimerActive: isTimerActiveRef.current,
              activeTaskId: activeTaskIdRef.current,
              activeTaskTitle: linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),
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
              activeTaskTitle: linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),
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

  // Global pomodoro completion detection â€” works even when not in Estudio
  const pomodoroCompletedRef = useRef(false);
  const completionSessionTimeRef = useRef(0);
  useEffect(() => {
    if (isTimerActive && !isRest && sessionType === 'pomodoro' && sessionTime >= settings.pomodoroTime && !pomodoroCompletedRef.current) {
      pomodoroCompletedRef.current = true;
      completionSessionTimeRef.current = sessionTimeRef.current;
      if (navigateToRef.current !== 'estudio') setShowRestPrompt(true);
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
        // Paused -> Active: solo cuenta si se reanuda a MITAD de sesión
        // (sessionTime > 0). Si el temporizador estaba en cero, el "hueco" era
        // simple inactividad entre sesiones, no una pausa: no es distracción.
        if (pauseStartTime) {
          const pauseSecs = Math.floor((Date.now() - pauseStartTime) / 1000);
          if (pauseSecs > 0 && sessionTimeRef.current > 0) {
            setAccumulatedPauseTime(prev => prev + pauseSecs);
            if (pauseSecs > 600) {
              setDistractionCount(prev => prev + 1);
              addNotification('Distracción detectada (pausa mayor a 10 min)', 'info');
              addStudySessionRef.current({
                type: sessionTypeRef.current || 'pomodoro',
                startedAt: new Date(Date.now() - pauseSecs * 1000).toISOString(),
                endedAt: new Date().toISOString(),
                duration: pauseSecs,
                taskId: activeTaskIdRef.current ?? undefined,
                plannedSessionId: activePlannedSessionIdRef.current ?? undefined,
                courseId: undefined,
                pauseCount: 0,
                pauseDuration: 0,
                isDistraction: true,
              });
            }
          }
        }
        setPauseStartTime(null);
      }
      prevIsTimerActiveRef.current = isTimerActive;
    }
  }, [isTimerActive, pauseStartTime, addNotification, isRest]);

  // Distracción SOLO por pausa manual: el detector de ventana oculta/blur se
  // eliminó a pedido (contaba distracción por usar otra ventana sin pausar).
  // Regla vigente: pausa manual + reanudar tras >10 min a mitad de sesión.

  // Large collections are serialized only when they change, not on every timer tick.
  const structuralJson=useMemo(()=>JSON.stringify({tasks,habits,notes,noteFolders,courses,events,studySessions,plannedSessions,settings,artists,playlists,downloadPath,youtubeVideoUrl}),[tasks,habits,notes,noteFolders,courses,events,studySessions,plannedSessions,settings,artists,playlists,downloadPath,youtubeVideoUrl]);
  const savedStructureRef=useRef(''),lastCounterMirrorRef=useRef(0),lastCounterStoreRef=useRef(0);
  // Debounced save
  useEffect(() => {
    if (!hydrated) return;
    try {
      // Restauración pendiente de recarga: no pisar lo restaurado.
      if (sessionStorage.getItem('owa_restore_pending')) return;
    } catch { /* noop */ }
    const runtimeJson = JSON.stringify({
      _savedAt: Date.now(),
        sessionTime, sessionType, isRest, isTimerActive, weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions,
        trackHistory, playCounts, musicQueue, musicVolume, shuffleMode, repeatMode,
        currentTrackId, isPlayingMusic: isPlayingMusic && !globalAudio.paused, musicListeningTime, musicListeningDate, dailyMusicTime,
        musicProgress, musicDuration,
        accumulatedPauseTime, pauseStartTime, distractionCount,
        focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
        dailyFocusPomodoro, dailyFocusChrono, dailyPerformances,
    });
    const json=runtimeJson.slice(0,-1)+','+structuralJson.slice(1);
    const structureChanged=savedStructureRef.current!==structuralJson;savedStructureRef.current=structuralJson;
    // El último estado queda disponible AL INSTANTE para el flush síncrono de cierre
    // (beforeunload/pagehide). Antes se asignaba DENTRO del debounce de 300ms: si la
    // app se cerraba antes, el flush no tenía nada que escribir y la sesión recién
    // creada se perdía al reiniciar.
    latestJsonRef.current = json;
    // Espejo síncrono en localStorage: el dato sobrevive a un cierre instantáneo
    // (IDB y backup/disco siguen en el debounce, como capas secundarias).
    try {
      if (json.length <= 5_000_000 && (structureChanged||Date.now()-lastCounterMirrorRef.current>=10000)) {
        lastCounterMirrorRef.current=Date.now();
        localStorage.setItem(STORAGE_KEY, json);
      } else if (json.length>5_000_000&&!mirrorQuotaWarnedRef.current) {
        console.warn('Espejo local omitido por tamaño (los datos viven en IndexedDB)');
        mirrorQuotaWarnedRef.current = true;
      }
    } catch (e: any) {
      if (!mirrorQuotaWarnedRef.current) {
        console.warn('Espejo local omitido por cuota (los datos viven en IndexedDB)');
        mirrorQuotaWarnedRef.current = true;
      }
    }
    if(!structureChanged&&Date.now()-lastCounterStoreRef.current<5000)return;
    lastCounterStoreRef.current=Date.now();
    const t = setTimeout(() => {
      try { if (sessionStorage.getItem('owa_restore_pending')) return; } catch {}
      set(STORAGE_KEY, json).catch((e: any) => console.error("Error saving data:", e));
      // Backup throttled en localStorage (copia de seguridad adicional).
      // Tope 1 MB (antes 5 MB): el espejo grande llenaba la cuota y tumbaba
      // vistas con QuotaExceededError. IDB + disco siguen guardando todo.
      try {
        if (json.length <= 1_000_000) {
          const now = Date.now();
          if (now - lastBackupTsRef.current > 60000) {
            localStorage.setItem('owa_studio_data_backup', json);
            lastBackupTsRef.current = now;
          }
        } else if (localStorage.getItem('owa_studio_data_backup') !== null) {
          try { localStorage.removeItem('owa_studio_data_backup'); } catch { /* noop */ }
        }
      } catch { /* noop */ }
      // Espejo en disco ($APPDATA/owa_studio_data.json): puente dev↔release y capa
      // extra de persistencia que sobrevive a limpiezas de IndexedDB/localStorage.
      if (isTauri()) {
        (async () => {
          try {
            const nowDisk = Date.now();
            if (nowDisk - lastDiskBackupTsRef.current > 60000) {
              lastDiskBackupTsRef.current = nowDisk;
              await persistWorkspaceDisk(json);
            }
          } catch { }
        })();
      }
      set(MUSIC_STATS_KEY, JSON.stringify({
        musicListeningTime, musicListeningDate, dailyMusicTime,
      })).catch((e: any) => console.error("Error saving music stats:", e));
    }, 300);
    debounceTimerRef.current = t;
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; };
  }, [
    tasks, habits, notes, noteFolders, courses, events, studySessions, plannedSessions, settings,
    weeklyStudyTime, dailyStudyTime, dailyStudyDate, pomodoroSessions, trackHistory, playCounts, musicQueue,
    musicVolume, artists, playlists, currentTrackId, isPlayingMusic, musicListeningDate,
    downloadPath, youtubeVideoUrl,
    accumulatedPauseTime, pauseStartTime, distractionCount,
    focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime,
    dailyFocusPomodoro, dailyFocusChrono,
    hydrated,
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
              activeTaskTitle: linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),
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
              activeTaskTitle: linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),
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

  // Programador ÚNICO de recordatorios nativos (cada 60 s).
  // El anti-spam vive en lib/notifications (canNotifyItem con clave id+fecha
  // de la ocurrencia): no repite aunque el efecto se re-monte, sin Sets en memoria.
  // Respeta el interruptor maestro (Ajustes → Sonidos y Alertas → Notificaciones)
  // y el toggle de tareas por vencer (event_task).
  useEffect(() => {
    if (!hydrated || settings.notifications === false) return;
    const checkReminders = async () => {
      try {
        const { requestNativePermission, notifyEventReminder1h, notifyUpcomingEvent, notifyStudySessionSoon, notifyTaskDueSoon, notifyTaskOverdue } = await import('../lib/notifications');
        if (!(await requestNativePermission())) return;
        const nowMs = Date.now();
        const H = 3_600_000;
        const DAY = 86_400_000;
        for (const ev of events) {
          if (!ev.startTime || !ev.date) continue;
          const evStart = new Date(`${ev.date}T${ev.startTime}`).getTime();
          if (isNaN(evStart)) continue;
          const diff = evStart - nowMs;
          if (diff > 30 * 60_000 && diff <= H) notifyEventReminder1h(ev.title, evStart, ev.id);
          else if (diff > 0 && diff <= 30 * 60_000) notifyUpcomingEvent(ev.title, evStart, ev.id);
        }
        for (const ps of plannedSessions) {
          if (!ps.startTime || !ps.date) continue;
          const psStart = new Date(`${ps.date}T${ps.startTime}`).getTime();
          if (isNaN(psStart)) continue;
          const diff = psStart - nowMs;
          if (diff > 0 && diff <= 10 * 60_000) notifyStudySessionSoon(ps.title, psStart, ps.id);
        }
        if ((settings as any).event_task !== false) {
          for (const t of tasks) {
            if ((t as any).status === 'completado' || !t.dueDate) continue;
            const due = new Date(t.dueDate).getTime();
            if (isNaN(due)) continue;
            const diff = due - nowMs;
            if (diff > 0 && diff <= DAY) notifyTaskDueSoon(t.title, due, t.id);
            else if (diff < 0 && Math.abs(diff) < 7 * DAY) notifyTaskOverdue(t.title, due, t.id);
          }
        }
      } catch { }
    };
    checkReminders();
    const timer = setInterval(checkReminders, 60000);
    return () => clearInterval(timer);
  }, [hydrated, settings.notifications, (settings as any).event_task, events, plannedSessions, tasks]);

  // Pause audio when closing window
  useEffect(() => {
    const handleBeforeUnload = () => {
      globalAudio.pause();
      if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
      const savedIsPlaying = false;
      void saveBeforeUnloadRef.current?.(savedIsPlaying).catch(e=>console.error("No se pudo guardar al cerrar:",e));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const saveBeforeUnloadRef = useRef<((overrideIsPlaying?: boolean, keepTimerActive?: boolean) => Promise<void>) | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestJsonRef = useRef<string | null>(null);
  // Flush síncrono al cerrar/ocultar: si la app se cierra antes del debounce de 300ms
  // (o IDB falla por cuota), el localStorage queda con el ÚLTIMO estado y la carga
  // por "frescura" lo restaura — así las sesiones de estudio nunca se pierden.
  useEffect(() => {
    const flush = () => {
      try {
        if (sessionStorage.getItem('owa_restore_pending')) return;
      } catch { /* noop */ }
      if (latestJsonRef.current) {
        try { localStorage.setItem(STORAGE_KEY, latestJsonRef.current); } catch { /* noop */ }
      }
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
  const closePendingRef=useRef(false),closeApprovedRef=useRef(false);
  useEffect(()=>{
    if(!isTauri())return;
    let disposed=false;let unlisten:(()=>void)|undefined;
    void import('@tauri-apps/api/window').then(async({getCurrentWindow})=>{
      const window=getCurrentWindow();
      const stop=await window.onCloseRequested(async event=>{
        if(closeApprovedRef.current)return;
        event.preventDefault();
        if(closePendingRef.current)return;
        closePendingRef.current=true;
        try {
          globalAudio.pause();setIsTimerActive(false);
          if(debounceTimerRef.current){clearTimeout(debounceTimerRef.current);debounceTimerRef.current=null;}
          await saveBeforeUnloadRef.current?.(false);
          closeApprovedRef.current=true;
          await window.close();
        } catch {
          closeApprovedRef.current=false;
          addNotification('No se pudo guardar el último cambio. La ventana permanece abierta para volver a intentarlo.','error');
        } finally {closePendingRef.current=false;}
      });
      if(disposed)stop();else unlisten=stop;
    }).catch(()=>{});
    return()=>{disposed=true;unlisten?.();};
  },[addNotification]);
  saveBeforeUnloadRef.current = async (overrideIsPlaying?: boolean, keepTimerActive = false) => {
    if (!hydrated) return;
    try { if(sessionStorage.getItem('owa_restore_pending'))return; } catch {}
    // Editors patch latestJsonRef synchronously before the last durable write.
    window.dispatchEvent(new Event('apheka:flush-editors'));
    const raw=latestJsonRef.current;
    if(!raw)return;
    const snapshot=JSON.parse(raw);
    const youtubeDuration=youtubeVideoUrl?generalYtControl.getDuration?.():0,youtubeTime=youtubeVideoUrl?generalYtControl.getTime?.():undefined;
    const liveProgress=youtubeDuration&&youtubeDuration>0&&Number.isFinite(youtubeTime)?Math.max(0,Math.min(1,youtubeTime!/youtubeDuration)):globalAudio.duration && Number.isFinite(globalAudio.duration) && globalAudio.duration>0 ? globalAudio.currentTime/globalAudio.duration : musicProgress;
    const json=JSON.stringify({...snapshot,_savedAt:Date.now(),isTimerActive:keepTimerActive ? isTimerActive : false,isPlayingMusic:overrideIsPlaying ?? isPlayingMusic,musicProgress:liveProgress,musicDuration});
    latestJsonRef.current=json;
    let mirrored=false;
    try {localStorage.setItem(STORAGE_KEY,json);mirrored=localStorage.getItem(STORAGE_KEY)===json;} catch {}
    const writes:Promise<unknown>[]=[set(STORAGE_KEY,json)];
    if(isTauri())writes.push(persistWorkspaceDisk(json));
    const result=await Promise.allSettled(writes);
    if(!mirrored && result.every(r=>r.status==='rejected'))throw new Error('No storage accepted the closing snapshot');
    try {
      localStorage.setItem('owa_current_track_id',currentTrackIdRef.current || '');
      localStorage.setItem('owa_music_progress',String(liveProgress));
      localStorage.setItem('owa_music_duration',String(musicDuration));
    } catch {}
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ TASKS Ã¢â€â‚¬Ã¢â€â‚¬
  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks' | 'files' | 'notes' | 'apuntes' | 'studyTime'> & { notes?: string; apuntes?: string; files?: TaskFile[]; subtasks?: SubTask[] }) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      status: 'inicio',
      subtasks: prepareTaskSteps(taskMinutes(task.estimatedMinutes),task.title,task.subtasks||[]),
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

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; });

  // Refleja en Google Tasks el estado de una tarea vinculada (completar / reactivar)
  async function pushTaskStatusToGoogle(task: Task) {
    if (!googleConnectedRef.current || !task.googleTaskId) return;
    try {
      const { createDefaultList, updateTaskStatus } = await import('../lib/google/tasks');
      const listId = await createDefaultList();
      await updateTaskStatus(listId, task.googleTaskId, task.status === 'completado');
    } catch (e) { console.error('Push task status to Google failed:', e); }
  }

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
    const old=tasksRef.current.find(t=>t.id===id);
    if(!old)return;
    if(updates.estimatedMinutes!==undefined){const estimatedMinutes=taskMinutes(updates.estimatedMinutes),subtasks=prepareTaskSteps(estimatedMinutes,updates.title||old.title,updates.subtasks||old.subtasks);updates={...updates,estimatedMinutes:subtasks.length?subtasks.reduce((sum,s)=>sum+(s.estimatedMinutes||0),0):estimatedMinutes,subtasks};}
    const next={...old,...updates};
    if(updates.status!==undefined && updates.status!==old.status) next.completedAt=updates.status==='completado'?new Date().toISOString():undefined;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, ...(updates.status!==undefined ? {completedAt:next.completedAt} : {}) } : t));
    if(next.course!==old.course || next.status!==old.status) setCourses(prev=>prev.map(c=>{
      const totalDelta=Number(c.name===next.course)-Number(c.name===old.course);
      const doneDelta=Number(c.name===next.course&&next.status==='completado')-Number(c.name===old.course&&old.status==='completado');
      return totalDelta||doneDelta?{...c,totalTasks:Math.max(0,c.totalTasks+totalDelta),completedTasks:Math.max(0,c.completedTasks+doneDelta)}:c;
    }));
    if (updates.status) {
      const current = tasksRef.current.find(t => t.id === id);
      if (current) void pushTaskStatusToGoogle({ ...current, ...updates });
    }
  }, []);

  const deleteTask = useCallback((id: string) => {
    const task=tasksRef.current.find(t=>t.id===id);
    if(!task)return;
    setTasks(prev=>prev.filter(t=>t.id!==id));
    setCourses(pc=>pc.map(c=>c.name===task.course?{...c,totalTasks:Math.max(0,c.totalTasks-1),completedTasks:task.status==='completado'?Math.max(0,c.completedTasks-1):c.completedTasks}:c));
  }, []);

  const toggleTaskStatus = useCallback((id: string) => {
    const current = tasksRef.current.find(t => t.id === id);
    if(!current)return;
    updateTask(id,{status:current.status==='inicio'?'progreso':current.status==='progreso'?'completado':'inicio'});
  }, [updateTask]);

  const addSubTask = useCallback((taskId: string, title: string) => {
    const id=crypto.randomUUID();
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...appendTaskStep(t,{id,title,done:false}) } : t));
  }, []);

  const toggleSubTask = useCallback((taskId: string, subId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) } : t));
  }, []);

  const deleteSubTask = useCallback((taskId: string, subId: string) => {
    setTasks(prev => prev.map(t => {if(t.id!==taskId)return t;const subtasks=t.subtasks.filter(s=>s.id!==subId);return {...t,subtasks,...(subtasks.length&&subtasks.every(s=>s.estimatedMinutes)?{estimatedMinutes:subtasks.reduce((sum,s)=>sum+s.estimatedMinutes!,0)}:{})};}));
  }, []);

  const addTaskFile = useCallback((taskId: string, file: Omit<TaskFile, 'id'>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, files: [...t.files, { ...file, id: Date.now().toString() }] } : t));
  }, []);

  const removeTaskFile = useCallback((taskId: string, fileId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t));
  }, []);

  const incrementTaskStudyTime = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, studyTime: studySeconds(t.studyTime) + 1 } : t));
  }, []);

  // Ã¢â€â‚¬Ã¢â€â‚¬ NOTES Ã¢â€â‚¬Ã¢â€â‚¬
  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // Robustez de escritura: normaliza lo que entra al estado — nunca un título
    // en blanco ni contenido con solo markup/espacios.
    const clean = {
      ...note,
      title: (note.title || '').trim() || 'Sin título',
      content: note.content || '',
      subtitle: (note.subtitle || '').trim(),
    };
    setNotes(prev => [...prev, { ...clean, id, createdAt: now, updatedAt: now }]);
    return id;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev => {
      const note = prev.find(n => n.id === id);
      if (!note) return prev;
      // No re-escribe si nada cambió de verdad (evita updatedAt saltando sin motivo)
      const touches = Object.keys(updates) as (keyof Note)[];
      const unchanged = touches.every(k => String(note[k] ?? '') === String((updates as any)[k] ?? ''));
      if (unchanged) return prev;
      const clean = { ...updates } as Partial<Note>;
      if (clean.title !== undefined) clean.title = (clean.title || '').trim() || 'Sin título';
      if (clean.subtitle !== undefined) clean.subtitle = (clean.subtitle || '').trim();
      return prev.map(n => n.id === id ? { ...n, ...clean, updatedAt: new Date().toISOString() } : n);
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

  const flushNoteContent = useCallback((noteId: string, content: string, title?: string) => {
    try { if (sessionStorage.getItem('owa_restore_pending')) return; } catch {}
    const stamp = new Date().toISOString();
    const clean = normalizeEditorHtml(content || '');
    setNotes(prev => prev.some(n => n.id === noteId) ? prev.map(n => n.id === noteId ? { ...n, content: clean, ...(typeof title === 'string' ? { title: (title || '').trim() || 'Sin título' } : {}), updatedAt: stamp } : n) : prev);
    try {
      const raw = latestJsonRef.current;
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.notes)) return;
      const idx = data.notes.findIndex((n: any) => n && n.id === noteId);
      if (idx === -1) return;
      const updated = { ...data.notes[idx], content: clean, updatedAt: stamp };
      if (typeof title === 'string') updated.title = title;
      data.notes[idx] = updated;
      data._savedAt = Date.now();
      const json = JSON.stringify(data);
      latestJsonRef.current = json;
      try { localStorage.setItem(STORAGE_KEY, json); } catch { }
      try { if (json.length <= 1_000_000) localStorage.setItem('owa_studio_data_backup', json); } catch { }
    } catch { }
  }, []);

  const addNoteFolder = useCallback((folder: Omit<NoteFolder, 'id'>) => {
    const id=crypto.randomUUID();
    setNoteFolders(prev => [...prev, { ...folder, id, sortOrder: prev.length }]);
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
    setNotes(prev=>reorderNoteSubset(prev,noteIds));
  },[]);

  const updateNoteFolder = useCallback((id: string, updates: Partial<NoteFolder>) => {
    setNoteFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const duplicateNote = useCallback((noteId: string): string | null => {
    const original = notes.find(n => n.id === noteId);
    if (!original) return null;
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
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

  // â”€â”€ COURSES â”€â”€
  const addCourse = useCallback((course: Omit<Course, 'id' | 'sortOrder'> & { id?: string }) => {
    const newId = course.id || crypto.randomUUID();
    const cleanItems = (arr: any) => (Array.isArray(arr) ? arr : []).filter((x: any) => !!x && typeof x === 'object');
    setCourses(prev => {
      const newCourse: Course = { ...course, id: newId, sortOrder: prev.length, studyTopics: cleanItems(course.studyTopics), groups: cleanItems(course.groups) };
      return [...prev, newCourse];
    });
    // Keep this outside the state updater: React may evaluate it twice.
    setNoteFolders(pf => pf.some(f=>f.courseId===newId) ? pf : [...pf, { id: `f-${newId}`, name: course.name, color: course.color, courseId: newId, isManual: false }]);
    return newId;
  }, []);

  const updateCourse = useCallback((id: string, updates: Partial<Course>) => {
    const cleanItems = (arr: any) => (Array.isArray(arr) ? arr : []).filter((x: any) => !!x && typeof x === 'object');
    const old=coursesLiveRef.current.find(c=>c.id===id);
    if(!old)return;
    const coverReplaced=!Object.prototype.hasOwnProperty.call(updates,'coverOriginal')&&
      ((Object.prototype.hasOwnProperty.call(updates,'coverUrl')&&updates.coverUrl!==old.coverUrl)||(Object.prototype.hasOwnProperty.call(updates,'coverImage')&&updates.coverImage!==old.coverImage));
    if(updates.name!==undefined||updates.color!==undefined) {
      setTasks(pt=>pt.map(t=>t.course===old.name?{...t,course:updates.name??t.course,courseColor:updates.color??t.courseColor}:t));
      setNotes(pn=>pn.map(n=>n.course===old.name?{...n,course:updates.name??n.course,courseColor:updates.color??n.courseColor}:n));
    }
    setCourses(prev => prev.map(c => c.id === id ? {
        ...c,
        ...(coverReplaced?{coverOriginal:undefined,coverCrop:undefined}:{}),
        ...updates,
        ...(updates.studyTopics !== undefined && { studyTopics: cleanItems(updates.studyTopics) }),
        ...(updates.groups !== undefined && { groups: cleanItems(updates.groups) }),
      } : c));
    if (updates.name || updates.color) {
      setNoteFolders(prev => prev.map(f =>
        f.courseId === id ? { ...f, ...(updates.name && { name: updates.name }), ...(updates.color && { color: updates.color }) } : f
      ));
    }
  }, []);

  const deleteCourse = useCallback((id: string) => {
    const course=coursesLiveRef.current.find(c=>c.id===id);
    if(!course)return;
    setTasks(pt=>pt.filter(t=>t.course!==course.name));
    setNotes(pn=>pn.filter(n=>n.course!==course.name));
    setNoteFolders(pf=>pf.filter(f=>f.courseId!==id));
    setPlannedSessions(ps=>ps.filter(s=>s.courseId!==id));
    setCourses(prev=>prev.filter(c=>c.id!==id));
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ EVENTS Ã¢â€â‚¬Ã¢â€â‚¬
  const addEvent = useCallback((event: Omit<ScheduleEvent, 'id'>) => {
    setEvents(prev => [...prev, { ...event, id: Date.now().toString() }]);
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<ScheduleEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  // â”€â”€ HABITS â”€â”€
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ MUSIC Ã¢â€â‚¬Ã¢â€â‚¬
  // Alta unificada: evita duplicados por ruta original (filePath) o URL.
  // Sin efectos secundarios dentro del updater (StrictMode lo ejecuta dos veces).
  const addTrack = useCallback((track: Omit<Track, 'id'>) => {
    const key = track.filePath || track.url || '';
    if (key) {
      const existing = tracksRef.current.find(t => (t.filePath || t.url || '') === key);
      if (existing) {if(existing.librarySaved===false&&track.librarySaved!==false){const promoted={...existing,librarySaved:true};tracksRef.current=tracksRef.current.map(t=>t.id===existing.id?promoted:t);setTracks(prev=>prev.map(t=>t.id===existing.id?{...t,librarySaved:true}:t));void saveTrackMetadata(promoted).catch(()=>{});}return existing.id;}
    }
    const id = crypto.randomUUID();
    const newTrack: Track = { ...track, ...(track.isFavorite?{librarySaved:true}:{}), id };
    tracksRef.current=[...tracksRef.current,newTrack];
    setTracks(prev => [...prev, newTrack]);
    saveTrackMetadata(newTrack).catch((e: any) => console.error('Error saving track:', e));
    return id;
  }, []);

  // Si cambia el título de una canción local, su archivo en la carpeta propia
  // se renombra igual (solo el título) para que la carpeta siempre refleje
  // los datos. Si el renombrado falla, se conserva la ruta anterior
  // (la canción sigue sonando). `skipRename` es para importaciones masivas:
  // los renombres los hace después "Normalizar nombres" de una vez.
  const updateTrack = useCallback(async (id: string, updates: Partial<Track>, skipRename = false) => {
    const current = tracksRef.current.find(t => t.id === id);
    if (!current) return;
    let updated: Track = { ...current, ...updates,
      ...(updates.isFavorite===true?{librarySaved:true}:updates.librarySaved===false?{isFavorite:false}:{}) };
    const nameChanged =
      !skipRename &&
      current.source === 'local' &&
      (updates.title !== undefined || updates.artist !== undefined) &&
      (updated.title !== current.title || updated.artist !== current.artist);
    if (nameChanged && isTauri()) {
      try {
        const ext = (updated.url || current.url || 'mp3').split('.').pop() || 'mp3';
        const taken = new Set(
          tracksRef.current.filter(t => t.id !== id).map(t => (t.audioFile || '').toLowerCase()).filter(Boolean)
        );
        const fileName = buildAudioFileName(updated.artist, updated.title, ext, taken);
        const oldBase = current.audioFile || (current.url || '').split('/').pop() || '';
        if (fileName && fileName !== oldBase) {
          const newFull = await renameAudioInStorage(oldBase, fileName);
          updated = { ...updated, url: newFull, audioFile: fileName };
        }
      } catch { /* se conserva la ruta anterior */ }
    }
    tracksRef.current=tracksRef.current.map(t=>t.id===id?updated:t);
    setTracks(prev => prev.map(t => t.id === id ? updated : t));
    saveTrackMetadata(updated).catch((e: any) => console.error('Error saving track metadata:', e));
  }, []);

  const deleteTrack = useCallback((id: string) => {
    const doomed = tracksRef.current.find(t => t.id === id);
    if (currentTrackId === id) {
      setCurrentTrackId(null);
      setIsPlayingMusic(false);
      setMusicProgress(0);
      globalAudio.pause();
      globalAudio.src = '';
    }
    setTracks(prev => prev.filter(t => t.id !== id));
    setPlaylists(prev=>prev.map(list=>list.trackIds.includes(id)?{...list,trackIds:list.trackIds.filter(trackId=>trackId!==id)}:list));
    setMusicQueue(prev=>prev.filter(trackId=>trackId!==id));
    if(currentTrackId===id)setYoutubeVideoUrl(null);
    deleteTrackMetadata(id).catch((e: any) => console.error('Error deleting track metadata:', e));
    deleteTrackFileFromDB(id).catch(() => {});
    removeAudioFromStorage(id, doomed?.audioFile).catch(() => {});
  }, [currentTrackId]);

  const toggleTrackFavorite = useCallback((id: string) => {
    const current = tracksRef.current.find(t => t.id === id);
    if (!current) return;
    const updated = { ...current, isFavorite: !current.isFavorite, ...(!current.isFavorite?{librarySaved:true}:{}) };
    tracksRef.current=tracksRef.current.map(track=>track.id===id?updated:track);
    setTracks(prev => prev.map(t => t.id === id ? updated : t));
    saveTrackMetadata(updated).catch((e: any) => console.error('Error saving track metadata:', e));
  }, []);

  // Repair older previews marked as favorites once, without scanning on playback ticks.
  useEffect(()=>{
    if(!hydrated)return;
    const repaired=tracksRef.current.filter(track=>track.isFavorite&&track.librarySaved===false);
    if(!repaired.length)return;
    const ids=new Set(repaired.map(track=>track.id));
    const next=tracksRef.current.map(track=>ids.has(track.id)?{...track,librarySaved:true}:track);
    tracksRef.current=next;setTracks(next);
    for(const track of next)if(ids.has(track.id))void saveTrackMetadata(track).catch(()=>{});
  },[hydrated]);

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
        // Phase 1: Loading/Reading file (ONCE â€” avoid Windows Defender collisions)
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

        // Phase 4: Save to storage (use pre-read buffer â€” no extra disk I/O)
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

  // Normaliza rutas Windows ("C:\x\y.mp3" -> "C:/x/y.mp3"): el asset protocol
  // y el reproductor fallan con backslashes codificados (%5C).
  const normalizeLocalPath = (p: string): string => p.replace(/\\/g, '/');

  // --- Zero-copy: folder scan for audio files ---
  // Devuelve tracks SIN guardar (el llamador persiste una sola vez).
  // Límites anti-cuelgue: profundidad 8, máximo 2000 archivos.
  const scanFolderForAudio = useCallback(async (folderPath: string): Promise<Track[]> => {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'opus', 'mp4', 'aiff', 'ape']);
    const found: Track[] = [];
    const seenPaths = new Set(tracksRef.current.map(t => normalizeLocalPath(t.filePath || t.url || '')));
    const MAX_FILES = 2000;
    const MAX_DEPTH = 8;

    async function scan(dir: string, depth: number) {
      if (depth > MAX_DEPTH || found.length >= MAX_FILES) return;
      let entries;
      try {
        entries = await readDir(dir);
      } catch { return; /* ignore read errors */ }
      for (const entry of entries) {
        if (found.length >= MAX_FILES) return;
        const fullPath = normalizeLocalPath(`${dir}/${entry.name}`);
        if (entry.isDirectory) {
          await scan(fullPath, depth + 1);
        } else if (entry.isFile) {
          const ext = fullPath.split('.').pop()?.toLowerCase();
          if (ext && AUDIO_EXTS.has(ext) && !seenPaths.has(fullPath)) {
            seenPaths.add(fullPath);
            try {
              const meta = await extractAudioMetadata(fullPath);
              found.push({
                id: crypto.randomUUID(),
                title: meta.title || fullPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown',
                artist: meta.artist || '',
                duration: Math.round(meta.duration || 0),
                source: 'local',
                url: fullPath,
                coverImage: meta.coverUrl || undefined,
                isFavorite: false,
                listenedTime: 0,
                filePath: fullPath,
              });
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    }

    await scan(normalizeLocalPath(folderPath), 0);
    return found;
  }, []);

  // Recorrido RÁPIDO (sin metadata) para saber el total antes de importar:
  // alimenta la pantalla de carga con el número real de canciones.
  const collectAudioFiles = useCallback(async (folderPath: string): Promise<string[]> => {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'opus', 'mp4', 'aiff', 'ape']);
    const out: string[] = [];
    const MAX_FILES = 2000;
    const MAX_DEPTH = 8;
    async function walk(dir: string, depth: number) {
      if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
      let entries;
      try {
        entries = await readDir(dir);
      } catch { return; }
      for (const entry of entries) {
        if (out.length >= MAX_FILES) return;
        const fullPath = normalizeLocalPath(`${dir}/${entry.name}`);
        if (entry.isDirectory) await walk(fullPath, depth + 1);
        else if (entry.isFile && AUDIO_EXTS.has(fullPath.split('.').pop()?.toLowerCase() || '')) out.push(fullPath);
      }
    }
    await walk(normalizeLocalPath(folderPath), 0);
    return out;
  }, []);

  // --- Zero-copy: check if local file still exists ---
  const checkLocalFileExists = useCallback(async (track: Track): Promise<boolean> => {
    const p = track.filePath || track.url;
    if (!p || track.source !== 'local') return track.source !== 'local';
    try {
      const { stat } = await import('@tauri-apps/plugin-fs');
      await stat(normalizeLocalPath(p));
      return true;
    } catch {
      return false;
    }
  }, []);

  // --- Borrar duplicados: misma ruta/URL o mismo título+artista+duración ---
  // Conserva la primera aparición (la más antigua en la biblioteca).
  const removeDuplicateTracks = useCallback(async (): Promise<number> => {
    const all = tracksRef.current;
    if (all.length < 2) return 0;
    const normStr = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const seenPath = new Set<string>();
    const seenContent = new Set<string>();
    const dupIds = new Set<string>();
    for (const t of all) {
      const pathKey = normalizeLocalPath(t.filePath || t.url || '').toLowerCase();
      const contentKey = `${normStr(t.title || '')}|${normStr(t.artist || '')}|${Math.round((t.duration || 0) / 2)}`;
      if ((pathKey && seenPath.has(pathKey)) || (t.title && seenContent.has(contentKey))) {
        dupIds.add(t.id);
        continue;
      }
      if (pathKey) seenPath.add(pathKey);
      if (t.title) seenContent.add(contentKey);
    }
    if (dupIds.size === 0) return 0;
    setTracks(prev => prev.filter(t => !dupIds.has(t.id)));
    setMusicQueue(prev => prev.filter(id => !dupIds.has(id)));
    for (const id of dupIds) {
      deleteTrackMetadata(id).catch(() => {});
      deleteTrackFileFromDB(id).catch(() => {});
    }
    addNotification(`${dupIds.size} ${dupIds.size === 1 ? 'duplicado eliminado' : 'duplicados eliminados'}`, 'success');
    return dupIds.size;
  }, []);

  // --- Limpieza de faltantes: verifica la ruta REPRODUCIBLE (url = copia gestionada) ---
  // Usa tracksRef (siempre fresco) en vez del closure: evita purgas con datos viejos.
  // No se mira filePath (el original puede haberse movido sin que importe: la copia sigue).
  const cleanupMissingLocalFiles = useCallback(async () => {
    const all = tracksRef.current;
    const localTracks = all.filter(t => t.source === 'local' && t.url);
    if (localTracks.length === 0) return { removed: 0 };

    const goneIds = new Set<string>();
    for (const track of localTracks) {
      try {
        const { stat } = await import('@tauri-apps/plugin-fs');
        await stat(normalizeLocalPath(track.url!));
      } catch {
        goneIds.add(track.id);
      }
    }

    if (goneIds.size > 0) {
      setTracks(prev => prev.filter(t => !goneIds.has(t.id)));
      for (const id of goneIds) {
        deleteTrackMetadata(id).catch(() => {});
      }
      addNotification(`${goneIds.size} ${goneIds.size === 1 ? 'canción eliminada (archivo no encontrado)' : 'canciones eliminadas (archivo no encontrado)'}`, 'info');
    }

    return { removed: goneIds.size };
  }, [checkLocalFileExists]);

  // --- Alta local con COPIA a la carpeta propia (máxima fiabilidad) ---
  // Cada archivo se lee UNA vez a RAM y con ese mismo buffer se extrae metadata,
  // se copia a la carpeta de música de la app y se guarda el blob en IndexedDB.
  // La reproducción NUNCA depende del asset protocol ni de que el original siga
  // existiendo: `url` apunta siempre a la copia gestionada. `filePath` conserva
  // la ruta original como referencia (dedup + metadatos). Si la copia falla, se
  // conserva la referencia zero-copy como fallback para no perder la canción.
  // Reporta progreso a importState para la pantalla de carga.
  const importLocalZeroCopy = useCallback(async (paths: string[], isFolder = false): Promise<number> => {
    if (!paths || paths.length === 0) return 0;

    const norm = paths.map(p => normalizeLocalPath(p));
    // Lista plana de archivos: en carpetas se recorre primero (rápido, sin metadata)
    // para conocer el total real y mostrar la pantalla de carga.
    let fileList: string[] = [];
    if (isFolder) {
      for (const folder of norm) {
        const found = await collectAudioFiles(folder);
        fileList.push(...found);
      }
    } else {
      fileList = norm;
    }
    if (fileList.length === 0) return 0;

    const known = new Set(tracksRef.current.map(t => normalizeLocalPath(t.filePath || t.url || '')));
    const fresh = fileList.filter(p => !known.has(p));
    // Archivos ya conocidos: se marcan como vistos para no reimportarlos.
    fresh.forEach(p => known.add(p));
    const total = fresh.length;

    setImportState({ active: true, current: 0, total, fileName: '', phase: 'loading_file', phaseProgress: 0, overallProgress: 0 });
    const newTracks: Track[] = [];
    // Nombres ocupados en la carpeta propia (evita choques "Artista - Título").
    const takenNames = new Set(
      tracksRef.current.map(t => (t.audioFile || (t.url || '').split('/').pop() || '').toLowerCase()).filter(Boolean)
    );
    try {
      for (let i = 0; i < fresh.length; i++) {
        const path = fresh[i];
        const name = path.split('/').pop() || 'Unknown';
        const pct = Math.round((i / Math.max(1, total)) * 100);
        setImportState(prev => ({ ...prev, current: i + 1, fileName: name, phase: 'extracting_metadata', phaseProgress: pct, overallProgress: pct }));
        try {
          // 1) Leer UNA vez (con reintento: Windows Defender puede bloquear el 1er intento)
          let fileData: Uint8Array | undefined;
          for (let attempt = 0; attempt < 2 && !fileData; attempt++) {
            try {
              const raw = await readFile(path);
              if (raw && raw.length > 0) fileData = raw instanceof Uint8Array ? raw : new Uint8Array(raw as any);
            } catch {
              if (attempt === 0) await new Promise(r => setTimeout(r, 400));
            }
          }
          if (!fileData) throw new Error('No se pudo leer el archivo');
          // 2) Metadata con el buffer ya leído (sin re-leer ni fetch en cascada).
          // Títulos/artistas normalizados: sin espacios dobles, primera letra en mayúscula.
          const meta = await extractAudioMetadata(path, fileData);
          const title = toDisplayName(meta.title || name.replace(/\.[^/.]+$/, '')) || 'Sin título';
          const artist = toDisplayName(meta.artist || '');
          const id = crypto.randomUUID();
          // 3) Copia gestionada a la carpeta propia con nombre legible
          // "Artista - Título.ext" (esta es la que se reproduce).
          const ext = (path.split('.').pop() || 'mp3').toLowerCase();
          const fileName = buildAudioFileName(artist, title, ext, takenNames);
          let storedPath = path;
          let storedFile: string | undefined;
          try {
            storedPath = await copyAudioToStorage(path, id, fileData, fileName);
            storedFile = fileName;
          } catch {
            storedPath = path; // fallback: referencia al original
          }
          // 4) Blob en IndexedDB para reproducción instantánea
          try {
            await storeTrackFileInDB(id, path, fileData);
          } catch { /* el blob es optimización, no crítico */ }
          newTracks.push({
            id,
            title,
            artist,
            duration: Math.round(meta.duration || 0),
            source: 'local',
            url: storedPath,
            coverImage: meta.coverUrl || undefined,
            isFavorite: false,
            listenedTime: 0,
            filePath: path,
            audioFile: storedFile,
          });
        } catch (err) {
          console.error('Error importing:', path, err);
        }
      }
      if (newTracks.length > 0) {
        setImportState(prev => ({ ...prev, phase: 'saving_to_db', phaseProgress: 50, overallProgress: 95 }));
        setTracks(prev => [...prev, ...newTracks]);
        for (const track of newTracks) {
          await saveTrackMetadata(track).catch(() => {});
        }
      }
      return newTracks.length;
    } finally {
      setImportState({ active: false, current: total, total, fileName: '', phase: 'finished', phaseProgress: 100, overallProgress: 100 });
    }
  }, [collectAudioFiles]);

  // --- Normaliza nombres de la carpeta propia a "Artista - Título.ext" ---
  // Una sola vez (flag local): renombra copias legacy `<id>.ext` o con nombre
  // distinto a los datos actuales. Nunca borra audio: si el renombrado falla,
  // la canción conserva su ruta anterior y sigue sonando.
  const normalizeMusicFilenames = useCallback(async (): Promise<number> => {
    if (!isTauri()) return 0;
    let fixed = 0;
    try {
      const musicDir = await getMusicDir();
      const taken = new Set(
        tracksRef.current.map(t => (t.audioFile || (t.url || '').split('/').pop() || '').toLowerCase()).filter(Boolean)
      );
      for (const t of tracksRef.current) {
        if (t.source !== 'local' || !t.url) continue;
        // Mayúsculas/minúsculas donde corresponden (solo si viene todo en un caso).
        const newTitle = toDisplayName(t.title) || t.title;
        const newArtist = toDisplayName(t.artist);
        const normUrl = normalizeLocalPath(t.url);
        const normDir = normalizeLocalPath(musicDir);
        if (!normUrl.toLowerCase().startsWith(normDir.toLowerCase() + '/')) {
          // Fuera de la carpeta propia: solo corrige el casing de los datos.
          if (newTitle !== t.title || newArtist !== t.artist) {
            const updated: Track = { ...t, title: newTitle, artist: newArtist };
            setTracks(prev => prev.map(x => x.id === t.id ? updated : x));
            await saveTrackMetadata(updated).catch(() => {});
            fixed++;
          }
          continue;
        }
        const currentBase = normUrl.split('/').pop() || '';
        if (!currentBase) continue;
        const ext = (currentBase.split('.').pop() || 'mp3').toLowerCase();
        const takenWithoutSelf = new Set([...taken].filter(x => x !== currentBase.toLowerCase()));
        const wanted = buildAudioFileName(newArtist, newTitle, ext, takenWithoutSelf);
        const casingChanged = newTitle !== t.title || newArtist !== t.artist;
        if (wanted.toLowerCase() === currentBase.toLowerCase()) {
          if (!t.audioFile || casingChanged) {
            const updated: Track = { ...t, title: newTitle, artist: newArtist, audioFile: currentBase };
            setTracks(prev => prev.map(x => x.id === t.id ? updated : x));
            saveTrackMetadata(updated).catch(() => {});
            if (casingChanged) fixed++;
          }
          continue;
        }
        try {
          const newFull = await renameAudioInStorage(currentBase, wanted);
          taken.delete(currentBase.toLowerCase());
          taken.add(wanted.toLowerCase());
          const updated: Track = { ...t, title: newTitle, artist: newArtist, url: newFull, audioFile: wanted };
          setTracks(prev => prev.map(x => x.id === t.id ? updated : x));
          await saveTrackMetadata(updated).catch(() => {});
          fixed++;
        } catch { /* conserva la ruta anterior */ }
      }
    } catch { /* noop */ }
    return fixed;
  }, []);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    try {
      // v2 = convención solo-Título (v1 era "Artista - Título").
      if (localStorage.getItem('owa_music_filenames_v2') === '1') return;
    } catch { return; }
    normalizeMusicFilenames()
      .then(n => {
        try { localStorage.setItem('owa_music_filenames_v2', '1'); } catch { /* noop */ }
        if (n > 0) addNotification(`${n} ${n === 1 ? 'archivo de música renombrado' : 'archivos de música renombrados'} a solo título`, 'success');
      })
      .catch(() => {
        try { localStorage.setItem('owa_music_filenames_v2', '1'); } catch { /* noop */ }
      });
  }, [hydrated, normalizeMusicFilenames]);

   const playTrack = useCallback((id: string, preserveQueue = false) => {
    if(settings.musicOffline&&!canPlayOffline(tracksRef.current.find(track=>track.id===id))){addNotification('La reproducción online está desactivada. Puedes usar tu biblioteca local.','info');return;}
    repeatOnePlayedRef.current = false;
    // Same track already loaded â€” just resume (no reload)
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
      // Source invalid or not ready â€” force a full reload
      loadedTrackIdRef.current = null;
      loadingTrackIdRef.current = null;
    }

    // Same track currently being loaded async â€” just mark to auto-play
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
    setMusicProgress(restoreSeekRef.current ?? 0);
    setMusicDuration(0);
    try { localStorage.setItem('owa_current_track_id', id); } catch {}

    const track = tracksRef.current.find(t => t.id === id);
    if (!track || !track.url) {
      setYoutubeVideoUrl(null);
      return;
    }

    // YouTube â†’ ReactPlayer
    if (!track.localAudioPath && (track.url.includes('youtube.com/') || track.url.includes('youtu.be/'))) {
      if (!globalAudio.paused) globalAudio.pause();
      globalAudio.removeAttribute('src');globalAudio.load();
      const resolvedUrl=resolvedYouTubeUrl(track.url);
      generalYtControl.pendingSeek=restoreSeekRef.current!==null?{url:resolvedUrl,ratio:restoreSeekRef.current}:undefined;
      restoreSeekRef.current=null;
      setYoutubeVideoUrl(resolvedUrl);
      generalYtControl.restorePosition?.();
      // La canción online también participa de la lógica de cola: si no hay
      // cola se construye una con el contexto actual (barajada si el modo
      // aleatorio está activo) para que las flechas anterior/siguiente y el
      // fin de canción naveguen por el resto de canciones.
      setMusicQueue(prev => {
        const remaining=prev.filter(tid=>tid!==id&&tracksRef.current.some(t=>t.id===tid));
        if(preserveQueue||remaining.length)return remaining;
        const pool=shuffleModeRef.current?radioTracks(tracksRef.current,queueSourceRef.current?.pool).map(t=>t.id):(queueSourceRef.current?.pool??tracksRef.current.filter(isLibraryTrack).map(t=>t.id));
        return shuffleModeRef.current?weightedShuffle(pool.filter(tid=>tid!==id),playCountsRef.current):pool.slice(pool.indexOf(id)+1).filter(tid=>tid!==id);
      });
      if (resumeStayPausedRef.current) {
        resumeStayPausedRef.current = false;
        setIsPlayingMusic(false);
      } else {
        setIsPlayingMusic(true);
      }
      setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
      setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      loadedTrackIdRef.current = null;
      loadingTrackIdRef.current = null;
      if (resumeStayPausedRef.current) {
        resumeStayPausedRef.current = false;
      } else {
        // Play síncrono: si el iframe ya está listo, arrancar sin esperar el re-render
        try { generalYtControl.playVideo?.(); } catch { /* noop */ }
      }
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

        if (track.source === 'local' || track.localAudioPath) {
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

          // Strategy 2: readFile + Blob URL (fiable: no depende del asset
          // protocol; la copia gestionada siempre existe en la carpeta propia).
          const localPath = normalizeLocalPath(track.localAudioPath||track.url);
          if (!srcUrl) {
            try {
              const data = await readFile(localPath);
              if (loadingTrackIdRef.current !== id) {
                if (srcUrl?.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
                return;
              }
              if (data && data.length > 100) {
                const ext = (track.localAudioPath||track.url).split('.').pop()?.toLowerCase() || '';
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
              console.warn('[Audio] readFile failed:', readErr);
            }
          }

          // Strategy 3 (último recurso): convertFileSrc (streaming). La ruta se
          // normaliza a slashes: los backslashes de Windows rompen el asset protocol.
          if (!srcUrl) {
            try {
              srcUrl = convertFileSrc(localPath);
              if (!srcUrl) srcUrl = null;
            } catch {
              srcUrl = null;
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
              // Not enough data yet â€” canplay handler will retry
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
      const after = prev.filter(tid => tid !== id&&(!shuffleModeRef.current||tracksRef.current.some(t=>t.id===tid&&isLibraryTrack(t))));
      if (preserveQueue || after.length >= 5) return after;
      const history = trackHistoryRef.current;
      const pool = shuffleModeRef.current?radioTracks(tracksRef.current,queueSourceRef.current?.pool).map(t=>t.id):(queueSourceRef.current?.pool ?? tracksRef.current.filter(isLibraryTrack).map(t => t.id));
      // 85% distance: exclude history entries until most of pool is played
      const threshold = Math.floor(pool.length * 0.85);
      const excludeIds = new Set(history.length < threshold ? history : []);
      excludeIds.add(id);
      const available = pool.filter(tid => !excludeIds.has(tid) && !after.includes(tid));
      if (shuffleModeRef.current) {
        const shuffled = weightedShuffle(available, playCountsRef.current);
        return [...after, ...shuffled];
      }
      const currentIdx = pool.indexOf(id);
      const ordered = pool.slice(currentIdx + 1)
        .filter(tid => !excludeIds.has(tid) && !after.includes(tid));
      return [...after, ...ordered];
    });

    setTrackHistory(prev => [id, ...prev.filter(tid => tid !== id)].slice(0, 50));
    setPlayCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, [tracks, currentTrackId, currentTrackStartTime, setTrackPlayDurations, setIsPlayingMusic, setTrackHistory, setPlayCounts,settings.musicOffline,addNotification]);
  playTrackRef.current = playTrack;

  const toggleMusicPlayback = useCallback(() => {
    const cid = currentTrackIdRef.current;
    const track = cid ? tracksRef.current.find(t => t.id === cid) : null;
    
    if (!track && tracksRef.current.some(isLibraryTrack)) {
      const first=shuffleModeRef.current?libraryRadioOrder(radioTracks(tracksRef.current,queueSourceRef.current?.pool),null,trackHistoryRef.current,playCountsRef.current,playbackSettingsRef.current.musicOffline)[0]:tracksRef.current.find(isLibraryTrack)?.id;
      if(first)playTrackRef.current(first);
      return;
    }
    if (!track) return;

    const isYT = !track.localAudioPath && (track.url?.includes('youtube.com/') || track.url?.includes('youtu.be/'));
    if (isYT) {
      if (!youtubeVideoUrl) setYoutubeVideoUrl(track.url!);
      const togglingTo = !isPlayingMusicRef.current;
      setIsPlayingMusic(togglingTo);
      // Play/Pausa SÍNCRONOS sobre el iframe: sin esperar el re-render de React,
      // la pausa/reanudación es instantánea incluso pulsando varias veces seguidas
      try {
        if (togglingTo) generalYtControl.playVideo?.();
        else generalYtControl.pauseVideo?.();
      } catch { /* noop */ }
      return;
    }

    const audio = globalAudio;
    const hasSrc = !!audio.src;

    if (!hasSrc || audio.ended) {
      // Audio has no source or ended â€” (re)load and play
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
      // Audio still loading â€” defer to canplay
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
    // Si la pista actual es de la NUBE (YouTube), el seek va al iframe del
    // reproductor general (motor YT imperativo), NUNCA al <audio> local.
    if (youtubeVideoUrl) {
      if (generalYtControl.seekTo) generalYtControl.seekTo(progress);
      return;
    }
    if (globalAudio.duration && isFinite(progress)) {
      globalAudio.currentTime = progress * globalAudio.duration;
    }
  }, [youtubeVideoUrl]);

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

  useEffect(()=>{if(settings.musicOffline&&currentTrackId&&!canPlayOffline(tracksRef.current.find(t=>t.id===currentTrackId)))clearCurrentTrack();},[settings.musicOffline,currentTrackId,clearCurrentTrack]);

  const setMusicVolumeCb = useCallback((volume: number) => {
    setMusicVolume(volume);
    globalAudio.volume = volume;
  }, []);

  // Music audio engine: init events
  useEffect(() => {
    globalAudio.volume = musicVolume;
    const audio = globalAudio;

    let publishedSecond = -1;
    const publishProgress = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      publishedSecond = Math.floor(audio.currentTime);
      setMusicProgress(Math.max(0, Math.min(1, audio.currentTime / audio.duration)));
    };
    const onTimeUpdate = () => {
      // The shared context also renders courses, notes and the music library.
      // Publish the clock once per second; seeks and pauses remain immediate.
      if (Math.floor(audio.currentTime) !== publishedSecond) publishProgress();
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
      const result=nextMusicSelection({tracks:tracksRef.current,currentId:currentTrackIdRef.current,queue:musicQueueRef.current,sourcePool:queueSourceRef.current?.pool,shuffle:shuffleModeRef.current,repeat:repeatModeRef.current,history:trackHistoryRef.current,counts:playCountsRef.current,offline:playbackSettingsRef.current.musicOffline});
      if(result.id===currentTrackIdRef.current&&result.id){globalAudio.currentTime=0;void globalAudio.play().catch(()=>setIsPlayingMusic(false));return;}
      musicQueueRef.current=result.queue;setMusicQueue(result.queue);
      if(result.id){playTrackRef.current(result.id,true);if(coverModalTrackIdRef.current)setCoverModalTrackId(result.id);}else {globalAudio.pause();setIsPlayingMusic(false);}
    };
    const recovery=new PlaybackRecovery();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const onError = () => {
      const cid = currentTrackIdRef.current;
      if (!cid) { setIsPlayingMusic(false); return; }
      const decision=recovery.failure(cid,globalAudio.error?.code||0,playbackSettingsRef.current.autoRetryOnError!==false);
      if(decision.action==='ignore')return;
      if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}
      if (decision.action==='retry') {
        const delay=decision.delay!;
        retryTimer = setTimeout(() => {
          if (currentTrackIdRef.current === cid && isPlayingMusicRef.current) {
            globalAudio.load();
            globalAudio.play().catch(() => {});
          }
        }, delay);
      } else {
        loadedTrackIdRef.current = null;
        loadingTrackIdRef.current=null;
        autoPlayRef.current=false;
        setIsAudioLoading(false);
        setIsPlayingMusic(false);
        const nextInQueue = musicQueueRef.current?.find(id=>recovery.canAdvance(id)&&tracksRef.current.some(t=>t.id===id&&(!playbackSettingsRef.current.musicOffline||canPlayOffline(t))));
        if (nextInQueue) {
          playTrackRef.current?.(nextInQueue);
        }else{
          globalAudio.pause();
          addNotification('La reproducción se detuvo porque las pistas no están disponibles. Revisa la conexión o el archivo antes de continuar.','error');
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
      publishProgress();
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
      publishProgress();
      if (!currentTrackStartTimeRef.current) {
        setCurrentTrackStartTime(Date.now() / 1000);
      }
      setIsPlayingMusic(true);
    };

    const onPlaying=()=>{recovery.played();if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}};
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('seeked', publishProgress);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('pause', onPauseExternal);
    audio.addEventListener('play', onPlayExternal);
    audio.addEventListener('playing',onPlaying);

    // sync state when tab becomes visible again (lid open, tab switch)
    const onVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden â†’ save listening time, pause audio
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
        // Tab visible again â€” resume if we were playing
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
      audio.removeEventListener('seeked', publishProgress);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('pause', onPauseExternal);
      audio.removeEventListener('play', onPlayExternal);
      audio.removeEventListener('playing',onPlaying);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, []);

  // Ã¢â€â‚¬Ã¢â€â‚¬ STUDY SESSIONS Ã¢â€â‚¬Ã¢â€â‚¬
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
    if(session.taskId && session.taskId===activeTaskIdRef.current && !session.taskTitle) {
      session={...session,subtaskId:activeSubtaskIdRef.current || undefined,taskTitle:linkedStudyTitle(tasksRef.current.find(t=>t.id===session.taskId),activeSubtaskIdRef.current)};
    }
    const key = `${session.type}-${session.taskId || session.plannedSessionId || "free"}-${session.subtaskId || ""}-${session.duration}-${Math.floor(Date.now() / 2000)}`;
    if (key === lastSessionKeyRef.current) return null;
    lastSessionKeyRef.current = key;
    // Anti-duplicados real: solo hay UN temporizador activo, así que dos registros
    // del mismo origen (tarea/sesión planificada y mismo tipo normal/distracción)
    // que se SOLAPAN en el tiempo son el mismo estudio registrado dos veces.
    // Las rutas de distracción (pausa>10min por blur Y por reanudación del timer)
    // podían dispararse ambas para una misma ausencia y crear el duplicado.
    const nFlag = session.isDistraction ? 'd' : 'r';
    const nStart = new Date(session.startedAt).getTime();
    const nEnd = nStart + (session.duration || 0) * 1000;
    if (isFinite(nStart)) {
      const dup = (studySessions || []).find(s => {
        if (!s || !s.startedAt) return false;
        if ((s.isDistraction ? 'd' : 'r') !== nFlag) return false;
        if ((s.type === 'break') !== (session.type === 'break')) return false;
        if ((s.taskId ?? '') !== (session.taskId ?? '')) return false;
        if (((s as any).plannedSessionId ?? '') !== ((session as any).plannedSessionId ?? '')) return false;
        const sStart = new Date(s.startedAt).getTime();
        if (!isFinite(sStart)) return false;
        const sEnd = sStart + (s.duration || 0) * 1000;
        return sStart < nEnd - 60000 && nStart < sEnd - 60000;
      });
      if (dup) return dup.id;
    }
    const id = Date.now().toString();
    const newSession = { ...session, id };
    setStudySessions(prev => {
      const updated = [...prev, newSession];
      return updated;
    });
    setTimeout(() => recalcDailyPerformance(new Date().toISOString().slice(0, 10)), 0);
    return id;
  }, [studySessions, settings.dailyGoal, settings.studyGoals]);
  addStudySessionRef.current = addStudySession;

  const updateStudySession = useCallback((id: string, updates: Partial<StudySession>) => {
    setStudySessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setTimeout(() => recalcDailyPerformance(new Date().toISOString().slice(0, 10)), 0);
  }, []);

  const deleteStudySession = useCallback((id: string) => {
    setStudySessions(prev => prev.filter(s => s.id !== id));
    setTimeout(() => recalcDailyPerformance(new Date().toISOString().slice(0, 10)), 0);
  }, []);

  // Auditoría ligera de cambios en sesiones planificadas: permite diagnosticar
  // cualquier borrado/ocultación "misteriosa" (owa_session_audit_v1, máx 100).
  const auditPlannedSession = useCallback((action: string, s: PlannedSession | { id: string; date?: string; courseId?: string; title?: string }) => {
    try {
      const key = 'owa_session_audit_v1';
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      const list = (Array.isArray(arr) ? arr : []).slice(-99);
      list.push({ at: new Date().toISOString(), action, id: s.id, date: s.date, courseId: s.courseId, title: s.title });
      localStorage.setItem(key, JSON.stringify(list));
    } catch { /* noop */ }
  }, []);

  const addPlannedSession = useCallback((session: Omit<PlannedSession, 'id' | 'createdAt'>) => {
    const id = `planned_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newSession: PlannedSession = { ...session, id, createdAt: new Date().toISOString() };
    setPlannedSessions(prev => [...prev, newSession]);
    // Marca la última sesión creada/editada para que el cronograma de Cursos
    // salte a su día (la sesión recién creada se ve SIEMPRE al instante).
    try { localStorage.setItem('owa_last_planned_session', JSON.stringify({ id, date: newSession.date, courseId: newSession.courseId })); } catch { /* noop */ }
    auditPlannedSession('add', newSession);
  }, [auditPlannedSession]);

  const updatePlannedSession = useCallback((id: string, updates: Partial<PlannedSession>) => {
    setPlannedSessions(prev => {
      const target = prev.find(s => s.id === id);
      if (target) {
        const next = { ...target, ...updates };
        if (updates.date || updates.courseId || updates.title) {
          try { localStorage.setItem('owa_last_planned_session', JSON.stringify({ id, date: next.date, courseId: next.courseId })); } catch { /* noop */ }
        }
        auditPlannedSession('update', next);
        return prev.map(s => s.id === id ? next : s);
      }
      return prev;
    });
  }, [auditPlannedSession]);

  const deletePlannedSession = useCallback((id: string) => {
    setPlannedSessions(prev => {
      const target = prev.find(s => s.id === id);
      if (target) auditPlannedSession('delete', target);
      return prev.filter(s => s.id !== id);
    });
  }, [auditPlannedSession]);

  const reorderPlannedSessions = useCallback((orderedIds: string[]) => {
    setPlannedSessions(prev => {
      const byId = new Map(prev.map(s => [s.id, s]));
      const reordered: PlannedSession[] = [];
      orderedIds.forEach((id, i) => {
        const s = byId.get(id);
        if (s) reordered.push({ ...s, sortOrder: i });
      });
      const rest = prev.filter(s => !orderedIds.includes(s.id));
      return [...reordered, ...rest];
    });
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

  // Update refs and persistence in the same action, before another click/timer tick.
  const commitTimerLink = useCallback((taskId: string | null, sessionId: string | null, subtaskId: string | null = null) => {
    timerLinkRevision.current++;
    const record = { activeTaskId: taskId, activeSubtaskId: taskId ? subtaskId : null, activePlannedSessionId: sessionId, updatedAt: Date.now() };
    activeTaskIdRef.current = taskId;
    activeSubtaskIdRef.current = record.activeSubtaskId;
    setActiveSubtaskId(record.activeSubtaskId);
    activePlannedSessionIdRef.current = sessionId;
    setActiveTaskId(taskId);
    setActivePlannedSessionId(sessionId);
    try {
      localStorage.removeItem('owa_study_task_id');
      localStorage.removeItem('owa_study_task_title');
      localStorage.setItem('owa_timer_link_v1', JSON.stringify(record));
    } catch { /* IndexedDB fallback below. */ }
    timerLinkWrites.current = timerLinkWrites.current.catch(() => {}).then(() => set('owa_timer_link_v1', record)).catch(() => {
      let mirrored = false;
      try { mirrored = localStorage.getItem('owa_timer_link_v1') === JSON.stringify(record); } catch {}
      if (!mirrored) addNotification('No se pudo guardar el vínculo de Estudio.', 'error');
    });
  }, [addNotification]);
  const linkTaskToTimer = useCallback((taskId: string, subtaskId?: string) => {
    const unavailable = taskLinkUnavailable(tasksRef.current.find(t => t.id === taskId));
    if (unavailable) { addNotification(unavailable, 'info'); return; }
    if (subtaskId) {
      const sub=tasksRef.current.find(t=>t.id===taskId)?.subtasks.find(s=>s.id===subtaskId);
      if (!sub || sub.done || !sub.title.trim()) {addNotification("Esta subtarea no está disponible para estudiar.","info");return;}
    }
    const next = changeTimerLink({ activeTaskId: activeTaskIdRef.current,
 activePlannedSessionId: activePlannedSessionIdRef.current }, 'task', taskId);
    commitTimerLink(next.activeTaskId, next.activePlannedSessionId, subtaskId || null);
  }, [commitTimerLink, addNotification]);
  const unlinkTaskFromTimer = useCallback(() => {
    commitTimerLink(null, activePlannedSessionIdRef.current);
  }, [commitTimerLink]);
  const linkPlannedSessionToTimer = useCallback((id: string) => {
    const candidate = plannedSessions.find(s => s.id === id);
    const unavailable = sessionLinkUnavailable(candidate) || (candidate && !courses.some(c => c.id === candidate.courseId) ? 'El curso de esta sesión ya no existe.' : null);
    if (unavailable) { addNotification(unavailable, 'info'); return; }
    const next = changeTimerLink({ activeTaskId: activeTaskIdRef.current,
 activePlannedSessionId: activePlannedSessionIdRef.current }, 'session', id);
    commitTimerLink(next.activeTaskId, next.activePlannedSessionId);
  }, [commitTimerLink, plannedSessions, courses, addNotification]);
  const unlinkPlannedSessionFromTimer = useCallback(() => {
    commitTimerLink(activeTaskIdRef.current, null, activeSubtaskIdRef.current);
  }, [commitTimerLink]);

  // Discard orphaned links only after the real library has finished loading.
  useEffect(() => {
    if (!hydrated || !timerLinkHydrated) return;
    const taskId = activeTaskId && tasks.some(t => t.id === activeTaskId) ? activeTaskId : null;
    const sessionId = activePlannedSessionId && plannedSessions.some(s => s.id === activePlannedSessionId) ? activePlannedSessionId : null;
    const subtaskId = taskId && tasks.find(t=>t.id===taskId)?.subtasks.some(s=>s.id===activeSubtaskId && !s.done) ? activeSubtaskId : null;
    if (taskId !== activeTaskId || sessionId !== activePlannedSessionId || subtaskId !== activeSubtaskId) commitTimerLink(taskId, sessionId, subtaskId);
  }, [hydrated, timerLinkHydrated, tasks, plannedSessions, activeTaskId, activeSubtaskId, activePlannedSessionId, commitTimerLink]);

  const navigateToCourse = useCallback((courseId: string, groupId?: string, topicId?: string) => {
    setCourseDeepLink({ courseId, groupId, topicId });
    setNavigateTo('curso_detalle' as ViewId);
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

  const startSubtaskStudy = useCallback((taskId:string,subtaskId:string):boolean => {
    const task=tasksRef.current.find(t=>t.id===taskId);
    const sub=task?.subtasks.find(s=>s.id===subtaskId);
    const unavailable=taskLinkUnavailable(task);
    if(unavailable || !sub || sub.done || !sub.title.trim()){addNotification(unavailable || 'Esta subtarea no está disponible para estudiar.','info');return false;}
    if(activeTaskIdRef.current===taskId && activeSubtaskIdRef.current===subtaskId && !isRestRef.current){setIsTimerActive(true);return true;}
    const elapsed=sessionTimeRef.current;
    if(elapsed>0 && !isRestRef.current) {
      addStudySession({type:sessionTypeRef.current,startedAt:new Date(Date.now()-elapsed*1000).toISOString(),endedAt:new Date().toISOString(),duration:elapsed,taskId:activeTaskIdRef.current || undefined,subtaskId:activeSubtaskIdRef.current || undefined,taskTitle:linkedStudyTitle(tasksRef.current.find(t=>t.id===activeTaskIdRef.current),activeSubtaskIdRef.current),plannedSessionId:activePlannedSessionIdRef.current || undefined,pauseCount:distractionCountRef.current,pauseDuration:accumulatedPauseTimeRef.current});
    }
    linkTaskToTimer(taskId,subtaskId);
    resetTimer();
    setSessionType('pomodoro');
    const blockMinutes=Math.max(1,Math.min(120,Math.round(sub.estimatedMinutes||((task?.estimatedMinutes||60)/Math.max(1,task?.subtasks.filter(s=>!s.done).length||1)))));
    setSettings(previous=>({...previous,pomodoroTime:blockMinutes*60,pomodoroEndAt:undefined}));
    setIsTimerActive(true);
    return true;
  },[addNotification,addStudySession,linkTaskToTimer,resetTimer]);

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
      plannedSessionId: activePlannedSessionIdRef.current || undefined,
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ DOWNLOADS Ã¢â€â‚¬Ã¢â€â‚¬
  const addToDownloadQueue = useCallback((item: Omit<DownloadItem, 'id' | 'progress' | 'status' | 'completedItems'>): string => {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newItem: DownloadItem = {
      ...item,
      format:item.format||playbackSettingsRef.current.downloadFormat||'mp3',
      videoQuality:item.videoQuality||playbackSettingsRef.current.downloadVideoQuality||'1080',
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
    setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, status, progress: status === 'queued' ? 0 : d.progress, errorMessage: status === 'queued' ? undefined : errorMessage || d.errorMessage } : d));
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ SETTINGS Ã¢â€â‚¬Ã¢â€â‚¬
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
      return { ...prev, ...(updates.pomodoroTime !== undefined ? { pomodoroEndAt: undefined } : {}), ...updates, ...extra };
    });
  }, []);

  // Ã¢â€â‚¬Ã¢â€â‚¬ INTEGRATIONS Ã¢â€â‚¬Ã¢â€â‚¬
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

  const syncCalendarTwoWayCb = useCallback(async (): Promise<{ created: number; updated: number; pushed: number; deleted: number; errors: number }> => {
    try {
      const { syncCalendarTwoWay } = await import('../lib/google/calendar');
      const mainEvents = events.map(e => ({
        id: e.id, title: e.title, description: e.description, date: e.date,
        startTime: e.startTime, endTime: e.endTime, allDay: e.allDay, color: e.color, googleEventId: e.googleEventId,
      }));
      const bridgeEvents: PlanEventBridge[] = planEvents.map(p => ({
        id: 'plan:' + p.id, title: p.title, description: p.description, date: p.date,
        startTime: p.startTime, endTime: p.endTime, allDay: !!p.allDay, color: p.color, googleEventId: p.googleEventId,
      }));
      const res = await syncCalendarTwoWay([...mainEvents, ...bridgeEvents]);
      // Guardar mapeos de los eventos reciÃ©n creados en Google
      for (const m of res.newMappings) {
        if (m.appEventId.startsWith('plan:')) continue;
        updateEvent(m.appEventId, { googleEventId: m.googleEventId });
      }
      // Mapeos de eventos del Planificador
      const planMaps = res.newMappings.filter(m => m.appEventId.startsWith('plan:'));
      if (planMaps.length) {
        const mapById = new Map(planMaps.map(m => [m.appEventId.slice(5), m.googleEventId]));
        setPlanEvents(prev => prev.map(p => mapById.has(p.id) ? { ...p, googleEventId: mapById.get(p.id)! } : p));
      }
      // Importar eventos externos de Google
      for (const ev of res.imported) {
        addEvent({ title: ev.title, description: ev.description, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, color: ev.color, allDay: ev.allDay, tags: [], files: [], recurring: 'none', googleEventId: ev.googleEventId });
      }
      // Actualizar en la app los eventos externos modificados en Google
      for (const u of res.updates) {
        if (u.id.startsWith('plan:')) continue;
        updateEvent(u.id, u.changes);
      }
      // Reflejar esas actualizaciones en el Planificador (match por googleEventId)
      setPlanEvents(prev => prev.map(p => {
        if (!p.googleEventId) return p;
        const u = res.updates.find(x => x.googleEventId && x.googleEventId === p.googleEventId);
        return u ? { ...p, ...u.changes, googleEventId: p.googleEventId } : p;
      }));
      // Exponer importaciones al Planificador para que las muestre en su store
      setPlanSyncImports(res.imported.map(ev => ({
        id: 'gcal_' + ev.googleEventId,
        title: ev.title, description: ev.description, date: ev.date,
        startTime: ev.startTime, endTime: ev.endTime, allDay: ev.allDay,
        color: ev.color, googleEventId: ev.googleEventId,
      })));
      setPlanSyncTick(t => t + 1);
      setLastCalendarSync(new Date().toISOString());
      return { created: res.created, updated: res.updated, pushed: res.pushed, deleted: res.deleted, errors: res.errors };
    } catch (e) {
      console.error('Calendar two-way sync failed:', e);
      return { created: 0, updated: 0, pushed: 0, deleted: 0, errors: 1 };
    }
  }, [events, planEvents, addEvent, updateEvent, setLastCalendarSync, setPlanEvents]);

  const triggerTasksSync = useCallback(async () => {
    try {
      const { syncAppTasksToGoogle } = await import('../lib/google/tasks');
      const { synced } = await syncAppTasksToGoogle(
        tasks.map(t => ({ id: t.id, title: t.title, description: t.notes || '', status: t.status === 'completado' ? 'completed' as const : t.status === 'progreso' ? 'in_progress' as const : 'pending' as const, dueDate: t.dueDate }))
      );
      if (synced > 0) addNotification(`${synced} tareas sincronizadas con Google Tasks`, 'success');
    } catch (e) { console.error('Tasks sync failed:', e); }
  }, [tasks]);

  // Empuja un evento del Planificador a Google Calendar al crearlo/editarlo
  const syncPlanEventToGoogle = useCallback(async (ev: PlanEventBridge): Promise<string | null> => {
    if (!googleConnected) return ev.googleEventId || null;
    try {
      const { createEvent, updateEvent: gUpdate, toGoogleInput } = await import('../lib/google/calendar');
      const input = { ...toGoogleInput(ev), extendedProperties: { private: { owaId: 'plan:' + ev.id } } };
      if (ev.googleEventId) {
        await gUpdate(ev.googleEventId, input);
        return ev.googleEventId;
      }
      const created = await createEvent(input);
      return created.id;
    } catch (e) {
      console.error('Plan event -> Google failed:', e);
      return ev.googleEventId || null;
    }
  }, [googleConnected]);

  // Elimina un evento del Planificador en Google Calendar
  const deletePlanEventFromGoogle = useCallback(async (googleEventId: string): Promise<void> => {
    if (!googleConnected || !googleEventId) return;
    try {
      const { deleteEvent } = await import('../lib/google/calendar');
      await deleteEvent(googleEventId);
    } catch (e) { console.error('Delete plan event from Google failed:', e); }
  }, [googleConnected]);

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

  const syncTasksTwoWayCb = useCallback(async (): Promise<{ created: number; updated: number; pushed: number; deleted: number; errors: number }> => {
    try {
      const { syncTasksTwoWay } = await import('../lib/google/tasks');
      const res = await syncTasksTwoWay(
        tasks.map(t => ({
          id: t.id, title: t.title, notes: t.notes || '', dueDate: t.dueDate,
          status: t.status === 'completado' ? 'completed' as const : t.status === 'progreso' ? 'in_progress' as const : 'pending' as const,
          googleTaskId: t.googleTaskId,
        }))
      );
      // Guardar mapeos de las tareas reciÃ©n creadas en Google
      for (const m of res.newMappings) updateTask(m.appTaskId, { googleTaskId: m.googleTaskId });
      // Importar tareas aÃ±adidas directamente en la lista de Google
      for (const t of res.imported) {
        addTask({
          title: t.title, course: '', courseColor: '', priority: 'medium',
          urgent: false, important: false, dueDate: t.dueDate,
          notes: t.notes, googleTaskId: t.googleTaskId,
        });
      }
      // Aplicar actualizaciones traÃ­das desde Google
      for (const u of res.updates) {
        updateTask(u.id, {
          title: u.changes.title, notes: u.changes.notes, dueDate: u.changes.dueDate,
          status: u.changes.status === 'completed' ? 'completado' : u.changes.status === 'in_progress' ? 'progreso' : 'inicio',
        });
      }
      return { created: res.created, updated: res.updated, pushed: res.pushed, deleted: res.deleted, errors: res.errors };
    } catch (e) {
      console.error('Tasks two-way sync failed:', e);
      return { created: 0, updated: 0, pushed: 0, deleted: 0, errors: 1 };
    }
  }, [tasks, addTask, updateTask]);

  // ── Auto-sync de Google (Calendar + Tasks) ────────────────────────────────
  const googleConnectedRef = useRef(googleConnected);
  useEffect(() => { googleConnectedRef.current = googleConnected; }, [googleConnected]);
  const calendarSyncEnabledRef = useRef(calendarSyncEnabled);
  useEffect(() => { calendarSyncEnabledRef.current = calendarSyncEnabled; }, [calendarSyncEnabled]);
  const syncCalendarTwoWayRef = useRef(syncCalendarTwoWayCb);
  useEffect(() => { syncCalendarTwoWayRef.current = syncCalendarTwoWayCb; });
  const syncTasksTwoWayRef = useRef(syncTasksTwoWayCb);
  useEffect(() => { syncTasksTwoWayRef.current = syncTasksTwoWayCb; });
  const lastAutoSyncRef = useRef(0);

  useEffect(() => {
    if (!googleConnected || !calendarSyncEnabled) return;
    let disposed = false;
    const runAutoSync = async () => {
      if (disposed || !googleConnectedRef.current || !calendarSyncEnabledRef.current) return;
      const now = Date.now();
      if (now - lastAutoSyncRef.current < 60_000) return;
      lastAutoSyncRef.current = now;
      try { await syncCalendarTwoWayRef.current(); } catch (e) { console.error('Auto-sync Calendar falló:', e); }
      try { await syncTasksTwoWayRef.current(); } catch (e) { console.error('Auto-sync Tasks falló:', e); }
    };
    // Primera sincronización tras conectar y, luego, cada 15 minutos.
    const first = setTimeout(() => { runAutoSync(); }, 10_000);
    const iv = setInterval(runAutoSync, 15 * 60 * 1000);
    return () => { disposed = true; clearTimeout(first); clearInterval(iv); };
  }, [googleConnected, calendarSyncEnabled]);

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

  const setQueueSourcePersisted=useCallback((source:{pool:string[];name?:string}|null)=>{queueSourceRef.current=source;setQueueSource(source);rememberQueueSource(source);},[]);
  const queueResumed=useRef(false);
  useEffect(()=>{
    if(!hydrated||!tracks.length||queueResumed.current)return;queueResumed.current=true;
    let session=1;try{session=(Number(localStorage.getItem('apheka_music_boot_v1'))||0)+1;localStorage.setItem('apheka_music_boot_v1',String(session));}catch{}
    const resumed=resumeLibraryQueue(tracks.filter(isLibraryTrack).map(track=>track.id),currentTrackId,musicQueue,readQueueIntent(),'boot:'+session,tracks.map(track=>track.id));
    queueSourceRef.current=resumed.source;musicQueueRef.current=resumed.queue;setQueueSource(resumed.source);setMusicQueue(resumed.queue);
  },[hydrated,tracks,currentTrackId]);

  const value: AppContextType = {
    persistWorkspace: async () => {
      if (!hydrated || sessionStorage.getItem('owa_restore_pending')) throw new Error('Espera a que termine de cargar o restaurar el espacio de trabajo.');
      await saveBeforeUnloadRef.current?.(undefined, true);
    },
    tasks, habits, notes, noteFolders, courses, events, tracks, studySessions, plannedSessions,
    hydrated,
    settings, sessionTime, sessionType, weeklyStudyTime, dailyStudyTime, pomodoroSessions,
    activeTaskId, activeSubtaskId, timerLocked, isTimerActive, roundsCompleted, showCompletion,
    showRestPrompt, setShowRestPrompt, handlePomodoroBannerClick,
    currentTrackId, coverModalTrackId, youtubeVideoUrl, setYoutubeVideoUrl, isPlayingMusic, isAudioLoading, musicVolume, musicProgress, musicDuration, setMusicDuration, musicListeningTime, dailyMusicTime, weeklyMusicTime, monthlyMusicTime, shuffleMode, repeatMode,
    trackHistory, playCounts, musicQueue, queueSource, downloadQueue, artists,
    googleConnected, calendarSyncEnabled, lastCalendarSync, importState,
    addTask, updateTask, deleteTask, toggleTaskStatus, clearAllTasks, deleteCompletedTasks, deleteOldCompletedTasks, reorderTasks,
    addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, incrementTaskStudyTime,
    addNote, updateNote, updateNoteVisual, deleteNote, restoreNote, permanentlyDeleteNote, addNoteFolder, deleteNoteFolder, reorderFolders, reorderNotes, updateNoteFolder, duplicateNote, flushNoteContent,
    addCourse, updateCourse, deleteCourse, reorderCourses,
    addEvent, updateEvent, deleteEvent,
    addHabit, updateHabit, deleteHabit, setHabits,
    addTrack, updateTrack, deleteTrack, toggleTrackFavorite, importLocalTracks,
    scanFolderForAudio, checkLocalFileExists, cleanupMissingLocalFiles, importLocalZeroCopy, removeDuplicateTracks, normalizeMusicFilenames,
    playTrack, toggleMusicPlayback, setIsPlayingMusic, clearCurrentTrack, setMusicVolume: setMusicVolumeCb, setMusicProgress: setMusicProgressCb, setMusicProgressRaw: setMusicProgress,
    setShuffleMode, setRepeatMode, setMusicQueue, setQueueSource:setQueueSourcePersisted, clearAllMusicData,
    exportMusicLibrary, importMusicLibrary,
    setCoverModalTrackId,
    addArtist: useCallback((name: string, profileImage?: string, catalogId?:string) => {
      setArtists(prev => {
        const matches=(a:SavedMusicArtist)=>catalogId&&a.catalogId?a.catalogId===catalogId:artistKey(a.name)===artistKey(name);
        if (prev.some(matches)) return prev.map(a=>matches(a)?{...a,origin:'catalog' as const,...(catalogId?{catalogId}:{}),...(profileImage?{profileImage}:{})}:a);
        return [...prev, { id: crypto.randomUUID(), name, origin:'catalog' as const, catalogId, ...(profileImage ? { profileImage } : {}) }];
      });
    }, []),
    updateArtist: useCallback((id: string, updates: Partial<Pick<SavedMusicArtist,'name'|'profileImage'|'trackIds'>>) => {
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
    addStudySession, updateStudySession, deleteStudySession, incrementSessionTime, incrementDailyStudyTime,
    addPlannedSession, updatePlannedSession, deletePlannedSession, reorderPlannedSessions,
    incrementPomodoroSessions, resetPomodoroSessions, setActiveTaskId,
    linkTaskToTimer, startSubtaskStudy, unlinkTaskFromTimer, toggleTimer, resetTimer,
    activePlannedSessionId, setActivePlannedSessionId, linkPlannedSessionToTimer, unlinkPlannedSessionFromTimer,
    setIsTimerActive, setSessionTime, setDailyStudyTime, setWeeklyStudyTime,
    setTasks, setPomodoroSessions, setShowCompletion, setRoundsCompleted, isRest, setIsRest,
    setSessionType, accumulatedPauseTime, pauseStartTime, distractionCount, focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime, dailyFocusPomodoro, dailyFocusChrono,
    setAccumulatedPauseTime, setPauseStartTime, setDistractionCount, setFocusPomodoroTime, setFocusChronoTime, setBreakTime, setDailyFocusPomodoro, setDailyFocusChrono,
    dailyPerformances, setDailyPerformances,
    navigateTo, setNavigateTo,
    courseDeepLink, setCourseDeepLink, navigateToCourse,
    focusedTaskId, setFocusedTaskId,
    focusedEventId, setFocusedEventId,
    updateSettings: updateSettingsCb,
    setGoogleConnected, setCalendarSyncEnabled: setCalendarSyncEnabledPersist, setLastCalendarSync,
    triggerCalendarSync, syncCalendarTwoWay: syncCalendarTwoWayCb, importGoogleEvents: importGoogleEventsCb,
    planEvents, setPlanEvents, planSyncTick, planSyncImports, syncPlanEventToGoogle, deletePlanEventFromGoogle,
    triggerTasksSync, syncTasksTwoWay: syncTasksTwoWayCb, importGoogleTasks: importGoogleTasksCb,
    searchYouTubeMusic: searchYouTubeMusicCb, searchVideos: searchVideosCb, importClassroomCourses: importClassroomCoursesCb,
    importClassroomAssignments: importClassroomAssignmentsCb,
    exportNotesToGoogleDoc: exportNotesToGoogleDocCb, exportStatsToGoogleSheets: exportStatsToGoogleSheetsCb,
    loadGoogleProfile: loadGoogleProfileCb,
    searchStudyResources: searchStudyResourcesCb,
    createStudyQuiz: createStudyQuizCb,
    initFirebaseNotifications: initFirebaseNotificationsCb,
    triggerDriveBackup,
    notifications, addNotification, removeNotification, clearNotifications, toastMessage,
  };

  const sliceStore=useRef<ReturnType<typeof createSelectionStore<AppContextType>>|null>(null);
  if(!sliceStore.current)sliceStore.current=createSelectionStore(value);
  useLayoutEffect(()=>{sliceStore.current!.commit(value);});
  return <AppSliceContext.Provider value={sliceStore.current}><AppContext.Provider value={value}>{children}</AppContext.Provider></AppSliceContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

/** Event bridges read the latest committed state without rendering on timer/audio ticks. */
export function useAppSnapshot(){
  const store=useContext(AppSliceContext);
  if(!store)throw new Error('useAppSnapshot must be used within AppProvider');
  return store.getSnapshot;
}

export function useAppSlice<K extends keyof AppContextType>(keys:readonly K[]):Pick<AppContextType,K>{
  const store=useContext(AppSliceContext);
  if(!store)throw new Error('useAppSlice must be used within AppProvider');
  const signature=keys.join('|');
  const selected=useMemo(()=>{
    let previous:Pick<AppContextType,K>|undefined;
    return()=>{const snapshot=store.getSnapshot();if(previous&&keys.every(key=>Object.is(previous![key],snapshot[key])))return previous;previous=Object.fromEntries(keys.map(key=>[key,snapshot[key]])) as Pick<AppContextType,K>;return previous;};
  },[store,signature]);
  return useSyncExternalStore(store.subscribe,selected,selected);
}



