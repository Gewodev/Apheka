// Motor de YouTube compartido: la MISMA lógica que usa el reproductor emergente
// (VideoPiP) se usa también en el reproductor GENERAL. El emergente reproduce
// la nube de forma fiable con la IFrame API imperativa; el general usa este
// mismo patrón (video oculto detrás, audio del iframe).

let ytApiPromise: Promise<boolean> | null = null;
export function ensureYouTubeApi(): Promise<boolean> {
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      try {
        const w = window as any;
        if (w.YT && w.YT.Player) { resolve(true); return; }
        const prev = w.onYouTubeIframeAPIReady;
        w.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(true); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      } catch { resolve(false); }
    });
  }
  return ytApiPromise;
}

export function extractYouTubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const v = u.searchParams.get('v');
    if (v) return v;
    const host = u.hostname.replace('www.', '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.pathname.includes('/embed/')) return u.pathname.split('/embed/')[1]?.split('?')[0] || null;
  } catch {
    const m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export function extractPlaylistId(raw: string): string | null {
  try {
    const list = new URL(raw).searchParams.get('list');
    return list || null;
  } catch { return null; }
}

// Control de seek del reproductor general (lo registra App.tsx; lo consume
// AppContext.setMusicProgressCb para que la barra de progreso del GENERAL
// busque dentro del iframe de YouTube en vez del <audio> local).
export const generalYtControl: { seekTo?: (ratio: number) => void } = {};
