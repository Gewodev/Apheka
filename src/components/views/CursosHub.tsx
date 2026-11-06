import type {BannerCrop} from '../../lib/bannerCrop';
import {useTaskPresentationSlice} from "../../store/AppContext";
import {courseStudySeconds} from '../../lib/courseStudy';
import BannerField from '../ui/BannerField';
import WorkspaceHeader from '../ui/WorkspaceHeader';
import {beginBrainDrag,finishBrainDrag,cancelBrainDrag} from '../../lib/brainDrop';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap, PlusCircle, Upload, Download,
  X, Image as ImageIcon, Pencil,
} from 'lucide-react';
import { DndContext, closestCorners, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp, Course } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
import ImageEditorModal from '../ui/ImageEditorModal';
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
  const { courses = [], tasks, studySessions, addCourse, updateCourse, reorderCourses } = useTaskPresentationSlice(["courses","tasks","studySessions","addCourse","updateCourse","reorderCourses"]);
  const studyTotals=useMemo(()=>courseStudySeconds(courses,tasks,studySessions),[courses,tasks,studySessions]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseColor, setCourseColor] = useState('#758bfa');
  const [courseCover, setCourseCover] = useState<string | undefined>(undefined);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [courseOriginal,setCourseOriginal]=useState<string|undefined>();
  const [courseCrop,setCourseCrop]=useState<BannerCrop|undefined>();
  const [timeStr, setTimeStr] = useState(() => format(new Date(), "HH:mm"));
  const [secStr, setSecStr] = useState(() => format(new Date(), "ss"));
  const [dragActive, setDragActive] = useState(false);

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
    reader.onload = (event) => { setEditorSrc(event.target?.result as string); };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleEditorConfirm = (dataUrl: string,crop:BannerCrop) => {
    setCourseOriginal(previous=>previous||editorSrc||undefined);setCourseCrop(crop);
    setCourseCover(dataUrl);
    setEditorSrc(null);
    toast.success('Imagen aplicada');
  };

  const handleCreate = () => {
    const name = courseName.trim();
    if (!name) { toast.error('El nombre es obligatorio'); return; }
    if (courses.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast.error('Ya existe'); return; }
    addCourse({ name, color: courseColor, progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0, coverImage: courseCover, coverUrl: courseCover,coverOriginal:courseOriginal,coverCrop:courseCrop, groups: [], studyTopics: [] });
    setCourseName(''); setCourseColor('#758bfa'); setCourseCover(undefined);setCourseOriginal(undefined);setCourseCrop(undefined); setEditorSrc(null); setShowAddModal(false);
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

  // ─── Drag & drop DINÁMICO con @dnd-kit/sortable (long-press 300ms) ───
  // La cuadrícula se desplaza EN VIVO durante el arrastre: los vecinos se
  // apartan (rectSortingStrategy) y al soltar se persiste el nuevo orden.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }));
  const hubDragRef = useRef(false);
  const coursesRef = useRef(courses);
  const onSelectRef = useRef(onSelectCourse);
  coursesRef.current = courses;
  onSelectRef.current = onSelectCourse;

  const handleHubDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if(finishBrainDrag()){setDragActive(false);setTimeout(()=>{hubDragRef.current=false;},80);return;}
    setDragActive(false);
    setTimeout(() => { hubDragRef.current = false; }, 80);
    if (!over) return;
    const ids = coursesRef.current.map(c => c.id);
    const fromIdx = ids.indexOf(String(active.id));
    const toIdx = ids.indexOf(String(over.id));
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    reorderCourses(arrayMove(ids, fromIdx, toIdx));
  }, [reorderCourses]);

  const startDrag = useCallback(() => {
    hubDragRef.current = true;
    setDragActive(true);
  }, []);

  const endDrag = useCallback(() => {
    setDragActive(false);
    setTimeout(() => { hubDragRef.current = false; }, 80);
  }, []);

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
              addCourse({ name: c.name, color: c.color || '#758bfa', progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0, coverImage: c.coverImage || c.coverUrl, coverUrl: c.coverImage || c.coverUrl,coverOriginal:c.coverOriginal,coverCrop:c.coverCrop, groups: c.groups || [], studyTopics: c.studyTopics || [] });
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
      <WorkspaceHeader title="Cursos" description={`${courses.length} ${courses.length === 1 ? 'asignatura' : 'asignaturas'} para organizar lo que aprendes.`} />
      <div className="workspace-toolbar">
        <span className="workspace-toolbar-label">Biblioteca de cursos</span>
        <div className="workspace-actions">
          <button data-ui-control="" className="btn-secondary" onClick={() => importInputRef.current?.click()}><Upload size={15} /> Importar</button>
          <button data-ui-control="" className="btn-secondary" onClick={handleExport}><Download size={15} /> Exportar</button>
          <button data-ui-control="" className="btn-primary" onClick={() => setShowAddModal(true)}><PlusCircle size={16} /> Añadir curso</button>
        </div>
      </div>

      <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImport} />

      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "auto", paddingRight: 4, paddingTop: 4 }}>
        {courses.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', textAlign: 'center' }}>
            <GraduationCap size={60} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.3 }} />
            <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 8 }}>Aún no tienes cursos</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 380, lineHeight: 1.6 }}>Agrega tu primer curso para empezar a organizar tus temas, tareas y recursos de estudio.</p>
          </div>
        ) : (
          <>
          <DndContext sensors={sensors} collisionDetection={closestCorners}
            onDragStart={event=>{startDrag();beginBrainDrag('courses',String(event.active.id));}}
            onDragEnd={handleHubDragEnd}
            onDragCancel={()=>{cancelBrainDrag();endDrag();}}
          >
            <SortableContext items={courses.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="course-workspace-grid" style={{ userSelect: dragActive ? 'none' : undefined }}>
                {courses.map((course) => (
                  <CourseTile key={course.id} course={course} activeTasks={tasks.filter(t=>t.course===course.name&&t.status!=="completado").length} studyHours={(studyTotals[course.id]||0)/3600} onSelect={onSelectRef.current} dragGuard={() => hubDragRef.current} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddModal(false)}>
          <div className="bento-card workspace-dialog course-create-dialog" role="dialog" aria-modal="true" aria-label="Nueva asignatura" style={{ width: 480, padding: '26px 28px', borderRadius: 16, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-elevated)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'Inter Tight', sans-serif", margin: 0, letterSpacing: '0.01em' }}>
                  <GraduationCap size={16} style={{ color: "var(--accent)" }} /> Nueva Asignatura
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>Crea una asignatura para organizar tus cursos</p>
              </div>
              <button data-ui-control="" onClick={() => setShowAddModal(false)} title="Cerrar"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6, transition: 'all 150ms ' + EASE }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', display: 'block', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                <input aria-label="Nombre de la asignatura" value={courseName} onChange={e => setCourseName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  style={{ width: '100%', height: 42, fontSize: 13, fontWeight: 500, padding: '0 13px', borderRadius: 10, boxSizing: 'border-box', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif", transition: 'border-color 180ms ' + EASE }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  placeholder="Ej: Cálculo, Biología..." autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', display: 'block', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['#E11D48','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6','#D946EF','#0EA5E9','#22C55E','#EAB308','#A855F7','#758bfa','#6B7280'].map(c => {
                    const sel = courseColor === c;
                    return (
                      <button data-ui-control="" key={c} onClick={() => setCourseColor(c)} title={c}
                        style={{ width: 26, height: 26, borderRadius: '50%', border: sel ? '2px solid var(--bg-elevated)' : '2px solid transparent', background: c, cursor: 'pointer', outline: sel ? `2px solid ${c}` : 'none', outlineOffset: 2, boxShadow: sel ? `0 0 12px ${c}55` : 'none', transition: 'all 180ms ' + EASE, padding: 0 }} />
                    );
                  })}
                </div>
              </div>
              <BannerField value={courseCover} onChange={value=>{setCourseCover(value);setCourseOriginal(value);setCourseCrop(undefined);}} onEdit={value=>setEditorSrc(courseOriginal||value)}/>
              <button data-ui-control="" onClick={handleCreate} disabled={!courseName.trim()}
                style={{ width: '100%', height: 42, border: 'none', borderRadius: 10, cursor: 'pointer', marginTop: 2, background: courseName.trim() ? "var(--accent)" : "var(--bg-hover)", color: courseName.trim() ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.03em', transition: "all 200ms " + EASE, boxShadow: courseName.trim() ? "0 6px 20px color-mix(in srgb, var(--accent) 28%, transparent)" : 'none' }}
                onMouseEnter={e => { if (courseName.trim()) { e.currentTarget.style.filter = 'brightness(1.07)'; } }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
                Crear Asignatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor de imagen del banner (se abre al subir o al pulsar el lápiz) */}
      {editorSrc && (
        <ImageEditorModal src={editorSrc} initialCrop={courseCrop} title="Banner de la asignatura"
          onConfirm={handleEditorConfirm} onCancel={() => setEditorSrc(null)} />
      )}

    </div>
  );
}

// ─── Tarjeta de curso SORTABLE: sigue al cursor y los vecinos se apartan ───
function CourseTile({ course, activeTasks, studyHours, onSelect, dragGuard }: {
  course: Course;
  activeTasks: number;
  studyHours: number;
  onSelect: (id: string) => void;
  dragGuard: () => boolean;
}) {
  const cover=course.coverUrl||course.coverImage;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  return (
    <div className="course-workspace-tile"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button" tabIndex={0} aria-label={`Abrir curso ${course.name}`}
      onKeyDown={e=>{if(e.key==='Enter')onSelect(course.id);}}
      onClick={() => { if (dragGuard()) return; onSelect(course.id); }}
      onContextMenu={(e) => { if (isDragging) e.preventDefault(); }}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 10,
        border: isDragging ? `2px dashed ${course.color}` : `1.5px solid ${course.color}35`,
        background: isDragging
          ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-elevated))'
          : cover
            ? 'var(--bg-surface)'
            : 'var(--bg-surface)',
        cursor: isDragging ? 'grabbing' : 'pointer',
        outline: isDragging ? '2px dashed var(--accent)' : 'none',
        outlineOffset: isDragging ? 0 : 2,
        transition: isDragging ? 'none' : [transition, 'border-color 160ms ease-out'].filter(Boolean).join(', '),
        aspectRatio: '16/10',
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 5 : 1,
        transform: transform ? CSS.Transform.toString(transform) : 'none',
        boxShadow: isDragging
          ? `0 14px 40px ${course.color}2e, inset 0 0 40px ${course.color}10`
          : `inset 0 0 40px ${course.color}06, 0 0 0 1px ${course.color}10 inset`,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Full-bleed cover */}
      {cover ? (
        <img src={cover} alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: "transform 700ms " + EASE, pointerEvents: 'none' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <span className="course-monogram" style={{ color:course.color }}>{course.name.split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase()}</span>
        </div>
      )}

      {/* Dark overlay for cover images */}
      {cover && (
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
          fontSize: 24, fontWeight: 500,
          color: cover ? '#fff' : `var(--text-primary)`,
          fontFamily: "'Inter Tight', sans-serif",
          letterSpacing: '-0.03em', lineHeight: 1.15,
          display: 'block',
          textShadow: cover ? '0 2px 16px rgba(0,0,0,0.6)' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{course.name}</span>
        <div className="course-tile-summary" style={{color:cover?'#ececf0':'var(--text-secondary)'}}>
          <span>{activeTasks} tareas activas</span>
          <span>{Math.round(studyHours*10)/10} h de estudio</span>
        </div>
      </div>
    </div>
  );
}
