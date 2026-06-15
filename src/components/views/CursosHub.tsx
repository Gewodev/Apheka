import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap, Book, PlusCircle, Upload, Download, Trash2,
  X, Image as ImageIcon, Sparkles, FolderUp, MoreHorizontal
} from 'lucide-react';
import { useApp, Course } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
import toast from 'react-hot-toast';

interface CursosHubProps {
  onSelectCourse: (courseId: string) => void;
}

export default function CursosHub({ onSelectCourse }: CursosHubProps) {
  const { courses = [], addCourse, updateCourse, deleteCourse, addNotification } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseCover, setCourseCover] = useState<string | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // File loading helper
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

  // Create course
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
      sortOrder: courses.length,
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

  // Delete course
  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteCourse(pendingDeleteId);
    setPendingDeleteId(null);
    toast.success('Asignatura eliminada');
  };

  // Export JSON
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

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          // Add all imported courses
          importedData.forEach(course => {
            // Check for duplicate names
            if (!courses.some(c => c.name.toLowerCase() === course.name.toLowerCase())) {
              addCourse({
                name: course.name,
                color: course.color || '#758bfa',
                progress: course.progress || 0,
                totalTasks: course.totalTasks || 0,
                completedTasks: course.completedTasks || 0,
                hoursStudied: course.hoursStudied || 0,
                sortOrder: course.sortOrder ?? courses.length,
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
    <div className="page-container" style={{ height: '100%', overflowY: 'auto', padding: '28px 32px', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 300, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.03em' }}>
            <GraduationCap size={28} className="aether-text-primary" />
            Mis Asignaturas
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 400 }}>
            {courses.length} asignatura{courses.length !== 1 ? 's' : ''} en tu biblioteca
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => importInputRef.current?.click()} className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid var(--aether-border-glass)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 200ms' }}>
            <Upload size={14} /> Importar
          </button>
          <button onClick={handleExport} className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid var(--aether-border-glass)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 200ms' }}>
            <Download size={14} /> Exportar
          </button>
          <button onClick={() => setShowAddModal(true)} className="aether-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 20px', fontSize: 12, border: 'none', cursor: 'pointer' }}>
            <PlusCircle size={15} /> Añadir
          </button>
          <NotificationBell />
        </div>
      </div>

      <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImport} />

      {/* Subject list */}
      {courses.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', textAlign: 'center' }}>
          <GraduationCap size={64} style={{ color: 'var(--text-muted)', marginBottom: 20, opacity: 0.3 }} />
          <h3 style={{ fontSize: 18, fontWeight: 400, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 8 }}>Aún no tienes asignaturas</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 380, lineHeight: 1.6, fontWeight: 300 }}>
            Agrega tu primera asignatura para empezar a estructurar tus temas, agrupaciones y recursos de estudio.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24, paddingBottom: 40 }}>
          {courses.map(course => {
            const studyTopics = course.studyTopics || [];
            const doneTopics = studyTopics.filter(t => t.status === 'done').length;
            const totalTopics = studyTopics.length;
            const progressPercent = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;

            return (
              <div
                key={course.id}
                className="aether-glass-card group"
                style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', position: 'relative', height: 240 }}
                onClick={() => onSelectCourse(course.id)}
              >
                {/* Header card with name and delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--aether-border-glass)', zIndex: 10 }}>
                  <h3 className="truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', maxWidth: '80%', fontFamily: "'Inter Tight', sans-serif" }}>
                    {course.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(course.id);
                    }}
                    className="btn-ghost text-red-500 hover-opacity"
                    style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'all 200ms', background: 'transparent', border: 'none', cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Banner / Cover area */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${course.color}22 0%, ${course.color}05 100%)` }}>
                  {course.coverUrl ? (
                    <img
                      src={course.coverUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 500ms' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Book size={40} style={{ color: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,12,0.9) 0%, transparent 100%)' }} />
                </div>

                {/* Footer progress bar */}
                <div style={{ padding: 16, background: 'rgba(10,10,12,0.85)', borderTop: '1px solid var(--aether-border-glass)', zIndex: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Retención y Maestría
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--aether-primary)' }}>
                      {doneTopics} / {totalTopics} temas ({progressPercent}%)
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progressPercent}%`, height: '100%',
                        background: 'var(--aether-primary)', borderRadius: 2,
                        transition: 'width 500ms cubic-bezier(0.16,1,0.3,1)',
                        boxShadow: '0 0 8px rgba(117, 139, 250, 0.4)'
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAddModal(false)}>
          <div className="aether-glass-card" style={{ width: 440, padding: 28, background: 'var(--bg-surface)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={18} className="aether-text-primary" /> Nueva Asignatura
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-ghost" style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Nombre de Asignatura</label>
                <input
                  type="text"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="input-base"
                  style={{ width: '100%', height: 38, fontSize: 13, padding: '0 12px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
                  placeholder="Ej: Cálculo de Variaciones, Biología Celular..."
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Banner (Imagen Opcional)</label>
                {courseCover ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16/7', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--aether-border-glass)' }}>
                    <img src={courseCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => setCourseCover(undefined)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', height: 90, borderRadius: 10, border: '2px dashed var(--aether-border-glass)',
                      background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <ImageIcon size={18} className="aether-text-primary" />
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subir Banner</span>
                  </button>
                )}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
              </div>

              <button
                onClick={handleCreate}
                className="aether-btn-primary"
                disabled={!courseName.trim()}
                style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer', marginTop: 8 }}
              >
                Crear Asignatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setPendingDeleteId(null)}>
          <div className="aether-glass-card" style={{ width: 400, padding: 24, background: 'var(--bg-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>¿Eliminar asignatura?</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Esto eliminará permanentemente la asignatura junto con todas sus agrupaciones temáticas, temas independientes y materiales del repositorio. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setPendingDeleteId(null)} className="btn-ghost"
                style={{ height: 34, padding: '0 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleConfirmDelete}
                style={{ height: 34, padding: '0 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff', fontWeight: 600 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
