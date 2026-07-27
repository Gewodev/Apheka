import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface VideoPiPProps {
  url: string | null;
  title: string;
  onClose: () => void;
}

const DEFAULT_W = 420;
const DEFAULT_H = 260;
const MIN_W = 240;
const MIN_H = 140;
const BAR_H = 28;

function extractYouTubeId(raw: string): string | null {
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

function VideoPiPInner({ url, title, onClose }: VideoPiPProps) {
  const [hovered, setHovered] = useState(false);
  const posRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: DEFAULT_W, h: DEFAULT_H });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, origW: 0, origH: 0 });

  const initialPos = useMemo(() => {
    const x = Math.round((window.innerWidth - DEFAULT_W) / 2);
    const y = Math.round((window.innerHeight - DEFAULT_H) / 2);
    return { x, y };
  }, []);

  useEffect(() => {
    posRef.current = initialPos;
  }, [initialPos]);

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
        dragRef.current.active = false;
        resizeRef.current.active = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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

  if (!url) return null;

  const ytId = extractYouTubeId(url);
  const isVideo = isDirectVideo(url);

  return createPortal(
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: DEFAULT_W,
        height: DEFAULT_H,
        transform: `translate(${initialPos.x}px, ${initialPos.y}px)`,
        zIndex: 99990,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0a0a0c',
        border: hovered ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: hovered
          ? '0 20px 60px rgba(0,0,0,0.65), 0 4px 20px rgba(0,0,0,0.4)'
          : '0 12px 40px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)',
        willChange: 'transform',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
      }}
    >
      {/* Thin drag bar at top */}
      <div
        onMouseDown={handleDragDown}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: BAR_H,
          cursor: 'grab', zIndex: 5,
          background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          transition: 'background 150ms',
        }}
      />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        title="Cerrar"
        style={{
          position: 'absolute', top: 4, right: 4, zIndex: 10,
          width: 20, height: 20, borderRadius: 5, border: 'none',
          background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: hovered ? 'rgba(255,255,255,0.6)' : 'transparent',
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.8)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = hovered ? 'rgba(255,255,255,0.08)' : 'transparent'; e.currentTarget.style.color = hovered ? 'rgba(255,255,255,0.6)' : 'transparent'; }}
      >
        <X size={11} strokeWidth={2.5} />
      </button>

      {/* Title */}
      <div
        style={{
          position: 'absolute', top: 0, left: 12, right: 32, height: BAR_H,
          display: 'flex', alignItems: 'center', zIndex: 4, pointerEvents: 'none',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: hovered ? 'rgba(255,255,255,0.55)' : 'transparent',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '-0.01em',
          lineHeight: 1,
          transition: 'color 150ms',
        }}>
          {title}
        </span>
      </div>

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
      }}>
        {ytId ? (
          <iframe
            key={ytId}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1&rel=0&modestbranding=1`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          />
        ) : isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)', fontSize: 12,
          }}>
            Formato no soportado
          </div>
        )}
      </div>

      {/* Resize grip */}
      <div
        onMouseDown={handleResizeDown}
        style={{
          position: 'absolute',
          right: 0, bottom: 0,
          width: 16, height: 16,
          cursor: 'nwse-resize',
          zIndex: 6,
        }}
      />
    </div>,
    document.body
  );
}

export default memo(VideoPiPInner);
