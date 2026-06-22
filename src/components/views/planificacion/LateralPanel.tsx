import React from 'react';
import { X, Calendar, Clock, BookOpen, FileText, ExternalLink, Trash2, CheckCircle2, Link as LinkIcon, Repeat, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlanEvent } from './EventModal';
import { fmtTimeRange, useApp } from '../../../store/AppContext';

export type SelectedItem = 
  | { type: 'day'; date: Date; events: PlanEvent[]; tasks: any[] }
  | { type: 'event'; event: PlanEvent }
  | { type: 'task'; task: any };

interface LateralPanelProps {
  item: SelectedItem | null;
  onClose: () => void;
  onSelectEvent?: (ev: PlanEvent) => void;
  onEditEvent?: (ev: PlanEvent) => void;
  onDeleteEvent?: (evId: string) => void;
  onViewTask?: (taskId: string) => void;
  onAddEvent?: (date: Date) => void;
}

export default function LateralPanel({ item, onClose, onSelectEvent, onEditEvent, onDeleteEvent, onViewTask, onAddEvent }: LateralPanelProps) {
  const { settings } = useApp();
  const tf = settings?.timeFormat;
  if (!item) return null;

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
        onClick={onClose} 
      />
      
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          bottom: 0, 
          right: 0, 
          width: 440, // slightly wider for breathing room
          background: 'var(--surface)', 
          borderLeft: '1px solid var(--border-soft)',
          zIndex: 1300,
          boxShadow: '-32px 0 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
        
        {/* Header */}
        <div style={{ padding: '28px 36px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {item.type === 'day' && 'Agenda del día'}
            {item.type === 'event' && 'Detalle del Evento'}
            {item.type === 'task' && 'Detalle de Tarea'}
          </div>
          <button 
            onClick={onClose} 
            style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '36px' }}>
          {item.type === 'day' && (
            <DayDetails item={item} onSelectEvent={onSelectEvent} onViewTask={onViewTask} timeFormat={tf} onAddEvent={onAddEvent} />
          )}
          {item.type === 'event' && (
            <EventDetails item={item} onEdit={onEditEvent} onDelete={onDeleteEvent} timeFormat={tf} />
          )}
          {item.type === 'task' && (
            <TaskDetails item={item} onViewTask={onViewTask} />
          )}
        </div>
      </div>
    </>
  );
}

function DayDetails({ item, onSelectEvent, onViewTask, timeFormat, onAddEvent }: { item: Extract<SelectedItem, {type: 'day'}>, onSelectEvent?: (ev: PlanEvent) => void, onViewTask?: (taskId: string) => void, timeFormat?: '24h' | '12h', onAddEvent?: (date: Date) => void }) {
  const { date, events, tasks } = item;
  const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es });
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <div>
        <h2 style={{ fontSize: 34, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", textTransform: 'capitalize', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {formattedDate}
        </h2>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, fontWeight: 400 }}>
          {events.length} eventos programados y {tasks.length} entregas
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {events.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={13} /> Eventos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map(ev => (
                <div 
                  key={ev.id} 
                  onClick={() => onSelectEvent?.(ev)}
                  style={{ padding: '16px 20px', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 14, borderLeft: `3px solid ${ev.color}`, cursor: 'pointer', transition: 'all 200ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-elevated)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} /> {ev.allDay ? 'Todo el día' : fmtTimeRange(ev.startTime, ev.endTime, timeFormat)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={13} /> Entregas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => onViewTask?.(t.id)}
                  style={{ padding: '16px 20px', background: 'var(--surface-elevated)', border: '1px dashed var(--border-soft)', borderRadius: 14, borderLeft: `3px solid ${t.courseColor || 'var(--text-muted)'}`, cursor: 'pointer', transition: 'all 200ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-elevated)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={13} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.course || 'Sin materia'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.2, strokeWidth: 1 }} />
            <div style={{ fontSize: 18, fontWeight: 300, fontFamily: "'Outfit',sans-serif" }}>Día libre</div>
            <div style={{ fontSize: 14, marginTop: 8, opacity: 0.7 }}>No hay eventos ni entregas programadas.</div>
          </div>
        )}

        <button
          onClick={() => onAddEvent?.(date)}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            height:42, borderRadius:12, padding:'0 24px',
            fontSize:13, fontWeight:700, fontFamily:"'Outfit',sans-serif",
            border:'none', cursor:'pointer',
            background:'var(--accent)', color:'#fff',
            boxShadow:'0 4px 15px var(--accent-dim)',
            transition:'all 200ms', marginTop:8,
          }}
          onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.15)'}
          onMouseLeave={e=>e.currentTarget.style.filter='none'}
        >
          <Plus size={16}/> Agregar Evento
        </button>
      </div>
    </div>
  );
}

