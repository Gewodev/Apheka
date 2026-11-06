import {invoke,isTauri} from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let cachedPermission: boolean | null = null;

export async function requestNativePermission(): Promise<boolean> {
  if (cachedPermission !== null) return cachedPermission;
  let granted = false;
  try {
    granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === 'granted';
    }
  } catch {
    granted = false;
  }
  cachedPermission = granted;
  return granted;
}

// ─── Anti-spam: timestamps en localStorage + memoria para limitar frecuencia ───
// Doble capa: si localStorage falla por cuota, el Map en memoria evita el
// bucle de "a cada rato" durante la sesión.
const NOTIF_KEY_PREFIX = 'owa_notif_ts_';
const memNotif = new Map<string, number>();

export function canNotifyItem(itemId: string, minIntervalMs: number = 3_600_000): boolean {
  const now = Date.now();
  const mem = memNotif.get(itemId);
  if (mem !== undefined && now - mem < minIntervalMs) return false;
  try {
    const raw = localStorage.getItem(NOTIF_KEY_PREFIX + itemId);
    if (raw) {
      const last = parseInt(raw, 10);
      if (!isNaN(last) && now - last < minIntervalMs) {
        memNotif.set(itemId, last);
        return false;
      }
    }
    try {
      localStorage.setItem(NOTIF_KEY_PREFIX + itemId, now.toString());
    } catch { /* cuota llena: la capa en memoria sigue protegiendo */ }
    memNotif.set(itemId, now);
    return true;
  } catch {
    memNotif.set(itemId, now);
    return true;
  }
}

// ─── Candado COMPARTIDO entre dev y producción (1 hora) ───
// Ambas apps leen/escriben el mismo identifier (com.owa.studio), así que sin
// este candado cada aviso salía DOS veces (una por app). El archivo vive en
// %APPDATA%/com.owa.studio y guarda el último aviso por clave: si la otra app
// ya avisó hace menos de 1 h, esta no repite. Fail-open: si no se puede
// leer/escribir, se permite avisar (igual que antes).
const SHARED_SLOT_FILE = 'com.owa.studio/notif_slots.json';

export async function claimSharedSlot(key: string, cooldownMs: number = 3_600_000): Promise<boolean> {
  const now = Date.now();
  try {
    const fs = await import('@tauri-apps/plugin-fs');
    let slots: Record<string, number> = {};
    try {
      const raw = await fs.readTextFile(SHARED_SLOT_FILE, { baseDir: (fs as any).BaseDirectory?.AppData });
      slots = JSON.parse(raw || '{}');
    } catch { slots = {}; }
    const last = slots[key];
    if (typeof last === 'number' && now - last < cooldownMs) return false;
    slots[key] = now;
    // Poda: no guardar claves de hace más de 24 h.
    for (const k of Object.keys(slots)) {
      if (typeof slots[k] !== 'number' || now - slots[k] > 86_400_000) delete slots[k];
    }
    try {
      await fs.writeTextFile(SHARED_SLOT_FILE, JSON.stringify(slots), { baseDir: (fs as any).BaseDirectory?.AppData });
    } catch { /* no se pudo persistir: igual se avisa esta vez */ }
    return true;
  } catch {
    return true;
  }
}

export type NotificationTarget={kind:'task'|'event'|'session'|'study'|'tasks'|'settings'|'music'|'downloads';id?:string;date?:string};
export async function sendNativeNotification(title: string, body: string,target:NotificationTarget={kind:'study'}): Promise<void> {
  try {
    const ok = await requestNativePermission();
    if (!ok) return;
    if(isTauri())await invoke('send_workspace_notification',{title,body,target});
    else sendNotification({ title, body });
  } catch {
    // fallback silencioso
  }
}

