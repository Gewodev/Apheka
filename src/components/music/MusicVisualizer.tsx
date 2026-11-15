import { useEffect, useRef, useState } from 'react';
import { Music2, Volume2, VolumeX, Settings } from 'lucide-react';
import { useAppSlice } from '../../store/AppContext';

/**
 * MusicVisualizer - A rhythm-reactive visualization component.
 * Creates a "symbiotic mass" that reacts to audio frequency data in real-time.
 * Features:
 * - Multiple visualization modes (particles, waves, bars, orb)
 * - Beat detection with onset detection
 * - Frequency-based color mapping (rainbow spectrum)
 * - Smooth 60fps animations using requestAnimationFrame
 * - Configurable sensitivity and style
 * - Falls back gracefully when audio context unavailable
 */

type VisualizerMode = 'orb' | 'waves' | 'particles' | 'bars' | 'radial';
type ColorScheme = 'rainbow' | 'fire' | 'ocean' | 'forest' | 'cosmic' | 'monochrome';

interface VisualizerConfig {
  mode: VisualizerMode;
  colorScheme: ColorScheme;
  sensitivity: number;      // 0.1 - 2.0
  smoothing: number;        // 0.0 - 0.99
  showBeatPulse: boolean;
  showFrequencyBars: boolean;
  particleCount: number;    // 50 - 500
  orbComplexity: number;    // 1 - 5
}

const DEFAULT_CONFIG: VisualizerConfig = {
  mode: 'orb',
  colorScheme: 'rainbow',
  sensitivity: 1.0,
  smoothing: 0.8,
  showBeatPulse: true,
  showFrequencyBars: false,
  particleCount: 200,
  orbComplexity: 3,
};

const COLOR_SCHEMES: Record<ColorScheme, string[]> = {
  rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'],
  fire: ['#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFA500', '#FF6347', '#DC143C'],
  ocean: ['#000080', '#0000FF', '#00BFFF', '#00FFFF', '#40E0D0', '#48D1CC', '#20B2AA'],
  forest: ['#006400', '#228B22', '#32CD32', '#7CFC00', '#ADFF2F', '#98FB98', '#90EE90'],
  cosmic: ['#1A0033', '#4B0082', '#8A2BE2', '#9400D3', '#BA55D3', '#DA70D6', '#EE82EE'],
  monochrome: ['#111111', '#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD'],
};

