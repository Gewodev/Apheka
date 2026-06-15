import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let cachedPermission: boolean | null = null;

export async function requestNativePermission(): Promise<boolean> {
  if (cachedPermission !== null) return cachedPermission;
  let granted = await isPermissionGranted();
  if (!granted) {
    const perm = await requestPermission();
    granted = perm === 'granted';
  }
  cachedPermission = granted;
  return granted;
}

export async function sendNativeNotification(title: string, body: string): Promise<void> {
  try {
    const ok = await requestNativePermission();
    if (!ok) return;
    sendNotification({ title, body });
  } catch {
    // silently fall back — app may not be in Tauri context
  }
}

export function notifySessionComplete(minutes: number): void {
  sendNativeNotification(
    'Sesión completada',
    `Has completado ${minutes} minutos de enfoque. Toma un descanso.`
  );
}

export function notifyGoalReached(hours: number): void {
  sendNativeNotification(
    'Meta diaria alcanzada',
    `Excelente. Has estudiado ${hours} horas hoy.`
  );
}

export function notifyBreakOver(): void {
  sendNativeNotification(
    'Descanso terminado',
    'Tu descanso ha finalizado. Inicia un nuevo ciclo de enfoque.'
  );
}

export function notifyAllTasksComplete(): void {
  sendNativeNotification(
    'Tareas completadas',
    'Todas las tareas pendientes han sido marcadas como completadas.'
  );
}

export function notifyTaskDueSoon(title: string, dueDate: string): void {
  sendNativeNotification(
    'Tarea por vencer',
    `"${title}" vence el ${dueDate}.`
  );
}
