import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Search, Check, Trash2,
  ChevronRight, CalendarDays,
  Clock, List as ListIcon, FileText,
  Link, Video, File, X, Upload,
  ExternalLink, Eye, Filter,
  ClipboardList, ChevronLeft, Timer,
  Paperclip, StickyNote,
  Zap, Circle, CheckCircle, Loader,
  MoreVertical, AlertTriangle,
  ArrowUp, ArrowDown, CheckSquare,
  LayoutGrid, Calendar, Play, Activity,
  TrendingUp, Flame, ListTodo, Image, Music, FileSpreadsheet,
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
  const { tasks, courses, addTask, updateTask, toggleTaskStatus, deleteTask, addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, clearAllTasks, addNotification, setNavigateTo, focusedTaskId, setFocusedTaskId, settings } = useApp();

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
  const [newMaterialType, setNewMaterialType] = useState<string>('other');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPath, setNewMaterialPath] = useState('');
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [googleConnected, setGoogleConnected] = useState(isSignedIn());
  const [syncing, setSyncing] = useState<'classroom' | 'tasks' | null>(null);
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (confirmDeleteMaterial || confirmDeleteTask) { setConfirmDeleteMaterial(null); setConfirmDeleteTask(null); return; } if (showNotesModal) { setShowNotesModal(false); return; } if (showSubtasksModal) { setShowSubtasksModal(false); return; } if (pdfPreviewUrl || previewModalUrl) { setPdfPreviewUrl(null); setPreviewModalUrl(null); return; } if (selectedTaskId) { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); return; } if (showNewModal) setShowNewModal(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfPreviewUrl, selectedTaskId, showNewModal, showNotesModal, showSubtasksModal, confirmDeleteMaterial, confirmDeleteTask]);

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
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', mp4: 'video', webm: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt', txt: 'text', csv: 'csv', zip: 'zip', rar: 'zip', '7z': 'zip', json: 'text', md: 'text' };
    setNewMaterialType((typeMap[ext] || 'other') as any);
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

  const renderMaterials = () => {
    if (!selectedTask) return null;
    return (
      <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}><Paperclip size={13} style={{ color: 'var(--accent)' }} /> Materiales</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTask.files.length}</span>
        </div>
        {selectedTask.files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {selectedTask.files.map(f => {
              const isYouTube = f.type === 'video' || (f.type === 'link' && (f.path.includes('youtube.com') || f.path.includes('youtu.be')));
              const isDrive = f.path.includes('drive.google.com') || f.type === 'drive';
              
              let embedUrl = '';
              if (isYouTube) {
                if (f.path.includes('youtube.com/watch?v=')) {
                  embedUrl = f.path.replace('watch?v=', 'embed/');
                } else if (f.path.includes('youtu.be/')) {
                  embedUrl = f.path.replace('youtu.be/', 'youtube.com/embed/');
                }
              }

              return (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getFileIcon(f.type, 13)}
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {f.type === 'pdf' && <button onClick={() => { setPdfPreviewUrl(f.path); if (isDetailExpanded) setActivePreviewUrl(f.path); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 3 }}><Eye size={11} /></button>}
                      {isYouTube && <button onClick={() => { if (embedUrl) { setPdfPreviewUrl(embedUrl); if (isDetailExpanded) setActivePreviewUrl(embedUrl); } }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 3 }}><Play size={11} /></button>}
                      <button onClick={() => removeTaskFile(selectedTask.id, f.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 3 }}><X size={10} /></button>
                    </div>
                  </div>

                  {isYouTube && embedUrl && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', background: '#000', cursor: 'pointer' }} onClick={() => { setPdfPreviewUrl(embedUrl); if (isDetailExpanded) setActivePreviewUrl(embedUrl); }}>
                      <img src={`https://img.youtube.com/vi/${embedUrl.split('/embed/')[1]?.split('?')[0]}/0.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} alt="Youtube Cover" />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Play size={14} fill="#fff" style={{ color: '#fff', marginLeft: 2 }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {isDrive && (
                    <a href={f.path} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 6, textDecoration: 'none' }} className="hover:bg-blue-500/20">
                      <div style={{ padding: 3, borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }}><path fill="#FFD04B" d="M19 13h-6v6h6v-6z"/><path fill="#4285F4" d="M13 19h-6v-6h6v6z"/><path fill="#0F9D58" d="M7 13h6V7H7v6z"/><path fill="#DB4437" d="M19 7h-6v6h6V7z"/></svg>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-primary)' }}>Abrir en Drive</span>
                      </div>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {showAddMaterial ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setAddMaterialMode('link'); setNewMaterialType('link'); }}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: addMaterialMode === 'link' ? '2px solid var(--accent)' : '1px solid var(--border-default)', background: addMaterialMode === 'link' ? 'var(--accent)10' : 'var(--bg-surface)', color: addMaterialMode === 'link' ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 150ms' }}>
                <Link size={10} style={{ marginRight: 4 }} />Enlace
              </button>
              <button onClick={() => { setAddMaterialMode('file'); setNewMaterialType('other'); }}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: addMaterialMode === 'file' ? '2px solid var(--accent)' : '1px solid var(--border-default)', background: addMaterialMode === 'file' ? 'var(--accent)10' : 'var(--bg-surface)', color: addMaterialMode === 'file' ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 150ms' }}>
                <Upload size={10} style={{ marginRight: 4 }} />Archivo
              </button>
            </div>
            <input value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Nombre del material..."
              style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none' }} />
            {addMaterialMode === 'link' ? (
              <input value={newMaterialPath} onChange={e => setNewMaterialPath(e.target.value)} placeholder="URL (YouTube, Drive, web...)"
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none' }} />
            ) : (
              <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', borderRadius: 6, fontSize: 9, fontWeight: 600, cursor: 'pointer', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>
                <Upload size={11} /> {newMaterialFile ? newMaterialFile.name : 'Seleccionar archivo...'}
              </button>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} multiple />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); setAddMaterialMode('file'); }}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 9, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={handleAddMaterial} disabled={!newMaterialName.trim()}
                style={{ padding: '5px 14px', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', opacity: newMaterialName.trim() ? 1 : 0.3 }}>
                <Plus size={11} /> Añadir
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddMaterial(true)} style={{ width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 9, fontWeight: 600, cursor: 'pointer', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Plus size={12} /> Añadir material
          </button>
        )}
      </div>
    );
  };

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
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 16, textAlign: 'center' }}>Prioridad</span>
                <span style={{ flex: 1.2, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 24 }}>Fecha</span>
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
                                  <div style={{ flex: 1, paddingLeft: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                  <div style={{ flex: 1.2, paddingLeft: 24, opacity: longPressedTaskId === t.id ? 0 : 1, transition: 'opacity 200ms' }}>
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
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, justifyContent: 'center' }}>
          {(() => {
            const isBoard = viewMode === 'board';
            const sz = isBoard ? 130 : 170;
            const labelSz = isBoard ? 12 : 14;
            const innerSz = isBoard ? 12 : 24;
            return (
              <>
                <div style={{ padding: isBoard ? '14px 14px' : '20px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isBoard ? 10 : 14 }}>
                      <span style={{ fontSize: isBoard ? 8 : 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>CURSOS</span>
                    </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', width: sz, height: sz, flexShrink: 0 }}>
                      <div style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        background: courseDistribution.length > 0
                          ? donutGradient(courseDistribution.map(c => ({ value: c.count, color: c.color })))
                          : 'conic-gradient(from -90deg, var(--border-soft) 0deg 360deg)',
                        mask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                        WebkitMask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        transform: 'translateZ(0)',
                      }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: innerSz, fontWeight: 500, color: 'var(--text-primary)' }}>{tasks.length}</span>
                        <span style={{ fontSize: isBoard ? 8 : 10, fontWeight: 500, color: 'var(--text-muted)', marginTop: isBoard ? 1 : 3 }}>tareas</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                      {courseDistribution.slice(0, isBoard ? 5 : 6).map(c => (
                        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.color, flexShrink: 0, boxShadow: `0 0 4px ${c.color}40` }} />
                          <span style={{ fontSize: isBoard ? 9 : 10, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.name}</span>
                          <span style={{ fontSize: isBoard ? 9 : 10, fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0 }}>{c.count}</span>
                        </div>
                      ))}
                      {courseDistribution.length > (isBoard ? 5 : 6) && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', paddingTop: 2, borderTop: '1px solid var(--border-soft)', marginTop: 1 }}>
                          +{courseDistribution.length - (isBoard ? 5 : 6)} más
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: isBoard ? '14px 14px' : '20px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: isBoard ? 8 : 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', display: 'block', marginBottom: isBoard ? 10 : 14 }}>ESTADO</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {statusData.length > 0 && (
                      <div style={{ position: 'relative', width: sz, height: sz, flexShrink: 0, alignSelf: 'center' }}>
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: donutGradient(statusData.map(s => ({ value: s.val, color: s.color }))),
                          mask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                          WebkitMask: `radial-gradient(circle at ${sz/2}px ${sz/2}px, transparent ${16.5 * sz / 48}px, #000 ${16.5 * sz / 48}px ${23.5 * sz / 48}px, transparent ${23.5 * sz / 48}px)`,
                          willChange: 'transform',
                          backfaceVisibility: 'hidden',
                          transform: 'translateZ(0)',
                        }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
                  <select id="new-task-course" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                    <option value="">Sin curso</option>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Prioridad</label>
                  <select id="new-task-priority" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
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
                  <input id="new-task-duedate" type="date" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark', fontFamily: "'JetBrains Mono',monospace" }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeTime} onChange={e => setIncludeTime(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Incluir hora
                  </label>
                  {includeTime && (
                    <input id="new-task-duetime" type="time" defaultValue="23:59" style={{ width: '100%', padding: '8px 12px', marginTop: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark', fontFamily: "'JetBrains Mono',monospace" }} />
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

      {/* TASK DETAIL PANEL */}
      {selectedTaskId && selectedTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'color-mix(in srgb, var(--bg-base) 65%, transparent)', backdropFilter: 'blur(6px)' }} onClick={() => { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); setPreviewModalUrl(null); }}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 520, height: '100dvh', borderRadius: 0, borderLeft: `3px solid ${statusConfig[selectedTask.status]?.color || 'var(--border-default)'}`, padding: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} onClick={e => e.stopPropagation()}>
            {/* Header — barra coloreada */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${statusConfig[selectedTask.status]?.color}25`, flexShrink: 0, background: `${statusConfig[selectedTask.status]?.color}06` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setSelectedTaskId(null)} style={{ width: 32, height: 32, borderRadius: 8, background: `${statusConfig[selectedTask.status]?.color}10`, border: `1px solid ${statusConfig[selectedTask.status]?.color}20`, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
                  <ChevronRight size={14} />
                </button>
                <div onClick={() => toggleTaskStatus(selectedTask.id)}
                  style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${selectedTask.status === 'completado' ? '#10B981' : statusConfig[selectedTask.status]?.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: selectedTask.status === 'completado' ? '#10B981' : `${statusConfig[selectedTask.status]?.color}15`, transition: 'all 200ms' }}>
                  {selectedTask.status === 'completado' && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                  {selectedTask.status === 'progreso' && <Zap size={10} style={{ color: statusConfig[selectedTask.status]?.color }} />}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: statusConfig[selectedTask.status]?.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{statusConfig[selectedTask.status]?.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggleTaskStatus(selectedTask.id)}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer', border: `1px solid ${statusConfig[selectedTask.status]?.color}30`, background: `${statusConfig[selectedTask.status]?.color}12`, color: statusConfig[selectedTask.status]?.color, transition: 'all 150ms' }}>
                  {statusConfig[selectedTask.status]?.next === 'completado' ? 'Completar tarea' : statusConfig[selectedTask.status]?.next === 'progreso' ? 'Iniciar tarea' : 'Reabrir'}
                </button>
                <button onClick={() => setConfirmDeleteTask(selectedTask.id)} style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }} className="no-scrollbar">

              {/* Title — grande, editable */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <input value={selectedTask.title} onChange={e => updateTask(selectedTask.id, { title: e.target.value })}
                  style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", outline: 'none', padding: '2px 0', letterSpacing: '-0.01em', lineHeight: 1.3 }}
                  onFocus={e => e.target.style.borderBottom = `1px solid ${statusConfig[selectedTask.status]?.color}40`}
                  onBlur={e => e.target.style.borderBottom = '1px solid transparent'} />
              </div>

              {/* Course | Date | Time — bigger cards, correct proportions */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1.2fr', gap: 8 }}>
                <div style={{ padding: '14px 16px', background: `${selectedTask.courseColor}08`, borderRadius: 12, border: `1px solid ${selectedTask.courseColor}18`, transition: 'all 150ms' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedTask.courseColor, boxShadow: `0 0 8px ${selectedTask.courseColor}60` }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Curso</span>
                  </div>
                  <select value={selectedTask.course} onChange={e => { const course = courses.find(c => c.name === e.target.value); const isNone = e.target.value === 'Sin curso'; updateTask(selectedTask.id, { course: e.target.value, courseColor: isNone ? '#888' : (course?.color || '#E11D48') }); }}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 13, fontWeight: selectedTask.course === 'Sin curso' ? 400 : 600, color: selectedTask.course === 'Sin curso' ? 'var(--text-muted)' : selectedTask.courseColor, outline: 'none', cursor: 'pointer', fontStyle: selectedTask.course === 'Sin curso' ? 'italic' : 'normal' }}>
                    <option value="Sin curso">Sin curso</option>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ padding: '14px 16px', background: `${statusConfig[selectedTask.status]?.color}06`, borderRadius: 12, border: `1px solid ${statusConfig[selectedTask.status]?.color}15` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <CalendarDays size={11} style={{ color: statusConfig[selectedTask.status]?.color }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fecha</span>
                  </div>
                  <input type="date"
                    value={selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : ''}
                    onChange={e => {
                      const oldTime = selectedTask.dueDate && selectedTask.dueDate.length > 10 ? selectedTask.dueDate.slice(11, 16) : '';
                      updateTask(selectedTask.id, { dueDate: e.target.value ? (oldTime ? `${e.target.value}T${oldTime}` : e.target.value) : undefined });
                    }}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark', fontFamily: "'JetBrains Mono',monospace" }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 9, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedTask.dueDate ? selectedTask.dueDate.length > 10 : false}
                      onChange={e => {
                        const datePart = selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : '';
                        updateTask(selectedTask.id, { dueDate: e.target.checked && datePart ? `${datePart}T23:59` : (datePart || undefined) });
                      }}
                      style={{ accentColor: 'var(--accent)' }} />
                    Hora
                  </label>
                  {selectedTask.dueDate && selectedTask.dueDate.length > 10 && (
                    <input type="time"
                      value={selectedTask.dueDate!.slice(11, 16)}
                      onChange={e => updateTask(selectedTask.id, { dueDate: `${selectedTask.dueDate!.slice(0, 10)}T${e.target.value}` })}
                      style={{ width: '100%', padding: '6px 8px', marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark', fontFamily: "'JetBrains Mono',monospace" }} />
                  )}
                </div>
                <div style={{ padding: '14px 16px', background: `${statusConfig[selectedTask.status]?.color}06`, borderRadius: 12, border: `1px solid ${statusConfig[selectedTask.status]?.color}15` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Timer size={11} style={{ color: statusConfig[selectedTask.status]?.color }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tiempo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                    <input type="number" min="1" value={selectedTask.estimatedMinutes || 60}
                      onChange={e => updateTask(selectedTask.id, { estimatedMinutes: parseInt(e.target.value) || 60 })}
                      style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', padding: 0, width: 40 }} />
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>min</span>
                  </div>
                </div>
              </div>

              {/* Study Progress Bar — premium */}
              {(() => {
                const statusCol = statusConfig[selectedTask.status]?.color || 'var(--accent)';
                const goalSecs = (selectedTask.estimatedMinutes || 60) * 60;
                const studiedSecs = selectedTask.studyTime || 0;
                const pct = Math.min(100, Math.round((studiedSecs / goalSecs) * 100));
                const reached = studiedSecs >= goalSecs;
                const barColor = reached ? '#10B981' : statusCol;
                return (
                  <div style={{ padding: '16px 18px', background: `linear-gradient(135deg, ${statusCol}08, var(--bg-elevated))`, borderRadius: 12, border: `1px solid ${statusCol}18` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${barColor}20, ${barColor}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${barColor}15` }}>
                          <Activity size={14} style={{ color: barColor }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Progreso de estudio</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", color: barColor, background: `${barColor}12`, padding: '3px 12px', borderRadius: 6, letterSpacing: '0.02em' }}>
                        {reached ? '100%' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 10, borderRadius: 5, background: `${barColor}06`, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: reached ? 'linear-gradient(90deg, #10B981, #34D399)' : `linear-gradient(90deg, ${statusCol}, ${statusCol}88)`, transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: `0 0 16px ${barColor}40, inset 0 1px 0 rgba(255,255,255,0.1)` }} />
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 5, background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                      <span>{(studiedSecs / 60).toFixed(1)}m estudiados</span>
                      <span style={{ color: 'var(--text-secondary)' }}>Meta: {selectedTask.estimatedMinutes || 60}m</span>
                    </div>
                  </div>
                );
              })()}

              {/* Subtareas + Notas — tarjetas premium */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={() => setShowSubtasksModal(true)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '16px 18px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${statusConfig[selectedTask.status]?.color || 'var(--border-default)'}18`, background: `${statusConfig[selectedTask.status]?.color}04`, transition: 'all 200ms', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: statusConfig[selectedTask.status]?.color, opacity: 0.3, borderRadius: '0 2px 2px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${statusConfig[selectedTask.status]?.color}18, ${statusConfig[selectedTask.status]?.color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ClipboardList size={15} style={{ color: statusConfig[selectedTask.status]?.color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Subtareas</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: selectedTask.subtasks.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', paddingLeft: 40 }}>
                    {selectedTask.subtasks.length > 0 ? `${selectedTask.subtasks.filter(s => s.done).length}/${selectedTask.subtasks.length} completadas` : 'Agregar subtareas'}
                  </span>
                </button>
                <button onClick={() => setShowNotesModal(true)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '16px 18px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${statusConfig[selectedTask.status]?.color || 'var(--border-default)'}18`, background: `${statusConfig[selectedTask.status]?.color}04`, transition: 'all 200ms', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: statusConfig[selectedTask.status]?.color, opacity: 0.3, borderRadius: '0 2px 2px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${statusConfig[selectedTask.status]?.color}18, ${statusConfig[selectedTask.status]?.color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StickyNote size={15} style={{ color: statusConfig[selectedTask.status]?.color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Notas</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: selectedTask.notes?.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', paddingLeft: 40 }}>
                    {selectedTask.notes?.trim() ? `${selectedTask.notes.slice(0, 40)}...` : 'Agregar notas'}
                  </span>
                </button>
              </div>

              {/* Materiales */}
              <div style={{ padding: '16px 18px', background: `linear-gradient(135deg, var(--bg-elevated) 0%, ${statusConfig[selectedTask.status]?.color}04 100%)`, borderRadius: 12, border: `1px solid ${statusConfig[selectedTask.status]?.color}12` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${statusConfig[selectedTask.status]?.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Paperclip size={12} style={{ color: statusConfig[selectedTask.status]?.color }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>Materiales</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 10px', borderRadius: 5 }}>{selectedTask.files.length}</span>
                </div>
                {selectedTask.files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {selectedTask.files.map(f => {
                      const isYouTube = f.type === 'video' || (f.type === 'link' && (f.path.includes('youtube.com') || f.path.includes('youtu.be')));
                      const isDrive = f.path.includes('drive.google.com') || f.type === 'drive';
                      const isAudio = f.type === 'audio' || (f.type === 'other' && (f.path.endsWith('.mp3') || f.path.endsWith('.wav') || f.path.endsWith('.ogg') || f.path.endsWith('.flac')));
                      const isWeb = f.type === 'link' && !isYouTube;
                      const isOffice = f.type === 'doc' || f.type === 'xls' || f.type === 'ppt' || (f.type === 'other' && (f.path.endsWith('.docx') || f.path.endsWith('.doc') || f.path.endsWith('.xlsx') || f.path.endsWith('.xls') || f.path.endsWith('.pptx') || f.path.endsWith('.ppt')));
                      const isPdf = f.type === 'pdf';
                      const isImage = f.type === 'image';
                      const isLocal = !f.path.startsWith('http') && !f.path.startsWith('blob:') && !f.path.startsWith('data:');
                      let embedUrl = '';
                      if (isYouTube) {
                        const v = f.path.includes('youtube.com/watch?v=') ? f.path.split('v=')[1]?.split('&')[0] : f.path.includes('youtu.be/') ? f.path.split('youtu.be/')[1]?.split('?')[0] : '';
                        if (v) embedUrl = `https://www.youtube.com/embed/${v}`;
                      }
                      const localSrc = isLocal && typeof f.path === 'string' && !f.path.startsWith('http') ? (window as any).__TAURI__?.convertFileSrc?.(f.path as string) || f.path : f.path;

                      const handleCardClick = () => {
                        if (isPdf) setPdfPreviewUrl(isLocal ? localSrc : f.path);
                        else if (isOffice) { try { (window as any).__TAURI__?.shell?.open?.(f.path); } catch {} }
                        else if (isImage) setPreviewModalUrl(f.path);
                        else if (isYouTube && embedUrl) setPreviewModalUrl(embedUrl);
                        else if (isWeb) setPreviewModalUrl(f.path);
                      };

                      const cardCursor = (isPdf || isOffice || isImage || (isYouTube && embedUrl) || isWeb) ? 'pointer' : 'default';
                      const statusColor = statusConfig[selectedTask.status]?.color || 'var(--accent)';
                      const badgeInfo = isPdf ? { label: 'PDF', bg: 'rgba(239,68,68,0.12)', fg: '#EF4444' } : isAudio ? { label: 'Audio', bg: 'rgba(139,92,246,0.12)', fg: '#8B5CF6' } : isOffice ? { label: f.type === 'doc' ? 'Doc' : f.type === 'xls' ? 'XLS' : 'PPT', bg: 'rgba(37,99,235,0.12)', fg: '#2563EB' } : isImage ? { label: 'IMG', bg: 'rgba(245,158,11,0.12)', fg: '#F59E0B' } : isYouTube ? { label: 'Video', bg: 'rgba(239,68,68,0.12)', fg: '#EF4444' } : isWeb ? { label: 'Web', bg: 'rgba(16,185,129,0.12)', fg: '#10B981' } : isDrive ? { label: 'Drive', bg: 'rgba(66,133,244,0.12)', fg: '#4285F4' } : { label: 'File', bg: 'rgba(255,255,255,0.06)', fg: 'var(--text-muted)' };

                      return (
                        <div key={f.id} onClick={handleCardClick}
                          style={{ borderRadius: 10, border: `1px solid var(--border-subtle)`, cursor: cardCursor, transition: 'all 150ms', overflow: 'hidden', background: 'var(--bg-surface)' }}
                          className={cardCursor !== 'default' ? 'hover:border-[var(--border-strong)] hover:shadow-sm' : ''}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 10px 12px' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 7, background: `linear-gradient(135deg, ${statusColor}14, ${statusColor}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${statusColor}10` }}>
                              {getFileIcon(f.type, 14)}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 550, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 3, background: badgeInfo.bg, color: badgeInfo.fg, textTransform: 'uppercase', lineHeight: '16px' }}>
                              {badgeInfo.label}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteMaterial({ taskId: selectedTask.id, fileId: f.id }); }} title="Eliminar"
                              style={{ padding: 3, borderRadius: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', opacity: 0.35, transition: 'opacity 150ms' }}
                              className="hover:opacity-100"><X size={9} /></button>
                          </div>
                          {isYouTube && embedUrl && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
                              <img src={`https://img.youtube.com/vi/${embedUrl.split('/embed/')[1]?.split('?')[0]}/0.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} alt="" />
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                                  <Play size={15} fill="#fff" style={{ color: '#fff', marginLeft: 2 }} />
                                </div>
                              </div>
                            </div>
                          )}
                          {isAudio && (
                            <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 12px', background: 'var(--bg-deep)' }}>
                              <audio controls style={{ width: '100%', height: 30, borderRadius: 4 }} src={isLocal ? localSrc : (f.path.startsWith('blob:') || f.path.startsWith('data:') ? f.path : '')}>
                                Tu navegador no soporta audio.
                              </audio>
                            </div>
                          )}
                          {isImage && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', maxHeight: 140, overflow: 'hidden' }}>
                              <img src={isLocal ? localSrc : f.path} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </div>
                          )}
                          {isPdf && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', position: 'relative' }}>
                              <object data={isLocal ? localSrc : f.path} type="application/pdf" style={{ width: '100%', height: 180, border: 'none', display: 'block' }} aria-label={f.name}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 16px' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#EF4444"><path d="M6 2h12l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5"/></svg>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.name}</span>
                                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Toca para previsualizar</span>
                                </div>
                              </object>
                            </div>
                          )}
                          {isOffice && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-deep)' }}>
                              {f.type === 'doc' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563EB"><path d="M6 2h12l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5M8 13h8v-2H8v2zm0 4h5v-2H8v2zm0-8h3V7H8v2z"/></svg> : f.type === 'xls' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#16A34A"><path d="M6 2h12l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5M8 13l4 4-4 4h2.5l2.5-2.5L15.5 21H18l-4-4 4-4h-2.5L12.5 15 10 13H8z"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="#D97706"><path d="M6 2h12l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5M8 13v-2h8v2H8zm0 4v-2h5v2H8z"/></svg>}
                              <span style={{ flex: 1, fontSize: 10, color: 'var(--text-secondary)' }}>Abrir {f.type === 'doc' ? 'documento' : f.type === 'xls' ? 'hoja de cálculo' : 'presentación'}</span>
                              <ExternalLink size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </div>
                          )}
                          {isWeb && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-deep)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)' }}>{f.path.replace(/^https?:\/\//, '').split('/')[0]}</span>
                              <ExternalLink size={10} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                            </div>
                          )}
                          {isDrive && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(66,133,244,0.05)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="#4285F4"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                              <span style={{ flex: 1, fontSize: 9, fontWeight: 600, color: '#4285F4' }}>Google Drive</span>
                              <ExternalLink size={10} style={{ flexShrink: 0, color: '#4285F4' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {showAddMaterial ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px', background: 'var(--bg-surface)', borderRadius: 12, border: `1px solid ${statusConfig[selectedTask.status]?.color}20` }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setAddMaterialMode('link'); setNewMaterialType('link'); }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: addMaterialMode === 'link' ? `2px solid ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}` : '1px solid var(--border-default)', background: addMaterialMode === 'link' ? `${statusConfig[selectedTask.status]?.color}08` : 'var(--bg-elevated)', color: addMaterialMode === 'link' ? (statusConfig[selectedTask.status]?.color || 'var(--accent)') : 'var(--text-secondary)', transition: 'all 150ms' }}>
                        <Link size={12} /> Enlace
                      </button>
                      <button onClick={() => { setAddMaterialMode('file'); setNewMaterialType('other'); }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: addMaterialMode === 'file' ? `2px solid ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}` : '1px solid var(--border-default)', background: addMaterialMode === 'file' ? `${statusConfig[selectedTask.status]?.color}08` : 'var(--bg-elevated)', color: addMaterialMode === 'file' ? (statusConfig[selectedTask.status]?.color || 'var(--accent)') : 'var(--text-secondary)', transition: 'all 150ms' }}>
                        <Upload size={12} /> Archivo
                      </button>
                    </div>
                    <input value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Nombre del material..."
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, color: 'var(--text-primary)', outline: 'none' }} />
                    {addMaterialMode === 'link' ? (
                      <input value={newMaterialPath} onChange={e => setNewMaterialPath(e.target.value)} placeholder="URL (YouTube, Drive, web...)"
                        style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, color: 'var(--text-primary)', outline: 'none' }} />
                    ) : (
                      <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>
                        <Upload size={12} /> {newMaterialFile ? newMaterialFile.name : 'Seleccionar archivo...'}
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} multiple />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); setAddMaterialMode('file'); }}
                        style={{ padding: '8px 18px', borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', transition: 'all 150ms' }}
                        className="hover:text-white">Cancelar</button>
                      <button onClick={handleAddMaterial} disabled={!newMaterialName.trim()}
                        style={{ padding: '8px 22px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: statusConfig[selectedTask.status]?.color || 'var(--accent)', color: '#fff', opacity: newMaterialName.trim() ? 1 : 0.3, transition: 'all 150ms' }}>
                        <Plus size={12} /> Añadir
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddMaterial(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 0', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: `1px dashed ${statusConfig[selectedTask.status]?.color}40`, background: `${statusConfig[selectedTask.status]?.color}04`, color: statusConfig[selectedTask.status]?.color, transition: 'all 150ms' }} className="hover:bg-[var(--bg-hover)]">
                    <Plus size={13} /> Añadir material
                  </button>
                )}
              </div>

              {/* Estudiar esta tarea — vinculación real */}
              <button onClick={() => {
                localStorage.setItem('owa_study_task_id', selectedTask.id);
                localStorage.setItem('owa_study_task_title', selectedTask.title);
                setSelectedTaskId(null);
                setNavigateTo('estudio');
              }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', border: 'none', background: `linear-gradient(135deg, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}, ${statusConfig[selectedTask.status]?.color}88)`, color: '#fff', transition: 'all 200ms' }}>
                Estudiar esta tarea
              </button>

            </div>
          </div>
        </div>
      )}

      {/* SUBTASKS MODAL */}
      {showSubtasksModal && selectedTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setShowSubtasksModal(false)}>
          <div style={{ width: '100%', maxWidth: 460, padding: '28px 32px', background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-default)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: `linear-gradient(180deg, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}, ${statusConfig[selectedTask.status]?.color}44)`, opacity: 0.4 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}18, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}06)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={16} style={{ color: statusConfig[selectedTask.status]?.color || 'var(--accent)' }} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>Subtareas</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{selectedTask.subtasks.filter(s => s.done).length}/{selectedTask.subtasks.length} completadas</span>
                </div>
              </div>
              <button onClick={() => setShowSubtasksModal(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }} className="hover:text-white"><X size={13} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }} className="no-scrollbar">
              {selectedTask.subtasks.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 0', color: 'var(--text-muted)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px dashed var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={18} style={{ opacity: 0.3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>Sin subtareas aún</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.6 }}>Agrega una subtarea para dividir esta tarea</span>
                </div>
              )}
              {selectedTask.subtasks.map(st => (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: st.done ? 'rgba(16,185,129,0.04)' : 'var(--bg-elevated)', border: `1px solid ${st.done ? 'rgba(16,185,129,0.15)' : 'var(--border-subtle)'}`, transition: 'all 150ms' }}
                  className="hover:bg-surfaceElevated">
                  <button onClick={() => toggleSubTask(selectedTask.id, st.id)}
                    style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${st.done ? '#10B981' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: st.done ? '#10B981' : 'transparent', transition: 'all 200ms' }}>
                    {st.done && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 500, color: st.done ? 'var(--text-tertiary)' : 'var(--text-primary)', flex: 1, textDecoration: st.done ? 'line-through' : 'none' }}>{st.title}</span>
                  <button onClick={() => deleteSubTask(selectedTask.id, st.id)} style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    className="hover:bg-white/[0.06] hover:text-white"><X size={11} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <input value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Agregar subtarea..." onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
              <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}
                style={{ padding: '10px 20px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: statusConfig[selectedTask.status]?.color || 'var(--accent)', color: '#fff', opacity: newSubtaskTitle.trim() ? 1 : 0.3, transition: 'all 150ms' }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTAS MODAL */}
      {showNotesModal && selectedTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setShowNotesModal(false)}>
          <div style={{ width: '100%', maxWidth: 500, padding: '28px 32px', background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-default)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: `linear-gradient(180deg, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}, ${statusConfig[selectedTask.status]?.color}44)`, opacity: 0.4 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}18, ${statusConfig[selectedTask.status]?.color || 'var(--accent)'}06)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StickyNote size={16} style={{ color: statusConfig[selectedTask.status]?.color || 'var(--accent)' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Notas</span>
              </div>
              <button onClick={() => setShowNotesModal(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }} className="hover:text-white"><X size={13} /></button>
            </div>
            <textarea value={selectedTask.notes || ''} onChange={e => updateTask(selectedTask.id, { notes: e.target.value })}
              placeholder="Escribe notas, resúmenes o recordatorios..."
              style={{ width: '100%', minHeight: 220, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>{(selectedTask.notes || '').length} caracteres</span>
              <button onClick={() => setShowNotesModal(false)}
                style={{ padding: '8px 24px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: statusConfig[selectedTask.status]?.color || 'var(--accent)', color: '#fff', transition: 'all 150ms' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MINI BROWSER STATE */}
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
              {/* Browser toolbar */}
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

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => { setPdfPreviewUrl(null); setPreviewModalUrl(null); }}>
            <div className="bento-card" style={{ width: '100%', maxWidth: 900, height: '85vh', padding: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
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
          </div>
        );
      })()}

      {/* CONFIRM DELETE MATERIAL */}
      {confirmDeleteMaterial && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmDeleteMaterial(null)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 320, padding: '20px 24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
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
        </div>
      )}

      {/* CONFIRM DELETE TASK */}
      {confirmDeleteTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmDeleteTask(null)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 320, padding: '20px 24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
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
        </div>
      )}

    </div>
  );
}

