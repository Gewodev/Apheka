import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Check, Trash2,
  ChevronRight, CalendarDays,
  Clock, List as ListIcon, FileText,
  Link, Video, File, X, Upload,
  ExternalLink, Eye, Filter,
  ClipboardList, ChevronLeft, Timer,
  Paperclip, StickyNote,
  Zap, Circle, CheckCircle, Loader,
  AlertTriangle,
  ArrowUp, ArrowDown, CheckSquare,
  LayoutGrid, Calendar, Play, Activity,
  TrendingUp, Flame, ListTodo, Image, Music, FileSpreadsheet,
  Star, Pencil, ChevronDown, Globe,
} from 'lucide-react';
import { useApp, Task, fmtClock } from '../../store/AppContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
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



function SortableTaskRow({ task, children }: { task: Task; children: (dragProps: { attributes: any; listeners: any; setNodeRef: any; style: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : 'auto' };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners, setNodeRef, style, isDragging })}</div>;
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
  const { tasks, courses, notes, addTask, updateTask, toggleTaskStatus, deleteTask, addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, clearAllTasks, addNotification, setNavigateTo, focusedTaskId, setFocusedTaskId, settings, addNote, updateNote } = useApp();
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
      return `Hace ${months}m`;
    } catch {
      return 'Reciente';
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
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
  const [longPressedTaskId, setLongPressedTaskId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
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
  const [addMaterialMode, setAddMaterialMode] = useState<'link' | 'file'>('file');
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState<{ taskId: string; fileId: string } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState(false);
  const [expandedStatus, setExpandedStatus] = useState(false);

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
    if (searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const allHaveSortOrder = filtered.length > 0 && filtered.every(t => t.sortOrder !== undefined);
    return [...filtered].sort((a, b) => {
      if (allHaveSortOrder) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      const aDone = a.status === 'completado' ? 1 : 0;
      const bDone = b.status === 'completado' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (sortBy === 'fecha') { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return localDate(a.dueDate).getTime() - localDate(b.dueDate).getTime(); }
      return (a.course || '').localeCompare(b.course || '');
    });
  }, [tasks, courseFilter, searchQuery, sortBy]);

  const { reorderTasks } = useApp();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [calendarDragTaskId, setCalendarDragTaskId] = useState<string | null>(null);

  const listSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const calendarSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } })
  );

  const handleDragEndList = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const ids = filteredTasks.map(t => t.id);
      const oldIndex = ids.indexOf(active.id);
      const newIndex = ids.indexOf(over.id);
      const newIds = arrayMove([...ids], oldIndex, newIndex);
      reorderTasks(newIds);
    }
    setActiveDragId(null);
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
    if (!taskId) return {};
    try { return JSON.parse(localStorage.getItem(`owa_task_sec_${taskId}`) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    setSectionCollapsed(() => {
      if (!taskId) return {};
      try { return JSON.parse(localStorage.getItem(`owa_task_sec_${taskId}`) || '{}'); } catch { return {}; }
    });
  }, [taskId]);
  useEffect(() => { if (taskId) localStorage.setItem(`owa_task_sec_${taskId}`, JSON.stringify(sectionCollapsed)); }, [taskId, sectionCollapsed]);

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

  const handleAddSubtask = useCallback(() => { if (!selectedTask || !newSubtaskTitle.trim()) return; addSubTask(selectedTask.id, newSubtaskTitle.trim()); setNewSubtaskTitle(''); }, [selectedTask, newSubtaskTitle, addSubTask]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNewMaterialFile(file);
    // Use file directly — no double dialog
    const reader = new FileReader();
    reader.onload = (ev) => setNewMaterialPath(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (!newMaterialName.trim()) setNewMaterialName(file.name.replace(/\.[^/.]+$/, ''));
    e.target.value = '';
  }, [newMaterialName]);

  const fetchPageTitle = useCallback(async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const html = await res.text();
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1].trim() : null;
    } catch { return null; }
  }, []);

  const handleAddMaterial = useCallback(async () => {
    if (!selectedTask) return;
    const path = addMaterialMode === 'link' ? newMaterialPath.trim() : newMaterialPath;
    if (!path) { addNotification('Ingresa la URL o selecciona un archivo', 'error'); return; }
    let name = newMaterialName.trim();
    if (!name && addMaterialMode === 'link') {
      const fetched = await fetchPageTitle(path);
      if (fetched) name = fetched;
    }
    if (!name) { addNotification('Ingresa el nombre del material', 'error'); return; }
    const ext = newMaterialFile?.name.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', mp4: 'video', webm: 'video', avi: 'video', mov: 'video', mkv: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', wma: 'audio', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt', txt: 'text', csv: 'csv', json: 'text', md: 'text', xml: 'text', zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip' };
    let detectedType = addMaterialMode === 'file' ? (typeMap[ext] || 'other') : 'link';
    if (addMaterialMode === 'link') {
      if (path.includes('youtube.com') || path.includes('youtu.be')) detectedType = 'video';
      else if (path.includes('drive.google.com')) detectedType = 'drive';
    }
    addTaskFile(selectedTask.id, { name, path, type: detectedType, size: newMaterialFile?.size });
    setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); setShowAddMaterial(false); setAddMaterialMode('file');
  }, [selectedTask, newMaterialName, newMaterialPath, newMaterialFile, addMaterialMode, addTaskFile, fetchPageTitle]);

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
    const dayNames = ['L','M','M','J','V','S','D'];
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '11px 18px 11px 12px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'var(--bg-elevated)', borderRadius: '12px 12px 0 0' }}>
                <span style={{ width: 30, flexShrink: 0 }} />
                <span style={{ flex: 4, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>Tarea</span>
                <span style={{ flex: 2.2, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 16, textAlign: 'center' }}>Curso</span>
                <span style={{ flex: 0.8, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 12, textAlign: 'left' }}>Prioridad</span>
                <span style={{ flex: 1.5, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 32 }}>Fecha</span>
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
                  <DndContext sensors={listSensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEndList} modifiers={[restrictToParentElement]}>
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
                            {({ attributes, listeners, setNodeRef, style: dndStyle, isDragging: isDndDragging }) => (
                              <div ref={setNodeRef} style={{ ...dndStyle, display: 'flex', alignItems: 'center', gap: 0, padding: '0', minHeight: 50, borderBottom: '1px solid var(--border-soft)', background: selectedTaskId === t.id ? `${stripColor}06` : bgStatus, transition: 'all 120ms', opacity: isDndDragging ? 0.4 : 1 }}
                                className="hover:bg-white/[0.025]"
                                onMouseDown={() => { isLongPressRef.current = false; longPressTimer.current = setTimeout(() => { isLongPressRef.current = true; setLongPressedTaskId(prev => prev === t.id ? null : t.id); }, 500); }}
                                onMouseUp={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                                onMouseLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                                onTouchStart={() => { isLongPressRef.current = false; longPressTimer.current = setTimeout(() => { isLongPressRef.current = true; setLongPressedTaskId(prev => prev === t.id ? null : t.id); }, 500); }}
                                onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}>
                                {/* Left toggle strip — cuadrado centrado — also drag handle */}
                                <div {...attributes} {...listeners}
                                  onClick={(e) => { e.stopPropagation(); if (isLongPressRef.current) { isLongPressRef.current = false; return; } handleToggle(e, t.id); }}
                                  style={{ width: 30, height: 30, flexShrink: 0, background: stripColor, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, margin: 'auto 0 auto 12px', transition: 'all 150ms', boxShadow: `0 0 12px ${stripColor}30` }}>
                                  {isDone && <Check size={13} strokeWidth={3} style={{ color: '#fff' }} />}
                                  {t.status === 'progreso' && <Zap size={12} style={{ color: '#fff' }} />}
                                </div>
                                {/* Content area — click opens detail */}
                                <div onClick={(e) => { e.stopPropagation(); handleOpenDetail(t.id); }}
                                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, padding: '0 18px 0 12px', minHeight: 50, cursor: 'pointer', minWidth: 0 }}>
                                  <div style={{ flex: 4, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: titleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isDone ? 'line-through' : 'none' }}>
                                      {t.title}
                                    </span>
                                  </div>
                                  <div style={{ flex: 2.2, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingLeft: 16 }}>
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
                                  <div style={{ flex: 0.8, paddingLeft: 12, display: 'flex', alignItems: 'center' }}>
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
                                  <div style={{ flex: 1.5, paddingLeft: 36, opacity: longPressedTaskId === t.id ? 0 : 1, transition: 'opacity 200ms' }}>
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
                              width: 28, height: 28, borderRadius: 6, margin: '10px',
                              background: sc, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {t.status === 'completado' && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
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
                const colTasks = tasks.filter(t => t.status === col.status);
                return (
                  <div key={col.status} className="bento-card"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) {
                        const newStatus = col.status === 'completado' ? 'completado' : col.status === 'progreso' ? 'progreso' : 'inicio';
                        updateTask(taskId, { status: newStatus });
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
                        <div key={task.id} className="board-card hover:bg-white/[0.03]" draggable onDragStart={e => handleDragStart(e, task.id)} onDragEnd={handleDragEnd} onClick={() => handleOpenDetail(task.id)}
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
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
                  <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: i >= 5 ? 'color-mix(in srgb, #EF4444 35%, transparent)' : 'var(--text-secondary)', letterSpacing: '0.08em', background: 'var(--bg-surface)', textTransform: 'uppercase' }}>{d}</div>
                ))}
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
                                  borderTop: isTodayDay ? '1px solid var(--accent-soft)' : '1px solid transparent',
                                  borderLeft: isSel ? '1px solid var(--accent-dim)' : di === 0 ? '1px solid var(--border-soft)' : 'none',
                                  transition: 'background 150ms',
                                  outline: isOver ? '1.5px solid var(--accent)' : 'none',
                                  outlineOffset: -1.5,
                                }}>
                                {/* Day Number */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, flexShrink: 0 }}>
                                  <span style={{
                                    fontSize: calendarSubMode === 'semana' ? 13 : 11,
                                    fontWeight: isTodayDay ? 700 : (isSel ? 700 : 400),
                                    color: isTodayDay ? 'var(--accent)' : (isSel ? 'var(--text-primary)' : isCurrentMonth ? (isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)') : 'var(--text-muted)'),
                                    width: 26, height: 26,
                                    borderRadius: '50%',
                                    background: isTodayDay ? 'var(--accent-dim)' : (isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>{format(day, 'd')}</span>
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
                                                borderRadius: 4,
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
                                              {task.title}
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
          <div className="bento-card" style={{ width: '100%', maxWidth: 440, padding: '24px 28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} style={{ color: 'var(--accent)' }} /> Nueva Tarea
              </h2>
              <button onClick={() => setShowNewModal(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Título</label>
                <input id="new-task-title" type="text" placeholder="Ej. Resolver problemas de física..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Curso</label>
                  <select id="new-task-course" style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter', sans-serif" }}>
                    <option value="">Sin curso</option>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Prioridad</label>
                  <select id="new-task-priority" style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter', sans-serif" }}>
                    <option value="">Sin prioridad</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setSelectedTaskId(null)}
                    style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    title="Cerrar">
                    <ChevronRight size={16} />
                  </button>
                  <span onClick={() => toggleTaskStatus(selectedTask.id)}
                    style={{ cursor: 'pointer', fontSize: 9.5, fontWeight: 600, color: taskColor, letterSpacing: '0.05em', fontFamily: "'Inter Tight', sans-serif", padding: '4px 12px', borderRadius: 6, background: `${taskColor}10`, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all 150ms', border: `1px solid ${taskColor}18` }}
                    onMouseEnter={e => e.currentTarget.style.background = `${taskColor}18`}
                    onMouseLeave={e => e.currentTarget.style.background = `${taskColor}10`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: taskColor, flexShrink: 0 }} />
                    {statusConfig[selectedTask.status]?.label}
                  </span>
                </div>
                <button onClick={() => setConfirmDeleteTask(selectedTask.id)}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', opacity: 0.5 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.5'; }}
                  title="Eliminar tarea">
                  <Trash2 size={13} />
                </button>
              </div>

              {/* ── Scrollable Content ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 48px', display: 'flex', flexDirection: 'column', gap: 14 }} className="no-scrollbar">

                {/* ── Title ── */}
                <div className="bento-card" style={{ padding: '16px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
                  <input
                    id="task-title-input"
                    value={selectedTask.title}
                    onChange={e => updateTask(selectedTask.id, { title: e.target.value })}
                    style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 21, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", outline: 'none', padding: 0, lineHeight: 1.3 }}
                    placeholder="Título de la tarea..."
                  />
                  <div style={{ width: 40, height: 2, borderRadius: 1, background: `linear-gradient(90deg, ${taskColor}, transparent)`, marginTop: 10 }} />
                </div>

                {/* ── Info Grid 2×2 ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {/* Curso */}
                  <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', border: `1px solid ${selectedTask.course !== 'Sin curso' ? `${selectedCourseColor}28` : 'var(--border-default)'}`, borderRadius: 9 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: selectedTask.course !== 'Sin curso' ? selectedCourseColor : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 5 }}>
                      {selectedTask.course !== 'Sin curso' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: selectedCourseColor, flexShrink: 0 }} />}
                      Curso
                    </span>
                    <select value={selectedTask.course}
                      onChange={e => updateTask(selectedTask.id, { course: e.target.value, courseColor: e.target.value === 'Sin curso' ? '#888' : (courses.find(c => c.name === e.target.value)?.color || '#E11D48') })}
                      style={{ width: '100%', height: 28, padding: '0 9px', background: selectedTask.course !== 'Sin curso' ? `${selectedCourseColor}08` : 'var(--bg-elevated)', border: `1px solid ${selectedTask.course !== 'Sin curso' ? `${selectedCourseColor}30` : 'var(--border-default)'}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: selectedTask.course !== 'Sin curso' ? selectedCourseColor : 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}>
                      <option value="Sin curso" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Sin curso</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.name} style={{ background: 'var(--bg-elevated)', color: c.color }}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Prioridad */}
                  <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', border: `1px solid ${selectedTask.priority && selectedTask.priority !== 'none' ? `${priorityColor}28` : 'var(--border-default)'}`, borderRadius: 9 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: selectedTask.priority && selectedTask.priority !== 'none' ? priorityColor : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 5 }}>
                      {selectedTask.priority && selectedTask.priority !== 'none' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />}
                      Prioridad
                    </span>
                    <select value={selectedTask.priority || 'none'} onChange={e => updateTask(selectedTask.id, { priority: e.target.value as any })}
                      style={{ width: '100%', height: 28, padding: '0 9px', background: selectedTask.priority && selectedTask.priority !== 'none' ? `${priorityColor}08` : 'var(--bg-elevated)', border: `1px solid ${selectedTask.priority && selectedTask.priority !== 'none' ? `${priorityColor}30` : 'var(--border-default)'}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: selectedTask.priority && selectedTask.priority !== 'none' ? priorityColor : 'var(--text-primary)', outline: 'none', cursor: 'pointer', colorScheme: 'dark', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}>
                      <option value="none" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Ninguna</option>
                      <option value="low" style={{ background: 'var(--bg-elevated)', color: '#10B981' }}>Baja</option>
                      <option value="medium" style={{ background: 'var(--bg-elevated)', color: '#F59E0B' }}>Media</option>
                      <option value="high" style={{ background: 'var(--bg-elevated)', color: '#EF4444' }}>Alta</option>
                    </select>
                  </div>

                  {/* Fecha Límite */}
                  {(() => {
                    const tr = selectedTask.dueDate ? getTimeRemaining(selectedTask.dueDate) : null;
                    const dateColor = tr?.overdue ? '#EF4444' : tr?.urgent ? '#F59E0B' : 'var(--text-secondary)';
                    const dateBorderColor = tr?.overdue ? 'rgba(239,68,68,0.28)' : tr?.urgent ? 'rgba(245,158,11,0.28)' : 'var(--border-default)';
                    const dateVal = selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : '';
                    const hasTime = selectedTask.dueDate && selectedTask.dueDate.length > 10;
                    const timeVal = hasTime ? selectedTask.dueDate!.slice(11, 16) : '23:59';
                    return (
                      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', border: `1px solid ${dateBorderColor}`, borderRadius: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: dateColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Fecha</span>
                          {tr && (
                            <span style={{ fontSize: 8.5, fontWeight: 600, color: dateColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {tr.overdue && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />}
                              {tr.text}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="date"
                            value={dateVal}
                            onChange={e => {
                              if (!e.target.value) { updateTask(selectedTask.id, { dueDate: undefined }); return; }
                              updateTask(selectedTask.id, { dueDate: hasTime ? `${e.target.value}T${timeVal}` : `${e.target.value}T23:59` });
                            }}
                            style={{ flex: 1, height: 28, padding: '0 9px', background: 'var(--bg-elevated)', border: `1px solid ${dateBorderColor}`, borderRadius: 7, fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', fontFamily: "'JetBrains Mono',monospace", minWidth: 0, cursor: 'text', colorScheme: 'dark' }}
                          />
                          {selectedTask.dueDate && (
                            <>
                              <input type="time"
                                value={timeVal}
                                onChange={e => updateTask(selectedTask.id, { dueDate: `${dateVal}T${e.target.value}` })}
                                style={{ width: 86, height: 28, padding: '0 9px', background: 'var(--bg-elevated)', border: `1px solid ${dateBorderColor}`, borderRadius: 7, fontSize: 10.5, fontWeight: 600, color: hasTime ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none', fontFamily: "'JetBrains Mono',monospace", minWidth: 0, cursor: 'text', colorScheme: 'dark' }}
                              />
                              <button onClick={() => updateTask(selectedTask.id, { dueDate: hasTime ? dateVal : `${dateVal}T${timeVal}` })}
                                title={hasTime ? "Quitar hora" : "Añadir hora"}
                                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hasTime ? `${taskColor}10` : 'transparent', border: `1px solid ${hasTime ? `${taskColor}30` : 'var(--border-soft)'}`, borderRadius: 7, color: hasTime ? taskColor : 'var(--text-muted)', cursor: 'pointer', padding: 0, outline: 'none', flexShrink: 0, transition: 'all 150ms' }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}18`; e.currentTarget.style.color = taskColor; e.currentTarget.style.borderColor = `${taskColor}50`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = hasTime ? `${taskColor}10` : 'transparent'; e.currentTarget.style.color = hasTime ? taskColor : 'var(--text-muted)'; e.currentTarget.style.borderColor = hasTime ? `${taskColor}30` : 'var(--border-soft)'; }}>
                                <Clock size={11} />
                              </button>
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
                    return (
                      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 9 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Tiempo</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: progressColor, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, marginTop: -1 }}>{pct}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 9px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 7 }}>
                          <Clock size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <input type="number" min="1" value={selectedTask.estimatedMinutes || 60}
                            onChange={e => updateTask(selectedTask.id, { estimatedMinutes: parseInt(e.target.value) || 60 })}
                            style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', padding: 0, width: '100%' }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0, fontWeight: 500 }}>min</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: progressColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
                          </div>
                          <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{studyMins}m</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Subtareas ── */}
                <div className="bento-card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                  <div onClick={() => setSectionCollapsed(prev => ({ ...prev, subtareas: !prev.subtareas }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer', transition: 'background 150ms', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ transform: `rotate(${sectionCollapsed.subtareas ? -90 : 0}deg)`, transition: 'transform 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronDown size={13} style={{ color: taskColor }} />
                    </div>
                    <CheckSquare size={12} style={{ color: taskColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Subtareas</span>
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
                    <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {selectedTask.subtasks.map((st) => (
                          <div key={st.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: "7px 10px", borderRadius: 7, background: st.done ? 'rgba(16,185,129,0.08)' : 'var(--bg-surface)', border: `1px solid ${st.done ? 'rgba(16,185,129,0.15)' : 'var(--border-soft)'}`, transition: 'all 150ms', opacity: st.done ? 0.55 : 1 }}
                            onMouseEnter={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                            onMouseLeave={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-surface)'; } }}>
                            <button onClick={() => toggleSubTask(selectedTask.id, st.id)}
                              style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${st.done ? '#10B981' : 'var(--border-strong)'}`, background: st.done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                              onMouseEnter={e => { if (!st.done) { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${taskColor}14`; } }}
                              onMouseLeave={e => { if (!st.done) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; } }}>
                              {st.done && <Check size={9} strokeWidth={4} style={{ color: '#fff' }} />}
                            </button>
                            <input
                              value={st.title}
                              onChange={e => {
                                const updated = selectedTask.subtasks.map(s => s.id === st.id ? { ...s, title: e.target.value } : s);
                                updateTask(selectedTask.id, { subtasks: updated });
                              }}
                              style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 11.5, fontWeight: st.done ? 400 : 500, color: st.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: st.done ? 'line-through' : 'none', outline: 'none', padding: 0 }}
                            />
                            {!st.done && (
                              <button onClick={() => {
                                localStorage.setItem('owa_study_task_id', selectedTask.id);
                                localStorage.setItem('owa_study_task_title', `${selectedTask.title} — ${st.title}`);
                                setSelectedTaskId(null);
                                setNavigateTo('estudio');
                              }}
                                style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0, opacity: 0 }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0'; }}
                                title="Estudiar esta subtarea">
                                <Play size={10} fill="#10B981" style={{ color: '#10B981' }} />
                              </button>
                            )}
                            <button onClick={() => deleteSubTask(selectedTask.id, st.id)}
                              style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0, opacity: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0'; }}
                              title="Eliminar">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        {selectedTask.subtasks.length === 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 7, border: '1px dashed var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, gap: 2 }}>
                            <CheckSquare size={14} style={{ opacity: 0.15 }} />
                            <span style={{ opacity: 0.3 }}>Desglosa la tarea en pasos</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 5 }}>
                        <input
                          value={newSubtaskTitle}
                          onChange={e => setNewSubtaskTitle(e.target.value)}
                          placeholder="Añadir paso..."
                          onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                          style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 7, fontSize: 10.5, color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms' }}
                          onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}14`; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: newSubtaskTitle.trim() ? taskColor : 'var(--border-soft)', color: newSubtaskTitle.trim() ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newSubtaskTitle.trim() ? 'pointer' : 'default', transition: 'all 150ms', flexShrink: 0 }}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Materiales ── */}
                {/* ── Materiales ── */}
                <div className="bento-card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                  <div onClick={() => setSectionCollapsed(prev => ({ ...prev, materiales: !prev.materiales }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer', transition: 'background 150ms', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ transform: `rotate(${sectionCollapsed.materiales ? -90 : 0}deg)`, transition: 'transform 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronDown size={13} style={{ color: taskColor }} />
                    </div>
                    <Paperclip size={12} style={{ color: taskColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Materiales</span>
                    {selectedTask.files.length > 0 && (
                      <span style={{ fontSize: 8.5, color: 'var(--text-secondary)', fontWeight: 600, background: 'var(--bg-hover)', padding: '1px 9px', borderRadius: 4 }}>{selectedTask.files.length} archivos</span>
                    )}
                  </div>

                  {!sectionCollapsed.materiales && (
                    <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {selectedTask.files.length === 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 7, border: '1px dashed var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 500, gap: 2 }}>
                            <Paperclip size={14} style={{ opacity: 0.15 }} />
                            <span style={{ opacity: 0.3 }}>Añade recursos de estudio</span>
                          </div>
                        )}
                        {selectedTask.files.map(f => {
                          const isYouTube = f.type === 'video' || (f.type === 'link' && (f.path.includes('youtube.com') || f.path.includes('youtu.be')));
                          const isDrive = f.path.includes('drive.google.com') || f.type === 'drive';
                          const isAudio = f.type === 'audio' || (f.type === 'other' && (f.path.endsWith('.mp3') || f.path.endsWith('.wav') || f.path.endsWith('.ogg')));
                          const isWeb = f.type === 'link' && !isYouTube && !isDrive;
                          const isExcel = f.type === 'xls' || (f.type === 'other' && (f.path.endsWith('.xlsx') || f.path.endsWith('.xls') || f.path.includes('sheets')));
                          const isWord = f.type === 'doc' || (f.type === 'other' && (f.path.endsWith('.docx') || f.path.endsWith('.doc')));
                          const isPPT = f.type === 'ppt' || (f.type === 'other' && (f.path.endsWith('.pptx') || f.path.endsWith('.ppt')));
                          const isPdf = f.type === 'pdf';
                          const isImage = f.type === 'image';
                          const isLocal = !f.path.startsWith('http') && !f.path.startsWith('blob:') && !f.path.startsWith('data:');
                          const localSrc = isLocal ? (window as any).__TAURI__?.convertFileSrc?.(f.path) || f.path : f.path;

                          const openFile = (path: string) => {
                            if ((window as any).__TAURI__?.shell?.open) {
                              (window as any).__TAURI__.shell.open(path).catch(() => window.open(path, '_blank', 'noopener,noreferrer'));
                            } else {
                              window.open(path, '_blank', 'noopener,noreferrer');
                            }
                          };
                          const handleCardClick = () => {
                            if (isPdf) setPdfPreviewUrl(isLocal ? localSrc : f.path);
                            else if (isImage) setPreviewModalUrl(f.path);
                            else if (isYouTube) {
                              const v = f.path.includes('youtube.com/watch?v=') ? f.path.split('v=')[1]?.split('&')[0] : f.path.includes('youtu.be/') ? f.path.split('youtu.be/')[1]?.split('?')[0] : '';
                              if (v) setPreviewModalUrl(`https://www.youtube.com/embed/${v}`);
                            }
                            else if (isWeb || isDrive) openFile(f.path);
                            else if (isWord || isExcel || isPPT) openFile(f.path);
                            else if (isAudio && f.path.startsWith('http')) openFile(f.path);
                            else if (f.path.startsWith('http')) setPreviewModalUrl(f.path);
                          };

                          const s = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;
                          let iconEl: React.ReactNode;
                          let badgeColor = '#888';
                          let domain = '';
                          if (isWord) { badgeColor = '#2563EB'; iconEl = s('M23.004 1.5q.41 0 .703.293t.293.703v19.008q0 .41-.293.703t-.703.293H6.996q-.41 0-.703-.293T6 21.504V18H.996q-.41 0-.703-.293T0 17.004V6.996q0-.41.293-.703T.996 6H6V2.496q0-.41.293-.703t.703-.293zM6.035 11.203l1.442 4.735h1.64l1.57-7.876H9.036l-.937 4.653-1.325-4.5H5.38l-1.406 4.523-.938-4.675H1.312l1.57 7.874h1.641zM22.5 21v-3h-15v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3h-15v3Z', '#2563EB'); }
                          else if (isExcel) { badgeColor = '#10B981'; iconEl = s('M23 1.5q.41 0 .7.3.3.29.3.7v19q0 .41-.3.7-.29.3-.7.3H7q-.41 0-.7-.3-.3-.29-.3-.7V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h5V2.5q0-.41.3-.7.29-.3.7-.3zM6 13.28l1.42 2.66h2.14l-2.38-3.87 2.34-3.8H7.46l-1.3 2.4-.05.08-.04.09-.64-1.28-.66-1.29H2.59l2.27 3.82-2.48 3.85h2.16zM14.25 21v-3H7.5v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3H7.5v3zm8.25 15v-3h-6.75v3zm0-4.5v-3.75h-6.75v3.75zm0-5.25V7.5h-6.75v3.75zm0-5.25V3h-6.75v3Z', '#10B981'); }
                          else if (isPPT) { badgeColor = '#F97316'; iconEl = s('M13.5 1.5q1.453 0 2.795.375 1.342.375 2.508 1.06 1.166.686 2.12 1.641.956.955 1.641 2.121.686 1.166 1.061 2.508Q24 10.547 24 12q0 1.453-.375 2.795-.375 1.342-1.06 2.508-.686 1.166-1.641 2.12-.955.956-2.121 1.641-1.166.686-2.508 1.061-1.342.375-2.795.375-1.29 0-2.52-.305-1.23-.304-2.337-.884-1.108-.58-2.063-1.418-.955-.838-1.693-1.893H.997q-.411 0-.704-.293T0 17.004V6.996q0-.41.293-.703T.996 6h3.89q.739-1.055 1.694-1.893.955-.837 2.063-1.418 1.107-.58 2.337-.884Q12.21 1.5 13.5 1.5zm.75 1.535v8.215h8.215q-.14-1.64-.826-3.076-.686-1.436-1.782-2.531-1.095-1.096-2.537-1.782-1.441-.685-3.07-.826zm-5.262 7.57q0-.68-.228-1.166-.229-.486-.627-.79-.399-.305-.938-.446-.539-.14-1.172-.14H2.848v7.863h1.84v-2.742H5.93q.574 0 1.119-.17t.978-.493q.434-.322.698-.802.263-.48.263-1.114zM13.5 21q1.172 0 2.262-.287t2.056-.82q.967-.534 1.776-1.278.808-.744 1.418-1.664.61-.92.984-1.986.375-1.067.469-2.227h-9.703V3.035q-1.735.14-3.27.908T6.797 6h4.207q.41 0 .703.293t.293.703v10.008q0 .41-.293.703t-.703.293H6.797q.644.715 1.412 1.271.768.557 1.623.944.855.387 1.781.586Q12.54 21 13.5 21zM5.812 9.598q.575 0 .915.228.34.229.34.838 0 .27-.124.44-.123.17-.31.275-.188.105-.422.146-.234.041-.445.041H4.687V9.598Z', '#F97316'); }
                          else if (isPdf) { badgeColor = '#EF4444'; iconEl = s('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704zm-1.42 1.03c-.107.532-.64.887-1.384.887-.213 0-.39-.036-.604-.071-1.348-.32-2.626-.994-3.903-2.059a17.717 17.717 0 0 1 2.98-.248c.746 0 1.385.035 1.81.142.497.106 1.278.426 1.1 1.348zm-7.524-1.668a38.01 38.01 0 0 0-2.945.674 39.68 39.68 0 0 0-2.52.745 40.05 40.05 0 0 0 1.207-2.555c.426-.994.78-2.023 1.136-2.981.354.603.745 1.207 1.135 1.739a50.127 50.127 0 0 0 1.987 2.378zM10.038 1.46a.768.768 0 0 1 .674-.425c.745 0 .887.851.887 1.526 0 1.135-.355 2.874-.958 4.861-1.03-2.768-1.1-5.074-.603-5.962zM6.134 17.997c-1.81 2.981-3.549 4.826-4.613 4.826a.872.872 0 0 1-.532-.177c-.213-.213-.32-.461-.249-.745.213-1.065 2.271-2.555 5.394-3.904Z', '#EF4444'); }
                          else if (isYouTube) { badgeColor = '#EF4444'; iconEl = s('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#EF4444'); }
                          else if (isDrive) { badgeColor = '#4285F4'; iconEl = <svg viewBox="0 0 24 24" width={17} height={17} style={{ flexShrink: 0, display: 'block' }}><path fill="#4285F4" d="M12 1.5l9 15.6H3L12 1.5z"/><path fill="#34A853" d="M12 22.5L3 17.1h18L12 22.5z"/><path fill="#FBBC05" d="M3 17.1l3-5.2 3 5.2H3z"/><path fill="#EA4335" d="M18 17.1l-3-5.2-3 5.2h6z"/></svg>; }
                          else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={13} />; }
                          else if (isImage) { badgeColor = '#F59E0B'; iconEl = <Image size={13} />; }
                          else if (isWeb) {
                            badgeColor = '#10B981';
                            try { domain = new URL(f.path).hostname; } catch {}
                            iconEl = (
                              <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                alt="" style={{ width: 16, height: 16, borderRadius: 2 }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            );
                          }
                          else { iconEl = <File size={13} />; }

                          return (
                            <div key={f.id} onClick={handleCardClick}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'all 150ms' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = `${badgeColor}40`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                              <div style={{ width: 30, height: 30, borderRadius: 7, background: `${badgeColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', color: badgeColor, position: 'relative' }}>
                                {iconEl}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {f.name}
                                </span>
                                <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginTop: 1 }}>
                                  {isWeb ? domain : isYouTube ? 'YouTube' : isDrive ? 'Google Drive' : f.size ? `${(f.size / 1024).toFixed(0)} KB` : 'Enlace'}
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

                        <div onClick={() => setShowAddMaterial(true)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 0', borderRadius: 7, border: '1px dashed var(--border-soft)', cursor: 'pointer', background: 'transparent', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'transparent'; }}>
                          <Plus size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)' }}>Añadir material</span>
                        </div>
                      </div>

                      {showAddMaterial && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '11px 13px', background: 'var(--bg-elevated)', borderRadius: 9, border: `1px solid ${taskColor}20` }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {(['link', 'file'] as const).map(m => (
                              <button key={m} onClick={() => { setAddMaterialMode(m); }}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: addMaterialMode === m ? `1px solid ${taskColor}` : '1px solid var(--border-soft)', background: addMaterialMode === m ? `${taskColor}14` : 'var(--bg-surface)', color: addMaterialMode === m ? taskColor : 'var(--text-secondary)', transition: 'all 150ms' }}>
                                {m === 'link' ? <Link size={9} /> : <Upload size={9} />}
                                {m === 'link' ? 'Enlace' : 'Archivo'}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <input value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Nombre del material..."
                              onKeyDown={e => { if (e.key === 'Enter' && newMaterialName.trim() && (addMaterialMode === 'file' || newMaterialPath.trim())) handleAddMaterial(); }}
                              style={{ flex: 1, padding: '6px 9px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms' }}
                              onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}12`; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }} />
                            <button onClick={handleAddMaterial} disabled={!newMaterialName.trim()}
                              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: taskColor, color: '#fff', opacity: newMaterialName.trim() ? 1 : 0.3, transition: 'all 150ms', whiteSpace: 'nowrap' }}>
                              Añadir
                            </button>
                            <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); setAddMaterialMode('file'); }}
                              style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <X size={10} />
                            </button>
                          </div>
                          {addMaterialMode === 'link' ? (
                            <input value={newMaterialPath} onChange={e => setNewMaterialPath(e.target.value)} placeholder="URL (YouTube, Drive, web...)"
                              onKeyDown={e => { if (e.key === 'Enter' && newMaterialName.trim() && newMaterialPath.trim()) handleAddMaterial(); }}
                              style={{ width: '100%', padding: '6px 9px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none', transition: 'all 150ms' }}
                              onFocus={e => { e.currentTarget.style.borderColor = taskColor; e.currentTarget.style.boxShadow = `0 0 0 2px ${taskColor}12`; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }} />
                          ) : (
                            <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 6, fontSize: 9.5, fontWeight: 600, cursor: 'pointer', border: '1px dashed var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', transition: 'all 150ms' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}>
                              <Upload size={10} /> {newMaterialFile ? newMaterialFile.name : 'Seleccionar archivo...'}
                            </button>
                          )}
                          <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Apuntes ── */}
                <div className="bento-card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                  <div onClick={() => setSectionCollapsed(prev => ({ ...prev, apuntes: !prev.apuntes }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer', transition: 'background 150ms', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ transform: `rotate(${sectionCollapsed.apuntes ? -90 : 0}deg)`, transition: 'transform 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronDown size={13} style={{ color: taskColor }} />
                    </div>
                    <StickyNote size={12} style={{ color: taskColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>Apuntes</span>
                    {selectedTask.apuntes && selectedTask.apuntes.trim().length > 0 && (
                      <span style={{ fontSize: 8.5, color: 'var(--text-secondary)', fontWeight: 600, background: 'var(--bg-hover)', padding: '1px 9px', borderRadius: 4 }}>{selectedTask.apuntes.split(/\s+/).filter(Boolean).length} palabras</span>
                    )}
                  </div>

                  {!sectionCollapsed.apuntes && (
                    <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                      {(selectedTask.apuntes?.trim() || showApuntesEditor) ? (
                        <textarea
                          value={selectedTask.apuntes || ''}
                          onChange={e => updateTask(selectedTask.id, { apuntes: e.target.value })}
                          placeholder="Escribe tus apuntes aquí..."
                          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 12, outline: 'none', padding: '10px 12px', resize: 'vertical', minHeight: 68, lineHeight: 1.65, fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
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
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 68, borderRadius: 7, border: '1px dashed var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 500, gap: 3, cursor: 'pointer', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}>
                          <StickyNote size={15} style={{ opacity: 0.15 }} />
                          <span style={{ opacity: 0.3 }}>Añadir apuntes</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* ── Estudiar CTA ── */}
                <button onClick={() => {
                  localStorage.setItem('owa_study_task_id', selectedTask.id);
                  localStorage.setItem('owa_study_task_title', selectedTask.title);
                  setSelectedTaskId(null);
                  setNavigateTo('estudio');
                }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${taskColor}30`,
                    background: `${taskColor}08`,
                    color: taskColor,
                    transition: 'all 200ms',
                    width: '100%',
                    fontFamily: "'Inter Tight', sans-serif",
                    letterSpacing: '0.03em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${taskColor}14`; e.currentTarget.style.borderColor = `${taskColor}50`; e.currentTarget.style.transform = 'scale(1.01)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${taskColor}08`; e.currentTarget.style.borderColor = `${taskColor}30`; e.currentTarget.style.transform = 'scale(1)'; }}>
                  <Play size={13} fill={taskColor} style={{ color: taskColor }} />
                  Estudiar
                </button>

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

        const MiniBrowser = () => {
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
        };

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

