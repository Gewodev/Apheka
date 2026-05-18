import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, 
  Sparkles, Calendar, ListTodo, Upload, X, 
  Clock, BookOpen, GraduationCap, Bot,
  Layers, Check, Wifi, Bell,
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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Student schedule blocks matching the screenshot exactly
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
    if (!aiPrompt.trim() && !scheduleImage) return toast.error('Sube una imagen o describe tu horario');
    toast.success('Horario procesado e integrado al calendario exitosamente');
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
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HEADER ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Planificador</h1>
            <Calendar size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Organiza tu tiempo, domina tus metas.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Bell size={16} /></button>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <div className="led-display" style={{ fontSize: 28, fontWeight: 300, lineHeight: 1 }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 14 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA (GRID 1fr 300px) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, flex: 1, alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: CALENDAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-deep)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={handlePrev} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}><ChevronLeft size={16} /></button>
              <h2 style={{ fontSize: 16, fontWeight: 600, minWidth: 160, textAlign: 'center', letterSpacing: '-0.01em', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {viewMode === 'month' && format(currentDate, 'MMMM yyyy', { locale: es as any })}
                {viewMode === 'week' && `Semana del ${format(weekStart, "d MMM", { locale: es as any })}`}
                {viewMode === 'day' && format(currentDate, "d 'de' MMMM", { locale: es as any })}
              </h2>
              <button onClick={handleNext} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}><ChevronRight size={16} /></button>
              <button onClick={goToday} className="btn-secondary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', height: 34, marginLeft: 8 }}>Hoy</button>
            </div>

            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border-default)' }}>
              {(['month', 'week', 'day'] as ViewMode[]).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: viewMode === m ? 'var(--accent)' : 'transparent',
                  color: viewMode === m ? '#fff' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 200ms',
                }}>
                  {m === 'month' ? <Calendar size={14} /> : m === 'week' ? <Layers size={14} /> : <ListTodo size={14} />}
                  {m === 'month' ? 'Mes' : m === 'week' ? 'Semana' : 'Día'}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="bento-card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-base)' }}>
            {viewMode === 'month' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)' }}>
                  {DAY_HEADERS.map(d => (
                    <div key={d} style={{ padding: '12px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {weekRows.map((week, wi) => (
                    <div key={wi} style={{ borderBottom: wi < weekRows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {week.map((day, di) => {
                          const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                          const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
                          const isSel = isSameDay(day, selectedDay);
                          const isTodayDay = isToday(day);
                          const isCurrentMonth = isSameMonth(day, monthStart);
                          const allItems = [
                            ...dayTasks.map(t => ({ type: 'task' as const, title: t.title, color: t.courseColor })),
                            ...dayEvents.map(e => ({ type: 'event' as const, title: e.title, color: e.color }))
                          ].slice(0, 3);

                          return (
                            <div key={di} onClick={() => { setSelectedDay(day); setCurrentDate(day); }} style={{
                              padding: '8px 10px', minHeight: 110,
                              borderRight: di < 6 ? '1px solid var(--border-subtle)' : 'none',
                              background: isSel ? 'var(--accent-dim)' : 'transparent',
                              border: isSel ? '1px solid var(--accent-glow)' : '1px solid transparent',
                              cursor: 'pointer', transition: 'all 200ms',
                              opacity: isCurrentMonth ? 1 : 0.3, position: 'relative',
                            }} onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-hover)'; }} onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                              <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isTodayDay ? 700 : 600, marginBottom: 6, color: isTodayDay ? '#fff' : 'var(--text-primary)', background: isTodayDay ? 'var(--accent)' : isSel ? 'var(--bg-surface)' : 'transparent', boxShadow: isTodayDay ? '0 0 12px var(--accent-glow)' : 'none' }}>
                                {format(day, 'd')}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {allItems.map((item, ii) => (
                                  <div key={ii} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${item.color}20`, borderLeft: `2px solid ${item.color}`, color: item.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.title}
                                  </div>
                                ))}
                                {dayTasks.length + dayEvents.length > 3 && (
                                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingLeft: 4, fontWeight: 600 }}>
                                    +{dayTasks.length + dayEvents.length - 3} más
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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', position: 'sticky', top: 0, zIndex: 2 }}>
                  <div style={{ padding: 12 }} />
                  {weekDays.map((d, i) => (
                    <div key={i} onClick={() => { setSelectedDay(d); setCurrentDate(d); }} style={{
                      padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
                      background: isSameDay(d, selectedDay) ? 'var(--accent-dim)' : 'transparent',
                      borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{format(d, 'EEE', { locale: es as any })}</div>
                      <div style={{ width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: isToday(d) ? 700 : 600, color: isToday(d) ? '#fff' : 'var(--text-primary)', background: isToday(d) ? 'var(--accent)' : 'transparent', marginTop: 4, boxShadow: isToday(d) ? '0 0 12px var(--accent-glow)' : 'none' }}>
                        {format(d, 'd')}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  {hours.map((h, hi) => (
                    <div key={hi} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)', minHeight: 60 }}>
                      <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'right', borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-deep)' }}>{h}</div>
                      {weekDays.map((d, di) => {
                        const cellEvents = events.filter(e => isSameDay(new Date(e.date), d) && e.startTime?.startsWith(h.split(':')[0]));
                        return (
                          <div key={di} onClick={() => { setSelectedDay(d); setCurrentDate(d); }} style={{
                            padding: '4px 8px', borderLeft: di > 0 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer',
                            background: isSameDay(d, new Date()) && isToday(new Date()) ? 'var(--accent-dim)' : 'transparent',
                          }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = isSameDay(d, new Date()) && isToday(new Date()) ? 'var(--accent-dim)' : 'transparent'}>
                            {cellEvents.map((e, ei) => (
                              <div key={ei} style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: `${e.color}25`, borderLeft: `2px solid ${e.color}`, color: e.color, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'day' && (
              <div>
                {hours.map((h, hi) => {
                  const dayEvents = events.filter(e => isSameDay(new Date(e.date), selectedDay) && e.startTime?.startsWith(h.split(':')[0]));
                  return (
                    <div key={hi} style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', minHeight: 72 }}>
                      <div style={{ width: 80, padding: '16px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'right', borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', flexShrink: 0 }}>{h}</div>
                      <div style={{ flex: 1, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {dayEvents.map((e, ei) => (
                          <div key={ei} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, background: `${e.color}20`, borderLeft: `3px solid ${e.color}`, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Clock size={14} /> <span style={{ fontWeight: 700 }}>{e.title}</span>
                            </div>
                            {e.startTime && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{e.startTime} – {e.endTime}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Day Detail Footer */}
          {(selectedDayTasks.length > 0 || selectedDayEvents.length > 0) && (
            <div className="bento-card" style={{ padding: '16px 20px', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                {format(selectedDay, "d MMM", { locale: es as any })}
              </div>
              <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
              {selectedDayTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: `${t.courseColor}15`, border: `1px solid ${t.courseColor}30`, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.courseColor, boxShadow: `0 0 8px ${t.courseColor}` }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</span>
                  <button onClick={() => toast.success('Tarea completada')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Check size={14} /></button>
                </div>
              ))}
              {selectedDayEvents.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: `${e.color}15`, border: `1px solid ${e.color}30`, flexShrink: 0 }}>
                  <Sparkles size={14} style={{ color: e.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{e.startTime}–{e.endTime}</span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: HORARIO & IA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Horario de Clases Card */}
          <div className="bento-card" style={{ padding: '24px 20px', background: 'var(--bg-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                <GraduationCap size={18} className="text-accent" /> Horario de Clases
              </h3>
              <button onClick={() => setShowScheduleModal(true)} className="btn-ghost hover-lift" style={{ padding: 6, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}><Plus size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(day => {
                const dayBlocks = scheduleBlocks.filter(b => b.day === day);
                if (dayBlocks.length === 0) return null;
                return (
                  <div key={day}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, paddingLeft: 4 }}>{day}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {dayBlocks.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: `linear-gradient(90deg, ${b.color}15 0%, var(--bg-surface) 100%)`, border: `1px solid ${b.color}20`, borderLeft: `4px solid ${b.color}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontWeight: 500 }}>{b.time}</div>
                          </div>
                          <BookOpen size={16} style={{ color: b.color, opacity: 0.7, flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IA Horario Card */}
          <div className="bento-card" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, #1a1a2e 100%)', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 8px 32px rgba(99,102,241,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#818CF8' }}>
                <Bot size={18} /> IA Horario
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.5, fontWeight: 500 }}>
              Sube una foto de tu horario escolar y la IA lo procesará para añadirlo a tu calendario automáticamente.
            </p>
            <button onClick={() => setShowAIModal(true)} className="btn-primary hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, height: 40, padding: '0 20px', width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
              <Upload size={16} /> Subir Horario
            </button>
          </div>

        </div>

      </div>

      {/* ── AI Modal ── */}
      {showAIModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowAIModal(false)}>
          <div className="bento-card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: '#818CF8' }}>
                <Bot size={22} /> Subir Horario Escolar
              </h2>
              <button onClick={() => setShowAIModal(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Foto o Captura del Horario</label>
              {scheduleImage ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                  <img src={scheduleImage} alt="Horario" style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }} />
                  <button onClick={() => setScheduleImage(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', borderRadius: 6, padding: 6, cursor: 'pointer' }}><X size={16} /></button>
                </div>
              ) : (
                <label className="btn-ghost" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px', borderRadius: 12, border: '2px dashed var(--border-subtle)', cursor: 'pointer', background: 'var(--bg-surface)' }}>
                  <Upload size={28} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Haz clic para seleccionar o arrastra una imagen</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Soporta PNG, JPG, WEBP</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Questionnaire */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ListTodo size={16} className="text-accent" /> Cuestionario de Apoyo (Opcional)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {questions.map(q => (
                  <div key={q.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block' }}>{q.label}</label>
                    <input
                      type="text"
                      placeholder={q.label}
                      value={qa[q.key] || ''}
                      onChange={e => setQa(prev => ({ ...prev, [q.key]: e.target.value }))}
                      className="input-base"
                      style={{ fontSize: 12, height: 36, width: '100%', background: 'var(--bg-surface)' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Indicación Adicional para la IA</label>
              <textarea
                placeholder="Ej: Mi horario es de lunes a viernes de 8am a 1pm. Ignorar los recesos..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="input-base"
                style={{ fontSize: 12, width: '100%', resize: 'vertical', minHeight: 80, padding: 12, background: 'var(--bg-surface)' }}
              />
            </div>

            <button onClick={handleAIGenerate} className="btn-primary hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, height: 42, padding: '0 20px', width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
              <Bot size={16} /> Procesar e Integrar Horario
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
