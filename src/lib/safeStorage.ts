// Acceso a localStorage que NUNCA lanza (evita el crash "exceeded the quota"
// que tumbaba vistas enteras). Ante cuota llena, libera lastre conocido
// (timestamps de notificaciones, log de errores, historiales de notas) y
// reintenta una vez; si ni así cabe, omite el guardado sin romper nada.

function evictBallast(): void {
  try {
    const drop: string[] = [];
    const slimVersions: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf('owa_notif_ts_') === 0) drop.push(k);
      else if (k === 'owa_error_log_v1') {
        try {
          const arr = JSON.parse(localStorage.getItem(k) || '[]');
          if (Array.isArray(arr) && arr.length > 3) {
            localStorage.setItem(k, JSON.stringify(arr.slice(-3)));
          }
        } catch { drop.push(k); }
      } else if (k.indexOf('owa_note_versions_') === 0) {
        slimVersions.push(k);
      }
    }
    for (const k of drop) { try { localStorage.removeItem(k); } catch { /* noop */ } }
    // Historiales de notas: conserva 1 por nota (solo vista previa, sin HTML).
    for (const k of slimVersions) {
      try {
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(arr) && arr.length > 1) {
          const v0 = arr[0] || {};
          localStorage.setItem(k, JSON.stringify([{
            timestamp: v0.timestamp,
            preview: v0.preview,
            wordCount: v0.wordCount,
          }]));
        }
      } catch { /* noop */ }
    }
  } catch { /* noop */ }
}

export function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    evictBallast();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* noop */ }
}
