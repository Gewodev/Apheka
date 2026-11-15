import React, { useState, useEffect } from 'react';
import { useAppSlice } from '../../store/AppContext';
import { Music2, Settings, X, Check, SlidersHorizontal, Palette, Zap, Circle, Hexagon, Grid } from 'lucide-react';
import './music-visualizer.css';

const MODES = [
  { id: 'orb' as const, icon: Circle, label: 'Orbe Vivo', desc: 'Masa simbiótica que respira al ritmo', gradient: 'linear-gradient(135deg, #FF0000, #00FF00, #0000FF)' },
  { id: 'waves' as const, icon: Zap, label: 'Ondas', desc: 'Ondas fluidas que fluyen con la música', gradient: 'linear-gradient(135deg, #00FFFF, #0080FF, #4B0082)' },
  { id: 'particles' as const, icon: Grid, label: 'Partículas', desc: 'Enjambre reactivo que estalla en los beats', gradient: 'linear-gradient(135deg, #FFD700, #FF6B00, #FF0080)' },
  { id: 'radial' as const, icon: Hexagon, label: 'Radial', desc: 'Anillos concéntricos que pulsan', gradient: 'linear-gradient(135deg, #FF00FF, #00FFFF, #FFFF00)' },
  { id: 'bars' as const, icon: SlidersHorizontal, label: 'Barras', desc: 'Ecualizador clásico moderno', gradient: 'linear-gradient(135deg, #00FF00, #FFFF00, #FF0000)' },
];

const COLOR_SCHEMES = [
  { id: 'rainbow', label: 'Arcoíris', preview: 'rainbow', gradient: 'linear-gradient(90deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #9400D3)' },
  { id: 'fire', label: 'Fuego', preview: 'fire', gradient: 'linear-gradient(90deg, #FF0000, #FF4500, #FF8C00, #FFD700, #FFA500, #FF6347, #DC143C)' },
  { id: 'ocean', label: 'Océano', preview: 'ocean', gradient: 'linear-gradient(90deg, #000080, #0000FF, #00BFFF, #00FFFF, #40E0D0, #48D1CC, #20B2AA)' },
  { id: 'forest', label: 'Bosque', preview: 'forest', gradient: 'linear-gradient(90deg, #006400, #228B22, #32CD32, #7CFC00, #ADFF2F, #98FB98, #90EE90)' },
  { id: 'cosmic', label: 'Cósmico', preview: 'cosmic', gradient: 'linear-gradient(90deg, #1A0033, #4B0082, #8A2BE2, #9400D3, #BA55D3, #DA70D6, #EE82EE)' },
  { id: 'monochrome', label: 'Monocromo', preview: 'monochrome', gradient: 'linear-gradient(90deg, #111111, #333333, #555555, #777777, #999999, #BBBBBB, #DDDDDD)' },
];

