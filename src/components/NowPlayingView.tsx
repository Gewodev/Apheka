import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, X, Music, Heart, Edit2 } from 'lucide-react';
import { useApp, globalAudio, getAudioLevel, initAudioAnalyser, disposeAudioAnalyser } from '../store/AppContext';

const AURA_CANVAS_SIZE = 1000;
const SIDEBAR_EXPANDED = 220;
const SIDEBAR_COLLAPSED = 64;

export default function NowPlayingView({ sidebarCollapsed, activeView }: { sidebarCollapsed: boolean; activeView?: string }) {
  const {
    coverModalTrackId, setCoverModalTrackId,
    tracks, currentTrackId, isPlayingMusic,
    shuffleMode, repeatMode, toggleMusicPlayback, playTrack,
    setShuffleMode, setRepeatMode, setMusicProgress,
    settings, musicQueue, trackHistory, toggleTrackFavorite, updateTrack,
  } = useApp();

  const track = tracks.find(t => t.id === coverModalTrackId);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mouseInside, setMouseInside] = useState(false);
  const visible = !!coverModalTrackId;
  const [progress, setProgress] = useState(0);
  const coverRef = useRef<HTMLDivElement>(null);
  const auraCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const halfSideRef = useRef(100);

  // Keep halfSide in sync with actual cover rendered size
  useEffect(() => {
    const updateHalf = () => {
      if (!coverRef.current || !auraCanvasRef.current) return;
      const coverW = coverRef.current.offsetWidth;
      const canvasCSS = coverW + 800;
      const nativeCover = AURA_CANVAS_SIZE * coverW / canvasCSS;
      halfSideRef.current = nativeCover / 2;
    };
    updateHalf();
    const ro = new ResizeObserver(updateHalf);
    if (coverRef.current) ro.observe(coverRef.current);
    return () => ro.disconnect();
  }, [coverModalTrackId]);
  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  // Track transition crossfade
  const prevCoverRef = useRef<string | undefined>(undefined);
  const [fadeCover, setFadeCover] = useState<string | undefined>(undefined);
  const [fadingOut, setFadingOut] = useState(false);
  const prevTrackIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!coverModalTrackId) return;
    if (coverModalTrackId !== prevTrackIdRef.current) {
      // Track changed — capture old cover for crossfade
      const oldTrack = prevTrackIdRef.current ? tracks.find(t => t.id === prevTrackIdRef.current) : undefined;
      if (oldTrack?.coverImage && track?.coverImage && oldTrack.coverImage !== track.coverImage) {
        setFadeCover(oldTrack.coverImage);
        setFadingOut(true);
        setTimeout(() => { setFadingOut(false); setFadeCover(undefined); }, 700);
      }
      prevTrackIdRef.current = coverModalTrackId;
    }
  }, [coverModalTrackId, tracks]);

  useEffect(() => {
    if (!coverModalTrackId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCoverModalTrackId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [coverModalTrackId, setCoverModalTrackId]);

  // Auto-close when switching away from music view
  useEffect(() => {
    if (activeView && activeView !== 'musica') {
      setCoverModalTrackId(null);
    }
  }, [activeView, setCoverModalTrackId]);

  const handleClose = useCallback(() => {
    setCoverModalTrackId(null);
    document.documentElement.style.removeProperty('--cover-dominant');
  }, [setCoverModalTrackId]);

  // Extract dominant color from cover for sidebar tint
  useEffect(() => {
    if (!track?.coverImage) {
      document.documentElement.style.removeProperty('--cover-dominant');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 50; c.height = 50;
      const ctx2 = c.getContext('2d');
      if (!ctx2) return;
      ctx2.drawImage(img, 0, 0, 50, 50);
      const d = ctx2.getImageData(0, 0, 50, 50).data;
      let r = 0, g = 0, b = 0, count = 0;
      // Sample border pixels (more representative of cover edge)
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          if (x > 5 && x < 44 && y > 5 && y < 44) continue; // skip center
          const idx = (y * 50 + x) * 4;
          r += d[idx]; g += d[idx + 1]; b += d[idx + 2]; count++;
        }
      }
      if (count > 0) {
        const hex = `#${((1 << 24) + (Math.round(r / count) << 16) + (Math.round(g / count) << 8) + Math.round(b / count)).toString(16).slice(1)}`;
        document.documentElement.style.setProperty('--cover-dominant', hex);
      }
    };
    img.src = track.coverImage;
    return () => { img.onload = null; };
  }, [track?.coverImage]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -8, y: dx * 8 });
    setMouseInside(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setMouseInside(false);
  }, []);

  useEffect(() => {
    if (!coverModalTrackId) return;
    const interval = setInterval(() => {
      if (globalAudio && !globalAudio.paused && globalAudio.duration) {
        setProgress(globalAudio.currentTime / globalAudio.duration);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [coverModalTrackId]);

  // Aura plasma orgánico permanente — fluye detrás de la portada
  useEffect(() => {
    if (!coverModalTrackId) return;
    initAudioAnalyser();

    const canvas = auraCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let prevSmooth = 0;
    let phase = 0;
    let firePhase = 0;

    const draw = () => {
      const raw = getAudioLevel();
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);

      // Sensibilidad mejorada — ataque rápido
      const level = raw > prevSmooth
        ? prevSmooth + (raw - prevSmooth) * 0.80
        : prevSmooth + (raw - prevSmooth) * 0.03;
      prevSmooth = level;

      phase += 0.008 + level * 0.06;
      firePhase += 0.015 + level * 0.05;

      const cx = w / 2;
      const cy = h / 2;
      const halfSide = halfSideRef.current;
      const inten = Math.min(1, level * 4.0);

      // ─── 5 burbujas plasmáticas superpuestas ───
      const numBlobs = 5;
      for (let b = 0; b < numBlobs; b++) {
        const driftX = Math.sin(phase * (0.03 + b * 0.02)) * halfSide * 0.4;
        const driftY = Math.cos(phase * (0.04 + b * 0.015)) * halfSide * 0.4;
        const bx = cx + driftX;
        const by = cy + driftY;
        const blobPhase = phase * (0.15 + b * 0.06);
        const size = halfSide * (0.25 + b * 0.20) + level * halfSide * 0.12;
        const amp = size * (0.25 + inten * 0.18);

        const pts: [number, number][] = [];
        const npts = 50 + b * 5;
        for (let i = 0; i < npts; i++) {
          const θ = (i / npts) * Math.PI * 2;
          const n = (
            Math.sin(θ * 2.0 + blobPhase) * 0.30 +
            Math.sin(θ * 3.5 - blobPhase * 0.7) * 0.25 +
            Math.sin(θ * 5.0 + blobPhase * 0.5) * 0.18 +
            Math.cos(θ * 1.5 + blobPhase * 0.3) * 0.15 +
            Math.sin(θ * 7.0 + blobPhase * 1.2) * 0.12
          );
          const r = Math.max(1, size + n * amp);
          pts.push([bx + Math.cos(θ) * r, by + Math.sin(θ) * r]);
        }

        const alpha = Math.max(0, 0.02 + inten * 0.025 - b * 0.003);
        if (alpha < 0.005) continue;

        ctx!.save();
        ctx!.filter = `blur(${4 + b * 4 + level * 2}px)`;
        ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          ctx!.lineTo(pts[i][0], pts[i][1]);
        }
        ctx!.closePath();
        ctx!.fill();
        ctx!.restore();
      }

      // ─── Luz central que rellena el hueco de la portada ───
      {
        const glowR = halfSide * (0.30 + Math.sin(phase * 0.3) * 0.05 + level * 0.10);
        const coreR = halfSide * (0.08 + level * 0.06);
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        g.addColorStop(0, `rgba(255,255,255,${0.06 + inten * 0.08})`);
        g.addColorStop(0.2, `rgba(255,255,255,${0.03 + inten * 0.05})`);
        g.addColorStop(0.5, `rgba(255,255,255,${0.01 + inten * 0.02})`);
        g.addColorStop(1, `rgba(255,255,255,0)`);
        ctx!.save();
        ctx!.filter = `blur(${2 + level * 3}px)`;
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();

        // Core más brillante
        const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        core.addColorStop(0, `rgba(255,255,255,${0.08 + inten * 0.12})`);
        core.addColorStop(0.5, `rgba(255,255,255,${0.03 + inten * 0.06})`);
        core.addColorStop(1, `rgba(255,255,255,0)`);
        ctx!.save();
        ctx!.fillStyle = core;
        ctx!.beginPath();
        ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // ─── Fuego y humo sutiles desde múltiples direcciones ───
      {
        const fireInten = Math.min(1, level * 2.5) * 0.10 + 0.01;
        if (fireInten > 0.01) {
          const fr = halfSide * (0.6 + Math.sin(firePhase * 0.3) * 0.15);

          // Fuego desde 4 direcciones cardinales
          const fireDirs = [
            { ax: 0.4, ay: 0.1, phOff: 0 },     // arriba
            { ax: -0.3, ay: 0.4, phOff: 2.1 },   // abajo-izq
            { ax: 0.5, ay: -0.3, phOff: 4.2 },   // arriba-dcho
            { ax: -0.4, ay: -0.4, phOff: 1.7 },  // abajo-dcho
          ];
          for (let d = 0; d < fireDirs.length; d++) {
            const dir = fireDirs[d];
            for (let fi = 0; fi < 2; fi++) {
              const fx = cx + Math.sin(firePhase * dir.ax + fi * 2.1 + dir.phOff) * halfSide * 0.5;
              const fy = cy + Math.cos(firePhase * dir.ay + fi * 1.7 + dir.phOff) * halfSide * 0.5;
              const fs = fr * (0.25 + fi * 0.20 + Math.sin(firePhase + d) * 0.05);
              const g = ctx!.createRadialGradient(fx, fy, 0, fx, fy, fs);
              const a = fireInten * (1 - fi * 0.25) * (0.6 + d * 0.1);
              g.addColorStop(0, `rgba(255,200,130,${a * 0.7})`);
              g.addColorStop(0.3, `rgba(255,140,50,${a * 0.5})`);
              g.addColorStop(0.6, `rgba(200,70,10,${a * 0.25})`);
              g.addColorStop(1, `rgba(255,80,0,0)`);
              ctx!.save();
              ctx!.filter = `blur(${4 + fi * 5 + level * 3}px)`;
              ctx!.fillStyle = g;
              ctx!.beginPath();
              ctx!.arc(fx, fy, fs, 0, Math.PI * 2);
              ctx!.fill();
              ctx!.restore();
            }
          }

          // Humo gris desde los laterales
          const smokeInten = fireInten * 0.5;
          for (let si = 0; si < 6; si++) {
            const sx = cx + Math.sin(firePhase * 0.2 + si * 1.05) * halfSide * (0.8 + Math.sin(firePhase * 0.1 + si) * 0.3);
            const sy = cy + Math.cos(firePhase * 0.25 + si * 0.9) * halfSide * (0.8 + Math.cos(firePhase * 0.15 + si) * 0.3);
            const ss = halfSide * (0.3 + si * 0.12 + Math.sin(firePhase * 0.4 + si * 0.5) * 0.1);
            const sg = ctx!.createRadialGradient(sx, sy, 0, sx, sy, ss);
            const sa = smokeInten * (0.15 - si * 0.02) * (0.5 + Math.sin(firePhase * 0.3 + si) * 0.3);
            if (sa < 0.003) continue;
            sg.addColorStop(0, `rgba(180,180,190,${sa})`);
            sg.addColorStop(0.5, `rgba(120,120,130,${sa * 0.5})`);
            sg.addColorStop(1, `rgba(80,80,90,0)`);
            ctx!.save();
            ctx!.filter = `blur(${10 + si * 4}px)`;
            ctx!.fillStyle = sg;
            ctx!.beginPath();
            ctx!.arc(sx, sy, ss, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.restore();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      disposeAudioAnalyser();
    };
  }, [coverModalTrackId]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    if (globalAudio && globalAudio.duration) {
      globalAudio.currentTime = val * globalAudio.duration;
    }
    setMusicProgress(val);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isCurrentTrack = track && track.id === currentTrackId;
  const currentTime = progress * (globalAudio?.duration || 1);
  const totalDuration = globalAudio?.duration || track?.duration || 0;
  const acC = settings.accentColor || '#E11D48';

  const isLight = (hex: string) => {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
  };

  if (!track) return null;

  const bgImage = track.coverImage;
  const hasCover = !!bgImage;
  const isDarkMode = settings.theme === 'oscuro' || (settings.theme === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches) || settings.theme === 'vibrante';
  const coverBgMode = settings.coverBgMode || 'auto';

  // Compute solid base background according to coverBgMode
  const coverBaseBg = (() => {
    const appBg = settings.useThreeColors && settings.surfaceColor
      ? settings.surfaceColor
      : isDarkMode ? '#020203' : '#f5f0ea';
    switch (coverBgMode) {
      case 'black': return '#000';
      case 'gray': return '#1a1a1a';
      case 'theme': return appBg;
      default: return hasCover ? '#000' : appBg;
    }
  })();

  // Whether to show blurred cover or not
  const showBlurredCover = coverBgMode === 'auto' && hasCover;
  const isLightBg = hasCover ? false : !isDarkMode;
  const textMain = isLightBg ? '#1a1a1a' : '#fff';
  const textMuted = isLightBg ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.5)';
  const textLow = isLightBg ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        left: sidebarW,
        zIndex: 10000,
        display: 'flex',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 400ms ease, left 300ms ease',
      }}
    >
        {/* Solid base — according to coverBgMode */}
      <div style={{ position: 'absolute', inset: 0, background: coverBaseBg }} />

      {/* Blurred background — cover art fills entirely (auto mode only) */}
      {showBlurredCover && (
        <div
          style={{
            position: 'absolute',
            inset: -80,
            background: `url(${bgImage}) center/cover no-repeat`,
            filter: 'blur(100px) saturate(2.2)',
            transform: visible ? 'scale(1.1)' : 'scale(1.35)',
            transition: 'background-image 600ms ease, transform 500ms ease',
          }}
        />
      )}

      {/* Edge darkening vignette — smooth radial fade to black at corners */}
      {showBlurredCover && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* Fading old cover for crossfade (auto mode only) */}
      {showBlurredCover && fadeCover && (
        <div
          style={{
            position: 'absolute',
            inset: -80,
            background: `url(${fadeCover}) center/cover no-repeat`,
            filter: 'blur(100px) saturate(2.2)',
            opacity: fadingOut ? 0 : 1,
            transition: 'opacity 700ms ease',
            zIndex: 1,
          }}
        />
      )}

      {/* Dark overlay — adjusted per coverBgMode */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: coverBgMode === 'auto' && hasCover
            ? 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 100%)'
            : coverBgMode === 'theme' || !hasCover
              ? 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.08) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.20) 100%)',
          cursor: 'pointer',
          opacity: visible ? 1 : 0,
          transition: 'opacity 400ms ease',
        }}
      />

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          zIndex: 20,
          transition: 'background 200ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      >
        <X size={18} />
      </button>

      {/* Main content: side-by-side layout — closes from the front */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          gap: '6%',
          padding: '0 6%',
          transform: visible ? 'translateX(0) translateY(0) scale(1)' : 'translateX(0) translateY(30px) scale(0.92)',
          opacity: visible ? 1 : 0,
          transition: 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 350ms ease',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {/* LEFT: Cover art with 3D tilt and square audio-reactive aura */}
        <div
          style={{
            flex: '0 0 min(48vw, 450px)',
            maxWidth: 'min(48vw, 450px)',
            aspectRatio: '1/1',
            position: 'relative',
          }}
        >
          {/* Square aura canvas layer — unlimited extent */}
          <canvas
            ref={auraCanvasRef}
            width={AURA_CANVAS_SIZE}
            height={AURA_CANVAS_SIZE}
            style={{
              position: 'absolute',
              inset: '50% 0 0 50%',
              width: 'calc(100% + 800px)',
              height: 'calc(100% + 800px)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* Cover image with 3D tilt */}
          <div
            ref={coverRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClose}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 14,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 3,
              boxShadow: mouseInside
                ? '0 24px 64px rgba(0,0,0,0.6), 0 0 80px rgba(255,255,255,0.04)'
                : '0 16px 48px rgba(0,0,0,0.5)',
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: mouseInside ? 'box-shadow 100ms' : 'transform 500ms ease, box-shadow 500ms ease',
              cursor: 'pointer',
            }}
          >
            {/* Hover exit-hint overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: mouseInside ? 1 : 0,
              pointerEvents: mouseInside ? 'auto' : 'none',
              transition: 'opacity 300ms ease',
              zIndex: 5,
              borderRadius: 14,
            }}>
              <div style={{
                width: 40, height: 40,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
                transform: mouseInside ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(8px)',
                transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
              }}>
                <X size={20} />
              </div>
            </div>

            {track.coverImage ? (
              <img
                src={track.coverImage}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${acC}18`,
                  position: 'relative',
                }}
              >
                {/* Border that picks up app accent color */}
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 14,
                  border: `1.5px solid ${acC}40`,
                  pointerEvents: 'none',
                }} />
                <Music size={56} style={{ color: acC, opacity: 0.65 }} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Track info, progress, controls */}
        <div
          style={{
            flex: '1 1 38%',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            padding: '0 4px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 400ms ease 120ms, transform 400ms ease 120ms',
            maxWidth: 400,
          }}
        >
          {/* Track info */}
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Inter Tight', 'SF Pro Display', -apple-system, sans-serif",
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                margin: 0,
                background: hasCover ? 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)' : 'none',
                WebkitBackgroundClip: hasCover ? 'text' : undefined,
                WebkitTextFillColor: hasCover ? 'transparent' : undefined,
                backgroundClip: hasCover ? 'text' : undefined,
                color: hasCover ? 'transparent' : textMain,
              }}
            >
              {track.title}
            </h1>
            {track.artist && (
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: textMuted,
                  marginTop: 6,
                  marginBottom: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {track.artist}
              </p>
            )}
          </div>

          {/* Action buttons: favourite + edit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => toggleTrackFavorite(track.id)}
              style={{
                background: 'none', border: 'none', padding: 6, cursor: 'pointer',
                color: track.isFavorite ? textMain : textMuted, display: 'flex', borderRadius: 6, transition: 'color 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = textMain; }}
              onMouseLeave={e => { e.currentTarget.style.color = track.isFavorite ? textMain : textMuted; }}
              title={track.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
              <Heart size={18} style={{ fill: track.isFavorite ? textMain : 'none' }} />
            </button>
            <button onClick={() => { setEditing(true); setEditTitle(track.title); setEditArtist(track.artist || ''); }}
              style={{
                background: 'none', border: 'none', padding: 6, cursor: 'pointer',
                color: textLow, display: 'flex', borderRadius: 6, transition: 'color 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = textMuted; }}
              onMouseLeave={e => { e.currentTarget.style.color = textLow; }}
              title="Editar canción">
              <Edit2 size={15} />
            </button>
          </div>

          {editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 14 }}>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#1a1a1a', outline: 'none' }}
                placeholder="Título" autoFocus />
              <input value={editArtist} onChange={e => setEditArtist(e.target.value)}
                style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#1a1a1a', outline: 'none' }}
                placeholder="Artista" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditing(false)}
                  style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: textMuted }}>
                  Cancelar
                </button>
                <button onClick={() => { updateTrack(track.id, { title: editTitle, artist: editArtist }); setEditing(false); }}
                  style={{ background: acC, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={handleProgressChange}
              style={{
                width: '100%',
                height: 4,
                borderRadius: 3,
                WebkitAppearance: 'none',
                appearance: 'none',
                background: `linear-gradient(to right, ${textMain} ${progress * 100}%, ${textLow} ${progress * 100}%)`,
                outline: 'none',
                cursor: 'pointer',
                transition: 'height 200ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.height = '6px')}
              onMouseLeave={e => (e.currentTarget.style.height = '4px')}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontSize: 11,
                fontWeight: 500,
                color: textLow,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Controls — centered, slightly smaller */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              marginTop: 4,
            }}
          >
            {/* Shuffle */}
            <button
              onClick={() => setShuffleMode(!shuffleMode)}
              style={{
                background: 'none',
                border: 'none',
                color: shuffleMode ? acC : textLow,
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 200ms',
              }}
            >
              <Shuffle size={16} />
            </button>

            {/* Prev — from history */}
            <button
              onClick={() => {
                if (track.id !== currentTrackId) {
                  return playTrack(track.id);
                }
                // trackHistory[0] = current, trackHistory[1] = previous
                const prevId = trackHistory.length > 1 ? trackHistory[1] : null;
                if (prevId) {
                  setCoverModalTrackId(prevId);
                  playTrack(prevId);
                } else {
                  const idx = tracks.findIndex(t => t.id === currentTrackId);
                  if (idx > 0) {
                    const newId = tracks[idx - 1].id;
                    setCoverModalTrackId(newId);
                    playTrack(newId);
                  }
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: textMuted,
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SkipBack size={20} />
            </button>

            {/* Play/Pause — clean, polished */}
            <button
              onClick={() => {
                if (track.id !== currentTrackId) {
                  playTrack(track.id);
                } else {
                  toggleMusicPlayback();
                }
              }}
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                border: 'none',
                background: hasCover ? 'rgba(255,255,255,0.93)' : (isLightBg ? acC : 'rgba(255,255,255,0.93)'),
                color: hasCover ? '#000' : (isLightBg ? '#fff' : '#000'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 150ms, background 200ms, box-shadow 200ms',
                boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.25)';
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'scale(0.95)';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.20)';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.35)';
              }}
            >
              {isPlayingMusic && isCurrentTrack ? (
                <Pause size={22} />
              ) : (
                <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />
              )}
            </button>

            {/* Next — use queue */}
            <button
              onClick={() => {
                if (track.id !== currentTrackId) {
                  return playTrack(track.id);
                }
                const nextId = musicQueue[0];
                if (nextId) {
                  setCoverModalTrackId(nextId);
                  playTrack(nextId);
                } else {
                  const idx = tracks.findIndex(t => t.id === currentTrackId);
                  if (idx < tracks.length - 1) {
                    const newId = tracks[idx + 1].id;
                    setCoverModalTrackId(newId);
                    playTrack(newId);
                  }
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: textMuted,
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SkipForward size={20} />
            </button>

            {/* Repeat */}
            <button
              onClick={() => {
                const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
                const idx = modes.indexOf(repeatMode);
                setRepeatMode(modes[(idx + 1) % modes.length]);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: repeatMode !== 'none' ? acC : textLow,
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'color 200ms',
              }}
            >
              <Repeat size={16} />
              {repeatMode === 'one' && (
                <span
                  style={{
                    position: 'absolute',
                    fontSize: 8,
                    fontWeight: 700,
                    top: 2,
                    right: 2,
                    color: acC,
                  }}
                >
                  1
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
