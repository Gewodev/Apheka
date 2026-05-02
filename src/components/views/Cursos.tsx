import React, { useState } from 'react';
import { Plus, BookOpen, ChevronRight, Trash2, Edit2, X, BarChart3, Clock, Trophy, Calendar, Sparkles, AlertTriangle, Layers, Activity } from 'lucide-react';
import { useApp } from '../../store/AppContext';

interface CursosProps {
  onSelect: (view: string) => void;
}

export default function Cursos({ onSelect }: CursosProps) {
  const { courses, tasks, addCourse, deleteCourse } = useApp();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#E11D48');
  const [deletingCourse, setDeletingCourse] = useState<string | null>(null);

  const courseColors = [
    '#E11D48', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#4B5563'
  ];

  const handleCreateCourse = () => {
    if (!newCourseName.trim()) return;
    addCourse({
      name: newCourseName,
      color: newCourseColor,
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      hoursStudied: 0,
    });
    setNewCourseName('');
    setShowCreateModal(false);
  };

  const handleDeleteCourse = (courseId: string) => {
    deleteCourse(courseId);
    setDeletingCourse(null);
    if (selectedCourse === courses.find(c => c.id === courseId)?.name) {
      setSelectedCourse(null);
    }
  };

  return (
    <div className="page-container">
      
      {/* ARCHITECTURAL HEADER - REFINED */}
      <header className="flex justify-between items-end mb-24 relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Layers size={20} className="text-accent" />
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.5em]">Estructura de Conocimiento</span>
          </div>
          <h1 className="text-8xl font-black text-primary tracking-tighter leading-none">
            Sectores
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl text-secondary font-medium tracking-tight opacity-60">
            {courses.length} MATERIAS ACTIVAS EN EL PROTOCOLO
          </p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-12 h-20 rounded-[32px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all flex items-center gap-4"
        >
          <Plus size={24} /> Nuevo Sector
        </button>
      </header>

      {/* GRID - MASTERED SPACING */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
        {courses.map(course => {
          const completed = tasks.filter(t => t.course === course.name && (t.status === 'completado' || t.status === 'simple_done')).length;
          const progress = course.totalTasks > 0 ? Math.round((completed / course.totalTasks) * 100) : 0;
          
          return (
            <div
              key={course.id}
              onClick={() => setSelectedCourse(course.name)}
              className="bento-card group flex flex-col cursor-pointer transition-all duration-500 relative overflow-hidden p-12 hover:scale-[1.02] hover:border-accent/30"
            >
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeletingCourse(course.id); }}
                  className="w-12 h-12 rounded-2xl bg-accent/5 text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="flex items-start justify-between mb-12">
                <div 
                  className="w-16 h-16 rounded-[28px] flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform duration-500"
                  style={{ background: `linear-gradient(135deg, ${course.color}, ${course.color}CC)` }}
                >
                  <BookOpen size={32} />
                </div>
              </div>

              <div className="mb-10">
                <h3 className="text-4xl font-black text-primary mb-3 tracking-tighter leading-none group-hover:translate-x-2 transition-transform duration-500">{course.name}</h3>
                <div className="flex items-center gap-3 text-[10px] font-black text-muted uppercase tracking-widest">
                  <Activity size={14} className="text-accent/50" />
                  <span>Sincronizado</span>
                </div>
              </div>

              <div className="mt-auto pt-10 border-t border-white/5">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">Eficiencia</span>
                  <span className="text-2xl font-black text-primary tracking-tighter">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(225,29,72,0.3)]" 
                    style={{ width: `${progress}%`, backgroundColor: course.color }} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mt-10">
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-primary tracking-tighter">{completed}/{course.totalTasks || 0}</span>
                  <span className="text-[10px] font-black text-muted uppercase tracking-[0.4em]">Hitos</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-primary tracking-tighter">{course.hoursStudied || 0}h</span>
                  <span className="text-[10px] font-black text-muted uppercase tracking-[0.4em]">Foco</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* ADD BUTTON - REFINED */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="bento-card border-dashed border-2 border-white/5 bg-transparent hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-6 text-muted hover:text-accent transition-all min-h-[350px] group"
        >
          <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-accent transition-all duration-500">
            <Plus size={40} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.6em]">Añadir Sector</span>
        </button>
      </div>

      {/* CREATE MODAL - REFINED */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="bento-card max-w-2xl w-full p-16 bg-surface shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-white/10 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-16">
              <div>
                <h2 className="text-5xl font-black tracking-tighter mb-4">Nuevo Sector</h2>
                <p className="text-[11px] font-black text-muted uppercase tracking-widest">Protocolo Académico</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-16 h-16 rounded-full flex items-center justify-center hover:bg-white/5 transition-all">
                <X size={32} className="text-muted" />
              </button>
            </div>
            
            <div className="space-y-12">
              <div className="flex flex-col gap-5">
                <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Nombre del Sector</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Ej: Análisis de Algoritmos"
                  className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[32px] text-primary font-black text-2xl focus:border-accent outline-none transition-all placeholder:text-white/5"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-6">
                <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Espectro Cromático</label>
                <div className="flex gap-4 flex-wrap">
                  {courseColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCourseColor(color)}
                      className={`w-14 h-14 rounded-2xl transition-all duration-500 transform hover:scale-125 ${
                        newCourseColor === color ? 'ring-4 ring-accent ring-offset-8 ring-offset-bg-surface scale-110 shadow-2xl' : ''
                      }`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-6 pt-8">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-6 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] text-tertiary hover:bg-white/5 transition-all">Cancelar</button>
                <button onClick={handleCreateCourse} className="flex-[2] py-6 rounded-[28px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Sincronizar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL - REFINED */}
      {deletingCourse && (
        <div className="modal-overlay" onClick={() => setDeletingCourse(null)}>
          <div className="bento-card max-w-lg w-full p-16 bg-surface border-accent/20 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-[48px] bg-accent/5 flex items-center justify-center text-accent mb-12 border border-accent/20">
                <AlertTriangle size={64} />
              </div>
              <h2 className="text-5xl font-black tracking-tighter mb-6">¿Purgar Sector?</h2>
              <p className="text-secondary text-lg font-medium mb-16 opacity-60 leading-relaxed">Todos los registros y progresos asociados a este sector serán eliminados permanentemente.</p>
              <div className="flex gap-6 w-full">
                <button onClick={() => setDeletingCourse(null)} className="flex-1 py-6 rounded-[28px] bg-white/[0.02] border border-white/5 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Abortar</button>
                <button onClick={() => handleDeleteCourse(deletingCourse)} className="flex-1 py-6 rounded-[28px] bg-accent text-white text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL - REFINED */}
      {selectedCourse && (
        <div className="modal-overlay" onClick={() => setSelectedCourse(null)}>
          <div className="bento-card max-w-4xl w-full p-16 bg-surface shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-white/10 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-16 pb-12 border-b border-white/5">
              <div>
                <h2 className="text-6xl font-black tracking-tighter leading-none mb-4">{selectedCourse}</h2>
                <p className="text-[11px] font-black text-accent uppercase tracking-[0.5em]">Registro de Actividades por Sector</p>
              </div>
              <button onClick={() => setSelectedCourse(null)} className="w-16 h-16 rounded-full flex items-center justify-center hover:bg-white/5 transition-all">
                <X size={32} className="text-muted" />
              </button>
            </div>
            <div className="max-h-[500px] overflow-y-auto pr-6 space-y-6">
              {tasks.filter(t => t.course === selectedCourse).map(task => (
                <div key={task.id} className="flex items-center gap-8 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 group hover:border-accent/30 transition-all">
                  <div className={`w-3 h-3 rounded-full ${task.status === 'completado' || task.status === 'simple_done' ? 'bg-accent shadow-[0_0_10px_var(--accent)]' : 'bg-white/10'}`} />
                  <span className={`flex-1 text-2xl font-black tracking-tight ${task.status === 'completado' || task.status === 'simple_done' ? 'text-muted line-through' : 'text-primary'}`}>
                    {task.title}
                  </span>
                  <span className="text-[11px] font-black text-tertiary uppercase tracking-widest px-6 py-2 bg-white/5 rounded-full border border-white/5">
                    {task.priority.toUpperCase()}
                  </span>
                </div>
              ))}
              {tasks.filter(t => t.course === selectedCourse).length === 0 && (
                <div className="text-center py-24 opacity-10">
                  <Sparkles size={120} className="mx-auto mb-8" />
                  <p className="font-black uppercase tracking-[0.8em]">Sector Despejado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
 );
}