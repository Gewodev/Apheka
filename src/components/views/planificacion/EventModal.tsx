import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Plus, Trash2, Repeat, Check, Paperclip, FileText, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

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
  tasks: { id: string; title: string; courseColor: string }[];
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
  const [attachments, setAttachments] = useState<PlanEvent['attachments']>(event?.attachments || []);
  
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (courseId) {
      const c = courses.find(x => x.id === courseId);
      if (c) setColor(c.color);
    }
  }, [courseId, courses]);

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

  const handleAddLink = () => {
    const url = prompt('Ingresa la URL:');
    if (url) {
      const name = prompt('Nombre del enlace:') || url;
      setAttachments([...attachments, { type: 'link', name, url }]);
    }
    setShowAttachMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setAttachments([...attachments, { type: 'file', name: file.name, url, size: `${sizeMb} MB` }]);
    }
    setShowAttachMenu(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 2, 3, 0.85)', backdropFilter: 'blur(16px)' }} onClick={onClose}>
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
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.02em' }}>
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
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} />
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
                    <select value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Fin</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <select value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}>
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
              <select value={repeat} onChange={e => setRepeat(e.target.value as any)} style={{ fontSize: 13, height: 32, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '0 12px', color: 'var(--text-secondary)', outline: 'none' }}>
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
                <input type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} style={{ flex: 1, fontSize: 13, height: 32, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '0 12px', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Linking */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Materia</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none' }}>
                  <option value="">Ninguna</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {tasks.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Tarea vinculada</label>
                  <select value={taskId} onChange={e => setTaskId(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="">Ninguna</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {attachments.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                        {item.type === 'link' ? <LinkIcon size={12} style={{ color: '#3b82f6' }} /> : <FileText size={12} style={{ color: 'var(--accent)' }} />}
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-primary)', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>
                          {item.name}
                        </a>
                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowAttachMenu(!showAttachMenu)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                    <Paperclip size={14} /> Adjuntar
                  </button>
                  
                  {showAttachMenu && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 8, boxShadow: '0 12px 24px rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', flexDirection: 'column', padding: 4, width: 140 }}>
                      <button onClick={handleAddLink} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, textAlign: 'left', cursor: 'pointer', borderRadius: 4 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <LinkIcon size={14} /> Enlace
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, textAlign: 'left', cursor: 'pointer', borderRadius: 4 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <FileText size={14} /> Archivo local
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
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
