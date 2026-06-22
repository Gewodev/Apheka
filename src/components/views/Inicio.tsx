import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Monitor, Wifi, Music, CheckSquare, FileText, Flame,
  Cpu, HardDrive, Thermometer
} from 'lucide-react';
import { useApp, fmtClock } from '../../store/AppContext';
import { format, subDays, subWeeks, addDays, addWeeks, startOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';
import { getWeeklyPhrase } from '../../data/phrases';
import NotificationBell from '../ui/NotificationBell';

const segs: Record<string, boolean[]> = {
  '0': [true,true,true,true,true,true,false], '1': [false,true,true,false,false,false,false],
  '2': [true,true,false,true,true,false,true], '3': [true,true,true,true,false,false,true],
  '4': [false,true,true,false,false,true,true], '5': [true,false,true,true,false,true,true],
  '6': [true,false,true,true,true,true,true], '7': [true,true,true,false,false,false,false],
  '8': [true,true,true,true,true,true,true], '9': [true,true,true,true,false,true,true],
};
const segPolys: [number,number][][] = [
  [[14,4],[58,4],[50,12],[22,12]],
  [[68,14],[60,18],[60,50],[68,54]],
  [[68,66],[60,70],[60,102],[68,106]],
  [[22,108],[50,108],[58,116],[14,116]],
  [[4,66],[12,70],[12,102],[4,106]],
  [[4,14],[12,18],[12,50],[4,54]],
  [[10,60],[18,56],[54,56],[62,60],[54,64],[18,64]],
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
  
  // If today not completed yet, check yesterday first
  const startDay = metGoal(todayStr) ? todayStr :
                   metGoal(yesterdayStr) ? yesterdayStr : null;
  
  if (!startDay) return 0;
  
  // Walk backwards to find the start of the streak
  let s = 1;
  let d = subDays(new Date(startDay), 1);
  while (metGoal(format(d, 'yyyy-MM-dd'))) {
    s++;
    d = subDays(d, 1);
  }
  return s;
}

interface SysStats {
  cpu: number; ram: number; ramTotal: number; ramUsed: number;
  disk: number; diskTotal: number; diskUsed: number;
  battery: number; netSpeed: number; netName: string;
  cpuTemp: number | null; gpuTemp: number | null;
  cpuName: string; gpuName: string;
  laptopModel: string; osInfo: string;
}

const mockStats = (): SysStats => ({
  cpu: 0, ram: 0, ramTotal: 0, ramUsed: 0,
  disk: 0, diskTotal: 0, diskUsed: 0, battery: -1,
  netSpeed: 0, netName: '', cpuTemp: null, gpuTemp: null,
  cpuName: '', gpuName: '', laptopModel: '', osInfo: '',
});

const hl = (l: number) =>
  l === 0 ? 'var(--bg-deep)' : l === 1 ? 'var(--accent-dim)' : l === 2 ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : l === 3 ? 'color-mix(in srgb, var(--accent) 65%, transparent)' : 'var(--accent)';

const pc: Record<string, string> = { high: '#E11D48', medium: '#F59E0B', low: '#10B981' };
const pcl: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

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
    updateSettings,
    setNavigateTo,
  } = app || {};
  const [ct, setCt] = useState(new Date());
  const [ss, setSs] = useState<SysStats>(mockStats());
  const [detailStat, setDetailStat] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [sysHistory, setSysHistory] = useState<{ time: string; cpu: number; ram: number; gpuTemp: number | null }[]>([]);
  const [detailView, setDetailView] = useState(false);

  useEffect(() => {
    const ti = setInterval(() => setCt(new Date()), 1000);
    const si = setInterval(async () => {
      try {
        const raw: any = await invoke('get_system_stats');
        const parsed: SysStats = {
          cpu: Math.round(raw.cpu || 0),
          ram: Math.round(raw.ram || 0),
          ramTotal: raw.ramTotal || 0,
          ramUsed: raw.ramUsed || 0,
          disk: Math.round(raw.disk || 0),
          diskTotal: raw.diskTotal || 0,
          diskUsed: raw.diskUsed || 0,
          battery: raw.battery ?? -1,
          netSpeed: raw.netSpeed || 0,
          netName: raw.netName || '',
          cpuTemp: raw.cpuTemp ?? null,
          gpuTemp: raw.gpuTemp ?? null,
          cpuName: raw.cpuName || '',
          gpuName: raw.gpuName || '',
          laptopModel: raw.laptopModel || '',
          osInfo: raw.osInfo || '',
        };
        setSs(parsed);
        setSysHistory(prev => {
          const next = [...prev, { time: format(ct, 'HH:mm'), cpu: parsed.cpu, ram: parsed.ram, gpuTemp: parsed.gpuTemp }];
          return next.length > 30 ? next.slice(-30) : next;
        });
      } catch { /* keep prev values */ }
    }, 3000);
    return () => { clearInterval(ti); clearInterval(si); };
  }, []);

  const statsList = useMemo(() => [
    { id: 'cpu', label: 'CPU', val: ss.cpu, unit: '%', color: '#3B82F6', detail: `Carga del procesador: ${ss.cpu}%.` },
    { id: 'ram', label: 'RAM', val: ss.ram, unit: '%', color: '#10B981', detail: `${ss.ramUsed.toFixed(1)} GB / ${ss.ramTotal.toFixed(0)} GB usados.` },
    { id: 'disk', label: 'DISCO', val: ss.disk, unit: '%', color: '#8B5CF6', detail: `Almacenamiento: ${ss.disk}% ocupado (${ss.diskUsed.toFixed(1)}/${ss.diskTotal.toFixed(1)} GB).` },
  ], [ss]);

  const timeStr = fmtClock(format(ct, 'HH:mm'), settings?.timeFormat);
  const secStr = format(ct, 'ss');
  const dateStr = format(ct, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es as any });
  const dateCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const streak = useMemo(() => calculateStreak(weeklyStudyTime, settings?.dailyGoal || 240, settings?.dailyGoalHistory, settings?.initialDailyGoal), [weeklyStudyTime, settings?.dailyGoal, settings?.dailyGoalHistory, settings?.initialDailyGoal]);
  const phrase = useMemo(() => getWeeklyPhrase(), []);
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
    active: tasks.filter(t => t.status !== 'completado').length || 8,
    total: notes.length || 146,
  }), [tasks, notes]);

  const dailyGoalMinutes = settings?.dailyGoal || 240;
  const dailyPct = useMemo(() => Math.min(100, Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100) || 73), [dailyStudyTime, dailyGoalMinutes]);
  const dc = detailStat && detailStat !== 'all' ? statsList.find(s => s.id === detailStat) : null;

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

      {/* â'€â'€ HEADER â'€â'€ */}
      <header className="flex justify-between items-end gap-6 pt-1" style={{ paddingBottom: 4, marginBottom: 4 }}>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-tertiary)' }}>
            {(() => {
              const h = ct.getHours();
              return h < 12 ? 'Buenos dias' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
            })()}, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{settings.userName || 'Avery'}</span>
          </div>
          <h1 style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 300, fontSize: 32, lineHeight: 1.4, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
            {phrase}
          </h1>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0" style={{ 
          paddingLeft: 16, 
          borderLeft: '1px solid var(--border-subtle)',
          position: 'relative'
        }}>
          {/* Clock background illumination */}
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            right: 0, 
            width: 150, 
            height: 100, 
            background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)', 
            opacity: 0.4, 
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            zIndex: 0
          }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#10B981' : '#EF4444', boxShadow: isOnline ? '0 0 8px rgba(16,185,129,0.5)' : '0 0 8px rgba(239,68,68,0.5)', position: 'relative', zIndex: 1, transition: 'all 300ms' }} />
          <NotificationBell />
          <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
            <div className="flex items-baseline gap-2 justify-end">
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200, lineHeight: 0.9, color: 'var(--accent)', letterSpacing: '0.02em', textShadow: '0 0 20px var(--accent-glow)' }}>
                {timeStr}
              </span>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200, color: 'var(--accent)', opacity: 0.7, letterSpacing: '0.02em' }}>
                {secStr}
              </span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 6 }}>
              {dateCap}
            </div>
          </div>
        </div>
      </header>

      {/* â'€â'€ ROW 1: 3 STATS + TIMER â'€â'€ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'TAREAS', val: ts.active, sub: 'Pendientes', color: '#3B82F6', icon: CheckSquare },
          { label: 'NOTAS', val: ts.total, sub: 'Guardadas', color: '#10B981', icon: FileText },
          { label: 'RACHA', val: streak, sub: 'dias', color: '#F59E0B', icon: Flame },
        ].map((s, i) => (
          <div key={i}
            style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>{s.label}</span>
              <s.icon size={16} style={{ color: s.color, opacity: 0.8 }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{s.sub}</div>
            </div>
          </div>
        ))}

        {/* META DIARIA */}
        {(() => {
          const goalMins = (settings?.dailyGoal || 240);
          const goalSecs = goalMins * 60;
          const doneMins = Math.round(dailyStudyTime / 60);
          const pct = Math.min(100, (dailyStudyTime / goalSecs) * 100);
          const remaining = Math.max(0, goalMins - doneMins);
          return (
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>META DIARIA</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: remaining <= 0 ? '#10B981' : 'var(--text-tertiary)' }}>
                  {doneMins}/{goalMins}min
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: remaining <= 0 ? '#10B981' : `linear-gradient(90deg, ${settings?.accentColor || 'var(--accent)'}, #8B5CF6)`, width: `${pct}%`, transition: 'width 400ms ease', boxShadow: remaining <= 0 ? '0 0 8px #10B98180' : `0 0 8px var(--accent-glow)` }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 500, color: remaining <= 0 ? '#10B981' : 'var(--text-secondary)' }}>
                {remaining <= 0
                  ? 'Meta alcanzada'
                  : `Faltan ${remaining}min para alcanzar la meta`}
              </span>
            </div>
          );
        })()}
      </div>

      {/* â'€â'€ ROW 2: HEATMAP + RECIENTES â'€â'€ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">

        {/* HEATMAP */}
        <div className="xl:col-span-6" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>ACTIVIDAD (4 MESES)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 130, color: 'var(--text-tertiary)', fontSize: 9, fontWeight: 600 }}><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: 'repeat(16, 1fr)', gap: 4, flex: 1, height: 130 }}>
              {heatmapData.flatMap((r, ri) => r.map((cell, ci) => (
                <div key={`${ri}-${ci}`} title={cell.tooltip} style={{ borderRadius: 2, background: hl(cell.level), boxShadow: cell.level >= 3 ? '0 0 6px var(--accent-glow)' : 'none', transition: 'all 120ms' }} className="hover:scale-110 cursor-pointer" />
              )))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            <span>Menos</span>
            {[0,1,2,3,4].map(l => <div key={l} style={{ width: 10, height: 10, borderRadius: 2, background: hl(l) }} />)}
            <span>Mas</span>
          </div>
        </div>

        {/* RECIENTES: Canciones */}
        <div className="xl:col-span-6" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
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
              recentTracks.slice(0, 4).map((track) => (
                <div key={track.id} style={{ 
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
                <div key={i} style={{ 
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-2">

        {/* TASKS */}
        <div className="xl:col-span-4" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
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
                    {tr && <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{tr}</span>}
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
        <div className="xl:col-span-4" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>NOTAS</span>
            <span onClick={() => setNavigateTo?.('apuntes')} style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.slice(0, 5).map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }} className="hover:border-borderDark/60 group">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>{timeAgo(n.updatedAt)}</span>
              </div>
            ))}
            {notes.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>Sin notas aun</div>
            )}
          </div>
        </div>

        {/* SYSTEM STATUS */}
        <div className="xl:col-span-4" style={{ padding: '24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
          {/* Top: icon + info */}
          {(() => { const a = Math.round((ss.cpu + ss.ram + ss.disk) / 3); const lc = a > 80 ? '#E11D48' : a > 50 ? '#F59E0B' : '#22C55E'; const R = 28; const circ = 2 * Math.PI * R; const off = circ * (1 - a / 100); return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={R} fill="none" stroke="var(--bg-deep)" strokeWidth="5" />
                <circle cx="36" cy="36" r={R} fill="none" stroke={lc} strokeWidth="5"
                  strokeDasharray={circ} strokeDashoffset={off}
                  strokeLinecap="round" transform="rotate(-90, 36, 36)" style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </svg>
              <Monitor size={30} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: lc }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>SISTEMA</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.laptopModel || ss.osInfo || 'Equipo'}</div>
            </div>
            <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: '#3B82F6', whiteSpace: 'nowrap', padding: '4px 12px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-soft)' }}>{'\u25CF'} En vivo</span>
          </div>
          );})()}
          {/* Metrics row - 3 per row, spacious */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'CPU', val: `${ss.cpu}%`, color: '#E11D48', bar: ss.cpu },
              { label: 'RAM', val: `${ss.ram}%`, color: '#F59E0B', bar: ss.ram },
              { label: 'DISCO', val: `${ss.disk}%`, color: '#8B5CF6', bar: ss.disk },
              { label: 'BAT.', val: ss.battery < 0 ? '--' : `${Math.round(ss.battery)}%`, color: '#3B82F6', bar: ss.battery < 0 ? 0 : ss.battery },
              { label: 'CPU \u00B0C', val: ss.cpuTemp !== null ? `${Math.round(ss.cpuTemp)}\u00B0` : '--', color: '#EF4444' },
              { label: 'GPU \u00B0C', val: ss.gpuTemp !== null ? `${Math.round(ss.gpuTemp)}\u00B0` : '--', color: '#F97316' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-deep)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{m.label}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: m.color, fontFamily: "'Share Tech Mono', monospace" }}>{m.val}</span>
                </div>
                {(m as any).bar !== undefined && (
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-base)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: m.color, width: `${(m as any).bar}%`, boxShadow: `0 0 8px ${m.color}50`, transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div onClick={() => setDetailView(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'all 150ms' }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'Share Tech Mono', monospace" }}>Detalles del sistema</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)', fontFamily: "'Share Tech Mono', monospace" }}>Ver especificaciones</span>
          </div>
        </div>
      </div>

      {/* â'€â'€ EXPANDED DETAIL VIEW â'€â'€ */}
      {detailView && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: 16 }} onClick={() => setDetailView(false)}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Monitor size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Sistema</h2>
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Especificaciones del equipo</p>
                </div>
              </div>
              <button onClick={() => setDetailView(false)} style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Cerrar
              </button>
            </div>

            {/* Single column: specs only (no graph) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* CPU Section */}
                <DetailSection icon={<Cpu size={13} />} title="Procesador (CPU)" values={[
                  { label: 'Modelo', value: ss.cpuName || 'Desconocido' },
                  { label: 'Uso', value: `${ss.cpu}%` },
                  { label: 'Temperatura', value: ss.cpuTemp !== null ? `${Math.round(ss.cpuTemp)}C` : 'N/A' },
                ]} />

                {/* GPU Section */}
                <DetailSection icon={<Monitor size={13} />} title="Tarjeta Grafica (GPU)" values={[
                  { label: 'Modelo', value: ss.gpuName || 'Desconocido' },
                  { label: 'Temperatura', value: ss.gpuTemp !== null ? `${Math.round(ss.gpuTemp)}C` : 'N/A' },
                ]} />

                {/* RAM Section */}
                <DetailSection icon={<Activity size={13} />} title="Memoria RAM" values={[
                  { label: 'Uso', value: `${ss.ram}%` },
                  { label: 'Usado', value: `${ss.ramUsed.toFixed(1)} GB` },
                  { label: 'Total', value: `${ss.ramTotal.toFixed(0)} GB` },
                ]} />

                {/* Disk Section */}
                <DetailSection icon={<HardDrive size={13} />} title="Almacenamiento" values={[
                  { label: 'Uso', value: `${ss.disk}%` },
                  { label: 'Usado', value: `${ss.diskUsed.toFixed(1)} GB` },
                  { label: 'Total', value: `${ss.diskTotal.toFixed(1)} GB` },
                ]} />

                {/* Network Section */}
                <DetailSection icon={<Wifi size={13} />} title="Red" values={[
                  { label: 'Conexion', value: isOnline ? 'En linea' : 'Sin conexion' },
                  { label: 'Velocidad', value: ss.netSpeed > 0 ? `${ss.netSpeed} Mbps` : 'N/A' },
                  { label: 'Adaptador', value: ss.netName || 'Desconocido' },
                ]} />

                {/* Battery Section */}
                {ss.battery >= 0 && (
                  <DetailSection icon={<Monitor size={13} />} title="Bateria" values={[
                    { label: 'Carga', value: `${Math.round(ss.battery)}%` },
                  ]} />
                )}

                {/* System Info Section */}
                <DetailSection icon={<Monitor size={13} />} title="Equipo" values={[
                  { label: 'Modelo', value: ss.laptopModel || 'Desconocido' },
                  { label: 'Sistema', value: ss.osInfo || 'Desconocido' },
                ]} />
              </div>

            <button onClick={() => setDetailView(false)} style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }} className="hover:opacity-80">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* â'€â'€ SINGLE STAT MODAL â'€â'€ */}
      {dc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: 16 }} onClick={() => setDetailStat(null)}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Monitor size={20} style={{ color: dc.color }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{dc.label}</h2>
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Diagnostico en tiempo real</p>
                </div>
              </div>
              <button onClick={() => setDetailStat(null)} style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>Cerrar</button>
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, textAlign: 'center', margin: '16px 0', fontFamily: "'Share Tech Mono', monospace", color: dc.color }}>
              {dc.val}<span style={{ fontSize: 16, marginLeft: 2 }}>{dc.unit}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-deep)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${dc.val}%`, backgroundColor: dc.color, boxShadow: `0 0 8px ${dc.color}`, transition: 'width 500ms' }} />
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 16, padding: 10, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>{dc.detail}</p>
            <button onClick={() => setDetailStat(null)} style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }} className="hover:opacity-80">
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function DetailSection({ icon, title, values }: { icon: React.ReactNode; title: string; values: { label: string; value: string }[] }) {
  return (
    <div style={{ marginTop: 10, padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-soft)' }}>
{icon}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {values.map(v => (
          <div key={v.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{v.label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>{v.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

