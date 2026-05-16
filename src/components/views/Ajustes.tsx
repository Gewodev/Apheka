import React, { useEffect, useState } from 'react';
import {
  User, Bell, Palette, LogOut,
  Moon, Sun, Type, Check,
  Timer, Target, Zap, Clock, Brain, BookOpen,
  Download, FolderOpen, Music
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import toast from 'react-hot-toast';
import { open } from '@tauri-apps/plugin-dialog';
import { getDownloadPath, setDownloadPath } from '../../lib/musicApi';

export default function Ajustes() {
  const { settings, updateSettings } = useApp();

  const fonts = [
    { name: 'Inter', family: "'Inter', sans-serif" },
    { name: 'Outfit', family: "'Outfit', sans-serif" },
    { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
    { name: 'Roboto', family: "'Roboto', sans-serif" },
  ];

  const [downloadPath, setDownloadPathState] = useState('');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>('mp3');

  useEffect(() => {
    getDownloadPath().then(setDownloadPathState).catch(() => { });
  }, []);

  const handleFontChange = (font: string) => {
    updateSettings({ fontFamily: font });
    document.documentElement.style.setProperty('--font-primary', font);
    toast.success(`Tipografía cambiada`);
  };

  return (
  return (
    <div className="page-container" style={{ overflowY: 'auto' }}>

      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Configuración</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>Personaliza tu entorno de estudio</p>
      </header>

      <div style={{ maxWidth: 840 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* ── Profile ── */}
            <section className="bento-card" style={{ padding: '24px 28px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
                <User size={18} className="text-accent" /> Perfil
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #0d0d12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, flexShrink: 0, boxShadow: '0 0 20px var(--accent-glow)' }}>
                  {settings.userName.charAt(0).toUpperCase()}
                </div>
                <input type="text" value={settings.userName} onChange={e => updateSettings({ userName: e.target.value })} className="input-base" style={{ flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 600 }} placeholder="Tu nombre" />
              </div>
            </section>

            {/* ── Appearance ── */}
            <section className="bento-card" style={{ padding: '24px 28px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
                <Palette size={18} className="text-accent" /> Apariencia
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Modo Visual</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Tema de la interfaz</div>
                  </div>
                  <div style={{ display: 'flex', background: 'var(--bg-deep)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <button onClick={() => updateSettings({ theme: 'oscuro' })} style={{ padding: '8px 16px', borderRadius: 8, background: settings.theme === 'oscuro' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: settings.theme === 'oscuro' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, transition: 'all 200ms', boxShadow: settings.theme === 'oscuro' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}>
                      <Moon size={14} /> Oscuro
                    </button>
                    <button onClick={() => updateSettings({ theme: 'claro' })} style={{ padding: '8px 16px', borderRadius: 8, background: settings.theme === 'claro' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: settings.theme === 'claro' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, transition: 'all 200ms', boxShadow: settings.theme === 'claro' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}>
                      <Sun size={14} /> Claro
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Type size={14} className="text-accent" /> Tipografía Global
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {fonts.map(font => (
                      <button key={font.name} onClick={() => handleFontChange(font.family)} className="hover-lift" style={{ padding: '12px', borderRadius: 10, background: settings.fontFamily === font.family ? 'var(--accent)' : 'var(--bg-deep)', border: `1px solid ${settings.fontFamily === font.family ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`, color: settings.fontFamily === font.family ? '#fff' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 200ms', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: font.family }}>Aa</div>
                        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>{font.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Color de Acento</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'].map(color => (
                      <div key={color} onClick={() => updateSettings({ accentColor: color })} className="hover-lift" style={{ width: 36, height: 36, borderRadius: '50%', background: color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${settings.accentColor === color ? '#fff' : 'transparent'}`, boxShadow: settings.accentColor === color ? `0 0 16px ${color}80` : 'none', transition: 'all 200ms' }}>
                        {settings.accentColor === color && <Check size={14} color="#fff" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* ── Study Configuration ── */}
            <section className="bento-card" style={{ padding: '24px 28px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
                <Brain size={18} className="text-accent" /> Configuración de Estudio
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Timer size={12} /> Tiempo enfoque
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={settings.pomodoroTime / 60} onChange={e => updateSettings({ pomodoroTime: parseInt(e.target.value) * 60 || 1500 })} className="input-base" style={{ fontSize: 13, padding: '8px 12px', width: '100%', fontWeight: 600 }} min="1" max="120" />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>min</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={12} /> Descanso corto
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={settings.shortBreakTime / 60} onChange={e => updateSettings({ shortBreakTime: parseInt(e.target.value) * 60 || 300 })} className="input-base" style={{ fontSize: 13, padding: '8px 12px', width: '100%', fontWeight: 600 }} min="1" max="30" />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>min</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={12} /> Meta diaria
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={settings.dailyGoal} onChange={e => updateSettings({ dailyGoal: parseInt(e.target.value) || 240 })} className="input-base" style={{ fontSize: 13, padding: '8px 12px', width: '100%', fontWeight: 600 }} min="1" />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>min</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={12} /> Metas Pomo
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={settings.pomodoroGoal} onChange={e => updateSettings({ pomodoroGoal: parseInt(e.target.value) || 4 })} className="input-base" style={{ fontSize: 13, padding: '8px 12px', width: '100%', fontWeight: 600 }} min="1" max="20" />
                  </div>
                </div>
              </d          {/* ── Downloads ── */}
              <section className="bento-card" style={{ padding: '24px 28px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
                  <Download size={18} className="text-accent" /> Descargas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Carpeta de destino</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-deep)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px', minWidth: 0 }}>
                        <FolderOpen size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{downloadPath || 'Descargas/OWA Music'}</span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
                            if (folder) {
                              setDownloadPathState(String(folder));
                              await setDownloadPath(String(folder));
                              toast.success('Carpeta de descarga actualizada');
                            }
                          } catch (e) { console.error(e); toast.error('No se pudo cambiar la carpeta'); }
                        }}
                        className="btn-secondary hover-lift"
                        style={{ height: 42, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}
                      >
                        <FolderOpen size={14} /> Cambiar
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Formato de audio</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['mp3', 'm4a'].map(f => (
                        <button
                          key={f}
                          onClick={() => setAudioFormat(f as 'mp3' | 'm4a')}
                          className="hover-lift"
                          style={{
                            padding: '6px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                            background: audioFormat === f ? 'var(--accent)' : 'var(--bg-deep)',
                            color: audioFormat === f ? '#fff' : 'var(--text-tertiary)',
                            border: `1px solid ${audioFormat === f ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`,
                            cursor: 'pointer', transition: 'all 200ms',
                            boxShadow: audioFormat === f ? '0 4px 12px rgba(225,29,72,0.3)' : 'none'
                          }}
                        >{f}</button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 500 }}>
                      MP3 recomendado para máxima compatibilidad
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Notifications ── */}
              <section className="bento-card" style={{ padding: '24px 28px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
                  <Bell size={18} className="text-accent" /> Notificaciones
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px 0' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Alertas de temporizador</span>
                    <input type="checkbox" checked={settings.notifications} onChange={e => updateSettings({ notifications: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px 0' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Efectos de sonido</span>
                    <input type="checkbox" checked={settings.soundEffects} onChange={e => updateSettings({ soundEffects: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </label>
                </div>
              </section>

              <button className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'color-mix(in srgb, var(--error) 8%, transparent)', color: 'var(--error)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: 'fit-content', marginTop: 12 }}>
                <LogOut size={16} /> Cerrar Sesión
              </button>

          </div>
        </div>
      </div>
      );
}
