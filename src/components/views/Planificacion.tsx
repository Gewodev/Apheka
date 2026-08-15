/**
 * Planificacion.tsx — Enterprise Academic Planner (v2 Revamp)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FolderOpen, Plus, Minus, Calendar, Clock, X, Trash2, Check, CheckSquare, CheckCircle2, Pencil, BookOpen
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
const REVIEW_LEVEL_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#FBBF24', '#EAB308', '#A3E635', '#84CC16', '#4ADE80', '#22C55E', '#10B981'];

function PlanSelectDropdown({ value, onChange, options, noneLabel, color }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; noneLabel: string; color: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sel = options.find(o => o.id === value);
  const filtered = options.filter(o => !query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { setOpen(false); setQuery(''); };
  return (
    <div tabIndex={-1} style={{ position: 'relative', outline: 'none' }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}>
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{ width: '100%', height: 42, borderRadius: 10, border: `1px solid ${open ? `${color}55` : 'var(--border-subtle)'}`, background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '0 38px 0 13px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 150ms', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sel ? 'var(--text-primary)' : 'var(--text-muted)' }}>{sel ? sel.label : noneLabel}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: open ? color : 'var(--text-muted)', transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="plan-select-popup">
          <div className="psp-search-wrap">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar…" className="psp-search" />
          </div>
          <div className="psp-list no-scrollbar">
            <button type="button" className={`psp-opt${value === '' ? ' sel' : ''}`} onClick={() => { onChange(''); close(); }}
              style={value === '' ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, color, fontWeight: 600 } : undefined}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noneLabel}</span>
              {value === '' && <Check size={12} style={{ color, flexShrink: 0 }} />}
            </button>
            {filtered.map(o => {
              const sel2 = o.id === value;
              return (
                <button key={o.id} type="button" className={`psp-opt${sel2 ? ' sel' : ''}`} onClick={() => { onChange(o.id); close(); }} title={o.label}
                  style={sel2 ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, color, fontWeight: 600 } : undefined}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {sel2 && <Check size={12} style={{ color, flexShrink: 0 }} />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <span className="psp-empty">Sin resultados</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const { tasks, courses, setNavigateTo, addNotification, settings, studySessions, plannedSessions, addPlannedSession, updatePlannedSession, deletePlannedSession, focusedEventId, setFocusedEventId,
    planEvents, setPlanEvents, planSyncTick, planSyncImports, syncPlanEventToGoogle, deletePlanEventFromGoogle,
    googleConnected, calendarSyncEnabled } = useApp();

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
  const [occurrenceDate, setOccurrenceDate]   = useState<string | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // Plan session modal (study blocks)
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planEditId, setPlanEditId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState('');
  const [planStartTime, setPlanStartTime] = useState('09:00');
  const [planTitle, setPlanTitle] = useState('');
  const [planCourseId, setPlanCourseId] = useState('');
  const [planGroupId, setPlanGroupId] = useState('');
  const [planTopicId, setPlanTopicId] = useState('');
  const [planType, setPlanType] = useState('estudio');
  const [planDuration, setPlanDuration] = useState(30);
  const [planIntensity, setPlanIntensity] = useState(5);
  const [planTimeEdit, setPlanTimeEdit] = useState<'h' | 'm' | null>(null);
  const [planTimeEditVal, setPlanTimeEditVal] = useState('');
  const [planOccurrenceDate, setPlanOccurrenceDate] = useState<string | null>(null);
  const [planScope, setPlanScope] = useState<'all' | 'one'>('all');
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  const parsePlanTime = (t: string) => {
    const [h, m] = (t || '09:00').split(':').map(Number);
    return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
  };
  const shiftPlanTime = (unit: 'h' | 'm', dir: number) => {
    const { h, m } = parsePlanTime(planStartTime);
    const nh = unit === 'h' ? (h + dir + 24) % 24 : h;
    const nm = unit === 'm' ? (m + dir * 5 + 60) % 60 : m;
    setPlanStartTime(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
  };
  const commitPlanTimeEdit = (unit: 'h' | 'm') => {
    setPlanTimeEdit(null);
    const raw = planTimeEditVal.trim();
    if (!/^\d{1,2}$/.test(raw)) return;
    const n = parseInt(raw, 10);
    const { h, m } = parsePlanTime(planStartTime);
    if (unit === 'h' && n <= 23) setPlanStartTime(`${String(n).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    if (unit === 'm' && n <= 59) setPlanStartTime(`${String(h).padStart(2, '0')}:${String(n).padStart(2, '0')}`);
  };

  const allCourseGroups = useMemo(() => (courses || []).flatMap(c => (c.groups || []).map(g => ({ ...g, courseId: c.id }))), [courses]);
  const allCourseTopics = useMemo(() => (courses || []).flatMap(c => (c.studyTopics || []).map(t => ({ ...t, courseId: c.id }))), [courses]);

  const openNewPlanSession = (date?: string) => {
    setPlanEditId(null);
    const fallbackDate = (() => {
      if (date) return date;
      // Sin fecha explícita: HOY si cae dentro de la semana visible (semana/día);
      // si el usuario navegó a otra semana, el día visible actual. Así la sesión
      // nueva SIEMPRE cae en una fecha que la vista actual muestra.
      if (planView === 'week' || planView === 'day') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const ws = startOfWeek(navDate, { weekStartsOn: 1 });
        const we = addDays(ws, 6);
        if (todayStr >= format(ws, 'yyyy-MM-dd') && todayStr <= format(we, 'yyyy-MM-dd')) return todayStr;
        return format(navDate, 'yyyy-MM-dd');
      }
      return format(new Date(), 'yyyy-MM-dd');
    })();
    setPlanDate(fallbackDate);
    setPlanStartTime('09:00');
    setPlanTitle('');
    setPlanCourseId('');
    setPlanGroupId('');
    setPlanTopicId('');
    setPlanType('estudio');
    setPlanDuration(30);
    setPlanIntensity(5);
    setPlanTimeEdit(null);
    setPlanOccurrenceDate(null);
    setPlanScope('all');
    setConfirmDeleteSession(false);
    setShowPlanModal(true);
  };

  const openEditPlanSession = (ps: { id: string; date: string; startTime?: string; title: string; courseId: string; type: string; durationMinutes: number; intensity?: number; repeat?: 'none' | 'daily' | 'weekly' | 'custom_days'; repeatDays?: number[]; repeatUntil?: string; groupId?: string; topicId?: string }) => {
    setPlanEditId(ps.id);
    setPlanDate(ps.date);
    setPlanStartTime(ps.startTime || '09:00');
    setPlanTitle(ps.title || '');
    setPlanCourseId(ps.courseId || '');
    setPlanGroupId(ps.groupId || '');
    setPlanTopicId(ps.topicId || '');
    setPlanType(ps.type || 'estudio');
    setPlanDuration(ps.durationMinutes || 30);
    setPlanIntensity(ps.intensity || 5);
    setPlanTimeEdit(null);
    setPlanScope('all');
    setConfirmDeleteSession(false);
    setShowPlanModal(true);
  };

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

  // Registra los eventos del planificador en el contexto para el sync con Google Calendar
  useEffect(() => {
    setPlanEvents(events.map(e => ({
      id: e.id, title: e.title, description: e.description || '', date: e.date,
      startTime: e.startTime || '', endTime: e.endTime || '', allDay: !!e.allDay,
      color: e.color || 'var(--accent)', googleEventId: e.googleEventId,
    })));
  }, [events, setPlanEvents]);

  // Aplica resultados del sync: googleEventIds nuevos + eventos creados en Google
  useEffect(() => {
    if (planSyncTick === 0) return;
    setEvents(prev => {
      let changed = false;
      const bridgeIds = new Map(planEvents.map(p => [p.id, p.googleEventId]));
      let next = prev.map(e => {
        const gid = bridgeIds.get(e.id);
        if (gid && !e.googleEventId) { changed = true; return { ...e, googleEventId: gid }; }
        return e;
      });
      const known = new Set(next.map(e => e.googleEventId).filter(Boolean) as string[]);
      const toAdd = planSyncImports.filter(imp => !!imp.googleEventId && !known.has(imp.googleEventId));
      if (toAdd.length) {
        changed = true;
        next = [...next, ...toAdd.map(imp => ({
          id: imp.id, title: imp.title, date: imp.date, allDay: !!imp.allDay,
          startTime: imp.startTime, endTime: imp.endTime, color: imp.color,
          description: imp.description, googleEventId: imp.googleEventId,
          repeat: 'none' as const, attachments: [],
        }))];
      }
      return changed ? next : prev;
    });
  }, [planSyncTick, planEvents, planSyncImports]);

  useEffect(() => {
    if (!focusedEventId || events.length === 0) return;
    const ev = events.find(e => e.id === focusedEventId);
    if (ev) {
      setSelectedItem({ type: 'event', event: ev });
    }
    setFocusedEventId(null);
  }, [focusedEventId, events]);
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
      // Excluded occurrence (edited as "only this event")
      if (e.exceptions && e.exceptions.includes(iso)) return false;
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
    }).map(e => {
      const ov = e.occurrenceOverrides?.[iso];
      return ov ? { ...e, ...ov } : e;
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
    return (plannedSessions || []).filter(s => {
      if (s.exceptions && s.exceptions.includes(iso)) return false;
      if (s.repeatUntil && isBefore(new Date(s.repeatUntil + 'T23:59:59'), new Date(iso + 'T00:00:00'))) return false;
      if (s.date === iso) return true;
      if (s.repeat === 'daily') return !isBefore(new Date(iso + 'T12:00:00'), new Date(s.date + 'T12:00:00'));
      if (s.repeat === 'weekly') {
        const orig = new Date(s.date + 'T12:00:00');
        const tgt = new Date(iso + 'T12:00:00');
        return orig.getDay() === tgt.getDay() && !isBefore(tgt, orig);
      }
      if (s.repeat === 'custom_days' && s.repeatDays) {
        const orig = new Date(s.date + 'T12:00:00');
        const tgt = new Date(iso + 'T12:00:00');
        const mappedDay = (tgt.getDay() + 6) % 7;
        return s.repeatDays.includes(mappedDay) && !isBefore(tgt, orig);
      }
      return false;
    });
  }

  /* Distribuye bloques de tiempo (sesiones registradas + planificadas) en
     carriles SIN superposición: dos bloques que se pisan en el horario se
     muestran lado a lado en vez de apilarse uno encima del otro. Se agrupan
     por componentes conexas de solape para que un bloque aislado conserve su
     ancho completo. */
  function layoutTimeLanes<T extends { id: string; start: number; end: number }>(blocks: T[]): Map<string, { col: number; cols: number }> {
    const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
    const res = new Map<string, { col: number; cols: number }>();
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      let gEnd = sorted[i].end;
      while (j + 1 < sorted.length && sorted[j + 1].start < gEnd) {
        j++;
        gEnd = Math.max(gEnd, sorted[j].end);
      }
      const colEnd: number[] = [];
      let maxCols = 1;
      for (let k = i; k <= j; k++) {
        const b = sorted[k];
        let c = 0;
        while (colEnd[c] !== undefined && colEnd[c] > b.start) c++;
        colEnd[c] = b.end;
        maxCols = Math.max(maxCols, c + 1);
        res.set(b.id, { col: c, cols: 0 });
      }
      for (let k = i; k <= j; k++) {
        const a = res.get(sorted[k].id);
        if (a) res.set(sorted[k].id, { ...a, cols: maxCols });
      }
      i = j + 1;
    }
    return res;
  }

  const isOld = (dateStr: string) => {
    const diff = (new Date().getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000;
    return diff > 4;
  };

  const studyBlock = (s: { id: string; type: string; startedAt: string; duration: number; title?: string; taskId?: string; courseId?: string; plannedSessionId?: string }) => {
    const linkedPlan = s.plannedSessionId ? (plannedSessions || []).find(p => p.id === s.plannedSessionId) : null;
    const linkedTask = s.taskId ? tasks.find(t => t.id === s.taskId) : null;
    const linkedCourse = s.courseId ? courses.find(c => c.id === s.courseId) : null;
    const fallback = s.type === 'pomodoro' ? 'Pomodoro' : 'Cronómetro';
    let color: string;
    let label: string;
    if (linkedPlan) {
      const psInt = Math.max(0, Math.min(10, linkedPlan.intensity || 0));
      color = psInt > 0 ? REVIEW_LEVEL_COLORS[psInt - 1] : '#9CA3AF';
      label = linkedPlan.title || fallback;
    } else if (linkedTask) {
      color = linkedTask.courseColor || '#9CA3AF';
      label = linkedTask.title;
    } else if (linkedCourse) {
      color = linkedCourse.color || '#9CA3AF';
      label = linkedCourse.name;
    } else {
      color = '#9CA3AF';
      label = s.title || fallback;
    }
    return { color, label, mins: Math.round(s.duration / 60), isPlan: !!linkedPlan };
  };

  function saveOnePlanSession(originalId: string, occurrenceDate: string) {
    const original = (plannedSessions || []).find(s => s.id === originalId);
    if (!original) return;
    updatePlannedSession(original.id, { exceptions: [...(original.exceptions || []), occurrenceDate] });
    const payload = {
      courseId: planCourseId || '', date: occurrenceDate, startTime: planStartTime || undefined,
      title: planTitle.trim(), groupId: planGroupId || undefined, topicId: planTopicId || undefined,
      durationMinutes: planDuration, type: planType, intensity: planIntensity, completed: false,
      repeat: 'none' as const, repeatDays: undefined, repeatUntil: undefined,
    };
    addPlannedSession(payload);
  }

  function deleteEvent(id: string) {
    const target = events.find(e => e.id === id);
    setEvents(p => p.filter(e => e.id !== id));
    setEditingEvent(null);
    setShowEventModal(false);
    setSelectedItem(null);
    if (googleConnected && target?.googleEventId) {
      void deletePlanEventFromGoogle(target.googleEventId);
    }
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
    if (googleConnected && calendarSyncEnabled) {
      void syncPlanEventToGoogle({ ...ev, description: ev.description || '' }).then(gid => {
        if (gid && gid !== ev.googleEventId) {
          setEvents(p => p.map(e => e.id === ev.id ? { ...e, googleEventId: gid } : e));
        }
      });
    }
  }

  function saveOneEvent(override: Partial<PlanEvent>, originalId: string, occDate: string) {
    const baseEvent = events.find(x => x.id === originalId);
    const movedTo = override.date && override.date !== occDate ? override.date : null;
    setEvents(p => p.map(e => {
      if (e.id !== originalId) return e;
      const overrides = { ...(e.occurrenceOverrides || {}) };
      const merged = { ...(overrides[occDate] || {}), ...override };
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(merged)) {
        if (JSON.stringify(v) !== JSON.stringify((e as unknown as Record<string, unknown>)[k])) clean[k] = v;
      }
      if (Object.keys(clean).length) overrides[occDate] = clean as Partial<PlanEvent>;
      else delete overrides[occDate];
      const exceptions = movedTo && !(e.exceptions || []).includes(occDate) ? [...(e.exceptions || []), occDate] : e.exceptions;
      return { ...e, exceptions, occurrenceOverrides: Object.keys(overrides).length ? overrides : undefined };
    }));
    setShowEventModal(false);
    setEditingEvent(null);
    setSelectedItem(null);
    if (googleConnected && calendarSyncEnabled && movedTo && baseEvent?.googleEventId) {
      void syncPlanEventToGoogle({ ...baseEvent, description: baseEvent.description || '' });
    }
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
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: (showScheduleBuilder || showHabits) ? 'var(--bg-secondary)' : 'var(--surface-elevated)', border: '1px solid var(--border-soft)', opacity: (showScheduleBuilder || showHabits) ? 0.4 : 1, pointerEvents: (showScheduleBuilder || showHabits) ? 'none' : 'auto', transition: 'opacity 200ms' }}>
            {(['week', 'day', 'month', 'year'] as PlanView[]).map(v => (
              <button key={v} onClick={() => setPlanView(v)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 200ms', background: planView === v ? 'var(--accent)' : 'transparent', color: planView === v ? '#fff' : 'var(--text-secondary)', fontFamily: "'Outfit',sans-serif" }}>
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {!showScheduleBuilder && !showHabits && (
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
            onClick={() => { setModalDefaults({ date: format(new Date(), 'yyyy-MM-dd') }); setEditingEvent(null); setOccurrenceDate(null); setShowEventModal(true); }}
            style={{
              display:'flex', alignItems:'center', gap:7,
              height:38, borderRadius:10, padding:'0 20px',
              fontSize:11, fontWeight:600, fontFamily:"'Inter Tight',sans-serif", letterSpacing:'0.02em',
              border:'none', cursor:'pointer',
              background:'var(--accent)', color:'#fff',
              boxShadow:'0 4px 15px var(--accent-dim)',
              transition:'all 200ms',
            }}
            onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.15)'}
            onMouseLeave={e=>e.currentTarget.style.filter='none'}
          >
            <Plus size={15} strokeWidth={2.2}/> Nuevo Evento
          </button>
          <button
            onClick={() => openNewPlanSession()}
            style={{
              display:'flex', alignItems:'center', gap:7,
              height:38, borderRadius:10, padding:'0 20px',
              fontSize:11, fontWeight:600, fontFamily:"'Inter Tight',sans-serif", letterSpacing:'0.02em',
              border:'none', cursor:'pointer',
              background:'var(--accent)', color:'#fff',
              boxShadow:'0 4px 15px var(--accent-dim)',
              transition:'all 200ms',
            }}
            onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.15)'}
            onMouseLeave={e=>e.currentTarget.style.filter='none'}
          >
            <Clock size={15} strokeWidth={2.2}/> Nueva sesión
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
                      onClick={() => { const dIso = format(d, 'yyyy-MM-dd'); const dEvs = getEventsForDate(dIso); const dLinkedIds = new Set(dEvs.map(ev => (ev as PlanEvent).taskId).filter(Boolean)); setSelectedItem({ type: 'day', date: d, events: dEvs, tasks: tasks.filter(t => { if (!t.dueDate || t.status === 'completado') return false; if (dLinkedIds.has(t.id)) return false; return (t.dueDate || '').slice(0, 10) === dIso; }) }); }}
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
                                  onClick={()=>{ setModalDefaults({ date:iso, startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setOccurrenceDate(null); setShowEventModal(true); }}
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
                                  onClick={e => { e.stopPropagation(); setOccurrenceDate(iso); setSelectedItem({ type: 'event', event: item as PlanEvent }); }}
                                  style={{
                                    position:'absolute', top, left: `${pos.left}%`, width: `${pos.width}%`, height: hpx,
                                    borderLeft: `3px solid ${itemColor}`,
                                    borderRadius: '4px',
                                    background: `color-mix(in srgb, ${itemColor} 12%, var(--bg-base))`,
                                    boxShadow: `inset 0 1px 0 ${itemColor}10, 0 2px 8px rgba(0,0,0,0.08)`,
                                    zIndex: 3, cursor: isDragging ? 'grabbing' : 'pointer', display:'flex', flexDirection:'column', padding: hpx <= 30 ? '3px 8px' : '6px 10px', overflow: 'hidden',
                                    opacity: isDragging ? 0.4 : 1,
                                    transition: 'opacity 150ms',
                                  }}
                                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow = `inset 0 1px 0 ${itemColor}20, 0 6px 20px rgba(0,0,0,0.25)`; e.currentTarget.style.zIndex='4'; }}
                                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow = `inset 0 1px 0 ${itemColor}10, 0 2px 8px rgba(0,0,0,0.08)`; e.currentTarget.style.zIndex='3'; }}
                                  >
                                  {hpx <= 62 ? (
                                    <div title={item.title} style={{ display:'flex', flexDirection:'column', justifyContent:'center', minWidth:0, height:'100%' }}>
                                      <span style={{ fontSize: hpx <= 30 ? 10 : 11, fontWeight:600, color:itemColor, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                                      {hpx > 30 && pos.width > 40 && (
                                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, fontWeight:700, color:'var(--text-muted)', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</span>
                                      )}
                                    </div>
                                  ) : (
                                  <>
                                  <span title={item.title} style={{ flexShrink:0, fontSize: hpx <= 40 ? 10 : 11, fontWeight: 600, color: itemColor, lineHeight: 1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                                  {hpx > 40 && pos.width > 35 && (item as PlanEvent).taskId && (() => { const lt = tasks.find(t => t.id === (item as PlanEvent).taskId); return lt ? (
                                    <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
                                      <CheckCircle2 size={9} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                                      <span style={{ fontSize:9, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lt.title}</span>
                                    </div>
                                  ) : null; })()}
                                  <div title={fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)} style={{ display: 'flex', alignItems:'center', gap:4, marginTop: hpx <= 40 ? 1 : 2, flexShrink:0 }}>
                                    <Clock size={9} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                                    <span style={{ fontSize: hpx <= 40 ? 9 : 10, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</span>
                                  </div>
                                  </>
                                  )}
                                </div>
                              )}
                            </DraggablePlanEvent>
                          );
                        })}
                        {(() => {
                          const dayStudy = getStudySessionsForDate(iso).filter(s => isValidDateStr(s.startedAt)).map(s => {
                            const stD = new Date(s.startedAt);
                            const stH = stD.getHours() + stD.getMinutes() / 60 + stD.getSeconds() / 3600;
                            return { id: s.id, kind: 'study' as const, start: stH, end: stH + s.duration / 3600, sTop: (stH - H_START) * H_PX, sH: Math.max((s.duration / 3600) * H_PX, 26), s };
                          });
                          const dayPlanned = getPlannedSessionsForDate(iso).filter(ps => !!ps.startTime && !dayStudy.some(x => x.s.plannedSessionId === ps.id)).map(ps => {
                            const [sh, sm] = (ps.startTime as string).split(':').map(Number);
                            const stH = sh + sm / 60;
                            const sH = Math.max((ps.durationMinutes / 60) * H_PX, 22);
                            const sTop = (stH - H_START) * H_PX;
                            if (sTop < -sH) return null;
                            return { id: `planned-${ps.id}`, kind: 'planned' as const, start: stH, end: stH + ps.durationMinutes / 60, sTop, sH, ps };
                          }).filter((x): x is NonNullable<typeof x> => !!x);
                          const lanes = layoutTimeLanes([...dayStudy, ...dayPlanned]);
                          return (
                            <>
                              {dayStudy.map(x => {
                                const b = studyBlock(x.s);
                                const ln = lanes.get(x.id) || { col: 0, cols: 1 };
                                const wPct = 96 / ln.cols;
                                return (
                                  <div key={x.id} title={`${b.label} — ${b.mins} min registrados${b.isPlan ? ' · sesión planificada' : ''}`}
                                    style={{
                                      position:'absolute', top: x.sTop, left: `${2 + ln.col * wPct}%`, width: `${wPct}%`, height: x.sH,
                                      borderRadius: 6, zIndex: 1, pointerEvents: 'none',
                                      background: `linear-gradient(135deg, ${b.color}1c, ${b.color}06)`,
                                      borderLeft: `3px ${b.isPlan ? 'dashed' : 'solid'} ${b.color}99`,
                                      boxShadow: b.isPlan ? `inset 0 0 0 1px ${b.color}33, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                      display:'flex', flexDirection:'column', justifyContent:'center', padding: '4px 9px 4px 10px', overflow: 'hidden',
                                    }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: b.color, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'Inter Tight',sans-serif", lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {b.label}
                                    </span>
                                    {x.sH > 30 && (
                                      <span style={{ fontSize: 8.5, fontWeight: 600, color: b.color, opacity: 0.75, fontFamily: "'JetBrains Mono',monospace", marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {b.isPlan && (
                                          <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.08em', padding: '1px 4px', borderRadius: 4, border: `1px solid ${b.color}55`, color: b.color, opacity: 1, lineHeight: 1 }}>SESIÓN</span>
                                        )}
                                        <Check size={8} strokeWidth={3} style={{ flexShrink: 0 }} /> {b.mins} min registrados
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {dayPlanned.map(x => {
                                const ps = x.ps;
                                const ln = lanes.get(x.id) || { col: 0, cols: 1 };
                                const wPct = 96 / ln.cols;
                                const courseInfo = courses.find(c => c.id === ps.courseId);
                                const pCol = courseInfo?.color || '#9CA3AF';
                                const psInt = Math.max(0, Math.min(10, ps.intensity || 0));
                                const done = !!ps.completed;
                                const [sh, sm] = (ps.startTime as string).split(':').map(Number);
                                return (
                                  <div key={`planned-${ps.id}`} title={`${ps.title || 'Sesión'} — ${ps.durationMinutes}m · intensidad ${psInt}/10${done ? ' · completada' : ''}`}
                                    onClick={e => { e.stopPropagation(); setPlanOccurrenceDate(iso); setSelectedItem({ type: 'plansession', session: ps }); }}
                                    style={{
                                      position:'absolute', top: x.sTop, left: `${2 + ln.col * wPct}%`, width: `${wPct}%`, height: x.sH,
                                      borderRadius: 6, zIndex: 2, cursor: 'pointer',
                                      background: `linear-gradient(135deg, ${pCol}16, ${pCol}05)`,
                                      borderLeft: `3px solid ${pCol}66`,
                                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '5px 9px',
                                      transition: 'all 150ms', opacity: done ? 0.72 : 1,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${pCol}22, ${pCol}0a)`; e.currentTarget.style.boxShadow = `0 4px 14px ${pCol}33`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${pCol}16, ${pCol}05)`; e.currentTarget.style.boxShadow = 'none'; }}
                                  >
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: pCol, fontFamily: "'Inter', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                      {done && <span style={{ color: '#10B981', fontWeight: 800, marginRight: 4 }}>✓</span>}
                                      {ps.title || 'Sesión de estudio'}
                                    </span>
                                    {x.sH > 30 && (
                                      <span style={{ fontSize: 8.5, fontWeight: 500, color: pCol, opacity: 0.75, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', marginTop: 1 }}>
                                        {fmtTimeRange(ps.startTime!, (() => { const m = Math.round(sh * 60 + sm + ps.durationMinutes); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; })(), settings?.timeFormat)} · {ps.durationMinutes}m
                                      </span>
                                    )}
                                    {x.sH > 44 && (
                                      <div style={{ display: 'flex', gap: 1.5, marginTop: 'auto', width: '100%', paddingTop: 2 }}>
                                        {REVIEW_LEVEL_COLORS.map((col, i) => (
                                          <div key={i} style={{ flex: 1, height: 4, borderRadius: 1, background: i < psInt ? col : 'var(--bg-deep)', opacity: i < psInt ? 0.9 : 0.5, boxShadow: i === psInt - 1 ? `0 0 6px ${col}88` : 'none' }} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
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
                    <span key={ev.id} onClick={()=>{ setOccurrenceDate(format(navDate,'yyyy-MM-dd')); setSelectedItem({ type: 'event', event: ev }); }} style={{ fontSize:12, fontWeight:600, padding:'6px 16px', borderRadius:10, background:`${ev.color}15`, border:`1px solid ${ev.color}30`, color:ev.color, cursor:'pointer' }}>{ev.title}</span>
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
                        onClick={()=>{ setModalDefaults({ date:format(navDate,'yyyy-MM-dd'), startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setOccurrenceDate(null); setShowEventModal(true); }}
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
                          <div key={item.id} onClick={e=>{e.stopPropagation(); if (!isClass) { setOccurrenceDate(format(navDate,'yyyy-MM-dd')); setSelectedItem({ type: 'event', event: item as PlanEvent }); }}} 
                            style={{ 
                              position:'absolute', top, left:`${pos.left}%`, width:`${pos.width}%`, height:hpx, 
                              borderLeft: isClass ? 'none' : `3px solid ${item.color}`,
                              background: isClass ? `color-mix(in srgb, ${item.color} 3%, transparent)` : `color-mix(in srgb, ${item.color} 18%, var(--bg-base))`, 
                              zIndex: isClass ? 0 : 3, cursor: isClass ? 'default' : 'pointer', display:'flex', flexDirection:'column', padding: isClass ? '4px 10px' : (hpx <= 34 ? '3px 10px' : '12px 16px'), overflow:'hidden',
                              opacity: isClass ? 0.5 : 1,
                              pointerEvents: isClass ? 'none' : 'auto',
                              borderRight: isClass ? 'none' : '1px solid var(--border-soft)', borderTop: isClass ? 'none' : '1px solid var(--border-soft)', borderBottom: isClass ? 'none' : '1px solid var(--border-soft)',
                              transition: 'filter 150ms'
                            }}
                            onMouseEnter={e => !isClass && (e.currentTarget.style.filter = 'brightness(1.2)')}
                            onMouseLeave={e => !isClass && (e.currentTarget.style.filter = 'none')}
                          >
                             {!isClass && hpx <= 62 ? (
                               <div title={item.title} style={{ display:'flex', flexDirection:'column', justifyContent:'center', minWidth:0, height:'100%' }}>
                                 <span style={{ fontSize: hpx <= 30 ? 11 : 12, fontWeight:600, color:item.color, lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                                 {hpx > 30 && pos.width > 40 && (
                                   <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, fontWeight:700, color:'var(--text-muted)', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</span>
                                 )}
                               </div>
                             ) : (
                             <>
                             <div title={item.title} style={{ fontSize: isClass ? 11 : (hpx <= 34 ? 13 : 15), fontWeight: isClass ? 500 : 600, color: isClass ? 'var(--text-muted)' : item.color, lineHeight: 1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flexShrink:0 }}>{item.title}</div>
                             {!isClass && <div title={fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)} style={{ fontSize: hpx <= 34 ? 11 : 12, color:'var(--text-muted)', marginTop: hpx <= 34 ? 1 : 4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flexShrink:0 }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</div>}
                             {!isClass && hpx > 40 && (item as PlanEvent).taskId && (() => { const lt = tasks.find(t => t.id === (item as PlanEvent).taskId); return lt ? (
                               <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, padding:'4px 8px', borderRadius:6, background:`${lt.courseColor||'var(--text-muted)'}10`, borderLeft:`2px solid ${lt.courseColor||'var(--text-muted)'}` }}>
                                 <CheckCircle2 size={10} style={{ color: lt.courseColor||'var(--text-muted)', flexShrink:0 }} />
                                 <span style={{ fontSize:11, color: lt.courseColor||'var(--text-secondary)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lt.title}</span>
                               </div>
                             ) : null; })()}
                             {!isClass && (item as PlanEvent).description && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:8, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{(item as PlanEvent).description}</div>}
                             </>
                             )}
                          </div>
                        );
                      });
                    })()}
                    {(() => {
                      const isoD = format(navDate, 'yyyy-MM-dd');
                      const dayStudy = getStudySessionsForDate(isoD).filter(s => isValidDateStr(s.startedAt)).map(s => {
                        const stD = new Date(s.startedAt);
                        const stH = stD.getHours() + stD.getMinutes() / 60 + stD.getSeconds() / 3600;
                        return { id: s.id, kind: 'study' as const, start: stH, end: stH + s.duration / 3600, sTop: (stH - H_START) * H_PX, sH: Math.max((s.duration / 3600) * H_PX, 28), s };
                      });
                      const dayPlanned = getPlannedSessionsForDate(isoD).filter(ps => !!ps.startTime && !dayStudy.some(x => x.s.plannedSessionId === ps.id)).map(ps => {
                        const [sh, sm] = (ps.startTime as string).split(':').map(Number);
                        const stH = sh + sm / 60;
                        const sH = Math.max((ps.durationMinutes / 60) * H_PX, 22);
                        const sTop = (stH - H_START) * H_PX;
                        if (sTop < -sH) return null;
                        return { id: `planned-${ps.id}`, kind: 'planned' as const, start: stH, end: stH + ps.durationMinutes / 60, sTop, sH, ps };
                      }).filter((x): x is NonNullable<typeof x> => !!x);
                      const lanes = layoutTimeLanes([...dayStudy, ...dayPlanned]);
                      return (
                        <>
                      {dayStudy.map(x => {
                        const b = studyBlock(x.s);
                        const ln = lanes.get(x.id) || { col: 0, cols: 1 };
                        const wPct = 95 / ln.cols;
                        return (
                          <div key={x.id} title={`${b.label} — ${b.mins} min registrados${b.isPlan ? ' · sesión planificada' : ''}`}
                            style={{
                              position:'absolute', top: x.sTop, left: `${2.5 + ln.col * wPct}%`, width: `${wPct}%`, height: x.sH,
                              borderRadius: 6, zIndex: 1, pointerEvents: 'none',
                              background: `linear-gradient(135deg, ${b.color}1c, ${b.color}06)`,
                              borderLeft: `3px ${b.isPlan ? 'dashed' : 'solid'} ${b.color}99`,
                              boxShadow: b.isPlan ? `inset 0 0 0 1px ${b.color}33, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                              display:'flex', flexDirection:'column', justifyContent:'center', padding: '5px 11px', overflow:'hidden',
                            }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: b.color, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'Inter Tight',sans-serif", lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.label}
                            </span>
                            {x.sH > 32 && (
                              <span style={{ fontSize: 9.5, fontWeight: 600, color: b.color, opacity: 0.75, fontFamily: "'JetBrains Mono',monospace", marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {b.isPlan && (
                                  <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', padding: '1px 5px', borderRadius: 4, border: `1px solid ${b.color}55`, color: b.color, opacity: 1, lineHeight: 1 }}>SESIÓN</span>
                                )}
                                <Check size={9} strokeWidth={3} style={{ flexShrink: 0 }} /> {b.mins} min registrados
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {dayPlanned.map(x => {
                        const ps = x.ps;
                        const ln = lanes.get(x.id) || { col: 0, cols: 1 };
                        const wPct = 95 / ln.cols;
                        const courseInfo = courses.find(c => c.id === ps.courseId);
                        const pCol = courseInfo?.color || '#9CA3AF';
                        const psInt = Math.max(0, Math.min(10, ps.intensity || 0));
                        const done = !!ps.completed;
                        const [sh, sm] = (ps.startTime as string).split(':').map(Number);
                        return (
                          <div key={`planned-${ps.id}`} title={`${ps.title || 'Sesión'} — ${ps.durationMinutes}m · intensidad ${psInt}/10${done ? ' · completada' : ''}`}
                            onClick={e => { e.stopPropagation(); setPlanOccurrenceDate(isoD); setSelectedItem({ type: 'plansession', session: ps }); }}
                            style={{
                              position:'absolute', top: x.sTop, left: `${2.5 + ln.col * wPct}%`, width: `${wPct}%`, height: x.sH,
                              borderRadius: 6, zIndex: 2, cursor: 'pointer',
                              background: `linear-gradient(135deg, ${pCol}18, ${pCol}06)`,
                              borderLeft: `3px solid ${pCol}66`,
                              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 11px',
                              transition: 'all 150ms', opacity: done ? 0.72 : 1,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${pCol}26, ${pCol}0c)`; e.currentTarget.style.boxShadow = `0 4px 14px ${pCol}33`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${pCol}18, ${pCol}06)`; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: pCol, fontFamily: "'Inter',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                              {done && <span style={{ color: '#10B981', fontWeight: 800, marginRight: 4 }}>✓</span>}
                              {ps.title || 'Sesión de estudio'}
                            </span>
                            {x.sH > 34 && (
                              <span style={{ fontSize: 10, fontWeight: 500, color: pCol, opacity: 0.75, fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>
                                {fmtTimeRange(ps.startTime!, (() => { const m = Math.round(sh * 60 + sm + ps.durationMinutes); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; })(), settings?.timeFormat)} · {ps.durationMinutes}m
                              </span>
                            )}
                            {x.sH > 48 && (
                              <div style={{ display: 'flex', gap: 1.5, marginTop: 'auto', width: '100%', paddingTop: 3 }}>
                                {REVIEW_LEVEL_COLORS.map((col, i) => (
                                  <div key={i} style={{ flex: 1, height: 5, borderRadius: 1, background: i < psInt ? col : 'var(--bg-deep)', opacity: i < psInt ? 0.9 : 0.5, boxShadow: i === psInt - 1 ? `0 0 6px ${col}88` : 'none' }} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {isToday(navDate) && nowH>=H_START && nowH<=H_END && (
                      <div style={{ position:'absolute', top:nowPx, left:0, right:0, height:2, background:'var(--accent)', zIndex:10, pointerEvents:'none', boxShadow:'0 0 16px var(--accent-glow)' }}>
                        <div style={{ position:'absolute', left:-4, top:-4, width:10, height:10, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 20px var(--accent-glow)' }}/>
                      </div>
                    )}
                        </>
                      );
                    })()}

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
                      const dayTasks=tasks.filter(t=>{if(!t.dueDate||t.status==='completado')return false;if(linkedTaskIds.has(t.id))return false;return (t.dueDate||'').slice(0,10)===iso});
                      const opacity = isOld(iso) && !tod ? 0.35 : (inc ? 1 : 0.25);
                      return (
                        <div key={di}
                          onClick={()=>{ setSelectedItem({ type: 'day', date: day, events: dayEvs, tasks: dayTasks }); }}
                          style={{ height:130, padding:'10px 12px', cursor:'pointer', overflow:'hidden', borderRight:di<6?'1px solid var(--border-soft)':'none', background:'transparent', opacity, transition:'background 200ms', position:'relative' }}
                          onMouseEnter={e=>!tod && (e.currentTarget.style.outline='1px solid var(--border-strong)')}
                          onMouseLeave={e=>!tod && (e.currentTarget.style.outline='none')}
                        >
                          <div style={{ width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10, fontSize:13,fontWeight:tod?700:500, background:tod?'var(--accent)':'transparent', color:tod?'#fff':'var(--text-primary)', fontFamily:"'Outfit',sans-serif" }}>{format(day,'d')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                            {dayEvs.slice(0,3).map((ev,ei)=>{
                              const evTask = (ev as PlanEvent).taskId ? tasks.find(t => t.id === (ev as PlanEvent).taskId) : null;
                              return <div key={ei} style={{ fontSize:10,padding:'4px 8px',borderRadius:6,background:`${ev.color}15`,borderLeft:`2px solid ${ev.color}`,color:ev.color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>{ev.title}{evTask ? <span style={{opacity:0.55,fontWeight:500}}> + {evTask.title}</span> : ''}</div>;
                            })}
                            {dayTasks.slice(0,3).map((t,ti)=><div key={ti} style={{ fontSize:10,padding:'4px 8px',borderRadius:6,background:`${t.courseColor||'var(--text-muted)'}15`,borderLeft:`2px dashed ${t.courseColor||'var(--text-muted)'}`,color:t.courseColor||'var(--text-secondary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>Ent: {t.title}</div>)}
                            {(dayEvs.length+dayTasks.length)>6&&<div style={{ fontSize:10,color:'var(--text-muted)',fontWeight:600, marginTop: 4 }}>+{dayEvs.length+dayTasks.length-6} más</div>}
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
                            const dayEvs2 = getEventsForDate(iso);
                            const dayLinkedIds2 = new Set(dayEvs2.map(ev => (ev as PlanEvent).taskId).filter(Boolean));
                            const dayTasks2 = tasks.filter(t => { if(!t.dueDate || t.status === 'completado') return false; if(dayLinkedIds2.has(t.id)) return false; return (t.dueDate||'').slice(0,10)===iso });
                            return (
                              <div key={di}
                                onClick={(e) => { e.stopPropagation(); if (inc) setSelectedItem({ type: 'day', date: day, events: dayEvs2, tasks: dayTasks2 }); }}
                                style={{
                                  width:'100%', aspectRatio:'1', borderRadius:4,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize: inc ? 10 : 8,
                                  fontWeight: tod ? 800 : (inc ? 500 : 300),
                                  color: tod ? '#fff' : (inc ? 'var(--text-primary)' : 'var(--text-muted)'),
                                  background: tod ? 'var(--accent)' : 'transparent',
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
        onAddPlanSession={(date) => { openNewPlanSession(format(date, 'yyyy-MM-dd')); setSelectedItem(null); }}
        onEditPlanSession={(session) => { setSelectedItem(null); openEditPlanSession(session); }}
        onFileMoved={(evId, oldUrl, newPath) => {
          setEvents(p => p.map(e => e.id === evId ? { ...e, attachments: (e.attachments || []).map(f => f.url === oldUrl ? { ...f, url: newPath } : f) } : e));
          setSelectedItem(prev => prev?.type === 'event' && prev.event.id === evId ? { type: 'event', event: { ...prev.event, attachments: (prev.event.attachments || []).map(f => f.url === oldUrl ? { ...f, url: newPath } : f) } } : prev);
          addNotification('Archivo actualizado a su nueva ubicación', 'success');
        }}
      />

      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaults={modalDefaults}
          courses={courses}
          tasks={tasks}
          occurrenceDate={occurrenceDate}
          onClose={()=>{ setShowEventModal(false); setEditingEvent(null); }}
          onSave={saveEvent}
          onSaveOne={saveOneEvent}
          onDelete={id=>{ deleteEvent(id); }}
          addNotification={addNotification}
        />
      )}

      {showPlanModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPlanModal(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          {(() => {
            const modalDate = planDate || format(navDate, 'yyyy-MM-dd');
            const selCourse = courses.find(c => c.id === planCourseId);
            const courseColor = selCourse?.color || 'var(--accent)';
            const selGroups = allCourseGroups.filter(g => g.courseId === planCourseId);
            const selTopics = allCourseTopics.filter(t => t.groupId === planGroupId);
            return (
              <div style={{ position: 'relative', width: 480, maxHeight: '88vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'modalDrop 260ms cubic-bezier(0.16, 1, 0.3, 1)' }} className="bento-card modal-opaque">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${courseColor}, color-mix(in srgb, ${courseColor} 33%, transparent), transparent)`, pointerEvents: 'none' }} />
                <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em' }}>{planEditId ? 'Editar sesión' : 'Nueva sesión de estudio'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", textTransform: 'capitalize', letterSpacing: '-0.01em' }}>
                        {format(new Date(modalDate + 'T12:00:00'), 'EEEE', { locale: es })}
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> · {format(new Date(modalDate + 'T12:00:00'), "d 'de' MMMM", { locale: es })}</span>
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0, opacity: 0.7 }} />
                      <span title={selCourse ? `Vinculado al curso ${selCourse.name}` : 'Sesión de estudio libre'}
                        style={{ fontSize: 10, fontWeight: 700, color: courseColor, fontFamily: "'Inter Tight', sans-serif", background: `color-mix(in srgb, ${courseColor} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${courseColor} 20%, transparent)`, padding: '3px 11px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase', letterSpacing: '0.09em', lineHeight: 1.4, maxWidth: 240, overflow: 'hidden' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selCourse ? selCourse.name : 'Estudio libre'}</span>
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setShowPlanModal(false)}
                    style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 15 }} className="no-scrollbar">
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 7, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Curso</label>
                    <select value={planCourseId} onChange={e => { setPlanCourseId(e.target.value); setPlanGroupId(''); setPlanTopicId(''); }}
                      style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: planCourseId ? 'var(--text-primary)' : 'var(--text-muted)', padding: '0 13px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}
                      className="input-base">
                      <option value="">Estudio libre (sin curso)</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 7, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Título</label>
                    <input value={planTitle} onChange={e => setPlanTitle(e.target.value)}
                      placeholder="Ej: Repasar capítulo 3"
                      autoFocus
                      style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 13px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                      className="input-base" />
                  </div>

                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 7, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Hora de inicio</label>
                      <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', overflow: 'hidden' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
                          <button onClick={() => shiftPlanTime('h', 1)} title="Subir hora (+1h)"
                            style={{ width: '100%', height: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms' }}
                            onMouseEnter={e => e.currentTarget.style.color = courseColor}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <ChevronUp size={14} />
                          </button>
                          {planTimeEdit === 'h' ? (
                            <input autoFocus value={planTimeEditVal}
                              onChange={e => setPlanTimeEditVal(e.target.value.replace(/\D/g, '').slice(0, 2))}
                              onBlur={() => commitPlanTimeEdit('h')}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              style={{ width: '72%', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', fontSize: 17, fontWeight: 700, color: courseColor, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', padding: 0, height: 28 }} />
                          ) : (
                            <button onClick={() => { setPlanTimeEdit('h'); setPlanTimeEditVal(String(parsePlanTime(planStartTime).h)); }} title="Editar hora (manual)"
                              style={{ width: '100%', height: 34, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: courseColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', padding: 0, transition: 'background 150ms' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {String(parsePlanTime(planStartTime).h).padStart(2, '0')}
                            </button>
                          )}
                          <button onClick={() => shiftPlanTime('h', -1)} title="Bajar hora (−1h)"
                            style={{ width: '100%', height: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms' }}
                            onMouseEnter={e => e.currentTarget.style.color = courseColor}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>:</div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
                          <button onClick={() => shiftPlanTime('m', 1)} title="Subir minutos (+5m)"
                            style={{ width: '100%', height: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms' }}
                            onMouseEnter={e => e.currentTarget.style.color = courseColor}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <ChevronUp size={14} />
                          </button>
                          {planTimeEdit === 'm' ? (
                            <input autoFocus value={planTimeEditVal}
                              onChange={e => setPlanTimeEditVal(e.target.value.replace(/\D/g, '').slice(0, 2))}
                              onBlur={() => commitPlanTimeEdit('m')}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              style={{ width: '72%', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', fontSize: 17, fontWeight: 700, color: courseColor, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', padding: 0, height: 28 }} />
                          ) : (
                            <button onClick={() => { setPlanTimeEdit('m'); setPlanTimeEditVal(String(parsePlanTime(planStartTime).m)); }} title="Editar minutos (manual)"
                              style={{ width: '100%', height: 34, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: courseColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', padding: 0, transition: 'background 150ms' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {String(parsePlanTime(planStartTime).m).padStart(2, '0')}
                            </button>
                          )}
                          <button onClick={() => shiftPlanTime('m', -1)} title="Bajar minutos (−5m)"
                            style={{ width: '100%', height: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms' }}
                            onMouseEnter={e => e.currentTarget.style.color = courseColor}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ width: 158 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 7, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Duración</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => setPlanDuration(Math.max(5, planDuration - 5))} title="Reducir"
                          style={{ width: 38, height: 46, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, ' + courseColor + ' 40%, transparent)'; e.currentTarget.style.color = courseColor; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                          <Minus size={14} />
                        </button>
                        <div style={{ flex: 1, height: 46, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{planDuration}</span>
                          <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>min</span>
                        </div>
                        <button onClick={() => setPlanDuration(Math.min(240, planDuration + 5))} title="Aumentar"
                          style={{ width: 38, height: 46, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, ' + courseColor + ' 40%, transparent)'; e.currentTarget.style.color = courseColor; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
                        {[15, 25, 30, 45, 60].map(m => (
                          <button key={m} onClick={() => setPlanDuration(m)}
                            style={{ flex: 1, padding: '4px 0', borderRadius: 7, fontSize: 9.5, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', border: planDuration === m ? 'color-mix(in srgb, ' + courseColor + ' 40%, transparent)' : '1px solid var(--border-subtle)', background: planDuration === m ? 'color-mix(in srgb, ' + courseColor + ' 8%, transparent)' : 'transparent', color: planDuration === m ? courseColor : 'var(--text-muted)', transition: 'all 150ms' }}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderRadius: 11, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Intensidad esperada</label>
                      <span style={{ fontSize: 11, fontWeight: 700, color: planIntensity > 0 ? REVIEW_LEVEL_COLORS[planIntensity - 1] : 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif" }}>
                        {planIntensity <= 3 ? 'Suave' : planIntensity <= 6 ? 'Media' : planIntensity <= 8 ? 'Intensa' : 'Máxima'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                      {REVIEW_LEVEL_COLORS.map((col, i) => {
                        const v = i + 1;
                        const on = v <= planIntensity;
                        return (
                          <button key={v} onClick={() => setPlanIntensity(v)} title={`Intensidad ${v}`}
                            style={{ flex: 1, height: 26, borderRadius: 6, cursor: 'pointer', border: on ? 'none' : '1px solid var(--border-subtle)', background: on ? `linear-gradient(180deg, ${col}, color-mix(in srgb, ${col} 45%, #000 55%))` : 'var(--bg-hover)', opacity: on ? 1 : 0.55, boxShadow: v === planIntensity ? 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 12px rgba(255,255,255,0.16)' : on ? 'inset 0 1px 0 rgba(255,255,255,0.18)' : 'none', transition: 'all 160ms' }}
                            onMouseEnter={e => { if (!on) e.currentTarget.style.opacity = '0.85'; }}
                            onMouseLeave={e => { if (!on) e.currentTarget.style.opacity = '0.55'; }} />
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Suave</span>
                      <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Máxima</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Vincular a (opcional)</label>
                    <PlanSelectDropdown value={planGroupId}
                      onChange={v => { setPlanGroupId(v); setPlanTopicId(''); }}
                      options={selGroups.map(g => ({ id: g.id, label: g.name }))}
                      noneLabel="Sin agrupación" color={courseColor} />
                    {planGroupId ? (
                      selTopics.length > 0 ? (
                        <div style={{ animation: 'fadeIn 200ms ease' }}>
                          <PlanSelectDropdown value={planTopicId}
                            onChange={setPlanTopicId}
                            options={selTopics.map(t => ({ id: t.id, label: t.title }))}
                            noneLabel="Sin tema" color={courseColor} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-deep)', padding: '0 13px', animation: 'fadeIn 200ms ease' }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>Esta agrupación no tiene temas</span>
                        </div>
                      )
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-deep)', padding: '0 13px' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>Elige una agrupación para vincular un tema</span>
                      </div>
                    )}
                  </div>

                  
                </div>

                <div style={{ padding: '14px 24px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
                  {planEditId && (
                    <button onClick={() => setConfirmDeleteSession(true)} title="Eliminar sesión"
                      style={{ marginRight: 'auto', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button onClick={() => setShowPlanModal(false)}
                    style={{ height: 38, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 18px', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    Cancelar
                  </button>
                  <button onClick={() => {
                      if (!modalDate || !planTitle.trim()) { addNotification('Ponle un título a la sesión.', 'info'); return; }
                      const payload = { courseId: planCourseId || '', date: modalDate, startTime: planStartTime || undefined, title: planTitle.trim(), groupId: planGroupId || undefined, topicId: planTopicId || undefined, durationMinutes: planDuration, type: planType, intensity: planIntensity, completed: false };
                      if (planEditId) {
                        const orig = (plannedSessions || []).find(s => s.id === planEditId);
                        const repeatPatch = orig?.repeat && orig.repeat !== 'none' ? { repeat: orig.repeat, repeatDays: orig.repeatDays, repeatUntil: orig.repeatUntil } : {};
                        updatePlannedSession(planEditId, { ...payload, ...repeatPatch, exceptions: orig?.exceptions });
                      } else addPlannedSession(payload);
                      // La sesión guardada debe verse AL INSTANTE: si la vista no la
                      // muestra (mes/año no renderizan sesiones), saltar a la semana
                      // de la fecha de la sesión recién creada/editada.
                      const targetDate = new Date(modalDate + 'T12:00:00');
                      if (planView !== 'week') setPlanView('week');
                      setNavDate(startOfWeek(targetDate, { weekStartsOn: 1 }));
                      setShowPlanModal(false);
                    }}
                    style={{ height: 38, borderRadius: 9, border: 'none', background: courseColor, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '0 22px', transition: 'all 150ms', boxShadow: selCourse ? `0 4px 14px ${selCourse.color}2e` : '0 4px 14px var(--accent-dim)' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                    {planEditId ? 'Guardar cambios' : 'Planificar'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <input ref={imgInputRef} type="file" accept="image/*" style={{ display:'none' }}
        onChange={e=>{ const f=e.target.files?.[0]; if(f){const url=URL.createObjectURL(f);setScheduleImageUrl(url);} }}/>

      {confirmDeleteSession && showPlanModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99996,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        }} onClick={() => setConfirmDeleteSession(false)}>
          <div className="bento-card" style={{ padding: 26, width: 350, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={13} />
              </span>
              Eliminar sesión
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.5 }}>
              {planTitle.trim()
                ? `Se eliminará "${planTitle.trim()}"${(() => { const os = (plannedSessions || []).find(s => s.id === planEditId); return os?.repeat && os.repeat !== 'none' ? ' y todas sus repeticiones' : ''; })()}. Esta acción no se puede deshacer.`
                : 'Se eliminará esta sesión. Esta acción no se puede deshacer.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteSession(false)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { deletePlannedSession(planEditId!); setShowPlanModal(false); setConfirmDeleteSession(false); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={13} /> Sí, eliminar
              </button>
            </div>
          </div>
        </div>, document.body
      )}
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

function AllDayBar({ events, plannedSessions }: { events: PlanEvent[]; plannedSessions?: { id: string; title: string; durationMinutes: number; type: string; courseId?: string; startTime?: string }[] }) {
  const ps = (plannedSessions || []).filter(s => !s.startTime);
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
