import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Target, Clock, BookOpen, Trash2, X, Calendar as CalendarIcon, Sparkles, Layers, Activity, CalendarDays, Timer } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format, addDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Planificacion() {
  const { schedule, tasks, courses, addScheduleBlock, deleteScheduleBlock, sessionTime } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlock, setNewBlock] = useState({
    title: '',
    course: courses[0]?.name || '',
    startTime: '09:00',
    endTime: '10:00',
  });

  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i + weekOffset * 7));
  }, [weekOffset, startOfCurrentWeek]);

  const dayBlocks = useMemo(() =>
    schedule.filter(b => b.dayIndex === selectedDay).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule, selectedDay]
  );

  const stats = useMemo(() => {
    const pending = tasks.filter(t => t.status !== 'completado').length;
    const todayHours = (sessionTime / 3600).toFixed(1);
    return [
      { label: 'Tiempo de Foco', value: `${todayHours}h`, icon: Clock, color: 'text-accent' },
      { label: 'Operaciones', value: pending, icon: CheckCircle2, color: 'text-success' },
      { label: 'Sectores', value: courses.length, icon: BookOpen, color: 'text-primary' },
    ];
  }, [tasks, courses, sessionTime]);

  const handleAddBlock = () => {
    if (!newBlock.title.trim()) return;
    
    const start = new Date(`2000-01-01T${newBlock.startTime}:00`);
    const end = new Date(`2000-01-01T${newBlock.endTime}:00`);
    
    if (start >= end) return;
    
    const course = courses.find(c => c.name === newBlock.course);
    addScheduleBlock({
      dayIndex: selectedDay,
      title: newBlock.title,
      course: newBlock.course,
      color: course?.color || '#E11D48',
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
    });
    setShowAddModal(false);
    setNewBlock({ title: '', course: courses[0]?.name || '', startTime: '09:00', endTime: '10:00' });
  };

  return (
    <div className="page-container">
      
      {/* ARCHITECTURAL HEADER - REFINED */}
      <header className="flex justify-between items-end mb-24 relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={20} className="text-accent" />
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.5em]">Logística Temporal</span>
          </div>
          <h1 className="text-8xl font-black text-primary tracking-tighter leading-none">
            Agenda
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl text-secondary font-medium tracking-tight opacity-60">
            SEMANA DEL {format(weekDates[0], 'd MMM').toUpperCase()} AL {format(weekDates[6], 'd MMM YYYY', { locale: es }).toUpperCase()}
          </p>
        </div>

        <div className="flex gap-8 items-center">
          <div className="flex items-center gap-2 bg-white/[0.02] p-2 rounded-[28px] border border-white/5">
            <button onClick={() => setWeekOffset(w => w - 1)} className="w-14 h-14 flex items-center justify-center hover:bg-white/5 rounded-2xl text-tertiary transition-all">
              <ChevronLeft size={24} />
            </button>
            <div className="px-8 text-[11px] font-black text-primary uppercase tracking-[0.3em]">
               Navegar
            </div>
            <button onClick={() => setWeekOffset(w => w + 1)} className="w-14 h-14 flex items-center justify-center hover:bg-white/5 rounded-2xl text-tertiary transition-all">
              <ChevronRight size={24} />
            </button>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-12 h-20 rounded-[32px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all flex items-center gap-4"
          >
            <Plus size={24} /> Nuevo Bloque
          </button>
        </div>
      </header>

      {/* STATS - MASTERED SPACING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-24">
        {stats.map(s => (
          <div key={s.label} className="bento-card p-12 flex items-center gap-10">
            <div className="w-24 h-24 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <s.icon size={36} className={s.color} />
            </div>
            <div>
              <p className="text-[11px] font-black text-muted uppercase tracking-[0.4em] mb-3">{s.label}</p>
              <p className="text-6xl font-black text-primary tracking-tighter leading-none">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-16">
        
        {/* DAY SELECTOR - VERTICAL GRID */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
          {weekDates.map((date, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDay(idx)}
              className={`p-10 rounded-[40px] flex items-center justify-between transition-all duration-500 border relative overflow-hidden group ${
                selectedDay === idx 
                ? 'bg-elevated border-white/10 text-primary shadow-2xl scale-[1.08] z-10' 
                : 'bg-surface/30 border-transparent text-tertiary hover:bg-white/[0.03] hover:translate-x-4'
              }`}
            >
              <div className="flex flex-col gap-2 items-start">
                <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${selectedDay === idx ? 'text-accent' : 'text-muted'}`}>
                  {DAYS[idx].substring(0, 3)}
                </span>
                <span className={`text-5xl font-black tracking-tighter ${selectedDay === idx ? 'text-primary' : 'text-secondary'}`}>
                  {format(date, 'd')}
                </span>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                selectedDay === idx ? 'bg-accent text-white shadow-xl shadow-accent/30' : 'bg-white/5 text-muted opacity-0 group-hover:opacity-100'
              }`}>
                <ChevronRight size={24} />
              </div>
            </button>
          ))}
        </div>

        {/* SCHEDULE BLOCKS - MASTERED HIERARCHY */}
        <div className="col-span-12 lg:col-span-9">
          <div className="bento-card min-h-[800px] p-0 border-white/[0.02]">
            <div className="p-16 border-b border-white/[0.03] flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 rounded-[32px] bg-accent/5 flex items-center justify-center border border-accent/20">
                   <Timer size={32} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-primary tracking-tight uppercase leading-none mb-3">
                    {DAYS[selectedDay]} {format(weekDates[selectedDay], 'd', { locale: es })}
                  </h3>
                  <p className="text-[11px] font-black text-muted uppercase tracking-[0.4em]">Protocolo de Operaciones Diarias</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-[11px] font-black text-accent uppercase tracking-widest px-8 py-4 bg-accent/10 rounded-full border border-accent/10">
                  {dayBlocks.length} EVENTOS
                </span>
              </div>
            </div>

            <div className="p-16 space-y-8">
              {dayBlocks.map((block) => (
                <div 
                  key={block.id}
                  className="flex items-center gap-12 p-12 rounded-[48px] bg-white/[0.01] border border-white/[0.03] group hover:border-accent/30 hover:bg-white/[0.03] transition-all relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-accent/10 group-hover:bg-accent group-hover:shadow-[0_0_20px_var(--accent)] transition-all" />
                  
                  <div className="w-32 text-left shrink-0">
                    <p className="text-4xl font-black text-primary tracking-tighter leading-none mb-2">{block.startTime}</p>
                    <p className="text-[11px] font-black text-muted uppercase tracking-widest">{block.endTime}</p>
                  </div>
                  
                  <div className="w-px h-16 bg-white/5" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border border-white/5" style={{ color: block.color, backgroundColor: `${block.color}15` }}>{block.course}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-accent/30" />
                    </div>
                    <h4 className="text-4xl font-black text-primary tracking-tighter group-hover:translate-x-4 transition-transform duration-500">{block.title}</h4>
                  </div>

                  <button 
                    onClick={() => deleteScheduleBlock(block.id)}
                    className="opacity-0 group-hover:opacity-100 w-16 h-16 rounded-[24px] bg-white/5 text-muted flex items-center justify-center transition-all hover:bg-accent/10 hover:text-accent hover:scale-110"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              ))}

              {dayBlocks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-48 opacity-10">
                  <Sparkles size={120} className="mb-12" />
                  <p className="font-black uppercase tracking-[0.8em] text-center">Optimización Completa</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MODAL REFINED */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="bento-card max-w-2xl w-full p-16 bg-surface shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-white/10 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-16">
              <div>
                <h2 className="text-5xl font-black tracking-tighter mb-4">Añadir Actividad</h2>
                <p className="text-[11px] font-black text-muted uppercase tracking-widest">Sincronización de Slot Temporal</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-16 h-16 rounded-full flex items-center justify-center hover:bg-white/5 transition-all">
                <X size={32} className="text-muted" />
              </button>
            </div>
            
            <div className="space-y-12">
              <div className="flex flex-col gap-5">
                <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Análisis Cuántico"
                  className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[32px] text-primary font-black text-2xl focus:border-accent outline-none transition-all"
                  value={newBlock.title}
                  onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col gap-5">
                  <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Inicio</label>
                  <input
                    type="time"
                    className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[32px] text-primary font-black text-xl outline-none focus:border-accent transition-all cursor-pointer"
                    value={newBlock.startTime}
                    onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-5">
                  <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Fin</label>
                  <input
                    type="time"
                    className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[32px] text-primary font-black text-xl outline-none focus:border-accent transition-all cursor-pointer"
                    value={newBlock.endTime}
                    onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-6 pt-8">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-6 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] text-tertiary hover:bg-white/5 transition-all">Cancelar</button>
                <button onClick={handleAddBlock} className="flex-[2] py-6 rounded-[28px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4">
                  <Plus size={24} /> Confirmar Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}