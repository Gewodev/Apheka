import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Timer, Clock, Trophy, Zap, SkipForward, ArrowUpRight, Sparkles, Brain, Activity, ShieldCheck } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type TimerMode = 'pomodoro' | 'break' | 'chrono';

const POMODORO_TIME = 25 * 60;
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;

export default function Estudio({ isActive, setIsActive, mode, setMode }: {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
}) {
  const { sessionTime, pomodoroSessions, incrementSessionTime, incrementPomodoroSessions } = useApp();
  const [seconds, setSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [breakType, setBreakType] = useState<'short' | 'long'>('short');
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = window.setInterval(() => {
        setSeconds(s => s + 1);
        if (mode === 'pomodoro' || mode === 'chrono') incrementSessionTime();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, mode, incrementSessionTime]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = useCallback(() => setIsActive(true), [setIsActive]);
  const handlePause = useCallback(() => setIsActive(false), [setIsActive]);
  const handleReset = useCallback(() => { setIsActive(false); setSeconds(0); }, [setIsActive]);

  const handleComplete = useCallback(() => {
    incrementPomodoroSessions();
    setIsActive(false);
    setSeconds(0);
    if (mode === 'pomodoro') {
      setMode('break');
    }
  }, [incrementPomodoroSessions, setIsActive, mode, setMode]);

  const currentModeTime = mode === 'pomodoro' ? POMODORO_TIME : mode === 'break' ? (breakType === 'short' ? SHORT_BREAK : LONG_BREAK) : POMODORO_TIME;
  const progress = mode === 'chrono' ? 0 : Math.min(seconds / currentModeTime, 1);
  const remaining = mode === 'chrono' ? 0 : currentModeTime - seconds;
  const isComplete = mode !== 'chrono' && seconds >= currentModeTime;

  useEffect(() => {
    if (isComplete && mode === 'pomodoro') {
      handleComplete();
    }
  }, [isComplete, mode, handleComplete]);

  return (
    <div className="page-container max-w-[1400px]">
      
      {/* ARCHITECTURAL HEADER */}
      <div className="flex justify-between items-end mb-16 relative">
        <div className="absolute -left-12 top-0 bottom-0 w-1 bg-accent/20" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={14} className="text-accent" />
            <span className="text-[10px] font-black text-tertiary uppercase tracking-[0.4em]">Laboratorio de Enfoque</span>
          </div>
          <h1 className="text-7xl font-black text-primary tracking-tighter leading-none">
            {mode === 'pomodoro' ? 'Estudio' : mode === 'break' ? 'Descanso' : 'Libre'}
            <span className="text-accent">.</span>
          </h1>
          <p className="text-lg text-secondary font-medium tracking-tight uppercase tracking-widest">
            {isActive ? 'Protocolo de Enfoque Activado' : 'Esperando Inicio de Sesión'}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-4 mb-2">
            <span className="text-3xl font-black text-primary tracking-tighter tabular-nums leading-none">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 flex items-center gap-2">
            <Activity size={12} className="text-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Monitorización en Vivo</span>
          </div>
        </div>
      </div>

      {/* MODE SELECTOR - REMASTERED */}
      <div className="flex justify-center mb-24">
        <div className="flex bg-surface p-2 rounded-[24px] border border-default shadow-2xl relative">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <span className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">Seleccionar Modo</span>
          </div>
          {[
            { id: 'pomodoro' as TimerMode, label: 'Pomodoro', icon: Timer },
            { id: 'break' as TimerMode, label: 'Descanso', icon: Coffee },
            { id: 'chrono' as TimerMode, label: 'Chrono', icon: Clock },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); handleReset(); }}
              className={`flex items-center gap-3 px-12 py-4 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                mode === m.id
                  ? 'bg-elevated text-primary border border-white/5 shadow-xl scale-105 z-10'
                  : 'text-tertiary hover:text-secondary hover:bg-hover'
              }`}
            >
              <m.icon size={16} className={mode === m.id ? 'text-accent' : ''} />
              <span>{m.label}</span>
              {mode === m.id && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-20 items-center">
        
        {/* TIMER DISPLAY - MASTERED */}
        <div className="col-span-12 lg:col-span-7 flex flex-col items-center">
          <div className="relative w-[500px] h-[500px] flex items-center justify-center group">
            {/* Architectural Rings */}
            <div className="absolute inset-0 rounded-full border border-white/[0.02]" />
            <div className="absolute inset-8 rounded-full border border-white/[0.01]" />
            
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="250" cy="250" r="230"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-20"
              />
              <circle
                cx="250" cy="250" r="230"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 230}
                strokeDashoffset={2 * Math.PI * 230 * (1 - progress)}
                className="timer-ring transition-all duration-1000"
                style={{ filter: `drop-shadow(0 0 20px rgba(225, 29, 72, 0.4))` }}
              />
            </svg>

            <div className="flex flex-col items-center z-10">
              <div className="flex items-center gap-2 mb-2 opacity-40">
                <ShieldCheck size={14} className="text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Secure Session</span>
              </div>
              <span className="text-[120px] font-black text-primary tracking-tighter leading-none tabular-nums font-outfit">
                {formatTime(mode === 'chrono' ? seconds : remaining)}
              </span>
              <div className="flex items-center gap-4 mt-8">
                <div className="w-12 h-[1px] bg-white/10" />
                <span className="text-[10px] font-black text-tertiary uppercase tracking-[0.5em]">
                  {isActive ? 'Ejecutando' : 'Standby'}
                </span>
                <div className="w-12 h-[1px] bg-white/10" />
              </div>
            </div>
          </div>

          {/* CONTROLS - MASTERED */}
          <div className="flex items-center gap-12 mt-20">
            <button
              onClick={handleReset}
              className="w-16 h-16 rounded-2xl border border-default text-tertiary hover:text-primary hover:bg-elevated transition-all flex items-center justify-center group"
              title="Reiniciar"
            >
              <RotateCcw size={20} className="group-hover:rotate-[-45deg] transition-transform" />
            </button>

            <button
              onClick={isActive ? handlePause : handleStart}
              className={`w-32 h-32 rounded-[40px] flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 border-4 ${
                isActive ? 'bg-primary border-white/10 text-base' : 'bg-accent border-accent/20 text-white shadow-[0_20px_50px_rgba(225,29,72,0.3)]'
              }`}
            >
              {isActive ? <Pause size={48} fill="currentColor" /> : <Play size={48} className="ml-2" fill="currentColor" />}
            </button>

            <button
              onClick={handleComplete}
              className="w-16 h-16 rounded-2xl border border-default text-tertiary hover:text-primary hover:bg-elevated transition-all flex items-center justify-center group"
              title="Completar"
            >
              <Trophy size={20} className="group-hover:scale-125 transition-transform" />
            </button>
          </div>
        </div>

        {/* ANALYTICS PANEL */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-8">
          <div className="bento-card relative">
            <div className="absolute top-0 right-0 p-8">
              <Activity size={24} className="text-accent/20" />
            </div>
            <div className="flex items-center gap-3 mb-12">
              <Sparkles size={20} className="text-accent" />
              <span className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em]">Métricas de Enfoque</span>
            </div>
            
            <div className="space-y-10">
              <div className="flex justify-between items-center group">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-elevated border border-default flex items-center justify-center transition-all group-hover:border-accent/30 group-hover:bg-accent/5">
                    <Trophy size={24} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-primary tracking-tight">Sesiones Logradas</p>
                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Hoy</p>
                  </div>
                </div>
                <span className="text-4xl font-black text-primary tracking-tighter">{pomodoroSessions}</span>
              </div>

              <div className="flex justify-between items-center group">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-elevated border border-default flex items-center justify-center transition-all group-hover:border-accent/30 group-hover:bg-accent/5">
                    <Clock size={24} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-primary tracking-tight">Tiempo Acumulado</p>
                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Enfoque Total</p>
                  </div>
                </div>
                <span className="text-4xl font-black text-primary tracking-tighter">{formatTime(sessionTime)}</span>
              </div>

              <div className="pt-10 border-t border-default/50">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-tertiary mb-4">
                  <span>Intensidad de Trabajo</span>
                  <span className="text-accent">Optimizado</span>
                </div>
                <div className="progress-track h-2 bg-white/5">
                  <div className="progress-thumb" style={{ width: '85%' }}>
                    <div className="progress-glow" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card p-8 flex items-center justify-between group cursor-pointer hover:bg-elevated transition-all border-dashed">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-accent/5 flex items-center justify-center border border-accent/20">
                <Zap size={24} className="text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">Optimización</p>
                <p className="text-base text-primary font-bold tracking-tight">Activar Sonidos de Fondo para Enfoque</p>
              </div>
            </div>
            <ArrowUpRight size={20} className="text-muted group-hover:text-primary transition-all translate-y-1 -translate-x-1 group-hover:translate-y-0 group-hover:translate-x-0" />
          </div>
        </div>

      </div>
    </div>
  );
}
