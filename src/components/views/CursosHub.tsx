import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, BookOpen, Trash2, Edit3, X, Check, GraduationCap,
  User, FileText, Layers, Image, MoreHorizontal,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
const PRESET_COLORS = [
  '#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#EF4444', '#0EA5E9', '#84CC16', '#D946EF', '#22C55E',
  '#A855F7', '#D946EF', '#0D9488', '#2563EB', '#DC2626',
  '#7C3AED', '#0284C7', '#65A30D', '#DB2777', '#0891B2',
  '#C2410C', '#4F46E5', '#059669', '#BE123C', '#0369A1',
];

interface CursosHubProps {
  onSelectCourse: (courseId: string) => void;
}

export default function CursosHub({ onSelectCourse }: CursosHubProps) {
  const { courses, addCourse, updateCourse, deleteCourse, addNotification } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newTeacher, setNewTeacher] = useState('');
  const [newCredits, setNewCredits] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState('');

  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editTeacher, setEditTeacher] = useState('');
  const [editCredits, setEditCredits] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState('');

  const newFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const resetNewForm = () => {
    setNewName(''); setNewColor(PRESET_COLORS[0]); setNewTeacher('');
    setNewCredits(''); setNewLevel(''); setNewCover(''); setNewDesc('');
    setNewCoverFile(null); setNewCoverPreview('');
  };

  const resetEditForm = () => {
    setEditId(null); setEditCoverFile(null); setEditCoverPreview('');
  };

  const handleCoverFile = (file: File | null, setPreview: (v: string) => void, setName?: (v: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!newName.trim()) { addNotification('El nombre del curso es obligatorio', 'error'); return; }
    addCourse({
      name: newName.trim(),
      color: newColor,
      progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0,
      coverUrl: newCoverPreview || newCover || undefined,
      description: newDesc || undefined,
      level: newLevel || undefined,
      credits: newCredits || undefined,
      teacher: newTeacher || undefined,
    });
    resetNewForm();
    setShowNew(false);
  };

  const startEdit = (course: typeof courses[0]) => {
    setEditId(course.id);
    setEditName(course.name);
    setEditColor(course.color);
    setEditTeacher(course.teacher || '');
    setEditCredits(course.credits || '');
    setEditLevel(course.level || '');
    setEditCover(course.coverUrl || '');
    setEditDesc(course.description || '');
    setEditCoverPreview('');
    setEditCoverFile(null);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editId) return;
    updateCourse(editId, {
      name: editName.trim(),
      color: editColor,
      teacher: editTeacher || undefined,
      credits: editCredits || undefined,
      level: editLevel || undefined,
      coverUrl: editCoverPreview || editCover || undefined,
      description: editDesc || undefined,
    });
    resetEditForm();
  };

  const handleDelete = (id: string) => {
    deleteCourse(id);
    setConfirmDeleteId(null);
    setMenuOpenId(null);
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const secondsStr = currentTime.toLocaleTimeString('es-ES', { second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <div className="page-container" style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 200, color: 'var(--text-primary)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Inter Tight', sans-serif" }}>
            <Layers size={22} style={{ color: 'var(--accent)' }} />
            Mis Cursos
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 400, letterSpacing: '0.02em' }}>
            {courses.length} curso{courses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => { resetNewForm(); setShowNew(true); }}
            style={{ height: 38, padding: '0 22px', fontSize: 12, fontWeight: 500, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', transition: 'all 200ms' }}>
            <Plus size={14} /> Nuevo Curso
          </button>
          <NotificationBell />
          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 28, fontWeight: 300, lineHeight: 1, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>{timeStr}</span>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 300, color: 'var(--text-tertiary)', opacity: 0.5 }}>{secondsStr}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </div>

      {courses.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.3 }} />
          <h3 style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 8 }}>Aún no tienes cursos</h3>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 360, lineHeight: 1.6, fontWeight: 300 }}>Crea tu primer curso para empezar a organizar tus tareas, apuntes y horarios de estudio.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {courses.map(course => {
          const progressPct = course.totalTasks > 0 ? Math.round((course.completedTasks / course.totalTasks) * 100) : 0;
          return (
          <div key={course.id} className="bento-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'all 350ms cubic-bezier(0.16,1,0.3,1)', position: 'relative', background: 'var(--bg-elevated)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; setMenuOpenId(null); }}
          >
            {/* Banner */}
            <div style={{ height: 110, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}88 60%, ${course.color}33 100%)` }}
              onClick={() => onSelectCourse(course.id)}>
              {course.coverUrl ? (
                <img src={course.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GraduationCap size={36} style={{ color: 'rgba(255,255,255,0.12)' }} />
                </div>
              )}
              {/* Overlay gradient */}
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, var(--bg-elevated) 0%, transparent 60%)` }} />
              {/* Course name on banner */}
              <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14, zIndex: 2 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 1px 8px rgba(0,0,0,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</h3>
              </div>
            </div>

            {/* Three-dots menu */}
            <div style={{ position: 'absolute', top: 116, right: 12, zIndex: 10 }}>
              <button onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === course.id ? null : course.id); }}
                style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', transition: 'all 150ms' }}>
                <MoreHorizontal size={14} />
              </button>
              {menuOpenId === course.id && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 140, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: 4, zIndex: 20, backdropFilter: 'blur(16px)' }}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => { startEdit(course); setMenuOpenId(null); }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', transition: 'all 150ms' }}
                    className="hover:bg-white/[0.04] hover:text-white">
                    <Edit3 size={12} /> Editar
                  </button>
                  <button onClick={() => { setConfirmDeleteId(course.id); setMenuOpenId(null); }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', transition: 'all 150ms' }}
                    className="hover:bg-red-500/10">
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '14px 16px 16px' }} onClick={() => onSelectCourse(course.id)}>
              {/* Metadata badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {course.teacher && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '3px 8px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.01em' }}>
                    <User size={9} /> {course.teacher}
                  </span>
                )}
                {course.credits && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '3px 8px', borderRadius: 5, letterSpacing: '0.01em' }}>
                    <span style={{ opacity: 0.5 }}>{course.credits}</span> créditos
                  </span>
                )}
                {course.level && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '3px 8px', borderRadius: 5, letterSpacing: '0.01em' }}>
                    {course.level}
                  </span>
                )}
              </div>

              {course.description && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 10, fontWeight: 300, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.description}
                </p>
              )}

              {/* Compact progress dot */}
              {course.totalTasks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: course.color, borderRadius: 2, transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)' }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{progressPct}%</span>
                </div>
              )}

              {/* Bottom accent line */}
              <div style={{ marginTop: course.description || course.totalTasks > 0 ? 12 : 12, height: 1.5, width: '100%', background: `linear-gradient(90deg, ${course.color}44, transparent)`, borderRadius: 1 }} />
            </div>
          </div>
          );
        })}
      </div>

      {/* New Course Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => { resetNewForm(); setShowNew(false); }}>
          <div className="bento-card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 32, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={16} style={{ color: 'var(--accent)' }} /> Nuevo Curso
              </h3>
              <button onClick={() => { resetNewForm(); setShowNew(false); }} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} placeholder="Ej: Cálculo Diferencial" />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Color</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', boxShadow: newColor === c ? `0 0 10px ${c}` : 'none', transition: 'all 150ms' }}
                    />
                  ))}
                  <label style={{ width: 28, height: 28, borderRadius: '50%', background: newColor, border: '2px dashed var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: newColor === PRESET_COLORS[0] ? '#fff' : undefined, transition: 'all 150ms', position: 'relative', overflow: 'hidden' }}>
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Docente</label>
                  <input value={newTeacher} onChange={e => setNewTeacher(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} placeholder="Nombre del profesor" />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Créditos</label>
                  <input value={newCredits} onChange={e => setNewCredits(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} placeholder="Ej: 4" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nivel</label>
                  <input value={newLevel} onChange={e => setNewLevel(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} placeholder="Ej: Avanzado" />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Portada</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={newCover} onChange={e => setNewCover(e.target.value)} className="input-base" style={{ flex: 1, height: 38, fontSize: 12 }} placeholder="https://..." />
                    <button onClick={() => newFileRef.current?.click()} style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Image size={14} />
                    </button>
                  </div>
                  <input type="file" ref={newFileRef} accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setNewCoverFile(f); handleCoverFile(f, setNewCoverPreview); } }} />
                  {newCoverPreview && (
                    <div style={{ marginTop: 6, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                      <img src={newCoverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Descripción</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 60, fontSize: 12, resize: 'vertical', padding: '8px 10px' }} placeholder="Breve Descripción del curso..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => { resetNewForm(); setShowNew(false); }} className="btn-secondary" style={{ height: 36, padding: '0 16px', fontSize: 12 }}>Cancelar</button>
              <button onClick={handleCreate} className="btn-primary" style={{ height: 36, padding: '0 20px', fontSize: 12 }}>
                <Plus size={14} /> Crear Curso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {editId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => resetEditForm()}>
          <div className="bento-card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 32, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Edit3 size={16} style={{ color: 'var(--accent)' }} /> Editar Curso
              </h3>
              <button onClick={() => resetEditForm()} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Color</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setEditColor(c)}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: editColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', boxShadow: editColor === c ? `0 0 10px ${c}` : 'none', transition: 'all 150ms' }}
                    />
                  ))}
                  <label style={{ width: 28, height: 28, borderRadius: '50%', background: editColor, border: '2px dashed var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, transition: 'all 150ms', position: 'relative', overflow: 'hidden' }}>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Docente</label>
                  <input value={editTeacher} onChange={e => setEditTeacher(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Créditos</label>
                  <input value={editCredits} onChange={e => setEditCredits(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nivel</label>
                  <input value={editLevel} onChange={e => setEditLevel(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Portada</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={editCover} onChange={e => setEditCover(e.target.value)} className="input-base" style={{ flex: 1, height: 38, fontSize: 12 }} placeholder="https://..." />
                    <button onClick={() => editFileRef.current?.click()} style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Image size={14} />
                    </button>
                  </div>
                  <input type="file" ref={editFileRef} accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setEditCoverFile(f); handleCoverFile(f, setEditCoverPreview); } }} />
                  {(editCoverPreview || editCover) && (
                    <div style={{ marginTop: 6, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                      <img src={editCoverPreview || editCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Descripción</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 60, fontSize: 12, resize: 'vertical', padding: '8px 10px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => resetEditForm()} className="btn-secondary" style={{ height: 36, padding: '0 16px', fontSize: 12 }}>Cancelar</button>
              <button onClick={handleSaveEdit} className="btn-primary" style={{ height: 36, padding: '0 20px', fontSize: 12 }}>
                <Check size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setConfirmDeleteId(null)}>
          <div className="bento-card" style={{ width: 320, padding: 28, textAlign: 'center', border: '1px solid rgba(239,68,68,0.25)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trash2 size={18} style={{ color: '#ef4444' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 6 }}>¿Eliminar curso?</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.5, fontWeight: 300 }}>
              Esta acción eliminará el curso y se perderán las tareas y notas asociadas.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary" style={{ height: 36, padding: '0 16px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDeleteId)} style={{ height: 36, padding: '0 20px', fontSize: 12, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

