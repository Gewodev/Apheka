import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, Target, Zap, Clock, 
  CheckCircle, Trophy, BookOpen, Sparkles, Flame,
  MessageSquare, Plus, Send, Lightbulb,
  Brain, Link, Trash2, Star, ClipboardList,
  PenSquare, Bell, ChartPie, ChevronUp, ChevronDown, Check,
  Activity, ArrowRight, Quote, LineChart, BellOff,
  Coffee, Edit3, Settings, HelpCircle, StopCircle,
  List, FileText, Calendar, TrendingUp,
  ChevronRight, AlertTriangle, RefreshCw, Timer as TimerIcon,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

function calculateStreak(weeklyStudyTime: Record<string, number>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    if ((weeklyStudyTime[key] || 0) > 0) streak++;
    else break;
  }
  return streak;
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
];

const repasoConcepts = [
  { titulo: 'Ley de Pareto', desc: 'El 80% de resultados viene del 20% del esfuerzo. Enfócate en lo esencial.' },
  { titulo: 'Técnica Feynman', desc: 'Si no puedes explicarlo simple, no lo entiendes bien. Enséñalo para aprenderlo.' },
  { titulo: 'Curva del Olvido', desc: 'Repasa 24h, 7d y 30d después para fijar el conocimiento.' },
  { titulo: 'Active Recall', desc: 'Recuperar información activamente es 2x más efectivo que releer.' },
  { titulo: 'Spaced Repetition', desc: 'Distribuye el repaso en el tiempo para máxima retención.' },
];

const maxTowerBlocks = 8;

