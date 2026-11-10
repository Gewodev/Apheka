import { createPointerRecovery } from '../lib/workspacePointer';
import {compatiblePointerEnabled,createCompatiblePointer,POINTER_PREFERENCE_EVENT} from '../lib/compatiblePointer';
import { useEffect, useSyncExternalStore } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { createFullscreenController, type FullscreenPort } from '../lib/fullscreen';

const native = isTauri();
const recoverPointer = createPointerRecovery(() => invoke('restore_workspace_pointer'));
const port: FullscreenPort = native ? {
  read: () => getCurrentWindow().isFullscreen(),
  write: active => getCurrentWindow().setFullscreen(active),
  focusContent: async () => {
    if (document.visibilityState === 'visible' && await getCurrentWindow().isFocused()) {
      await getCurrentWebview().setFocus();
      await recoverPointer(true);
    }
  },
} : {
  read: async () => !!document.fullscreenElement,
  write: async active => {
    if (active) await document.documentElement.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
  },
  focusContent: async () => {},
};

export const windowFullscreen = createFullscreenController(port, () => {
  window.dispatchEvent(new Event('apheka:cancel-interaction'));
});

const recoverFocusedContent = createPointerRecovery(async () => {
  await windowFullscreen.refresh();
  // Maximized and restored windows can lose their native cursor too.
  await port.focusContent();
});

/** A hidden auxiliary window can leave native input stale without changing fullscreen. */
export function resumeFullscreenInput(force = false) {
  return native && document.visibilityState === 'visible' ? recoverFocusedContent(force) : Promise.resolve();
}

function hasOpenLayer() {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"],[role="menu"],[role="listbox"],.pomodoro-options-menu,.notification-panel')]
    .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).pointerEvents !== 'none');
}

/** Mount once in AppContent, so Escape still works after leaving Estudio. */
export function useFullscreenLifecycle(onError: (message: string) => void) {
  useEffect(() => {
    let disposed = false;
    const compatiblePointer=native&&/Windows/i.test(navigator.userAgent)?createCompatiblePointer():null;
    const syncPointer=()=>compatiblePointer?.setEnabled(windowFullscreen.getSnapshot().active&&compatiblePointerEnabled());
    window.addEventListener(POINTER_PREFERENCE_EVENT,syncPointer);
    const unlisten: (() => void)[] = [];
    const attach = (promise: Promise<() => void>) => {
      void promise.then(stop => disposed ? stop() : unlisten.push(stop)).catch(() => {});
    };
    const sync = () => { void windowFullscreen.refresh(); };
    const resume = () => { if (native) void resumeFullscreenInput(); else sync(); };
    const visible = () => { if (document.visibilityState === 'visible') { if (native) void resumeFullscreenInput(true); else sync(); } };
    const recover = () => {
      const state = windowFullscreen.getSnapshot();
      if (native && !compatiblePointer?.isEnabled() && (state.active || state.busy) && document.visibilityState === 'visible') void recoverPointer();
    };
    // Media can alter the native cursor independently of CSS; recover on real input too.
    document.addEventListener('play', recover, true);
    window.addEventListener('resize', recover);
    const layeredEscapes = new WeakSet<KeyboardEvent>();
    const captureEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && hasOpenLayer()) layeredEscapes.add(event);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key === 'F11') {
        event.preventDefault();
        void windowFullscreen.toggle();
      } else if (event.key === 'Escape' && (windowFullscreen.getSnapshot().active || windowFullscreen.getSnapshot().busy) && !document.fullscreenElement && !layeredEscapes.has(event)) {
        event.preventDefault();
        void windowFullscreen.exit();
      }
    };
    const errors = windowFullscreen.subscribe(() => {
      const state = windowFullscreen.getSnapshot();
      if (!state.busy && state.error) onError(state.error);
      document.documentElement.dataset.fullscreen = String(state.active);
      syncPointer();
    });
    window.addEventListener('keydown', keyboard);
    document.addEventListener('keydown', captureEscape, true);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', visible);
    document.addEventListener('fullscreenchange', sync);
    if (native) {
      attach(getCurrentWindow().onResized(sync));
      attach(getCurrentWindow().onFocusChanged(({ payload }) => { if (payload) void resumeFullscreenInput(true); }));
    }
    sync();
    syncPointer();
    return () => {
      disposed = true;
      unlisten.forEach(stop => stop()); errors();
      window.removeEventListener('keydown', keyboard);
      document.removeEventListener('keydown', captureEscape, true);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visible);
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('play', recover, true);
      window.removeEventListener('resize', recover);
      delete document.documentElement.dataset.fullscreen;
      window.removeEventListener(POINTER_PREFERENCE_EVENT,syncPointer);
      compatiblePointer?.dispose();
    };
  }, [onError]);
}

export function useWindowFullscreen() {
  return useSyncExternalStore(windowFullscreen.subscribe, windowFullscreen.getSnapshot);
}
