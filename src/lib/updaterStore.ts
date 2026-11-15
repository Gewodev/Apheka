import { fetchUpdate, installUpdate, updaterSupported, type UpdaterState } from './appUpdater';

/**
 * Estado compartido del auto-actualizador. La banda superior de la app y el
 * boton "Buscar actualizaciones" de Ajustes leen la misma fuente, de modo que
 * nunca hay dos comprobaciones simultaneas ni dos avisos a la vez.
 */

type Listener = () => void;

let state: UpdaterState = { status: 'idle' };
let pending: Promise<void> | null = null;
const listeners = new Set<Listener>();
const DISMISS_KEY = 'west_update_dismissed_version';

const emit = () => { listeners.forEach(listener => listener()); };

export const updaterStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  snapshot(): UpdaterState { return state; },
  set(patch: Partial<UpdaterState>) {
    state = { ...state, ...patch };
    emit();
  },
  dismissedVersion(): string {
    try { return localStorage.getItem(DISMISS_KEY) || ''; } catch { return ''; }
  },
  dismiss(version: string) {
    try { localStorage.setItem(DISMISS_KEY, version); } catch { /* noop */ }
    state = { status: 'idle' };
    emit();
  },
  /** Comprueba el endpoint. `manual` fuerza el aviso aunque el usuario lo descartara antes. */
  async check(manual = false): Promise<void> {
    if (!updaterSupported()) {
      if (manual) updaterStore.set({ status: 'error', error: 'Las actualizaciones automáticas solo están disponibles en West de escritorio.' });
      return;
    }
    if (pending) return pending;
    pending = (async () => {
      updaterStore.set({ status: 'checking', error: undefined });
      const { update, currentVersion, error, errorCode } = await fetchUpdate();
      
      // Si no hay update, puede ser porque no hay versión nueva (no es error)
      // o porque hubo un error real (red, firma, etc.)
      if (!update) {
        const isRealError = errorCode && errorCode !== 'no_update';
        
        if (manual) {
          // En comprobación manual, siempre informamos al usuario
          if (isRealError) {
            updaterStore.set({ status: 'error', currentVersion, error: error || 'Error desconocido al comprobar actualizaciones.', errorCode });
            // Notificar en el centro de notificaciones solo si es error real
            if (typeof window !== 'undefined' && 'Notification' in window) {
              try {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                  new Notification('West - Actualización', { body: error, tag: 'west-update-error' });
                }
              } catch { /* noop */ }
            }
          } else {
            // No hay versión nueva - esto es normal, no es error
            updaterStore.set({ status: 'up-to-date', currentVersion, error: undefined });
            if (typeof window !== 'undefined' && 'Notification' in window) {
              try {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                  new Notification('West', { body: 'Estás en la última versión disponible.', tag: 'west-update-uptodate' });
                }
              } catch { /* noop */ }
            }
          }
        } else {
          // En automático: solo silenciosamente up-to-date si no hay versión nueva
          // Si hay error real, no molestamos al usuario (se loggea en consola)
          if (isRealError) {
            console.warn('[Updater] Error al comprobar actualizaciones (auto):', error, errorCode);
          }
          updaterStore.set({ status: 'up-to-date', currentVersion, error: undefined });
        }
        return;
      }
      
      const dismissed = updaterStore.dismissedVersion();
      if (!manual && dismissed === update.version) {
        updaterStore.set({ status: 'up-to-date', version: update.version, currentVersion });
        return;
      }
      updaterStore.set({ status: 'available', version: update.version, currentVersion, notes: update.body, progress: 0 });
      // Notificar en el centro de notificaciones (campanita)
      if (!manual && typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            new Notification(`West ${update.version} disponible`, { 
              body: 'Se ha detectado una nueva versión. Haz clic para actualizar.', 
              tag: 'west-update-available',
              icon: '/icons/icon-192.png'
            });
          }
        } catch { /* noop */ }
      }
    })().finally(() => { pending = null; });
    return pending;
  },
  /** Descarga e instala la version disponible. */
  async install(): Promise<void> {
    const version = state.version;
    if (!version) return;
    updaterStore.set({ status: 'downloading', progress: 0, error: undefined });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        updaterStore.set({ status: 'error', error: 'La version nueva ya no esta disponible. Vuelve a comprobar las actualizaciones.' });
        return;
      }
      await installUpdate(update, progress => updaterStore.set({ progress }));
      updaterStore.set({ status: 'installed', progress: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updaterStore.set({ status: 'error', error: 'No se pudo completar la actualizacion: ' + message });
    }
  },
};
