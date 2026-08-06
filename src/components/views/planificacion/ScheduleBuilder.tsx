import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Edit3, Check, Trash2, Plus, CalendarRange } from 'lucide-react';
import { get, set } from 'idb-keyval';

export interface ScheduleImageItem {
  id: string;
  title: string;
  dataUrl: string;
}

export interface ScheduleClass {
  id: string;
  title: string;
  courseId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  teacher?: string;
  color: string;
  type?: 'class' | 'break' | 'meal';
}

interface ScheduleBuilderProps {
  scheduleImageUrl: string | null;
  onSetScheduleImage: (url: string | null) => void;
  imgInputRef: React.RefObject<HTMLInputElement | null>;
  classes: ScheduleClass[];
  onAddClass: (cls: Omit<ScheduleClass, 'id'>) => void;
  onUpdateClass: (id: string, patch: Partial<ScheduleClass>) => void;
  onDeleteClass: (id: string) => void;
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CLASS_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4'];
const TYPE_LABELS: Record<string, string> = { class: 'Clase', break: 'Descanso', meal: 'Comida' };

const DAY_CELLS = [
  { day: 0, start: '07:00', end: '08:00' },
  { day: 0, start: '08:00', end: '09:00' },
  { day: 0, start: '09:00', end: '10:00' },
  { day: 0, start: '10:00', end: '11:00' },
  { day: 0, start: '11:00', end: '12:00' },
  { day: 0, start: '12:00', end: '13:00' },
  { day: 0, start: '13:00', end: '14:00' },
  { day: 0, start: '14:00', end: '15:00' },
  { day: 0, start: '15:00', end: '16:00' },
  { day: 0, start: '16:00', end: '17:00' },
  { day: 0, start: '17:00', end: '18:00' },
  { day: 0, start: '18:00', end: '19:00' },
];

export default function ScheduleBuilder({
  scheduleImageUrl,
  onSetScheduleImage,
  imgInputRef,
  classes,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}: ScheduleBuilderProps) {
  const [tab, setTab] = useState<'bloques' | 'imagen'>('bloques');
  const [scheduleImages, setScheduleImages] = useState<ScheduleImageItem[]>(() => {
    try {
      const saved = localStorage.getItem('owa_sched_images_v3');
      if (saved) {
        const parsed: ScheduleImageItem[] = JSON.parse(saved);
        setTimeout(() => {
          set('owa_sched_images_v3', parsed).catch(() => {});
          localStorage.removeItem('owa_sched_images_v3');
        }, 0);
        return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (scheduleImages.length > 0) return;
    (async () => {
      try {
        const saved = await get<ScheduleImageItem[]>('owa_sched_images_v3');
        if (saved && saved.length > 0) setScheduleImages(saved);
      } catch {}
    })();
  }, []);

  const [activeImageIdx, setActiveImageIdx] = useState(() => {
    try { return Number(localStorage.getItem('owa_sched_active_image_idx') || '0'); }
    catch { return 0; }
  });

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  useEffect(() => {
    const img = scheduleImages[activeImageIdx];
    const url = img ? img.dataUrl : null;
    if (url !== scheduleImageUrl) {
      onSetScheduleImage(url);
    }
    localStorage.setItem('owa_sched_active_image_idx', String(activeImageIdx));
  }, [scheduleImages, activeImageIdx]);

  useEffect(() => {
    set('owa_sched_images_v3', scheduleImages).catch(() => {});
  }, [scheduleImages]);

  const [imgScale, setImgScale] = useState(1);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // ── CRUD de bloques ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ dayOfWeek: 0, startTime: '07:00', endTime: '08:00', title: '', room: '', type: 'class' as ScheduleClass['type'], color: CLASS_COLORS[5] });

  const sorted = [...classes].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  const startAdding = () => {
    setDraft({ dayOfWeek: 0, startTime: '07:00', endTime: '08:00', title: '', room: '', type: 'class', color: CLASS_COLORS[5] });
    setIsAdding(true);
    setEditingId(null);
    setConfirmDeleteId(null);
  };

  const startEdit = (c: ScheduleClass) => {
    setDraft({ dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime, title: c.title, room: c.room || '', type: c.type || 'class', color: c.color });
    setEditingId(c.id);
    setIsAdding(false);
    setConfirmDeleteId(null);
  };

  const saveEdit = () => {
    if (!draft.title.trim()) return;
    if (isAdding) {
      onAddClass({ ...draft, title: draft.title.trim() });
      setIsAdding(false);
    } else if (editingId) {
      onUpdateClass(editingId, { ...draft, title: draft.title.trim() });
      setEditingId(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 8,
    padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6,
    borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)',
    fontSize: 12, minWidth: 0,
  };

  return (
    <div className="bento-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, border: '1px solid var(--border-default)' }}>
      {/* Header with tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif" }}>Horario</span>
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
            <button onClick={() => setTab('bloques')}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: tab === 'bloques' ? 'var(--accent)' : 'transparent', color: tab === 'bloques' ? '#fff' : 'var(--text-secondary)', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarRange size={12} /> Bloques
            </button>
            <button onClick={() => setTab('imagen')}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: tab === 'imagen' ? 'var(--accent)' : 'transparent', color: tab === 'imagen' ? '#fff' : 'var(--text-secondary)', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ImageIcon size={12} /> Imagen
            </button>
          </div>
        </div>
        {tab === 'bloques' && (
          <button onClick={startAdding}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: "'Outfit',sans-serif", border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 15px var(--accent-dim)', transition: 'all 200ms' }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
            <Plus size={14} /> Añadir bloque
          </button>
        )}
        {tab === 'imagen' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {scheduleImages.length > 0 && (
              <>
                <button onClick={() => setActiveImageIdx(i => Math.max(0, i - 1))} disabled={activeImageIdx === 0} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10, opacity: activeImageIdx === 0 ? 0.3 : 1 }}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace", minWidth: 40, textAlign: 'center' }}>
                  {activeImageIdx + 1}/{scheduleImages.length}
                </span>
                <button onClick={() => setActiveImageIdx(i => Math.min(scheduleImages.length - 1, i + 1))} disabled={activeImageIdx >= scheduleImages.length - 1} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10, opacity: activeImageIdx >= scheduleImages.length - 1 ? 0.3 : 1 }}>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => setImgScale(s => Math.min(s + 0.2, 4))} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10 }}><ZoomIn size={16}/></button>
                <button onClick={() => setImgScale(s => Math.max(1, s - 0.2))} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10 }}><ZoomOut size={16}/></button>
              </>
            )}
            <button onClick={() => { const d = document.createElement('input'); d.type = 'file'; d.accept = 'image/*'; d.onchange = () => { const f = d.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => { const dataUrl = r.result as string; setScheduleImages(prev => { const dup = prev.findIndex(img => img.dataUrl === dataUrl); if (dup >= 0) { setActiveImageIdx(dup); return prev; } setActiveImageIdx(prev.length); return [...prev, { id: crypto.randomUUID(), title: f.name.replace(/\.[^.]+$/, ''), dataUrl }]; }); }; r.readAsDataURL(f); } }; d.click(); }} className="btn-secondary" style={{ fontSize: 13, height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10 }}>
              <ImageIcon size={16} /> {scheduleImages.length > 0 ? 'Añadir' : 'Subir'}
            </button>
            {scheduleImages.length > 0 && (
              <button onClick={() => { if (confirm('¿Eliminar esta imagen del horario?')) { const updated = scheduleImages.filter((_, i) => i !== activeImageIdx); setScheduleImages(updated); if (activeImageIdx >= updated.length && updated.length > 0) setActiveImageIdx(updated.length - 1); } }} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10, color: 'var(--accent)' }}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {tab === 'bloques' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ borderRadius: 12, border: '1px solid var(--border-soft)', overflow: 'hidden', background: 'color-mix(in srgb, var(--bg-elevated) 50%, transparent)' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '110px 92px 92px minmax(0,1fr) 110px 96px 66px 96px', background: 'color-mix(in srgb, var(--bg-elevated) 70%, transparent)', borderBottom: '2px solid var(--border-soft)', position: 'sticky', top: 0, zIndex: 2 }}>
              {['Día', 'Inicio', 'Fin', 'Bloque', 'Aula', 'Tipo', 'Color', 'Acciones'].map(h => (
                <div key={h} style={{ padding: '10px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: '1px solid var(--border-soft)', textAlign: 'left' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map(c => {
              const isEditing = editingId === c.id;
              const isConfirming = confirmDeleteId === c.id;
              if (isEditing || isConfirming) {
                return (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '110px 92px 92px minmax(0,1fr) 110px 96px 66px 96px', background: 'rgba(139,92,246,0.04)' }}>
                    <div style={{ ...cellStyle }}>
                      <select value={draft.dayOfWeek} onChange={e => setDraft(d => ({ ...d, dayOfWeek: Number(e.target.value) }))} style={inputStyle}>
                        {DAY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                      </select>
                    </div>
                    <div style={{ ...cellStyle }}>
                      <input type="time" value={draft.startTime} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} />
                    </div>
                    <div style={{ ...cellStyle }}>
                      <input type="time" value={draft.endTime} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} />
                    </div>
                    <div style={{ ...cellStyle }}>
                      <input type="text" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Nombre del bloque" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingId(null); setIsAdding(false); setConfirmDeleteId(null); } }}
                        style={inputStyle} />
                    </div>
                    <div style={{ ...cellStyle }}>
                      <input type="text" value={draft.room || ''} onChange={e => setDraft(d => ({ ...d, room: e.target.value }))} placeholder="Aula" style={inputStyle} />
                    </div>
                    <div style={{ ...cellStyle }}>
                      <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as ScheduleClass['type'] }))} style={inputStyle}>
                        <option value="class">Clase</option>
                        <option value="break">Descanso</option>
                        <option value="meal">Comida</option>
                      </select>
                    </div>
                    <div style={{ ...cellStyle, position: 'relative' }}>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {CLASS_COLORS.map(col => (
                          <div key={col} onClick={() => setDraft(d => ({ ...d, color: col }))}
                            style={{ width: 12, height: 12, borderRadius: 3, background: col, cursor: 'pointer', boxShadow: draft.color === col ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${col}` : 'none' }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ ...cellStyle, borderRight: 'none', gap: 4 }}>
                      <button onClick={saveEdit} title="Guardar" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10B981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Check size={14} /></button>
                      <button onClick={() => { setEditingId(null); setIsAdding(false); setConfirmDeleteId(null); }} title="Cancelar" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '110px 92px 92px minmax(0,1fr) 110px 96px 66px 96px', transition: 'background 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{DAY_NAMES[c.dayOfWeek]}</div>
                  <div style={{ ...cellStyle, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-secondary)' }}>{c.startTime}</div>
                  <div style={{ ...cellStyle, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-secondary)' }}>{c.endTime}</div>
                  <div style={{ ...cellStyle, overflow: 'hidden' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0, boxShadow: `0 0 6px ${c.color}88` }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                  </div>
                  <div style={{ ...cellStyle, color: 'var(--text-muted)', fontSize: 11 }}>{c.room || '—'}</div>
                  <div style={{ ...cellStyle }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${c.color}14`, color: c.type === 'break' ? 'var(--text-muted)' : c.type === 'meal' ? '#F59E0B' : c.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {TYPE_LABELS[c.type || 'class']}
                    </span>
                  </div>
                  <div style={{ ...cellStyle }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c.color, boxShadow: `0 0 8px ${c.color}66` }} />
                  </div>
                  <div style={{ ...cellStyle, borderRight: 'none', gap: 4 }}>
                    <button onClick={() => startEdit(c)} title="Editar" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => { setConfirmDeleteId(c.id); setEditingId(null); setIsAdding(false); }} title="Eliminar" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Inline confirm-delete row */}
            {confirmDeleteId && (() => {
              const c = classes.find(x => x.id === confirmDeleteId);
              if (!c) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(225,29,72,0.06)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-primary)' }}>
                  <Trash2 size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ¿Eliminar <b style={{ fontWeight: 700 }}>{c.title}</b> del horario?
                  </span>
                  <button onClick={() => { onDeleteClass(c.id); setConfirmDeleteId(null); }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Sí, eliminar</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancelar</button>
                </div>
              );
            })()}

            {/* Empty state */}
            {classes.length === 0 && !isAdding && !confirmDeleteId && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '44px 0' }}>
                <CalendarRange size={36} style={{ color: 'var(--text-muted)', opacity: 0.3, strokeWidth: 1 }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)' }}>Sin bloques todavía</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Añade tus clases, descansos y comidas para verlas en el planificador.</span>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, fontFamily: "'Inter Tight',sans-serif" }}>
            Los bloques aparecen difuminados en la vista Semana y Día del planificador.
          </div>
        </div>
      )}

      {tab === 'imagen' && (
        <div ref={imgContainerRef} style={{ flex: 1, position: 'relative', overflowY: 'auto', background: 'var(--bg-primary)' }}>
          {scheduleImages.length > 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {editingTitleId === scheduleImages[activeImageIdx]?.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" value={editTitleValue} onChange={e => setEditTitleValue(e.target.value)} autoFocus
                      style={{ fontSize: 22, fontWeight: 300, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", outline: 'none', width: 360 }}
                      onKeyDown={e => { if (e.key === 'Enter') { setScheduleImages(prev => prev.map(img => img.id === editingTitleId ? { ...img, title: editTitleValue } : img)); setEditingTitleId(null); } }} />
                    <button onClick={() => { setScheduleImages(prev => prev.map(img => img.id === editingTitleId ? { ...img, title: editTitleValue } : img)); setEditingTitleId(null); }} className="btn-secondary" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}><Check size={14} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.02em' }}>
                      {scheduleImages[activeImageIdx]?.title || 'Horario'}
                    </span>
                    <button onClick={() => { setEditingTitleId(scheduleImages[activeImageIdx]?.id); setEditTitleValue(scheduleImages[activeImageIdx]?.title || ''); }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-muted)' }}>
                      <Edit3 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                <img
                  src={scheduleImages[activeImageIdx]?.dataUrl}
                  alt={scheduleImages[activeImageIdx]?.title || 'Horario'}
                  draggable={false}
                  style={{
                    transform: `scale(${imgScale})`,
                    transformOrigin: 'top left',
                    transition: 'transform 150ms',
                    width: '100%', display: 'block',
                    borderRadius: 8, boxShadow: '0 16px 48px rgba(0,0,0,0.4)'
                  }}
                />
              </div>
              {scheduleImages.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px 20px', flexShrink: 0 }}>
                  {scheduleImages.map((_, i) => (
                    <div key={i} onClick={() => setActiveImageIdx(i)} style={{ width: 8, height: 8, borderRadius: '50%', background: i === activeImageIdx ? 'var(--accent)' : 'var(--border-strong)', cursor: 'pointer', transition: 'all 200ms', boxShadow: i === activeImageIdx ? '0 0 8px var(--accent-glow)' : 'none' }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div onClick={() => { const d = document.createElement('input'); d.type = 'file'; d.accept = 'image/*'; d.onchange = () => { const f = d.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => { const dataUrl = r.result as string; setScheduleImages(prev => { const dup = prev.findIndex(img => img.dataUrl === dataUrl); if (dup >= 0) { setActiveImageIdx(dup); return prev; } setActiveImageIdx(prev.length); return [...prev, { id: crypto.randomUUID(), title: f.name.replace(/\.[^.]+$/, ''), dataUrl }]; }); }; r.readAsDataURL(f); } }; d.click(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: 60, borderRadius: 20, border: '2px dashed var(--border-strong)', cursor: 'pointer', transition: 'border-color 200ms', maxWidth: 420 }}>
              <ImageIcon size={48} style={{ color: 'var(--text-muted)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Sube la imagen de tu horario</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>PNG o JPG de tu universidad. Puedes subir varias imágenes.</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
