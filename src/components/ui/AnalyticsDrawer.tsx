import {sameTaskPresentation} from '../../lib/viewSnapshots';
import './analytics-refined.css';
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
import { generateWeekData, generateHourData, productiveSessions, seconds } from '../../lib/studyAnalytics';
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
  isDistraction?: boolean;
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
  boxShadow: 'none',
};

function generateCourseBreakdown(tasks: Task[]) {
  const courses = [...new Set(tasks.map(t => t.course))];
  return courses.map(c => {
    const ct = tasks.filter(t => t.course === c);
    return {
      course: (c || 'Sin curso').length > 14 ? c.slice(0, 14) + '…' : (c || 'Sin curso'),
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
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
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
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 10,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FlowSVG({data}:{data:ReturnType<typeof generateFlowData>}){
 const courses=data.nodes.slice(0,-3),statuses=data.nodes.slice(-3);
 if(!data.links.length)return <p className="analytics-empty">Añade tareas para ver su distribución por curso y estado.</p>;
 return <div className="analytics-course-flow"><div className="analytics-flow-legend">{statuses.map(status=><span key={status.name}><i style={{background:status.color}}/>{status.name}</span>)}</div>{courses.map((course,index)=>{const rows=data.links.filter(link=>link.source===index),total=rows.reduce((sum,row)=>sum+row.value,0);return <section key={course.name||index}><header><span><i style={{background:course.color}}/>{course.name||'Sin curso'}</span><output>{total} {total===1?'tarea':'tareas'}</output></header><div className="analytics-flow-track" role="img" aria-label={rows.map(row=>statuses[row.target-courses.length].name+': '+row.value).join(', ')}>{statuses.map((status,i)=>{const count=rows.find(row=>row.target===courses.length+i)?.value||0;return count?<span key={status.name} style={{width:count/total*100+'%',background:status.color}} title={status.name+': '+count}>{count/total>.12?count:''}</span>:null;})}</div><footer>{statuses.map((status,i)=><span key={status.name}>{rows.find(row=>row.target===courses.length+i)?.value||0}<small>{status.name}</small></span>)}</footer></section>})}</div>;
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

const AnalyticsDrawer = React.memo(function AnalyticsDrawer({ isOpen, onClose, studySessions, tasks, settings }: AnalyticsDrawerProps) {
  const [activeTab, setActiveTab] = useState('time');
  const [pillState, setPillState] = useState(false);
  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusSessions = useMemo(() => productiveSessions(studySessions), [studySessions]);
  const today = new Date().toDateString();
  const weekData = useMemo(() => generateWeekData(studySessions), [studySessions, today]);
  const hourData = useMemo(() => generateHourData(studySessions), [studySessions]);
  const funnelData = useMemo(() => generateFunnelData(tasks), [tasks]);
  const courseData = useMemo(() => generateCourseBreakdown(tasks), [tasks]);
  const flowData = useMemo(() => generateFlowData(tasks), [tasks]);

  const totalStudyMin = useMemo(() => Math.round(focusSessions.reduce((a, s) => a + seconds(s.duration), 0) / 60), [studySessions]);
  const completedToday = useMemo(() => tasks.filter(t => t.status === 'completado').length, [tasks]);
  const pendingToday = useMemo(() => tasks.filter(t => t.status !== 'completado').length, [tasks]);
  const avgSession = useMemo(() => focusSessions.length > 0
    ? Math.round((focusSessions.reduce((a, s) => a + seconds(s.duration), 0) / focusSessions.length) / 60)
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
          right: isOpen ? 'min(580px, calc(100% - 16px))' : 0,
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
          <button data-ui-control="" className="analytics-edge-handle" aria-label={isOpen?'Ocultar estadísticas':'Mostrar estadísticas'} onClick={handlePillClick}
            style={{
              width: 32, height: 72,
              borderRadius: '10px 0 0 10px',
              background: 'var(--bg-surface)',
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
            >
            <ChevronRight size={16} style={{ transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
          </button>
        </motion.div>
      </div>

      {/* ── Drawer panel ── */}
      <motion.div className="analytics-drawer" data-open={isOpen}
        initial={false}
        animate={{ x: isOpen ? 0 : 'calc(100% + 16px)' }}
        transition={{ duration:.2,ease:[.16,1,.3,1] }}
        style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: 'min(50vw, 680px)',
          minWidth: 480,
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-default)',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'none',
          overflow: 'hidden',
          willChange: 'transform',
        }}
      >
        {/* ── Header with metrics ── */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--bg-elevated)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)', boxShadow: '0 0 14px var(--accent-glow)' }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Estadísticas</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 500 }}>{focusSessions.length} sesiones</span>
              </div>
            </div>
            <button data-ui-control="" aria-label="Cerrar estadísticas" onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
              className="hover:text-white hover:brightness-125">
              <X size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { label: 'Estudio', value: `${totalStudyMin}m`, color: 'var(--accent)', icon: Clock },
              { label: 'Sesiones', value: focusSessions.length, color: '#8B5CF6', icon: Activity },
              { label: 'Completadas', value: completedToday, color: '#10B981', icon: CheckCircle },
              { label: 'Promedio', value: `${avgSession}m`, color: '#F59E0B', icon: Zap },
            ].map(m => (
              <div key={m.label} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 1 }}>
                  <m.icon size={7} style={{ color: m.color }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
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
              <button data-ui-control="" key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '8px 4px 6px',
                  fontSize: 11,
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
                  <SectionTitle icon={BarChart3}>Últimos 7 días · minutos</SectionTitle>
                  <ChartContainer>
                    <ResponsiveContainer debounce={80} width="100%" height={164}>
                      <BarChart data={weekData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Bar isAnimationActive={false} dataKey="productive" name="Tiempo de estudio" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Estudio: {weekData.reduce((a, d) => a + d.productive, 0)}m</span>
                    </div>
                  </div>
                </Section>

                <Section>
                  <SectionTitle icon={TrendingUp}>Ritmo por hora · duración y enfoque</SectionTitle>
                  <ChartContainer>
                    <ResponsiveContainer debounce={80} width="100%" height={164}>
                      <AreaChart data={hourData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis yAxisId="minutes" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} unit="m"/><YAxis yAxisId="focus" orientation="right" domain={[0,100]} tick={{fontSize:10,fill:chartTextColor}} axisLine={false} tickLine={false} unit="%" width={36}/>
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Area isAnimationActive={false} connectNulls={false} dot={false} yAxisId="focus" type="monotone" dataKey="efficiency" name="Enfoque %" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} strokeWidth={2} />
                        <Area isAnimationActive={false} connectNulls={false} dot={false} yAxisId="minutes" type="monotone" dataKey="avgDuration" name="Duración prom. (min)" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.1} strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </Section>

                <Section>
                  <SectionTitle icon={Target}>Progreso Diario</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {weekData.map(d => {
                      const weekday=new Date(d.date+'T12:00:00').getDay();
                      const goalMin = Math.max(1,settings?.studyGoals?.[['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][weekday]]??settings?.dailyGoal??240);
                      const pct = Math.min(100, Math.round((d.productive / goalMin) * 100));
                      return (
                        <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', width: 24, flexShrink: 0 }}>{d.day}</span>
                          <div style={{ flex: 1, height: 7, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 * weekData.indexOf(d) }}
                              style={{ height: '100%', background: pct >= 100 ? '#10B981' : 'var(--accent)', borderRadius: 4 }}
                            />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: pct >= 100 ? '#10B981' : 'var(--text-secondary)', width: 30, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{d.productive}m</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", width: 40, textAlign: 'right' }}>{d.sessions} ses.</span>
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
                  <SectionTitle icon={Target}>Estado de las tareas</SectionTitle>
                  <div className="analytics-status-summary"><header><strong>{tasks.length}</strong><span>tareas registradas</span></header><div className="analytics-status-track" role="img" aria-label={funnelData.slice(1).map(s=>`${s.name}: ${s.value}`).join(', ')}>{funnelData.slice(1).filter(s=>s.value).map(s=><span key={s.name} style={{width:`${s.value/Math.max(1,tasks.length)*100}%`,background:s.color}} title={`${s.name}: ${s.value}`}/>)}</div><dl>{funnelData.slice(1).map(s=><div key={s.name}><dt><i style={{background:s.color}}/>{s.name}</dt><dd>{s.value}<small>{Math.round(s.value/Math.max(1,tasks.length)*100)}%</small></dd></div>)}</dl></div>
                </Section>

                <Section>
                  <SectionTitle icon={Layers}>Distribución por Curso</SectionTitle>
                  <ChartContainer height={Math.max(100, courseData.length * 28 + 16)}>
                    <ResponsiveContainer debounce={80} width="100%" height={Math.max(100, courseData.length * 28 + 16)}>
                      <BarChart data={courseData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="course" type="category" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} width={72} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: 'var(--text-primary)' }} />
                        <Bar isAnimationActive={false} dataKey="completadas" name="Completadas" stackId="a" fill="#10B981" maxBarSize={16} />
                        <Bar isAnimationActive={false} dataKey="progreso" name="En Progreso" stackId="a" fill="#3B82F6" maxBarSize={16} />
                        <Bar isAnimationActive={false} dataKey="pendientes" name="Pendientes" stackId="a" fill="#F59E0B" radius={[0, 3, 3, 0]} maxBarSize={16} />
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
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.course}</span>
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
                  <SectionTitle icon={GitBranch}>Distribución por curso</SectionTitle>
                  <FlowSVG data={flowData} />
                </Section>

                <Section>
                  <SectionTitle icon={Activity}>Métricas Clave</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <MiniStat label="Finalización" value={tasks.length > 0 ? `${Math.round((completedToday / tasks.length) * 100)}%` : '0%'} color="#10B981" icon={CheckCircle} />
                    <MiniStat label="Sesiones/Día" value={focusSessions.length > 0 ? `${Math.round(focusSessions.length / Math.max(1, Math.ceil((Date.now() - new Date(studySessions[0]?.startedAt || Date.now()).getTime()) / 86400000)))}` : '0'} color="#8B5CF6" icon={Activity} />
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
},(previous,next)=>previous.isOpen===next.isOpen&&previous.onClose===next.onClose&&previous.studySessions===next.studySessions&&previous.settings===next.settings&&sameTaskPresentation(previous.tasks,next.tasks));

export default AnalyticsDrawer;
