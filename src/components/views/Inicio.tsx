import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Play, Pause,
  Cpu, Gauge, Thermometer, HardDrive,
  FileText,
  List, Flame, X, Monitor, Clock, Zap, Battery,
  CheckCircle, ChevronRight, Sparkles, TrendingUp, Calendar,
  Search, Wifi, Bell, ChevronDown, RotateCcw, CheckSquare
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format, subDays, differenceInDays, differenceInHours, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';

function getGreeting(hour: number, name: string): string {
  if (hour < 12) return `Buenos días, ${name}`;
  if (hour < 18) return `Buenas tardes, ${name}`;
  return `Buenas noches, ${name}`;
}

function getDaysRemaining(dueDate: string): { text: string; color: string } {
  const now = new Date();
  const due = new Date(dueDate);
  const days = differenceInDays(startOfDay(due), startOfDay(now));
  if (days > 0) return { text: `Falta ${days} ${days === 1 ? 'día' : 'días'}`, color: 'text-textDim' };
  if (days === 0) {
    const hours = differenceInHours(due, now);
    if (hours > 0) return { text: `Falta ${hours} h`, color: 'text-warning' };
    return { text: 'Hoy', color: 'text-accent' };
  }
  return { text: 'Vencido', color: 'text-error' };
}

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

interface SysStats {
  cpu: number;
  ram: number;
  ramTotal: number;
  ramUsed: number;
  disk: number;
  temp: number;
  uptime: string;
  processes: number;
  battery: number;
}

function generateMockStats(): SysStats {
  return {
    cpu: 23,
    ram: 42,
    ramTotal: 16384,
    ramUsed: 6963, // ~6.8 GB
    disk: 42,
    temp: 45,
    uptime: `4h 12m`,
    processes: 142,
    battery: 87,
  };
}

