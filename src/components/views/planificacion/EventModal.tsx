import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, CalendarClock, Clock, Plus, Trash2, Repeat, Check, Music, Image, File, Globe, Upload, Link2, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

import { GoogleClassroomIcon, GoogleDriveIcon, GoogleDocsIcon, GoogleSheetsIcon, GoogleSlidesIcon, GoogleFormsIcon, WordIcon, ExcelIcon, PowerPointIcon } from '../../ui/GoogleIcons';
import { useApp } from '../../../store/AppContext';
import { openFileSmart, pickAndPersistFile } from '../../../lib/openFileSmart';
import { useMaterialMenu } from '../../ui/MaterialContextMenu';
import { isTauri } from '@tauri-apps/api/core';

const s = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;

// ─── Iconos de materiales IDÉNTICOS a Cursos/Tareas (misma cadena de detección por URL/extensión) ───
function getMatBadge(url: string, name: string) {
  const isLink = url.startsWith('http');
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || url.startsWith('data:image');
  const isPdf = ext === 'pdf';
  const isDoc = ['doc', 'docx'].includes(ext);
  const isXls = ['xls', 'xlsx', 'csv'].includes(ext);
  const isPpt = ['ppt', 'pptx'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext) || url.startsWith('data:audio');
  const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext) || url.startsWith('data:video');
  const isYouTube = isLink && (url.includes('youtube.com') || url.includes('youtu.be'));
  const isClassroom = isLink && url.includes('classroom.google.com');
  const isDrive = isLink && url.includes('drive.google.com');
  const isGoogleDocs = isLink && url.includes('docs.google.com');
  const isGoogleSheets = isLink && url.includes('sheets.google.com');
  const isGoogleSlides = isLink && url.includes('slides.google.com');
  const isGoogleForms = isLink && url.includes('forms.google.com');
  const isWeb = isLink && !isYouTube && !isDrive && !isClassroom && !isGoogleDocs && !isGoogleSheets && !isGoogleSlides && !isGoogleForms;

  let iconEl: React.ReactNode;
  let badgeColor = '#888';
  let subtitle = 'Archivo';
  if (isDoc) { badgeColor = '#2563EB'; iconEl = <WordIcon />; subtitle = 'Word'; }
  else if (isGoogleDocs) { badgeColor = '#2563EB'; iconEl = <GoogleDocsIcon />; subtitle = 'Google Docs'; }
  else if (isXls) { badgeColor = '#10B981'; iconEl = <ExcelIcon />; subtitle = 'Excel'; }
  else if (isGoogleSheets) { badgeColor = '#10B981'; iconEl = <GoogleSheetsIcon />; subtitle = 'Google Sheets'; }
  else if (isPpt) { badgeColor = '#F97316'; iconEl = <PowerPointIcon />; subtitle = 'PowerPoint'; }
  else if (isGoogleSlides) { badgeColor = '#F97316'; iconEl = <GoogleSlidesIcon />; subtitle = 'Google Slides'; }
  else if (isPdf) { badgeColor = '#EF4444'; iconEl = s('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704z', '#EF4444'); subtitle = 'PDF'; }
  else if (isYouTube) { badgeColor = '#EF4444'; iconEl = s('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#EF4444'); subtitle = 'YouTube'; }
  else if (isClassroom) { badgeColor = '#0F9D58'; iconEl = <GoogleClassroomIcon />; subtitle = 'Classroom'; }
  else if (isDrive) { badgeColor = '#4285F4'; iconEl = <GoogleDriveIcon />; subtitle = 'Google Drive'; }
  else if (isGoogleForms) { badgeColor = '#7C3AED'; iconEl = <GoogleFormsIcon />; subtitle = 'Google Forms'; }
  else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={17} />; subtitle = 'Audio'; }
  else if (isImg) { badgeColor = '#F59E0B'; iconEl = <Image size={17} />; subtitle = 'Imagen'; }
  else if (isVideo) { badgeColor = '#EC4899'; iconEl = <File size={17} />; subtitle = 'Video'; }
  else if (isWeb) {
    badgeColor = '#10B981';
    let domain = '';
    try { domain = new URL(url).hostname; } catch {}
    subtitle = domain;
    iconEl = (
      <span style={{ position: 'relative', width: 17, height: 17, display: 'inline-flex', flexShrink: 0 }}>
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" style={{ width: 17, height: 17, borderRadius: 3, position: 'absolute', inset: 0 }}
          onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.link-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
        <span className="link-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><Link2 size={12} /></span>
      </span>
    );
  }
  else iconEl = <File size={17} />;
  return { iconEl, badgeColor, subtitle };
}

