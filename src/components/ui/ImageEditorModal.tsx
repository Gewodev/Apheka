import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Pencil } from 'lucide-react';

const BANNER_ASPECT = 16 / 7;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms',
};
const ghostBtn: React.CSSProperties = {
  height: 38, padding: '0 20px', borderRadius: 10, cursor: 'pointer',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)',
};

// ─── Editor de posición del banner ───
// El área visible (stage) ES el recorte con las dimensiones del banner (16:7).
// La imagen se ajusta sola al encuadre (cover, sin opciones de tamaño) y lo
// único editable es la POSICIÓN (arrastrar). Al aplicar se exporta un canvas
// con exactamente ese encuadre.
export default function ImageEditorModal({ src, title = 'Editar imagen', onConfirm, onCancel }: {
  src: string;
  title?: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [imgDims, setImgDims] = useState<{ nw: number; nh: number } | null>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgDims(null);
    setPanX(0);
    setPanY(0);
    setLoadError(false);
  }, [src]);

  const aspect = BANNER_ASPECT;
  const W = Math.min(560, 380 * aspect);
  const H = W / aspect;

  const s0 = imgDims ? Math.max(W / imgDims.nw, H / imgDims.nh) : 1;
  const dw = imgDims ? imgDims.nw * s0 : 0;
  const dh = imgDims ? imgDims.nh * s0 : 0;
  const lx = Math.max(0, (dw - W) / 2);
  const ly = Math.max(0, (dh - H) / 2);

  const clampPan = useCallback((x: number, y: number) => ({
    x: clamp(x, -lx, lx),
    y: clamp(y, -ly, ly),
  }), [lx, ly]);

  const handleApply = () => {
    if (!imgDims || busy) return;
    setBusy(true);
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setBusy(false); return; }
    ctx.scale(scale, scale);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const img = new Image();
    img.onload = () => {
      const stageX = (W - dw) / 2 + panX;
      const stageY = (H - dh) / 2 + panY;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, stageX, stageY, dw, dh);
      onConfirm(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => { setBusy(false); onCancel(); };
    img.src = src;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99996, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onCancel}>
      <div className="bento-card" onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: '94vw', padding: 24, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-elevated)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Inter Tight', sans-serif", margin: 0 }}>
            <Pencil size={16} style={{ color: 'var(--accent)' }} /> {title}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
        </div>

        {/* Stage: lo visible ES el recorte final */}
        <div ref={stageRef}
          onPointerDown={(e) => {
            if (!imgDims) return;
            dragRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const n = clampPan(
              dragRef.current.px + (e.clientX - dragRef.current.x),
              dragRef.current.py + (e.clientY - dragRef.current.y)
            );
            setPanX(n.x);
            setPanY(n.y);
          }}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
          onDoubleClick={() => { setPanX(0); setPanY(0); }}
          style={{
            width: W, height: H, margin: '0 auto', position: 'relative', overflow: 'hidden',
            borderRadius: 12, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none',
            background: 'repeating-conic-gradient(#232833 0% 25%, #1c212b 0% 50%) 0 0 / 18px 18px',
            border: '1px solid var(--border-default)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <img src={src} alt="" draggable={false}
            onLoad={(e) => { if (!imgDims) setImgDims({ nw: e.currentTarget.naturalWidth, nh: e.currentTarget.naturalHeight }); }}
            onError={() => setLoadError(true)}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: imgDims ? dw : '100%',
              height: imgDims ? dh : '100%',
              objectFit: imgDims ? undefined : 'cover',
              transform: imgDims ? `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))` : 'translate(-50%, -50%)',
              pointerEvents: 'none', userSelect: 'none', willChange: 'transform',
            }}
          />
          {loadError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>No se pudo cargar la imagen. Inténtalo de nuevo.</span>
            </div>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
          Arrastra para mover la imagen · doble clic para centrar
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} style={ghostBtn}>Cancelar</button>
          <button onClick={handleApply} disabled={!imgDims || busy || loadError}
            style={{
              height: 38, padding: '0 22px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: imgDims && !busy && !loadError ? 'var(--accent)' : 'var(--bg-hover)',
              color: imgDims && !busy && !loadError ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 200ms',
            }}>
            {busy ? 'Procesando…' : (<><Check size={14} /> Aplicar imagen</>)}
          </button>
        </div>
      </div>
    </div>
  );
}