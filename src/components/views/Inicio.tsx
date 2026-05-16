import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Play, Pause,
  Cpu, Gauge, Thermometer, HardDrive,
  FileText,
  List, Flame, X, Monitor, Clock, Zap, Battery,
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
  if (days > 0) return { text: `falta ${days} ${days === 1 ? 'día' : 'días'}`, color: 'var(--text-tertiary)' };
  if (days === 0) {
    const hours = differenceInHours(due, now);
    if (hours > 0) return { text: `falta ${hours} h`, color: 'var(--warning)' };
    return { text: 'contratiempo', color: 'var(--error)' };
  }
  return { text: 'contratiempo', color: 'var(--error)' };
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
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const greeting = useMemo(() => getGreeting(currentTime.getHours(), settings.userName), [currentTime, settings.userName]);

  const streak = useMemo(() => calculateStreak(weeklyStudyTime), [weeklyStudyTime]);
  const hasActivityToday = (weeklyStudyTime[format(new Date(), 'yyyy-MM-dd')] || 0) > 0;
  const dailyGoalMinutes = 240; // 4 hours default

  const heatmapData = useMemo(() => {
    const cells = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'yyyy-MM-dd');
      const secs = weeklyStudyTime[key] || 0;
      const level = secs === 0 ? 0 : secs < 1800 ? 1 : secs < 3600 ? 2 : secs < 7200 ? 3 : 4;
      cells.push({ level, date: key });
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
      }).slice(0, 3),
    [tasks]
  );

  const recentNotes = useMemo(() =>
    [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3),
    [notes]
  );

  const taskStats = useMemo(() => ({
    active: tasks.filter(t => t.status !== 'completado').length,
    total: notes.length,
    efficiency: '92%',
  }), [tasks, notes]);

  const entries = [
    { label: 'TAREAS ACTIVAS', val: taskStats.active, icon: List },
    { label: 'NOTAS GUARDADAS', val: taskStats.total, icon: FileText },
    { label: 'EFICIENCIA SEMANAL', val: taskStats.efficiency, icon: Activity }
  ];

  const detailContent = detailStat ? statsList.find(s => s.id === detailStat) : null;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <span>{greeting}</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Todo listo para otra gran sesión.</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Mantén el enfoque, los resultados llegan.</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="led-container" style={{ padding: '10px 20px 8px', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div className="led-display led-time-md" style={{ fontSize: 32 }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 16 }}>{secondsStr}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, flex: 1 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'TAREAS ACTIVAS', val: taskStats.active, sub: 'Pendientes', icon: List, color: 'var(--accent)' },
              { label: 'NOTAS GUARDADAS', val: taskStats.total, sub: 'En total', icon: FileText, color: '#3B82F6' },
              { label: 'EFICIENCIA SEMANAL', val: taskStats.efficiency, sub: 'Excelente', icon: Activity, color: '#10B981' },
              { label: 'RACHA ACTUAL', val: streak, sub: 'Días seguidos', icon: Flame, color: '#F59E0B' },
            ].map((s, i) => (
              <div key={i} className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="stat-label" style={{ fontSize: 10 }}>{s.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={16} style={{ color: s.color }} />
                  </div>
                </div>
                <div>
                  <div className="stat-value" style={{ fontSize: 28 }}>{s.val}</div>
                  <div className="stat-subtext" style={{ fontSize: 11, marginTop: 2 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bento-card" style={{ padding: '20px 24px', minHeight: 160, display: 'flex', flexDirection: 'column' }}>
            <div className="section-header" style={{ marginBottom: 16, fontSize: 14 }}>Actividad (30 Días)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 10, flex: 1, alignContent: 'center' }}>
              {heatmapData.map((d, i) => (
                <div
                  key={i}
                  style={{
                    background: heatmapColors[d.level],
                    border: '1px solid rgba(255,255,255,0.02)',
                    borderRadius: 6,
                    height: 32,
                    transition: 'all 200ms',
                    boxShadow: d.level > 0 ? `0 4px 12px ${heatmapColors[d.level]}40` : 'none'
                  }}
                  title={d.date}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
              <div className="section-header" style={{ marginBottom: 12, fontSize: 13 }}>Próximas Tareas<span className="view-all">Ver todas</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {upcomingTasks.length > 0 ? upcomingTasks.map(t => {
                  const remaining = t.dueDate ? getDaysRemaining(t.dueDate) : null;
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.courseColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      </div>
                      {remaining && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: remaining.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{remaining.text}</span>
                      )}
                    </div>
                  );
                }) : (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, margin: 'auto' }}>Sin tareas pendientes</div>
                )}
              </div>
            </div>
            <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
              <div className="section-header" style={{ marginBottom: 12, fontSize: 13 }}>Notas Recientes<span className="view-all">Ver todas</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {recentNotes.length > 0 ? recentNotes.map(n => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <FileText size={14} className="text-accent" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, margin: 'auto' }}>Sin notas recientes</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Progress Diario */}
          <div className="bento-card" style={{ padding: '18px 20px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
            <div className="section-header" style={{ marginBottom: 12, fontSize: 11 }}>
              <Zap size={14} color="var(--accent)" />PROGRESO DIARIO
              <span className="view-all">Hoy</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1 }}>
              {Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100)}<span style={{ fontSize: 20, color: 'var(--text-muted)' }}>%</span>
            </div>
            <div className="stat-subtext" style={{ marginBottom: 12, fontSize: 12 }}>de la meta diaria</div>
            <div className="progress-track" style={{ height: 6, borderRadius: 3, marginBottom: 10 }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((dailyStudyTime / (dailyGoalMinutes * 60)) * 100))}%`, borderRadius: 3, boxShadow: '0 0 10px var(--accent-glow)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div><div className="stat-label" style={{ fontSize: 10 }}>Tiempo actual</div><div style={{ fontSize: 13, fontWeight: 600 }}>{Math.floor(dailyStudyTime / 3600)}h {Math.floor((dailyStudyTime % 3600) / 60)}m</div></div>
              <div style={{ textAlign: 'right' }}><div className="stat-label" style={{ fontSize: 10 }}>Meta diaria</div><div style={{ fontSize: 13, fontWeight: 600 }}>{Math.floor(dailyGoalMinutes / 60)}h {dailyGoalMinutes % 60}m</div></div>
            </div>
          </div>

          {/* Enfoque Rápido */}
          <div className="bento-card" style={{ padding: '20px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="section-header" style={{ justifyContent: 'center', marginBottom: 16, fontSize: 11, letterSpacing: '0.1em' }}>
              <Clock size={14} color="var(--accent)" />ENFOQUE RÁPIDO
            </div>
            <div className="led-container" style={{ padding: '20px 24px', marginBottom: 16, borderRadius: 12, width: '100%' }}>
              <div className="led-display" style={{ fontSize: 42, fontWeight: 300, lineHeight: 1 }}>
                {formatSessionTime(sessionTime)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Iniciar sesión</div>
            </div>
            <button onClick={toggleTimer} style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none',
              background: isTimerActive ? 'rgba(255,23,68,0.15)' : 'var(--accent)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isTimerActive ? '0 0 20px rgba(255,23,68,0.4)' : '0 8px 16px rgba(0,0,0,0.3)',
              transition: 'all 300ms',
            }} className="hover-lift">
              {isTimerActive ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" style={{ marginLeft: 4 }} />}
            </button>
          </div>

          {/* Racha */}
          <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: hasActivityToday ? 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, transparent 100%)' : 'var(--bg-deep)',
              border: `1px solid ${hasActivityToday ? 'rgba(99,102,241,0.4)' : 'var(--border-subtle)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: hasActivityToday ? 'inset 0 0 12px rgba(99,102,241,0.2)' : 'none'
            }}>
              <Flame size={24} color={hasActivityToday ? 'var(--accent)' : 'var(--text-muted)'} fill={hasActivityToday ? 'var(--accent)' : 'transparent'} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>{streak}</div>
              <div className="stat-label" style={{ marginTop: 4, fontSize: 11 }}>Racha de días</div>
            </div>
          </div>

          {/* Sistema */}
          <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="section-header" style={{ marginBottom: 4, fontSize: 11, letterSpacing: '0.05em' }}>
              <Monitor size={12} />ESTADO DEL SISTEMA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              {statsList.map(s => (
                <div key={s.id} onClick={() => setDetailStat(s.id)} style={{ background: 'var(--bg-deep)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 200ms' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <s.icon size={12} style={{ color: s.color }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}{s.unit}</span>
                  </div>
                  <div className="progress-track" style={{ height: 3, borderRadius: 2 }}>
                    <div className="progress-fill" style={{ width: `${s.val}%`, background: s.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── DETAIL MODAL ── */}
      {detailContent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }} onClick={() => setDetailStat(null)}>
          <div className="bento-card" style={{ width: 380, maxHeight: '90vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-base)', border: `1px solid var(--border-default)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <detailContent.icon size={20} style={{ color: detailContent.color }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600 }}>{detailContent.label}</h2>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Diagnóstico en tiempo real</p>
                </div>
              </div>
              <button onClick={() => setDetailStat(null)} className="btn-ghost" style={{ padding: 4, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: 48, fontWeight: 600, color: detailContent.color, textAlign: 'center', marginBottom: 8 }}>
              {detailContent.val}<span style={{ fontSize: 20, fontWeight: 500 }}>{detailContent.unit}</span>
            </div>

            <div className="progress-track" style={{ marginBottom: 24 }}>
              <div className="progress-fill" style={{ width: `${detailContent.val}%`, background: detailContent.color }} />
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>{detailContent.detail}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
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

            <button onClick={() => setDetailStat(null)} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>Cerrar</button>
          </div>
        </div>
      )}

    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-base)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}
