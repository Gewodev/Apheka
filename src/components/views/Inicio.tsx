import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, BookOpen, Clock, Zap, ChevronRight, FileText, ListTodo, TrendingUp, Calendar, ArrowRight, Sparkles, Activity, Target
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

const Inicio: React.FC = () => {
  const { tasks, notes, pomodoroSessions, sessionTime, settings } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeTasks = useMemo(() => tasks.filter(t => t.status !== 'completado').slice(0, 4), [tasks]);
  const recentNotes = useMemo(() => [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 4), [notes]);

  const heatmap = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 32 }).map((_, i) => {
      const day = subDays(today, 31 - i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const hasActivity = tasks.some(task => 
        (task.status === 'completado' || task.status === 'simple_done') && 
        task.completedAt && new Date(task.completedAt) >= dayStart && 
        new Date(task.completedAt) <= dayEnd
      );
      return { active: hasActivity, id: i };
    });
  }, [tasks]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = heatmap.length - 1; i >= 0; i--) {
      if (heatmap[i].active) count++;
      else if (count > 0) break;
    }
    return count;
  }, [heatmap]);

  const dailyProgress = useMemo(() => {
    if (!settings?.dailyGoal) return 0;
    const goalSeconds = settings.dailyGoal * 60;
    return Math.min(Math.round((sessionTime / goalSeconds) * 100), 100);
  }, [sessionTime, settings?.dailyGoal]);

  return (
    <div className="page-container">
      
      {/* ARCHITECTURAL HEADER - REFINED PROPORTIONS */}
      <header className="flex justify-between items-end mb-24 relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.5em]">Terminal de Control</span>
          </div>
          <h1 className="text-8xl font-black text-primary tracking-tighter leading-none">
            {format(currentTime, 'EEEE', { locale: es })}
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl text-secondary font-medium tracking-tight opacity-60">
            {format(currentTime, 'dd MMMM, yyyy', { locale: es })}
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-baseline gap-4">
            <span className="text-9xl font-black text-primary tracking-tighter tabular-nums leading-none">
              {format(currentTime, 'HH:mm')}
            </span>
            <span className="text-3xl font-bold text-accent tabular-nums opacity-60">{format(currentTime, 'ss')}</span>
          </div>
        </div>
      </header>

      {/* MAIN BENTO GRID - INCREASED GAP-12 (3rem) */}
      <div className="grid grid-cols-12 gap-12">
        
        {/* PRIMARY METRICS */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bento-card h-full p-12">
            <div className="flex items-center gap-4 mb-16">
              <Activity size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Estado Operativo</span>
            </div>
            
            <div className="grid grid-cols-4 gap-12">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Cola</span>
                <span className="text-6xl font-black text-primary tracking-tighter leading-none">{tasks.filter(t => t.status !== 'completado').length}</span>
                <div className="w-10 h-1.5 bg-accent/20 rounded-full mt-2" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Base</span>
                <span className="text-6xl font-black text-primary tracking-tighter leading-none">{notes.length}</span>
                <div className="w-10 h-1.5 bg-white/5 rounded-full mt-2" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Log</span>
                <span className="text-6xl font-black text-primary tracking-tighter leading-none">{pomodoroSessions}</span>
                <div className="w-10 h-1.5 bg-white/5 rounded-full mt-2" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Días</span>
                <span className="text-6xl font-black text-accent tracking-tighter leading-none">{streak}</span>
                <div className="w-10 h-1.5 bg-accent/40 rounded-full mt-2" />
              </div>
            </div>
          </div>
        </div>

        {/* DAILY TARGET */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bento-card h-full p-12">
            <div className="flex items-center gap-4 mb-12">
              <Target size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Meta de Hoy</span>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-6">
                <span className="text-6xl font-black text-primary tracking-tighter leading-none">{dailyProgress}%</span>
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Sincronizado</span>
              </div>
              <div className="progress-track h-4 bg-white/5 rounded-full overflow-hidden">
                <div className="progress-thumb h-full bg-accent rounded-full relative" style={{ width: `${dailyProgress}%` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WORKFLOW VISUALIZER */}
        <div className="col-span-12">
          <div className="bento-card p-12">
            <div className="flex justify-between items-center mb-12">
              <div className="flex items-center gap-4">
                <Sparkles size={24} className="text-accent" />
                <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Matriz de Actividad</span>
              </div>
              <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Nivel de Carga</span>
                <div className="flex gap-1.5">
                  {[0.1, 0.3, 0.6, 1].map(o => <div key={o} className="w-3.5 h-3.5 rounded-sm bg-accent" style={{ opacity: o }} />)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-16 gap-3">
              {heatmap.map(day => (
                <div 
                  key={day.id} 
                  className={`aspect-square rounded-lg transition-all duration-700 ${
                    day.active 
                      ? 'bg-accent shadow-[0_0_20px_rgba(225,29,72,0.4)] border border-accent/50' 
                      : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.05]'
                  }`}
                  title={`Día ${day.id + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RECENT RECORDS */}
        <div className="col-span-12 lg:col-span-6">
          <div className="bento-card p-12 h-full">
            <div className="flex items-center gap-4 mb-10">
              <ListTodo size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Prioridades en Cola</span>
            </div>
            <div className="flex flex-col gap-4">
              {activeTasks.length > 0 ? activeTasks.map(task => (
                <div key={task.id} className="group flex items-center gap-8 p-8 rounded-[28px] bg-white/[0.02] border border-transparent hover:border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
                  <div className="w-1.5 h-12 rounded-full bg-accent/20 group-hover:bg-accent group-hover:shadow-[0_0_15px_var(--accent)] transition-all" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-2">{task.course}</p>
                    <h4 className="text-xl font-bold text-primary tracking-tight truncate">{task.title}</h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <ChevronRight size={20} className="text-primary" />
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center opacity-10">
                  <CheckCircle2 size={48} className="mx-auto mb-6" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Procesos Pendientes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="bento-card p-12 h-full">
            <div className="flex items-center gap-4 mb-10">
              <FileText size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Últimos Registros</span>
            </div>
            <div className="flex flex-col gap-4">
              {recentNotes.length > 0 ? recentNotes.map(note => (
                <div key={note.id} className="group flex items-center gap-8 p-8 rounded-[28px] bg-white/[0.02] border border-transparent hover:border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-muted group-hover:text-accent group-hover:border group-hover:border-accent/30 transition-all">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-2">Archivo .LOG</p>
                    <h4 className="text-xl font-bold text-primary tracking-tight truncate">{note.title}</h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <ArrowRight size={20} className="text-primary" />
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center opacity-10">
                  <Sparkles size={48} className="mx-auto mb-6" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em]">Sin Registros Recientes</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Inicio;