export default function MusicVisualizerSettings() {
  const { settings, updateSettings } = useAppSlice(['settings', 'updateSettings']);
  
  const visualizerSettings = settings.musicVisualizer || {
    enabled: true,
    mode: 'orb' as const,
    colorScheme: 'rainbow' as const,
    sensitivity: 1.0,
    smoothing: 0.8,
    showBeatPulse: true,
    showFrequencyBars: false,
    particleCount: 200,
    orbComplexity: 3,
    showOnCover: true,
    showOnLyrics: true,
  };
  
  const [localSettings, setLocalSettings] = useState(visualizerSettings);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateSettings({ musicVisualizer: localSettings });
    }, 300);
    return () => clearTimeout(timer);
  }, [localSettings, updateSettings]);

  const handleChange = <K extends keyof typeof localSettings>(key: K, value: typeof localSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <section className="bento-card music-visualizer-settings" style={{ padding: 24 }}>
      <header>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #8B5CF6) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Music2 size={16} style={{ color: '#fff' }} />
        </span>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", margin: 0 }}>Visualizador Musical</h3>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, marginBottom: 0 }}>Efectos visuales reactivos al ritmo en portada y letra</p>
        </div>
      </header>

      {/* Main Toggle */}
      <div className="music-visualizer-toggle">
        <div className="music-visualizer-toggle-info">
          <span className="music-visualizer-toggle-icon">
            <SlidersHorizontal size={14} />
          </span>
          <div>
            <span className="music-visualizer-toggle-label">Visualizador activado</span>
            <span className="music-visualizer-toggle-desc">Muestra efectos visuales que reaccionan al ritmo de la canción</span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={localSettings.enabled}
          onClick={() => handleChange('enabled', !localSettings.enabled)}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: 'none',
            background: localSettings.enabled ? 'var(--accent)' : 'var(--border-subtle)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 200ms ease',
          }}
        >
          <span style={{
            position: 'absolute',
            top: 2,
            left: localSettings.enabled ? 24 : 2,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </button>
      </div>

      {!localSettings.enabled && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          Activa el visualizador para ver las opciones de configuración
        </p>
      )}

      {localSettings.enabled && (
        <>
          {/* Display Options */}
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }}>
              <input
                type="checkbox"
                checked={localSettings.showOnCover}
                onChange={e => handleChange('showOnCover', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>En portada del reproductor</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>Sobre la carátula del álbum</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }}>
              <input
                type="checkbox"
                checked={localSettings.showOnLyrics}
                onChange={e => handleChange('showOnLyrics', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>En vista de letra</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>Fondo animado detrás de la letra</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }}>
              <input
                type="checkbox"
                checked={localSettings.showBeatPulse}
                onChange={e => handleChange('showBeatPulse', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Pulso en el beat</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>Destello visual en cada golpe</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms' }}>
              <input
                type="checkbox"
                checked={localSettings.showFrequencyBars}
                onChange={e => handleChange('showFrequencyBars', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Barras de frecuencia</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>Superponer ecualizador</span>
            </label>
          </div>

          {/* Mode Selection */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Modo de visualización</span>
              <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'var(--accent)' }}>{MODES.find(m => m.id === localSettings.mode)?.label}</span>
            </div>
            <div className="music-visualizer-options">
              {MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  className={`music-visualizer-option ${localSettings.mode === mode.id ? 'selected' : ''}`}
                  onClick={() => handleChange('mode', mode.id)}
                  style={{
                    background: mode.gradient,
                    color: '#fff',
                    border: localSettings.mode === mode.id ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: localSettings.mode === mode.id ? '0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)' : 'none',
                  }}
                >
                  <div className="music-visualizer-option-header">
                    <span className="music-visualizer-option-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <mode.icon size={12} />
                    </span>
                    <span className="music-visualizer-option-title">{mode.label}</span>
                  </div>
                  <div className="music-visualizer-option-desc">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Scheme Selection */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Esquema de color</span>
              <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'var(--accent)' }}>{COLOR_SCHEMES.find(c => c.id === localSettings.colorScheme)?.label}</span>
            </div>
            <div className="music-visualizer-color-schemes">
              {COLOR_SCHEMES.map(scheme => (
                <button
                  key={scheme.id}
                  type="button"
                  className={`music-visualizer-color-scheme ${localSettings.colorScheme === scheme.id ? 'selected' : ''} ${scheme.preview}`}
                  onClick={() => handleChange('colorScheme', scheme.id as any)}
                  style={{ background: scheme.gradient }}
                >
                  <span className="music-visualizer-color-scheme-preview {scheme.preview}" />
                  <span>{scheme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Sliders */}
          <div className="music-visualizer-sliders">
            <div className="music-visualizer-slider">
              <div className="music-visualizer-slider-label">
                <span>Sensibilidad</span>
                <span className="music-visualizer-slider-value">{localSettings.sensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.1"
                value={localSettings.sensitivity}
                onChange={e => handleChange('sensitivity', parseFloat(e.target.value))}
                className="music-visualizer-slider-input"
              />
            </div>

            <div className="music-visualizer-slider">
              <div className="music-visualizer-slider-label">
                <span>Suavizado</span>
                <span className="music-visualizer-slider-value">{Math.round(localSettings.smoothing * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.05"
                value={localSettings.smoothing}
                onChange={e => handleChange('smoothing', parseFloat(e.target.value))}
                className="music-visualizer-slider-input"
              />
            </div>

            <div className="music-visualizer-slider">
              <div className="music-visualizer-slider-label">
                <span>Partículas (modo partículas)</span>
                <span className="music-visualizer-slider-value">{localSettings.particleCount}</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="25"
                value={localSettings.particleCount}
                onChange={e => handleChange('particleCount', parseInt(e.target.value))}
                className="music-visualizer-slider-input"
              />
            </div>

            <div className="music-visualizer-slider">
              <div className="music-visualizer-slider-label">
                <span>Complejidad (modo orbe)</span>
                <span className="music-visualizer-slider-value">{localSettings.orbComplexity}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={localSettings.orbComplexity}
                onChange={e => handleChange('orbComplexity', parseInt(e.target.value))}
                className="music-visualizer-slider-input"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setLocalSettings({ ...localSettings, mode: 'orb', colorScheme: 'rainbow', sensitivity: 1.2, particleCount: 200 })}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
            >
              <Zap size={12} /> Discoteca
            </button>
            <button
              type="button"
              onClick={() => setLocalSettings({ ...localSettings, mode: 'particles', colorScheme: 'fire', sensitivity: 1.5, particleCount: 300 })}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
            >
              <Zap size={12} style={{ color: '#FF6B00' }} /> Fuego
            </button>
            <button
              type="button"
              onClick={() => setLocalSettings({ ...localSettings, mode: 'waves', colorScheme: 'ocean', sensitivity: 0.8, smoothing: 0.9 })}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
            >
              <Zap size={12} style={{ color: '#00FFFF' }} /> Chill
            </button>
            <button
              type="button"
              onClick={() => setLocalSettings({ ...localSettings, mode: 'radial', colorScheme: 'cosmic', sensitivity: 1.0, orbComplexity: 4 })}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
            >
              <Hexagon size={12} style={{ color: '#9400D3' }} /> Psicodélico
            </button>
            <button
              type="button"
              onClick={() => setLocalSettings({ ...localSettings, mode: 'orb', colorScheme: 'monochrome', sensitivity: 0.6, smoothing: 0.85 })}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
            >
              <Circle size={12} style={{ color: '#888' }} /> Minimal
            </button>
          </div>
        </>
      )}
    </section>
  );
}