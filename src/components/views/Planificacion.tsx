/**
 * Planificacion.tsx â€” Enterprise Academic Planner (v2 Revamp)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, X, Trash2, Check
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

import EventModal, { PlanEvent } from './planificacion/EventModal';
import ScheduleBuilder, { ScheduleClass } from './planificacion/ScheduleBuilder';
import LateralPanel, { SelectedItem } from './planificacion/LateralPanel';

const H_START = 0;
const H_END   = 23;
const H_PX    = 64; 
const DAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

type PlanView = 'week' | 'day' | 'month';
const VIEW_LABELS: Record<PlanView, string> = {
  week: 'Vista Semanal',
  day: 'Vista Diaria',
  month: 'Vista Mensual',
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
  const { tasks, courses, setNavigateTo, addNotification, settings } = useApp();

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

  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragOver, setDragOver]               = useState<{ dayIdx: number; hour: number } | null>(null);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [scheduleImageUrl, setScheduleImageUrl] = useState<string | null>(null);
  const [scheduleTab, setScheduleTab] = useState<'image' | 'manual'>(() => {
    try { return (localStorage.getItem('owa_sched_last_tab') as 'image' | 'manual') || 'manual'; }
    catch { return 'manual'; }
  });
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);

  useEffect(() => { localStorage.setItem('owa_sched_last_tab', scheduleTab); }, [scheduleTab]);

  useEffect(() => { localStorage.setItem('owa_planner_view', planView); }, [planView]);
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

  const nav = (dir: 1 | -1) => {
    if (planView === 'month') setNavDate(dir===1 ? addMonths(navDate,1) : subMonths(navDate,1));
    else if (planView === 'week') setNavDate(dir===1 ? addWeeks(navDate,1) : subWeeks(navDate,1));
    else if (planView === 'day') setNavDate(dir===1 ? addDays(navDate,1) : subDays(navDate,1));
  };

  const navLabel = useMemo(() => {
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

  const isOld = (dateStr: string) => {
    const diff = (new Date().getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000;
    return diff > 4;
  };

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
    <div className="page-container" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background: 'var(--bg-primary)' }}>

      {/* HEADER — Title + Date | Bell + Clock */}
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, paddingTop:6, flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.03em', fontFamily:"'Outfit', sans-serif", lineHeight:1 }}>
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
            {(['week', 'day', 'month'] as PlanView[]).map(v => (
              <button key={v} onClick={() => setPlanView(v)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 200ms', background: planView === v ? 'var(--accent)' : 'transparent', color: planView === v ? '#fff' : 'var(--text-secondary)', fontFamily: "'Outfit',sans-serif" }}>
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {!showScheduleBuilder && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>nav(-1)} className="btn-secondary" style={{ padding:'8px 10px', borderRadius:10, height:36, border: 'none' }}><ChevronLeft size={16}/></button>
              <button onClick={()=>setNavDate(new Date())} className="btn-secondary" style={{ fontSize:13, fontWeight:600, padding:'0 20px', height:36, borderRadius:10, border: 'none' }}>Hoy</button>
              <button onClick={()=>nav(1)}  className="btn-secondary" style={{ padding:'8px 10px', borderRadius:10, height:36, border: 'none' }}><ChevronRight size={16}/></button>
              <span style={{ fontSize:16, fontWeight:300, color:'var(--text-primary)', textTransform:'capitalize', minWidth:260, fontFamily: "'Outfit', sans-serif", textAlign: 'right', letterSpacing: '-0.01em' }}>{navLabel}</span>
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => setShowScheduleBuilder(!showScheduleBuilder)} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, border: showScheduleBuilder ? '1px solid var(--accent)' : '1px solid var(--border-soft)', background: showScheduleBuilder ? 'rgba(225,29,72,0.08)' : 'transparent' }}>
            <Calendar size={14} /> {showScheduleBuilder ? 'Cerrar Horario' : 'Horario'}
          </button>
          <button
            onClick={() => { setModalDefaults({ date: format(new Date(), 'yyyy-MM-dd') }); setEditingEvent(null); setShowEventModal(true); }}
            className="btn-primary"
            style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:600, padding:'10px 24px', boxShadow:'0 8px 32px var(--accent-glow)', borderRadius: 14 }}
          >
            <Plus size={18}/> Nuevo Evento
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      {showScheduleBuilder ? (
        <div style={{ display:'flex', flex:1, gap:16, minHeight:0, overflow:'hidden' }}>
          <ScheduleBuilder
            classes={classes}
            courses={courses as any}
            onUpdateClasses={setClasses}
            scheduleImageUrl={scheduleImageUrl}
            onSetScheduleImage={setScheduleImageUrl}
            imgInputRef={imgInputRef}
            scheduleTab={scheduleTab}
            onSetScheduleTab={setScheduleTab}
            addNotification={addNotification}
            timeFormat={settings?.timeFormat}
          />
        </div>
      ) : (
      <div style={{ display:'flex', flex:1, gap:16, minHeight:0, overflow:'hidden' }}>
        <div className="bento-card" style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden', padding:0, border:'1px solid var(--border-default)', background: 'color-mix(in srgb, var(--bg-elevated) 65%, transparent)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>

          {/* WEEK VIEW */}
          {planView === 'week' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:`60px repeat(7,1fr)`, borderBottom:'1px solid var(--border-soft)', flexShrink:0, background: 'var(--bg-primary)' }}>
                <div style={{ borderRight:'1px solid var(--border-soft)' }}/>
                {weekDays.map((d,i) => {
                  const tod = isToday(d);
                  return (
                    <div key={i}
                      onClick={() => setSelectedItem({ type: 'day', date: d, events: getEventsForDate(format(d, 'yyyy-MM-dd')), tasks: tasks.filter(t => t.dueDate === format(d, 'yyyy-MM-dd') && t.status !== 'completado') })}
                      style={{ padding:'12px 0', textAlign:'center', cursor:'pointer', borderLeft: i > 0 ? '1px solid var(--border-soft)' : 'none', background:tod?'rgba(225,29,72,0.05)':'transparent', position:'relative', transition:'background 200ms' }}
                      onMouseEnter={e=>!tod && (e.currentTarget.style.background='var(--surface-hover)')}
                      onMouseLeave={e=>!tod && (e.currentTarget.style.background='transparent')}
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
                      <AllDayBar events={getAllDayEventsForDate(format(d,'yyyy-MM-dd'))} />
                    </div>
                  );
                })}
              </div>
              <div ref={timelineRef} style={{ flex:1, overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:`60px repeat(7,1fr)`, minHeight:(H_END-H_START+1)*H_PX }}>
                  <div style={{ borderRight:'1px solid var(--border-soft)', background: 'var(--bg-primary)' }}>
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
                          const isOver = dragOver?.dayIdx===di && dragOver?.hour===h;
                          return (
                            <div key={h}
                              onDragOver={e=>{ e.preventDefault(); setDragOver({dayIdx:di,hour:h}); }}
                              onDragLeave={()=>setDragOver(null)}
                              onDrop={()=>handleDrop(di,h)}
                              onClick={()=>{ setModalDefaults({ date:iso, startTime:fracToTime(h), endTime:fracToTime(h+1) }); setEditingEvent(null); setShowEventModal(true); }}
                              style={{ height:H_PX, borderBottom:'1px dashed var(--border-soft)', background:isOver?'rgba(225,29,72,0.08)':'transparent', transition:'background 100ms', cursor:'cell' }}
                            />
                          );
                        })}
                        {[...schedCls, ...timedEvs].map(item => {
                          const isClass = 'dayOfWeek' in item;
                          const top = eventTop(item);
                          const hpx = eventHeight(item);
                          const pos = layout.get(item.id) || { left: 0, width: 100 };
                          const itemColor = isClass && item.type === 'break' ? 'var(--text-muted)' : isClass && item.type === 'meal' ? '#f59e0b' : item.color;
                          
                          return (
                            <div key={item.id}
                              draggable={!isClass}
                              onDragStart={() => !isClass && setDraggingEventId(item.id)}
                              onDragEnd={()=>{ setDraggingEventId(null); setDragOver(null); }}
                              onClick={e => { e.stopPropagation(); isClass ? setSelectedItem({ type: 'day', date: d, events: timedEvs, tasks: [] }) : setSelectedItem({ type: 'event', event: item as PlanEvent }); }}
                              style={{
                                position:'absolute', top, left: `${pos.left}%`, width: `${pos.width}%`, height: hpx,
                                borderLeft: isClass ? 'none' : `3px solid ${itemColor}`,
                                borderRadius: '4px',
                                background: isClass ? `color-mix(in srgb, ${itemColor} 4%, transparent)` : `color-mix(in srgb, ${itemColor} 12%, var(--bg-base))`,
                                boxShadow: isClass ? 'none' : `inset 0 1px 0 ${itemColor}10, 0 2px 8px rgba(0,0,0,0.08)`,
                                zIndex: isClass ? 0 : 3, cursor: isClass ? 'pointer' : 'grab', display:'flex', flexDirection:'column', padding: isClass ? '4px 8px' : '6px 10px', overflow: 'hidden',
                                transition:'opacity 150ms',
                                opacity: isClass ? 0.55 : 1,
                                pointerEvents: isClass ? 'none' : 'auto',
                              }}
                              onMouseEnter={e=>{ if (!isClass) { e.currentTarget.style.boxShadow = `inset 0 1px 0 ${itemColor}20, 0 6px 20px rgba(0,0,0,0.25)`; e.currentTarget.style.zIndex='4'; } }}
                              onMouseLeave={e=>{ if (!isClass) { e.currentTarget.style.boxShadow = `inset 0 1px 0 ${itemColor}10, 0 2px 8px rgba(0,0,0,0.08)`; e.currentTarget.style.zIndex='3'; } }}
                            >
                              <span style={{ fontSize: isClass ? 10 : 11, fontWeight: isClass ? 500 : 600, color: isClass ? 'var(--text-muted)' : itemColor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</span>
                              {!isClass && hpx > 40 && (
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                                  <Clock size={10} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>{fmtTimeRange(item.startTime, item.endTime, settings?.timeFormat)}</span>
                                </div>
                              )}
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
            </>
          )}

          {/* DAY VIEW */}
          {planView === 'day' && (
            <>
              <div style={{ padding:'20px 28px', borderBottom:'1px solid var(--border-soft)', flexShrink:0, background: 'var(--bg-primary)' }}>
                <div style={{ fontSize:24, fontWeight:300, color:isToday(navDate)?'var(--accent)':'var(--text-primary)', fontFamily:"'Outfit',sans-serif", textTransform:'capitalize', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {format(navDate,"EEEE d 'de' MMMM yyyy",{locale:es as any})}
                  {isToday(navDate) && <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-glow)', padding:'4px 12px', borderRadius:20 }}>HOY</span>}
                </div>
                <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:8 }}>
                  {getAllDayEventsForDate(format(navDate,'yyyy-MM-dd')).map(ev => (
                    <span key={ev.id} onClick={()=>{ setSelectedItem({ type: 'event', event: ev }); }} style={{ fontSize:12, fontWeight:600, padding:'6px 16px', borderRadius:10, background:`${ev.color}15`, border:`1px solid ${ev.color}30`, color:ev.color, cursor:'pointer' }}>{ev.title}</span>
                  ))}
                </div>
              </div>
              <div ref={timelineRef} style={{ flex:1, overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', minHeight:(H_END-H_START+1)*H_PX }}>
                  <div style={{ borderRight:'1px solid var(--border-soft)', background: 'var(--bg-primary)' }}>
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
                            {!isClass && (item as PlanEvent).description && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:8, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{(item as PlanEvent).description}</div>}
                          </div>
                        );
                      });
                    })()}
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
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border-soft)', flexShrink:0, background: 'var(--bg-primary)' }}>
                {DAY_LABELS.map(d=><div key={d} style={{ padding:'12px 0', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{d}</div>)}
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                {weekRows.map((week,wi)=>(
                  <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border-soft)' }}>
                    {week.map((day,di)=>{
                      const inc=isSameMonth(day,monthStart), tod=isToday(day);
                      const iso=format(day,'yyyy-MM-dd');
                      const dayEvs=[...getAllDayEventsForDate(iso), ...getTimedEventsForDate(iso)];
                      const dayTasks=tasks.filter(t=>t.dueDate&&format(new Date(t.dueDate),'yyyy-MM-dd')===iso&&t.status!=='completado');
                      const opacity = isOld(iso) && !tod ? 0.35 : (inc ? 1 : 0.25);
                      return (
                        <div key={di}
                          onClick={()=>{ setSelectedItem({ type: 'day', date: day, events: dayEvs, tasks: dayTasks }); }}
                          style={{ height:130, padding:'10px 12px', cursor:'pointer', overflow:'hidden', borderRight:di<6?'1px solid var(--border-soft)':'none', background:tod?'rgba(225,29,72,0.05)':'transparent', opacity, transition:'background 200ms' }}
                          onMouseEnter={e=>!tod && (e.currentTarget.style.background='var(--surface-hover)')}
                          onMouseLeave={e=>!tod && (e.currentTarget.style.background='transparent')}
                        >
                          <div style={{ width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10, fontSize:13,fontWeight:tod?700:500, background:tod?'var(--accent)':'transparent', color:tod?'#fff':'var(--text-primary)', fontFamily:"'Outfit',sans-serif" }}>{format(day,'d')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                            {dayEvs.slice(0,3).map((ev,ei)=><div key={ei} style={{ fontSize:10,padding:'4px 8px',borderRadius:6,background:`${ev.color}15`,borderLeft:`2px solid ${ev.color}`,color:ev.color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600 }}>{ev.title}</div>)}
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
        </div>
      </div>
      )}
      <LateralPanel 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onSelectEvent={(ev) => setSelectedItem({ type: 'event', event: ev })}
        onEditEvent={(ev) => { setEditingEvent(ev); setShowEventModal(true); setSelectedItem(null); }}
        onDeleteEvent={(id) => { deleteEvent(id); }}
        onViewTask={(id) => { setSelectedItem(null); setNavigateTo(`tareas`); }}
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

function AllDayBar({ events }: { events: PlanEvent[] }) {
  if (!events.length) return <div style={{ minHeight:8 }}/>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'4px 8px', justifyContent:'center' }}>
      {events.slice(0,2).map(ev=>(
        <div key={ev.id} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:`${ev.color}15`, borderLeft:`2px solid ${ev.color}`, color:ev.color, maxWidth:80, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:600 }}>{ev.title}</div>
      ))}
      {events.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>+{events.length - 2}</div>}
    </div>
  );
}
