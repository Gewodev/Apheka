import React from 'react';
import { X, Calendar, Clock, BookOpen, FileText, ExternalLink, Trash2, CheckCircle2, Link as LinkIcon, Repeat, Plus, Star, Video, Music, Image, FileSpreadsheet, File, Globe } from 'lucide-react';
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
  const { settings, tasks } = useApp();
  const tf = settings?.timeFormat;
  if (!item) return null;

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
        onClick={onClose} 
      />
      
      <div className="bento-card"
        style={{ 
          position: 'fixed', 
          top: 0, 
          bottom: 0, 
          right: 0, 
          width: 440, padding: 0,
          background: 'var(--surface)', 
          borderLeft: '1px solid var(--border-soft)',
          borderRight: 'none', borderTop: 'none', borderBottom: 'none',
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
            <EventDetails item={item} onEdit={onEditEvent} onDelete={onDeleteEvent} timeFormat={tf} tasks={tasks} onViewTask={onViewTask} />
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

const GOAL_KEY = 'owa_planned_goal';

function EventDetails({ item, onEdit, onDelete, timeFormat, tasks, onViewTask }: { item: Extract<SelectedItem, {type: 'event'}>, onEdit?: (ev: PlanEvent) => void, onDelete?: (evId: string) => void, timeFormat?: '24h' | '12h', tasks?: any[], onViewTask?: (taskId: string) => void }) {
  const { event } = item;

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [goalId, setGoalId] = React.useState(() => localStorage.getItem(GOAL_KEY) || '');
  const isGoal = goalId === event.id;

  const toggleGoal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGoal) {
      localStorage.removeItem(GOAL_KEY);
      setGoalId('');
    } else {
      localStorage.setItem(GOAL_KEY, event.id);
      setGoalId(event.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, height: '100%' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: event.color, boxShadow: `0 0 16px ${event.color}80` }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: event.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evento programado</span>
          <button onClick={toggleGoal} title={isGoal ? 'Quitar meta planificada' : 'Marcar como meta planificada'}
            style={{ marginLeft: 'auto', padding: 6, borderRadius: 8, background: isGoal ? `${event.color}18` : 'transparent', border: `1px solid ${isGoal ? event.color : 'transparent'}`, cursor: 'pointer', color: isGoal ? event.color : 'var(--text-tertiary)', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = isGoal ? `${event.color}25` : 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isGoal ? `${event.color}18` : 'transparent'; }}>
            <Star size={16} fill={isGoal ? event.color : 'none'} />
          </button>
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

      {event.taskId && (() => {
        const linkedTask = tasks?.find(t => t.id === event.taskId);
        if (!linkedTask) return null;
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Tarea vinculada</div>
            <div
              onClick={() => onViewTask?.(linkedTask.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:'var(--surface-elevated)', border:'1px solid var(--border-soft)', borderRadius:14, cursor:'pointer', transition:'all 200ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-elevated)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
            >
              <div style={{ padding:10, background:`${linkedTask.courseColor||'var(--text-muted)'}15`, borderRadius:10, border:`1px solid ${linkedTask.courseColor||'var(--text-muted)'}25` }}>
                <CheckCircle2 size={18} style={{ color: linkedTask.courseColor || 'var(--text-muted)' }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, color:'var(--text-primary)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{linkedTask.title}</div>
                {linkedTask.dueDate && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Vence: {(() => { try { return format(new Date(linkedTask.dueDate+'T12:00:00'), "d 'de' MMM", { locale: es }); } catch { return '—'; } })()}</div>}
              </div>
              <ExternalLink size={16} style={{ color:'var(--text-muted)', flexShrink:0 }} />
            </div>
          </div>
        );
      })()}

      {event.attachments && event.attachments.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={13} /> Materiales y Enlaces
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {event.attachments.map((file, i) => {
              const fType = (() => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const typeMap: Record<string, string> = {
                  pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
                  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video',
                  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
                  doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt',
                  txt: 'text', csv: 'text', json: 'text', md: 'text', xml: 'text',
                  zip: 'zip', rar: 'zip', '7z': 'zip',
                };
                if (typeMap[ext]) return typeMap[ext];
                if (file.url.includes('youtube.com') || file.url.includes('youtu.be')) return 'video';
                if (file.url.includes('drive.google.com')) return 'drive';
                if (file.type === 'link') return 'link';
                return 'other';
              })();
              const isYouTube = fType === 'video' && (file.url.includes('youtube.com') || file.url.includes('youtu.be'));
              const isDrive = fType === 'drive';
              const isAudio = fType === 'audio';
              const isWeb = fType === 'link' && !isYouTube && !isDrive;
              const isExcel = fType === 'xls';
              const isWord = fType === 'doc';
              const isPPT = fType === 'ppt';
              const isPdf = fType === 'pdf';
              const isImage = fType === 'image';
              const isLocal = !file.url.startsWith('http') && !file.url.startsWith('blob:') && !file.url.startsWith('data:');
              let domain = '';
              if (isWeb) { try { domain = new URL(file.url).hostname; } catch {} }

              const openFile = (url: string) => {
                if ((window as any).__TAURI__?.shell?.open) {
                  (window as any).__TAURI__.shell.open(url).catch(() => window.open(url, '_blank', 'noopener,noreferrer'));
                } else {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              };

              const handleCardClick = (e: React.MouseEvent) => {
                e.preventDefault();
                if (isPdf) openFile(file.url);
                else if (isImage) openFile(file.url);
                else if (isYouTube) {
                  const v = file.url.includes('watch?v=') ? file.url.split('v=')[1]?.split('&')[0]
                    : file.url.includes('youtu.be/') ? file.url.split('youtu.be/')[1]?.split('?')[0] : '';
                  if (v) openFile(`https://www.youtube.com/watch?v=${v}`);
                }
                else if (isWeb || isDrive) openFile(file.url);
                else if (isWord || isExcel || isPPT) openFile(file.url);
                else if (isAudio) openFile(file.url);
                else if (file.url.startsWith('http')) openFile(file.url);
                else if (isLocal) openFile(file.url);
              };

              const s = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;
              let iconEl: React.ReactNode;
              let badgeColor = '#888';
              if (isWord) { badgeColor = '#2563EB'; iconEl = s('M23.004 1.5q.41 0 .703.293t.293.703v19.008q0 .41-.293.703t-.703.293H6.996q-.41 0-.703-.293T6 21.504V18H.996q-.41 0-.703-.293T0 17.004V6.996q0-.41.293-.703T.996 6H6V2.496q0-.41.293-.703t.703-.293zM6.035 11.203l1.442 4.735h1.64l1.57-7.876H9.036l-.937 4.653-1.325-4.5H5.38l-1.406 4.523-.938-4.675H1.312l1.57 7.874h1.641zM22.5 21v-3h-15v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3h-15v3Z', '#2563EB'); }
              else if (isExcel) { badgeColor = '#10B981'; iconEl = s('M23 1.5q.41 0 .7.3.3.29.3.7v19q0 .41-.3.7-.29.3-.7.3H7q-.41 0-.7-.3-.3-.29-.3-.7V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h5V2.5q0-.41.3-.7.29-.3.7-.3zM6 13.28l1.42 2.66h2.14l-2.38-3.87 2.34-3.8H7.46l-1.3 2.4-.05.08-.04.09-.64-1.28-.66-1.29H2.59l2.27 3.82-2.48 3.85h2.16zM14.25 21v-3H7.5v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3H7.5v3zm8.25 15v-3h-6.75v3zm0-4.5v-3.75h-6.75v3.75zm0-5.25V7.5h-6.75v3.75zm0-5.25V3h-6.75v3Z', '#10B981'); }
              else if (isPPT) { badgeColor = '#F97316'; iconEl = s('M13.5 1.5q1.453 0 2.795.375 1.342.375 2.508 1.06 1.166.686 2.12 1.641.956.955 1.641 2.121.686 1.166 1.061 2.508Q24 10.547 24 12q0 1.453-.375 2.795-.375 1.342-1.06 2.508-.686 1.166-1.641 2.12-.955.956-2.121 1.641-1.166.686-2.508 1.061-1.342.375-2.795.375-1.29 0-2.52-.305-1.23-.304-2.337-.884-1.108-.58-2.063-1.418-.955-.838-1.693-1.893H.997q-.411 0-.704-.293T0 17.004V6.996q0-.41.293-.703T.996 6h3.89q.739-1.055 1.694-1.893.955-.837 2.063-1.418 1.107-.58 2.337-.884Q12.21 1.5 13.5 1.5zm.75 1.535v8.215h8.215q-.14-1.64-.826-3.076-.686-1.436-1.782-2.531-1.095-1.096-2.537-1.782-1.441-.685-3.07-.826zm-5.262 7.57q0-.68-.228-1.166-.229-.486-.627-.79-.399-.305-.938-.446-.539-.14-1.172-.14H2.848v7.863h1.84v-2.742H5.93q.574 0 1.119-.17t.978-.493q.434-.322.698-.802.263-.48.263-1.114zM13.5 21q1.172 0 2.262-.287t2.056-.82q.967-.534 1.776-1.278.808-.744 1.418-1.664.61-.92.984-1.986.375-1.067.469-2.227h-9.703V3.035q-1.735.14-3.27.908T6.797 6h4.207q.41 0 .703.293t.293.703v10.008q0 .41-.293.703t-.703.293H6.797q.644.715 1.412 1.271.768.557 1.623.944.855.387 1.781.586Q12.54 21 13.5 21zM5.812 9.598q.575 0 .915.228.34.229.34.838 0 .27-.124.44-.123.17-.31.275-.188.105-.422.146-.234.041-.445.041H4.687V9.598Z', '#F97316'); }
              else if (isPdf) { badgeColor = '#EF4444'; iconEl = s('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704zm-1.42 1.03c-.107.532-.64.887-1.384.887-.213 0-.39-.036-.604-.071-1.348-.32-2.626-.994-3.903-2.059a17.717 17.717 0 0 1 2.98-.248c.746 0 1.385.035 1.81.142.497.106 1.278.426 1.1 1.348zm-7.524-1.668a38.01 38.01 0 0 0-2.945.674 39.68 39.68 0 0 0-2.52.745 40.05 40.05 0 0 0 1.207-2.555c.426-.994.78-2.023 1.136-2.981.354.603.745 1.207 1.135 1.739a50.127 50.127 0 0 0 1.987 2.378zM10.038 1.46a.768.768 0 0 1 .674-.425c.745 0 .887.851.887 1.526 0 1.135-.355 2.874-.958 4.861-1.03-2.768-1.1-5.074-.603-5.962zM6.134 17.997c-1.81 2.981-3.549 4.826-4.613 4.826a.872.872 0 0 1-.532-.177c-.213-.213-.32-.461-.249-.745.213-1.065 2.271-2.555 5.394-3.904Z', '#EF4444'); }
              else if (isYouTube) { badgeColor = '#EF4444'; iconEl = s('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#EF4444'); }
              else if (isDrive) { badgeColor = '#4285F4'; iconEl = <svg viewBox="0 0 24 24" width={17} height={17} style={{ flexShrink: 0, display: 'block' }}><path fill="#4285F4" d="M12 1.5l9 15.6H3L12 1.5z"/><path fill="#34A853" d="M12 22.5L3 17.1h18L12 22.5z"/><path fill="#FBBC05" d="M3 17.1l3-5.2 3 5.2H3z"/><path fill="#EA4335" d="M18 17.1l-3-5.2-3 5.2h6z"/></svg>; }
              else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={13} />; }
              else if (isImage) { badgeColor = '#F59E0B'; iconEl = <Image size={13} />; }
              else if (isWeb) {
                badgeColor = '#10B981';
                iconEl = (
                  <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt="" style={{ width: 16, height: 16, borderRadius: 2 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                );
              }
              else { iconEl = <File size={13} />; }

              return (
                <div key={i} onClick={handleCardClick}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 7,
                           background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)',
                           cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${badgeColor}40`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: `${badgeColor}14`,
                               display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                               color: badgeColor, position: 'relative' }}>
                    {iconEl}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginTop: 1 }}>
                      {isWeb ? domain : isYouTube ? 'YouTube' : isDrive ? 'Google Drive' : file.size || 'Enlace'}
                    </span>
                  </div>
                  <ExternalLink size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.5 }} />
                </div>
              );
            })}
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
                {task.dueDate && <DetailRow icon={<Calendar size={18} strokeWidth={1.5} />} label="Fecha de entrega" value={(()=>{try{const hasTime=task.dueDate.includes('T');const d=hasTime?new Date(task.dueDate):new Date(task.dueDate+'T12:00:00');return format(d,"EEEE d 'de' MMMM yyyy"+(hasTime?" 'a las' HH:mm":""),{locale:es})}catch{return '—'}})()} />}
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
