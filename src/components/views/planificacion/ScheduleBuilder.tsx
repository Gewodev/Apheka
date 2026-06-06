import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Image as ImageIcon, Settings2, Trash2, Clock, Coffee, Utensils, ZoomIn, ZoomOut, Move, RefreshCw, Check, PlusCircle, Filter, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { fmtClock } from '../../../store/AppContext';
import { get, set } from 'idb-keyval';

export interface ScheduleImageItem {
  id: string;
  title: string;
  dataUrl: string;
}

export interface ScheduleCondition {
  id: string;
  field: 'hour' | 'day' | 'type' | 'duration';
  operator: 'eq' | 'lt' | 'gt' | 'between';
  value: string;
  value2?: string;
}

export interface ScheduleRule {
  id: string;
  name: string;
  conditions: ScheduleCondition[];
  logic: 'and' | 'or';
  action: 'adjust_duration' | 'set_duration' | 'skip';
  actionValue: number;
  enabled: boolean;
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
  classes: ScheduleClass[];
  courses: { id: string; name: string; color: string; teacher?: string; room?: string }[];
  onUpdateClasses: (c: ScheduleClass[]) => void;
  scheduleImageUrl: string | null;
  onSetScheduleImage: (url: string | null) => void;
  imgInputRef: React.RefObject<HTMLInputElement | null>;
  scheduleTab: 'image' | 'manual';
  onSetScheduleTab: (t: 'image' | 'manual') => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  timeFormat?: '24h' | '12h';
}

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(m: number) {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const generateBlocks = (baseMins: number, startH: number, startM: number, endH: number, endMin?: number) => {
  let current = new Date();
  current.setHours(startH, startM, 0, 0);
  const end = new Date();
  end.setHours(endH, endMin ?? 0, 0, 0);

  const blocks: { id: string; start: string; duration: number }[] = [];
  while (current < end) {
    blocks.push({
      id: crypto.randomUUID(),
      start: current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      duration: baseMins
    });
    current = new Date(current.getTime() + baseMins * 60000);
  }
  return blocks;
};

export default function ScheduleBuilder({
  classes,
  courses,
  onUpdateClasses,
  scheduleImageUrl,
  onSetScheduleImage,
  imgInputRef,
  scheduleTab,
  onSetScheduleTab,
  addNotification,
  timeFormat
}: ScheduleBuilderProps) {
  // Setup Wizard State
  const [isSetupDone, setIsSetupDone] = useState(localStorage.getItem('owa_sched_setup_v3') === '1');
  const [baseDuration, setBaseDuration] = useState(45);
  const [startHour, setStartHour] = useState(7);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(22);
  const [endMinute, setEndMinute] = useState(0);
  
  const [gridBlocks, setGridBlocks] = useState<{ id: string; start: string; duration: number }[]>(() => {
    try {
      const saved = localStorage.getItem('owa_sched_blocks_v3');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ dayOfWeek: number; start: string; end: string } | null>(null);
  const [editingClass, setEditingClass] = useState<ScheduleClass | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [rules, setRules] = useState<ScheduleRule[]>(() => {
    try {
      const saved = localStorage.getItem('owa_sched_rules_v3');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);

  // Time editor state for left gutter
  const [editingBlockTime, setEditingBlockTime] = useState<string | null>(null);
  const [editBlockTimeValue, setEditBlockTimeValue] = useState('');
  const [editingBlockEnd, setEditingBlockEnd] = useState<string | null>(null);
  const [editBlockEndValue, setEditBlockEndValue] = useState('');
  const [timePopupPos, setTimePopupPos] = useState<{ top: number; left: number; align: 'left' | 'right' } | null>(null);
  const timePopupRef = useRef<HTMLDivElement>(null);

  const showTimePopup = (el: HTMLElement) => {
    const popupW = 220;
    const popupH = 170;
    const gap = 8;

    // Position popup to the right of the gutter column at a fixed vertical position
    const gutterRect = el.parentElement?.getBoundingClientRect() || el.getBoundingClientRect();
    const left = gutterRect.right + gap;

    // Fixed vertical: center of viewport, clamped
    let top = Math.max(120, (window.innerHeight - popupH) / 2);
    if (top + popupH > window.innerHeight) top = window.innerHeight - popupH - 4;

    setTimePopupPos({ top, left: Math.min(left, window.innerWidth - popupW - gap), align: 'left' });
  };

  useEffect(() => {
    if (!timePopupPos) return;
    const handler = (e: MouseEvent) => {
      if (timePopupRef.current && !timePopupRef.current.contains(e.target as Node)) {
        setTimePopupPos(null);
        setEditingBlockTime(null);
        setEditingBlockEnd(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [timePopupPos]);

  // Multi-image carousel state — stored in IndexedDB (avoids localStorage quota)
  const [scheduleImages, setScheduleImages] = useState<ScheduleImageItem[]>(() => {
    try {
      const saved = localStorage.getItem('owa_sched_images_v3');
      if (saved) {
        const parsed: ScheduleImageItem[] = JSON.parse(saved);
        // Migrate to IndexedDB on next tick
        setTimeout(() => {
          set('owa_sched_images_v3', parsed).catch(() => {});
          localStorage.removeItem('owa_sched_images_v3');
        }, 0);
        return parsed;
      }
    } catch {}
    return [];
  });
  // Load from IndexedDB if localStorage was empty (fresh start)
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

  // Sync active image URL to parent
  useEffect(() => {
    const img = scheduleImages[activeImageIdx];
    const url = img ? img.dataUrl : null;
    // Only update if different from current prop
    if (url !== scheduleImageUrl) {
      onSetScheduleImage(url);
    }
    localStorage.setItem('owa_sched_active_image_idx', String(activeImageIdx));
  }, [scheduleImages, activeImageIdx]);

  // Save images to IndexedDB (deduplication handled at upload time)
  useEffect(() => {
    set('owa_sched_images_v3', scheduleImages).catch(() => {});
  }, [scheduleImages]);

  // Image Pan/Zoom state
  const [imgScale, setImgScale] = useState(1);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  const handleCompleteSetup = () => {
    const startStr = String(startHour).padStart(2, '0') + ':' + String(startMinute).padStart(2, '0');
    const endMins = endHour * 60 + endMinute;
    const startMins = startHour * 60 + startMinute;
    if (endMins <= startMins) { addNotification('La hora de fin debe ser mayor a la de inicio', 'error'); return; }
    if (!confirm(`¿Confirmar generación del horario?\n\n• Duración base: ${baseDuration} min por bloque\n• Horario: ${startStr} - ${String(endHour).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}\n• Total aproximado: ${Math.floor((endMins - startMins) / baseDuration)} bloques\n\nPuedes ajustar cada bloque después desde Ajustes > Reglas.`)) return;
    const newBlocks = generateBlocks(baseDuration, startHour, startMinute, endHour, endMinute);
    setGridBlocks(newBlocks);
    setIsSetupDone(true);
    localStorage.setItem('owa_sched_setup_v3', '1');
    localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(newBlocks));
  };

  const handleResetSchedule = () => {
    setShowResetConfirm(true);
  };
  const confirmResetSchedule = () => {
    setGridBlocks([]);
    onUpdateClasses([]);
    setIsSetupDone(false);
    localStorage.removeItem('owa_sched_setup_v3');
    localStorage.removeItem('owa_sched_blocks_v3');
    setShowSettings(false);
    setShowResetConfirm(false);
  };

  const shiftBlocks = (index: number, newDuration: number) => {
    if (newDuration < 5) return;
    const updated = [...gridBlocks];
    updated[index].duration = newDuration;
    let currentStart = timeToMins(updated[0].start);
    for (let i = 0; i < updated.length; i++) {
      updated[i].start = minsToTime(currentStart);
      currentStart += updated[i].duration;
    }
    setGridBlocks(updated);
    localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
  };

  const applyGlobalRule = (deltaMins: number, affectType: 'all' | 'except_breaks') => {
    const updated = [...gridBlocks];
    let currentStart = timeToMins(updated[0].start);
    for (let i = 0; i < updated.length; i++) {
      updated[i].start = minsToTime(currentStart);
      updated[i].duration = Math.max(10, updated[i].duration + deltaMins);
      currentStart += updated[i].duration;
    }
    setGridBlocks(updated);
    localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
  };

  const matchesCondition = (block: { start: string; duration: number }, condition: ScheduleCondition): boolean => {
    const val = Number(condition.value);
    const val2 = condition.value2 ? Number(condition.value2) : 0;
    switch (condition.field) {
      case 'hour': {
        const blockMins = timeToMins(block.start);
        const blockHour = Math.floor(blockMins / 60);
        switch (condition.operator) {
          case 'eq': return blockHour === val;
          case 'lt': return blockHour < val;
          case 'gt': return blockHour > val;
          case 'between': return blockHour >= val && blockHour <= val2;
          default: return blockHour === val;
        }
      }
      case 'duration':
        switch (condition.operator) {
          case 'eq': return block.duration === val;
          case 'lt': return block.duration < val;
          case 'gt': return block.duration > val;
          case 'between': return block.duration >= val && block.duration <= val2;
          default: return block.duration === val;
        }
      default: return true;
    }
  };

  const applyRules = () => {
    const enabledRules = rules.filter(r => r.enabled);
    if (enabledRules.length === 0) {
      addNotification('No hay reglas activas. Crea reglas en Ajustes.', 'info');
      return;
    }
    let updated = [...gridBlocks];
    for (const rule of enabledRules) {
      updated = updated.map(block => {
        const results = rule.conditions.map(c => matchesCondition(block, c));
        const passed = rule.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
        if (!passed) return block;
        switch (rule.action) {
          case 'adjust_duration':
            return { ...block, duration: Math.max(10, block.duration + rule.actionValue) };
          case 'set_duration':
            return { ...block, duration: Math.max(10, rule.actionValue) };
          case 'skip':
            return { ...block, duration: 0 };
          default:
            return block;
        }
      });
    }
    let currentStart = timeToMins(updated[0].start);
    for (let i = 0; i < updated.length; i++) {
      updated[i].start = minsToTime(currentStart);
      currentStart += Math.max(5, updated[i].duration);
    }
    setGridBlocks(updated);
    localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
    addNotification(`Reglas aplicadas — ${enabledRules.length} regla(s) ejecutada(s)`, 'success');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'color-mix(in srgb, var(--bg-elevated) 65%, transparent)', backdropFilter: 'blur(8px)' }}>
      {/* Tabs & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-elevated)', borderRadius: 10, padding: 4, border: '1px solid var(--border-soft)' }}>
          {([['manual', 'Constructor Manual'], ['image', 'Imagen Adjunta']] as ['manual'|'image', string][]).map(([t, l]) => (
            <button key={t} onClick={() => onSetScheduleTab(t)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 200ms', background: scheduleTab === t ? 'var(--accent)' : 'transparent', color: scheduleTab === t ? '#fff' : 'var(--text-secondary)', fontFamily: "'Outfit',sans-serif" }}>
              {l}
            </button>
          ))}
        </div>
        
        {scheduleTab === 'manual' && isSetupDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSettings(!showSettings)} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 10, height: 36, border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Settings2 size={16} /> Ajustes
              </button>
              {showSettings && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 280, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 100, padding: 16, maxHeight: 400, overflowY: 'auto' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Reglas Globales</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button onClick={() => applyGlobalRule(-5, 'all')} className="btn-secondary" style={{ flex: 1, padding: '6px' }}>-5m Todos</button>
                    <button onClick={() => applyGlobalRule(5, 'all')} className="btn-secondary" style={{ flex: 1, padding: '6px' }}>+5m Todos</button>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Reglas Condicionales</span>
                    <button onClick={() => { setEditingRule(null); setShowRuleModal(true); }} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <PlusCircle size={12} /> Nueva
                    </button>
                  </div>

                  {rules.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', textAlign: 'center' }}>
                      Sin reglas personalizadas. Crea una para añadir lógica condicional a tu horario.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {rules.map(rule => (
                        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                          <div 
                            onClick={() => {
                              setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                            }} 
                            style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid ' + (rule.enabled ? 'var(--accent)' : 'var(--border-strong)'), background: rule.enabled ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {rule.enabled && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{rule.conditions.length} condicion(es) - {rule.action === 'adjust_duration' ? (rule.actionValue > 0 ? '+' : '') + rule.actionValue + 'm' : rule.action === 'set_duration' ? rule.actionValue + 'm' : 'Saltar'}</div>
                          </div>
                          <button onClick={() => { setEditingRule(rule); setShowRuleModal(true); }} className="btn-ghost" style={{ padding: 4 }}><Settings2 size={12} /></button>
                        </div>
                      ))}
                      <button onClick={applyRules} className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Filter size={14} /> Aplicar Reglas
                      </button>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-soft)', margin: '12px -16px' }} />
                  <button onClick={handleResetSchedule} style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(225,29,72,0.1)', color: 'var(--accent)', border: '1px solid rgba(225,29,72,0.2)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                    <RefreshCw size={14} /> Reiniciar Horario
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {scheduleTab === 'image' && (
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
        )}
      </div>

      {/* Image Tab — Carousel */}
      {scheduleTab === 'image' && (
        <div ref={imgContainerRef}
          style={{ flex: 1, position: 'relative', overflowY: 'auto', background: 'var(--bg-primary)' }}
        >
          {scheduleImages.length > 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Title bar */}
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
              {/* Image */}
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
              {/* Dot indicators */}
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

      {/* Manual Setup Tab */}
      {scheduleTab === 'manual' && !isSetupDone && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
          <div style={{ width: 440, padding: 40, background: 'var(--surface)', borderRadius: 24, border: '1px solid var(--border-soft)', boxShadow: '0 32px 64px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", marginBottom: 12, textAlign: 'center', letterSpacing: '-0.02em' }}>Configura tu Grid</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 40, lineHeight: 1.5 }}>
              Establece las temporalidades base (en múltiplos de 15 min).
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 40 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Duración Base por Bloque (min)</label>
                <select value={baseDuration} onChange={e => setBaseDuration(Number(e.target.value))} style={{ width: '100%', height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 16, outline: 'none' }}>
                  {[15, 30, 45, 60, 75, 90, 120].map(v => <option key={v} value={v}>{v} minutos</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Inicio</label>
                  <div style={{ position: 'relative' }}>
                      <Clock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', opacity: 0.6 }} />
                    <input type="time" value={String(startHour).padStart(2,'0') + ':' + String(startMinute).padStart(2,'0')} onChange={e => { const [h,m] = e.target.value.split(':'); setStartHour(Number(h)); setStartMinute(Number(m)); }} style={{ width: '100%', height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 52px', color: 'var(--text-primary)', fontSize: 16, fontFamily: "'JetBrains Mono',monospace", outline: 'none', letterSpacing: '0.06em' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Fin</label>
                  <div style={{ position: 'relative' }}>
                      <Clock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', opacity: 0.6 }} />
                    <input type="time" value={String(endHour).padStart(2,'0') + ':' + String(endMinute).padStart(2,'0')} onChange={e => { const [h,m] = e.target.value.split(':'); setEndHour(Number(h)); setEndMinute(Number(m)); }} style={{ width: '100%', height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 52px', color: 'var(--text-primary)', fontSize: 16, fontFamily: "'JetBrains Mono',monospace", outline: 'none', letterSpacing: '0.06em' }} />
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleCompleteSetup} className="btn-primary" style={{ width: '100%', height: 52, borderRadius: 14, fontSize: 16, fontWeight: 600 }}>
              Generar Matriz
            </button>
          </div>
        </div>
      )}

      {/* Manual Grid Tab — each block is its own independent temporal row */}
      {scheduleTab === 'manual' && isSetupDone && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: 'transparent' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '76px repeat(5, 1fr)', minWidth: 980 }}>
              {/* Header row */}
              <div style={{ borderBottom: '1px solid var(--border-soft)', borderRight: '1px solid var(--border-soft)', position: 'sticky', top: 0, background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)', backdropFilter: 'blur(8px)', zIndex: 12 }} />
              {[0, 1, 2, 3, 4].map(di => (
                <div key={di} style={{ padding: '14px 0', textAlign: 'center', borderBottom: '1px solid var(--border-soft)', borderRight: di < 4 ? '1px solid var(--border-soft)' : 'none', position: 'sticky', top: 0, background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{'LUN_MAR_MIÉ_JUE_VIE'.split('_')[di]}</div>
                </div>
              ))}

              {/* Each block = one full row: gutter + 5 day columns */}
              {gridBlocks.map((block, bi) => {
                const blockStartMins = timeToMins(block.start);
                const blockEndMins = blockStartMins + block.duration;
                const blockHeight = Math.max(60, block.duration * 1.5);
                const pxPerMin = 1.5;
                const minBlockH = 60;
                const courseColors = courses.reduce((acc, c) => ({ ...acc, [c.id]: c.color }), {} as Record<string, string>);

                // Gutter cell
                const endStr = minsToTime(blockEndMins);

                return (
                  <React.Fragment key={block.id}>
                    {/* Gutter cell */}
                    <div style={{ height: blockHeight, borderBottom: '1px dashed var(--border-subtle)', borderRight: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '6px 8px 4px 6px', background: 'color-mix(in srgb, var(--bg-elevated) 25%, transparent)' }}>
                      <div onClick={e => { setEditingBlockTime(block.id); setEditBlockTimeValue(block.start); setEditingBlockEnd(null); showTimePopup(e.currentTarget); }} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 6px', borderRadius: 6, marginLeft: 'auto' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 10%, transparent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'inherit', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.4, letterSpacing: '0.02em' }}>
                          {fmtClock(block.start, timeFormat)}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'inherit', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.4, opacity: 0.5 }}>▼</span>
                      </div>
                      {bi < gridBlocks.length - 1 && <div onClick={e => { setEditingBlockEnd(block.id); setEditBlockEndValue(endStr); setEditingBlockTime(null); showTimePopup(e.currentTarget); }} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '1px 6px', borderRadius: 5, marginTop: 1, marginLeft: 'auto' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'inherit', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.3, opacity: 0.45 }}>
                          {fmtClock(endStr, timeFormat)}
                        </span>
                        <span style={{ fontSize: 7, fontWeight: 500, color: 'inherit', fontFamily: "'JetBrains Mono',monospace", opacity: 0.35 }}>▼</span>
                      </div>}
                    </div>

                    {/* 5 day columns — each filtered to classes overlapping this block */}
                    {[0, 1, 2, 3, 4].map(di => {
                      // Filter classes for this day that overlap this block's time range
                      const dayClasses = classes
                        .filter(c => c.dayOfWeek === di && (() => {
                          const cs = timeToMins(c.startTime);
                          const ce = timeToMins(c.endTime);
                          return cs < blockEndMins && ce > blockStartMins;
                        })())
                        .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));

                      // Group overlapping classes into columns
                      const overlapGroups: { cls: ScheduleClass; col: number; totalCols: number }[] = [];
                      for (const cls of dayClasses) {
                        const s = timeToMins(cls.startTime);
                        const e = timeToMins(cls.endTime);
                        const occupied = new Set<number>();
                        for (const placed of overlapGroups) {
                          const ps = timeToMins(placed.cls.startTime);
                          const pe = timeToMins(placed.cls.endTime);
                          if (s < pe && e > ps) occupied.add(placed.col);
                        }
                        let col = 0;
                        while (occupied.has(col)) col++;
                        const totalCols = Math.max(col + 1, ...overlapGroups.map(g => g.totalCols));
                        overlapGroups.push({ cls, col, totalCols });
                      }
                      const maxCols = Math.max(1, ...overlapGroups.map(g => g.totalCols));
                      for (const g of overlapGroups) g.totalCols = maxCols;

                      return (
                        <div key={`${block.id}-${di}`} style={{ height: blockHeight, borderBottom: '1px dashed var(--border-subtle)', borderRight: di < 4 ? '1px solid var(--border-soft)' : 'none', background: di % 2 === 0 ? 'color-mix(in srgb, var(--bg-base) 60%, transparent)' : 'transparent', position: 'relative', overflow: 'hidden' }}>
                          {/* Click empty area to add class */}
                          <div onClick={() => {
                            setAddDefaults({ dayOfWeek: di, start: block.start, end: minsToTime(blockEndMins) });
                            setEditingClass(null);
                            setShowAddModal(true);
                          }} style={{ position: 'absolute', inset: 0, cursor: 'pointer', transition: 'background 250ms' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 6%, transparent)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />

                          {/* Class cards within this block */}
                          {overlapGroups.map((g, gi) => {
                            const s = timeToMins(g.cls.startTime);
                            const e = timeToMins(g.cls.endTime);
                            // Position relative to block: clamp to block bounds
                            const relStart = Math.max(s, blockStartMins);
                            const relEnd = Math.min(e, blockEndMins);
                            const top = (relStart - blockStartMins) * pxPerMin;
                            const height = Math.max(minBlockH, (relEnd - relStart) * pxPerMin);
                            const wPct = 100 / g.totalCols;
                            const bg = g.cls.type === 'break'
                              ? '#3B82F6'
                              : g.cls.type === 'meal'
                                ? '#F59E0B'
                                : courseColors[g.cls.courseId || ''] || g.cls.color || 'var(--accent)';
                            return (
                              <div key={`cls-${g.cls.id}`}
                                onClick={e => { e.stopPropagation(); setEditingClass(g.cls); setShowAddModal(true); }}
                                style={{ position: 'absolute', top: Math.min(top, blockHeight - 28), left: `${(g.col / g.totalCols) * 100}%`, width: `calc(${wPct}% - 4px)`, height: Math.min(height, blockHeight - top), marginLeft: 2, borderRadius: 8, padding: '4px 6px', overflow: 'hidden', cursor: 'pointer', background: `color-mix(in srgb, ${bg} 18%, transparent)`, borderLeft: `3px solid ${bg}`, transition: 'all 200ms', zIndex: 2 }}
                                onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, ${bg} 30%, transparent)`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = `color-mix(in srgb, ${bg} 18%, transparent)`; e.currentTarget.style.transform = 'scale(1)'; }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                                  {g.cls.title}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                  {fmtClock(g.cls.startTime, timeFormat)} – {fmtClock(g.cls.endTime, timeFormat)}
                                </div>
                                {g.cls.teacher && (
                                  <div style={{ fontSize: 8, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                    {g.cls.teacher}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Class Modal */}
      {showAddModal && (
        <AddClassModal 
          editing={editingClass}
          defaults={addDefaults} 
          courses={courses} 
          onClose={() => { setShowAddModal(false); setEditingClass(null); }} 
          onAdd={(newClasses) => { 
            let updated = [...classes];
            if (editingClass) updated = updated.filter(x => x.id !== editingClass.id);
            updated.push(...newClasses);
            onUpdateClasses(updated); 
            setShowAddModal(false); 
          }}
          onDelete={(id) => {
            if (!confirm('¿Eliminar este bloque del horario?')) return;
            onUpdateClasses(classes.filter(c => c.id !== id));
            setShowAddModal(false);
          }}
        />
      )}

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface-elevated)', borderRadius: 14, border: '1px solid var(--border-soft)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)', padding: 24, minWidth: 300, maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Reiniciar Horario</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              ¿Estás seguro de que deseas borrar todo el horario? Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmResetSchedule} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings outside click */}
      {showSettings && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowSettings(false)} />}

      {/* Time editing popup — positioned right next to the gutter cell */}
      {timePopupPos && (editingBlockTime || editingBlockEnd) && (
        <div ref={timePopupRef} style={{ position: 'fixed', top: timePopupPos.top, left: timePopupPos.left, zIndex: 1000 }}>
          <div style={{ padding: 16, borderRadius: 12, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
              {editingBlockTime ? 'Editar inicio' : 'Editar fin'}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="time"
                value={editingBlockTime ? editBlockTimeValue : editBlockEndValue}
                onChange={e => {
                  if (editingBlockTime) setEditBlockTimeValue(e.target.value);
                  else setEditBlockEndValue(e.target.value);
                }}
                autoFocus
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (editingBlockTime) {
                        const newStart = timeToMins(editBlockTimeValue);
                        if (!isNaN(newStart)) {
                          const updated = [...gridBlocks];
                          const bi = gridBlocks.findIndex(b => b.id === editingBlockTime);
                          if (bi >= 0) {
                            updated[bi].start = editBlockTimeValue;
                            // Cascade: adjust previous block's end to match new start
                            if (bi > 0) {
                              const prevStartMins = timeToMins(updated[bi - 1].start);
                              if (newStart > prevStartMins) {
                                updated[bi - 1].duration = newStart - prevStartMins;
                              }
                            }
                            setGridBlocks(updated);
                            localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
                          }
                        }
                      } else {
                        const newEnd = timeToMins(editBlockEndValue);
                        const bi = gridBlocks.findIndex(b => b.id === editingBlockEnd);
                        if (bi >= 0) {
                          const startMins = timeToMins(gridBlocks[bi].start);
                          if (!isNaN(newEnd) && newEnd > startMins) {
                            const newDuration = newEnd - startMins;
                            const updated = [...gridBlocks];
                            updated[bi].duration = newDuration;
                            // Cascade: adjust next block's start to match this end
                            if (bi < updated.length - 1) {
                              updated[bi + 1].start = editBlockEndValue;
                            }
                            setGridBlocks(updated);
                            localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
                          }
                        }
                      }
                      setTimePopupPos(null);
                      setEditingBlockTime(null);
                      setEditingBlockEnd(null);
                    }
                  if (e.key === 'Escape') { setTimePopupPos(null); setEditingBlockTime(null); setEditingBlockEnd(null); }
                }}
                style={{ width: '100%', height: 44, fontSize: 18, padding: '0 14px', borderRadius: 8, background: 'var(--bg-primary)', border: '1.5px solid var(--accent)', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace", outline: 'none', fontWeight: 600, letterSpacing: '0.06em' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setTimePopupPos(null); setEditingBlockTime(null); setEditingBlockEnd(null); }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onMouseDown={() => {
                if (editingBlockTime) {
                  const newStart = timeToMins(editBlockTimeValue);
                  if (!isNaN(newStart)) {
                    const updated = [...gridBlocks];
                    const bi = gridBlocks.findIndex(b => b.id === editingBlockTime);
                    if (bi >= 0) {
                      updated[bi].start = editBlockTimeValue;
                      if (bi > 0) {
                        const prevStartMins = timeToMins(updated[bi - 1].start);
                        if (newStart > prevStartMins) {
                          updated[bi - 1].duration = newStart - prevStartMins;
                        }
                      }
                      setGridBlocks(updated);
                      localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
                    }
                  }
                } else {
                  const newEnd = timeToMins(editBlockEndValue);
                  const bi = gridBlocks.findIndex(b => b.id === editingBlockEnd);
                  if (bi >= 0) {
                    const startMins = timeToMins(gridBlocks[bi].start);
                    if (!isNaN(newEnd) && newEnd > startMins) {
                      const newDuration = newEnd - startMins;
                      const updated = [...gridBlocks];
                      updated[bi].duration = newDuration;
                      if (bi < updated.length - 1) {
                        updated[bi + 1].start = editBlockEndValue;
                      }
                      setGridBlocks(updated);
                      localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(updated));
                    }
                  }
                }
                setTimePopupPos(null);
                setEditingBlockTime(null);
                setEditingBlockEnd(null);
              }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {editingBlockTime ? 'Aplicar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <RuleModal
          rule={editingRule}
          onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
          onSave={(rule) => {
            if (editingRule) {
              setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
            } else {
              setRules(prev => [...prev, rule]);
            }
            setShowRuleModal(false);
            setEditingRule(null);
          }}
          onDelete={(id) => {
            setRules(prev => prev.filter(r => r.id !== id));
            setShowRuleModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

function AddClassModal({ editing, defaults, courses, onClose, onAdd, onDelete }: { editing: ScheduleClass|null, defaults: any, courses: any[], onClose: () => void, onAdd: (c: ScheduleClass[]) => void, onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(editing?.title || '');
  const [courseId, setCourseId] = useState(editing?.courseId || '');
  const [day, setDay] = useState(editing?.dayOfWeek ?? defaults?.dayOfWeek ?? 0);
  const [start, setStart] = useState(editing?.startTime || defaults?.start || '08:00');
  const [end, setEnd] = useState(editing?.endTime || defaults?.end || '09:00');
  const [room, setRoom] = useState(editing?.room || '');
  const [teacher, setTeacher] = useState(editing?.teacher || '');
  const [color, setColor] = useState(editing?.color || '#E11D48');
  const [type, setType] = useState<'class'|'break'|'meal'>(editing?.type || 'class');
  const [repeatDaily, setRepeatDaily] = useState(false);

  const DAYS = ['LUN','MAR','MIÉ','JUE','VIE'];
  const COLOR_SWATCHES = ['#E11D48','#DC2626','#F97316','#EAB308','#22C55E','#14B8A6','#3B82F6','#6366F1','#A855F7','#EC4899'];

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!confirm(editing ? '¿Guardar cambios en este bloque?' : '¿Añadir este bloque al horario?')) return;

    const baseId = editing?.id || crypto.randomUUID();
    const newClasses: ScheduleClass[] = [];
    const daysToApply = (repeatDaily && (type === 'break' || type === 'meal')) ? [0,1,2,3,4] : [day];

    for (const d of daysToApply) {
      newClasses.push({
        id: d === day ? baseId : crypto.randomUUID(),
        title: title.trim(),
        courseId: courseId || undefined,
        dayOfWeek: d,
        startTime: start,
        endTime: end,
        room: type === 'class' ? room : undefined,
        teacher: type === 'class' ? teacher : undefined,
        color,
        type
      });
    }

    onAdd(newClasses);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: 520, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 24, border: '1px solid var(--border-soft)', padding: 36, boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.02em' }}>{editing ? 'Editar Bloque' : 'Añadir al Horario'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing && <button onClick={() => { if (confirm('¿Eliminar este bloque del horario?')) onDelete(editing.id); }} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /></button>}
            <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'var(--surface-elevated)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        {/* Type Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['class', 'break', 'meal'] as const).map(t => (
            <button
              key={t} onClick={() => setType(t)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border-soft)'}`, background: type === t ? 'rgba(225,29,72,0.05)' : 'var(--surface-elevated)', color: type === t ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms' }}
            >
                            {t === 'class' ? 'Clase' : t === 'break' ? 'Descanso' : 'Comida'}
            </button>
          ))}
        </div>

        {/* Day Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Día</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS.map((l, i) => (
              <button key={i} onClick={() => setDay(i)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${day === i ? (type === 'class' ? color : 'var(--accent)') : 'var(--border-soft)'}`, background: day === i ? `color-mix(in srgb, ${type === 'class' ? color : 'var(--accent)'} 12%, transparent)` : 'var(--bg-secondary)', color: day === i ? (type === 'class' ? color : 'var(--accent)') : 'var(--text-secondary)', cursor: 'pointer', letterSpacing: '0.04em', transition: 'all 200ms' }}
              >{l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Título</label>
            <input type="text" placeholder={type === 'class' ? 'Ej: Cálculo I, Álgebra...' : type === 'break' ? 'Ej: Recreo, Café...' : 'Ej: Almuerzo, Comida...'} value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 15, outline: 'none' }} autoFocus />
          </div>

          {/* Course */}
          {type === 'class' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Materia (opcional)</label>
              <select value={courseId} onChange={e => { setCourseId(e.target.value); const c = courses.find(x => x.id === e.target.value); if (c) { setColor(c.color); if (c.teacher) setTeacher(c.teacher); if (c.room) setRoom(c.room); } }} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                <option value="">Sin materia</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Start / End */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Inicio</label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.6 }} />
                <input type="time" value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 44px', color: 'var(--text-primary)', fontSize: 15, fontFamily: "'JetBrains Mono',monospace", outline: 'none', letterSpacing: '0.04em' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Fin</label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.6 }} />
                <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 44px', color: 'var(--text-primary)', fontSize: 15, fontFamily: "'JetBrains Mono',monospace", outline: 'none', letterSpacing: '0.04em' }} />
              </div>
            </div>
          </div>

          {/* Room + Teacher (class only) */}
          {type === 'class' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Aula</label>
                <input type="text" placeholder="Ej: A-202" value={room} onChange={e => setRoom(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Profesor</label>
                <input type="text" placeholder="Nombre" value={teacher} onChange={e => setTeacher(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
              </div>
            </div>
          )}

          {/* Color (class only) */}
          {type === 'class' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {COLOR_SWATCHES.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{ width: 32, height: 32, borderRadius: 8, background: c, border: color === c ? '2px solid #fff' : 'none', outline: color === c ? `2px solid ${c}` : 'none', cursor: 'pointer', boxShadow: color === c ? `0 0 12px ${c}60` : '0 1px 4px rgba(0,0,0,0.1)', transition: 'all 150ms' }}
                  />
                ))}
                <div style={{ position: 'relative', width: 32, height: 32 }}>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  <div style={{ width: 32, height: 32, borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>+</div>
                </div>
              </div>
            </div>
          )}

          {/* Repeat daily (break/meal only) */}
          {(type === 'break' || type === 'meal') && !editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '14px 16px', background: 'var(--surface-elevated)', borderRadius: 12, border: '1px solid var(--border-soft)', transition: 'all 200ms' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-soft)'}
            >
              <input type="checkbox" checked={repeatDaily} onChange={e => setRepeatDaily(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Repetir todos los días</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Misma hora de {start} a {end} de lunes a viernes</span>
              </div>
            </label>
          )}
        </div>

        <button onClick={handleSubmit} className="btn-primary" style={{ width: '100%', height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700, marginTop: 28 }}>
          {editing ? 'Guardar Cambios' : 'Añadir Bloque'}
        </button>
      </div>
    </div>
  );
}

function RuleModal({ rule, onClose, onSave, onDelete }: { rule: ScheduleRule | null; onClose: () => void; onSave: (r: ScheduleRule) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState(rule?.name || '');
  const [logic, setLogic] = useState<'and' | 'or'>(rule?.logic || 'and');
  const [action, setAction] = useState<'adjust_duration' | 'set_duration' | 'skip'>(rule?.action || 'adjust_duration');
  const [actionValue, setActionValue] = useState(rule?.actionValue ?? 5);
  const [conditions, setConditions] = useState<ScheduleCondition[]>(rule?.conditions || [{ id: crypto.randomUUID(), field: 'hour', operator: 'lt', value: '600' }]);

  const addCondition = () => {
    setConditions(prev => [...prev, { id: crypto.randomUUID(), field: 'hour', operator: 'lt', value: '480' }]);
  };

  const updateCondition = (id: string, updates: Partial<ScheduleCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: rule?.id || crypto.randomUUID(),
      name: name.trim(),
      conditions,
      logic,
      action,
      actionValue,
      enabled: rule?.enabled ?? true,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: 520, maxHeight: '80vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 24, border: '1px solid var(--border-soft)', padding: 36, boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.02em' }}>{rule ? 'Editar Regla' : 'Nueva Regla'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {rule && <button onClick={() => onDelete(rule.id)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /></button>}
            <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'var(--surface-elevated)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
          <input type="text" placeholder="Nombre de la regla (Ej: Mañana comprimida)" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 15, outline: 'none' }} autoFocus />

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Condiciones</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Si</span>
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
              <button onClick={() => setLogic('and')} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: logic === 'and' ? 'var(--accent)' : 'transparent', color: logic === 'and' ? '#fff' : 'var(--text-secondary)' }}>TODAS (Y)</button>
              <button onClick={() => setLogic('or')} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: logic === 'or' ? 'var(--accent)' : 'transparent', color: logic === 'or' ? '#fff' : 'var(--text-secondary)' }}>CUALQUIERA (O)</button>
            </div>
          </div>

          {conditions.map((cond, ci) => (
            <div key={cond.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
              {ci > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', padding: '0 4px' }}>{logic === 'and' ? 'Y' : 'O'}</span>
              )}
              <select value={cond.field} onChange={e => updateCondition(cond.id, { field: e.target.value as any })} style={{ padding: '8px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                <option value="hour">Hora inicio</option>
                <option value="duration">Duración</option>
              </select>
              <select value={cond.operator} onChange={e => updateCondition(cond.id, { operator: e.target.value as any })} style={{ padding: '8px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                <option value="lt">Anterior a</option>
                <option value="gt">Desde</option>
                <option value="between">Entre</option>
              </select>
              <input type="number" value={cond.value} onChange={e => updateCondition(cond.id, { value: e.target.value })} style={{ width: 70, padding: '8px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} placeholder="min" />
              {cond.operator === 'between' && (
                <>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>y</span>
                  <input type="number" value={cond.value2 || ''} onChange={e => updateCondition(cond.id, { value2: e.target.value })} style={{ width: 70, padding: '8px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} placeholder="max" />
                </>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>min</span>
              <button onClick={() => removeCondition(cond.id)} style={{ padding: 4, marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>
            </div>
          ))}
          <button onClick={addCondition} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            <Plus size={14} /> Añadir condición
          </button>

          <div style={{ borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acción</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['adjust_duration', 'set_duration', 'skip'] as const).map(a => (
              <button key={a} onClick={() => setAction(a)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: `1px solid ${action === a ? 'var(--accent)' : 'var(--border-soft)'}`, background: action === a ? 'rgba(225,29,72,0.05)' : 'var(--surface-elevated)', color: action === a ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms' }}>
                {a === 'adjust_duration' ? 'Ajustar' : a === 'set_duration' ? 'Fijar' : 'Saltar'}
              </button>
            ))}
          </div>
          {action !== 'skip' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{action === 'adjust_duration' ? 'Ajustar ±' : 'Fijar en'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {action === 'adjust_duration' && (
                  <button onClick={() => setActionValue(prev => Math.max(-120, prev - 5))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>-</button>
                )}
                <input type="number" value={actionValue} onChange={e => setActionValue(Number(e.target.value))} style={{ width: 60, textAlign: 'center', padding: '6px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, outline: 'none' }} />
                {action === 'adjust_duration' && (
                  <button onClick={() => setActionValue(prev => Math.min(120, prev + 5))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>+</button>
                )}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>minutos</span>
            </div>
          )}
        </div>

        <button onClick={handleSave} className="btn-primary" style={{ width: '100%', height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700 }}>
          {rule ? 'Guardar Regla' : 'Crear Regla'}
        </button>
      </div>
    </div>
  );
}
