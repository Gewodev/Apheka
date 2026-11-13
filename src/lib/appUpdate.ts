/**
 * Update notices for the desktop app.
 *
 * The check never touches the network and never breaks the app: it compares the
 * version of the installer that ran on this machine (and an optional published
 * channel file) with the version that is running.
 */

import {invoke, isTauri} from './tauri';

export interface UpdateAction {
  label: string;
  kind: 'relaunch' | 'open-url';
  url?: string;
}

export interface UpdateFinding {
  version: string;
  kind: 'installed' | 'channel';
  message: string;
  action?: UpdateAction;
  notes?: string;
}

interface UpdateState {
  installed?: string | null;
  channel?: { version: string; url?: string | null; notes?: string | null } | null;
}

/** Compare dotted versions: 1 when a is newer, -1 when b is newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.trim().replace(/^v/i, '').split(/[.\-+]/).map(part => {
    const number = parseInt(part, 10);
    return Number.isFinite(number) ? number : 0;
  });
  const left = parse(a || '0');
  const right = parse(b || '0');
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** Look for a newer build. Returns null when there is nothing to announce. */
export async function checkAppUpdate(currentVersion: string): Promise<UpdateFinding | null> {
  if (!isTauri() || !currentVersion) return null;
  try {
    const state = await invoke<UpdateState>('update_state');
    const installed = state?.installed?.trim();
    if (installed && compareVersions(installed, currentVersion) > 0) {
      return {
        version: installed,
        kind: 'installed',
        message: `APHEKA ${installed} ya está instalada. Reinicia la aplicación para usarla.`,
        action: {label: 'Reiniciar ahora', kind: 'relaunch'},
      };
    }
    const channel = state?.channel;
    if (channel?.version && compareVersions(channel.version, currentVersion) > 0) {
      const url = channel.url?.trim();
      return {
        version: channel.version.trim(),
        kind: 'channel',
        notes: channel.notes?.trim() || undefined,
        message: `Hay una actualización disponible: APHEKA ${channel.version.trim()}.`,
        action: url ? {label: 'Descargar', kind: 'open-url', url} : undefined,
      };
    }
    return null;
  } catch {
    // A failed check is not an error for the user: the app keeps working.
    return null;
  }
}

/** Restart the desktop app so a freshly installed build is the running one. */
export async function relaunchApp(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('relaunch_app');
  } catch {
    // Ignore: the user can restart the app by hand.
  }
}
