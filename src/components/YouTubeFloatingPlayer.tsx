import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, ExternalLink } from 'lucide-react';

interface YouTubePlayerPayload {
  videoUrl: string;
  title: string;
  thumbnail: string;
}

export default function YouTubeFloatingPlayer() {
  const [data, setData] = useState<YouTubePlayerPayload | null>(null);

  useEffect(() => {
    const unlisten = listen<YouTubePlayerPayload>('youtube:load', (e) => {
      setData(e.payload);
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

  const close = () => {
    try { getCurrentWindow().close(); } catch {}
  };

  const openInBrowser = () => {
    if (data?.videoUrl) {
      try { getCurrentWindow().close(); } catch {}
      window.open(data.videoUrl, '_blank');
    }
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0b0c0f',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
      position: 'relative',
    }}>
      {/* Drag region + header */}
      <div data-tauri-drag-region style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', background: '#0b0c0f',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, minHeight: 32,
      }}>
        <div data-tauri-drag-region style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#E11D48', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data?.title || 'YouTube Player'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={openInBrowser} style={{
            width: 22, height: 22, borderRadius: 4,
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><ExternalLink size={11} /></button>
          <button onClick={close} style={{
            width: 22, height: 22, borderRadius: 4,
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={12} /></button>
        </div>
      </div>

      {/* Video area */}
      <div style={{
        flex: 1, position: 'relative',
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&modestbranding=1&enablejsapi=1`}
            style={{
              width: '100%', height: '100%',
              border: 'none',
            }}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : (
          <div style={{
            textAlign: 'center', color: 'rgba(255,255,255,0.2)',
            fontSize: 13, padding: 20,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
            Esperando video...
          </div>
        )}
      </div>

      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; background: #0b0c0f; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
