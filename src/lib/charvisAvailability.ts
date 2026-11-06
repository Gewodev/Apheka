import {useSyncExternalStore} from 'react';

const key = 'apheka_ai_suspended';
const listeners = new Set<() => void>();
const readEnabled = () => { try { return localStorage.getItem(key) !== '1'; } catch { return true; } };
let enabled = readEnabled();

function update(next: boolean) {
  if (next === enabled) return;
  enabled = next;
  // Abort active requests before React unmounts the assistant and its listeners.
  if (!next) window.dispatchEvent(new Event('apheka:charvis-suspend'));
  listeners.forEach(listener => listener());
}

export function setCharvisEnabled(next: boolean) {
  try { localStorage.setItem(key, next ? '0' : '1'); } catch { /* Keep this session usable if storage is unavailable. */ }
  update(next);
}

function onStorage(event: StorageEvent) {
  if (event.key === key || event.key === null) update(readEnabled());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}

export function useCharvisEnabled() {
  return useSyncExternalStore(subscribe, () => enabled, () => true);
}
