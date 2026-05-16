import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Clock, List, Layers, Star, Plus,
  Target, GraduationCap, ChevronRight, CheckCircle,
  FileText, BrainCircuit, NotebookPen, ExternalLink,
  Image as ImageIcon, Folder, X, Upload, MoreVertical
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Cursos() {
  const { courses, tasks, notes, addCourse } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'resumen' | 'repaso' | 'tareas' | 'notas'>('resumen');
  const [showNewCourse, setShowNewCourse] = useState(false);
  
  // New course state
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#8B5CF6');

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0];
  const courseTasks = tasks.filter(t => t.course === selectedCourse?.name);
  const courseNotes = notes.filter(n => n.course === selectedCourse?.name);
  const completedTasks = courseTasks.filter(t => t.status === 'completado').length;
  const progress = courseTasks.length > 0 ? (completedTasks / courseTasks.length) * 100 : 0;

  // Aggregate files from course tasks
  const courseFiles = useMemo(() => {
    return courseTasks.flatMap(t => t.files);
  }, [courseTasks]);

  const handleCreateCourse = () => {
    if (!newCourseName.trim()) return;
    addCourse({
      name: newCourseName,
      color: newCourseColor,
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      hoursStudied: 0
    });
    setNewCourseName('');
    setShowNewCourse(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>
      
      {/* ── LEFT SIDEBAR (Course List) ── */}
      <aside style={{ width: 72, borderRight: '1px solid rgba(255,255,255,0.04)', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 16, boxShadow: '4px 0 32px rgba(0,0,0,0.2)', zIndex: 10 }}>
         {courses.map(course => (
           <button 
             key={course.id} 
             onClick={() => setSelectedCourseId(course.id)}
             style={{ 
               width: 44, height: 44, borderRadius: 12, background: selectedCourseId === course.id ? course.color : 'var(--bg-elevated)', 
               display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'all 200ms',
               color: selectedCourseId === course.id ? '#fff' : 'var(--text-tertiary)',
               boxShadow: selectedCourseId === course.id ? `0 4px 16px ${course.color}40` : 'none',
               position: 'relative'
             }}
             title={course.name}
           >
              <div style={{ fontSize: 18, fontWeight: 600 }}>{course.name[0]}</div>
              {selectedCourseId === course.id && (
                <div style={{ position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)', width: 4, height: 20, background: course.color, borderRadius: '0 4px 4px 0' }} />
              )}
           </button>
         ))}
         <div style={{ flex: 1 }} />
         <button onClick={() => setShowNewCourse(true)} className="btn-ghost" style={{ width: 44, height: 44, borderRadius: 12, border: '1px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={20} />
         </button>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
         {selectedCourse ? (
           <div className="fade-in-animation" style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
              
              {/* Header */}
              <header style={{ padding: '32px 40px 0', flexShrink: 0 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                    <div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                         <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedCourse.color, boxShadow: `0 0 10px ${selectedCourse.color}` }} />
                         <div style={{ fontSize: 11, fontWeight: 600, color: selectedCourse.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Módulo Académico</div>
                       </div>
                       <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{selectedCourse.name}</h1>
                    </div>
                    <div style={{ textAlign: 'right', background: 'var(--bg-surface)', padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                       <div style={{ fontSize: 24, fontWeight: 700, color: selectedCourse.color }}>{Math.round(progress)}%</div>
                       <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progreso Total</div>
                    </div>
                 </div>
                 
                 {/* Tabs */}
                 <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
                    {[
                      { id: 'resumen', label: 'Resumen', icon: Layers },
                      { id: 'repaso', label: 'Repaso', icon: BrainCircuit },
                      { id: 'tareas', label: 'Tareas', icon: List },
                      { id: 'notas', label: 'Notas', icon: NotebookPen }
                    ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{ 
                          padding: '0 0 12px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? selectedCourse.color : 'transparent'}`,
                          color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 200ms'
                        }}
                      >
                        <tab.icon size={16} style={{ color: activeTab === tab.id ? selectedCourse.color : 'currentColor' }} />
                        {tab.label}
                      </button>
                    ))}
                 </div>
              </header>

              {/* Layout for content + right sidebar */}
              <div style={{ display: 'flex', flex: 1, minHeight: 0, padding: '0 40px 32px', gap: 32 }}>
                
                {/* Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', paddingRight: 8 }}>
                  
                  {activeTab === 'resumen' && (
                    <div className="fade-in-animation" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                         {[
                           { label: 'Tareas Activas', val: courseTasks.filter(t => t.status !== 'completado').length, icon: Layers },
                           { label: 'Horas de Estudio', val: `${(selectedCourse.hoursStudied || 0).toFixed(1)}h`, icon: Clock },
                           { label: 'Notas Totales', val: courseNotes.length, icon: FileText }
                         ].map((stat, i) => (
                           <div key={i} className="bento-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--bg-deep)' }}>
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${selectedCourse.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedCourse.color }}>
                                 <stat.icon size={22} />
                              </div>
                              <div>
                                 <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
                                 <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{stat.val}</div>
                              </div>
                           </div>
                         ))}
                      </div>

                      <div className="bento-card" style={{ padding: 24 }}>
                        <div className="section-header" style={{ marginBottom: 16 }}>
                           <Target size={16} className="text-accent" /> Tareas Recientes
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                           {courseTasks.slice(0, 5).map(task => (
                              <div key={task.id} style={{ padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${selectedCourse.color}`, background: task.status === 'completado' ? selectedCourse.color : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {task.status === 'completado' && <CheckCircle size={10} color="#fff" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                   <div style={{ fontSize: 13, fontWeight: 500, color: task.status === 'completado' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'completado' ? 'line-through' : 'none' }}>{task.title}</div>
                                   <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{task.dueDate ? format(new Date(task.dueDate), 'd MMMM yyyy', { locale: es }) : 'Sin fecha'}</div>
                                </div>
                                <ChevronRight size={16} className="text-muted" />
                             </div>
                           ))}
                           {courseTasks.length === 0 && (
                             <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No hay tareas para este curso</div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'tareas' && (
                    <div className="fade-in-animation">
                      <div className="bento-card" style={{ padding: 24, minHeight: 400 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div className="section-header" style={{ marginBottom: 0 }}>
                            <List size={16} className="text-accent" /> Todas las Tareas
                          </div>
                          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>+ Nueva Tarea</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                           {courseTasks.map(task => (
                              <div key={task.id} style={{ padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${selectedCourse.color}`, background: task.status === 'completado' ? selectedCourse.color : 'transparent', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                   <div style={{ fontSize: 13, fontWeight: 500 }}>{task.title}</div>
                                   <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 12 }}>
                                     <span>Vence: {task.dueDate ? format(new Date(task.dueDate), 'd MMM', { locale: es }) : 'N/A'}</span>
                                     <span>Subtareas: {task.subtasks.length}</span>
                                     <span>Archivos: {task.files.length}</span>
                                   </div>
                                </div>
                             </div>
                           ))}
                           {courseTasks.length === 0 && (
                             <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Añade tu primera tarea para este curso desde la vista de Tareas</div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'notas' && (
                    <div className="fade-in-animation" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                      {courseNotes.map(note => (
                        <div key={note.id} className="bento-card" style={{ padding: 16, cursor: 'pointer' }}>
                          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{note.title}</h3>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {note.content.replace(/<[^>]*>?/gm, '')}
                          </div>
                          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
                            Actualizado: {format(new Date(note.updatedAt), 'd MMM yyyy', { locale: es })}
                          </div>
                        </div>
                      ))}
                      {courseNotes.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--bg-surface)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                          No hay notas para este curso. Créalas en la vista de Notas.
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'repaso' && (
                    <div className="fade-in-animation bento-card" style={{ padding: 40, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <BrainCircuit size={48} style={{ color: selectedCourse.color, opacity: 0.2, marginBottom: 16 }} />
                      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Módulo de Repaso</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300 }}>Este apartado está en construcción. Aquí podrás repasar conceptos clave usando tarjetas de memoria interactivas.</p>
                    </div>
                  )}

                </div>

                {/* Right Sidebar (Files & Shortcuts) */}
                <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                   <div className="bento-card" style={{ padding: 20 }}>
                      <div className="section-header" style={{ marginBottom: 16 }}>
                         <Folder size={14} className="text-accent" /> Archivos & Accesos
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                         {courseFiles.slice(0, 8).map((f, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer' }} className="hover-lift">
                               <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 {f.type === 'pdf' ? <FileText size={12} color="#EF4444" /> : f.type === 'image' ? <ImageIcon size={12} color="#3B82F6" /> : <ExternalLink size={12} color="#10B981" />}
                               </div>
                               <div style={{ flex: 1, minWidth: 0 }}>
                                 <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                                 <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{f.type.toUpperCase()}</div>
                               </div>
                            </div>
                         ))}
                         {courseFiles.length === 0 && (
                           <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No hay archivos asociados a las tareas</div>
                         )}
                      </div>

                      <button className="btn-secondary" style={{ width: '100%', fontSize: 11, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Plus size={14} /> Añadir acceso directo
                      </button>
                   </div>

                   <div className="bento-card" style={{ padding: 20, background: `linear-gradient(135deg, color-mix(in srgb, ${selectedCourse.color} 10%, transparent), transparent)` }}>
                      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                         <Star size={14} style={{ color: selectedCourse.color }} /> Logros
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                         <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={10} color={selectedCourse.color} /> Curso iniciado</div>
                         {completedTasks > 0 && (
                           <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={10} color={selectedCourse.color} /> {completedTasks} tareas completadas</div>
                         )}
                      </div>
                   </div>
                </div>

              </div>
           </div>
         ) : (
           <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <GraduationCap size={64} style={{ opacity: 0.1, marginBottom: 24 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>Selecciona un curso o crea uno nuevo</p>
           </div>
         )}
      </main>

      {/* ── NEW COURSE MODAL ── */}
      {showNewCourse && (
        <div role="dialog" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowNewCourse(false)}>
          <div className="bento-card" style={{ width: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={18} className="text-accent" /> Nuevo Curso
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Nombre del Curso</label>
                <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Ej. Matemáticas Avanzadas" className="input-base" autoFocus style={{ width: '100%', fontSize: 13, padding: '10px 14px', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Color Distintivo</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'].map(color => (
                    <button key={color} onClick={() => setNewCourseColor(color)} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: newCourseColor === color ? '2px solid #fff' : 'none', cursor: 'pointer', boxShadow: newCourseColor === color ? `0 0 10px ${color}` : 'none', transition: 'all 200ms' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowNewCourse(false)} className="btn-secondary" style={{ fontSize: 12, padding: '8px 20px' }}>Cancelar</button>
                <button onClick={handleCreateCourse} className="btn-primary" disabled={!newCourseName.trim()} style={{ fontSize: 12, padding: '8px 24px', opacity: newCourseName.trim() ? 1 : 0.5 }}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
