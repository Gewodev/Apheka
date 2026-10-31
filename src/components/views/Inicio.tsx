import LiveClock from '../ui/LiveClock';
import WorkspaceClock from '../ui/WorkspaceClock';
import { calculateStreak, getGoalForDay } from '../../lib/studyStreak';
﻿import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Music, CheckSquare, FileText, Flame,
  Target, Star, Lock, Check, X, Calendar, Timer } from 'lucide-react';
import { useAppSlice } from '../../store/AppContext';
import { format, subDays, subWeeks, addDays, addWeeks, startOfWeek, parseISO, isBefore } from 'date-fns';
import { loadPlanner, peekPlanner, PLANNER_CHANGED } from '../../lib/plannerStore';
import { readFeatured, hydrateFeatured, setFeaturedEvent, FEATURED_CHANGED } from '../../lib/featuredEvent';
import { nextOccurrence } from '../../lib/eventOccurrence';
import { es } from 'date-fns/locale';
import { getWeeklyPhrase } from '../../data/phrases';
import NotificationBell from '../ui/NotificationBell';

const segs: Record<string, boolean[]> = {
  '0': [true, true, true, true, true, true, false], '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true], '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true], '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true], '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true], '9': [true, true, true, true, false, true, true],
};
const segPolys: [number, number][][] = [
  [[14, 4], [58, 4], [50, 12], [22, 12]],
  [[68, 14], [60, 18], [60, 50], [68, 54]],
  [[68, 66], [60, 70], [60, 102], [68, 106]],
  [[22, 108], [50, 108], [58, 116], [14, 116]],
  [[4, 66], [12, 70], [12, 102], [4, 106]],
  [[4, 14], [12, 18], [12, 50], [4, 54]],
  [[10, 60], [18, 56], [54, 56], [62, 60], [54, 64], [18, 64]],
];
function DigitSVG({ d, color, width = 80, height = 130 }: { d: string; color: string; width?: number; height?: number }) {
  const s = segs[d] || segs['0'];
  return (
    <svg width={width} height={height} viewBox="0 0 72 120" style={{ display: 'block' }}>
      {segPolys.map((poly, i) => (
        <polygon key={i} points={poly.map(p => p.join(',')).join(' ')}
          fill={s[i] ? color : 'var(--led-segment-off)'}
          style={{ transition: 'fill 150ms cubic-bezier(0.4, 0, 0.2, 1)', filter: s[i] ? `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 15px ${color}50)` : 'none' }}
        />
      ))}
    </svg>
  );
}
function ColonSVG({ color, width = 28, height = 130 }: { color: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 120" style={{ display: 'block' }}>
      <rect x={8} y={38} width={8} height={8} rx={4} ry={4} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
      <rect x={8} y={74} width={8} height={8} rx={4} ry={4} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
    </svg>
  );
}
function LEDTime({ time, color, digitWidth = 80, digitHeight = 130, colonWidth = 28 }: { time: string; color: string; digitWidth?: number; digitHeight?: number; colonWidth?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {time.split('').map((ch, i) =>
        ch === ':' ? <ColonSVG key={i} color={color} width={colonWidth} height={digitHeight} /> : <DigitSVG key={i} d={ch} color={color} width={digitWidth} height={digitHeight} />
      )}
    </div>
  );
}

/** Convert a UTC ISO timestamp to local YYYY-MM-DD */


interface GoalEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  allDay?: boolean;
  color: string;
  repeat?: string;
  repeatDays?: number[];
  repeatUntil?: string;
  exceptions?: string[];
  occurrenceOverrides?: Record<string, Partial<GoalEvent>>;
  _session?: boolean;
  durationMinutes?: number;
}

const GOAL_KEY = 'owa_planned_goal';

// Mapea una sesión de estudio planificada al shape de GoalEvent (para
// "Siguientes" y para que el Destacado pueda apuntar a una sesión).
function mapSessionToGoal(s: any, courses: any[]): GoalEvent | null {
  if (!s || !s.date || s.completed) return null;
  const color = courses.find((c: any) => c.id === s.courseId)?.color || '#8B5CF6';
  return {
    id: s.id, title: s.title, date: s.date, startTime: s.startTime || undefined, allDay: false,
    color, repeat: s.repeat, repeatDays: s.repeatDays, repeatUntil: s.repeatUntil,
    exceptions: s.exceptions, _session: true, durationMinutes: s.durationMinutes,
  };
}

