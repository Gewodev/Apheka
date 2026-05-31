import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  X, BarChart3, Clock, Activity,
  ChevronRight, TrendingUp, Target, AlertTriangle,
  ListTodo, Layers, GitBranch,
  Zap, CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart,
  Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface StudySession {
  id: string;
  type: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  taskId?: string;
  pauseCount?: number;
  pauseDuration?: number;
}

interface Task {
  id: string;
  title: string;
  course: string;
  courseColor: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedMinutes?: number;
  studyTime?: number;
  [key: string]: any;
}

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studySessions: StudySession[];
  tasks: Task[];
  settings?: any;
}

const tabs = [
  { id: 'time', label: 'Tiempo', icon: Clock },
  { id: 'tasks', label: 'Tareas', icon: ListTodo },
  { id: 'flow', label: 'Flujo', icon: GitBranch },
];

const chartTextColor = 'var(--text-tertiary)';
const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-soft)',
  borderRadius: 8,
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

function generateWeekData(studySessions: StudySession[]) {
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayStr = format(d, 'yyyy-MM-dd');
    const daySessions = studySessions.filter(s => s.startedAt.startsWith(dayStr));
    const productive = daySessions.reduce((a, s) => a + s.duration, 0);
    const paused = daySessions.reduce((a, s) => a + (s.pauseDuration || 0), 0);
    return {
      day: dayNames[i],
      productive: Math.round(productive / 60),
      paused: Math.round(paused / 60),
      sessions: daySessions.length,
      date: dayStr,
    };
  });
}

function generateHourData(studySessions: StudySession[]) {
  return Array.from({ length: 24 }, (_, i) => {
    const hour = `${i.toString().padStart(2, '0')}:00`;
    const hs = studySessions.filter(s => new Date(s.startedAt).getHours() === i);
    return {
      hour,
      completions: hs.filter(s => s.duration > 0).length,
      avgDuration: hs.length > 0
        ? Math.round(hs.reduce((a, s) => a + s.duration, 0) / hs.length / 60)
        : 0,
      efficiency: hs.length > 0
        ? Math.round(hs.filter(s => (s.pauseDuration || 0) === 0).length / hs.length * 100)
        : 0,
    };
  });
}

function generateCourseBreakdown(tasks: Task[]) {
  const courses = [...new Set(tasks.map(t => t.course))];
  return courses.map(c => {
    const ct = tasks.filter(t => t.course === c);
    return {
      course: c.length > 14 ? c.slice(0, 14) + '…' : c,
      completadas: ct.filter(t => t.status === 'completado').length,
      progreso: ct.filter(t => t.status === 'progreso').length,
      pendientes: ct.filter(t => t.status === 'inicio').length,
      color: ct[0]?.courseColor || '#6B7280',
    };
  }).sort((a, b) => (b.completadas + b.progreso + b.pendientes) - (a.completadas + a.progreso + a.pendientes));
}

function generateFunnelData(tasks: Task[]) {
  return [
    { name: 'Creadas', value: tasks.length, color: '#6B7280' },
    { name: 'Pendientes', value: tasks.filter(t => t.status === 'inicio').length, color: '#F59E0B' },
    { name: 'En Progreso', value: tasks.filter(t => t.status === 'progreso').length, color: '#3B82F6' },
    { name: 'Completadas', value: tasks.filter(t => t.status === 'completado').length, color: '#10B981' },
  ];
}

function generateFlowData(tasks: Task[]) {
  const courses = [...new Set(tasks.map(t => t.course))];
  const statuses = [
    { key: 'inicio', label: 'Pendientes', color: '#F59E0B' },
    { key: 'progreso', label: 'En Progreso', color: '#3B82F6' },
    { key: 'completado', label: 'Completadas', color: '#10B981' },
  ];
  const nodes = [
    ...courses.map(c => ({ name: c, color: tasks.find(t => t.course === c)?.courseColor || '#6B7280' })),
    ...statuses.map(s => ({ name: s.label, color: s.color })),
  ];
  const links: { source: number; target: number; value: number; sourceColor: string; targetColor: string }[] = [];
  courses.forEach((c, ci) => {
    const cTasks = tasks.filter(t => t.course === c);
    const cColor = cTasks[0]?.courseColor || '#6B7280';
    statuses.forEach((s, si) => {
      const count = cTasks.filter(t => t.status === s.key).length;
      if (count > 0) links.push({ source: ci, target: courses.length + si, value: count, sourceColor: cColor, targetColor: s.color });
    });
  });
  return { nodes, links };
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--accent)' }} />
      <Icon size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  );
}

