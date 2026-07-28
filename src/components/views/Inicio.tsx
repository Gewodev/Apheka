import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Music, CheckSquare, FileText, Flame,
  Target, Star, Lock, Check, X
} from 'lucide-react';
import { useApp, fmtClock } from '../../store/AppContext';
import { format, subDays, subWeeks, addDays, addWeeks, startOfWeek, parseISO } from 'date-fns';
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
function toLocalDate(iso: string): string {
  try { return format(new Date(iso), 'yyyy-MM-dd'); } catch { return iso.slice(0, 10); }
}

function getGoalForDay(dayStr: string, currentGoal: number, dailyGoalHistory?: Record<string, number>, initialDailyGoal?: number): number {
  const changeDates = Object.keys(dailyGoalHistory || {}).sort();
  for (let i = changeDates.length - 1; i >= 0; i--) {
    if (changeDates[i] <= dayStr) return dailyGoalHistory![changeDates[i]];
  }
  return initialDailyGoal ?? currentGoal;
}

function calculateStreak(sessions: { startedAt: string; duration: number; isDistraction?: boolean }[], dailyGoalMin: number, dailyGoalHistory?: Record<string, number>, initialDailyGoal?: number): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Build daily totals from actual sessions (excluding distractions)
  const dailyTotals: Record<string, number> = {};
  sessions.forEach(s => {
    if (s.isDistraction) return;
    const day = toLocalDate(s.startedAt);
    dailyTotals[day] = (dailyTotals[day] || 0) + s.duration;
  });

  const metGoal = (dayStr: string): boolean => {
    const goalForDay = getGoalForDay(dayStr, dailyGoalMin, dailyGoalHistory, initialDailyGoal);
    if (goalForDay <= 0) return false;
    const studied = dailyTotals[dayStr];
    return studied !== undefined && studied > 0 && studied >= goalForDay * 60;
  };

  const startDay = metGoal(todayStr) ? todayStr :
                   metGoal(yesterdayStr) ? yesterdayStr : null;

  if (!startDay) return 0;

  let s = 1;
  let d = subDays(new Date(startDay), 1);
  let maxLookback = 365;
  while (maxLookback-- > 0 && metGoal(format(d, 'yyyy-MM-dd'))) {
    s++;
    d = subDays(d, 1);
  }
  return s;
}

interface GoalEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  allDay?: boolean;
  color: string;
}

const GOAL_KEY = 'owa_planned_goal';
const STORE_KEY = 'owa_planner_v3';

function loadGoalEvent(): GoalEvent | null {
  try {
    const goalId = localStorage.getItem(GOAL_KEY);
    if (!goalId) return null;
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const ev = (data.events || []).find((e: any) => e.id === goalId);
    if (!ev) return null;
    return { id: ev.id, title: ev.title, date: ev.date, startTime: ev.startTime, allDay: ev.allDay, color: ev.color };
  } catch { return null; }
}

const hl = (l: number) =>
  l === 0 ? 'var(--bg-deep)' : l === 1 ? 'var(--accent-dim)' : l === 2 ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : l === 3 ? 'color-mix(in srgb, var(--accent) 65%, transparent)' : 'var(--accent)';

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

