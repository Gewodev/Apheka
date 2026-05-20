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
  Bell, MoreVertical, AlertTriangle,
  ArrowUp, ArrowDown, CheckSquare,
  LayoutGrid, Calendar, Play, Activity,
  TrendingUp, Flame, ListTodo,
} from 'lucide-react';
import { useApp, Task } from '../../store/AppContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

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

function getTimeRemaining(dueDate: string): string {
  const parsed = new Date(dueDate);
  if (isNaN(parsed.getTime())) return '';
  const diff = parsed.getTime() - Date.now();
  if (diff <= 0) return 'Vencida';
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) { const h = Math.floor(diff / (1000 * 60 * 60)); return h <= 0 ? 'Hoy 23:59' : `Hoy ${format(parsed, 'HH:mm')}`; }
  const d = Math.floor(days);
  return d === 1 ? 'Mañana' : format(parsed, "d MMM", { locale: es });
}

function getFileIcon(type: string, size = 14) {
  switch (type) {
    case 'pdf': return <FileText size={size} style={{ color: '#EF4444' }} />;
    case 'video': return <Video size={size} style={{ color: '#8B5CF6' }} />;
    case 'image': return <File size={size} style={{ color: '#3B82F6' }} />;
    case 'link': return <Link size={size} style={{ color: '#10B981' }} />;
    default: return <File size={size} style={{ color: 'var(--text-tertiary)' }} />;
  }
}