function EventDetails({ item, onEdit, onDelete, timeFormat }: { item: Extract<SelectedItem, {type: 'event'}>, onEdit?: (ev: PlanEvent) => void, onDelete?: (evId: string) => void, timeFormat?: '24h' | '12h' }) {
  const { event } = item;

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, height: '100%' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: event.color, boxShadow: `0 0 16px ${event.color}80` }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: event.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evento programado</span>
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", lineHeight: 1.1, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
          {event.title}
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <DetailRow icon={<Calendar size={18} strokeWidth={1.5} />} label="Fecha" value={(()=>{try{return format(new Date(event.date+'T12:00:00'),"EEEE d 'de' MMMM yyyy",{locale:es})}catch{return '—'}})()} />
        <DetailRow icon={<Clock size={18} strokeWidth={1.5} />} label="Hora" value={event.allDay ? 'Todo el día' : fmtTimeRange(event.startTime, event.endTime, timeFormat)} />
        {event.repeat !== 'none' && <DetailRow icon={<Repeat size={18} strokeWidth={1.5} />} label="Repetición" value={event.repeat === 'daily' ? 'Diaria' : event.repeat === 'weekly' ? 'Semanal' : 'Días específicos'} subValue={event.repeatUntil ? `Hasta el ${(()=>{try{return format(new Date(event.repeatUntil+'T12:00:00'),'d MMM yyyy')}catch{return '—'}})()}` : undefined} />}
      </div>

      {event.description && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Notas</div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--surface-elevated)', padding: 20, borderRadius: 16, border: '1px solid var(--border-soft)', fontWeight: 400, whiteSpace: 'pre-wrap' }}>
            {event.description}
          </div>
        </div>
      )}

      {event.attachments && event.attachments.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Materiales y Enlaces</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {event.attachments.map((file, i) => (
              <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 14, textDecoration: 'none', transition: 'all 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-elevated)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ padding: 10, background: 'var(--surface)', borderRadius: 10, color: file.type === 'link' ? '#3b82f6' : 'var(--accent)', border: '1px solid var(--border-soft)' }}>
                    {file.type === 'link' ? <LinkIcon size={18} /> : <FileText size={18} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                    {file.size && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{file.size}</div>}
                  </div>
                </div>
                <ExternalLink size={16} style={{ color: 'var(--text-muted)' }} />
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
        <button 
          onClick={() => onEdit?.(event)}
          style={{ width: '100%', padding: '14px 20px', borderRadius: 14, fontSize: 15, fontWeight: 600, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
        >
          Editar Evento
        </button>
        {showDeleteConfirm ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 600, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={() => { onDelete?.(event.id); }} style={{ flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 600, border: 'none', background: 'rgba(225,29,72,0.15)', color: 'var(--accent)', cursor: 'pointer' }}>
              Confirmar Eliminar
            </button>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ width: '100%', padding: '16px', borderRadius: 14, fontSize: 15, fontWeight: 600, border: '1px solid rgba(225,29,72,0.2)', background: 'rgba(225,29,72,0.06)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Trash2 size={16} /> Eliminar Evento
          </button>
        )}
      </div>
    </div>
  );
}

function TaskDetails({ item, onViewTask }: { item: Extract<SelectedItem, {type: 'task'}>, onViewTask?: (taskId: string) => void }) {
  const { task } = item;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, height: '100%' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: task.courseColor || 'var(--text-muted)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: task.courseColor || 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{task.course || 'Tarea'}</span>
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Outfit',sans-serif", lineHeight: 1.1, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
          {task.title}
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {task.dueDate && <DetailRow icon={<Calendar size={18} strokeWidth={1.5} />} label="Fecha de entrega" value={(()=>{try{return format(new Date(task.dueDate+'T12:00:00'),"EEEE d 'de' MMMM yyyy",{locale:es})}catch{return '—'}})()} />}
        <DetailRow icon={<CheckCircle2 size={18} strokeWidth={1.5} />} label="Estado" value={task.status === 'completado' ? 'Completado' : task.status === 'en-curso' ? 'En curso' : 'Pendiente'} />
      </div>

      <button 
        onClick={() => onViewTask?.(task.id)}
        className="btn-primary"
        style={{ marginTop: 'auto', width: '100%', padding: '16px', borderRadius: 14, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        Abrir en Entregas <ExternalLink size={16} />
      </button>
    </div>
  );
}

function DetailRow({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-soft)', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {subValue && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subValue}</div>}
      </div>
    </div>
  );
}
