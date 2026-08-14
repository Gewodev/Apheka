import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, Minimize2, Maximize2, Play, Pause, Disc3 } from 'lucide-react';
import { ensureYouTubeApi, extractYouTubeId, extractPlaylistId } from '../lib/ytEngine';

export interface VideoPiPProps {
  url: string | null;
  title: string;
  onClose: () => void;
  autoplay?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  pipAfterQueue?: { url: string; title: string }[];
  setPipAfterQueue?: (q: { url: string; title: string }[]) => void;
  onPipPlayNext?: (url: string, title?: string) => void;
}

const DEFAULT_W = 420;
const DEFAULT_H = 260;
const MIN_W = 240;
const MIN_H = 140;
const BAR_H = 30;
const MINI_W = 304;
const MINI_H = 96;

function isDirectVideo(url: string): boolean {
  if (url.startsWith('data:video/')) return true;
  try {
    const u = new URL(url);
    const ext = u.pathname.split('.').pop()?.toLowerCase() || '';
    return ['mp4', 'webm', 'ogg', 'ogv', 'mov'].includes(ext);
  } catch {
    return false;
  }
}

function ytThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function loadPipStorage() {
  try {
    const raw = localStorage.getItem('owa_pip_v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function VideoPiPInner({ url, title, onClose, autoplay = false, onPlayingChange, pipAfterQueue, setPipAfterQueue, onPipPlayNext }: VideoPiPProps) {
  const [hovered, setHovered] = useState(false);
  const [mini, setMini] = useState<boolean>(() => {
    const d = loadPipStorage();
    return !!(d && d.mini);
  });
  const posRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: DEFAULT_W, h: DEFAULT_H });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, origW: 0, origH: 0 });
  const justDraggedRef = useRef(false);

  const ytPlayerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [ytMode, setYtMode] = useState<'api' | 'fallback'>('api');
  const [trackTitle, setTrackTitle] = useState<string | null>(null);
  const [thumbId, setThumbId] = useState<string | null>(null);
  const ytHolderRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef(url);
  const titleRef = useRef(title);

  useEffect(() => { urlRef.current = url; titleRef.current = title; }, [url, title]);

  const initialPos = useMemo(() => {
    const d = loadPipStorage();
    const w = Math.max(DEFAULT_W, MINI_W);
    const h = Math.max(DEFAULT_H, MINI_H);
    if (d && typeof d.x === 'number' && typeof d.y === 'number') {
      return {
        x: Math.min(Math.max(8, d.x), Math.max(8, window.innerWidth - w - 8)),
        y: Math.min(Math.max(8, d.y), Math.max(8, window.innerHeight - h - 8)),
      };
    }
    return {
      x: Math.round((window.innerWidth - w) / 2),
      y: Math.round((window.innerHeight - h) / 2),
    };
  }, []);

  useEffect(() => {
    posRef.current = initialPos;
  }, [initialPos]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const w = mini ? MINI_W : sizeRef.current.w;
    const h = mini ? MINI_H : sizeRef.current.h;
    const x = Math.min(Math.max(8, posRef.current.x), Math.max(8, window.innerWidth - w - 8));
    const y = Math.min(Math.max(8, posRef.current.y), Math.max(8, window.innerHeight - h - 8));
    posRef.current = { x, y };
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    c.style.transform = `translate(${x}px, ${y}px)`;
    try {
      localStorage.setItem('owa_pip_v1', JSON.stringify({
        ...(loadPipStorage() || {}),
        url: urlRef.current,
        title: titleRef.current,
        mini,
        x,
        y,
      }));
    } catch { /* noop */ }
  }, [mini]);

  useEffect(() => {
    try {
      if (url) localStorage.setItem('owa_pip_v1', JSON.stringify({ ...(loadPipStorage() || {}), url, title, mini }));
      else localStorage.removeItem('owa_pip_v1');
    } catch { /* noop */ }
  }, [url, title, mini]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const c = containerRef.current;
      if (!c) return;
      if (dragRef.current.active) {
        const nx = dragRef.current.origX + (e.clientX - dragRef.current.startX);
        const ny = dragRef.current.origY + (e.clientY - dragRef.current.startY);
        posRef.current = { x: nx, y: ny };
        c.style.transform = `translate(${nx}px, ${ny}px)`;
      }
      if (resizeRef.current.active) {
        const nw = Math.max(MIN_W, resizeRef.current.origW + (e.clientX - resizeRef.current.startX));
        const nh = Math.max(MIN_H, resizeRef.current.origH + (e.clientY - resizeRef.current.startY));
        sizeRef.current = { w: nw, h: nh };
        c.style.width = `${nw}px`;
        c.style.height = `${nh}px`;
      }
    }
    function onUp() {
      if (dragRef.current.active || resizeRef.current.active) {
        const wasDrag = dragRef.current.active;
        if (wasDrag) justDraggedRef.current = true;
        dragRef.current.active = false;
        resizeRef.current.active = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (wasDrag) {
          try {
            const d = loadPipStorage() || {};
            d.x = posRef.current.x;
            d.y = posRef.current.y;
            localStorage.setItem('owa_pip_v1', JSON.stringify(d));
          } catch { /* noop */ }
        }
      }
    }
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleDragDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: posRef.current.x, origY: posRef.current.y };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { active: true, startX: e.clientX, startY: e.clientY, origW: sizeRef.current.w, origH: sizeRef.current.h };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleClose = useCallback(() => {
    const c = containerRef.current;
    if (c) {
      c.style.transition = 'opacity 150ms ease-out, transform 150ms ease-out';
      c.style.opacity = '0';
      c.style.pointerEvents = 'none';
    }
    setTimeout(onClose, 150);
  }, [onClose]);

  const ytId = url ? extractYouTubeId(url) : null;
  const ytList = url ? extractPlaylistId(url) : null;
  const ytShow = !!ytId || !!ytList;
  const isVideo = url ? isDirectVideo(url) : false;
  const canControl = ytShow ? ytMode === 'api' : isVideo;
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  const shownTitle = trackTitle || title;

  useEffect(() => {
    if (!url || !ytShow) {
      try { ytPlayerRef.current?.destroy?.(); } catch { /* noop */ }
      ytPlayerRef.current = null;
      setPlaying(false);
      setCur(0);
      setDur(0);
      setTrackTitle(null);
      setThumbId(null);
      onPlayingChange?.(false);
      return;
    }
    let cancelled = false;
    ensureYouTubeApi().then((ok) => {
      if (cancelled) return;
      const wrap = ytHolderRef.current;
      if (!ok || !wrap) { setYtMode('fallback'); return; }
      setYtMode('api');
      const prev = ytPlayerRef.current;
      if (prev) {
        // Seguro: React NUNCA toca este DOM (contenedor imperativo) → sin removeChild
        try { prev.destroy(); } catch { /* noop */ }
        ytPlayerRef.current = null;
      }
      if (cancelled) return;
      setTrackTitle(null);
      setThumbId(null);
      try {
        const w = window as any;
        wrap.innerHTML = '';
        const holder = document.createElement('div');
        holder.style.width = '100%';
        holder.style.height = '100%';
        wrap.appendChild(holder);
        const cfg: any = {
          width: '100%',
          height: '100%',
          playerVars: { autoplay: autoplay ? 1 : 0, loop: 1, rel: 0, modestbranding: 1, controls: 1, playsinline: 1 },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              ytPlayerRef.current = e.target;
              setYtMode('api');
              const d = e.target.getDuration?.() || 0;
              if (d) setDur(d);
              if (autoplay) {
                try { e.target.playVideo?.(); } catch { /* noop */ }
              }
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              const playingNow = e.data === 1;
              setPlaying(playingNow);
              onPlayingChange?.(playingNow);
              if (playingNow || e.data === 5) {
                // Seguir la canción actual de la playlist: título + thumb real
                try {
                  const vd = e.target.getVideoData?.();
                  if (vd && vd.title) setTrackTitle(vd.title);
                  const vurl = e.target.getVideoUrl?.();
                  if (vurl) {
                    const vid = extractYouTubeId(vurl);
                    if (vid) setThumbId(vid);
                  }
                } catch { /* noop */ }
              }
              if (playingNow) {
                const d = ytPlayerRef.current?.getDuration?.() || 0;
                if (d) setDur(d);
              }
              if (e.data === 0) {
                // ¿Hay una canción programada "después de la actual"? → consumirla
                const pq = pipAfterQueue ?? [];
                if (pq.length > 0) {
                  const [next, ...rest] = pq;
                  setPipAfterQueue?.(rest);
                  onPipPlayNext?.(next.url, next.title);
                  return;
                }
                if (!ytList) {
                  // Video suelto ENDED → loop hasta que pause o cambie
                  try {
                    const p = ytPlayerRef.current;
                    if (p) { p.seekTo?.(0, true); p.playVideo?.(); }
                  } catch { /* noop */ }
                }
              }
            },
          },
        };
        if (ytId) cfg.videoId = ytId;
        if (ytList) {
          // Playlist nativa: la API avanza sola de canción en canción
          // y con loop:1 al terminar la última vuelve a la primera
          cfg.playerVars.listType = 'playlist';
          cfg.playerVars.list = ytList;
        } else if (ytId) {
          cfg.playerVars.playlist = ytId;
        }
        const player = new w.YT.Player(holder, cfg);
        if (player && player.getIframe) {
          ytPlayerRef.current = player;
        }
      } catch { if (!cancelled) setYtMode('fallback'); }
    });
    return () => {
      cancelled = true;
      // destroy() es SEGURO aquí: el holder es imperativo, React no lo elimina
      try { ytPlayerRef.current?.destroy?.(); } catch { /* noop */ }
      ytPlayerRef.current = null;
      setPlaying(false);
      setCur(0);
      setDur(0);
      setTrackTitle(null);
      setThumbId(null);
      onPlayingChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!playing || !ytPlayerRef.current) return;
    const t = window.setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      setCur(p.getCurrentTime() || 0);
      const d = p.getDuration?.();
      if (typeof d === 'number' && d > 0) setDur(d);
    }, 400);
    return () => window.clearInterval(t);
  }, [playing, ytMode, url]);

  const togglePlay = useCallback(() => {
    const p = ytPlayerRef.current;
    if (p && typeof p.pauseVideo === 'function') {
      if (playing) p.pauseVideo();
      else p.playVideo();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => { /* noop */ });
    else v.pause();
  }, [playing]);

  const seekTo = useCallback((ratio: number) => {
    const p = ytPlayerRef.current;
    if (p && typeof p.getDuration === 'function') {
      const d = p.getDuration() || 0;
      p.seekTo(ratio * d, true);
      setCur(ratio * d);
      return;
    }
    const v = videoRef.current;
    if (v && v.duration) v.currentTime = ratio * v.duration;
  }, []);

  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canControl) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    seekTo(ratio);
  }, [canControl, seekTo]);

  if (!url) return null;

  return createPortal(
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: mini ? MINI_W : DEFAULT_W,
        height: mini ? MINI_H : DEFAULT_H,
        transform: `translate(${initialPos.x}px, ${initialPos.y}px)`,
        zIndex: 99990,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        border: '1px solid ' + (hovered ? 'var(--border-strong)' : 'var(--border-subtle)'),
        boxShadow: hovered
          ? '0 20px 60px rgba(0,0,0,0.45), 0 4px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 14px 40px rgba(0,0,0,0.32), 0 3px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        willChange: 'transform',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
      }}
    >
      {/* Header / drag bar (full mode only): title only */}
      <div
        onMouseDown={handleDragDown}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: BAR_H, zIndex: 5,
          display: mini ? 'none' : 'flex',
          alignItems: 'center',
          padding: '0 72px 0 14px',
          background: hovered ? 'color-mix(in srgb, var(--bg-hover) 55%, transparent)' : 'transparent',
          transition: 'background 150ms',
          cursor: 'grab',
        }}
      >
        <span style={{
          fontSize: 12, fontWeight: 400,
          color: 'var(--text-secondary)',
          fontFamily: "'Inter Tight', sans-serif",
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0, lineHeight: 1,
        }}>
          {shownTitle}
        </span>
      </div>

      {/* Minimize button (full mode only) */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setMini(true); }}
        title="Minimizar (solo audio)"
        style={{
          position: 'absolute', top: 4, right: 30, zIndex: 10,
          width: 22, height: 22, borderRadius: 6,
          border: '1px solid ' + (hovered ? 'var(--border-default)' : 'transparent'),
          background: hovered ? 'var(--bg-hover)' : 'transparent',
          display: mini ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
          opacity: hovered ? 1 : 0.5,
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.background = hovered ? 'var(--bg-hover)' : 'transparent'; e.currentTarget.style.borderColor = hovered ? 'var(--border-default)' : 'transparent'; e.currentTarget.style.color = hovered ? 'var(--text-secondary)' : 'var(--text-muted)'; e.currentTarget.style.opacity = hovered ? '1' : '0.5'; }}
      >
        <Minimize2 size={12} strokeWidth={1.75} />
      </button>

      {/* Close button (full mode only) */}
      <button
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        title="Cerrar"
        style={{
          position: 'absolute', top: 4, right: 4, zIndex: 10,
          width: 22, height: 22, borderRadius: 6,
          border: '1px solid ' + (hovered ? 'var(--border-default)' : 'transparent'),
          background: hovered ? 'var(--bg-hover)' : 'transparent',
          display: mini ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
          opacity: hovered ? 1 : 0.5,
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.85)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.85)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.background = hovered ? 'var(--bg-hover)' : 'transparent'; e.currentTarget.style.borderColor = hovered ? 'var(--border-default)' : 'transparent'; e.currentTarget.style.color = hovered ? 'var(--text-secondary)' : 'var(--text-muted)'; e.currentTarget.style.opacity = hovered ? '1' : '0.5'; }}
      >
        <X size={11} strokeWidth={1.75} />
      </button>

      {/* Video content */}
      <div style={{
        position: 'absolute',
        top: BAR_H,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        background: '#000',
        zIndex: 2,
        visibility: mini ? 'hidden' : 'visible',
      }}>
        {ytShow ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={ytHolderRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {ytMode === 'fallback' && (
              <iframe
                key={url}
                src={ytList
                  ? `https://www.youtube.com/embed/videoseries?list=${ytList}&autoplay=${autoplay ? 1 : 0}&loop=1&controls=1&rel=0&modestbranding=1`
                  : `https://www.youtube.com/embed/${ytId}?autoplay=${autoplay ? 1 : 0}&loop=1&playlist=${ytId}&controls=1&rel=0&modestbranding=1`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              />
            )}
          </div>
        ) : isVideo ? (
          <video
            ref={videoRef}
            src={url}
            controls
            autoPlay={autoplay}
            loop
            playsInline
            onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onPlay={() => { setPlaying(true); onPlayingChange?.(true); }}
            onPause={() => { setPlaying(false); onPlayingChange?.(false); }}
            onEnded={(e) => {
              const pq = pipAfterQueue ?? [];
              if (pq.length > 0) {
                const [next, ...rest] = pq;
                setPipAfterQueue?.(rest);
                onPipPlayNext?.(next.url, next.title);
                return;
              }
              e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => { /* noop */ });
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)', fontSize: 12,
            fontFamily: "'Inter Tight', sans-serif",
          }}>
            Formato no soportado
          </div>
        )}
      </div>

      {/* Resize grip (full mode only) */}
      <div
        onMouseDown={handleResizeDown}
        style={{
          position: 'absolute',
          right: 0, bottom: 0,
          width: 16, height: 16,
          cursor: 'nwse-resize',
          zIndex: 6,
          display: mini ? 'none' : 'block',
        }}
      />

      {/* Compact bar (mini mode): horizontal — cover left, title + progress + buttons right */}
      {mini && (
        <div
          onMouseDown={handleDragDown}
          style={{
            position: 'absolute', inset: 0, zIndex: 7,
            display: 'flex', flexDirection: 'row', alignItems: 'stretch',
            gap: 10, padding: 8,
            background: 'var(--bg-primary)',
            borderRadius: 14,
            cursor: 'grab',
          }}
        >
          {/* Cover — click expands */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (justDraggedRef.current) { justDraggedRef.current = false; return; }
              setMini(false);
            }}
            title="Restaurar video"
            style={{
              width: 142, height: '100%',
              borderRadius: 10, overflow: 'hidden',
              position: 'relative', flexShrink: 0,
              background: '#000',
              cursor: 'pointer',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.35)',
            }}
          >
            {thumbId || ytId ? (
              <img
                src={ytThumb((thumbId || ytId) as string)}
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-elevated)',
              }}>
                <Disc3 size={20} strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              </div>
            )}
          </div>

          {/* Right column: title / progress / buttons */}
          <div style={{
            flex: 1, minWidth: 0,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2px 0',
          }}>
            {/* Title */}
            <div style={{
              fontSize: 12, fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: "'Inter Tight', sans-serif",
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{shownTitle}</div>

            {/* Progress bar + times (when controllable) */}
            {canControl && (
              <div>
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={handleSeekClick}
                  title="Buscar en la canción"
                  style={{ height: 10, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{
                    position: 'relative', width: '100%', height: 3, borderRadius: 2,
                    background: 'var(--bg-hover)',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2,
                      width: pct + '%',
                      background: 'linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 55%, #000 45%) 100%)',
                      boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)',
                      transition: 'width 300ms linear',
                    }} />
                    {pct > 0 && (
                      <div style={{
                        position: 'absolute', top: '50%',
                        left: `calc(${pct}% - 3px)`,
                        transform: 'translateY(-50%)',
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent)',
                        boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 90%, transparent), inset 0 0 0 1px rgba(255,255,255,0.35)',
                        transition: 'left 300ms linear',
                      }} />
                    )}
                  </div>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: 1,
                  fontSize: 8, fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--text-tertiary)', letterSpacing: '0.02em',
                }}>
                  <span>{fmtTime(cur)}</span>
                  <span>{fmtTime(dur)}</span>
                </div>
              </div>
            )}

            {/* Buttons row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                title={playing ? 'Pausar' : 'Reproducir'}
                disabled={!canControl}
                style={{
                  width: 24, height: 24, borderRadius: 7,
                  border: '1px solid ' + (canControl ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--border-soft)'),
                  background: canControl ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: canControl ? 'var(--accent)' : 'var(--text-tertiary)',
                  cursor: canControl ? 'pointer' : 'default',
                  flexShrink: 0, transition: 'all 150ms ease',
                  opacity: canControl ? 1 : 0.45,
                  boxShadow: canControl ? '0 1px 6px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
                }}
                onMouseEnter={e => { if (canControl) { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 18%, transparent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 60%, transparent)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = canControl ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-hover)'; e.currentTarget.style.borderColor = canControl ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--border-soft)'; }}
              >
                {playing
                  ? <Pause size={12} strokeWidth={1.75} fill="currentColor" />
                  : <Play size={12} strokeWidth={1.75} fill="currentColor" style={{ marginLeft: 1 }} />}
              </button>
              <div style={{ flex: 1 }} />
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setMini(false); }}
                title="Expandir"
                style={{
                  width: 21, height: 21, borderRadius: 6,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--bg-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-hover) 70%, var(--bg-elevated))'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
              >
                <Maximize2 size={10} strokeWidth={1.75} />
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                title="Cerrar"
                style={{
                  width: 21, height: 21, borderRadius: 6,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--bg-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.9)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.9)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(239,68,68,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <X size={10} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default memo(VideoPiPInner);
