import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Zap, Clock,
  CheckCircle, Trophy, Sparkles, Flame,
  Coffee, X, Timer, BarChart3, Plus,
  AlertTriangle, Link2, Eye, Focus, Monitor, Minimize2, Maximize2,
  Check, Minus, Brain, Volume2, BookOpen, ArrowUpRight, Trash2
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

const REVIEW_LEVEL_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#FBBF24', '#EAB308', '#A3E635', '#84CC16', '#4ADE80', '#22C55E', '#10B981'];

/** Convert a UTC ISO timestamp to local YYYY-MM-DD (avoids UTC vs local date mismatch) */
function toLocalDate(iso: string): string {
  try { return format(new Date(iso), 'yyyy-MM-dd'); } catch { return iso.slice(0, 10); }
}

function getGoalForDay(dayStr: string, currentGoal: number, dailyGoalHistory?: Record<string, number>, initialDailyGoal?: number): number {
  const changeDates = Object.keys(dailyGoalHistory || {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  for (let i = changeDates.length - 1; i >= 0; i--) {
    if (changeDates[i] <= dayStr) return dailyGoalHistory![changeDates[i]];
  }
  return initialDailyGoal ?? currentGoal;
}

function calculateStreak(dailyTotals: Record<string, number>, dailyGoalMin: number, dailyGoalHistory?: Record<string, number>, initialDailyGoal?: number): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

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

const TomatoIcon = ({ size = 24, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <ellipse cx="12" cy="14.5" rx="7.5" ry="7" fill={color} fillOpacity="0.12" />
    <ellipse cx="12" cy="14.5" rx="7.5" ry="7" stroke={color} fill="none" />
    <ellipse cx="12" cy="14.5" rx="7.5" ry="7" fill={color} fillOpacity="0.05" transform="translate(0, -0.5)" />
    <path d="M12 3.5C12 3.5 10.5 5 10 6c-.3.6-.5 1.2-.5 1.8" stroke={color} strokeWidth="1.2" fill="none" />
    <path d="M12 3.5c1.8 0 3 1.5 3 3.2" stroke={color} strokeWidth="1" fill="none" opacity="0.3" />
    <path d="M12 3.5c-1.8 0-3 1.5-3 3.2" stroke={color} strokeWidth="1" fill="none" opacity="0.15" />
    <path d="M12 3.5c0 0 1.2 1.3 1.8 2.5" stroke={color} strokeWidth="1" fill="none" opacity="0.25" />
    <path d="M9.8 6.2c-1.2.8-2.5 2-3.2 3.8" stroke={color} strokeWidth="0.8" fill="none" opacity="0.15" />
    <path d="M12 3l1.5 1.2" stroke={color} strokeWidth="1" opacity="0.5" />
    <path d="M12 3L9.5 4" stroke={color} strokeWidth="1" opacity="0.4" />
    <path d="M11 2.5l1 .5 1-.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

function LEDTime({ time, color, digitWidth = 110, digitHeight = 180, colonWidth = 32 }: { time: string; color: string; digitWidth?: number; digitHeight?: number; colonWidth?: number }) {
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
  sessionIre?: number;
  evaluated?: boolean;
  volmeter?: number;
  perception?: number;
  discomfort?: number;
  mode?: string;
  isDistraction?: boolean;
  plannedSessionId?: string;
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
    plannedSessions, updatePlannedSession,
    activePlannedSessionId, linkPlannedSessionToTimer, unlinkPlannedSessionFromTimer,
    navigateToCourse, setNavigateTo,
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
  const [evalPlanOutcome, setEvalPlanOutcome] = useState<'logrado' | 'no_logrado'>('logrado');
  const [evalStudyMode, setEvalStudyMode] = useState<'free' | 'task'>('free');
  const [evalLinkedTaskId, setEvalLinkedTaskId] = useState<string | null>(null);
  const [evalFreeText, setEvalFreeText] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [planBlockHover, setPlanBlockHover] = useState(false);
  const [taskBlockHover, setTaskBlockHover] = useState(false);
  const [winW, setWinW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWinW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isNarrow = winW < 1024;
  const dw = isNarrow ? 58 : 82;
  const dh = isNarrow ? 96 : 136;
  const cw = isNarrow ? 18 : 26;
  const dotStep = isNarrow ? 2 : 1;
  const controlSize = isNarrow ? 60 : 72;
  const controlIcon = isNarrow ? 24 : 30;
  const resetSize = isNarrow ? 46 : 56;
  const resetIcon = isNarrow ? 16 : 20;

  const hasTriggeredRef = useRef(false);
  const breakNotifiedRef = useRef(false);

  const handleEvalAndStartRest = useCallback((saveData?: Partial<StudySession>) => {
    if (saveData) {
      if (evalSessionId) {
        updateStudySession(evalSessionId, saveData);
      } else if (pendingSessionRef.current) {
        addStudySession({ ...pendingSessionRef.current, ...saveData });
        pendingSessionRef.current = null;
      }
    }
    setShowSessionEval(false);
    setShowFreeStudyPrompt(false);
    setShowRestPrompt(false);
    if (isRest) {
      return;
    }
    if (sessionType === 'pomodoro') {
      incrementPomodoroSessions();
      setIsRest(true);
      setIsTimerActive(true);
    } else {
      setIsTimerActive(false);
    }
    setSessionTime(0);
  }, [evalSessionId, sessionType, isRest, updateStudySession, addStudySession, incrementPomodoroSessions, setIsRest, setSessionTime, setIsTimerActive, setShowRestPrompt]);

  // No restStartRef needed — sessionTime is always reset to 0 when rest starts

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
  const pendingSessionRef = useRef<Omit<StudySession, 'id'> | null>(null);

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekAgoStr = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const monthStartStr = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  // Semana actual (resetea lunes) — misma lógica que todayDistractionCount/racha
  const weekStartStr = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    return format(weekStart, 'yyyy-MM-dd');
  }, []);

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

  // Estudio Puro SEMANAL (lunes→hoy) para el Resumen Operativo
  const weeklyStudySecs = useMemo(() => {
    let total = 0;
    for (const [day, secs] of Object.entries(weeklyStudyTime)) {
      if (day >= weekStartStr) total += secs;
    }
    return total;
  }, [weeklyStudyTime, weekStartStr]);
  const weeklyStudyFormatted = weeklyStudySecs > 0
    ? `${Math.floor(weeklyStudySecs / 3600)}h ${Math.floor((weeklyStudySecs % 3600) / 60)}m`
    : '0m';

  // Sesiones de la SEMANA actual (lunes→hoy) para el Resumen Operativo
  const weeklySessions = useMemo(() =>
    studySessions.filter(s => toLocalDate(s.startedAt) >= weekStartStr),
  [studySessions, weekStartStr]);

  // Sessiones de la ultima semana para el feed (reseteo semanal visual)
  const recentSessions = useMemo(() => 
    studySessions.filter(s => toLocalDate(s.startedAt) >= weekAgoStr),
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
  const pomoGoal2 = (settings.pomodoroGoal || 4) || 1;
  const isLongBreak = isRest && pomodoroSessions > 0 && pomodoroSessions % pomoGoal2 === 0;
  const currentBreakLimit = isLongBreak ? (settings.longBreakTime || 900) : (settings.shortBreakTime || 300);
  const restElapsed = isRest ? sessionTime : 0;
  const computedRest = Math.max(0, currentBreakLimit - restElapsed);
  const computedDisplay = sessionType === 'pomodoro' ? Math.max(0, (settings.pomodoroTime || 1500) - sessionTime) : sessionTime;

  useEffect(() => {
    if (isTimerActive && !isRest && sessionTime >= settings.pomodoroTime && !hasTriggeredRef.current && sessionType === 'pomodoro') {
      hasTriggeredRef.current = true;
      setIsTimerActive(false);
      sendNativeNotification('Sesión completada', 'Buen trabajo. Evalúa tu sesión.');
      notifySessionComplete(settings.pomodoroTime / 60);
      pendingSessionRef.current = {
        type: 'pomodoro',
        startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        duration: sessionTime,
        taskId: activeTaskId || undefined,
        courseId: undefined,
        pauseCount: distractionCount,
        pauseDuration: accumulatedPauseTime - lastPauseTimeRef.current,
        plannedSessionId: activePlannedSessionId || undefined,
      };
      setEvalSessionId(null);
      setEvalPerception(7);
      setEvalDiscomfort(Math.min(10, distractionCount));
      setEvalVolmeter(0);
      setEvalMode('rendimiento');
      setEvalFreeText('');
      if (activePlannedSessionId) {
        const ps = (plannedSessions || []).find(p => p.id === activePlannedSessionId);
        setEvalPlanOutcome(ps?.completed ? 'logrado' : 'no_logrado');
      }
      if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        setEvalTaskAction(task?.status === 'inicio' ? null : (task?.status === 'progreso' ? 'not_finished' : 'complete'));
        setEvalSubjects(courses.filter(c => task?.course === c.name).map(c => c.id));
        setShowSessionEval(true);
      } else if (activePlannedSessionId) {
        // Sesión de estudio vinculada — mismo flujo de registro (eval con volmeter,
        // updatePlannedSession + unlink) pero con el recuadro personalizado 1-10
        setEvalSubjects([]);
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
      setShowRestPrompt(false);
      lastPauseTimeRef.current = accumulatedPauseTime;
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
      if (found && !activePlannedSessionId) {
        setActiveTaskId(taskId);
        addNotification(`Estudiando: ${found.title}`, 'success');
      } else if (found && activePlannedSessionId) {
        addNotification('Hay una sesión de estudio vinculada. Desvincúlala para estudiar esta tarea.', 'info');
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
  }, [sessionTime, isRest, currentBreakLimit, isLongBreak, addStudySession]);

  const unlinkTask = () => { 
    if (isTimerActive) return;
    setActiveTaskId(null); 
    addNotification('Sesion completada', 'success'); 
  };

  // Linked planned session (plannedSessions + activePlannedSessionId via context)
  const linkedPlanSession = useMemo(
    () => (plannedSessions || []).find(s => s.id === activePlannedSessionId) || null,
    [plannedSessions, activePlannedSessionId]
  );
  const linkedPlanCourse = useMemo(
    () => (linkedPlanSession ? courses.find(c => c.id === linkedPlanSession.courseId) : null) || null,
    [linkedPlanSession, courses]
  );
  const [showUnlinkPlanConfirm, setShowUnlinkPlanConfirm] = useState(false);
  const [showUnlinkTaskConfirm, setShowUnlinkTaskConfirm] = useState(false);

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
    const weekSessions = studySessions.filter(s => toLocalDate(s.startedAt) >= weekStartStr);
    const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(v, mx));

    const focusSecs = weekSessions.reduce((acc, s) => acc + s.duration, 0);
    const pauseSecs = weekSessions.reduce((acc, s) => acc + (s.pauseDuration || 0), 0);
    const distractions = weekSessions.reduce((acc, s) => acc + (s.pauseCount || 0), 0);
    const breakSecs = studySessions.filter(s => toLocalDate(s.startedAt) >= weekStartStr && s.type === 'break')
      .reduce((acc, s) => acc + s.duration, 0);

    if (focusSecs <= 0 && weekSessions.length === 0) return 0;

    const dailyGoalSecs = (settings?.dailyGoal || 240) * 60;
    const focusMin = focusSecs / 60;

    // ScoreMeta (tolerancia 95%)
    const scoreMeta = dailyGoalSecs > 0
      ? clamp(focusSecs / (dailyGoalSecs * 0.95), 0, 1)
      : 0.8;

    // ScoreEnfoque = eficiencia × penalización por distracciones
    const totalOp = focusSecs + pauseSecs + distractions * 60;
    const eficiencia = totalOp > 0 ? focusSecs / totalOp : 1;
    const hoursStudy = focusMin / 60;
    const distPerHour = hoursStudy > 0 ? distractions / hoursStudy : 0;
    const scoreEnfoque = clamp(eficiencia * Math.exp(-0.05 * distPerHour), 0, 1);

    // ScoreFlujo según duración promedio de bloques de estudio
    const studyBlocks = weekSessions.filter(s => s.type !== 'break');
    const avgBlockMin = studyBlocks.length > 0
      ? studyBlocks.reduce((acc, s) => acc + s.duration, 0) / studyBlocks.length / 60
      : 0;
    const longestBlock = Math.max(...studyBlocks.map(s => s.duration), 0) / 60;
    const effectiveBlock = Math.max(avgBlockMin, longestBlock * 0.6);
    let scoreFlujo = 0;
    if (effectiveBlock <= 0) scoreFlujo = 0.3;
    else if (effectiveBlock < 5) scoreFlujo = clamp(0.3 + (effectiveBlock / 5) * 0.3, 0.3, 0.6);
    else if (effectiveBlock < 15) scoreFlujo = 0.6 + ((effectiveBlock - 5) / 10) * 0.35;
    else if (effectiveBlock <= 60) scoreFlujo = 0.95;
    else if (effectiveBlock <= 90) scoreFlujo = 0.85;
    else scoreFlujo = 0.7;

    // ScoreDescanso (ratio ideal 0.20)
    const ratioDescanso = focusMin > 0 ? (breakSecs / 60) / focusMin : 0;
    const scoreDescanso = focusMin > 0
      ? clamp(1 - Math.abs(ratioDescanso - 0.20) / 0.25, 0.2, 1)
      : 0.5;

    // ScorePercepcion — user's 1-20 self-rating blended in (sesiones planificadas usan 1-10)
    const evaluatedSessions = weekSessions.filter(s => s.volmeter !== undefined && s.volmeter !== null);
    const scorePercepcion = evaluatedSessions.length > 0
      ? evaluatedSessions.reduce((sum, s) => sum + ((s.volmeter || 10) / (s.plannedSessionId ? 10 : 20)), 0) / evaluatedSessions.length
      : 0.5;

    // IRE compuesto — percepcion weighs in when user has rated sessions
    const hasRating = evaluatedSessions.length > 0;
    const ire = 100 *
      Math.pow(scoreMeta, hasRating ? 0.25 : 0.35) *
      Math.pow(scoreEnfoque, hasRating ? 0.25 : 0.35) *
      Math.pow(scoreFlujo, hasRating ? 0.15 : 0.20) *
      Math.pow(scoreDescanso, hasRating ? 0.08 : 0.10) *
      Math.pow(scorePercepcion, hasRating ? 0.27 : 0);

    return Math.max(1, Math.round(ire));
  }, [studySessions, settings?.dailyGoal, weekStartStr]);

  // Daily trend: compare today vs yesterday
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayStudySecs = weeklyStudyTime[yesterdayStr] || 0;
  const yesterdaySessions = studySessions.filter(s => toLocalDate(s.startedAt) === yesterdayStr).length;
  // Compute this week's distraction count (resets Monday) from persisted studySessions
  const todayDistractionCount = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return studySessions.filter(s => s.isDistraction && toLocalDate(s.startedAt) >= weekStartStr).length;
  }, [studySessions]);

  const yesterdayDistractions = 0; // not persisted daily, show neutral
  const yesterdayEfficiency = 75; // fallback

  const activityFeed: ActivityEntry[] = useMemo(() => {
    const entries: ActivityEntry[] = [];
    const sortedSessions = [...recentSessions]
      .filter(s => !s.isDistraction)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 15);
    
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
        sessionIre: (() => {
          const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(v, mx));
          const focusMin = s.duration / 60;
          const eff = s.duration + s.pauseDuration + (s.pauseCount || 0) * 60 > 0
            ? s.duration / (s.duration + s.pauseDuration + (s.pauseCount || 0) * 60) : 1;
          const distPerHour = focusMin > 0 ? ((s.pauseCount || 0) / (focusMin / 60)) : 0;
          const sm = pomGoal > 0 ? clamp(s.duration / (pomGoal * 0.95), 0, 1) : 0.5;
          const se = clamp(eff * Math.exp(-0.05 * distPerHour), 0, 1);
          let sf = 0;
          if (focusMin < 5) sf = clamp(focusMin / 10, 0, 0.5);
          else if (focusMin < 15) sf = 0.5 + ((focusMin - 5) / 10) * 0.4;
          else if (focusMin <= 60) sf = 1;
          else if (focusMin <= 90) sf = 0.9;
          else sf = 0.7;
          const hasVol = s.volmeter !== undefined && s.volmeter !== null;
          const sp = hasVol ? (s.volmeter || 10) / (s.plannedSessionId ? 10 : 20) : 0.5;
          return Math.round(100 *
            Math.pow(sm, hasVol ? 0.30 : 0.40) *
            Math.pow(se, hasVol ? 0.28 : 0.35) *
            Math.pow(sf, hasVol ? 0.14 : 0.15) *
            Math.pow(sp, hasVol ? 0.28 : 0));
        })(),
        evaluated: s.perception !== undefined,
        volmeter: s.volmeter,
        perception: s.perception,
        discomfort: s.discomfort,
        mode: s.mode,
        isDistraction: s.isDistraction,
        plannedSessionId: s.plannedSessionId,
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
      // Re-read actual state to avoid icon desync
      const actual = await win.isFullscreen();
      setIsFullscreen(actual);
    } catch {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
      // Re-check after browser fullscreen toggle
      setTimeout(async () => {
        try {
          const win = getCurrentWebviewWindow();
          setIsFullscreen(await win.isFullscreen());
        } catch {}
      }, 300);
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
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 0 20px var(--accent-glow)' }}>Estudio</h1>
          </div>
          <p className="hidden sm:block" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 400, letterSpacing: '0.02em' }}>Tu concentración, tu ritmo.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={tf} style={{ padding: 8, borderRadius: '50%', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Pantalla completa">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {/* Floating timer toggle — show/hide always-on-top floating timer window */}
            <button className="hidden md:block" onClick={async () => {
              const existing = await WebviewWindow.getByLabel('floating-timer');
              if (existing) {
                const visible = await existing.isVisible();
                if (visible) { await existing.hide(); } else { await existing.show(); await existing.setFocus(); }
                return;
              }
              const win = new WebviewWindow('floating-timer', {
                url: '/',
                title: 'Timer',
                width: 156, height: 112,
                resizable: false,
                decorations: false,
                transparent: true,
                alwaysOnTop: true,
                skipTaskbar: false,
              });
              win.setShadow(false).catch(() => {});
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
            <div className="hidden sm:block" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-tertiary)', position: 'relative', zIndex: 1 }} />
            <NotificationBell />
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div className="flex items-baseline gap-2 justify-end">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(32px, 6vw, 68px)', fontWeight: 200, lineHeight: 0.9, color: 'var(--text-secondary)', letterSpacing: '0.02em', transition: 'color 300ms' }}>
                  {fmtClock(format(currentTime, 'HH:mm'), settings?.timeFormat)}
                </span>
                <span className="hidden lg:inline" style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 200, color: 'var(--text-tertiary)', opacity: 0.7, letterSpacing: '0.02em', transition: 'color 300ms' }}>
                  {format(currentTime, 'ss')}
                </span>
              </div>
              <div className="hidden lg:block" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 6 }}>
                {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN TWO-COLUMN DASHBOARD LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0">

        {/* LEFT COLUMN: Timer & Bottom Statistics */}
        <div className="lg:flex-[1.6]" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          
          {/* TIMER PANEL */}
          <div className="bento-card" style={{ padding: isNarrow ? '18px 18px 12px' : '24px 32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            
            {/* Mode Type Header */}
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 6 }}>
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
                      padding: isNarrow ? '6px 14px' : '8px 24px', borderRadius: 8, fontSize: isNarrow ? 10 : 11, fontWeight: 600,
                      letterSpacing: '0.04em', cursor: blocked ? 'not-allowed' : 'pointer', border: 'none', textTransform: 'uppercase',
                      background: active ? `linear-gradient(135deg, ${statusColor}15, ${statusColor}05)` : 'transparent',
                      color: active ? statusColor : blocked ? 'var(--text-muted)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: isNarrow ? 5 : 8, transition: 'all 300ms',
                      position: 'relative', opacity: blocked ? 0.4 : 1,
                    }}
                  >
                    <Icon size={isNarrow ? 12 : 14} color={active ? statusColor : 'currentColor'} />
                    {mode.label}
                    {active && <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, background: statusColor, borderRadius: 2, boxShadow: `0 0 8px ${statusColor}80` }} />}
                  </button>
                );
              })}
            </div>

            {/* Glowing Segmented Timer */}
            <div style={{ position: 'relative', margin: '10px 0 4px', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, height: 240, background: `radial-gradient(ellipse, ${statusColor}08 0%, transparent 65%)`, pointerEvents: 'none' }} />
              <LEDTime 
                time={isBreakTime ? fmt(computedRest) : fmt(computedDisplay)} 
                color={statusColor} 
              />
              {/* Edge-to-edge progress dots — pomodoro only (flotantes para no agrandar la vista) */}
              {sessionType === 'pomodoro' && !isBreakTime && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, display: 'flex', gap: dotStep > 1 ? 1 : 2, justifyContent: 'space-between', pointerEvents: 'none' }}>
                  {Array.from({ length: Math.ceil(60 / dotStep) }, (_, i) => {
                    const idx = i * dotStep;
                    const nextIdx = Math.min(idx + dotStep - 1, 59);
                    const filled = sessionTime >= ((settings.pomodoroTime || 1500) / 60) * (nextIdx + 1);
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
            </div>

            {/* Linked Plan Session Indicator (below timer) — pill 1 línea, sin hora, click lleva al tema/agrupación, X fuera del recuadro */}
            {linkedPlanSession && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }}
                onMouseEnter={() => setPlanBlockHover(true)} onMouseLeave={() => setPlanBlockHover(false)}>
                <div
                  onClick={() => { if (linkedPlanSession.groupId || linkedPlanSession.topicId) navigateToCourse(linkedPlanSession.courseId, linkedPlanSession.groupId || undefined, linkedPlanSession.topicId || undefined); }}
                  title={linkedPlanSession.groupId || linkedPlanSession.topicId ? 'Ir al tema o agrupación' : 'Sesión de estudio vinculada'}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 260, padding: '7px 12px', borderRadius: 999, border: `1px dashed ${linkedPlanCourse?.color || statusColor}55`, background: `${linkedPlanCourse?.color || statusColor}0d`, cursor: (linkedPlanSession.groupId || linkedPlanSession.topicId) ? 'pointer' : 'default', transition: 'all 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${linkedPlanCourse?.color || statusColor}88`; e.currentTarget.style.background = `${linkedPlanCourse?.color || statusColor}18`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${linkedPlanCourse?.color || statusColor}55`; e.currentTarget.style.background = `${linkedPlanCourse?.color || statusColor}0d`; }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: linkedPlanCourse?.color || statusColor, boxShadow: `0 0 6px ${linkedPlanCourse?.color || statusColor}80`, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: linkedPlanCourse?.color || statusColor, fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>Sesión</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{linkedPlanSession.title || 'Sesión'}</span>
                </div>
                <button onClick={e => { e.stopPropagation(); setShowUnlinkPlanConfirm(true); }} title="Desvincular sesión"
                  style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, opacity: planBlockHover ? 1 : 0, transition: 'opacity 150ms, background 150ms, color 150ms, border-color 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(239,68,68,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Linked Task Indicator (small typography, below timer) — X fuera del recuadro */}
            <div onMouseEnter={() => setTaskBlockHover(true)} onMouseLeave={() => setTaskBlockHover(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: linkedPlanSession ? 8 : 20 }}>
              {activeTask && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: `${activeTask.courseColor || statusColor}08`, border: `1px solid ${activeTask.courseColor || statusColor}20`, maxWidth: 260 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: activeTask.courseColor || statusColor, boxShadow: `0 0 4px ${activeTask.courseColor || statusColor}60`, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                    {activeTask.title}
                  </span>
                </div>
              )}
              {!activeTask && !linkedPlanSession && (
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>Sin tarea vinculada</span>
              )}
              {activeTask && (
                <button onClick={() => setShowUnlinkTaskConfirm(true)} title="Desvincular tarea"
                  style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, opacity: taskBlockHover ? 1 : 0, transition: 'opacity 150ms, background 150ms, color 150ms, border-color 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(239,68,68,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isNarrow ? 20 : 28, marginTop: 28, marginBottom: 8 }}>
              <div style={{ position: 'relative', width: resetSize, height: resetSize }}>
                {isBreakTime && isTimerActive && (() => {
                  const totalBreak = isLongBreak && settings.longBreakTime ? settings.longBreakTime : (settings.shortBreakTime || 300);
                  const pct = Math.min(100, Math.max(0, Math.round((sessionTime / totalBreak) * 100)));
                  const r = resetSize / 2 - 3;
                  const circ = 2 * Math.PI * r;
                  const offset = circ - (pct / 100) * circ;
                  return (
                    <svg width={resetSize} height={resetSize} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                      <circle cx={resetSize / 2} cy={resetSize / 2} r={r} fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth={2.5} />
                      <circle cx={resetSize / 2} cy={resetSize / 2} r={r} fill="none" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 400ms ease' }} />
                    </svg>
                  );
                })()}
                <button onClick={() => { if (isTimerActive && !isBreakTime) return; setShowResetConfirm(true); }}
                  style={{
                    width: resetSize, height: resetSize, borderRadius: '50%',
                    cursor: isTimerActive && !isBreakTime ? 'not-allowed' : 'pointer',
                    border: isBreakTime && isTimerActive ? `1px solid #F59E0B50` : '1px solid var(--border-soft)',
                    background: isTimerActive && !isBreakTime ? 'var(--bg-deep)' : (isBreakTime && isTimerActive ? '#F59E0B10' : 'var(--bg-deep)'),
                    color: isTimerActive && !isBreakTime ? 'var(--text-muted)' : (isBreakTime && isTimerActive ? '#F59E0B' : 'var(--text-secondary)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 200ms',
                    opacity: isTimerActive && !isBreakTime ? 0.3 : 1,
                    position: 'relative',
                  }}
                  title={isTimerActive && !isBreakTime ? "No puedes reiniciar mientras el temporizador está corriendo" : "Reiniciar"}>
                  <RotateCcw size={resetIcon} />
                </button>
              </div>
              
              <button onClick={handleToggle} style={{
                width: controlSize, height: controlSize, borderRadius: '50%', cursor: 'pointer',
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
                {isTimerActive ? <Pause size={controlIcon} fill="currentColor" /> : <Play size={controlIcon} fill="currentColor" style={{ marginLeft: isNarrow ? 2 : 4 }} />}
              </button>

              <button onClick={() => {
                if (sessionTime < 60 || isBreakTime) return;
                setIsTimerActive(false);
                const nowSessionTime = sessionTime;
                if (sessionType === 'pomodoro' && nowSessionTime < (settings.pomodoroTime || 1500) * 0.5) {
                  setSessionTime(0);
                  hasTriggeredRef.current = false;
                  addNotification('Sesión menor al 50%, reiniciando pomodoro', 'info');
                  return;
                }
                pendingSessionRef.current = {
                  type: sessionType,
                  startedAt: new Date(Date.now() - nowSessionTime * 1000).toISOString(),
                  endedAt: new Date().toISOString(),
                  duration: nowSessionTime,
                  taskId: activeTaskId || undefined,
                  courseId: undefined,
                  pauseCount: distractionCount,
                  pauseDuration: accumulatedPauseTime,
                  plannedSessionId: activePlannedSessionId || undefined,
                };
                hasTriggeredRef.current = false;
                if (sessionType === 'chrono') {
                  lastChronoRoundRef.current = chronoGoal > 0 ? Math.floor(nowSessionTime / chronoGoal) : 0;
                  saveChronoRound(lastChronoRoundRef.current);
                }
                lastPauseTimeRef.current = accumulatedPauseTime;
                setEvalSessionId(null);
                setEvalVolmeter(0);
                setEvalFreeText('');
                if (activePlannedSessionId) {
                  const ps = (plannedSessions || []).find(p => p.id === activePlannedSessionId);
                  setEvalPlanOutcome(ps?.completed ? 'logrado' : 'no_logrado');
                }
                if (activeTask) {
                  setEvalTaskAction(activeTask.status === 'inicio' ? null : (activeTask.status === 'progreso' ? 'not_finished' : 'complete'));
                  setEvalSubjects(courses.filter(c => activeTask.course === c.name).map(c => c.id));
                  setShowSessionEval(true);
                } else if (activePlannedSessionId) {
                  setEvalSubjects([]);
                  setShowSessionEval(true);
                } else {
                  setEvalSubjects([]);
                  setShowFreeStudyPrompt(true);
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
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
        <div className="lg:flex-[1.2] estudio-stats" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          
          {/* 4 ELEGANT SIDEBAR METRICS CARD */}
          <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 300, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Inter', sans-serif" }}>
              Resumen Operativo
            </span>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Metric 1: Pure Study Time */}
                <div className="stat-card" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <Clock size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: statusColor, opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Estudio Puro</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{weeklyStudyFormatted}</span>
                </div>

                {/* Metric 2: Completed Sessions */}
                <div className="stat-card" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <CheckCircle size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#8B5CF6', opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Sesiones</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{weeklySessions.length}</span>
                </div>

                {/* Metric 3: Eficiencia (IRE compuesto) */}
                <div className="stat-card" style={{ background: 'var(--bg-deep)', border: `1px solid ${efficiencyPct >= 80 ? '#10B981' : efficiencyPct >= 50 ? '#F59E0B' : '#EF4444'}30`, borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <Zap size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: efficiencyPct >= 80 ? '#10B981' : efficiencyPct >= 50 ? '#F59E0B' : '#EF4444', opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Rendimiento</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: efficiencyPct >= 80 ? '#10B981' : efficiencyPct >= 50 ? 'var(--text-primary)' : '#EF4444', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{efficiencyPct}%</span>
                </div>

                {/* Metric 4: Distracciones */}
                <div className="stat-card" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                  <AlertTriangle size={80} style={{ position: 'absolute', bottom: -20, right: -20, color: '#EF4444', opacity: 0.15 }} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 1 }}>Distracciones</span>
                  <span style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{todayDistractionCount}</span>
                </div>
            </div>
          </div>

          {/* DETAILED ACTIVITY HISTORY CARD (Max 6) — Professional List */}
          <div className="bento-card" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-soft)' }}>
                  <Timer size={13} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>
                    Actividad de hoy
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>{activityFeed.length} bloques</span>
                </div>
              </div>
              {activityFeed.length > 0 && (
                <button onClick={() => setShowAllActivity(true)} style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent)', background: 'var(--accent-dim)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, transition: 'all 150ms', fontFamily: "'Inter Tight', sans-serif" }}
                  className="hover:opacity-80">
                  Ver todo
                </button>
              )}
            </div>
            
            {activityFeed.length > 0 && (
              <div className="hidden lg:flex" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 8px', fontSize: 8, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                <span style={{ width: 26, flexShrink: 0 }} />
                <span style={{ width: 58, flexShrink: 0 }}>Tiempo</span>
                <span style={{ flex: 1 }}>Progreso</span>
                <span style={{ width: 32, textAlign: 'center', flexShrink: 0 }}>Rend.</span>
                <span style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>Escala</span>
              </div>
            )}

            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
              {activityFeed.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {activityFeed.slice(0, 5).map((entry, i) => {
                    const isPomo = entry.type === 'pomodoro';
                    const isChrono = entry.type === 'chrono';
                    const isBreakEntry = entry.type === 'break';
                    const c = isPomo ? focusColor : isChrono ? chronoColor : breakColor;
                    const Icon = isPomo ? TomatoIcon : isBreakEntry ? Coffee : Timer;
                    const mins = Math.floor(entry.duration / 60);
                    const secs = entry.duration % 60;
                    const eff = entry.sessionIre ?? entry.sessionEff ?? 100;
                    const effColor = eff >= 80 ? '#10B981' : eff >= 50 ? '#F59E0B' : '#EF4444';
                    const vm = entry.volmeter != null && entry.volmeter !== undefined
                      ? (entry.volmeter <= 10 ? entry.volmeter * 2 : entry.volmeter)
                      : Math.round(eff / 5);
                    const isDist = entry.isDistraction;
                    const planSess = entry.plannedSessionId ? (plannedSessions || []).find(p => p.id === entry.plannedSessionId) : null;
                    const planCol = planSess ? (courses.find(c => c.id === planSess.courseId)?.color || null) : null;
                    const isStudyEntry = !!planSess;
                    const segCount = isStudyEntry ? 10 : 20;
                    const vmNorm = isStudyEntry ? Math.max(1, Math.min(10, entry.volmeter ?? Math.round(eff / 10))) : vm;
                    return (
                        <div key={entry.id || i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 8px', borderRadius: 10,
                          opacity: isDist ? 0.45 : 1,
                          border: '1px solid transparent',
                          borderBottom: i < Math.min(activityFeed.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: isDist ? 'rgba(245,158,11,0.08)' : `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isDist ? <Coffee size={12} color="#F59E0B" /> : <Icon size={12} color={c} />}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isDist ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", width: 58, textAlign: 'left', flexShrink: 0, fontStyle: isDist ? 'italic' : 'normal' }}>
                          {mins > 0 ? `${mins}m` : `${secs}s`}
                        </span>
                        {isDist ? (
                          <span style={{ fontSize: 9, fontWeight: 600, color: '#F59E0B', fontFamily: "'Inter Tight', sans-serif", flex: 1, textAlign: 'center', letterSpacing: '0.02em' }}>Distracción</span>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, alignItems: 'center' }}>
                              {isStudyEntry ? (
                                REVIEW_LEVEL_COLORS.map((col, j) => (
                                  <div key={j} style={{
                                    flex: 1, height: 18, borderRadius: 3,
                                    background: j < vmNorm ? col : 'var(--bg-hover)',
                                    flexShrink: 0, opacity: j < vmNorm ? 0.95 : 1,
                                  }} />
                                ))
                              ) : (
                                Array.from({ length: 20 }, (_, j) => (
                                  <div key={j} style={{
                                    flex: 1, height: 18, borderRadius: 3,
                                    background: j < vm
                                      ? (j < 7 ? '#EF4444' : j < 14 ? '#F59E0B' : '#10B981')
                                      : 'var(--bg-hover)',
                                    flexShrink: 0,
                                  }} />
                                ))
                              )}
                            </div>
                            <span style={{ width: 32, textAlign: 'center', fontSize: 10, fontWeight: 600, color: effColor, fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>{eff}%</span>
                            {isStudyEntry ? (
                              <span style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: planCol || 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", borderRadius: 6, padding: '2px 6px', lineHeight: 1.4 }}>{vmNorm}/10</span>
                              </span>
                            ) : (
                              <span style={{ width: 46, textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>{vm}/20</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '40px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--bg-deep)', border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TomatoIcon size={18} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Sin actividad hoy</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>Inicia un bloque de estudio para ver tu progreso aquí.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* VIEW ALL MODAL (UP TO 10 ITEMS) */}
        {showAllActivity && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} onClick={() => setShowAllActivity(false)}>
            <div className="bento-card"
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
                      {(() => {
                        const validSecs = activityFeed.reduce((s, e) => s + e.duration, 0);
                        const validCount = activityFeed.length;
                        return (
                          <>
                            Total: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{(Math.floor(validSecs / 3600)) > 0 ? `${Math.floor(validSecs / 3600)}h ` : ''}{Math.floor((validSecs % 3600) / 60)}m</span> · {validCount} {validCount === 1 ? 'sesión' : 'sesiones'}
                          </>
                        );
                      })()}
                    </div>

                    {/* Column headers — misma estética que la vista previa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 8px', fontSize: 8, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                      <span style={{ width: 26, flexShrink: 0 }} />
                      <span style={{ width: 58, flexShrink: 0 }}>Tiempo</span>
                      <span style={{ flex: 1 }}>Progreso</span>
                      <span style={{ width: 32, textAlign: 'center', flexShrink: 0 }}>Rend.</span>
                      <span style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>Escala</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {activityFeed.map((entry, i) => {
                        const isPomo = entry.type === 'pomodoro';
                        const isChrono = entry.type === 'chrono';
                        const isBreakEntry = entry.type === 'break';
                        const c = isPomo ? focusColor : isChrono ? chronoColor : breakColor;
                        const Icon = isPomo ? TomatoIcon : isBreakEntry ? Coffee : Timer;
                        const mins = Math.floor(entry.duration / 60);
                        const secs = entry.duration % 60;
                        const isDist = entry.isDistraction;
                        const eff = entry.sessionIre ?? entry.sessionEff ?? 100;
                        const effColor = eff >= 80 ? '#10B981' : eff >= 50 ? '#F59E0B' : '#EF4444';
                        const vm = entry.volmeter != null && entry.volmeter !== undefined
                          ? (entry.volmeter <= 10 ? entry.volmeter * 2 : entry.volmeter)
                          : Math.round(eff / 5);
                        const planSess = entry.plannedSessionId ? (plannedSessions || []).find(p => p.id === entry.plannedSessionId) : null;
                        const planCol = planSess ? (courses.find(c => c.id === planSess.courseId)?.color || null) : null;
                        const isStudyEntry = !!planSess;
                        const vmNorm = isStudyEntry ? Math.max(1, Math.min(10, entry.volmeter ?? Math.round(eff / 10))) : vm;
                        return (
                          <div key={entry.id || i}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '10px 8px', borderRadius: 10,
                              opacity: isDist ? 0.45 : 1,
                              border: '1px solid transparent',
                              borderBottom: i < activityFeed.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            }}>
                            <div style={{ width: 26, height: 26, borderRadius: 7, background: isDist ? 'rgba(245,158,11,0.08)' : `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isDist ? <Coffee size={12} color="#F59E0B" /> : <Icon size={12} color={c} />}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: isDist ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", width: 58, textAlign: 'left', flexShrink: 0, fontStyle: isDist ? 'italic' : 'normal' }}>
                              {mins > 0 ? `${mins}m` : `${secs}s`}
                            </span>
                            {isDist ? (
                              <span style={{ fontSize: 9, fontWeight: 600, color: '#F59E0B', fontFamily: "'Inter Tight', sans-serif", flex: 1, textAlign: 'center', letterSpacing: '0.02em' }}>Distracción</span>
                            ) : (
                              <>
                                <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, alignItems: 'center' }}>
                                  {isStudyEntry ? (
                                    REVIEW_LEVEL_COLORS.map((col, j) => (
                                      <div key={j} style={{
                                        flex: 1, height: 18, borderRadius: 3,
                                        background: j < vmNorm ? col : 'var(--bg-hover)',
                                        flexShrink: 0, opacity: j < vmNorm ? 0.95 : 1,
                                      }} />
                                    ))
                                  ) : (
                                    Array.from({ length: 20 }, (_, j) => (
                                      <div key={j} style={{
                                        flex: 1, height: 18, borderRadius: 3,
                                        background: j < vm
                                          ? (j < 7 ? '#EF4444' : j < 14 ? '#F59E0B' : '#10B981')
                                          : 'var(--bg-hover)',
                                        flexShrink: 0,
                                      }} />
                                    ))
                                  )}
                                </div>
                                <span style={{ width: 32, textAlign: 'center', fontSize: 10, fontWeight: 600, color: effColor, fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>{eff}%</span>
                                {isStudyEntry ? (
                                  <span style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: planCol || 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", borderRadius: 6, padding: '2px 6px', lineHeight: 1.4 }}>{vmNorm}/10</span>
                                  </span>
                                ) : (
                                  <span style={{ width: 46, textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>{vm}/20</span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '60px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <TomatoIcon size={20} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                    Sin actividad hoy
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
          {(() => {
            const dVol = detailSession.volmeter;
            const dScale = detailSession.plannedSessionId ? 10 : 20;
            const dPct = dVol != null ? Math.round((Math.min(dVol, dScale) / dScale) * 100) : 50;
            const dCol = dVol != null ? (dVol >= dScale * 0.7 ? '#10B981' : dVol >= dScale * 0.35 ? '#F59E0B' : '#EF4444') : focusColor;
            return (
          <div onClick={e => e.stopPropagation()} className="bento-card"
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
                      strokeDasharray={`${2 * Math.PI * 32 * dPct / 100} ${2 * Math.PI * 32 * (100 - dPct) / 100}`}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dasharray 600ms ease', opacity: 0.85 }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: -4 }}>
                    {detailSession.type === 'pomodoro' ? (
                      <CheckCircle size={20} color={dCol} />
                    ) : (
                      <Clock size={20} color={chronoColor} />
                    )}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginTop: 2 }}>{dVol ?? '—'}<span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>{'/' + dScale}</span></span>
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
                  <Zap size={14} style={{ color: dCol, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, width: 72, flexShrink: 0 }}>Rendimiento</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                    {Array.from({ length: dScale }, (_, i) => {
                      const filled = i < (dVol ?? 0);
                      return (
                        <div key={i} style={{
                          flex: 1, maxWidth: 10, height: 14, borderRadius: 2,
                          background: filled ? dCol : 'var(--bg-deep)',
                          opacity: filled ? 1 : 0.4,
                          transition: 'all 200ms',
                        }} />
                      );
                    })}
                    <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', minWidth: 30, textAlign: 'right', marginLeft: 6 }}>{dPct}%</span>
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
            );
          })()}
        </div>
      )}

      {/* Unlink planned session confirmation */}
      {showUnlinkPlanConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setShowUnlinkPlanConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bento-card" style={{ width: 340, background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border-soft)', padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EF444412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={15} color="#EF4444" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¿Desvincular sesión?</span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>La sesión planificada dejará de estar conectada al temporizador. Podrás vincularla nuevamente desde Cursos.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setShowUnlinkPlanConfirm(false)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>Cancelar</button>
              <button onClick={() => { unlinkPlannedSessionFromTimer(); setShowUnlinkPlanConfirm(false); addNotification('Sesión desvinculada', 'info'); }} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>Desvincular</button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink task confirmation */}
      {showUnlinkTaskConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setShowUnlinkTaskConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bento-card" style={{ width: 340, background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border-soft)', padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EF444412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={15} color="#EF4444" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¿Desvincular tarea?</span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>La tarea dejará de estar conectada al temporizador. Podrás vincularla nuevamente desde Tareas.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setShowUnlinkTaskConfirm(false)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>Cancelar</button>
              <button onClick={() => { setActiveTaskId(null); setShowUnlinkTaskConfirm(false); addNotification('Tarea desvinculada', 'info'); }} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>Desvincular</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowResetConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bento-card"
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
              {isBreakTime ? <>El descanso no contará para tu recuperación.</> : sessionTime >= 60 ? <>Esta acción se marcará como <strong style={{ color: '#F59E0B' }}>distracción</strong>.</> : '¿Seguro que deseas reiniciar?'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResetConfirm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {isBreakTime ? 'Seguir descansando' : 'Cancelar'}
              </button>
              <button onClick={() => { setShowResetConfirm(false); const wasWarned = sessionTime >= 60 && !isBreakTime; if (wasWarned) { setDistractionCount((distractionCount ?? 0) + 1); setAccumulatedPauseTime(prev => prev + 30); } handleReset({ isDistraction: wasWarned }); }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#F59E0B', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Reiniciar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-SESSION EVALUATION — linked task or linked study session */}
      {showSessionEval && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => { setShowSessionEval(false); setShowFreeStudyPrompt(false); setShowRestPrompt(false); }}>
          <div onClick={e => e.stopPropagation()} className="bento-card"
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

            {/* Linked planned session info (top priority) — estilo check de tareas: nombre arriba, curso debajo */}
            {linkedPlanSession && (
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 14, border: `1px dashed ${(linkedPlanCourse?.color || statusColor)}45`, background: `${(linkedPlanCourse?.color || statusColor)}08`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${(linkedPlanCourse?.color || statusColor)}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${(linkedPlanCourse?.color || statusColor)}30` }}>
                    <Zap size={11} style={{ color: linkedPlanCourse?.color || statusColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: linkedPlanCourse?.color || statusColor, fontFamily: "'Inter Tight', sans-serif", marginBottom: 2 }}>Sesión de estudio</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkedPlanSession.title || 'Sesión'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: linkedPlanCourse?.color || statusColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkedPlanCourse?.name || 'Curso'}</span>
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-default)', flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{linkedPlanSession.durationMinutes}min</span>
                </div>
              </div>
            )}

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

            {/* Velocímetro 1-10 (planned study) or 1-20 (regular) */}
            {linkedPlanSession ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>Rendimiento</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: evalVolmeter > 0 ? REVIEW_LEVEL_COLORS[Math.min(9, evalVolmeter - 1)] : 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{Math.max(0, Math.min(10, evalVolmeter))}<span style={{ fontSize: 11, fontWeight: 500, opacity: 0.4 }}>/10</span></span>
                </div>
                <div style={{ position: 'relative', display: 'flex', gap: 3, alignItems: 'center', padding: '8px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                  {(() => { const plannedInt = Math.max(0, Math.min(10, linkedPlanSession.intensity || 0)); return (
                    <>
                      {/* Intensidad programada — capa de fondo, sombra difuminada de lo planeado en Cursos */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 3, padding: '8px', pointerEvents: 'none' }}>
                        {REVIEW_LEVEL_COLORS.map((col, i) => {
                          const v = i + 1;
                          const planned = v <= plannedInt;
                          return <div key={`plan-${v}`} style={{ flex: 1, borderRadius: 4, background: planned ? `${col}22` : 'transparent', boxShadow: planned ? `inset 0 0 0 1px ${col}30` : 'none' }} />;
                        })}
                      </div>
                      {/* Rendimiento real — capa superior 1-10 */}
                      {REVIEW_LEVEL_COLORS.map((col, i) => {
                        const v = i + 1;
                        const on = v <= evalVolmeter;
                        const planned = v <= plannedInt;
                        return (
                          <button key={v} onClick={() => setEvalVolmeter(v)} title={`Rendimiento ${v}/10 · programada ${planned ? 'sí' : 'no'}`}
                            style={{ flex: 1, height: 26, borderRadius: 4, cursor: 'pointer', border: 'none', background: on ? col : 'transparent', opacity: on ? 1 : 0.4, boxShadow: on ? `0 0 10px ${col}70` : 'none', transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
                        );
                      })}
                    </>
                  ); })()}
                </div>
                <input type="range" min="0" max="10" value={evalVolmeter} onChange={e => setEvalVolmeter(Number(e.target.value))}
                  style={{ width: '100%', height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: 'transparent', marginTop: 6 }}
                  className="volume-slider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  <span>Bajo</span><span style={{ opacity: 0.7 }}>Intensidad programada: {linkedPlanSession.intensity || 0}/10</span><span>Alto</span>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>¿Qué tan bien lo hiciste?</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: evalVolmeter > 14 ? '#10B981' : (evalVolmeter > 7 ? '#F59E0B' : '#EF4444'), fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{evalVolmeter}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.4 }}>/20</span></span>
                </div>
                <div style={{
                  position: 'relative', height: 40, display: 'flex', alignItems: 'flex-end', gap: 3,
                  padding: '4px 0',
                  background: 'var(--bg-surface)', borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                }}>
                  {Array.from({ length: 20 }, (_, i) => {
                    const isActive = i < evalVolmeter;
                    const barColor = i < 7 ? '#EF4444' : i < 14 ? '#F59E0B' : '#10B981';
                    const barH = isActive ? 8 + (i / 20) * 28 : 4;
                    return (
                      <div key={i} style={{
                        flex: 1, height: barH, borderRadius: '3px 3px 1px 1px',
                        background: isActive ? barColor : 'rgba(255,255,255,0.04)',
                        transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: isActive ? `0 0 8px ${barColor}40, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
                        opacity: isActive ? 1 : 0.5,
                      }} />
                    );
                  })}
                </div>
                <input type="range" min="0" max="20" value={evalVolmeter} onChange={e => setEvalVolmeter(Number(e.target.value))}
                  style={{ width: '100%', height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: 'transparent', marginTop: 6 }}
                  className="volume-slider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span>Bajo</span><span>Alto</span>
                </div>
              </div>
            )}

            {/* Resultado de la sesión de estudio — un solo botón que activa/desactiva */}
            {linkedPlanSession && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.02em' }}>Resultado</label>
                <button onClick={() => setEvalPlanOutcome(evalPlanOutcome === 'logrado' ? 'no_logrado' : 'logrado')} style={{
                  width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 180ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  border: evalPlanOutcome === 'logrado' ? '1px solid #10B981' : '1px solid var(--border-soft)',
                  background: evalPlanOutcome === 'logrado' ? 'linear-gradient(135deg, #10B9811a, #10B98108)' : 'var(--bg-deep)',
                  color: evalPlanOutcome === 'logrado' ? '#10B981' : 'var(--text-secondary)',
                  boxShadow: evalPlanOutcome === 'logrado' ? '0 0 16px #10B98126, inset 0 0 0 1px #10B98122' : 'none',
                }}>
                  {evalPlanOutcome === 'logrado' ? (
                    <><Check size={13} />Cumplí la sesión</>
                  ) : (
                    <><X size={13} />Aún sigo en el proceso</>
                  )}
                </button>
              </div>
            )}

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
                      <button onClick={() => setEvalTaskAction('not_finished')} style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        border: evalTaskAction === 'not_finished' ? `1px solid #6B7280` : '1px solid var(--border-soft)',
                        background: evalTaskAction === 'not_finished' ? '#6B728012' : 'var(--bg-deep)',
                        color: evalTaskAction === 'not_finished' ? '#9CA3AF' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 150ms',
                      }}>No lo terminé</button>
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
              <button onClick={() => {
                setShowSessionEval(false);
                setShowFreeStudyPrompt(false);
                setShowRestPrompt(false);
              }}
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
                if (activePlannedSessionId) {
                  updatePlannedSession(activePlannedSessionId, { completed: evalPlanOutcome !== 'no_logrado' });
                  unlinkPlannedSessionFromTimer();
                }
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => { setShowSessionEval(false); setShowFreeStudyPrompt(false); setShowRestPrompt(false); }}>
          <div onClick={e => e.stopPropagation()} className="bento-card"
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
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.02em' }}>¿Qué estudiaste? <span style={{ color: '#EF4444' }}>*</span></label>
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

            {/* Volmeter 1-20 — premium bar display */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>¿Qué tan bien lo hiciste?</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: evalVolmeter > 14 ? '#10B981' : (evalVolmeter > 7 ? '#F59E0B' : '#EF4444'), fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{evalVolmeter}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.4 }}>/20</span></span>
              </div>
              <div style={{
                position: 'relative', height: 40, display: 'flex', alignItems: 'flex-end', gap: 3,
                padding: '4px 0',
                background: 'var(--bg-surface)', borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}>
                {Array.from({ length: 20 }, (_, i) => {
                  const isActive = i < evalVolmeter;
                  const barColor = i < 7 ? '#EF4444' : i < 14 ? '#F59E0B' : '#10B981';
                  const barH = isActive ? 8 + (i / 20) * 28 : 4;
                  return (
                    <div key={i} style={{
                      flex: 1, height: barH, borderRadius: '3px 3px 1px 1px',
                      background: isActive ? barColor : 'rgba(255,255,255,0.04)',
                      transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isActive ? `0 0 8px ${barColor}40, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
                      opacity: isActive ? 1 : 0.5,
                    }} />
                  );
                })}
              </div>
              <input type="range" min="1" max="20" value={evalVolmeter} onChange={e => setEvalVolmeter(Number(e.target.value))}
                style={{ width: '100%', height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: 'transparent', marginTop: 6 }}
                className="volume-slider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Bajo</span><span>Alto</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => {
                setShowSessionEval(false);
                setShowFreeStudyPrompt(false);
                setShowRestPrompt(false);
              }}
                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={() => {
                const freeTitle = evalFreeText.trim();
                if (!freeTitle) {
                  addNotification('Ponle un título a lo que estudiaste.', 'error');
                  return;
                }
                handleEvalAndStartRest({
                  title: freeTitle,
                  subjects: evalSubjects.length > 0 ? evalSubjects : undefined,
                  volmeter: evalVolmeter,
                  evaluatedAt: new Date().toISOString(),
                });
                if (activePlannedSessionId) {
                  updatePlannedSession(activePlannedSessionId, { completed: evalPlanOutcome !== 'no_logrado' });
                  unlinkPlannedSessionFromTimer();
                }
                addNotification(`Estudiaste: ${freeTitle}`, 'success');
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
