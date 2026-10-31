import {beginBrainDrag,finishBrainDrag,cancelBrainDrag} from '../../lib/brainDrop';
import TaskStudyControls from './tasks/TaskStudyControls';
import TaskDurationField from './tasks/TaskDurationField';
import {distributeSubtaskMinutes,suggestTaskSteps,nextStudyStep,studyBlockMinutes,taskMinutes} from '../../lib/taskStudyPlan';
import {assessTasks,taskDeadline} from '../../lib/taskIntelligence';
import {useAppSnapshot} from '../../store/AppContext';
import {TaskBoard,TaskUrgencyMatrix,TaskOverview,TaskStateButton} from './tasks/TaskPriorityViews';
import TaskStudyPicker from './tasks/TaskStudyPicker';
import './tasks/taskWorkspace.css';
import {useAppSlice} from "../../store/AppContext";
import TimeControl from '../ui/TimeControl';
import {usePanelWidth,PanelResizeHandle} from '../../hooks/usePanelWidth';
import PlanSelectDropdown from '../ui/PlanSelectDropdown';
import { taskLinkUnavailable } from '../../lib/linkEligibility';
import WorkspaceHeader from '../ui/WorkspaceHeader';
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import LiveClock from '../ui/LiveClock';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Check, Trash2, Shuffle, Grid2X2,
  ChevronRight, CalendarDays, ChevronUp,
  Clock, List as ListIcon, FileText,
  Link, Video, File, X, Upload, Link2,
  ExternalLink,   Eye, EyeOff, Filter,
  ChevronLeft, Timer,
  Paperclip,
  Zap, Circle, CheckCircle, Loader,
  AlertTriangle,
  ArrowUp, ArrowDown, CheckSquare,
  LayoutGrid, Calendar, Play, Activity,
  TrendingUp, Flame, ListTodo, Image, Music, FileSpreadsheet,
  Star, Pencil, ChevronDown, Globe,
} from 'lucide-react';
import { useApp, Task, fmtClock } from '../../store/AppContext';
import { openFileSmart, pickAndPersistFile } from '../../lib/openFileSmart';
import { fuzzyMatch } from '../../lib/fuzzy';
import { useMaterialMenu } from '../ui/MaterialContextMenu';
import { isTauri, convertFileSrc } from '@tauri-apps/api/core';
import { GoogleClassroomIcon, GoogleDriveIcon, GoogleDocsIcon, GoogleSheetsIcon, GoogleSlidesIcon, GoogleFormsIcon, WordIcon, ExcelIcon, PowerPointIcon } from '../ui/GoogleIcons';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, addWeeks, subWeeks, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { isSignedIn, signIn, signOut, onAuthChange } from '../../lib/google';
import NotificationBell from '../ui/NotificationBell';
import {
  DndContext, DragOverlay, closestCenter, closestCorners, pointerWithin,
  PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement, snapCenterToCursor } from '@dnd-kit/modifiers';

