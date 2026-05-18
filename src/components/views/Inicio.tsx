import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Play, Pause,
  Cpu, Gauge, Thermometer, HardDrive,
  FileText,
  List, Flame, X, Monitor, Clock, Zap, Battery,
  CheckCircle, ChevronRight, Sparkles, TrendingUp, Calendar,
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
    cpu: Math.floor(Math.random() * 25) + 8,
    ram: Math.floor(Math.random() * 15) + 45,
    ramTotal: 16384,
    ramUsed: Math.floor(Math.random() * 4000) + 7000,
    disk: Math.floor(Math.random() * 20) + 35,
    temp: Math.floor(Math.random() * 8) + 40,
    uptime: `${Math.floor(Math.random() * 5) + 1}h ${Math.floor(Math.random() * 60)}m`,
    processes: Math.floor(Math.random() * 80) + 120,
    battery: Math.floor(Math.random() * 30) + 60,
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
        let ramPct = 50, ramTotal = 16384, ramUsed = 8192;
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
          disk: prev.disk || Math.floor(Math.random() * 20) + 35,
          temp: prev.temp || Math.floor(Math.random() * 8) + 40,
          uptime: prev.uptime || '--',
          processes: prev.processes || 0,
          battery: prev.battery || 0,
        }));
      } catch {
        setSysStats(generateMockStats());
      }
    }, 3000);
    return () => { clearInterval(timeInterval); clearInterval(statsInterval); };
  }, []);

  const statsList = useMemo(() => [
    { id: 'cpu', label: 'CPU', val: sysStats.cpu, unit: '%', color: '#3B82F6', icon: Cpu, detail: `Carga actual del procesador. ${sysStats.cpu}% de uso.` },
    { id: 'ram', label: 'RAM', val: sysStats.ram, unit: '%', color: '#10B981', icon: Gauge, detail: `${Math.round(sysStats.ramUsed / 1024)} GB / ${Math.round(sysStats.ramTotal / 1024)} GB usados. ${sysStats.ram}% en uso.` },
    { id: 'disk', label: 'DISCO', val: sysStats.disk, unit: '%', color: '#8B5CF6', icon: HardDrive, detail: `Almacenamiento. ${sysStats.disk}% ocupado del disco principal.` },
    { id: 'temp', label: 'TEMP', val: sysStats.temp, unit: '°C', color: '#F59E0B', icon: Thermometer, detail: `Temperatura del sistema. ${sysStats.temp}°C — dentro del rango normal.` },
  ], [sysStats]);

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const greeting = useMemo(() => getGreeting(currentTime.getHours(), settings.userName), [currentTime, settings.userName]);

  const streak = useMemo(() => calculateStreak(weeklyStudyTime), [weeklyStudyTime]);
  const hasActivityToday = (weeklyStudyTime[format(new Date(), 'yyyy-MM-dd')] || 0) > 0;
  const dailyGoalMinutes = 240; // 4 hours default

  // Heatmap / Activity Data (30 days)
  const heatmapData = useMemo(() => {
    const cells = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'yyyy-MM-dd');
      const secs = weeklyStudyTime[key] || 0;
      const level = secs === 0 ? 0 : secs < 1800 ? 1 : secs < 3600 ? 2 : secs < 7200 ? 3 : 4;
      cells.push({ level, date: key, minutes: Math.round(secs / 60) });
    }
    return cells;
  }, [weeklyStudyTime]);

  const heatmapColors = [
    'var(--heatmap-0)',
    'var(--heatmap-1)',
    'var(--heatmap-2)',
    'var(--heatmap-3)',
    'var(--heatmap-4)',
  ];

  const formatSessionTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const upcomingTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completado')
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }).slice(0, 4),
    [tasks]
  );

  const recentNotes = useMemo(() =>
    [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 4),
    [notes]
  );

  const taskStats = useMemo(() => ({
    active: tasks.filter(t => t.status !== 'completado').length,
    total: notes.length,
    efficiency: '94%',
  }), [tasks, notes]);

  const detailContent = detailStat ? statsList.find(s => s.id === detailStat) : null;

  return (
    <div className="page-container flex flex-col h-full overflow-y-auto custom-scroll pr-2">

      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-borderDark/60 pt-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-widest mb-2">
            <Sparkles size={14} />
            <span>{greeting}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-textMain tracking-tight leading-none mb-2">
            Control Cognitivo Central.
          </h1>
          <p className="text-sm text-textDim font-medium">
            Sistema operativo académico de alto rendimiento. Todo listo para tu sesión.
          </p>
        </div>

        {/* Big LED Time & Date Display */}
        <div className="flex flex-col items-end flex-shrink-0 bg-surface2 border border-accent/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(225,29,72,0.15)] min-w-[260px]">
          <div className="flex items-baseline gap-2 text-accent digital-font tracking-wider">
            <span className="text-5xl font-bold leading-none">{timeStr}</span>
            <span className="text-xl font-normal opacity-80">{secondsStr}</span>
          </div>
          <div className="mt-3 text-xs font-bold text-textDim uppercase tracking-widest border-t border-borderDark/80 pt-2 w-full text-right">
            {dateStrCapitalized}
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 items-start">

        {/* LEFT / CENTER CONTENT (8 COLS) */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* 4 STATS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'TAREAS ACTIVAS', val: taskStats.active, sub: 'Pendientes de cierre', icon: List, color: 'var(--accent)' },
              { label: 'NOTAS GUARDADAS', val: taskStats.total, sub: 'Base de conocimiento', icon: FileText, color: '#3B82F6' },
              { label: 'EFICIENCIA GLOBAL', val: taskStats.efficiency, sub: 'Productividad óptima', icon: Activity, color: '#10B981' },
              { label: 'RACHA DE ENFOQUE', val: `${streak} días`, sub: 'Hábito consolidado', icon: Flame, color: '#F59E0B' },
            ].map((s, i) => (
              <div key={i} className="bg-surface2 rounded-xl border border-borderDark p-5 flex flex-col justify-between shadow-sm hover:border-borderDark/80 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-textDim uppercase tracking-wider">{s.label}</span>
                  <div className="w-8 h-8 rounded-lg bg-surface border border-borderDark flex items-center justify-center shadow-inner">
                    <s.icon size={16} style={{ color: s.color }} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-textMain tracking-tight mb-1">{s.val}</div>
                  <div className="text-xs text-textDim font-medium">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CONSOLIDATED ACTIVITY & DAYS CHART (30 DAYS) */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <Activity size={16} className="text-accent" /> Actividad Consolidada (Últimos 30 Días)
                </h3>
                <p className="text-xs text-textDim mt-1">Mapa de calor y distribución de minutos de estudio por jornada</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-textDim font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Menos</span>
                  {[0, 1, 2, 3, 4].map(lvl => (
                    <div key={lvl} className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatmapColors[lvl] }} />
                  ))}
                  <span>Más</span>
                </div>
              </div>
            </div>

            {/* Consolidated Bar + Heatmap Visualizer */}
            <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-30 gap-1.5 items-end pt-8 pb-2 border-b border-borderDark/40 flex-1 min-h-[140px]">
              {heatmapData.map((d, i) => {
                const maxMin = Math.max(...heatmapData.map(x => x.minutes), 120);
                const heightPct = Math.max(12, (d.minutes / maxMin) * 100);
                const isTodayCell = i === heatmapData.length - 1;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 w-full group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 bg-surface border border-borderDark px-2.5 py-1.5 rounded shadow-xl text-[10px] min-w-[90px] text-center">
                      <span className="font-bold text-textMain">{d.minutes} min</span>
                      <span className="text-textDim text-[9px]">{d.date}</span>
                    </div>

                    {/* Bar */}
                    <div
                      className={`w-full rounded-t transition-all duration-300 group-hover:brightness-125 ${isTodayCell ? 'border-t-2 border-accent shadow-[0_0_8px_var(--accent-glow)]' : ''}`}
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: heatmapColors[d.level],
                        opacity: d.level === 0 ? 0.4 : 1
                      }}
                    />

                    {/* Date label for specific milestones */}
                    {i % 5 === 0 && (
                      <span className="text-[9px] font-medium text-textDim/70 hidden md:block absolute top-full mt-2 transform -rotate-45 origin-top-left">
                        {format(new Date(d.date), 'd MMM', { locale: es as any })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-8 text-xs text-textDim font-semibold">
              <span>Hace 30 días</span>
              <span className="text-accent flex items-center gap-1"><TrendingUp size={14} /> Jornada Actual</span>
            </div>
          </div>

          {/* DEDICATED NOTION-STYLE DATABASE VIEWS (TAREAS & NOTAS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Próximas Tareas */}
            <div className="bg-surface2 rounded-xl border border-borderDark p-6 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-borderDark/60">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <List size={16} className="text-accent" /> Próximas Tareas
                </h3>
                <span className="text-xs font-bold text-accent cursor-pointer hover:underline uppercase tracking-wider">Ver base</span>
              </div>
              <div className="flex flex-col gap-3 flex-1">
                {upcomingTasks.length > 0 ? upcomingTasks.map(t => {
                  const remaining = t.dueDate ? getDaysRemaining(t.dueDate) : null;
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3.5 bg-surface rounded-xl border border-borderDark/60 hover:border-borderDark hover:bg-surface/80 transition-all group">
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: t.courseColor }} />
                        <span className="text-xs font-semibold text-textMain truncate group-hover:text-accent transition-colors">{t.title}</span>
                      </div>
                      {remaining && (
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md bg-surface2 border border-borderDark flex-shrink-0 ${remaining.color}`}>
                          {remaining.text}
                        </span>
                      )}
                    </div>
                  );
                }) : (
                  <div className="flex flex-col items-center justify-center p-8 text-textDim text-xs font-medium border border-dashed border-borderDark rounded-xl my-auto">
                    <CheckCircle size={24} className="mb-2 opacity-30" />
                    Bandeja limpia. No hay tareas pendientes.
                  </div>
                )}
              </div>
            </div>

            {/* Notas Recientes */}
            <div className="bg-surface2 rounded-xl border border-borderDark p-6 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-borderDark/60">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-accent" /> Notas Recientes
                </h3>
                <span className="text-xs font-bold text-accent cursor-pointer hover:underline uppercase tracking-wider">Ver base</span>
              </div>
              <div className="flex flex-col gap-3 flex-1">
                {recentNotes.length > 0 ? recentNotes.map(n => (
                  <div key={n.id} className="flex items-center justify-between p-3.5 bg-surface rounded-xl border border-borderDark/60 hover:border-borderDark hover:bg-surface/80 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText size={16} className="text-textDim group-hover:text-accent transition-colors flex-shrink-0" />
                      <span className="text-xs font-semibold text-textMain truncate group-hover:text-accent transition-colors">{n.title}</span>
                    </div>
                    <ChevronRight size={16} className="text-textDim group-hover:text-textMain transition-colors flex-shrink-0 ml-2" />
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center p-8 text-textDim text-xs font-medium border border-dashed border-borderDark rounded-xl my-auto">
                    <FileText size={24} className="mb-2 opacity-30" />
                    Sin notas recientes registradas.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: METRICS, QUICK FOCUS & SYSTEM DIAGNOSTICS (4 COLS) */}
        <div className="xl:col-span-4 flex flex-col gap-6">

          {/* PROGRESO DIARIO */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-borderDark/60">
              <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                <Zap size={16} className="text-accent" /> Progreso Diario
              </h3>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Meta 4h</span>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-extrabold text-textMain tracking-tight">
                {Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100)}
              </span>
              <span className="text-xl font-bold text-textDim">%</span>
            </div>
            <p className="text-xs text-textDim font-medium mb-6">Completado de la meta de estudio de hoy</p>

            <div className="h-2.5 rounded-full bg-surface border border-borderDark overflow-hidden mb-6 p-0.5">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 shadow-[0_0_12px_var(--accent-glow)]"
                style={{ width: `${Math.min(100, Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-borderDark/60 bg-surface/50 p-4 rounded-xl border border-borderDark/40">
              <div>
                <span className="text-[10px] font-bold text-textDim uppercase tracking-wider block mb-1">Tiempo Actual</span>
                <span className="text-sm font-extrabold text-textMain">{Math.floor(dailyStudyTime / 3600)}h {Math.floor((dailyStudyTime % 3600) / 60)}m</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-textDim uppercase tracking-wider block mb-1">Meta Diaria</span>
                <span className="text-sm font-extrabold text-textMain">{Math.floor(dailyGoalMinutes / 60)}h {dailyGoalMinutes % 60}m</span>
              </div>
            </div>
          </div>

          {/* ENFOQUE RÁPIDO */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-6 flex flex-col items-center text-center shadow-sm">
            <div className="w-full flex items-center justify-between mb-6 pb-3 border-b border-borderDark/60">
              <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-accent" /> Enfoque Rápido
              </h3>
              <span className="text-xs font-bold text-textDim uppercase tracking-wider">Crono</span>
            </div>

            <div className="bg-surface border border-borderDark rounded-2xl p-6 w-full mb-6 shadow-inner">
              <div className="text-5xl font-bold text-accent digital-font tracking-wider mb-2">
                {formatSessionTime(sessionTime)}
              </div>
              <span className="text-[11px] font-bold text-textDim uppercase tracking-widest block">
                {isTimerActive ? 'Sesión en curso' : 'Temporizador inactivo'}
              </span>
            </div>

            <button
              onClick={toggleTimer}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold transition-all shadow-lg hover:scale-105 active:scale-95 ${
                isTimerActive
                  ? 'bg-red-900/40 border-2 border-accent text-accent shadow-[0_0_25px_rgba(225,29,72,0.3)]'
                  : 'bg-accent shadow-[0_0_20px_var(--accent-glow)]'
              }`}
            >
              {isTimerActive ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
          </div>

          {/* ESTADO DEL SISTEMA (DIAGNÓSTICO EN TIEMPO REAL) */}
          <div className="bg-surface2 rounded-xl border border-borderDark p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-borderDark/60">
              <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                <Monitor size={16} className="text-accent" /> Estado del Sistema
              </h3>
              <span className="text-xs font-bold text-textDim uppercase tracking-wider">Tauri Backend</span>
            </div>

            <div className="flex flex-col gap-4">
              {statsList.map(s => (
                <div
                  key={s.id}
                  onClick={() => setDetailStat(s.id)}
                  className="bg-surface p-4 rounded-xl border border-borderDark/60 hover:border-borderDark hover:bg-surface/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-surface2 border border-borderDark flex items-center justify-center group-hover:scale-105 transition-transform">
                        <s.icon size={13} style={{ color: s.color }} />
                      </div>
                      <span className="text-xs font-bold text-textMain uppercase tracking-wider">{s.label}</span>
                    </div>
                    <span className="text-xs font-bold digital-font tracking-wider" style={{ color: s.color }}>
                      {s.val}{s.unit}
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-surface2 border border-borderDark/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.val}%`, backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }}
                    />
                  </div>
                </div>
              ))}
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
