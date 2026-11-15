import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import type { Update } from '@tauri-apps/plugin-updater';

/**
 * Auto-actualizador de West.
 *
 * Flujo: la app consulta el manifiesto `latest.json` publicado en GitHub
 * Releases, comprueba la firma con la clave publica incrustada en el
 * instalador y, si hay una version nueva, descarga el instalador NSIS y lo
 * aplica conservando los datos del usuario.
 *
 * La clave publica (pubkey) verifica que el paquete sea autentico. La clave
 * privada nunca viaja con la app: solo la usa el servidor de releases.
 */

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'installed' | 'up-to-date' | 'error';

export type UpdaterState = {
  status: UpdaterStatus;
  version?: string;
  currentVersion?: string;
  notes?: string;
  progress?: number;
  error?: string;
};

export const updaterSupported = (): boolean => isTauri();

/** Consulta el endpoint configurado. Nunca lanza: un fallo de red no rompe la app. */
export async function fetchUpdate(timeout = 15000): Promise<{ update: Update | null; currentVersion: string; error?: string }> {
  if (!isTauri()) return { update: null, currentVersion: '' };
  try {
    const currentVersion = await getVersion();
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check({ timeout });
    return { update, currentVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { update: null, currentVersion: '', error: message };
  }
}

/** Descarga e instala la version descargada. En Windows la app se cierra al terminar. */
export async function installUpdate(
  update: Update,
  onProgress?: (progress: number, downloaded: number, total: number) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall(
    event => {
      if (event.event === 'Started') total = event.data.contentLength ?? 0;
      else if (event.event === 'Progress') downloaded += event.data.chunkLength;
      onProgress?.(total > 0 ? Math.min(1, downloaded / total) : 0, downloaded, total);
    },
    { restartAfterInstall: true },
  );
}
