import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Edit3, Check, Trash2 } from 'lucide-react';
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
}

export default function ScheduleBuilder({
  scheduleImageUrl,
  onSetScheduleImage,
  imgInputRef,
}: ScheduleBuilderProps) {
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'color-mix(in srgb, var(--bg-elevated) 65%, transparent)', backdropFilter: 'blur(8px)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif" }}>Horario</div>
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
            </>
          )}
          {scheduleImages.length > 0 && <div style={{ width: 1, height: 24, background: 'var(--border-soft)' }} />}
          {scheduleImages.length > 0 && (
            <>
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
      </div>

      {/* Image viewer */}
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
    </div>
  );
}
