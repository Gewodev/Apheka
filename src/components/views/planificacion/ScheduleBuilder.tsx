import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Image as ImageIcon, Settings2, Trash2, Clock, Coffee, Utensils, ZoomIn, ZoomOut, Move, RefreshCw } from 'lucide-react';

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
  courses: { id: string; name: string; color: string; teacher?: string }[];
  onUpdateClasses: (c: ScheduleClass[]) => void;
  scheduleImageUrl: string | null;
  onSetScheduleImage: (url: string | null) => void;
  imgInputRef: React.RefObject<HTMLInputElement | null>;
  scheduleTab: 'image' | 'manual';
  onSetScheduleTab: (t: 'image' | 'manual') => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
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

const generateBlocks = (baseMins: number, startH: number, endH: number) => {
  let current = new Date();
  current.setHours(startH, 0, 0, 0);
  const end = new Date();
  end.setHours(endH, 0, 0, 0);

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
  addNotification
}: ScheduleBuilderProps) {
  // Setup Wizard State
  const [isSetupDone, setIsSetupDone] = useState(localStorage.getItem('owa_sched_setup_v3') === '1');
  const [baseDuration, setBaseDuration] = useState(45);
  const [startHour, setStartHour] = useState(7);
  const [endHour, setEndHour] = useState(22);
  
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

  // Image Pan/Zoom state
  const [imgScale, setImgScale] = useState(1);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const isDraggingImg = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleCompleteSetup = () => {
    const newBlocks = generateBlocks(baseDuration, startHour, endHour);
    setGridBlocks(newBlocks);
    setIsSetupDone(true);
    localStorage.setItem('owa_sched_setup_v3', '1');
    localStorage.setItem('owa_sched_blocks_v3', JSON.stringify(newBlocks));
  };

  const handleResetSchedule = () => {
    if (confirm("¿Estás seguro de que deseas borrar todo el horario? Esta acción no se puede deshacer.")) {
      setGridBlocks([]);
      onUpdateClasses([]);
      setIsSetupDone(false);
      localStorage.removeItem('owa_sched_setup_v3');
      localStorage.removeItem('owa_sched_blocks_v3');
      setShowSettings(false);
    }
  };

  const shiftBlocks = (index: number, newDuration: number) => {
    if (newDuration < 5) return;
    const updated = [...gridBlocks];
    updated[index].duration = newDuration;
    
    // Recalculate starts
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

  // Image dragging logic
  const onImgMouseDown = (e: React.MouseEvent) => {
    isDraggingImg.current = true;
    dragStartPos.current = { x: e.clientX - imgPos.x, y: e.clientY - imgPos.y };
  };
  const onImgMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImg.current) return;
    setImgPos({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
  };
  const onImgMouseUp = () => { isDraggingImg.current = false; };
  const onImgWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setImgScale(s => Math.min(Math.max(1, s - e.deltaY * 0.001), 4)); // Minimum scale is 1
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Tabs & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'var(--surface)' }}>
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
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 240, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 100, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Reglas Globales</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button onClick={() => applyGlobalRule(-5, 'all')} className="btn-secondary" style={{ flex: 1, padding: '6px' }}>-5m Todos</button>
                    <button onClick={() => applyGlobalRule(5, 'all')} className="btn-secondary" style={{ flex: 1, padding: '6px' }}>+5m Todos</button>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-soft)', margin: '16px -16px' }} />
                  <button onClick={handleResetSchedule} style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(225,29,72,0.1)', color: 'var(--accent)', border: '1px solid rgba(225,29,72,0.2)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                    <RefreshCw size={14} /> Reiniciar Horario
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {scheduleTab === 'image' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {scheduleImageUrl && (
              <>
                <button onClick={() => setImgScale(s => Math.min(s + 0.2, 4))} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10 }}><ZoomIn size={16}/></button>
                <button onClick={() => setImgScale(s => Math.max(1, s - 0.2))} className="btn-secondary" style={{ padding: 8, height: 36, borderRadius: 10 }}><ZoomOut size={16}/></button>
              </>
            )}
            <button onClick={() => imgInputRef.current?.click()} className="btn-secondary" style={{ fontSize: 13, height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10 }}>
              <ImageIcon size={16} /> {scheduleImageUrl ? 'Cambiar' : 'Subir'}
            </button>
          </div>
        )}
      </div>

      {/* Image Tab */}
      {scheduleTab === 'image' && (
        <div 
          style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-primary)', cursor: isDraggingImg.current ? 'grabbing' : 'grab' }}
          onMouseDown={onImgMouseDown} onMouseMove={onImgMouseMove} onMouseUp={onImgMouseUp} onMouseLeave={onImgMouseUp} onWheel={onImgWheel}
        >
          {scheduleImageUrl ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <img 
                src={scheduleImageUrl} 
                alt="Horario" 
                draggable={false}
                style={{ 
                  transform: `translate(${imgPos.x}px, ${imgPos.y}px) scale(${imgScale})`, 
                  transformOrigin: 'center',
                  transition: isDraggingImg.current ? 'none' : 'transform 100ms',
                  maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', 
                  borderRadius: 8, boxShadow: '0 16px 48px rgba(0,0,0,0.4)' 
                }} 
              />
              <div style={{ position: 'absolute', bottom: 20, right: 20, padding: '8px 12px', background: 'var(--surface-elevated)', backdropFilter: 'blur(10px)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-soft)' }}>
                <Move size={14} /> Arrastra para mover • Scroll para zoom
              </div>
            </div>
          ) : (
            <div onClick={() => imgInputRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: 60, borderRadius: 20, border: '2px dashed var(--border-strong)', cursor: 'pointer', transition: 'border-color 200ms', maxWidth: 420 }}>
              <ImageIcon size={48} style={{ color: 'var(--text-muted)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Sube la imagen de tu horario</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>PNG o JPG de tu universidad.</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Hora Inicio</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input type="number" value={startHour} min={0} max={23} onChange={e => setStartHour(Number(e.target.value))} style={{ width: '100%', height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 44px', color: 'var(--text-primary)', fontSize: 16, outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Hora Fin</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input type="number" value={endHour} min={0} max={23} onChange={e => setEndHour(Number(e.target.value))} style={{ width: '100%', height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 44px', color: 'var(--text-primary)', fontSize: 16, outline: 'none' }} />
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

      {/* Manual Grid Tab */}
      {scheduleTab === 'manual' && isSetupDone && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Grid Area — times are inline within each block, no separate column */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: 'var(--bg-primary)' }}>
            {[0, 1, 2, 3, 4].map(di => (
              <div key={di} style={{ borderRight: '1px solid var(--border-soft)', minWidth: 180 }}>
                <div style={{ padding: '16px 0', textAlign: 'center', borderBottom: '1px solid var(--border-soft)', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{'Lunes_Martes_Miércoles_Jueves_Viernes'.split('_')[di]}</div>
                </div>
                <div style={{ position: 'relative' }}>
                  {gridBlocks.map((block) => {
                    const blockMins = timeToMins(block.start);
                    const blockEndMins = blockMins + block.duration;
                    const endStr = minsToTime(blockEndMins);
                    
                    const cls = classes.find(c => c.dayOfWeek === di && timeToMins(c.startTime) <= blockMins && timeToMins(c.endTime) >= blockEndMins);
                    
                    return (
                      <div 
                        key={block.id} 
                        onClick={() => {
                          if (cls) {
                            setEditingClass(cls);
                            setAddDefaults(null);
                            setShowAddModal(true);
                          } else {
                            setAddDefaults({ dayOfWeek: di, start: block.start, end: endStr });
                            setEditingClass(null);
                            setShowAddModal(true);
                          }
                        }}
                        style={{ height: Math.max(60, block.duration * 1.5), borderBottom: '1px dashed var(--border-soft)', position: 'relative', cursor: 'pointer', transition: 'background 200ms' }}
                        onMouseEnter={e => !cls && (e.currentTarget.style.background = 'var(--surface-hover)')}
                        onMouseLeave={e => !cls && (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Time label inline at top of each block */}
                        <div style={{ position: 'absolute', top: 2, left: 6, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", opacity: cls ? 0.5 : 0.8, zIndex: 1 }}>
                          {block.start}
                        </div>
                        {cls && (
                          <div style={{ 
                            position: 'absolute', inset: '2px 4px', borderRadius: 10, padding: '10px 12px', 
                            background: cls.type === 'break' ? 'var(--surface-elevated)' : cls.type === 'meal' ? 'rgba(245,158,11,0.05)' : `${cls.color}15`, 
                            border: `1px solid ${cls.type === 'break' ? 'var(--border-strong)' : cls.type === 'meal' ? 'rgba(245,158,11,0.2)' : `${cls.color}40`}`, 
                            borderLeft: `4px solid ${cls.type === 'break' ? 'var(--text-muted)' : cls.type === 'meal' ? '#f59e0b' : cls.color}`, 
                            overflow: 'hidden', zIndex: 2, display: 'flex', flexDirection: 'column'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: cls.type === 'break' ? 'var(--text-secondary)' : cls.type === 'meal' ? '#f59e0b' : cls.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {cls.type === 'break' && <Coffee size={14} />}
                              {cls.type === 'meal' && <Utensils size={14} />}
                              {cls.title}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {cls.startTime} - {cls.endTime}
                            </div>
                            {cls.room && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{cls.room}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
            onUpdateClasses(classes.filter(c => c.id !== id));
            setShowAddModal(false);
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

  const handleSubmit = () => {
    if (!title.trim()) return;
    
    const baseId = editing?.id || crypto.randomUUID();
    const newClasses: ScheduleClass[] = [];

    if (repeatDaily && (type === 'break' || type === 'meal')) {
      for (let i = 0; i < 5; i++) {
        newClasses.push({
          id: i === day ? baseId : crypto.randomUUID(),
          title: title.trim(),
          dayOfWeek: i,
          startTime: start,
          endTime: end,
          color,
          type
        });
      }
    } else {
      newClasses.push({
        id: baseId,
        title: title.trim(),
        courseId: courseId || undefined,
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        room,
        teacher,
        color,
        type
      });
    }

    onAdd(newClasses);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div style={{ width: 480, background: 'var(--surface)', borderRadius: 24, border: '1px solid var(--border-soft)', padding: 36, boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.02em' }}>{editing ? 'Editar Bloque' : 'Añadir al Horario'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing && <button onClick={() => onDelete(editing.id)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /></button>}
            <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'var(--surface-elevated)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {(['class', 'break', 'meal'] as const).map(t => (
            <button 
              key={t} onClick={() => setType(t)} 
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border-soft)'}`, background: type === t ? 'rgba(225,29,72,0.05)' : 'var(--surface-elevated)', color: type === t ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 200ms' }}
            >
              {t === 'class' ? 'Clase' : t === 'break' ? 'Descanso' : 'Comida'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
          <input type="text" placeholder="Título (Ej: Cálculo I, Almuerzo...)" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 15, outline: 'none' }} autoFocus />
          
          {type === 'class' && (
            <select value={courseId} onChange={e => { setCourseId(e.target.value); const c = courses.find(x => x.id === e.target.value); if (c) setColor(c.color); }} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
              <option value="">Selecciona materia (opcional)</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="time" value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 44px', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px 0 44px', color: 'var(--text-primary)' }} />
            </div>
          </div>

          {(type === 'break' || type === 'meal') && !editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 16px', background: 'var(--surface-elevated)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
              <input type="checkbox" checked={repeatDaily} onChange={e => setRepeatDaily(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Repetir a esta misma hora todos los días</span>
            </label>
          )}

          {type === 'class' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <input type="text" placeholder="Aula (Ej: A-202)" value={room} onChange={e => setRoom(e.target.value)} style={{ height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', fontSize: 14 }} />
              <div style={{ position: 'relative' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                <div style={{ height: 48, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 6, background: color, boxShadow: `0 0 12px ${color}60` }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Color</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSubmit} className="btn-primary" style={{ width: '100%', height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700 }}>
          {editing ? 'Guardar Cambios' : 'Añadir'}
        </button>
      </div>
    </div>
  );
}
