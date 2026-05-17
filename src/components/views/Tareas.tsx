import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Search, Check, Trash2,
  ChevronRight, CalendarDays,
  Clock, List as ListIcon, FileText,
  Link, Video, File, X, Upload,
  ExternalLink, Eye, Filter,
  ClipboardList, ChevronLeft, Timer,
  Paperclip, StickyNote, GripVertical,
  Zap, Circle, CheckCircle, Loader,
  Bell, MoreVertical, AlertTriangle,
  ArrowUp, ArrowDown, CheckSquare,
  LayoutGrid, Calendar, Play
} from 'lucide-react';
import { useApp, Task } from '../../store/AppContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const statusConfig = {
  inicio: { label: 'Pendiente', color: '#F59E0B', next: 'progreso', icon: Circle },
  progreso: { label: 'En Curso', color: '#3B82F6', next: 'completado', icon: Loader },
  completado: { label: 'Completada', color: '#10B981', next: 'inicio', icon: CheckCircle },
};

function getTimeRemaining(dueDate: string): string {
  const parsed = new Date(dueDate);
  if (isNaN(parsed.getTime())) return '';
  const diff = parsed.getTime() - Date.now();
  if (diff <= 0) return 'Vencida';
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) {
    const h = Math.floor(diff / (1000 * 60 * 60));
    return h <= 0 ? 'Hoy, 23:59' : `Hoy, ${format(parsed, 'HH:mm')}`;
  }
  const d = Math.floor(days);
  return d === 1 ? 'Mañana 23:59' : format(parsed, "d MMM, HH:mm", { locale: es });
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
  const {
    tasks, courses, addTask, updateTask,
    toggleTaskStatus, deleteTask, addSubTask,
    toggleSubTask, deleteSubTask, addTaskFile,
    removeTaskFile, linkTaskToTimer, setNavigateTo,
    clearAllTasks
  } = useApp();

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

  const notificationCount = useMemo(() =>
    tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'completado').length,
  [tasks]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completadas = tasks.filter(t => t.status === 'completado').length;
    const pendientes = tasks.filter(t => t.status === 'inicio').length;
    const progreso = tasks.filter(t => t.status === 'progreso').length;
    const vencidas = tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'completado').length;
    
    return {
      total, completadas, pendientes, progreso, vencidas,
      completadasPct: total ? Math.round((completadas / total) * 100) : 0,
      pendientesPct: total ? Math.round((pendientes / total) * 100) : 0,
      progresoPct: total ? Math.round((progreso / total) * 100) : 0,
    };
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
      if (sortBy === 'prioridad') {
        const pWeight = { high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority as keyof typeof pWeight] || 1) - (pWeight[a.priority as keyof typeof pWeight] || 1);
      }
      if (sortBy === 'fecha') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return a.course.localeCompare(b.course);
    });
  }, [tasks, courseFilter, searchQuery, subTab, sortBy]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pdfPreviewUrl) { setPdfPreviewUrl(null); return; }
        if (selectedTaskId) { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); return; }
        if (showNewModal) { setShowNewModal(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfPreviewUrl, selectedTaskId, showNewModal]);

  const handleToggle = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    toggleTaskStatus(id);
  }, [toggleTaskStatus]);

  const handleOpenDetail = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, []);

  const handleCreateTask = useCallback(() => {
    const title = (document.getElementById('new-task-title') as HTMLInputElement)?.value?.trim();
    const courseSelect = document.getElementById('new-task-course') as HTMLSelectElement;
    const prioritySelect = document.getElementById('new-task-priority') as HTMLSelectElement;
    const dueDateInput = document.getElementById('new-task-duedate') as HTMLInputElement;
    const estimatedInput = document.getElementById('new-task-estimated') as HTMLInputElement;
    if (!title) { toast.error('Ingresa un título'); return; }
    
    const courseName = courseSelect?.value || 'General';
    const course = courses.find(c => c.name === courseName);
    const dueDate = dueDateInput?.value || undefined;
    const estimatedMinutes = estimatedInput?.value ? parseInt(estimatedInput.value) : 60;
    
    addTask({
      title, course: courseName,
      courseColor: course?.color || '#E11D48',
      priority: (prioritySelect?.value as any) || 'medium',
      urgent: prioritySelect?.value === 'high',
      important: prioritySelect?.value === 'high',
      dueDate, estimatedMinutes,
    });
    setShowNewModal(false);
    toast.success('Tarea creada exitosamente');
  }, [addTask, courses]);

  const handleAddSubtask = useCallback(() => {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    addSubTask(selectedTask.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  }, [selectedTask, newSubtaskTitle, addSubTask]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewMaterialFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setNewMaterialPath(dataUrl);
    };
    reader.readAsDataURL(file);
    if (!newMaterialName.trim()) {
      setNewMaterialName(file.name.replace(/\.[^/.]+$/, ''));
    }
    e.target.value = '';
  }, [newMaterialName]);

  const handleAddMaterial = useCallback(() => {
    if (!selectedTask || !newMaterialName.trim()) return;
    const useUrl = newMaterialType === 'video' || newMaterialType === 'link';
    const path = useUrl ? newMaterialPath.trim() : newMaterialPath;
    if (!path) { toast.error('Selecciona o ingresa la URL del material'); return; }
    const size = newMaterialFile?.size;
    const ext = newMaterialFile?.name.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', mp4: 'video', doc: 'doc', docx: 'doc' };
    const resolvedType = useUrl ? newMaterialType : (typeMap[ext] || 'other');
    addTaskFile(selectedTask.id, { name: newMaterialName.trim(), path, type: resolvedType, size });
    setNewMaterialName('');
    setNewMaterialPath('');
    setNewMaterialFile(null);
    setShowAddMaterial(false);
    toast.success('Material añadido');
  }, [selectedTask, newMaterialName, newMaterialPath, newMaterialFile, newMaterialType, addTaskFile]);

  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const weekRows: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weekRows.push(calendarDays.slice(i, i + 7));
  }

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "Sábado, d 'de' MMMM 'de' yyyy", { locale: es });

  // Course distribution calculation
  const courseDistribution = useMemo(() => {
    const map: Record<string, { count: number; color: string }> = {};
    tasks.forEach(t => {
      if (!map[t.course]) map[t.course] = { count: 0, color: t.courseColor };
      map[t.course].count++;
    });
    return Object.entries(map).map(([name, { count, color }]) => ({
      name, count, color, pct: tasks.length ? Math.round((count / tasks.length) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }, [tasks]);

  return (
    <div className="page-container flex flex-col gap-6 h-full overflow-y-auto overflow-x-hidden p-8 bg-background select-none">
      
      {/* ── 1. TOP HEADER ── */}
      <header className="flex items-center justify-between flex-shrink-0 border-b border-borderDark/40 pb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-textMain">Tareas</h1>
            <CheckCircle className="text-accent w-6 h-6" strokeWidth={2.5} />
          </div>
          <p className="text-xs text-textDim mt-1 font-medium">
            {viewMode === 'list' && subTab === 'todas' && 'Organiza, prioriza y completa tus tareas.'}
            {viewMode === 'list' && subTab === 'completadas' && `Tareas finalizadas — ${stats.completadas} completadas.`}
            {viewMode === 'list' && subTab === 'pendientes' && `Foco en lo que falta — ${stats.pendientes} por hacer.`}
            {viewMode === 'list' && subTab === 'progreso' && `En acción — ${stats.progreso} tareas en curso.`}
            {viewMode === 'list' && subTab === 'vencidas' && `Atención urgente — ${stats.vencidas} vencidas.`}
            {viewMode === 'board' && 'Arrastra las tareas entre columnas para cambiar su estado.'}
            {viewMode === 'calendar' && 'Visualiza y gestiona tareas en tu calendario.'}
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-semibold text-success tracking-wide">Conectado</span>
          </div>

          {/* Bell Icon with notification badge */}
          <button className="w-10 h-10 rounded-xl bg-surface border border-borderDark flex items-center justify-center text-textDim hover:text-textMain hover:border-borderDark/80 transition-all cursor-pointer relative" onClick={() => { if (notificationCount > 0) setSubTab('vencidas'); }}>
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-error border-2 border-background flex items-center justify-center text-[9px] font-semibold text-white shadow-sm shadow-error/30">{notificationCount}</span>
            )}
          </button>

          {/* LED Clock */}
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1 bg-surface border border-borderDark px-4 py-1.5 rounded-lg shadow-inner">
              <span className="led-display text-3xl font-light tracking-wider text-accent">{timeStr}</span>
              <span className="led-seconds text-sm font-semibold text-accent/70">{secondsStr}</span>
            </div>
            <span className="text-[10px] text-textDim mt-1 font-medium capitalize">{dateStr}</span>
          </div>
        </div>
      </header>

      {/* ── 2. SUB-HEADER / TOOLBAR ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-surface border border-borderDark p-1 rounded-lg shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-textDim hover:text-textMain'
            }`}
          >
            <ListIcon size={14} /> Lista
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'board' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-textDim hover:text-textMain'
            }`}
          >
            <LayoutGrid size={14} /> Tablero
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'calendar' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-textDim hover:text-textMain'
            }`}
          >
            <Calendar size={14} /> Calendario
          </button>
        </div>

        {/* Search + Filter + New Task */}
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textDim" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-borderDark rounded-lg pl-10 pr-12 py-2 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-background border border-borderDark rounded text-[9px] font-semibold text-textDim">⌘K</span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-9 top-1/2 -translate-y-1/2 text-textDim hover:text-textMain">
                <X size={12} />
              </button>
            )}
          </div>

          <button className="flex items-center gap-2 bg-surface border border-borderDark hover:border-borderDark/80 px-4 py-2.5 rounded-lg text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">
            <Filter size={14} /> Filtros
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 bg-accent hover:opacity-90 text-white px-6 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* ── 3. MAIN BODY LAYOUT (Left Main Area + Right Panel) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* ── LEFT MAIN AREA (col-span-2) ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <div className="bento-card flex-1 flex flex-col bg-surface border border-borderDark rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-4">
                <div className="flex items-center gap-6">
                  {[
                    { id: 'todas', label: 'Todas' },
                    { id: 'pendientes', label: 'Pendientes' },
                    { id: 'progreso', label: 'En progreso' },
                    { id: 'completadas', label: 'Completadas' },
                    { id: 'vencidas', label: 'Vencidas' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setSubTab(tab.id as any)} className={`text-xs font-semibold pb-4 -mb-4 border-b-2 transition-all cursor-pointer ${subTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-textMain'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-surface2 border border-borderDark px-3 py-1.5 rounded-xl text-xs font-semibold text-textDim cursor-pointer hover:border-borderDark/80">
                  <span>Ordenar:</span>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-transparent text-textMain font-semibold border-none outline-none cursor-pointer">
                    <option value="prioridad">Prioridad</option>
                    <option value="fecha">Fecha límite</option>
                    <option value="curso">Curso</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 pb-3 border-b border-borderDark text-[10px] font-semibold text-textDim uppercase tracking-wider px-2">
                <div className="col-span-5">Tarea</div>
                <div className="col-span-2">Curso</div>
                <div className="col-span-2">Prioridad</div>
                <div className="col-span-2">Fecha Límite</div>
                <div className="col-span-1 text-center">Estado</div>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1 mt-3">
                {filteredTasks.map(task => {
                  const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completado';
                  const isDone = task.status === 'completado';
                  return (
                    <div key={task.id} onClick={() => handleOpenDetail(task.id)} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all cursor-pointer ${isDone ? 'bg-surface2/40 border-borderDark/40 opacity-60' : 'bg-surface2 border-borderDark hover:border-borderDark/80 hover:bg-surface2/80 shadow-sm'} ${isOverdue ? 'border-error/40 hover:border-error' : ''}`}>
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <button onClick={e => handleToggle(e, task.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${isDone ? 'bg-success border-success text-white shadow-sm shadow-success/20' : 'border-borderDark hover:border-accent'}`}>
                          {isDone && <Check size={12} strokeWidth={3} />}
                        </button>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-xs font-semibold truncate ${isDone ? 'line-through text-textDim' : 'text-textMain'}`}>{task.title}</span>
                          <div className="flex items-center gap-3 mt-1">
                            {task.subtasks.length > 0 && (
                              <span className="text-[10px] font-medium text-textDim flex items-center gap-1"><ClipboardList size={10} /> {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>
                            )}
                            {task.files.length > 0 && (
                              <span className="text-[10px] font-medium text-textDim flex items-center gap-1"><Paperclip size={10} /> {task.files.length}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center truncate">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border truncate shadow-2xs" style={{ backgroundColor: `${task.courseColor}15`, borderColor: `${task.courseColor}30`, color: task.courseColor }}>{task.course}</span>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border ${task.priority === 'high' ? 'bg-error/10 border-error/20 text-error' : task.priority === 'medium' ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-success/10 border-success/20 text-success'}`}>
                          {task.priority === 'high' ? <ArrowUp size={10} strokeWidth={3} /> : task.priority === 'medium' ? <ArrowUp size={10} className="rotate-45" strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                          {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                      </div>
                      <div className="col-span-2 flex flex-col justify-center">
                        <span className={`text-xs font-semibold truncate ${isOverdue ? 'text-error font-semibold' : 'text-textDim'}`}>{task.dueDate ? getTimeRemaining(task.dueDate) : 'Sin fecha'}</span>
                        {task.estimatedMinutes && (
                          <span className="text-[10px] text-textDim font-medium flex items-center gap-1 mt-0.5"><Clock size={10} /> {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}m</span>
                        )}
                      </div>
                      <div className="col-span-1 flex items-center justify-between">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 border shadow-2xs ${task.status === 'completado' ? 'bg-success/10 border-success/20 text-success' : task.status === 'progreso' ? 'bg-info/10 border-info/20 text-info animate-pulse' : 'bg-warning/10 border-warning/20 text-warning'}`}>
                          {task.status === 'completado' ? <CheckCircle size={10} strokeWidth={2.5} /> : task.status === 'progreso' ? <Play size={10} fill="currentColor" /> : <Clock size={10} strokeWidth={2.5} />}
                          {task.status === 'completado' ? 'Completada' : task.status === 'progreso' ? 'En progreso' : 'Pendiente'}
                        </span>
                        <button onClick={e => { e.stopPropagation(); handleOpenDetail(task.id); }} className="p-1 rounded-lg text-textDim hover:text-textMain hover:bg-surface transition-all cursor-pointer"><MoreVertical size={16} /></button>
                      </div>
                    </div>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-3 py-12">
                    <CheckSquare size={32} className="opacity-30" />
                    <p className="text-xs font-medium">No se encontraron tareas en esta categoría.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-borderDark pt-4 mt-4 text-xs font-medium text-textDim px-2">
                <span>Mostrando 1 a {filteredTasks.length} de {tasks.length} tareas</span>
              </div>
            </div>
          )}

          {/* ── KANBAN BOARD VIEW ── */}
          {viewMode === 'board' && (
            <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-2">
              {[
                { status: 'inicio', label: 'Pendientes', icon: Clock, color: '#F59E0B', bg: 'rgba(245,158,11,0.04)' },
                { status: 'progreso', label: 'En Curso', icon: Loader, color: '#3B82F6', bg: 'rgba(59,130,246,0.04)' },
                { status: 'completado', label: 'Completadas', icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.04)' },
              ].map(col => {
                const colTasks = tasks.filter(t => t.status === col.status);
                const Icon = col.icon;
                return (
                  <div key={col.status} className="flex flex-col flex-1 min-w-[260px] rounded-xl border border-borderDark" style={{ background: col.bg }}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-borderDark flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} style={{ color: col.color }} />
                        <span className="text-xs font-semibold text-textMain">{col.label}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-textDim bg-surface2 border border-borderDark rounded-lg px-2 py-0.5">{colTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 p-3 overflow-y-auto flex-1">
                      {colTasks.map(task => (
                        <div key={task.id} onClick={() => handleOpenDetail(task.id)} className="p-3 rounded-lg bg-surface border border-borderDark hover:border-borderDark/80 shadow-sm transition-all cursor-pointer">
                          <div className="flex items-start gap-2.5">
                            <button onClick={e => { e.stopPropagation(); toggleTaskStatus(task.id); }} className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${task.status === 'completado' ? 'bg-success border-success' : 'border-borderDark hover:border-accent'}`}>
                              {task.status === 'completado' && <Check size={9} strokeWidth={3} className="text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold truncate ${task.status === 'completado' ? 'line-through text-textDim' : 'text-textMain'}`}>{task.title}</div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border" style={{ backgroundColor: `${task.courseColor}15`, borderColor: `${task.courseColor}25`, color: task.courseColor }}>{task.course}</span>
                                {task.dueDate && (
                                  <span className={`text-[9px] font-medium ${new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completado' ? 'text-error' : 'text-textDim'}`}>
                                    {format(new Date(task.dueDate), "d MMM", { locale: es })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {(task.subtasks.length > 0 || task.files.length > 0) && (
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-borderDark">
                              {task.subtasks.length > 0 && <span className="text-[9px] text-textDim flex items-center gap-1"><ClipboardList size={9} /> {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>}
                              {task.files.length > 0 && <span className="text-[9px] text-textDim flex items-center gap-1"><Paperclip size={9} /> {task.files.length}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-2 py-8 opacity-50">
                          <CheckSquare size={24} />
                          <p className="text-[10px] font-medium">Sin tareas</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CALENDAR VIEW ── */}
          {viewMode === 'calendar' && (
            <div className="bento-card flex-1 flex flex-col bg-surface border border-borderDark rounded-xl p-6 shadow-sm overflow-y-auto">
              {/* Month Nav */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="p-1.5 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer"><ChevronLeft size={14} /></button>
                  <span className="text-sm font-semibold text-textMain capitalize w-32 text-center">{format(calendarDate, 'MMMM yyyy', { locale: es })}</span>
                  <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="p-1.5 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer"><ChevronRight size={14} /></button>
                </div>
                <button onClick={() => setCalendarDate(new Date())} className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-xl hover:bg-accent/20 transition-all cursor-pointer">Hoy</button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] font-semibold text-textDim uppercase tracking-wider">{dayHeaders.map(d => <div key={d}>{d}</div>)}</div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {weekRows.map((week, wi) => (
                  <React.Fragment key={wi}>
                    {week.map((day, di) => {
                      const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day) && t.status !== 'completado');
                      const hasDue = dayTasks.length > 0;
                      const isTodayDay = isToday(day);
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      const isSel = isSameDay(day, calendarSelectedDay);
                      return (
                        <div key={di} onClick={() => setCalendarSelectedDay(day)} className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-semibold text-xs ${isTodayDay ? 'bg-accent text-white shadow-sm shadow-accent/20' : isSel ? 'bg-surface2 border border-borderDark text-textMain' : isCurrentMonth ? 'text-textMain hover:bg-surface2/50' : 'text-textDim/40'}`}>
                          <span>{format(day, 'd')}</span>
                          {hasDue && !isTodayDay && <div className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full" style={{ background: isSel ? 'var(--accent)' : '#22C55E' }} />}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              {/* Selected day tasks */}
              <div className="border-t border-borderDark pt-4 mt-1">
                <div className="text-[10px] font-semibold text-textDim uppercase tracking-wider mb-3">{format(calendarSelectedDay, "d 'de' MMMM", { locale: es })} — Tareas</div>
                <div className="flex flex-col gap-2">
                  {tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarSelectedDay)).map(task => {
                    const isOverdue = new Date(task.dueDate!).getTime() < Date.now() && task.status !== 'completado';
                    const isDone = task.status === 'completado';
                    return (
                      <div key={task.id} onClick={() => handleOpenDetail(task.id)} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isDone ? 'bg-surface2/40 border-borderDark/40 opacity-60' : 'bg-surface2 border-borderDark hover:border-borderDark/80 shadow-sm'}`}>
                        <button onClick={e => handleToggle(e, task.id)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${isDone ? 'bg-success border-success' : 'border-borderDark hover:border-accent'}`}>
                          {isDone && <Check size={9} strokeWidth={3} className="text-white" />}
                        </button>
                        <span className={`text-xs flex-1 truncate ${isDone ? 'line-through text-textDim' : 'text-textMain'}`}>{task.title}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border flex-shrink-0`} style={{ backgroundColor: `${task.courseColor}15`, borderColor: `${task.courseColor}25`, color: task.courseColor }}>{task.course}</span>
                        {isOverdue && <AlertTriangle size={12} className="text-error flex-shrink-0" />}
                      </div>
                    );
                  })}
                  {tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarSelectedDay)).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-textDim gap-2">
                      <CalendarDays size={24} className="opacity-30" />
                      <p className="text-xs font-medium">Sin tareas para este día.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT PANEL (col-span-1) ── */}
        <div className="lg:col-span-1 flex flex-col gap-3 overflow-y-auto pr-1">
          
          {/* Conditional Mini Calendar — hidden on calendar view */}
          {viewMode !== 'calendar' && (
            <div className="bento-card p-4 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold text-textDim uppercase tracking-wider">Calendario</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="p-1 rounded-md bg-surface2 border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer">
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-[11px] font-semibold text-textMain capitalize w-22 text-center">
                    {format(calendarDate, 'MMM yyyy', { locale: es })}
                  </span>
                  <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="p-1 rounded-md bg-surface2 border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-px mb-1.5 text-center text-[9px] font-semibold text-textDim uppercase tracking-wider">
                {dayHeaders.map(d => <div key={d} className="py-0.5">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {weekRows.map((week, wi) => (
                  <React.Fragment key={wi}>
                    {week.map((day, di) => {
                      const hasTasks = tasks.some(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                      const isTodayDay = isToday(day);
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      return (
                        <div key={di} onClick={() => setCalendarSelectedDay(day)} className={`aspect-square rounded-md flex flex-col items-center justify-center relative transition-all cursor-pointer text-[11px] font-semibold ${isTodayDay ? 'bg-accent text-white' : isSameDay(day, calendarSelectedDay) ? 'bg-surface2 border border-borderDark text-textMain' : isCurrentMonth ? 'text-textMain hover:bg-surface2/50' : 'text-textDim/30'}`}>
                          <span>{format(day, 'd')}</span>
                          {hasTasks && !isTodayDay && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent" />}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => setViewMode('calendar')} className="w-full mt-4 py-2.5 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-lg text-[11px] font-semibold text-textDim hover:text-textMain transition-all cursor-pointer">Agenda completa</button>
            </div>
          )}

          {/* PRÓXIMAS ENTREGAS */}
          <div className="bento-card p-4 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-borderDark pb-3">
              <span className="text-[11px] font-semibold text-textDim uppercase tracking-wider flex items-center gap-2"><Clock size={14} className="text-accent" /> Próximas entregas</span>
            </div>
            <div className="flex flex-col gap-2">
              {filteredTasks.filter(t => t.status !== 'completado' && t.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all cursor-pointer" onClick={() => handleOpenDetail(t.id)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.courseColor }} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-textMain truncate">{t.title}</span>
                      <span className="text-[10px] text-textDim/70 mt-0.5">{t.course}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 pl-2">
                    <span className="text-[11px] font-semibold text-accent">{getTimeRemaining(t.dueDate!)}</span>
                  </div>
                </div>
              ))}
              {filteredTasks.filter(t => t.status !== 'completado' && t.dueDate).length === 0 && (
                <div className="flex flex-col items-center justify-center text-textDim gap-2 py-5">
                  <CheckCircle size={22} className="opacity-20" />
                  <p className="text-xs">Sin entregas pendientes</p>
                </div>
              )}
            </div>
            <button onClick={() => setSubTab('pendientes')} className="w-full mt-4 py-2.5 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-lg text-[11px] font-semibold text-textDim hover:text-textMain transition-all cursor-pointer">Ver todas</button>
          </div>

          {/* ── ANALYTICS SECTION ── */}
          <div className="flex flex-col gap-3 mt-1 pt-3 border-t border-borderDark/40">
            {/* CARGA DE TRABAJO SEMANAL */}
            <div className="bento-card p-4 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm">
              <span className="text-[11px] font-semibold text-textDim uppercase tracking-wider mb-4 border-b border-borderDark pb-3">Carga semanal</span>
              <div className="flex items-end justify-between gap-1.5 h-28 px-0.5">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                  const h = [40, 70, 55, 90, 30, 15, 10][idx];
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end">
                      <div className="w-full bg-accent hover:bg-accent/80 rounded-sm transition-all cursor-pointer" style={{ height: `${h}%` }} />
                      <span className="text-[9px] font-semibold text-textDim/60">{day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-borderDark">
                <div><span className="text-[9px] font-semibold text-textDim/60 uppercase tracking-wider block">Total</span><span className="text-base font-semibold text-textMain">10h 45m</span></div>
                <div className="text-right"><span className="text-[9px] font-semibold text-textDim/60 uppercase tracking-wider block">Promedio</span><span className="text-base font-semibold text-textMain">1h 30m</span></div>
              </div>
            </div>

            {/* DISTRIBUCIÓN POR CURSO (donut) */}
            <div className="bento-card p-4 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm">
              <span className="text-[11px] font-semibold text-textDim uppercase tracking-wider mb-4 border-b border-borderDark pb-3">Distribución</span>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
                  {courseDistribution.length > 0 ? (
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      {courseDistribution.map((c, i) => {
                        const circumference = 81.68;
                        const offset = courseDistribution.slice(0, i).reduce((sum, s) => sum - (s.pct / 100) * circumference, 0);
                        return (
                          <circle key={c.name} cx="18" cy="18" r="13" fill="none" stroke={c.color} strokeWidth="3"
                            strokeDasharray={`${(c.pct / 100) * circumference} ${circumference}`}
                            strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500"
                          />
                        );
                      })}
                    </svg>
                  ) : (
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    </svg>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-textDim">{tasks.length}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {courseDistribution.map(c => (
                    <div key={c.name} className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-[10px] text-textMain truncate">{c.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-textDim/70 flex-shrink-0">{c.count} · {c.pct}%</span>
                    </div>
                  ))}
                  {courseDistribution.length === 0 && <p className="text-[10px] text-textDim/50 text-center py-3">Sin tareas</p>}
                </div>
              </div>
            </div>

            {/* ESTADO DE TAREAS (donut) */}
            <div className="bento-card p-4 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm">
              <span className="text-[11px] font-semibold text-textDim uppercase tracking-wider mb-4 border-b border-borderDark pb-3">Estado</span>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
                  {(() => {
                    const statusData = [
                      { label: 'Completadas', val: stats.completadas, color: '#10B981' },
                      { label: 'Pendientes', val: stats.pendientes, color: '#F59E0B' },
                      { label: 'En progreso', val: stats.progreso, color: '#3B82F6' },
                      { label: 'Vencidas', val: stats.vencidas, color: '#EF4444' },
                    ].filter(s => s.val > 0);
                    const total = statusData.reduce((sum, s) => sum + s.val, 0);
                    const circumference = 81.68;
                    return statusData.length > 0 ? (
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {statusData.map((s, i) => {
                          const pct = total > 0 ? (s.val / total) * 100 : 0;
                          const offset = statusData.slice(0, i).reduce((sum, prev) => {
                            const prevPct = total > 0 ? (prev.val / total) * 100 : 0;
                            return sum - (prevPct / 100) * circumference;
                          }, 0);
                          return (
                            <circle key={s.label} cx="18" cy="18" r="13" fill="none" stroke={s.color} strokeWidth="3"
                              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                              strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500"
                            />
                          );
                        })}
                      </svg>
                    ) : (
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      </svg>
                    );
                  })()}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-textDim">{stats.completadasPct}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {[
                    { label: 'Completadas', val: stats.completadas, color: '#10B981' },
                    { label: 'Pendientes', val: stats.pendientes, color: '#F59E0B' },
                    { label: 'En progreso', val: stats.progreso, color: '#3B82F6' },
                    { label: 'Vencidas', val: stats.vencidas, color: '#EF4444' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] text-textMain">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-textDim/70">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── 6. MODALS & PANELS (Preserved from existing code) ── */}
      
      {/* NEW TASK MODAL */}
      {showNewModal && (
        <div role="dialog" aria-modal="true" aria-label="Nueva tarea" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewModal(false)}>
          <div className="bento-card w-full max-w-md p-5 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <Plus size={20} className="text-accent" strokeWidth={2.5} /> Nueva Tarea
              </h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Título de la tarea</label>
                <input id="new-task-title" type="text" placeholder="Ej. Resolver problemas de física..." className="w-full bg-surface2 border border-borderDark rounded-lg px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Curso</label>
                  <select id="new-task-course" className="w-full bg-surface2 border border-borderDark rounded-lg px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner">
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Prioridad</label>
                  <select id="new-task-priority" className="w-full bg-surface2 border border-borderDark rounded-lg px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner">
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Fecha límite</label>
                  <input id="new-task-duedate" type="date" className="w-full bg-surface2 border border-borderDark rounded-lg px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner color-scheme-dark" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Tiempo estimado (min)</label>
                  <input id="new-task-estimated" type="number" min="1" placeholder="60" className="w-full bg-surface2 border border-borderDark rounded-lg px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all shadow-inner" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewModal(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-lg text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleCreateTask} className="px-8 py-3 bg-accent hover:opacity-90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Crear tarea</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASK DETAIL PANEL */}
      {selectedTaskId && selectedTask && (
        <div role="dialog" aria-modal="true" aria-label="Detalle de tarea" className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-md animate-fadeIn" onClick={() => { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); }}>
          <div className="w-full max-w-lg h-full bg-surface border-l border-borderDark shadow-sm flex flex-col animate-slideInRight" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-borderDark p-6 bg-surface flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedTaskId(null)} className="p-2 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer">
                  <ChevronRight size={16} />
                </button>
                <span className="text-xs font-semibold text-textDim uppercase tracking-wider">Detalle de la tarea</span>
              </div>
              <button onClick={() => { deleteTask(selectedTask.id); setSelectedTaskId(null); }} className="p-2 rounded-xl bg-error/10 border border-error/20 text-error hover:bg-error/20 transition-all cursor-pointer shadow-sm shadow-error/10">
                <Trash2 size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
              {/* Title + Status */}
              <div className="flex items-start gap-4">
                <button onClick={() => toggleTaskStatus(selectedTask.id)} className="mt-1 p-3 rounded-lg bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all flex-shrink-0 cursor-pointer shadow-sm">
                  {selectedTask.status === 'completado' ? <CheckCircle size={20} className="text-success" strokeWidth={2.5} /> :
                   selectedTask.status === 'progreso' ? <Loader size={20} className="text-info animate-spin" strokeWidth={2.5} /> :
                   <Circle size={20} className="text-warning" strokeWidth={2.5} />}
                </button>
                <input
                  type="text"
                  value={selectedTask.title}
                  onChange={e => updateTask(selectedTask.id, { title: e.target.value })}
                  className="w-full bg-transparent border-none text-xl font-semibold text-textMain focus:outline-none focus:border-b focus:border-accent pb-1 transition-all"
                />
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 bg-surface2 border border-borderDark p-6 rounded-xl shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Curso</span>
                  <select
                    value={selectedTask.course}
                    onChange={e => {
                      const course = courses.find(c => c.name === e.target.value);
                      updateTask(selectedTask.id, { course: e.target.value, courseColor: course?.color || '#E11D48' });
                    }}
                    className="bg-surface border border-borderDark rounded-xl px-3 py-2 text-xs font-semibold text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner"
                  >
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Fecha límite</span>
                  <input
                    type="date"
                    value={selectedTask.dueDate ? selectedTask.dueDate.split('T')[0] : ''}
                    onChange={e => updateTask(selectedTask.id, { dueDate: e.target.value || undefined })}
                    className="bg-surface border border-borderDark rounded-xl px-3 py-2 text-xs font-semibold text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner color-scheme-dark"
                  />
                </div>

                {selectedTask.estimatedMinutes && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Tiempo estimado</span>
                    <div className="flex items-center gap-2 bg-surface border border-borderDark rounded-xl px-3 py-2 text-xs font-semibold text-textMain shadow-inner">
                      <Timer size={14} className="text-textDim" />
                      <span>{selectedTask.estimatedMinutes} min</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Tiempo dedicado</span>
                  <div className="flex items-center gap-2 bg-surface border border-borderDark rounded-xl px-3 py-2 text-xs font-semibold text-textMain shadow-inner">
                    <Clock size={14} className="text-textDim" />
                    <span>{(selectedTask.studyTime / 60).toFixed(1)}h</span>
                  </div>
                </div>
              </div>

              {/* Subtasks */}
              <div className="bento-card p-5 flex flex-col bg-surface2 border border-borderDark rounded-xl shadow-sm gap-4">
                <div className="flex items-center justify-between border-b border-borderDark pb-3">
                  <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                    <ClipboardList size={16} className="text-accent" /> Subtareas
                  </span>
                  {selectedTask.subtasks.length > 0 && (
                    <span className="text-xs font-semibold text-textMain">
                      {selectedTask.subtasks.filter(s => s.done).length}/{selectedTask.subtasks.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  {selectedTask.subtasks.map(st => (
                    <div key={st.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-borderDark shadow-2xs">
                      <button
                        onClick={() => toggleSubTask(selectedTask.id, st.id)}
                        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                          st.done ? 'bg-success border-success text-white shadow-sm shadow-success/20' : 'border-borderDark hover:border-accent'
                        }`}
                      >
                        {st.done && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className={`text-xs font-semibold flex-1 ${st.done ? 'line-through text-textDim' : 'text-textMain'}`}>
                        {st.title}
                      </span>
                      <button onClick={() => deleteSubTask(selectedTask.id, st.id)} className="p-1 rounded-lg text-textDim hover:text-error hover:bg-surface2 transition-all cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    placeholder="Agregar nueva subtarea..."
                    className="w-full bg-surface border border-borderDark rounded-lg px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    className="p-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-lg transition-all shadow-sm shadow-accent/20 cursor-pointer flex-shrink-0"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Materials */}
              <div className="bento-card p-5 flex flex-col bg-surface2 border border-borderDark rounded-xl shadow-sm gap-4">
                <div className="flex items-center justify-between border-b border-borderDark pb-3">
                  <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                    <Paperclip size={16} className="text-accent" /> Materiales adjuntos
                  </span>
                  {selectedTask.files.length > 0 && (
                    <span className="text-xs font-semibold text-textMain">{selectedTask.files.length}</span>
                  )}
                </div>

                {selectedTask.files.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {selectedTask.files.map(f => (
                      <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-borderDark shadow-2xs">
                        <div className="w-8 h-8 rounded-xl bg-surface2 border border-borderDark flex items-center justify-center flex-shrink-0 shadow-inner">
                          {getFileIcon(f.type, 14)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-semibold text-textMain truncate">{f.name}</span>
                          <span className="text-[10px] font-medium text-textDim uppercase">{f.type} {f.size ? `· ${(f.size / 1024).toFixed(0)} KB` : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {f.type === 'pdf' && (
                            <button onClick={() => setPdfPreviewUrl(f.path)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                              <Eye size={14} />
                            </button>
                          )}
                          {f.type === 'video' && f.path.startsWith('http') && (
                            <a href={f.path} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button onClick={() => removeTaskFile(selectedTask.id, f.id)} className="p-2 rounded-xl text-textDim hover:text-error hover:bg-surface2 transition-all cursor-pointer">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showAddMaterial ? (
                  <div className="flex flex-col gap-4 p-5 bg-surface border border-borderDark rounded-lg shadow-inner mt-1">
                    <div className="flex items-center gap-2 bg-surface2 border border-borderDark p-1 rounded-xl shadow-2xs">
                      {(['pdf', 'video', 'link', 'other'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setNewMaterialType(type)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold uppercase transition-all cursor-pointer ${
                            newMaterialType === type ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-textDim hover:text-textMain'
                          }`}
                        >
                          {type === 'pdf' ? 'PDF' : type === 'video' ? 'Video' : type === 'link' ? 'Link' : 'Otro'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newMaterialName}
                        onChange={e => setNewMaterialName(e.target.value)}
                        placeholder="Nombre del material..."
                        className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-2.5 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner"
                      />
                      {newMaterialType !== 'link' && (
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-surface2 border border-borderDark hover:border-borderDark/80 px-4 py-2.5 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm flex-shrink-0">
                          <Upload size={14} /> Subir
                        </button>
                      )}
                    </div>

                    {(newMaterialType === 'pdf' || newMaterialType === 'video' || newMaterialType === 'other') && (
                      <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept={newMaterialType === 'pdf' ? '.pdf' : newMaterialType === 'video' ? '.mp4,.webm' : undefined} />
                    )}

                    {(newMaterialType === 'video' || newMaterialType === 'link') && (
                      <input
                        type="text"
                        value={newMaterialPath}
                        onChange={e => setNewMaterialPath(e.target.value)}
                        placeholder={newMaterialType === 'video' ? 'URL de YouTube o video...' : 'URL del enlace...'}
                        className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-2.5 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner"
                      />
                    )}

                    <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-4 mt-1">
                      <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); }} className="px-5 py-2 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                      <button onClick={handleAddMaterial} disabled={!newMaterialName.trim()} className="flex items-center gap-2 px-6 py-2 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">
                        <Plus size={14} strokeWidth={2.5} /> Añadir material
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddMaterial(true)} className="w-full py-3.5 bg-surface border border-dashed border-borderDark hover:border-accent rounded-lg text-xs font-semibold text-textDim hover:text-accent transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm mt-1">
                    <Plus size={16} strokeWidth={2.5} /> Añadir material adjunto
                  </button>
                )}
              </div>

              {/* Notes */}
              <div className="bento-card p-5 flex flex-col bg-surface2 border border-borderDark rounded-xl shadow-sm gap-4">
                <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2 border-b border-borderDark pb-3">
                  <StickyNote size={16} className="text-accent" /> Notas de la tarea
                </span>
                <textarea
                  value={selectedTask.notes || ''}
                  onChange={e => updateTask(selectedTask.id, { notes: e.target.value })}
                  placeholder="Escribe notas, resúmenes o recordatorios sobre esta tarea..."
                  className="w-full h-32 bg-surface border border-borderDark rounded-lg p-4 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {pdfPreviewUrl && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-8 animate-fadeIn" onClick={() => setPdfPreviewUrl(null)}>
          <div className="w-full max-w-5xl h-[85vh] bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col overflow-hidden animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-borderDark px-6 py-4 bg-surface flex-shrink-0">
              <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                <Eye size={16} className="text-accent" /> Vista previa del documento
              </span>
              <button onClick={() => setPdfPreviewUrl(null)} className="p-2 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer">
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 bg-surface2 relative overflow-hidden">
              {pdfPreviewUrl.startsWith('http') ? (
                <iframe src={pdfPreviewUrl} className="w-full h-full border-none" title="PDF Preview" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-textDim gap-3">
                  <Eye size={32} className="opacity-30" />
                  <p className="text-xs font-medium">Vista previa local no disponible en este modo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