export default function MusicVisualizer({ 
  audioElement,
  isPlaying,
  className = '',
  width = '100%',
  height = '100%',
}: {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  className?: string;
  width?: string;
  height?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const configRef = useRef<VisualizerConfig>(DEFAULT_CONFIG);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Beat detection state
  const beatHistoryRef = useRef<number[]>([]);
  const lastBeatRef = useRef<number>(0);
  const beatThresholdRef = useRef<number>(1.5);
  
  // Visual state
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number; 
    size: number; color: string; life: number; angle: number; speed: number;
  }>>([]);
  
  const waveOffsetRef = useRef(0);
  const orbRotationRef = useRef(0);
  const beatPulseRef = useRef(0);

  const settings = useAppSlice(['settings']);
  
  // Get visualizer settings from app settings
  const visualizerSettings = settings.settings?.musicVisualizer || {
    enabled: true,
    mode: 'orb',
    colorScheme: 'rainbow',
    sensitivity: 1.0,
    showOnCover: true,
    showOnLyrics: true,
  };

  // Initialize audio context and analyser
  const initAudio = async () => {
    if (!audioElement || audioContextRef.current) return;
    
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      
      const source = ctx.createMediaElementSource(audioElement);
      sourceRef.current = source;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = configRef.current.smoothing;
      analyserRef.current = analyser;
      
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      setIsReady(true);
      setError(null);
    } catch (err) {
      setError('No se pudo inicializar el visualizador de audio');
      console.error('Audio visualizer init error:', err);
    }
  };

  // Clean up audio context
  const cleanupAudio = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsReady(false);
  };

  // Beat detection algorithm
  const detectBeat = (dataArray: Uint8Array): boolean => {
    const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    
    beatHistoryRef.current.push(bass);
    if (beatHistoryRef.current.length > 43) beatHistoryRef.current.shift();
    
    const historyAvg = beatHistoryRef.current.reduce((a, b) => a + b, 0) / beatHistoryRef.current.length;
    const variance = beatHistoryRef.current.reduce((sum, val) => sum + Math.pow(val - historyAvg, 2), 0) / beatHistoryRef.current.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = historyAvg + beatThresholdRef.current * stdDev;
    const now = performance.now();
    const isBeat = bass > threshold && (now - lastBeatRef.current) > 150;
    
    if (isBeat) {
      lastBeatRef.current = now;
      beatPulseRef.current = 1.0;
    }
    
    return isBeat;
  };

  // Get color from frequency data
  const getColorFromFrequency = (freqIndex: number, totalFreq: number, beat: number): string => {
    const scheme = COLOR_SCHEMES[configRef.current.colorScheme];
    const normalized = freqIndex / totalFreq;
    const colorIndex = Math.floor(normalized * (scheme.length - 1));
    const nextIndex = Math.min(colorIndex + 1, scheme.length - 1);
    const t = (normalized * (scheme.length - 1)) % 1;
    
    const c1 = hexToRgb(scheme[colorIndex]);
    const c2 = hexToRgb(scheme[nextIndex]);
    
    if (!c1 || !c2) return scheme[0];
    
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    
    // Boost saturation on beat
    if (beat > 0.5) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      if (diff > 0) {
        return `rgb(${Math.min(255, r + diff * beat)}, ${Math.min(255, g + diff * beat * 0.5)}, ${Math.max(0, b - diff * beat * 0.5)})`;
      }
    }
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Render orb visualization
  const renderOrb = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number, beat: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.35;
    const complexity = configRef.current.orbComplexity;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(orbRotationRef.current);
    
    // Multiple rotating layers
    for (let layer = 0; layer < complexity; layer++) {
      const layerRadius = maxRadius * (0.4 + layer * 0.15);
      const points = 64 + layer * 16;
      const rotationSpeed = 0.0005 * (layer + 1) * (1 + beat * 2);
      const layerRot = orbRotationRef.current + layer * 0.5;
      
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2 + layerRot;
        const freqIndex = Math.floor((i / points) * (dataArray.length / 2));
        const amplitude = dataArray[freqIndex] / 255;
        const radius = layerRadius * (0.6 + amplitude * 0.6 * configRef.current.sensitivity);
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, layerRadius);
      const baseColor = getColorFromFrequency(layer * 32, dataArray.length / 2, beat);
      gradient.addColorStop(0, baseColor + '40');
      gradient.addColorStop(0.5, baseColor + '20');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Stroke
      ctx.strokeStyle = baseColor + (0.3 + beat * 0.5).toFixed(2).slice(2);
      ctx.lineWidth = 1.5 + beat * 2;
      ctx.stroke();
    }
    
    // Center pulse on beat
    if (beat > 0.3) {
      const pulseRadius = maxRadius * 0.15 * beat;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseRadius);
      gradient.addColorStop(0, '#fff' + Math.floor(beat * 200).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  };

  // Render wave visualization
  const renderWaves = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number, beat: number) => {
    const centerY = height / 2;
    const waveCount = 5;
    const barWidth = width / (dataArray.length / 4);
    
    for (let wave = 0; wave < waveCount; wave++) {
      ctx.beginPath();
      const waveOffset = (waveOffsetRef.current + wave * 0.3) % (Math.PI * 2);
      const amplitude = 30 + wave * 15 + beat * 40;
      
      for (let i = 0; i < dataArray.length / 4; i++) {
        const x = i * barWidth;
        const freqIndex = i * 4;
        const normalized = dataArray[freqIndex] / 255;
        const y = centerY + Math.sin(waveOffset + i * 0.1) * amplitude * normalized * configRef.current.sensitivity;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      const color = getColorFromFrequency(wave * 64, dataArray.length / 4, beat);
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 2 + wave * 0.5;
      ctx.stroke();
      
      // Fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = color + '10';
      ctx.fill();
    }
    
    waveOffsetRef.current += 0.01 * (1 + beat);
  };

  // Render particle visualization
  const renderParticles = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number, beat: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const particleCount = configRef.current.particleCount;
    
    // Initialize particles if needed
    if (particlesRef.current.length < particleCount) {
      while (particlesRef.current.length < particleCount) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * Math.min(width, height) * 0.4;
        particlesRef.current.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 3 + 1,
          color: getColorFromFrequency(Math.floor(Math.random() * dataArray.length), dataArray.length, 0),
          life: 1,
          angle,
          speed: Math.random() * 0.5 + 0.2,
        });
      }
    }
    
    // Get bass energy for particle burst
    const bass = dataArray.slice(0, 20).reduce((a, b) => a + b, 0) / 20 / 255;
    const isBassHit = bass > 0.6;
    
    particlesRef.current.forEach((p, i) => {
      // Update position
      const freqIndex = Math.floor((i / particleCount) * dataArray.length);
      const energy = dataArray[freqIndex] / 255;
      
      // Attract to center with spring physics
      const dx = centerX - p.x;
      const dy = centerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = 0.005 + energy * 0.02;
      
      p.vx += dx * force;
      p.vy += dy * force;
      
      // Add angular velocity based on frequency
      p.angle += p.speed * 0.01 * (1 + energy);
      const orbitRadius = 50 + energy * 100;
      p.vx += Math.cos(p.angle) * orbitRadius * 0.001;
      p.vy += Math.sin(p.angle) * orbitRadius * 0.001;
      
      // Beat burst
      if (isBassHit && Math.random() < 0.1) {
        const burstAngle = Math.random() * Math.PI * 2;
        p.vx += Math.cos(burstAngle) * (5 + Math.random() * 10);
        p.vy += Math.sin(burstAngle) * (5 + Math.random() * 10);
      }
      
      // Damping
      p.vx *= 0.98;
      p.vy *= 0.98;
      
      p.x += p.vx;
      p.y += p.vy;
      
      // Wrap around
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
      
      // Update color based on frequency
      p.color = getColorFromFrequency(freqIndex, dataArray.length, beat);
      
      // Draw particle
      ctx.beginPath();
      const alpha = Math.max(0.1, p.life) * (0.5 + energy * 0.5);
      ctx.fillStyle = p.color.replace('rgb', 'rgba').replace(')', `, ${alpha.toFixed(2)})`);
      ctx.arc(p.x, p.y, Math.max(1, p.size * (0.5 + energy)), 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Render frequency bars
  const renderBars = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number, beat: number) => {
    const barCount = 64;
    const barWidth = width / barCount * 0.8;
    const gap = width / barCount * 0.2;
    const maxHeight = height * 0.8;
    
    for (let i = 0; i < barCount; i++) {
      const freqIndex = Math.floor(i * (dataArray.length / 2) / barCount);
      const normalized = dataArray[freqIndex] / 255;
      const barHeight = normalized * maxHeight * configRef.current.sensitivity;
      const x = i * (barWidth + gap) + gap / 2;
      const y = height - barHeight;
      
      const color = getColorFromFrequency(freqIndex, dataArray.length / 2, beat);
      
      // Gradient fill
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0.1)'));
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Beat glow on top
      if (beat > 0.5) {
        ctx.fillStyle = '#fff' + Math.floor(beat * 150).toString(16).padStart(2, '0');
        ctx.fillRect(x, y - 2, barWidth, 2);
      }
    }
  };

  // Render radial visualization
  const renderRadial = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number, beat: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;
    const segments = 32;
    
    for (let ring = 0; ring < 4; ring++) {
      const ringRadius = maxRadius * (0.2 + ring * 0.2);
      ctx.beginPath();
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2 + orbRotationRef.current * (1 + ring * 0.1);
        const freqIndex = Math.floor(i * (dataArray.length / 2) / segments);
        const amplitude = dataArray[freqIndex] / 255;
        const radius = ringRadius * (0.7 + amplitude * 0.5 * configRef.current.sensitivity);
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      const color = getColorFromFrequency(ring * 32, dataArray.length / 2, beat);
      ctx.fillStyle = color + '20';
      ctx.fill();
      ctx.strokeStyle = color + '60';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  // Main render loop
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current || !isPlaying) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear with slight trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);
    
    // Get frequency data
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Detect beat
    const beat = configRef.current.showBeatPulse ? detectBeat(dataArray) : 0;
    const beatValue = beatPulseRef.current;
    beatPulseRef.current *= 0.92; // Decay
    
    // Update orb rotation
    orbRotationRef.current += 0.0008 * (1 + beatValue * 3);
    
    // Render based on mode
    switch (configRef.current.mode) {
      case 'orb':
        renderOrb(ctx, dataArray, width, height, beatValue);
        break;
      case 'waves':
        renderWaves(ctx, dataArray, width, height, beatValue);
        break;
      case 'particles':
        renderParticles(ctx, dataArray, width, height, beatValue);
        break;
      case 'bars':
        renderBars(ctx, dataArray, width, height, beatValue);
        break;
      case 'radial':
        renderRadial(ctx, dataArray, width, height, beatValue);
        break;
    }
    
    // Draw frequency bars overlay if enabled
    if (configRef.current.showFrequencyBars && configRef.current.mode !== 'bars') {
      renderBars(ctx, dataArray, width, height, beatValue * 0.3);
    }
    
    animationRef.current = requestAnimationFrame(render);
  };

  // Start/stop render loop based on playback
  useEffect(() => {
    if (isPlaying && isReady && audioElement) {
      animationRef.current = requestAnimationFrame(render);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, isReady, audioElement]);

  // Initialize when audio element changes
  useEffect(() => {
    if (audioElement && visualizerSettings.enabled) {
      initAudio();
    } else {
      cleanupAudio();
    }
    return cleanupAudio;
  }, [audioElement, visualizerSettings.enabled]);

  // Handle audio context resume on user interaction
  useEffect(() => {
    const resumeAudio = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (err) {
          console.warn('Could not resume audio context:', err);
        }
      }
    };
    
    document.addEventListener('click', resumeAudio, { once: true });
    document.addEventListener('keydown', resumeAudio, { once: true });
    return () => {
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
    };
  }, []);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  if (!visualizerSettings.enabled) return null;

  return (
    <div 
      className={`music-visualizer ${className}`}
      style={{ 
        width, 
        height, 
        position: 'relative', 
        overflow: 'hidden',
        borderRadius: 'inherit',
        background: 'transparent',
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          display: 'block',
          borderRadius: 'inherit',
        }}
      />
      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 12,
          padding: 16,
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

// Helper function
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}