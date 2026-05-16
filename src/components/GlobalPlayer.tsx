import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Music, Heart, ListMusic, ChevronUp, ChevronDown,
  Shuffle, Repeat,
} from 'lucide-react';
import { useApp } from '../store/AppContext';

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer() {
  const {
    currentTrackId, isPlayingMusic, toggleMusicPlayback,
    tracks, musicVolume, setMusicVolume, musicProgress, setMusicProgress,
    playlists, toggleTrackFavorite,
  } = useApp();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showMiniPlaylist, setShowMiniPlaylist] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const queueIds = playlists.flatMap(p => p.trackIds);
  const queue = tracks.filter(t => queueIds.includes(t.id)).slice(0, 10);

  if (!currentTrack) return null;

  const displayProgress = isSeeking ? seekValue : musicProgress;
  const currentTime = displayProgress * currentTrack.duration;
  const isFavorited = currentTrack.isFavorite;

  useEffect(() => {
    if (currentTrackId) setIsExpanded(true);
  }, [currentTrackId]);

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
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 220,
        right: 0,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Minimized toggle */}
      {!isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)', padding: '4px 14px', borderRadius: '10px 10px 0 0',
            border: '1px solid var(--border-subtle)', borderBottom: 'none',
            cursor: 'pointer', pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="hover-lift"
        >
          <ChevronUp size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reproductor</span>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: isPlayingMusic ? 'var(--success)' : 'var(--text-muted)' }} />
        </div>
      )}

      <div
        style={{
          background: 'rgba(10, 10, 12, 0.96)',
          backdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--border-subtle)',
          transform: isExpanded ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
        }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          onMouseDown={(e) => { setIsSeeking(true); setSeekValue(musicProgress); handleProgressClick(e); }}
          onMouseMove={handleProgressDrag}
          onMouseUp={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
          onMouseLeave={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
          style={{
            height: 3, background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
            position: 'relative', width: '100%',
          }}
        >
          <div style={{
            height: '100%', width: `${displayProgress * 100}%`,
            background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #fff))',
            transition: isSeeking ? 'none' : 'width 200ms',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', right: -5, top: -3.5, width: 10, height: 10,
              borderRadius: '50%', background: '#fff', opacity: isSeeking ? 1 : 0,
              transition: 'opacity 200ms',
              boxShadow: '0 0 8px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{
          padding: '8px 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 64,
        }}>
          {/* Left: Track info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '30%', minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-base)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentTrack.coverImage ? (
                <img src={currentTrack.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Music size={16} style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{currentTrack.artist}</div>
            </div>
            <button onClick={() => toggleTrackFavorite(currentTrack.id)} className="btn-ghost" style={{ padding: 4, display: 'flex', flexShrink: 0 }}>
              <Heart size={14} fill={isFavorited ? 'var(--accent)' : 'none'} color={isFavorited ? 'var(--accent)' : 'var(--text-muted)'} />
            </button>
          </div>

          {/* Center: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button className="btn-ghost" style={{ padding: 4, display: 'flex', opacity: 0.5 }} title="Aleatorio">
                <Shuffle size={14} />
              </button>
              <button className="btn-ghost" style={{ padding: 4, display: 'flex' }} title="Anterior">
                <SkipBack size={16} />
              </button>
              <button
                onClick={toggleMusicPlayback}
                style={{
                  width: 34, height: 34, borderRadius: '50%', background: '#fff', color: '#000',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 200ms',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
              >
                {isPlayingMusic ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
              </button>
              <button className="btn-ghost" style={{ padding: 4, display: 'flex' }} title="Siguiente">
                <SkipForward size={16} />
              </button>
              <button className="btn-ghost" style={{ padding: 4, display: 'flex', opacity: 0.5 }} title="Repetir">
                <Repeat size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480 }}>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', minWidth: 32, textAlign: 'right' }}>{formatTime(currentTime)}</span>
              <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative' }}>
                <div style={{ width: `${displayProgress * 100}%`, height: '100%', background: 'rgba(255,255,255,0.3)', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', minWidth: 32 }}>{formatTime(currentTrack.duration)}</span>
            </div>
          </div>

          {/* Right: Volume + mini playlist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', width: '30%' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button className="btn-ghost" style={{ padding: 4, display: 'flex' }} onClick={() => setMusicVolume(musicVolume > 0 ? 0 : 0.7)}>
                {musicVolume === 0 ? <VolumeX size={15} style={{ color: 'var(--text-muted)' }} /> : <Volume2 size={15} style={{ color: 'var(--text-muted)' }} />}
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

            {/* Mini playlist */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMiniPlaylist(!showMiniPlaylist)} className="btn-ghost" style={{ padding: 4, display: 'flex' }} title="Cola">
                <ListMusic size={15} style={{ color: showMiniPlaylist ? 'var(--accent)' : 'var(--text-muted)' }} />
              </button>
              {showMiniPlaylist && (
                <div style={{
                  position: 'absolute', bottom: '100%', right: 0, width: 240, maxHeight: 280,
                  background: 'rgba(10,10,12,0.98)', backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-subtle)', borderRadius: 10,
                  boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 8,
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                    Cola de reproducción
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {queue.map((t, i) => (
                      <div key={t.id || i} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                        background: t.id === currentTrack.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-base)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Music size={10} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                          <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{t.artist}</div>
                        </div>
                        {t.id === currentTrack.id && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                      </div>
                    ))}
                    {queue.length === 0 && (
                      <div style={{ padding: 16, textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>Cola vacía</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="btn-ghost"
              style={{ padding: 4, display: 'flex' }}
            >
              <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
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
  );
}
