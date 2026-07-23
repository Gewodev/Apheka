import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, Clock, Plus, Trash2, Repeat, Check, FileText, Link as LinkIcon, ExternalLink, Music, Video, Image, FileSpreadsheet, File, Globe } from 'lucide-react';
import { format } from 'date-fns';

function getEventFileIcon(type: string, size = 14) {
  switch (type) {
    case 'pdf': return <FileText size={size} style={{ color: '#ef4444' }} />;
    case 'video': return <Video size={size} style={{ color: '#8b5cf6' }} />;
    case 'image': return <Image size={size} style={{ color: '#3b82f6' }} />;
    case 'audio': return <Music size={size} style={{ color: '#10b981' }} />;
    case 'link': return <LinkIcon size={size} style={{ color: '#3b82f6' }} />;
    case 'drive': return <ExternalLink size={size} style={{ color: '#f59e0b' }} />;
    case 'doc':
    case 'xls':
    case 'ppt': return <FileText size={size} style={{ color: '#6366f1' }} />;
    default: return <File size={size} style={{ color: 'var(--text-muted)' }} />;
  }
}

function detectEventFileType(fileName: string, path: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
    mp4: 'video', webm: 'video', mov: 'video', avi: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
    doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt',
  };
  if (typeMap[ext]) return typeMap[ext];
  if (path.includes('youtube.com') || path.includes('youtu.be')) return 'video';
  if (path.includes('drive.google.com')) return 'drive';
  return 'other';
}

async function fetchEventPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch { return null; }
}

export interface PlanEvent {
  id: string;
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  courseId?: string;
  color: string;
  description?: string;
  taskId?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'custom_days';
  repeatDays?: number[]; // 0=Mon..6=Sun if custom_days
  repeatUntil?: string; // Limit for repetition
  attachments?: { type: 'link' | 'file'; name: string; url: string; size?: string }[];
}

