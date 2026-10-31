import {useAppSlice} from "../store/AppContext";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, X, Music, Heart, Edit2 } from 'lucide-react';
import { useApp, globalAudio } from '../store/AppContext';

const SIDEBAR_EXPANDED = 236;
const SIDEBAR_COLLAPSED = 64;

export default function NowPlayingView({ sidebarCollapsed, activeView }: { sidebarCollapsed: boolean; activeView?: string }) {
  const {
    coverModalTrackId, setCoverModalTrackId,
    tracks, currentTrackId, isPlayingMusic,
    shuffleMode, repeatMode, toggleMusicPlayback, playTrack,
    setShuffleMode, setRepeatMode, setMusicProgress,
    settings, musicQueue, trackHistory, toggleTrackFavorite, updateTrack, queueSource,
  } = useAppSlice(["coverModalTrackId","setCoverModalTrackId","tracks","currentTrackId","isPlayingMusic","shuffleMode","repeatMode","toggleMusicPlayback","playTrack","setShuffleMode","setRepeatMode","setMusicProgress","settings","musicQueue","trackHistory","toggleTrackFavorite","updateTrack","queueSource"]);

  const track = tracks.find(t => t.id === coverModalTrackId);
  const artwork=track?.coverImage||track?.coverUrl;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [mouseInside, setMouseInside] = useState(false);
  const visible = !!coverModalTrackId;
  const [progress, setProgress] = useState(0);
  const [dominantColor, setDominantColor] = useState('#000');
  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  useEffect(() => { setEditing(false); setEditTitle(''); setEditArtist(''); }, [coverModalTrackId]);

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
  }, [setCoverModalTrackId]);

  // Extract dominant color from cover
  useEffect(() => {
    if (!artwork) {
      setDominantColor('#000');
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
      let d: Uint8ClampedArray;
      try { d = ctx2.getImageData(0, 0, 50, 50).data; } catch { setDominantColor('#202024'); return; }
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i + 1]; b += d[i + 2]; count++;
      }
      if (count > 0) {
        const hex = `#${((1 << 24) + (Math.round(r / count) << 16) + (Math.round(g / count) << 8) + Math.round(b / count)).toString(16).slice(1)}`;
        setDominantColor(hex);
      }
    };
    img.src = artwork;
    return () => { img.onload = null; };
  }, [artwork]);

  const handleMouseMove = useCallback(() => { setMouseInside(true); }, []);
  const handleMouseLeave = useCallback(() => { setMouseInside(false); }, []);

  useEffect(() => {
    if (!coverModalTrackId || coverModalTrackId !== currentTrackId) { setProgress(0); return; }
    const sync = () => {
      if (Number.isFinite(globalAudio.duration) && globalAudio.duration > 0) {
        setProgress(Math.max(0, Math.min(1, globalAudio.currentTime / globalAudio.duration)));
      }
    };
    sync();
    const update = () => { if (!document.hidden) sync(); };
    globalAudio.addEventListener('timeupdate', update);globalAudio.addEventListener('loadedmetadata', update);document.addEventListener('visibilitychange', update);
    return () => {globalAudio.removeEventListener('timeupdate', update);globalAudio.removeEventListener('loadedmetadata', update);document.removeEventListener('visibilitychange', update);};
  }, [coverModalTrackId, currentTrackId]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (coverModalTrackId !== currentTrackId || !Number.isFinite(globalAudio.duration) || globalAudio.duration <= 0) return;
    const val = Math.max(0, Math.min(1, parseFloat(e.target.value)));
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
  const totalDuration = isCurrentTrack && Number.isFinite(globalAudio.duration) && globalAudio.duration > 0 ? globalAudio.duration : Math.max(0, track?.duration || 0);
  const currentTime = isCurrentTrack ? progress * totalDuration : 0;
  const acC = settings.accentColor || '#E11D48';

  const isLight = (hex: string) => {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
  };

  if (!track) return null;

  const bgImage = artwork;
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
      default: return hasCover ? dominantColor : appBg;
    }
  })();

  // Whether to show blurred cover or not
  const showBlurredCover = coverBgMode === 'auto' && hasCover;
  // Theme mode: show app bg image behind
  const showThemeBg = coverBgMode === 'theme' && !!settings.backgroundImage;
  const isLightBg = isLight(coverBaseBg);
  const textMain = isLightBg ? '#1a1a1a' : '#fff';
  const textMuted = isLightBg ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.5)';
  const textLow = isLightBg ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';

  return (
    <div className="now-playing-view" role="dialog" aria-modal="true" aria-label="Portada ampliada"
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
            inset: -24,
            background: `url(${bgImage}) center/cover no-repeat`,
            filter: 'blur(18px) saturate(.8)',
            transform: 'none',
            transition: 'background-image 600ms ease, transform 500ms ease',
          }}
        />
      )}

      {/* Theme mode: app background image blurred behind */}
      {showThemeBg && (
        <div
          style={{
            position: 'absolute',
            inset: -24,
            background: `url(${settings.backgroundImage}) center/cover no-repeat`,
            filter: 'blur(18px) brightness(var(--bg-brightness, 100%))',
            transform: 'none',
            transition: 'transform 500ms ease',
          }}
        />
      )}

      {/* Click-to-close overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          cursor: 'pointer',
          opacity: visible ? 1 : 0,
          transition: 'opacity 400ms ease',
        }}
      />

      {/* Close button */}
      <button aria-label="Cerrar portada ampliada"
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
          color: textMain,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'none',
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
        {/* LEFT: Static artwork, without a continuous rendering loop */}
        <div
          style={{
            flex: '0 0 min(48vw, 450px)',
            maxWidth: 'min(48vw, 450px)',
            aspectRatio: '1/1',
            position: 'relative',
          }}
        >
          {/* Cover image */}
          <div
            className="now-playing-cover"
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
              transform: 'none',
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
                backdropFilter: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
                transform: mouseInside ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(8px)',
                transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
              }}>
                <X size={20} />
              </div>
            </div>

            {artwork ? (
              <img
                src={artwork}
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
              <input aria-label="Título de la canción" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#1a1a1a', outline: 'none' }}
                placeholder="Título" autoFocus />
              <input aria-label="Artista de la canción" value={editArtist} onChange={e => setEditArtist(e.target.value)}
                style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#1a1a1a', outline: 'none' }}
                placeholder="Artista" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditing(false)}
                  style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: textMuted }}>
                  Cancelar
                </button>
                <button disabled={!editTitle.trim()} onClick={async () => { if (!editTitle.trim()) return; await updateTrack(track.id, { title: editTitle.trim(), artist: editArtist.trim() }); setEditing(false); }}
                  style={{ background: acC, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div>
            <input
              aria-label="Posición de reproducción" disabled={!isCurrentTrack || !Number.isFinite(globalAudio.duration) || globalAudio.duration <= 0} type="range"
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
            <button aria-label="Reproducción aleatoria" aria-pressed={shuffleMode}
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
            <button aria-label="Canción anterior"
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
            <button aria-label={isPlayingMusic && isCurrentTrack ? "Pausar canción" : "Reproducir canción"}
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
            <button aria-label="Canción siguiente"
              onClick={() => {
                if (track.id !== currentTrackId) {
                  return playTrack(track.id);
                }
                const nextId = musicQueue[0];
                if (nextId) {
                  setCoverModalTrackId(nextId);
                  playTrack(nextId);
                } else {
                  const pool = queueSource?.pool ?? tracks.map(t => t.id);
                  if (shuffleMode) {
                    const rest = pool.filter(tid => tid !== currentTrackId);
                    if (rest.length > 0) { const pick = rest[Math.floor(Math.random() * rest.length)]; setCoverModalTrackId(pick); playTrack(pick); }
                    else if (pool.length > 0) { setCoverModalTrackId(pool[0]); playTrack(pool[0]); }
                  } else {
                    const idx = pool.findIndex(t => t === currentTrackId);
                    if (idx < pool.length - 1) {
                      const newId = pool[idx + 1];
                      setCoverModalTrackId(newId);
                      playTrack(newId);
                    } else if (repeatMode === 'all' && pool.length > 0) {
                      const newId = pool[0];
                      setCoverModalTrackId(newId);
                      playTrack(newId);
                    }
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
            <button aria-label={`Repetición: ${repeatMode}`} aria-pressed={repeatMode!=="none"}
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
