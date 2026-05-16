import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Search, Check, Trash2,
  ChevronRight, CalendarDays,
  Clock, List as ListIcon, FileText,
  Link, Video, File, X, Upload,
  ExternalLink, Eye, Filter,
  ClipboardList, ChevronLeft, Timer,
  Paperclip, StickyNote, GripVertical,
  Zap, Circle, CheckCircle, Loader
} from 'lucide-react';
import { useApp, Task } from '../../store/AppContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const statusConfig = {
  inicio: { label: 'Pendiente', color: 'var(--accent)', next: 'progreso', icon: Circle },
  progreso: { label: 'En Curso', color: '#F59E0B', next: 'completado', icon: Loader },
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
    return h <= 0 ? 'Hoy' : `${h}h`;
  }
  const d = Math.floor(days);
  return d === 1 ? '1 día' : `${d} días`;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
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

  const stats = useMemo(() => ({
    total: tasks.length,
    inicio: tasks.filter(t => t.status === 'inicio').length,
    completado: tasks.filter(t => t.status === 'completado').length,
    progreso: tasks.filter(t => t.status === 'progreso').length
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (courseFilter) filtered = filtered.filter(t => t.course === courseFilter);
    if (searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered;
  }, [tasks, courseFilter, searchQuery]);

  const levels = [
    { id: 'inicio', title: 'Pendientes', filter: (t: Task) => t.status === 'inicio' },
    { id: 'progreso', title: 'En Curso', filter: (t: Task) => t.status === 'progreso' },
    { id: 'completado', title: 'Completadas', filter: (t: Task) => t.status === 'completado' }
  ];

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
    const dueDateInput = document.getElementById('new-task-duedate') as HTMLInputElement;
    const estimatedInput = document.getElementById('new-task-estimated') as HTMLInputElement;
    if (!title) { toast.error('Ingresa un título'); return; }
    const course = courses.find(c => c.name === courseSelect?.value);
    const dueDate = dueDateInput?.value || undefined;
    const estimatedMinutes = estimatedInput?.value ? parseInt(estimatedInput.value) : undefined;
    addTask({
      title, course: courseSelect?.value || 'General',
      courseColor: course?.color || '#E11D48',
      priority: 'medium', urgent: false, important: false,
      dueDate, estimatedMinutes,
    });
    setShowNewModal(false);
    toast.success('Tarea creada');
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

  const handleCalendarTaskDrop = useCallback((taskId: string, date: Date) => {
    const task = tasks.find(t => t.id === taskId);
    const newDate = date.toISOString().split('T')[0];
    if (task?.dueDate === newDate) return;
    updateTask(taskId, { dueDate: newDate });
    toast.success('Fecha actualizada');
  }, [updateTask, tasks]);

  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const selectedDayTasks = useMemo(() =>
    tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), calendarSelectedDay)),
    [tasks, calendarSelectedDay]
  );

  const weekRows: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weekRows.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', height: '100%', overflow: 'hidden', padding: '20px 28px' }}>

      {/* ── HEADER (sin título "Tareas", solo stats y controles) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            { label: 'Pendientes', val: stats.inicio, color: 'var(--accent)' },
            { label: 'En Curso', val: stats.progreso, color: '#F59E0B' },
            { label: 'Completadas', val: stats.completado, color: '#10B981' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{s.val}</span>
              <span style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)' }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '4px 10px', borderRadius: 6, background: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 10, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ListIcon size={12} /> Lista
          </button>
          <button onClick={() => setViewMode('calendar')} style={{ padding: '4px 10px', borderRadius: 6, background: viewMode === 'calendar' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: viewMode === 'calendar' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 10, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CalendarDays size={12} /> Calendario
          </button>
        </div>
      </div>

      {/* ── Search + New ── */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar tareas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-base" style={{ paddingLeft: 32, paddingRight: searchQuery ? 28 : 10, fontSize: 11, height: 32 }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={12} />
            </button>
          )}
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', fontSize: 11, fontWeight: 600, height: 32 }}>
          <Plus size={14} /> NUEVA
        </button>
      </div>

      {/* ── Course filters ── */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0, paddingBottom: 2 }}>
        <button onClick={() => setCourseFilter(null)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: !courseFilter ? 'var(--bg-elevated)' : 'var(--bg-surface)', fontSize: 9, fontWeight: 600, color: !courseFilter ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 200ms', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={10} /> Todos
        </button>
        {courses.map(c => (
          <button key={c.id} onClick={() => setCourseFilter(courseFilter === c.name ? null : c.name)} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid var(--border-subtle)`, background: courseFilter === c.name ? `${c.color}18` : 'var(--bg-surface)', fontSize: 9, fontWeight: 600, color: courseFilter === c.name ? c.color : 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 200ms', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT (List + Bottom Calendar) ── */}
      {viewMode === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>

          {/* List of Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {levels.map(level => {
              const levelTasks = filteredTasks.filter(level.filter);
              if (levelTasks.length === 0) return null;
              const StatusIcon = statusConfig[level.id as keyof typeof statusConfig].icon;
              return (
                <div key={level.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 2 }}>
                    <StatusIcon size={11} style={{ color: statusConfig[level.id as keyof typeof statusConfig].color }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                      {level.title}
                      <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--text-muted)', fontSize: 9 }}>{levelTasks.length}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {levelTasks.map((task, ti) => {
                      const remaining = task.dueDate ? getTimeRemaining(task.dueDate) : null;
                      const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completado';
                      const cfg = statusConfig[task.status];
                      return (
                        <div key={task.id} className="bento-card" style={{ padding: '8px 14px', cursor: 'default', borderColor: isOverdue ? 'color-mix(in srgb, var(--error) 40%, transparent)' : undefined, animation: 'fadeIn 400ms ease forwards', animationDelay: `${ti * 40}ms`, opacity: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.borderColor = isOverdue ? 'var(--error)' : 'rgba(255,255,255,0.10)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.borderColor = isOverdue ? 'color-mix(in srgb, var(--error) 40%, transparent)' : 'rgba(255,255,255,0.04)'; }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* 3-state status toggle */}
                            <div onClick={(e) => handleToggle(e, task.id)} style={{ cursor: 'pointer', flexShrink: 0, position: 'relative', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%',
                                border: `2px solid ${cfg.color}`,
                                background: task.status === 'completado' ? cfg.color : 'transparent',
                                transition: 'all 300ms', position: 'relative',
                                boxShadow: task.status === 'completado' ? `0 0 6px ${cfg.color}` : 'none',
                              }}>
                                {task.status === 'completado' && <Check size={9} color="#fff" strokeWidth={3} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />}
                              </div>
                              {task.status === 'progreso' && <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />}
                            </div>

                            {/* Task info */}
                            <div onClick={() => handleOpenDetail(task.id)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: task.status === 'completado' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'completado' ? 'line-through' : 'none' }}>
                                {task.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                <div style={{ padding: '1px 6px 1px 4px', borderRadius: 3, background: `${task.courseColor}14`, fontSize: 8, fontWeight: 600, color: task.courseColor, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: task.courseColor }} />
                                  {task.course}
                                </div>
                                {isOverdue && <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 2, background: 'color-mix(in srgb, var(--error) 8%, transparent)', padding: '1px 5px', borderRadius: 3 }}><CalendarDays size={8} /> Vencida</span>}
                                {task.subtasks.length > 0 && <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}><ClipboardList size={8} /> {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>}
                                {task.files.length > 0 && <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}><Paperclip size={8} /> {task.files.length}</span>}
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenDetail(task.id); }} style={{ padding: '4px 8px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                                Detalle
                              </button>
                              {task.status !== 'completado' && (
                                <button onClick={(e) => { e.stopPropagation(); linkTaskToTimer(task.id); setNavigateTo('estudio'); }} style={{ padding: '4px 8px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 9, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }} onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                  <Zap size={10} /> Estudiar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Calendar & Stats Row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>

            {/* Próximas Entregas (Timeline) */}
            <div className="bento-card" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <Clock size={13} className="text-accent" /> Próximas Entregas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredTasks.filter(t => t.status !== 'completado' && t.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 3).map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                    {i !== 2 && <div style={{ position: 'absolute', left: 4, top: 14, bottom: -12, width: 1, background: 'var(--border-subtle)' }} />}
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.courseColor, border: '2px solid var(--bg-surface)', position: 'relative', zIndex: 1, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{getTimeRemaining(t.dueDate!)}</div>
                    </div>
                  </div>
                ))}
                {filteredTasks.filter(t => t.status !== 'completado' && t.dueDate).length === 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No hay tareas próximas</div>
                )}
              </div>
            </div>

            {/* Mini Calendar */}
            <div className="bento-card" style={{ width: 280, padding: '16px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {format(calendarDate, 'MMMM yyyy', { locale: es })}
                </div>
                <button onClick={() => setViewMode('calendar')} className="btn-secondary" style={{ fontSize: 9, padding: '4px 8px' }}>Ver completo</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {dayHeaders.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', padding: '2px 0' }}>{d[0]}</div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {weekRows.slice(0, 5).map((week, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                    {week.map((day, di) => {
                      const hasTasks = tasks.some(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                      const isTodayDay = isToday(day);
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      return (
                        <div key={di} style={{
                          aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, borderRadius: 4, cursor: 'default',
                          color: isTodayDay ? '#fff' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                          background: isTodayDay ? 'var(--accent)' : 'transparent',
                          fontWeight: isTodayDay ? 700 : 500,
                          position: 'relative',
                        }}>
                          {format(day, 'd')}
                          {hasTasks && !isTodayDay && <div style={{ position: 'absolute', bottom: 2, width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)' }} />}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── CALENDAR VIEW (full screen, grande) ── */}
      {viewMode === 'calendar' && (
        <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
          <div className="bento-card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="btn-ghost" style={{ padding: 4, borderRadius: 6, cursor: 'pointer', display: 'flex' }}>
                  <ChevronLeft size={18} />
                </button>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{format(calendarDate, 'MMMM yyyy', { locale: es as any }).charAt(0).toUpperCase() + format(calendarDate, 'MMMM yyyy', { locale: es as any }).slice(1)}</span>
                <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="btn-ghost" style={{ padding: 4, borderRadius: 6, cursor: 'pointer', display: 'flex' }}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setCalendarDate(new Date())} className="btn-secondary" style={{ fontSize: 10, fontWeight: 600, padding: '4px 12px', cursor: 'pointer', borderRadius: 6 }}>Hoy</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
              {dayHeaders.map(d => (
                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 2 }}>
              {weekRows.map((week, wi) => (
                <div key={wi} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {week.map((day, di) => {
                      const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                      const isSel = isSameDay(day, calendarSelectedDay);
                      const isTodayDay = isToday(day);
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      return (
                        <div key={di} onClick={() => setCalendarSelectedDay(day)} style={{
                          padding: '6px 8px', minHeight: 100,
                          borderRight: di < 6 ? '1px solid var(--border-subtle)' : 'none',
                          background: isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                          cursor: 'pointer', transition: 'all 200ms', position: 'relative',
                          opacity: isCurrentMonth ? 1 : 0.3,
                        }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isTodayDay ? 700 : 500, marginBottom: 4, color: isTodayDay ? '#fff' : 'var(--text-primary)', background: isTodayDay ? 'var(--accent)' : isSel ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent' }}>
                            {format(day, 'd')}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayTasks.slice(0, 3).map(t => (
                              <div key={t.id} onClick={(e) => { e.stopPropagation(); handleCalendarTaskDrop(t.id, day); }} style={{ fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: `${t.courseColor}18`, color: t.courseColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab', lineHeight: 1.4 }}>
                                {t.title}
                              </div>
                            ))}
                            {dayTasks.length > 3 && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', paddingLeft: 4, fontWeight: 500 }}>+{dayTasks.length - 3} más</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NEW TASK MODAL ── */}
      {showNewModal && (
        <div role="dialog" aria-modal="true" aria-label="Nueva tarea" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowNewModal(false)}>
          <div className="bento-card" style={{ width: 420, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} className="text-accent" /> Nueva Tarea
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input id="new-task-title" type="text" placeholder="Título de la tarea" className="input-base" autoFocus style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8 }} />
              <select id="new-task-course" className="input-base" style={{ cursor: 'pointer', fontSize: 11, padding: '8px 12px', borderRadius: 8 }}>
                {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                <option value="General">General</option>
              </select>

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    <CalendarDays size={10} style={{ marginRight: 3, display: 'inline' }} /> Fecha
                  </div>
                  <input id="new-task-duedate" type="date" className="input-base" style={{ fontSize: 10, padding: '6px 8px', borderRadius: 6, colorScheme: 'dark', cursor: 'pointer' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    <Timer size={10} style={{ marginRight: 3, display: 'inline' }} /> Tiempo
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input id="new-task-estimated" type="number" min="1" placeholder="60" className="input-base" style={{ fontSize: 10, padding: '6px 8px', borderRadius: 6, width: '60%' }} />
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>min</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowNewModal(false)} className="btn-secondary" style={{ fontSize: 11, padding: '6px 16px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCreateTask} className="btn-primary" style={{ fontSize: 11, padding: '6px 18px', cursor: 'pointer' }}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TASK DETAIL PANEL ── */}
      {selectedTaskId && selectedTask && (
        <div role="dialog" aria-modal="true" aria-label="Detalle de tarea" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => { setSelectedTaskId(null); setShowAddMaterial(false); setPdfPreviewUrl(null); }}>
          <div style={{ width: 520, height: '100%', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', borderLeft: '1px solid rgba(255,255,255,0.04)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} className="slide-in-right">
            <header style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setSelectedTaskId(null)} className="btn-ghost" style={{ padding: 4, borderRadius: 6, cursor: 'pointer', display: 'flex' }}>
                  <ChevronRight size={16} />
                </button>
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle</span>
              </div>
              <button onClick={() => { deleteTask(selectedTask.id); setSelectedTaskId(null); }} className="btn-ghost" style={{ color: 'var(--error)', cursor: 'pointer', padding: 4, borderRadius: 5, opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                <Trash2 size={14} />
              </button>
            </header>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
              {/* Title + Status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
                <div onClick={() => toggleTaskStatus(selectedTask.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexShrink: 0, cursor: 'pointer', padding: '3px 8px 3px 6px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: 2, height: 6, width: 60, borderRadius: 3, overflow: 'hidden', background: 'var(--border-subtle)' }}>
                    {[
                      { color: 'var(--accent)', active: true },
                      { color: '#F59E0B', active: selectedTask.status === 'progreso' || selectedTask.status === 'completado' },
                      { color: '#10B981', active: selectedTask.status === 'completado' },
                    ].map((seg, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: 2, background: seg.active ? seg.color : 'transparent', transition: 'background 300ms' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: statusConfig[selectedTask.status].color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {statusConfig[selectedTask.status].label}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <input type="text" value={selectedTask.title} onChange={e => updateTask(selectedTask.id, { title: e.target.value })} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid transparent', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', padding: '2px 0' }} onFocus={e => e.currentTarget.style.borderBottomColor = 'var(--border-subtle)'} onBlur={e => e.currentTarget.style.borderBottomColor = 'transparent'} />
                </div>
              </div>

              {/* Metadata */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 500 }}>Curso</span>
                  <select value={selectedTask.course} onChange={e => { const course = courses.find(c => c.name === e.target.value); updateTask(selectedTask.id, { course: e.target.value, courseColor: course?.color || '#E11D48' }); }} className="input-base" style={{ fontSize: 9, padding: '1px 4px', height: 20, width: 100, cursor: 'pointer', border: 'none', background: 'transparent', color: selectedTask.courseColor }}>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <CalendarDays size={10} style={{ color: 'var(--text-tertiary)' }} />
                  <input type="date" value={selectedTask.dueDate ? selectedTask.dueDate.split('T')[0] : ''} onChange={e => updateTask(selectedTask.id, { dueDate: e.target.value || undefined })} className="input-base" style={{ fontSize: 9, padding: '1px 4px', height: 20, width: 110, cursor: 'pointer', border: 'none', background: 'transparent', colorScheme: 'dark' }} />
                </div>
                {selectedTask.estimatedMinutes && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <Timer size={10} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)' }}>{selectedTask.estimatedMinutes} min</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <Clock size={10} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)' }}>{(selectedTask.studyTime / 60).toFixed(1)}h</span>
                </div>
              </div>

              {/* Subtasks */}
              <div className="bento-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <ClipboardList size={11} className="text-accent" />
                  <span style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtareas</span>
                  {selectedTask.subtasks.length > 0 && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ height: 2, width: 30, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${(selectedTask.subtasks.filter(s => s.done).length / selectedTask.subtasks.length) * 100}%`, transition: 'width 300ms' }} />
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTask.subtasks.filter(s => s.done).length}/{selectedTask.subtasks.length}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                  {selectedTask.subtasks.map(st => (
                    <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 5, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                      <div onClick={() => toggleSubTask(selectedTask.id, st.id)} style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `2px solid ${st.done ? 'var(--success)' : 'var(--border-default)'}`, background: st.done ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 200ms' }}>
                        {st.done && <Check size={8} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ flex: 1, fontSize: 10, color: st.done ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: st.done ? 'line-through' : 'none' }}>{st.title}</span>
                      <button onClick={() => deleteSubTask(selectedTask.id, st.id)} className="btn-ghost" style={{ color: 'var(--text-muted)', opacity: 0.2, cursor: 'pointer', padding: 1 }} onMouseEnter={e => e.currentTarget.style.opacity = '0.6'} onMouseLeave={e => e.currentTarget.style.opacity = '0.2'}>
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Agregar subtarea..." className="input-base" style={{ flex: 1, fontSize: 9, padding: '5px 8px', height: 26, borderRadius: 5 }} onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }} />
                  <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} style={{ height: 26, width: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 5, cursor: newSubtaskTitle.trim() ? 'pointer' : 'not-allowed', background: newSubtaskTitle.trim() ? 'var(--accent)' : 'var(--border-subtle)', color: '#fff' }}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Materials */}
              <div className="bento-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Paperclip size={11} className="text-accent" />
                  <span style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Materiales</span>
                  {selectedTask.files.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTask.files.length}</span>}
                </div>
                {selectedTask.files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                    {selectedTask.files.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 5, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${f.type === 'pdf' ? '#EF4444' : f.type === 'video' ? '#8B5CF6' : f.type === 'link' ? '#10B981' : '#3B82F6'}14` }}>
                          {getFileIcon(f.type, 10)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{f.type.toUpperCase()}{f.size ? ` · ${(f.size / 1024).toFixed(0)}KB` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {f.type === 'pdf' && <button onClick={() => setPdfPreviewUrl(f.path)} className="btn-ghost" style={{ padding: 3, opacity: 0.3, cursor: 'pointer', borderRadius: 3 }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '0.3'}><Eye size={10} /></button>}
                          {f.type === 'video' && f.path.startsWith('http') && <a href={f.path} target="_blank" rel="noopener noreferrer" style={{ padding: 3, opacity: 0.3, color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '0.3'}><ExternalLink size={10} /></a>}
                          <button onClick={() => removeTaskFile(selectedTask.id, f.id)} className="btn-ghost" style={{ padding: 3, opacity: 0.1, cursor: 'pointer', borderRadius: 3, color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.4'} onMouseLeave={e => e.currentTarget.style.opacity = '0.1'}><X size={9} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showAddMaterial ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px', background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {(['pdf', 'video', 'link', 'other'] as const).map(type => (
                        <button key={type} onClick={() => setNewMaterialType(type)} style={{ fontSize: 7, fontWeight: 600, padding: '3px 6px', borderRadius: 4, cursor: 'pointer', flex: 1, textTransform: 'uppercase', letterSpacing: '0.03em', border: newMaterialType === type ? 'none' : '1px solid var(--border-subtle)', background: newMaterialType === type ? 'var(--accent)' : 'var(--bg-surface)', color: newMaterialType === type ? '#fff' : 'var(--text-tertiary)' }}>
                          {type === 'pdf' ? 'PDF' : type === 'video' ? 'Video' : type === 'link' ? 'Link' : 'Archivo'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="text" value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Nombre" className="input-base" style={{ flex: 1, fontSize: 9, padding: '5px 8px', height: 26, borderRadius: 5 }} />
                      {newMaterialType !== 'link' && <button onClick={() => fileInputRef.current?.click()} style={{ height: 26, padding: '0 10px', fontSize: 8, fontWeight: 600, borderRadius: 5, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}><Upload size={9} /> Subir</button>}
                    </div>
                    {(newMaterialType === 'pdf' || newMaterialType === 'video' || newMaterialType === 'other') && <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} accept={newMaterialType === 'pdf' ? '.pdf' : newMaterialType === 'video' ? '.mp4,.webm' : undefined} />}
                    {(newMaterialType === 'video' || newMaterialType === 'link') && <input type="text" value={newMaterialPath} onChange={e => setNewMaterialPath(e.target.value)} placeholder={newMaterialType === 'video' ? 'URL de YouTube...' : 'URL...'} className="input-base" style={{ fontSize: 9, padding: '5px 8px', height: 26, borderRadius: 5 }} />}
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowAddMaterial(false); setNewMaterialName(''); setNewMaterialPath(''); setNewMaterialFile(null); }} style={{ fontSize: 9, fontWeight: 500, cursor: 'pointer', padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)' }}>Cancelar</button>
                      <button onClick={handleAddMaterial} disabled={!newMaterialName.trim()} style={{ fontSize: 9, fontWeight: 600, padding: '4px 12px', borderRadius: 5, cursor: newMaterialName.trim() ? 'pointer' : 'not-allowed', border: 'none', background: newMaterialName.trim() ? 'var(--accent)' : 'var(--border-subtle)', color: newMaterialName.trim() ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Plus size={9} /> Añadir
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddMaterial(true)} style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 500, cursor: 'pointer', padding: '6px 10px', borderRadius: 5, border: '1px dashed var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                    <Plus size={10} /> Añadir material
                  </button>
                )}
              </div>

              {/* Notes */}
              <div className="bento-card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <StickyNote size={11} className="text-accent" />
                  <span style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas</span>
                </div>
                <textarea value={selectedTask.notes} onChange={e => updateTask(selectedTask.id, { notes: e.target.value })} placeholder="Notas o detalles..." style={{ width: '100%', minHeight: 90, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview */}
      {pdfPreviewUrl && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }} onClick={() => setPdfPreviewUrl(null)}>
          <div style={{ width: '80vw', height: '85vh', background: 'var(--bg-surface)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-strong)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)' }}>Vista previa</span>
              <button onClick={() => setPdfPreviewUrl(null)} className="btn-ghost" style={{ cursor: 'pointer', padding: 2 }}><X size={14} /></button>
            </div>
            <div style={{ flex: 1, background: '#525659' }}>
              {pdfPreviewUrl.startsWith('http') ? (
                <iframe src={pdfPreviewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', gap: 6 }}>
                  <Eye size={24} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: 10, opacity: 0.6 }}>Vista previa local no disponible</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
