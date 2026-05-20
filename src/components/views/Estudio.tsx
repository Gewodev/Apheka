import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Zap, Clock,
  CheckCircle, Trophy, Sparkles, Flame,
  Coffee, Check, X, Timer, BarChart3,
  TrendingUp, AlertTriangle,
  Quote, Lightbulb, Focus, Activity,
  Minimize2, Maximize2, Monitor, List,
  Link2, Circle, Eye,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useApp } from '../../store/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

function calculateStreak(w: Record<string, number>): number {
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = subDays(new Date(), i);
    if ((w[format(d, 'yyyy-MM-dd')] || 0) > 0) s++; else break;
  }
  return s;
}

const tips = [
  'Hidrátate — tu cerebro funciona mejor con agua.',
  'Apaga notificaciones para mantener el enfoque.',
  'Divide tareas grandes en bloques de 25 min.',
  'Respira hondo 3 veces antes de empezar.',
  'Recompénsate al cumplir cada meta.',
  'Revisa lo avanzado cada 4 ciclos.',
  'Menos multitarea = más profundidad.',
  'El descanso no es pérdida, es recarga.',
  'El éxito es la suma de pequeños esfuerzos diarios.',
];

const segs: Record<string, boolean[]> = {
  '0': [true,true,true,true,true,true,false], '1': [false,true,true,false,false,false,false],
  '2': [true,true,false,true,true,false,true], '3': [true,true,true,true,false,false,true],
  '4': [false,true,true,false,false,true,true], '5': [true,false,true,true,false,true,true],
  '6': [true,false,true,true,true,true,true], '7': [true,true,true,false,false,false,false],
  '8': [true,true,true,true,true,true,true], '9': [true,true,true,true,false,true,true],
};

const segPolys: [number,number][][] = [
  [[14,4],[58,4],[50,12],[22,12]], // A (Top)
  [[68,14],[60,18],[60,50],[68,54]], // B (Top-Right)
  [[68,66],[60,70],[60,102],[68,106]], // C (Bottom-Right)
  [[22,108],[50,108],[58,116],[14,116]], // D (Bottom)
  [[4,66],[12,70],[12,102],[4,106]], // E (Bottom-Left)
  [[4,14],[12,18],[12,50],[4,54]], // F (Top-Left)
  [[10,60],[18,56],[54,56],[62,60],[54,64],[18,64]], // G (Middle)
];

function DigitSVG({ d, color, width = 72, height = 120 }: { d: string; color: string; width?: number; height?: number }) {
  const s = segs[d] || segs['0'];
  const pts = (poly: [number,number][]) => poly.map(p => p.join(',')).join(' ');
  return (
    <svg width={width} height={height} viewBox="0 0 72 120" style={{ display: 'block' }}>
      {segPolys.map((poly, i) => (
        <polygon key={i} points={pts(poly)}
          fill={s[i] ? color : 'rgba(255,255,255,0.015)'}
          style={{
            transition: 'fill 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            filter: s[i] ? `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 15px ${color}50)` : 'none',
          }}
        />
      ))}
    </svg>
  );
}

function ColonSVG({ color, width = 24, height = 120 }: { color: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 120" style={{ display: 'block' }}>
      <rect x={8} y={38} width={8} height={8} rx={4} ry={4} fill={color}
        style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
      <rect x={8} y={74} width={8} height={8} rx={4} ry={4} fill={color}
        style={{ filter: `drop-shadow(0 0 5px ${color}90) drop-shadow(0 0 12px ${color}50)`, transition: 'fill 150ms ease-out' }} />
    </svg>
  );
}

function LEDTime({ time, color, digitWidth = 72, digitHeight = 120, colonWidth = 24 }: { time: string; color: string; digitWidth?: number; digitHeight?: number; colonWidth?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      {time.split('').map((ch, i) =>
        ch === ':' 
          ? <ColonSVG key={i} color={color} width={colonWidth} height={digitHeight} /> 
          : <DigitSVG key={i} d={ch} color={color} width={digitWidth} height={digitHeight} />
      )}
    </div>
  );
}