function loadGoalEvent(): GoalEvent | null {
  const selected = readFeatured();
  if (!selected.id) return null;
  const event = peekPlanner()?.events.find(e => e.id === selected.id) || selected.event;
  return event ? (nextOccurrence(event) || event) as GoalEvent : null;
}

const hl = (l: number) =>
  l === 0 ? 'color-mix(in srgb,var(--text-primary) 7%,var(--bg-base))' : l === 1 ? 'var(--accent-dim)' : l === 2 ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : l === 3 ? 'color-mix(in srgb, var(--accent) 65%, transparent)' : 'var(--accent)';

const pc: Record<string, string> = { high: '#E11D48', medium: '#F59E0B', low: '#10B981', none: 'var(--text-tertiary)' };
const pcl: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja', none: 'Sin pri.' };

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  try { return format(new Date(d), 'd MMM', { locale: es }); } catch { return ''; }
}

const FeaturedCountdown=React.memo(function FeaturedCountdown({event}:{event:GoalEvent}){
 return <LiveClock>{now=>{
  const target=new Date(event.date+'T'+(event.allDay?'23:59:59':event.startTime||'23:59:59')).getTime();
  const diff=Number.isFinite(target)?Math.max(0,target-now.getTime()):0;
  const countdown={days:Math.floor(diff/86400000),hours:Math.floor(diff%86400000/3600000),minutes:Math.floor(diff%3600000/60000),seconds:Math.floor(diff%60000/1000)};
  return (<div className="home-featured-countdown" style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 0 16px', fontFamily: "'Inter Tight', sans-serif" }}>
                {[
                  { val: countdown.days, label: 'dias' },
                  { val: countdown.hours, label: 'hrs' },
                  { val: countdown.minutes, label: 'min' },
                  { val: countdown.seconds, label: 'seg' },
                ].map((u, i) => {
                  const isZero = u.val === 0 && i < 3;
                  return (
                    <React.Fragment key={u.label}>
                      {i > 0 && <div className="home-countdown-separator" aria-hidden="true" style={{ alignSelf: 'center', fontSize: 22, fontWeight: 500, color: `${event.color}40`, paddingBottom: 14 }}>:</div>}
                      <div style={{ textAlign: 'center', minWidth: 48 }}>
                        <div style={{ fontSize: 34, fontWeight: 500, lineHeight: 1, color: isZero ? 'var(--text-tertiary)' : event.color, letterSpacing: '-0.02em', transition: 'color 200ms' }}>
                          {String(u.val).padStart(2, '0')}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>{u.label}</div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>);
 }}</LiveClock>;
});

export default function Inicio() {
  const {
    tasks = [],
    notes = [],
    settings,
    dailyStudyTime = 0,
    weeklyStudyTime = {},
    tracks = [],
    trackHistory = [],
    updateSettings,
    setNavigateTo,
    setFocusedEventId,
    setFocusedTaskId,
    plannedSessions = [],
    courses = [],
  } = useAppSlice(["tasks","notes","settings","dailyStudyTime","weeklyStudyTime","tracks","trackHistory","updateSettings","setNavigateTo","setFocusedEventId","setFocusedTaskId","plannedSessions","courses"]);
  const [ct, setCt] = useState(new Date());

  const [goalEvent, setGoalEvent] = useState<GoalEvent | null>(() => loadGoalEvent());
  const [upcomingEvents, setUpcomingEvents] = useState<GoalEvent[]>([]);
  // Data refresh is independent from the clock. Reading never clears a user's pin.
  useEffect(() => {
    let alive = true;
    let request = 0;
    const refresh = async () => {
      const token = ++request;
      try {
        const { events } = await loadPlanner();
        if (!alive || token !== request) return;
        const sessions = (plannedSessions || []).map(s => mapSessionToGoal(s, courses)).filter(Boolean) as GoalEvent[];
        const all = [...events, ...sessions];
        const selection = readFeatured();
        const upcoming = all.filter(e => e.id !== selection.id).map(e => nextOccurrence(e)).filter(Boolean) as GoalEvent[];
        setUpcomingEvents(upcoming.sort((a,b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')).slice(0,5));
        const source = all.find(e => e.id === selection.id) || selection.event;
        setGoalEvent(selection.id && source ? (nextOccurrence(source) || source) as GoalEvent : null);
      } catch { /* A read failure must never erase the pin or last displayed data. */ }
    };
    void hydrateFeatured().then(refresh);
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    window.addEventListener(FEATURED_CHANGED, refresh);
    window.addEventListener(PLANNER_CHANGED, refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(FEATURED_CHANGED, refresh);
      window.removeEventListener(PLANNER_CHANGED, refresh);
    };
  }, [plannedSessions, courses]);

  // Greeting, heatmap and dates change by minute. Seconds stay inside LiveClock.
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const tick=()=>{const now=new Date();setCt(now);timer=setTimeout(tick,60000-now.getSeconds()*1000-now.getMilliseconds());};
    tick();return()=>clearTimeout(timer);
  },[]);


  const streak = useMemo(() => calculateStreak(weeklyStudyTime, settings?.dailyGoal ?? 240, settings?.dailyGoalHistory, settings?.initialDailyGoal), [weeklyStudyTime, settings?.dailyGoal, settings?.dailyGoalHistory, settings?.initialDailyGoal, format(new Date(), 'yyyy-MM-dd')]);
  const phrase = useMemo(() => getWeeklyPhrase(), []);
  const [phraseEditing, setPhraseEditing] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState('');
  const [phraseLocked, setPhraseLocked] = useState(() => localStorage.getItem('owa_phrase_locked') === 'true');
  const [phraseCustom, setPhraseCustom] = useState(() => localStorage.getItem('owa_phrase_custom') || '');
  const displayPhrase = phraseCustom || phrase;
  const handleSavePhrase = useCallback(() => {
    const trimmed = phraseDraft.trim();
    if (trimmed) {
      try { localStorage.setItem('owa_phrase_custom', trimmed); } catch { /* cuota */ }
      setPhraseCustom(trimmed);
    } else {
      localStorage.removeItem('owa_phrase_custom');
      setPhraseCustom('');
    }
    setPhraseEditing(false);
  }, [phraseDraft]);
  const handleCancelPhrase = useCallback(() => {
    setPhraseEditing(false);
    setPhraseDraft('');
  }, []);
  const togglePhraseLock = useCallback(() => {
    const next = !phraseLocked;
    setPhraseLocked(next);
    try { localStorage.setItem('owa_phrase_locked', String(next)); } catch { /* cuota */ }
  }, [phraseLocked]);
  useEffect(() => {
    if (settings && !settings.heatmapStartDate && updateSettings) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToSub = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mondayOfThisWeek = subDays(today, daysToSub);
      const startMon = subWeeks(mondayOfThisWeek, 15);
      updateSettings({ heatmapStartDate: format(startMon, 'yyyy-MM-dd') });
    }
  }, [settings, updateSettings]);

  const heatmapData = useMemo(() => {
    const today = new Date();
    const grid: { level: number; tooltip: string }[][] = [];

    const dayOfWeekToday = today.getDay();
    const daysToSubToday = dayOfWeekToday === 0 ? 6 : dayOfWeekToday - 1;
    const mondayOfThisWeek = subDays(today, daysToSubToday);
    const defaultStart = subWeeks(mondayOfThisWeek, 15);

    const configuredStart = settings?.heatmapStartDate ? parseISO(settings.heatmapStartDate) : defaultStart;
    const startOfWeekConfigured = startOfWeek(configuredStart, { weekStartsOn: 1 });

    const weeksDiff = Math.floor((mondayOfThisWeek.getTime() - startOfWeekConfigured.getTime()) / (7 * 24 * 60 * 60 * 1000));

    let baseMonday = startOfWeekConfigured;
    if (weeksDiff > 15) {
      baseMonday = subWeeks(mondayOfThisWeek, 15);
    }

    for (let r = 0; r < 7; r++) {
      const rowCells: { level: number; tooltip: string }[] = [];
      for (let c = 0; c < 16; c++) {
        const targetDate = addDays(addWeeks(baseMonday, c), r);
        const dayStr = format(targetDate, 'yyyy-MM-dd');

        const secondsStudied = weeklyStudyTime[dayStr] || 0;
        const isFuture = targetDate.getTime() > today.getTime();

        const goalForDay = getGoalForDay(dayStr, settings?.dailyGoal ?? 240, settings?.dailyGoalHistory, settings?.initialDailyGoal);
        const goalSeconds = goalForDay * 60;

        const met = secondsStudied >= goalSeconds && secondsStudied > 0;
        const pct = goalSeconds > 0 ? secondsStudied / goalSeconds : 0;
        const level = isFuture ? 0 : met ? 4 : pct >= 0.75 ? 3 : pct >= 0.25 ? 2 : pct > 0 ? 1 : 0;

        const dateFormatted = format(targetDate, "d 'de' MMM", { locale: es });
        const minutesStudied = Math.floor(secondsStudied / 60);

        const tooltip = isFuture
          ? `${dateFormatted}: Dia futuro`
          : `${dateFormatted}: ${minutesStudied}m / ${goalForDay}m (${Math.round(pct * 100)}%) ${met ? 'Meta cumplida' : ''}`;

        rowCells.push({ level, tooltip });
      }
      grid.push(rowCells);
    }
    return grid;
  }, [weeklyStudyTime, settings?.heatmapStartDate, settings?.dailyGoal, settings?.dailyGoalHistory, settings?.initialDailyGoal, format(ct,'yyyy-MM-dd')]);

  const ts = useMemo(() => ({
    active: tasks.filter(t => t.status !== 'completado').length,
    total: notes.filter(n => !n.deletedAt && !n.isCoursePrivate && (n.title || n.content)).length,
  }), [tasks, notes]);

  const dailyGoalMinutes = settings?.dailyGoal ?? 240;
  const dailyPct = useMemo(() => {
    if (!dailyGoalMinutes || dailyGoalMinutes <= 0) return 0;
    return Math.min(100, Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100));
  }, [dailyStudyTime, dailyGoalMinutes]);
  const todayAchieved = dailyGoalMinutes > 0 && dailyStudyTime >= dailyGoalMinutes * 60;

  const recentTracks = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof tracks = [];
    const byId=new Map(tracks.map(track=>[track.id,track]));
    for (const id of trackHistory) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = byId.get(id);
      if (t) result.push(t);
      if (result.length >= 4) break;
    }
    return result;
  }, [trackHistory, tracks]);



  return (
    <div className="page-container flex flex-col h-full overflow-y-auto custom-scroll" style={{ gap: 20 }}>

      {/* HEADER */}
      <header className="workspace-home-header flex justify-between items-end gap-6 pt-1" style={{ paddingBottom: 10, marginBottom: 2 }}>
        <div className="flex-1 min-w-0">
          <div className="hidden sm:flex items-center gap-2" style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
            {(() => {
              const h = ct.getHours();
              return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
            })()}, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{settings.userName || 'Avery'}</span>
          </div>
          {phraseEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <input value={phraseDraft} onChange={e => setPhraseDraft(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSavePhrase(); if (e.key === 'Escape') handleCancelPhrase(); }}
                style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 8, padding: '0 12px', fontSize: 15, fontFamily: "'Inter Tight', sans-serif", fontWeight: 500, border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }} />
              <button data-ui-control="" onClick={togglePhraseLock} title={phraseLocked ? 'Desbloquear frase' : 'Bloquear frase'}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'none', border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: phraseLocked ? '#F59E0B' : 'var(--text-muted)', flexShrink: 0, transition: 'all 150ms' }}>
                <Lock size={13} />
              </button>
              <button data-ui-control="" onClick={handleSavePhrase} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Check size={14} />
              </button>
              <button data-ui-control="" onClick={handleCancelPhrase} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', maxWidth: '100%' }} onClick={() => { setPhraseDraft(displayPhrase); setPhraseEditing(true); }}>
              <h1 className="home-study-phrase" style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 500, fontSize: 'clamp(18px, 3.2vw, 34px)', lineHeight: 1.5, letterSpacing: '0.01em', color: 'var(--text-secondary)', margin: 0 }}>
                {displayPhrase}
              </h1>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <NotificationBell />
          <WorkspaceClock className="home-clock"/>
        </div>
      </header>

      {/* ROW 1: STAT CARDS + META DIARIA */}
      <div className="home-metrics grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Tareas', val: ts.active, sub: 'Pendientes', color: '#3B82F6', IconC: CheckSquare },
          { label: 'Notas', val: ts.total, sub: 'Guardadas', color: '#10B981', IconC: FileText },
          { label: 'Racha', val: streak, sub: 'días', color: '#F59E0B', IconC: Flame },
        ].map((s, i) => {
          const active = i === 2 && streak > 0 && todayAchieved;
          const c = s.color;
          return (
            <div key={i} className={(i === 2 ? "col-span-2 lg:col-span-1" : "col-span-1") + " bento-card home-stat-card"}
              style={{
                display: 'flex', overflow: 'hidden',
                background: `linear-gradient(135deg, var(--bg-elevated) 0%, color-mix(in srgb, ${c}02, var(--bg-base)) 100%)`,
                border: `1px solid ${active ? `${c}30` : 'var(--border-subtle)'}`,
                borderRadius: 14,
                boxShadow: active
                  ? `0 0 24px ${c}0a, 0 1px 2px rgba(0,0,0,0.06)`
                  : '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 350ms cubic-bezier(0.16,1,0.3,1)',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = active ? `${c}50` : 'var(--border-default)';
                e.currentTarget.style.boxShadow = active ? `0 0 36px ${c}14, 0 4px 12px rgba(0,0,0,0.10)` : '0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(-1.5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = active ? `${c}30` : 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = active ? `0 0 24px ${c}0a, 0 1px 2px rgba(0,0,0,0.06)` : '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
              <div style={{
                width: 64, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.IconC size={21} style={{
                  color: active ? '#F59E0B' : c,
                  opacity: active ? 1 : 0.7,
                  fill: i === 2 && active ? '#F59E0B' : 'transparent',
                  filter: active ? `drop-shadow(0 0 8px ${c}50)` : 'none',
                }} />
              </div>
              <div className="home-stat-copy">
                <div className="home-stat-heading"><strong>{s.val}</strong><span style={{color:c}}>{s.label}</span></div>
                <span className="home-stat-description">{s.sub}</span>
              </div>
            </div>
          );
        })}

        {/* META DIARIA */}
        {(() => {
          const configuredGoal = settings?.dailyGoal ?? 240;
          const goalM = Number.isFinite(configuredGoal) ? Math.max(0, configuredGoal) : 240;
          const seconds = Number.isFinite(dailyStudyTime) ? Math.max(0, dailyStudyTime) : 0;
          const doneM = Math.floor(seconds / 60);
          const pct = goalM > 0 ? Math.min(100, seconds / (goalM * 60) * 100) : 0;
          const rem = Math.max(0, Math.ceil((goalM * 60 - seconds) / 60));
          const a = settings?.accentColor || 'var(--accent)';
          const met = goalM > 0 && seconds >= goalM * 60;
          return (
            <div className="col-span-2 bento-card home-daily-goal"
              style={{
                padding: '16px 20px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                background: `linear-gradient(135deg, var(--bg-elevated) 0%, color-mix(in srgb, ${a}02, var(--bg-base)) 100%)`,
                border: `1px solid ${met ? `${a}30` : 'var(--border-subtle)'}`,
                borderRadius: 14,
                boxShadow: met ? `0 0 28px ${a}08, 0 1px 2px rgba(0,0,0,0.06)` : '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 350ms cubic-bezier(0.16,1,0.3,1)',
              }}>
              {met && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 85% 15%, ${a}0d 0%, transparent 50%)`, pointerEvents: 'none' }} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${a}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${a}14` }}>
                    <Target size={13} style={{ color: a }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text-tertiary)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>META DIARIA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: met ? a : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, letterSpacing: '-0.03em' }}>{doneM}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>/{goalM} min</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${a}, ${a}77)`, width: `${pct}%`, transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: met ? a : 'var(--text-secondary)' }}>
                  {goalM === 0 ? 'Configura tu meta en Ajustes' : met ? 'Meta cumplida' : `Restan ${rem} min`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {met && <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>{'\u2713'} Completada</span>}
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                    fontFamily: "'JetBrains Mono', monospace",
                    background: met ? `${a}0a` : 'var(--bg-hover)',
                    padding: '2px 8px', borderRadius: 4,
                    border: met ? `1px solid ${a}18` : 'none',
                  }}>
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* â'€â'€ ROW 2: HEATMAP + RECIENTES â'€â'€ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">

        {/* HEATMAP */}
        <div className="xl:col-span-6 bento-card home-activity" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
          <div>
            <span className="block" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>ACTIVIDAD (4 MESES)</span>
          </div>
          <div className="home-activity-grid" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <div className="home-activity-days hidden sm:flex" style={{ flexDirection: 'column', justifyContent: 'space-between', height: 130, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div className="home-activity-matrix" style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: 'repeat(16, 1fr)', gap: 4, flex: 1, height: 130 }}>
              {heatmapData.flatMap((r, ri) => r.map((cell, ci) => (
                <div key={`${ri}-${ci}`} data-level={cell.level} title={cell.tooltip} style={{ borderRadius: 2, background: hl(cell.level), '--heatmap-cell': hl(cell.level), boxShadow: cell.level >= 3 ? '0 0 6px var(--accent-glow)' : 'none', transition: 'all 120ms' } as React.CSSProperties} className="hover:scale-110 cursor-pointer" />
              )))}
            </div>
          </div>
          <div className="hidden sm:flex" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            <span>Menos</span>
            {[0, 1, 2, 3, 4].map(l => <div key={l} style={{ width: 10, height: 10, borderRadius: 2, background: hl(l) }} />)}
            <span>Mas</span>
          </div>
        </div>

        {/* RECIENTES: Canciones */}
        <div className="xl:col-span-6 hidden sm:flex bento-card" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>RECIENTES</span>
            <span onClick={() => setNavigateTo?.('musica')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ir a Musica</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: recentTracks.length ? 'repeat(4, minmax(0, 1fr))' : '1fr',
            gap: 12,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'start'
          }}>
            {recentTracks.length > 0 ? (
              recentTracks.slice(0, 4).map((track, idx) => (
                <div key={track.id} className={idx >= 3 ? 'hidden lg:block' : ''} style={{
                  background: 'var(--bg-deep)',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxWidth: '160px',
                  margin: '0 auto',
                  width: '100%'
                }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                    {track.coverImage||track.coverUrl ? (
                      <img src={track.coverImage||track.coverUrl} loading="lazy" decoding="async" alt={'Portada de '+track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Music size={20} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="home-music-empty">
                <Music size={28} strokeWidth={1.5} />
                <strong>Tu música, a mano</strong>
                <p>Las canciones que escuches aparecerán aquí.</p>
                <button data-ui-control="" className="btn-secondary" onClick={() => setNavigateTo?.('musica')}>Abrir biblioteca</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* â'€â'€ ROW 3: TASKS + NOTES + SYSTEM â'€â'€ */}
      <div className="home-overview-grid grid gap-4 mb-2">

        {/* TASKS */}
        <div className="home-overview-card bento-card" style={{ padding: '18px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.07, pointerEvents: 'none', lineHeight: 0 }}>
            <CheckSquare size={120} strokeWidth={1} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>TAREAS</span>
            <span onClick={() => setNavigateTo?.('tareas')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.filter(t => t.status !== 'completado').slice(0, 4).map(t => {
              const isDone = t.status === 'completado';
              const tr = t.dueDate ? (() => { try { const dd = t.dueDate!.includes('T') ? new Date(t.dueDate!) : new Date(t.dueDate! + 'T12:00:00'); return format(dd, 'd MMM', { locale: es }); } catch { return ''; } })() : '';
              return (
                <div key={t.id} onClick={() => { setFocusedTaskId?.(t.id); setNavigateTo?.('tareas'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, transition: 'all 150ms', cursor: 'pointer', opacity: isDone ? 0.5 : 1 }} className="hover:border-borderDark/60 group">
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: t.status === 'completado' ? '#10B981' : t.status === 'progreso' ? `${t.courseColor}50` : 'var(--bg-base)', border: `2px solid ${t.status === 'completado' ? '#10B981' : t.courseColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                    {isDone && <CheckSquare size={8} strokeWidth={3} style={{ color: '#fff' }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none' }}>{t.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.courseColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.course}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tr && <span className="hidden lg:inline" style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{tr}</span>}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${pc[t.priority]}20`, color: pc[t.priority] }}>{pcl[t.priority]}</span>
                  </div>
                </div>
              );
            })}
            {tasks.filter(t => t.status !== 'completado').length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Sin tareas pendientes</div>
            )}
          </div>
        </div>

        {/* NOTES */}
        <div className="home-overview-card bento-card" style={{ padding: '18px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.07, pointerEvents: 'none', lineHeight: 0 }}>
            <FileText size={120} strokeWidth={1} color="#10B981" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>NOTAS</span>
            <span onClick={() => setNavigateTo?.('apuntes')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.filter(n => !n.deletedAt && !n.isCoursePrivate && (n.title || n.content)).slice(0, 5).map(n => (
              <div key={n.id} onClick={() => { try { localStorage.setItem('owa_focused_note_id', n.id); } catch {} setNavigateTo?.('apuntes'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }} className="hover:border-borderDark/60 group">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title || n.content?.slice(0, 40) || 'Sin titulo'}</div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{timeAgo(n.updatedAt)}</span>
              </div>
            ))}
            {notes.filter(n => !n.deletedAt && !n.isCoursePrivate && (n.title || n.content)).length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Sin notas aun</div>
            )}
          </div>
        </div>

        {/* GOAL / DESTACADO */}
        <div className="home-overview-card home-featured-card bento-card" style={{ padding: '24px', background: 'var(--bg-surface)', border: `1px solid ${goalEvent ? `${goalEvent.color}30` : 'var(--border-subtle)'}`, borderRadius: 14, display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>

          {goalEvent ? (
            <>
              {/* Goal header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${goalEvent.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${goalEvent.color}20` }}>
                  <Star size={17} fill={goalEvent.color} style={{ color: goalEvent.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 3 }}>DESTACADO</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: goalEvent.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goalEvent.title}</div>
                </div>
                <button data-ui-control="" className="btn-ghost" aria-label="Quitar destacado" title="Quitar destacado" onClick={() => { void setFeaturedEvent(null).catch(console.error); }}><X size={16} /></button>
              </div>

              {/* Big countdown */}
              <FeaturedCountdown event={goalEvent}/>

              {/* Date label or expired message */}
              {(() => {
                try {
                  const d = new Date(goalEvent.date + 'T' + (goalEvent.allDay ? '23:59:59' : goalEvent.startTime || '23:59'));
                  const diff = d.getTime() - Date.now();
                  if (diff <= 0) return (
                    <div style={{ textAlign: 'center', padding: '2px 0' }}>
                      <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>Este evento ya comenzó</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 4 }}>Conservado hasta que lo quites de destacados</div>
                    </div>
                  );
                  return (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                      {format(d, "EEEE d 'de' MMMM", { locale: es as any })}
                      {goalEvent.startTime && !goalEvent.allDay ? ` · ${goalEvent.startTime}` : ''}
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Upcoming event beside the pinned event */}
              {upcomingEvents.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Siguientes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {upcomingEvents.slice(0,1).map(ev => {
                      const evDate = (() => { try { return new Date(ev.date + 'T' + (ev.startTime || '12:00')); } catch { return null; } })();
                      if ((ev as any)._session) return (
                        <div key={ev.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10,
                          background: `${ev.color}0a`, border: `1px solid ${ev.color}30`,
                          transition: 'all 200ms ease', cursor: 'pointer',
                        }}
                          onClick={() => { setNavigateTo('flujo'); }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${ev.color}60`; e.currentTarget.style.background = `${ev.color}14`; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = `${ev.color}30`; e.currentTarget.style.background = `${ev.color}0a`; }}>
                          <span style={{ width: 28, height: 28, borderRadius: 8, background: `${ev.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Timer size={13} style={{ color: ev.color }} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: ev.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                              Sesión{ev.durationMinutes ? ` · ${ev.durationMinutes} min` : ''}
                            </span>
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{ev.startTime}</span>
                        </div>
                      );
                      return (
                        <div key={ev.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                          background: 'transparent', border: '1px solid transparent',
                          transition: 'all 200ms ease', cursor: 'pointer',
                        }}
                          onClick={() => { setNavigateTo('flujo'); setFocusedEventId(ev.id); }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${ev.color}30`; e.currentTarget.style.background = `${ev.color}0a`; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ev.color}10`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: ev.color, textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.03em' }}>
                              {evDate ? format(evDate, 'MMM', { locale: es as any }) : ''}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: ev.color, lineHeight: 1, marginTop: 2, fontFamily: "'Inter Tight', sans-serif" }}>
                              {evDate ? format(evDate, 'd') : ''}
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                              {ev.startTime && !ev.allDay ? (
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-tertiary)' }}>{ev.startTime}</span>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>Todo el dia</span>
                              )}
                              <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                                {evDate ? format(evDate, 'd MMM', { locale: es as any }) : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Header */}
              <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.07, pointerEvents: 'none', lineHeight: 0 }}>
                <Calendar size={120} strokeWidth={1} color="var(--accent)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)', position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>PROXIMOS EVENTOS</span>
                <span onClick={() => setNavigateTo?.('flujo')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todo</span>
              </div>
              {/* Events */}
              {upcomingEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upcomingEvents.map(ev => {
                    const evDate = (() => { try { return new Date(ev.date + 'T' + (ev.startTime || '12:00')); } catch { return null; } })();
                    if ((ev as any)._session) return (
                        <div key={ev.id} style={{
                          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 11,
                          background: `${ev.color}0a`, border: `1px solid ${ev.color}30`,
                          transition: 'all 200ms ease', cursor: 'pointer',
                        }}
                          onClick={() => { setNavigateTo('flujo'); }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${ev.color}60`; e.currentTarget.style.background = `${ev.color}14`; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = `${ev.color}30`; e.currentTarget.style.background = `${ev.color}0a`; }}>
                          <span style={{ width: 30, height: 30, borderRadius: 9, background: `${ev.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Timer size={14} style={{ color: ev.color }} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: ev.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                              Sesión de estudio{ev.durationMinutes ? ` · ${ev.durationMinutes} min` : ''}
                            </span>
                          </span>
                          <span style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{ev.startTime}</span>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{evDate ? format(evDate, 'd MMM', { locale: es as any }) : ''}</span>
                          </span>
                        </div>
                    );
                    return (
                        <div key={ev.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                          background: 'transparent', border: '1px solid transparent',
                          transition: 'all 200ms ease', cursor: 'pointer',
                        }}
                          onClick={() => { setNavigateTo('flujo'); setFocusedEventId(ev.id); }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${ev.color}30`; e.currentTarget.style.background = `${ev.color}0a`; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ev.color}10`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ev.color, textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.03em' }}>
                            {evDate ? format(evDate, 'MMM', { locale: es as any }) : ''}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: ev.color, lineHeight: 1, marginTop: 2, fontFamily: "'Inter Tight', sans-serif" }}>
                            {evDate ? format(evDate, 'd') : ''}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {ev.startTime && !ev.allDay ? (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-tertiary)' }}>{ev.startTime}</span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)' }}>Todo el dia</span>
                            )}
                            <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                              {evDate ? format(evDate, 'd MMM', { locale: es as any }) : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'center', lineHeight: 1.5 }}>
                    Sin eventos proximos
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}



