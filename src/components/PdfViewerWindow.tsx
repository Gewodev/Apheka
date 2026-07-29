import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, Pin, PinOff, Minus, Maximize2, Maximize, FileText, Download, Music, Film, Image, RotateCcw } from 'lucide-react';

interface ViewerData { url: string; title: string; type: string; }

const PRESETS = [
  { label: 'A4 vertical', w: 720, h: 960 },
  { label: 'A4 horizontal', w: 1020, h: 720 },
  { label: '16:9', w: 1120, h: 630 },
  { label: 'Cuadrada', w: 720, h: 720 },
  { label: 'Pantalla completa', w: 0, h: 0 },
];

export default function PdfViewerWindow() {
  const [data, setData] = useState<ViewerData | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showResizer, setShowResizer] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const url = sp.get('vw_url');
    const title = sp.get('vw_title');
    const type = sp.get('vw_type');
    if (url && title && type) {
      setData({ url, title, type });
      document.title = title;
    }
  }, []);

  const handleClose = useCallback(async () => {
    try { await getCurrentWindow().destroy(); } catch { window.close(); }
  }, []);

  const handleMinimize = useCallback(async () => {
    try { await getCurrentWindow().minimize(); } catch {}
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      if (maximized) { await win.unmaximize(); setIsMaximized(false); }
      else { await win.maximize(); setIsMaximized(true); }
    } catch {}
  }, []);

  const handlePin = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const next = !isPinned;
      await win.setAlwaysOnTop(next);
      setIsPinned(next);
    } catch {}
  }, [isPinned]);

  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    try { await getCurrentWindow().startDragging(); } catch {}
  }, []);

  const handlePreset = useCallback(async (w: number, h: number) => {
    try {
      const win = getCurrentWindow();
      if (w === 0 && h === 0) {
        await win.maximize();
        setIsMaximized(true);
      } else {
        const maximized = await win.isMaximized();
        if (maximized) { await win.unmaximize(); setIsMaximized(false); }
        const { LogicalSize } = await import('@tauri-apps/api/dpi');
        await win.setSize(new LogicalSize(w, h));
        await win.center();
      }
    } catch {}
    setShowResizer(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!data?.url) return;
    const a = document.createElement('a');
    a.href = data.url;
    a.download = data.title;
    a.click();
  }, [data]);

  const typeLabel = data?.type === 'pdf' ? 'PDF' : data?.type === 'image' ? 'IMG' : data?.type === 'video' ? 'VID' : data?.type === 'audio' ? 'AUD' : 'FILE';
  const iconColor = data?.type === 'pdf' ? '#EF4444' : data?.type === 'image' ? '#F59E0B' : data?.type === 'video' ? '#EC4899' : data?.type === 'audio' ? '#8B5CF6' : '#3B82F6';
  const TypeIcon = data?.type === 'pdf' ? FileText : data?.type === 'image' ? Image : data?.type === 'video' ? Film : data?.type === 'audio' ? Music : FileText;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0c0c0f',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Custom title bar */}
      <div
        onMouseDown={handleDrag}
        style={{
          height: 40,
          display: 'flex', alignItems: 'center',
          padding: '0 12px',
          background: 'rgba(255,255,255,0.025)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          userSelect: 'none',
          cursor: 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, paddingLeft: 2 }}>
          {data && (
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: `${iconColor}15`, border: `1px solid ${iconColor}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <TypeIcon size={11} style={{ color: iconColor }} />
            </div>
          )}
          <span style={{
            fontSize: 12.5, fontWeight: 500, color: data ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360,
          }}>{data?.title || 'Cargando...'}</span>
          {data && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: iconColor,
              background: `${iconColor}12`, padding: '2px 7px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
            }}>{typeLabel}</span>
          )}
          {isPinned && (
            <span style={{ fontSize: 8, fontWeight: 600, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', padding: '2px 5px', borderRadius: 3, flexShrink: 0 }}>PIN</span>
          )}
        </div>

        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {data && (
            <>
              <button onClick={handleDownload}
                style={{ width: 30, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                title="Descargar"
              ><Download size={13} /></button>

              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowResizer(v => !v)}
                  style={{ width: 30, height: 28, borderRadius: 6, border: 'none', background: showResizer ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={e => { if (!showResizer) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; } }}
                  title="Tamaño de ventana"
                >{isMaximized ? <RotateCcw size={13} /> : <Maximize size={13} />}</button>
                {showResizer && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: 4, zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    minWidth: 160,
                  }}>
                    {PRESETS.map(p => (
                      <button key={p.label} onClick={() => handlePreset(p.w, p.h)}
                        style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 11.5, textAlign: 'left', cursor: 'pointer', borderRadius: 5, transition: 'all 120ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                      >{p.label}{p.w ? ` (${p.w}×${p.h})` : ''}</button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <button onClick={handlePin}
            style={{ width: 30, height: 28, borderRadius: 6, border: 'none', background: isPinned ? 'rgba(251,191,36,0.12)' : 'transparent', cursor: 'pointer', color: isPinned ? '#FBBF24' : 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { if (!isPinned) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; } }}
            onMouseLeave={e => { if (!isPinned) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; } }}
            title={isPinned ? 'Desanclar' : 'Siempre encima'}
          >{isPinned ? <PinOff size={13} /> : <Pin size={13} />}</button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', margin: '0 3px' }} />

          <button onClick={handleMinimize}
            style={{ width: 30, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            title="Minimizar"
          ><Minus size={13} /></button>

          <button onClick={handleMaximize}
            style={{ width: 30, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            title="Maximizar"
          >{isMaximized ? <Maximize2 size={13} /> : <Maximize size={13} />}</button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', margin: '0 2px' }} />

          <button onClick={handleClose}
            style={{ width: 30, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            title="Cerrar"
          ><X size={14} /></button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a0c', position: 'relative' }}>
        {!data ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              <FileText size={22} style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Preparando visor...</span>
          </div>
        ) : data.type === 'pdf' ? (
          error ? (
            <PdfFallback url={data.url} title={data.title} />
          ) : (
            <object
              data={data.url}
              type="application/pdf"
              style={{ width: '100%', height: '100%', border: 'none' }}
              onError={() => setError(true)}
            >
              <PdfFallback url={data.url} title={data.title} />
            </object>
          )
        ) : data.type === 'image' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', padding: 16 }}>
            <img src={data.url} alt={data.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
          </div>
        ) : data.type === 'video' ? (
          <video
            src={data.url}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            onError={() => setError(true)}
          />
        ) : data.type === 'audio' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', gap: 24 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 24,
              background: `linear-gradient(135deg, ${iconColor}12, ${iconColor}06)`,
              border: `1px solid ${iconColor}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Music size={36} style={{ color: iconColor, opacity: 0.6 }} />
            </div>
            <audio src={data.url} controls autoPlay style={{ width: 400, maxWidth: '85%' }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: -8 }}>{data.title}</span>
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={28} style={{ color: 'rgba(255,255,255,0.25)' }} />
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Vista previa no disponible para este formato</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{data.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PdfFallback({ url, title }: { url: string; title: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0a0a0c' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FileText size={28} style={{ color: '#EF4444', opacity: 0.6 }} />
      </div>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>El visor nativo de PDF no está disponible</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{title}</span>
      <iframe src={url} title={title} style={{ width: '90%', height: '80%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: '#fff' }} />
    </div>
  );
}