interface EventModalProps {
  event: PlanEvent | null;
  defaults: Partial<PlanEvent>;
  courses: { id: string; name: string; color: string }[];
  tasks: { id: string; title: string; courseColor: string; dueDate?: string }[];
  onClose: () => void;
  onSave: (ev: PlanEvent) => void;
  onDelete: (id: string) => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function EventModal({
  event,
  defaults,
  courses,
  tasks,
  onClose,
  onSave,
  onDelete,
  addNotification
}: EventModalProps) {
  const th = document.documentElement.getAttribute('data-theme');
  const isDarkSelect = !th || th === 'oscuro' || th === 'vibrante';
  const selectBorder = isDarkSelect ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)';
  const [title, setTitle] = useState(event?.title || defaults.title || '');
  const [allDay, setAllDay] = useState(event?.allDay ?? defaults.allDay ?? false);
  const [date, setDate] = useState(event?.date || defaults.date || format(new Date(), 'yyyy-MM-dd'));
  const [start, setStart] = useState(event?.startTime || defaults.startTime || '09:00');
  const [end, setEnd] = useState(event?.endTime || defaults.endTime || '10:00');
  const [courseId, setCourseId] = useState(event?.courseId || defaults.courseId || '');
  const [color, setColor] = useState(event?.color || (defaults.courseId ? courses.find(c => c.id === defaults.courseId)?.color || '#E11D48' : '#E11D48'));
  const [desc, setDesc] = useState(event?.description || '');
  const [repeat, setRepeat] = useState<PlanEvent['repeat']>(event?.repeat || 'none');
  const [repeatDays, setRepeatDays] = useState<number[]>(event?.repeatDays || []);
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil || '');
  const [taskId, setTaskId] = useState(event?.taskId || '');
  const [attachments, setAttachments] = useState<{ type: 'link' | 'file'; name: string; url: string; size?: string }[]>(event?.attachments || []);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (courseId) {
      const c = courses.find(x => x.id === courseId);
      if (c) setColor(c.color);
    }
  }, [courseId, courses]);

  const taskMismatch = useMemo(() => {
    if (!taskId) return null;
    const t = tasks.find(x => x.id === taskId);
    if (!t || !t.dueDate) return null;
    const td = t.dueDate.slice(0, 10);
    const hasTime = t.dueDate.includes('T');
    const tt = hasTime ? t.dueDate.slice(11, 16) : null;
    if (td === date && (!hasTime || allDay || tt === start)) return null;
    return { taskDate: td, taskTime: tt, hasTime };
  }, [taskId, tasks, date, start, allDay]);

  const syncTaskToEvent = () => {
    if (!taskMismatch) return;
    setDate(taskMismatch.taskDate);
    if (taskMismatch.hasTime && taskMismatch.taskTime) {
      if (allDay) setAllDay(false);
      setStart(taskMismatch.taskTime);
      const [h, m] = taskMismatch.taskTime.split(':').map(Number);
      setEnd(`${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  };

  // Generate 15-min intervals
  const timeOptions: string[] = [];
  for (let h = 0; h <= 23; h++) {
    ['00', '15', '30', '45'].forEach(m => timeOptions.push(`${String(h).padStart(2, '0')}:${m}`));
  }

  function handleSave() {
    if (!title.trim()) {
      addNotification('El título es obligatorio', 'error');
      return;
    }
    if (!allDay && start >= end) {
      addNotification('La hora de inicio no puede ser posterior o igual a la de fin', 'error');
      return;
    }
    if (repeat === 'custom_days' && repeatDays.length === 0) {
      addNotification('Selecciona al menos un día de repetición', 'error');
      return;
    }
    if (repeat !== 'none' && repeatUntil && repeatUntil < date) {
      addNotification('La fecha de fin de repetición no puede ser anterior a la fecha del evento', 'error');
      return;
    }

    const ev: PlanEvent = {
      id: event?.id || crypto.randomUUID(),
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? '00:00' : start,
      endTime: allDay ? '23:59' : end,
      courseId: courseId || undefined,
      color,
      description: desc || undefined,
      repeat,
      repeatDays: repeat === 'custom_days' ? repeatDays : undefined,
      repeatUntil: repeat !== 'none' && repeatUntil ? repeatUntil : undefined,
      taskId: taskId || undefined,
      attachments
    };
    onSave(ev);
  }

  const DAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const toggleRepeatDay = (idx: number) => {
    setRepeatDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) {
      addNotification('Ingresa una URL válida', 'error');
      return;
    }
    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    let name = linkName.trim();
    if (!name) {
      try {
        const fetched = await fetchEventPageTitle(url);
        if (fetched) name = fetched;
        else name = url.replace(/^https?:\/\//, '').slice(0, 40);
      } catch { name = url.replace(/^https?:\/\//, '').slice(0, 40); }
    }
    const detectedType = url.includes('youtube.com') || url.includes('youtu.be') ? 'video' : url.includes('drive.google.com') ? 'drive' : 'link';
    setAttachments([...attachments, { type: detectedType as any, name, url }]);
    setLinkUrl('');
    setLinkName('');
    setShowLinkForm(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const detectedType = detectEventFileType(file.name, url);
      setAttachments([...attachments, { type: detectedType as any, name: file.name, url, size: `${sizeMb} MB` }]);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div 
        style={{ 
          width: 580, 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          background: 'var(--surface)', 
          border: '1px solid var(--border-soft)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 4, height: 20, borderRadius: 4, background: color, boxShadow: `0 0 12px ${color}60` }} />
            <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight',sans-serif", letterSpacing: '-0.02em' }}>
              {event ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {event && (
              <button onClick={() => onDelete(event.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(225,29,72,0.2)', background: 'rgba(225,29,72,0.05)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 200ms' }}>
                <Trash2 size={13} /> Eliminar
              </button>
            )}
            <button onClick={onClose} style={{ padding: 8, borderRadius: 8, background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Título</label>
            <input 
              autoFocus 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSave()} 
              placeholder="Ej: Reunión de proyecto, Examen final..." 
              style={{ width: '100%', fontSize: 16, height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 200ms' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--text-secondary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-soft)'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Date & All Day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Fecha</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10 }}>
                <button 
                  onClick={() => setAllDay(p => !p)} 
                  style={{ width: 40, height: 22, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms', background: allDay ? 'var(--accent)' : 'var(--bg-secondary)', flexShrink: 0 }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 200ms', left: allDay ? 21 : 3, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
                </button>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Todo el día</span>
              </div>
            </div>

            {/* Time */}
            {!allDay && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Inicio</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <select value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Fin</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <select value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Repeat */}
          <div style={{ padding: '16px', background: 'var(--surface-elevated)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: repeat === 'custom_days' || repeat !== 'none' ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Repeat size={15} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Repetición</span>
              </div>
              <select value={repeat} onChange={e => setRepeat(e.target.value as any)} style={{ fontSize: 13, height: 32, background: 'var(--bg-secondary)', border: selectBorder, borderRadius: 6, padding: '0 12px', color: 'var(--text-secondary)', outline: 'none' }}>
                <option value="none">Ninguna</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
                <option value="custom_days">Días específicos</option>
              </select>
            </div>
            
            {repeat === 'custom_days' && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
                {DAY_INITIALS.map((d, i) => {
                  const isActive = repeatDays.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleRepeatDay(i)}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isActive ? 'var(--accent)' : 'var(--bg-primary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-soft)'}`,
                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        transition: 'all 200ms',
                        boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none'
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}

            {repeat !== 'none' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Termina el:</span>
                <input type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} style={{ flex: 1, fontSize: 13, height: 32, background: 'var(--bg-secondary)', border: selectBorder, borderRadius: 6, padding: '0 12px', color: 'var(--text-primary)', outline: 'none' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Linking */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Materia</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none' }}>
                  <option value="">Ninguna</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {tasks.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Tarea vinculada</label>
                  <select value={taskId} onChange={e => setTaskId(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="">Ninguna</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  {taskMismatch && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginBottom: 2 }}>Fecha desincronizada</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Tarea: {taskMismatch.taskDate}{taskMismatch.taskTime ? ` ${taskMismatch.taskTime}` : ''}  ·  Evento: {date}{!allDay ? ` ${start}` : ''}
                        </div>
                      </div>
                      <button onClick={syncTaskToEvent}
                        style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#F59E0B', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        Sincronizar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Appearance */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Color</label>
              <div style={{ position: 'relative', height: 44 }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                <div style={{ width: '100%', height: '100%', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, pointerEvents: 'none' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: color, boxShadow: `0 0 10px ${color}50` }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{color.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Attachments */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Detalles & Materiales</label>
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, overflow: 'visible' }}>
              <textarea 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Agrega notas, enlaces, o detalles importantes..." 
                style={{ width: '100%', fontSize: 14, minHeight: 80, background: 'transparent', border: 'none', padding: '16px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
              />
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: 10, borderRadius: '0 0 12px 12px' }}>
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {attachments.map((item, i) => {
                      const fileType = detectEventFileType(item.name, item.url);
                      const isVideo = fileType === 'video' && (item.url.includes('youtube.com') || item.url.includes('youtu.be'));
                      const isImage = fileType === 'image';
                      const isAudio = fileType === 'audio';
                      const isDrive = fileType === 'drive';
                      return (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                          {getEventFileIcon(fileType, 14)}
                          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none', fontWeight: 500 }}>
                            {item.name}
                          </a>
                          {item.size && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{item.size}</span>}
                          <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}><X size={10} /></button>
                        </div>
                        {isImage && (
                          <div style={{ padding: '0 12px 8px' }}>
                            <img src={item.url} alt={item.name} style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 6, objectFit: 'contain', background: 'var(--bg-primary)' }} />
                          </div>
                        )}
                        {isVideo && (
                          <div style={{ padding: '0 12px 8px' }}>
                            <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg-primary)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Video size={12} /> YouTube · {item.name}
                            </div>
                          </div>
                        )}
                        {isAudio && (
                          <div style={{ padding: '0 12px 8px' }}>
                            <audio controls src={item.url} style={{ width: '100%', height: 32 }} />
                          </div>
                        )}
                        {isDrive && (
                          <div style={{ padding: '0 12px 8px' }}>
                            <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg-primary)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ExternalLink size={12} /> Google Drive
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {showLinkForm && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Globe size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input
                          autoFocus
                          type="url"
                          value={linkUrl}
                          onChange={e => setLinkUrl(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); } }}
                          placeholder="https://..."
                          style={{ flex: 1, fontSize: 13, height: 32, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '0 10px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                      <input
                        type="text"
                        value={linkName}
                        onChange={e => setLinkName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); } }}
                        placeholder="Nombre (opcional)"
                        style={{ fontSize: 12, height: 28, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '0 10px', color: 'var(--text-primary)', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={handleAddLink} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!showLinkForm && (
                      <button onClick={() => setShowLinkForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                        <LinkIcon size={14} /> Enlace
                      </button>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                      <FileText size={14} /> Archivo local
                    </button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 12, background: 'var(--bg-primary)', borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 200ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ flex: 2, height: 48, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px var(--accent-glow)', transition: 'transform 200ms, box-shadow 200ms' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px var(--accent-glow)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-glow)' }}>
            <Check size={16} />
            {event ? 'Guardar Cambios' : 'Crear Evento'}
          </button>
        </div>
      </div>
    </div>
  );
}