// ─── Frases reflexivas breves para acompañar las notificaciones ───
const TASK_PHRASES = [
  'Un pequeño avance hoy te dará paz mental mañana.',
  'Dedicar 10 minutos ahora marca la diferencia.',
  'No busques perfección, busca consistencia.',
  'Cada paso cuenta, por más pequeño que parezca.',
  'Tu futuro yo te agradecerá los minutos invertidos hoy.',
  'Avanzar poco a poco construye grandes resultados.',
  'La clave no es la velocidad, sino la constancia.',
  'Organizar tu día empieza con una sola tarea.',
  'Lo que haces hoy define lo que logras mañana.',
  'Cumplirte a ti mismo fortalece tu confianza.',
];

const EVENT_PHRASES = [
  'Prepara tu espacio y tu mente.',
  'Un minuto de anticipación vale una hora de improvisación.',
  'Llegar preparado es llegar con ventaja.',
  'Organiza lo que necesitas antes de empezar.',
  'La puntualidad habla de respeto propio.',
  'Estar listo a tiempo reduce el estrés.',
];

const STUDY_PHRASES = [
  'Un bloque corto de 15 minutos mantiene tu progreso activo.',
  'Estudiar un poco cada día supera las sesiones maratónicas.',
  'La memoria se fortalece con la repetición espaciada.',
  'Incluso 10 minutos de repaso consolidan lo aprendido.',
  'La constancia supera al talento cuando el talento no es constante.',
  'Repasar hoy lo que aprendiste ayer duplica tu retención.',
];

const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

// ─── Notificaciones de sesiones de estudio ───

export function notifySessionComplete(minutes: number): void {
  sendNativeNotification(
    'Sesion completada',
    `Has completado ${minutes} minutos de trabajo dedicado. Toma un descanso merecido.`
  );
}

export function notifyGoalReached(hours: number): void {
  sendNativeNotification(
    'Meta diaria alcanzada',
    `Superaste tu objetivo acumulando ${hours} horas de estudio hoy. Buen trabajo.`
  );
}

export function notifyBreakOver(): void {
  sendNativeNotification(
    'Descanso finalizado',
    'Tu pausa ha terminado. Inicia tu siguiente bloque de estudio con mente fresca.'
  );
}

// ─── Formato de tiempo restante / transcurrido (preciso, no genérico) ───