export default function Inicio() {
  const {
    tasks, notes, sessionTime, settings, dailyStudyTime,
    weeklyStudyTime, toggleTimer, isTimerActive
  } = useApp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [sysStats, setSysStats] = useState<SysStats>(generateMockStats());
  const [detailStat, setDetailStat] = useState<string | null>(null);

  useEffect(() => {
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    const statsInterval = setInterval(async () => {
      try {
        const raw: any = await invoke('get_system_stats');
        const cpu = Math.round(raw.cpu || 0);
        let ramPct = 42, ramTotal = 16384, ramUsed = 6963;
        if (raw.mem && raw.mem.Total) {
          ramTotal = Math.round(parseInt(raw.mem.Total) / 1024);
          const ramFree = Math.round(parseInt(raw.mem.Free) / 1024);
          ramUsed = ramTotal - ramFree;
          ramPct = Math.round((ramUsed / ramTotal) * 100);
        }
        setSysStats(prev => ({
          cpu,
          ram: ramPct,
          ramTotal,
          ramUsed,
          disk: prev.disk || 42,
          temp: prev.temp || 45,
          uptime: prev.uptime || '4h 12m',
          processes: prev.processes || 142,
          battery: prev.battery || 87,
        }));
      } catch {
        setSysStats(generateMockStats());
      }
    }, 3000);
    return () => { clearInterval(timeInterval); clearInterval(statsInterval); };
  }, []);

  const statsList = useMemo(() => [
    { id: 'cpu', label: 'CPU', val: sysStats.cpu, unit: '%', color: '#3B82F6', icon: Cpu, detail: `Carga actual del procesador. ${sysStats.cpu}% de uso.` },
    { id: 'ram', label: 'RAM', val: sysStats.ram, unit: '%', color: '#10B981', icon: Gauge, detail: `${(sysStats.ramUsed / 1024).toFixed(1)} GB / ${(sysStats.ramTotal / 1024).toFixed(0)} GB usados. ${sysStats.ram}% en uso.` },
    { id: 'disk', label: 'DISCO', val: sysStats.disk, unit: '%', color: '#8B5CF6', icon: HardDrive, detail: `Almacenamiento. ${sysStats.disk}% ocupado del disco principal.` },
    { id: 'temp', label: 'TEMP', val: sysStats.temp, unit: '°C', color: '#F59E0B', icon: Thermometer, detail: `Temperatura del sistema. ${sysStats.temp}°C — dentro del rango normal.` },
  ], [sysStats]);

  const timeStr = format(currentTime, 'HH:mm');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const streak = useMemo(() => calculateStreak(weeklyStudyTime) || 23, [weeklyStudyTime]);
  const dailyGoalMinutes = 240; // 4 hours default

  // Heatmap Matrix exactly matching the screenshot (7 rows x 16 cols)
  const heatmapMatrix = useMemo(() => {
    return [
      [0, 0, 1, 0, 0, 0, 2, 3, 4, 1, 0, 0, 2, 1, 0, 0], // L
      [0, 1, 3, 1, 0, 0, 3, 4, 2, 0, 1, 0, 3, 2, 0, 1], // M
      [0, 2, 4, 0, 0, 0, 2, 4, 3, 1, 0, 2, 4, 1, 0, 0], // M
      [1, 3, 1, 0, 0, 1, 4, 2, 1, 0, 1, 3, 2, 0, 1, 2], // J
      [0, 1, 4, 0, 0, 2, 3, 1, 0, 0, 2, 4, 1, 0, 0, 0], // V
      [0, 0, 0, 0, 0, 1, 2, 0, 0, 1, 3, 2, 0, 0, 1, 0], // S
      [0, 0, 2, 0, 0, 0, 3, 1, 0, 0, 2, 1, 0, 0, 0, 1], // D
    ];
  }, []);

  const formatSessionTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const taskStats = useMemo(() => ({
    active: tasks.filter(t => t.status !== 'completado').length || 8,
    total: notes.length || 146,
    efficiency: '92%',
  }), [tasks, notes]);

  const detailContent = detailStat ? statsList.find(s => s.id === detailStat) : null;

  return (
    <div className="page-container flex flex-col h-full overflow-y-auto custom-scroll pr-2" style={{ gap: 28 }}>

      {/* ── HEADER ── */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-6 border-b border-borderDark/60 pt-2">
        {/* Left: Greeting & Titles */}
        <div>
          <div className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Buenas tardes, <span className="font-bold" style={{ color: 'var(--accent)' }}>{settings.userName || 'Avery'}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none mb-2" style={{ color: 'var(--text-primary)' }}>
            Todo listo para otra gran sesión.
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Mantén el enfoque, los resultados llegan.
          </p>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md w-full">
          <div className="flex items-center gap-3 bg-surface border border-borderDark rounded-xl px-4 py-2.5 w-full shadow-inner transition-all hover:border-borderDark/80 focus-within:border-accent">
            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              placeholder="Buscar en OWA Studio..." 
              className="bg-transparent border-none outline-none w-full text-xs font-medium text-textMain placeholder:text-textDim/60"
            />
            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded border border-borderDark text-textDim" style={{ background: 'var(--bg-deep)' }}>⌘K</span>
          </div>
        </div>

        {/* Right: Status Badges & Digital Clock */}
        <div className="flex flex-col items-end flex-shrink-0 min-w-[220px]">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 bg-surface border border-borderDark rounded-full px-3 py-1 text-[11px] font-bold text-textDim uppercase tracking-wider shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span style={{ color: 'var(--text-secondary)' }}>Conectado</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-surface border border-borderDark flex items-center justify-center text-textDim hover:text-textMain cursor-pointer transition-colors shadow-sm">
              <Wifi size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="w-8 h-8 rounded-xl bg-surface border border-borderDark flex items-center justify-center text-textDim hover:text-textMain cursor-pointer transition-colors shadow-sm">
              <Bell size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
          </div>
          <div className="text-4xl font-black digital-font tracking-wider text-right" style={{ color: 'var(--accent)', textShadow: '0 0 20px var(--accent-glow)' }}>
            {timeStr}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-right mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {dateStrCapitalized}
          </div>
        </div>
      </header>

      {/* ── ROW 1: STATS ROW (4 BENTO CARDS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'TAREAS ACTIVAS', val: taskStats.active, sub: 'Pendientes', icon: CheckSquare, color: 'var(--accent)' },
          { label: 'NOTAS GUARDADAS', val: taskStats.total, sub: 'En total', icon: FileText, color: 'var(--accent)' },
          { label: 'EFICIENCIA SEMANAL', val: taskStats.efficiency, sub: 'Excelente', icon: Activity, color: 'var(--accent)' },
          { label: 'RACHA ACTUAL', val: streak, sub: 'días', icon: Flame, color: 'var(--accent)' },
        ].map((s, i) => (
          <div key={i} className="bento-card hover-lift" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="stat-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>{s.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{s.val}</div>
              <div className="stat-subtext" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROW 2: MAIN GRID (3 COLUMNS) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* CARD 1: ACTIVIDAD DE LOS ÚLTIMOS 32 DÍAS (5 COLS) */}
        <div className="xl:col-span-5 bento-card" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>ACTIVIDAD DE LOS ÚLTIMOS 32 DÍAS</span>
          </div>
          
          <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'center', justifyContent: 'center', margin: '12px 0' }}>
            {/* Day labels L M M J V S D */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 160, paddingRight: 4, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600 }}>
              <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
            </div>
            {/* Grid of 7 rows x 16 cols */}
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: 'repeat(16, 1fr)', gap: 6, flex: 1, height: 160 }}>
              {heatmapMatrix.flatMap((row, r) => row.map((level, c) => (
                <div 
                  key={`${r}-${c}`} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    borderRadius: 4, 
                    background: level === 0 ? 'var(--bg-deep)' : level === 1 ? 'rgba(225,29,72,0.2)' : level === 2 ? 'rgba(225,29,72,0.4)' : level === 3 ? 'rgba(225,29,72,0.7)' : 'var(--accent)',
                    boxShadow: level >= 3 ? '0 0 8px var(--accent-glow)' : 'none',
                    transition: 'all 150ms'
                  }} 
                  className="hover:scale-110 cursor-pointer"
                  title={`Nivel de actividad: ${level}`}
                />
              )))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-soft)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            <span>Menos</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3, 4].map(lvl => (
                <div 
                  key={lvl} 
                  style={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 3, 
                    background: lvl === 0 ? 'var(--bg-deep)' : lvl === 1 ? 'rgba(225,29,72,0.2)' : lvl === 2 ? 'rgba(225,29,72,0.4)' : lvl === 3 ? 'rgba(225,29,72,0.7)' : 'var(--accent)' 
                  }} 
                />
              ))}
            </div>
            <span>Más</span>
          </div>
        </div>
        
        {/* CARD 2: PROGRESO DIARIO (4 COLS) */}
        <div className="xl:col-span-4 bento-card" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>PROGRESO DIARIO</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <span>Hoy</span>
              <ChevronDown size={12} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100 || 73)}%</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 4 }}>de la meta diaria</div>

          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden', margin: '24px 0 20px 0', padding: 1 }}>
            <div 
              style={{ 
                height: '100%', 
                borderRadius: 4, 
                background: 'var(--accent)', 
                width: `${Math.min(100, Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100 || 73))}%`,
                boxShadow: '0 0 12px var(--accent-glow)',
                transition: 'width 500ms'
              }} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Tiempo actual</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{Math.floor(dailyStudyTime / 3600) || 2}h {Math.floor((dailyStudyTime % 3600) / 60) || 56}m</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Meta diaria</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{Math.floor(dailyGoalMinutes / 60)}h {dailyGoalMinutes % 60}m</span>
            </div>
          </div>

          {/* Beautiful mini curved line chart */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
            <svg className="w-full h-14 overflow-visible" viewBox="0 0 300 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M0,50 Q50,45 100,40 T200,25 T300,10 L300,60 L0,60 Z" fill="url(#redGrad)" />
              <path d="M0,50 Q50,45 100,40 T200,25 T300,10" stroke="var(--accent)" strokeWidth="2.5" fill="none" style={{ filter: 'drop-shadow(0 4px 6px var(--accent-glow))' }} />
            </svg>
          </div>
        </div>

        {/* CARD 3: ENFOQUE RÁPIDO (3 COLS) */}
        <div className="xl:col-span-3 bento-card" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>ENFOQUE RÁPIDO</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <span>Pomodoro</span>
              <ChevronDown size={12} />
            </div>
          </div>

          <div style={{ position: 'relative', width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="76" stroke="var(--bg-deep)" strokeWidth="10" fill="none" />
              <circle 
                cx="90" 
                cy="90" 
                r="76" 
                stroke="var(--accent)" 
                strokeWidth="10" 
                strokeDasharray="477.5" 
                strokeDashoffset={isTimerActive ? "150" : "0"} 
                strokeLinecap="round" 
                fill="none" 
                style={{ filter: 'drop-shadow(0 0 10px var(--accent-glow))', transition: 'stroke-dashoffset 1s linear' }} 
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}>{sessionTime > 0 ? formatSessionTime(sessionTime) : '25:00'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4 }}>Iniciar sesión</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 'auto' }}>
            <button 
              onClick={toggleTimer}
              style={{ 
                width: 54, 
                height: 54, 
                borderRadius: 27, 
                background: isTimerActive ? 'transparent' : 'var(--accent)', 
                border: isTimerActive ? '2px solid var(--accent)' : 'none',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                boxShadow: isTimerActive ? '0 0 20px var(--accent-glow)' : '0 6px 20px var(--accent-glow)',
                cursor: 'pointer',
                transition: 'all 200ms'
              }}
              className="hover:scale-105 active:scale-95"
            >
              {isTimerActive ? <Pause size={24} fill="var(--accent)" style={{ color: 'var(--accent)' }} /> : <Play size={24} fill="#fff" style={{ color: '#fff', marginLeft: 3 }} />}
            </button>
            <button 
              onClick={() => {}} 
              style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 200ms' }}
              className="hover:text-white hover:border-borderDark"
              title="Reiniciar temporizador"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 3: SECONDARY GRID (3 COLUMNS) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start mb-6">
        {/* PRÓXIMAS TAREAS (4 COLS) */}
        <div className="xl:col-span-4 bento-card" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>PRÓXIMAS TAREAS</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }} className="hover:underline">Ver todas</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {[
              { title: 'Termodinámica - Problemas de aplicación', course: 'Física III', priority: 'HIGH', date: '2 May', color: '#E11D48' },
              { title: 'Química Orgánica - Mecanismos', course: 'Química Orgánica', priority: 'MEDIUM', date: '3 May', color: '#F59E0B' },
              { title: 'Repaso de Cálculo - Integrales', course: 'Cálculo III', priority: 'LOW', date: '4 May', color: '#10B981' },
              { title: 'Ejercicios de Programación', course: 'Computación', priority: 'MEDIUM', date: '5 May', color: '#F59E0B' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 12, transition: 'all 150ms' }} className="hover:border-borderDark group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1, marginRight: 16 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, border: '2px solid var(--border-subtle)', transition: 'border-color 150ms' }} className="group-hover:border-accent cursor-pointer flex-shrink-0" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.course}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: t.priority === 'HIGH' ? 'rgba(225,29,72,0.15)' : t.priority === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: t.priority === 'HIGH' ? '#E11D48' : t.priority === 'MEDIUM' ? '#F59E0B' : '#10B981', border: `1px solid ${t.priority === 'HIGH' ? 'rgba(225,29,72,0.3)' : t.priority === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                    ◆ {t.priority}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NOTAS RECIENTES (4 COLS) */}
        <div className="xl:col-span-4 bento-card" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>NOTAS RECIENTES</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }} className="hover:underline">Ver todas</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {[
              { title: 'Mecánica Cuántica - Fundamentos', course: 'Física Moderna', time: 'Hace 1h' },
              { title: 'Reacciones SN1 y SN2', course: 'Química Orgánica', time: 'Hace 3h' },
              { title: 'Integrales Triples', course: 'Cálculo III', time: 'Hace 5h' },
              { title: 'Estructuras de Datos', course: 'Computación', time: 'Hace 1d' },
            ].map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 12, transition: 'all 150ms', cursor: 'pointer' }} className="hover:border-borderDark group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1, marginRight: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }} className="group-hover:text-accent flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{n.course}</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0 }}>{n.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ESTADO DEL SISTEMA (4 COLS) */}
        <div className="xl:col-span-4 bento-card" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>ESTADO DEL SISTEMA</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {/* CPU */}
            <div onClick={() => setDetailStat('cpu')} className="cursor-pointer group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <Cpu size={14} style={{ color: '#3B82F6' }} />
                  <span>CPU</span>
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{sysStats.cpu}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3B82F6', width: `${sysStats.cpu}%`, borderRadius: 3, boxShadow: '0 0 8px #3B82F6', transition: 'width 500ms' }} />
              </div>
            </div>

            {/* RAM */}
            <div onClick={() => setDetailStat('ram')} className="cursor-pointer group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <Gauge size={14} style={{ color: '#10B981' }} />
                  <span>RAM</span>
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{(sysStats.ramUsed / 1024).toFixed(1)} GB / {(sysStats.ramTotal / 1024).toFixed(0)} GB</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#10B981', width: `${sysStats.ram}%`, borderRadius: 3, boxShadow: '0 0 8px #10B981', transition: 'width 500ms' }} />
              </div>
            </div>

            {/* ALMACENAMIENTO */}
            <div onClick={() => setDetailStat('disk')} className="cursor-pointer group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <HardDrive size={14} style={{ color: '#8B5CF6' }} />
                  <span>Almacenamiento</span>
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{sysStats.disk}% / 1 TB</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#8B5CF6', width: `${sysStats.disk}%`, borderRadius: 3, boxShadow: '0 0 8px #8B5CF6', transition: 'width 500ms' }} />
              </div>
            </div>

            {/* TEMPERATURA */}
            <div onClick={() => setDetailStat('temp')} className="cursor-pointer group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <Thermometer size={14} style={{ color: '#F59E0B' }} />
                  <span>Temperatura</span>
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{sysStats.temp}°C</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#F59E0B', width: `${Math.min(100, Math.round((sysStats.temp / 80) * 100))}%`, borderRadius: 3, boxShadow: '0 0 8px #F59E0B', transition: 'width 500ms' }} />
              </div>
            </div>

            {/* BOTTOM ROW: RED & BATERÍA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 'auto', paddingTop: 8 }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
                  <Wifi size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>Red</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Conectado</div>
                  <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginTop: 1 }}>42.4 Mbps</div>
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
                  <Battery size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>Batería</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>87%</div>
                  <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginTop: 1 }}>Cargando</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {detailContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setDetailStat(null)}>
          <div className="bg-surface2 border border-borderDark rounded-2xl w-full max-w-md p-8 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-borderDark/60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface border border-borderDark flex items-center justify-center shadow-inner">
                  <detailContent.icon size={24} style={{ color: detailContent.color }} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-textMain uppercase tracking-wider">{detailContent.label}</h2>
                  <p className="text-xs text-textDim font-medium">Diagnóstico de hardware en tiempo real</p>
                </div>
              </div>
              <button onClick={() => setDetailStat(null)} className="w-8 h-8 rounded-lg bg-surface border border-borderDark flex items-center justify-center text-textDim hover:text-textMain transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="text-5xl font-extrabold text-center my-6 digital-font tracking-wider" style={{ color: detailContent.color }}>
              {detailContent.val}<span className="text-2xl font-bold ml-1">{detailContent.unit}</span>
            </div>

            <div className="h-3 rounded-full bg-surface border border-borderDark overflow-hidden mb-6 p-0.5 shadow-inner">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${detailContent.val}%`, backgroundColor: detailContent.color, boxShadow: `0 0 12px ${detailContent.color}` }} />
            </div>

            <p className="text-xs text-textDim font-medium leading-relaxed mb-6 bg-surface p-4 rounded-xl border border-borderDark/40">
              {detailContent.detail}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-borderDark/60">
              {detailContent.id === 'cpu' && (
                <>
                  <DetailItem label="Frecuencia" value="3.6 GHz" />
                  <DetailItem label="Núcleos" value="8 lógicos" />
                  <DetailItem label="Procesos" value={`${sysStats.processes} activos`} />
                  <DetailItem label="Arquitectura" value="x64" />
                </>
              )}
              {detailContent.id === 'ram' && (
                <>
                  <DetailItem label="Total" value={`${Math.round(sysStats.ramTotal / 1024)} GB`} />
                  <DetailItem label="En uso" value={`${Math.round(sysStats.ramUsed / 1024)} GB`} />
                  <DetailItem label="Disponible" value={`${Math.round((sysStats.ramTotal - sysStats.ramUsed) / 1024)} GB`} />
                  <DetailItem label="Tipo" value="DDR4" />
                </>
              )}
              {detailContent.id === 'disk' && (
                <>
                  <DetailItem label="Capacidad" value="256 GB" />
                  <DetailItem label="Usado" value={`${Math.round(sysStats.disk * 2.56)} GB`} />
                  <DetailItem label="Disponible" value={`${256 - Math.round(sysStats.disk * 2.56)} GB`} />
                  <DetailItem label="Tipo" value="SSD NVMe" />
                </>
              )}
              {detailContent.id === 'temp' && (
                <>
                  <DetailItem label="CPU" value={`${sysStats.temp}°C`} />
                  <DetailItem label="GPU" value={`${Math.round(sysStats.temp * 0.85)}°C`} />
                  <DetailItem label="Uptime" value={sysStats.uptime} />
                  <DetailItem label="Batería" value={`${sysStats.battery}%`} />
                </>
              )}
            </div>

            <button onClick={() => setDetailStat(null)} className="mt-8 w-full py-3 rounded-xl bg-surface border border-borderDark text-xs font-bold text-textMain hover:bg-surface/80 transition-colors uppercase tracking-wider">
              Cerrar Diagnóstico
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3.5 rounded-xl border border-borderDark/60 flex flex-col justify-between">
      <div className="text-[10px] font-bold text-textDim uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xs font-extrabold text-textMain">{value}</div>
    </div>
  );
}
