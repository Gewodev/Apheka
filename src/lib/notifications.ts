export function requestNativePermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

export function sendNativeNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon.png',
      silent: false,
      tag: 'owa-studio',
    });
  } catch {
    // fallback silently
  }
}

export function notifySessionComplete(minutes: number): void {
  sendNativeNotification(
    'Sesion completada',
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
