import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Zap, Clock,
  CheckCircle, Trophy, Sparkles, Flame,
  Coffee, X, Timer, BarChart3, Plus,
  TrendingUp, AlertTriangle, Link2, Eye, Focus, Monitor, Minimize2, Maximize2,
  Check, Minus, Brain, Volume2, BookOpen
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useApp, fmtClock, StudySession } from '../../store/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { notifySessionComplete, notifyBreakOver, sendNativeNotification } from '../../lib/notifications';
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M12 4.5c-2.8 0-5.5 1.2-6.5 3.5C4.5 10 5 15 12 22c7-7 7.5-12 6.5-14.5-1-2.3-3.7-3.5-6.5-3.5Z" />
    <path d="M12 4.5c-1 0-2.5.6-2.5 2.5s1.2 2.5 2.5 2.5 2.5-.6 2.5-2.5-1.5-2.5-2.5-2.5Z" opacity="0.15" />
    <path d="M8 8c-.8.5-1.2 1.2-1.2 2" />
    <path d="M16 8c.8.5 1.2 1.2 1.2 2" />
    <path d="M12 15.5l-1 .5v1.5l1 1 1-1v-1.5l-1-.5Z" fill={color} fillOpacity="0.2" />
    <path d="M12 2.5c-.3 0-.5.2-.5.5v1.5h1V3c0-.3-.2-.5-.5-.5Z" />
    <path d="M9.5 3.2l-.3.7 1.3.6.3-.7-1.3-.6Z" />
    <path d="M14.5 3.2l.3.7-1.3.6-.3-.7 1.3-.6Z" />
    <path d="M12 3l1.5.8-1.5.7-1.5-.7L12 3Z" fill={color} fillOpacity="0.3" />
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
  pauseDuration?: number;
  sessionEff?: number;
  evaluated?: boolean;
  volmeter?: number;
  perception?: number;
  discomfort?: number;
  mode?: string;
}


