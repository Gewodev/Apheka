import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Maximize2, GripVertical } from 'lucide-react';

export interface VideoPiPProps {
  url: string | null;
  title: string;
  onClose: () => void;
}

const DEFAULT_W = 420;
const DEFAULT_H = 260;
const MIN_W = 280;
const MIN_H = 180;

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
  const [minimized, setMinimized] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const posRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, origW: 0, origH: 0 });
  const sizeRef = useRef(size);
  const minimizedRef = useRef(minimized);
  sizeRef.current = size;
  minimizedRef.current = minimized;

  useEffect(() => {
    posRef.current = {
      x: Math.round((window.innerWidth - DEFAULT_W) / 2),
      y: Math.round((window.innerHeight - DEFAULT_H) / 2),
    };
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const c = containerRef.current;
      if (!c) return;
      if (dragRef.current.active) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const nx = dragRef.current.origX + dx;
        const ny = dragRef.current.origY + dy;
        posRef.current = { x: nx, y: ny };
        c.style.transform = `translate(${nx}px, ${ny}px)`;
      }
      if (resizeRef.current.active) {
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        setSize({
          w: Math.max(MIN_W, resizeRef.current.origW + dx),
          h: Math.max(MIN_H, resizeRef.current.origH + dy),
        });
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized(m => !m);
  }, []);

  if (!url) return null;

  const ytId = extractYouTubeId(url);
  const isVideo = isDirectVideo(url);
  const headerH = 36;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: size.w,
        height: minimized ? headerH : size.h,
        zIndex: 99990,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#111114',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 2px 12px rgba(0,0,0,0.3)',
        willChange: 'transform',
        transition: 'width 200ms cubic-bezier(0.16,1,0.3,1), height 200ms cubic-bezier(0.16,1,0.3,1), border-radius 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Header / grab area */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: headerH,
          minHeight: headerH,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px 0 12px',
          cursor: 'grab',
          background: '#18181b',
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.06)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <GripVertical size={14} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        <span style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1,
          fontFamily: "'Inter Tight', sans-serif",
          letterSpacing: '-0.01em',
        }}>
          {title}
        </span>
        <button
          onClick={handleMinimize}
          title={minimized ? 'Expandir' : 'Minimizar'}
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.45)', cursor: 'pointer', flexShrink: 0,
            transition: 'all 120ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
        >
          {minimized ? <Maximize2 size={13} /> : <Minus size={13} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          title="Cerrar"
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.45)', cursor: 'pointer', flexShrink: 0,
            transition: 'all 120ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Video content */}
      <div style={{
        width: '100%',
        flex: 1,
        overflow: 'hidden',
        borderRadius: minimized ? 0 : '0 0 12px 12px',
        transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
        background: '#000',
      }}>
        {ytId ? (
          <iframe
            key={ytId}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1&rel=0&modestbranding=1`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
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
      {!minimized && (
        <div
          onMouseDown={handleResizeDown}
          style={{
            position: 'absolute',
            right: 1, bottom: 1,
            width: 16, height: 16,
            cursor: 'nwse-resize',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: 2,
            zIndex: 2,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <line x1="8" y1="1" x2="1" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" />
            <line x1="8" y1="4.5" x2="4.5" y2="8" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
}

export default memo(VideoPiPInner);
