// Shared engine for the single integrated YouTube music player.

let ytApiPromise: Promise<boolean> | null = null;
export function ensureYouTubeApi():Promise<boolean>{if((window as any).YT?.Player)return Promise.resolve(true);if(!ytApiPromise){ytApiPromise=new Promise<boolean>(resolve=>{let done=false;const script=document.createElement('script'),w=window as any,previous=w.onYouTubeIframeAPIReady;const finish=(ok:boolean)=>{if(done)return;done=true;clearTimeout(timeout);if(!ok){script.remove();ytApiPromise=null;}resolve(ok);};const timeout=setTimeout(()=>finish(false),12000);w.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{finish(true);}};script.src='https://www.youtube.com/iframe_api';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';script.onerror=()=>finish(false);document.head.appendChild(script);});}return ytApiPromise;}

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

// Control del reproductor general (los registra App.tsx; los consume
// AppContext.setMusicProgressCb para que la barra busque DENTRO del iframe
// y toggleMusicPlayback para pausar/reproducir AL INSTANTE, sin esperar el
// re-render de React — máxima fluidez de pausa y reproducción consecutiva).
export const generalYtControl: { pendingSeek?:{url:string;ratio:number};restorePosition?:()=>void;getTime?:()=>number;getDuration?:()=>number;seekTo?: (ratio: number) => void; playVideo?: () => void; pauseVideo?: () => void } = {};
