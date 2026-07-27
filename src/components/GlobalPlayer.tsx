import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat2, Disc3, Heart
} from 'lucide-react';
import { useApp, Track } from '../store/AppContext';

function formatTime(secs: number) {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlayerBarCharacter({ frames, frameSpeeds, gifUrl, isDraw, progress, offsetY, size, shadow, borderRadius, borderWidth, borderColor, isSeeking }: {
  frames: string[]; frameSpeeds: number[]; gifUrl: string; isDraw: boolean;
  progress: number; offsetY: number; size: number; shadow: number;
  borderRadius: number; borderWidth: number; borderColor: string;
  isSeeking: boolean;
}) {
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (!isDraw || frames.length <= 1) return;
    const delay = frameSpeeds[frameIdx] || 1000;
    const timer = setTimeout(() => {
      setFrameIdx((frameIdx + 1) % frames.length);
    }, delay);
    return () => clearTimeout(timer);
  }, [isDraw, frames, frameSpeeds, frameIdx]);

  useEffect(() => { setFrameIdx(0); }, [frames.join(',')]);

  const src = isDraw ? frames[frameIdx] : gifUrl;
  if (!src) return null;

  return (
    <div style={{
      position: 'absolute',
      left: `${progress * 100}%`,
      bottom: '50%',
      zIndex: 5,
      pointerEvents: 'none',
      transition: isSeeking ? 'none' : 'left 250ms linear',
      transform: `translate(-50%, ${offsetY}px)`,
    }}>
      <div style={{
        width: size, height: size,
        borderRadius,
        overflow: 'hidden',
        border: borderWidth && borderColor
          ? `${borderWidth}px solid ${borderColor}`
          : 'none',
        boxShadow: shadow > 0
          ? `0 ${shadow * 0.3}px ${shadow}px rgba(0,0,0,0.35)`
          : 'none',
        background: 'transparent',
      }}>
        <img src={src} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    </div>
  );
}

