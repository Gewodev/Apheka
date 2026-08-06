import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap, PlusCircle, Upload, Download,
  X, Image as ImageIcon,
} from 'lucide-react';
import { useApp, Course } from '../../store/AppContext';
import { openBrainWithAnchor, isOverBrainZone, setBrainDragState } from '../../lib/brainDrop';
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
  const { courses = [], addCourse, updateCourse, reorderCourses } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseColor, setCourseColor] = useState('#758bfa');
  const [courseCover, setCourseCover] = useState<string | undefined>(undefined);
  const [timeStr, setTimeStr] = useState(() => format(new Date(), "HH:mm"));
  const [secStr, setSecStr] = useState(() => format(new Date(), "ss"));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [longPressIndex, setLongPressIndex] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

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

  // ─── Long-press drag & reorder (pointer-based, sin ghost recortado) ───
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number; index: number } | null>(null);
  const draggingRef = useRef(false);
  const longPressActiveRef = useRef(false);
  const overIndexRef = useRef<number | null>(null);
  const ghostSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pressedElRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef(courses);
  const onSelectRef = useRef(onSelectCourse);
  coursesRef.current = courses;
  onSelectRef.current = onSelectCourse;

  const cleanupDrag = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    pressStartRef.current = null;
    pressedElRef.current = null;
    draggingRef.current = false;
    longPressActiveRef.current = false;
    overIndexRef.current = null;
    ghostSizeRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
    setGhost(null);
    setLongPressIndex(null);
    setBrainDragState(false);
    window.removeEventListener('pointermove', handleWindowMove);
    window.removeEventListener('pointerup', handleWindowUp);
    window.removeEventListener('pointercancel', cleanupDrag);
  }, []);

  const handleWindowMove = useCallback((e: PointerEvent) => {
    const start = pressStartRef.current;
    if (!start) return;

    if (draggingRef.current) {
      e.preventDefault();
      setGhost({ x: e.clientX, y: e.clientY });
      // Mientras se arrastra sobre la franja de Charvis, mostramos el overlay en el chat.
      setBrainDragState(isOverBrainZone(e.clientX), 'Suelta para anclar en Charvis');
      const tiles = gridRef.current ? Array.from(gridRef.current.querySelectorAll<HTMLElement>('[data-course-idx]')) : [];
      let target: number | null = null;
      for (const tile of tiles) {
        const r = tile.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          target = Number(tile.dataset.courseIdx);
          break;
        }
      }
      if (target !== null) {
        overIndexRef.current = target;
        setOverIndex(target);
      } else {
        overIndexRef.current = null;
        setOverIndex(null);
      }
      return;
    }

    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (longPressActiveRef.current && dist > 10) {
      draggingRef.current = true;
      setDragIndex(start.index);
      setOverIndex(start.index);
      overIndexRef.current = start.index;
      setGhost({ x: e.clientX, y: e.clientY });
    } else if (dist > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      pressStartRef.current = null;
    }
  }, []);

  const handleWindowUp = useCallback((e: PointerEvent) => {
    const start = pressStartRef.current;
    const wasDragging = draggingRef.current;

    if (wasDragging && start) {
      // Si se suelta sobre la franja derecha (panel de Charvis), se ancla el
      // curso en el chat en lugar de reordenar.
      if (isOverBrainZone(e.clientX)) {
        const course = coursesRef.current[start.index];
        if (course) openBrainWithAnchor({ kind: 'course', id: course.id });
        cleanupDrag();
        return;
      }
      const ids = [...coursesRef.current.map(c => c.id)];
      const [moved] = ids.splice(start.index, 1);
      const target = overIndexRef.current === null ? start.index : Math.min(overIndexRef.current, ids.length);
      ids.splice(target, 0, moved);
      reorderCourses(ids);
    }
    cleanupDrag();

    if (!wasDragging && start && start.index < coursesRef.current.length) {
      onSelectRef.current(coursesRef.current[start.index].id);
    }
  }, [reorderCourses, cleanupDrag]);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pressStartRef.current = { x: e.clientX, y: e.clientY, index };
    pressedElRef.current = e.currentTarget as HTMLElement;
    longPressTimer.current = setTimeout(() => {
      longPressActiveRef.current = true;
      setLongPressIndex(index);
      const el = pressedElRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        ghostSizeRef.current = { width: rect.width, height: rect.height };
      }
    }, LONG_PRESS_MS);
    window.addEventListener('pointermove', handleWindowMove, { passive: false });
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', cleanupDrag);
  }, [handleWindowMove, handleWindowUp, cleanupDrag]);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    window.removeEventListener('pointermove', handleWindowMove);
    window.removeEventListener('pointerup', handleWindowUp);
    window.removeEventListener('pointercancel', cleanupDrag);
  }, [handleWindowMove, handleWindowUp, cleanupDrag]);

  // Display order while dragging: the grid stays put; only on drop we reorder.
  // The dragged card lifts in place and the target slot shows a dashed ring,
  // so nothing overlaps or "mixes" mid-drag.
  const ghostCourse = dragIndex !== null ? courses[dragIndex] : null;

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
          <>
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, paddingBottom: 24, userSelect: draggingRef.current ? 'none' : undefined }}>
            {courses.map((course) => {
              const originalIdx = courses.findIndex(c => c.id === course.id);
              const isDragging = dragIndex === originalIdx;
              const isDropTarget = overIndex === originalIdx && dragIndex !== null && !isDragging;
              return (
              <div key={course.id}
                data-course-idx={originalIdx}
                onPointerDown={(e) => handlePointerDown(e, originalIdx)}
                onContextMenu={(e) => { if (draggingRef.current) e.preventDefault(); }}
                style={{
                  position: 'relative', overflow: 'hidden',
                  borderRadius: 16,
                  border: isDragging
                    ? `2px dashed ${course.color}`
                    : isDropTarget
                      ? `2px dashed var(--accent)`
                      : `1.5px solid ${course.color}35`,
                  background: isDragging
                    ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-elevated))'
                    : isDropTarget
                      ? 'color-mix(in srgb, var(--accent) 9%, var(--bg-elevated))'
                      : course.coverUrl
                        ? `linear-gradient(160deg, ${course.color}06, transparent 50%)`
                        : `linear-gradient(160deg, ${course.color}14, transparent 50%)`,
                  cursor: draggingRef.current ? 'grabbing' : 'pointer',
                  outline: isDragging || isDropTarget ? '2px dashed var(--accent)' : 'none',
                  outlineOffset: isDragging ? 0 : isDropTarget ? 4 : 2,
                  transition: draggingRef.current ? 'border-color 150ms' : `all 500ms ${EASE}`,
                  aspectRatio: '16/10',
                  opacity: isDragging ? 0.45 : isDropTarget ? 0.72 : 1,
                  zIndex: isDragging ? 5 : 1,
                  transform: isDragging ? 'scale(0.96)' : 'none',
                  boxShadow: isDragging
                    ? `0 14px 40px ${course.color}2e, inset 0 0 40px ${course.color}10`
                    : isDropTarget
                      ? `0 0 0 3px color-mix(in srgb, var(--accent) 38%, transparent), inset 0 0 40px ${course.color}08`
                      : `inset 0 0 40px ${course.color}06, 0 0 0 1px ${course.color}10 inset`,
                  touchAction: 'pan-y',
                }}
                onMouseEnter={(e) => {
                  if (draggingRef.current || isDragging || isDropTarget) return;
                  e.currentTarget.style.borderColor = `${course.color}65`;
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.005)';
                  e.currentTarget.style.boxShadow = `0 8px 28px ${course.color}18, inset 0 0 40px ${course.color}08, 0 0 0 1px ${course.color}1a inset`;
                }}
                onMouseLeave={(e) => {
                  if (draggingRef.current || isDragging || isDropTarget) return;
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = `${course.color}35`;
                  e.currentTarget.style.boxShadow = `inset 0 0 40px ${course.color}06, 0 0 0 1px ${course.color}10 inset`;
                }}
              >
                {(!isDragging && !isDropTarget) && (<>
                {/* Full-bleed cover */}
                {course.coverUrl ? (
                  <img src={course.coverUrl} alt="" draggable={false}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: "transform 700ms " + EASE, pointerEvents: 'none' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
                    <GraduationCap size={44} style={{ color: course.color, opacity: 0.08 }} />
                  </div>
                )}

                {/* Dark overlay for cover images */}
                {course.coverUrl && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)',
                    pointerEvents: 'none', zIndex: 1,
                  }} />
                )}

                {/* Course name */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '16px 18px', zIndex: 2, pointerEvents: 'none',
                }}>
                  <span style={{
                    fontSize: 26, fontWeight: 250,
                    color: course.coverUrl ? '#fff' : `var(--text-primary)`,
                    fontFamily: "'Inter Tight', sans-serif",
                    letterSpacing: '-0.03em', lineHeight: 1.15,
                    display: 'block',
                    textShadow: course.coverUrl ? '0 2px 16px rgba(0,0,0,0.6)' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{course.name}</span>
                </div>
                </>)}
              </div>
              );
            })}
          </div>
          {ghostCourse && ghost && ghostSizeRef.current && createPortal(
            <div style={{
              position: 'fixed', left: 0, top: 0, zIndex: 99990, pointerEvents: 'none',
              width: ghostSizeRef.current.width, height: ghostSizeRef.current.height,
              transform: `translate(${ghost.x - ghostSizeRef.current.width / 2}px, ${ghost.y - ghostSizeRef.current.height / 2}px)`,
              borderRadius: 16, overflow: 'hidden',
              border: `1.5px solid ${ghostCourse.color}88`,
              boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${ghostCourse.color}22 inset`,
              opacity: 0.96,
            }}>
              {ghostCourse.coverUrl ? (
                <img src={ghostCourse.coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(160deg, ${ghostCourse.color}18, var(--bg-elevated))` }}>
                  <GraduationCap size={44} style={{ color: ghostCourse.color, opacity: 0.25 }} />
                </div>
              )}
              {ghostCourse.coverUrl && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)', pointerEvents: 'none' }} />
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
                <span style={{ fontSize: 26, fontWeight: 250, color: ghostCourse.coverUrl ? '#fff' : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.03em', lineHeight: 1.15, display: 'block', textShadow: '0 2px 16px rgba(0,0,0,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ghostCourse.name}</span>
              </div>
            </div>,
            document.body
          )}
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddModal(false)}>
          <div className="bento-card" style={{ width: 420, padding: 24, borderRadius: 'var(--radius-lg)', background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-elevated)" }} onClick={e => e.stopPropagation()}>
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

    </div>
  );
}
