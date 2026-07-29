import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, Clock, Plus, Trash2, Repeat, Check, FileText, Link as LinkIcon, ExternalLink, Music, Video, Image, FileSpreadsheet, File, Globe } from 'lucide-react';
import { format } from 'date-fns';

import { GoogleClassroomIcon, GoogleDriveIcon, GoogleDocsIcon, GoogleSheetsIcon, GoogleSlidesIcon, GoogleFormsIcon } from '../../ui/GoogleIcons';

const s = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;

function getEventFileIcon(type: string, size = 14) {
  const iconProps = { size } as any;
  switch (type) {
    case 'pdf': return s('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704zm-1.42 1.03c-.107.532-.64.887-1.384.887-.213 0-.39-.036-.604-.071-1.348-.32-2.626-.994-3.903-2.059a17.717 17.717 0 0 1 2.98-.248c.746 0 1.385.035 1.81.142.497.106 1.278.426 1.1 1.348zm-7.524-1.668a38.01 38.01 0 0 0-2.945.674 39.68 39.68 0 0 0-2.52.745 40.05 40.05 0 0 0 1.207-2.555c.426-.994.78-2.023 1.136-2.981.354.603.745 1.207 1.135 1.739a50.127 50.127 0 0 0 1.987 2.378zM10.038 1.46a.768.768 0 0 1 .674-.425c.745 0 .887.851.887 1.526 0 1.135-.355 2.874-.958 4.861-1.03-2.768-1.1-5.074-.603-5.962zM6.134 17.997c-1.81 2.981-3.549 4.826-4.613 4.826a.872.872 0 0 1-.532-.177c-.213-.213-.32-.461-.249-.745.213-1.065 2.271-2.555 5.394-3.904Z', '#EF4444');
    case 'video': return s('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#8B5CF6');
    case 'image': return <Image size={size} style={{ color: '#F59E0B' }} />;
    case 'audio': return <Music size={size} style={{ color: '#8B5CF6' }} />;
    case 'link': return <Globe size={size} style={{ color: '#10B981' }} />;
    case 'classroom': return <GoogleClassroomIcon size={size} />;
    case 'drive': return <GoogleDriveIcon size={size} />;
    case 'doc': return <GoogleDocsIcon size={size} />;
    case 'xls': return <GoogleSheetsIcon size={size} />;
    case 'ppt': return <GoogleSlidesIcon size={size} />;
    case 'forms': return <GoogleFormsIcon size={size} />;
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
  if (path.includes('classroom.google.com')) return 'classroom';
  if (path.includes('drive.google.com')) return 'drive';
  if (path.includes('docs.google.com')) return 'doc';
  if (path.includes('sheets.google.com')) return 'xls';
  if (path.includes('slides.google.com')) return 'ppt';
  if (path.includes('forms.google.com')) return 'forms';
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
    const detectedType = url.includes('youtube.com') || url.includes('youtu.be') ? 'video' : url.includes('classroom.google.com') ? 'classroom' : url.includes('drive.google.com') ? 'drive' : 'link';
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
                      const isYouTube = fileType === 'video' && (item.url.includes('youtube.com') || item.url.includes('youtu.be'));
                      const isImage = fileType === 'image';
                      const isAudio = fileType === 'audio';
                      const isDrive = fileType === 'drive';
                      const isClassroom = fileType === 'classroom';
                      const isWeb = fileType === 'link' && !isYouTube && !isDrive && !isClassroom;
                      const isPdf = fileType === 'pdf';
                      const isDoc = fileType === 'doc';
                      const isXls = fileType === 'xls';
                      const isPpt = fileType === 'ppt';
                      const isForms = fileType === 'forms';
                      const isVideoFile = fileType === 'video' && !isYouTube;
                      let domain = '';
                      if (isWeb) { try { domain = new URL(item.url).hostname.replace('www.', ''); } catch {} }
                      const subtitleText = isYouTube ? 'YouTube' : isClassroom ? 'Classroom' : isDrive ? 'Google Drive' : isWeb ? domain : isPdf ? 'PDF' : isDoc ? 'Google Docs' : isXls ? 'Google Sheets' : isPpt ? 'Google Slides' : isForms ? 'Google Forms' : isAudio ? 'Audio' : isImage ? 'Imagen' : isVideoFile ? 'Video' : item.size || 'Archivo';
                      return (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                          {isWeb ? (
                            <span style={{ position: 'relative', width: 15, height: 15, display: 'inline-flex', flexShrink: 0 }}>
                              <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" style={{ width: 15, height: 15, borderRadius: 2, position: 'absolute', inset: 0 }}
                                onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.link-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                              <span className="link-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><LinkIcon size={10} /></span>
                            </span>
                          ) : getEventFileIcon(fileType, 14)}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                            <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginTop: 1 }}>{subtitleText}</span>
                          </div>
                          {item.size && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{item.size}</span>}
                          <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}><X size={10} /></button>
                        </div>
                        {isImage && (
                          <div style={{ padding: '0 12px 8px' }}>
                            <img src={item.url} alt={item.name} style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 6, objectFit: 'contain', background: 'var(--bg-primary)' }} />
                          </div>
                        )}
                        {isYouTube && (
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
