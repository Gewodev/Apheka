// Bridge between the app's music player and the native Windows media flyout
// (SMTC). Only the general player uses it, so there is a single media session.
//
// Pushes are serialized: a new snapshot can arrive while the previous invoke is
// still in flight, and the queue always converges on the latest one. State is
// marked as delivered only after the command succeeds, so a failed push is
// retried by the next tick instead of being silently lost.

import {invoke, isTauri} from './tauri';

export interface NativeMediaState {
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  /** Seconds. */
  position: number;
  /** Seconds. */
  duration: number;
  /** Data URL, http(s) URL or empty string. */
  cover: string;
  canNext: boolean;
  canPrev: boolean;
}

interface Payload {
  active: boolean;
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  position: number;
  duration: number;
  cover?: string;
  canNext: boolean;
  canPrev: boolean;
}

let desired: Payload | null = null;
let delivered: Payload | null = null;
let pumping = false;

const finite = (value: number) => (Number.isFinite(value) ? value : 0);

function same(a: Payload | null, b: Payload | null): boolean {
  if (!a || !b) return a === b;
  return a.active === b.active
    && a.title === b.title
    && a.artist === b.artist
    && a.album === b.album
    && a.playing === b.playing
    && a.position === b.position
    && a.duration === b.duration
    && a.canNext === b.canNext
    && a.canPrev === b.canPrev
    && a.cover === b.cover;
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (!same(desired, delivered)) {
      const target = desired;
      if (!target || !target.active) {
        await invoke('media_controls_clear');
      } else {
        const payload: Payload = {
          active: true,
          title: target.title,
          artist: target.artist,
          album: target.album,
          playing: target.playing,
          position: target.position,
          duration: target.duration,
          canNext: target.canNext,
          canPrev: target.canPrev,
        };
        // `cover` means "new artwork" to the native side, so it travels only
        // when it changed: a data URL can be hundreds of kilobytes.
        if (target.cover !== (delivered?.cover ?? '')) payload.cover = target.cover;
        await invoke('media_controls_update', {payload});
      }
      delivered = target;
    }
  } catch {
    // Leave `delivered` untouched so the next sync retries. Stopping the loop
    // prevents a failing command from spinning on every render.
  } finally {
    pumping = false;
  }
}

/** Publish the current song, or pass `null` to remove the native session. */
export function syncNativeMedia(state: NativeMediaState | null): void {
  if (!isTauri()) return;
  desired = state
    ? {
      active: true,
      title: state.title || '',
      artist: state.artist || '',
      album: state.album || '',
      playing: !!state.playing,
      position: Math.max(0, finite(state.position)),
      duration: Math.max(0, finite(state.duration)),
      cover: state.cover || '',
      canNext: !!state.canNext,
      canPrev: !!state.canPrev,
    }
    : null;
  void pump();
}

/**
 * Listen for the hardware media keys / flyout buttons. Returns an unlisten
 * function; a no-op outside the desktop shell.
 */
export async function subscribeNativeMediaButtons(
  handler: (button: string) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const {listen} = await import('@tauri-apps/api/event');
    return await listen<string>('apheka-media-button', event => {
      if (typeof event.payload === 'string') handler(event.payload);
    });
  } catch (error) {
    console.warn('No se pudo escuchar los controles multimedia del sistema', error);
    return () => {};
  }
}
