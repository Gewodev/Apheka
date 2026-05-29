import React, { useState, useEffect, useMemo } from 'react';
import {
  Monitor, Wifi, Music, CheckSquare, FileText, Flame
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
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
          fill={s[i] ? color : 'rgba(255,255,255,0.015)'}
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

function calculateStreak(w: Record<string, number>, dailyGoalMin: number, dailyGoalHistory?: Record<string, number>): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  const metGoal = (dayStr: string): boolean => {
    const goalForDay = dailyGoalHistory?.[dayStr] ?? dailyGoalMin;
    return (w[dayStr] || 0) >= goalForDay * 60;
  };
  
  const completedToday = metGoal(todayStr);
  const completedYesterday = metGoal(yesterdayStr);
  
  if (!completedToday && !completedYesterday) return 0;
  
  let s = 0;
  let startDay = completedToday ? 0 : 1;
  while (true) {
    const d = subDays(new Date(), startDay);
    const dStr = format(d, 'yyyy-MM-dd');
    if (metGoal(dStr)) {
      s++;
      startDay++;
    } else {
      break;
    }
  }
  return s;
}

interface SysStats { cpu: number; ram: number; ramTotal: number; ramUsed: number; disk: number; temp: number; battery: number; }

const mockStats = (): SysStats => ({ cpu: 23, ram: 42, ramTotal: 16384, ramUsed: 6963, disk: 42, temp: 45, battery: 87 });

const hl = (l: number) =>
  l === 0 ? 'var(--bg-deep)' : l === 1 ? 'var(--accent-dim)' : l === 2 ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : l === 3 ? 'color-mix(in srgb, var(--accent) 65%, transparent)' : 'var(--accent)';

const sampleTasks = [
  { title: 'Termodinámica - Problemas de Aplicación', course: 'Física III', priority: 'HIGH' as const, date: '2 May' },
  { title: 'Química Orgánica - Mecanismos', course: 'Química Orgánica', priority: 'MEDIUM' as const, date: '3 May' },
  { title: 'Repaso de Cálculo - Integrales', course: 'Cálculo III', priority: 'LOW' as const, date: '4 May' },
  { title: 'Ejercicios de Programación', course: 'Computación', priority: 'MEDIUM' as const, date: '5 May' },
];

const sampleNotes = [
  { title: 'Mecánica Cuántica - Fundamentos', course: 'Física Moderna', time: 'Hace 1h' },
  { title: 'Reacciones SN1 y SN2', course: 'Química Orgánica', time: 'Hace 3h' },
  { title: 'Integrales Triples', course: 'Cálculo III', time: 'Hace 5h' },
  { title: 'Estructuras de Datos', course: 'Computación', time: 'Hace 1d' },
  { title: 'Ecuaciones Diferenciales', course: 'Matemáticas Avanzadas', time: 'Hace 2d' },
];