export default function Inicio() {
  const app = useApp();
  const {
    tasks = [],
    notes = [],
    sessionTime = 0,
    settings,
    dailyStudyTime = 0,
    weeklyStudyTime = {},
    toggleTimer,
    isTimerActive = false,
    isRest = false,
    sessionType = 'pomodoro',
    tracks = [],
    trackHistory = [],
    studySessions = [],
    updateSettings,
    setNavigateTo,
  } = app || {};
  const [ct, setCt] = useState(new Date());

  const [goalEvent, setGoalEvent] = useState<GoalEvent | null>(() => loadGoalEvent());
  const [goalCountdown, setGoalCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [goalExpired, setGoalExpired] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<GoalEvent[]>([]);

  const updateGoalFromStorage = useCallback(() => setGoalEvent(loadGoalEvent()), []);

  const computeUpcoming = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      const all: GoalEvent[] = (data.events || []).map((e: any) => ({
        id: e.id, title: e.title, date: e.date, startTime: e.startTime, allDay: e.allDay, color: e.color,
      }));
      const today = format(new Date(), 'yyyy-MM-dd');
      const future = all.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
      if (!goalEvent) return future.slice(0, 4);
      const afterGoal = future.filter(e => e.id !== goalEvent.id);
      return afterGoal.slice(0, 1);
    } catch { return []; }
  }, [goalEvent]);

  useEffect(() => {
    const ti = setInterval(() => {
      setCt(new Date());
      const g = loadGoalEvent();
      if (g?.id !== goalEvent?.id) setGoalEvent(g);
    }, 1000);
    const cd = setInterval(() => {
      if (!goalEvent) { setGoalCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); setGoalExpired(false); return; }
      const t = new Date(goalEvent.date + 'T' + (goalEvent.startTime || '23:59'));
      const diff = t.getTime() - Date.now();
      if (diff <= 0) {
        setGoalCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setGoalExpired(true);
        // Auto-unpin after 12h
        const hoursSince = Math.abs(diff) / 3600000;
        if (hoursSince >= 12) {
          localStorage.removeItem(GOAL_KEY);
          setGoalEvent(null);
          setGoalExpired(false);
        }
        return;
      }
      setGoalExpired(false);
      setGoalCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    const up = setInterval(() => setUpcomingEvents(computeUpcoming()), 5000);
    setUpcomingEvents(computeUpcoming());
    window.addEventListener('storage', updateGoalFromStorage);
    return () => { clearInterval(ti); clearInterval(cd); clearInterval(up); window.removeEventListener('storage', updateGoalFromStorage); };
  }, [goalEvent, updateGoalFromStorage, computeUpcoming]);

  const timeStr = fmtClock(format(ct, 'HH:mm'), settings?.timeFormat);
  const secStr = format(ct, 'ss');
  const dateStr = format(ct, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es as any });
  const dateCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const streak = useMemo(() => calculateStreak(studySessions, settings?.dailyGoal || 240, settings?.dailyGoalHistory, settings?.initialDailyGoal), [studySessions, settings?.dailyGoal, settings?.dailyGoalHistory, settings?.initialDailyGoal]);
  const phrase = useMemo(() => getWeeklyPhrase(), []);
  const [phraseEditing, setPhraseEditing] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState('');
  const [phraseLocked, setPhraseLocked] = useState(() => localStorage.getItem('owa_phrase_locked') === 'true');
  const [phraseCustom, setPhraseCustom] = useState(() => localStorage.getItem('owa_phrase_custom') || '');
  const displayPhrase = phraseCustom || phrase;
  const handleSavePhrase = useCallback(() => {
    const trimmed = phraseDraft.trim();
    if (trimmed) {
      localStorage.setItem('owa_phrase_custom', trimmed);
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
    localStorage.setItem('owa_phrase_locked', String(next));
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

        const goalForDay = getGoalForDay(dayStr, settings?.dailyGoal || 240, settings?.dailyGoalHistory, settings?.initialDailyGoal);
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
  }, [weeklyStudyTime, settings?.heatmapStartDate, settings?.dailyGoal, settings?.dailyGoalHistory, settings?.initialDailyGoal]);

  const ts = useMemo(() => ({
    active: tasks.filter(t => t.status !== 'completado').length,
    total: notes.filter(n => !n.deletedAt && !n.isCoursePrivate && (n.title || n.content)).length,
  }), [tasks, notes]);

  const dailyGoalMinutes = settings?.dailyGoal || 240;
  const dailyPct = useMemo(() => {
    if (!dailyGoalMinutes || dailyGoalMinutes <= 0) return 0;
    return Math.min(100, Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100));
  }, [dailyStudyTime, dailyGoalMinutes]);
  const todayAchieved = dailyStudyTime >= dailyGoalMinutes * 60;

  const recentTracks = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof tracks = [];
    for (const id of trackHistory) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = tracks.find(track => track.id === id);
      if (t) result.push(t);
      if (result.length >= 4) break;
    }
    return result;
  }, [trackHistory, tracks]);

  const timerM = Math.floor(sessionTime / 60);
  const timerS = sessionTime % 60;
  const timerStr = sessionTime > 0
    ? `${timerM.toString().padStart(2, '0')}:${timerS.toString().padStart(2, '0')}`
    : '25:00';

  return (
    <div className="page-container flex flex-col h-full overflow-y-auto custom-scroll" style={{ gap: 20 }}>

      {/* HEADER */}
      <header className="flex justify-between items-end gap-6 pt-1" style={{ paddingBottom: 10, marginBottom: 2 }}>
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
                style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 8, padding: '0 12px', fontSize: 15, fontFamily: "'Inter Tight', sans-serif", fontWeight: 350, border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }} />
              <button onClick={togglePhraseLock} title={phraseLocked ? 'Desbloquear frase' : 'Bloquear frase'}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'none', border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: phraseLocked ? '#F59E0B' : 'var(--text-muted)', flexShrink: 0, transition: 'all 150ms' }}>
                <Lock size={13} />
              </button>
              <button onClick={handleSavePhrase} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Check size={14} />
              </button>
              <button onClick={handleCancelPhrase} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', maxWidth: '100%' }} onClick={() => { setPhraseDraft(displayPhrase); setPhraseEditing(true); }}>
              <h1 className="truncate" style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 350, fontSize: 'clamp(18px, 3.2vw, 34px)', lineHeight: 1.5, letterSpacing: '0.01em', color: 'var(--text-secondary)', margin: 0 }}>
                {displayPhrase}
              </h1>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <NotificationBell />
          <div style={{ textAlign: 'right', paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)' }}>
            <div className="flex items-baseline gap-2 justify-end">
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(38px, 7.5vw, 82px)', fontWeight: 220, lineHeight: 0.85, color: 'var(--accent)', letterSpacing: '-0.03em', textShadow: '0 0 30px var(--accent-glow)' }}>
                {timeStr}
              </span>
              <span className="hidden sm:block" style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(12px, 2vw, 22px)', fontWeight: 300, color: 'var(--accent)', opacity: 0.35, letterSpacing: '0.02em' }}>
                {secStr}
              </span>
            </div>
            <div className="hidden xs:block" style={{ fontSize: 'clamp(8px, 0.8vw, 10px)', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.16em', marginTop: 3 }}>
              {dateCap}
            </div>
          </div>
        </div>
      </header>

      {/* ROW 1: STAT CARDS + META DIARIA */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'TAREAS', val: ts.active, sub: 'Pendientes', color: '#3B82F6', IconC: CheckSquare },
          { label: 'NOTAS', val: ts.total, sub: 'Guardadas', color: '#10B981', IconC: FileText },
          { label: 'RACHA', val: streak, sub: 'días', color: streak > 0 ? '#F59E0B' : 'var(--text-tertiary)', IconC: Flame },
        ].map((s, i) => {
          const active = i === 2 && streak > 0 && todayAchieved;
          const c = s.color;
          return (
            <div key={i} className={(i === 2 ? "col-span-2 lg:col-span-1" : "col-span-1") + " bento-card"}
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
                <s.IconC size={24} style={{
                  color: active ? '#F59E0B' : c,
                  opacity: active ? 1 : 0.7,
                  fill: i === 2 && active ? '#F59E0B' : 'transparent',
                  filter: active ? `drop-shadow(0 0 8px ${c}50)` : 'none',
                }} />
              </div>
              <div style={{ flex: 1, padding: '12px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 650, color: active ? '#F59E0B' : 'var(--text-primary)', lineHeight: 1.05, letterSpacing: '-0.02em', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 3 }}>{s.val}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 650, color: c, letterSpacing: '0.08em', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{s.label}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-default)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 }}>{s.sub}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* META DIARIA */}
        {(() => {
          const goalM = (settings?.dailyGoal || 240);
          const doneM = Math.round(dailyStudyTime / 60);
          const pct = Math.min(100, (dailyStudyTime / (goalM * 60)) * 100);
          const rem = Math.max(0, goalM - doneM);
          const a = settings?.accentColor || 'var(--accent)';
          const met = rem <= 0;
          return (
            <div className="col-span-2 bento-card"
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
                  <span style={{ fontSize: 9, fontWeight: 650, color: 'var(--text-tertiary)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>META DIARIA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: met ? a : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, letterSpacing: '-0.03em' }}>{doneM}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)' }}>/{goalM} min</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${a}, ${a}77)`, width: `${pct}%`, transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: met ? a : 'var(--text-secondary)' }}>
                  {rem <= 0 ? 'Meta cumplida' : `Restan ${rem} min`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {met && <span style={{ fontSize: 9, color: '#10B981', fontWeight: 600 }}>{'\u2713'} Completada</span>}
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
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
        <div className="xl:col-span-6 bento-card" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
          <div>
            <span className="block" style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>ACTIVIDAD (4 MESES)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <div className="hidden sm:flex" style={{ flexDirection: 'column', justifyContent: 'space-between', height: 130, color: 'var(--text-tertiary)', fontSize: 9, fontWeight: 600 }}><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: 'repeat(16, 1fr)', gap: 4, flex: 1, height: 130 }}>
              {heatmapData.flatMap((r, ri) => r.map((cell, ci) => (
                <div key={`${ri}-${ci}`} title={cell.tooltip} style={{ borderRadius: 2, background: hl(cell.level), boxShadow: cell.level >= 3 ? '0 0 6px var(--accent-glow)' : 'none', transition: 'all 120ms' }} className="hover:scale-110 cursor-pointer" />
              )))}
            </div>
          </div>
          <div className="hidden sm:flex" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            <span>Menos</span>
            {[0, 1, 2, 3, 4].map(l => <div key={l} style={{ width: 10, height: 10, borderRadius: 2, background: hl(l) }} />)}
            <span>Mas</span>
          </div>
        </div>

        {/* RECIENTES: Canciones */}
        <div className="xl:col-span-6 hidden sm:flex bento-card" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>RECIENTES</span>
            <span onClick={() => setNavigateTo?.('musica')} style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ir a Musica</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
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
                    {track.coverImage ? (
                      <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Music size={20} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                  </div>
                </div>
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={i >= 3 ? 'hidden lg:block' : ''} style={{
                  background: 'var(--bg-deep)',
                  borderRadius: 10,
                  border: '1px dashed var(--border-subtle)',
                  aspectRatio: '1/1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.4,
                  maxWidth: '160px',
                  margin: '0 auto',
                  width: '100%'
                }}>
                  <Music size={20} style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
                  <span style={{ fontSize: 8, marginTop: 4, color: 'var(--text-tertiary)' }}>Vacio</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* â'€â'€ ROW 3: TASKS + NOTES + SYSTEM â'€â'€ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 mb-2">

        {/* TASKS */}
        <div className="xl:col-span-4 md:col-span-1 bento-card" style={{ padding: '18px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.07, pointerEvents: 'none', lineHeight: 0 }}>
            <CheckSquare size={120} strokeWidth={1} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>TAREAS</span>
            <span onClick={() => setNavigateTo?.('tareas')} style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.filter(t => t.status !== 'completado').slice(0, 4).map(t => {
              const isDone = t.status === 'completado';
              const tr = t.dueDate ? (() => { try { return format(new Date(t.dueDate + 'T12:00:00'), 'd MMM', { locale: es }); } catch { return ''; } })() : '';
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, transition: 'all 150ms', opacity: isDone ? 0.5 : 1 }} className="hover:border-borderDark/60 group">
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: t.status === 'completado' ? '#10B981' : t.status === 'progreso' ? `${t.courseColor}50` : 'var(--bg-base)', border: `2px solid ${t.status === 'completado' ? '#10B981' : t.courseColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                    {isDone && <CheckSquare size={8} strokeWidth={3} style={{ color: '#fff' }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none' }}>{t.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.courseColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{t.course}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tr && <span className="hidden lg:inline" style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{tr}</span>}
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${pc[t.priority]}20`, color: pc[t.priority] }}>{pcl[t.priority]}</span>
                  </div>
                </div>
              );
            })}
            {tasks.filter(t => t.status !== 'completado').length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>Sin tareas pendientes</div>
            )}
          </div>
        </div>

        {/* NOTES */}
        <div className="xl:col-span-4 md:col-span-1 bento-card" style={{ padding: '18px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.07, pointerEvents: 'none', lineHeight: 0 }}>
            <FileText size={120} strokeWidth={1} color="#10B981" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>NOTAS</span>
            <span onClick={() => setNavigateTo?.('apuntes')} style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.filter(n => !n.deletedAt && !n.isCoursePrivate && (n.title || n.content)).slice(0, 5).map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }} className="hover:border-borderDark/60 group">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title || n.content?.slice(0, 40) || 'Sin titulo'}</div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>{timeAgo(n.updatedAt)}</span>
              </div>
            ))}
            {notes.filter(n => !n.deletedAt && !n.isCoursePrivate && (n.title || n.content)).length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>Sin notas aun</div>
            )}
          </div>
        </div>

        {/* GOAL / META PLANIFICADA */}
        <div className="xl:col-span-4 hidden xl:block bento-card" style={{ padding: '24px', background: `linear-gradient(135deg, var(--bg-elevated) 0%, color-mix(in srgb, ${goalEvent?.color || 'var(--accent)'}04, var(--bg-base)) 100%)`, border: `1px solid ${goalEvent ? `${goalEvent.color}30` : 'var(--border-subtle)'}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>

          {goalEvent ? (
            <>
              {/* Goal header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${goalEvent.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${goalEvent.color}20` }}>
                  <Star size={17} fill={goalEvent.color} style={{ color: goalEvent.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 3 }}>META PLANIFICADA</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: goalEvent.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goalEvent.title}</div>
                </div>
              </div>

              {/* Big countdown */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 0 16px', fontFamily: "'Inter Tight', sans-serif" }}>
                {[
                  { val: goalCountdown.days, label: 'dias' },
                  { val: goalCountdown.hours, label: 'hrs' },
                  { val: goalCountdown.minutes, label: 'min' },
                  { val: goalCountdown.seconds, label: 'seg' },
                ].map((u, i) => {
                  const isZero = u.val === 0 && i < 3;
                  return (
                    <React.Fragment key={u.label}>
                      {i > 0 && <div style={{ alignSelf: 'center', fontSize: 22, fontWeight: 200, color: `${goalEvent.color}40`, paddingBottom: 14 }}>:</div>}
                      <div style={{ textAlign: 'center', minWidth: 48 }}>
                        <div style={{ fontSize: 34, fontWeight: 250, lineHeight: 1, color: isZero ? 'var(--text-tertiary)' : goalEvent.color, letterSpacing: '-0.02em', transition: 'color 200ms' }}>
                          {String(u.val).padStart(2, '0')}
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>{u.label}</div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Date label or expired message */}
              {(() => {
                try {
                  const d = new Date(goalEvent.date + 'T' + (goalEvent.startTime || '23:59'));
                  const diff = d.getTime() - Date.now();
                  if (diff <= 0) return (
                    <div style={{ textAlign: 'center', padding: '2px 0' }}>
                      <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>Ha llegado el dia de tu meta</div>
                      <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 4 }}>Se desanclara automaticamente manana</div>
                    </div>
                  );
                  return (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                      {format(d, "EEEE d 'de' MMMM", { locale: es as any })}
                      {goalEvent.startTime && !goalEvent.allDay ? ` · ${goalEvent.startTime}` : ''}
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Upcoming events (2) */}
              {upcomingEvents.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Siguientes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {upcomingEvents.map(ev => {
                      const evDate = (() => { try { return new Date(ev.date + 'T' + (ev.startTime || '12:00')); } catch { return null; } })();
                      return (
                        <div key={ev.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)',
                          transition: 'all 200ms ease', cursor: 'default',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${ev.color}25`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ev.color}10`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: 8, fontWeight: 700, color: ev.color, textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.03em' }}>
                              {evDate ? format(evDate, 'MMM', { locale: es as any }) : ''}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: ev.color, lineHeight: 1, marginTop: 2, fontFamily: "'Inter Tight', sans-serif" }}>
                              {evDate ? format(ev.date, 'd') : ''}
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                              {ev.startTime && !ev.allDay ? (
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-tertiary)' }}>{ev.startTime}</span>
                              ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>Todo el dia</span>
                              )}
                              <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>PROXIMOS EVENTOS</span>
                <span onClick={() => setNavigateTo?.('flujo')} style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todo</span>
              </div>
              {/* Events */}
              {upcomingEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upcomingEvents.map(ev => {
                    const evDate = (() => { try { return new Date(ev.date + 'T' + (ev.startTime || '12:00')); } catch { return null; } })();
                    return (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)',
                        transition: 'all 200ms ease', cursor: 'default',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${ev.color}25`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ev.color}10`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: ev.color, textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.03em' }}>
                            {evDate ? format(evDate, 'MMM', { locale: es as any }) : ''}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: ev.color, lineHeight: 1, marginTop: 2, fontFamily: "'Inter Tight', sans-serif" }}>
                            {evDate ? format(ev.date, 'd') : ''}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {ev.startTime && !ev.allDay ? (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-tertiary)' }}>{ev.startTime}</span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)' }}>Todo el dia</span>
                            )}
                            <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>
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