export default function GlobalPlayer({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const {
    currentTrackId, isPlayingMusic, toggleMusicPlayback,
    tracks, musicVolume, setMusicVolume, setMusicProgress, musicProgress,
    musicDuration, shuffleMode, setShuffleMode, setRepeatMode, repeatMode, musicQueue, setMusicQueue, queueSource,
    playTrack, settings, setCoverModalTrackId, toggleTrackFavorite,
  } = useApp();

  const progressRef = useRef<HTMLDivElement>(null);
  const seekValueRef = useRef(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [arrowVisible, setArrowVisible] = useState(false);
  const [playerHovered, setPlayerHovered] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proximityRef = useRef(false);
  const currentTrack = useMemo(() => tracks.find(t => t.id === currentTrackId), [tracks, currentTrackId]);
  const hasTrack = !!currentTrack;
  const sidebarWidth = sidebarCollapsed ? 64 : 220;
  const hasTracks = tracks.length > 0;
  const acC = settings.accentColor || '#E11D48';

  const barPadding = settings.playerBarEnabled
    ? (settings.playerBarHeight === 'compact' ? '12px 24px 14px 20px'
      : settings.playerBarHeight === 'large' ? '16px 28px 18px 24px'
      : '14px 26px 16px 22px')
    : '14px 26px 16px 22px';

  const barTrackImage = useMemo(() => {
    if (!settings.playerBarEnabled) return null;
    const src = settings.playerBarTrackSource || 'url';
    if (src === 'url') return settings.playerBarTrackUrl || null;
    const frames = (settings.playerBarCharacterDraw || '').split('|').filter(Boolean);
    return frames.length > 0 ? frames[0] : null;
  }, [settings.playerBarEnabled, settings.playerBarTrackSource, settings.playerBarTrackUrl, settings.playerBarCharacterDraw]);

  const progressVal = isSeeking ? seekValue : musicProgress;

  const sidebarWidthRef = useRef(sidebarWidth);
  useEffect(() => { sidebarWidthRef.current = sidebarWidth; }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (expanded) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight - 30;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const nearBottom = window.innerHeight - e.clientY < 24;
      const inZone = nearBottom || (Math.abs(dx) < 120 && Math.abs(dy) < 40);
      if (inZone && !proximityRef.current) {
        proximityRef.current = true;
        setArrowVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      } else if (!inZone && proximityRef.current) {
        proximityRef.current = false;
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setArrowVisible(false), 300);
      }
    };
    const onLeave = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      proximityRef.current = false;
      hideTimerRef.current = setTimeout(() => setArrowVisible(false), 120);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [expanded]);

  const handleOpen = useCallback(() => {
    setExpanded(true);
    setArrowVisible(false);
    proximityRef.current = false;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const handleClose = useCallback(() => {
    setExpanded(false);
    proximityRef.current = false;
    setPlayerHovered(false);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMusicVolume(parseFloat(e.target.value));
  };

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !hasTrack) return;
    const rect = progressRef.current.getBoundingClientRect();
    setMusicProgress(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }, [hasTrack, setMusicProgress]);

  const handleSeekMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !hasTrack) return;
    const rect = progressRef.current.getBoundingClientRect();
    const val = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekValueRef.current = val;
    setSeekValue(val);
    setIsSeeking(true);
  }, [hasTrack]);

  useEffect(() => {
    if (!isSeeking) return;
    const onMove = (e: MouseEvent) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const val = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekValueRef.current = val;
      setSeekValue(val);
    };
    const onUp = () => {
      setMusicProgress(seekValueRef.current);
      setIsSeeking(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isSeeking, setMusicProgress]);

  if (!hasTracks || !currentTrackId) return null;

  return (
    <>
      {/* Entry arrow — refined double chevron */}
      <div style={{
        position: 'fixed',
        left: sidebarWidth,
        right: 0,
        bottom: arrowVisible && !expanded ? 16 : 4,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: arrowVisible && !expanded ? 'auto' : 'none',
        zIndex: 9998,
        opacity: arrowVisible && !expanded ? 1 : 0,
        transition: 'opacity 250ms ease, bottom 300ms cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div onClick={handleOpen}
          style={{
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 28px',
            userSelect: 'none',
            borderRadius: 10,
            background: 'transparent',
            border: 'none',
            transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          title="Abrir reproductor">
          <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
            <path d="M6 12L20 4L34 12" stroke={acC} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
            <path d="M10 14L20 7L30 14" stroke={acC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" style={{ filter: `drop-shadow(0 0 6px ${acC}50)` }} />
          </svg>
        </div>
      </div>

      {/* Player panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: sidebarWidth - 12, right: 0,
        zIndex: 9996,
        transform: expanded ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: expanded ? 'auto' : 'none',
      }}
        onMouseEnter={() => setPlayerHovered(true)}
        onMouseLeave={() => setPlayerHovered(false)}>
          {hasTrack && (
          <div style={{
            background: `color-mix(in srgb, var(--bg-primary) calc(var(--ui-opacity, 0.85) * 100%), transparent)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: settings.playerBarEnabled && settings.playerBarBorderColor
              ? `${settings.playerBarBorderWidth || 1}px solid ${settings.playerBarBorderColor}`
              : '1px solid var(--border-default)',
            borderRadius: settings.playerBarEnabled ? `${settings.playerBarBorderRadius ?? 14}px ${settings.playerBarBorderRadius ?? 14}px 0 0` : '14px 14px 0 0',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 -2px 20px rgba(0,0,0,0.12)',
          }}>
            {/* Top accent line — thin, no glow */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'var(--bg-hover)',
            }}>
              <div style={{
                width: `${musicProgress * 100}%`, height: '100%',
                background: acC,
                transition: isSeeking ? 'none' : 'width 300ms linear',
              }} />
            </div>

            {/* Main content */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr auto',
              alignItems: 'center',
        padding: '24px 30px 26px 28px',
        gap: 28,
            }}>
              {/* LEFT: Cover + Title/Artist */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                minWidth: 0,
              }}>
                <div style={{
                  width: 58, height: 58, borderRadius: 12, overflow: 'hidden',
                  background: 'var(--bg-deep)', flexShrink: 0,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  cursor: 'pointer', position: 'relative',
                }} onClick={() => currentTrackId && setCoverModalTrackId(currentTrackId)}>
                  {currentTrack?.coverUrl || currentTrack?.coverImage ? (
                    <img src={currentTrack.coverUrl || currentTrack.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${acC} 12%, transparent)` }}>
                      <Disc3 size={20} style={{ color: acC }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      lineHeight: 1.3, fontFamily: "'Inter Tight', sans-serif",
                    }}>
                      {currentTrack.title}
                    </span>
                    <button onClick={() => currentTrackId && toggleTrackFavorite(currentTrackId)}
                      style={{
                        background: 'none', border: 'none', padding: 3, cursor: 'pointer',
                        color: currentTrack?.isFavorite ? '#F43F5E' : 'var(--text-muted)',
                        display: 'flex', flexShrink: 0, borderRadius: 4,
                        transition: 'all 200ms',
                        transform: currentTrack?.isFavorite ? 'scale(1.05)' : 'scale(1)',
                      }}
                      onMouseEnter={e => { if (!currentTrack?.isFavorite) { e.currentTarget.style.color = '#F43F5E'; e.currentTarget.style.transform = 'scale(1.15)'; } }}
                      onMouseLeave={e => { if (!currentTrack?.isFavorite) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.transform = 'scale(1)'; } }}
                      title={currentTrack?.isFavorite ? 'Quitar de favoritas' : 'Añadir a favoritas'}>
                      <Heart size={14} fill={currentTrack?.isFavorite ? '#F43F5E' : 'none'} strokeWidth={currentTrack?.isFavorite ? 0 : 2} />
                    </button>
                  </div>
                  <span style={{
                    fontSize: 12, color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}>
                    {currentTrack.artist}
                  </span>
                  {queueSource?.name && (
                    <span style={{
                      fontSize: 10, color: acC, opacity: 0.5,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      lineHeight: 1.2, fontWeight: 500,
                    }}>
                      {queueSource.name}
                    </span>
                  )}
                </div>
              </div>

              {/* CENTER: Controls + Progress */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                minWidth: 0, width: '100%', maxWidth: 600,
                margin: '0 auto',
              }}>
                {/* Controls row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  flexShrink: 0,
                }}>
                  <button onClick={() => setShuffleMode(!shuffleMode)}
                    style={{
                      background: 'none', border: 'none', padding: 8, cursor: 'pointer',
                      color: shuffleMode ? acC : 'var(--text-tertiary)',
                      display: 'flex', transition: 'all 150ms', borderRadius: 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = shuffleMode ? acC : 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = shuffleMode ? acC : 'var(--text-tertiary)'; e.currentTarget.style.background = 'none'; }}>
                    <Shuffle size={17} />
                  </button>
                  <button onClick={() => {
                    const pool = queueSource?.pool ?? tracks.map(t => t.id);
                    const idx = pool.indexOf(currentTrackId);
                    if (idx > 0) playTrack(pool[idx - 1]);
                    else if (repeatMode !== 'none' && pool.length > 0) playTrack(pool[pool.length - 1]);
                  }}
                    style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', borderRadius: 8, transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none'; }}>
                    <SkipBack size={18} />
                  </button>
                  {/* Play/Pause */}
                  <button onClick={toggleMusicPlayback}
                    style={{
                      width: 46, height: 46, borderRadius: 14,
                      background: acC,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', border: 'none',
                      boxShadow: `0 2px 12px ${acC}30`,
                      transition: 'all 150ms ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 3px 18px ${acC}50`; e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 12px ${acC}30`; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {isPlayingMusic ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" style={{ marginLeft: 1 }} />}
                  </button>
                  <button onClick={() => {
                    if (musicQueue.length > 0) { setMusicQueue(musicQueue.slice(1)); playTrack(musicQueue[0]); return; }
                    const pool = queueSource?.pool ?? tracks.map(t => t.id);
                    if (shuffleMode) {
                      const rest = pool.filter(tid => tid !== currentTrackId);
                      if (rest.length > 0) { const pick = rest[Math.floor(Math.random() * rest.length)]; playTrack(pick); }
                      else if (pool.length > 0) playTrack(pool[0]);
                    } else {
                      const idx = pool.indexOf(currentTrackId);
                      if (idx < pool.length - 1) playTrack(pool[idx + 1]);
                      else if (repeatMode === 'all' && pool.length > 0) playTrack(pool[(idx + 1) % pool.length]);
                    }
                  }}
                    style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', borderRadius: 8, transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none'; }}>
                    <SkipForward size={18} />
                  </button>
                  <button onClick={() => {
                    const next = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
                    setRepeatMode(next);
                  }}
                    style={{
                      background: 'none', border: 'none', padding: 8, cursor: 'pointer',
                      color: repeatMode !== 'none' ? acC : 'var(--text-tertiary)',
                      position: 'relative', display: 'flex', borderRadius: 8, transition: 'all 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = repeatMode !== 'none' ? acC : 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = repeatMode !== 'none' ? acC : 'var(--text-tertiary)'; e.currentTarget.style.background = 'none'; }}>
                    <Repeat2 size={17} />
                    {repeatMode === 'one' && <span style={{ position: 'absolute', top: -2, right: -3, fontSize: 9, fontWeight: 700, color: acC }}>1</span>}
                  </button>
                </div>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    minWidth: 36, textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                    flexShrink: 0,
                  }}>
                    {formatTime(musicProgress * (musicDuration || 0))}
                  </span>
                  <div ref={progressRef}
                    onClick={handleProgressClick}
                    onMouseDown={handleSeekMouseDown}
                    style={{
                      flex: 1,
                      height: settings.playerBarEnabled ? (settings.playerBarTrackHeight ?? 4) : 4,
                      borderRadius: 4, cursor: 'pointer', position: 'relative',
                      overflow: 'visible',
                      transition: 'height 200ms',
                    }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: 4,
                      backgroundColor: barTrackImage ? 'transparent' : 'var(--bg-hover)',
                      backgroundImage: barTrackImage ? `url(${barTrackImage})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      opacity: barTrackImage ? 0.15 : 1,
                    }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: 4,
                      clipPath: `inset(0 ${(1 - progressVal) * 100}% 0 0)`,
                      transition: isSeeking ? 'none' : 'clip-path 250ms linear',
                      backgroundColor: settings.playerBarEnabled && settings.playerBarTrackColor
                        ? settings.playerBarTrackColor
                        : acC,
                      backgroundImage: barTrackImage ? `url(${barTrackImage})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: settings.playerBarEnabled && settings.playerBarTrackColor
                          ? settings.playerBarTrackColor
                          : acC,
                        opacity: barTrackImage ? 0.35 : 1,
                        borderRadius: 4,
                      }} />
                    </div>
                    {settings.playerBarEnabled && (() => {
                      const isDraw = settings.playerBarCharacterSource === 'draw';
                      const frames = isDraw
                        ? (settings.playerBarCharacterDraw || '').split('|').filter(Boolean)
                        : [];
                      const frameSpeeds = (settings.playerBarFrameSpeeds || '').split('|').map(Number).filter(n => n > 0);
                      const gifUrl = !isDraw ? settings.playerBarCharacterUrl : '';
                      if (!isDraw && !gifUrl) return null;
                      if (isDraw && frames.length === 0) return null;
                      return <PlayerBarCharacter
                        frames={frames} frameSpeeds={frameSpeeds}
                        gifUrl={gifUrl || ''} isDraw={isDraw}
                        progress={isSeeking ? seekValue : musicProgress}
                        offsetY={settings.playerBarCharacterOffsetY ?? 0}
                        size={settings.playerBarCharacterSize ?? 40}
                        shadow={settings.playerBarCharacterShadow ?? 6}
                        borderRadius={settings.playerBarCharacterBorderRadius ?? 50}
                        borderWidth={settings.playerBarCharacterBorderWidth ?? 0}
                        borderColor={settings.playerBarCharacterBorderColor || ''}
                        isSeeking={isSeeking}
                      />;
                    })()}
                  </div>
                  <span style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    minWidth: 36, textAlign: 'left',
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                    flexShrink: 0,
                  }}>
                    {formatTime(musicDuration || 0)}
                  </span>
                </div>
              </div>

              {/* RIGHT: Volume + Close */}
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 12, flexShrink: 0, justifyContent: 'flex-end',
              }}>
                {/* Volume — refined slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setMusicVolume(musicVolume > 0 ? 0 : 0.7)}
                    style={{
                      width: 32, height: 32,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: musicVolume === 0 ? '#F59E0B' : 'var(--text-tertiary)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8, flexShrink: 0,
                      transition: 'color 150ms ease, background 150ms ease',
                    }}
                    onMouseEnter={e => { if (musicVolume > 0) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                    onMouseLeave={e => { if (musicVolume > 0) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none'; } }}>
                    {musicVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <div style={{ width: 100, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: `${musicVolume * 100}%`, height: 4, borderRadius: 4,
                      background: musicVolume === 0 ? 'var(--text-muted)' : acC,
                      pointerEvents: 'none', zIndex: 1,
                      transition: 'width 120ms ease, background 200ms ease',
                    }} />
                    <input type="range" min="0" max="1" step="0.005" value={musicVolume} onChange={handleVolumeChange}
                      style={{
                        width: '100%', height: 4, cursor: 'pointer', position: 'relative', zIndex: 2,
                        WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 4,
                        background: 'transparent',
                      }}
                      className="volume-slider" />
                  </div>
                </div>
                <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', opacity: 0.3, flexShrink: 0 }} />
                {/* Close button — appears on hover */}
                <button onClick={handleClose}
                  style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    transition: 'all 150ms', lineHeight: 0,
                    opacity: playerHovered ? 1 : 0,
                    transform: playerHovered ? 'translateY(0)' : 'translateY(3px)',
                    pointerEvents: playerHovered ? 'auto' : 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = acC; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Cerrar reproductor">
                  <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
                    <path d="M2 3L7 8L12 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
