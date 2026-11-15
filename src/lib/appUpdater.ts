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
  errorCode?: string;
};

export const updaterSupported = (): boolean => isTauri();

/** Consulta el endpoint configurado. Nunca lanza: un fallo de red no rompe la app. */
export async function fetchUpdate(timeout = 15000): Promise<{ update: Update | null; currentVersion: string; error?: string; errorCode?: string }> {
  if (!isTauri()) return { update: null, currentVersion: '', error: 'Las actualizaciones solo están disponibles en la aplicación de escritorio.', errorCode: 'not_tauri' };
  
  try {
    const currentVersion = await getVersion();
    
    // Primero verificamos si el manifiesto latest.json existe haciendo una petición HEAD/GET directa
    // Esto evita el falso "no_update" cuando el release no existe (404)
    const manifestUrl = 'https://github.com/AuthomiaAgency/Owa_Studio/releases/latest/download/latest.json';
    let manifestExists = false;
    try {
      const response = await fetch(manifestUrl, { method: 'HEAD', cache: 'no-cache' });
      manifestExists = response.ok;
    } catch {
      manifestExists = false;
    }
    
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check({ timeout });
    
    // Si el manifiesto NO existe en GitHub, es un error de configuración, no "no hay update"
    if (!manifestExists) {
      return { 
        update: null, 
        currentVersion, 
        error: 'No hay releases publicados con información de actualización. El servidor no tiene latest.json configurado.', 
        errorCode: 'not_found' 
      };
    }
    
    // Si el manifiesto existe pero update es null, realmente no hay versión nueva
    if (!update) {
      return { 
        update: null, 
        currentVersion, 
        error: 'No hay una versión nueva disponible.', 
        errorCode: 'no_update' 
      };
    }
    return { update, currentVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Clasificar el tipo de error para dar mensaje más específico
    let errorCode = 'unknown';
    let userMessage = message;
    
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('econnrefused') || lowerMsg.includes('timeout') || lowerMsg.includes('enotfound')) {
      errorCode = 'network';
      userMessage = 'Error de conexión: no se pudo alcanzar el servidor de actualizaciones. Verifica tu conexión a internet.';
    } else if (lowerMsg.includes('signature') || lowerMsg.includes('pubkey') || lowerMsg.includes('verif')) {
      errorCode = 'signature';
      userMessage = 'Error de verificación: la firma de la actualización no es válida.';
    } else if (lowerMsg.includes('not found') || lowerMsg.includes('404') || lowerMsg.includes('release')) {
      errorCode = 'not_found';
      userMessage = 'No se encontró información de actualización. El servidor puede no tener releases configurados.';
    } else if (lowerMsg.includes('version') || lowerMsg.includes('downgrade')) {
      errorCode = 'version';
      userMessage = 'La versión disponible no es más nueva que la instalada.';
    }
    
    return { update: null, currentVersion: '', error: userMessage, errorCode };
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
