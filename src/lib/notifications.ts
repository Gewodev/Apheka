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

// ─── Anti-spam: timestamps en localStorage para limitar frecuencia ───
const NOTIF_KEY_PREFIX = 'owa_notif_ts_';

export function canNotifyItem(itemId: string, minIntervalMs: number = 3_600_000): boolean {
  try {
    const raw = localStorage.getItem(NOTIF_KEY_PREFIX + itemId);
    if (raw) {
      const last = parseInt(raw, 10);
      if (!isNaN(last) && Date.now() - last < minIntervalMs) {
        return false;
      }
    }
    localStorage.setItem(NOTIF_KEY_PREFIX + itemId, Date.now().toString());
    return true;
  } catch {
    return true;
  }
}

export async function sendNativeNotification(title: string, body: string): Promise<void> {
  try {
    const ok = await requestNativePermission();
    if (!ok) return;
    sendNotification({ title, body });
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

// ─── Notificaciones de tareas ───

export function notifyAllTasksComplete(): void {
  sendNativeNotification(
    'Todas las tareas listas',
    'Has completado la lista de pendientes. Disfruta tu tiempo libre.'
  );
}

export function notifyTaskDueSoon(title: string, dueDateStr: string, taskId: string): void {
  if (!canNotifyItem('task_' + taskId, 4 * 3_600_000)) return;

  sendNativeNotification(
    `Tarea pendiente: ${title}`,
    `Vence el ${dueDateStr}. ${pick(TASK_PHRASES)}`
  );
}

export function notifyTaskOverdue(title: string, taskId: string): void {
  if (!canNotifyItem('overdue_' + taskId, 6 * 3_600_000)) return;

  sendNativeNotification(
    'Tarea vencida',
    `"${title}" requiere tu atencion. ${pick(TASK_PHRASES)}`
  );
}

// ─── Notificaciones de eventos ───

export function notifyUpcomingEvent(title: string, timeStr: string, eventId: string): void {
  if (!canNotifyItem('event_' + eventId, 2 * 3_600_000)) return;

  sendNativeNotification(
    `Proximo evento: ${title}`,
    `Programado para las ${timeStr}. ${pick(EVENT_PHRASES)}`
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
