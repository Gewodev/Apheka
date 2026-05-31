import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Zap, Clock,
  CheckCircle, Trophy, Sparkles, Flame,
  Coffee, X, Timer, BarChart3, Plus,
  TrendingUp, AlertTriangle, Link2, Eye, Focus, Monitor, Minimize2, Maximize2
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useApp } from '../../store/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { notifySessionComplete, notifyBreakOver } from '../../lib/notifications';
import NotificationBell from '../ui/NotificationBell';
import AnalyticsDrawer from '../ui/AnalyticsDrawer';
import { DigitSVG, ColonSVG } from '../LEDDigits';

function getGoalForDay(dayStr: string, currentGoal: number, dailyGoalHistory?: Record<string, number>, initialDailyGoal?: number): number {
  const changeDates = Object.keys(dailyGoalHistory || {}).sort();
  for (let i = changeDates.length - 1; i >= 0; i--) {
    if (changeDates[i] <= dayStr) return dailyGoalHistory![changeDates[i]];
  }
  return initialDailyGoal ?? currentGoal;
}

function calculateStreak(w: Record<string, number>, dailyGoalMin: number, dailyGoalHistory?: Record<string, number>, initialDailyGoal?: number): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const metGoal = (dayStr: string): boolean => {
    const goalForDay = getGoalForDay(dayStr, dailyGoalMin, dailyGoalHistory, initialDailyGoal);
    return (w[dayStr] || 0) >= goalForDay * 60;
  };

  const startDay = metGoal(todayStr) ? todayStr :
                   metGoal(yesterdayStr) ? yesterdayStr : null;

  if (!startDay) return 0;

  let s = 1;
  let d = subDays(new Date(startDay), 1);
  while (metGoal(format(d, 'yyyy-MM-dd'))) {
    s++;
    d = subDays(d, 1);
  }
  return s;
}

