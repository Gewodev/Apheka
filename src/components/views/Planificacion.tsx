/**
 * Planificacion.tsx â€” Enterprise Academic Planner
 *
 * Architecture:
 *  - 4 views: Semana | Día | Mes | Horario (fixed schedule / cronogram)
 *  - Events are stored locally, strongly typed, linked to courses
 *  - Drag-and-drop rescheduling inside week grid
 *  - Right sidebar: today's agenda + upcoming deadlines only
 *  - No gamification, no imposed categories, no AI panel
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, X,
  Check, Trash2, GraduationCap, Settings2, Image,
  AlignLeft, RotateCcw, ChevronDown,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addDays, subDays, addWeeks, subWeeks,
  parseISO, isAfter, isBefore,
} from 'date-fns';
import { es } from 'date-fns/locale';
import NotificationBell from '../ui/NotificationBell';
// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const H_START = 7;
const H_END   = 22;
const H_PX    = 56;       // px per hour
const DAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type PlanView = 'week' | 'day' | 'month' | 'schedule';

interface PlanEvent {
  id: string;
  title: string;
  date: string;          // 'yyyy-MM-dd'
  allDay: boolean;
  startTime: string;     // 'HH:mm'
  endTime: string;       // 'HH:mm'
  courseId?: string;     // linked course
  color: string;         // hex
  description?: string;
  taskId?: string;       // linked task
  repeat: 'none' | 'weekly';
}

interface ScheduleClass {
  id: string;
  title: string;
  courseId?: string;
  dayOfWeek: number;     // 0=Mon â€¦ 6=Sun
  startTime: string;     // 'HH:mm'
  endTime: string;
  room?: string;
  teacher?: string;
  color: string;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function timeToFrac(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}
function fracToTime(f: number): string {
  const h = Math.floor(f), m = Math.round((f - h) * 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function nowFrac() { const n = new Date(); return n.getHours() + n.getMinutes()/60 + n.getSeconds()/3600; }

function eventTop(ev: PlanEvent): number { return (timeToFrac(ev.startTime) - H_START) * H_PX; }
function eventHeight(ev: PlanEvent): number {
  const d = timeToFrac(ev.endTime) - timeToFrac(ev.startTime);
  return Math.max(d * H_PX - 2, 22);
}

const HOURS = Array.from({ length: H_END - H_START + 1 }, (_, i) => H_START + i);

function defaultColor(courses: { id:string; color:string }[], courseId?: string): string {
  if (courseId) { const c = courses.find(x => x.id === courseId); if (c) return c.color; }
  return '#6366f1';
}

// â”€â”€ Storage key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STORE_KEY = 'owa_planner_v3';

function loadStore(): { events: PlanEvent[]; classes: ScheduleClass[] } {
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return { events: d.events || [], classes: d.classes || [] }; }
  catch { return { events: [], classes: [] }; }
}
function saveStore(events: PlanEvent[], classes: ScheduleClass[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ events, classes }));
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function Planificacion() {
  const { tasks, courses, setNavigateTo, addNotification } = useApp();

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [planView, setPlanView] = useState<PlanView>('week');
  const [navDate, setNavDate]   = useState(new Date());
  const [now, setNow]           = useState(new Date());

  const [events, setEvents]    = useState<PlanEvent[]>([]);
  const [classes, setClasses]  = useState<ScheduleClass[]>([]);

  // modals / panels
  const [showEventModal, setShowEventModal]   = useState(false);
  const [modalDefaults, setModalDefaults]     = useState<Partial<PlanEvent>>({});
  const [editingEvent, setEditingEvent]       = useState<PlanEvent | null>(null);
  const [showScheduleAdd, setShowScheduleAdd] = useState(false);
  const [deletingId, setDeletingId]           = useState<string | null>(null);

  // drag-n-drop rescheduling (week view)
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragOver, setDragOver]               = useState<{ dayIdx: number; hour: number } | null>(null);

  // schedule image upload ref
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [scheduleImageUrl, setScheduleImageUrl] = useState<string | null>(null);
  const [scheduleTab, setScheduleTab] = useState<'image' | 'manual'>('manual');

  // â”€â”€ Clock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const timeStr = format(now, 'HH:mm');
  const secsStr = format(now, 'ss');
  const dateStr = format(now, "EEEE d 'de' MMMM yyyy", { locale: es as any });

  // â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { const d = loadStore(); setEvents(d.events); setClasses(d.classes); }, []);
  useEffect(() => { const t = setTimeout(() => saveStore(events, classes), 400); return () => clearTimeout(t); }, [events, classes]);

  // â”€â”€ Week computation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const weekStart = startOfWeek(navDate, { weekStartsOn: 1 });
  const weekDays  = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const monthStart = startOfMonth(navDate);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekRows   = calDays.reduce<Date[][]>((a, d, i) => { if (i%7===0) a.push([]); a[a.length-1].push(d); return a; }, []);

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const nav = (dir: 1 | -1) => {
    if (planView === 'month') setNavDate(dir===1 ? addMonths(navDate,1) : subMonths(navDate,1));
    else if (planView === 'week') setNavDate(dir===1 ? addWeeks(navDate,1) : subWeeks(navDate,1));
    else if (planView === 'day') setNavDate(dir===1 ? addDays(navDate,1) : subDays(navDate,1));
    // schedule: no navigation
  };

  const navLabel = useMemo(() => {
    if (planView==='month') return format(navDate,'MMMM yyyy',{locale:es as any});
    if (planView==='week')  return `${format(weekDays[0],'d MMM',{locale:es as any})} â€“ ${format(weekDays[6],'d MMM yyyy',{locale:es as any})}`;
    if (planView==='day')   return format(navDate,"EEEE d 'de' MMMM yyyy",{locale:es as any});
    return 'Horario base';
  }, [planView, navDate, weekDays]);

  // â”€â”€ Event helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function getEventsForDate(iso: string): PlanEvent[] {
    return events.filter(e => {
      if (e.date === iso) return true;
      if (e.repeat === 'weekly') {
        // same day-of-week on or after original date
        const orig = new Date(e.date + 'T12:00:00');
        const tgt  = new Date(iso + 'T12:00:00');
        return orig.getDay() === tgt.getDay() && !isBefore(tgt, orig);
      }
      return false;
    });
  }
  function getTimedEventsForDate(iso: string): PlanEvent[] {
    return getEventsForDate(iso).filter(e => !e.allDay);
  }
  function getAllDayEventsForDate(iso: string): PlanEvent[] {
    return getEventsForDate(iso).filter(e => e.allDay);
  }
  function getClassesForDay(di: number): ScheduleClass[] {
    return classes.filter(c => c.dayOfWeek === di);
  }

  // â”€â”€ Drag-and-drop rescheduling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleDrop(dayIdx: number, hour: number) {
    if (!draggingEventId) { setDragOver(null); return; }
    const ev = events.find(e => e.id === draggingEventId);
    if (!ev) { setDragOver(null); setDraggingEventId(null); return; }
    const dur = timeToFrac(ev.endTime) - timeToFrac(ev.startTime);
    const newStart = Math.max(H_START, Math.min(H_END - dur, hour));
    const newEnd   = newStart + dur;
    const newDate  = format(weekDays[dayIdx], 'yyyy-MM-dd');
    setEvents(p => p.map(e => e.id === draggingEventId
      ? { ...e, date: newDate, startTime: fracToTime(newStart), endTime: fracToTime(newEnd) }
      : e));
    setDraggingEventId(null);
    setDragOver(null);
  }

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function deleteEvent(id: string) {
    setEvents(p => p.filter(e => e.id !== id));
    setDeletingId(null);
    setEditingEvent(null);
  }

  // â”€â”€ Save/update event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function saveEvent(ev: PlanEvent) {
    setEvents(p => {
      const idx = p.findIndex(x => x.id === ev.id);
      if (idx >= 0) { const n = [...p]; n[idx] = ev; return n; }
      return [...p, ev];
    });
    setShowEventModal(false);
    setEditingEvent(null);
  }

  // â”€â”€ Upcoming sidebar items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const todayISO  = format(new Date(), 'yyyy-MM-dd');
  const todayDi   = (new Date().getDay() + 6) % 7;

  const todayEvents = useMemo(() => {
    const timed = getTimedEventsForDate(todayISO).sort((a,b) => a.startTime.localeCompare(b.startTime));
    const allDay = getAllDayEventsForDate(todayISO);
    return { timed, allDay };
  }, [events, todayISO]);

  const todayClasses = useMemo(() =>
    classes.filter(c => c.dayOfWeek === todayDi).sort((a,b) => a.startTime.localeCompare(b.startTime)),
    [classes, todayDi]);

  const upcomingDeadlines = useMemo(() =>
    tasks.filter(t => t.status !== 'completado' && t.dueDate)
      .sort((a,b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 6),
    [tasks]);

  // â”€â”€ real-time indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const nowH  = nowFrac();
  const nowPx = (nowH - H_START) * H_PX;
  const todayWeekIdx = (new Date().getDay() + 6) % 7;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <div className="page-container" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, paddingTop:6, flexShrink:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h1 style={{ fontSize:28, fontWeight:700, color:'var(--accent)', letterSpacing:'-0.025em', fontFamily:"'Inter Tight', sans-serif", textShadow:'0 0 20px var(--accent-glow)', lineHeight:1 }}>
              Planificador
            </h1>
          </div>
          <p style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:5, fontWeight:400 }}>
            {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Live clock */}
          <NotificationBell />
          <div style={{ textAlign:'right', paddingRight:2, position:'relative' }}>
            <div style={{ position:'absolute', right:-4, top:'50%', transform:'translateY(-50%)', width:120, height:80, background:'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)', pointerEvents:'none', opacity:0.6 }}/>
            <div style={{ display:'flex', alignItems:'baseline', gap:3, justifyContent:'flex-end', position:'relative' }}>
              <span style={{ fontFamily:"'Inter Tight', sans-serif", fontSize:52, fontWeight:200, lineHeight:0.9, color:'var(--accent)', textShadow:'0 0 20px var(--accent-glow)', letterSpacing:'0.02em' }}>{timeStr}</span>
              <span style={{ fontFamily:"'Inter Tight', sans-serif", fontSize:18, fontWeight:200, color:'var(--accent)', opacity:0.6 }}>{secsStr}</span>
            </div>
          </div>

          {/* New event */}
          <button
            onClick={() => { setModalDefaults({ date: todayISO }); setEditingEvent(null); setShowEventModal(true); }}
            className="btn-primary hover-lift"
            style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, padding:'9px 18px', boxShadow:'0 0 18px var(--accent-glow)', fontFamily:"'Inter Tight', sans-serif", whiteSpace:'nowrap' }}
          >
            <Plus size={14}/> Nuevo evento
          </button>
        </div>
      </header>

      {/* â”€â”€ VIEW TABS + NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexShrink:0 }}>
        {/* View tabs */}
        <div style={{ display:'flex', borderRadius:9, padding:3, border:'1px solid var(--border-default)', gap:2 }}>
          {([['week','Semana'],['day','Día'],['month','Mes'],['schedule','Horario']] as [PlanView,string][]).map(([v,label])=>(
            <button key={v} onClick={()=>setPlanView(v)} style={{
              padding:'6px 18px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'none', transition:'all 200ms',
              background: planView===v ? 'var(--accent)' : 'transparent',
              color: planView===v ? '#fff' : 'var(--text-secondary)',
              boxShadow: planView===v ? '0 0 12px var(--accent-glow)' : 'none',
              fontFamily:"'Inter Tight', sans-serif",
            }}>{label}</button>
          ))}
        </div>

        {/* Navigation */}
        {planView !== 'schedule' && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={()=>nav(-1)} className="btn-ghost" style={{ padding:'6px 8px', borderRadius:7 }}><ChevronLeft size={15}/></button>
            <button onClick={()=>setNavDate(new Date())} className="btn-secondary" style={{ fontSize:11, fontWeight:600, padding:'5px 13px', height:30 }}>Hoy</button>
            <button onClick={()=>nav(1)}  className="btn-ghost" style={{ padding:'6px 8px', borderRadius:7 }}><ChevronRight size={15}/></button>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize', minWidth:200 }}>{navLabel}</span>
          </div>
        )}
      </div>

      {/* â”€â”€ MAIN GRID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display:'flex', flex:1, gap:14, minHeight:0, overflow:'hidden' }}>

        {/* â”€â”€ CALENDAR AREA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden', borderRadius:12, border:'1px solid var(--border-default)',  }}>

          {/* â•”â•â• WEEK VIEW â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•— */}
          {planView === 'week' && (
            <>
              {/* Day header row */}
              <div style={{ display:'grid', gridTemplateColumns:`52px repeat(7,1fr)`, borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
                <div style={{ borderRight:'1px solid var(--border-subtle)' }}/>
                {weekDays.map((d,i) => {
                  const tod = isToday(d);
                  return (
                    <div key={i}
                      onClick={() => { setNavDate(d); setPlanView('day'); }}
                      style={{ padding:'10px 0', textAlign:'center', cursor:'pointer', borderLeft:'1px solid var(--border-subtle)', background:tod?'rgba(225,29,72,0.04)':'transparent', position:'relative', userSelect:'none', transition:'background 200ms' }}
                      onMouseEnter={e=>{ if(!tod)(e.currentTarget as HTMLElement).style.background='var(--bg-hover)'; }}
                      onMouseLeave={e=>{ if(!tod)(e.currentTarget as HTMLElement).style.background='transparent'; }}
                    >
                      {tod && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'var(--accent)', boxShadow:'0 0 8px var(--accent-glow)' }}/>}
                      <div style={{ fontSize:10, fontWeight:600, color:tod?'var(--accent)':'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{DAY_LABELS[i]}</div>
                      <div style={{
                        width:28, height:28, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', marginTop:3,
                        fontSize:13, fontWeight:tod?700:500,
                        background:tod?'var(--accent)':'transparent',
                        color:tod?'#fff':'var(--text-primary)',
                        boxShadow:tod?'0 0 14px var(--accent-glow)':'none',
                        fontFamily:"'Outfit',sans-serif",
                      }}>{format(d,'d')}</div>
                      {/* All-day events */}
                      <AllDayBar events={getAllDayEventsForDate(format(d,'yyyy-MM-dd'))} courses={courses}/>
                    </div>
                  );
                })}
              </div>

              {/* Timed grid */}
              <div style={{ flex:1, overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:`52px repeat(7,1fr)`, minHeight:(H_END-H_START+1)*H_PX }}>
                  {/* Hour labels */}
                  <div style={{ borderRight:'1px solid var(--border-subtle)' }}>
                    {HOURS.map(h => (
                      <div key={h} style={{ height:H_PX, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:8, paddingTop:4, borderBottom:'1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize:9, fontWeight:600, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'0.03em' }}>
                          {String(h).padStart(2,'0')}:00
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((d,di) => {
                    const iso = format(d,'yyyy-MM-dd');
                    const tod = isToday(d);
                    const timedEvs = getTimedEventsForDate(iso);
                    const schedCls = getClassesForDay(di);
                    return (
                      <div key={di} style={{ position:'relative', borderLeft:'1px solid var(--border-subtle)', background:tod?'rgba(225,29,72,0.025)': di>=5?'rgba(0,0,0,0.12)':'transparent' }}>
                        {/* Drop zones */}
                        {HOURS.map(h => {
                          const isOver = dragOver?.dayIdx===di && dragOver?.hour===h;
                          return (
                            <div key={h}
                              onDragOver={e=>{ e.preventDefault(); setDragOver({dayIdx:di,hour:h}); }}
                              onDragLeave={()=>setDragOver(null)}
                              onDrop={()=>handleDrop(di,h)}
                              onClick={()=>{ setModalDefaults({ date:iso, startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setShowEventModal(true); }}
                              style={{ height:H_PX, borderBottom:'1px solid var(--border-subtle)', background:isOver?'rgba(225,29,72,0.09)':'transparent', transition:'background 80ms', cursor:'cell' }}
                            />
                          );
                        })}

                        {/* Schedule (fixed) classes */}
                        {schedCls.map(cls => {
                          const top = (timeToFrac(cls.startTime) - H_START) * H_PX;
                          const h   = (timeToFrac(cls.endTime) - timeToFrac(cls.startTime)) * H_PX - 2;
                          return (
                            <div key={cls.id} title={`${cls.title}\n${cls.startTime} â€“ ${cls.endTime}`} style={{ position:'absolute', top, left:2, right:2, height:h, borderRadius:5, padding:'3px 6px', overflow:'hidden', background:`${cls.color}14`, borderLeft:`3px solid ${cls.color}55`, pointerEvents:'none', zIndex:1, display:'flex', flexDirection:'column', gap:1 }}>
                              <span style={{ fontSize:9, fontWeight:700, color:cls.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.3 }}>{cls.title}</span>
                              {h>30 && <span style={{ fontSize:8, color:'var(--text-muted)' }}>{cls.startTime} â€“ {cls.endTime}{cls.room?` · ${cls.room}`:''}</span>}
                            </div>
                          );
                        })}

                        {/* Calendar events */}
                        {timedEvs.map(ev => {
                          const top = eventTop(ev);
                          const hpx = eventHeight(ev);
                          const c = ev.color;
                          const isEdit = editingEvent?.id === ev.id;
                          return (
                            <div key={ev.id}
                              draggable
                              onDragStart={() => setDraggingEventId(ev.id)}
                              onDragEnd={()=>{ setDraggingEventId(null); setDragOver(null); }}
                              onClick={e=>{ e.stopPropagation(); setEditingEvent(ev); setShowEventModal(true); }}
                              style={{
                                position:'absolute', top, left:5, right:5, height:hpx,
                                borderRadius:7, padding:'4px 8px', overflow:'hidden',
                                background:`linear-gradient(145deg, ${c}28 0%, ${c}14 100%)`,
                                border:`1px solid ${c}${isEdit?'70':'38'}`,
                                borderLeft:`3px solid ${c}`,
                                boxShadow: isEdit?`0 0 14px ${c}40`:'0 1px 6px rgba(0,0,0,0.22)',
                                zIndex: isEdit?5:3, cursor:'grab', display:'flex', flexDirection:'column', gap:1,
                                transition:'box-shadow 180ms, border-color 180ms',
                              }}
                              onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.boxShadow=`0 3px 16px ${c}45`; (e.currentTarget as HTMLElement).style.zIndex='4'; }}
                              onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.boxShadow='0 1px 6px rgba(0,0,0,0.22)'; (e.currentTarget as HTMLElement).style.zIndex='3'; }}
                            >
                              <span style={{ fontSize:10, fontWeight:700, color:c, lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.title}</span>
                              {hpx>32 && <span style={{ fontSize:8, color:'var(--text-muted)', fontWeight:500 }}>{ev.startTime} â€“ {ev.endTime}</span>}
                            </div>
                          );
                        })}

                        {/* Now line */}
                        {tod && nowH>=H_START && nowH<=H_END && (
                          <div style={{ position:'absolute', top:nowPx, left:0, right:0, height:1.5, background:'var(--accent)', zIndex:9, pointerEvents:'none', boxShadow:'0 0 8px var(--accent-glow)' }}>
                            <div style={{ position:'absolute', left:-3, top:-3.5, width:8, height:8, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 10px var(--accent-glow)' }}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* â•”â•â• DAY VIEW â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•— */}
          {planView === 'day' && (
            <>
              <div style={{ padding:'12px 18px 10px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:isToday(navDate)?'var(--accent)':'var(--text-primary)', fontFamily:"'Outfit',sans-serif", textTransform:'capitalize' }}>
                  {format(navDate,"EEEE d 'de' MMMM yyyy",{locale:es as any})}
                  {isToday(navDate) && <span style={{ marginLeft:10, fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-dim)', padding:'2px 9px', borderRadius:20 }}>HOY</span>}
                </div>
                {/* All-day events for day view */}
                <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:5 }}>
                  {getAllDayEventsForDate(format(navDate,'yyyy-MM-dd')).map(ev => (
                    <span key={ev.id} onClick={()=>{ setEditingEvent(ev); setShowEventModal(true); }} style={{ fontSize:10, fontWeight:600, padding:'2px 10px', borderRadius:20, background:`${ev.color}20`, border:`1px solid ${ev.color}45`, color:ev.color, cursor:'pointer' }}>{ev.title}</span>
                  ))}
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'52px 1fr', minHeight:(H_END-H_START+1)*H_PX }}>
                  {/* Labels */}
                  <div style={{ borderRight:'1px solid var(--border-subtle)' }}>
                    {HOURS.map(h=>(
                      <div key={h} style={{ height:H_PX, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:8, paddingTop:4, borderBottom:'1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize:9, fontWeight:600, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace" }}>{String(h).padStart(2,'0')}:00</span>
                      </div>
                    ))}
                  </div>
                  {/* Column */}
                  <div style={{ position:'relative' }}>
                    {HOURS.map(h=>(
                      <div key={h}
                        onClick={()=>{ setModalDefaults({ date:format(navDate,'yyyy-MM-dd'), startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setShowEventModal(true); }}
                        style={{ height:H_PX, borderBottom:'1px solid var(--border-subtle)', cursor:'cell', background:'transparent' }}/>
                    ))}
                    {/* schedule classes */}
                    {getClassesForDay((navDate.getDay()+6)%7).map(cls=>{
                      const top=(timeToFrac(cls.startTime)-H_START)*H_PX, h=(timeToFrac(cls.endTime)-timeToFrac(cls.startTime))*H_PX-2;
                      return <div key={cls.id} style={{ position:'absolute', top, left:8, right:8, height:h, borderRadius:8, padding:'6px 12px', background:`${cls.color}14`, borderLeft:`4px solid ${cls.color}`, zIndex:1, pointerEvents:'none' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:cls.color }}>{cls.title}</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{cls.startTime} â€“ {cls.endTime}{cls.room?` · ${cls.room}`:''}</div>
                        {cls.teacher && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{cls.teacher}</div>}
                      </div>;
                    })}
                    {/* events */}
                    {getTimedEventsForDate(format(navDate,'yyyy-MM-dd')).map(ev=>{
                      const top=eventTop(ev), hpx=eventHeight(ev), c=ev.color;
                      return <div key={ev.id} onClick={e=>{e.stopPropagation();setEditingEvent(ev);setShowEventModal(true);}} style={{ position:'absolute', top, left:12, right:12, height:hpx, borderRadius:9, padding:'7px 12px', background:`linear-gradient(145deg,${c}25,${c}12)`, border:`1px solid ${c}42`, borderLeft:`4px solid ${c}`, zIndex:3, cursor:'pointer', display:'flex', flexDirection:'column', gap:3 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:c }}>{ev.title}</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500 }}>{ev.startTime} â€“ {ev.endTime}</div>
                        {ev.description && <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{ev.description}</div>}
                      </div>;
                    })}
                    {/* now */}
                    {isToday(navDate) && nowH>=H_START && nowH<=H_END && (
                      <div style={{ position:'absolute', top:nowPx, left:0, right:0, height:1.5, background:'var(--accent)', zIndex:9, pointerEvents:'none', boxShadow:'0 0 10px var(--accent-glow)' }}>
                        <div style={{ position:'absolute', left:-3, top:-3.5, width:8, height:8, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 12px var(--accent-glow)' }}/>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* â•”â•â• MONTH VIEW â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•— */}
          {planView === 'month' && (
            <>
              {/* Day headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
                {DAY_LABELS.map(d=><div key={d} style={{ padding:'9px 0', textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{d}</div>)}
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                {weekRows.map((week,wi)=>(
                  <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border-subtle)' }}>
                    {week.map((day,di)=>{
                      const inc=isSameMonth(day,monthStart), tod=isToday(day);
                      const iso=format(day,'yyyy-MM-dd');
                      const dayEvs=[...getAllDayEventsForDate(iso), ...getTimedEventsForDate(iso)];
                      const dayTasks=tasks.filter(t=>t.dueDate&&format(new Date(t.dueDate),'yyyy-MM-dd')===iso&&t.status!=='completado');
                      return (
                        <div key={di}
                          onClick={()=>{ setNavDate(day); setPlanView('day'); }}
                          style={{ minHeight:84, padding:'6px 8px', cursor:'pointer', borderRight:di<6?'1px solid var(--border-subtle)':'none', background:tod?'rgba(225,29,72,0.04)':'transparent', opacity:inc?1:0.28, transition:'background 150ms' }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=tod?'rgba(225,29,72,0.07)':'var(--bg-hover)';}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=tod?'rgba(225,29,72,0.04)':'transparent';}}>
                          <div style={{ width:24,height:24,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:4, fontSize:12,fontWeight:tod?700:500, background:tod?'var(--accent)':'transparent', color:tod?'#fff':'var(--text-primary)', boxShadow:tod?'0 0 12px var(--accent-glow)':'none', fontFamily:"'Outfit',sans-serif" }}>{format(day,'d')}</div>
                          {dayEvs.slice(0,2).map((ev,ei)=><div key={ei} style={{ fontSize:9,padding:'1px 5px',borderRadius:3,marginBottom:2,background:`${ev.color}20`,borderLeft:`2px solid ${ev.color}`,color:ev.color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>{ev.title}</div>)}
                          {dayTasks.slice(0,2).map((t,ti)=><div key={ti} style={{ fontSize:9,padding:'1px 5px',borderRadius:3,marginBottom:2,background:`${t.courseColor}18`,borderLeft:`2px solid ${t.courseColor}`,color:t.courseColor,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>ðŸ“… {t.title}</div>)}
                          {(dayEvs.length+dayTasks.length)>4&&<div style={{ fontSize:8,color:'var(--text-muted)',fontWeight:600 }}>+{dayEvs.length+dayTasks.length-4} más</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* â•”â•â• SCHEDULE VIEW (Horario Base / Cronograma) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•— */}
          {planView === 'schedule' && (
            <ScheduleView
              classes={classes}
              courses={courses}
              onUpdateClasses={setClasses}
              scheduleImageUrl={scheduleImageUrl}
              onSetScheduleImage={setScheduleImageUrl}
              imgInputRef={imgInputRef}
              scheduleTab={scheduleTab}
              onSetScheduleTab={setScheduleTab}
              addNotification={addNotification}
            />
          )}
        </div>

        {/* â”€â”€ RIGHT SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ width:264, flexShrink:0, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>

          {/* Today's Agenda */}
          <div className="bento-card" style={{ padding:'14px 16px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:12, display:'flex', alignItems:'center', gap:5 }}>
              <Clock size={11} style={{ color:'var(--accent)' }}/> Agenda de hoy
            </div>

            {todayEvents.allDay.length > 0 && (
              <div style={{ marginBottom:10 }}>
                {todayEvents.allDay.map(ev=>(
                  <div key={ev.id} onClick={()=>{setEditingEvent(ev);setShowEventModal(true);}} style={{ padding:'5px 10px', borderRadius:7, marginBottom:5, background:`${ev.color}15`, borderLeft:`3px solid ${ev.color}`, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:ev.color }}>{ev.title}</span>
                    <span style={{ fontSize:9, color:'var(--text-muted)', marginLeft:'auto' }}>Todo el día</span>
                  </div>
                ))}
              </div>
            )}

            {todayClasses.length === 0 && todayEvents.timed.length === 0 ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--text-muted)' }}>
                <Calendar size={20} style={{ margin:'0 auto 8px', display:'block', opacity:0.3 }}/>
                <span style={{ fontSize:11 }}>Sin agenda para hoy</span>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {/* Merge schedule classes + timed events, sorted by time */}
                {[
                  ...todayClasses.map(c=>({ id:c.id, title:c.title, start:c.startTime, end:c.endTime, color:c.color, type:'class' as const })),
                  ...todayEvents.timed.map(e=>({ id:e.id, title:e.title, start:e.startTime, end:e.endTime, color:e.color, type:'event' as const, ev:e })),
                ].sort((a,b)=>a.start.localeCompare(b.start)).map(item=>(
                  <div key={item.id}
                    onClick={item.type==='event'?()=>{setEditingEvent(item.ev);setShowEventModal(true);}:undefined}
                    style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'7px 10px', borderRadius:7, background:`${item.color}12`, border:`1px solid ${item.color}22`, cursor:item.type==='event'?'pointer':'default', transition:'background 150ms' }}
                    onMouseEnter={e=>{ if(item.type==='event')(e.currentTarget as HTMLElement).style.background=`${item.color}20`; }}
                    onMouseLeave={e=>{ if(item.type==='event')(e.currentTarget as HTMLElement).style.background=`${item.color}12`; }}>
                    <div style={{ width:3, height:'100%', minHeight:24, borderRadius:2, background:item.color, flexShrink:0, marginTop:2 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:500, marginTop:1 }}>{item.start} â€“ {item.end}</div>
                    </div>
                    {item.type==='class' && <span style={{ fontSize:8, padding:'2px 6px', borderRadius:10, background:`${item.color}20`, color:item.color, fontWeight:700, flexShrink:0 }}>Clase</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming deadlines */}
          <div className="bento-card" style={{ padding:'14px 16px', flex:1, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:12, display:'flex', alignItems:'center', gap:5 }}>
              <GraduationCap size={11} style={{ color:'var(--warning)' }}/> Próximas entregas
            </div>
            {upcomingDeadlines.length === 0 ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--text-muted)' }}>
                <Check size={20} style={{ margin:'0 auto 8px', display:'block', opacity:0.3 }}/>
                <span style={{ fontSize:11 }}>Sin entregas pendientes</span>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {upcomingDeadlines.map(t => {
                  const diff = t.dueDate ? Math.ceil((new Date(t.dueDate+'T00:00:00').getTime() - Date.now()) / 86400000) : 999;
                  const uc   = diff <= 0 ? '#ef4444' : diff === 1 ? '#f97316' : diff <= 3 ? '#f59e0b' : 'var(--text-muted)';
                  const dl   = diff < 0 ? 'Vencida' : diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : `${diff}d`;
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                      <div style={{ width:3, height:'100%', minHeight:30, borderRadius:2, background:t.courseColor, flexShrink:0, marginTop:3 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                          <span style={{ fontSize:9, color:'var(--text-muted)', fontWeight:500 }}>{t.course}</span>
                          {t.dueDate && <span style={{ fontSize:9, color:'var(--text-muted)' }}>· {format(new Date(t.dueDate+'T12:00:00'),'d MMM',{locale:es as any})}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize:9, fontWeight:700, color:uc, padding:'2px 7px', borderRadius:4, background:`${uc === 'var(--text-muted)' ? 'rgba(255,255,255,0.06)' : `${uc}18`}`, flexShrink:0 }}>{dl}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick add event */}
          <button onClick={()=>{ setModalDefaults({ date:todayISO }); setEditingEvent(null); setShowEventModal(true); }}
            className="btn-ghost hover-lift"
            style={{ width:'100%', height:38, borderRadius:9, border:'1px dashed var(--border-strong)', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:12, fontWeight:600, transition:'all 200ms', flexShrink:0 }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor='var(--accent)'; (e.currentTarget as HTMLElement).style.color='var(--accent)'; }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor='var(--border-strong)'; (e.currentTarget as HTMLElement).style.color=''; }}>
            <Plus size={13}/> Agregar evento
          </button>
        </div>
      </div>

      {/* â•â• MODALS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaults={modalDefaults}
          courses={courses}
          tasks={tasks}
          onClose={()=>{ setShowEventModal(false); setEditingEvent(null); }}
          onSave={saveEvent}
          onDelete={id=>{ setDeletingId(id); setShowEventModal(false); }}
          addNotification={addNotification}
        />
      )}
      {deletingId && (
        <ConfirmDeleteModal
          onCancel={()=>setDeletingId(null)}
          onConfirm={()=>deleteEvent(deletingId)}
        />
      )}

      {/* Hidden image input */}
      <input ref={imgInputRef} type="file" accept="image/*" style={{ display:'none' }}
        onChange={e=>{ const f=e.target.files?.[0]; if(f){const url=URL.createObjectURL(f);setScheduleImageUrl(url);} }}/>
    </div>
  );
}

// â•â• All-day bar (mini dots in week header) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AllDayBar({ events, courses }: { events: PlanEvent[]; courses: { id:string; color:string; name:string }[] }) {
  if (!events.length) return <div style={{ minHeight:6 }}/>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:2, padding:'3px 6px', justifyContent:'center' }}>
      {events.slice(0,3).map(ev=>(
        <div key={ev.id} style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:`${ev.color}22`, borderLeft:`2px solid ${ev.color}`, color:ev.color, maxWidth:60, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:600 }}>{ev.title}</div>
      ))}
    </div>
  );
}

// â•â• SCHEDULE VIEW (Horario Base) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ScheduleViewProps {
  classes: ScheduleClass[];
  courses: { id:string; name:string; color:string; teacher?:string }[];
  onUpdateClasses: (c:ScheduleClass[])=>void;
  scheduleImageUrl: string|null;
  onSetScheduleImage: (url:string|null)=>void;
  imgInputRef: React.RefObject<HTMLInputElement|null>;
  scheduleTab: 'image'|'manual';
  onSetScheduleTab: (t:'image'|'manual')=>void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function ScheduleView({ classes, courses, onUpdateClasses, scheduleImageUrl, onSetScheduleImage, imgInputRef, scheduleTab, onSetScheduleTab, addNotification }: ScheduleViewProps) {
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClass, setNewClass] = useState<Partial<ScheduleClass>>({ dayOfWeek:0, startTime:'08:00', endTime:'09:30', color:'#6366f1' });
  const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const SCHED_H_START = 7, SCHED_H_END = 21, SCHED_H_PX = 50;
  const schedHours = Array.from({ length: SCHED_H_END - SCHED_H_START + 1 }, (_,i) => SCHED_H_START+i);

  function addClass() {
    if(!newClass.title?.trim()){addNotification('Escribe el nombre', 'error');return;}
    const course = courses.find(c=>c.id===newClass.courseId);
    const cls: ScheduleClass = {
      id: crypto.randomUUID(),
      title: newClass.title!.trim(),
      courseId: newClass.courseId,
      dayOfWeek: newClass.dayOfWeek??0,
      startTime: newClass.startTime??'08:00',
      endTime: newClass.endTime??'09:30',
      room: newClass.room,
      teacher: newClass.teacher || course?.teacher,
      color: newClass.color || course?.color || '#6366f1',
    };
    onUpdateClasses([...classes, cls]);
    setShowAddClass(false);
    setNewClass({ dayOfWeek:0, startTime:'08:00', endTime:'09:30', color:'#6366f1' });
  }

  function delClass(id: string) {
    onUpdateClasses(classes.filter(c=>c.id!==id));
  }

  // Half-hour slots for select
  const timeOptions: string[] = [];
  for(let h=6;h<=23;h++){ timeOptions.push(`${String(h).padStart(2,'0')}:00`); timeOptions.push(`${String(h).padStart(2,'0')}:30`); }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Tabs */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px 0', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:2, background:'var(--bg-surface)', borderRadius:8, padding:3, border:'1px solid var(--border-default)' }}>
          {([['manual','Cronograma manual'],['image','Imagen de horario']] as ['manual'|'image',string][]).map(([t,l])=>(
            <button key={t} onClick={()=>onSetScheduleTab(t)} style={{ padding:'5px 14px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', transition:'all 180ms', background:scheduleTab===t?'var(--accent)':'transparent', color:scheduleTab===t?'#fff':'var(--text-secondary)', fontFamily:"'Outfit',sans-serif" }}>{l}</button>
          ))}
        </div>
        {scheduleTab==='manual' && (
          <button onClick={()=>setShowAddClass(true)} className="btn-primary" style={{ fontSize:11, fontWeight:600, height:30, padding:'0 14px', display:'flex', alignItems:'center', gap:5 }}>
            <Plus size={12}/> Agregar clase
          </button>
        )}
        {scheduleTab==='image' && (
          <button onClick={()=>imgInputRef.current?.click()} className="btn-secondary" style={{ fontSize:11, height:30, padding:'0 14px', display:'flex', alignItems:'center', gap:5 }}>
            <Image size={12}/> {scheduleImageUrl?'Cambiar imagen':'Subir imagen'}
          </button>
        )}
      </div>

      {/* Image tab */}
      {scheduleTab==='image' && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16 }}>
          {scheduleImageUrl
            ? <div style={{ position:'relative', width:'100%', height:'100%' }}>
                <img src={scheduleImageUrl} alt="Horario" style={{ width:'100%', height:'100%', objectFit:'contain', borderRadius:10 }}/>
                <button onClick={()=>onSetScheduleImage(null)} style={{ position:'absolute', top:8, right:8, padding:'4px 10px', borderRadius:6, border:'none', background:'rgba(239,68,68,0.85)', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}><X size={11}/>Quitar</button>
              </div>
            : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:40, borderRadius:14, border:'2px dashed var(--border-strong)', cursor:'pointer', transition:'border-color 200ms', maxWidth:380 }}
                onClick={()=>imgInputRef.current?.click()}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border-strong)';}}>
                <Image size={40} style={{ color:'var(--text-muted)', opacity:0.5 }}/>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Sube una foto de tu horario</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>PNG, JPG · foto de la pantalla, impresión, captura</div>
                </div>
              </div>
          }
        </div>
      )}

      {/* Manual tab â€” weekly timetable grid */}
      {scheduleTab==='manual' && (
        <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
          {classes.length === 0 && !showAddClass ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, color:'var(--text-muted)', padding:40 }}>
              <GraduationCap size={40} style={{ opacity:0.25 }}/>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Sin horario configurado</div>
                <div style={{ fontSize:12 }}>Agrega tus clases para verlas en el cronograma y en el calendario semanal.</div>
              </div>
              <button onClick={()=>setShowAddClass(true)} className="btn-primary" style={{ fontSize:12, height:36, padding:'0 20px', display:'flex', alignItems:'center', gap:5 }}><Plus size={13}/> Agregar primera clase</button>
            </div>
          ) : (
            <div style={{ minWidth:600 }}>
              {/* Grid */}
              <div style={{ display:'grid', gridTemplateColumns:`52px repeat(5,1fr)` }}>
                {/* Header */}
                <div style={{ borderBottom:'1px solid var(--border-subtle)', borderRight:'1px solid var(--border-subtle)' }}/>
                {[0,1,2,3,4].map(di=>(
                  <div key={di} style={{ padding:'10px 0', textAlign:'center', borderBottom:'1px solid var(--border-subtle)', borderLeft:'1px solid var(--border-subtle)', background: di===((new Date().getDay()+6)%7) ? 'rgba(225,29,72,0.04)':'transparent' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{'LunMarMiéJueVie'.slice(di*3,di*3+3)}</div>
                  </div>
                ))}
                {/* Body */}
                {schedHours.map(h=>(
                  <React.Fragment key={h}>
                    <div style={{ height:SCHED_H_PX, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:6, paddingTop:3, borderBottom:'1px solid var(--border-subtle)', borderRight:'1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize:8, fontWeight:600, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace" }}>{String(h).padStart(2,'0')}:00</span>
                    </div>
                    {[0,1,2,3,4].map(di=>(
                      <div key={di} style={{ height:SCHED_H_PX, borderBottom:'1px solid var(--border-subtle)', borderLeft:'1px solid var(--border-subtle)', position:'relative' }}/>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              {/* Overlay blocks per day */}
              {[0,1,2,3,4].map(di=>{
                const dayClasses=classes.filter(c=>c.dayOfWeek===di);
                // column position: col index di+1, grid col width = (100%-52px)/5
                return dayClasses.map(cls=>{
                  const top=(timeToFrac(cls.startTime)-SCHED_H_START)*SCHED_H_PX;
                  const h=(timeToFrac(cls.endTime)-timeToFrac(cls.startTime))*SCHED_H_PX-2;
                  const colW = `calc((100% - 52px) / 5)`;
                  const colL = `calc(52px + (100% - 52px) / 5 * ${di})`;
                  // offset to header row: 1 row = 34px (header)
                  const HEADER_PX = 37;
                  return (
                    <div key={cls.id} style={{ position:'absolute', top:`calc(${HEADER_PX}px + ${top}px)`, left:colL, width:colW, height:h, borderRadius:6, padding:'4px 8px', background:`${cls.color}22`, border:`1px solid ${cls.color}40`, borderLeft:`3px solid ${cls.color}`, overflow:'hidden', pointerEvents:'all', cursor:'default', zIndex:10 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:4 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:cls.color, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{cls.title}</span>
                        <button onClick={()=>delClass(cls.id)} style={{ padding:2, border:'none', background:'rgba(239,68,68,0.12)', color:'#ef4444', borderRadius:3, cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 }}><X size={9}/></button>
                      </div>
                      {h>30 && <div style={{ fontSize:8, color:'var(--text-muted)', marginTop:1 }}>{cls.startTime} â€“ {cls.endTime}</div>}
                      {h>44 && cls.room && <div style={{ fontSize:8, color:'var(--text-muted)' }}>{cls.room}</div>}
                    </div>
                  );
                });
              })}
            </div>
          )}

          {/* Add class inline form */}
          {showAddClass && (
            <div style={{ margin:'12px 16px', padding:'16px', borderRadius:12, background:'var(--bg-surface)', border:'1px solid var(--border-default)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:14, fontFamily:"'Outfit',sans-serif" }}>Nueva clase</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Nombre *</label>
                  <input autoFocus type="text" placeholder="Ej: Cálculo I" value={newClass.title||''} onChange={e=>setNewClass(p=>({...p,title:e.target.value}))} className="input-base" style={{ width:'100%', fontSize:13, height:38 }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Materia (vinculada)</label>
                  <select value={newClass.courseId||''} onChange={e=>{const c=courses.find(x=>x.id===e.target.value);setNewClass(p=>({...p,courseId:e.target.value||undefined,color:c?.color||p.color}));}} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}>
                    <option value="">Sin vincular</option>
                    {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Día</label>
                  <select value={newClass.dayOfWeek??0} onChange={e=>setNewClass(p=>({...p,dayOfWeek:Number(e.target.value)}))} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}>
                    {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((d,i)=><option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Inicio</label>
                  <select value={newClass.startTime||'08:00'} onChange={e=>setNewClass(p=>({...p,startTime:e.target.value}))} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}>
                    {timeOptions.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Fin</label>
                  <select value={newClass.endTime||'09:30'} onChange={e=>setNewClass(p=>({...p,endTime:e.target.value}))} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}>
                    {timeOptions.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Aula / Sala</label>
                  <input type="text" placeholder="A-201" value={newClass.room||''} onChange={e=>setNewClass(p=>({...p,room:e.target.value}))} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Profesor/a</label>
                  <input type="text" placeholder="Nombre" value={newClass.teacher||''} onChange={e=>setNewClass(p=>({...p,teacher:e.target.value}))} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Color</label>
                  <input type="color" value={newClass.color||'#6366f1'} onChange={e=>setNewClass(p=>({...p,color:e.target.value}))} style={{ width:'100%', height:38, borderRadius:7, border:'1px solid var(--border-default)', cursor:'pointer', background:'transparent' }}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setShowAddClass(false)} className="btn-secondary" style={{ flex:1, height:36, fontSize:12 }}>Cancelar</button>
                <button onClick={addClass} className="btn-primary" style={{ flex:2, height:36, fontSize:12, fontWeight:700 }}>Guardar clase</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â•â• EVENT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface EventModalProps {
  event: PlanEvent | null;
  defaults: Partial<PlanEvent>;
  courses: { id:string; name:string; color:string }[];
  tasks: { id:string; title:string; courseColor:string }[];
  onClose: ()=>void;
  onSave: (ev:PlanEvent)=>void;
  onDelete: (id:string)=>void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function EventModal({ event, defaults, courses, tasks, onClose, onSave, onDelete, addNotification }: EventModalProps) {
  const [title, setTitle]       = useState(event?.title  || defaults.title  || '');
  const [allDay, setAllDay]     = useState(event?.allDay ?? defaults.allDay ?? false);
  const [date, setDate]         = useState(event?.date   || defaults.date   || format(new Date(),'yyyy-MM-dd'));
  const [start, setStart]       = useState(event?.startTime || defaults.startTime || '09:00');
  const [end, setEnd]           = useState(event?.endTime   || defaults.endTime   || '10:00');
  const [courseId, setCourseId] = useState(event?.courseId  || defaults.courseId  || '');
  const [color, setColor]       = useState(event?.color || (defaults.courseId ? courses.find(c=>c.id===defaults.courseId)?.color || '#6366f1' : '#6366f1'));
  const [desc, setDesc]         = useState(event?.description || '');
  const [repeat, setRepeat]     = useState<'none'|'weekly'>(event?.repeat || 'none');
  const [taskId, setTaskId]     = useState(event?.taskId || '');

  // Auto color from course
  useEffect(()=>{ if(courseId){ const c=courses.find(x=>x.id===courseId); if(c) setColor(c.color); } }, [courseId]);

  // Time options
  const timeOptions: string[] = [];
  for(let h=0;h<=23;h++){ timeOptions.push(`${String(h).padStart(2,'0')}:00`); timeOptions.push(`${String(h).padStart(2,'0')}:30`); }

  function save() {
    if(!title.trim()){ addNotification('El título es obligatorio', 'error'); return; }
    const ev: PlanEvent = {
      id: event?.id || crypto.randomUUID(),
      title: title.trim(),
      date, allDay,
      startTime: allDay ? '00:00' : start,
      endTime:   allDay ? '23:59' : end,
      courseId:  courseId || undefined,
      color, description: desc||undefined,
      repeat, taskId: taskId||undefined,
    };
    onSave(ev);
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.72)', backdropFilter:'blur(14px)' }} onClick={onClose}>
      <div className="bento-card" style={{ width:440, maxHeight:'92vh', overflowY:'auto', padding:26, background:'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border:'1px solid var(--border-subtle)' }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:3, height:18, borderRadius:2, background:color }}/>
            <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', fontFamily:"'Outfit',sans-serif" }}>{event?'Editar evento':'Nuevo evento'}</h2>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {event && <button onClick={()=>onDelete(event.id)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}><Trash2 size={11}/>Eliminar</button>}
            <button onClick={onClose} className="btn-ghost" style={{ padding:6, borderRadius:'50%' }}><X size={15}/></button>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Título *</label>
          <input autoFocus type="text" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="Nombre del evento" className="input-base" style={{ width:'100%', fontSize:13, height:40 }}/>
        </div>

        {/* All-day toggle */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <button onClick={()=>setAllDay(p=>!p)} style={{ width:38, height:20, borderRadius:10, border:'none', cursor:'pointer', position:'relative', transition:'background 200ms', background:allDay?'var(--accent)':'var(--bg-surface)', flexShrink:0 }}>
            <div style={{ width:14, height:14, borderRadius:'50%', background:'#fff', position:'absolute', top:3, transition:'left 200ms', left:allDay?21:3, boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
          </button>
          <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>Todo el día</span>
        </div>

        {/* Date */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Fecha</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input-base" style={{ width:'100%', fontSize:13, height:40 }}/>
        </div>

        {/* Start / End time */}
        {!allDay && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Inicio</label>
              <select value={start} onChange={e=>setStart(e.target.value)} className="input-base" style={{ width:'100%', fontSize:13, height:40 }}>
                {timeOptions.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Fin</label>
              <select value={end} onChange={e=>setEnd(e.target.value)} className="input-base" style={{ width:'100%', fontSize:13, height:40 }}>
                {timeOptions.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Course link */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Materia (opcional)</label>
          <select value={courseId} onChange={e=>setCourseId(e.target.value)} className="input-base" style={{ width:'100%', fontSize:13, height:40 }}>
            <option value="">Sin materia</option>
            {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Task link */}
        {tasks.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Vincular tarea (opcional)</label>
            <select value={taskId} onChange={e=>setTaskId(e.target.value)} className="input-base" style={{ width:'100%', fontSize:12, height:38 }}>
              <option value="">Sin tarea</option>
              {tasks.filter(t=>(t as any).status!=='completado').map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        {/* Color + Repeat */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Color</label>
            <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ width:'100%', height:40, borderRadius:8, border:'1px solid var(--border-default)', cursor:'pointer', background:'transparent' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Repetir</label>
            <select value={repeat} onChange={e=>setRepeat(e.target.value as 'none'|'weekly')} className="input-base" style={{ width:'100%', fontSize:12, height:40 }}>
              <option value="none">Sin Repetición</option>
              <option value="weekly">Cada semana</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom:22 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Notas (opcional)</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Descripción, tema, detallesâ€¦" className="input-base" style={{ width:'100%', fontSize:12, resize:'vertical', minHeight:60, padding:'8px 10px' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex:1, height:40, fontSize:13, fontWeight:600 }}>Cancelar</button>
          <button onClick={save} className="btn-primary hover-lift" style={{ flex:2, height:40, fontSize:13, fontWeight:700 }}>
            {event?'Guardar cambios':'Crear evento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// â•â• CONFIRM DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ConfirmDeleteModal({ onCancel, onConfirm }: { onCancel:()=>void; onConfirm:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(10px)' }} onClick={onCancel}>
      <div className="bento-card" style={{ width:300, padding:'26px 26px', textAlign:'center', background:'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border:'1px solid rgba(239,68,68,0.25)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
          <Trash2 size={18} style={{ color:'#ef4444' }}/>
        </div>
        <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:8, fontFamily:"'Outfit',sans-serif" }}>¿Eliminar evento?</div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:22 }}>Esta acción no se puede deshacer.</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} className="btn-secondary" style={{ flex:1, height:36, fontSize:12 }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex:1, height:36, borderRadius:8, border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