function DonutChart({ pomodoro, chrono, breakTime }: { pomodoro: number; chrono: number; breakTime: number }) {
  const total = pomodoro + chrono + breakTime;
  const r = 32;
  const strokeWidth = 10;
  const circ = 2 * Math.PI * r;

  const data = [
    { label: 'Pomodoro', val: pomodoro, color: 'var(--accent)', glow: 'rgba(225,29,72,0.3)' },
    { label: 'Cronómetro', val: chrono, color: '#3B82F6', glow: 'rgba(59,130,246,0.3)' },
    { label: 'Descansos', val: breakTime, color: '#10B981', glow: 'rgba(16,185,129,0.3)' },
  ];

  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 12 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} opacity={0.3} />
        </svg>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 8 }}>Sin datos de distribución hoy</span>
      </div>
    );
  }

  let currentOffset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%', height: '100%', minHeight: 110 }}>
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <svg width="96" height="96" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} opacity={0.1} />
          {data.map((item, index) => {
            if (item.val === 0) return null;
            const percentage = item.val / total;
            const strokeLength = circ * percentage;
            const strokeOffset = circ - strokeLength + currentOffset;
            currentOffset -= strokeLength;
            return (
              <circle
                key={index}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeLength} ${circ}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{
                  transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease',
                  filter: `drop-shadow(0 0 4px ${item.color}50)`,
                }}
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            {Math.round(((pomodoro + chrono) / Math.max(1, total)) * 100)}%
          </span>
          <span style={{ fontSize: 6, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enfoque</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {data.map((item, index) => {
          const hours = Math.floor(item.val / 3600);
          const minutes = Math.floor((item.val % 3600) / 60);
          const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          const pct = Math.round((item.val / total) * 100);

          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, boxShadow: `0 0 4px ${item.color}`, flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>{timeStr}</span>
                <span style={{ fontSize: 7, fontWeight: 500, color: 'var(--text-muted)' }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyBarChart({ data, color }: { data: { l: string; v: number }[]; color: string }) {
  const maxVal = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 42, width: '100%', padding: '0 4px' }}>
      {data.map((item, index) => {
        const barHeight = Math.max(3, (item.v / maxVal) * 36);
        const isToday = index === 6;
        const barColor = isToday ? color : 'var(--border-subtle)';
        const minutes = Math.round(item.v / 60);
        return (
          <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ position: 'relative', width: '100%', height: 36, display: 'flex', alignItems: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  height: barHeight,
                  borderRadius: '3px 3px 0 0',
                  background: isToday ? `linear-gradient(to top, ${color}, ${color}dd)` : 'rgba(255, 255, 255, 0.05)',
                  border: isToday ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isToday ? `0 0 10px ${color}35` : 'none',
                  transition: 'height 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                title={`${minutes} min estudiados`}
              />
            </div>
            <span style={{ fontSize: 8, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {item.l}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ActivityEntry {
  id: string;
  type: 'pomodoro' | 'corto' | 'largo' | 'chrono';
  label: string;
  startedAt: string;
  duration: number;
  status: 'completado' | 'mitad' | 'interrumpido' | 'ronda';
  meta?: string; // HH:MM completion time
}

export default function Estudio() {
  const {
    tasks, settings, dailyStudyTime, activeTaskId, setActiveTaskId,
    pomodoroSessions, incrementPomodoroSessions, studySessions,
    addStudySession, weeklyStudyTime,
    accumulatedPauseTime, pauseStartTime, distractionCount,
    focusPomodoroTime, focusChronoTime, breakTime,
  } = useApp();

  const {
    sessionType, setSessionType, chronoRounds, setChronoRounds, chronoGoal,
    isTimerActive, isRest, setIsRest, sessionTime, setSessionTime,
    displayTime, restTimeLeft, pomodoroProgress, pomodoroGoal,
    handleToggle, handleReset, handleTypeChange,
  } = useTimer();

  const [showCompletion, setShowCompletion] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const restStartRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const tipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastChronoRoundRef = useRef(0);

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const streak = useMemo(() => calculateStreak(weeklyStudyTime), [weeklyStudyTime]);

  const weekDayData = useMemo(() => {
    const dn = ['D','L','M','M','J','V','S'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { l: dn[d.getDay()], v: weeklyStudyTime[format(d, 'yyyy-MM-dd')] || 0 };
    });
  }, [weeklyStudyTime]);

  useEffect(() => {
    tipTimerRef.current = setInterval(() => setTipIndex(p => (p + 1) % tips.length), 15000);
    return () => { if (tipTimerRef.current) clearInterval(tipTimerRef.current); };
  }, []);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const restElapsed = isRest ? sessionTime - restStartRef.current : 0;
  const computedRest = Math.max(0, settings.shortBreakTime - restElapsed);
  const computedDisplay = sessionType === 'pomodoro' ? Math.max(0, settings.pomodoroTime - sessionTime) : sessionTime;

  useEffect(() => {
    if (isTimerActive && !isRest && sessionTime >= settings.pomodoroTime && !hasTriggeredRef.current && sessionType === 'pomodoro') {
      hasTriggeredRef.current = true;
      setIsRest(true);
      restStartRef.current = sessionTime;
      incrementPomodoroSessions();
      setShowCompletion(true);
      addStudySession({
        type: 'pomodoro',
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: sessionTime,
        taskId: activeTaskId || undefined,
        courseId: undefined,
        pauseCount: distractionCount,
      });
    }
    if (isRest || !isTimerActive || sessionType !== 'pomodoro') hasTriggeredRef.current = false;
  }, [sessionTime, isTimerActive, sessionType, isRest, settings.pomodoroTime]);

  useEffect(() => {
    if (isTimerActive && sessionType === 'chrono' && chronoGoal > 0) {
      const r = Math.floor(sessionTime / chronoGoal);
      if (r > 0 && r > lastChronoRoundRef.current) {
        lastChronoRoundRef.current = r;
        setChronoRounds(r);
        toast.success(`¡Ronda ${r} completada! (${chronoGoal / 60} min)`);
      }
    }
  }, [sessionTime, isTimerActive, sessionType, chronoGoal]);

  useEffect(() => {
    if (sessionType === 'chrono' && !isTimerActive && sessionTime === 0) lastChronoRoundRef.current = 0;
  }, [sessionType, isTimerActive, sessionTime]);

  useEffect(() => {
    if (isRest && restElapsed >= settings.shortBreakTime) {
      setIsRest(false);
      handleReset();
      toast.success('Descanso completado');
    }
  }, [restElapsed, isRest, settings.shortBreakTime]);

  const unlinkTask = () => { setActiveTaskId(null); toast.success('Tarea desvinculada'); };

  const isBreakTime = isRest;
  const statusColor = isBreakTime ? '#10B981' : (sessionType === 'chrono' ? '#3B82F6' : 'var(--accent)');
  const statusText = !isTimerActive ? 'PAUSADO' : (isBreakTime ? 'DESCANSO' : 'ENFOQUE');
  const chronoRoundsNow = sessionType === 'chrono' && chronoGoal > 0 ? Math.floor(sessionTime / chronoGoal) : 0;

  const totalH = Math.floor(dailyStudyTime / 3600);
  const totalM = Math.floor((dailyStudyTime % 3600) / 60);

  // Mathematical calculations for lateral metrics
  const studyTotalSecs = focusPomodoroTime + focusChronoTime;
  const studyH = Math.floor(studyTotalSecs / 3600);
  const studyM = Math.floor((studyTotalSecs % 3600) / 60);
  const studyFormatted = studyH > 0 ? `${studyH}h ${studyM}m` : `${studyM}m`;

  let efficiencyPct = 100;
  if (studyTotalSecs > 0) {
    const pauseSecs = accumulatedPauseTime;
    const factor = (Math.cbrt(pauseSecs) / studyTotalSecs) * 100;
    efficiencyPct = Math.max(0, Math.min(100, Math.round(100 - factor)));
  }

  // Construct activity feed
  const activityFeed: ActivityEntry[] = useMemo(() => {
    const entries: ActivityEntry[] = [];
    const sortedSessions = [...studySessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    for (const s of sortedSessions) {
      const isFull = s.type === 'pomodoro' ? s.duration >= settings.pomodoroTime : s.duration > 0;
      const isHalf = s.type === 'pomodoro' ? s.duration >= settings.pomodoroTime / 2 : true;
      let status: ActivityEntry['status'] = 'mitad';
      if (isFull) status = 'completado';
      else if (isHalf) status = 'mitad';
      
      let label = '';
      if (s.type === 'pomodoro') {
        label = isFull ? 'Pomodoro Completado' : 'Pomodoro Incompleto';
      } else if (s.type === 'chrono') {
        const rds = chronoGoal > 0 ? Math.floor(s.duration / chronoGoal) : 0;
        label = rds > 0 ? `Cronómetro (${rds} Rds)` : 'Cronómetro Enfoque';
      } else {
        label = 'Sesión de Enfoque';
      }
      
      const completionTime = s.endedAt ? format(new Date(s.endedAt), 'HH:mm') : format(new Date(), 'HH:mm');
      
      entries.push({
        id: s.id,
        type: s.type as any,
        label,
        startedAt: s.startedAt,
        duration: s.duration,
        status: status as any,
        meta: completionTime,
      });
    }
    
    if (isTimerActive && sessionTime > 0) {
      const completionTime = format(new Date(), 'HH:mm');
      entries.unshift({
        id: 'current',
        type: sessionType as any,
        label: isBreakTime 
          ? 'Descanso en Curso' 
          : (sessionType === 'chrono' ? 'Cronómetro en Curso' : 'Pomodoro en Curso'),
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        duration: sessionTime,
        status: 'mitad',
        meta: completionTime,
      });
    }
    return entries;
  }, [studySessions, isTimerActive, sessionTime, sessionType, isBreakTime, settings.pomodoroTime, chronoGoal]);

  const pomoPct = Math.min(100, (sessionTime / settings.pomodoroTime) * 100);
  const restPct = isRest ? Math.min(100, (restElapsed / settings.shortBreakTime) * 100) : 0;
  const displayPct = isRest ? restPct : pomoPct;
  const totalDots = 50;
  const filledDots = Math.round((displayPct / 100) * totalDots);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const tf = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  return (
    <div className="page-container h-full flex flex-col overflow-y-auto custom-scroll" style={{ gap: 0, paddingBottom: 16, position: 'relative' }}>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Estudio</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-tertiary)' }}>
            <div style={{ width: 3, height: 10, background: 'var(--text-secondary)', borderRadius: 2 }} />
            <div style={{ width: 3, height: 16, background: 'var(--accent)', borderRadius: 2 }} />
            <div style={{ width: 3, height: 7, background: 'var(--text-secondary)', borderRadius: 2 }} />
            <div style={{ width: 3, height: 12, background: 'var(--text-tertiary)', borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={tf} style={{ padding: 6, borderRadius: 6, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', transition: 'all 200ms', display: 'flex' }}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={() => invoke('open_floating_timer')} style={{ padding: 6, borderRadius: 6, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', transition: 'all 200ms', display: 'flex' }} title="Ventana flotante">
            <Monitor size={15} />
          </button>
        </div>
      </header>

      {/* MAIN TWO-COLUMN DASHBOARD LAYOUT */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>

        {/* LEFT COLUMN: Timer & Bottom Statistics */}
        <div style={{ flex: 1.8, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          
          {/* TIMER PANEL */}
          <div className="bento-card" style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Mode pills */}
            <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 10 }}>
              {[
                { id: 'pomodoro', label: 'Pomodoro', icon: Flame },
                { id: 'chrono', label: 'Cronómetro', icon: Zap },
              ].map(mode => {
                const active = sessionType === mode.id && !isBreakTime;
                const Icon = mode.icon;
                return (
                  <button key={mode.id} onClick={() => handleTypeChange(mode.id as any)}
                    style={{
                      padding: '5px 16px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.08em', cursor: 'pointer', border: 'none', textTransform: 'uppercase',
                      background: active ? `linear-gradient(135deg, ${statusColor}20, ${statusColor}08)` : 'transparent',
                      color: active ? statusColor : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 5, transition: 'all 300ms',
                      position: 'relative',
                    }}
                  >
                    <Icon size={11} />
                    {mode.label}
                    {active && <div style={{ position: 'absolute', bottom: -1, left: '20%', right: '20%', height: 2, background: statusColor, borderRadius: 2, boxShadow: `0 0 6px ${statusColor}60` }} />}
                  </button>
                );
              })}
            </div>

            {/* Thin Elegant Status Label above clock */}
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 11,
              fontWeight: 300,
              letterSpacing: '0.3em',
              color: statusColor,
              textTransform: 'uppercase',
              marginBottom: 4,
              marginTop: 6,
              opacity: 0.8,
              transition: 'color 300ms ease',
            }}>
              {statusText}
            </div>

            {/* Glowing Segmented Timer - Enlarged width=88 height=144 */}
            <div style={{ position: 'relative', marginBottom: 12, marginTop: 4, height: 154, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, height: 160, background: `radial-gradient(ellipse, ${statusColor}06 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <LEDTime 
                time={isBreakTime ? fmt(computedRest) : fmt(computedDisplay)} 
                color={statusColor} 
                digitWidth={88} 
                digitHeight={144} 
                colonWidth={32} 
              />
            </div>

            {/* Progress dots - vanishes in Cronómetro */}
            <div style={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center', 
              marginBottom: 12, 
              justifyContent: 'center',
              height: 4,
              opacity: sessionType === 'pomodoro' ? 1 : 0,
              visibility: sessionType === 'pomodoro' ? 'visible' : 'hidden',
              transition: 'opacity 300ms, visibility 300ms'
            }}>
              {Array.from({ length: totalDots }).map((_, i) => (
                <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: i < filledDots ? statusColor : 'var(--border-subtle)', boxShadow: i < filledDots ? `0 0 4px ${statusColor}50` : 'none', transition: 'all 350ms' }} />
              ))}
            </div>

            {/* Linked task banner */}
            <div style={{ marginBottom: 12, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeTask ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 8px', borderRadius: 100, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                  <Timer size={10} style={{ color: statusColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeTask.title}
                  </span>
                  <button onClick={unlinkTask} style={{ marginLeft: 1, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex' }}>
                    <X size={8} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, border: '1px dashed var(--border-subtle)', opacity: 0.3 }}>
                  <Timer size={10} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sin tarea vinculada</span>
                </div>
              )}
            </div>

            {/* Centered Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 12 }}>
              {/* Reset */}
              <button onClick={handleReset} style={{ width: 40, height: 40, borderRadius: 12, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }} title="Reiniciar temporizador">
                <RotateCcw size={16} />
              </button>
              
              {/* Play / Pause circle */}
              <button onClick={handleToggle} style={{
                width: 64, height: 64, borderRadius: '50%', cursor: 'pointer',
                border: 'none',
                background: isTimerActive ? `linear-gradient(135deg, ${statusColor}, ${statusColor}cc)` : `linear-gradient(135deg, ${statusColor}, ${statusColor}99)`,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 35px ${statusColor}40, 0 6px 18px rgba(0,0,0,0.4)`,
                transition: 'all 300ms',
              }} className="hover:scale-105" onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 50px ${statusColor}60, 0 8px 24px rgba(0,0,0,0.5)` }} onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 35px ${statusColor}40, 0 6px 18px rgba(0,0,0,0.4)` }}>
                {isTimerActive ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" style={{ marginLeft: 3 }} />}
              </button>

              {/* Monitor button on the right */}
              <button onClick={() => invoke('open_floating_timer')} style={{ width: 40, height: 40, borderRadius: 12, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }} title="Abrir Timer Flotante (PiP)">
                <Monitor size={16} />
              </button>
            </div>

            {/* Footer Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', width: '100%', borderTop: '1px solid var(--border-soft)', paddingTop: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progreso</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {sessionType === 'pomodoro' ? `${pomodoroProgress}/${pomodoroGoal}` : `${chronoRoundsNow} Ronda(s)`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sesiones Hoy</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {studySessions.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enfoque Hoy</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {totalH}h {totalM}m
                </span>
              </div>
            </div>
          </div>

          {/* TWO CLEAN CARDS BELOW THE TIMER */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
            
            {/* CARD 1: Time Distribution Donut (Left Card) */}
            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140 }}>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Distribución de Tiempo</span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <DonutChart pomodoro={focusPomodoroTime} chrono={focusChronoTime} breakTime={breakTime} />
              </div>
            </div>

            {/* CARD 2: Combined Focus Streak & Weekly Bar Chart (Right Card) */}
            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140 }}>
              {/* Streak at the top */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-soft)', paddingBottom: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: streak > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Flame size={13} style={{ color: streak > 0 ? '#F59E0B' : 'var(--text-muted)', fill: streak > 0 ? '#F59E0B' : 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{streak} {streak === 1 ? 'Día' : 'Días'} de Racha</span>
                  <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>¡Mantén tu consistencia de estudio!</span>
                </div>
              </div>
              
              {/* Weekly study bar chart at the bottom */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4 }}>
                <WeeklyBarChart data={weekDayData} color={statusColor} />
              </div>
            </div>

          </div>

          {/* Quote row at bottom of left column */}
          <div className="bento-card" style={{ padding: '8px 14px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Quote size={12} style={{ color: 'var(--accent)', opacity: 0.3, flexShrink: 0 }} />
              <p style={{ fontSize: 8, fontStyle: 'italic', lineHeight: 1.4, color: 'var(--text-tertiary)', margin: 0 }}>"{tips[tipIndex]}"</p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (LATERAL): Metrics & Activity History */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          
          {/* 4 SIDEBAR METRICS CARD */}
          <div className="bento-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)', paddingBottom: 6 }}>Métricas de Enfoque</span>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Metric 1: Pure Study Time */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: `${statusColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={9} style={{ color: statusColor }} />
                  </div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Estudio Puro</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  {studyFormatted}
                </span>
              </div>

              {/* Metric 2: Completed Sessions */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={9} style={{ color: '#8B5CF6' }} />
                  </div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Sesiones</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  {studySessions.length} completas
                </span>
              </div>

              {/* Metric 3: Efficiency % */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={9} style={{ color: '#F59E0B' }} />
                  </div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Eficiencia</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  {efficiencyPct}%
                </span>
              </div>

              {/* Metric 4: Distractions */}
              <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={9} style={{ color: '#EF4444' }} />
                  </div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Distracciones</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  {distractionCount}
                </span>
              </div>
            </div>
          </div>

          {/* ACTIVITY HISTORY CARD */}
          <div className="bento-card" style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Activity size={12} style={{ color: 'var(--accent)' }} /> Historial de Actividad
              </span>
              <button 
                onClick={() => setShowAllActivity(true)}
                style={{ 
                  fontSize: 8, 
                  fontWeight: 700, 
                  color: 'var(--accent)', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 3,
                  transition: 'opacity 200ms'
                }}
                className="hover:opacity-80"
              >
                <Eye size={10} />
                Ver Todo
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="custom-scroll">
              {activityFeed.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Table header */}
                  <div style={{ display: 'flex', gap: 4, padding: '2px 4px', marginBottom: 4, fontSize: 7, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ width: 14 }}>Icon</span>
                    <span style={{ flex: 1 }}>Sesión / Modo</span>
                    <span style={{ width: 30, textAlign: 'right' }}>Dur.</span>
                    <span style={{ width: 26, textAlign: 'right' }}>Hora</span>
                  </div>
                  {activityFeed.slice(0, 6).map((entry, i) => {
                    const typeColors: Record<string, string> = { pomodoro: 'var(--accent)', chrono: '#3B82F6', corto: '#10B981', largo: '#8B5CF6' };
                    const c = typeColors[entry.type] || 'var(--text-muted)';
                    return (
                      <div key={entry.id || i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 4px', borderRadius: 4, fontSize: 8, transition: 'all 100ms', borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                        <div style={{ width: 14, display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: c }} />
                          </div>
                        </div>
                        <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
                        <span style={{ width: 30, textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", fontSize: 7 }}>{Math.floor(entry.duration / 60)}m</span>
                        <span style={{ width: 26, textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: 7 }}>{entry.meta || '--:--'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin actividad registrada hoy</div>
                  <div style={{ fontSize: 7, color: 'var(--text-muted)', marginTop: 2 }}>Inicia el temporizador para registrar tu primer bloque de estudio.</div>
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
                maxWidth: 460, 
                padding: '24px', 
                background: 'var(--surface-elevated)', 
                border: '1px solid var(--border-soft)', 
                display: 'flex', 
                flexDirection: 'column',
                maxHeight: '80vh',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
              }} 
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-soft)', paddingBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Activity size={14} style={{ color: 'var(--accent)' }} /> Historial de Enfoque Diario
                </h3>
                <button 
                  onClick={() => setShowAllActivity(false)} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 4 }}
                  className="hover:bg-white/5"
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }} className="custom-scroll">
                {activityFeed.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', gap: 6, padding: '4px 6px', marginBottom: 6, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ width: 14 }}>Icon</span>
                      <span style={{ flex: 1 }}>Sesión / Modo</span>
                      <span style={{ width: 40, textAlign: 'right' }}>Duración</span>
                      <span style={{ width: 36, textAlign: 'right' }}>Hora</span>
                    </div>
                    {activityFeed.slice(0, 20).map((entry, i) => {
                      const typeColors: Record<string, string> = { pomodoro: 'var(--accent)', chrono: '#3B82F6', corto: '#10B981', largo: '#8B5CF6' };
                      const c = typeColors[entry.type] || 'var(--text-muted)';
                      return (
                        <div key={entry.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px', borderRadius: 6, fontSize: 9, transition: 'all 100ms', borderBottom: '1px solid rgba(255,255,255,0.015)' }}>
                          <div style={{ width: 14, display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 4, height: 4, borderRadius: '50%', background: c }} />
                            </div>
                          </div>
                          <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)' }}>{entry.label}</span>
                          <span style={{ width: 40, textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", fontSize: 8 }}>{Math.floor(entry.duration / 60)}m {entry.duration % 60}s</span>
                          <span style={{ width: 36, textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: 8 }}>{entry.meta || '--:--'}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay actividad registrada.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* COMPLETION DIALOG */}
      {showCompletion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => setShowCompletion(false)}>
          <div style={{ borderRadius: 18, width: '100%', maxWidth: 360, padding: '32px 24px', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Sparkles size={26} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', textAlign: 'center' }}>Ciclo Completado</h2>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>¡Excelente sesión de enfoque! Tómate un respiro antes del siguiente bloque.</p>
            <button onClick={() => setShowCompletion(false)} style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 200ms', textTransform: 'uppercase', boxShadow: `0 0 20px rgba(225,29,72,0.3)` }}>
              Iniciar Descanso
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