function MiniStat({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Icon size={9} style={{ color }} />
        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>{value}</span>
    </div>
  );
}

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
}

function ChartContainer({ children, height = 164 }: ChartContainerProps) {
  return (
    <div style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 10,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FlowSVG({ data }: { data: ReturnType<typeof generateFlowData> }) {
  const { nodes, links } = data;
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  if (nodes.length === 0) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>Sin datos</div>;

  const w = 380;
  const gap = 22;
  const leftCount = nodes.length - 3;
  const h = Math.max(gap * (leftCount + 3) + 28, leftCount * gap + 130);
  const colX1 = 16;
  const colX2 = w - 16;
  const pad = 10;

  const leftYs = nodes.slice(0, leftCount).map((_, i) => pad + i * gap);
  const rightYs = nodes.slice(leftCount).map((_, i) => {
    const totalRight = nodes.length - leftCount;
    const startY = (h - totalRight * gap) / 2;
    return startY + i * gap;
  });

  const maxVal = Math.max(...links.map(l => l.value), 1);

  return (
    <svg width={w} height={h} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      <defs>
        {links.map((l, i) => (
          <linearGradient key={i} id={`fl-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={l.sourceColor} stopOpacity={hoveredLink === i ? 0.9 : 0.55} />
            <stop offset="100%" stopColor={l.targetColor} stopOpacity={hoveredLink === i ? 0.9 : 0.55} />
          </linearGradient>
        ))}
        {links.map((l, i) => (
          <filter key={`shadow-${i}`} id={`shadow-${i}`}>
            <feDropShadow dx={0} dy={1} stdDeviation={2} floodOpacity={0.3} />
          </filter>
        ))}
      </defs>
      {links.map((l, i) => {
        const x1 = colX1 + 72;
        const x2 = colX2 - 72;
        const y1 = leftYs[l.source] + 10;
        const y2 = rightYs[l.target - leftCount] + 10;
        const thickness = Math.max(3, (l.value / maxVal) * 36);
        const midX = (x1 + x2) / 2;
        const isHovered = hoveredLink === i;
        return (
          <g key={i} style={{ cursor: 'pointer' }}>
            <path
              d={`M ${x1} ${y1 - thickness / 2} C ${midX} ${y1 - thickness / 2}, ${midX} ${y2 - thickness / 2}, ${x2} ${y2 - thickness / 2} L ${x2} ${y2 + thickness / 2} C ${midX} ${y2 + thickness / 2}, ${midX} ${y1 + thickness / 2}, ${x1} ${y1 + thickness / 2} Z`}
              fill={`url(#fl-${i})`}
              opacity={hoveredLink === null ? 0.85 : (isHovered ? 1 : 0.2)}
              filter={isHovered ? `url(#shadow-${i})` : undefined}
              onMouseEnter={() => setHoveredLink(i)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{ transition: 'opacity 200ms' }}
            />
            {isHovered && (
              <text x={midX} y={(y1 + y2) / 2} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}
                style={{ pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                {l.value} tarea{l.value !== 1 ? 's' : ''}
              </text>
            )}
          </g>
        );
      })}
      {nodes.slice(0, leftCount).map((n, i) => (
        <g key={`ln-${i}`}>
          <rect x={colX1} y={leftYs[i]} width={6} height={20} rx={3} fill={n.color} />
          <text x={colX1 + 12} y={leftYs[i] + 14} fill="var(--text-primary)" fontSize={9} fontWeight={600}>{n.name}</text>
        </g>
      ))}
      {nodes.slice(leftCount).map((n, i) => (
        <g key={`rn-${i}`}>
          <rect x={colX2 - 6} y={rightYs[i]} width={6} height={20} rx={3} fill={n.color} />
          <text x={colX2 - 12} y={rightYs[i] + 14} fill="var(--text-primary)" fontSize={9} fontWeight={600} textAnchor="end">{n.name}</text>
        </g>
      ))}
    </svg>
  );
}

const TAB_SPRING = { type: 'spring' as const, stiffness: 280, damping: 30 };

function TabContent({ children, tabId }: { children: React.ReactNode; tabId: string }) {
  return (
    <motion.div
      key={tabId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {children}
    </motion.div>
  );
}

const AnalyticsDrawer = React.memo(function AnalyticsDrawer({ isOpen, onClose, studySessions, tasks }: AnalyticsDrawerProps) {
  const [activeTab, setActiveTab] = useState('time');
  const [pillState, setPillState] = useState(false);
  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekData = useMemo(() => generateWeekData(studySessions), [studySessions]);
  const hourData = useMemo(() => generateHourData(studySessions), [studySessions]);
  const funnelData = useMemo(() => generateFunnelData(tasks), [tasks]);
  const courseData = useMemo(() => generateCourseBreakdown(tasks), [tasks]);
  const flowData = useMemo(() => generateFlowData(tasks), [tasks]);

  const totalStudyMin = useMemo(() => Math.round(studySessions.reduce((a, s) => a + s.duration, 0) / 60), [studySessions]);
  const completedToday = useMemo(() => tasks.filter(t => t.status === 'completado').length, [tasks]);
  const pendingToday = useMemo(() => tasks.filter(t => t.status !== 'completado').length, [tasks]);
  const avgSession = useMemo(() => studySessions.length > 0
    ? Math.round((studySessions.reduce((a, s) => a + s.duration, 0) / studySessions.length) / 60)
    : 0, [studySessions]);

  const clearTimer = useCallback(() => { if (pillTimer.current) { clearTimeout(pillTimer.current); pillTimer.current = null; } }, []);

  const handleEdgeEnter = useCallback(() => { clearTimer(); setPillState(true); }, [clearTimer]);
  const handleEdgeLeave = useCallback(() => {
    if (!isOpen) { pillTimer.current = setTimeout(() => setPillState(false), 500); }
  }, [isOpen]);
  const handlePillClick = useCallback(() => { onClose(); setPillState(false); }, [onClose]);

  useEffect(() => { if (!isOpen) setPillState(false); }, [isOpen]);
  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <>
      {/* ── Edge capture ── */}
      <div
        onMouseEnter={handleEdgeEnter}
        onMouseLeave={handleEdgeLeave}
        style={{
          position: 'absolute',
          right: isOpen ? 'min(50vw, 680px)' : 0,
          top: 0, bottom: 0,
          width: 14,
          zIndex: isOpen ? 25 : 45,
          transition: 'right 450ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <motion.div
          animate={{ opacity: pillState || isOpen ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'absolute',
            right: -4,
            top: '50%',
            translateY: '-50%',
            pointerEvents: (pillState || isOpen) ? 'auto' : 'none',
          }}
        >
          <button onClick={handlePillClick}
            style={{
              width: 32, height: 72,
              borderRadius: '10px 0 0 10px',
              background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
              border: '1px solid var(--border-soft)',
              borderRight: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: `-6px 0 24px rgba(0,0,0,0.25), 0 0 16px var(--accent-glow)`,
              transition: 'all 250ms',
            }}
            className="hover:text-white hover:brightness-125">
            <ChevronRight size={16} style={{ transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
          </button>
        </motion.div>
      </div>

      {/* ── Drawer panel ── */}
      <motion.div
        initial={false}
        animate={{ x: isOpen ? 0 : 'calc(100% + 16px)' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.8 }}
        style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: 'min(50vw, 680px)',
          minWidth: 500,
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-default)',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          willChange: 'transform',
        }}
      >
        {/* ── Header with metrics ── */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)', boxShadow: '0 0 14px var(--accent-glow)' }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Estadísticas</span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 500 }}>{studySessions.length} sesiones</span>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
              className="hover:text-white hover:brightness-125">
              <X size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { label: 'Estudio', value: `${totalStudyMin}m`, color: 'var(--accent)', icon: Clock },
              { label: 'Sesiones', value: studySessions.length, color: '#8B5CF6', icon: Activity },
              { label: 'Completadas', value: completedToday, color: '#10B981', icon: CheckCircle },
              { label: 'Promedio', value: `${avgSession}m`, color: '#F59E0B', icon: Zap },
            ].map(m => (
              <div key={m.label} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 1 }}>
                  <m.icon size={7} style={{ color: m.color }} />
                  <span style={{ fontSize: 7, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 2, padding: '4px 16px 0', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)', flexShrink: 0 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '8px 4px 6px',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  position: 'relative',
                  transition: 'color 200ms',
                }}>
                <Icon size={10} />
                {tab.label}
                {active && (
                  <motion.div layoutId="tab-underline"
                    style={{ position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, background: 'var(--accent)', borderRadius: 2, boxShadow: '0 0 8px var(--accent-glow)' }}
                    transition={TAB_SPRING}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 16px' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'time' && (
              <TabContent tabId="time">
                <Section>
                  <SectionTitle icon={BarChart3}>Distribución Semanal</SectionTitle>
                  <ChartContainer>
                    <ResponsiveContainer width="100%" height={164}>
                      <BarChart data={weekData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 8, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Bar dataKey="productive" name="Tiempo de estudio" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />
                      <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>Estudio: {weekData.reduce((a, d) => a + d.productive, 0)}m</span>
                    </div>
                  </div>
                </Section>

                <Section>
                  <SectionTitle icon={TrendingUp}>Eficiencia por Hora</SectionTitle>
                  <ChartContainer>
                    <ResponsiveContainer width="100%" height={164}>
                      <AreaChart data={hourData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 8, fill: chartTextColor }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fontSize: 8, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Area type="monotone" dataKey="efficiency" name="Eficiencia %" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} strokeWidth={2} />
                        <Area type="monotone" dataKey="avgDuration" name="Duración prom. (min)" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.1} strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </Section>

                <Section>
                  <SectionTitle icon={Target}>Progreso Diario</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {weekData.map(d => {
                      const goalMin = 240;
                      const pct = Math.min(100, Math.round((d.productive / goalMin) * 100));
                      return (
                        <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-primary)', width: 24, flexShrink: 0 }}>{d.day}</span>
                          <div style={{ flex: 1, height: 7, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 * weekData.indexOf(d) }}
                              style={{ height: '100%', background: pct >= 100 ? '#10B981' : 'var(--accent)', borderRadius: 4 }}
                            />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 500, color: pct >= 100 ? '#10B981' : 'var(--text-secondary)', width: 30, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{d.productive}m</span>
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", width: 16, textAlign: 'right' }}>{d.sessions}s</span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              </TabContent>
            )}

            {activeTab === 'tasks' && (
              <TabContent tabId="tasks">
                <Section>
                  <SectionTitle icon={Target}>Embudo de Tareas</SectionTitle>
                  <ChartContainer height={150}>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: chartTextColor }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Bar dataKey="value" name="Tareas" radius={[0, 4, 4, 0]} maxBarSize={26}>
                          {funnelData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 5 }}>
                    {funnelData.map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{s.name}: {s.value}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section>
                  <SectionTitle icon={Layers}>Distribución por Curso</SectionTitle>
                  <ChartContainer height={Math.max(100, courseData.length * 28 + 16)}>
                    <ResponsiveContainer width="100%" height={Math.max(100, courseData.length * 28 + 16)}>
                      <BarChart data={courseData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 8, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="course" type="category" tick={{ fontSize: 8, fill: chartTextColor }} axisLine={false} tickLine={false} width={72} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Bar dataKey="completadas" name="Completadas" stackId="a" fill="#10B981" maxBarSize={16} />
                        <Bar dataKey="progreso" name="En Progreso" stackId="a" fill="#3B82F6" maxBarSize={16} />
                        <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill="#F59E0B" radius={[0, 3, 3, 0]} maxBarSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </Section>

                <Section>
                  <SectionTitle icon={AlertTriangle}>Carga Pendiente</SectionTitle>
                  {courseData.filter(c => c.pendientes > 0).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {courseData.filter(c => c.pendientes > 0).map(c => (
                        <div key={c.course} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, background: 'var(--bg-hover)' }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 9, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.course}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{c.pendientes}</span>
                          <div style={{ width: 40, height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, c.pendientes * 15)}%` }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              style={{ height: '100%', background: '#F59E0B', borderRadius: 2 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>Todo completado</div>
                  )}
                </Section>
              </TabContent>
            )}

            {activeTab === 'flow' && (
              <TabContent tabId="flow">
                <Section>
                  <SectionTitle icon={GitBranch}>Curso → Estado</SectionTitle>
                  <FlowSVG data={flowData} />
                </Section>

                <Section>
                  <SectionTitle icon={Activity}>Métricas Clave</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <MiniStat label="Finalización" value={tasks.length > 0 ? `${Math.round((completedToday / tasks.length) * 100)}%` : '0%'} color="#10B981" icon={CheckCircle} />
                    <MiniStat label="Sesiones/Día" value={studySessions.length > 0 ? `${Math.round(studySessions.length / Math.max(1, Math.ceil((Date.now() - new Date(studySessions[0]?.startedAt || Date.now()).getTime()) / 86400000)))}` : '0'} color="#8B5CF6" icon={Activity} />
                    <MiniStat label="Min/Sesión" value={`${avgSession}m`} color="var(--accent)" icon={Clock} />
                    <MiniStat label="Pendientes" value={tasks.length > 0 ? `${Math.round((pendingToday / tasks.length) * 100)}%` : '0%'} color="#F59E0B" icon={AlertTriangle} />
                  </div>
                </Section>
              </TabContent>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
});

export default AnalyticsDrawer;
