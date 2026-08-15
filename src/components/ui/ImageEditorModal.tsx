import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, X, Check, Pencil } from 'lucide-react';

const BANNER_ASPECT = 16 / 7;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clampZoom = (z: number) => clamp(z, MIN_ZOOM, MAX_ZOOM);

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

// ─── Editor de imagen estilo "gran empresa": zoom y arrastre ───
// El área visible (stage) ES el recorte con las dimensiones del banner (16:7):
// la imagen se mueve/acerca por detrás y al aplicar se exporta un canvas
// con exactamente ese encuadre.
export default function ImageEditorModal({ src, title = 'Editar imagen', onConfirm, onCancel }: {
  src: string;
  title?: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [imgDims, setImgDims] = useState<{ nw: number; nh: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgDims(null);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [src]);

  const aspect = BANNER_ASPECT;
  const W = Math.min(560, 380 * aspect);
  const H = W / aspect;

  const s0 = imgDims ? Math.max(W / imgDims.nw, H / imgDims.nh) : 1;
  const s = s0 * zoom;
  const dw = imgDims ? imgDims.nw * s : 0;
  const dh = imgDims ? imgDims.nh * s : 0;
  const lx = Math.max(0, (dw - W) / 2);
  const ly = Math.max(0, (dh - H) / 2);

  const clampPan = useCallback((x: number, y: number) => ({
    x: clamp(x, -lx, lx),
    y: clamp(y, -ly, ly),
  }), [lx, ly]);

  // Rueda del ratón para acercar/alejar (listener no pasivo para poder preventDefault).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => clampZoom(z * (e.deltaY < 0 ? 1.08 : 0.92)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
          onDoubleClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
          style={{
            width: W, height: H, margin: '0 auto', position: 'relative', overflow: 'hidden',
            borderRadius: 12, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none',
            background: 'repeating-conic-gradient(#232833 0% 25%, #1c212b 0% 50%) 0 0 / 18px 18px',
            border: '1px solid var(--border-default)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          {imgDims ? (
            <img src={src} alt="" draggable={false}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                width: dw, height: dh,
                transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`,
                pointerEvents: 'none', userSelect: 'none', willChange: 'transform',
              }}
            />
          ) : (
            <img src={src} alt="" onLoad={(e) => setImgDims({ nw: e.currentTarget.naturalWidth, nh: e.currentTarget.naturalHeight })}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0, pointerEvents: 'none' }} />
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
          Arrastra para mover la imagen · rueda del ratón para acercar · doble clic para ajustar
        </p>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setZoom(z => clampZoom(z - 0.25))} title="Alejar" style={iconBtn}><ZoomOut size={15} /></button>
          <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom} onChange={e => setZoom(clampZoom(Number(e.target.value)))}
            style={{ width: 180, accentColor: 'var(--accent)' }} />
          <button onClick={() => setZoom(z => clampZoom(z + 0.25))} title="Acercar" style={iconBtn}><ZoomIn size={15} /></button>
          <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} title="Ajustar al encuadre" style={iconBtn}><Maximize2 size={15} /></button>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)', minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} style={ghostBtn}>Cancelar</button>
          <button onClick={handleApply} disabled={!imgDims || busy}
            style={{
              height: 38, padding: '0 22px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: imgDims && !busy ? 'var(--accent)' : 'var(--bg-hover)',
              color: imgDims && !busy ? '#fff' : 'var(--text-muted)',
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