export default function Estudio() {
  const {
    tasks, courses, addSubTask, settings, dailyStudyTime, activeTaskId, setActiveTaskId,
    pomodoroSessions, incrementPomodoroSessions, studySessions,
    addStudySession, updateStudySession, weeklyStudyTime,
    dailyPerformances,
    focusPomodoroTime, focusChronoTime, breakTime, dailyBreakTime, dailyFocusPomodoro, dailyFocusChrono,
    accumulatedPauseTime, distractionCount,
    addNotification, updateTask, setAccumulatedPauseTime, setIsTimerActive,
    setDistractionCount, setShowRestPrompt,
  } = useApp();

  const {
    sessionType, setSessionType, chronoRounds, setChronoRounds, chronoGoal,
    isTimerActive, isRest, setIsRest, sessionTime, setSessionTime,
    displayTime, pomodoroProgress, pomodoroGoal,
    handleToggle, handleReset, handleTypeChange,
  } = useTimer();

  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSessionEval, setShowSessionEval] = useState(false);
  const [showFreeStudyPrompt, setShowFreeStudyPrompt] = useState(false);
  const [evalSessionId, setEvalSessionId] = useState<string | null>(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [detailSession, setDetailSession] = useState<StudySession | null>(null);
  const [evalPerception, setEvalPerception] = useState(7);
  const [evalDiscomfort, setEvalDiscomfort] = useState(2);
  const [evalVolmeter, setEvalVolmeter] = useState(10);
  const [evalMode, setEvalMode] = useState<'rendimiento' | 'tiempo'>('rendimiento');
  const [evalSubjects, setEvalSubjects] = useState<string[]>([]);
  const [evalTaskAction, setEvalTaskAction] = useState<'progress' | 'complete' | 'not_finished' | null>(null);
  const [evalStudyMode, setEvalStudyMode] = useState<'free' | 'task'>('free');
  const [evalLinkedTaskId, setEvalLinkedTaskId] = useState<string | null>(null);
  const [evalFreeText, setEvalFreeText] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const restStartRef = useRef(-1);
  const hasTriggeredRef = useRef(false);
  const breakNotifiedRef = useRef(false);

  const handleEvalAndStartRest = useCallback((saveData?: Partial<StudySession>) => {
    if (evalSessionId && saveData) {
      updateStudySession(evalSessionId, saveData);
    }
    setShowSessionEval(false);
    setShowFreeStudyPrompt(false);
    setShowRestPrompt(false);
    if (sessionType === 'pomodoro') {
      incrementPomodoroSessions();
      setIsRest(true);
      setIsTimerActive(true);
    } else {
      setIsTimerActive(false);
    }
    setSessionTime(0);
  }, [evalSessionId, sessionType, updateStudySession, incrementPomodoroSessions, setIsRest, setSessionTime, setIsTimerActive, setShowRestPrompt]);

  // Sync restStartRef when rest transitions (handles banner / FloatingTimer path)
  useEffect(() => {
    if (isRest && restStartRef.current === -1) {
      const saved = parseInt(localStorage.getItem('owa_rest_start_time') || '-1', 10);
      restStartRef.current = saved >= 0 ? saved : sessionTime;
    } else if (!isRest) {
      restStartRef.current = -1;
    }
  }, [isRest]);

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
  const restElapsed = isRest ? sessionTime - Math.max(0, restStartRef.current) : 0;
  const computedRest = Math.max(0, currentBreakLimit - restElapsed);
  const computedDisplay = sessionType === 'pomodoro' ? Math.max(0, settings.pomodoroTime - sessionTime) : sessionTime;

  useEffect(() => {
    if (isTimerActive && !isRest && sessionTime >= settings.pomodoroTime && !hasTriggeredRef.current && sessionType === 'pomodoro') {
      hasTriggeredRef.current = true;
      setIsTimerActive(false);
      sendNativeNotification('Sesión completada', 'Buen trabajo. Evalúa tu sesión.');
      notifySessionComplete(settings.pomodoroTime / 60);
      const sessionId = addStudySession({
        type: 'pomodoro',
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: sessionTime,
        taskId: activeTaskId || undefined,
        courseId: undefined,
        pauseCount: distractionCount,
        pauseDuration: accumulatedPauseTime - lastPauseTimeRef.current,
      });
      if (sessionId) {
        setEvalSessionId(sessionId);
        setEvalPerception(7);
        setEvalDiscomfort(Math.min(10, distractionCount));
        setEvalVolmeter(Math.min(20, Math.max(1, 10 - distractionCount + 5)));
        setEvalMode('rendimiento');
        setEvalFreeText('');
        if (activeTaskId) {
          const task = tasks.find(t => t.id === activeTaskId);
          setEvalTaskAction(task?.status === 'inicio' ? null : (task?.status === 'progreso' ? 'not_finished' : 'complete'));
          setEvalSubjects(courses.filter(c => task?.course === c.name).map(c => c.id));
          setShowSessionEval(true);
        } else {
          setEvalSubjects([]);
          setShowFreeStudyPrompt(true);
        }
        // Mark previous unevaluated session as distraction
        const prevPomodoros = studySessions
          .filter((s: StudySession) => s.type === 'pomodoro')
          .sort((a: StudySession, b: StudySession) => new Date(b.endedAt || b.startedAt).getTime() - new Date(a.endedAt || a.startedAt).getTime());
        if (prevPomodoros.length > 0) {
          const prev = prevPomodoros[0];
          if (prev.perception === undefined && prev.volmeter === undefined && !prev.isDistraction) {
            updateStudySession(prev.id, { isDistraction: true });
          }
        }
      }
      setShowRestPrompt(false);
      lastPauseTimeRef.current = accumulatedPauseTime;
      if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) updateTask(activeTaskId, { studyTime: (task.studyTime || 0) + Math.round(sessionTime / 60) });
      }
    }
    if (isRest || sessionType !== 'pomodoro') hasTriggeredRef.current = false;
  }, [sessionTime, isTimerActive, sessionType, isRest, settings.pomodoroTime, distractionCount, activeTaskId, tasks, updateTask]);

  useEffect(() => {
    if (isTimerActive && sessionType === 'chrono' && chronoGoal > 0) {
      const r = Math.floor(sessionTime / chronoGoal);
      if (r > 0 && r > lastChronoRoundRef.current) {
        lastChronoRoundRef.current = r;
        saveChronoRound(r);
        setChronoRounds(r);
        addNotification(`Ronda ${r} completada (${chronoGoal / 60} min)`, 'success');
        const sessionId = addStudySession({
          type: 'chrono',
          startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
          endedAt: new Date().toISOString(),
          duration: chronoGoal,
          taskId: activeTaskId || undefined,
          courseId: undefined,
          pauseCount: distractionCount,
          pauseDuration: accumulatedPauseTime - lastPauseTimeRef.current,
        });
        if (sessionId) {
          setEvalSessionId(sessionId);
          setEvalPerception(7);
          setEvalDiscomfort(Math.min(10, distractionCount));
          setEvalVolmeter(Math.min(20, Math.max(1, 10 - distractionCount + 5)));
          setEvalMode('tiempo');
          setEvalFreeText('');
          if (activeTaskId) {
            const task = tasks.find(t => t.id === activeTaskId);
            setEvalTaskAction(task?.status === 'inicio' ? null : (task?.status === 'progreso' ? 'not_finished' : 'complete'));
            setEvalSubjects(courses.filter(c => task?.course === c.name).map(c => c.id));
            setShowSessionEval(true);
          } else {
            setEvalSubjects([]);
            setShowFreeStudyPrompt(true);
          }
        }
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
      addStudySession({
        type: 'break',
        startedAt: new Date(Date.now() - restElapsed * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: restElapsed,
        taskId: undefined,
        courseId: undefined,
        pauseCount: 0,
        pauseDuration: 0,
      });
      setIsRest(false);
      setSessionTime(0);
      setIsTimerActive(false);
      notifyBreakOver();
      addNotification(isLongBreak ? 'Descanso largo completado' : 'Descanso completado', 'success');
    }
    if (!isRest) breakNotifiedRef.current = false;
  }, [restElapsed, isRest, currentBreakLimit, isLongBreak, addStudySession]);

  const unlinkTask = () => { 
    if (isTimerActive) return;
    setActiveTaskId(null); 
    addNotification('Sesion completada', 'success'); 
  };

  const handleReopenEval = (entryId: string) => {
    const session = studySessions.find(s => s.id === entryId);
    if (!session || (session.type !== 'pomodoro' && session.type !== 'chrono')) return;
    setEvalSessionId(entryId);
    setEvalVolmeter(session.volmeter ?? Math.min(20, Math.max(1, 10 - (session.pauseCount || 0) + 5)));
    setEvalFreeText('');
    setEvalPerception(session.perception ?? 7);
    setEvalDiscomfort(session.discomfort ?? Math.min(10, session.pauseCount || 0));
    setEvalMode(session.mode || 'rendimiento');
    const task = tasks.find(t => t.id === session.taskId);
    if (task) {
      setEvalTaskAction(task.status === 'inicio' ? null : (task.status === 'progreso' ? 'not_finished' : 'complete'));
      setEvalSubjects(courses.filter(c => task?.course === c.name).map(c => c.id));
      setShowSessionEval(true);
    } else {
      setEvalSubjects(session.subjects || []);
      setShowFreeStudyPrompt(true);
    }
  };

  const handleViewSession = (entryId: string) => {
    const session = studySessions.find(s => s.id === entryId);
    if (!session) return;
    setDetailSession(session);
    setShowSessionDetail(true);
  };

  const isBreakTime = isRest;
  const focusColor = settings.timerFocusColor || '#E11D48';
  const breakColor = settings.timerBreakColor || '#10B981';
  const longBreakColor = settings.timerLongBreakColor || '#F59E0B';
  const chronoColor = settings.timerChronoColor || '#3B82F6';
  const statusColor = isBreakTime ? (isLongBreak ? longBreakColor : breakColor) : (sessionType === 'chrono' ? chronoColor : focusColor);
  const statusText = !isTimerActive ? 'PAUSADO' : (isBreakTime ? 'DESCANSO' : 'ENFOQUE');
  const chronoRoundsNow = sessionType === 'chrono' && chronoGoal > 0 ? Math.floor(sessionTime / chronoGoal) : 0;

  const studyTotalSecs = focusPomodoroTime + focusChronoTime;
  const studyH = Math.floor(studyTotalSecs / 3600);
  const studyM = Math.floor((studyTotalSecs % 3600) / 60);
  const studyFormatted = studyH > 0 ? `${studyH}h ${studyM}m` : `${studyM}m`;

  const efficiencyPct = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todaysSessions = studySessions.filter(s => s.startedAt.startsWith(todayStr));
    const focusSecs = todaysSessions.reduce((acc, s) => acc + s.duration, 0);
    const pauseSecs = todaysSessions.reduce((acc, s) => acc + (s.pauseDuration || 0), 0);
    const distractions = todaysSessions.reduce((acc, s) => acc + (s.pauseCount || 0), 0);
    const total = focusSecs + pauseSecs + distractions * 60;
    return total > 0 ? Math.round(100 * focusSecs / total) : todaysSessions.length > 0 ? 100 : 0;
  }, [studySessions]);

  // Daily trend: compare today vs yesterday
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayStudySecs = weeklyStudyTime[yesterdayStr] || 0;
  const yesterdaySessions = studySessions.filter(s => s.startedAt.startsWith(yesterdayStr)).length;
  const yesterdayDistractions = 0; // not persisted daily, show neutral
  const yesterdayEfficiency = 75; // fallback

  const activityFeed: ActivityEntry[] = useMemo(() => {
    const entries: ActivityEntry[] = [];
    const sortedSessions = [...recentSessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 10);
    
    for (const s of sortedSessions) {
      const isPomo = s.type === 'pomodoro';
      const pomGoal = settings.pomodoroTime;
      const isFull = isPomo ? s.duration >= pomGoal : s.duration > 0;
      const isHalf = isPomo ? s.duration >= pomGoal / 2 : true;
      let status: ActivityEntry['status'] = 'interrumpido';
      if (isFull) status = 'completado';
      else if (isHalf) status = 'mitad';
      
      let label = s.type === 'pomodoro' ? 'Pomodoro' : (s.type === 'chrono' ? 'Cronómetro' : 'Descanso');
      
      const completionTime = s.endedAt ? (() => { try { return format(new Date(s.endedAt), 'HH:mm'); } catch { return '—'; } })() : '—';
      
      entries.push({
        id: s.id,
        type: s.type as any,
        label,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        duration: s.duration,
        status: status as any,
        meta: completionTime,
        pauseCount: s.pauseCount || 0,
        pauseDuration: s.pauseDuration || 0,
        sessionEff: s.duration + s.pauseDuration + (s.pauseCount || 0) * 60 > 0
          ? Math.round(100 * s.duration / (s.duration + s.pauseDuration + (s.pauseCount || 0) * 60))
          : 100,
        evaluated: s.perception !== undefined,
        volmeter: s.volmeter,
        perception: s.perception,
        discomfort: s.discomfort,
        mode: s.mode,
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
  const donutGradient = useMemo(() => {
    if (totalDonut === 0) return 'conic-gradient(from -90deg, var(--bg-hover) 0deg 360deg)';
    const active = donutDataRaw.filter(d => d.value > 0);
    const N = active.length;
    if (N === 0) return 'conic-gradient(from -90deg, var(--bg-hover) 0deg 360deg)';
    const GAP_DEG = 2;
    if (N === 1) return `conic-gradient(from -90deg, ${active[0].color} 0deg 360deg)`;
    const available = 360 - N * GAP_DEG;
    let currentDeg = GAP_DEG / 2;
    const stops = [`transparent 0deg ${currentDeg}deg`];
    for (let i = 0; i < N; i++) {
      const segDeg = (active[i].value / totalDonut) * available;
      stops.push(`${active[i].color} ${currentDeg}deg ${currentDeg + segDeg}deg`);
      currentDeg += segDeg;
      if (i < N - 1) {
        stops.push(`transparent ${currentDeg}deg ${currentDeg + GAP_DEG}deg`);
        currentDeg += GAP_DEG;
      } else {
        stops.push(`transparent ${currentDeg}deg 360deg`);
      }
    }
    return `conic-gradient(from -90deg, ${stops.join(', ')})`;
  }, [donutDataRaw, totalDonut]);
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
            <button onClick={tf} style={{ padding: 8, borderRadius: '50%', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Pantalla completa">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {/* Floating timer toggle — opens always-on-top floating timer window */}
            <button onClick={async () => {
              const existing = await WebviewWindow.getByLabel('floating-timer');
              if (existing) { await existing.show(); await existing.setFocus(); return; }
              const win = new WebviewWindow('floating-timer', {
                url: '/',
                title: 'Timer',
                width: 170, height: 96,
                resizable: false,
                decorations: true,
                alwaysOnTop: true,
                skipTaskbar: true,
              });
              win.once('tauri://error', () => {});
            }} style={{
              padding: 8, borderRadius: '50%', background: 'var(--bg-deep)',
              border: '1px solid var(--border-soft)', color: 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title="Ventana flotante del timer">
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
                  {fmtClock(format(currentTime, 'HH:mm'), settings?.timeFormat)}
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
          
          {/* TIMER PANEL */}
          <div className="bento-card" style={{ padding: '24px 32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            
            {/* Mode Type Header */}
            <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
              {[
                { id: 'pomodoro', label: 'Pomodoro', icon: TomatoIcon },
                { id: 'chrono', label: 'Cronómetro', icon: Timer },
              ].map(mode => {
                const active = sessionType === mode.id && !isBreakTime;
                const blocked = (isTimerActive || isBreakTime || sessionTime > 0) && !active;
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
            <div style={{ position: 'relative', margin: '10px 0 4px', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 200, background: `radial-gradient(ellipse, ${statusColor}08 0%, transparent 65%)`, pointerEvents: 'none' }} />
              <LEDTime 
                time={isBreakTime ? fmt(computedRest) : fmt(computedDisplay)} 
                color={statusColor} 
                digitWidth={112} 
                digitHeight={184} 
                colonWidth={36} 
              />
            </div>

            {/* Edge-to-edge progress dots — pomodoro only */}
            {sessionType === 'pomodoro' && !isBreakTime && (
              <div style={{ width: '100%', display: 'flex', gap: 2, justifyContent: 'space-between', marginTop: 10, marginBottom: 2 }}>
                {Array.from({ length: 60 }, (_, i) => {
                  const filled = sessionTime >= ((settings.pomodoroTime || 1500) / 60) * (i + 1);
                  return (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 1.5,
                      background: filled ? statusColor : 'var(--bg-hover)',
                      boxShadow: filled ? `0 0 4px ${statusColor}60` : 'none',
                      transition: 'background 200ms, box-shadow 200ms',
                    }} />
                  );
                })}
              </div>
            )}

            {/* Linked Task Indicator (small typography, below timer) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '5px 12px', borderRadius: 6, background: activeTask ? `${activeTask.courseColor || statusColor}08` : 'transparent', border: activeTask ? `1px solid ${activeTask.courseColor || statusColor}20` : 'none', marginTop: 20 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: activeTask ? (activeTask.courseColor || statusColor) : 'var(--text-muted)', boxShadow: activeTask ? `0 0 4px ${activeTask.courseColor || statusColor}60` : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: activeTask ? 500 : 400, color: activeTask ? 'var(--text-secondary)' : 'var(--text-muted)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {activeTask ? activeTask.title : 'Sin tarea vinculada'}
              </span>
              {activeTask && (
                <>
                  <button onClick={() => setActiveTaskId(null)} style={{ fontSize: 9, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}>
                    Desvincular
                  </button>
                  <button onClick={() => {
                    const nextStatus = activeTask.status === 'inicio' ? 'progreso' : activeTask.status === 'progreso' ? 'completado' : 'inicio';
                    updateTask(activeTaskId!, { status: nextStatus });
                    addNotification(`Tarea marcada como "${nextStatus}"`, 'success');
                  }} style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                    {activeTask.status === 'inicio' ? 'Iniciar' : activeTask.status === 'progreso' ? 'Completar' : 'Reabrir'}
                  </button>
                </>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 28, marginBottom: 8 }}>
              <div style={{ position: 'relative', width: 56, height: 56 }}>
                {isBreakTime && isTimerActive && (() => {
                  const breakElapsed = sessionTime - (restStartRef.current === -1 ? 0 : restStartRef.current);
                  const totalBreak = isLongBreak && settings.longBreakTime ? settings.longBreakTime : (settings.shortBreakTime || 300);
                  const pct = Math.min(100, Math.max(0, Math.round((breakElapsed / totalBreak) * 100)));
                  const r = 25;
                  const circ = 2 * Math.PI * r;
                  const offset = circ - (pct / 100) * circ;
                  return (
                    <svg width={56} height={56} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth={2.5} />
                      <circle cx={28} cy={28} r={r} fill="none" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 400ms ease' }} />
                    </svg>
                  );
                })()}
                <button onClick={() => setShowResetConfirm(true)}
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    cursor: 'pointer',
                    border: isBreakTime && isTimerActive ? `1px solid #F59E0B50` : '1px solid var(--border-soft)',
                    background: isBreakTime && isTimerActive ? '#F59E0B10' : 'var(--bg-deep)',
                    color: isBreakTime && isTimerActive ? '#F59E0B' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 200ms',
                    opacity: isTimerActive && !isBreakTime ? 0.35 : 1,
                    position: 'relative',
                  }}
                  title="Reiniciar (se considera distracción)">
                  <RotateCcw size={20} />
                </button>
              </div>
              
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

              <button onClick={() => {
                if (sessionTime < 60 || isBreakTime) return;
                setIsTimerActive(false);
                const nowSessionTime = sessionTime;
                if (sessionType === 'pomodoro' && nowSessionTime < (settings.pomodoroTime || 1500) * 0.5) {
                  setSessionTime(0);
                  addNotification('Sesión menor al 50%, reiniciando pomodoro', 'info');
                  return;
                }
                const sessionId = addStudySession({
                  type: sessionType,
                  startedAt: new Date(Date.now() - nowSessionTime * 1000).toISOString(),
                  endedAt: new Date().toISOString(),
                  duration: nowSessionTime,
                  taskId: activeTaskId || undefined,
                  courseId: undefined,
                  pauseCount: distractionCount,
                  pauseDuration: accumulatedPauseTime,
                });
                hasTriggeredRef.current = false;
                if (sessionType === 'chrono') {
                  lastChronoRoundRef.current = chronoGoal > 0 ? Math.floor(nowSessionTime / chronoGoal) : 0;
                  saveChronoRound(lastChronoRoundRef.current);
                }
                lastPauseTimeRef.current = accumulatedPauseTime;
                setSessionTime(0);
                setEvalSessionId(sessionId || null);
                setEvalVolmeter(Math.min(20, Math.max(1, 10 - distractionCount + 5)));
                setEvalFreeText('');
                if (activeTask) {
                  setEvalTaskAction(activeTask.status === 'inicio' ? null : (activeTask.status === 'progreso' ? 'not_finished' : 'complete'));
                  setEvalSubjects(courses.filter(c => activeTask.course === c.name).map(c => c.id));
                  setShowSessionEval(true);
                } else {
                  setEvalSubjects([]);
                  setShowFreeStudyPrompt(true);
                }
                if (activeTaskId) {
                  const task = tasks.find(t => t.id === activeTaskId);
                  if (task) updateTask(activeTaskId, { studyTime: (task.studyTime || 0) + Math.round(nowSessionTime / 60) });
                }
              }} style={{
                width: 56, height: 56, borderRadius: '50%', cursor: sessionTime >= 60 && !isBreakTime ? 'pointer' : 'not-allowed',
                border: sessionTime >= 60 && !isBreakTime ? `1px solid #10B98150` : '1px solid var(--border-soft)',
                background: sessionTime >= 60 && !isBreakTime ? '#10B98110' : 'var(--bg-deep)',
                color: sessionTime >= 60 && !isBreakTime ? '#10B981' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 200ms', opacity: sessionTime >= 60 ? 1 : 0.35,
              }} title={sessionTime < 60 ? 'Espera al menos 1 minuto' : 'Completar sesión'}>
                <CheckCircle size={22} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* COMPACT CHARTS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            
            {/* Donut Chart - distribution */}
            <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: 10 }}>Distribución</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: donutGradient,
                    mask: 'radial-gradient(circle at 60px 60px, transparent 34px, #000 34px 50px, transparent 50px)',
                    WebkitMask: 'radial-gradient(circle at 60px 60px, transparent 34px, #000 34px 50px, transparent 50px)',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                  }} />
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

            {/* PROGRESS TODAY + STREAK (replaces old Tarea Vinculada) */}
            <div className="bento-card" style={{
              padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              background: `linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)`,
              border: `1px solid ${dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? `${settings?.accentColor || 'var(--accent)'}30` : 'var(--border-subtle)'}`,
              position: 'relative', overflow: 'hidden',
            }}>
              {dailyStudyTime >= (settings?.dailyGoal || 240) * 60 && (
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 80% 30%, ${settings?.accentColor || 'var(--accent)'}15 0%, transparent 60%)`, pointerEvents: 'none' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Progreso de Hoy</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dailyStudyTime >= (settings?.dailyGoal || 240) * 60 && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: settings?.accentColor || 'var(--accent)', boxShadow: `0 0 8px ${settings?.accentColor || 'var(--accent)'}80` }} />
                  )}
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? (settings?.accentColor || 'var(--accent)') : 'var(--text-secondary)',
                    background: dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? `${settings?.accentColor || 'var(--accent)'}10` : 'var(--bg-deep)',
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
                  background: `linear-gradient(90deg, ${settings?.accentColor || 'var(--accent)'}, ${settings?.accentColor || 'var(--accent)'}cc)`,
                  width: `${Math.min(100, (dailyStudyTime / ((settings?.dailyGoal || 240) * 60)) * 100)}%`,
                  transition: 'width 500ms ease',
                  boxShadow: `0 0 8px ${settings?.accentColor || 'var(--accent)'}60`,
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <Flame size={11} color={dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#F59E0B' : 'var(--text-muted)'} fill={dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#F59E0B' : 'none'} />
                <span style={{ fontSize: 10, fontWeight: 600, color: dailyStudyTime >= (settings?.dailyGoal || 240) * 60 ? '#F59E0B' : 'var(--text-secondary)' }}>
                  {streak} {streak === 1 ? 'día' : 'días'} consecutivos
                </span>
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
                  <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{studyFormatted}</span>
                </div>

                {/* Metric 2: Completed Sessions */}
                <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <CheckCircle size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#8B5CF6', opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Sesiones</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{recentSessions.length}</span>
                </div>

                {/* Metric 3: Eficiencia */}
                <div style={{ background: 'var(--bg-deep)', border: `1px solid ${efficiencyPct > 80 ? '#10B981' : efficiencyPct > 50 ? '#F59E0B' : '#EF4444'}30`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <TrendingUp size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: efficiencyPct > 80 ? '#10B981' : efficiencyPct > 50 ? '#F59E0B' : '#EF4444', opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Eficiencia</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: efficiencyPct > 80 ? '#10B981' : efficiencyPct > 50 ? 'var(--text-primary)' : '#EF4444', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{efficiencyPct}%</span>
                </div>

                {/* Metric 4: Distractions */}
                <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <AlertTriangle size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#EF4444', opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Distracciones</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{distractionCount}</span>
                </div>
            </div>
          </div>

          {/* DETAILED ACTIVITY HISTORY CARD (Max 5) */}
          <div className="bento-card" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Timer size={11} style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Actividad
                </span>
              </div>
              {activityFeed.length > 0 && (
                <button onClick={() => setShowAllActivity(true)} style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, transition: 'background 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <Eye size={10} /> Ver todo ({activityFeed.length})
                </button>
              )}
            </div>
            
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
              {activityFeed.length > 0 ? (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto 48px', gap: 10, padding: '0 10px 8px', fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)', marginBottom: 6 }}>
                    <span />
                    <span>Duración</span>
                    <span>Hora</span>
                    <span style={{ textAlign: 'center' }}>Rend.</span>
                  </div>
                  {activityFeed.slice(0, 5).map((entry, i) => {
                    const isPomo = entry.type === 'pomodoro';
                    const isChrono = entry.type === 'chrono';
                    const isBreakEntry = entry.type === 'break';
                    const c = isPomo ? focusColor : isChrono ? chronoColor : breakColor;
                    const Icon = isPomo ? TomatoIcon : isBreakEntry ? Coffee : Timer;
                    const mins = Math.floor(entry.duration / 60);
                    const secs = entry.duration % 60;
                    const timeStr = entry.endedAt ? (() => { try { return format(new Date(entry.endedAt), 'HH:mm'); } catch { return '—'; } })() : '—';
                    const notEvaled = !entry.evaluated && (entry.type === 'pomodoro' || entry.type === 'chrono');
                    const StatusIcon = entry.status === 'completado' ? Check : entry.status === 'mitad' ? Minus : X;
                    const statusCol = entry.status === 'completado' ? 'var(--success)' : entry.status === 'mitad' ? '#F59E0B' : 'var(--error)';
                    const pct = entry.type === 'pomodoro' && settings.pomodoroTime > 0 ? Math.min(100, Math.round(entry.duration / settings.pomodoroTime * 100)) : 100;
                    const r = 10, circ = 2 * Math.PI * r;
                    const eff = entry.sessionEff ?? 100;
                    return (
                      <div key={entry.id || i}
                        style={{
                          display: 'grid', gridTemplateColumns: '32px 1fr auto auto', gap: 8,
                          padding: '8px 10px', borderRadius: 8, alignItems: 'center',
                          cursor: 'default',
                          transition: 'background 180ms ease',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: `${c}12`, flexShrink: 0 }}>
                          <Icon size={13} color={c} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                            {mins > 0 ? `${mins}m` : ''}{secs > 0 && mins === 0 ? ` ${secs}s` : ''}
                          </span>
                          {isPomo && (
                            <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: statusCol, transition: 'width 400ms ease' }} />
                            </div>
                          )}
                          <span style={{ fontSize: 8, fontWeight: 600, color: eff > 80 ? 'var(--success)' : eff > 50 ? '#F59E0B' : 'var(--error)', whiteSpace: 'nowrap' }}>
                            {eff}%
                          </span>
                          {(entry.pauseCount ?? 0) > 0 && (
                            <span style={{ fontSize: 7, color: '#F59E0B', fontWeight: 700, background: '#F59E0B15', padding: '0 5px', borderRadius: 4, lineHeight: '14px', whiteSpace: 'nowrap' }}>
                              {entry.pauseCount}p
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 450, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.01em' }}>{entry.meta ?? timeStr}</span>
                        <div style={{ width: 28, height: 28, position: 'relative', flexShrink: 0, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {entry.volmeter !== undefined ? (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: entry.volmeter >= 14 ? '#10B981' : entry.volmeter >= 8 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>{entry.volmeter}</div>
                              <div style={{ fontSize: 6, color: 'var(--text-muted)', lineHeight: 1, marginTop: 1 }}>/20</div>
                            </div>
                          ) : (
                            <>
                              <svg width={28} height={28} viewBox="0 0 28 28" style={{ position: 'absolute', inset: 0 }}>
                                <circle cx={14} cy={14} r={r} fill="none" stroke="var(--bg-deep)" strokeWidth={2.5} />
                                <circle cx={14} cy={14} r={r} fill="none" stroke={statusCol} strokeWidth={2.5}
                                  strokeDasharray={`${circ * pct / 100} ${circ * (100 - pct) / 100}`}
                                  strokeLinecap="round"
                                  transform="rotate(-90 14 14)"
                                  style={{ transition: 'stroke-dasharray 600ms ease', opacity: pct > 0 ? 0.85 : 0.3 }} />
                              </svg>
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <StatusIcon size={9} color={statusCol} strokeWidth={2.5} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '30px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--bg-deep)', border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TomatoIcon size={18} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', display: 'block', marginBottom: 3 }}>Sin actividad hoy</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Inicia un bloque de estudio para registrar tu progreso.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* VIEW ALL MODAL (UP TO 10 ITEMS) */}
        {showAllActivity && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} onClick={() => setShowAllActivity(false)}>
            <div 
              style={{ 
                borderRadius: 18, 
                width: '100%', 
                maxWidth: 480, 
                padding: '28px 0 24px', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-soft)', 
                display: 'flex', 
                flexDirection: 'column',
                maxHeight: '70vh',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7)'
              }} 
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 28px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Timer size={13} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Actividad</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 500 }}>{activityFeed.length} {activityFeed.length === 1 ? 'sesión' : 'sesiones'}</span>
                  </div>
                </div>
                <button onClick={() => setShowAllActivity(false)} style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', transition: 'background 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }} className="custom-scroll">
                {activityFeed.length > 0 ? (
                  <>
                    {/* Summary */}
                    <div style={{ padding: '14px 0 12px', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, borderBottom: '1px solid var(--border-soft)', marginBottom: 8, letterSpacing: '0.02em' }}>
                      Total: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{(Math.floor(activityFeed.reduce((s, e) => s + e.duration, 0) / 3600)) > 0 ? `${Math.floor(activityFeed.reduce((s, e) => s + e.duration, 0) / 3600)}h ` : ''}{Math.floor((activityFeed.reduce((s, e) => s + e.duration, 0) % 3600) / 60)}m</span> · {activityFeed.length} {activityFeed.length === 1 ? 'sesión' : 'sesiones'}
                    </div>

                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto 40px', gap: 10, padding: '0 10px 8px', fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
                      <span />
                      <span>Duración</span>
                      <span>Hora</span>
                      <span style={{ textAlign: 'center' }}>Rend.</span>
                    </div>
                    {activityFeed.slice(0, 10).map((entry, i) => {
                      const isPomo = entry.type === 'pomodoro';
                      const isChrono = entry.type === 'chrono';
                      const isBreakEntry = entry.type === 'break';
                      const c = isPomo ? focusColor : isChrono ? chronoColor : breakColor;
                      const Icon = isPomo ? TomatoIcon : isBreakEntry ? Coffee : Timer;
                      const mins = Math.floor(entry.duration / 60);
                      const secs = entry.duration % 60;
                      const timeStr = entry.endedAt ? (() => { try { return fmtClock(format(new Date(entry.endedAt), 'HH:mm'), settings?.timeFormat); } catch { return '—'; } })() : '—';
                      const notEvaled = !entry.evaluated && (entry.type === 'pomodoro' || entry.type === 'chrono');
                      const StatusIcon = entry.status === 'completado' ? Check : entry.status === 'mitad' ? Minus : X;
                      const statusCol = entry.status === 'completado' ? 'var(--success)' : entry.status === 'mitad' ? '#F59E0B' : 'var(--error)';
                      const pct = entry.type === 'pomodoro' && settings.pomodoroTime > 0 ? Math.min(100, Math.round(entry.duration / settings.pomodoroTime * 100)) : 100;
                      const r = 10, circ = 2 * Math.PI * r;
                      const eff = entry.sessionEff ?? 100;
                      return (
                        <div key={entry.id || i}
                          style={{
                            display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 8,
                            padding: '7px 10px', borderRadius: 8, alignItems: 'center',
                            cursor: 'default',
                            transition: 'background 180ms ease',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: `${c}10`, flexShrink: 0 }}>
                            <Icon size={11} color={c} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 550, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                              {mins > 0 ? `${mins}m` : ''}{secs > 0 && mins === 0 ? ` ${secs}s` : ''}
                            </span>
                            {isPomo && (
                              <div style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: statusCol, transition: 'width 400ms ease' }} />
                              </div>
                            )}
                            <span style={{ fontSize: 8, fontWeight: 600, color: eff > 80 ? 'var(--success)' : eff > 50 ? '#F59E0B' : 'var(--error)' }}>
                              {eff}%
                            </span>
                            {(entry.pauseCount ?? 0) > 0 && (
                              <span style={{ fontSize: 7, color: '#F59E0B', fontWeight: 700, background: '#F59E0B15', padding: '0 4px', borderRadius: 4, lineHeight: '14px', whiteSpace: 'nowrap' }}>
                                {entry.pauseCount}p
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 450, fontFamily: "'Inter Tight', sans-serif" }}>{entry.meta ?? timeStr}</span>
                          <div style={{ width: 28, height: 28, position: 'relative', flexShrink: 0, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {entry.volmeter !== undefined ? (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: entry.volmeter >= 14 ? '#10B981' : entry.volmeter >= 8 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>{entry.volmeter}</div>
                                <div style={{ fontSize: 6, color: 'var(--text-muted)', lineHeight: 1, marginTop: 1 }}>/20</div>
                              </div>
                            ) : (
                              <>
                                <svg width={28} height={28} viewBox="0 0 28 28" style={{ position: 'absolute', inset: 0 }}>
                                  <circle cx={14} cy={14} r={r} fill="none" stroke="var(--bg-deep)" strokeWidth={2.5} />
                                  <circle cx={14} cy={14} r={r} fill="none" stroke={statusCol} strokeWidth={2.5}
                                    strokeDasharray={`${circ * pct / 100} ${circ * (100 - pct) / 100}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 14 14)"
                                    style={{ transition: 'stroke-dasharray 600ms ease', opacity: pct > 0 ? 0.85 : 0.3 }} />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <StatusIcon size={9} color={statusCol} strokeWidth={2.5} />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
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

      {/* Read-only Session Detail Modal */}
      {showSessionDetail && detailSession && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} onClick={() => setShowSessionDetail(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', borderRadius: 20,
              border: '1px solid var(--border-soft)', padding: '32px 0 24px',
              maxWidth: 400, width: '90%',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
            }}>
            {/* Session header */}
            <div style={{ padding: '0 28px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: `${detailSession.type === 'pomodoro' ? focusColor : chronoColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {detailSession.type === 'pomodoro' ? <Timer size={17} color={focusColor} /> : <Clock size={17} color={chronoColor} />}
                </div>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>
                    {detailSession.type === 'pomodoro' ? 'Pomodoro' : 'Cronómetro'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginTop: 2, fontWeight: 450 }}>
                    {(() => { try { return format(new Date(detailSession.startedAt), "d MMM yyyy, HH:mm", { locale: es }); } catch { return '—'; } })()} · {Math.floor(detailSession.duration / 60)}m {detailSession.duration % 60}s
                  </span>
                </div>
              </div>
            </div>

            {/* Gauge section */}
            {detailSession.perception !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 16px', borderBottom: '1px solid var(--border-subtle)', margin: '0 28px' }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <svg width={80} height={80} viewBox="0 0 80 80">
                    <circle cx={40} cy={40} r={32} fill="none" stroke="var(--bg-deep)" strokeWidth={6} />
                    <circle cx={40} cy={40} r={32} fill="none" stroke={focusColor} strokeWidth={6}
                      strokeDasharray={`${2 * Math.PI * 32 * (detailSession.volmeter ?? 50) / 100} ${2 * Math.PI * 32 * (100 - (detailSession.volmeter ?? 50)) / 100}`}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dasharray 600ms ease', opacity: 0.85 }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {detailSession.type === 'pomodoro' ? (
                      <CheckCircle size={20} color={detailSession.volmeter && detailSession.volmeter > 14 ? '#10B981' : detailSession.volmeter && detailSession.volmeter > 7 ? '#F59E0B' : '#EF4444'} />
                    ) : (
                      <Clock size={20} color={chronoColor} />
                    )}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginTop: 2 }}>{detailSession.volmeter ?? '—'}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Data rows */}
            <div style={{ padding: '16px 28px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detailSession.perception !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                  <Brain size={14} style={{ color: focusColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 60, flexShrink: 0 }}>Percepción</span>
                  <div style={{ display: 'flex', gap: 3, flex: 1, justifyContent: 'flex-end' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <div key={n} style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: n <= (detailSession.perception ?? 0) ? focusColor : 'var(--bg-deep)',
                        opacity: n <= (detailSession.perception ?? 0) ? 0.85 : 0.3,
                        transition: 'opacity 200ms',
                      }} />
                    ))}
                  </div>
                </div>
              )}
              {detailSession.discomfort !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                  <AlertTriangle size={14} style={{ color: detailSession.discomfort > 5 ? '#F59E0B' : 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 60, flexShrink: 0 }}>Molestia</span>
                  <div style={{ display: 'flex', gap: 3, flex: 1, justifyContent: 'flex-end' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <div key={n} style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: n <= (detailSession.discomfort ?? 0) ? '#F59E0B' : 'var(--bg-deep)',
                        opacity: n <= (detailSession.discomfort ?? 0) ? 0.85 : 0.3,
                        transition: 'opacity 200ms',
                      }} />
                    ))}
                  </div>
                </div>
              )}
              {detailSession.volmeter !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                  <Zap size={14} style={{ color: detailSession.volmeter > 14 ? '#10B981' : detailSession.volmeter > 7 ? '#F59E0B' : '#EF4444', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 72, flexShrink: 0 }}>Rendimiento</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                    {Array.from({ length: 20 }, (_, i) => {
                      const filled = i < detailSession.volmeter!;
                      const col = detailSession.volmeter! > 14 ? '#10B981' : detailSession.volmeter! > 7 ? '#F59E0B' : '#EF4444';
                      return (
                        <div key={i} style={{
                          width: 8, height: 12, borderRadius: 2,
                          background: filled ? col : 'var(--bg-deep)',
                          opacity: filled ? 1 : 0.4,
                          transition: 'all 200ms',
                        }} />
                      );
                    })}
                    <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', minWidth: 30, textAlign: 'right', marginLeft: 6 }}>{detailSession.volmeter}/20</span>
                  </div>
                </div>
              )}
              {detailSession.subjects && detailSession.subjects.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                  <BookOpen size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 60, flexShrink: 0 }}>Materias</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
                    {detailSession.subjects.map((sub, i) => {
                      const course = courses.find(c => c.id === sub);
                      return course ? (
                        <span key={i} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: `${course.color || focusColor}15`, color: course.color || focusColor, fontWeight: 600 }}>{course.name}</span>
                      ) : (
                        <span key={i} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: `${focusColor}15`, color: focusColor, fontWeight: 600 }}>{sub.slice(0, 20)}</span>
                      );
                    })}
                  </div>
                </div>
              )}
              {detailSession.isDistraction && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#F59E0B06', border: '1px solid #F59E0B12' }}>
                  <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 60, flexShrink: 0 }}>Estado</span>
                  <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500, marginLeft: 'auto' }}>Distracción</span>
                </div>
              )}
              {(detailSession.pauseCount ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                  <Coffee size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 60, flexShrink: 0 }}>Pausas</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', fontFamily: "'Inter Tight', sans-serif", marginLeft: 'auto' }}>{detailSession.pauseCount}</span>
                </div>
              )}
              {!detailSession.perception && !detailSession.discomfort && detailSession.volmeter === undefined && !detailSession.isDistraction && !detailSession.subjects?.length && !(detailSession.pauseCount ?? 0) && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                  Sin datos de evaluación registrados para esta sesión.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 28px 0' }}>
              <button onClick={() => setShowSessionDetail(false)}
                style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 550, transition: 'background 150ms, border-color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowResetConfirm(false)}>
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
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¿Reiniciar{isBreakTime ? ' descanso' : ''}?</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px' }}>
              {!isBreakTime && sessionTime >= 60 ? <>Esta acción se marcará como <strong style={{ color: '#F59E0B' }}>distracción</strong>.</> : isBreakTime ? <>El descanso no contará para tu recuperación.</> : '¿Seguro que deseas reiniciar?'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Aprovecha para repasar apuntes o tomar una pausa activa. Unos minutos mejoran tu retención.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResetConfirm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {isBreakTime ? 'Seguir descansando' : 'Cancelar'}
              </button>
              <button onClick={() => { setShowResetConfirm(false); if (sessionTime >= 60 && !isBreakTime) { setDistractionCount((distractionCount ?? 0) + 1); setAccumulatedPauseTime(prev => prev + 30); } handleReset(); }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#F59E0B', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Reiniciar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-SESSION EVALUATION — with linked task */}
      {showSessionEval && evalSessionId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => { handleEvalAndStartRest({ volmeter: evalVolmeter, evaluatedAt: new Date().toISOString() }); }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', borderRadius: 20,
              border: '1px solid var(--border-soft)', padding: '32px 36px',
              maxWidth: 460, width: '90%',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}80`, flexShrink: 0 }} />
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Evaluar sesión</span>
            </div>

            {/* Linked task info */}
            {activeTask && (
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: `${activeTask.courseColor || statusColor}10`, border: `1px solid ${activeTask.courseColor || statusColor}30` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: activeTask.courseColor || statusColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTask.title}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: activeTask.status === 'inicio' ? '#F59E0B' : activeTask.status === 'progreso' ? '#3B82F6' : '#10B981' }}>
                    {activeTask.status === 'inicio' ? 'Sin empezar' : activeTask.status === 'progreso' ? 'En progreso' : 'Completada'}
                  </div>
                </div>
              </div>
            )}

            {/* Volmeter 1-20 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>¿Qué tan bien lo hiciste?</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: evalVolmeter > 14 ? '#10B981' : (evalVolmeter > 7 ? '#F59E0B' : '#EF4444'), fontFamily: "'Inter Tight', sans-serif" }}>{evalVolmeter}/20</span>
              </div>
              <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'flex-end', gap: 2, marginBottom: 4 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{
                    flex: 1, height: i < evalVolmeter ? 6 + (i / 20) * 18 : 3, borderRadius: '2px 2px 0 0',
                    background: i < evalVolmeter
                      ? (i < 7 ? '#EF4444' : i < 14 ? '#F59E0B' : '#10B981')
                      : 'var(--bg-hover)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: i < evalVolmeter ? `0 0 3px ${i < 7 ? '#EF4444' : i < 14 ? '#F59E0B' : '#10B981'}50` : 'none',
                  }} />
                ))}
              </div>
              <input type="range" min="1" max="20" value={evalVolmeter} onChange={e => setEvalVolmeter(Number(e.target.value))}
                style={{ width: '100%', height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: 'transparent', marginTop: 2 }}
                className="volume-slider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Bajo</span><span>Alto</span>
              </div>
            </div>

            {/* Task state action */}
            {activeTask && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.02em' }}>Estado de la tarea</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {activeTask.status === 'inicio' && (
                    <>
                      <button onClick={() => setEvalTaskAction('progress')} style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        border: evalTaskAction === 'progress' ? `1px solid #F59E0B` : '1px solid var(--border-soft)',
                        background: evalTaskAction === 'progress' ? '#F59E0B12' : 'var(--bg-deep)',
                        color: evalTaskAction === 'progress' ? '#F59E0B' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 150ms',
                      }}>En proceso</button>
                      <button onClick={() => setEvalTaskAction('complete')} style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        border: evalTaskAction === 'complete' ? `1px solid #10B981` : '1px solid var(--border-soft)',
                        background: evalTaskAction === 'complete' ? '#10B98112' : 'var(--bg-deep)',
                        color: evalTaskAction === 'complete' ? '#10B981' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 150ms',
                      }}>Completado</button>
                    </>
                  )}
                  {activeTask.status === 'progreso' && (
                    <>
                      <button onClick={() => setEvalTaskAction('complete')} style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        border: evalTaskAction === 'complete' ? `1px solid #10B981` : '1px solid var(--border-soft)',
                        background: evalTaskAction === 'complete' ? '#10B98112' : 'var(--bg-deep)',
                        color: evalTaskAction === 'complete' ? '#10B981' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 150ms',
                      }}>Completado</button>
                      <button onClick={() => setEvalTaskAction('not_finished')} style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        border: evalTaskAction === 'not_finished' ? `1px solid #F59E0B` : '1px solid var(--border-soft)',
                        background: evalTaskAction === 'not_finished' ? '#F59E0B12' : 'var(--bg-deep)',
                        color: evalTaskAction === 'not_finished' ? '#F59E0B' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 150ms',
                      }}>No lo terminé</button>
                    </>
                  )}
                  {activeTask.status === 'completado' && (
                    <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, padding: '10px 12px', background: '#10B98112', borderRadius: 10, border: '1px solid #10B98130', flex: 1, textAlign: 'center' }}>
                      Tarea ya completada
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { handleEvalAndStartRest({ volmeter: evalVolmeter, evaluatedAt: new Date().toISOString() }); }}
                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={() => {
                handleEvalAndStartRest({
                  perception: evalPerception,
                  discomfort: evalDiscomfort,
                  mode: evalMode,
                  subjects: evalSubjects.length > 0 ? evalSubjects : undefined,
                  volmeter: evalVolmeter,
                  evaluatedAt: new Date().toISOString(),
                });
                if (evalTaskAction === 'complete' && activeTaskId) {
                  updateTask(activeTaskId, { status: 'completado', completedAt: new Date().toISOString() });
                  addNotification('¡Tarea completada!', 'success');
                } else if (evalTaskAction === 'progress' && activeTaskId) {
                  updateTask(activeTaskId, { status: 'progreso' });
                }
                if (activeTaskId) setActiveTaskId(null);
              }}
                style={{ padding: '8px 24px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${statusColor}, ${statusColor}dd)`, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FREE STUDY PROMPT — no linked task */}
      {showFreeStudyPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => { handleEvalAndStartRest(); }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', borderRadius: 20,
              border: '1px solid var(--border-soft)', padding: '32px 36px',
              maxWidth: 460, width: '90%',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}80`, flexShrink: 0 }} />
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Registrar tiempo</span>
            </div>

            {/* What did you study? */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.02em' }}>¿Qué estudiaste?</label>
              <input value={evalFreeText} onChange={e => setEvalFreeText(e.target.value)}
                style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 14px', fontSize: 13, outline: 'none' }}
                placeholder="Tema, materia o concepto..." className="input-base" />
            </div>

            {/* Course selector (free study only) — single select */}
            {courses.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.02em' }}>Materia (opcional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                  {courses.map(c => {
                    const sel = evalSubjects.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => setEvalSubjects(sel ? [] : [c.id])}
                        style={{
                          padding: '10px 12px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                          border: sel ? `1.5px solid ${c.color}` : '1px solid var(--border-soft)',
                          background: sel ? `${c.color}15` : 'var(--bg-deep)',
                          color: sel ? c.color : 'var(--text-tertiary)',
                          cursor: 'pointer', transition: 'all 180ms',
                          display: 'flex', alignItems: 'center', gap: 8,
                          boxShadow: sel ? `0 0 12px ${c.color}25` : 'none',
                        }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: c.color, flexShrink: 0,
                          boxShadow: sel ? `0 0 6px ${c.color}` : 'none',
                          transition: 'box-shadow 200ms',
                        }} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
                        {sel && <span style={{ fontSize: 9, opacity: 0.5 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Volmeter 1-20 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>¿Qué tan bien lo hiciste?</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: evalVolmeter > 14 ? '#10B981' : (evalVolmeter > 7 ? '#F59E0B' : '#EF4444'), fontFamily: "'Inter Tight', sans-serif" }}>{evalVolmeter}/20</span>
              </div>
              <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'flex-end', gap: 2, marginBottom: 4 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{
                    flex: 1, height: i < evalVolmeter ? 6 + (i / 20) * 18 : 3, borderRadius: '2px 2px 0 0',
                    background: i < evalVolmeter
                      ? (i < 7 ? '#EF4444' : i < 14 ? '#F59E0B' : '#10B981')
                      : 'var(--bg-hover)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: i < evalVolmeter ? `0 0 3px ${i < 7 ? '#EF4444' : i < 14 ? '#F59E0B' : '#10B981'}50` : 'none',
                  }} />
                ))}
              </div>
              <input type="range" min="1" max="20" value={evalVolmeter} onChange={e => setEvalVolmeter(Number(e.target.value))}
                style={{ width: '100%', height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: 'transparent', marginTop: 2 }}
                className="volume-slider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Bajo</span><span>Alto</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { handleEvalAndStartRest({ volmeter: evalVolmeter, evaluatedAt: new Date().toISOString() }); }}
                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={() => {
                handleEvalAndStartRest({
                  subjects: evalSubjects.length > 0 ? evalSubjects : undefined,
                  volmeter: evalVolmeter,
                  evaluatedAt: new Date().toISOString(),
                });
                addNotification(evalFreeText.trim() ? `Estudiaste: ${evalFreeText.trim()}` : 'Sesión registrada', 'success');
              }}
                style={{ padding: '8px 24px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${statusColor}, ${statusColor}dd)`, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Guardar
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
