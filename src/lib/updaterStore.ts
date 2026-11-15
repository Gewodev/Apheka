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
      if (manual) updaterStore.set({ status: 'error', error: 'Las actualizaciones automaticas solo estan disponibles en West de escritorio.' });
      return;
    }
    if (pending) return pending;
    pending = (async () => {
      updaterStore.set({ status: 'checking', error: undefined });
      const { update, currentVersion, error } = await fetchUpdate();
      if (!update) {
        // Sin red, sin release todavia o sin version nueva: en automatico no se
        // molesta al usuario; solo se informa cuando la comprobacion es manual.
        updaterStore.set({ status: manual ? 'error' : 'up-to-date', currentVersion, error: manual ? 'No se pudo comprobar si hay una version nueva. Revisa tu conexion.' : undefined });
        return;
      }
      const dismissed = updaterStore.dismissedVersion();
      if (!manual && dismissed === update.version) {
        updaterStore.set({ status: 'up-to-date', version: update.version, currentVersion });
        return;
      }
      updaterStore.set({ status: 'available', version: update.version, currentVersion, notes: update.body, progress: 0 });
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
