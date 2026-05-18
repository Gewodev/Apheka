import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Music, Heart, ListMusic, ChevronUp, ChevronDown,
  Shuffle, Repeat, Disc3,
} from 'lucide-react';
import { useApp } from '../store/AppContext';

function formatTime(secs: number) {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer() {
  const {
    currentTrackId, isPlayingMusic, toggleMusicPlayback,
    tracks, musicVolume, setMusicVolume, musicProgress, setMusicProgress,
    musicDuration, shuffleMode, setShuffleMode, repeatMode, setRepeatMode, musicQueue, setMusicQueue,
    playTrack, toggleTrackFavorite,
  } = useApp();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const [showCollapsedHint, setShowCollapsedHint] = useState(false);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const queue = musicQueue.map(id => tracks.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => t != null);

  const hasTrack = !!currentTrack;

  useEffect(() => {
    if (currentTrackId) setIsExpanded(true);
  }, [currentTrackId]);

  const handleHoverZoneEnter = () => {
    if (isExpanded) return;
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setShowCollapsedHint(true);
  };

  const handleHoverZoneLeave = () => {
    collapseTimeoutRef.current = setTimeout(() => {
      setShowCollapsedHint(false);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  const displayProgress = isSeeking ? seekValue : musicProgress;
  const duration = (musicDuration || currentTrack?.duration || 0);
  const currentTime = displayProgress * duration;
  const isFavorited = currentTrack?.isFavorite ?? false;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setMusicProgress(Math.max(0, Math.min(1, x)));
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSeeking || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setSeekValue(Math.max(0, Math.min(1, x)));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMusicVolume(parseFloat(e.target.value));
  };

  return (
    <>
      {/* Hover zone at bottom - always captures mouse */}
      <div
        onMouseEnter={handleHoverZoneEnter}
        onMouseLeave={handleHoverZoneLeave}
        onClick={() => { if (!isExpanded) { setIsExpanded(true); setShowCollapsedHint(false); } }}
        style={{
          position: 'fixed', bottom: 0, left: 220, right: 0, zIndex: 99,
          height: isExpanded ? 0 : 80, cursor: isExpanded ? 'default' : 'pointer',
          pointerEvents: 'auto',
        }}
      >
        {/* Floating arrow - only visual, no interaction */}
        <div style={{
          position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: isExpanded ? 0 : (showCollapsedHint ? 1 : 0),
          transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent))', opacity: 0.3 }} />
          <ChevronUp size={20} style={{ color: 'var(--accent)', opacity: 0.6 }} />
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, var(--accent), transparent)', opacity: 0.3 }} />
        </div>
      </div>

      {/* Expanded player */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 220, right: 0, zIndex: 100,
          transform: isExpanded ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{
          background: 'rgba(8, 8, 10, 0.96)',
          backdropFilter: 'blur(32px)',
          borderRadius: '14px 14px 0 0',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {/* Progress bar */}
          <div
            ref={progressRef}
            onMouseDown={(e) => { if (hasTrack) { setIsSeeking(true); setSeekValue(musicProgress); handleProgressClick(e); } }}
            onMouseMove={handleProgressDrag}
            onMouseUp={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
            onMouseLeave={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
            style={{
              height: 3, background: 'rgba(255,255,255,0.03)', cursor: hasTrack ? 'pointer' : 'default',
              position: 'relative', width: '100%', overflow: 'hidden',
            }}
          >
            <div style={{
              height: '100%', width: hasTrack ? `${displayProgress * 100}%` : '0%',
              background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff))',
              transition: isSeeking ? 'none' : 'width 200ms',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', right: -4, top: -3.5, width: 10, height: 10,
                borderRadius: '50%', background: '#fff', opacity: isSeeking ? 1 : 0,
                transition: 'opacity 200ms',
                boxShadow: '0 0 6px rgba(0,0,0,0.4)',
              }} />
            </div>
          </div>

          <div style={{
            padding: '10px 24px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', height: 76,
          }}>
            {/* Left: Track info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '28%', minWidth: 0 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 8,
                background: 'var(--bg-base)', flexShrink: 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
                {currentTrack?.coverImage ? (
                  <img src={currentTrack.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Disc3 size={18} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                {hasTrack ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{currentTrack.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{currentTrack.artist}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>Sin reproducción</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Busca o sube música</div>
                  </>
                )}
              </div>
              {hasTrack && (
                <button onClick={() => toggleTrackFavorite(currentTrack.id)} className="btn-ghost" style={{ padding: 6, display: 'flex', flexShrink: 0, borderRadius: '50%' }}>
                  <Heart size={15} fill={isFavorited ? 'var(--accent)' : 'none'} color={isFavorited ? 'var(--accent)' : 'var(--text-muted)'} />
                </button>
              )}
            </div>

            {/* Center: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, maxWidth: 460 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <button
                  onClick={() => setShuffleMode(!shuffleMode)}
                  className="btn-ghost"
                  style={{ padding: 6, display: 'flex', borderRadius: '50%', color: shuffleMode ? 'var(--accent)' : 'var(--text-tertiary)', opacity: hasTrack ? 1 : 0.25 }}
                  disabled={!hasTrack}
                >
                  <Shuffle size={16} />
                </button>

                <button
                  onClick={() => { if (hasTrack) { const idx = tracks.findIndex(t => t.id === currentTrackId); if (idx > 0) playTrack(tracks[idx - 1].id); } }}
                  className="btn-ghost"
                  style={{ padding: 6, display: 'flex', borderRadius: '50%', color: 'var(--text-secondary)', opacity: hasTrack ? 1 : 0.25 }}
                  disabled={!hasTrack}
                >
                  <SkipBack size={18} />
                </button>

                <button
                  onClick={hasTrack ? toggleMusicPlayback : undefined}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', background: hasTrack ? '#fff' : 'rgba(255,255,255,0.06)',
                    color: hasTrack ? '#000' : 'var(--text-muted)',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: hasTrack ? 'pointer' : 'default', transition: 'all 200ms',
                    boxShadow: hasTrack ? '0 4px 20px rgba(225,29,72,0.3)' : 'none',
                  }}
                  onMouseEnter={e => { if (hasTrack) { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(225,29,72,0.4)'; } }}
                  onMouseLeave={e => { if (hasTrack) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(225,29,72,0.3)'; } }}
                >
                  {isPlayingMusic ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" style={{ marginLeft: 2 }} />}
                </button>

                <button
                  onClick={() => { if (hasTrack) { const idx = tracks.findIndex(t => t.id === currentTrackId); if (idx < tracks.length - 1) playTrack(tracks[idx + 1].id); else if (repeatMode === 'all' && tracks.length > 0) playTrack(tracks[0].id); } }}
                  className="btn-ghost"
                  style={{ padding: 6, display: 'flex', borderRadius: '50%', color: 'var(--text-secondary)', opacity: hasTrack ? 1 : 0.25 }}
                  disabled={!hasTrack}
                >
                  <SkipForward size={18} />
                </button>

                <button
                  onClick={() => { if (hasTrack) { const next = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none'; setRepeatMode(next); } }}
                  className="btn-ghost"
                  style={{ padding: 6, display: 'flex', borderRadius: '50%', color: repeatMode !== 'none' ? 'var(--accent)' : 'var(--text-tertiary)', opacity: hasTrack ? 1 : 0.25, position: 'relative' }}
                  disabled={!hasTrack}
                >
                  <Repeat size={16} />
                  {repeatMode === 'one' && <span style={{ position: 'absolute', fontSize: 7, fontWeight: 700, top: 1, right: 1, color: 'var(--accent)' }}>1</span>}
                </button>
              </div>
              {hasTrack && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 32, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatTime(currentTime)}</span>
                  <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: `${displayProgress * 100}%`, height: '100%', background: 'linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.45))', borderRadius: 4, transition: isSeeking ? 'none' : 'width 200ms' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 32, fontFamily: 'var(--font-mono)' }}>{formatTime(duration)}</span>
                </div>
              )}
            </div>

            {/* Right: Volume + Queue + Minimize */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', width: '28%' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
              >
                <button className="btn-ghost" style={{ padding: 6, display: 'flex', borderRadius: '50%' }} onClick={() => setMusicVolume(musicVolume > 0 ? 0 : 0.7)}>
                  {musicVolume === 0 ? <VolumeX size={16} style={{ color: 'var(--text-muted)' }} /> : <Volume2 size={16} style={{ color: 'var(--text-muted)' }} />}
                </button>
                <div style={{
                  width: showVolume ? 64 : 0, overflow: 'hidden', transition: 'width 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex', alignItems: 'center',
                }}>
                  <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={musicVolume}
                    onChange={handleVolumeChange}
                    style={{ width: 64, height: 3, WebkitAppearance: 'none', appearance: 'none', background: 'rgba(255,255,255,0.08)', borderRadius: 4, outline: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowQueue(!showQueue)} className="btn-ghost" style={{ padding: 6, display: 'flex', borderRadius: '50%' }} title="Cola">
                  <ListMusic size={16} style={{ color: showQueue ? 'var(--accent)' : 'var(--text-muted)' }} />
                  {queue.length > 0 && (
                    <span style={{ position: 'absolute', top: 0, right: 0, width: 13, height: 13, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{queue.length}</span>
                  )}
                </button>
                {showQueue && (
                  <div style={{
                    position: 'absolute', bottom: '100%', right: 0, width: 260, maxHeight: 300,
                    background: 'rgba(8,8,10,0.98)', backdropFilter: 'blur(24px)',
                    border: '1px solid var(--border-subtle)', borderRadius: 12,
                    boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 8,
                  }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cola</span>
                      <button onClick={() => setMusicQueue([])} className="btn-ghost" style={{ padding: 2, fontSize: 9, color: 'var(--text-muted)' }}>Limpiar</button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {queue.map((t, i) => (
                        <div key={t.id || i} onClick={() => playTrack(t.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', cursor: 'pointer',
                          background: t.id === currentTrackId ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                          transition: 'background 150ms',
                        }} onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 6%, transparent)'} onMouseLeave={e => e.currentTarget.style.background = t.id === currentTrackId ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent'}>
                          <div style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--bg-base)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={10} style={{ color: 'var(--text-muted)' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 500, color: t.id === currentTrackId ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{t.artist}</div>
                          </div>
                          {t.id === currentTrackId && (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                          )}
                        </div>
                      ))}
                      {queue.length === 0 && (
                        <div style={{ padding: 16, textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>
                          <ListMusic size={20} style={{ margin: '0 auto 6px', opacity: 0.15 }} />
                          Cola vacía
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="btn-ghost"
                style={{ padding: 6, display: 'flex', borderRadius: '50%' }}
                title="Minimizar"
              >
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>

          <style>{`
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 0 4px rgba(0,0,0,0.3);
            }
            input[type=range]::-moz-range-thumb {
              width: 10px; height: 10px; border-radius: 50%; background: #fff; cursor: pointer; border: none;
            }
          `}</style>
        </div>
      </div>
    </>
  );
}