export default function Tareas() {
  const { tasks, courses, addTask, updateTask, toggleTaskStatus, deleteTask, addSubTask, toggleSubTask, deleteSubTask, addTaskFile, removeTaskFile, clearAllTasks } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [subTab, setSubTab] = useState<'todas' | 'pendientes' | 'progreso' | 'completadas' | 'vencidas'>('todas');
  const [sortBy, setSortBy] = useState<'prioridad' | 'fecha' | 'curso'>('prioridad');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<Date>(new Date());
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterialType, setNewMaterialType] = useState<'pdf' | 'video' | 'link' | 'other'>('pdf');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPath, setNewMaterialPath] = useState('');
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);

  const notificationCount = useMemo(() => tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'completado').length, [tasks]);

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completadas = tasks.filter(t => t.status === 'completado').length;
    const pendientes = tasks.filter(t => t.status === 'inicio').length;
    const progreso = tasks.filter(t => t.status === 'progreso').length;
    const vencidas = tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'completado').length;
    return { total, completadas, pendientes, progreso, vencidas, completadasPct: total ? Math.round((completadas / total) * 100) : 0 };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (courseFilter) filtered = filtered.filter(t => t.course === courseFilter);
    if (searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (subTab === 'pendientes') filtered = filtered.filter(t => t.status === 'inicio');
    if (subTab === 'progreso') filtered = filtered.filter(t => t.status === 'progreso');
    if (subTab === 'completadas') filtered = filtered.filter(t => t.status === 'completado');
    if (subTab === 'vencidas') filtered = filtered.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'completado');
    return [...filtered].sort((a, b) => {
      if (sortBy === 'prioridad') { const p = { high: 3, medium: 2, low: 1 }; return (p[b.priority as keyof typeof p] || 1) - (p[a.priority as keyof typeof p] || 1); }
      if (sortBy === 'fecha') { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); }
      return (a.course || '').localeCompare(b.course || '');
    });
  }, [tasks, courseFilter, searchQuery, subTab, sortBy]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (pdfPreviewUrl) { setPdfPreviewUrl(null); return; } if (selectedTaskId) { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); return; } if (showNewModal) setShowNewModal(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfPreviewUrl, selectedTaskId, showNewModal]);

  const handleToggle = useCallback((e: React.MouseEvent, id: string) => { e.stopPropagation(); e.preventDefault(); toggleTaskStatus(id); }, [toggleTaskStatus]);
  const handleOpenDetail = useCallback((id: string) => setSelectedTaskId(id), []);

  const handleCreateTask = useCallback(() => {
    const title = (document.getElementById('new-task-title') as HTMLInputElement)?.value?.trim();
    const courseSelect = document.getElementById('new-task-course') as HTMLSelectElement;
    const prioritySelect = document.getElementById('new-task-priority') as HTMLSelectElement;
    const dueDateInput = document.getElementById('new-task-duedate') as HTMLInputElement;
    const estimatedInput = document.getElementById('new-task-estimated') as HTMLInputElement;
    if (!title) { toast.error('Ingresa un título'); return; }
    const courseName = courseSelect?.value || 'General';
    const course = courses.find(c => c.name === courseName);
    addTask({ title, course: courseName, courseColor: course?.color || '#E11D48', priority: (prioritySelect?.value as any) || 'medium', urgent: prioritySelect?.value === 'high', important: prioritySelect?.value === 'high', dueDate: dueDateInput?.value || undefined, estimatedMinutes: estimatedInput?.value ? parseInt(estimatedInput.value) : 60 });
    setShowNewModal(false);
    toast.success('Tarea creada');
  }, [addTask, courses]);

  const handleAddSubtask = useCallback(() => { if (!selectedTask || !newSubtaskTitle.trim()) return; addSubTask(selectedTask.id, newSubtaskTitle.trim()); setNewSubtaskTitle(''); }, [selectedTask, newSubtaskTitle, addSubTask]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNewMaterialFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setNewMaterialPath(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (!newMaterialName.trim()) setNewMaterialName(file.name.replace(/\.[^/.]+$/, ''));
    e.target.value = '';
  }, [newMaterialName]);

  const handleAddMaterial = useCallback(() => {
    if (!selectedTask || !newMaterialName.trim()) return;
    const useUrl = newMaterialType === 'video' || newMaterialType === 'link';
    const path = useUrl ? newMaterialPath.trim() : newMaterialPath;
    if (!path) { toast.error('Selecciona o ingresa la URL'); return; }
    const size = newMaterialFile?.size;
    const ext = newMaterialFile?.name.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', mp4: 'video', doc: 'doc', docx: 'doc' };
    addTaskFile(selectedTask.id, { name: newMaterialName.trim(), path, type: useUrl ? newMaterialType : (typeMap[ext] || 'other'), size });
    setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); setShowAddMaterial(false);
    toast.success('Material añadido');
  }, [selectedTask, newMaterialName, newMaterialPath, newMaterialFile, newMaterialType, addTaskFile]);

  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const weekRows: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) weekRows.push(calendarDays.slice(i, i + 7));

  const timeStr = format(currentTime, 'HH:mm');
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
    { label: 'Vencidas', val: stats.vencidas, color: '#EF4444' },
  ].filter(s => s.val > 0);
  const totalStatus = statusData.reduce((a, s) => a + s.val, 0);

  return (
    <div className="page-container h-full flex flex-col overflow-y-auto custom-scroll" style={{ gap: 0 }}>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingTop: 8, flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>Tareas</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-tertiary)' }}>
              <div style={{ width: 3, height: 10, background: 'var(--text-secondary)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 16, background: 'var(--accent)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 7, background: 'var(--text-secondary)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 12, background: 'var(--text-tertiary)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {stats.total} tareas · {stats.completadasPct}% completado
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 14, fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
            SYS
          </div>
          <button style={{ ...s.btn('1px solid var(--border-default)', 'var(--bg-elevated)', 'var(--text-secondary)'), padding: '0 10px', height: 36, position: 'relative' }} onClick={() => { if (notificationCount > 0) setSubTab('vencidas'); }}>
            <Bell size={15} />
            {notificationCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-base)' }}>{notificationCount}</span>}
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: 'var(--bg-deep)', padding: '6px 14px', borderRadius: 12, border: '1px solid var(--border-default)' }}>
            <span className="led-display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{timeStr}</span>
            <span className="led-seconds" style={{ fontSize: 12, fontWeight: 600 }}>{secondsStr}</span>
          </div>
        </div>
      </header>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'list', label: 'Lista', icon: ListIcon },
            { id: 'board', label: 'Tablero', icon: LayoutGrid },
            { id: 'calendar', label: 'Calendario', icon: Calendar },
          ].map(m => {
            const active = viewMode === m.id;
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setViewMode(m.id as any)}
                style={{ padding: '6px 16px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', border: 'none', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 300ms' }}>
                <Icon size={12} /> {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: 34, paddingLeft: 32, fontSize: 11, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}><X size={11} /></button>}
          </div>
          <select value={courseFilter || ''} onChange={e => setCourseFilter(e.target.value || null)} style={{ height: 34, padding: '0 10px', fontSize: 10, fontWeight: 600, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
            <option value="">Todos los cursos</option>
            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ height: 34, padding: '0 10px', fontSize: 10, fontWeight: 600, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
            <option value="prioridad">Prioridad</option>
            <option value="fecha">Fecha</option>
            <option value="curso">Curso</option>
          </select>
          <button onClick={() => setShowNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', transition: 'all 200ms' }}>
            <Plus size={14} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* SUB-TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, flexShrink: 0 }}>
        {[
          { id: 'todas', label: 'Todas', count: stats.total },
          { id: 'pendientes', label: 'Pendientes', count: stats.pendientes },
          { id: 'progreso', label: 'En progreso', count: stats.progreso },
          { id: 'completadas', label: 'Completadas', count: stats.completadas },
          { id: 'vencidas', label: 'Vencidas', count: stats.vencidas },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id as any)}
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: subTab === tab.id ? 'var(--accent)' : 'transparent', color: subTab === tab.id ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 200ms' }}>
            {tab.label}
            <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: subTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-deep)', color: subTab === tab.id ? '#fff' : 'var(--text-muted)' }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, flex: 1, minHeight: 0 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="bento-card" style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 10px', borderBottom: '1px solid var(--border-subtle)', fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span style={{ flex: 3 }}>Tarea</span>
                <span style={{ flex: 1.2, textAlign: 'center' }}>Curso</span>
                <span style={{ flex: 1, textAlign: 'center' }}>Prioridad</span>
                <span style={{ flex: 1.2, textAlign: 'center' }}>Fecha</span>
                <span style={{ flex: 1, textAlign: 'center' }}>Estado</span>
                <span style={{ width: 28 }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                {filteredTasks.map(task => {
                  const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completado';
                  const isDone = task.status === 'completado';
                  return (
                    <div key={task.id} onClick={() => handleOpenDetail(task.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms', background: isDone ? 'var(--bg-elevated)' : 'var(--bg-hover)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.25)' : 'transparent'}`, opacity: isDone ? 0.55 : 1 }}
                      className={!isDone ? 'hover:bg-white/[0.03]' : ''}>
                      <button onClick={e => handleToggle(e, task.id)}
                        style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isDone ? '#10B981' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: isDone ? '#10B981' : 'transparent', transition: 'all 200ms' }}>
                        {isDone && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                      </button>
                      <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</span>
                      <span style={{ flex: 1.2, textAlign: 'center', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${task.courseColor}15`, color: task.courseColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.course}</span>
                      <span style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, color: task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#10B981' }}>
                        {task.priority === 'high' ? <ArrowUp size={10} /> : task.priority === 'medium' ? <ArrowUp size={10} style={{ transform: 'rotate(45deg)' }} /> : <ArrowDown size={10} />}
                      </span>
                      <span style={{ flex: 1.2, textAlign: 'center', fontSize: 9, fontWeight: 600, color: isOverdue ? '#EF4444' : 'var(--text-tertiary)' }}>
                        {task.dueDate ? getTimeRemaining(task.dueDate) : '—'}
                      </span>
                      <div style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDone ? '#10B981' : task.status === 'progreso' ? '#3B82F6' : '#F59E0B', boxShadow: task.status === 'progreso' ? '0 0 6px rgba(59,130,246,0.5)' : 'none' }} />
                        <span style={{ fontSize: 8, fontWeight: 600, color: isDone ? '#10B981' : task.status === 'progreso' ? '#3B82F6' : '#F59E0B' }}>
                          {isDone ? 'Hecho' : task.status === 'progreso' ? 'Curso' : 'Pend'}
                        </span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleOpenDetail(task.id); }} style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MoreVertical size={13} />
                      </button>
                    </div>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, padding: '40px 0', color: 'var(--text-muted)' }}>
                    <CheckSquare size={28} style={{ opacity: 0.15 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin tareas en esta categoría</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOARD VIEW */}
          {viewMode === 'board' && (
            <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { status: 'inicio', label: 'Pendientes', color: '#F59E0B' },
                { status: 'progreso', label: 'En Curso', color: '#3B82F6' },
                { status: 'completado', label: 'Completadas', color: '#10B981' },
              ].map(col => {
                const colTasks = tasks.filter(t => t.status === col.status);
                return (
                  <div key={col.status} className="bento-card" style={{ flex: 1, minWidth: 240, padding: '12px 14px', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-base))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${col.color}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{col.label}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${col.color}15`, color: col.color }}>{colTasks.length}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {colTasks.map(task => (
                        <div key={task.id} onClick={() => handleOpenDetail(task.id)}
                          style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 150ms' }}
                          className="hover:border-white/10">
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <button onClick={e => handleToggle(e, task.id)}
                              style={{ marginTop: 1, width: 14, height: 14, borderRadius: '50%', border: `2px solid ${task.status === 'completado' ? '#10B981' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: task.status === 'completado' ? '#10B981' : 'transparent' }}>
                              {task.status === 'completado' && <Check size={8} strokeWidth={3} style={{ color: '#fff' }} />}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: task.status === 'completado' ? 'line-through' : 'none' }}>{task.title}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3, background: `${task.courseColor}15`, color: task.courseColor }}>{task.course}</span>
                                {task.dueDate && <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{getTimeRemaining(task.dueDate)}</span>}
                              </div>
                              {(task.subtasks.length > 0 || task.files.length > 0) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 8, color: 'var(--text-tertiary)' }}>
                                  {task.subtasks.length > 0 && <span>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>}
                                  {task.files.length > 0 && <span>{task.files.length} archivos</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 4, padding: '20px 0', color: 'var(--text-muted)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>Sin tareas</div>
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
            <div className="bento-card" style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={13} /></button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", textTransform: 'capitalize' }}>{format(calendarDate, 'MMMM yyyy', { locale: es })}</span>
                  <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={13} /></button>
                </div>
                <button onClick={() => setCalendarDate(new Date())} style={{ fontSize: 9, fontWeight: 700, padding: '4px 12px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-glow)', cursor: 'pointer' }}>Hoy</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 8, textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {dayHeaders.map(d => <div key={d} style={{ padding: '4px 0' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 14 }}>
                {weekRows.map((week, wi) => (
                  <React.Fragment key={wi}>
                    {week.map((day, di) => {
                      const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day) && t.status !== 'completado');
                      const isTodayDay = isToday(day);
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      const isSel = isSameDay(day, calendarSelectedDay);
                      return (
                        <div key={di} onClick={() => setCalendarSelectedDay(day)}
                          style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms', background: isTodayDay ? 'var(--accent)' : isSel ? 'var(--bg-elevated)' : 'transparent', border: isSel && !isTodayDay ? '1px solid var(--border-default)' : '1px solid transparent', color: isTodayDay ? '#fff' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isTodayDay ? 700 : 600, fontSize: 11 }}>
                          <span>{format(day, 'd')}</span>
                          {dayTasks.length > 0 && !isTodayDay && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginTop: 2 }} />}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>{format(calendarSelectedDay, "d 'de' MMMM", { locale: es })}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarSelectedDay)).map(task => {
                    const isOverdue = new Date(task.dueDate!).getTime() < Date.now() && task.status !== 'completado';
                    const isDone = task.status === 'completado';
                    return (
                      <div key={task.id} onClick={() => handleOpenDetail(task.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: isDone ? 'var(--bg-elevated)' : 'var(--bg-hover)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'transparent'}`, opacity: isDone ? 0.5 : 1 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: task.courseColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</span>
                        {isOverdue && <AlertTriangle size={10} style={{ color: '#EF4444', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                  {tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarSelectedDay)).length === 0 && (
                    <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>Sin tareas</div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

          {/* Mini Calendar */}
          {viewMode !== 'calendar' && (
            <div className="bento-card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calendario</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} style={{ width: 24, height: 24, borderRadius: 4, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={12} /></button>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{format(calendarDate, 'MMM', { locale: es })}</span>
                  <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} style={{ width: 24, height: 24, borderRadius: 4, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={12} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, textAlign: 'center', fontSize: 7, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>
                {dayHeaders.map(d => <div key={d} style={{ padding: '2px 0' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
                {weekRows.map((week, wi) => (
                  <React.Fragment key={wi}>
                    {week.map((day, di) => {
                      const hasTasks = tasks.some(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                      const isTodayDay = isToday(day);
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      return (
                        <div key={di} onClick={() => { setCalendarSelectedDay(day); setCalendarDate(day); }}
                          style={{ aspectRatio: '1', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 9, fontWeight: isTodayDay ? 700 : 600, color: isTodayDay ? '#fff' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)', background: isTodayDay ? 'var(--accent)' : 'transparent' }}>
                          <span>{format(day, 'd')}</span>
                          {hasTasks && !isTodayDay && <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)', marginTop: 1 }} />}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div className="bento-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={12} style={{ color: 'var(--accent)' }} /> Próximas
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tasks.filter(t => t.status !== 'completado' && t.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 5).map(t => (
                <div key={t.id} onClick={() => handleOpenDetail(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 5, cursor: 'pointer', transition: 'all 150ms' }} className="hover:bg-white/[0.02]">
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: t.courseColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: '#F59E0B', flexShrink: 0 }}>{getTimeRemaining(t.dueDate!)}</span>
                </div>
              ))}
              {tasks.filter(t => t.status !== 'completado' && t.dueDate).length === 0 && <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 9, color: 'var(--text-tertiary)' }}>Todo al día</div>}
            </div>
          </div>

          {/* Weekly Load */}
          <div className="bento-card" style={{ padding: '12px 14px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Carga semanal</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, padding: '0 2px' }}>
              {weeklyHours.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', borderRadius: '2px 2px 0 0', background: i === new Date().getDay() ? 'var(--accent)' : 'var(--border-subtle)', height: `${d.h}%`, transition: 'height 400ms' }} />
                  <span style={{ fontSize: 6, fontWeight: 600, color: 'var(--text-muted)' }}>{d.l}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 8, color: 'var(--text-tertiary)' }}>
              <span>{totalEst.h}h {totalEst.m}m pendientes</span>
              <span>{stats.total} tareas</span>
            </div>
          </div>

          {/* Distribution */}
          <div className="bento-card" style={{ padding: '12px 14px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Distribución</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  {courseDistribution.length > 0 ? courseDistribution.map((c, i) => {
                    const circ = 81.68;
                    const off = courseDistribution.slice(0, i).reduce((sum, s) => sum - (s.pct / 100) * circ, 0);
                    return <circle key={c.name} cx="18" cy="18" r="13" fill="none" stroke={c.color} strokeWidth="3" strokeDasharray={`${(c.pct / 100) * circ} ${circ}`} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'all 500ms' }} />;
                  }) : <circle cx="18" cy="18" r="13" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{tasks.length}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                {courseDistribution.slice(0, 4).map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0 }}>{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="bento-card" style={{ padding: '12px 14px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>Estado</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  {statusData.length > 0 ? statusData.map((s, i) => {
                    const circ = 81.68;
                    const pct = totalStatus > 0 ? (s.val / totalStatus) * 100 : 0;
                    const off = statusData.slice(0, i).reduce((sum, prev) => { const pp = totalStatus > 0 ? (prev.val / totalStatus) * 100 : 0; return sum - (pp / 100) * circ; }, 0);
                    return <circle key={s.label} cx="18" cy="18" r="13" fill="none" stroke={s.color} strokeWidth="3" strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'all 500ms' }} />;
                  }) : <circle cx="18" cy="18" r="13" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.completadasPct}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                {[
                  { label: 'Hechas', val: stats.completadas, color: '#10B981' },
                  { label: 'Pendientes', val: stats.pendientes, color: '#F59E0B' },
                  { label: 'En curso', val: stats.progreso, color: '#3B82F6' },
                  { label: 'Vencidas', val: stats.vencidas, color: '#EF4444' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)' }}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* NEW TASK MODAL */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNewModal(false)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 440, padding: '24px 28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Prioridad</label>
                  <select id="new-task-priority" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Fecha límite</label>
                  <input id="new-task-duedate" type="date" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} />
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); }}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 480, height: '100%', borderRadius: 0, borderLeft: '1px solid var(--border-default)', padding: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setSelectedTaskId(null)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight size={15} />
                </button>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Detalle</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { if (selectedTask) { const cs = statusConfig[selectedTask.status]; toggleTaskStatus(selectedTask.id); toast.success(`Tarea movida a: ${cs.label}`); } }}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: 'none', background: statusConfig[selectedTask.status]?.color + '20', color: statusConfig[selectedTask.status]?.color }}>
                  {statusConfig[selectedTask.status]?.label} → {statusConfig[statusConfig[selectedTask.status]?.next]?.label}
                </button>
                <button onClick={() => { deleteTask(selectedTask.id); setSelectedTaskId(null); }} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button onClick={() => toggleTaskStatus(selectedTask.id)}
                  style={{ marginTop: 2, width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedTask.status === 'completado' ? '#10B981' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: selectedTask.status === 'completado' ? '#10B981' : 'transparent' }}>
                  {selectedTask.status === 'completado' && <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />}
                </button>
                <input value={selectedTask.title} onChange={e => updateTask(selectedTask.id, { title: e.target.value })}
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid transparent', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", outline: 'none' }}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'transparent'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-default)' }}>
                <div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>Curso</span>
                  <select value={selectedTask.course} onChange={e => { const course = courses.find(c => c.name === e.target.value); updateTask(selectedTask.id, { course: e.target.value, courseColor: course?.color || '#E11D48' }); }}
                    style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>Vence</span>
                  <input type="date" value={selectedTask.dueDate ? selectedTask.dueDate.split('T')[0] : ''} onChange={e => updateTask(selectedTask.id, { dueDate: e.target.value || undefined })}
                    style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} />
                </div>
                <div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>Estimado</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Timer size={11} style={{ color: 'var(--text-tertiary)' }} /> {selectedTask.estimatedMinutes || 0} min
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>Dedicado</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Clock size={11} style={{ color: 'var(--text-tertiary)' }} /> {((selectedTask.studyTime || 0) / 60).toFixed(1)}h
                  </div>
                </div>
              </div>

              <div className="bento-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}><ClipboardList size={13} style={{ color: 'var(--accent)' }} /> Subtareas</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTask.subtasks.filter(s => s.done).length}/{selectedTask.subtasks.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedTask.subtasks.map(st => (
                    <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => toggleSubTask(selectedTask.id, st.id)}
                        style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${st.done ? '#10B981' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', background: st.done ? '#10B981' : 'transparent' }}>
                        {st.done && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
                      </button>
                      <span style={{ fontSize: 10, fontWeight: 600, color: st.done ? 'var(--text-tertiary)' : 'var(--text-primary)', flex: 1, textDecoration: st.done ? 'line-through' : 'none' }}>{st.title}</span>
                      <button onClick={() => deleteSubTask(selectedTask.id, st.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><X size={10} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Agregar subtarea..." onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                    style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none' }} />
                  <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}
                    style={{ padding: '7px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', opacity: newSubtaskTitle.trim() ? 1 : 0.3 }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <div className="bento-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}><Paperclip size={13} style={{ color: 'var(--accent)' }} /> Materiales</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTask.files.length}</span>
                </div>
                {selectedTask.files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {selectedTask.files.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                        {getFileIcon(f.type, 13)}
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {f.type === 'pdf' && <button onClick={() => setPdfPreviewUrl(f.path)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 3 }}><Eye size={11} /></button>}
                          {f.type === 'video' && f.path.startsWith('http') && <a href={f.path} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-tertiary)', padding: 3 }}><ExternalLink size={11} /></a>}
                          <button onClick={() => removeTaskFile(selectedTask.id, f.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 3 }}><X size={10} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showAddMaterial ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['pdf', 'video', 'link', 'other'] as const).map(type => (
                        <button key={type} onClick={() => setNewMaterialType(type)}
                          style={{ flex: 1, padding: '5px 0', borderRadius: 5, fontSize: 8, fontWeight: 700, cursor: 'pointer', border: 'none', textTransform: 'uppercase', background: newMaterialType === type ? 'var(--accent)' : 'var(--bg-surface)', color: newMaterialType === type ? '#fff' : 'var(--text-secondary)' }}>{type}</button>
                      ))}
                    </div>
                    <input value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Nombre del material..."
                      style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none' }} />
                    {(newMaterialType === 'video' || newMaterialType === 'link') && (
                      <input value={newMaterialPath} onChange={e => setNewMaterialPath(e.target.value)} placeholder={newMaterialType === 'video' ? 'URL de YouTube...' : 'URL del enlace...'}
                        style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none' }} />
                    )}
                    {(newMaterialType === 'pdf' || newMaterialType === 'other') && (
                      <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, fontSize: 9, fontWeight: 600, cursor: 'pointer', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>
                        <Upload size={11} /> Subir archivo
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} accept={newMaterialType === 'pdf' ? '.pdf' : newMaterialType === 'video' ? '.mp4,.webm' : undefined} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); }}
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

              <div className="bento-card" style={{ padding: '14px 16px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <StickyNote size={13} style={{ color: 'var(--accent)' }} /> Notas
                </span>
                <textarea value={selectedTask.notes || ''} onChange={e => updateTask(selectedTask.id, { notes: e.target.value })} placeholder="Escribe notas, resúmenes o recordatorios..."
                  style={{ width: '100%', height: 80, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 10, color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {pdfPreviewUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setPdfPreviewUrl(null)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 900, height: '85vh', padding: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={13} style={{ color: 'var(--accent)' }} /> Vista previa
              </span>
              <button onClick={() => setPdfPreviewUrl(null)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-elevated)' }}>
              {pdfPreviewUrl.startsWith('http') ? (
                <iframe src={pdfPreviewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-tertiary)' }}>
                  <Eye size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Vista previa local no disponible</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