async function fetchEventPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch { return null; }
}

export interface PlanEvent {
  id: string;
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  courseId?: string;
  color: string;
  description?: string;
  taskId?: string;
  googleEventId?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'custom_days';
  repeatDays?: number[]; // 0=Mon..6=Sun if custom_days
  repeatUntil?: string; // Limit for repetition
  exceptions?: string[]; // Occurrence dates excluded from a recurring series (YYYY-MM-DD)
  occurrenceOverrides?: Record<string, Partial<PlanEvent>>; // Cambios de UNA ocurrencia por fecha (no se crea otro evento)
  attachments?: { type: 'link' | 'file'; name: string; url: string; size?: string }[];
}

interface EventModalProps {
  event: PlanEvent | null;
  defaults: Partial<PlanEvent>;
  courses: { id: string; name: string; color: string }[];
  tasks: { id: string; title: string; courseColor: string; dueDate?: string }[];
  occurrenceDate?: string | null; // The specific date of the occurrence being edited
  onClose: () => void;
  onSave: (ev: PlanEvent) => void;
  onSaveOne?: (override: Partial<PlanEvent>, originalId: string, occurrenceDate: string) => void;
  onDelete: (id: string) => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function EventModal({
  event,
  defaults,
  courses,
  tasks,
  occurrenceDate,
  onClose,
  onSave,
  onSaveOne,
  onDelete,
  addNotification
}: EventModalProps) {
  const th = document.documentElement.getAttribute('data-theme');
  const isDarkSelect = !th || th === 'oscuro' || th === 'vibrante';
  const selectBorder = isDarkSelect ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)';
  const { setPipUrl } = useApp();
  const matMenu = useMaterialMenu((m) => addNotification(m, 'error'));
  const isRecurringEdit = !!(event && event.repeat !== 'none');
  const [showScopePrompt, setShowScopePrompt] = useState(false);
  const [pendingEv, setPendingEv] = useState<PlanEvent | null>(null);
  const [title, setTitle] = useState(event?.title || defaults.title || '');
  const [allDay, setAllDay] = useState(event?.allDay ?? defaults.allDay ?? false);
  const [date, setDate] = useState(occurrenceDate || event?.date || defaults.date || format(new Date(), 'yyyy-MM-dd'));
  const [start, setStart] = useState(event?.startTime || defaults.startTime || '09:00');
  // Duración en minutos (la hora de FIN se CALCULA: inicio + duración)
  const [duration, setDuration] = useState<number>(() => {
    if (event?.startTime && event?.endTime) {
      const [sh, sm] = event.startTime.split(':').map(Number);
      const [eh, em] = event.endTime.split(':').map(Number);
      const d = (eh * 60 + em) - (sh * 60 + sm);
      if (d > 0) return d;
    }
    return 60;
  });
  const computeEnd = (s: string, mins: number): string => {
    const [h, m] = s.split(':').map(Number);
    const t = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };
  const end = computeEnd(start, duration);
  const shiftStart = (unit: 'h' | 'm', dir: number) => {
    const [h, m] = start.split(':').map(Number);
    if (unit === 'h') { const nh = (h + dir + 24) % 24; setStart(`${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`); }
    else { const nm = (m + dir * 5 + 60) % 60; setStart(`${String(h).padStart(2, '0')}:${String(nm).padStart(2, '0')}`); }
  };
  const [courseId, setCourseId] = useState(event?.courseId || defaults.courseId || '');
  const [color, setColor] = useState(event?.color || (defaults.courseId ? courses.find(c => c.id === defaults.courseId)?.color || '#E11D48' : '#E11D48'));
  const [desc, setDesc] = useState(event?.description || '');
  const [repeat, setRepeat] = useState<PlanEvent['repeat']>(event?.repeat || 'none');
  const [repeatDays, setRepeatDays] = useState<number[]>(event?.repeatDays || []);
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil || '');
  const [taskId, setTaskId] = useState(event?.taskId || '');
  const [attachments, setAttachments] = useState<{ type: 'link' | 'file'; name: string; url: string; size?: string }[]>(event?.attachments || []);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (courseId) {
      const c = courses.find(x => x.id === courseId);
      if (c) setColor(c.color);
    }
  }, [courseId, courses]);

  const taskMismatch = useMemo(() => {
    if (!taskId) return null;
    const t = tasks.find(x => x.id === taskId);
    if (!t || !t.dueDate) return null;
    const td = t.dueDate.slice(0, 10);
    const hasTime = t.dueDate.includes('T');
    const tt = hasTime ? t.dueDate.slice(11, 16) : null;
    if (td === date && (!hasTime || allDay || tt === start)) return null;
    return { taskDate: td, taskTime: tt, hasTime };
  }, [taskId, tasks, date, start, allDay]);

  const syncTaskToEvent = () => {
    if (!taskMismatch) return;
    setDate(taskMismatch.taskDate);
    if (taskMismatch.hasTime && taskMismatch.taskTime) {
      if (allDay) setAllDay(false);
      setStart(taskMismatch.taskTime);
    }
  };

  // Generate 15-min intervals
  const timeOptions: string[] = [];
  for (let h = 0; h <= 23; h++) {
    ['00', '15', '30', '45'].forEach(m => timeOptions.push(`${String(h).padStart(2, '0')}:${m}`));
  }

  function handleSave() {
    if (!title.trim()) {
      addNotification('El título es obligatorio', 'error');
      return;
    }
    if (!allDay && start >= end) {
      addNotification('La hora de inicio no puede ser posterior o igual a la de fin', 'error');
      return;
    }
    if (repeat === 'custom_days' && repeatDays.length === 0) {
      addNotification('Selecciona al menos un día de repetición', 'error');
      return;
    }
    if (repeat !== 'none' && !repeatUntil) {
      addNotification('Ponle una fecha de fin a la repetición', 'error');
      return;
    }
    if (repeat !== 'none' && repeatUntil && repeatUntil < date) {
      addNotification('La fecha de fin de repetición no puede ser anterior a la fecha del evento', 'error');
      return;
    }

    const ev: PlanEvent = {
      id: event?.id || crypto.randomUUID(),
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? '00:00' : start,
      endTime: allDay ? '23:59' : computeEnd(start, duration),
      courseId: courseId || undefined,
      color,
      description: desc || undefined,
      repeat,
      repeatDays: repeat === 'custom_days' ? repeatDays : undefined,
      repeatUntil: repeat !== 'none' && repeatUntil ? repeatUntil : undefined,
      taskId: taskId || undefined,
      attachments
    };
    if (event && event.repeat !== 'none') {
      // Detectar si se cambiaron la repetición o el curso — esos siempre aplican a toda la serie
      const repeatChanged = repeat !== event.repeat ||
        JSON.stringify(repeatDays || []) !== JSON.stringify(event.repeatDays || []) ||
        (repeatUntil || '') !== (event.repeatUntil || '');
      const courseChanged = (courseId || '') !== (event.courseId || '');
      const hasOtherChanges = event.title !== title.trim() ||
        event.allDay !== allDay ||
        (allDay ? '00:00' : start) !== event.startTime ||
        (allDay ? '23:59' : computeEnd(start, duration)) !== event.endTime ||
        event.color !== color ||
        (event.description || '') !== desc ||
        (event.taskId || '') !== taskId ||
        JSON.stringify(event.attachments || []) !== JSON.stringify(attachments) ||
        date !== (occurrenceDate || event.date);

      //  - Cambios en repetición o curso → siempre a toda la serie (se limpia el override de esta ocurrencia).
      //  - Evento que era recurrente y ahora no → también a toda la serie.
      //  - Otros cambios en un evento recurrente → ventana de confirmación (mismo evento, override por fecha).
      const forceAll = repeatChanged || courseChanged || (repeat as string) === 'none';
      const occDate = occurrenceDate || event.date;
      if (forceAll) {
        const ovs = { ...(event.occurrenceOverrides || {}) };
        delete ovs[occDate];
        onSave({ ...ev, occurrenceOverrides: Object.keys(ovs).length ? ovs : undefined });
        return;
      }
      if (hasOtherChanges && onSaveOne) {
        setPendingEv(ev);
        setShowScopePrompt(true);
        return;
      }
      if (occurrenceDate) {
        // Edición de una ocurrencia sin cambios reales → cerrar sin tocar la serie
        addNotification('No hay cambios que guardar en esta ocurrencia', 'info');
        return;
      }
    }
    onSave(ev);
  }

  function executeScope(s: 'all' | 'one') {
    if (!pendingEv || !event) return;
    setShowScopePrompt(false);
    const occDate = occurrenceDate || pendingEv.date;
    if (s === 'all') {
      // "A todos": guarda los cambios sobre la base SIEMPRE que no sea un cambio de repetición/curso
      // (esos ya se aplican a toda la serie directamente) — se limpia el override de esta ocurrencia.
      const ovs = { ...(event.occurrenceOverrides || {}) };
      delete ovs[occDate];
      const repeatDaysClean = pendingEv.repeat === 'custom_days' ? pendingEv.repeatDays : undefined;
      const repeatUntilClean = pendingEv.repeat !== 'none' && pendingEv.repeatUntil ? pendingEv.repeatUntil : undefined;
      onSave({ ...pendingEv, occurrenceOverrides: Object.keys(ovs).length ? ovs : undefined, repeatDays: repeatDaysClean, repeatUntil: repeatUntilClean });
    } else {
      // "Solo esta": diff contra la ocurrencia actual (que ya incluye overrides anteriores) → override por fecha
      const cur = event;
      const ov: Partial<PlanEvent> = {};
      if (pendingEv.title !== cur.title) ov.title = pendingEv.title;
      if (pendingEv.allDay !== cur.allDay) ov.allDay = pendingEv.allDay;
      if ((pendingEv.allDay ? '00:00' : pendingEv.startTime) !== (cur.allDay ? '00:00' : cur.startTime)) ov.startTime = pendingEv.startTime;
      if ((pendingEv.allDay ? '23:59' : pendingEv.endTime) !== (cur.allDay ? '23:59' : cur.endTime)) ov.endTime = pendingEv.endTime;
      if (pendingEv.color !== cur.color) ov.color = pendingEv.color;
      if ((pendingEv.description || '') !== (cur.description || '')) ov.description = pendingEv.description;
      if ((pendingEv.taskId || '') !== (cur.taskId || '')) ov.taskId = pendingEv.taskId;
      if ((pendingEv.date || '') !== occDate) ov.date = pendingEv.date;
      if (JSON.stringify(pendingEv.attachments || []) !== JSON.stringify(cur.attachments || [])) ov.attachments = pendingEv.attachments;
      if (onSaveOne) onSaveOne(ov, event.id, occDate);
      else onSave(pendingEv);
    }
    setPendingEv(null);
  }

  const DAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const toggleRepeatDay = (idx: number) => {
    setRepeatDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) {
      addNotification('Ingresa una URL válida', 'error');
      return;
    }
    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    let name = linkName.trim();
    if (!name) {
      try {
        const fetched = await fetchEventPageTitle(url);
        if (fetched) name = fetched;
        else name = url.replace(/^https?:\/\//, '').slice(0, 40);
      } catch { name = url.replace(/^https?:\/\//, '').slice(0, 40); }
    }
    setAttachments([...attachments, { type: 'link', name, url }]);
    setLinkUrl('');
    setLinkName('');
    setShowLinkForm(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments([...attachments, { type: 'file', name: file.name, url: reader.result as string, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` }]);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleAddFileBtn = async () => {
    if (isTauri()) {
      let r: { path: string; name: string } | null;
      try { r = await pickAndPersistFile(); }
      catch { addNotification('No se pudo abrir el selector de archivos', 'error'); return; }
      if (!r) return;
      let size: string | undefined;
      try {
        const { stat } = await import('@tauri-apps/plugin-fs');
        const st = await stat(r.path);
        if (st && st.size) size = `${(st.size / (1024 * 1024)).toFixed(1)} MB`;
      } catch {}
      setAttachments([...attachments, { type: 'file', name: r.name, url: r.path, size }]);
      return;
    }
    fileInputRef.current?.click();
  };

  const openAttachment = (item: { type: 'link' | 'file'; name: string; url: string }) => {
    openFileSmart(item.url, item.name, {
      onMedia: (u, n) => setPipUrl(u, n),
      onError: (m) => addNotification(m, 'error'),
      onMoved: (np) => {
        setAttachments(prev => prev.map(a => a.url === item.url ? { ...a, url: np } : a));
        addNotification('Adjunto actualizado a su nueva ubicación', 'success');
      },
    }).catch(() => addNotification('No se pudo abrir el material', 'error'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div 
        style={{ 
          width: 580, 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          background: 'var(--surface)', 
          border: '1px solid var(--border-soft)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 4, height: 20, borderRadius: 4, background: color, boxShadow: `0 0 12px ${color}60` }} />
            <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight',sans-serif", letterSpacing: '-0.02em' }}>
              {event ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {event && (
              <button onClick={() => onDelete(event.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(225,29,72,0.2)', background: 'rgba(225,29,72,0.05)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 200ms' }}>
                <Trash2 size={13} /> Eliminar
              </button>
            )}
            <button onClick={onClose} style={{ padding: 8, borderRadius: 8, background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Título</label>
            <input 
              autoFocus 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSave()} 
              placeholder="Ej: Reunión de proyecto, Examen final..." 
              style={{ width: '100%', fontSize: 16, height: 48, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 200ms' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--text-secondary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-soft)'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Date & All Day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Fecha</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px 0 40px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10 }}>
                <button 
                  onClick={() => setAllDay(p => !p)} 
                  style={{ width: 40, height: 22, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms', background: allDay ? 'var(--accent)' : 'var(--bg-secondary)', flexShrink: 0 }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 200ms', left: allDay ? 21 : 3, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
                </button>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Todo el día</span>
              </div>
            </div>

            {/* Hora de inicio (stepper dinámico) + Durará → fin calculado */}
            {!allDay && (() => {
              const ChevBtn = ({ dir, unit }: { dir: 1 | -1; unit: 'h' | 'm' }) => (
                <button onClick={() => shiftStart(unit, dir)} tabIndex={-1}
                  title={unit === 'h' ? (dir > 0 ? '+1 hora' : '-1 hora') : (dir > 0 ? '+5 minutos' : '-5 minutos')}
                  style={{ width: '100%', height: 18, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'color 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.color = color; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  {dir > 0 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              );
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Hora de inicio</label>
                    <div tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); shiftStart('h', 1); }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); shiftStart('h', -1); }
                        else if (e.key === 'ArrowRight') { e.preventDefault(); shiftStart('m', 1); }
                        else if (e.key === 'ArrowLeft') { e.preventDefault(); shiftStart('m', -1); }
                      }}
                      title="Flechas: arriba/abajo horas, izquierda/derecha minutos"
                      style={{ display: 'flex', alignItems: 'stretch', borderRadius: 10, border: selectBorder, background: 'var(--surface-elevated)', overflow: 'hidden', outline: 'none' }}
                      onFocus={e => { e.currentTarget.style.borderColor = color; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
                        <ChevBtn dir={1} unit="h" />
                        <span style={{ height: 34, display: 'flex', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                          {String(Number(start.split(':')[0])).padStart(2, '0')}
                        </span>
                        <ChevBtn dir={-1} unit="h" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', width: 16, justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>:</div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
                        <ChevBtn dir={1} unit="m" />
                        <span style={{ height: 34, display: 'flex', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                          {String(Number(start.split(':')[1])).padStart(2, '0')}
                        </span>
                        <ChevBtn dir={-1} unit="m" />
                      </div>
                    </div>
                  </div>
                  <div style={{ width: 118, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, border: '1px solid var(--border-soft)', background: color + '0a' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Termina</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{end}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Durará</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button onClick={() => setDuration(Math.max(5, duration - 5))} title="-5 min"
                      style={{ width: 30, height: 38, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                      <Minus size={13} />
                    </button>
                    <div style={{ width: 66, height: 38, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{duration}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>MIN</span>
                    </div>
                    <button onClick={() => setDuration(Math.min(720, duration + 5))} title="+5 min"
                      style={{ width: 30, height: 38, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}>
                      <Plus size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[15, 30, 45, 60, 90, 120].map((mins: number) => (
                      <button key={mins} onClick={() => setDuration(mins)}
                        style={{ padding: '5px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', border: duration === mins ? '1px solid ' + color : '1px solid var(--border-soft)', background: duration === mins ? color + '14' : 'transparent', color: duration === mins ? color : 'var(--text-muted)', transition: 'all 130ms' }}>
                        {mins}
                      </button>
                    ))}
                  </div>
                </div>
                </div>
              );
            })()}
          </div>

          {/* Repeat */}
          <div style={{ padding: '16px', background: 'var(--surface-elevated)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: repeat === 'custom_days' || repeat !== 'none' ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Repeat size={15} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Repetición</span>
              </div>
              <select value={repeat} onChange={e => setRepeat(e.target.value as any)} style={{ fontSize: 13, height: 32, background: 'var(--bg-secondary)', border: selectBorder, borderRadius: 6, padding: '0 12px', color: 'var(--text-secondary)', outline: 'none' }}>
                <option value="none">Ninguna</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
                <option value="custom_days">Días específicos</option>
              </select>
            </div>
            
            {repeat === 'custom_days' && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
                {DAY_INITIALS.map((d, i) => {
                  const isActive = repeatDays.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleRepeatDay(i)}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isActive ? 'var(--accent)' : 'var(--bg-primary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-soft)'}`,
                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        transition: 'all 200ms',
                        boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none'
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}

            {repeat !== 'none' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Termina el:</span>
                <input type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} style={{ flex: 1, fontSize: 13, height: 32, background: 'var(--bg-secondary)', border: !repeatUntil ? '1px solid #EF444480' : selectBorder, borderRadius: 6, padding: '0 12px', color: 'var(--text-primary)', outline: 'none' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Linking */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Materia</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none' }}>
                  <option value="">Ninguna</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {tasks.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Tarea vinculada</label>
                  <select value={taskId} onChange={e => setTaskId(e.target.value)} style={{ width: '100%', fontSize: 14, height: 44, background: 'var(--surface-elevated)', border: selectBorder, borderRadius: 10, padding: '0 16px', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="">Ninguna</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  {taskMismatch && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', flexShrink: 0, boxShadow: '0 0 10px rgba(245,158,11,0.15)' }}>
                        <CalendarClock size={14} strokeWidth={1.75} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.02em' }}>Fecha desincronizada</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Tarea: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>{taskMismatch.taskDate ? `${taskMismatch.taskDate.slice(8, 10)}/${taskMismatch.taskDate.slice(5, 7)}/${taskMismatch.taskDate.slice(0, 4)}${taskMismatch.taskTime ? ` · ${taskMismatch.taskTime}` : ''}` : '—'}</span>
                          {'  ·  '}Evento: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}${!allDay ? ` · ${start}` : ''}` : '—'}</span>
                        </div>
                      </div>
                      <button onClick={syncTaskToEvent}
                        style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(245,158,11,0.5)', background: '#F59E0B', color: '#2A1A05', fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 150ms', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FBBF24'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(245,158,11,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F59E0B'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(245,158,11,0.25)'; }}>
                        Sincronizar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Appearance */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Color</label>
              <div style={{ position: 'relative', height: 44 }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                <div style={{ width: '100%', height: '100%', background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, pointerEvents: 'none' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: color, boxShadow: `0 0 10px ${color}50` }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{color.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Attachments */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>Detalles & Materiales</label>
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 12, overflow: 'visible' }}>
              <textarea 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Agrega notas, enlaces, o detalles importantes..." 
                style={{ width: '100%', fontSize: 14, minHeight: 80, background: 'transparent', border: 'none', padding: '16px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
              />
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: 10, borderRadius: '0 0 12px 12px' }}>
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {attachments.map((item, i) => {
                      const badge = getMatBadge(item.url, item.name);
                      const isImage = item.url.startsWith('data:image') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(item.name.split('.').pop()?.toLowerCase() || '');
                      return (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden', transition: 'all 150ms' }}>
                        <div onClick={() => openAttachment(item)} title="Abrir material"
                          onContextMenu={(e) => matMenu.openMenu(e, { url: item.url, name: item.name, color: badge.badgeColor })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${badge.badgeColor}0d`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: `${badge.badgeColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: badge.badgeColor }}>
                            {badge.iconEl}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                            <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginTop: 1 }}>{badge.subtitle}</span>
                          </div>
                          {item.size && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{item.size}</span>}
                          <button onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, idx) => idx !== i)); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0, borderRadius: 5, transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                            <X size={11} />
                          </button>
                        </div>
                        {isImage && (
                          <div style={{ padding: '0 10px 8px' }} onClick={() => openAttachment(item)}>
                            <img src={item.url} alt={item.name} style={{ maxWidth: '100%', maxHeight: 110, borderRadius: 6, objectFit: 'contain', background: 'var(--bg-primary)', cursor: 'pointer' }} />
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {showLinkForm && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Globe size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input
                          autoFocus
                          type="url"
                          value={linkUrl}
                          onChange={e => setLinkUrl(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); } }}
                          placeholder="https://..."
                          style={{ flex: 1, fontSize: 13, height: 32, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '0 10px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                      <input
                        type="text"
                        value={linkName}
                        onChange={e => setLinkName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); } }}
                        placeholder="Nombre (opcional)"
                        style={{ fontSize: 12, height: 28, background: 'var(--surface-elevated)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '0 10px', color: 'var(--text-primary)', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={handleAddLink} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!showLinkForm && (
                      <button onClick={() => setShowLinkForm(true)} style={{ flex: 1, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: `${color}0d`, padding: 0, border: `1px solid ${color}40`, cursor: 'pointer', transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${color}1a`; e.currentTarget.style.borderColor = `${color}60`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.borderColor = `${color}40`; }}>
                        <Link2 size={14} style={{ color }} /> Enlace
                      </button>
                    )}
                    <button onClick={handleAddFileBtn} style={{ flex: 1, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: `${color}0d`, padding: 0, border: `1px solid ${color}40`, cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${color}1a`; e.currentTarget.style.borderColor = `${color}60`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.borderColor = `${color}40`; }}>
                      <Upload size={14} style={{ color }} /> Archivo
                    </button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isRecurringEdit && (
          <div style={{ padding: '0 32px 24px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Repeat size={13} style={{ color: 'var(--accent)' }} />
              <span style={{ fontFamily: "'Inter', sans-serif" }}>
                Cambios en repetición o curso se aplican a toda la serie. Para otros cambios, se te preguntará al guardar.
              </span>
            </div>
          </div>
        )}

        {showScopePrompt && pendingEv && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99996, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowScopePrompt(false); setPendingEv(null); }}>
            <div className="bento-card" onClick={e => e.stopPropagation()} style={{ padding: 26, width: 380, maxWidth: '90vw' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Repeat size={13} />
                </span>
                Aplicar cambios
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.5 }}>
                ¿A qué eventos quieres aplicar los cambios?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => executeScope('all')} style={{ width: '100%', height: 40, borderRadius: 9, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 10px var(--accent-dim)' }}>
                  <Repeat size={14} /> Todos los eventos
                </button>
                <button onClick={() => executeScope('one')} style={{ width: '100%', height: 40, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Calendar size={14} /> Solo este evento
                </button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* Footer */}
        <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 12, background: 'var(--bg-primary)', borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 200ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ flex: 2, height: 48, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px var(--accent-glow)', transition: 'transform 200ms, box-shadow 200ms' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px var(--accent-glow)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-glow)' }}>
            <Check size={16} />
            {event ? 'Guardar Cambios' : 'Crear Evento'}
          </button>
        </div>
      </div>
    </div>
  );
}