export default function Estudio() {
  const { 
    tasks, notes, sessionTime, isTimerActive, toggleTimer, resetTimer,
    activeTaskId, unlinkTaskFromTimer, settings, dailyStudyTime,
    pomodoroSessions, incrementPomodoroSessions, studySessions,
    addStudySession, isRest, setIsRest, addTask, weeklyStudyTime,
    googleConnected, triggerTasksSync, importGoogleTasks
  } = useApp();

  const [sessionType, setSessionType] = useState<'pomodoro' | 'chrono'>('pomodoro');
  const [cacheInput, setCacheInput] = useState('');
  const [cacheEntries, setCacheEntries] = useState<string[]>([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [nextGoal, setNextGoal] = useState('');
  const [tipIndex, setTipIndex] = useState(0);
  const [conceptIndex, setConceptIndex] = useState(0);
  const [owasClaimed, setOwasClaimed] = useState(false);
  const [syncingTasks, setSyncingTasks] = useState(false);
  const restStartRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const tipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDate = format(new Date(), "d 'de' MMMM yyyy", { locale: es as any });

  const tasksCompletedToday = useMemo(() => 
    tasks.filter(t => t.completedAt && t.completedAt.startsWith(todayStr)).length,
    [tasks, todayStr]
  );
  const activeTasksCount = useMemo(() => 
    tasks.filter(t => t.status !== 'completado').length,
    [tasks]
  );
  const streak = useMemo(() => calculateStreak(weeklyStudyTime), [weeklyStudyTime]);

  const recentSessions = useMemo(() => 
    [...studySessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 5),
    [studySessions]
  );
  const totalRecent = useMemo(() => recentSessions.reduce((acc, s) => acc + s.duration, 0), [recentSessions]);

  const pomodoroGoal = settings.pomodoroGoal || 4;
  const pomodoroProgress = Math.min(pomodoroSessions, pomodoroGoal);
  const progressPercent = Math.round((pomodoroProgress / pomodoroGoal) * 100);

  const weekDayData = useMemo(() => {
    const today = new Date();
    const days: { label: string; minutes: number }[] = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      days.push({ label: dayNames[d.getDay()], minutes: weeklyStudyTime[key] || 0 });
    }
    return days;
  }, [weeklyStudyTime]);

  const towerFilled = Math.min(pomodoroSessions, maxTowerBlocks);
  const isTowerComplete = towerFilled >= maxTowerBlocks;
  const owasToday = pomodoroSessions;

  useEffect(() => {
    tipTimerRef.current = setInterval(() => setTipIndex(prev => (prev + 1) % tips.length), 15000);
    return () => { if (tipTimerRef.current) clearInterval(tipTimerRef.current); };
  }, []);

  useEffect(() => {
    const ci = setInterval(() => setConceptIndex(prev => (prev + 1) % repasoConcepts.length), 12000);
    return () => clearInterval(ci);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayLabel = todayDate.charAt(0).toUpperCase() + todayDate.slice(1);
  const restElapsed = isRest ? sessionTime - restStartRef.current : 0;
  const restTimeLeft = Math.max(0, settings.shortBreakTime - restElapsed);
  const displayTime = sessionType === 'pomodoro' ? Math.max(0, settings.pomodoroTime - sessionTime) : sessionTime;

  const progressPct = useMemo(() => {
    if (sessionType === 'chrono' || settings.pomodoroTime === 0) return 0;
    return Math.min(100, (sessionTime / settings.pomodoroTime) * 100);
  }, [sessionTime, settings.pomodoroTime, sessionType]);

  const restProgressPct = useMemo(() => {
    if (!isRest || settings.shortBreakTime === 0) return 0;
    return Math.min(100, (restElapsed / settings.shortBreakTime) * 100);
  }, [restElapsed, settings.shortBreakTime, isRest]);

  const currentProgress = isRest ? restProgressPct : progressPct;

  useEffect(() => {
    if (isTimerActive && !isRest && sessionTime >= settings.pomodoroTime && !hasTriggeredRef.current && sessionType === 'pomodoro') {
      hasTriggeredRef.current = true;
      setIsRest(true);
      restStartRef.current = sessionTime;
      incrementPomodoroSessions();
      setShowCompletion(true);
    }
    if (isRest || !isTimerActive || sessionType !== 'pomodoro') hasTriggeredRef.current = false;
  }, [sessionTime, isTimerActive, sessionType, isRest, settings.pomodoroTime]);

  useEffect(() => {
    if (isRest && restElapsed >= settings.shortBreakTime) {
      setIsRest(false);
      resetTimer();
      toast.success('Descanso completado');
    }
  }, [restElapsed, isRest, settings.shortBreakTime]);

  const handleReset = () => {
    if (sessionTime >= 600) {
      addStudySession({
        type: sessionType, startedAt: new Date(Date.now() - sessionTime * 1000).toISOString(),
        endedAt: new Date().toISOString(), duration: sessionTime,
        taskId: activeTaskId || undefined, courseId: undefined, pauseCount: 0,
      });
    }
    resetTimer();
  };

  const handleToggle = () => {
    toggleTimer();
    if (!isTimerActive) toast.success(isRest ? 'Descanso reanudado' : 'Sesión iniciada');
  };

  const handleTypeChange = (type: 'pomodoro' | 'chrono') => {
    if (isTimerActive && sessionTime >= 600) handleReset();
    else resetTimer();
    setSessionType(type);
    setIsRest(false);
  };

  const handleCacheSubmit = useCallback(() => {
    if (!cacheInput.trim()) return;
    setCacheEntries(prev => [cacheInput.trim(), ...prev]);
    setCacheInput('');
  }, [cacheInput]);

  const handleCacheDelete = useCallback((idx: number) => {
    setCacheEntries(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCacheToTask = useCallback((text: string) => {
    addTask({ title: text, course: 'General', courseColor: '#E11D48', priority: 'medium', urgent: false, important: false });
    toast.success('Nota convertida en tarea');
  }, [addTask]);

  const handleTaskSync = useCallback(async () => {
    setSyncingTasks(true);
    try {
      await triggerTasksSync();
      const count = await importGoogleTasks();
      toast.success(count > 0 ? `${count} tareas importadas de Google Tasks` : 'Tareas sincronizadas');
    } catch { toast.error('Error al sincronizar tareas'); }
    setSyncingTasks(false);
  }, [triggerTasksSync, importGoogleTasks]);

  const handleClaimOwas = useCallback(() => {
    setOwasClaimed(true);
    toast.success(`🎉 ¡${owasToday} Owas reclamadas! Torre del conocimiento completa.`);
  }, [owasToday]);

  const handleCloseCompletion = useCallback(() => {
    setShowCompletion(false);
    setNextGoal('');
    if (nextGoal.trim()) toast.success(`Meta: "${nextGoal.trim()}"`);
  }, [nextGoal]);

  const currentConcept = repasoConcepts[conceptIndex];
  const canWriteCache = isTimerActive && !isRest;
  const taskStudyTime = activeTask?.studyTime || 0;

  const upTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completado')
      .sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); })
      .slice(0, 5), [tasks]
  );

  const rcNotes = useMemo(() =>
    [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5), [notes]
  );

  const heatmapColors = [
    'var(--bg-hover)',
    'color-mix(in srgb, var(--accent) 15%, transparent)',
    'color-mix(in srgb, var(--accent) 40%, transparent)',
    'color-mix(in srgb, var(--accent) 70%, transparent)',
    'color-mix(in srgb, var(--accent) 95%, transparent)',
  ];

  const heatmap = useMemo(() => {
    const labels = ['Sin actividad', 'Bajo', 'Medio', 'Alto', 'Máximo'];
    return Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i);
      const secs = weeklyStudyTime[format(d, 'yyyy-MM-dd')] || 0;
      const lvl = secs === 0 ? 0 : secs < 1800 ? 1 : secs < 3600 ? 2 : secs < 7200 ? 3 : 4;
      return { lvl, tip: `${format(d, 'd/M')} — ${labels[lvl]}` };
    });
  }, [weeklyStudyTime]);

  const totalMin = useMemo(() => Math.round(dailyStudyTime / 60), [dailyStudyTime]);
  const GOAL_MIN = 240;
  const goalProgress = useMemo(() => Math.min(100, Math.round((dailyStudyTime / (GOAL_MIN * 60)) * 100)), [dailyStudyTime]);
  const weekTotal = useMemo(() => weekDayData.reduce((acc, d) => acc + d.minutes, 0), [weekDayData]);

  const timerDisplayVal = useMemo(() => {
    const total = settings.pomodoroTime || 1500;
    const left = Math.max(0, total - Math.min(sessionTime, total));
    return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  }, [sessionTime, settings.pomodoroTime]);

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-background">
      {/* Top Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-borderDark/50 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-wide text-textMain">Estudio</h1>
            <button className="text-textDim hover:text-textMain transition-colors">
              <Edit3 size={18} />
            </button>
          </div>
          <p className="text-sm text-textDim mt-1">Enfócate profundamente, los resultados llegan.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-full border border-borderDark">
            <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]"></div>
            <span className="text-xs font-medium text-textMain">Conectado</span>
          </div>
          <button className="relative text-textDim hover:text-textMain transition-colors">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full"></span>
          </button>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold glow-red digital-font tracking-wider">
                {format(new Date(), 'HH:mm')}
              </span>
              <span className="text-sm text-accent digital-font">
                {format(new Date(), 'ss')}
              </span>
            </div>
            <p className="text-xs text-textDim capitalize">{todayDate}</p>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col xl:flex-row gap-6 custom-scroll">
        
        {/* Left Column (Timer Area) */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* Timer Card */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-5 flex flex-col items-center relative overflow-hidden flex-1 min-h-[400px]">
            {/* Timer Modes */}
            <div className="flex space-x-2 bg-background p-1.5 rounded-xl border border-borderDark mb-8 w-full max-w-2xl justify-between">
              <button 
                onClick={() => handleTypeChange('pomodoro')}
                className={`flex items-center justify-center gap-2 flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${sessionType === 'pomodoro' && !isRest ? 'bg-accent/10 text-accent' : 'text-textDim hover:text-textMain hover:bg-surface'}`}
              >
                <Flame size={16} /> Pomodoro
              </button>
              <button 
                onClick={() => { handleTypeChange('pomodoro'); setIsRest(true); }}
                className={`flex items-center justify-center gap-2 flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${sessionType === 'pomodoro' && isRest && settings.shortBreakTime > 0 ? 'bg-success/10 text-success' : 'text-textDim hover:text-textMain hover:bg-surface'}`}
              >
                <Coffee size={16} /> Descanso corto
              </button>
              <button 
                onClick={() => handleTypeChange('chrono')}
                className={`flex items-center justify-center gap-2 flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${sessionType === 'chrono' ? 'bg-info/10 text-info' : 'text-textDim hover:text-textMain hover:bg-surface'}`}
              >
                <Zap size={16} /> Cronómetro
              </button>
            </div>

            {/* Main Timer Display */}
            <div className="flex flex-col items-center justify-center my-8 relative w-full">
              <p className={`text-sm font-semibold tracking-widest mb-4 uppercase ${isRest ? 'text-success' : 'text-accent'}`}>
                {isRest ? 'Descanso' : (sessionType === 'pomodoro' ? 'Enfoque' : 'Cronómetro')}
              </p>
              
              <div className={`text-[8rem] md:text-[10rem] lg:text-[12rem] leading-none font-semibold digital-font tracking-tight ${isRest ? 'glow-green' : 'glow-red'}`}>
                {isRest ? formatTime(restTimeLeft) : formatTime(displayTime)}
              </div>

              {/* Progress Dots (Simulated Ring) */}
              <div className="w-full max-w-md h-2 mt-8 flex justify-between px-4">
                {Array.from({ length: 45 }).map((_, i) => {
                  const isActive = i < Math.floor((currentProgress / 100) * 45);
                  return (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${isActive ? (isRest ? 'bg-success shadow-[0_0_5px_var(--success)]' : 'bg-accent shadow-[0_0_5px_var(--accent)]') : 'bg-borderDark'}`}></div>
                  )
                })}
              </div>
            </div>

            {/* Current Task */}
            {activeTask && (
              <div className="flex items-center gap-3 bg-background px-5 py-2.5 rounded-full border border-borderDark mt-8 mb-10 max-w-md w-full">
                <Target className="text-accent text-sm" size={16} />
                <span className="text-sm text-textDim flex-1 truncate">
                  Trabajando en: <span className="text-textMain font-medium">{activeTask.title}</span>
                </span>
                <button onClick={unlinkTaskFromTimer} className="ml-2 text-textDim hover:text-textMain bg-surface2 p-1.5 rounded-md transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
            {!activeTask && (
              <div className="flex items-center gap-3 bg-background px-5 py-2.5 rounded-full border border-borderDark mt-8 mb-10 max-w-md w-full opacity-50">
                <Target className="text-textDim text-sm" size={16} />
                <span className="text-sm text-textDim flex-1 text-center">
                  Sin tarea vinculada
                </span>
              </div>
            )}

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-10 mt-auto pt-4">
              <button onClick={handleReset} className="flex flex-col items-center gap-2 text-textDim hover:text-textMain transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-surface2 border border-borderDark flex items-center justify-center group-hover:bg-borderDark transition-colors">
                  <RotateCcw size={18} />
                </div>
                <span className="text-xs font-medium">Reiniciar</span>
              </button>
              
              <button 
                onClick={handleToggle}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 ${isTimerActive ? 'bg-surface2 border border-borderDark' : 'bg-accent glow-red-box'}`}
              >
                {isTimerActive ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-2" />}
              </button>

              <button 
                onClick={() => { if (isTimerActive && !isRest) { setIsRest(true); restStartRef.current = sessionTime; incrementPomodoroSessions(); setShowCompletion(true); } }}
                className="flex flex-col items-center gap-2 text-textDim hover:text-success transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-surface2 border border-borderDark flex items-center justify-center group-hover:border-success/50 transition-colors">
                  <Check size={18} />
                </div>
                <span className="text-xs font-medium">Completar</span>
              </button>
            </div>

            {/* Stats Footer inside Timer */}
            <div className="w-full flex justify-between px-10 mt-12 pt-6 border-t border-borderDark/50">
              <div className="text-center">
                <p className="text-[10px] text-textDim uppercase tracking-wider mb-1 font-semibold">Ciclo</p>
                <p className="text-xl font-semibold text-textMain">{pomodoroProgress} <span className="text-textDim text-lg">/ {pomodoroGoal}</span></p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-textDim uppercase tracking-wider mb-1 font-semibold">Sesiones Hoy</p>
                <p className="text-xl font-semibold text-textMain">{pomodoroSessions}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-textDim uppercase tracking-wider mb-1 font-semibold">Tiempo Enfocado</p>
                <p className="text-xl font-semibold text-textMain">{Math.floor(dailyStudyTime / 60)}h {dailyStudyTime % 60}m</p>
              </div>
            </div>
          </div>

          {/* Bottom Left Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribucion de Tiempo */}
            <div className="bg-surface2 rounded-xl border border-borderDark p-5">
              <div className="flex items-center gap-2 mb-6 text-sm text-textDim font-semibold uppercase tracking-wider">
                <ChartPie size={16} /> Distribución de tiempo
              </div>
              <div className="flex items-center justify-between">
                {/* SVG Donut */}
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="transparent" r="40" stroke="var(--border-default)" strokeWidth="15"></circle>
                    <circle cx="50" cy="50" fill="transparent" r="40" stroke="var(--accent)" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * 0.7)} strokeWidth="15" className="transition-all duration-1000 ease-out"></circle>
                    <circle cx="50" cy="50" fill="transparent" r="40" stroke="var(--success)" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * 0.2)} strokeDasharray-offset={251.2 * 0.7} strokeWidth="15" className="transition-all duration-1000 ease-out" style={{ strokeDashoffset: 251.2 - (251.2 * 0.2), strokeDasharray: '251.2', transform: 'rotate(252deg)', transformOrigin: 'center' }}></circle>
                  </svg>
                </div>
                {/* Legend */}
                <div className="space-y-3 flex-1 ml-6">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>
                      <span className="text-textMain">Enfoque</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
                      <span className="text-textMain">Descansos</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-info"></span>
                      <span className="text-textMain">Cronómetro</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Racha de Enfoque */}
            <div className="bg-surface2 rounded-xl border border-borderDark p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4 text-sm text-textDim font-semibold uppercase tracking-wider">
                  <Flame size={16} /> Racha de enfoque
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-semibold glow-red text-accent">{streak}</span>
                  <span className="text-lg text-accent mb-0.5">días</span>
                </div>
              </div>
              <div className="flex items-end justify-between h-20 mt-4 gap-1">
                {weekDayData.map((day, idx) => {
                  const maxMin = Math.max(...weekDayData.map(d => d.minutes), 1);
                  const h = Math.max(8, (day.minutes / maxMin) * 80);
                  const isActive = idx === 6;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 w-full">
                      <div className={`w-full rounded-sm transition-all ${isActive ? 'bg-accent glow-red-box' : 'bg-accent opacity-50'}`} style={{ height: `${h}%` }}></div>
                      <span className={`text-[10px] ${isActive ? 'text-white font-semibold' : 'text-textDim'}`}>{day.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="w-full xl:w-96 flex flex-col gap-6 flex-shrink-0">
          
          {/* Metrics Cards */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-textDim font-semibold uppercase tracking-wider flex items-center gap-2">
                <LineChart size={16} /> Métricas de hoy
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background border border-borderDark rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Clock size={16} />
                  </div>
                  <p className="text-xs text-textDim">Tiempo enfocado</p>
                </div>
                <p className="text-xl font-semibold text-textMain mb-1">{Math.floor(dailyStudyTime / 60)}h {dailyStudyTime % 60}m</p>
              </div>
              <div className="bg-background border border-borderDark rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success">
                    <CheckCircle size={16} />
                  </div>
                  <p className="text-xs text-textDim">Sesiones</p>
                </div>
                <p className="text-xl font-semibold text-textMain mb-1">{pomodoroSessions}</p>
              </div>
              <div className="bg-background border border-borderDark rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info">
                    <Target size={16} />
                  </div>
                  <p className="text-xs text-textDim">Tareas hechas</p>
                </div>
                <p className="text-xl font-semibold text-textMain mb-1">{tasksCompletedToday}</p>
              </div>
              <div className="bg-background border border-borderDark rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                    <Trophy size={16} />
                  </div>
                  <p className="text-xs text-textDim">Owas</p>
                </div>
                <p className="text-xl font-semibold text-warning mb-1">{owasToday}</p>
              </div>
            </div>
            
            {/* Quote */}
            <div className="mt-4 bg-background border border-borderDark rounded-xl p-4 flex gap-4">
              <Quote className="text-accent text-xl mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm text-textMain italic mb-2">"{tips[tipIndex]}"</p>
              </div>
            </div>
          </div>

          {/* Session History */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-5 flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm text-textDim font-semibold uppercase tracking-wider flex items-center gap-2">
                <RotateCcw size={16} /> Historial de sesiones
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scroll space-y-4">
              <div className="grid grid-cols-12 gap-2 text-[10px] text-textDim uppercase tracking-wider border-b border-borderDark pb-2">
                <div className="col-span-2 text-center">Tipo</div>
                <div className="col-span-5">Actividad</div>
                <div className="col-span-2 text-center">Dur.</div>
                <div className="col-span-3 text-right">Completado</div>
              </div>
              
              {recentSessions.length > 0 ? recentSessions.map((s, i) => {
                const isPomo = s.type === 'pomodoro';
                return (
                  <div key={s.id || i} className="grid grid-cols-12 gap-2 items-center text-sm py-2 hover:bg-surface rounded-lg transition-colors px-1">
                    <div className="col-span-2 flex justify-center">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs ${isPomo ? 'bg-accent/20 text-accent' : 'bg-info/20 text-info'}`}>
                        {isPomo ? <Flame size={12} /> : <Zap size={12} />}
                      </div>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <p className="text-textMain font-medium truncate">{isPomo ? 'Pomodoro' : 'Crono'}</p>
                    </div>
                    <div className="col-span-2 text-center text-textMain font-medium">{Math.floor(s.duration / 60)}m</div>
                    <div className="col-span-3 flex justify-end items-center gap-2">
                      <span className="text-xs text-textDim">{format(new Date(s.startedAt), 'HH:mm')}</span>
                      <CheckCircle className="text-success" size={14} />
                    </div>
                  </div>
                );
              }) : (
                <div className="py-8 text-center text-textDim text-sm flex flex-col items-center gap-2">
                  <Clock size={24} className="opacity-20" />
                  No hay sesiones recientes
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ═══ RACHA ═══ */}
        <div className="rounded-xl p-5 bg-surface border border-borderDark flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/10 text-warning">
                <Flame size={16} strokeWidth={1.5} />
              </div>
              <span className="text-base font-semibold text-textMain">Racha</span>
            </div>
            <span className="text-lg font-semibold font-mono text-warning">{streak} días</span>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-textDim">Meta diaria</span>
              <span className="text-xs font-semibold text-textMain">{totalMin} / {GOAL_MIN} min</span>
            </div>
            <div className="h-[3px] rounded-full bg-surface2 border border-borderDark/30 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-500" style={{ width: `${goalProgress}%` }} />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-textDim" strokeWidth={1.5} />
                <span className="text-xs font-medium text-textDim">Semanal</span>
              </div>
              <span className="text-[11px] font-semibold text-textDim">{weekTotal} min</span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {weekDayData.map((b, i) => {
                const maxMin = Math.max(...weekDayData.map(d => d.minutes), 1);
                const pct = Math.min(100, (b.minutes / maxMin) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end group">
                    <div
                      className="w-full rounded-t-sm transition-all duration-300 cursor-pointer"
                      style={{
                        height: `${Math.max(3, pct)}%`,
                        background: `linear-gradient(to top, ${pct > 60 ? 'var(--accent)' : pct > 30 ? 'color-mix(in srgb, var(--accent) 70%, transparent)' : 'color-mix(in srgb, var(--accent) 40%, transparent)'}, transparent)`,
                      }}
                    />
                    <span className="text-[9px] font-medium text-textDim/60">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} className="text-textDim" strokeWidth={1.5} />
              <span className="text-xs font-medium text-textDim">Actividad</span>
              <span className="text-[11px] font-semibold text-textDim ml-auto">{heatmap.filter(d => d.lvl > 0).length}/30</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {heatmap.map((d, i) => (
                <div
                  key={i}
                  className="transition-all duration-150 hover:scale-125 hover:z-10 cursor-pointer rounded-[3px]"
                  style={{ backgroundColor: heatmapColors[d.lvl], width: 12, height: 12 }}
                  title={d.tip}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-2 text-[9px] font-medium text-textDim/50">
              <span>Menos</span>
              {[0, 1, 2, 3, 4].map(l => (
                <div key={l} className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: heatmapColors[l] }} />
              ))}
              <span>Más</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-surface2/30 border border-borderDark/20">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isTimerActive ? 'bg-accent/10 text-accent' : 'bg-surface2 text-textDim'}`}>
                <TimerIcon size={14} strokeWidth={1.5} />
              </div>
              <div>
                <span className="text-xs font-medium text-textMain">Timer</span>
                <p className="text-[11px] text-textDim">{isTimerActive ? 'En sesión' : 'Inactivo'}</p>
              </div>
            </div>
            <span className={`text-base font-semibold font-mono ${isTimerActive ? 'text-accent' : 'text-textDim'}`}>{timerDisplayVal}</span>
          </div>
      </div>

      {/* ── POMODORO COMPLETION DIALOG ── */}
      {showCompletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCompletion(false)}>
          <div className="bg-surface2 rounded-xl border border-borderDark w-full max-w-md max-h-[85vh] overflow-y-auto p-5 shadow-sm" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-accent" />
              </div>
              <h2 className="text-2xl font-semibold text-textMain">¡Enfoque Completado!</h2>
              <p className="text-sm text-textDim mt-2">Descansa {Math.floor(settings.shortBreakTime / 60)} min.</p>
            </div>
            <div className="flex justify-center gap-2 mb-6">
              {Array.from({ length: pomodoroGoal }).map((_, i) => (
                <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${i < pomodoroProgress ? 'bg-accent text-white shadow-[0_0_10px_var(--accent)]' : 'bg-surface border border-borderDark text-transparent'}`}>
                  {i < pomodoroProgress ? '✓' : ''}
                </div>
              ))}
            </div>
            <div className="text-center mb-6 text-sm text-textDim">
              {pomodoroProgress}/{pomodoroGoal} pomodoros · {progressPercent}% de la meta
            </div>
            
            <button onClick={handleCloseCompletion} className="w-full bg-surface border border-borderDark text-textMain py-3 rounded-lg font-medium hover:bg-surface2 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );

}
