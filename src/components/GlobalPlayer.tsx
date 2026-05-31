import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat2, Disc3
} from 'lucide-react';
import { useApp } from '../store/AppContext';

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
    musicDuration, shuffleMode, setShuffleMode, setRepeatMode, repeatMode,
    playTrack, settings,
  } = useApp();

  const progressRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [arrowVisible, setArrowVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proximityRef = useRef(false);

  const currentTrack = useMemo(() => tracks.find(t => t.id === currentTrackId), [tracks, currentTrackId]);
  const hasTrack = !!currentTrack;
  const sidebarWidth = sidebarCollapsed ? 64 : 220;
  const hasTracks = tracks.length > 0;
  const themeClaro = settings.theme === 'claro';
  const acC = settings.accentColor || 'var(--accent)';

  const barPadding = settings.playerBarEnabled
    ? (settings.playerBarHeight === 'compact' ? '12px 32px 12px 16px'
      : settings.playerBarHeight === 'large' ? '26px 32px 26px 16px'
      : '22px 32px 22px 16px')
    : '14px 32px 14px 16px';

  // Don't auto-select a track on mount; let user choose from Música view
  // Player starts collapsed and paused

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (expanded) return;
      const nearBottom = window.innerHeight - e.clientY < 50;
      if (nearBottom && !proximityRef.current) {
        proximityRef.current = true;
        setArrowVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      } else if (!nearBottom && proximityRef.current) {
        proximityRef.current = false;
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setArrowVisible(false), 500);
      }
    };
    const onLeave = () => {
      if (!expanded && arrowVisible) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setArrowVisible(false), 350);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [arrowVisible, expanded]);

  const handleOpen = useCallback(() => {
    setExpanded(true);
    setArrowVisible(false);
    proximityRef.current = false;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const handleClose = useCallback(() => {
    setExpanded(false);
    proximityRef.current = false;
    setArrowVisible(false);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMusicVolume(parseFloat(e.target.value));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !hasTrack) return;
    const rect = progressRef.current.getBoundingClientRect();
    setMusicProgress(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  if (!hasTracks) return null;

  return (
    <>
      {/* Entry arrow */}
      <div onClick={handleOpen}
        style={{
          position: 'fixed', bottom: 14,
          left: `calc(50% + ${sidebarWidth / 2}px)`,
          transform: arrowVisible && !expanded ? 'translateX(-50%)' : 'translateX(-50%) scale(0.6)',
          cursor: 'pointer',
          opacity: arrowVisible && !expanded ? 1 : 0,
          transition: 'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
          zIndex: 9998,
          pointerEvents: arrowVisible && !expanded ? 'auto' : 'none',
          lineHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          filter: arrowVisible ? `drop-shadow(0 0 12px ${acC}80)` : 'none',
        }}
        title="Abrir reproductor">
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
          <path d="M6 14L20 4L34 14" stroke={acC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 18L20 11L26 18" stroke={acC} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
        </svg>
        <div style={{ width: 24, height: 2, borderRadius: 1, background: acC, opacity: 0.2 }} />
      </div>

      {/* Player panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: sidebarWidth, right: 0,
        zIndex: 9996,
        transform: expanded ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: expanded ? 'auto' : 'none',
      }}>
        {hasTrack && (
          <div style={{
          background: settings.playerBarBgColor
            ? settings.playerBarBgColor
            : 'var(--bg-elevated)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderTop: settings.playerBarEnabled && settings.playerBarBorderColor
              ? `${settings.playerBarBorderWidth || 1}px solid ${settings.playerBarBorderColor}`
              : '1px solid var(--border-subtle)',
            borderRadius: settings.playerBarEnabled ? `${settings.playerBarBorderRadius ?? 16}px ${settings.playerBarBorderRadius ?? 16}px 0 0` : '0',
            position: 'relative',
          }}>
            {/* Top progress line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'var(--bg-hover)',
            }}>
              <div style={{
                width: `${musicProgress * 100}%`, height: '100%',
                background: `linear-gradient(90deg, ${acC}, ${acC}bb)`,
                transition: isSeeking ? 'none' : 'width 300ms linear',
                boxShadow: `0 0 10px ${acC}50`,
              }} />
            </div>

            {/* Main content — 2-column: everything left, volume+arrow right */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              padding: barPadding,
              gap: 24,
            }}>
              {/* LEFT: Cover + Title + Controls + Progress */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                minWidth: 0,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10, overflow: 'hidden',
                  background: 'var(--bg-deep)', flexShrink: 0,
                  boxShadow: `0 2px 10px rgba(0,0,0,0.3)`,
                }}>
                  {currentTrack?.coverUrl || currentTrack?.coverImage ? (
                    <img src={currentTrack.coverUrl || currentTrack.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${acC} 12%, transparent)` }}>
                      <Disc3 size={18} style={{ color: acC }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginRight: 8 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: themeClaro ? '#111' : '#eee',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1.3, letterSpacing: '-0.01em',
                  }}>
                    {currentTrack.title}
                  </div>
                  <div style={{
                    fontSize: 12, color: themeClaro ? '#999' : '#777',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1.2, marginTop: 1,
                  }}>
                    {currentTrack.artist}
                  </div>
                </div>

                {/* Control buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setShuffleMode(!shuffleMode)}
                    style={{
                      background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                      color: shuffleMode ? acC : (themeClaro ? '#aaa' : '#555'),
                      display: 'flex', transition: 'color 200ms',
                    }}>
                    <Shuffle size={14} />
                  </button>
                  <button onClick={() => {
                    const idx = tracks.findIndex(t => t.id === currentTrackId);
                    if (idx > 0) playTrack(tracks[idx - 1].id);
                  }}
                    style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: themeClaro ? '#444' : '#aaa', display: 'flex', transition: 'color 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = acC; }}
                    onMouseLeave={e => { e.currentTarget.style.color = themeClaro ? '#444' : '#aaa'; }}>
                    <SkipBack size={17} />
                  </button>
                  <button onClick={toggleMusicPlayback}
                    style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${acC}, ${acC}dd)`,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', border: 'none',
                      boxShadow: `0 3px 12px ${acC}40`,
                      transition: 'transform 150ms, box-shadow 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = `0 5px 20px ${acC}60`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 3px 12px ${acC}40`; }}
                  >
                    {isPlayingMusic ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 1.5 }} />}
                  </button>
                  <button onClick={() => {
                    const idx = tracks.findIndex(t => t.id === currentTrackId);
                    if (idx < tracks.length - 1) playTrack(tracks[idx + 1].id);
                    else if (repeatMode === 'all' && tracks.length > 0) playTrack(tracks[0].id);
                  }}
                    style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: themeClaro ? '#444' : '#aaa', display: 'flex', transition: 'color 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = acC; }}
                    onMouseLeave={e => { e.currentTarget.style.color = themeClaro ? '#444' : '#aaa'; }}>
                    <SkipForward size={17} />
                  </button>
                  <button onClick={() => {
                    const next = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
                    setRepeatMode(next);
                  }}
                    style={{
                      background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                      color: repeatMode !== 'none' ? acC : (themeClaro ? '#aaa' : '#555'),
                      position: 'relative', display: 'flex', transition: 'color 200ms',
                    }}>
                    <Repeat2 size={14} />
                    {repeatMode === 'one' && <span style={{ position: 'absolute', top: -2, right: -3, fontSize: 7, fontWeight: 700, color: acC }}>1</span>}
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 360, minWidth: 120 }}>
                  <span style={{
                    fontSize: 10, color: themeClaro ? '#888' : '#777',
                    minWidth: 28, textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                  }}>
                    {formatTime(musicProgress * (musicDuration || 0))}
                  </span>
                  <div ref={progressRef}
                    onClick={handleProgressClick}
                    onMouseDown={(e) => { setIsSeeking(true); setSeekValue(musicProgress); handleProgressClick(e); }}
                    onMouseMove={(e) => { if (isSeeking && progressRef.current) { const r = progressRef.current.getBoundingClientRect(); setSeekValue(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); } }}
                    onMouseUp={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
                    onMouseLeave={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
                    style={{
                      flex: 1,
                      height: settings.playerBarEnabled ? (settings.playerBarTrackHeight ?? 3) : 3,
                      background: settings.playerBarEnabled && settings.playerBarBgUrl
                        ? `url(${settings.playerBarBgUrl}) center/cover no-repeat`
                        : 'var(--bg-hover)',
                      borderRadius: 3, cursor: 'pointer', position: 'relative',
                      overflow: 'visible',
                      transition: 'height 200ms',
                    }}>
                    <div style={{
                      width: `${(isSeeking ? seekValue : musicProgress) * 100}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: settings.playerBarEnabled && settings.playerBarTrackColor
                        ? settings.playerBarTrackColor
                        : acC,
                      backgroundImage: settings.playerBarEnabled ? (() => {
                        const src = settings.playerBarTrackSource || 'url';
                        if (src === 'url') return settings.playerBarTrackUrl || undefined;
                        const frames = (settings.playerBarTrackDraw || '').split('|').filter(Boolean);
                        return frames.length > 0 ? `url(${frames[0]})` : undefined;
                      })() : undefined,
                      backgroundSize: 'auto 100%',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      transition: isSeeking ? 'none' : 'width 250ms linear',
                    }} />
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
                    fontSize: 10, color: themeClaro ? '#aaa' : '#777',
                    minWidth: 28, textAlign: 'left',
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                  }}>
                    {formatTime(musicDuration || 0)}
                  </span>
                </div>
              </div>

              {/* RIGHT: Volume + close arrow (well spaced) */}
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 12, flexShrink: 0,
              }}>
                <div style={{ width: 1, height: 28, background: 'var(--border-soft)', flexShrink: 0 }} />
                <button onClick={() => setMusicVolume(musicVolume > 0 ? 0 : 0.7)}
                  style={{
                    background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                    color: themeClaro ? '#999' : '#666', display: 'flex', transition: 'color 150ms', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = acC; }}
                  onMouseLeave={e => { e.currentTarget.style.color = themeClaro ? '#999' : '#666'; }}>
                  {musicVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div style={{ width: 72, flexShrink: 0 }}>
                  <input type="range" min="0" max="1" step="0.005" value={musicVolume} onChange={handleVolumeChange}
                    style={{
                      width: '100%', height: 4, cursor: 'pointer',
                      WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 3,
                      background: 'var(--bg-hover)',
                    }}
                    className="volume-slider" />
                </div>
                <div style={{ width: 16, flexShrink: 0 }} />
                  <button onClick={handleClose}
                    style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: acC, background: `${acC}08`,
                      border: `1px solid ${acC}15`,
                      transition: 'all 200ms', lineHeight: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${acC}18`; e.currentTarget.style.borderColor = `${acC}35`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${acC}08`; e.currentTarget.style.borderColor = `${acC}15`; }}
                    title="Cerrar reproductor">
                    <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                      <path d="M3 9L7 3L11 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 10L7 7L8 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
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
