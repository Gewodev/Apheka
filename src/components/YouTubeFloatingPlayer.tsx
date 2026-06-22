import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface YouTubePlayerPayload {
  videoUrl: string;
  title: string;
  thumbnail: string;
}

const LS_KEY = 'owa_yt_pending';

export default function YouTubeFloatingPlayer() {
  const [data, setData] = useState<YouTubePlayerPayload | null>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { localStorage.removeItem(LS_KEY); return JSON.parse(raw); }
    } catch {}
    return null;
  });

  useEffect(() => {
    const unlisten = listen<YouTubePlayerPayload>('youtube:load', (e) => {
      setData(e.payload);
      localStorage.removeItem(LS_KEY);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const videoId = data?.videoUrl
    ? (() => {
        try {
          const u = new URL(data.videoUrl);
          return u.searchParams.get('v') || data.videoUrl.split('/').pop() || '';
        } catch {
          return data.videoUrl.split('/').pop() || '';
        }
      })()
    : '';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', display: 'flex' }}>
      {videoId ? (
        <iframe
          key={videoId}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&modestbranding=1`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', color: 'rgba(255,255,255,0.15)', gap: 10 }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.3)', borderRadius: '50%', animation: 'ytSpin 0.8s linear infinite' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Cargando video...</span>
        </div>
      )}

      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; background: #000; }
        * { box-sizing: border-box; }
        @keyframes ytSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
