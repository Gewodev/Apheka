import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, CloudRain, Waves, Flame, Wind, Music2, Sparkles, Disc, Command, Activity, Headphones, Radio } from 'lucide-react';

const tracks = [
  { id: '1', title: 'Lo-Fi Beats', artist: 'Chill Beats', duration: '3:24', color: '#E11D48' },
  { id: '2', title: 'Ambient Focus', artist: 'Deep Work', duration: '4:12', color: '#3B82F6' },
  { id: '3', title: 'Classical Piano', artist: 'Orchestra', duration: '2:58', color: '#10B981' },
  { id: '4', title: 'Nature Sounds', artist: 'Relaxation', duration: '5:00', color: '#F59E0B' },
  { id: '5', title: 'White Noise', artist: 'Focus Mode', duration: '10:00', color: '#8B5CF6' },
];

const ambientSounds = [
  { id: 'rain', label: 'Lluvia', icon: CloudRain },
  { id: 'ocean', label: 'Olas', icon: Waves },
  { id: 'wind', label: 'Viento', icon: Wind },
  { id: 'fire', label: 'Fogata', icon: Flame },
];

export default function Musica() {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setMuted] = useState(false);
  const [progress, setProgress] = useState(35);
  const [liked, setLiked] = useState<Set<number>>(new Set([0, 3]));
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playing) {
      const interval = setInterval(() => setProgress(p => Math.min(p + 0.4, 100)), 1000);
      return () => clearInterval(interval);
    }
  }, [playing]);

  const handleProgress = useCallback((e: React.MouseEvent) => {
    if (progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      setProgress((e.clientX - rect.left) / rect.width * 100);
    }
  }, []);

  const toggleLike = useCallback((idx: number) => {
    setLiked(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const track = tracks[current];

  const parseDuration = (dur: string) => {
    const [m, s] = dur.split(':').map(Number);
    return m * 60 + s;
  };

  const currentSeconds = Math.floor((progress / 100) * parseDuration(track.duration));
  const formatCurrentTime = () => {
    const m = Math.floor(currentSeconds / 60);
    const s = currentSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page-container">
      
      {/* ARCHITECTURAL HEADER - REFINED */}
      <header className="flex justify-between items-end mb-24 relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Radio size={20} className="text-accent" />
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.5em]">Frecuencia Operativa</span>
          </div>
          <h1 className="text-8xl font-black text-primary tracking-tighter leading-none">
            Inmersión
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl text-secondary font-medium tracking-tight opacity-60">
            AUDIO DE ALTA FIDELIDAD ACTIVO
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="px-8 py-4 rounded-full bg-accent/5 border border-accent/20 flex items-center gap-4">
              <Headphones size={20} className="text-accent" />
              <span className="text-[10px] font-black text-accent uppercase tracking-[0.4em]">Protocolo Atmosférico</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-16">
        
        {/* PLAYER MAIN CARD - MASTERED PROPORTIONS */}
        <div className="col-span-12 xl:col-span-8">
          <div className="bento-card p-0 min-h-[700px]">
            {/* Visualizer Area */}
            <div className="flex-1 bg-gradient-to-br from-accent/5 via-transparent to-transparent flex flex-col items-center justify-center relative p-20 overflow-hidden">
              <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]" />
              
              <div className={`w-96 h-96 rounded-[100px] bg-elevated border-[12px] border-white/[0.02] shadow-[0_60px_120px_rgba(0,0,0,0.6)] flex items-center justify-center relative transition-all duration-1000 ${playing ? 'rotate-180 scale-105' : 'scale-100'}`}>
                <div className="absolute inset-8 rounded-[80px] border-2 border-dashed border-accent/20 animate-spin-slow" />
                <div className="w-32 h-32 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
                  <Disc size={100} className={`text-accent ${playing ? 'animate-spin-slow' : ''}`} />
                </div>
              </div>

              <div className="mt-24 text-center">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <Activity size={18} className="text-accent animate-pulse" />
                  <span className="text-[10px] font-black text-accent uppercase tracking-[0.6em]">Transmitiendo</span>
                </div>
                <h2 className="text-7xl font-black text-primary tracking-tighter mb-4 leading-none">{track.title}</h2>
                <p className="text-lg text-muted font-bold uppercase tracking-[0.4em] opacity-40">{track.artist}</p>
              </div>
            </div>

            {/* Controls Area */}
            <div className="p-16 bg-white/[0.01] border-t border-white/[0.03]">
              {/* Progress */}
              <div className="mb-12" ref={progressRef} onClick={handleProgress}>
                <div className="h-3 w-full bg-white/5 rounded-full cursor-pointer overflow-hidden group relative">
                  <div 
                    className="h-full bg-accent transition-all duration-500 relative rounded-full"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-2xl scale-0 group-hover:scale-100 transition-all border-4 border-accent" />
                  </div>
                </div>
                <div className="flex justify-between mt-6 text-[11px] font-black text-muted tracking-[0.3em] uppercase opacity-40">
                  <span>{formatCurrentTime()}</span>
                  <span>{track.duration}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-12">
                  <button className="text-muted hover:text-primary transition-all hover:-translate-x-2">
                    <SkipBack size={40} />
                  </button>
                  <button 
                    onClick={() => setPlaying(!playing)}
                    className="w-28 h-28 rounded-[40px] bg-accent text-white flex items-center justify-center shadow-[0_30px_60px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all group"
                  >
                    {playing ? <Pause size={48} /> : <Play size={48} className="ml-2" />}
                  </button>
                  <button className="text-muted hover:text-primary transition-all hover:translate-x-2">
                    <SkipForward size={40} />
                  </button>
                </div>

                <div className="flex items-center gap-8 w-80 bg-white/[0.02] p-6 rounded-[32px] border border-white/5">
                  <button onClick={() => setMuted(!isMuted)} className="text-muted hover:text-accent transition-colors">
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${isMuted ? 0 : volume}%` }} />
                  </div>
                  <span className="text-[11px] font-black text-muted w-10">{isMuted ? '0' : volume}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR: QUEUE & AMBIENT */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-16">
          
          {/* AMBIENT SOUNDS */}
          <div className="bento-card p-12">
            <div className="flex items-center gap-4 mb-12">
              <Sparkles size={24} className="text-accent" />
              <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Atmósfera</span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {ambientSounds.map(s => (
                <button
                  key={s.id}
                  className="flex flex-col items-center gap-5 p-10 rounded-[40px] border border-white/[0.02] bg-white/[0.01] hover:bg-white/[0.03] hover:border-accent/30 transition-all group relative overflow-hidden"
                >
                  <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center text-muted group-hover:text-accent group-hover:scale-110 transition-all border border-transparent group-hover:border-accent/20">
                    <s.icon size={32} />
                  </div>
                  <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em] group-hover:text-primary transition-colors">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* PLAYLIST */}
          <div className="bento-card p-0 overflow-hidden flex-1">
            <div className="p-12 border-b border-white/[0.03] flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <Disc size={24} className="text-accent" />
                <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Archivo de Sesión</span>
              </div>
            </div>
            <div className="p-8 space-y-4">
              {tracks.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => setCurrent(idx)}
                  className={`flex items-center gap-8 p-8 rounded-[32px] cursor-pointer transition-all border relative group ${
                    current === idx
                      ? 'bg-elevated border-accent/20 text-primary shadow-2xl scale-[1.03]'
                      : 'border-transparent text-secondary hover:bg-white/[0.02]'
                  }`}
                >
                  {current === idx && <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-accent rounded-full shadow-[0_0_15px_var(--accent)]" />}
                  <span className="text-[11px] font-black text-muted w-6 group-hover:text-accent transition-colors">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-bold truncate tracking-tight">{t.title}</p>
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mt-2 opacity-50">{t.artist}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(idx); }}
                    className={`p-4 rounded-2xl bg-white/5 transition-all hover:scale-110 ${liked.has(idx) ? 'text-accent bg-accent/10' : 'text-muted'}`}
                  >
                    <Heart size={20} fill={liked.has(idx) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
