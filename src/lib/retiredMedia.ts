/** Only state owned by the retired video windows. Never clear music or lyric caches. */
export const RETIRED_MEDIA_KEYS = ['owa_pip_v1', 'owa_yt_pending'] as const;

export function clearRetiredMediaState(storage: Pick<Storage, 'removeItem'>): void {
  for (const key of RETIRED_MEDIA_KEYS) {
    try { storage.removeItem(key); } catch { /* Read-only storage must not block startup. */ }
  }
}

export function retireMediaState(): () => void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { clearRetiredMediaState(window[name]); } catch { /* Storage unavailable. */ }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key && RETIRED_MEDIA_KEYS.some(key => key === event.key) && event.newValue !== null) {
      try { clearRetiredMediaState(event.storageArea || localStorage); } catch { /* Storage unavailable. */ }
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