const DAY_MS = 86_400_000;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtHour(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDayShort(ms: number): string {
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// "hoy a las 18:30" · "mañana a las 09:00" · "el 12 ene a las 10:00"
function fmtWhenFuture(targetMs: number, nowMs: number): string {
  const t = new Date(targetMs);
  const now = new Date(nowMs);
  const tomorrow = new Date(nowMs + DAY_MS);
  if (sameDay(t, now)) return `hoy a las ${fmtHour(targetMs)}`;
  if (sameDay(t, tomorrow)) return `mañana a las ${fmtHour(targetMs)}`;
  return `el ${fmtDayShort(targetMs)} a las ${fmtHour(targetMs)}`;
}

// "en 25 minutos" · "en 3 horas" · "mañana" · "en 4 días"
function fmtCountdown(diffMs: number): string {
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return mins <= 1 ? 'en 1 minuto' : `en ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'en 1 hora' : `en ${hours} horas`;
  const days = Math.round(diffMs / DAY_MS);
  return days === 1 ? 'mañana' : `en ${days} días`;
}

// "hace 2 horas" · "ayer" · "hace 5 días"
function fmtOverdue(agoMs: number): string {
  const mins = Math.round(agoMs / 60_000);
  if (mins < 60) return mins <= 1 ? 'hace 1 minuto' : `hace ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
  const days = Math.round(agoMs / DAY_MS);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

function occurrenceKey(prefix: string, id: string, targetMs: number): string {
  const d = new Date(targetMs);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}_${id}_${day}`;
}

// ─── Notificaciones de tareas ───

export function notifyAllTasksComplete(): void {
  sendNativeNotification(
    'Todas las tareas listas',
    'Has completado la lista de pendientes. Disfruta tu tiempo libre.',
    {kind:'tasks'}
  );
}

// Tarea que aún no vence: mensaje distinto según falte poco o varios días.
export async function notifyTaskDueSoon(title: string, dueMs: number, taskId: string): Promise<void> {
  const now = Date.now();
  const diff = dueMs - now;
  if (!(diff > 0)) return;
  const key = occurrenceKey('task', taskId, dueMs);
  if (!canNotifyItem(key, 20 * 3_600_000)) return;
  if (!(await claimSharedSlot(key))) return;

  const urgent = diff <= 3 * 3_600_000;
  sendNativeNotification(
    urgent ? `Tarea por vencer: ${title}` : `Recordatorio: ${title}`,
    urgent
      ? `Vence ${fmtWhenFuture(dueMs, now)} (${fmtCountdown(diff)}). ${pick(TASK_PHRASES)}`
      : `Vence ${fmtWhenFuture(dueMs, now)}. ${pick(TASK_PHRASES)}`,
    {kind:'task',id:taskId,date:new Date(dueMs).toLocaleDateString('en-CA')}
  );
}

// Tarea ya vencida: mensaje distinto según lleve horas o días.
export async function notifyTaskOverdue(title: string, dueMs: number, taskId: string): Promise<void> {
  const now = Date.now();
  const ago = now - dueMs;
  if (!(ago > 0)) return;
  const today = new Date();
  const dayId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const key = `overdue_${taskId}_${dayId}`;
  if (!canNotifyItem(key, 20 * 3_600_000)) return;
  if (!(await claimSharedSlot(key))) return;

  sendNativeNotification(
    'Tarea vencida',
    `"${title}" venció ${fmtOverdue(ago)}. ${pick(TASK_PHRASES)}`,
    {kind:'task',id:taskId,date:new Date(dueMs).toLocaleDateString('en-CA')}
  );
}

// ─── Notificaciones de eventos ───

// Aviso de 1 hora: solo contexto de preparación.
export async function notifyEventReminder1h(title: string, eventMs: number, eventId: string): Promise<void> {
  const key = occurrenceKey('ev1h', eventId, eventMs);
  if (!canNotifyItem(key, 20 * 3_600_000)) return;
  if (!(await claimSharedSlot(key))) return;
  sendNativeNotification(
    `Evento en una hora: ${title}`,
    `Empieza a las ${fmtHour(eventMs)}. ${pick(EVENT_PHRASES)}`,
    {kind:'event',id:eventId,date:new Date(eventMs).toLocaleDateString('en-CA')}
  );
}

// Aviso de 30 minutos: hora exacta + cuenta atrás.
export async function notifyUpcomingEvent(title: string, eventMs: number, eventId: string): Promise<void> {
  const diff = eventMs - Date.now();
  if (!(diff > 0)) return;
  const key = occurrenceKey('ev30', eventId, eventMs);
  if (!canNotifyItem(key, 20 * 3_600_000)) return;
  if (!(await claimSharedSlot(key))) return;

  sendNativeNotification(
    `Próximo evento: ${title}`,
    `Hoy a las ${fmtHour(eventMs)} (${fmtCountdown(diff)}). ${pick(EVENT_PHRASES)}`,
    {kind:'event',id:eventId,date:new Date(eventMs).toLocaleDateString('en-CA')}
  );
}

// ─── Notificaciones de sesiones de estudio ───

export async function notifyStudySessionSoon(title: string, sessionMs: number, sessionId: string): Promise<void> {
  const diff = sessionMs - Date.now();
  if (!(diff > 0)) return;
  const key = occurrenceKey('ps10', sessionId, sessionMs);
  if (!canNotifyItem(key, 20 * 3_600_000)) return;
  if (!(await claimSharedSlot(key))) return;

  sendNativeNotification(
    'Sesión de estudio en 10 minutos',
    `"${title}" empieza a las ${fmtHour(sessionMs)}. Prepara tu espacio y tu mente.`,
    {kind:'session',id:sessionId,date:new Date(sessionMs).toLocaleDateString('en-CA')}
  );
}

// ─── Recordatorio de estudio ───

export function notifyStudyReminder(): void {
  if (!canNotifyItem('daily_study_reminder', 12 * 3_600_000)) return;

  sendNativeNotification(
    'Un momento de enfoque',
    pick(STUDY_PHRASES)
  );
}
