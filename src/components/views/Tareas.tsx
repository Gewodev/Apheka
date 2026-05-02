import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, CheckCircle2, X, Flame, Flag, Pencil, ListTodo, Filter, Sparkles, AlertTriangle, ArrowRight, ChevronRight, Activity, Layers } from 'lucide-react';
import { useApp, Task } from '../../store/AppContext';

export default function Tareas() {
  const { tasks, courses, addTask, updateTask, deleteTask, toggleTaskStatus } = useApp();
  const [selectedCourse, setSelectedCourse] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskUrgent, setTaskUrgent] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedCourse !== 'Todos' && t.course !== selectedCourse) return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tasks, selectedCourse, searchQuery]);

  const activeTasks = filteredTasks.filter(t => t.status !== 'completado' && t.status !== 'simple_done');
  const completedTasks = filteredTasks.filter(t => t.status === 'completado' || t.status === 'simple_done');

  const openModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskPriority(task.priority);
      setTaskUrgent(task.urgent);
    } else {
      setEditingTask(null);
      setTaskTitle('');
      setTaskPriority('medium');
      setTaskUrgent(false);
    }
    setShowModal(true);
  };

  const saveTask = () => {
    if (!taskTitle.trim()) return;
    const course = courses.find(c => c.name === selectedCourse) || courses[0];
    const courseName = selectedCourse === 'Todos' ? course?.name || 'General' : selectedCourse;
    const courseColor = course?.color || '#E11D48';

    if (editingTask) {
      updateTask(editingTask.id, { title: taskTitle, priority: taskPriority, urgent: taskUrgent });
    } else {
      addTask({ title: taskTitle, course: courseName, courseColor, priority: taskPriority, urgent: taskUrgent, checkType: 'simple' });
    }
    setShowModal(false);
  };

  return (
    <div className="page-container">
      
      {/* ARCHITECTURAL HEADER - REFINED */}
      <header className="flex justify-between items-end mb-24 relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Layers size={20} className="text-accent" />
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.5em]">Gestión de Operaciones</span>
          </div>
          <h1 className="text-8xl font-black text-primary tracking-tighter leading-none">
            Tareas
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl text-secondary font-medium tracking-tight opacity-60">
            {activeTasks.length} ACCIONES PENDIENTES EN COLA
          </p>
        </div>
        <button 
          onClick={() => openModal()}
          className="px-12 h-20 rounded-[32px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all flex items-center gap-4"
        >
          <Plus size={24} /> Nueva Acción
        </button>
      </header>

      <div className="grid grid-cols-12 gap-16">
        
        {/* LEFT COLUMN: FILTERS & STATS */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-12">
          
          <div className="bento-card p-12">
            <div className="flex items-center gap-4 mb-12">
              <Search size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Localizador</span>
            </div>
            
            <div className="space-y-10">
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Búsqueda Global</label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Filtrar por etiqueta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-[24px] text-lg font-bold text-primary focus:border-accent outline-none transition-all placeholder:text-muted/30"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Sector</label>
                <div className="relative">
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-[24px] text-lg font-bold text-primary outline-none focus:border-accent appearance-none cursor-pointer"
                  >
                    <option value="Todos">Todos los Sectores</option>
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <ChevronRight size={24} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted pointer-events-none rotate-90" />
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card p-12">
            <div className="flex items-center gap-4 mb-12">
              <Activity size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Diagnóstico</span>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 flex justify-between items-center group hover:border-accent/30 transition-all">
                <div>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Pendientes</p>
                  <p className="text-6xl font-black text-primary tracking-tighter leading-none">{activeTasks.length}</p>
                </div>
                <div className="w-16 h-16 rounded-[24px] bg-accent/5 flex items-center justify-center border border-accent/10">
                  <Flame size={28} className="text-accent" />
                </div>
              </div>
              <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 flex justify-between items-center group hover:border-success/30 transition-all">
                <div>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Ejecutadas</p>
                  <p className="text-6xl font-black text-success tracking-tighter leading-none">{completedTasks.length}</p>
                </div>
                <div className="w-16 h-16 rounded-[24px] bg-success/5 flex items-center justify-center border border-success/10">
                  <CheckCircle2 size={28} className="text-success" />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: TASK LIST */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-12">
          
          <div className="bento-card min-h-[800px] flex flex-col p-0 border-white/[0.02]">
            <div className="p-16 border-b border-white/[0.03] bg-white/[0.01] flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 rounded-[24px] bg-accent/5 flex items-center justify-center border border-accent/20">
                  <ListTodo size={32} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-primary tracking-tight leading-none mb-2 uppercase">Cola de Procesos</h3>
                  <p className="text-[11px] font-black text-muted uppercase tracking-[0.4em]">Priorización Inteligente Activa</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-[0_0_15px_var(--accent)]" />
              </div>
            </div>

            <div className="p-16 space-y-6">
              {activeTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => toggleTaskStatus(task.id)}
                  className="flex items-center gap-10 p-10 rounded-[48px] bg-white/[0.01] border border-white/[0.02] group hover:border-accent/30 hover:bg-white/[0.03] transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-accent/10 group-hover:bg-accent group-hover:shadow-[0_0_20px_var(--accent)] transition-all" />
                  
                  <div 
                    className={`w-12 h-12 rounded-[20px] border-2 flex items-center justify-center transition-all duration-500 ${
                      task.status === 'simple_done' ? 'bg-accent border-accent scale-110 shadow-2xl' : 'border-white/10 group-hover:border-accent/50'
                    }`}
                  >
                    {task.status === 'simple_done' && <CheckCircle2 size={24} className="text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/5" style={{ color: task.courseColor, backgroundColor: `${task.courseColor}15` }}>
                        {task.course}
                      </span>
                      {task.urgent && (
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                          <Flame size={12} className="text-accent" />
                          <span className="text-[10px] font-black text-accent uppercase tracking-widest">Urgente</span>
                        </div>
                      )}
                    </div>
                    <h4 className="text-3xl font-black text-primary tracking-tighter truncate group-hover:translate-x-4 transition-transform duration-500">{task.title}</h4>
                  </div>

                  <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-8 group-hover:translate-x-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openModal(task); }}
                      className="w-16 h-16 rounded-[24px] bg-white/5 flex items-center justify-center text-muted hover:text-primary hover:bg-white/10 transition-all"
                    >
                      <Pencil size={24} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteId(task.id); }}
                      className="w-16 h-16 rounded-[24px] bg-accent/5 flex items-center justify-center text-accent/50 hover:text-accent hover:bg-accent/10 transition-all"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                </div>
              ))}

              {activeTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-48 opacity-10">
                  <CheckCircle2 size={120} className="mb-12" />
                  <p className="font-black uppercase tracking-[0.8em] text-center">Protocolo Finalizado</p>
                </div>
              )}
            </div>

            {completedTasks.length > 0 && (
              <div className="mt-auto p-16 border-t border-white/[0.03] bg-white/[0.01]">
                <div className="flex justify-between items-center mb-10">
                  <h4 className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Historial de Ejecución</h4>
                  <button onClick={() => setDeleteId('all')} className="text-[11px] font-black text-accent uppercase tracking-widest hover:scale-110 transition-all">Limpiar Log</button>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {completedTasks.slice(0, 4).map(task => (
                    <div key={task.id} className="flex items-center gap-6 px-8 py-6 rounded-[32px] bg-white/[0.02] border border-transparent opacity-40 hover:opacity-100 hover:border-white/10 transition-all group">
                      <CheckCircle2 size={20} className="text-success group-hover:scale-125 transition-transform" />
                      <span className="text-lg font-bold text-secondary line-through truncate tracking-tight">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL MASTERED */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="bento-card max-w-2xl w-full p-16 bg-surface shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-white/10 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-16">
              <div>
                <h2 className="text-5xl font-black tracking-tighter mb-4">{editingTask ? 'Modificar' : 'Nueva Acción'}</h2>
                <p className="text-[11px] font-black text-muted uppercase tracking-widest">Descriptor de Protocolo</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-16 h-16 rounded-full flex items-center justify-center hover:bg-white/5 transition-all">
                <X size={32} className="text-muted" />
              </button>
            </div>
            
            <div className="space-y-12">
              <div className="flex flex-col gap-5">
                <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Identificador</label>
                <input
                  type="text"
                  placeholder="Define la acción operativa..."
                  className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[32px] text-primary font-black text-2xl focus:border-accent outline-none transition-all"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-5">
                <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Prioridad de Ejecución</label>
                <div className="grid grid-cols-3 gap-6">
                  {(['high', 'medium', 'low'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTaskPriority(p)}
                      className={`p-6 text-[11px] font-black rounded-[24px] border transition-all uppercase tracking-[0.3em] ${
                        taskPriority === p ? 'bg-accent border-accent text-white shadow-2xl scale-110' : 'bg-white/[0.02] border-white/5 text-muted hover:bg-white/5'
                      }`}
                    >
                      {p === 'high' ? 'Crítico' : p === 'medium' ? 'Medio' : 'Bajo'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setTaskUrgent(!taskUrgent)}
                className={`w-full flex items-center justify-between p-8 rounded-[32px] border font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-500 ${
                  taskUrgent ? 'bg-accent/10 border-accent/40 text-accent shadow-2xl' : 'bg-white/[0.02] border-white/5 text-muted hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <Flame size={24} />
                  <span>Protocolo de Emergencia</span>
                </div>
                <div className={`w-14 h-8 rounded-full relative transition-all ${taskUrgent ? 'bg-accent' : 'bg-white/10'}`}>
                   <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${taskUrgent ? 'right-1' : 'left-1'}`} />
                </div>
              </button>

              <div className="flex gap-6 pt-8">
                <button onClick={() => setShowModal(false)} className="flex-1 py-6 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] text-tertiary hover:bg-white/5 transition-all">Cancelar</button>
                <button onClick={saveTask} className="flex-[2] py-6 rounded-[28px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Sincronizar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="bento-card max-w-lg w-full p-16 bg-surface border-accent/20 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-[48px] bg-accent/5 flex items-center justify-center text-accent mb-12 border border-accent/20">
                <AlertTriangle size={64} />
              </div>
              <h2 className="text-5xl font-black tracking-tighter mb-6">¿Purgar Datos?</h2>
              <p className="text-secondary text-lg font-medium mb-16 opacity-60 leading-relaxed">Esta acción eliminará permanentemente los registros seleccionados del núcleo del sistema.</p>
              
              <div className="flex gap-6 w-full">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-6 rounded-[28px] bg-white/[0.02] border border-white/5 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Abortar</button>
                <button 
                  onClick={() => {
                    if (deleteId === 'all') {
                      tasks.filter(t => t.status === 'completado' || t.status === 'simple_done').forEach(t => deleteTask(t.id));
                    } else {
                      deleteTask(deleteId);
                    }
                    setDeleteId(null);
                  }}
                  className="flex-1 py-6 rounded-[28px] bg-accent text-white text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}