const TomatoIcon = ({ size = 24, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M12 2v2" />
    <path d="M10 3a2 2 0 0 0 4 0" />
    <path d="M17 6c-2-1-5-1-7-1s-5 0-7 1c-1.5.5-2.5 2-2.5 4 0 4.5 3 11 11.5 11S23.5 14.5 23.5 10c0-2-1-3.5-2.5-4Z" />
    <path d="M10 8s1-1 2-1 2 1 2 1" />
  </svg>
);

function LEDTime({ time, color, digitWidth = 112, digitHeight = 184, colonWidth = 36 }: { time: string; color: string; digitWidth?: number; digitHeight?: number; colonWidth?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      {time.split('').map((ch, i) =>
        ch === ':' 
          ? <ColonSVG key={i} color={color} width={colonWidth} height={digitHeight} /> 
          : <DigitSVG key={i} d={ch} color={color} width={digitWidth} height={digitHeight} />
      )}
    </div>
  );
}

interface ActivityEntry {
  id: string;
  type: 'pomodoro' | 'corto' | 'largo' | 'chrono' | 'break';
  label: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  status: 'completado' | 'mitad' | 'interrumpido' | 'ronda';
  meta?: string;
  pauseCount?: number;
}


export default function Estudio() {
  const {
    tasks, courses, addSubTask, settings, dailyStudyTime, activeTaskId, setActiveTaskId,
    pomodoroSessions, incrementPomodoroSessions, studySessions,
    addStudySession, weeklyStudyTime,

    focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime, dailyFocusPomodoro, dailyFocusChrono,
    accumulatedPauseTime, distractionCount,
    addNotification, updateTask, setAccumulatedPauseTime, setIsTimerActive,
  } = useApp();

  const {
    sessionType, setSessionType, chronoRounds, setChronoRounds, chronoGoal,
    isTimerActive, isRest, setIsRest, sessionTime, setSessionTime,
    displayTime, pomodoroProgress, pomodoroGoal,
    handleToggle, handleReset, handleTypeChange,
  } = useTimer();

  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBreakResetConfirm, setShowBreakResetConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const restStartRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const breakNotifiedRef = useRef(false);

  // Persistent chrono round tracking (survives unmount/remount)
  const CHRONO_KEY_EST = 'owa_chrono_last_round'; // shared key with useTimer
  function loadChronoRound(): number {
    try { return parseInt(localStorage.getItem(CHRONO_KEY_EST) || '0', 10) || 0; } catch { return 0; }
  }
  function saveChronoRound(r: number) {
    try { localStorage.setItem(CHRONO_KEY_EST, String(r)); } catch {}
  }
  const lastChronoRoundRef = useRef(loadChronoRound());
  const mountedRef = useRef(false);
  const lastPauseTimeRef = useRef(0);

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekAgoStr = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const monthStartStr = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  // Monthly study seconds
  const monthlyStudySecs = useMemo(() => {
    let total = 0;
    for (const [day, secs] of Object.entries(weeklyStudyTime)) {
      if (day >= monthStartStr) total += secs;
    }
    return total;
  }, [weeklyStudyTime, monthStartStr]);
  const monthlyStudyFormatted = monthlyStudySecs > 0
    ? `${Math.floor(monthlyStudySecs / 3600)}h ${Math.floor((monthlyStudySecs % 3600) / 60)}m`
    : '0m';

  // Sessiones de la ultima semana para el feed (reseteo semanal visual)
  const recentSessions = useMemo(() => 
    studySessions.filter(s => s.startedAt.slice(0, 10) >= weekAgoStr),
  [studySessions, weekAgoStr]);

  const streak = useMemo(() => calculateStreak(weeklyStudyTime, settings?.dailyGoal || 240, settings?.dailyGoalHistory, settings?.initialDailyGoal), [weeklyStudyTime, settings?.dailyGoal, settings?.dailyGoalHistory, settings?.initialDailyGoal]);

  const weekDayData = useMemo(() => {
    const dn = ['D','L','M','M','J','V','S'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { l: dn[d.getDay()], v: Math.round((weeklyStudyTime[format(d, 'yyyy-MM-dd')] || 0) / 60) };
    }).reverse();
  }, [weeklyStudyTime]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // Determine if current break should be long
  const isLongBreak = isRest && pomodoroSessions > 0 && pomodoroSessions % (settings.pomodoroGoal || 4) === 0;
  const currentBreakLimit = isLongBreak ? (settings.longBreakTime || 900) : (settings.shortBreakTime || 300);
  const restElapsed = isRest ? sessionTime - restStartRef.current : 0;
  const computedRest = Math.max(0, currentBreakLimit - restElapsed);
  const computedDisplay = sessionType === 'pomodoro' ? Math.max(0, settings.pomodoroTime - sessionTime) : sessionTime;

  useEffect(() => {
    if (isTimerActive && !isRest && sessionTime >= settings.pomodoroTime && !hasTriggeredRef.current && sessionType === 'pomodoro') {
      hasTriggeredRef.current = true;
      setIsRest(true);
      restStartRef.current = sessionTime;
      incrementPomodoroSessions();
      notifySessionComplete(settings.pomodoroTime / 60);
      addStudySession({
        type: 'pomodoro',
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: sessionTime,
        taskId: activeTaskId || undefined,
        courseId: undefined,
        pauseCount: distractionCount,
        pauseDuration: accumulatedPauseTime - lastPauseTimeRef.current,
      });
      lastPauseTimeRef.current = accumulatedPauseTime;
      if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) updateTask(activeTaskId, { studyTime: (task.studyTime || 0) + Math.round(sessionTime / 60) });
      }
    }
    if (isRest || !isTimerActive || sessionType !== 'pomodoro') hasTriggeredRef.current = false;
  }, [sessionTime, isTimerActive, sessionType, isRest, settings.pomodoroTime, distractionCount, activeTaskId, tasks, updateTask]);

  useEffect(() => {
    if (!mountedRef.current) {
      if (sessionType === 'chrono' && chronoGoal > 0) {
        const r = Math.floor(sessionTime / chronoGoal);
        if (r > 0) {
          lastChronoRoundRef.current = r;
          saveChronoRound(r);
        }
      }
      mountedRef.current = true;
      return;
    }
    if (isTimerActive && sessionType === 'chrono' && chronoGoal > 0) {
      const r = Math.floor(sessionTime / chronoGoal);
      if (r > 0 && r > lastChronoRoundRef.current) {
        lastChronoRoundRef.current = r;
        saveChronoRound(r);
        setChronoRounds(r);
        addNotification(`Ronda ${r} completada (${chronoGoal / 60} min)`, 'success');
        addStudySession({
          type: 'chrono',
          startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
          endedAt: new Date().toISOString(),
          duration: chronoGoal,
          taskId: activeTaskId || undefined,
          courseId: undefined,
          pauseCount: distractionCount,
          pauseDuration: accumulatedPauseTime - lastPauseTimeRef.current,
        });
        lastPauseTimeRef.current = accumulatedPauseTime;
        if (activeTaskId) {
          const task = tasks.find(t => t.id === activeTaskId);
          if (task) updateTask(activeTaskId, { studyTime: (task.studyTime || 0) + Math.round(chronoGoal / 60) });
        }
      }
    }
  }, [sessionTime, isTimerActive, sessionType, chronoGoal, distractionCount]);

  useEffect(() => {
    if (sessionType === 'chrono' && !isTimerActive && sessionTime === 0) { lastChronoRoundRef.current = 0; saveChronoRound(0); }
  }, [sessionType, isTimerActive, sessionTime]);

  // Read linked task from localStorage (set by Tareas "Estudiar esta tarea" button)
  useEffect(() => {
    const taskId = localStorage.getItem('owa_study_task_id');
    if (taskId) {
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        setActiveTaskId(taskId);
        addNotification(`Estudiando: ${found.title}`, 'success');
      }
      localStorage.removeItem('owa_study_task_id');
      localStorage.removeItem('owa_study_task_title');
    }
  }, []);

  useEffect(() => {
    if (isRest && restElapsed >= currentBreakLimit && !breakNotifiedRef.current) {
      breakNotifiedRef.current = true;
      setIsRest(false);
      setSessionTime(0);
      setIsTimerActive(false);
      notifyBreakOver();
      addNotification(isLongBreak ? 'Descanso largo completado' : 'Descanso completado', 'success');
    }
    if (!isRest) breakNotifiedRef.current = false;
  }, [restElapsed, isRest, currentBreakLimit, isLongBreak]);

  const unlinkTask = () => { 
    if (isTimerActive) return;
    setActiveTaskId(null); 
    addNotification('Sesion completada', 'success'); 
  };

  const isBreakTime = isRest;
  const focusColor = settings.timerFocusColor || '#E11D48';
  const breakColor = settings.timerBreakColor || '#10B981';
  const chronoColor = settings.timerChronoColor || '#3B82F6';
  const statusColor = isBreakTime ? breakColor : (sessionType === 'chrono' ? chronoColor : focusColor);
  const statusText = !isTimerActive ? 'PAUSADO' : (isBreakTime ? 'DESCANSO' : 'ENFOQUE');
  const chronoRoundsNow = sessionType === 'chrono' && chronoGoal > 0 ? Math.floor(sessionTime / chronoGoal) : 0;

  const studyTotalSecs = focusPomodoroTime + focusChronoTime;
  const studyH = Math.floor(studyTotalSecs / 3600);
  const studyM = Math.floor((studyTotalSecs % 3600) / 60);
  const studyFormatted = studyH > 0 ? `${studyH}h ${studyM}m` : `${studyM}m`;

  const efficiencyPct = isTimerActive || sessionTime > 0
    ? Math.max(0, Math.min(100, Math.round(100 - ((accumulatedPauseTime / Math.max(1, sessionTime)) * 100))))
    : 100;

  // Daily trend: compare today vs yesterday
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayStudySecs = weeklyStudyTime[yesterdayStr] || 0;
  const yesterdaySessions = studySessions.filter(s => s.startedAt.startsWith(yesterdayStr)).length;
  const yesterdayDistractions = 0; // not persisted daily, show neutral
  const yesterdayEfficiency = 75; // fallback

  const activityFeed: ActivityEntry[] = useMemo(() => {
    const entries: ActivityEntry[] = [];
    const sortedSessions = [...recentSessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 15);
    
    for (const s of sortedSessions) {
      const isFull = s.type === 'pomodoro' ? s.duration >= settings.pomodoroTime : s.duration > 0;
      const isHalf = s.type === 'pomodoro' ? s.duration >= settings.pomodoroTime / 2 : true;
      let status: ActivityEntry['status'] = 'mitad';
      if (isFull) status = 'completado';
      else if (isHalf) status = 'mitad';
      
      let label = s.type === 'pomodoro' ? 'Pomodoro' : (s.type === 'chrono' ? 'Cronómetro' : 'Descanso');
      
      const completionTime = s.endedAt ? format(new Date(s.endedAt), 'HH:mm') : format(new Date(), 'HH:mm');
      
      entries.push({
        id: s.id,
        type: s.type as any,
        label,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        duration: s.duration,
        status: status as any,
        meta: completionTime,
        pauseCount: s.pauseCount || 0
      });
    }
    return entries;
  }, [studySessions, settings.pomodoroTime]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const win = getCurrentWebviewWindow();
        setIsFullscreen(await win.isFullscreen());
      } catch { /* web mode */ }
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  const tf = async () => {
    try {
      const win = getCurrentWebviewWindow();
      const current = await win.isFullscreen();
      await win.setFullscreen(!current);
      setIsFullscreen(!current);
    } catch {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    }
  };

  const donutDataRaw = useMemo(() => [
    { name: 'Pomodoro', value: focusPomodoroTime, color: focusColor },
    { name: 'Cronómetro', value: focusChronoTime, color: chronoColor },
    { name: 'Descanso', value: breakTime, color: breakColor },
  ], [focusPomodoroTime, focusChronoTime, breakTime, focusColor, chronoColor, breakColor]);
  const totalDonut = focusPomodoroTime + focusChronoTime + breakTime;
  const donutSegments = useMemo(() => {
    if (totalDonut === 0) return [{ name: 'Sin Actividad', value: 1, color: 'var(--bg-hover)', startAngle: 0, endAngle: 360 }];
    const GAP = 10;
    const PAD = 1.5;
    const active = donutDataRaw.filter(d => d.value > 0);
    const numGaps = active.length - 1;
    const gapPerSegment = numGaps > 0 ? GAP / numGaps : 0;
    const totalAngle = 360 - numGaps * gapPerSegment;
    let currentAngle = 0;
    return active.map((d, i) => {
      const angle = (d.value / totalDonut) * totalAngle;
      const seg = {
        ...d,
        startAngle: currentAngle + i * gapPerSegment + PAD,
        endAngle: currentAngle + i * gapPerSegment + angle - PAD,
      };
      currentAngle += angle;
      return seg;
    });
  }, [donutDataRaw, totalDonut]);

  function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const s = polarToCartesian(cx, cy, r, endDeg);
    const e = polarToCartesian(cx, cy, r, startDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
  }

  return (
    <div className="page-container h-full flex flex-col" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', gap: 0, padding: '0 0 16px 0' }}>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 40, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 0 20px var(--accent-glow)' }}>Estudio</h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 400, letterSpacing: '0.02em' }}>Tu concentración, tu ritmo.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={tf} style={{ padding: 8, borderRadius: '50%', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:text-white hover:border-borderDefault" title="Pantalla completa">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {/* Floating timer toggle — opens always-on-top floating timer window */}
            <button onClick={() => invoke('open_floating_timer')} style={{
              padding: 8, borderRadius: '50%', background: 'var(--bg-deep)',
              border: '1px solid var(--border-soft)', color: 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} className="hover:text-white hover:border-borderDefault" title="Ventana flotante del timer">
              <Monitor size={16} />
            </button>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0" style={{ paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', right: 0, width: 150, height: 100, background: `radial-gradient(circle at center, var(--text-muted) 0%, transparent 70%)`, opacity: 0.1, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-tertiary)', position: 'relative', zIndex: 1 }} />
            <NotificationBell />
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div className="flex items-baseline gap-2 justify-end">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200, lineHeight: 0.9, color: 'var(--text-secondary)', letterSpacing: '0.02em', transition: 'color 300ms' }}>
                  {format(currentTime, 'HH:mm')}
                </span>
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200, color: 'var(--text-tertiary)', opacity: 0.7, letterSpacing: '0.02em', transition: 'color 300ms' }}>
                  {format(currentTime, 'ss')}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 6 }}>
                {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN TWO-COLUMN DASHBOARD LAYOUT */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        {/* LEFT COLUMN: Timer & Bottom Statistics */}
        <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          
          {/* TIMER PANEL (Slightly more compact vertically) */}
          <div className="bento-card" style={{ padding: '24px 32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            
            {/* Mode Type Header */}
            <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
              {[
                { id: 'pomodoro', label: 'Pomodoro', icon: TomatoIcon },
                { id: 'chrono', label: 'Cronómetro', icon: Timer },
              ].map(mode => {
                const active = sessionType === mode.id && !isBreakTime;
                const blocked = (isTimerActive || isBreakTime) && !active;
                const Icon = mode.icon;
                return (
                  <button key={mode.id} onClick={() => handleTypeChange(mode.id as any)}
                    style={{
                      padding: '8px 24px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.04em', cursor: blocked ? 'not-allowed' : 'pointer', border: 'none', textTransform: 'uppercase',
                      background: active ? `linear-gradient(135deg, ${statusColor}15, ${statusColor}05)` : 'transparent',
                      color: active ? statusColor : blocked ? 'var(--text-muted)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 8, transition: 'all 300ms',
                      position: 'relative', opacity: blocked ? 0.4 : 1,
                    }}
                  >
                    <Icon size={14} color={active ? statusColor : 'currentColor'} />
                    {mode.label}
                    {active && <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, background: statusColor, borderRadius: 2, boxShadow: `0 0 8px ${statusColor}80` }} />}
                  </button>
                );
              })}
            </div>

            {/* Glowing Segmented Timer */}
            <div style={{ position: 'relative', margin: '16px 0', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 200, background: `radial-gradient(ellipse, ${statusColor}08 0%, transparent 65%)`, pointerEvents: 'none' }} />
              <LEDTime 
                time={isBreakTime ? fmt(computedRest) : fmt(computedDisplay)} 
                color={statusColor} 
                digitWidth={112} 
                digitHeight={184} 
                colonWidth={36} 
              />
            </div>

            {/* Linked Task Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, background: activeTask ? `${activeTask.courseColor || statusColor}10` : 'var(--bg-deep)', border: `1px solid ${activeTask ? `${activeTask.courseColor || statusColor}30` : 'var(--border-subtle)'}`, marginTop: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: activeTask ? (activeTask.courseColor || statusColor) : 'var(--text-muted)', boxShadow: activeTask ? `0 0 6px ${activeTask.courseColor || statusColor}80` : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: activeTask ? 600 : 400, color: activeTask ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {activeTask ? activeTask.title : 'Sin tarea vinculada'}
              </span>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginTop: 12, marginBottom: 8 }}>
              <button onClick={() => { if (isBreakTime && isTimerActive) { setShowBreakResetConfirm(true); } else { handleReset(); } }}
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  cursor: isTimerActive ? (isBreakTime ? 'pointer' : 'not-allowed') : 'pointer',
                  border: isBreakTime && isTimerActive ? `1px solid #F59E0B50` : '1px solid var(--border-soft)',
                  background: isBreakTime && isTimerActive ? '#F59E0B10' : 'var(--bg-deep)',
                  color: isBreakTime && isTimerActive ? '#F59E0B' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 200ms',
                  opacity: isTimerActive && !isBreakTime ? 0.35 : 1,
                  position: 'relative',
                }}
                className="hover:text-white hover:border-borderDefault hover:bg-surfaceElevated"
                title={isBreakTime && isTimerActive ? 'Reiniciar descanso (se considera distracción)' : 'Reiniciar'}>
                <RotateCcw size={20} />
                {isBreakTime && isTimerActive && <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 6px #F59E0B80' }} />}
              </button>
              
              <button onClick={handleToggle} style={{
                width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
                border: `1px solid ${statusColor}50`,
                background: `${statusColor}15`,
                backdropFilter: 'blur(12px)',
                color: statusColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 32px rgba(0,0,0,0.15), inset 0 0 20px ${statusColor}10`,
                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${statusColor}25`; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.25), inset 0 0 24px ${statusColor}20`; e.currentTarget.style.border = `1px solid ${statusColor}80` }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${statusColor}15`; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.15), inset 0 0 20px ${statusColor}10`; e.currentTarget.style.border = `1px solid ${statusColor}50` }}
              >
                {isTimerActive ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{ marginLeft: 4 }} />}
              </button>

              <button onClick={unlinkTask} style={{ width: 56, height: 56, borderRadius: '50%', cursor: 'pointer', border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }} className="hover:text-white hover:border-borderDefault hover:bg-surfaceElevated" title="Completar sesión con tarea">
                <Link2 size={20} />
              </button>
            </div>
          </div>

          {/* COMPACT CHARTS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            
            {/* Donut Chart - distribution */}
            <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: 10 }}>Distribución</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 120, height: 120, position: 'relative', flexShrink: 0 }}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    {donutSegments.map((s, i) => {
                      const r = 42;
                      const d = describeArc(60, 60, r, s.startAngle, s.endAngle);
                      return (
                        <path key={i} d={d}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="16"
                          strokeLinecap="butt"
                          style={{ filter: s.name !== 'Sin Actividad' ? `drop-shadow(0 0 3px ${s.color}70)` : 'none', transition: 'all 300ms' }}
                        />
                      );
                    })}
                    <circle cx="60" cy="60" r="12" fill="none" stroke="var(--bg-deep)" strokeWidth="2" opacity="0.3" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {donutDataRaw.map(d => {
                    const pct = totalDonut > 0 ? Math.round((d.value / totalDonut) * 100) : 0;
                    return (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, boxShadow: `0 0 4px ${d.color}60`, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{d.name}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Progress today (customized) */}
            <div className="bento-card" style={{
              padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              background: `linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)`,
              border: `1px solid ${dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#10B98130' : 'var(--border-subtle)'}`,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Sutil glow cuando se cumple la meta */}
              {dailyStudyTime >= (settings?.dailyGoal || 240) * 60 && (
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 30%, #10B98115 0%, transparent 60%)', pointerEvents: 'none' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Progreso de Hoy</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dailyStudyTime >= (settings?.dailyGoal || 240) * 60 && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B98180' }} />
                  )}
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#10B981' : 'var(--text-secondary)',
                    background: dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#10B98110' : 'var(--bg-deep)',
                    padding: '2px 8px', borderRadius: 4,
                  }}>
                    {dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? 'META' : `${Math.min(100, Math.round((dailyStudyTime / ((settings?.dailyGoal || 240) * 60)) * 100))}%`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em' }}>
                  {Math.floor(dailyStudyTime / 3600)}<span style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-tertiary)' }}>h </span>
                  {Math.floor((dailyStudyTime % 3600) / 60)}<span style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-tertiary)' }}>m</span>
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>/ {settings?.dailyGoal || 240}min</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: dailyStudyTime >= (settings?.dailyGoal || 240) * 60
                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                    : `linear-gradient(90deg, ${settings?.accentColor || 'var(--accent)'}, #8B5CF6)`,
                  width: `${Math.min(100, (dailyStudyTime / ((settings?.dailyGoal || 240) * 60)) * 100)}%`,
                  transition: 'width 500ms ease',
                  boxShadow: dailyStudyTime >= (settings?.dailyGoal || 240) * 60
                    ? '0 0 12px #10B98160'
                    : `0 0 8px ${settings?.accentColor || 'var(--accent)'}40`,
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <Flame size={11} color={dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#F59E0B' : 'var(--text-muted)'} fill={dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#F59E0B' : 'none'} />
                <span style={{ fontSize: 10, fontWeight: 600, color: dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#F59E0B' : 'var(--text-secondary)' }}>
                  {streak} {streak === 1 ? 'día' : 'días'} consecutivos
                </span>
                {/* Monthly study time indicator */}
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                  Este mes: {monthlyStudyFormatted}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN (LATERAL): Metrics & Activity History */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          
          {/* 4 ELEGANT SIDEBAR METRICS CARD */}
          <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 300, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Inter', sans-serif" }}>
              Resumen Operativo
            </span>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Metric 1: Pure Study Time */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                <Clock size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: statusColor, opacity: 0.15 }} />
                <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Estudio Puro</span>
                <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1 }}>{studyFormatted}</span>
              </div>

              {/* Metric 2: Completed Sessions */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                <CheckCircle size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#8B5CF6', opacity: 0.15 }} />
                <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Sesiones</span>
                <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1 }}>{recentSessions.length}</span>
              </div>

              {/* Metric 3: Efficiency % */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                <Zap size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#F59E0B', opacity: 0.15 }} />
                <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Eficiencia</span>
                <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1 }}>{efficiencyPct}%</span>
              </div>

              {/* Metric 4: Distractions */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                <AlertTriangle size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#EF4444', opacity: 0.15 }} />
                <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Distracciones</span>
                <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1 }}>{distractionCount}</span>
              </div>
            </div>
          </div>

          {/* DETAILED ACTIVITY HISTORY CARD (Max 5) */}
          <div className="bento-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', minHeight: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                HISTORIAL
              </span>
              {activityFeed.length > 0 && (
                <button onClick={() => setShowAllActivity(true)} style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={10} /> Ver todo ({activityFeed.length})
                </button>
              )}
            </div>
            
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activityFeed.length > 0 ? (
                activityFeed.slice(0, 4).map((entry, i) => {
                  const isPomo = entry.type === 'pomodoro';
                  const isChrono = entry.type === 'chrono';
                  const isBreakEntry = entry.type === 'break';
                  const c = isPomo ? (settings.accentColor || '#E11D48') : isChrono ? '#3B82F6' : '#10B981';
                  const Icon = isPomo ? TomatoIcon : isBreakEntry ? Coffee : Timer;
                  const mins = Math.floor(entry.duration / 60);
                  const secs = entry.duration % 60;
                  const timeStr = entry.endedAt ? format(new Date(entry.endedAt), 'HH:mm') : '—';
                  const statusLabels: Record<string, string> = { completado: '✓', mitad: '○', fallido: '✕' };
                  const statusColors: Record<string, string> = { completado: 'var(--success)', mitad: '#F59E0B', fallido: 'var(--error)' };
                  const status = entry.meta ?? '';
                  const barW = Math.min(100, (entry.duration / Math.max(...activityFeed.slice(0, 4).map(e => e.duration), 1)) * 100);
                  return (
                    <div key={entry.id || i} style={{ display: 'flex', gap: 12, padding: '8px 12px', borderRadius: 10, background: i % 2 === 0 ? 'var(--bg-hover)' : 'transparent', transition: 'all 150ms' }} className="hover:bg-surfaceElevated">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `${c}60`, filter: `drop-shadow(0 0 4px ${c}60)` }} />
                        {i < Math.min(activityFeed.length, 4) - 1 && <div style={{ width: 1, flex: 1, background: 'linear-gradient(to bottom, var(--border-subtle), transparent)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <Icon size={11} color={c} />
                            {status && <span style={{ fontSize: 9, color: statusColors[status] || 'var(--text-tertiary)', fontWeight: 600 }}>{statusLabels[status] || status}</span>}
                          </div>
                          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap', fontFamily: "'Inter Tight', sans-serif" }}>{timeStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", minWidth: 44, letterSpacing: '0.01em' }}>
                            {mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''}
                          </span>
                          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, width: `${barW}%`, background: `linear-gradient(90deg, ${c}, ${c}80)`, transition: 'width 300ms' }} />
                          </div>
                        </div>
                        {(entry.pauseCount ?? 0) > 0 && (
                          <div style={{ fontSize: 8, color: '#F59E0B', marginTop: 2, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span>·</span> {entry.pauseCount} pausa{(entry.pauseCount ?? 0) !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg-deep)', border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TomatoIcon size={18} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>Sin actividad hoy</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Inicia un bloque de estudio para registrar tu progreso.</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* VIEW ALL MODAL (UP TO 20 ITEMS) */}
        {showAllActivity && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} onClick={() => setShowAllActivity(false)}>
            <div 
              style={{ 
                borderRadius: 16, 
                width: '100%', 
                maxWidth: 520, 
                padding: '24px 28px', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-soft)', 
                display: 'flex', 
                flexDirection: 'column',
                maxHeight: '75vh',
                boxShadow: '0 24px 64px rgba(0,0,0,0.8)'
              }} 
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Actividad</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 500 }}>{activityFeed.length} sesiones</span>
                </div>
                <button onClick={() => setShowAllActivity(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }} className="hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }} className="custom-scroll">
                {activityFeed.length > 0 ? (
                  (() => {
                    const totalSecs = activityFeed.reduce((s, e) => s + e.duration, 0);
                    const totalMins = Math.floor(totalSecs / 60);
                    const totalHours = Math.floor(totalMins / 60);
                    const totalMinRem = totalMins % 60;
                    const grouped: Record<string, typeof activityFeed> = {};
                    activityFeed.slice(0, 15).forEach(e => {
                      const d = e.startedAt ? format(new Date(e.startedAt), 'yyyy-MM-dd') : 'unknown';
                      if (!grouped[d]) grouped[d] = [];
                      grouped[d].push(e);
                    });
                    return (<>
                      <div style={{ padding: '4px 10px 10px', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em', borderBottom: '1px solid var(--border-subtle)', marginBottom: 6 }}>
                        Total: {totalHours > 0 ? `${totalHours}h ` : ''}{totalMinRem}m · {activityFeed.length} sesiones
                      </div>
                      {Object.entries(grouped).map(([dateStr, entries]) => (
                        <div key={dateStr}>
                          <div style={{ padding: '6px 10px 4px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {dateStr === format(new Date(), 'yyyy-MM-dd') ? 'Hoy' : dateStr === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') ? 'Ayer' : format(new Date(dateStr), 'd MMM', { locale: es })}
                            <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>{entries.reduce((s, e) => s + e.duration, 0) > 0 ? `${Math.floor(entries.reduce((s, e) => s + e.duration, 0) / 60)}m` : ''}</span>
                          </div>
                          {entries.map((entry, i) => {
                            const isPomo = entry.type === 'pomodoro';
                            const isChrono = entry.type === 'chrono';
                            const isBreakEntry = entry.type === 'break';
                            const c = isPomo ? (settings.accentColor || '#E11D48') : isChrono ? '#3B82F6' : '#10B981';
                            const Icon = isPomo ? TomatoIcon : isBreakEntry ? Coffee : Timer;
                            const mins = Math.floor(entry.duration / 60);
                            const secs = entry.duration % 60;
                            const timeStr = entry.endedAt ? format(new Date(entry.endedAt), 'HH:mm') : '—';
                            const dateStr = entry.startedAt ? format(new Date(entry.startedAt), 'd MMM', { locale: es }) : '';
                            const statusLabels: Record<string, string> = { completado: '✓', mitad: '○', fallido: '✕' };
                            const statusColors: Record<string, string> = { completado: 'var(--success)', mitad: '#F59E0B', fallido: 'var(--error)' };
                            const status = entry.meta ?? '';
                            const barW = Math.min(100, (entry.duration / Math.max(...activityFeed.slice(0, 15).map(e => e.duration), 1)) * 100);
                            return (
                              <div key={entry.id || i} style={{ display: 'flex', gap: 10, padding: '6px 10px', borderRadius: 6, transition: 'background 150ms' }} className="hover:bg-surfaceElevated">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, width: 8 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, filter: `drop-shadow(0 0 3px ${c}60)` }} />
                                  {i < entries.length - 1 && <div style={{ width: 1, flex: 1, background: 'linear-gradient(to bottom, var(--border-subtle), transparent)' }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                      <Icon size={9} color={c} />
                                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''}</span>
                                      {status && <span style={{ fontSize: 8, color: statusColors[status] || 'var(--text-tertiary)', marginLeft: 2 }}>{statusLabels[status] || status}</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500, fontFamily: "'Inter Tight', sans-serif" }}>{timeStr}</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', borderRadius: 1, width: `${barW}%`, background: `linear-gradient(90deg, ${c}, ${c}60)`, transition: 'width 300ms' }} />
                                    </div>
                                    {(entry.pauseCount ?? 0) > 0 && <span style={{ fontSize: 7, color: '#F59E0B', fontWeight: 500, whiteSpace: 'nowrap' }}>{entry.pauseCount}p</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>);
                  })()
                ) : (
                  <div style={{ padding: '60px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay actividad registrada.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      </div>

      {/* Break Reset Confirmation Modal */}
      {showBreakResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowBreakResetConfirm(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', borderRadius: 16,
              border: '1px solid var(--border-soft)', padding: '28px 32px',
              maxWidth: 400, width: '90%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F59E0B15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={16} color="#F59E0B" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¿Reiniciar durante descanso?</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px' }}>
              Si reinicias ahora, este descanso se marcará como <strong style={{ color: '#F59E0B' }}>distracción</strong> y no contará para tu recuperación.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Te recomendamos completar el descanso o aprovechar para repasar apuntes. Unos minutos de pausa activa mejoran tu retención.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBreakResetConfirm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Seguir descansando
              </button>
              <button onClick={() => { setShowBreakResetConfirm(false); handleReset(); }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#F59E0B', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Reiniciar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Drawer */}
      <AnalyticsDrawer
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(!showAnalytics)}
        studySessions={studySessions as any}
        tasks={tasks as any}
        settings={settings}
      />

    </div>
  );
}
