/**
 * Planificacion.tsx â€” Enterprise Academic Planner (v2 Revamp)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, X, Trash2, Check, CheckSquare, CheckCircle2
} from 'lucide-react';
import { useApp, fmtClock, fmtTimeRange } from '../../store/AppContext';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addDays, subDays, addWeeks, subWeeks,
  isBefore,
} from 'date-fns';
import { es } from 'date-fns/locale';
import NotificationBell from '../ui/NotificationBell';
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';

import EventModal, { PlanEvent } from './planificacion/EventModal';
import ScheduleBuilder, { ScheduleClass } from './planificacion/ScheduleBuilder';
import HabitsView from './planificacion/HabitsView';
import LateralPanel, { SelectedItem } from './planificacion/LateralPanel';

const H_START = 0;
const H_END   = 23;
const H_PX    = 64; 
const DAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

type PlanView = 'week' | 'day' | 'month' | 'year';
const VIEW_LABELS: Record<PlanView, string> = {
  week: 'Vista Semanal',
  day: 'Vista Diaria',
  month: 'Vista Mensual',
  year: 'Vista Anual',
};

function timeToFrac(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}
function fracToTime(f: number): string {
  const h = Math.floor(f), m = Math.round((f - h) * 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function nowFrac() { const n = new Date(); return n.getHours() + n.getMinutes()/60 + n.getSeconds()/3600; }

function eventTop(ev: PlanEvent | ScheduleClass): number { return (timeToFrac(ev.startTime) - H_START) * H_PX; }
function eventHeight(ev: PlanEvent | ScheduleClass): number {
  const d = timeToFrac(ev.endTime) - timeToFrac(ev.startTime);
  return Math.max(d * H_PX, 24); // Remove -2 to make blocks flush and sharp
}

const HOURS = Array.from({ length: H_END - H_START + 1 }, (_, i) => H_START + i);

const STORE_KEY = 'owa_planner_v3';

function loadStore(): { events: PlanEvent[]; classes: ScheduleClass[] } {
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return { events: d.events || [], classes: d.classes || [] }; }
  catch { return { events: [], classes: [] }; }
}
function saveStore(events: PlanEvent[], classes: ScheduleClass[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ events, classes }));
}

function getLayout(events: (PlanEvent | ScheduleClass)[]) {
  const sorted = [...events].sort((a,b) => timeToFrac(a.startTime) - timeToFrac(b.startTime));
  let groups: (PlanEvent | ScheduleClass)[][] = [];
  let currentGroup: (PlanEvent | ScheduleClass)[] = [];
  let groupEnd = 0;
  
  for (const ev of sorted) {
    const s = timeToFrac(ev.startTime);
    const e = timeToFrac(ev.endTime);
    if (currentGroup.length === 0) {
      currentGroup.push(ev);
      groupEnd = e;
    } else if (s < groupEnd) {
      currentGroup.push(ev);
      groupEnd = Math.max(groupEnd, e);
    } else {
      groups.push(currentGroup);
      currentGroup = [ev];
      groupEnd = e;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);
  
  const layout = new Map<string, { left: number, width: number }>();
  for (const g of groups) {
    const cols: (PlanEvent | ScheduleClass)[][] = [];
    for (const ev of g) {
      let placed = false;
      for (let i=0; i<cols.length; i++) {
        const last = cols[i][cols[i].length - 1];
        if (timeToFrac(last.endTime) <= timeToFrac(ev.startTime)) {
          cols[i].push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) cols.push([ev]);
    }
    for (let i=0; i<cols.length; i++) {
      for (const ev of cols[i]) {
        layout.set(ev.id, { left: (i / cols.length) * 100, width: (1 / cols.length) * 100 });
      }
    }
  }
  return layout;
}

// Function to visually merge consecutive schedule classes of the same type
function getMergedClasses(classes: ScheduleClass[]) {
  const sorted = [...classes].sort((a, b) => timeToFrac(a.startTime) - timeToFrac(b.startTime));
  const merged: ScheduleClass[] = [];
  let current: ScheduleClass | null = null;

  for (const cls of sorted) {
    if (!current) {
      current = { ...cls };
    } else {
      // If consecutive, same day, same class title and type, merge them
      if (current.dayOfWeek === cls.dayOfWeek && current.endTime === cls.startTime && current.title === cls.title && current.type === cls.type) {
        current.endTime = cls.endTime;
      } else {
        merged.push(current);
        current = { ...cls };
      }
    }
  }
  if (current) merged.push(current);
  return merged;
}

export default function Planificacion() {
  const { tasks, courses, setNavigateTo, addNotification, settings, studySessions, plannedSessions } = useApp();

  const [planView, setPlanView] = useState<PlanView>(() => {
    try { return (localStorage.getItem('owa_planner_view') as PlanView) || 'week'; }
    catch { return 'week'; }
  });
  const [navDate, setNavDate]   = useState(new Date());
  const [now, setNow]           = useState(new Date());

  const [events, setEvents]    = useState<PlanEvent[]>([]);
  const [classes, setClasses]  = useState<ScheduleClass[]>([]);

  const [showEventModal, setShowEventModal]   = useState(false);
  const [modalDefaults, setModalDefaults]     = useState<Partial<PlanEvent>>({});
  const [editingEvent, setEditingEvent]       = useState<PlanEvent | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const [activeDragPlanId, setActiveDragPlanId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ dayIdx: number; hour: number } | null>(null);

  const planSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [scheduleImageUrl, setScheduleImageUrl] = useState<string | null>(null);
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(() => {
    try { return localStorage.getItem('owa_show_schedule') === 'true'; } catch { return false; }
  });
  const [showHabits, setShowHabits] = useState(() => {
    try { return localStorage.getItem('owa_show_habits') === 'true'; } catch { return false; }
  });

  useEffect(() => { localStorage.setItem('owa_planner_view', planView); }, [planView]);
  useEffect(() => { localStorage.setItem('owa_show_schedule', String(showScheduleBuilder)); }, [showScheduleBuilder]);
  useEffect(() => { localStorage.setItem('owa_show_habits', String(showHabits)); }, [showHabits]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const timeStr = fmtClock(format(now, 'HH:mm'), settings?.timeFormat);
  const secsStr = format(now, 'ss');
  const dateStr = format(now, "EEEE d 'de' MMMM yyyy", { locale: es as any });

  useEffect(() => { const d = loadStore(); setEvents(d.events); setClasses(d.classes); }, []);
  useEffect(() => { const t = setTimeout(() => saveStore(events, classes), 400); return () => clearTimeout(t); }, [events, classes]);

  const weekStart = startOfWeek(navDate, { weekStartsOn: 1 });
  const weekDays  = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const monthStart = startOfMonth(navDate);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekRows   = calDays.reduce<Date[][]>((a, d, i) => { if (i%7===0) a.push([]); a[a.length-1].push(d); return a; }, []);

  const handleDragEndPlan = useCallback((event: any) => {
    const { active, over } = event;
    setActiveDragPlanId(null);
    setDragOverSlot(null);
    if (!over || !active) return;
    const overId = over.id as string;
    if (!overId.startsWith('plan-slot-')) return;
    const parts = overId.replace('plan-slot-', '').split('-');
    if (parts.length !== 2) return;
    const dayIdx = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);
    if (isNaN(dayIdx) || isNaN(hour)) return;
    const evId = active.id as string;
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const dur = timeToFrac(ev.endTime) - timeToFrac(ev.startTime);
    const newStart = Math.max(H_START, Math.min(H_END - dur, hour));
    const newEnd = newStart + dur;
    const newDate = format(weekDays[dayIdx], 'yyyy-MM-dd');
    setEvents(p => p.map(e => e.id === evId
      ? { ...e, date: newDate, startTime: fracToTime(newStart), endTime: fracToTime(newEnd) }
      : e));
  }, [events, weekDays]);

  const nav = (dir: 1 | -1) => {
    if (planView === 'year') setNavDate(dir===1 ? addMonths(navDate,12) : subMonths(navDate,12));
    else if (planView === 'month') setNavDate(dir===1 ? addMonths(navDate,1) : subMonths(navDate,1));
    else if (planView === 'week') setNavDate(dir===1 ? addWeeks(navDate,1) : subWeeks(navDate,1));
    else if (planView === 'day') setNavDate(dir===1 ? addDays(navDate,1) : subDays(navDate,1));
  };

  const navLabel = useMemo(() => {
    if (planView==='year')  return format(navDate,'yyyy',{locale:es as any});
    if (planView==='month') return format(navDate,'MMMM yyyy',{locale:es as any});
    if (planView==='week')  return `${format(weekDays[0],'d MMM',{locale:es as any})} - ${format(weekDays[6],'d MMM yyyy',{locale:es as any})}`;
    if (planView==='day')   return format(navDate,"EEEE d 'de' MMMM yyyy",{locale:es as any});
    return '';
  }, [planView, navDate, weekDays]);

  function getEventsForDate(iso: string): PlanEvent[] {
    return events.filter(e => {
      // Check repeat bounds
      if (e.repeatUntil && isBefore(new Date(e.repeatUntil+'T23:59:59'), new Date(iso+'T00:00:00'))) return false;

      if (e.date === iso) return true;
      if (e.repeat === 'daily') return !isBefore(new Date(iso+'T12:00:00'), new Date(e.date+'T12:00:00'));
      if (e.repeat === 'weekly') {
        const orig = new Date(e.date + 'T12:00:00');
        const tgt  = new Date(iso + 'T12:00:00');
        return orig.getDay() === tgt.getDay() && !isBefore(tgt, orig);
      }
      if (e.repeat === 'custom_days' && e.repeatDays) {
        const orig = new Date(e.date + 'T12:00:00');
        const tgt  = new Date(iso + 'T12:00:00');
        const jsDay = tgt.getDay();
        const mappedDay = (jsDay + 6) % 7; 
        return e.repeatDays.includes(mappedDay) && !isBefore(tgt, orig);
      }
      return false;
    });
  }
  
  function getTimedEventsForDate(iso: string): PlanEvent[] { return getEventsForDate(iso).filter(e => !e.allDay); }
  function getAllDayEventsForDate(iso: string): PlanEvent[] { return getEventsForDate(iso).filter(e => e.allDay); }
  function getClassesForDay(di: number): ScheduleClass[] { return getMergedClasses(classes.filter(c => c.dayOfWeek === di)); }

  function isValidDateStr(d: string | undefined | null): d is string {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !isNaN(t);
  }

  function getStudySessionsForDate(iso: string) {
    return studySessions.filter(s => {
      if (!isValidDateStr(s.startedAt)) return false;
      const sDate = format(new Date(s.startedAt), 'yyyy-MM-dd');
      if (sDate === iso) return true;
      if (isValidDateStr(s.endedAt)) {
        const eDate = format(new Date(s.endedAt), 'yyyy-MM-dd');
        return sDate <= iso && eDate >= iso;
      }
      return false;
    });
  }

  function getPlannedSessionsForDate(iso: string) {
    return (plannedSessions || []).filter(s => s.date === iso && !s.completed);
  }

  const isOld = (dateStr: string) => {
    const diff = (new Date().getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000;
    return diff > 4;
  };

  function deleteEvent(id: string) {
    setEvents(p => p.filter(e => e.id !== id));
    setEditingEvent(null);
    setShowEventModal(false);
    setSelectedItem(null);
  }

  function saveEvent(ev: PlanEvent) {
    setEvents(p => {
      const idx = p.findIndex(x => x.id === ev.id);
      if (idx >= 0) { const n = [...p]; n[idx] = ev; return n; }
      return [...p, ev];
    });
    setShowEventModal(false);
    setEditingEvent(null);
    setSelectedItem(null);
  }

  const nowH  = nowFrac();
  const nowPx = (nowH - H_START) * H_PX;

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const viewH = el.clientHeight;
    const target = nowPx - viewH / 2 + H_PX;
    el.scrollTop = Math.max(0, target);
  }, [planView, navDate]);

  return (
    <div className="page-container" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* HEADER — Title + Date | Bell + Clock */}
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, paddingTop:6, flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:200, color:'var(--text-primary)', letterSpacing:'-0.03em', fontFamily:"'Inter Tight', sans-serif", lineHeight:1 }}>
            Planificador
          </h1>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:6, fontWeight:500, letterSpacing: '0.01em' }}>
            {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <NotificationBell />
          <div style={{ textAlign:'right', paddingRight:2 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:3, justifyContent:'flex-end' }}>
              <span style={{ fontFamily:"'Inter Tight', sans-serif", fontSize:68, fontWeight:200, lineHeight:0.9, color:'var(--accent)', textShadow:'0 0 32px var(--accent-glow)', letterSpacing:'0.02em' }}>{timeStr}</span>
            </div>
          </div>
        </div>
      </header>

      {/* TOOLBAR — View Selector + Nav | Horario + Nuevo Evento */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Segmented view tabs — exclusive */}
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: showScheduleBuilder ? 'var(--bg-secondary)' : 'var(--surface-elevated)', border: '1px solid var(--border-soft)', opacity: showScheduleBuilder ? 0.4 : 1, pointerEvents: showScheduleBuilder ? 'none' : 'auto', transition: 'opacity 200ms' }}>
            {(['week', 'day', 'month', 'year'] as PlanView[]).map(v => (
              <button key={v} onClick={() => setPlanView(v)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 200ms', background: planView === v ? 'var(--accent)' : 'transparent', color: planView === v ? '#fff' : 'var(--text-secondary)', fontFamily: "'Outfit',sans-serif" }}>
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {!showScheduleBuilder && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={()=>nav(-1)}
                style={{
                  height:36, width:36, borderRadius:10, border:'1px solid var(--border-subtle)',
                  background:'transparent', color:'var(--text-secondary)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 200ms',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border-hover)';e.currentTarget.style.color='var(--text-primary)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.color='var(--text-secondary)';}}
              ><ChevronLeft size={15}/></button>
              <button onClick={()=>setNavDate(new Date())}
                style={{
                  height:36, borderRadius:10, border:'1px solid var(--border-subtle)',
                  background:'transparent', color:'var(--text-secondary)', cursor:'pointer',
                  fontSize:12, fontWeight:600, padding:'0 16px', fontFamily:"'Outfit',sans-serif",
                  transition:'all 200ms',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border-hover)';e.currentTarget.style.color='var(--text-primary)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.color='var(--text-secondary)';}}
              >Hoy</button>
              <button onClick={()=>nav(1)}
                style={{
                  height:36, width:36, borderRadius:10, border:'1px solid var(--border-subtle)',
                  background:'transparent', color:'var(--text-secondary)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 200ms',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border-hover)';e.currentTarget.style.color='var(--text-primary)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.color='var(--text-secondary)';}}
              ><ChevronRight size={15}/></button>
              <span style={{ fontSize:15, fontWeight:300, color:'var(--text-primary)', textTransform:'capitalize', minWidth:260, fontFamily: "'Outfit', sans-serif", textAlign: 'right', letterSpacing: '-0.01em' }}>{navLabel}</span>
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => setShowScheduleBuilder(!showScheduleBuilder)}
            style={{
              height:38, borderRadius:10, padding:'0 18px',
              fontSize:12, fontWeight:600, fontFamily:"'Outfit',sans-serif",
              display:'flex', alignItems:'center', gap:8,
              border: showScheduleBuilder ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              background: showScheduleBuilder ? 'rgba(225,29,72,0.08)' : 'transparent',
              color: showScheduleBuilder ? 'var(--accent)' : 'var(--text-secondary)',
              cursor:'pointer', transition:'all 200ms',
            }}
            onMouseEnter={e=>{if(!showScheduleBuilder){e.currentTarget.style.borderColor='var(--border-hover)';e.currentTarget.style.color='var(--text-primary)';}}}
            onMouseLeave={e=>{if(!showScheduleBuilder){e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.color='var(--text-secondary)';}}}
          >
            <Calendar size={14} /> {showScheduleBuilder ? 'Cerrar Horario' : 'Horario'}
          </button>
          <button onClick={() => setShowHabits(!showHabits)}
            style={{
              height:38, borderRadius:10, padding:'0 18px',
              fontSize:12, fontWeight:600, fontFamily:"'Outfit',sans-serif",
              display:'flex', alignItems:'center', gap:8,
              border: showHabits ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              background: showHabits ? 'rgba(225,29,72,0.08)' : 'transparent',
              color: showHabits ? 'var(--accent)' : 'var(--text-secondary)',
              cursor:'pointer', transition:'all 200ms',
            }}
            onMouseEnter={e=>{if(!showHabits){e.currentTarget.style.borderColor='var(--border-hover)';e.currentTarget.style.color='var(--text-primary)';}}}
            onMouseLeave={e=>{if(!showHabits){e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.color='var(--text-secondary)';}}}
          >
            <CheckSquare size={14} /> {showHabits ? 'Cerrar Hábitos' : 'Hábitos'}
          </button>
          <button
            onClick={() => { setModalDefaults({ date: format(new Date(), 'yyyy-MM-dd') }); setEditingEvent(null); setShowEventModal(true); }}
            style={{
              display:'flex', alignItems:'center', gap:8,
              height:38, borderRadius:10, padding:'0 20px',
              fontSize:12, fontWeight:700, fontFamily:"'Outfit',sans-serif",
              border:'none', cursor:'pointer',
              background:'var(--accent)', color:'#fff',
              boxShadow:'0 4px 15px var(--accent-dim)',
              transition:'all 200ms',
            }}
            onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.15)'}
            onMouseLeave={e=>e.currentTarget.style.filter='none'}
          >
            <Plus size={16}/> Nuevo Evento
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      {showScheduleBuilder || showHabits ? (
        <div style={{ display:'flex', flex:1, gap:16, minHeight:0, overflow:'hidden' }}>
          {showScheduleBuilder && (
            <div style={{ flex: showHabits ? '1 1 50%' : 1, minWidth: 0, display: 'flex' }}>
              <ScheduleBuilder
                scheduleImageUrl={scheduleImageUrl}
                onSetScheduleImage={setScheduleImageUrl}
                imgInputRef={imgInputRef}
              />
            </div>
          )}
          {showHabits && (
            <div className="bento-card" style={{ flex: showScheduleBuilder ? '1 1 50%' : 1, minWidth: 0, padding: 0, border: '1px solid var(--border-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <HabitsView />
            </div>
          )}
        </div>
      ) : (
      <div style={{ display:'flex', flex:1, gap:16, minHeight:0, overflow:'hidden' }}>
        <div className="bento-card" style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden', padding:0, border:'1px solid var(--border-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', background: 'color-mix(in srgb, var(--bg-surface) 60%, var(--bg-base) 40%)' }}>

          {/* WEEK VIEW */}
          {planView === 'week' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:`60px repeat(7,1fr)`, borderBottom:'1px solid var(--border-soft)', flexShrink:0 }}>
                <div style={{ borderRight:'1px solid var(--border-soft)' }}/>
                {weekDays.map((d,i) => {
                  const tod = isToday(d);
                  return (
                    <div key={i}
                      onClick={() => { const dIso = format(d, 'yyyy-MM-dd'); const dEvs = getEventsForDate(dIso); const dLinkedIds = new Set(dEvs.map(ev => (ev as PlanEvent).taskId).filter(Boolean)); setSelectedItem({ type: 'day', date: d, events: dEvs, tasks: tasks.filter(t => { if (!t.dueDate || t.status === 'completado') return false; if (dLinkedIds.has(t.id)) return false; return t.dueDate === dIso; }) }); }}
                      style={{ padding:'12px 0', textAlign:'center', cursor:'pointer', borderLeft: i > 0 ? '1px solid var(--border-soft)' : 'none', background:tod?'rgba(225,29,72,0.05)':'transparent', position:'relative', transition:'background 200ms' }}
                      onMouseEnter={e=>!tod && (e.currentTarget.style.outline='1px solid var(--border-strong)')}
                      onMouseLeave={e=>!tod && (e.currentTarget.style.outline='none')}
                    >
                      {tod && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'var(--accent)', boxShadow:'0 0 12px var(--accent-glow)' }}/>}
                      <div style={{ fontSize:11, fontWeight:700, color:tod?'var(--accent)':'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{DAY_LABELS[i]}</div>
                      <div style={{
                        width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', margin: '4px 0',
                        fontSize:15, fontWeight:tod?700:500,
                        background:tod?'var(--accent)':'transparent',
                        color:tod?'#fff':'var(--text-primary)',
                        fontFamily:"'Outfit',sans-serif",
                      }}>{format(d,'d')}</div>
                      <AllDayBar events={getAllDayEventsForDate(format(d,'yyyy-MM-dd'))} plannedSessions={getPlannedSessionsForDate(format(d,'yyyy-MM-dd'))} />
                    </div>
                  );
                })}
              </div>
              <DndContext sensors={planSensors} onDragStart={e => { if (!('dayOfWeek' in (events.find(ev => ev.id === e.active.id) || {} as any))) setActiveDragPlanId(e.active.id as string); }} onDragEnd={handleDragEndPlan}>
              <div ref={timelineRef} style={{ flex:1, overflowY:'auto', paddingBottom:24 }}>
                <div style={{ display:'grid', gridTemplateColumns:`60px repeat(7,1fr)`, minHeight:(H_END-H_START+1)*H_PX }}>
                  <div style={{ borderRight:'1px solid var(--border-soft)' }}>
                    {HOURS.map(h => (
                      <div key={h} style={{ height:H_PX, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:12, paddingTop:6, borderBottom:'1px solid var(--border-soft)' }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'0.04em' }}>
                          {fmtClock(String(h).padStart(2,'0') + ':00', settings?.timeFormat)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {weekDays.map((d,di) => {
                    const iso = format(d,'yyyy-MM-dd');
                    const tod = isToday(d);
                    const timedEvs = getTimedEventsForDate(iso);
                    const schedCls = getClassesForDay(di);
                    const layout = getLayout([...timedEvs, ...schedCls]);
                    const opacity = isOld(iso) ? 0.35 : 1;

                    return (
                      <div key={di} style={{ position:'relative', borderLeft: di > 0 ? '1px solid var(--border-soft)' : 'none', background:tod?'rgba(225,29,72,0.02)':'transparent', opacity }}>
                        {HOURS.map(h => {
                          const slotId = `plan-slot-${di}-${h}`;
                          const isOver = dragOverSlot?.dayIdx===di && dragOverSlot?.hour===h;
                          return (
                            <DroppablePlanSlot key={h} id={slotId}>
                              {({ setNodeRef, isOver: isOverDnd }) => (
                                <div ref={setNodeRef}
                                  onClick={()=>{ setModalDefaults({ date:iso, startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setShowEventModal(true); }}
                                  style={{ height:H_PX, borderBottom:'1px dashed var(--border-soft)', background:isOver||isOverDnd?'rgba(225,29,72,0.08)':'transparent', transition:'background 100ms', cursor:'cell' }}
                                />
                              )}
                            </DroppablePlanSlot>
                          );
                        })}
                        {[...schedCls, ...timedEvs].map(item => {
                          const isClass = 'dayOfWeek' in item;
                          const top = eventTop(item);
                          const hpx = eventHeight(item);
                          const pos = layout.get(item.id) || { left: 0, width: 100 };
                          const itemColor = isClass && item.type === 'break' ? 'var(--text-muted)' : isClass && item.type === 'meal' ? '#f59e0b' : item.color;
                          
                          if (isClass) {
                            return (
                              <div key={item.id}
                                onClick={e => { e.stopPropagation(); setSelectedItem({ type: 'day', date: d, events: timedEvs, tasks: [] }); }}
                                style={{
                                  position:'absolute', top, left: `${pos.left}%`, width: `${pos.width}%`, height: hpx,
                                  borderRadius: '4px',
                                  background: `color-mix(in srgb, ${itemColor} 4%, transparent)`,
                                  zIndex: 0, cursor: 'pointer', display:'flex', flexDirection:'column', padding: '4px 8px', overflow: 'hidden',
                                  opacity: 0.55,
                                }}
                              >
                                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                              </div>
                            );
                          }
                          
                          return (
                            <DraggablePlanEvent key={item.id} id={item.id}>
                              {({ attributes, listeners, setNodeRef, isDragging }) => (
                                <div ref={setNodeRef} {...attributes} {...listeners}
                                  onClick={e => { e.stopPropagation(); setSelectedItem({ type: 'event', event: item as PlanEvent }); }}
                                  style={{
                                    position:'absolute', top, left: `${pos.left}%`, width: `${pos.width}%`, height: hpx,
                                    borderLeft: `3px solid ${itemColor}`,
                                    borderRadius: '4px',
                                    background: `color-mix(in srgb, ${itemColor} 12%, var(--bg-base))`,
                                    boxShadow: `inset 0 1px 0 ${itemColor}10, 0 2px 8px rgba(0,0,0,0.08)`,
                                    zIndex: 3, cursor: 'grab', display:'flex', flexDirection:'column', padding: '6px 10px', overflow: 'hidden',
                                    opacity: isDragging ? 0.4 : 1,
                                    transition: 'opacity 150ms',
                                  }}
                                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow = `inset 0 1px 0 ${itemColor}20, 0 6px 20px rgba(0,0,0,0.25)`; e.currentTarget.style.zIndex='4'; }}
                                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow = `inset 0 1px 0 ${itemColor}10, 0 2px 8px rgba(0,0,0,0.08)`; e.currentTarget.style.zIndex='3'; }}
                                >
                                  <span style={{ fontSize: 11, fontWeight: 600, color: itemColor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                                  {hpx > 40 && (item as PlanEvent).taskId && (() => { const lt = tasks.find(t => t.id === (item as PlanEvent).taskId); return lt ? (
                                    <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
                                      <CheckCircle2 size={9} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                                      <span style={{ fontSize:9, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lt.title}</span>
                                    </div>
                                  ) : null; })()}
                                  {hpx > 40 && (
                                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                                      <Clock size={10} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DraggablePlanEvent>
                          );
                        })}
                        {getStudySessionsForDate(iso).map(s => {
                          if (!isValidDateStr(s.startedAt)) return null;
                          const stD = new Date(s.startedAt);
                          const stH = stD.getHours() + stD.getMinutes() / 60 + stD.getSeconds() / 3600;
                          const durH = s.duration / 3600;
                          const sTop = (stH - H_START) * H_PX;
                          const sH = Math.max(durH * H_PX, 16);
                          const isChrono = s.type === 'chrono';
                          return (
                            <div key={s.id} title={`Estudio: ${Math.round(s.duration/60)} min`}
                              style={{
                                position:'absolute', top: sTop, left: '2%', width: '96%', height: sH,
                                borderRadius: 4, zIndex: 1, pointerEvents: 'none',
                                background: isChrono ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                                borderLeft: `2px solid ${isChrono ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)'}`,
                                opacity: 0.7,
                              }}
                            />
                          );
                        })}
                        {getPlannedSessionsForDate(iso).map(ps => {
                          const durH = ps.durationMinutes / 60;
                          const sH = Math.max(durH * H_PX, 20);
                          const startH = 9;
                          const sTop = (startH - H_START) * H_PX;
                          const courseInfo = courses.find(c => c.id === ps.courseId);
                          return (
                            <div key={`planned-${ps.id}`} title={`${ps.title} (${ps.durationMinutes}m — ${ps.type})`}
                              style={{
                                position:'absolute', top: sTop, left: '4%', width: '92%', height: sH,
                                borderRadius: 6, zIndex: 2, pointerEvents: 'none',
                                background: `linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))`,
                                borderLeft: `2.5px dashed rgba(139,92,246,0.35)`,
                                display: 'flex', alignItems: 'flex-start', padding: '4px 8px',
                              }}>
                              <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(139,92,246,0.65)', fontFamily: "'Inter', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ps.title} <span style={{ fontWeight: 400, opacity: 0.6 }}>· {ps.durationMinutes}m</span>
                              </span>
                            </div>
                          );
                        })}
                        {tod && nowH>=H_START && nowH<=H_END && (
                          <div style={{ position:'absolute', top:nowPx, left:0, right:0, height:2, background:'var(--accent)', zIndex:10, pointerEvents:'none', boxShadow:'0 0 12px var(--accent-glow)' }}>
                            <div style={{ position:'absolute', left:-4, top:-4, width:10, height:10, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 16px var(--accent-glow)' }}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <DragOverlay dropAnimation={null}>
                {activeDragPlanId ? (() => {
                  const ev = events.find(e => e.id === activeDragPlanId);
                  if (!ev) return null;
                  return (
                    <div style={{
                      padding: '6px 12px', borderRadius: 6, borderLeft: `3px solid ${ev.color}`,
                      background: `color-mix(in srgb, ${ev.color} 15%, var(--bg-base))`,
                      boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                      fontSize: 12, fontWeight: 600, color: ev.color,
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.title}
                    </div>
                  );
                })() : null}
              </DragOverlay>
              </DndContext>
            </>
          )}

          {/* DAY VIEW */}
          {planView === 'day' && (
            <>
              <div style={{ padding:'20px 28px', borderBottom:'1px solid var(--border-soft)', flexShrink:0, backdropFilter: 'blur(var(--bg-blur, 10px))', WebkitBackdropFilter: 'blur(var(--bg-blur, 10px))' }}>
                <div style={{ fontSize:24, fontWeight:300, color:isToday(navDate)?'var(--accent)':'var(--text-primary)', fontFamily:"'Outfit',sans-serif", textTransform:'capitalize', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {format(navDate,"EEEE d 'de' MMMM yyyy",{locale:es as any})}
                  {isToday(navDate) && <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-glow)', padding:'4px 12px', borderRadius:20 }}>HOY</span>}
                </div>
                <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:8 }}>
                  {getAllDayEventsForDate(format(navDate,'yyyy-MM-dd')).map(ev => (
                    <span key={ev.id} onClick={()=>{ setSelectedItem({ type: 'event', event: ev }); }} style={{ fontSize:12, fontWeight:600, padding:'6px 16px', borderRadius:10, background:`${ev.color}15`, border:`1px solid ${ev.color}30`, color:ev.color, cursor:'pointer' }}>{ev.title}</span>
                  ))}
                  {getPlannedSessionsForDate(format(navDate,'yyyy-MM-dd')).map(s => (
                    <span key={s.id} style={{ fontSize:11, fontWeight:500, padding:'4px 12px', borderRadius:8, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'rgba(139,92,246,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.title || s.type} <span style={{ fontSize: 9, opacity: 0.6 }}>{s.durationMinutes}m</span>
                    </span>
                  ))}
                </div>
              </div>
              <div ref={timelineRef} style={{ flex:1, overflowY:'auto', paddingBottom:24 }}>
                <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', minHeight:(H_END-H_START+1)*H_PX }}>
                  <div style={{ borderRight:'1px solid var(--border-soft)', background: 'color-mix(in srgb, var(--bg-elevated) 40%, transparent)' }}>
                    {HOURS.map(h=>(
                      <div key={h} style={{ height:H_PX, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:12, paddingTop:6, borderBottom:'1px solid var(--border-soft)' }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace" }}>{fmtClock(String(h).padStart(2,'0') + ':00', settings?.timeFormat)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ position:'relative' }}>
                    {HOURS.map(h=>(
                      <div key={h}
                        onClick={()=>{ setModalDefaults({ date:format(navDate,'yyyy-MM-dd'), startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setShowEventModal(true); }}
                        style={{ height:H_PX, borderBottom:'1px dashed var(--border-soft)', cursor:'cell' }}/>
                    ))}
                    {(()=>{
                      const timedEvs = getTimedEventsForDate(format(navDate,'yyyy-MM-dd'));
                      const schedCls = getClassesForDay((navDate.getDay()+6)%7);
                      const layout = getLayout([...timedEvs, ...schedCls]);
                      
                      return [...schedCls, ...timedEvs].map(item => {
                        const isClass = 'dayOfWeek' in item;
                        const top=eventTop(item), hpx=eventHeight(item);
                        const pos = layout.get(item.id) || { left: 0, width: 100 };
                        return (
                          <div key={item.id} onClick={e=>{e.stopPropagation(); isClass ? null : setSelectedItem({ type: 'event', event: item as PlanEvent });}} 
                            style={{ 
                              position:'absolute', top, left:`${pos.left}%`, width:`${pos.width}%`, height:hpx, 
                              borderLeft: isClass ? 'none' : `3px solid ${item.color}`,
                              background: isClass ? `color-mix(in srgb, ${item.color} 3%, transparent)` : `color-mix(in srgb, ${item.color} 18%, var(--bg-base))`, 
                              zIndex: isClass ? 0 : 3, cursor: isClass ? 'default' : 'pointer', display:'flex', flexDirection:'column', padding: isClass ? '4px 10px' : '12px 16px', overflow:'hidden',
                              opacity: isClass ? 0.5 : 1,
                              pointerEvents: isClass ? 'none' : 'auto',
                              borderRight: isClass ? 'none' : '1px solid var(--border-soft)', borderTop: isClass ? 'none' : '1px solid var(--border-soft)', borderBottom: isClass ? 'none' : '1px solid var(--border-soft)',
                              transition: 'filter 150ms'
                            }}
                            onMouseEnter={e => !isClass && (e.currentTarget.style.filter = 'brightness(1.2)')}
                            onMouseLeave={e => !isClass && (e.currentTarget.style.filter = 'none')}
                          >
                            <div style={{ fontSize: isClass ? 11 : 15, fontWeight: isClass ? 500 : 600, color: isClass ? 'var(--text-muted)' : item.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
                            {!isClass && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</div>}
                            {!isClass && (item as PlanEvent).taskId && (() => { const lt = tasks.find(t => t.id === (item as PlanEvent).taskId); return lt ? (
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, padding:'4px 8px', borderRadius:6, background:`${lt.courseColor||'var(--text-muted)'}10`, borderLeft:`2px solid ${lt.courseColor||'var(--text-muted)'}` }}>
                                <CheckCircle2 size={10} style={{ color: lt.courseColor||'var(--text-muted)', flexShrink:0 }} />
                                <span style={{ fontSize:11, color: lt.courseColor||'var(--text-secondary)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lt.title}</span>
                              </div>
                            ) : null; })()}
                            {!isClass && (item as PlanEvent).description && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:8, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{(item as PlanEvent).description}</div>}
                          </div>
                        );
                      });
                    })()}
                    {getStudySessionsForDate(format(navDate,'yyyy-MM-dd')).map(s => {
                      if (!isValidDateStr(s.startedAt)) return null;
                      const stD = new Date(s.startedAt);
                      const stH = stD.getHours() + stD.getMinutes() / 60 + stD.getSeconds() / 3600;
                      const durH = s.duration / 3600;
                      const sTop = (stH - H_START) * H_PX;
                      const sH = Math.max(durH * H_PX, 16);
                      const isChrono = s.type === 'chrono';
                      return (
                        <div key={s.id} title={`Estudio: ${Math.round(s.duration/60)} min`}
                          style={{
                            position:'absolute', top: sTop, left: '2%', width: '96%', height: sH,
                            borderRadius: 4, zIndex: 1, pointerEvents: 'none',
                            background: isChrono ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                            borderLeft: `2px solid ${isChrono ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)'}`,
                            opacity: 0.7, display:'flex', alignItems:'center', paddingLeft:10, gap:6,
                          }}>
                          <span style={{ fontSize:10, fontWeight:600, color:isChrono?'rgba(16,185,129,0.7)':'rgba(59,130,246,0.7)' }}>
                            {((s.courseId ? courses.find(c=>c.id===s.courseId)?.name : (s.subjects?.[0] ? courses.find(c=>c.id===s.subjects![0])?.name : '')) || '').substring(0, 12)}
                          </span>
                          <span style={{ fontSize:9, fontWeight:400, color:'rgba(255,255,255,0.35)' }}>
                            {Math.round(s.duration/60)}min
                          </span>
                        </div>
                      );
                    })}
                    {isToday(navDate) && nowH>=H_START && nowH<=H_END && (
                      <div style={{ position:'absolute', top:nowPx, left:0, right:0, height:2, background:'var(--accent)', zIndex:10, pointerEvents:'none', boxShadow:'0 0 16px var(--accent-glow)' }}>
                        <div style={{ position:'absolute', left:-4, top:-4, width:10, height:10, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 20px var(--accent-glow)' }}/>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* MONTH VIEW */}
          {planView === 'month' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border-soft)', flexShrink:0, backdropFilter: 'blur(var(--bg-blur, 10px))', WebkitBackdropFilter: 'blur(var(--bg-blur, 10px))' }}>
                {DAY_LABELS.map(d=><div key={d} style={{ padding:'12px 0', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{d}</div>)}
              </div>
              <div style={{ flex:1, overflowY:'auto', paddingBottom:24 }}>
                {weekRows.map((week,wi)=>(
                  <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border-soft)' }}>
                    {week.map((day,di)=>{
                      const inc=isSameMonth(day,monthStart), tod=isToday(day);
                      const iso=format(day,'yyyy-MM-dd');
                      const dayEvs=[...getAllDayEventsForDate(iso), ...getTimedEventsForDate(iso)];
                      const linkedTaskIds = new Set(dayEvs.map(ev => (ev as PlanEvent).taskId).filter(Boolean));
                      const dayTasks=tasks.filter(t=>{if(!t.dueDate||t.status==='completado')return false;if(linkedTaskIds.has(t.id))return false;try{return format(new Date(t.dueDate+'T12:00:00'),'yyyy-MM-dd')===iso}catch{return false}});
                      const opacity = isOld(iso) && !tod ? 0.35 : (inc ? 1 : 0.25);
                      return (
                        <div key={di}
                          onClick={()=>{ setSelectedItem({ type: 'day', date: day, events: dayEvs, tasks: dayTasks }); }}
                          style={{ height:130, padding:'10px 12px', cursor:'pointer', overflow:'hidden', borderRight:di<6?'1px solid var(--border-soft)':'none', background:tod?'rgba(225,29,72,0.05)':'transparent', opacity, transition:'background 200ms', position:'relative' }}
                          onMouseEnter={e=>!tod && (e.currentTarget.style.outline='1px solid var(--border-strong)')}
                          onMouseLeave={e=>!tod && (e.currentTarget.style.outline='none')}
                        >
                          <div style={{ width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10, fontSize:13,fontWeight:tod?700:500, background:tod?'var(--accent)':'transparent', color:tod?'#fff':'var(--text-primary)', fontFamily:"'Outfit',sans-serif" }}>{format(day,'d')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                            {dayEvs.slice(0,3).map((ev,ei)=>{
                              const evTask = (ev as PlanEvent).taskId ? tasks.find(t => t.id === (ev as PlanEvent).taskId) : null;
                              return <div key={ei} style={{ fontSize:10,padding:'4px 8px',borderRadius:6,background:`${ev.color}15`,borderLeft:`2px solid ${ev.color}`,color:ev.color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>{ev.title}{evTask ? <span style={{opacity:0.55,fontWeight:500}}> + {evTask.title}</span> : ''}</div>;
                            })}
                            {getPlannedSessionsForDate(iso).slice(0, 2).map(s => (
                              <div key={s.id} style={{ fontSize:9, padding:'3px 7px', borderRadius:5, background:'rgba(139,92,246,0.08)', borderLeft:'2px solid rgba(139,92,246,0.25)', color:'rgba(139,92,246,0.7)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:500 }}>
                                {s.title || s.type} <span style={{opacity:0.5}}>{s.durationMinutes}m</span>
                              </div>
                            ))}
                            {dayTasks.slice(0,3).map((t,ti)=><div key={ti} style={{ fontSize:10,padding:'4px 8px',borderRadius:6,background:`${t.courseColor||'var(--text-muted)'}15`,borderLeft:`2px dashed ${t.courseColor||'var(--text-muted)'}`,color:t.courseColor||'var(--text-secondary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>Ent: {t.title}</div>)}
                            {(dayEvs.length+dayTasks.length+getPlannedSessionsForDate(iso).length)>6&&<div style={{ fontSize:10,color:'var(--text-muted)',fontWeight:600, marginTop: 4 }}>+{dayEvs.length+dayTasks.length+getPlannedSessionsForDate(iso).length-6} más</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* YEAR VIEW */}
          {planView === 'year' && (
            <div style={{ flex:1, overflowY:'auto', padding:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                {Array.from({ length: 12 }, (_, mi) => {
                  const monthDate = new Date(navDate.getFullYear(), mi, 1);
                  const mStart = startOfMonth(monthDate);
                  const mEnd = endOfMonth(monthDate);
                  const calStart2 = startOfWeek(mStart, { weekStartsOn: 1 });
                  const calEnd2 = endOfWeek(mEnd, { weekStartsOn: 1 });
                  const days = eachDayOfInterval({ start: calStart2, end: calEnd2 });
                  const weeks: Date[][] = [];
                  days.forEach((d, i) => { if (i % 7 === 0) weeks.push([]); weeks[weeks.length - 1].push(d); });
                  const thisMonth = mi === new Date().getMonth() && navDate.getFullYear() === new Date().getFullYear();
                  return (
                    <div key={mi}
                      style={{
                        borderRadius:'var(--radius-lg)',
                        border:'1px solid var(--border-soft)',
                        background: thisMonth ? 'rgba(225,29,72,0.04)' : 'transparent',
                        padding:12, cursor:'default',
                        transition:'all 200ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
                    >
                      <div
                        onClick={() => { setNavDate(new Date(navDate.getFullYear(), mi, 1)); setPlanView('month'); }}
                        style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:"'Outfit',sans-serif", marginBottom:12, letterSpacing:'-0.01em', textTransform:'uppercase', cursor:'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      >
                        {format(monthDate, 'MMMM', { locale: es as any })}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
                        {['L','M','X','J','V','S','D'].map(l => (
                          <div key={l} style={{ fontSize:8, fontWeight:700, color:'var(--text-tertiary)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</div>
                        ))}
                      </div>
                      {weeks.map((week, wi) => (
                        <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                          {week.map((day, di) => {
                            const inc = isSameMonth(day, monthDate);
                            const tod = isToday(day);
                            const iso = format(day, 'yyyy-MM-dd');
                            const hasEvent = getEventsForDate(iso).length > 0;
                            const dayEvs2 = getEventsForDate(iso);
                            const dayLinkedIds2 = new Set(dayEvs2.map(ev => (ev as PlanEvent).taskId).filter(Boolean));
                            const dayTasks2 = tasks.filter(t => { if(!t.dueDate || t.status === 'completado') return false; if(dayLinkedIds2.has(t.id)) return false; try { return format(new Date(t.dueDate+'T12:00:00'),'yyyy-MM-dd')===iso } catch { return false } });
                            return (
                              <div key={di}
                                onClick={(e) => { e.stopPropagation(); if (inc) setSelectedItem({ type: 'day', date: day, events: dayEvs2, tasks: dayTasks2 }); }}
                                style={{
                                  width:'100%', aspectRatio:'1', borderRadius:4,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize: inc ? 10 : 8,
                                  fontWeight: tod ? 800 : (inc ? 500 : 300),
                                  color: tod ? '#fff' : (inc ? 'var(--text-primary)' : 'var(--text-muted)'),
                                  background: tod ? 'var(--accent)' : (hasEvent ? 'rgba(225,29,72,0.08)' : 'transparent'),
                                  opacity: inc ? 1 : 0.3,
                                  cursor: inc ? 'pointer' : 'default',
                                  transition:'background 150ms',
                                }}
                                onMouseEnter={e => { if (inc && !tod) e.currentTarget.style.outline = '1px solid var(--border-strong)'; }}
                                onMouseLeave={e => { if (inc && !tod) e.currentTarget.style.outline = 'none'; }}
                              >
                                {format(day, 'd')}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      <LateralPanel 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onSelectEvent={(ev) => setSelectedItem({ type: 'event', event: ev })}
        onEditEvent={(ev) => { setEditingEvent(ev); setShowEventModal(true); setSelectedItem(null); }}
        onDeleteEvent={(id) => { deleteEvent(id); }}
        onViewTask={(id) => { setSelectedItem(null); setNavigateTo(`tareas`); /* TODO: pass taskId to Tareas to open detail */ }}
        onAddEvent={(date) => { setModalDefaults({ date: format(date, 'yyyy-MM-dd') }); setEditingEvent(null); setShowEventModal(true); setSelectedItem(null); }}
      />

      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaults={modalDefaults}
          courses={courses}
          tasks={tasks}
          onClose={()=>{ setShowEventModal(false); setEditingEvent(null); }}
          onSave={saveEvent}
          onDelete={id=>{ deleteEvent(id); }}
          addNotification={addNotification}
        />
      )}

      <input ref={imgInputRef} type="file" accept="image/*" style={{ display:'none' }}
        onChange={e=>{ const f=e.target.files?.[0]; if(f){const url=URL.createObjectURL(f);setScheduleImageUrl(url);} }}/>
    </div>
  );
}

function DraggablePlanEvent({ id, children }: { id: string; children: (props: { attributes: any; listeners: any; setNodeRef: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return <>{children({ attributes, listeners, setNodeRef, isDragging })}</>;
}

function DroppablePlanSlot({ id, children }: { id: string; children: (props: { setNodeRef: any; isOver: boolean }) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <>{children({ setNodeRef, isOver })}</>;
}

function AllDayBar({ events, plannedSessions }: { events: PlanEvent[]; plannedSessions?: { id: string; title: string; durationMinutes: number; type: string; courseId?: string }[] }) {
  const ps = plannedSessions || [];
  if (!events.length && !ps.length) return <div style={{ minHeight:8 }}/>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'4px 8px', justifyContent:'center', flexDirection: 'column', alignItems: 'center' }}>
      {events.slice(0,2).map(ev=>(
        <div key={ev.id} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:`${ev.color}15`, borderLeft:`2px solid ${ev.color}`, color:ev.color, maxWidth:80, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:600 }}>{ev.title}</div>
      ))}
      {events.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>+{events.length - 2}</div>}
      {ps.slice(0, 2).map(s => (
        <div key={s.id} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.08)', borderLeft: '2px solid rgba(139,92,246,0.3)', color: 'rgba(139,92,246,0.7)', maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
          {s.title || s.type}
        </div>
      ))}
      {ps.length > 2 && <div style={{ fontSize: 8, color: 'rgba(139,92,246,0.5)', fontWeight: 500 }}>+{ps.length - 2}</div>}
    </div>
  );
}
