import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Heart, ChevronUp, ChevronDown,
  Shuffle, Repeat, Disc3, ListMusic
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;

function formatTime(secs: number) {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer({ isCollapsed }: { isCollapsed: boolean }) {
  const {
    currentTrackId, isPlayingMusic, toggleMusicPlayback, setIsPlayingMusic,
    tracks, musicVolume, setMusicVolume, setMusicProgress, musicProgress,
    musicDuration, shuffleMode, setShuffleMode, repeatMode, setRepeatMode,
    musicQueue, setMusicQueue, playTrack, toggleTrackFavorite, settings, youtubeVideoUrl, updateTrack
  } = useApp();

  // Precise second-by-second listening time tracking
  useEffect(() => {
    let interval: any;
    if (isPlayingMusic && currentTrackId) {
      interval = setInterval(() => {
        const track = tracks.find(t => t.id === currentTrackId);
        if (track) {
          updateTrack(currentTrackId, { listenedTime: (track.listenedTime || 0) + 1 });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlayingMusic, currentTrackId, tracks, updateTrack]);

  const progressRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const [isHovered, setIsHovered] = useState(false); // For the tiny hover zone
  const [isExpanded, setIsExpanded] = useState(false);

  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const hasTrack = !!currentTrack;

  // Show player when a track is loaded (even when paused); hide when no track
  useEffect(() => {
    setIsExpanded(!!currentTrackId);
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
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: window.innerWidth > 768 ? (isCollapsed ? 64 : 220) : 0,
      right: 0,
      height: 'auto', // Parent container for player and hover zone
      zIndex: 1000,
      pointerEvents: 'none', // Allow clicks through, handled by children below
      transition: 'left 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    }}>
      {youtubeVideoUrl && (
        <div style={{ display: 'none' }}>
          <Player
            url={youtubeVideoUrl}
            playing={isPlayingMusic}
            volume={musicVolume}
            controls={false}
            width={0}
            height={0}
            onProgress={(state: any) => {
              if (!isSeeking && musicDuration > 0) {
                setMusicProgress(state.playedSeconds / musicDuration);
              }
            }}
            onEnded={() => {
              if (tracks.length > 0 && currentTrackId) {
                if (repeatMode === 'one') {
                  playTrack(currentTrackId);
                  return;
                }
                let nextId: string | null = null;
                const q = musicQueue;
                if (q.length > 0) {
                  const [next] = q;
                  setMusicQueue(q.slice(1));
                  nextId = next;
                } else if (shuffleMode || repeatMode === 'all') {
                  const rest = tracks.filter(t => t.id !== currentTrackId).map(t => t.id);
                  const refilled = shuffleMode ? [...rest].sort(() => Math.random() - 0.5) : rest;
                  if (refilled.length > 0) {
                    setMusicQueue(refilled.slice(1));
                    nextId = refilled[0];
                  }
                }
                if (nextId) playTrack(nextId);
                else { setIsExpanded(false); setIsPlayingMusic(false); }
              }
            }}
          />
        </div>
      )}
      {/* Main player container - slides in/out */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: isExpanded ? 90 : 0, // Full height when expanded, zero when collapsed
        overflow: 'hidden',
        background: settings.theme === 'claro' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 18, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${settings.theme === 'claro' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
        transform: `translateY(${isExpanded ? 0 : 100}%)`, // Animate transform
        transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), height 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        pointerEvents: isExpanded ? 'auto' : 'none', // Active only when expanded
      }}>
        {!hasTrack && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: settings.theme === 'claro' ? '#666' : '#ccc',
            fontSize: 14
          }}>
            <Disc3 size={20} style={{ opacity: 0.5 }} />
            <span>No hay pista seleccionada</span>
          </div>
        )}
        
        {hasTrack && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'minmax(200px, 1fr) auto minmax(200px, 1fr)',
            alignItems: 'center', 
            height: '100%',
            padding: '0 20px'
          }}>
            {/* Track Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: 12, overflow: 'hidden', 
                background: 'var(--bg-deep)', flexShrink: 0,
                boxShadow: '0 8px 24px var(--accent-glow)'
              }}>
                {currentTrack?.coverUrl || currentTrack?.coverImage ? (
                  <img src={currentTrack.coverUrl || currentTrack.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)' }}>
                    <Disc3 size={24} style={{ color: 'var(--accent)' }} className={isPlayingMusic ? 'spin-slow' : ''} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: settings.theme === 'claro' ? '#000' : '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 180
                }}>
                  {currentTrack.title}
                </div>
                <div style={{ 
                  fontSize: 12, 
                  color: settings.theme === 'claro' ? '#666' : '#999',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 180
                }}>
                  {currentTrack.artist}
                </div>
              </div>
            </div>

            {/* Center Controls and Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, maxWidth: 600 }}>
              {/* Playback Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <button
                  onClick={() => setShuffleMode(!shuffleMode)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    padding: 8, 
                    cursor: 'pointer',
                    color: shuffleMode ? 'var(--accent)' : (settings.theme === 'claro' ? '#666' : '#999'),
                    transition: 'color 0.2s' }}
                  disabled={!hasTrack}
                >
                  <Shuffle size={18} />
                </button>

                <button
                  onClick={() => { 
                    if (hasTrack) { 
                      const idx = tracks.findIndex(t => t.id === currentTrackId);
                      if (idx > 0) {
                        playTrack(tracks[idx - 1].id);
                      }
                    }
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    padding: 8, 
                    cursor: 'pointer',
                    color: hasTrack ? (settings.theme === 'claro' ? '#000' : '#fff') : (settings.theme === 'claro' ? '#666' : '#999'),
                    opacity: hasTrack ? 1 : 0.5
                  }}
                  disabled={!hasTrack}
                >
                  <SkipBack size={20} />
                </button>

                <button
                  onClick={hasTrack ? toggleMusicPlayback : undefined}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%', 
                    background: hasTrack ? 'var(--accent)' : 'transparent',
                    color: settings.theme === 'claro' ? '#fff' : '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: hasTrack ? 'pointer' : 'default',
                    transition: 'transform 0.15s',
                    border: 'none'
                  }}
                  onMouseEnter={e => { if (hasTrack) { e.currentTarget.style.transform = 'scale(1.08)'; } }}
                  onMouseLeave={e => { if (hasTrack) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {isPlayingMusic ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
                </button>

                <button
                  onClick={() => { 
                    if (hasTrack) { 
                      const idx = tracks.findIndex(t => t.id === currentTrackId);
                      if (idx < tracks.length - 1) {
                        playTrack(tracks[idx + 1].id);
                      } else if (repeatMode === 'all' && tracks.length > 0) {
                        playTrack(tracks[0].id);
                      }
                    }
                  }}
              style={{ 
                background: 'none', 
                border: 'none', 
                padding: 8, 
                cursor: 'pointer',
                color: hasTrack ? (settings.theme === 'claro' ? '#000' : '#fff') : (settings.theme === 'claro' ? '#666' : '#999'),
                opacity: hasTrack ? 1 : 0.5
              }}
              disabled={!hasTrack}
            >
              <SkipForward size={20} />
            </button>

                <button
                  onClick={() => { 
                    if (hasTrack) { 
                      const next = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
                      setRepeatMode(next);
                    }
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                  padding: 8, 
                  cursor: 'pointer',
                  color: repeatMode !== 'none' ? 'var(--accent)' : (settings.theme === 'claro' ? '#666' : '#999'),
                  position: 'relative'
                }}
                disabled={!hasTrack}
              >
                <Repeat size={18} />
                {repeatMode === 'one' && <span style={{ position: 'absolute', fontSize: 10, fontWeight: 700, top: -4, right: -4, color: 'var(--accent)' }}>1</span>}
              </button>
              </div>
              
              {/* Progress Bar and Time Display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <span style={{ 
                  fontSize: 11, 
                  color: 'var(--accent)', 
                  minWidth: 40, 
                  textAlign: 'right', 
                  fontFamily: 'monospace',
                  padding: '2px 6px',
                  background: 'var(--accent-dim)',
                  borderRadius: 4,
                  boxShadow: '0 0 8px var(--accent-glow)',
                  fontWeight: 600
                }}>{formatTime(musicProgress * (musicDuration || 0))}</span>
                <div 
                  ref={progressRef}
                  onClick={handleProgressClick}
                  onMouseDown={(e) => { if (hasTrack) { setIsSeeking(true); setSeekValue(musicProgress); handleProgressClick(e); } }}
                  onMouseMove={handleProgressDrag}
                  onMouseUp={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
                  onMouseLeave={() => { if (isSeeking) { setMusicProgress(seekValue); setIsSeeking(false); } }}
                  style={{ flex: 1, height: 6, background: settings.theme === 'claro' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderRadius: 3, cursor: hasTrack ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}
                >
                  <div style={{ 
                    width: `${(isSeeking ? seekValue : musicProgress) * 100}%`, 
                    height: '100%', 
                    background: 'var(--accent)',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      transform: 'translate(50%, -50%)',
                      boxShadow: '0 0 8px var(--accent)'
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: settings.theme === 'claro' ? '#666' : '#999', minWidth: 35, textAlign: 'left', fontFamily: 'monospace' }}>{formatTime(musicDuration || 0)}</span>
              </div>
            </div>

            {/* Right Section: Volume + Minimize */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifySelf: 'end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setMusicVolume(musicVolume > 0 ? 0 : 0.7)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    padding: 6, 
                    cursor: 'pointer',
                    color: settings.theme === 'claro' ? '#666' : '#999'
                  }}
                >
                  {musicVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={musicVolume}
                  onChange={handleVolumeChange}
                  style={{
                    width: 80,
                    height: 4,
                    WebkitAppearance: 'none',
                    background: settings.theme === 'claro' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                style={{ 
                  padding: 4, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)',
                  background: 'transparent',
                  border: 'none',
                  opacity: 0.6
                }}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Hover zone to expand player when collapsed */}
      <div
        onMouseEnter={() => { if (!isExpanded) setIsHovered(true); }}
        onMouseLeave={() => { setIsHovered(false); }}
        onClick={() => { if (!isExpanded) { setIsExpanded(true); setIsHovered(false); } }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: hasTrack ? 20 : 0, // Visible height when collapsed, if there's a track
          background: 'transparent',
          pointerEvents: isExpanded ? 'none' : 'auto', // Active only when collapsed
          cursor: 'pointer',
          zIndex: 1001 // Above main player container when collapsed
        }}
      >
        {/* Hover detection zone - wider and more sensitive */}
        <div 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => hasTrack && setIsExpanded(true)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: 50,
            cursor: hasTrack ? 'pointer' : 'default',
            pointerEvents: 'auto',
            zIndex: 5
          }}
        />

        {/* Visual hint (arrow) - Remastered with LED style lines */}
        <div style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: `translateX(-50%) translateY(${isHovered ? '0' : '10px'})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          opacity: isExpanded ? 0 : (isHovered && hasTrack ? 1 : 0),
          transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none'
        }}>
          <div style={{ width: 140, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent))', opacity: 0.4, boxShadow: '0 0 8px var(--accent-glow)' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {/* Main Point Up */}
            <div style={{ display: 'flex', gap: -6, marginBottom: -4 }}>
              <div style={{ width: 18, height: 3, background: 'var(--accent)', borderRadius: 4, transform: 'rotate(-35deg) translateX(4px)', boxShadow: '0 0 12px var(--accent)' }} />
              <div style={{ width: 18, height: 3, background: 'var(--accent)', borderRadius: 4, transform: 'rotate(35deg) translateX(-4px)', boxShadow: '0 0 12px var(--accent)' }} />
            </div>
            {/* Mini Below */}
            <div style={{ display: 'flex', gap: -4, opacity: 0.8 }}>
              <div style={{ width: 10, height: 2, background: 'var(--accent)', borderRadius: 4, transform: 'rotate(-35deg) translateX(2px)', boxShadow: '0 0 8px var(--accent)' }} />
              <div style={{ width: 10, height: 2, background: 'var(--accent)', borderRadius: 4, transform: 'rotate(35deg) translateX(-2px)', boxShadow: '0 0 8px var(--accent)' }} />
            </div>
          </div>

          <div style={{ width: 140, height: 1, background: 'linear-gradient(90deg, var(--accent), transparent)', opacity: 0.4, boxShadow: '0 0 8px var(--accent-glow)' }} />
        </div>
      </div>
    </div>
  );
} 
