import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GraduationCap, PlusCircle, Upload, Download, Trash2,
  X, Image as ImageIcon, GripVertical,
} from 'lucide-react';
import { useApp, Course } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
import toast from 'react-hot-toast';
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const LONG_PRESS_MS = 300;
interface CursosHubProps {
  onSelectCourse: (courseId: string) => void;
  onTabSelect?: (courseId: string, tab: 'tareas' | 'notas' | 'archivos') => void;
}

export default function CursosHub({ onSelectCourse, onTabSelect }: CursosHubProps) {
  const { courses = [], addCourse, updateCourse, deleteCourse, reorderCourses } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseColor, setCourseColor] = useState('#758bfa');
  const [courseCover, setCourseCover] = useState<string | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState(() => format(new Date(), "HH:mm"));
  const [secStr, setSecStr] = useState(() => format(new Date(), "ss"));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [longPressIndex, setLongPressIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => { const now = new Date(); setTimeStr(format(now, "HH:mm")); setSecStr(format(now, "ss")); };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = useMemo(() => {
    try {
      const d = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      return d.charAt(0).toUpperCase() + d.slice(1);
    } catch { return ""; }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setCourseCover(event.target?.result as string); toast.success('Imagen cargada'); };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    const name = courseName.trim();
    if (!name) { toast.error('El nombre es obligatorio'); return; }
    if (courses.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast.error('Ya existe'); return; }
    addCourse({ name, color: courseColor, progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0, coverImage: courseCover, coverUrl: courseCover, groups: [], studyTopics: [] });
    setCourseName(''); setCourseColor('#758bfa'); setCourseCover(undefined); setShowAddModal(false);
    toast.success('Asignatura creada');
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteCourse(pendingDeleteId);
    setPendingDeleteId(null);
    toast.success('Asignatura eliminada');
  };

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(courses, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', `owa-asignaturas-${new Date().toISOString().split('T')[0]}.json`);
      link.click();
      toast.success('Asignaturas exportadas');
    } catch { toast.error('Error al exportar'); }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index));
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const ids = [...courses.map(c => c.id)];
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, moved);
    reorderCourses(ids);
    setDragIndex(null);
  };
  const handleMouseDown = (index: number) => {
    longPressTimer.current = setTimeout(() => setLongPressIndex(index), LONG_PRESS_MS);
  };
  const handleMouseUp = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } setLongPressIndex(null); };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          importedData.forEach((c: Course) => {
            if (!courses.some(x => x.name.toLowerCase() === c.name.toLowerCase())) {
              addCourse({ name: c.name, color: c.color || '#758bfa', progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0, coverImage: c.coverImage || c.coverUrl, coverUrl: c.coverImage || c.coverUrl, groups: c.groups || [], studyTopics: c.studyTopics || [] });
            }
          });
          toast.success('Importado correctamente');
        } else toast.error('Formato inválido');
      } catch { toast.error('Error al parsear'); }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="page-container" style={{
      display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", gap: 24, padding: "24px 32px",
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4, flexShrink: 0 }}>
        <div>
          <h1 style={{
            fontFamily: "'Inter Tight', 'Arial Narrow', sans-serif",
            fontWeight: 200, fontSize: 44, lineHeight: 1,
            letterSpacing: '-0.04em',
            color: 'var(--text-primary)', margin: 0,
          }}>Mis Cursos</h1>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>
            {courses.length} {courses.length === 1 ? 'asignatura' : 'asignaturas'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <NotificationBell />
            <div style={{ paddingLeft: 20, borderLeft: '1px solid var(--border-subtle)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', right: 0, width: 150, height: 100, background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)', opacity: 0.4, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200, lineHeight: 0.9, color: 'var(--accent)', letterSpacing: '0.02em', textShadow: '0 0 20px var(--accent-glow)' }}>{timeStr}</span>
                  <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200, color: 'var(--accent)', opacity: 0.7, letterSpacing: '0.02em' }}>{secStr}</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, display: 'block' }}>{dateStr}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 8, height: 38, borderRadius: 10, padding: "0 18px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: "var(--accent)", color: "#fff", fontFamily: "'Outfit', sans-serif", boxShadow: "0 4px 15px var(--accent-dim)", transition: "all 200ms " + EASE }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
              <PlusCircle size={14} /> Añadir
            </button>
            <button onClick={() => importInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, height: 38, borderRadius: 10, padding: "0 18px", fontSize: 12, fontWeight: 600, border: "1px solid var(--border-subtle)", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", fontFamily: "'Outfit', sans-serif", transition: "all 200ms " + EASE }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
              <Upload size={13} /> Importar
            </button>
            <button onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 8, height: 38, borderRadius: 10, padding: "0 18px", fontSize: 12, fontWeight: 600, border: "1px solid var(--border-subtle)", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", fontFamily: "'Outfit', sans-serif", transition: "all 200ms " + EASE }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
              <Download size={13} /> Exportar
            </button>
          </div>
        </div>
      </header>

      <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImport} />

      <div style={{ flex: 1, overflow: "auto", paddingRight: 4, paddingTop: 4 }}>
        {courses.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', textAlign: 'center' }}>
            <GraduationCap size={60} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.3 }} />
            <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 8 }}>Aún no tienes cursos</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 380, lineHeight: 1.6 }}>Agrega tu primer curso para empezar a organizar tus temas, tareas y recursos de estudio.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, paddingBottom: 24 }}>
            {courses.map((course, idx) => {
              const isDragging = dragIndex === idx;
              const isLongPressed = longPressIndex === idx;
              return (
              <div key={course.id}
                draggable={isLongPressed}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                onMouseDown={() => handleMouseDown(idx)}
                onMouseUp={(e) => { handleMouseUp(); if (!isLongPressed) onSelectCourse(course.id); }}
                style={{
                  position: 'relative', overflow: 'hidden',
                  borderRadius: 16, border: '1px solid var(--border-subtle)',
                  background: course.coverUrl ? 'transparent' : `linear-gradient(145deg, ${course.color}22, ${course.color}06)`,
                  cursor: isLongPressed ? 'grabbing' : 'pointer',
                  opacity: isDragging ? 0.4 : 1,
                  outline: isLongPressed ? '2px dashed var(--accent)' : 'none',
                  outlineOffset: 2,
                  transition: isDragging ? "none" : "all 500ms " + EASE,
                  aspectRatio: '16/10',
                }}
                onMouseEnter={(e) => {
                  if (isDragging) return;
                  e.currentTarget.style.boxShadow = 'var(--shadow-elevated), 0 0 0 1px var(--accent-glow)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)';
                }}
                onMouseLeave={(e) => {
                  handleMouseUp();
                  if (isDragging) return;
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                {/* Full-bleed cover */}
                {course.coverUrl ? (
                  <img src={course.coverUrl} alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: "transform 700ms " + EASE }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GraduationCap size={52} style={{ color: course.color, opacity: 0.12 }} />
                  </div>
                )}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.8) 100%)',
                  pointerEvents: 'none',
                }} />

                {/* Course name overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '18px 20px',
                }}>
                  <span style={{
                    fontSize: 28, fontWeight: 200, color: '#fff',
                    fontFamily: "'Inter Tight', 'Arial Narrow', sans-serif",
                    letterSpacing: '-0.03em', lineHeight: 1.15,
                    display: 'block',
                    textShadow: '0 2px 20px rgba(0,0,0,0.7)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{course.name}</span>
                </div>

                {/* Delete button */}
                <button onClick={(e) => { e.stopPropagation(); setPendingDeleteId(course.id); }}
                  style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 4,
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
                    border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                    opacity: 0, transition: 'opacity 250ms ' + EASE,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(239,68,68,0.8)'; e.currentTarget.style.color = '#fff'; }}
                  className="group-hover-visible">
                  <Trash2 size={12} />
                </button>

                {isLongPressed && (
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
                    <GripVertical size={14} />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddModal(false)}>
          <div style={{ width: 420, padding: 24, borderRadius: 'var(--radius-lg)', background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-elevated)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Inter Tight', sans-serif", margin: 0 }}>
                <GraduationCap size={18} style={{ color: "var(--accent)" }} /> Nueva Asignatura
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Nombre</label>
                <input value={courseName} onChange={e => setCourseName(e.target.value)} className="input-base"
                  style={{ width: '100%', height: 40, fontSize: 13, padding: '0 12px', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
                  placeholder="Ej: Cálculo, Biología..." autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Color</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['#E11D48','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6','#D946EF','#0EA5E9','#22C55E','#EAB308','#A855F7','#758bfa','#6B7280'].map(c => (
                    <button key={c} onClick={() => setCourseColor(c)}
                      style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${courseColor === c ? '#fff' : 'transparent'}`, background: c, cursor: 'pointer', outline: courseColor === c ? `2px solid ${c}` : 'none', outlineOffset: 1, transition: 'all 150ms' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Banner (opcional)</label>
                {courseCover ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16/7', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <img src={courseCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setCourseCover(undefined)} style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', height: 80, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, transition: "all 200ms " + EASE }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                    <ImageIcon size={18} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subir Banner</span>
                  </button>
                )}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
              </div>
              <button onClick={handleCreate} disabled={!courseName.trim()}
                style={{ width: '100%', height: 40, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginTop: 4, background: courseName.trim() ? "var(--accent)" : "var(--bg-hover)", color: courseName.trim() ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-primary)", transition: "all 200ms " + EASE }}>
                Crear Asignatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {pendingDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setPendingDeleteId(null)}>
          <div style={{ width: 380, padding: 24, borderRadius: 'var(--radius-lg)', background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-elevated)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Trash2 size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>Eliminar asignatura</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>Esto eliminará permanentemente la asignatura junto con todos sus datos. Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPendingDeleteId(null)} style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Cancelar</button>
              <button onClick={handleConfirmDelete} style={{ background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