const s = {
  flex: (v: number) => ({ flex: v }),
  fc: (gap = 0) => ({ display: 'flex', flexDirection: 'column' as const, gap }),
  fr: (gap = 0) => ({ display: 'flex', alignItems: 'center' as const, gap }),
  bw: (w: string) => ({ width: w }),
  txt: (s = 12, w = 600, c = 'var(--text-primary)') => ({ fontSize: s, fontWeight: w, color: c }),
  mm: (c = 'var(--text-tertiary)') => ({ fontSize: 11, fontWeight: 600, color: c, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }),
  card: (p = '14px 16px') => ({ padding: p, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25)' }),
  inp: () => ({ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', transition: 'all 200ms' }),
  btn: (b = '1px solid var(--border-default)', bg = 'var(--bg-elevated)', c = 'var(--text-secondary)') => ({ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: b, background: bg, color: c, transition: 'all 200ms' }),
  sel: () => ({ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', transition: 'all 200ms' }),
};

const statusConfig: Record<string, { label: string; color: string; next: string }> = {
  inicio: { label: 'Pendiente', color: '#F59E0B', next: 'progreso' },
  progreso: { label: 'En Curso', color: '#3B82F6', next: 'completado' },
  completado: { label: 'Completada', color: '#10B981', next: 'inicio' },
};

const TASK_TYPE_MAP: Record<string, string> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', mp4: 'video', webm: 'video', avi: 'video', mov: 'video', mkv: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', wma: 'audio', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt', txt: 'text', csv: 'csv', json: 'text', md: 'text', xml: 'text', zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip' };

function localDate(d: string): Date {
  if (d.includes('T')) {
    const [datePart, timePart] = d.split('T');
    const [y, m, day] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    return new Date(y, m - 1, day, h, min);
  }
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getTimeRemaining(dueDate: string): { label: string; text: string; urgent: boolean; overdue: boolean } {
  const parsed = new Date(taskDeadline(dueDate)??NaN);
  if (isNaN(parsed.getTime())) return { label: '', text: '', urgent: false, overdue: false };
  const diff = parsed.getTime() - Date.now();
  if (diff <= 0) return { label: 'Vencida', text: 'Vencida', urgent: true, overdue: true };
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) { const h = Math.floor(diff / (1000 * 60 * 60)); return { label: 'Hoy', text: `Faltan ${h}h`, urgent: false, overdue: false }; }
  const d = Math.floor(days);
  if (d === 1) return { label: 'Mañana', text: 'Falta 1 día', urgent: false, overdue: false };
  if (d < 3) return { label: `${d}d`, text: `Faltan ${d} días`, urgent: false, overdue: false };
  return { label: `${d}d`, text: `Faltan ${d} días`, urgent: false, overdue: false };
}

function getFileIcon(type: string, size = 14) {
  switch (type) {
    case 'pdf': return <FileText size={size} style={{ color: '#EF4444' }} />;
    case 'video': return <Video size={size} style={{ color: '#8B5CF6' }} />;
    case 'image': return <Image size={size} style={{ color: '#3B82F6' }} />;
    case 'link': return <Link size={size} style={{ color: '#10B981' }} />;
    case 'drive': return (
      <svg viewBox="0 0 24 24" style={{ width: size, height: size }}><path fill="#FFD04B" d="M19 13h-6v6h6v-6z"/><path fill="#4285F4" d="M13 19h-6v-6h6v6z"/><path fill="#0F9D58" d="M7 13h6V7H7v6z"/><path fill="#DB4437" d="M19 7h-6v6h6V7z"/></svg>
    );
    case 'audio': return <Music size={size} style={{ color: '#8B5CF6' }} />;
    case 'doc': return <FileText size={size} style={{ color: '#3B82F6' }} />;
    case 'xls': return <FileSpreadsheet size={size} style={{ color: '#10B981' }} />;
    case 'ppt': return <FileText size={size} style={{ color: '#F59E0B' }} />;
    default: return <File size={size} style={{ color: 'var(--text-tertiary)' }} />;
  }
}



function SortableTaskRow({ task, children }: { task: Task; children: (dragProps: { isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: isDragging ? 'none' : CSS.Translate.toString(transform), transition };
  return <div className="task-sortable-row" ref={setNodeRef} style={style} {...attributes} {...listeners}>{children({ isDragging })}</div>;
}

function DraggableCalendarTask({ id, children }: { id: string; children: (props: { attributes: any; listeners: any; setNodeRef: any; isDragging: boolean; transform: any }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id });
  return <>{children({ attributes, listeners, setNodeRef, isDragging, transform })}</>;
}

function DroppableCalendarDay({ id, children }: { id: string; children: (props: { setNodeRef: any; isOver: boolean }) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <>{children({ setNodeRef, isOver })}</>;
}

function SortableCalendarTask({ task, children }: { task: Task; children: (dragProps: { attributes: any; listeners: any; setNodeRef: any; style: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 'auto' };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners, setNodeRef, style, isDragging })}</div>;
}

export default function Tareas() {
  const inspectorWidth=usePanelWidth('task-inspector',600,500,860,'left',32);
  const { tasks, courses, notes, addTask, updateTask, toggleTaskStatus, deleteTask, addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, clearAllTasks, addNotification, setNavigateTo, focusedTaskId, setFocusedTaskId, settings, addNote, updateNote, activePlannedSessionId, activeTaskId, linkTaskToTimer, startSubtaskStudy } = useAppSlice(["tasks","courses","notes","addTask","updateTask","toggleTaskStatus","deleteTask","addSubTask","toggleSubTask","deleteSubTask","addTaskFile","removeTaskFile","clearAllTasks","addNotification","setNavigateTo","focusedTaskId","setFocusedTaskId","settings","addNote","updateNote","activePlannedSessionId","activeTaskId","linkTaskToTimer","startSubtaskStudy"]);
  const th = document.documentElement.getAttribute('data-theme');
  const isDarkSelect = !th || th === 'oscuro' || th === 'vibrante';
  const selectBorder = isDarkSelect ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)';

  function timeAgo(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Reciente';
      const diffMs = Date.now() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Ahora';
      if (mins < 60) return `Hace ${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Hace ${hours}h`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'Ayer';
      if (days < 30) return `Hace ${days}d`;
      const months = Math.floor(days / 30);
      return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
    } catch {
      return 'Reciente';
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scheme = th === 'claro' ? 'light' : 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTaskCourse, setNewTaskCourse] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('');
  const [newTaskMinutes,setNewTaskMinutes]=useState('');
  const [newTaskSteps,setNewTaskSteps]=useState<import('../../store/AppContext').SubTask[]>([]);
  useEffect(()=>{if(showNewModal){setNewTaskCourse('');setNewTaskPriority('');setNewTaskMinutes('');setNewTaskSteps([]);}},[showNewModal]);
  const [newTaskPrefillDate, setNewTaskPrefillDate] = useState<string | null>(null);
  const [viewMode,setViewMode]=useState<'list'|'board'|'urgency'>(()=>{try{const saved=localStorage.getItem('owa_tasks_view');return saved==='calendar'||saved==='urgency'?'urgency':saved==='board'?'board':'list';}catch{return 'list';}});
  const [showPicker,setShowPicker]=useState(false),[assessmentTime,setAssessmentTime]=useState(Date.now);
  const intelligence=useAppSlice(['studySessions','plannedSessions','navigateToCourse']),getApp=useAppSnapshot();
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const refresh=()=>{clearTimeout(timer);if(document.hidden)return;setAssessmentTime(Date.now());timer=setTimeout(refresh,60000-Date.now()%60000);};refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};},[]);
  const assessments=useMemo(()=>assessTasks(tasks,{now:assessmentTime,dailyGoal:settings.dailyGoal,courses,studySessions:intelligence.studySessions,plannedSessions:intelligence.plannedSessions}),[tasks,assessmentTime,settings.dailyGoal,courses,intelligence.studySessions,intelligence.plannedSessions]);
  const [sortBy, setSortBy] = useState<'fecha' | 'curso'>('fecha');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<Date>(new Date(0));
  const [includeTime, setIncludeTime] = useState(false);
  const [calendarSubMode, setCalendarSubMode] = useState<'semana' | 'mes'>('mes');
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCourse, setQuickCourse] = useState('');
  const [quickPriority, setQuickPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPath, setNewMaterialPath] = useState('');
  const [googleConnected, setGoogleConnected] = useState(isSignedIn());
  const [syncing, setSyncing] = useState<'classroom' | 'tasks' | null>(null);


  function donutGradient(segments: { value: number; color: string }[], gapDeg = 2): string {
    const total = segments.reduce((a, s) => a + s.value, 0);
    if (total === 0) return 'conic-gradient(from -90deg, var(--border-soft) 0deg 360deg)';
    const active = segments.filter(s => s.value > 0);
    const N = active.length;
    if (N === 0) return 'conic-gradient(from -90deg, var(--border-soft) 0deg 360deg)';
    if (N === 1) return `conic-gradient(from -90deg, ${active[0].color} 0deg 360deg)`;
    const available = 360 - N * gapDeg;
    let currentDeg = gapDeg / 2;
    const stops = [`transparent 0deg ${currentDeg}deg`];
    for (let i = 0; i < N; i++) {
      const segDeg = (active[i].value / total) * available;
      stops.push(`${active[i].color} ${currentDeg}deg ${currentDeg + segDeg}deg`);
      currentDeg += segDeg;
      if (i < N - 1) {
        stops.push(`transparent ${currentDeg}deg ${currentDeg + gapDeg}deg`);
        currentDeg += gapDeg;
      } else {
        stops.push(`transparent ${currentDeg}deg 360deg`);
      }
    }
    return `conic-gradient(from -90deg, ${stops.join(', ')})`;
  }
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setIsInitialLoading(false), 650); return () => clearTimeout(t); }, []);
  try { useEffect(() => { localStorage.setItem('owa_tasks_view', viewMode); }, [viewMode]); } catch { /* cuota */ }
  useEffect(() => {
    const pendingId = localStorage.getItem('owa_pending_task_id');
    if (pendingId && tasks.some(t => t.id === pendingId)) {
      setSelectedTaskId(pendingId);
      localStorage.removeItem('owa_pending_task_id');
    }
  }, [tasks]);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showSubtasksModal, setShowSubtasksModal] = useState(false);
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState<{ taskId: string; fileId: string } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState(false);
  const [expandedStatus, setExpandedStatus] = useState(false);

  // Hide completed tasks
  type HideMode = 'off' | 'now' | '10m' | '1h' | '6h' | '24h' | '48h';
  const lastActiveMode = useRef<HideMode>('now');
  const [hideMode, setHideMode] = useState<HideMode>(() => {
    try { return (localStorage.getItem('owa_hide_completed') as HideMode) || 'off'; } catch { return 'off'; }
  });
  useEffect(() => { try { localStorage.setItem('owa_hide_completed', hideMode); } catch {} }, [hideMode]);

  const toggleHideMode = useCallback(() => {
    if (hideMode === 'off') {
      setHideMode(lastActiveMode.current);
    } else {
      lastActiveMode.current = hideMode;
      setHideMode('off');
    }
  }, [hideMode]);

  // Auto-refresh list when in time-based hide modes (every 30s)
  const [hideTick, setHideTick] = useState(0);
  useEffect(() => {
    if (hideMode === 'off' || hideMode === 'now') return;
    const timer = setInterval(() => setHideTick(n => n + 1), 30000);
    return () => clearInterval(timer);
  }, [hideMode]);

  const shouldHideCompleted = useCallback((task: { status: string; completedAt?: string }) => {
    if (hideMode === 'off') return false;
    if (task.status !== 'completado') return false;
    if (hideMode === 'now') return true;
    if (!task.completedAt) return false;
    const elapsed = Date.now() - new Date(task.completedAt).getTime();
    if (hideMode === '10m' && elapsed >= 10 * 60 * 1000) return true;
    if (hideMode === '1h' && elapsed >= 60 * 60 * 1000) return true;
    if (hideMode === '6h' && elapsed >= 6 * 60 * 60 * 1000) return true;
    if (hideMode === '24h' && elapsed >= 24 * 60 * 60 * 1000) return true;
    if (hideMode === '48h' && elapsed >= 48 * 60 * 60 * 1000) return true;
    return false;
  }, [hideMode, hideTick]);

  const notificationCount = useMemo(() => tasks.filter(t => t.dueDate && localDate(t.dueDate).getTime() < Date.now() && t.status !== 'completado').length, [tasks]);


  useEffect(() => {
    if (showNewModal && newTaskPrefillDate) {
      requestAnimationFrame(() => {
        const input = document.getElementById('new-task-duedate') as HTMLInputElement;
        if (input) { input.value = newTaskPrefillDate.slice(0, 10); }
        const timeInput = document.getElementById('new-task-duetime') as HTMLInputElement;
        if (timeInput) { timeInput.value = newTaskPrefillDate.length > 10 ? newTaskPrefillDate.slice(11, 16) : ''; }
      });
      setNewTaskPrefillDate(null);
    }
  }, [showNewModal, newTaskPrefillDate]);

  useEffect(() => { if (focusedTaskId) { setSelectedTaskId(focusedTaskId); setShowAddMaterial(false); setPdfPreviewUrl(null); setFocusedTaskId(null); } }, [focusedTaskId, setFocusedTaskId]);

  useEffect(() => { return onAuthChange(connected => setGoogleConnected(connected)); }, []);

  // Lock body scroll when new task modal is open
  useEffect(() => {
    if (showNewModal) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      const pc = document.querySelector('.page-container') as HTMLElement | null;
      if (pc) pc.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const pc = document.querySelector('.page-container') as HTMLElement | null;
      if (pc) pc.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const pc = document.querySelector('.page-container') as HTMLElement | null;
      if (pc) pc.style.overflow = '';
    };
  }, [showNewModal]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completadas = tasks.filter(t => t.status === 'completado').length;
    const pendientes = tasks.filter(t => t.status === 'inicio').length;
    const progreso = tasks.filter(t => t.status === 'progreso').length;
    const vencidas = tasks.filter(t => t.dueDate && localDate(t.dueDate).getTime() < Date.now() && t.status !== 'completado').length;
    return { total, completadas, pendientes, progreso, vencidas, completadasPct: total ? Math.round((completadas / total) * 100) : 0 };
  }, [tasks]);

  const scopedTasks=useMemo(()=>tasks.filter(task=>!(task as Task&{deletedAt?:string}).deletedAt&&(!courseFilter||task.course===courseFilter)&&(!searchQuery||fuzzyMatch(task.title,searchQuery))),[tasks,courseFilter,searchQuery]);
  const filteredTasks = useMemo(() => {
    let filtered = scopedTasks;
    filtered = filtered.filter(t => !shouldHideCompleted(t));
    const allHaveSortOrder = filtered.length > 0 && filtered.every(t => t.sortOrder !== undefined);
    return [...filtered].sort((a, b) => {
      if (allHaveSortOrder) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      const aDone = a.status === 'completado' ? 1 : 0;
      const bDone = b.status === 'completado' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (sortBy === 'fecha') { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return localDate(a.dueDate).getTime() - localDate(b.dueDate).getTime(); }
      return (a.course || '').localeCompare(b.course || '');
    });
  }, [scopedTasks, sortBy, shouldHideCompleted]);

  const { reorderTasks } = useAppSlice(["reorderTasks"]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [calendarDragTaskId, setCalendarDragTaskId] = useState<string | null>(null);
  // Suprime el click que dispara el navegador justo después de soltar un drag (long-press)
  const dragSuppressRef = useRef(false);

  const listSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );
  const calendarSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } })
  );

  const handleDragEndList = useCallback((event: any) => {
    if(finishBrainDrag()){setActiveDragId(null);dragSuppressRef.current=true;return;}
    const { active, over } = event;
    const d = event?.delta ?? { x: 0, y: 0 };
    dragSuppressRef.current = Math.abs(d.x) + Math.abs(d.y) > 4;
    const ids = filteredTasks.map(t => t.id);
    const oldIndex = ids.indexOf(active.id);
    if (oldIndex >= 0) {
      let newIndex = over ? ids.indexOf(over.id) : ids.length - 1;
      if (newIndex >= 0 && oldIndex !== newIndex && active.id !== over?.id) {
        const newIds = arrayMove([...ids], oldIndex, newIndex);
        reorderTasks(newIds);
      }
    }
    setActiveDragId(null);
    setTimeout(() => { dragSuppressRef.current = false; }, 250);
  }, [filteredTasks, reorderTasks]);

  const handleDragEndCalendar = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const targetDateStr = over.id.toString().replace('day-', '');
      if (targetDateStr) {
        updateTask(active.id.toString(), { dueDate: targetDateStr });
      }
    }
    setCalendarDragTaskId(null);
  }, [updateTask]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const taskId = selectedTask?.id;

  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('owa_task_panel_sections_v1') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('owa_task_panel_sections_v1', JSON.stringify(sectionCollapsed));
      Object.keys(localStorage).forEach(k => { if (k.startsWith('owa_task_sec_')) localStorage.removeItem(k); });
    } catch {}
  }, [sectionCollapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDeleteMaterial || confirmDeleteTask) {
          setConfirmDeleteMaterial(null);
          setConfirmDeleteTask(null);
          return;
        }
        if (pdfPreviewUrl || previewModalUrl) {
          setPdfPreviewUrl(null);
          setPreviewModalUrl(null);
          return;
        }
        if (selectedTaskId) {
          setSelectedTaskId(null);
          setShowAddMaterial(false);
          setPdfPreviewUrl(null);
          return;
        }
        if (showNewModal) setShowNewModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfPreviewUrl, selectedTaskId, showNewModal, confirmDeleteMaterial, confirmDeleteTask, previewModalUrl]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggingTaskId(taskId);
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.effectAllowed = 'move';
    }
  };
  const handleDragEnd = () => setDraggingTaskId(null);
  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, { dueDate: toLocalDateStr(targetDate) });
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const activeCourse = quickCourse || (courses[0]?.name || 'General');
    const color = courses.find(c => c.name === activeCourse)?.color || '#3B82F6';
    addTask({
      title: quickTitle.trim(),
      course: activeCourse,
      courseColor: color,
      priority: quickPriority,
      urgent: false,
      important: false,
      dueDate: calendarSelectedDay ? toLocalDateStr(calendarSelectedDay) : toLocalDateStr(new Date()),
      estimatedMinutes: 60,
    });
    setQuickTitle('');
  };

  const handlePrevPeriod = () => {
    if (calendarSubMode === 'semana') {
      setCalendarDate(prev => subWeeks(prev, 1));
    } else {
      setCalendarDate(prev => subMonths(prev, 1));
    }
  };
  const handleNextPeriod = () => {
    if (calendarSubMode === 'semana') {
      setCalendarDate(prev => addWeeks(prev, 1));
    } else {
      setCalendarDate(prev => addMonths(prev, 1));
    }
  };

  const handleToggle = useCallback((e: React.MouseEvent, id: string) => { e.stopPropagation(); e.preventDefault(); toggleTaskStatus(id); }, [toggleTaskStatus]);
  const handleOpenDetail = useCallback((id: string) => setSelectedTaskId(id), []);
  useEffect(()=>{const open=()=>{const id=sessionStorage.getItem('apheka_open_task');if(!id||!tasks.some(t=>t.id===id))return;sessionStorage.removeItem('apheka_open_task');handleOpenDetail(id);};open();window.addEventListener('apheka:open-task',open);return()=>window.removeEventListener('apheka:open-task',open);},[tasks,handleOpenDetail]);
  useEffect(()=>{window.dispatchEvent(new CustomEvent('apheka:task-focus',{detail:{id:selectedTaskId}}));},[selectedTaskId]);

  const handleCreateTask = useCallback(() => {
    const title = (document.getElementById('new-task-title') as HTMLInputElement)?.value?.trim();
    const dueDateInput = document.getElementById('new-task-duedate') as HTMLInputElement;
    const dueTimeInput = document.getElementById('new-task-duetime') as HTMLInputElement;
    if (!title) { addNotification('Ingresa un título', 'error'); return; }
    const courseName = newTaskCourse || 'Sin curso';
    const course = courses.find(c => c.name === courseName);
    let dueDate: string | undefined = undefined;
    if (dueDateInput?.value) {
      dueDate = includeTime && dueTimeInput?.value ? `${dueDateInput.value}T${dueTimeInput.value}` : dueDateInput.value;
    }
    const estimatedMinutes=taskMinutes(newTaskMinutes||60),steps=newTaskSteps.filter(s=>s.title.trim());
    if(estimatedMinutes>120&&steps.length<Math.ceil(estimatedMinutes/120)){setNewTaskSteps(suggestTaskSteps(estimatedMinutes,title,steps));addNotification('Revisa las partes propuestas antes de crear la tarea.','info');return;}
    addTask({ title, course: courseName, courseColor: course?.color || (courseName === 'Sin curso' ? 'var(--text-muted)' : '#E11D48'), priority: (newTaskPriority as any) || 'none', urgent: (newTaskPriority as any) === 'high', important: (newTaskPriority as any) === 'high', dueDate, estimatedMinutes,subtasks:steps, notes: (document.getElementById('new-task-notes') as HTMLTextAreaElement)?.value?.trim() || '' });
    setShowNewModal(false);
  }, [addTask, courses, includeTime, newTaskCourse, newTaskPriority,newTaskMinutes,newTaskSteps, addNotification]);

  const matMenu = useMaterialMenu((m) => addNotification(m, 'error'));

  const handleAddSubtask = useCallback(() => { if (!selectedTask || !newSubtaskTitle.trim()) return; addSubTask(selectedTask.id, newSubtaskTitle.trim()); setNewSubtaskTitle(''); }, [selectedTask, newSubtaskTitle, addSubTask]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (!selectedTask) return;
    if (isTauri()) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      addTaskFile(selectedTask.id, { name: file.name, path: ev.target?.result as string, type: TASK_TYPE_MAP[ext] || 'other', size: file.size });
      addNotification('Archivo subido', 'success');
    };
    reader.readAsDataURL(file);
  }, [selectedTask, addTaskFile]);

  const handleAddFileBtn = useCallback(async () => {
    if (!selectedTask) return;
    if (isTauri()) {
      let r: { path: string; name: string } | null;
      try { r = await pickAndPersistFile(); }
      catch { addNotification('No se pudo abrir el selector de archivos', 'error'); return; }
      if (!r) return;
      const ext = r.name.split('.').pop()?.toLowerCase() || '';
      addTaskFile(selectedTask.id, { name: r.name, path: r.path, type: TASK_TYPE_MAP[ext] || 'other', size: 0 });
      addNotification('Archivo subido', 'success');
      return;
    }
    fileInputRef.current?.click();
  }, [selectedTask, addTaskFile]);

  const fetchPageTitle = useCallback(async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const html = await res.text();
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1].trim() : null;
    } catch { return null; }
  }, []);

  const deriveLinkName = useCallback((url: string): string => {
    try {
      const u = new URL(url);
      let name = u.hostname.replace(/^www\./, '');
      const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ').trim();
      if (seg && seg.toLowerCase() !== name.toLowerCase()) name = `${name} — ${seg}`;
      return name;
    } catch { return url.length > 42 ? url.slice(0, 42) + '…' : url; }
  }, []);

  const handleAddMaterial = useCallback(() => {
    if (!selectedTask) return;
    const path = newMaterialPath.trim();
    if (!path) { addNotification('Ingresa la URL del enlace', 'error'); return; }
    const typedName = newMaterialName.trim();
    let detectedType = 'link';
    if (path.includes('youtube.com') || path.includes('youtu.be')) detectedType = 'video';
    else if (path.includes('classroom.google.com')) detectedType = 'classroom';
    else if (path.includes('drive.google.com')) detectedType = 'drive';
    else if (path.includes('docs.google.com')) detectedType = 'doc';
    else if (path.includes('sheets.google.com')) detectedType = 'xls';
    else if (path.includes('slides.google.com')) detectedType = 'ppt';
    const name = typedName || deriveLinkName(path);
    addTaskFile(selectedTask.id, { name, path, type: detectedType, size: 0 });
    addNotification('Enlace agregado', 'success');
    if (!typedName) {
      fetchPageTitle(path).then(fetched => {
        if (!fetched || !selectedTask) return;
        updateTask(selectedTask.id, { files: (tasks.find(t => t.id === selectedTask.id)?.files || []).map(x => x.path === path ? { ...x, name: fetched } : x) });
      }).catch(() => {});
    }
    setNewMaterialName(''); setNewMaterialPath(''); setShowAddMaterial(false);
  }, [selectedTask, newMaterialName, newMaterialPath, addTaskFile, fetchPageTitle, deriveLinkName, updateTask, tasks]);

  const changeStatus=(id:string,status:Task['status'])=>{const task=tasks.find(task=>task.id===id);if(!task||task.status===status)return;updateTask(id,{status,completedAt:status==='completado'?new Date().toISOString():undefined});};
  const beginRecommendedStudy=(id:string,mode:'pomodoro'|'chrono'='pomodoro',minutes?:number,subtaskId?:string)=>{
    const task=tasks.find(task=>task.id===id),blocked=taskLinkUnavailable(task);
    if(blocked){addNotification(blocked,'info');return;}
    const live=getApp();
    const sub=task&&(subtaskId?task.subtasks.find(s=>s.id===subtaskId&&!s.done):nextStudyStep(task));
    if(!task)return;
    if(taskMinutes(task.estimatedMinutes)>120&&!sub){updateTask(id,{subtasks:suggestTaskSteps(taskMinutes(task.estimatedMinutes),task.title,task.subtasks)});setShowPicker(false);handleOpenDetail(id);setSectionCollapsed(prev=>({...prev,subtareas:false}));addNotification('Revisa las subtareas para estudiar por bloques.','info');return;}
    if((live.isTimerActive||live.sessionTime>0)&&(live.activeTaskId!==id||live.activeSubtaskId!==(sub?.id||null)||live.activePlannedSessionId||live.isRest||mode!==live.sessionType)){addNotification('Termina o reinicia la sesión actual antes de empezar otra tarea.','info');setShowPicker(false);setNavigateTo('estudio');return;}
    linkTaskToTimer(id,sub?.id);if(task.status==='inicio')changeStatus(id,'progreso');
    if(live.sessionTime===0){const duration=Math.max(1,Math.min(120,sub?studyBlockMinutes(task,sub):minutes||studyBlockMinutes(task)));live.setSessionType(mode);live.updateSettings(mode==='pomodoro'?{pomodoroTime:duration*60,pomodoroEndAt:undefined}:{chronoGoal:duration*60});}
    live.setIsRest(false);live.setIsTimerActive(true);setShowPicker(false);setSelectedTaskId(null);setNavigateTo('estudio');
  };

  return (
    <div className="page-container task-workspace flex flex-col h-full overflow-y-auto custom-scroll" style={{ gap: 20 }}>

      {/* HEADER */}
      <WorkspaceHeader title="Tareas" />

      {/* TOOLBAR */}
      <div className="task-workspace-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
        <div className="bento-card task-view-switcher" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'list', label: 'Lista', icon: ListIcon },
            { id: 'board', label: 'Tablero', icon: LayoutGrid },
            { id: 'urgency', label: 'Urgencia', icon: Grid2X2 },
          ].map(m => {
            const active = viewMode === m.id;
            const Icon = m.icon;
            return (
              <button data-ui-control="" key={m.id} aria-pressed={active} onClick={() => setViewMode(m.id as any)}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 11.5, fontWeight: active ? 600 : 500,
                  fontFamily: "'Inter Tight', sans-serif",
                  letterSpacing: '0.02em', cursor: 'pointer', border: 'none',
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 200ms ease',
                  boxShadow: active ? '0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none',
                  opacity: active ? 1 : 0.7,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--text-tertiary)'; } }}>
                <Icon size={13} /> {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 180 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: 32, paddingLeft: 28, fontSize: 12, fontWeight: 400, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-soft)', color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms' }} />
            {searchQuery && <button data-ui-control="" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}><X size={10} /></button>}
          </div>

          {/* Eye toggle — click toggles hide/show completed tasks */}
            <button data-ui-control=""
              onClick={toggleHideMode}
              title={hideMode === 'off' ? 'Ocultar completadas' : 'Mostrar completadas'}
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid', transition: 'all 200ms',
                background: hideMode !== 'off' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-elevated)',
                borderColor: hideMode !== 'off' ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border-soft)',
                color: hideMode !== 'off' ? 'var(--accent)' : 'var(--text-tertiary)',
                opacity: hideMode === 'off' ? 0.5 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = hideMode !== 'off' ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = hideMode === 'off' ? '0.5' : '1'; e.currentTarget.style.borderColor = hideMode !== 'off' ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border-soft)'; }}>
              {hideMode !== 'off' ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

          <button data-app-action="primary" data-ui-control="" onClick={() => setShowNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 14px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', transition: 'all 200ms' }}>
            <Plus size={14} /> Agregar tarea
          </button>
          <button type="button" className="btn-secondary task-pick-trigger" aria-label="Elegir qué estudiar" title="Elegir qué estudiar" onClick={()=>setShowPicker(true)}><Shuffle size={17}/></button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="task-workspace-grid">

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* LIST VIEW */}
        {viewMode === 'list' && (
            <div className="bento-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, flex: 1 }}>
              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '11px 18px 11px 8px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'var(--bg-elevated)', borderRadius: '12px 12px 0 0' }}>
                <span style={{ width: 36, flexShrink: 0 }} />
                <span style={{ flex: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>Tarea</span>
                <span style={{ flex: 2.2, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Curso</span>
                <span style={{ flex: 0.8, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Prioridad</span>
                <span style={{ flex: 1.5, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Fecha</span>
                <span style={{ width: 30, flexShrink: 0 }} />
              </div>
              {/* Rows */}
              <div className="no-scrollbar task-list-scroll" data-drag-active={!!activeDragId} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
                {isInitialLoading ? [1,2,3,4,5,6].map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0', minHeight: 50, borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{ width: 24, minHeight: 50, flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px 0 26px', minHeight: 50 }}>
                      <div style={{ flex: 4, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 80}ms` }} />
                      <div style={{ flex: 1.8, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 80 + 100}ms` }} />
                      <div style={{ flex: 0.8, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 80 + 200}ms` }} />
                      <div style={{ flex: 0.9, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 80 + 300}ms` }} />
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                    </div>
                  </div>
                )) : (
                  <DndContext sensors={listSensors} collisionDetection={pointerWithin} onDragStart={e => { setActiveDragId(e.active.id as string);beginBrainDrag('tasks',String(e.active.id)); }} onDragCancel={() => {cancelBrainDrag();setActiveDragId(null);}} onDragEnd={handleDragEndList} modifiers={[restrictToParentElement]}>
                    <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {filteredTasks.map(task => {
                        const t = task;
                        const assessment=assessments.get(t.id);
                        const tr = t.dueDate ? getTimeRemaining(t.dueDate) : null;
                        const isDone = t.status === 'completado';
                        const isOverdue = tr?.overdue && !isDone;
                        const titleColor = isDone ? 'var(--text-tertiary)' : 'var(--text-primary)';
                        const dateColor = isDone ? '#10B981' : (isOverdue ? '#EF4444' : 'var(--text-secondary)');
                        const stripColor = statusConfig[t.status]?.color || '#F59E0B';
                        const bgStatus = isDone ? 'rgba(16,185,129,0.03)' : 'transparent';
                        const isDragging = activeDragId === t.id;
                        return (
                          <SortableTaskRow key={t.id} task={t}>
                            {({ isDragging: isDndDragging }) => (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0', minHeight: 50, border: '0', background: selectedTaskId === t.id ? `${stripColor}06` : bgStatus, transition: 'all 120ms', opacity: isDndDragging ? 0.4 : 1, userSelect: 'none', WebkitUserSelect: 'none' }}
                                className="task-ranked-row" data-task-id={t.id} data-urgent={assessment?.urgent||false} >
                                <TaskStateButton task={t} onStatus={(id,status)=>{if(!dragSuppressRef.current)changeStatus(id,status);}}/>
                                {/* Content area — click opens detail */}
                                <div onClick={(e) => { e.stopPropagation(); if (dragSuppressRef.current) return; handleOpenDetail(t.id); }}
                                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, padding: '0 18px 0 12px', minHeight: 50, cursor: 'pointer', minWidth: 0 }}>
                                  <div style={{ flex: 4, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: titleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isDone ? 'line-through' : 'none' }}>
                                      {t.title}
                                    </span>
                                    {assessment&&t.status!=='completado'&&<span className="task-list-risk" title={assessment.reasons.join('\n')}>{assessment.label}</span>}
                                  </div>
                                  <div style={{ flex: 2.2, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    {t.course && t.course !== 'Sin curso' ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 6, background: t.courseColor + '12', color: t.courseColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', border: t.status === 'progreso' ? `1px solid ${t.courseColor}50` : '1px solid transparent' }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.courseColor, flexShrink: 0, boxShadow: t.status === 'progreso' ? `0 0 6px ${t.courseColor}80` : 'none' }} />
                                      {t.course}
                                    </span>
                                    ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 400, padding: '2px 10px', borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', fontStyle: 'italic' }}>
                                      Sin curso
                                    </span>
                                    )}
                                  </div>
                                  <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {t.priority !== 'none' ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em', background: t.priority === 'high' ? 'rgba(239,68,68,0.15)' : t.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: t.priority === 'high' ? '#EF4444' : t.priority === 'medium' ? '#F59E0B' : '#10B981' }}>
                                      {t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja'}
                                    </span>
                                    ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 400, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Sin prioridad
                                    </span>
                                    )}
                                  </div>
                                  <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {tr && (
                                      <span style={{ fontSize: 12, fontWeight: 500, color: dateColor }}>
                                        {tr.text}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ width: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div onClick={(e) => { e.stopPropagation(); handleOpenDetail(t.id); }}
                                      style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms' }}
                                      className="hover:bg-white/[0.06]">
                                      <ChevronRight size={11} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </SortableTaskRow>
                        );
                      })}
                    </SortableContext>
              <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                      {activeDragId ? (() => {
                        const t = tasks.find(x => x.id === activeDragId);
                        if (!t) return null;
                        const sc = statusConfig[t.status]?.color || '#F59E0B';
                        return (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 0', height: 48,
                            background: 'var(--bg-surface)', borderRadius: 10,
                            border: '1px solid var(--border-soft)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                            width: 'max-content', maxWidth: 360,
                          }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 7, margin: '9px',
                              background: t.status === 'completado' ? '#10B981' : t.status === 'progreso' ? '#3B82F6' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1.5px solid ${t.status === 'completado' ? '#10B981' : t.status === 'progreso' ? '#3B82F6' : `${sc}55`}`,
                            }}>
                              {t.status === 'completado' && <Check size={13} strokeWidth={2.5} style={{ color: '#fff' }} />}
                              {t.status === 'progreso' && <div style={{ width: 11, height: 11, borderRadius: 4, background: 'rgba(255,255,255,0.92)' }} />}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                          </div>
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>
                )}
                {!isInitialLoading && filteredTasks.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, padding: '48px 0', color: 'var(--text-muted)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckSquare size={16} style={{ opacity: 0.3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Sin tareas</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode==='board'&&<TaskBoard tasks={filteredTasks} assessments={assessments} onOpen={handleOpenDetail} onStatus={changeStatus} onAdd={()=>setShowNewModal(true)}/>}
          {viewMode==='urgency'&&<TaskUrgencyMatrix tasks={filteredTasks} assessments={assessments} onOpen={handleOpenDetail} onStatus={changeStatus}/>}
        </div>
        <TaskOverview courses={courses} tasks={scopedTasks} assessments={assessments} courseFilter={courseFilter} onCourse={setCourseFilter} onOpen={handleOpenDetail}/>
      </div>
      {showPicker&&<TaskStudyPicker tasks={tasks} assessments={assessments} onClose={()=>setShowPicker(false)} onOpen={id=>{setShowPicker(false);handleOpenDetail(id);}} onStudy={id=>beginRecommendedStudy(id)} hasCourse={task=>courses.some(course=>course.name===task.course)} onCourse={task=>{const course=courses.find(course=>course.name===task.course);if(course){setShowPicker(false);intelligence.navigateToCourse(course.id);}}}/>}

      {/* NEW TASK MODAL */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNewModal(false)}>
          <div className="bento-card no-scrollbar workspace-dialog task-create-dialog" role="dialog" aria-modal="true" aria-label="Nueva tarea" style={{ width: '100%', maxWidth: 500, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', padding: '24px 28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} style={{ color: 'var(--accent)' }} /> Nueva Tarea
              </h2>
              <button data-ui-control="" aria-label="Cerrar nueva tarea" onClick={() => setShowNewModal(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Título</label>
                <input id="new-task-title" type="text" name="nueva-tarea" autoComplete="off" placeholder="Ej. Resolver problemas de física..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif" }} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Descripción (opcional)</label>
                <textarea id="new-task-notes" placeholder="Detalles, consigna, qué incluye la entrega..." rows={2} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', minHeight: 52, lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Curso</label>
                  <PlanSelectDropdown label="Curso de la nueva tarea" value={newTaskCourse} onChange={setNewTaskCourse} options={courses.map(course=>({id:course.name,label:course.name,color:course.color}))} noneLabel="Sin curso" color="var(--accent)" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Prioridad</label>
                  <PlanSelectDropdown label="Prioridad de la nueva tarea" value={newTaskPriority} onChange={setNewTaskPriority} options={[{id:'high',label:'Alta',color:'#EF4444'},{id:'medium',label:'Media',color:'#F59E0B'},{id:'low',label:'Baja',color:'#10B981'}]} noneLabel="Sin prioridad" color="var(--accent)" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Fecha</label>
                  <input id="new-task-duedate" type="date" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: selectBorder, borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: "'JetBrains Mono',monospace" }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeTime} onChange={e => setIncludeTime(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Incluir hora
                  </label>
                  {includeTime && (
                    <input id="new-task-duetime" type="time" defaultValue="23:59" style={{ width: '100%', padding: '8px 12px', marginTop: 6, background: 'var(--bg-elevated)', border: selectBorder, borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: "'JetBrains Mono',monospace" }} />
                  )}
                </div>
                <div>
                  <TaskDurationField minimum={Math.max(1,newTaskSteps.length)} value={taskMinutes(newTaskMinutes||60)} onChange={value=>{setNewTaskMinutes(String(value));if(newTaskSteps.length)setNewTaskSteps(distributeSubtaskMinutes(value,newTaskSteps));}}/>
                </div>
              </div>
              {(Number(newTaskMinutes)>120||newTaskSteps.length>0)&&<section className="task-step-planner" aria-label="Dividir tarea en subtareas"><header><span>Subtareas{Number(newTaskMinutes)>120?' · bloques de hasta 120 min':''}</span>{Number(newTaskMinutes)>120&&<button type="button" className="btn-secondary" onClick={()=>setNewTaskSteps(suggestTaskSteps(Number(newTaskMinutes),(document.getElementById('new-task-title') as HTMLInputElement)?.value||'',newTaskSteps))}>Dividir en subtareas</button>}</header>{newTaskSteps.map((sub,index)=><div className="task-draft-step" key={sub.id}><span>{index+1}</span><input aria-label={'Subtarea propuesta '+(index+1)} placeholder="Nombre de la subtarea" value={sub.title} onChange={event=>setNewTaskSteps(steps=>steps.map(s=>s.id===sub.id?{...s,title:event.target.value}:s))}/><label><input key={sub.estimatedMinutes} type="number" min={1} max={120} defaultValue={sub.estimatedMinutes||25} aria-label={'Minutos de subtarea propuesta '+(index+1)} onBlur={event=>{const value=Math.max(1,Math.min(120,Math.round(Number(event.target.value)||25)));event.target.value=String(value);const steps=newTaskSteps.map(s=>s.id===sub.id?{...s,estimatedMinutes:value}:s);setNewTaskSteps(steps);setNewTaskMinutes(String(steps.reduce((sum,s)=>sum+(s.estimatedMinutes||25),0)));}}/>min</label><button type="button" aria-label={'Quitar subtarea propuesta '+(index+1)} onClick={()=>{const steps=newTaskSteps.filter(s=>s.id!==sub.id);setNewTaskSteps(steps);if(steps.length)setNewTaskMinutes(String(steps.reduce((sum,s)=>sum+(s.estimatedMinutes||25),0)));}}><X size={13}/></button></div>)}</section>}
              <button type="button" className="task-add-draft-step" onClick={()=>{const assigned=newTaskSteps.reduce((sum,s)=>sum+(s.estimatedMinutes||25),0),total=taskMinutes(newTaskMinutes||60),minutes=Math.min(120,total>assigned?total-assigned:25);setNewTaskSteps(steps=>[...steps,{id:crypto.randomUUID(),title:'',done:false,estimatedMinutes:minutes}]);setNewTaskMinutes(String(Math.max(total,assigned+minutes)));}}><Plus size={14}/>Añadir subtarea</button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                <button data-app-action="secondary" data-ui-control="" onClick={() => setShowNewModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px', height: 36, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>Cancelar</button>
                <button data-app-action="primary" data-ui-control="" onClick={handleCreateTask} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 22px', height: 36, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff' }}>Crear tarea</button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── TASK DETAIL SIDEBAR (Portaled to document.body) ── */}
      {selectedTaskId && selectedTask && (() => {
        const totalSubtasks = selectedTask.subtasks.length;
        const doneSubtasks = selectedTask.subtasks.filter(s => s.done).length;
        const taskColor = statusConfig[selectedTask.status]?.color || 'var(--accent)';
        const selectedCourseColor = selectedTask.course !== 'Sin curso'
          ? (courses.find(c => c.name === selectedTask.course)?.color || 'var(--border-default)')
          : 'var(--border-default)';
        const priorityColor = selectedTask.priority === 'high' ? '#EF4444' : selectedTask.priority === 'medium' ? '#F59E0B' : selectedTask.priority === 'low' ? '#10B981' : 'var(--border-default)';
        return createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} onClick={() => { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); setPreviewModalUrl(null); }}>
            <div ref={inspectorWidth.ref} className="bento-card task-inspector" role="dialog" aria-label="Detalle de tarea" aria-modal="true" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: "var(--panel-width,560px)", maxWidth: '94vw', padding: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden', border: 'none', borderLeft: '1px solid var(--border-default)', boxShadow: '-20px 0 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset' }} onClick={e => e.stopPropagation()}>
<PanelResizeHandle control={inspectorWidth} label="Ancho del detalle de tarea"/>

              {/* ── Panel Header (mínimo: cerrar · estado · eliminar) ── */}
              <div className="task-inspector-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, gap: 10 }}>
                <button data-ui-control="" onClick={() => setSelectedTaskId(null)}
                  title="Cerrar"
                  style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                  <X size={14} />
                </button>
                <span className="task-inspector-label">Detalle de tarea</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button data-ui-control="" type="button" onClick={() => toggleTaskStatus(selectedTask.id)}
                    title="Cambiar estado"
                    style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: taskColor, letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif", padding: '6px 13px', borderRadius: 999, background: `${taskColor}10`, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all 150ms', border: `1px solid ${taskColor}18` }}
                    onMouseEnter={e => e.currentTarget.style.background = `${taskColor}18`}
                    onMouseLeave={e => e.currentTarget.style.background = `${taskColor}10`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: taskColor, flexShrink: 0, boxShadow: `0 0 6px ${taskColor}80` }} />
                    {statusConfig[selectedTask.status]?.label}
                  </button>
                  <button data-ui-control="" onClick={() => setConfirmDeleteTask(selectedTask.id)}
                    title="Eliminar tarea"
                    style={{ width: 30, height: 30, borderRadius: 9, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', opacity: 0.6, flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.6'; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable Content ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '26px 28px 30px', display: 'flex', flexDirection: 'column', gap: 22 }} className="task-inspector-content custom-scroll">

                {/* ── Title ── */}
                <div style={{ padding: '2px 2px 4px' }}>
                  <input
                    id="task-title-input" aria-label="Título de la tarea"
                    name="titulo-tarea"
                    autoComplete="off"
                    value={selectedTask.title}
                    onChange={e => updateTask(selectedTask.id, { title: e.target.value })}
                    style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", outline: 'none', padding: 0, lineHeight: 1.25, caretColor: taskColor }}
                    placeholder="Título de la tarea..."
                  />

                </div>

                {/* ── Descripción (justo bajo el título) ── */}
                <div style={{ padding: '0 2px', marginTop: -4 }}>
                  <textarea
                    value={selectedTask.notes || selectedTask.apuntes || ''}
                    onChange={e => updateTask(selectedTask.id, { notes: e.target.value })}
                    aria-label="Descripción de la tarea" placeholder="Describe el resultado que quieres conseguir…"
                    rows={Math.min(6, Math.max(1, (selectedTask.notes || selectedTask.apuntes || '').split('\n').length))}
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", padding: 0, minHeight: 26, overflow: 'hidden', transition: 'color 150ms' }}
                    onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
                    onFocus={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onBlur={e => {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      // Solo espacios → se guarda realmente vacío (sin notas fantasma)
                      if (!e.currentTarget.value.trim() && (selectedTask.notes || '').trim()) updateTask(selectedTask.id, { notes: '' });
                    }}
                  />
                </div>

                {/* ── Meta compacta: curso · prioridad · fecha ── */}
                {(() => {
                  const tr = selectedTask.dueDate ? getTimeRemaining(selectedTask.dueDate) : null;
                  const dateColor = tr?.overdue ? '#EF4444' : tr?.urgent ? '#F59E0B' : 'var(--text-secondary)';
                  const dateVal = selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : '';
                  const hasTime = selectedTask.dueDate && selectedTask.dueDate.length > 10;
                  const timeVal = hasTime ? selectedTask.dueDate!.slice(11, 16) : '23:59';
                  const courseIsSet = selectedTask.course !== 'Sin curso';
                  const courseHex = courseIsSet && selectedCourseColor.startsWith('#') ? selectedCourseColor : null;
                  const prioritySet = !!selectedTask.priority && selectedTask.priority !== 'none';
                  const pillBase = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 62, padding: '0 12px', borderRadius: 5, transition: 'border-color 150ms, background 150ms' } as React.CSSProperties;
                  return (
                    <div className="task-properties" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
                      {/* Curso */}
                      <div className="task-property task-colored-property" data-label="Curso" style={{ ...pillBase, ...({"--property-color": courseHex || "var(--workspace-line)"} as React.CSSProperties), background: courseHex ? `${courseHex}0d` : 'var(--bg-elevated)', border: `1px solid ${courseHex ? `${courseHex}30` : 'var(--border-soft)'}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = courseHex ? `${courseHex}55` : 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = courseHex ? `${courseHex}30` : 'var(--border-soft)'; }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedCourseColor, flexShrink: 0, opacity: courseIsSet ? 1 : 0.4 }} />
                        <PlanSelectDropdown label="Curso de la tarea" value={selectedTask.course === 'Sin curso' ? '' : selectedTask.course} onChange={value=>updateTask(selectedTask.id,{course:value || 'Sin curso',courseColor:courses.find(course=>course.name===value)?.color || '#888888'})} options={courses.map(course=>({id:course.name,label:course.name,color:course.color}))} noneLabel="Sin curso" color="var(--accent)" />
                      </div>
                      {/* Prioridad */}
                      <div className="task-property task-colored-property" data-label="Prioridad" style={{ ...pillBase, ...({"--property-color": prioritySet ? priorityColor : "var(--workspace-line)"} as React.CSSProperties), background: prioritySet ? `${priorityColor}0d` : 'var(--bg-elevated)', border: `1px solid ${prioritySet ? `${priorityColor}30` : 'var(--border-soft)'}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = prioritySet ? `${priorityColor}55` : 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = prioritySet ? `${priorityColor}30` : 'var(--border-soft)'; }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColor, flexShrink: 0, opacity: prioritySet ? 1 : 0.35 }} />
                        <PlanSelectDropdown label="Prioridad de la tarea" value={selectedTask.priority === 'none' ? '' : selectedTask.priority} onChange={value=>updateTask(selectedTask.id,{priority:(value || 'none') as any})} options={[{id:'low',label:'Baja',color:'#10B981'},{id:'medium',label:'Media',color:'#F59E0B'},{id:'high',label:'Alta',color:'#EF4444'}]} noneLabel="Sin prioridad" color="var(--accent)" />
                      </div>
                      {/* Fecha (solo día) */}
                      <div className="task-property task-date-property" data-label="Fecha de entrega" style={{ ...pillBase, gap: 7, background: tr?.overdue ? 'rgba(239,68,68,0.06)' : 'var(--bg-elevated)', border: `1px solid ${tr?.overdue ? 'rgba(239,68,68,0.35)' : 'var(--border-soft)'}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = tr?.overdue ? 'rgba(239,68,68,0.6)' : 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = tr?.overdue ? 'rgba(239,68,68,0.35)' : 'var(--border-soft)'; }}>
                        <CalendarDays size={12} style={{ color: dateColor, flexShrink: 0, opacity: dateVal ? 1 : 0.4 }} />
                        <input type="date" aria-label="Fecha de entrega de la tarea"
                          value={dateVal}
                          onChange={e => {
                            if (!e.target.value) { updateTask(selectedTask.id, { dueDate: undefined }); return; }
                            updateTask(selectedTask.id, { dueDate: hasTime ? `${e.target.value}T${timeVal}` : e.target.value });
                          }}
                          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: dateColor, cursor: 'text', colorScheme: scheme, fontFamily: "'JetBrains Mono', monospace", padding: 0, width: dateVal ? 94 : 84 }}
                        />
                      </div>
                      <div className="task-property task-time-property" style={{...pillBase,border:'1px solid var(--workspace-line)'}}>
                        <label className="task-time-toggle-row"><span>Hora de entrega</span><input type="checkbox" role="switch" aria-label="Activar hora de entrega" disabled={!dateVal} checked={!!hasTime} onChange={e=>updateTask(selectedTask.id,{dueDate:e.target.checked?dateVal+'T'+timeVal:dateVal})}/></label>
                        {hasTime?<TimeControl label="Hora límite de la tarea" value={timeVal} onChange={time=>updateTask(selectedTask.id,{dueDate:time?dateVal+'T'+time:dateVal})}/>:<span className="task-time-empty">{dateVal?'Sin hora':'Elige una fecha'}</span>}
                      </div>
                      {/* Estado (vence en / atrasado) — chip aparte */}
                      <div className="task-property task-study-duration" data-label="Estudio"><TaskDurationField compact minimum={Math.max(1,selectedTask.subtasks.length)} value={taskMinutes(selectedTask.estimatedMinutes)} onChange={estimatedMinutes=>updateTask(selectedTask.id,{estimatedMinutes,...(estimatedMinutes>120?{subtasks:suggestTaskSteps(estimatedMinutes,selectedTask.title,selectedTask.subtasks)}:selectedTask.subtasks.length?{subtasks:distributeSubtaskMinutes(estimatedMinutes,selectedTask.subtasks)}:{})})}/></div>
                      {tr && (
                        <div className="task-deadline-status" style={{ ...pillBase, gap: 6, height: 30, padding: '0 11px', background: tr.overdue ? 'rgba(239,68,68,0.08)' : tr.urgent ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)', border: `1px solid ${tr.overdue ? 'rgba(239,68,68,0.3)' : tr.urgent ? 'rgba(245,158,11,0.3)' : 'var(--border-soft)'}` }}>
                          {tr.overdue && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', flexShrink: 0, boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />}
                          <span style={{ fontSize: 11, fontWeight: 700, color: dateColor, whiteSpace: 'nowrap' }}>{tr.text}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Progreso de estudio (barra fina, solo si hay tiempo) ── */}
                {(() => {
                  const studyMins = Math.round((selectedTask.studyTime || 0) / 60);
                  const estMins = selectedTask.estimatedMinutes || 60;
                  if (studyMins <= 0) return null;
                  const pct = Math.min(100, Math.round((studyMins / estMins) * 100));
                  const progressColor = pct >= 100 ? '#10B981' : taskColor;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 2px 0' }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: progressColor, borderRadius: 2, transition: 'width 0.4s ease', boxShadow: `0 0 8px ${progressColor}60` }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>{pct}% · {studyMins}m / {estMins}m</span>
                    </div>
                  );
                })()}

                {selectedTask.sourceNoteId&&notes.some(note=>note.id===selectedTask.sourceNoteId&&!note.deletedAt)&&<button type="button" className="task-source-note" onClick={()=>{sessionStorage.setItem('apheka_open_note',selectedTask.sourceNoteId!);window.dispatchEvent(new Event('apheka:open-note'));setSelectedTaskId(null);setNavigateTo('apuntes');}}><FileText size={15}/><span>Abrir apunte de origen</span><ChevronRight size={15}/></button>}

                {/* ── Subtareas ── */}
                <div className="bento-card task-detail-section" style={{ padding: 0, background: 'var(--bg-surface)' }}>
                  <div onClick={() => setSectionCollapsed(prev => ({ ...prev, subtareas: !prev.subtareas }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', transition: 'background 150ms', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ transform: `rotate(${sectionCollapsed.subtareas ? -90 : 0}deg)`, transition: 'transform 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronDown size={13} style={{ color: taskColor }} />
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: `${taskColor}10`, border: `1px solid ${taskColor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckSquare size={12} style={{ color: taskColor }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Subtareas</span>
                    {totalSubtasks > 0 && (
                      <>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '1px 9px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.15)' }}>
                          {doneSubtasks}/{totalSubtasks}
                        </span>
                        <div style={{ width: 48, height: 3, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${taskColor}, ${taskColor}88)`, borderRadius: 2, transition: 'width 0.3s ease' }} />
                        </div>
                      </>
                    )}
                  </div>

                  {taskMinutes(selectedTask.estimatedMinutes)>120&&selectedTask.subtasks.length<Math.ceil(taskMinutes(selectedTask.estimatedMinutes)/120)&&<button type="button" className="task-distribute-steps btn-secondary" onClick={()=>{updateTask(selectedTask.id,{subtasks:suggestTaskSteps(taskMinutes(selectedTask.estimatedMinutes),selectedTask.title,selectedTask.subtasks)});setSectionCollapsed(prev=>({...prev,subtareas:false}));}}>Distribuir tiempo en subtareas</button>}
                  {!sectionCollapsed.subtareas && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10 }}>
                        {selectedTask.subtasks.map((st) => (
                          <div key={st.id} className="task-subtask-row" data-done={st.done}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: "11px 13px", borderRadius: 9, background: st.done ? 'rgba(16,185,129,0.08)' : 'var(--bg-surface)', border: `1px solid ${st.done ? 'rgba(16,185,129,0.15)' : 'var(--border-soft)'}`, transition: 'all 150ms', opacity: st.done ? 0.55 : 1 }}
                            onMouseEnter={e => { if (!st.done) { e.currentTarget.style.borderColor = `${taskColor}40`; e.currentTarget.style.background = `${taskColor}06`; } }}
                            onMouseLeave={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-surface)'; } }}>
                            <button data-ui-control="" className="task-subtask-check" aria-label={`Completar subtarea ${st.title}`} aria-pressed={st.done} onClick={() => toggleSubTask(selectedTask.id, st.id)}
                              style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${st.done ? '#10B981' : 'var(--border-strong)'}`, background: st.done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                              onMouseEnter={e => { if (!st.done) { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${taskColor}14`; } }}
                              onMouseLeave={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; } }}>
                              {st.done && <Check size={10} strokeWidth={4} style={{ color: '#fff' }} />}
                            </button>
                            <input aria-label={`Nombre de subtarea ${st.title}`}
                              value={st.title}
                              onChange={e => {
                                const updated = selectedTask.subtasks.map(s => s.id === st.id ? { ...s, title: e.target.value } : s);
                                updateTask(selectedTask.id, { subtasks: updated });
                              }}
                              style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 12.5, fontWeight: st.done ? 400 : 500, color: st.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: st.done ? 'line-through' : 'none', outline: 'none', padding: 0 }}
                            />
                            <label className="task-subtask-minutes"><input key={st.estimatedMinutes} type="number" min={1} max={120} aria-label={'Duración de subtarea '+st.title} defaultValue={st.estimatedMinutes||studyBlockMinutes(selectedTask,st)} onBlur={event=>{const value=Math.max(1,Math.min(120,Math.round(Number(event.target.value)||studyBlockMinutes(selectedTask,st))));event.target.value=String(value);const subtasks=selectedTask.subtasks.map(s=>({...s,estimatedMinutes:s.id===st.id?value:s.estimatedMinutes||studyBlockMinutes(selectedTask,s)}));updateTask(selectedTask.id,{subtasks,estimatedMinutes:subtasks.reduce((sum,s)=>sum+(s.estimatedMinutes||0),0)});}}/>min</label>
                            {!st.done && (
                              <button data-ui-control="" onClick={() => {
                                try {
                                  if (taskLinkUnavailable(selectedTask)) { addNotification(taskLinkUnavailable(selectedTask)!, 'info'); return; }
                                  beginRecommendedStudy(selectedTask.id,'pomodoro',undefined,st.id);
                                } catch (e) {
                                  addNotification('No se pudo vincular la subtarea (almacenamiento lleno).', 'error');
                                  console.error(e);
                                  return;
                                }
                              }}
                                style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0, opacity: 0.4 }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.4'; }}
                                aria-label={`Estudiar subtarea ${st.title}`} disabled={!!taskLinkUnavailable(selectedTask) || !st.title.trim()} title="Estudiar esta subtarea">
                                <Play size={11} fill="#10B981" style={{ color: '#10B981' }} />
                              </button>
                            )}
                            <button data-ui-control="" onClick={() => deleteSubTask(selectedTask.id, st.id)}
                              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0, opacity: 0.4 }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.4'; }}
                              title="Eliminar">
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                        {selectedTask.subtasks.length === 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 7, border: '1px dashed var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, gap: 3 }}>
                            <CheckSquare size={14} style={{ opacity: 0.2 }} />
                            <span style={{ opacity: 0.35 }}>Desglosa la tarea en pasos</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 7 }}>
                        <input
                          value={newSubtaskTitle}
                          onChange={e => setNewSubtaskTitle(e.target.value)}
                          placeholder="Añadir paso..."
                          onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                          style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 7, fontSize: 12, color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms', height: 36 }}
                          onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}14`; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button data-ui-control="" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}
                          style={{ width: 36, height: 36, borderRadius: 7, border: 'none', background: newSubtaskTitle.trim() ? taskColor : 'var(--border-soft)', color: newSubtaskTitle.trim() ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newSubtaskTitle.trim() ? 'pointer' : 'default', transition: 'all 150ms', flexShrink: 0 }}>
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Materiales ── */}
                <div className="bento-card" style={{ padding: 0, background: 'var(--bg-surface)' }}>
                  <div onClick={() => setSectionCollapsed(prev => ({ ...prev, materiales: !prev.materiales }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', transition: 'background 150ms', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ transform: `rotate(${sectionCollapsed.materiales ? -90 : 0}deg)`, transition: 'transform 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronDown size={13} style={{ color: taskColor }} />
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: `${taskColor}10`, border: `1px solid ${taskColor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Paperclip size={12} style={{ color: taskColor }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Materiales</span>
                    {selectedTask.files.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, background: 'var(--bg-hover)', padding: '1px 9px', borderRadius: 4 }}>{selectedTask.files.length} {selectedTask.files.length === 1 ? 'material' : 'materiales'}</span>
                    )}
                  </div>

                  {!sectionCollapsed.materiales && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>

                      {/* Tira de iconos: un tile por material, clic abre, clic derecho menú */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, paddingTop: 10 }}>
                        {selectedTask.files.map(f => {
                          const ext = (f.name || '').split('.').pop()?.toLowerCase() || '';
                          const isLink = f.type === 'link' || (typeof f.path === 'string' && f.path.startsWith('http'));
                          const isYouTube = isLink && (f.path.includes('youtube.com') || f.path.includes('youtu.be'));
                          const isClassroom = f.type === 'classroom' || f.path.includes('classroom.google.com');
                          const isDrive = f.type === 'drive' || f.path.includes('drive.google.com');
                          const isGoogleDocs = f.type === 'doc' || f.path.includes('docs.google.com');
                          const isGoogleSheets = f.type === 'xls' || f.path.includes('sheets.google.com');
                          const isGoogleSlides = f.type === 'ppt' || f.path.includes('slides.google.com');
                          const isGoogleForms = f.path.includes('forms.google.com');
                          const isPdf = f.type === 'pdf' || ext === 'pdf';
                          const isDoc = f.type === 'doc' || (f.type === 'other' && ['doc', 'docx'].includes(ext));
                          const isXls = f.type === 'xls' || (f.type === 'other' && ['xls', 'xlsx', 'csv'].includes(ext));
                          const isPpt = f.type === 'ppt' || (f.type === 'other' && ['ppt', 'pptx'].includes(ext));
                          const isAudio = f.type === 'audio' || (f.type === 'other' && ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext));
                          const isVideo = f.type === 'video' && !isYouTube;
                          const isImage = f.type === 'image' || (f.type === 'other' && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext));
                          const isWeb = isLink && !isYouTube && !isDrive && !isClassroom && !isGoogleDocs && !isGoogleSheets && !isGoogleSlides && !isGoogleForms;

                          const handleTileClick = async () => {
                            try {
                              await openFileSmart(f.path, f.name, {
                                onError: (m) => addNotification(m, 'error'),
                                onMoved: (np) => {
                                  updateTask(selectedTask.id, { files: selectedTask.files.map(x => x.id === f.id ? { ...x, path: np } : x) });
                                  addNotification('Archivo actualizado a su nueva ubicación', 'success');
                                },
                              });
                            } catch { /* noop */ }
                          };

                          const s = (d: string, c: string) => <svg viewBox="0 0 24 24" width={15} height={15} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;
                          let iconEl: React.ReactNode;
                          let badgeColor = '#888';
                          let domain = '';
                          if (isDoc) { badgeColor = '#2563EB'; iconEl = <WordIcon />; }
                          else if (isGoogleDocs) { badgeColor = '#2563EB'; iconEl = <GoogleDocsIcon />; }
                          else if (isXls) { badgeColor = '#10B981'; iconEl = <ExcelIcon />; }
                          else if (isGoogleSheets) { badgeColor = '#10B981'; iconEl = <GoogleSheetsIcon />; }
                          else if (isPpt) { badgeColor = '#F97316'; iconEl = <PowerPointIcon />; }
                          else if (isGoogleSlides) { badgeColor = '#F97316'; iconEl = <GoogleSlidesIcon />; }
                          else if (isPdf) { badgeColor = '#EF4444'; iconEl = s('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704z', '#EF4444'); }
                          else if (isYouTube) { badgeColor = '#EF4444'; iconEl = s('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#EF4444'); }
                          else if (isClassroom) { badgeColor = '#0F9D58'; iconEl = <GoogleClassroomIcon />; }
                          else if (isDrive) { badgeColor = '#4285F4'; iconEl = <GoogleDriveIcon />; }
                          else if (isGoogleForms) { badgeColor = '#7C3AED'; iconEl = <GoogleFormsIcon />; }
                          else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={12} />; }
                          else if (isImage) { badgeColor = '#F59E0B'; iconEl = <Image size={12} />; }
                          else if (isVideo) { badgeColor = '#EC4899'; iconEl = <File size={12} />; }
                          else if (isWeb) {
                            badgeColor = '#10B981';
                            try { domain = new URL(f.path).hostname; } catch {}
                            iconEl = (
                              <span style={{ position: 'relative', width: 15, height: 15, display: 'inline-flex', flexShrink: 0 }}>
                                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                  alt="" style={{ width: 15, height: 15, borderRadius: 3, position: 'absolute', inset: 0 }}
                                  onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.link-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                                <span className="link-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><Link size={11} /></span>
                              </span>
                            );
                          }
                          else { iconEl = <File size={12} />; }

                          const subtitleText = isYouTube ? 'YouTube' : isClassroom ? 'Classroom' : isDrive ? 'Google Drive' : isWeb ? domain : isPdf ? 'PDF' : isDoc ? 'Word' : isGoogleDocs ? 'Google Docs' : isXls ? 'Excel' : isGoogleSheets ? 'Google Sheets' : isPpt ? 'PowerPoint' : isGoogleSlides ? 'Google Slides' : isGoogleForms ? 'Google Forms' : isAudio ? 'Audio' : isImage ? 'Imagen' : isVideo ? 'Video' : f.size ? `${(f.size / 1024).toFixed(0)} KB` : 'Enlace';

                          return (
                            <div key={f.id} onClick={handleTileClick}
                              onContextMenu={(e) => matMenu.openMenu(e, { url: f.path, name: f.name, color: badgeColor })}
                              title={`${f.name}${subtitleText ? ` · ${subtitleText}` : ''}`}
                              style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: `${badgeColor}0d`, border: `1px solid ${badgeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 140ms', flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = `${badgeColor}55`; e.currentTarget.style.transform = 'translateY(-1px)'; const del = e.currentTarget.querySelector('.mat-del') as HTMLElement; if (del) del.style.opacity = '1'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = `${badgeColor}22`; e.currentTarget.style.transform = 'none'; const del = e.currentTarget.querySelector('.mat-del') as HTMLElement; if (del) del.style.opacity = '0'; }}>
                              <span style={{ color: badgeColor, display: 'flex' }}>{iconEl}</span>
                              <button data-ui-control="" className="mat-del" onClick={(e) => { e.stopPropagation(); setConfirmDeleteMaterial({ taskId: selectedTask.id, fileId: f.id }); }}
                                style={{ position: 'absolute', top: -5, right: -5, width: 15, height: 15, borderRadius: '50%', background: '#EF4444', border: '1.5px solid var(--bg-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 140ms', padding: 0 }}
                                title="Eliminar">
                                <X size={8} strokeWidth={3} />
                              </button>
                            </div>
                          );
                        })}
                        {/* Tile + : añadir enlace o subir archivo */}
                        <div onClick={() => { setShowAddMaterial(true); setSectionCollapsed(prev => ({ ...prev, materiales: false })); }}
                          title="Añadir enlace"
                          style={{ width: 38, height: 38, borderRadius: 10, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 140ms', color: 'var(--text-muted)', flexShrink: 0, background: 'transparent' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.color = taskColor; e.currentTarget.style.background = `${taskColor}08`; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                          <Plus size={14} />
                        </div>
                        <div onClick={() => { setSectionCollapsed(prev => ({ ...prev, materiales: false })); handleAddFileBtn(); }}
                          title="Subir archivo"
                          style={{ width: 38, height: 38, borderRadius: 10, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 140ms', color: 'var(--text-muted)', flexShrink: 0, background: 'transparent' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.color = taskColor; e.currentTarget.style.background = `${taskColor}08`; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                          <Upload size={13} />
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} />
                      </div>

                      {showAddMaterial && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 14px', background: `linear-gradient(160deg, ${taskColor}08, transparent)`, borderRadius: 10, border: `1px solid ${taskColor}30`, boxShadow: `0 0 0 3px ${taskColor}0a` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 24, height: 24, borderRadius: 7, background: `${taskColor}12`, border: `1px solid ${taskColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Link2 size={12} style={{ color: taskColor }} />
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Nuevo enlace</span>
                            <button data-ui-control="" onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); }}
                              style={{ width: 26, height: 26, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                              <X size={12} />
                            </button>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Link2 size={12} style={{ position: 'absolute', left: 12, color: taskColor, opacity: 0.8, pointerEvents: 'none' }} />
                            <input value={newMaterialPath} onChange={e => setNewMaterialPath(e.target.value)} placeholder="URL (YouTube, Drive, Classroom...)"
                              onKeyDown={e => { if (e.key === 'Enter' && newMaterialPath.trim()) handleAddMaterial(); }}
                              style={{ width: '100%', padding: '10px 12px 10px 30px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms' }}
                              onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}12`; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }} />
                          </div>
                          <input value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Nombre (opcional — se toma de la URL)"
                            onKeyDown={e => { if (e.key === 'Enter' && newMaterialPath.trim()) handleAddMaterial(); }}
                            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms' }}
                            onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}12`; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }} />
                          <button data-ui-control="" onClick={handleAddMaterial} disabled={!newMaterialPath.trim()}
                            style={{ height: 34, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: taskColor, color: '#fff', opacity: newMaterialPath.trim() ? 1 : 0.35, transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Link2 size={12} /> Añadir enlace
                          </button>
                          <button data-ui-control="" type="button" onClick={() => fileInputRef.current?.click()}
                            style={{ height: 30, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.color = taskColor; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                            <Upload size={11} /> o subir un archivo
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>


              </div>

              {/* ── Footer: Estudiar CTA (fijo, siempre visible) ── */}
              <div style={{ flexShrink: 0, padding: '14px 22px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TaskStudyControls task={selectedTask} assessment={assessments.get(selectedTask.id)} onDuration={minutes=>updateTask(selectedTask.id,{estimatedMinutes:minutes})} onStart={(mode,minutes)=>beginRecommendedStudy(selectedTask.id,mode,minutes)}/>
              </div>
          </div>
          </div>,
          document.body
        );
      })()}

      {/* PORTALED PREVIEW MODAL */}
      {(() => {
        const url = previewModalUrl || pdfPreviewUrl || '';
        const isWebUrl = url.startsWith('http') && !url.includes('youtube.com/embed');
        if (!url) return null;

        // Identidad estable entre renders (el reloj re-renderiza cada segundo y antes
        // desmontaba/remontaba el iframe del preview en cada tick).
        const MiniBrowser = useMemo(() => () => {
          const [navUrl, setNavUrl] = useState(url);
          const [currentUrl, setCurrentUrl] = useState(url);
          const [canGoBack, setCanGoBack] = useState(false);
          const [canGoForward, setCanGoForward] = useState(false);
          const historyRef = useRef<string[]>([url]);
          const positionRef = useRef(0);
          const iframeRef = useRef<HTMLIFrameElement>(null);

          const navigate = (newUrl: string) => {
            const fullUrl = newUrl.startsWith('http://') || newUrl.startsWith('https://') ? newUrl : `https://${newUrl}`;
            setCurrentUrl(fullUrl);
            setNavUrl(fullUrl);
            historyRef.current = historyRef.current.slice(0, positionRef.current + 1);
            historyRef.current.push(fullUrl);
            positionRef.current = historyRef.current.length - 1;
            setCanGoBack(positionRef.current > 0);
            setCanGoForward(false);
          };

          const goBack = () => {
            if (positionRef.current <= 0) return;
            positionRef.current--;
            const prev = historyRef.current[positionRef.current];
            setCurrentUrl(prev);
            setNavUrl(prev);
            setCanGoBack(positionRef.current > 0);
            setCanGoForward(true);
          };

          const goForward = () => {
            if (positionRef.current >= historyRef.current.length - 1) return;
            positionRef.current++;
            const next = historyRef.current[positionRef.current];
            setCurrentUrl(next);
            setNavUrl(next);
            setCanGoBack(true);
            setCanGoForward(positionRef.current < historyRef.current.length - 1);
          };

          const refresh = () => setCurrentUrl(prev => prev + (prev.includes('?') ? '&_t=' : '?_t=') + Date.now());

          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') navigate(navUrl);
          };

          return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Browser Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <button data-ui-control="" onClick={goBack} disabled={!canGoBack} title="Atrás"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: canGoBack ? 'var(--text-primary)' : 'var(--text-muted)', cursor: canGoBack ? 'pointer' : 'default', display: 'flex', opacity: canGoBack ? 1 : 0.3 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button data-ui-control="" onClick={goForward} disabled={!canGoForward} title="Adelante"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: canGoForward ? 'var(--text-primary)' : 'var(--text-muted)', cursor: canGoForward ? 'pointer' : 'default', display: 'flex', opacity: canGoForward ? 1 : 0.3 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
                <button data-ui-control="" onClick={refresh} title="Recargar"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                </button>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input value={navUrl} onChange={e => setNavUrl(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Buscar o escribir URL..."
                    style={{ width: '100%', padding: '5px 10px 5px 26px', borderRadius: 6, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', fontSize: 11, color: 'var(--text-primary)', outline: 'none' }} />
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
                <button data-ui-control="" onClick={() => window.open(currentUrl, '_blank')} title="Abrir en navegador externo"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                  <ExternalLink size={12} />
                </button>
              </div>
              {/* Content */}
              <div style={{ flex: 1, background: 'var(--bg-elevated)' }}>
                {currentUrl.startsWith('http') ? (
                  <iframe ref={iframeRef} src={currentUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Mini navegador" allow="autoplay; encrypted-media" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
                ) : currentUrl.startsWith('data:') || currentUrl.startsWith('blob:') ? (
                  pdfPreviewUrl ? (
                    <iframe src={currentUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                  ) : (
                    <img src={currentUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-tertiary)' }}>
                    <Eye size={28} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Archivo local — usa el botón de abrir</span>
                  </div>
                )}
              </div>
            </div>
          );
        }, [url, pdfPreviewUrl]);

        return createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99995, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
            onClick={() => { setPdfPreviewUrl(null); setPreviewModalUrl(null); }}>
            <div className="bento-card" style={{ width: '94%', maxWidth: 1000, height: '85vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-soft)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={13} style={{ color: 'var(--accent)' }} /> Vista previa
                </span>
                <button data-ui-control="" onClick={() => { setPdfPreviewUrl(null); setPreviewModalUrl(null); }} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
              </div>
              {isWebUrl ? <MiniBrowser /> : (
                <div style={{ flex: 1, background: 'var(--bg-elevated)' }}>
                  {url.startsWith('http') ? (
                    <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" allow="autoplay; encrypted-media" />
                  ) : url.startsWith('data:') || url.startsWith('blob:') ? (
                    pdfPreviewUrl ? (
                      <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                    ) : (
                      <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-tertiary)' }}>
                      <Eye size={28} style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>Archivo local</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* CONFIRM DELETE MATERIAL (Portaled) */}
      {confirmDeleteMaterial && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmDeleteMaterial(null)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 320, padding: '20px 24px', textAlign: 'center', border: '1px solid var(--border-soft)', background: 'var(--bg-primary)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <AlertTriangle size={16} style={{ color: '#EF4444' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Eliminar material</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }}>¿Estás seguro de eliminar este material?</span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteMaterial(null)} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button data-ui-control="" onClick={() => { removeTaskFile(confirmDeleteMaterial.taskId, confirmDeleteMaterial.fileId); setConfirmDeleteMaterial(null); }} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE TASK (Portaled) */}
      {confirmDeleteTask && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmDeleteTask(null)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 320, padding: '20px 24px', textAlign: 'center', border: '1px solid var(--border-soft)', background: 'var(--bg-primary)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <AlertTriangle size={16} style={{ color: '#EF4444' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Eliminar tarea</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }}>¿Estás seguro de eliminar esta tarea?</span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteTask(null)} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button data-ui-control="" onClick={() => { deleteTask(confirmDeleteTask); setSelectedTaskId(null); setConfirmDeleteTask(null); }} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

