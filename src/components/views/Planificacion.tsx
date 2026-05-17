import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, 
  Sparkles, Calendar, ListTodo, Upload, X, 
  Clock, BookOpen, GraduationCap, Bot,
  Layers, Check,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, isToday, addDays, subDays, addWeeks, subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

type ViewMode = 'month' | 'week' | 'day';
const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface ScheduleBlock {
  name: string;
  time: string;
  color: string;
  day: string;
}

export default function Planificacion() {
  const { tasks, events, addEvent } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [scheduleImage, setScheduleImage] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');

  // Student schedule blocks
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([
    { name: 'Matemáticas', time: '08:00–09:30', color: '#E11D48', day: 'Lun' },
    { name: 'Física', time: '09:45–11:15', color: '#3B82F6', day: 'Lun' },
    { name: 'Programación', time: '11:30–13:00', color: '#22C55E', day: 'Lun' },
    { name: 'Matemáticas', time: '08:00–09:30', color: '#E11D48', day: 'Mar' },
    { name: 'Química', time: '09:45–11:15', color: '#A855F7', day: 'Mar' },
    { name: 'Inglés', time: '11:30–13:00', color: '#F59E0B', day: 'Mar' },
    { name: 'Física', time: '08:00–09:30', color: '#3B82F6', day: 'Mié' },
    { name: 'Historia', time: '09:45–11:15', color: '#EC4899', day: 'Mié' },
    { name: 'Programación', time: '11:30–13:00', color: '#22C55E', day: 'Mié' },
    { name: 'Química', time: '08:00–09:30', color: '#A855F7', day: 'Jue' },
    { name: 'Inglés', time: '09:45–11:15', color: '#F59E0B', day: 'Jue' },
    { name: 'Historia', time: '08:00–09:30', color: '#EC4899', day: 'Vie' },
  ]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekRows: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) weekRows.push(calendarDays.slice(i, i + 7));

  // Week days for week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  // Day view hours
  const hours = Array.from({ length: 12 }, (_, i) => `${i + 7}:00`);

  const selectedDayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), selectedDay));
  const selectedDayEvents = events.filter(e => isSameDay(new Date(e.date), selectedDay));

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScheduleImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAIGenerate = () => {
    if (!aiPrompt.trim()) return toast.error('Describe tu horario');
    toast.success('Horario generado (simulado)');
    setShowAIModal(false);
    setAiPrompt('');
    setScheduleImage(null);
  };

  // Questionnaire answers
  const [qa, setQa] = useState<Record<string, string>>({});
  const questions = [
    { key: 'subjects', label: '¿Qué materias cursas?' },
    { key: 'days', label: '¿Qué días tienes clase?' },
    { key: 'times', label: '¿En qué horarios?' },
    { key: 'teachers', label: '¿Nombres de profesores?' },
  ];

  return (
    <div className="page-container" style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: 24 }}>
      
      {/* ── Left: Calendar ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0, paddingLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handlePrev} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.03)' }}><ChevronLeft size={16} /></button>
            <h2 style={{ fontSize: 22, fontWeight: 600, minWidth: 200, textAlign: 'center', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {viewMode === 'month' && format(currentDate, 'MMMM yyyy', { locale: es as any }).charAt(0).toUpperCase() + format(currentDate, 'MMMM yyyy', { locale: es as any }).slice(1)}
              {viewMode === 'week' && `Semana del ${format(weekStart, "d MMM", { locale: es as any })}`}
              {viewMode === 'day' && format(currentDate, "d 'de' MMMM", { locale: es as any })}
            </h2>
            <button onClick={handleNext} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.03)' }}><ChevronRight size={16} /></button>
            <button onClick={goToday} className="btn-secondary hover-lift" style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', cursor: 'pointer', marginLeft: 12, height: 'auto' }}>Hoy</button>
          </div>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-deep)', padding: 6, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
            {(['month', 'week', 'day'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: 'none', background: viewMode === m ? 'var(--accent)' : 'transparent',
                color: viewMode === m ? '#fff' : 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 200ms',
                boxShadow: viewMode === m ? '0 2px 8px rgba(225,29,72,0.3)' : 'none'
              }}>
                {m === 'month' ? <Calendar size={14} /> : m === 'week' ? <Layers size={14} /> : <ListTodo size={14} />}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {/* Calendar content */}
        <div className="bento-card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>

          {viewMode === 'month' && (
            <>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {DAY_HEADERS.map(d => (
                  <div key={d} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {weekRows.map((week, wi) => (
                  <div key={wi} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {week.map((day, di) => {
                        const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                        const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
                        const isSel = isSameDay(day, selectedDay);
                        const isTodayDay = isToday(day);
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const allItems = [...dayTasks.map(t => ({ type: 'task' as const, title: t.title, color: t.courseColor })), ...dayEvents.map(e => ({ type: 'event' as const, title: e.title, color: e.color }))].slice(0, 3);
                        return (
                          <div key={di} onClick={() => { setSelectedDay(day); setCurrentDate(day); }} style={{
                            padding: '4px 6px', minHeight: 80,
                            borderRight: di < 6 ? '1px solid var(--border-subtle)' : 'none',
                            background: isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                            cursor: 'pointer', transition: 'all 200ms',
                            opacity: isCurrentMonth ? 1 : 0.2,
                            position: 'relative',
                          }}>
                            <div style={{ width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: isTodayDay ? 600 : 500, marginBottom: 2, color: isTodayDay ? '#fff' : 'var(--text-primary)', background: isTodayDay ? 'var(--accent)' : isSel ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent' }}>
                              {format(day, 'd')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {allItems.map((item, ii) => (
                                <div key={ii} style={{ fontSize: 8, fontWeight: 500, padding: '1px 4px', borderRadius: 2, background: `${item.color}18`, borderLeft: `1.5px solid ${item.color}`, color: item.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                                  {item.title}
                                </div>
                              ))}
                              {dayTasks.length + dayEvents.length > 3 && (
                                <div style={{ fontSize: 7, color: 'var(--text-tertiary)', paddingLeft: 3, fontWeight: 500 }}>
                                  +{dayTasks.length + dayEvents.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {viewMode === 'week' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, background: '#0d0d12', zIndex: 2 }}>
                <div style={{ padding: 6 }} />
                {weekDays.map((d, i) => (
                  <div key={i} onClick={() => { setSelectedDay(d); setCurrentDate(d); }} style={{
                    padding: '6px 8px', textAlign: 'center', cursor: 'pointer',
                    background: isSameDay(d, selectedDay) ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    borderRadius: 0, borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)' }}>{format(d, 'EEEEE', { locale: es as any })}</div>
                    <div style={{ width: 22, height: 22, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: isToday(d) ? 600 : 500, color: isToday(d) ? '#fff' : 'var(--text-primary)', background: isToday(d) ? 'var(--accent)' : 'transparent', marginTop: 1 }}>
                      {format(d, 'd')}
                    </div>
                  </div>
                ))}
              </div>
              {/* Hour rows */}
              <div style={{ flex: 1 }}>
                 {hours.map((h, hi) => {
                    return (
                    <div key={hi} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)', minHeight: 48 }}>
                      <div style={{ padding: '4px 8px', fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'right', borderRight: '1px solid var(--border-subtle)' }}>{h}</div>
                      {weekDays.map((d, di) => {
                        const cellEvents = events.filter(e => isSameDay(new Date(e.date), d) && e.startTime?.startsWith(h.split(':')[0]));
                        return (
                          <div key={di} onClick={() => { setSelectedDay(d); setCurrentDate(d); }} style={{
                            padding: '2px 4px', borderLeft: di > 0 ? '1px solid var(--border-subtle)' : 'none',
                            cursor: 'pointer', background: isSameDay(d, new Date()) && isToday(new Date()) ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : 'transparent',
                          }}>
                            {cellEvents.map((e, ei) => (
                              <div key={ei} style={{ fontSize: 7, padding: '1px 3px', borderRadius: 2, background: `${e.color}20`, color: e.color, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'day' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {hours.map((h, hi) => {
                const dayEvents = events.filter(e => isSameDay(new Date(e.date), selectedDay) && e.startTime?.startsWith(h.split(':')[0]));
                const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), selectedDay));
                return (
                  <div key={hi} style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', minHeight: 56 }}>
                    <div style={{ width: 64, padding: '6px 8px', fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'right', borderRight: '1px solid var(--border-subtle)', flexShrink: 0 }}>{h}</div>
                    <div style={{ flex: 1, padding: '4px 8px' }}>
                      {dayEvents.map((e, ei) => (
                        <div key={ei} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: `${e.color}15`, borderLeft: `2px solid ${e.color}`, color: e.color, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={10} /> <span style={{ fontWeight: 600 }}>{e.title}</span>
                          {e.startTime && <span style={{ fontSize: 8, opacity: 0.6 }}>{e.startTime}–{e.endTime}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Selected day detail */}
        {(selectedDayTasks.length > 0 || selectedDayEvents.length > 0) && (
          <div style={{ flexShrink: 0, padding: '8px 12px', marginTop: 8, background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', gap: 10, overflowX: 'auto', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', paddingTop: 4, flexShrink: 0 }}>
              {format(selectedDay, "d MMM", { locale: es as any })}
            </div>
            {selectedDayTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: `${t.courseColor}10`, border: `1px solid ${t.courseColor}20`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.courseColor }} />
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-primary)' }}>{t.title}</span>
                <button onClick={() => toast.success('Tarea marcada')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}><Check size={10} /></button>
              </div>
            ))}
            {selectedDayEvents.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: `${e.color}10`, border: `1px solid ${e.color}25`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <Sparkles size={9} style={{ color: e.color }} />
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-primary)' }}>{e.title}</span>
                <span style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{e.startTime}–{e.endTime}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Schedule panel ── */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', paddingRight: 4 }}>

        <div className="bento-card" style={{ padding: '20px 24px', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
              <GraduationCap size={16} className="text-accent" /> Horario de Clases
            </h3>
            <button onClick={() => setShowScheduleModal(true)} className="btn-ghost hover-lift" style={{ padding: 6, cursor: 'pointer', display: 'flex', borderRadius: 8, background: 'var(--bg-elevated)' }}><Plus size={14} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(day => {
              const dayBlocks = scheduleBlocks.filter(b => b.day === day);
              if (dayBlocks.length === 0) return null;
              return (
                <div key={day} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 2 }}>{day}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayBlocks.map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: `linear-gradient(90deg, ${b.color}15 0%, transparent 100%)`, border: `1px solid ${b.color}10`, borderLeft: `3px solid ${b.color}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontWeight: 500 }}>{b.time}</div>
                        </div>
                        <BookOpen size={14} style={{ color: b.color, opacity: 0.5, flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Upload card */}
        <div className="bento-card" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, #1a1a2e 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
              <Bot size={16} style={{ color: '#818CF8' }} /> IA Horario
            </h3>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5, fontWeight: 500 }}>
            Sube una foto de tu horario escolar y la IA lo procesará para añadirlo a tu calendario automáticamente.
          </p>
          <button onClick={() => setShowAIModal(true)} className="btn-primary hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, height: 36, padding: '0 16px', width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Upload size={14} /> Subir Horario
          </button>
        </div>

      </div>

      {/* ── AI Modal ── */}
      {showAIModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowAIModal(false)}>
          <div className="bento-card" style={{ width: 440, maxHeight: '80vh', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={18} style={{ color: '#818CF8' }} /> Subir Horario
              </h2>
              <button onClick={() => setShowAIModal(false)} className="btn-ghost" style={{ padding: 3, cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Foto del horario</label>
              {scheduleImage ? (
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <img src={scheduleImage} alt="Horario" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
                  <button onClick={() => setScheduleImage(null)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 4, padding: 2, cursor: 'pointer', display: 'flex' }}><X size={12} /></button>
                </div>
              ) : (
                <label className="btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 8, border: '1px dashed var(--border-subtle)', cursor: 'pointer', fontSize: 10, color: 'var(--text-tertiary)' }}>
                  <Upload size={14} /> Haz clic para seleccionar imagen
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Questionnaire */}
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ListTodo size={12} /> Cuestionario rápido
              </h3>
              {questions.map(q => (
                <div key={q.key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 3, display: 'block' }}>{q.label}</label>
                  <input
                    type="text"
                    placeholder={q.label}
                    value={qa[q.key] || ''}
                    onChange={e => setQa(prev => ({ ...prev, [q.key]: e.target.value }))}
                    className="input-base"
                    style={{ fontSize: 10, height: 28, width: '100%' }}
                  />
                </div>
              ))}
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Indicación adicional</label>
              <textarea
                placeholder="Ej: Mi horario es de lunes a viernes de 8am a 1pm..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="input-base"
                style={{ fontSize: 10, width: '100%', resize: 'vertical', minHeight: 60, padding: 8 }}
              />
            </div>

            <button onClick={handleAIGenerate} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, height: 32, padding: '0 16px', width: '100%', justifyContent: 'center' }}>
              <Bot size={14} /> Generar Horario
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