const pc: Record<string, string> = { HIGH: '#E11D48', MEDIUM: '#F59E0B', LOW: '#10B981' };

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
  } = app || {};
  const [ct, setCt] = useState(new Date());
  const [ss, setSs] = useState<SysStats>(mockStats());
  const [detailStat, setDetailStat] = useState<string | null>(null);

  useEffect(() => {
    const ti = setInterval(() => setCt(new Date()), 1000);
    const si = setInterval(async () => {
      try {
        const raw: any = await invoke('get_system_stats');
        const cpu = Math.round(raw.cpu || 0);
        let rp = 42, rt = 16384, ru = 6963;
        if (raw.mem?.Total) {
          rt = Math.round(parseInt(raw.mem.Total) / 1024);
          ru = rt - Math.round(parseInt(raw.mem.Free) / 1024);
          rp = Math.round((ru / rt) * 100);
        }
        setSs(p => ({ cpu, ram: rp, ramTotal: rt, ramUsed: ru, disk: p.disk || 42, temp: p.temp || 45, battery: p.battery || 87 }));
      } catch { setSs(mockStats()); }
    }, 3000);
    return () => { clearInterval(ti); clearInterval(si); };
  }, []);

  const statsList = useMemo(() => [
    { id: 'cpu', label: 'CPU', val: ss.cpu, unit: '%', color: '#3B82F6', detail: `Carga del procesador: ${ss.cpu}%.` },
    { id: 'ram', label: 'RAM', val: ss.ram, unit: '%', color: '#10B981', detail: `${(ss.ramUsed / 1024).toFixed(1)} GB / ${(ss.ramTotal / 1024).toFixed(0)} GB usados.` },
    { id: 'disk', label: 'DISCO', val: ss.disk, unit: '%', color: '#8B5CF6', detail: `Almacenamiento: ${ss.disk}% ocupado.` },
    { id: 'temp', label: 'TEMP', val: ss.temp, unit: '°C', color: '#F59E0B', detail: `Temperatura: ${ss.temp}°C.` },
  ], [ss]);

  const timeStr = format(ct, 'HH:mm');
  const secStr = format(ct, 'ss');
  const dateStr = format(ct, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es as any });
  const dateCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const streak = useMemo(() => calculateStreak(weeklyStudyTime, settings?.dailyGoal || 240, settings?.dailyGoalHistory), [weeklyStudyTime, settings?.dailyGoal, settings?.dailyGoalHistory]);
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
        
        const goalForDay = settings?.dailyGoalHistory?.[dayStr] ?? (settings?.dailyGoal || 240);
        const goalSeconds = goalForDay * 60;
        
        const met = secondsStudied >= goalSeconds && secondsStudied > 0;
        const pct = goalSeconds > 0 ? secondsStudied / goalSeconds : 0;
        const level = isFuture ? 0 : met ? 4 : pct >= 0.75 ? 3 : pct >= 0.25 ? 2 : pct > 0 ? 1 : 0;
        
        const dateFormatted = format(targetDate, "d 'de' MMM", { locale: es });
        const minutesStudied = Math.floor(secondsStudied / 60);
        
        const tooltip = isFuture 
          ? `${dateFormatted}: Día futuro`
          : `${dateFormatted}: ${minutesStudied}m / ${goalForDay}m (${Math.round(pct * 100)}%) ${met ? 'âœ“ Meta cumplida' : ''}`;
          
        rowCells.push({ level, tooltip });
      }
      grid.push(rowCells);
    }
    return grid;
  }, [weeklyStudyTime, settings?.heatmapStartDate, settings?.dailyGoal, settings?.dailyGoalHistory]);

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

      {/* â”€â”€ HEADER â”€â”€ */}
      <header className="flex justify-between items-end gap-6 pt-1" style={{ paddingBottom: 4, marginBottom: 4 }}>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-tertiary)' }}>
            {(() => {
              const h = ct.getHours();
              return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
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
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.5)', position: 'relative', zIndex: 1 }} />
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

      {/* â”€â”€ ROW 1: 3 STATS + TIMER â”€â”€ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'TAREAS', val: ts.active, sub: 'Pendientes', color: '#3B82F6', icon: CheckSquare },
          { label: 'NOTAS', val: ts.total, sub: 'Guardadas', color: '#10B981', icon: FileText },
          { label: 'RACHA', val: streak, sub: 'días', color: '#F59E0B', icon: Flame },
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
                  ? 'âœ“ Meta alcanzada'
                  : `Faltan ${remaining}min para alcanzar la meta`}
              </span>
            </div>
          );
        })()}
      </div>

      {/* â”€â”€ ROW 2: HEATMAP + RECIENTES â”€â”€ */}
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
            <span>Más</span>
          </div>
        </div>

        {/* RECIENTES: Canciones */}
        <div className="xl:col-span-6" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>RECIENTES</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ir a Música â†’</span>
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
                      <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  <span style={{ fontSize: 8, marginTop: 4, color: 'var(--text-tertiary)' }}>Vacío</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ ROW 3: TASKS + NOTES + SYSTEM â”€â”€ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-2">

        {/* TASKS */}
        <div className="xl:col-span-4" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>TAREAS</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sampleTasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, transition: 'all 150ms' }} className="hover:border-borderDark/60 group">
                <div style={{ width: 12, height: 12, borderRadius: 6, border: '2px solid var(--border-subtle)', transition: 'border-color 150ms' }} className="group-hover:border-accent/60 cursor-pointer flex-shrink-0" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{t.course}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${pc[t.priority]}20`, color: pc[t.priority] }}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>

        {/* NOTES */}
        <div className="xl:col-span-4" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>NOTAS</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} className="hover:opacity-80">Ver todas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sampleNotes.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }} className="hover:border-borderDark/60 group">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>{n.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SYSTEM STATUS */}
        <div className="xl:col-span-4" style={{ padding: '18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-subtle)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>SISTEMA</span>
            <span style={{ fontSize: 9, fontFamily: "'Share Tech Mono', monospace", color: '#3B82F6' }}>{'\u25CF'} En vivo</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flex: 1 }}>
            {/* Combined gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: 110, flexShrink: 0 }}>
              <div style={{ position: 'relative', width: 90, height: 90 }}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-deep)" strokeWidth="8" />
                  {(() => {
                    const combined = Math.round((ss.cpu + ss.ram + ss.disk) / 3);
                    const circ = 2 * Math.PI * 50;
                    return (
                      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" strokeWidth="8" strokeDasharray={`${(combined / 100) * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ filter: 'drop-shadow(0 0 16px var(--accent-glow))', transition: 'stroke-dasharray 500ms' }} />
                    );
                  })()}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Monitor size={32} style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.04em', fontFamily: "'Share Tech Mono', monospace" }}>GENERAL</span>
            </div>
            {/* Metrics in 2x2 grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'CPU', val: ss.cpu, unit: '%', color: '#E11D48' },
                { label: 'RAM', val: ss.ram, unit: '%', color: '#F59E0B' },
                { label: 'DISCO', val: ss.disk, unit: '%', color: '#8B5CF6' },
                { label: 'TEMP', val: ss.temp, unit: '°C', color: '#3B82F6' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg-deep)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{m.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: "'Share Tech Mono', monospace" }}>{m.label === 'TEMP' ? `${m.val}°C` : `${m.val}%`}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-base)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: m.color, width: `${m.label === 'TEMP' ? Math.round((m.val / 80) * 100) : m.val}%`, boxShadow: `0 0 6px ${m.color}40`, transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div onClick={() => setDetailStat('all')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'all 150ms' }}>
            <Wifi size={12} style={{ color: '#3B82F6' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>Conectado · 42.4 Mbps</span>
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'Share Tech Mono', monospace" }}>Ver detalles â†’</span>
          </div>
        </div>
      </div>

      {/* â”€â”€ DETAIL MODAL â”€â”€ */}
      {detailStat === 'all' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: 16 }} onClick={() => setDetailStat(null)}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Monitor size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Sistema</h2>
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Diagnóstico en tiempo real</p>
                </div>
              </div>
              <button onClick={() => setDetailStat(null)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer' }}><span style={{ fontSize: 14 }}>âœ•</span></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {statsList.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: s.color }}>{s.label.slice(0, 2)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>{s.val}{s.unit}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-deep)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: s.color, width: `${s.val}%`, boxShadow: `0 0 6px ${s.color}60`, transition: 'width 500ms' }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 3 }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setDetailStat(null)} style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }} className="hover:opacity-80">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ SINGLE STAT MODAL â”€â”€ */}
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
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Diagnóstico en tiempo real</p>
                </div>
              </div>
              <button onClick={() => setDetailStat(null)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer' }}><span style={{ fontSize: 14 }}>âœ•</span></button>
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

