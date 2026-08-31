import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Check, Trash2,
  ChevronRight, CalendarDays,
  Clock, List as ListIcon, FileText,
  Link, Video, File, X, Upload, Link2,
  ExternalLink,   Eye, EyeOff, Filter,
  ClipboardList, ChevronLeft, Timer,
  Paperclip, StickyNote,
  Zap, Circle, CheckCircle, Loader,
  AlertTriangle,
  ArrowUp, ArrowDown, CheckSquare,
  LayoutGrid, Calendar, Play, Activity,
  TrendingUp, Flame, ListTodo, Image, Music, FileSpreadsheet,
  Star, Pencil, ChevronDown, Globe,
  BookOpen, Bookmark, Minus,
} from 'lucide-react';
import { useApp, Task, fmtClock } from '../../store/AppContext';
import { openFileSmart, pickAndPersistFile } from '../../lib/openFileSmart';
import { fuzzyMatch } from '../../lib/fuzzy';
import { useMaterialMenu } from '../ui/MaterialContextMenu';
import { isTauri, convertFileSrc } from '@tauri-apps/api/core';
import { BRAIN_DROP_MIME, writeBrainAnchor } from '../../lib/brainDrop';
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
  mm: (c = 'var(--text-tertiary)') => ({ fontSize: 9, fontWeight: 600, color: c, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }),
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
  const parsed = localDate(dueDate);
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
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children({ isDragging })}</div>;
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
  const { tasks, courses, notes, addTask, updateTask, toggleTaskStatus, deleteTask, addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, clearAllTasks, addNotification, setNavigateTo, focusedTaskId, setFocusedTaskId, settings, addNote, updateNote, activePlannedSessionId, activeTaskId, setPipUrl } = useApp();
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTaskPrefillDate, setNewTaskPrefillDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>(() => {
    try { return (localStorage.getItem('owa_tasks_view') as 'list' | 'board' | 'calendar') || 'list'; } catch { return 'list'; }
  });
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

  const [showApuntesEditor, setShowApuntesEditor] = useState(false);

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
  useEffect(() => { localStorage.setItem('owa_tasks_view', viewMode); }, [viewMode]);
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

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

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

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (courseFilter) filtered = filtered.filter(t => t.course === courseFilter);
    if (searchQuery) filtered = filtered.filter(t => fuzzyMatch(t.title, searchQuery));
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
  }, [tasks, courseFilter, searchQuery, sortBy, shouldHideCompleted]);

  const { reorderTasks } = useApp();
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
    e.dataTransfer.setData(BRAIN_DROP_MIME, writeBrainAnchor('task', taskId));
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

  const handleCreateTask = useCallback(() => {
    const title = (document.getElementById('new-task-title') as HTMLInputElement)?.value?.trim();
    const courseSelect = document.getElementById('new-task-course') as HTMLSelectElement;
    const prioritySelect = document.getElementById('new-task-priority') as HTMLSelectElement;
    const dueDateInput = document.getElementById('new-task-duedate') as HTMLInputElement;
    const dueTimeInput = document.getElementById('new-task-duetime') as HTMLInputElement;
    const estimatedInput = document.getElementById('new-task-estimated') as HTMLInputElement;
    if (!title) { addNotification('Ingresa un título', 'error'); return; }
    const courseName = courseSelect?.value || 'Sin curso';
    const course = courses.find(c => c.name === courseName);
    let dueDate: string | undefined = undefined;
    if (dueDateInput?.value) {
      dueDate = includeTime && dueTimeInput?.value ? `${dueDateInput.value}T${dueTimeInput.value}` : dueDateInput.value;
    }
    addTask({ title, course: courseName, courseColor: course?.color || (courseName === 'Sin curso' ? 'var(--text-muted)' : '#E11D48'), priority: (prioritySelect?.value as any) || 'none', urgent: (prioritySelect?.value as any) === 'high', important: (prioritySelect?.value as any) === 'high', dueDate, estimatedMinutes: estimatedInput?.value ? parseInt(estimatedInput.value) : 60 });
    setShowNewModal(false);
  }, [addTask, courses, includeTime]);

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

  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekRows: Date[][] = [];
  if (calendarSubMode === 'semana') {
    const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(calendarDate, { weekStartsOn: 1 });
    weekRows.push(eachDayOfInterval({ start: weekStart, end: weekEnd }));
  } else {
    for (let i = 0; i < calendarDays.length; i += 7) weekRows.push(calendarDays.slice(i, i + 7));
  }

  const timeStr = fmtClock(format(currentTime, 'HH:mm'), settings?.timeFormat);
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM", { locale: es });
  const dateStrCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const courseDistribution = useMemo(() => {
    const map: Record<string, { count: number; color: string }> = {};
    tasks.forEach(t => { if (!map[t.course]) map[t.course] = { count: 0, color: t.courseColor }; map[t.course].count++; });
    return Object.entries(map).map(([name, { count, color }]) => ({ name, count, color, pct: tasks.length ? Math.round((count / tasks.length) * 100) : 0 })).sort((a, b) => b.count - a.count);
  }, [tasks]);

  const totalEst = useMemo(() => {
    const mins = tasks.filter(t => t.status !== 'completado').reduce((a, t) => a + (t.estimatedMinutes || 0), 0);
    return { h: Math.floor(mins / 60), m: mins % 60 };
  }, [tasks]);

  const weeklyHours = useMemo(() => {
    const dayNames = ['L','M','X','J','V','S','D'];
    return dayNames.map((d, i) => ({ l: d, h: [30, 55, 40, 75, 25, 10, 5][i] }));
  }, []);

  const statusData = [
    { label: 'Completadas', val: stats.completadas, color: '#10B981' },
    { label: 'Pendientes', val: stats.pendientes, color: '#F59E0B' },
    { label: 'En progreso', val: stats.progreso, color: '#3B82F6' },
  ].filter(s => s.val > 0);
  const totalStatus = statusData.reduce((a, s) => a + s.val, 0);

  return (
    <div className="page-container flex flex-col h-full overflow-y-auto custom-scroll" style={{ gap: 20 }}>

      {/* HEADER */}
      <header className="bento-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '14px 20px', flexShrink: 0, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 300, fontSize: 32, lineHeight: 1.4, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>Tareas</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <NotificationBell />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200, lineHeight: 0.9, color: 'var(--accent)', letterSpacing: '0.02em', textShadow: '0 0 20px var(--accent-glow)' }}>{timeStr}</span>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200, color: 'var(--accent)', opacity: 0.6, letterSpacing: '0.02em' }}>{secondsStr}</span>
            </div>
          </div>
        </div>
      </header>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
        <div className="bento-card" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'list', label: 'Lista', icon: ListIcon },
            { id: 'board', label: 'Tablero', icon: LayoutGrid },
            { id: 'calendar', label: 'Calendario', icon: Calendar },
          ].map(m => {
            const active = viewMode === m.id;
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setViewMode(m.id as any)}
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
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}><X size={10} /></button>}
          </div>

          {/* Eye toggle — click toggles hide/show completed tasks */}
            <button
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

          <button onClick={() => setShowNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 14px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', transition: 'all 200ms' }}>
            <Plus size={14} /> Agregar tarea
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'calendar' ? '1fr' : '1fr 280px', gap: 16, flex: 1 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* LIST VIEW */}
        {viewMode === 'list' && (
            <div className="bento-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, flex: 1 }}>
              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '11px 18px 11px 8px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'var(--bg-elevated)', borderRadius: '12px 12px 0 0' }}>
                <span style={{ width: 36, flexShrink: 0 }} />
                <span style={{ flex: 4, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>Tarea</span>
                <span style={{ flex: 2.2, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Curso</span>
                <span style={{ flex: 0.8, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Prioridad</span>
                <span style={{ flex: 1.5, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Fecha</span>
                <span style={{ width: 30, flexShrink: 0 }} />
              </div>
              {/* Rows */}
              <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
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
                  <DndContext sensors={listSensors} collisionDetection={pointerWithin} onDragStart={e => { setActiveDragId(e.active.id as string); }} onDragEnd={handleDragEndList} modifiers={[restrictToParentElement]}>
                    <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {filteredTasks.map(task => {
                        const t = task;
                        const tr = t.dueDate ? getTimeRemaining(t.dueDate) : null;
                        const isDone = t.status === 'completado';
                        const isOverdue = tr?.overdue && !isDone;
                        const titleColor = isDone ? 'rgba(255,255,255,0.35)' : 'var(--text-primary)';
                        const dateColor = isDone ? '#10B981' : (isOverdue ? '#EF4444' : 'var(--text-secondary)');
                        const stripColor = statusConfig[t.status]?.color || '#F59E0B';
                        const bgStatus = isDone ? 'rgba(16,185,129,0.03)' : 'transparent';
                        const isDragging = activeDragId === t.id;
                        return (
                          <SortableTaskRow key={t.id} task={t}>
                            {({ isDragging: isDndDragging }) => (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0', minHeight: 50, borderBottom: '1px solid var(--border-soft)', background: selectedTaskId === t.id ? `${stripColor}06` : bgStatus, transition: 'all 120ms', opacity: isDndDragging ? 0.4 : 1, userSelect: 'none', WebkitUserSelect: 'none' }}
                                className="hover:bg-white/[0.025]">
                                {/* Left toggle strip — cuadrado centrado */}
                                <div
                                  onClick={(e) => { e.stopPropagation(); if (dragSuppressRef.current) return; handleToggle(e, t.id); }}
                                  style={{ width: 32, height: 32, flexShrink: 0, background: isDone ? '#10B981' : t.status === 'progreso' ? '#3B82F6' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, margin: 'auto 0 auto 4px', transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)', border: `1.5px solid ${isDone ? '#10B981' : t.status === 'progreso' ? '#3B82F6' : `${stripColor}55`}`, boxShadow: isDone ? '0 0 0 3px #10B98118' : t.status === 'progreso' ? '0 0 0 3px #3B82F618' : 'none' }}
                                  onMouseEnter={e => { if (!isDone && t.status !== 'progreso') { e.currentTarget.style.borderColor = `${stripColor}88`; e.currentTarget.style.transform = 'scale(1.06)'; } }}
                                  onMouseLeave={e => { if (!isDone && t.status !== 'progreso') { e.currentTarget.style.borderColor = `${stripColor}55`; e.currentTarget.style.transform = 'scale(1)'; } }}>
                                  {isDone && <Check size={14} strokeWidth={2.5} style={{ color: '#fff' }} />}
                                  {t.status === 'progreso' && <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.92)', boxShadow: '0 0 8px rgba(255,255,255,0.35)' }} />}
                                </div>
                                {/* Content area — click opens detail */}
                                <div onClick={(e) => { e.stopPropagation(); if (dragSuppressRef.current) return; handleOpenDetail(t.id); }}
                                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, padding: '0 18px 0 12px', minHeight: 50, cursor: 'pointer', minWidth: 0 }}>
                                  <div style={{ flex: 4, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: titleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isDone ? 'line-through' : 'none' }}>
                                      {t.title}
                                    </span>
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
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em', background: t.priority === 'high' ? 'rgba(239,68,68,0.15)' : t.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: t.priority === 'high' ? '#EF4444' : t.priority === 'medium' ? '#F59E0B' : '#10B981' }}>
                                      {t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja'}
                                    </span>
                                    ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 400, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
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

          {/* BOARD VIEW - KANBAN */}
          {viewMode === 'board' && (
            <div style={{ display: 'flex', gap: 10, minHeight: 300 }}>
              {[
                { status: 'inicio', label: 'Pendientes', color: '#F59E0B' },
                { status: 'progreso', label: 'En Curso', color: '#3B82F6' },
                { status: 'completado', label: 'Completadas', color: '#10B981' },
              ].map(col => {
                const colTasks = tasks.filter(t => t.status === col.status && !shouldHideCompleted(t));
                return (
                  <div key={col.status} className="bento-card"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) {
                        const newStatus = col.status === 'completado' ? 'completado' : col.status === 'progreso' ? 'progreso' : 'inicio';
                        // Fija/limpia completedAt igual que toggleTaskStatus (si no, las completadas nunca se ocultan)
                        updateTask(taskId, { status: newStatus, completedAt: newStatus === 'completado' ? new Date().toISOString() : undefined });
                      }
                    }}
                    style={{ flex: '1 1 0', minWidth: 0, width: 0, overflow: 'hidden', padding: '14px 12px', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.color, boxShadow: `0 0 6px ${col.color}60` }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>{col.label}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${col.color}15`, color: col.color }}>{colTasks.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 200, maxHeight: 'calc(100vh - 320px)' }} className="no-scrollbar">
                      {isInitialLoading ? [1,2,3].map((_, i) => (
                        <div key={i} style={{ padding: '14px 14px 12px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', marginTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ width: 60, height: 9, borderRadius: 6, background: 'rgba(255,255,255,0.05)', animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 120}ms` }} />
                            <div style={{ width: 50, height: 9, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 120 + 100}ms` }} />
                          </div>
                          <div style={{ width: '80%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10, animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 120 + 50}ms` }} />
                          <div style={{ width: 40, height: 9, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 120 + 150}ms` }} />
                        </div>
                      )) : colTasks.map((task, i) => {
                        const tr = task.dueDate ? getTimeRemaining(task.dueDate) : null;
                        return (
                        <div key={task.id} className="board-card hover:bg-white/[0.03]" draggable onDragStart={e => handleDragStart(e, task.id)} onDragEnd={handleDragEnd} onClick={() => { if (dragSuppressRef.current) { dragSuppressRef.current = false; return; } handleOpenDetail(task.id); }}
                          style={{
                            position: 'relative',
                            padding: '14px 14px 12px',
                            borderRadius: 10,
                            background: 'var(--bg-base)',
                            border: `1px solid ${task.status === 'completado' ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer',
                            transition: 'all 200ms',
                            flexShrink: 0,
                            overflow: 'hidden',
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            marginTop: 4,
                            opacity: draggingTaskId === task.id ? 0.35 : 1,
                          }}>
                          {/* Curso + Tiempo restante — juntos en fila superior */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            {task.course && task.course !== 'Sin curso' ? (
                            <span style={{ fontSize: 8, fontWeight: 600, color: task.courseColor, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: task.courseColor, flexShrink: 0 }} />
                              {task.course}
                            </span>
                            ) : (
                            <span style={{ fontSize: 8, fontWeight: 400, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              Sin curso
                            </span>
                            )}
                            {tr && (
                              <span style={{ fontSize: 8, fontWeight: 700, color: tr.urgent ? '#EF4444' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Timer size={9} />
                                {tr.text}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <div style={{ fontSize: 12, fontWeight: 600, color: task.status === 'completado' ? 'var(--text-tertiary)' : 'var(--text-primary)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'completado' ? 'line-through' : 'none' }}>
                            {task.title}
                          </div>

                          {/* Bottom row: prioridad + toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              {task.priority === 'none' && (
                                <span style={{ fontSize: 8, fontWeight: 400, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin prioridad</span>
                              )}
                              {task.priority === 'high' && (
                                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>ALTA</span>
                              )}
                              {task.priority === 'medium' && (
                                <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>MEDIA</span>
                              )}
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleToggle(e, task.id); }}
                              style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${task.status === 'completado' ? '#10B981' : statusConfig[task.status]?.color || 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: task.status === 'completado' ? '#10B981' : 'transparent' }}>
                              {task.status === 'completado' && <Check size={8} strokeWidth={3} style={{ color: '#fff' }} />}
                            </button>
                          </div>
                        </div>
                      )})}
                      {!isInitialLoading && colTasks.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 3, padding: '32px 0', color: 'var(--text-muted)' }}>
                          <div style={{ width: 4, height: 16, borderRadius: 2, background: 'var(--border-soft)' }} />
                          <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>Vacío</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <div className="bento-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', padding: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
              {/* Calendar Header */}
              <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-soft)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => { setCalendarDate(new Date()); const todayTasks = tasks.filter(t => t.dueDate && isSameDay(localDate(t.dueDate), new Date())); if (todayTasks.length > 0) setCalendarSelectedDay(new Date()); else setCalendarSelectedDay(new Date(0)); }} style={{ fontSize: 11, fontWeight: 500, padding: '5px 14px', borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'all 150ms' }}>Hoy</button>
                  <div style={{ display: 'flex', gap: 1 }}>
                    <button onClick={handlePrevPeriod} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}><ChevronLeft size={14} /></button>
                    <button onClick={handleNextPeriod} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}><ChevronRight size={14} /></button>
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", textTransform: 'capitalize', margin: 0 }}>{format(calendarDate, 'MMMM yyyy', { locale: es })}</h2>
                </div>
                <div style={{ display: 'flex', gap: 4, padding: 2, borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)' }}>
                  {[
                    { id: 'mes', label: 'Mes' },
                    { id: 'semana', label: 'Semana' },
                  ].map(m => (
                    <button key={m.id} onClick={() => setCalendarSubMode(m.id as any)}
                      style={{ padding: '3px 10px', borderRadius: 4, fontSize: 9, fontWeight: 500, cursor: 'pointer', border: 'none', background: calendarSubMode === m.id ? 'var(--accent-dim)' : 'transparent', color: calendarSubMode === m.id ? 'var(--accent)' : 'var(--text-muted)' }}>{m.label}</button>
                  ))}
                </div>
              </div>

              {/* Selected Day — sidebar derecha premium */}
              {calendarSelectedDay.getTime() > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 300,
                  height: '100%',
                  background: 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border-default)',
                  borderRadius: '0 12px 12px 0',
                  padding: '22px 18px',
                  boxShadow: '-6px 0 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02) inset',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  animation: 'slideInRight 200ms ease-out',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-soft)' }}>
                        <CalendarDays size={15} style={{ color: 'var(--accent)', strokeWidth: 1.5 }} />
                      </div>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', display: 'block', lineHeight: 1.3, fontFamily: "'Inter Tight', sans-serif" }}>
                          {format(calendarSelectedDay, "EEEE d", { locale: es })}
                        </span>
                        <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-muted)' }}>
                          {tasks.filter(t => t.dueDate && isSameDay(localDate(t.dueDate), calendarSelectedDay)).length} tareas
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setCalendarSelectedDay(new Date(0))} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 200ms', opacity: 0.6 }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'var(--bg-hover)'; }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 2 }}>
                    {(() => {
                      const dayTasks = tasks.filter(t => t.dueDate && isSameDay(localDate(t.dueDate), calendarSelectedDay));
                      if (dayTasks.length === 0) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, padding: '32px 0', color: 'var(--text-muted)' }}>
                            <div style={{ width: 6, height: 24, borderRadius: 3, background: 'var(--border-soft)' }} />
                            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sin tareas este día</span>
                          </div>
                        );
                      }
                      return dayTasks.map(task => {
                        const tr = task.dueDate ? getTimeRemaining(task.dueDate) : null;
                        return (
                          <div key={task.id} onClick={() => handleOpenDetail(task.id)}
                            style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${task.courseColor}`, cursor: 'pointer', transition: 'all 150ms', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
                            className="hover:bg-white/[0.02]">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 500, color: task.status === 'completado' ? 'var(--text-tertiary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'completado' ? 'line-through' : 'none' }}>
                                  {task.title}
                                </span>
                              </div>
                              <button onClick={e => { e.stopPropagation(); handleToggle(e, task.id); }}
                                style={{ flexShrink: 0, width: 15, height: 15, borderRadius: 4, border: `2px solid ${task.status === 'completado' ? '#10B981' : statusConfig[task.status]?.color || 'var(--border-default)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: task.status === 'completado' ? '#10B981' : 'transparent', transition: 'all 120ms' }}>
                                {task.status === 'completado' && <Check size={7} strokeWidth={3} style={{ color: '#fff' }} />}
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {task.course && task.course !== 'Sin curso' ? (
                              <span style={{ fontSize: 8.5, fontWeight: 500, color: task.courseColor, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: task.courseColor, flexShrink: 0, boxShadow: `0 0 4px ${task.courseColor}50` }} />
                                {task.course}
                              </span>
                              ) : (
                              <span style={{ fontSize: 8.5, fontWeight: 400, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontStyle: 'italic' }}>
                                Sin curso
                              </span>
                              )}
                              {task.priority === 'high' && (
                                <span style={{ fontSize: 7.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'color-mix(in srgb, #EF4444 12%, transparent)', color: '#EF4444' }}>ALTA</span>
                              )}
                              {task.priority === 'none' && (
                                <span style={{ fontSize: 7.5, fontWeight: 400, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin prioridad</span>
                              )}
                              {tr && (
                                <span style={{ fontSize: 8.5, fontWeight: 500, color: tr.urgent ? '#EF4444' : 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                  {tr.text}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-soft)', flexShrink: 0 }}>
                    <div onClick={() => { setNewTaskPrefillDate(format(calendarSelectedDay, 'yyyy-MM-dd')); setShowNewModal(true); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '9px 0', borderRadius: 8, fontSize: 10.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', border: '1px dashed var(--border-default)', color: 'var(--text-muted)', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
                      <Plus size={12} /> Agregar tarea este día
                    </div>
                  </div>
                </div>
              )}

              {/* Day Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => {
                  const headerDay = addDays(startOfWeek(calendarDate, { weekStartsOn: 1 }), i);
                  const isHeaderToday = isToday(headerDay);
                  return (
                    <div key={d} style={{ padding: '10px 0 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'var(--bg-surface)' }}>
                      <span style={{ fontSize: 10, fontWeight: isHeaderToday ? 700 : 600, color: isHeaderToday ? 'var(--accent)' : (i >= 5 ? 'color-mix(in srgb, #EF4444 35%, transparent)' : 'var(--text-muted)'), letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>{d}</span>
                      <span style={{ width: isHeaderToday ? 16 : 0, height: 2.5, borderRadius: 2, background: isHeaderToday ? 'var(--accent)' : 'transparent', opacity: isHeaderToday ? 1 : 0, boxShadow: isHeaderToday ? '0 0 6px var(--accent)' : 'none' }} />
                    </div>
                  );
                })}
              </div>

              {/* Calendar Grid — más vertical */}
              <DndContext sensors={calendarSensors} collisionDetection={pointerWithin} onDragStart={e => setCalendarDragTaskId(e.active.id as string)} onDragEnd={handleDragEndCalendar}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {weekRows.map((week, wi) => {
                  return (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, minHeight: 0 }}>
                      {week.map((day, di) => {
                        const dayTasks = tasks.filter(t => t.dueDate && isSameDay(localDate(t.dueDate), day));
                        const isTodayDay = isToday(day);
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isSel = isSameDay(day, calendarSelectedDay);
                        const maxVisible = calendarSubMode === 'semana' ? 8 : 4;
                        const visibleTasks = dayTasks.slice(0, maxVisible);
                        const overflow = dayTasks.length - maxVisible;
                        const cellBg = isSel ? 'var(--accent-dim)' : isTodayDay ? 'color-mix(in srgb, var(--accent) 2%, transparent)' : 'transparent';
                        const isWeekend = di >= 5;
                        return (
                          <DroppableCalendarDay key={di} id={`day-${format(day, 'yyyy-MM-dd')}`}>
                            {({ setNodeRef, isOver }) => (
                              <div ref={setNodeRef}
                                onClick={() => setCalendarSelectedDay(day)}
                                style={{
                                  borderRight: '1px solid var(--border-soft)',
                                  borderBottom: '1px solid var(--border-soft)',
                                  padding: calendarSubMode === 'semana' ? '8px 8px' : '4px 6px',
                                  cursor: 'pointer',
                                  background: isOver ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : cellBg,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  minHeight: calendarSubMode === 'semana' ? 260 : 110,
                                  overflow: 'hidden',
                                  position: 'relative',
                                  borderTop: isTodayDay ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid transparent',
                                  borderLeft: isSel ? '1px solid var(--accent-dim)' : di === 0 ? '1px solid var(--border-soft)' : 'none',
                                  transition: 'background 150ms',
                                  outline: isOver ? '1.5px solid var(--accent)' : 'none',
                                  outlineOffset: -1.5,
                                }}>
                                {/* Day Number */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, flexShrink: 0 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <span style={{
                                      fontSize: calendarSubMode === 'semana' ? 13 : 11,
                                      fontWeight: isTodayDay ? 700 : (isSel ? 700 : 400),
                                      color: isTodayDay ? '#fff' : (isSel ? 'var(--text-primary)' : isCurrentMonth ? (isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)') : 'var(--text-muted)'),
                                      width: 26, height: 26,
                                      borderRadius: '50%',
                                      background: isTodayDay ? `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #fff))` : (isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'),
                                      boxShadow: isTodayDay ? '0 0 10px color-mix(in srgb, var(--accent) 45%, transparent), 0 2px 6px rgba(0,0,0,0.3)' : 'none',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>{format(day, 'd')}</span>
                                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: isTodayDay ? 'var(--accent)' : (isSel ? 'color-mix(in srgb, var(--accent) 60%, transparent)' : 'transparent'), boxShadow: isTodayDay ? '0 0 6px var(--accent)' : 'none', transition: 'background 150ms' }} />
                                  </div>
                                </div>
                                {/* Task cards */}
                                {dayTasks.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflow: 'hidden', paddingTop: calendarSubMode === 'semana' ? 4 : 2 }}>
                                    {visibleTasks.map(task => {
                                      const isOverdueCal = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completado';
                                      return calendarSubMode === 'semana' ? (
                                        <DraggableCalendarTask key={task.id} id={task.id}>
                                          {({ attributes, listeners, setNodeRef: dragRef, isDragging }) => (
                                            <div ref={dragRef} {...attributes} {...listeners}
                                              onClick={(e) => { e.stopPropagation(); setCalendarSelectedDay(day); handleOpenDetail(task.id); }}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                borderRadius: 5,
                                                padding: '3px 8px',
                                                fontSize: 11,
                                                fontWeight: 500,
                                                color: task.status === 'completado' ? 'rgba(255,255,255,0.3)' : '#fff',
                                                background: task.status === 'completado' ? 'rgba(255,255,255,0.03)' : (isOverdueCal ? 'rgba(239,68,68,0.2)' : `${task.courseColor}18`),
                                                borderLeft: `2px solid ${isOverdueCal ? '#EF4444' : task.courseColor}`,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                lineHeight: '24px',
                                                cursor: isDragging ? 'grabbing' : 'grab',
                                                flexShrink: 0,
                                                textDecoration: task.status === 'completado' ? 'line-through' : 'none',
                                                transition: 'all 120ms',
                                                opacity: isDragging ? 0.4 : 1,
                                              }}
                                              className="hover:brightness-125">
                                              {(() => {
                                                const hasExplicitTime = task.dueDate && !task.dueDate.endsWith('T23:59');
                                                const timeLabel = hasExplicitTime ? format(localDate(task.dueDate as string), 'HH:mm') : null;
                                                return (
                                                  <>
                                                    {timeLabel && (
                                                      <span style={{
                                                        fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                                                        color: task.status === 'completado' ? 'rgba(255,255,255,0.25)' : (isOverdueCal ? '#EF4444' : task.courseColor),
                                                        flexShrink: 0, opacity: 0.85,
                                                      }}>{timeLabel}</span>
                                                    )}
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{task.title}</span>
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          )}
                                        </DraggableCalendarTask>
                                      ) : (
                                        <DraggableCalendarTask key={task.id} id={task.id}>
                                          {({ attributes, listeners, setNodeRef: dragRef, isDragging }) => (
                                            <div ref={dragRef} {...attributes} {...listeners}
                                              onClick={(e) => { e.stopPropagation(); setCalendarSelectedDay(day); handleOpenDetail(task.id); }}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                height: 18,
                                                borderRadius: 3,
                                                padding: '0 6px',
                                                cursor: isDragging ? 'grabbing' : 'grab',
                                                flexShrink: 0,
                                                background: isOverdueCal ? 'rgba(239,68,68,0.15)' : `${task.courseColor}15`,
                                                borderLeft: `2px solid ${isOverdueCal ? '#EF4444' : task.courseColor}`,
                                                transition: 'all 120ms',
                                                opacity: isDragging ? 0.4 : 1,
                                              }}
                                              className="hover:brightness-125">
                                              <span style={{
                                                width: 5, height: 5, borderRadius: '50%',
                                                background: isOverdueCal ? '#EF4444' : task.courseColor,
                                                flexShrink: 0,
                                              }} />
                                              <span style={{
                                                fontSize: 8,
                                                fontWeight: 600,
                                                color: task.status === 'completado' ? 'rgba(255,255,255,0.25)' : (isOverdueCal ? '#EF4444' : task.courseColor),
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                textDecoration: task.status === 'completado' ? 'line-through' : 'none',
                                              }}>
                                                {task.title}
                                              </span>
                                            </div>
                                          )}
                                        </DraggableCalendarTask>
                                      );
                                    })}
                                    {overflow > 0 && (
                                      <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-muted)', padding: '0 4px', flexShrink: 0 }}>+{overflow} más</div>
                                    )}
                                  </div>
                                )}
                                {dayTasks.length === 0 && calendarSubMode === 'semana' && (
                                  <div style={{ flex: 1 }} />
                                )}
                              </div>
                            )}
                          </DroppableCalendarDay>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]} style={{ position: 'fixed', pointerEvents: 'none', zIndex: 1000 }}>
                {calendarDragTaskId ? (() => {
                  const t = tasks.find(x => x.id === calendarDragTaskId);
                  if (!t) return null;
                  const isOverdueCal = t.dueDate && localDate(t.dueDate).getTime() < Date.now() && t.status !== 'completado';
                  return (
                    <div style={{
                      borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 500,
                      lineHeight: '24px',
                      color: '#fff',
                      background: isOverdueCal ? 'rgba(239,68,68,0.4)' : `${t.courseColor}30`,
                      borderLeft: `2px solid ${isOverdueCal ? '#EF4444' : t.courseColor}`,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                      textDecoration: t.status === 'completado' ? 'line-through' : 'none',
                      maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.title}
                    </div>
                  );
                })() : null}
              </DragOverlay>
              </DndContext>
            </div>
          )}

        </div>

        {/* RIGHT PANEL */}
        {(viewMode === 'list' || viewMode === 'board') && (
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, justifyContent: 'flex-start', alignItems: 'stretch' }}>
          {(() => {
            const isBoard = viewMode === 'board';
            const sz = isBoard ? 130 : 170;
            const labelSz = isBoard ? 12 : 14;
            const innerSz = isBoard ? 12 : 24;
            return (
              <>
                <div style={{ padding: isBoard ? '14px 14px' : '20px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isBoard ? 10 : 14 }}>
                      <span style={{ fontSize: isBoard ? 8 : 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>CURSOS</span>
                    </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div onClick={() => setExpandedCourses(!expandedCourses)} style={{ position: 'relative', width: sz, height: sz, flexShrink: 0, cursor: 'pointer' }}>
                      <div style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        background: courseDistribution.length > 0
                          ? donutGradient(courseDistribution.map(c => ({ value: c.count, color: c.color })))
                          : 'conic-gradient(from -90deg, var(--border-soft) 0deg 360deg)',
                        mask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                        WebkitMask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                        pointerEvents: 'none',
                      }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ fontSize: innerSz, fontWeight: 500, color: 'var(--text-primary)' }}>{tasks.length}</span>
                        <span style={{ fontSize: isBoard ? 8 : 10, fontWeight: 500, color: 'var(--text-muted)', marginTop: isBoard ? 1 : 3 }}>tareas</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                      {courseDistribution.slice(0, expandedCourses ? courseDistribution.length : (isBoard ? 5 : 6)).map(c => (
                        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.color, flexShrink: 0, boxShadow: `0 0 4px ${c.color}40` }} />
                          <span style={{ fontSize: isBoard ? 9 : 10, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.name}</span>
                          <span style={{ fontSize: isBoard ? 9 : 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0 }}>{c.count}</span>
                        </div>
                      ))}
                      {!expandedCourses && courseDistribution.length > (isBoard ? 5 : 6) && (
                        <div onClick={() => setExpandedCourses(true)} style={{ fontSize: 9, color: 'var(--accent)', paddingTop: 2, borderTop: '1px solid var(--border-soft)', marginTop: 1, cursor: 'pointer', fontWeight: 600 }}>
                          +{courseDistribution.length - (isBoard ? 5 : 6)} más
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: isBoard ? '14px 14px' : '20px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, minHeight: 0 }}>
                  <span style={{ fontSize: isBoard ? 8 : 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', display: 'block', marginBottom: isBoard ? 10 : 14 }}>ESTADO</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {statusData.length > 0 && (
                      <div onClick={() => setExpandedStatus(!expandedStatus)} style={{ position: 'relative', width: sz, height: sz, flexShrink: 0, alignSelf: 'center', cursor: 'pointer' }}>
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: donutGradient(statusData.map(s => ({ value: s.val, color: s.color }))),
                          mask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                          WebkitMask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                          pointerEvents: 'none',
                        }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: innerSz, fontWeight: 500, color: 'var(--text-primary)' }}>{stats.completadasPct}%</span>
                          <span style={{ fontSize: isBoard ? 8 : 10, fontWeight: 500, color: 'var(--text-muted)', marginTop: isBoard ? 1 : 3 }}>completado</span>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { label: 'Completadas', val: stats.completadas, color: '#10B981' },
                        { label: 'En curso', val: stats.progreso, color: '#3B82F6' },
                        { label: 'Pendientes', val: stats.pendientes, color: '#F59E0B' },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isBoard ? '2px 0' : '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: item.color, flexShrink: 0, boxShadow: `0 0 4px ${item.color}40` }} />
                            <span style={{ fontSize: isBoard ? 9 : 10, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</span>
                          </div>
                          <span style={{ fontSize: isBoard ? 9 : 10, fontWeight: 600, color: item.val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
        )}
      </div>

      {/* NEW TASK MODAL */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNewModal(false)}>
          <div className="bento-card no-scrollbar" style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', padding: '24px 28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} style={{ color: 'var(--accent)' }} /> Nueva Tarea
              </h2>
              <button onClick={() => setShowNewModal(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Título</label>
                <input id="new-task-title" type="text" name="nueva-tarea" autoComplete="off" placeholder="Ej. Resolver problemas de física..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif" }} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Curso</label>
                  <select id="new-task-course" style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter Tight', sans-serif" }}>
                    <option value="" style={{ background: '#18181b', color: '#e4e4e7' }}>Sin curso</option>
                    {courses.map(c => <option key={c.id} value={c.name} style={{ background: '#18181b', color: c.color }}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Prioridad</label>
                  <select id="new-task-priority" style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter Tight', sans-serif" }}>
                    <option value="" style={{ background: '#18181b', color: '#e4e4e7' }}>Sin prioridad</option>
                    <option value="high" style={{ background: '#18181b', color: '#EF4444' }}>Alta</option>
                    <option value="medium" style={{ background: '#18181b', color: '#F59E0B' }}>Media</option>
                    <option value="low" style={{ background: '#18181b', color: '#10B981' }}>Baja</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Fecha</label>
                  <input id="new-task-duedate" type="date" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: selectBorder, borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: "'JetBrains Mono',monospace" }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeTime} onChange={e => setIncludeTime(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Incluir hora
                  </label>
                  {includeTime && (
                    <input id="new-task-duetime" type="time" defaultValue="23:59" style={{ width: '100%', padding: '8px 12px', marginTop: 6, background: 'var(--bg-elevated)', border: selectBorder, borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: "'JetBrains Mono',monospace" }} />
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Estimado (min)</label>
                  <input id="new-task-estimated" type="number" min="1" placeholder="60" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setShowNewModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px', height: 36, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>Cancelar</button>
                <button onClick={handleCreateTask} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 22px', height: 36, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff' }}>Crear tarea</button>
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
            <div className="bento-card" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 520, maxWidth: '94vw', padding: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden', border: 'none', borderLeft: '1px solid var(--border-default)', boxShadow: '-20px 0 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset' }} onClick={e => e.stopPropagation()}>

              {/* ── Panel Header ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <button onClick={() => setSelectedTaskId(null)}
                    title="Cerrar"
                    style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                    <X size={14} />
                  </button>
                  <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${taskColor}1c, ${taskColor}08)`, border: `1px solid ${taskColor}30` }}>
                    <ClipboardList size={15} style={{ color: taskColor }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: taskColor, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'Inter Tight', sans-serif" }}>Detalle de tarea</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span onClick={() => toggleTaskStatus(selectedTask.id)}
                    title="Cambiar estado"
                    style={{ cursor: 'pointer', fontSize: 10, fontWeight: 600, color: taskColor, letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif", padding: '6px 13px', borderRadius: 999, background: `${taskColor}10`, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all 150ms', border: `1px solid ${taskColor}18` }}
                    onMouseEnter={e => e.currentTarget.style.background = `${taskColor}18`}
                    onMouseLeave={e => e.currentTarget.style.background = `${taskColor}10`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: taskColor, flexShrink: 0, boxShadow: `0 0 6px ${taskColor}80` }} />
                    {statusConfig[selectedTask.status]?.label}
                  </span>
                  <button onClick={() => setConfirmDeleteTask(selectedTask.id)}
                    title="Eliminar tarea"
                    style={{ width: 32, height: 32, borderRadius: 9, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', opacity: 0.6, flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.6'; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable Content ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px 28px', display: 'flex', flexDirection: 'column', gap: 18 }} className="no-scrollbar">

                {/* ── Title ── */}
                <div style={{ padding: '4px 4px 12px' }}>
                  <input
                    id="task-title-input"
                    name="titulo-tarea"
                    autoComplete="off"
                    value={selectedTask.title}
                    onChange={e => updateTask(selectedTask.id, { title: e.target.value })}
                    style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 24, fontWeight: 300, letterSpacing: '-0.01em', color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", outline: 'none', padding: 0, lineHeight: 1.3 }}
                    placeholder="Título de la tarea..."
                  />
                  <div style={{ width: 56, height: 2, borderRadius: 1, background: `linear-gradient(90deg, ${taskColor}, transparent)`, marginTop: 12, boxShadow: `0 0 10px ${taskColor}45` }} />
                </div>

                {/* ── Info Grid 2×2 ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {/* Curso */}
                  <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 12, position: 'relative', overflow: 'hidden', transition: 'all 180ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                    {selectedTask.course !== 'Sin curso' && <BookOpen size={72} strokeWidth={1} style={{ position: 'absolute', right: -12, bottom: -12, color: selectedCourseColor, opacity: 0.045, pointerEvents: 'none' }} />}
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter Tight', sans-serif" }}>Curso</span>
                    <select value={selectedTask.course}
                      onChange={e => updateTask(selectedTask.id, { course: e.target.value, courseColor: e.target.value === 'Sin curso' ? '#888' : (courses.find(c => c.name === e.target.value)?.color || '#E11D48') })}
                      style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 9, fontSize: 12, fontWeight: 500, color: selectedTask.course !== 'Sin curso' ? selectedCourseColor : 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter Tight', sans-serif", transition: 'all 150ms' }}>
                      <option value="Sin curso" style={{ background: '#18181b', color: '#e4e4e7' }}>Sin curso</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.name} style={{ background: '#18181b', color: c.color }}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Prioridad */}
                  <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 12, position: 'relative', overflow: 'hidden', transition: 'all 180ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                    {selectedTask.priority && selectedTask.priority !== 'none' && <Bookmark size={72} strokeWidth={1} style={{ position: 'absolute', right: -12, bottom: -12, color: priorityColor, opacity: 0.045, pointerEvents: 'none' }} />}
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter Tight', sans-serif" }}>Prioridad</span>
                    <select value={selectedTask.priority || 'none'} onChange={e => updateTask(selectedTask.id, { priority: e.target.value as any })}
                      style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 9, fontSize: 12, fontWeight: 500, color: selectedTask.priority && selectedTask.priority !== 'none' ? priorityColor : 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter Tight', sans-serif", transition: 'all 150ms' }}>
                      <option value="none" style={{ background: '#18181b', color: '#e4e4e7' }}>Ninguna</option>
                      <option value="low" style={{ background: '#18181b', color: '#10B981' }}>Baja</option>
                      <option value="medium" style={{ background: '#18181b', color: '#F59E0B' }}>Media</option>
                      <option value="high" style={{ background: '#18181b', color: '#EF4444' }}>Alta</option>
                    </select>
                  </div>

                  {/* Fecha Límite */}
                  {(() => {
                    const tr = selectedTask.dueDate ? getTimeRemaining(selectedTask.dueDate) : null;
                    const dateColor = tr?.overdue ? '#EF4444' : tr?.urgent ? '#F59E0B' : 'var(--text-secondary)';
                    const dateVal = selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : '';
                    const hasTime = selectedTask.dueDate && selectedTask.dueDate.length > 10;
                    const timeVal = hasTime ? selectedTask.dueDate!.slice(11, 16) : '23:59';
                    return (
                      <div style={{ padding: '16px', gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 12, position: 'relative', overflow: 'hidden', transition: 'all 180ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                        <CalendarDays size={72} strokeWidth={1} style={{ position: 'absolute', right: -12, bottom: -12, color: dateColor, opacity: 0.045, pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter Tight', sans-serif" }}>Fecha</span>
                          {tr && (
                            <span style={{ fontSize: 8.5, fontWeight: 500, color: dateColor, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                              {tr.overdue && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />}
                              {tr.text}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input type="date"
                            value={dateVal}
                            onChange={e => {
                              if (!e.target.value) { updateTask(selectedTask.id, { dueDate: undefined }); return; }
                              updateTask(selectedTask.id, { dueDate: hasTime ? `${e.target.value}T${timeVal}` : `${e.target.value}T23:59` });
                            }}
                            style={{ width: '100%', height: 34, padding: '0 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 9, fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)', outline: 'none', fontFamily: "'JetBrains Mono',monospace", minWidth: 0, cursor: 'text', colorScheme: scheme, transition: 'border-color 150ms' }}
                          />
                          {selectedTask.dueDate && (
                            <>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input type="time"
                                  value={timeVal}
                                  onChange={e => updateTask(selectedTask.id, { dueDate: `${dateVal}T${e.target.value}` })}
                                  style={{ flex: 1, height: 34, padding: '0 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 9, fontSize: 11.5, fontWeight: 500, color: hasTime ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none', fontFamily: "'JetBrains Mono',monospace", minWidth: 0, cursor: 'text', colorScheme: scheme, transition: 'border-color 150ms' }}
                                />
                                <button onClick={() => updateTask(selectedTask.id, { dueDate: hasTime ? dateVal : `${dateVal}T${timeVal}` })}
                                  title={hasTime ? "Quitar hora" : "Añadir hora"}
                                  style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hasTime ? `${taskColor}10` : 'transparent', border: `1px solid ${hasTime ? `${taskColor}30` : 'var(--border-soft)'}`, borderRadius: 9, color: hasTime ? taskColor : 'var(--text-muted)', cursor: 'pointer', padding: 0, outline: 'none', flexShrink: 0, transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}18`; e.currentTarget.style.color = taskColor; e.currentTarget.style.borderColor = `${taskColor}50`; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = hasTime ? `${taskColor}10` : 'transparent'; e.currentTarget.style.color = hasTime ? taskColor : 'var(--text-muted)'; e.currentTarget.style.borderColor = hasTime ? `${taskColor}30` : 'var(--border-soft)'; }}>
                                  <Clock size={12} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tiempo + Progreso */}
                  {(() => {
                    const studyMins = Math.round((selectedTask.studyTime || 0) / 60);
                    const estMins = selectedTask.estimatedMinutes || 60;
                    const pct = Math.min(100, Math.round((studyMins / estMins) * 100));
                    const progressColor = pct >= 100 ? '#10B981' : taskColor;
                    const setEst = (v: number) => updateTask(selectedTask.id, { estimatedMinutes: Math.max(5, v) });
                    return (
                      <div style={{ padding: '16px', gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 12, position: 'relative', overflow: 'hidden', transition: 'all 180ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                        <Clock size={72} strokeWidth={1} style={{ position: 'absolute', right: -12, bottom: -12, color: progressColor, opacity: 0.045, pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter Tight', sans-serif" }}>Tiempo</span>
                          <span style={{ fontSize: 19, fontWeight: 400, color: progressColor, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, marginTop: -1 }}>{pct}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <button onClick={() => setEst(estMins - 5)} title="Restar 5 min"
                            style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}12`; e.currentTarget.style.color = taskColor; e.currentTarget.style.borderColor = `${taskColor}40`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                            <Minus size={14} />
                          </button>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 9, minWidth: 0 }}>
                            <input type="number" min="5" step="5" value={estMins}
                              onChange={e => setEst(parseInt(e.target.value) || 5)}
                              style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', outline: 'none', padding: 0, width: '100%', minWidth: 0, fontFamily: "'Inter Tight', sans-serif" }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: 9.5, flexShrink: 0, fontWeight: 500 }}>min</span>
                          </div>
                          <button onClick={() => setEst(estMins + 5)} title="Sumar 5 min"
                            style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${taskColor}10`, border: `1px solid ${taskColor}30`, color: taskColor, cursor: 'pointer', padding: 0, transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}1c`; e.currentTarget.style.borderColor = `${taskColor}55`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${taskColor}10`; e.currentTarget.style.borderColor = `${taskColor}30`; }}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: progressColor, borderRadius: 2, transition: 'width 0.4s ease', boxShadow: `0 0 8px ${progressColor}60` }} />
                          </div>
                          <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{studyMins}m estudiados</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Subtareas ── */}
                <div className="bento-card" style={{ padding: 0, background: 'var(--bg-surface)' }}>
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
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Subtareas</span>
                    {totalSubtasks > 0 && (
                      <>
                        <span style={{ fontSize: 8.5, fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '1px 9px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.15)' }}>
                          {doneSubtasks}/{totalSubtasks}
                        </span>
                        <div style={{ width: 48, height: 3, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${taskColor}, ${taskColor}88)`, borderRadius: 2, transition: 'width 0.3s ease' }} />
                        </div>
                      </>
                    )}
                  </div>

                  {!sectionCollapsed.subtareas && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10 }}>
                        {selectedTask.subtasks.map((st) => (
                          <div key={st.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: "11px 13px", borderRadius: 9, background: st.done ? 'rgba(16,185,129,0.08)' : 'var(--bg-surface)', border: `1px solid ${st.done ? 'rgba(16,185,129,0.15)' : 'var(--border-soft)'}`, transition: 'all 150ms', opacity: st.done ? 0.55 : 1 }}
                            onMouseEnter={e => { if (!st.done) { e.currentTarget.style.borderColor = `${taskColor}40`; e.currentTarget.style.background = `${taskColor}06`; } }}
                            onMouseLeave={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-surface)'; } }}>
                            <button onClick={() => toggleSubTask(selectedTask.id, st.id)}
                              style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${st.done ? '#10B981' : 'var(--border-strong)'}`, background: st.done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                              onMouseEnter={e => { if (!st.done) { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${taskColor}14`; } }}
                              onMouseLeave={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; } }}>
                              {st.done && <Check size={10} strokeWidth={4} style={{ color: '#fff' }} />}
                            </button>
                            <input
                              value={st.title}
                              onChange={e => {
                                const updated = selectedTask.subtasks.map(s => s.id === st.id ? { ...s, title: e.target.value } : s);
                                updateTask(selectedTask.id, { subtasks: updated });
                              }}
                              style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 12.5, fontWeight: st.done ? 400 : 500, color: st.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: st.done ? 'line-through' : 'none', outline: 'none', padding: 0 }}
                            />
                            {!st.done && (
                              <button onClick={() => {
                                localStorage.setItem('owa_study_task_id', selectedTask.id);
                                localStorage.setItem('owa_study_task_title', `${selectedTask.title} — ${st.title}`);
                                setSelectedTaskId(null);
                                setNavigateTo('estudio');
                              }}
                                style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0, opacity: 0.4 }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.4'; }}
                                title="Estudiar esta subtarea">
                                <Play size={11} fill="#10B981" style={{ color: '#10B981' }} />
                              </button>
                            )}
                            <button onClick={() => deleteSubTask(selectedTask.id, st.id)}
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
                        <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}
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
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Materiales</span>
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setShowAddMaterial(true); setSectionCollapsed(prev => ({ ...prev, materiales: false })); }}
                        title="Añadir enlace"
                        style={{ width: 30, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${taskColor}0d`, border: `1px solid ${taskColor}40`, color: taskColor, cursor: 'pointer', padding: 0, transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}1a`; e.currentTarget.style.borderColor = `${taskColor}60`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${taskColor}0d`; e.currentTarget.style.borderColor = `${taskColor}40`; }}>
                        <Link2 size={12} />
                      </button>
                      <button onClick={() => { setSectionCollapsed(prev => ({ ...prev, materiales: false })); handleAddFileBtn(); }}
                        title="Subir archivo"
                        style={{ width: 30, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${taskColor}0d`, border: `1px solid ${taskColor}40`, color: taskColor, cursor: 'pointer', padding: 0, transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}1a`; e.currentTarget.style.borderColor = `${taskColor}60`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${taskColor}0d`; e.currentTarget.style.borderColor = `${taskColor}40`; }}>
                        <Upload size={12} />
                      </button>
                    </div>
                    {selectedTask.files.length > 0 && (
                      <span style={{ fontSize: 8.5, color: 'var(--text-secondary)', fontWeight: 600, background: 'var(--bg-hover)', padding: '1px 9px', borderRadius: 4 }}>{selectedTask.files.length} archivos</span>
                    )}
                  </div>

                  {!sectionCollapsed.materiales && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10 }}>
                        {selectedTask.files.length === 0 && !showAddMaterial && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 7, border: '1px dashed var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 500, gap: 2 }}>
                            <Paperclip size={14} style={{ opacity: 0.15 }} />
                            <span style={{ opacity: 0.3 }}>Añade recursos de estudio</span>
                          </div>
                        )}
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
                          const isLocal = !f.path.startsWith('http') && !f.path.startsWith('blob:') && !f.path.startsWith('data:');
                          const localSrc = isLocal ? (isTauri() ? convertFileSrc(f.path) : f.path) : f.path;
                          const handleCardClick = async () => {
                            try {
                              await openFileSmart(f.path, f.name, {
                                onMedia: (u, n) => setPipUrl(u, n),
                                onError: (m) => addNotification(m, 'error'),
                                onMoved: (np) => {
                                  updateTask(selectedTask.id, { files: selectedTask.files.map(x => x.id === f.id ? { ...x, path: np } : x) });
                                  addNotification('Archivo actualizado a su nueva ubicación', 'success');
                                },
                              });
                            } catch { /* noop */ }
                          };

                          const s = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;
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
                          else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={13} />; }
                          else if (isImage) { badgeColor = '#F59E0B'; iconEl = <Image size={13} />; }
                          else if (isVideo) { badgeColor = '#EC4899'; iconEl = <File size={13} />; }
                          else if (isWeb) {
                            badgeColor = '#10B981';
                            try { domain = new URL(f.path).hostname; } catch {}
                            iconEl = (
                              <span style={{ position: 'relative', width: 17, height: 17, display: 'inline-flex', flexShrink: 0 }}>
                                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                  alt="" style={{ width: 17, height: 17, borderRadius: 3, position: 'absolute', inset: 0 }}
                                  onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.link-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                                <span className="link-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><Link size={12} /></span>
                              </span>
                            );
                          }
                          else { iconEl = <File size={13} />; }

                          const subtitleText = isYouTube ? 'YouTube' : isClassroom ? 'Classroom' : isDrive ? 'Google Drive' : isWeb ? domain : isPdf ? 'PDF' : isDoc ? 'Word' : isGoogleDocs ? 'Google Docs' : isXls ? 'Excel' : isGoogleSheets ? 'Google Sheets' : isPpt ? 'PowerPoint' : isGoogleSlides ? 'Google Slides' : isGoogleForms ? 'Google Forms' : isAudio ? 'Audio' : isImage ? 'Imagen' : isVideo ? 'Video' : f.size ? `${(f.size / 1024).toFixed(0)} KB` : 'Enlace';

                          return (
                            <div key={f.id} onClick={handleCardClick}
                              onContextMenu={(e) => matMenu.openMenu(e, { url: f.path, name: f.name, color: badgeColor })}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'all 150ms' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = `${badgeColor}40`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                              <div style={{ width: 30, height: 30, borderRadius: 7, background: `${badgeColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: badgeColor, position: 'relative' }}>
                                {iconEl}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                                  {f.name}
                                </span>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginTop: 2 }}>
                                  {subtitleText}
                                </span>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteMaterial({ taskId: selectedTask.id, fileId: f.id }); }}
                                style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms', opacity: 0 }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0'; }}
                                title="Eliminar">
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {showAddMaterial && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 14px', background: `linear-gradient(160deg, ${taskColor}08, transparent)`, borderRadius: 10, border: `1px solid ${taskColor}30`, boxShadow: `0 0 0 3px ${taskColor}0a` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 24, height: 24, borderRadius: 7, background: `${taskColor}12`, border: `1px solid ${taskColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Link2 size={12} style={{ color: taskColor }} />
                            </span>
                            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Nuevo enlace</span>
                            <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); }}
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
                          <button onClick={handleAddMaterial} disabled={!newMaterialPath.trim()}
                            style={{ height: 34, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: taskColor, color: '#fff', opacity: newMaterialPath.trim() ? 1 : 0.35, transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Link2 size={12} /> Añadir enlace
                          </button>
                          <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Apuntes ── */}
                <div className="bento-card" style={{ padding: 0, background: 'var(--bg-surface)' }}>
                  <div onClick={() => setSectionCollapsed(prev => ({ ...prev, apuntes: !prev.apuntes }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', transition: 'background 150ms', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ transform: `rotate(${sectionCollapsed.apuntes ? -90 : 0}deg)`, transition: 'transform 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronDown size={13} style={{ color: taskColor }} />
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: `${taskColor}10`, border: `1px solid ${taskColor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <StickyNote size={12} style={{ color: taskColor }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Apuntes</span>
                    {selectedTask.apuntes && selectedTask.apuntes.trim().length > 0 && (
                      <span style={{ fontSize: 8.5, color: 'var(--text-secondary)', fontWeight: 600, background: 'var(--bg-hover)', padding: '1px 9px', borderRadius: 4 }}>{selectedTask.apuntes.split(/\s+/).filter(Boolean).length} palabras</span>
                    )}
                  </div>

                  {!sectionCollapsed.apuntes && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                      {(selectedTask.apuntes?.trim() || showApuntesEditor) ? (
                        <textarea
                          value={selectedTask.apuntes || ''}
                          onChange={e => updateTask(selectedTask.id, { apuntes: e.target.value })}
                          placeholder="Escribe tus apuntes aquí..."
                          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', padding: '16px 18px', resize: 'vertical', minHeight: 120, lineHeight: 1.75, fontFamily: "'Inter', sans-serif", transition: 'all 150ms', marginTop: 10 }}
                          onInput={e => {
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}12`; }}
                          onBlur={e => { if (!e.currentTarget.value.trim()) setShowApuntesEditor(false); e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                      ) : (
                        <div
                          onClick={() => setShowApuntesEditor(true)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 90, marginTop: 10, borderRadius: 10, border: '1px dashed var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, gap: 6, cursor: 'pointer', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}>
                          <StickyNote size={20} style={{ opacity: 0.2 }} />
                          <span style={{ opacity: 0.4 }}>Añadir apuntes</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* ── Footer: Estudiar CTA (fijo, siempre visible) ── */}
              <div style={{ flexShrink: 0, padding: '14px 22px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const otherTaskLinked = !!activeTaskId && activeTaskId !== selectedTask.id;
                  const blocked = !!activePlannedSessionId || otherTaskLinked;
                  return (
                <button
                  onClick={() => {
                    if (activePlannedSessionId) {
                      addNotification('Hay una sesión de estudio vinculada al temporizador. Desvincula esa sesión primero.', 'info');
                      return;
                    }
                    if (otherTaskLinked) {
                      addNotification('Ya hay otra tarea vinculada al temporizador. Desvincula esa tarea primero.', 'info');
                      return;
                    }
                    localStorage.setItem('owa_study_task_id', selectedTask.id);
                    localStorage.setItem('owa_study_task_title', selectedTask.title);
                    setSelectedTaskId(null);
                    setNavigateTo('estudio');
                  }}
                  title={activePlannedSessionId ? 'Hay una sesión de estudio vinculada al temporizador' : (otherTaskLinked ? 'Hay otra tarea vinculada al temporizador' : 'Estudiar esta tarea')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 9, fontSize: 11.5, fontWeight: 500,
                    cursor: blocked ? 'not-allowed' : 'pointer',
                    border: `1px solid ${blocked ? 'var(--border-subtle)' : taskColor + '26'}`,
                    background: blocked ? 'var(--bg-deep)' : `${taskColor}06`,
                    color: blocked ? 'var(--text-muted)' : taskColor,
                    transition: 'all 200ms',
                    width: '100%',
                    fontFamily: "'Inter Tight', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: blocked ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!blocked) { e.currentTarget.style.background = `${taskColor}10`; e.currentTarget.style.borderColor = `${taskColor}40`; e.currentTarget.style.transform = 'scale(1.01)'; } }}
                  onMouseLeave={e => { if (!blocked) { e.currentTarget.style.background = `${taskColor}06`; e.currentTarget.style.borderColor = `${taskColor}26`; e.currentTarget.style.transform = 'scale(1)'; } }}>
                  <Play size={13} fill={blocked ? 'var(--text-muted)' : taskColor} style={{ color: blocked ? 'var(--text-muted)' : taskColor }} />
                  {activePlannedSessionId ? 'Sesión vinculada activa' : (otherTaskLinked ? 'Tarea vinculada activa' : 'Estudiar')}
                </button>
                  );
                })()}
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
                <button onClick={goBack} disabled={!canGoBack} title="Atrás"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: canGoBack ? 'var(--text-primary)' : 'var(--text-muted)', cursor: canGoBack ? 'pointer' : 'default', display: 'flex', opacity: canGoBack ? 1 : 0.3 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button onClick={goForward} disabled={!canGoForward} title="Adelante"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: canGoForward ? 'var(--text-primary)' : 'var(--text-muted)', cursor: canGoForward ? 'pointer' : 'default', display: 'flex', opacity: canGoForward ? 1 : 0.3 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
                <button onClick={refresh} title="Recargar"
                  style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                </button>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input value={navUrl} onChange={e => setNavUrl(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Buscar o escribir URL..."
                    style={{ width: '100%', padding: '5px 10px 5px 26px', borderRadius: 6, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', fontSize: 10, color: 'var(--text-primary)', outline: 'none' }} />
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
                <button onClick={() => window.open(currentUrl, '_blank')} title="Abrir en navegador externo"
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
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={13} style={{ color: 'var(--accent)' }} /> Vista previa
                </span>
                <button onClick={() => { setPdfPreviewUrl(null); setPreviewModalUrl(null); }} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
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
              <button onClick={() => setConfirmDeleteMaterial(null)} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={() => { removeTaskFile(confirmDeleteMaterial.taskId, confirmDeleteMaterial.fileId); setConfirmDeleteMaterial(null); }} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff' }}>Eliminar</button>
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
              <button onClick={() => setConfirmDeleteTask(null)} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={() => { deleteTask(confirmDeleteTask); setSelectedTaskId(null); setConfirmDeleteTask(null); }} style={{ padding: '7px 20px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff' }}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

