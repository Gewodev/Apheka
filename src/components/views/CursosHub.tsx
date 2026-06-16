import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap, Book, PlusCircle, Upload, Download, Trash2,
  X, Image as ImageIcon, GripVertical
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
}

export default function CursosHub({ onSelectCourse }: CursosHubProps) {
  const { courses = [], addCourse, updateCourse, deleteCourse, reorderCourses } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseCover, setCourseCover] = useState<string | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState(() => format(new Date(), "HH:mm"));
  const [secStr, setSecStr] = useState(() => format(new Date(), "ss"));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [longPressIndex, setLongPressIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(format(now, "HH:mm"));
      setSecStr(format(now, "ss"));
    };
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
    reader.onload = (event) => {
      setCourseCover(event.target?.result as string);
      toast.success('Imagen cargada correctamente');
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    const name = courseName.trim();
    if (!name) {
      toast.error('El nombre de la asignatura es obligatorio');
      return;
    }
    if (courses.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Esta asignatura ya existe');
      return;
    }

    addCourse({
      name,
      color: '#758bfa',
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      hoursStudied: 0,
      coverImage: courseCover,
      coverUrl: courseCover,
      groups: [],
      studyTopics: []
    });

    setCourseName('');
    setCourseCover(undefined);
    setShowAddModal(false);
    toast.success('Asignatura creada correctamente');
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
      const exportFileDefaultName = `owa-asignaturas-${new Date().toISOString().split('T')[0]}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      toast.success('Asignaturas exportadas correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar asignaturas');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const ids = [...courses.map((c) => c.id)];
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, moved);
    reorderCourses(ids);
    setDragIndex(null);
  };

  const handleMouseDown = (index: number) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressIndex(index);
    }, LONG_PRESS_MS);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLongPressIndex(null);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          importedData.forEach((course: Course) => {
            if (!courses.some(c => c.name.toLowerCase() === course.name.toLowerCase())) {
              addCourse({
                name: course.name,
                color: course.color || '#758bfa',
                progress: course.progress || 0,
                totalTasks: course.totalTasks || 0,
                completedTasks: course.completedTasks || 0,
                hoursStudied: course.hoursStudied || 0,
                coverImage: course.coverImage || course.coverUrl,
                coverUrl: course.coverImage || course.coverUrl,
                groups: course.groups || [],
                studyTopics: course.studyTopics || []
              });
            }
          });
          toast.success('Datos importados correctamente');
        } else {
          toast.error('El formato del archivo es inválido');
        }
      } catch (err) {
        console.error(err);
        toast.error('Error al parsear el archivo JSON');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="page-container" style={{
      display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", gap: 20, padding: "20px 28px",
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingTop: 8, flexShrink: 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "var(--radius-sm)",
              background: "linear-gradient(135deg, var(--accent-dim), var(--accent)22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <GraduationCap size={22} style={{ color: "var(--accent)" }} />
            </div>
            <h1 style={{
              fontFamily: "'Inter Tight', sans-serif", fontWeight: 200,
              fontSize: 40, lineHeight: 1, letterSpacing: "-0.03em",
              color: "var(--text-primary)", margin: 0,
              textShadow: "0 0 20px var(--accent-glow)",
            }}>Mis Asignaturas</h1>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NotificationBell />
            <div style={{
              paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '50%', right: 0,
                width: 150, height: 100,
                background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)',
                opacity: 0.4, transform: 'translateY(-50%)',
                pointerEvents: 'none', zIndex: 0,
              }} />
              <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                  <span style={{
                    fontFamily: "'Inter Tight', sans-serif", fontSize: 68,
                    fontWeight: 200, lineHeight: 0.9, color: 'var(--accent)',
                    letterSpacing: '0.02em',
                    textShadow: '0 0 20px var(--accent-glow)',
                  }}>{timeStr}</span>
                  <span style={{
                    fontFamily: "'Inter Tight', sans-serif", fontSize: 22,
                    fontWeight: 200, color: 'var(--accent)', opacity: 0.7,
                    letterSpacing: '0.02em',
                  }}>{secStr}</span>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, display: 'block',
                }}>{dateStr}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setShowAddModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", fontSize: 11, fontWeight: 600,
                border: "none", borderRadius: 16,
                cursor: "pointer", background: "var(--accent)", color: "#fff",
                fontFamily: "var(--font-primary)",
                transition: "all 200ms " + EASE,
              }}
              className="hover:shadow-[0_0_14px_var(--accent-glow)]">
              <PlusCircle size={14} /> Añadir
            </button>
            <div style={{ width: 1, height: 18, background: "var(--border-subtle)" }} />
            <button onClick={() => importInputRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", fontSize: 10, fontWeight: 500,
                border: "1px solid var(--border-default)", borderRadius: 16,
                cursor: "pointer",
                background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
                color: "var(--text-secondary)", fontFamily: "var(--font-primary)",
                transition: "all 200ms " + EASE,
              }}>
              <Upload size={12} /> Importar
            </button>
            <button onClick={handleExport}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", fontSize: 10, fontWeight: 500,
                border: "1px solid var(--border-default)", borderRadius: 16,
                cursor: "pointer",
                background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
                color: "var(--text-secondary)", fontFamily: "var(--font-primary)",
                transition: "all 200ms " + EASE,
              }}>
              <Download size={12} /> Exportar
            </button>
          </div>
        </div>
      </header>

      <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImport} />

      {/* Course grid */}
      <div style={{ flex: 1, overflow: "auto", paddingRight: 4 }}>
        {courses.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '100px 20px', textAlign: 'center',
          }}>
            <GraduationCap size={60} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.3 }} />
            <h3 style={{
              fontSize: 18, fontWeight: 500, color: 'var(--text-secondary)',
              fontFamily: "'Inter Tight', sans-serif", marginBottom: 8,
            }}>Aún no tienes asignaturas</h3>
            <p style={{
              fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 380,
              lineHeight: 1.6, fontWeight: 400,
            }}>
              Agrega tu primera asignatura para empezar a estructurar tus temas, agrupaciones y recursos de estudio.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            paddingBottom: 20,
          }}>
            {courses.map((course, idx) => {
              const isDragging = dragIndex === idx;
              const isLongPressed = longPressIndex === idx;
              return (
              <div
                key={course.id}
                className="bento-card"
                draggable={isLongPressed}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                onMouseDown={() => handleMouseDown(idx)}
                onMouseUp={(e) => { handleMouseUp(); if (!isLongPressed) onSelectCourse(course.id); }}
                onMouseLeave={handleMouseUp}
                onMouseEnter={(e) => {
                  if (isDragging) return;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-elevated), 0 0 0 1px var(--accent-glow)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                }}
                style={{
                  position: 'relative', overflow: 'hidden',
                  aspectRatio: '16 / 10',
                  cursor: isLongPressed ? 'grabbing' : 'pointer',
                  opacity: isDragging ? 0.4 : 1,
                  outline: isLongPressed ? '2px dashed var(--accent)' : 'none',
                  outlineOffset: 2,
                  background: course.coverUrl
                    ? `linear-gradient(135deg, ${course.color}22 0%, ${course.color}08 100%)`
                    : `linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)`,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  transition: isDragging ? "none" : "all 400ms " + EASE,
                }}
              >
                {/* Cover image */}
                {course.coverUrl && (
                  <img
                    src={course.coverUrl}
                    alt=""
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover',
                      transition: "transform 600ms " + EASE,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                )}

                {/* Gradient overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: course.coverUrl
                    ? 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 80%)'
                    : 'linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }} />

                {/* Fallback icon when no cover */}
                {!course.coverUrl && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -60%)',
                    pointerEvents: 'none',
                  }}>
                    <Book size={48} style={{ color: 'var(--accent)', opacity: 0.2 }} />
                  </div>
                )}

                {/* Drag handle — visible on long press */}
                {isLongPressed && (
                  <div style={{
                    position: 'absolute', top: 10, left: 10, zIndex: 3,
                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'none',
                  }}>
                    <GripVertical size={14} />
                  </div>
                )}

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(course.id);
                  }}
                  style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 2,
                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)', border: 'none',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                    opacity: 0, transition: 'opacity 200ms ' + EASE,
                    backdropFilter: 'blur(4px)',
                  }}
                  className="delete-btn-hover"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.background = 'rgba(239,68,68,0.8)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    const parent = e.currentTarget.closest('[class]');
                    if (parent) e.currentTarget.style.opacity = '0';
                  }}
                >
                  <Trash2 size={12} />
                </button>

                {/* Course name */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '16px 18px',
                }}>
                  <span style={{
                    fontSize: 16, fontWeight: 700, color: course.coverUrl ? '#fff' : 'var(--text-primary)',
                    fontFamily: "'Inter Tight', sans-serif",
                    letterSpacing: '-0.01em',
                    display: 'block',
                    textShadow: course.coverUrl ? '0 1px 8px rgba(0,0,0,0.6)' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{course.name}</span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowAddModal(false)}>
          <div className="bento-card" style={{
            width: 420, padding: 24,
            background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-elevated)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20,
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Inter Tight', sans-serif",
              }}>
                <GraduationCap size={18} style={{ color: "var(--accent)" }} /> Nueva Asignatura
              </h3>
              <button onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, display: 'flex',
                }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'block', marginBottom: 6,
                }}>Nombre de la asignatura</label>
                <input
                  type="text"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="input-base"
                  style={{
                    width: '100%', height: 40, fontSize: 13,
                    padding: '0 12px', borderRadius: 'var(--radius-sm)',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Ej: Cálculo, Biología..."
                  autoFocus
                />
              </div>

              <div>
                <label style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'block', marginBottom: 6,
                }}>Banner (opcional)</label>
                {courseCover ? (
                  <div style={{
                    position: 'relative', width: '100%', aspectRatio: '16/7',
                    borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <img src={courseCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => setCourseCover(undefined)}
                      style={{
                        position: 'absolute', top: 6, right: 6, width: 24, height: 24,
                        borderRadius: '50%', background: 'rgba(239,68,68,0.9)',
                        border: 'none', color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', height: 80, borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-default)',
                      background: 'transparent', color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: "all 200ms " + EASE,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <ImageIcon size={18} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subir Banner</span>
                  </button>
                )}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
              </div>

              <button
                onClick={handleCreate}
                className="btn-primary"
                disabled={!courseName.trim()}
                style={{
                  width: '100%', height: 40, border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', marginTop: 4,
                  background: courseName.trim() ? "var(--accent)" : "var(--bg-hover)",
                  color: courseName.trim() ? "#fff" : "var(--text-muted)",
                  fontSize: 12, fontWeight: 600,
                  fontFamily: "var(--font-primary)",
                  transition: "all 200ms " + EASE,
                }}>
                Crear Asignatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setPendingDeleteId(null)}>
          <div className="bento-card" style={{
            width: 380, padding: 24,
            background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-elevated)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Trash2 size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <h3 style={{
                fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0,
                fontFamily: "'Inter Tight', sans-serif",
              }}>Eliminar asignatura</h3>
            </div>
            <p style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20,
            }}>
              Esto eliminará permanentemente la asignatura junto con todos sus datos. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPendingDeleteId(null)}
                className="btn-secondary"
                style={{
                  background: 'none', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                  color: 'var(--text-secondary)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'var(--font-primary)',
                }}>
                Cancelar
              </button>
              <button onClick={handleConfirmDelete}
                style={{
                  background: 'var(--error)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
