import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  User, Palette, Brain, Download, Bell,
  Moon, Sun,
  Timer, Zap,
  RefreshCw, Shield,
  Sliders, Music,
  Calendar, Database, Upload,
  Wifi, Image, Coffee, X, Trash2,
  Monitor, Activity, Sparkles, LogOut, Eye, EyeOff, CalendarDays, Clock
} from 'lucide-react';
import { useApp, fmtClock } from '../../store/AppContext';
import { del } from 'idb-keyval';
import { invoke } from '@tauri-apps/api/core';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { open, save } from '@tauri-apps/plugin-dialog';
import NotificationBell from '../ui/NotificationBell';
import { copyFile, mkdir, exists, readFile, writeFile, readTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir, join, extname } from '@tauri-apps/api/path';
import {
  signIn, signOut, isSignedIn, onAuthChange, configureGoogle,
} from '../../lib/google/index';
import { isTauri } from '../../lib/tauri';
import {
  supabase, signInWithGoogle as supabaseSignIn, signOutSupabase, getCurrentUser, syncAllToSupabase,
} from '../../lib/supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

type SettingsTab = 'perfil' | 'apariencia' | 'estudio' | 'musica' | 'sistema' | 'notificaciones';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
  { id: 'estudio', label: 'Estudio', icon: Brain },
  { id: 'musica', label: 'Música', icon: Music },
  { id: 'sistema', label: 'Sistema', icon: Shield },
  { id: 'notificaciones', label: 'Sonidos y Alertas', icon: Bell },
];

const FONTS = [
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'Inter Tight', family: "'Inter Tight', sans-serif" },
  { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { name: 'Roboto', family: "'Roboto', sans-serif" },
  { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
  { name: 'Satoshi', family: "'Satoshi', sans-serif" },
  { name: 'Cabinet Grotesk', family: "'Cabinet Grotesk', sans-serif" },
  { name: 'DM Sans', family: "'DM Sans', sans-serif" },
  { name: 'Manrope', family: "'Manrope', sans-serif" },
  { name: 'Clash Display', family: "'Clash Display', sans-serif" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'DM Mono', family: "'DM Mono', monospace" },
];

const THEME_PRESETS = [
  { name: 'Clásico', colors: ['#E11D48', '#3B82F6', '#1a1116'], desc: 'Rojo y azul sobre fondo granate oscuro' },
  { name: 'Noche', colors: ['#38bdf8', '#818cf8', '#0e1628'], desc: 'Cian y violeta sobre fondo azul noche' },
  { name: 'Galaxia', colors: ['#a78bfa', '#e879f9', '#181028'], desc: 'Púrpura y rosa sobre fondo violeta profundo' },
  { name: 'Bosque', colors: ['#4ade80', '#2dd4bf', '#0e1a10'], desc: 'Verde y turquesa sobre fondo bosque oscuro' },
  { name: 'Marino', colors: ['#60a5fa', '#34d399', '#0a1224'], desc: 'Azul océano y esmeralda sobre fondo marino' },
  { name: 'Atardecer', colors: ['#fb923c', '#f472b6', '#20140c'], desc: 'Naranja y rosa sobre fondo cálido terroso' },
  { name: 'Lava', colors: ['#f43f5e', '#f97316', '#1e0c0c'], desc: 'Rojo y naranja sobre fondo granate intenso' },
  { name: 'Neón', colors: ['#22d3ee', '#34d399', '#0c1a1e'], desc: 'Cian y esmeralda sobre fondo teal profundo' },
  { name: 'Hielo', colors: ['#7dd3fc', '#a5b4fc', '#0c1424'], desc: 'Azul y lavanda sobre fondo glacial oscuro' },
  { name: 'Ámbar', colors: ['#fbbf24', '#d97706', '#1e1808'], desc: 'Ámbar y dorado sobre fondo miel oscuro' },
  { name: 'Rosa', colors: ['#f472b6', '#c084fc', '#1a0e1c'], desc: 'Rosa y lavanda sobre fondo malva oscuro' },
  { name: 'Lima', colors: ['#84cc16', '#65a30d', '#0e1a0c'], desc: 'Lima y verde hoja sobre fondo verde profundo' },
  { name: 'Carbón', colors: ['#a1a1aa', '#6366f1', '#141416'], desc: 'Grises con acento índigo sobre fondo carbón' },
  { name: 'Día', colors: ['#0f172a', '#475569', '#f0ece4'], desc: 'Acento oscuro sobre fondo crema claro' },
  { name: 'Pastel', colors: ['#e86a7a', '#7fbbdd', '#f5f1eb'], desc: 'Coral suave y celeste sobre fondo marfil' },
];

const ACCENT_COLORS = ['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316', '#84CC16', '#D946EF', '#14B8A6', '#6366F1'];

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="bento-card hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'block', lineHeight: 1.5 }}>{desc}</span>
      </div>
      <div style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: checked ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)', transition: 'all 200ms', flexShrink: 0, marginLeft: 16, display: 'flex', alignItems: 'center', padding: 2 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(20px)' : 'translateX(0)', transition: 'all 200ms', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      </div>
    </label>
  );
}

function RangeSlider({ label, value, min, max, step = 1, unit, onChange, color }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string;
  onChange: (v: number) => void; color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 4, borderRadius: 2, outline: 'none', cursor: 'pointer',
          background: `linear-gradient(90deg, ${color}60, ${color} ${((value - min) / (max - min)) * 100}%, var(--bg-deep) ${((value - min) / (max - min)) * 100}%)`,
          WebkitAppearance: 'none', appearance: 'none', accentColor: color,
        }}
        className="range-slider" />
    </div>
  );
}

export default function Ajustes() {
  const {
    settings, updateSettings, googleConnected, setGoogleConnected,
    setCalendarSyncEnabled, lastCalendarSync, setLastCalendarSync,
    triggerCalendarSync, importGoogleEvents,
    loadGoogleProfile,
    events, tasks, notes, clearAllMusicData, addNotification, deleteCompletedTasks,
    exportMusicLibrary, importMusicLibrary,
    tracks, updateTrack,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil');

  type HideMode = 'off' | 'now' | '10m' | '1h' | '6h' | '24h' | '48h';
  const [hideMode, setHideMode] = useState<HideMode>(() => {
    try { return (localStorage.getItem('owa_hide_completed') as HideMode) || 'off'; } catch { return 'off'; }
  });


  const [googleProfile, setGoogleProfile] = useState<{ displayName: string; givenName: string; photoUrl: string; email: string } | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<{ email?: string } | null>(null);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showClearAllMusic, setShowClearAllMusic] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [clearAllMusicText, setClearAllMusicText] = useState('');
  const [sysInfo, setSysInfo] = useState<{ cpu: number; ram: number; disk: number; platform: string; arch: string; appVer: string } | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Load theme colors from saved settings on mount
  useEffect(() => {
    const saved = settings.accentColor;
    if (saved) {
      const match = THEME_PRESETS.find(t => t.colors[0] === saved);
      if (match) {
        if (match.colors[1]) document.documentElement.style.setProperty('--theme-secondary', match.colors[1]);
        if (match.colors[2]) document.documentElement.style.setProperty('--theme-tertiary', match.colors[2]);
      } else {
        document.documentElement.style.setProperty('--theme-secondary', saved);
        document.documentElement.style.setProperty('--theme-tertiary', saved);
      }
    }
  }, []);

  // Real-time clock for header
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = fmtClock(format(currentTime, 'HH:mm'), settings?.timeFormat);
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) {
      configureGoogle(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      setGoogleConnected(isSignedIn());
      const unsub = onAuthChange(connected => setGoogleConnected(connected));
      return unsub;
    }
  }, [setGoogleConnected]);

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const raw: any = await invoke('get_system_stats');
        setSysInfo({
          cpu: Math.round(raw.cpu || 0),
          ram: Math.round(raw.mem ? Math.round((parseInt(raw.mem.Total) - parseInt(raw.mem.Free)) / parseInt(raw.mem.Total) * 100) : 0),
          disk: raw.disk || 0,
          platform: navigator.platform,
          arch: '',
          appVer: '1.0.0',
        });
      } catch {
        setSysInfo({ cpu: 0, ram: 0, disk: 0, platform: navigator.platform, arch: '', appVer: '1.0.0' });
      }
    })();
  }, []);

  useEffect(() => {
    const success = localStorage.getItem('owa_auth_success');
    if (success === 'google') {
      localStorage.removeItem('owa_auth_success');
      configureGoogle(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      if (isSignedIn()) {
        setGoogleConnected(true);
        loadGoogleProfile().then(profile => {
          if (profile) {
            setGoogleProfile(profile);
            if (profile.givenName) updateSettings({ userName: profile.givenName });
            addNotification(`Bienvenido, ${profile.givenName || profile.displayName}`, 'success');
          } else {
            addNotification('Google conectado exitosamente', 'success');
          }
        });
      }
    }
    const error = localStorage.getItem('owa_auth_error');
    if (error) {
      localStorage.removeItem('owa_auth_error');
      addNotification(`Error de Autenticación: ${error}`, 'error');
    }
    const sbSuccess = localStorage.getItem('owa_supabase_auth_success');
    if (sbSuccess === 'true') {
      localStorage.removeItem('owa_supabase_auth_success');
      setSupabaseConnected(true);
      addNotification('Supabase conectado exitosamente', 'success');
    }
    getCurrentUser().then(user => { setSupabaseConnected(!!user); if (user) setSupabaseUser(user as any); });
  }, [loadGoogleProfile, setGoogleConnected, updateSettings]);

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) { addNotification('Configura VITE_GOOGLE_CLIENT_ID en .env', 'error'); return; }
    const ok = await signIn();
    if (ok) {
      setGoogleConnected(true);
      const profile = await loadGoogleProfile();
      if (profile) {
        setGoogleProfile(profile);
        if (profile.givenName) updateSettings({ userName: profile.givenName });
        addNotification(`Bienvenido, ${profile.givenName || profile.displayName}`, 'success');
      } else {
        addNotification('Google conectado exitosamente', 'success');
      }
    } else if (!isTauri()) {
      addNotification('No se pudo conectar con Google', 'error');
    }
  };

  const handleSupabaseSignIn = async () => {
    if (isTauri()) {
      supabaseSignIn();
      return;
    }
    try {
      await supabaseSignIn();
      setSupabaseConnected(true);
      addNotification('Supabase conectado exitosamente', 'success');
    } catch {
      addNotification('No se pudo conectar con Supabase', 'error');
    }
  };

  const handleEmailSignIn = async () => {
    if (!authEmail || !authPassword) { addNotification('Completa email y contraseña', 'error'); return; }
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) throw error;
      setSupabaseConnected(true);
      setSupabaseUser({ email: data.user?.email || undefined });
      addNotification('Inicio de sesión exitoso', 'success');
    } catch (e: any) {
      addNotification(e?.message || 'Error al iniciar sesión', 'error');
    }
    setAuthLoading(false);
  };

  const handleEmailRegister = async () => {
    if (!authEmail || !authPassword) { addNotification('Completa email y contraseña', 'error'); return; }
    if (authPassword.length < 6) { addNotification('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) throw error;
      if (data.user?.identities?.length === 0) {
        addNotification('Este email ya está registrado. Inicia sesión.', 'info');
      } else {
        addNotification('Registro exitoso. Revisa tu email para confirmar.', 'success');
        setSupabaseConnected(true);
        setSupabaseUser({ email: data.user?.email || undefined });
      }
    } catch (e: any) {
      addNotification(e?.message || 'Error al registrarse', 'error');
    }
    setAuthLoading(false);
  };

  const handleSupabaseSignOut = async () => {
    await signOutSupabase();
    setSupabaseConnected(false);
    setSupabaseUser(null);
    addNotification('Sesión cerrada exitosamente', 'success');
  };

  const handleSupabaseSync = async () => {
    setSupabaseSyncing(true);
    try {
      await syncAllToSupabase({
        tasks: tasks.map(t => ({ ...t, user_id: '' }) as unknown as Record<string, unknown>),
        notes: notes.map(n => ({ ...n, user_id: '' }) as unknown as Record<string, unknown>),
        events: events.map(e => ({ ...e, user_id: '' }) as unknown as Record<string, unknown>),
        studySessions: [],
      });
      addNotification('Datos sincronizados con la nube exitosamente', 'success');
    } catch { addNotification('Error al sincronizar con Supabase', 'error'); }
    setSupabaseSyncing(false);
  };

  const handleGoogleSignOut = () => {
    signOut(); setGoogleConnected(false); setCalendarSyncEnabled(false); setLastCalendarSync(null);
    setGoogleProfile(null);
    addNotification('Google desconectado exitosamente', 'success');
  };

  const handleCalendarSync = async () => {
    try {
      await triggerCalendarSync();
      const count = await importGoogleEvents();
      addNotification(count > 0 ? `${count} eventos importados de Google Calendar` : 'Eventos sincronizados exitosamente', 'success');
    } catch { addNotification('Error de Sincronización con Google Calendar', 'error'); }
  };

  const handleFontChange = (font: string) => {
    updateSettings({ fontFamily: font });
    document.documentElement.style.setProperty('--font-primary', font);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* â”€â”€ HEADER â”€â”€ */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: "'Inter Tight', sans-serif" }}>Configuración</h1>
            <Sliders size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 300, letterSpacing: '0.02em' }}>Personaliza cada aspecto de tu entorno</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              En linea
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <NotificationBell />
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16, position: 'relative' }}>
            {/* Clock background illumination */}
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              right: 0, 
              width: 120, 
              height: 80, 
              background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)', 
              opacity: 0.4, 
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              zIndex: 0
            }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
              <div className="led-display" style={{ fontSize: 28, lineHeight: 1, color: 'var(--accent)', textShadow: '0 0 15px var(--accent-glow)' }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 14, color: 'var(--accent)', opacity: 0.8 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4, position: 'relative', zIndex: 1 }}>
              {dateStrCapitalized}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA (SIDEBAR + SETTINGS PANELS) */}
      <div style={{ display: 'flex', flex: 1, gap: 24, minHeight: 600, alignItems: 'flex-start' }}>
        
        {/* INNER SIDEBAR */}
        <aside className="bento-card" style={{ width: 240, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 8px' }}>
            Categorías
          </div>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
                background: active ? 'var(--accent)' : 'transparent',
                border: 'none', color: active ? '#fff' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms'
              }}>
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 8px 0' }} />
        </aside>

        {/* MAIN AREA */}
        <main className="bento-card" style={{ flex: 1, padding: '32px 40px', minHeight: 600 }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>

            {/* â•â•â•â•â•â•â•â•â•â•â• PERFIL â•â•â•â•â•â•â•â•â•â•â• */}
            {activeTab === 'perfil' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Perfil de Usuario</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Tu identidad y conexiones en OWA Studio</p>
                </div>

                {/* Avatar + Name + Photo URL */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {settings.profilePhoto ? (
                      <img src={settings.profilePhoto} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-dim)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 300, color: 'var(--accent)', fontFamily: "'Inter Tight', sans-serif" }}>
                        {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'O'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Nombre</label>
                    <input type="text" value={settings.userName}
                      onChange={e => updateSettings({ userName: e.target.value })}
                      className="input-base" style={{ width: '100%', height: 40, fontSize: 14, fontWeight: 500 }}
                      placeholder="Tu nombre" />
                    <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Foto de perfil (URL)</label>
                    <input type="text" value={settings.profilePhoto || ''}
                      onChange={e => updateSettings({ profilePhoto: e.target.value || undefined })}
                      className="input-base" style={{ width: '100%', height: 38, fontSize: 12, fontWeight: 400 }}
                      placeholder="https://..." />
                  </div>
                </div>

                {/* Connected Services */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', marginBottom: 16 }}>Autenticación y Nube</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Google */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Google</span>
                          <span style={{ fontSize: 10, color: googleConnected ? '#10B981' : 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>{googleConnected ? (googleProfile?.email || 'Conectado') : 'Desconectado'}</span>
                        </div>
                      </div>
                      <button onClick={() => { if (googleConnected) { handleGoogleSignOut(); } else { setShowGoogleModal(true); } }}
                        style={{ fontSize: 10, fontWeight: 600, padding: '0 14px', height: 30, borderRadius: 6, cursor: 'pointer', border: googleConnected ? '1px solid rgba(239,68,68,0.2)' : 'none', background: googleConnected ? 'rgba(239,68,68,0.08)' : '#4285F4', color: googleConnected ? '#EF4444' : '#fff', transition: 'all 150ms' }}>
                        {googleConnected ? 'Desconectar' : 'Conectar'}
                      </button>
                    </div>
                    {/* Supabase */}
                    {supabaseConnected ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Database size={18} style={{ color: '#3DCF8E' }} />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Supabase Cloud</span>
                            <span style={{ fontSize: 10, color: supabaseConnected ? '#10B981' : 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>
                              {supabaseConnected ? `Usuario: ${supabaseUser?.email || 'Conectado'}` : 'Sincronización en la nube'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: supabaseConnected ? '#10B981' : 'var(--text-muted)' }}>{supabaseConnected ? 'Activo' : 'Inactivo'}</span>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: supabaseConnected ? '#10B981' : 'var(--text-muted)', boxShadow: supabaseConnected ? '0 0 8px rgba(16,185,129,0.5)' : 'none' }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Database size={16} style={{ color: '#3DCF8E' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</span>
                        </div>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="input-base" style={{ width: '100%', height: 36, fontSize: 12, padding: '0 10px' }} />
                        <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Contraseña" className="input-base" style={{ width: '100%', height: 36, fontSize: 12, padding: '0 10px' }} onKeyDown={e => { if (e.key === 'Enter') authMode === 'login' ? handleEmailSignIn() : handleEmailRegister(); }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={authMode === 'login' ? handleEmailSignIn : handleEmailRegister} disabled={authLoading} style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#3DCF8E', color: '#fff', opacity: authLoading ? 0.6 : 1, transition: 'all 150ms' }}>
                            {authLoading ? '...' : authMode === 'login' ? 'Entrar' : 'Registrarse'}
                          </button>
                          <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthEmail(''); setAuthPassword(''); }} style={{ fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', padding: '0 8px', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                            {authMode === 'login' ? 'Registrarse' : 'Volver'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>o</span>
                          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                        </div>
                        <button onClick={() => { setShowGoogleModal(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 34, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#4285F4', color: '#fff', transition: 'all 150ms' }}>
                          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Google
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ocultar tareas completadas */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <EyeOff size={16} style={{ color: 'var(--accent)' }} />
                    <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', margin: 0 }}>Ocultar tareas completadas</h3>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>Controla cuándo se ocultan las tareas completadas en la vista de Tareas</p>
                  {([
                    { mode: 'off' as const, label: 'Siempre visible', desc: 'Las tareas completadas nunca se ocultan', icon: <Eye size={13} /> },
                    { mode: 'now' as const, label: 'Al instante', desc: 'Se ocultan apenas las completas', icon: <Zap size={13} /> },
                    { mode: '10m' as const, label: '10 minutos', desc: 'Tiempo para revisarlas', icon: <Clock size={13} /> },
                    { mode: '1h' as const, label: '1 hora', desc: 'Las ves por un rato', icon: <Timer size={13} /> },
                    { mode: '6h' as const, label: '6 horas', desc: 'Ocultar al pasar el turno', icon: <Coffee size={13} /> },
                    { mode: '24h' as const, label: '24 horas', desc: 'Ocultar al día siguiente', icon: <Calendar size={13} /> },
                    { mode: '48h' as const, label: '2 días', desc: 'Dos días para revisar', icon: <CalendarDays size={13} /> },
                  ]).map((opt, i) => {
                    const isActive = hideMode === opt.mode;
                    return (
                      <React.Fragment key={opt.mode}>
                        {i === 1 && <div style={{ height: 1, background: 'var(--border-soft)', margin: '6px 0' }} />}
                        <button onClick={() => {
                          setHideMode(opt.mode);
                          localStorage.setItem('owa_hide_completed', opt.mode);
                        }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                            border: '1px solid', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', marginBottom: 4,
                            background: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                            borderColor: isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}>{opt.icon}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.3 }}>{opt.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{opt.desc}</div>
                          </div>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: isActive ? '2px solid var(--accent)' : '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                            {isActive && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
                          </div>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Danger Zone — Logout + Data Management */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(googleConnected || supabaseConnected) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={async () => {
                        try {
                          await signOutSupabase();
                          setSupabaseConnected(false);
                          setSupabaseUser(null);
                          signOut();
                          setGoogleConnected(false);
                          setCalendarSyncEnabled(false);
                          setLastCalendarSync(null);
                          setGoogleProfile(null);
                          addNotification('Sesión cerrada exitosamente', 'success');
                        } catch { addNotification('Error al cerrar sesión', 'error'); }
                      }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms' }}>
                        <LogOut size={14} /> Cerrar Sesión
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setShowClearAllMusic(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms' }}>
                      <Music size={14} /> Borrar toda la música
                    </button>
                    <button onClick={() => {
                      const completedCount = tasks.filter(t => t.status === 'completado').length;
                      if (completedCount === 0) { addNotification('No hay tareas completadas para eliminar', 'info'); return; }
                      if (confirm(`¿Eliminar ${completedCount} tarea${completedCount !== 1 ? 's' : ''} completada${completedCount !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) {
                        deleteCompletedTasks();
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#EF4444', border: 'none', color: '#fff', cursor: 'pointer' }}>
                      <Trash2 size={14} /> Borrar completadas
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Apariencia */}
            {activeTab === 'apariencia' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Apariencia y Diseño</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Personaliza cada aspecto visual de OWA Studio</p>
                </div>

                {/* Selector de modo: Clásico vs 3 Colores */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Sistema de Color
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {settings.useThreeColors ? 'Modo 3 Colores' : 'Modo Clásico'}
                    </span>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 16, cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Modo 3 Colores</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginTop: 2 }}>Define fondo, acento y secundario en un solo lugar</span>
                    </div>
                    <div style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, background: settings.useThreeColors ? 'var(--accent)' : 'var(--bg-base)', border: '1px solid var(--border-default)', transition: 'all 200ms', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 2 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: settings.useThreeColors ? 'translateX(18px)' : 'translateX(0)', transition: 'all 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      <input type="checkbox" checked={settings.useThreeColors ?? false} onChange={e => updateSettings({ useThreeColors: e.target.checked, selectedThemePreset: e.target.checked ? null : settings.selectedThemePreset })} style={{ display: 'none' }} />
                    </div>
                  </label>

                  {/* MODO CLÁSICO (useThreeColors = false) */}
                  {!settings.useThreeColors && (
                    <>
                      {/* Modo Visual - tema de fondo */}
                      <div style={{ marginBottom: 20 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>Fondo de la App</span>
                        <div style={{ display: 'flex', gap: 12 }}>
                          {[
                            { id: 'oscuro' as const, label: 'Oscuro', icon: Moon, desc: 'Fondo oscuro profesional' },
                            { id: 'claro' as const, label: 'Claro', icon: Sun, desc: 'Fondo claro limpio' },
                            { id: 'vibrante' as const, label: 'Vibrante', icon: Sparkles, desc: 'Colores intensos y vivos' },
                          ].map(t => {
                            const Icon = t.icon;
                            const active = settings.theme === t.id;
                            return (
                              <button key={t.id} onClick={() => updateSettings({ theme: t.id })} className="hover-lift" style={{
                                flex: 1, padding: '16px', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                                color: active ? '#fff' : 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.02em',
                                transition: 'all 200ms',
                              }}>
                                <Icon size={20} />
                                <span>{t.label}</span>
                                <span style={{ fontSize: 9, fontWeight: 300, opacity: 0.7 }}>{t.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Color de Acento - 14 círculos */}
                      <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>Color de Acento</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {ACCENT_COLORS.map(color => {
                            const active = settings.accentColor === color;
                            return (
                              <button key={color} onClick={() => updateSettings({ accentColor: color, selectedThemePreset: null })} style={{
                                width: 32, height: 32, borderRadius: '50%', border: active ? '2px solid #fff' : '2px solid transparent',
                                background: color, cursor: 'pointer', transition: 'all 200ms',
                                outline: active ? `2px solid ${color}` : 'none',
                                outlineOffset: 2,
                                boxShadow: active ? `0 0 12px ${color}60` : '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            );
                          })}
                        </div>
                      </div>

                      {/* Separador */}
                      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />

                      {/* Color Primario - picker */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: settings.accentColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>Personalizar</span>
                        </div>
                        <input type="color" value={settings.accentColor}
                          onChange={e => updateSettings({ accentColor: e.target.value, selectedThemePreset: null })}
                          style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.3, display: 'block', marginTop: 4 }}>
                          Navegación, botones, encabezados
                        </span>
                      </div>
                    </>
                  )}

                  {/* MODO 3 COLORES (useThreeColors = true) */}
                  {settings.useThreeColors && (
                    <>
                      {/* Paletas predefinidas de 3 colores */}
                      <div style={{ marginBottom: 20 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>Paletas de Color</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {THEME_PRESETS.map(theme => {
                            const active = settings.selectedThemePreset === theme.name;
                            return (
                              <button key={theme.name} onClick={() => {
                                updateSettings({
                                  selectedThemePreset: theme.name,
                                  accentColor: theme.colors[0],
                                  secondaryColor: theme.colors[1] || theme.colors[0],
                                  surfaceColor: theme.colors[2] || '#1a1a22',
                                });
                              }} style={{
                                padding: '14px', borderRadius: 10, cursor: 'pointer',
                                background: active ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                                border: active ? `1.5px solid ${theme.colors[0]}` : '1px solid var(--border-default)',
                                transition: 'all 200ms', textAlign: 'left',
                                boxShadow: active ? `0 0 20px ${theme.colors[0]}30` : 'none',
                              }}>
                                <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                                  {theme.colors.map((c, i) => (
                                    <div key={i} style={{
                                      flex: 1, height: 14, borderRadius: 3,
                                      background: c,
                                      boxShadow: i === 0 && active ? `0 0 6px ${c}` : 'none',
                                    }} />
                                  ))}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>{theme.name}</span>
                                <span style={{ fontSize: 9, fontWeight: 300, color: 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>{theme.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Separador */}
                      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />

                      {/* 3 Color Pickers */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Tus 3 Colores
                        </span>
                        <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${settings.accentColor}20`, color: settings.accentColor, border: `1px solid ${settings.accentColor}40`, letterSpacing: '0.04em' }}>
                          PERSONALIZAR
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: settings.accentColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>1 · Acento</span>
                          </div>
                          <input type="color" value={settings.accentColor}
                            onChange={e => updateSettings({ accentColor: e.target.value, selectedThemePreset: null })}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                            Botones, navegación, acentos principales
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: settings.secondaryColor || '#3B82F6', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>2 · Efectos</span>
                          </div>
                          <input type="color" value={settings.secondaryColor || '#3B82F6'}
                            onChange={e => updateSettings({ secondaryColor: e.target.value, selectedThemePreset: null })}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                            Efectos visuales, detalles secundarios
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: settings.surfaceColor || '#1a1a22', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>3 · Fondo</span>
                          </div>
                          <input type="color" value={settings.surfaceColor || '#1a1a22'}
                            onChange={e => updateSettings({ surfaceColor: e.target.value, selectedThemePreset: null })}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
                          <span style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                            Fondo de toda la interfaz
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Tipografía */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>Familia Tipográfica</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {FONTS.map(font => {
                      const active = settings.fontFamily === font.family;
                      return (
                        <button key={font.name} onClick={() => handleFontChange(font.family)} className="hover-lift" style={{
                          padding: '18px 12px', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: active ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 200ms'
                        }}>
                          <div style={{ fontSize: 22, fontWeight: 500, fontFamily: font.family, lineHeight: 1, letterSpacing: '-0.02em' }}>Aa</div>
                          <div style={{ fontSize: 10, fontWeight: 500, opacity: active ? 1 : 0.6, fontFamily: font.family }}>{font.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fondo de la Aplicación y Paneles */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>Fondo y Apariencia de Paneles</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {settings.backgroundImage && (
                      <div style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-subtle)' }}>
                        <img src={settings.backgroundImage} alt="Fondo" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                        <button onClick={() => { updateSettings({ backgroundImage: undefined, backgroundImagePath: undefined }); }} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 500, backdropFilter: 'blur(4px)' }}>
                          Remover Fondo
                        </button>
                      </div>
                    )}
                    <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        updateSettings({ backgroundImage: dataUrl, backgroundImagePath: undefined });
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                    <button onClick={async () => {
                      if (isTauri()) {
                        try {
                          const selected = await open({
                            multiple: false,
                            filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif', 'tiff', 'heic'] }]
                          });
                          if (selected && typeof selected === 'string') {
                            try {
                              const appData = await appCacheDir();
                              const hasDir = await exists(appData);
                              if (!hasDir) await mkdir(appData, { recursive: true });
                              const ext = await extname(selected);
                              const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
                              const filename = `background_${Date.now()}.${cleanExt}`;
                              const dest = await join(appData, filename);
                              await copyFile(selected, dest);
                              const imageData = await readFile(dest);
                              const mimeMap: Record<string, string> = {
                                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                                gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
                                svg: 'image/svg+xml', avif: 'image/avif', tiff: 'image/tiff', heic: 'image/heic',
                              };
                              const mime = mimeMap[cleanExt.toLowerCase()] || 'application/octet-stream';
                              const uint8 = new Uint8Array(imageData);
                              const chunks: string[] = [];
                              const chunkSize = 8192;
                              for (let i = 0; i < uint8.length; i += chunkSize) {
                                chunks.push(String.fromCharCode(...uint8.subarray(i, i + chunkSize)));
                              }
                              const base64 = btoa(chunks.join(''));
                              const dataUrl = `data:${mime};base64,${base64}`;
                              updateSettings({ backgroundImagePath: dest, backgroundImage: dataUrl });
                            } catch (e) {
                              console.error('Error al procesar imagen de fondo:', e);
                              addNotification('Error al procesar la imagen', 'error');
                            }
                          }
                        } catch (e) {
                          addNotification('Error al seleccionar la imagen', 'error');
                          console.error(e);
                        }
                      } else {
                        bgInputRef.current?.click();
                      }
                    }} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                      <Image size={16} /> {settings.backgroundImage ? 'Cambiar Imagen de Fondo' : 'Cargar Imagen de Fondo'}
                    </button>

                    {settings.backgroundImage && (
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 400 }}>Ajuste de Imagen</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[
                            { id: 'cover' as const, label: 'Cubrir' },
                            { id: 'contain' as const, label: 'Contener' },
                            { id: 'fill' as const, label: 'Llenar' },
                            { id: 'tile' as const, label: 'Mosaico' },
                          ].map(opt => {
                            const isActive = (settings.backgroundSize || 'cover') === opt.id;
                            return (
                              <button key={opt.id} onClick={() => updateSettings({ backgroundSize: opt.id })}
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`, background: isActive ? 'var(--accent-soft)' : 'var(--bg-deep)', color: isActive ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms' }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Opacidad de Paneles</span>
                        <span>{Math.round((settings.uiOpacity ?? 0.85) * 100)}%</span>
                      </label>
                      <input type="range" min="0.1" max="1" step="0.05"
                        value={settings.uiOpacity ?? 0.85}
                        onChange={(e) => updateSettings({ uiOpacity: parseFloat(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Brillo del Fondo</span>
                        <span>{settings.backgroundBrightness ?? 100}%</span>
                      </label>
                      <input type="range" min="30" max="200" step="5"
                        value={settings.backgroundBrightness ?? 100}
                        onChange={e => updateSettings({ backgroundBrightness: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Desenfoque de Paneles</span>
                        <span>{settings.backgroundBlur ?? 0}px</span>
                      </label>
                      <input type="range" min="0" max="30" step="1"
                        value={settings.backgroundBlur ?? 0}
                        onChange={e => updateSettings({ backgroundBlur: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Oscurecer Fondo</span>
                        <span>{settings.backgroundOverlay ?? 0}%</span>
                      </label>
                      <input type="range" min="0" max="80" step="5"
                        value={settings.backgroundOverlay ?? 0}
                        onChange={e => updateSettings({ backgroundOverlay: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                  </div>
                </div>

                {/* Vista de Portada Grande */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Vista de Portada Grande
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 12, lineHeight: 1.4 }}>
                    Fondo de la pantalla completa al hacer clic en una portada
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'auto' as const, label: 'Desde portada', desc: 'Color extraído' },
                      { id: 'black' as const, label: 'Negro', desc: 'Fondo oscuro neutro' },
                      { id: 'gray' as const, label: 'Gris', desc: 'Gris medio neutro' },
                      { id: 'theme' as const, label: 'Del tema', desc: 'Según acento/ fondo' },
                    ].map(opt => {
                      const active = (settings.coverBgMode ?? 'auto') === opt.id;
                      return (
                        <button key={opt.id} onClick={() => updateSettings({ coverBgMode: opt.id })} style={{
                          flex: 1, padding: '12px 8px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                          transition: 'all 200ms',
                        }}>
                          <span>{opt.label}</span>
                          <span style={{ fontSize: 9, fontWeight: 300, opacity: 0.65 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Barra de Reproducción Personalizable */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Barra de Reproducción
                  </span>

                  <Toggle
                    checked={settings.playerBarEnabled ?? false}
                    onChange={v => updateSettings({ playerBarEnabled: v })}
                    label="Diseño Personalizado de Barra"
                    desc="Personaje, colores, bordes, fondos y más"
                  />

                  {settings.playerBarEnabled && (
                    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 28 }}>
                      {/* ===== SECCION 1: PERSONAJE ===== */}
                      <div style={{ padding: '18px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            Personaje
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                            — el que viaja sobre la barra
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* GIF URL */}
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4, letterSpacing: '0.03em' }}>
                              URL del GIF
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
                              <input type="text" value={settings.playerBarCharacterUrl || ''}
                                onChange={e => updateSettings({ playerBarCharacterUrl: e.target.value })}
                                placeholder="https://ejemplo.com/mi-personaje.gif"
                                style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-default)', height: 36 }}>
                                {settings.playerBarCharacterUrl ? (
                                  <img src={settings.playerBarCharacterUrl} alt=""
                                    style={{ maxWidth: 32, maxHeight: 32, objectFit: 'contain', borderRadius: 4 }} />
                                ) : (
                                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Vacio</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Draw frames */}
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4, letterSpacing: '0.03em' }}>
                              Dibujo animado — {((settings.playerBarCharacterDraw || '').split('|').filter(Boolean).length) || 0} frame(s)
                            </label>
                            <button onClick={() => setShowDrawModal(true)}
                              style={{
                                width: '100%', padding: '10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                background: 'var(--accent)', border: 'none', color: '#fff',
                              }}>
                              {((settings.playerBarCharacterDraw || '').split('|').filter(Boolean).length) > 0 ? 'Editar dibujo' : 'Dibujar personaje'}
                            </button>
                          </div>
                        </div>

                        {/* Source selector */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                          {(['url', 'draw'] as const).map(src => (
                            <button key={src} onClick={() => updateSettings({ playerBarCharacterSource: src })}
                              style={{
                                flex: 1, padding: '8px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                                background: (settings.playerBarCharacterSource || 'url') === src ? 'var(--accent)' : 'var(--bg-deep)',
                                border: '1px solid var(--border-default)',
                                color: (settings.playerBarCharacterSource || 'url') === src ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 150ms',
                              }}>
                              Usar: {src === 'url' ? 'GIF' : 'Dibujo'}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                          <SliderRow label="Tamano" value={settings.playerBarCharacterSize ?? 40} min={16} max={120} step={2} unit="px"
                            onChange={v => updateSettings({ playerBarCharacterSize: v })} accent="var(--accent)" />
                          <SliderRow label="Sombra" value={settings.playerBarCharacterShadow ?? 6} min={0} max={30} step={1} unit="px"
                            onChange={v => updateSettings({ playerBarCharacterShadow: v })} accent="var(--accent)" />
                          <SliderRow label="Offset Vertical" value={settings.playerBarCharacterOffsetY ?? 0} min={-30} max={30} step={2} unit="px"
                            onChange={v => updateSettings({ playerBarCharacterOffsetY: v })} accent="var(--accent)" />
                        </div>
                      </div>

                      {/* ===== SECCION 2: BARRA (TRACK FILL) — Solo GIF ===== */}
                      <div style={{ padding: '18px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            Barra
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                            — GIF que se revela con el progreso
                          </span>
                        </div>

                        <div>
                          <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4, letterSpacing: '0.03em' }}>
                            URL del GIF
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
                            <input type="text" value={settings.playerBarTrackUrl || ''}
                              onChange={e => updateSettings({ playerBarTrackUrl: e.target.value })}
                              placeholder="https://ejemplo.com/mi-barra.gif"
                              style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 12, fontFamily: 'monospace', outline: 'none' }} />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-default)', height: 36 }}>
                              {settings.playerBarTrackUrl ? (
                                <img src={settings.playerBarTrackUrl} alt=""
                                  style={{ maxWidth: 32, maxHeight: 32, objectFit: 'contain', borderRadius: 4 }} />
                              ) : (
                                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Vacio</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ===== SECCION 3: ESTADO ===== */}
                      <div style={{ padding: '18px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            Estado
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                            — qué se muestra en cada parte
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                            Personaje: {settings.playerBarCharacterSource === 'url' ? 'Modo GIF' : 'Modo Dibujo'}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                            Barra: {settings.playerBarTrackSource === 'url' ? 'Modo GIF' : 'Modo Dibujo'}
                          </div>
                        </div>
                      </div>

                      {/* ===== SECCION 3: VISTA PREVIA ===== */}
                      <div style={{ padding: '20px', borderRadius: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                          <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)' }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            Vista Previa
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                            — se actualiza al instante
                          </span>
                        </div>

                        <div style={{ position: 'relative', height: 64, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                            <div style={{
                              flex: 1, height: 3, borderRadius: 2,
                              background: 'rgba(255,255,255,0.06)',
                              position: 'relative', overflow: 'visible',
                            }}>
                              <div style={{
                                width: '45%', height: '100%',
                                borderRadius: 2,
                                backgroundColor: settings.playerBarTrackColor || 'var(--accent)',
                                backgroundImage: (() => {
                                  const src = settings.playerBarTrackSource || 'url';
                                  if (src === 'url') return settings.playerBarTrackUrl ? `url(${settings.playerBarTrackUrl})` : undefined;
                                  const frames = (settings.playerBarTrackDraw || '').split('|').filter(Boolean);
                                  return frames.length > 0 ? `url(${frames[0]})` : undefined;
                                })(),
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                              }} />
                            </div>

                            <PreviewCharacter
                              source={settings.playerBarCharacterSource || 'url'}
                              drawData={settings.playerBarCharacterDraw || ''}
                              gifUrl={settings.playerBarCharacterUrl || ''}
                              size={settings.playerBarCharacterSize ?? 40}
                              offsetY={settings.playerBarCharacterOffsetY ?? 0}
                              shadow={settings.playerBarCharacterShadow ?? 6}
                              speeds={settings.playerBarFrameSpeeds || ''}
                            />
                        </div>

                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px dashed var(--border-default)' }}>
                          <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Limites visuales</div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                            <span>Personaje: {settings.playerBarCharacterSize ?? 40}x{settings.playerBarCharacterSize ?? 40}px</span>
                            <span>Sombra: {settings.playerBarCharacterShadow ?? 6}px</span>
                            <span>Offset Y: {settings.playerBarCharacterOffsetY ?? 0}px</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Drawing Modal for Character */}
                  {showDrawModal && (
                    <CharacterDrawModal
                      currentDraw={settings.playerBarCharacterDraw || ''}
                      currentSpeeds={settings.playerBarFrameSpeeds || ''}
                      characterSize={settings.playerBarCharacterSize ?? 40}
                      onSave={(dataUrl, speedsStr) => {
                        updateSettings({ playerBarCharacterDraw: dataUrl, playerBarFrameSpeeds: speedsStr });
                        setShowDrawModal(false);
                      }}
                      onClose={() => setShowDrawModal(false)}
                    />
                  )}

                </div>
              </section>
            )}

            {/* â•â•â•â•â•â•â•â•â•â•â• ESTUDIO â•â•â•â•â•â•â•â•â•â•â• */}
            {activeTab === 'estudio' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Tiempos y Metas de Estudio</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Configura los intervalos de tu método Pomodoro y objetivos</p>
                </div>

                <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <RangeSlider label="Enfoque" value={settings.pomodoroTime / 60} min={10} max={120} unit="min" onChange={v => updateSettings({ pomodoroTime: v * 60 })} color="#E11D48" />
                    <RangeSlider label="Cronómetro (meta por ronda)" value={(settings.chronoGoal || 1500) / 60} min={25} max={180} unit="min" onChange={v => updateSettings({ chronoGoal: v * 60 })} color="#3B82F6" />
                    <RangeSlider label="Meta Diaria" value={settings.dailyGoal} min={30} max={600} unit="min" onChange={v => updateSettings({ dailyGoal: v })} color="#8B5CF6" />
                  </div>

                  {/* Break section with visual cycle indicator */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ciclo de Descansos</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        {Array.from({ length: settings.pomodoroGoal || 4 }, (_, i) => (
                          <div key={i} style={{
                            width: 16, height: 16, borderRadius: 4,
                            background: i === (settings.pomodoroGoal || 4) - 1 ? '#F59E0B' : '#10B981',
                            opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: i === (settings.pomodoroGoal || 4) - 1 ? '0 0 6px #F59E0B60' : 'none',
                          }}>
                            <span style={{ fontSize: 7, fontWeight: 700, color: '#fff' }}>{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 4px #10B98180' }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>CORTOS</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>
                            {settings.shortBreakTime / 60}<span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>min</span>
                          </span>
                          <input type="range" min={1} max={30} value={settings.shortBreakTime / 60} onChange={e => updateSettings({ shortBreakTime: Number(e.target.value) * 60 })}
                            style={{ flex: 1, height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: `linear-gradient(90deg, #10B98160, #10B981 ${((settings.shortBreakTime / 60 - 1) / 29) * 100}%, var(--bg-hover) ${((settings.shortBreakTime / 60 - 1) / 29) * 100}%)` }}
                            className="range-slider" />
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 4 }}>×{settings.pomodoroGoal - 1 || 3} entre ciclos</div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: 'radial-gradient(circle, #F59E0B08 0%, transparent 70%)', pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 4px #F59E0B80' }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>LARGO</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>
                            {settings.longBreakTime / 60}<span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>min</span>
                          </span>
                          <input type="range" min={5} max={60} value={settings.longBreakTime / 60} onChange={e => updateSettings({ longBreakTime: Number(e.target.value) * 60 })}
                            style={{ flex: 1, height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: `linear-gradient(90deg, #F59E0B60, #F59E0B ${((settings.longBreakTime / 60 - 5) / 55) * 100}%, var(--bg-hover) ${((settings.longBreakTime / 60 - 5) / 55) * 100}%)` }}
                            className="range-slider" />
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 4 }}>Cada {settings.pomodoroGoal} ciclos</div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#6366F1', boxShadow: '0 0 4px #6366F180' }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>CICLOS</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>
                            {settings.pomodoroGoal}<span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>×</span>
                          </span>
                          <input type="range" min={1} max={20} value={settings.pomodoroGoal} onChange={e => updateSettings({ pomodoroGoal: Number(e.target.value) })}
                            style={{ flex: 1, height: 3, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', outline: 'none', borderRadius: 2, background: `linear-gradient(90deg, #6366F160, #6366F1 ${((settings.pomodoroGoal - 1) / 19) * 100}%, var(--bg-hover) ${((settings.pomodoroGoal - 1) / 19) * 100}%)` }}
                            className="range-slider" />
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          {settings.pomodoroGoal > 1
                            ? `${settings.pomodoroGoal - 1} cortos + 1 largo`
                            : 'Solo descanso largo'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timer Colors */}
                <div className="bento-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Formato de Hora</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['24h', '12h'] as const).map(f => (
                      <button key={f} onClick={() => updateSettings({ timeFormat: f })}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, border: `1px solid ${(settings.timeFormat || '24h') === f ? 'var(--accent)' : 'var(--border-soft)'}`, background: (settings.timeFormat || '24h') === f ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-deep)', color: (settings.timeFormat || '24h') === f ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 200ms' }}>
                        {f === '24h' ? '24 horas (00:00 – 23:59)' : '12 horas (AM / PM)'}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Afecta a todo el planificador, horario, eventos, cabeceras y tiempos en toda la app.</p>
                </div>

                {/* Timer Colors */}
                <div className="bento-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Colores de Temporizadores</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { key: 'timerFocusColor', label: 'Enfoque', def: '#E11D48' },
                      { key: 'timerBreakColor', label: 'Descanso', def: '#10B981' },
                      { key: 'timerLongBreakColor', label: 'Desc. Largo', def: '#F59E0B' },
                      { key: 'timerChronoColor', label: 'Cronómetro', def: '#3B82F6' },
                    ].map(c => {
                      const val = (settings as any)[c.key] || c.def;
                      return (
                        <label key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}>
                          <div style={{ height: 44, borderRadius: 10, background: val, position: 'relative', overflow: 'hidden', border: '1px solid var(--border-soft)', transition: 'all 200ms', boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06)` }}>
                            <input type="color" value={val} onChange={e => updateSettings({ [c.key]: e.target.value })}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                            <div style={{ position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 6, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Floating Timer Customization */}
                <div className="bento-card" style={{
                  padding: 0, overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    padding: '24px 24px 16px',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20,
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Timer Flotante</span>
                      <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", margin: '4px 0 2px' }}>Ventana independiente</h3>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 300, margin: 0 }}>Aparece al iniciar un enfoque desde el panel de estudio</p>
                    </div>
                    <div style={{
                      width: 80, height: 44, borderRadius: 8,
                      background: settings.floatingBgMode === 'app' ? '#0a0a0c' : (settings.floatingBgColor || '#020203'),
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0,
                      fontFamily: "'Inter Tight', sans-serif", color: '#E11D48',
                    }}>
                      <span style={{ fontSize: 6, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>ENFOQUE</span>
                      <span style={{
                        fontSize: 13, fontWeight: 300, lineHeight: 1, letterSpacing: '0.04em',
                        fontFamily: ({ led: "'Share Tech Mono', monospace", outfit: "'Outfit', sans-serif", 'dm-sans': "'DM Sans', sans-serif", playfair: "'Playfair Display', serif", space: "'Space Grotesk', sans-serif", jakarta: "'Plus Jakarta Sans', sans-serif", sora: "'Sora', sans-serif", inter: "'Inter', sans-serif" } as Record<string,string>)[settings.floatingFont] || "'Share Tech Mono', monospace",
                      }}>25:00</span>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 24px' }} />

                  <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Background mode */}
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Fondo</span>
                      <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>Color de la app o personalizado</span>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {[
                          { value: 'app', label: 'App' },
                          { value: 'custom', label: 'Personalizado' },
                        ].map(o => (
                          <button key={o.value} onClick={() => updateSettings({ floatingBgMode: o.value as any })}
                            style={{
                              padding: '7px 16px', borderRadius: 8, fontSize: 10, fontWeight: 500,
                              border: (settings.floatingBgMode || 'custom') === o.value ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                              background: (settings.floatingBgMode || 'custom') === o.value ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-deep)',
                              color: (settings.floatingBgMode || 'custom') === o.value ? 'var(--accent)' : 'var(--text-secondary)',
                              cursor: 'pointer', transition: 'all 150ms',
                            }}>{o.label}</button>
                        ))}
                      </div>
                      {settings.floatingBgMode === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Color</span>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{settings.floatingBgColor || '#020203'}</span>
                          <label style={{ position: 'relative', width: 28, height: 28, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                            <div style={{ position: 'absolute', inset: 0, background: settings.floatingBgColor || '#020203' }} />
                            <input type="color" value={settings.floatingBgColor || '#020203'} onChange={e => updateSettings({ floatingBgColor: e.target.value })}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Typography grid */}
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Tipografía</span>
                      <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>Elige el estilo del reloj</span>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8,
                      }}>
                        {[
                          { value: 'led', label: 'LED', preview: '88:88', font: "'Share Tech Mono', monospace" },
                          { value: 'outfit', label: 'Outfit', preview: '88:88', font: "'Outfit', sans-serif" },
                          { value: 'dm-sans', label: 'DM Sans', preview: '88:88', font: "'DM Sans', sans-serif" },
                          { value: 'playfair', label: 'Playfair', preview: '88:88', font: "'Playfair Display', serif" },
                          { value: 'space', label: 'Space G.', preview: '88:88', font: "'Space Grotesk', sans-serif" },
                          { value: 'jakarta', label: 'Jakarta', preview: '88:88', font: "'Plus Jakarta Sans', sans-serif" },
                          { value: 'sora', label: 'Sora', preview: '88:88', font: "'Sora', sans-serif" },
                          { value: 'inter', label: 'Inter', preview: '88:88', font: "'Inter', sans-serif" },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => updateSettings({ floatingFont: opt.value })}
                            style={{
                              padding: '10px 6px', borderRadius: 8, fontSize: 10,
                              border: settings.floatingFont === opt.value ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                              background: settings.floatingFont === opt.value ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-deep)',
                              color: settings.floatingFont === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                              cursor: 'pointer', transition: 'all 150ms',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            }}>
                            <span style={{ fontFamily: opt.font, fontSize: 16, fontWeight: 400, lineHeight: 1, color: 'currentColor' }}>{opt.preview}</span>
                            <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.7, letterSpacing: '0.02em' }}>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hide time + animation */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Ocultar tiempo en enfoque</span>
                          <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)' }}>Al activarse, el reloj se reemplaza por una animación</span>
                        </div>
                        <button onClick={() => {
                          if (!settings.floatingHideInFocus) {
                            updateSettings({ floatingHideInFocus: true, floatingAnimationType: settings.floatingAnimationType || 'plant' });
                          } else {
                            updateSettings({ floatingHideInFocus: false });
                          }
                        }}
                          style={{
                            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                            background: settings.floatingHideInFocus ? 'var(--accent)' : 'var(--bg-deep)',
                            transition: 'background 200ms', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
                          }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 3, transition: 'left 200ms',
                            left: settings.floatingHideInFocus ? 21 : 3,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }} />
                        </button>
                      </div>
                      {settings.floatingHideInFocus && (
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                            Tipo de animación
                            <span style={{ fontSize: 8, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>Solo visible en Pomodoro</span>
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {[
                              { value: 'plant', label: 'Planta', desc: 'Crece lentamente' },
                              { value: 'books', label: 'Libros', desc: 'Se apilan solos' },
                              { value: 'stars', label: 'Estrellas', desc: 'Brillan suavemente' },
                              { value: 'waves', label: 'Ondas', desc: 'Fluyen en calma' },
                              { value: 'leaves', label: 'Hojas', desc: 'Caen al viento' },
                              { value: 'breathing', label: 'Respiración', desc: 'Círculo que inspira' },
                            ].map(a => (
                              <button key={a.value} onClick={() => updateSettings({ floatingAnimationType: a.value })}
                                style={{
                                  padding: '10px 6px', borderRadius: 8, fontSize: 10,
                                  border: (settings.floatingAnimationType || 'plant') === a.value ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                                  background: (settings.floatingAnimationType || 'plant') === a.value ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-deep)',
                                  color: (settings.floatingAnimationType || 'plant') === a.value ? 'var(--accent)' : 'var(--text-secondary)',
                                  cursor: 'pointer', transition: 'all 150ms',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                }}>
                                <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>
                                  {a.value === 'plant' ? '🌱' : a.value === 'books' ? '📚' : a.value === 'stars' ? '✨' : a.value === 'waves' ? '〰️' : a.value === 'leaves' ? '🍃' : '○'}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 600 }}>{a.label}</span>
                                <span style={{ fontSize: 7, fontWeight: 400, opacity: 0.6 }}>{a.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* MÚSICA */}
            {activeTab === 'musica' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Configuración de Música</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Preferencias de audio, descargas y reproducción</p>
                </div>

                {/* Audio Format */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Formato de Descarga
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'mp3' as const, label: 'MP3', desc: 'Compatibilidad universal' },
                      { id: 'm4a' as const, label: 'M4A', desc: 'Mejor calidad por tamaño' },
                    ].map(opt => {
                      const active = (settings.downloadFormat || 'mp3') === opt.id;
                      return (
                        <button key={opt.id} onClick={() => updateSettings({ downloadFormat: opt.id })} style={{
                          flex: 1, padding: '12px 8px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 200ms',
                        }}>
                          <span>{opt.label}</span>
                          <span style={{ fontSize: 9, fontWeight: 300, opacity: 0.65 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audio Quality */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Calidad de Audio
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: '3', label: 'Normal', desc: '128-192 kbps' },
                      { id: '2', label: 'Alta', desc: '192-256 kbps' },
                      { id: '1', label: 'Extrema', desc: '256-320 kbps' },
                    ].map(opt => {
                      const active = (settings.audioQuality || '3') === opt.id;
                      return (
                        <button key={opt.id} onClick={() => updateSettings({ audioQuality: opt.id })} style={{
                          flex: 1, padding: '12px 8px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 200ms',
                        }}>
                          <span>{opt.label}</span>
                          <span style={{ fontSize: 9, fontWeight: 300, opacity: 0.65 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cover Art */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Portada de Descarga
                  </span>
                  <Toggle checked={settings.includeCover !== false} onChange={v => updateSettings({ includeCover: v })}
                    label="Incluir portada" desc="Incrustar la imagen de portada en el archivo de audio descargado." />
                </div>

                {/* Playback retries */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Reproducción
                  </span>
                  <Toggle checked={settings.autoRetryOnError !== false} onChange={v => updateSettings({ autoRetryOnError: v })}
                    label="Reintentar al fallar" desc="Reintentar automáticamente la reproducción hasta 3 veces si ocurre un error de audio." />
                </div>

                {/* Download path info */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Carpeta de Descargas
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                    Las canciones descargadas se guardan en la carpeta configurada del sistema. 
                    Puedes cambiarla desde la sección de música.
                  </div>
                </div>

                {/* Import / Export metadata */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Importar / Exportar Metadatos
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 14 }}>
                    Exporta los metadatos y portadas de todas tus canciones a un archivo JSON.
                    Al importar, se actualizan las canciones existentes usando su ID \u00fanico.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={async () => {
                      try {
                        const dest = await save({
                          filters: [{ name: 'JSON', extensions: ['json'] }],
                          defaultPath: 'owa_music_metadata.json',
                          title: 'Exportar metadatos de música',
                        });
                        if (!dest) return;
                        const metadata = tracks.map((t: any) => ({
                          id: t.id, title: t.title, artist: t.artist,
                          coverImage: t.coverImage,
                          duration: t.duration, source: t.source,
                          isFavorite: t.isFavorite,
                        }));
                        await writeFile(dest, new TextEncoder().encode(
                          JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tracks: metadata }, null, 2)
                        ));
                        addNotification(`Metadatos exportados: ${metadata.length} canciones`, 'success');
                      } catch (e) {
                        addNotification('Error al exportar metadatos', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <Upload size={14} /> Exportar metadatos
                    </button>
                    <button onClick={async () => {
                      try {
                        const src = await open({
                          filters: [{ name: 'JSON', extensions: ['json'] }],
                          title: 'Importar metadatos de música',
                          multiple: false,
                        });
                        if (!src) return;
                        const content = await readTextFile(src as string);
                        const data = JSON.parse(content);
                        const imported = data.tracks || [];
                        let updated = 0;
                        for (const meta of imported) {
                          const existing = tracks.find((t: any) => t.id === meta.id);
                          if (existing) {
                            updateTrack(meta.id, {
                              title: meta.title,
                              artist: meta.artist,
                              coverImage: meta.coverImage,
                              isFavorite: meta.isFavorite,
                            });
                            updated++;
                          }
                        }
                        addNotification(`Metadatos importados: ${updated} canciones actualizadas de ${imported.length}`, 'success');
                      } catch (e) {
                        addNotification('Error al importar metadatos', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10B981' }}>
                      <Download size={14} /> Importar metadatos
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'notificaciones' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Sonidos y Alertas de Sistema</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Controla el comportamiento acústico y notificaciones del entorno de estudio</p>
                </div>

                {/* General Toggles */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Configuración General</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Toggle checked={settings.notifications} onChange={v => updateSettings({ notifications: v })}
                      label="Notificaciones Visuales del Temporizador" desc="Mostrar notificación nativa al finalizar ciclos de estudio o descansos programados." />
                    <Toggle checked={settings.soundEffects} onChange={v => updateSettings({ soundEffects: v })}
                      label="Sonidos de Interfaz" desc="Reproducir retroalimentación acústica al interactuar con botones, pestañas, modales y arrastrar elementos." />
                  </div>
                </div>

                {/* Event-specific settings */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Eventos de Temporizador</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { id: 'pomodoro', label: 'Fin de Pomodoro', desc: 'Al completar un ciclo de concentración', color: '#E11D48' },
                      { id: 'break', label: 'Fin de Descanso', desc: 'Al terminar un período de descanso', color: '#10B981' },
                      { id: 'task', label: 'Tareas por Vencer', desc: 'Recordatorio de tareas próximas a vencer', color: '#F59E0B' },
                    ].map(ev => {
                      const key = `event_${ev.id}` as keyof typeof settings;
                      const enabled = settings[key] !== false;
                      return (
                        <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0, boxShadow: `0 0 6px ${ev.color}50` }} />
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.label}</span>
                              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>{ev.desc}</span>
                            </div>
                          </div>
                          <label style={{ position: 'relative', width: 36, height: 20, borderRadius: 10, background: enabled ? ev.color : 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 2, transition: 'all 200ms' }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(16px)' : 'translateX(0)', transition: 'all 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            <input type="checkbox" checked={enabled} onChange={e => updateSettings({ [key]: e.target.checked } as any)} style={{ display: 'none' }} />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Test notification */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => { import('../../lib/notifications').then(m => m.sendNativeNotification('🔔 OWA Studio', 'Notificaciones funcionando correctamente')); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff', transition: 'all 200ms' }}>
                    <Bell size={14} /> Probar Notificación
                  </button>
                  <button onClick={() => { addNotification('✅ Notificación de prueba enviada', 'success'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', transition: 'all 200ms' }}>
                    <Bell size={14} /> Probar Toast
                  </button>
                </div>
              </section>
            )}

            {/* SISTEMA */}
            {activeTab === 'sistema' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Diagnóstico del Sistema</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Información del entorno y rendimiento de OWA Studio</p>
                </div>

                {/* Platform Info */}
                <div className="bento-card" style={{ padding: '20px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={14} style={{ color: 'var(--accent)' }} /> Plataforma
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Sistema operativo', value: sysInfo?.platform || navigator.platform || 'Desconocido' },
                      { label: 'Arquitectura', value: sysInfo?.arch || navigator.platform.includes('64') ? 'x64' : 'x86' },
                      { label: 'Entorno', value: isTauri() ? 'Tauri (nativo)' : 'Navegador web' },
                      { label: 'Versión de la app', value: sysInfo?.appVer || '1.0.0' },
                      { label: 'User Agent', value: navigator.userAgent.slice(0, 80) + '…' },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{r.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace" }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hardware Stats */}
                {sysInfo && (
                  <div className="bento-card" style={{ padding: '20px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={14} style={{ color: 'var(--accent)' }} /> Rendimiento
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'CPU', val: sysInfo.cpu, unit: '%', color: '#3B82F6' },
                        { label: 'RAM', val: sysInfo.ram, unit: '%', color: '#F59E0B' },
                        { label: 'DISCO', val: sysInfo.disk, unit: '%', color: '#8B5CF6' },
                      ].map(m => (
                        <div key={m.label} style={{ background: 'var(--bg-deep)', borderRadius: 8, padding: '12px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{m.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: "'Share Tech Mono', monospace" }}>{m.val}{m.unit}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-base)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: m.color, width: `${Math.min(m.val, 100)}%`, boxShadow: `0 0 6px ${m.color}40` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cache & Storage */}
                <div className="bento-card" style={{ padding: '20px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={14} style={{ color: 'var(--accent)' }} /> Almacenamiento Local
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(() => {
                      let totalSize = 0;
                      const keys = Object.keys(localStorage);
                      const items: { key: string; size: number }[] = [];
                      for (const k of keys) {
                        const sz = new Blob([localStorage.getItem(k) || '']).size;
                        totalSize += sz;
                        items.push({ key: k, size: sz });
                      }
                      const fmt = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`;
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Total localStorage</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace" }}>{fmt(totalSize)} ({keys.length} entradas)</span>
                          </div>
                          {items.sort((a, b) => b.size - a.size).slice(0, 6).map(it => (
                            <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.key}</span>
                              <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>{fmt(it.size)}</span>
                            </div>
                          ))}
                          {items.length > 6 && (
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>… y {items.length - 6} entradas más</span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Cache clearing */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      Los datos cacheados (imágenes de horario, ajustes temporales) se pueden regenerar. 
                      Esto <strong>no</strong> elimina carátulas, canciones, archivos ni descargas.
                    </div>
                    <button onClick={() => {
                      if (!confirm('¿Limpiar caché temporal? Las imágenes de horario y datos regenerables se eliminarán. Los archivos descargados no se verán afectados.')) return;
                      del('owa_sched_images_v3').then(() => {
                        addNotification('Caché temporal limpiado correctamente', 'success');
                      }).catch(() => {
                        addNotification('No se pudo limpiar la caché de imágenes', 'error');
                      });
                      localStorage.removeItem('owa_sched_active_image_idx');
                      localStorage.removeItem('owa_sched_images_v3');
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}>
                      <RefreshCw size={14} /> Limpiar caché temporal
                    </button>
                  </div>
                </div>

                {/* Music Backup */}
                <div className="bento-card" style={{ padding: '20px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Music size={14} style={{ color: 'var(--accent)' }} /> Respaldo de Música
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 14 }}>
                    Exporta toda tu biblioteca de música (metadatos + archivos de audio) a una carpeta.
                    Luego puedes importarla desde esa misma carpeta para restaurarla.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={async () => {
                      try {
                        const selected = await open({ directory: true, title: 'Seleccionar carpeta para exportar música' });
                        if (!selected) return;
                        const count = await exportMusicLibrary(selected);
                        addNotification(`Biblioteca exportada: ${count} archivos copiados`, 'success');
                      } catch (e) {
                        addNotification('Error al exportar música', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <Upload size={14} /> Exportar biblioteca
                    </button>
                    <button onClick={async () => {
                      try {
                        const selected = await open({ directory: true, title: 'Seleccionar carpeta para importar música' });
                        if (!selected) return;
                        const count = await importMusicLibrary(selected);
                        addNotification(`Biblioteca importada: ${count} canciones restauradas`, 'success');
                      } catch (e) {
                        addNotification('Error al importar música', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10B981' }}>
                      <Download size={14} /> Importar biblioteca
                    </button>
                  </div>
                </div>

              </section>
            )}

          </div>
        </main>
      </div>

      {/* Google Connect Modal */}
      {showGoogleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowGoogleModal(false)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 420, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Conectar con Google
              </h2>
              <button onClick={() => setShowGoogleModal(false)} style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {googleProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  {googleProfile.photoUrl ? (
                    <img src={googleProfile.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{googleProfile.givenName?.[0]}</div>
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{googleProfile.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{googleProfile.email}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', marginLeft: 'auto', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
                </div>
                <button onClick={handleGoogleSignOut} style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                  Desconectar Google
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Conecta tu cuenta de Google para usar tu identidad en OWA Studio.
                </p>
                <button onClick={handleGoogleSignIn} style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#4285F4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/></svg>
                  Iniciar sesión con Google
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Clear All Music Confirmation */}
      {showClearAllMusic && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowClearAllMusic(false); setClearAllMusicText(''); }}>
          <div className="bento-card" style={{ padding: 28, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Eliminar toda la biblioteca de música</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Se eliminarán todas las canciones, playlists y descargas. Esta acción no se puede deshacer.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Escribe <strong style={{ color: 'var(--error)' }}>DeseoBorrarTodo</strong> para confirmar:
            </p>
            <input type="text" value={clearAllMusicText} onChange={e => setClearAllMusicText(e.target.value)}
              placeholder="DeseoBorrarTodo"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowClearAllMusic(false); setClearAllMusicText(''); }} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => {
                if (clearAllMusicText.trim() !== 'DeseoBorrarTodo') return;
                clearAllMusicData();
                setShowClearAllMusic(false);
                setClearAllMusicText('');
                addNotification('Biblioteca de música eliminada por completo', 'success');
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12, background: clearAllMusicText.trim() === 'DeseoBorrarTodo' ? 'var(--error)' : 'var(--bg-deep)', borderColor: clearAllMusicText.trim() === 'DeseoBorrarTodo' ? 'var(--error)' : 'var(--border-default)', opacity: clearAllMusicText.trim() === 'DeseoBorrarTodo' ? 1 : 0.4, cursor: clearAllMusicText.trim() === 'DeseoBorrarTodo' ? 'pointer' : 'not-allowed' }}>
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewCharacter({ source, drawData, gifUrl, size, offsetY, shadow, speeds: speedsStr }: {
  source: string; drawData: string; gifUrl: string;
  size: number; offsetY: number; shadow: number; speeds: string;
}) {
  const frames = useMemo(() => drawData.split('|').filter(Boolean), [drawData]);
  const speedsArr = useMemo(() => speedsStr.split('|').map(Number).filter(n => n > 0), [speedsStr]);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (source !== 'draw' || frames.length <= 1) return;
    const delay = speedsArr[frameIdx] || 1000;
    const timer = setTimeout(() => {
      setFrameIdx((frameIdx + 1) % frames.length);
    }, delay);
    return () => clearTimeout(timer);
  }, [source, frames, speedsArr, frameIdx]);

  // Reset index when data changes
  useEffect(() => { setFrameIdx(0); }, [drawData, gifUrl, source]);

  if (source === 'draw' && frames.length > 0 && frames[0]) {
    return (
      <div style={{
        position: 'absolute', left: '45%', bottom: '50%', zIndex: 5,
        pointerEvents: 'none',
        transform: `translate(-50%, ${offsetY}px)`,
      }}>
        <div style={{
          width: size, height: size, borderRadius: 8, overflow: 'hidden',
          boxShadow: shadow > 0 ? `0 ${shadow * 0.3}px ${shadow}px rgba(0,0,0,0.35)` : 'none',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <img src={frames[frameIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </div>
      </div>
    );
  }

  if (source === 'url' && gifUrl) {
    return (
      <div style={{
        position: 'absolute', left: '45%', bottom: '50%', zIndex: 5,
        pointerEvents: 'none',
        transform: `translate(-50%, ${offsetY}px)`,
      }}>
        <div style={{
          width: size, height: size, borderRadius: 8, overflow: 'hidden',
          boxShadow: shadow > 0 ? `0 ${shadow * 0.3}px ${shadow}px rgba(0,0,0,0.35)` : 'none',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <img src={gifUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </div>
      </div>
    );
  }

  return null;
}

function CharacterDrawModal({ currentDraw, currentSpeeds, characterSize, onSave, onClose }: {
  currentDraw: string; currentSpeeds: string; characterSize: number;
  onSave: (dataUrl: string, speedsStr: string) => void; onClose: () => void;
}) {
  const [frames, setFrames] = useState<string[]>(() => currentDraw.split('|').filter(Boolean));
  const [speeds, setSpeeds] = useState<number[]>(() => {
    const parsed = currentSpeeds.split('|').map(Number).filter(n => n > 0);
    const frameCount = currentDraw.split('|').filter(Boolean).length || 1;
    while (parsed.length < frameCount) parsed.push(1000);
    return parsed.slice(0, frameCount);
  });
  const [activeFrame, setActiveFrame] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#E11D48');
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [progressiveReveal, setProgressiveReveal] = useState(0);

  const CANVAS_W = 300;
  const CANVAS_H = 300;

  const loadFrame = (frameData: string, ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (frameData) {
      const img = document.createElement('img');
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        setHasDrawn(true);
        drawGuide(ctx);
      };
      img.src = frameData;
    } else {
      setHasDrawn(false);
      drawGuide(ctx);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    loadFrame(frames[activeFrame] || '', ctx);
  }, [activeFrame]);

  useEffect(() => {
    if (!hasDrawn) return;
    let start: number | null = null;
    const duration = 400;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      setProgressiveReveal(Math.min(elapsed / duration, 1));
      if (elapsed < duration) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [hasDrawn, activeFrame]);

  const drawGuide = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H / 2);
    ctx.lineTo(CANVAS_W, CANVAS_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,50,50,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const limitTop = CANVAS_H / 2 - characterSize / 2 - 10;
    ctx.moveTo(0, limitTop);
    ctx.lineTo(CANVAS_W, limitTop);
    ctx.stroke();

    const limitBot = CANVAS_H / 2 + characterSize / 2 + 10;
    ctx.beginPath();
    ctx.moveTo(0, limitBot);
    ctx.lineTo(CANVAS_W, limitBot);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '9px sans-serif';
    ctx.fillText(`Limite superior (${characterSize}px)`, 8, limitTop - 4);
    ctx.fillText(`Centro del riel de progreso`, 8, CANVAS_H / 2 - 4);
    ctx.fillText(`Limite inferior`, 8, limitBot + 12);
    ctx.restore();
  };

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current) return;
    const pos = getPointerPos(e);
    ctxRef.current.strokeStyle = isEraser ? '#000' : drawColor;
    ctxRef.current.lineWidth = isEraser ? brushSize * 3 : brushSize;
    ctxRef.current.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctxRef.current.lineTo(pos.x, pos.y);
    ctxRef.current.stroke();
    ctxRef.current.globalCompositeOperation = 'source-over';
  };

  const stopDraw = () => {
    setIsDrawing(false);
    if (ctxRef.current) ctxRef.current.beginPath();
  };

  const clearFrame = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasDrawn(false);
    drawGuide(ctx);
  };

  const getCurrentFrameData = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const saveCurrentFrame = () => {
    const data = getCurrentFrameData();
    if (!data) return;
    const updated = [...frames];
    updated[activeFrame] = data;
    setFrames(updated);
    setHasDrawn(false);
  };

  const updateSpeed = (idx: number, val: number) => {
    const updated = [...speeds];
    updated[idx] = Math.max(100, Math.min(5000, val));
    setSpeeds(updated);
  };

  const addFrame = () => {
    saveCurrentFrame();
    setFrames([...frames, '']);
    setSpeeds([...speeds, 1000]);
    setActiveFrame(frames.length);
  };

  const removeFrame = (idx: number) => {
    if (frames.length <= 1) return;
    const updated = frames.filter((_, i) => i !== idx);
    setFrames(updated);
    setSpeeds(speeds.filter((_, i) => i !== idx));
    if (activeFrame >= updated.length) setActiveFrame(updated.length - 1);
  };

  const saveAll = () => {
    saveCurrentFrame();
    const validFrames = frames.filter(f => f);
    const validSpeeds = speeds.slice(0, validFrames.length);
    onSave(validFrames.join('|'), validSpeeds.join('|'));
  };

  const previewUrl = frames[activeFrame] || '';

  const frameCount = frames.filter(f => f).length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div style={{ width: 680, maxHeight: '90vh', overflowY: 'auto', padding: 28, borderRadius: 16, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Dibujar personaje</span>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            style={{
              width: 300, height: 300, borderRadius: 12, background: '#000',
              cursor: isEraser ? 'cell' : 'crosshair',
              border: '2px solid var(--border-default)',
              touchAction: 'none',
              opacity: progressiveReveal || 1,
              transition: 'opacity 0.3s',
            }} />
        </div>

        {/* Tools */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Color:</span>
            <input type="color" value={drawColor} onChange={e => { setDrawColor(e.target.value); setIsEraser(false); }}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', padding: 1, cursor: 'pointer' }} />
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Grosor:</span>
            <input type="range" min={2} max={20} step={1} value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))}
              style={{ width: 60, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 16 }}>{brushSize}</span>
          </div>

          <button onClick={() => setIsEraser(!isEraser)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
              background: isEraser ? 'var(--accent)' : 'var(--bg-deep)',
              border: '1px solid var(--border-default)',
              color: isEraser ? '#fff' : 'var(--text-secondary)',
            }}>
            {isEraser ? 'Borrando' : 'Dibujar'}
          </button>

          <button onClick={clearFrame}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
              background: 'var(--bg-deep)', border: '1px solid var(--border-default)',
              color: 'var(--text-muted)',
            }}>
            Limpiar
          </button>

          <button onClick={saveCurrentFrame}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
              background: hasDrawn ? 'var(--accent)' : 'var(--bg-deep)',
              border: '1px solid var(--border-default)',
              color: hasDrawn ? '#fff' : 'var(--text-muted)',
            }}>
            Guardar frame
          </button>
        </div>

        {/* Frames / Layers */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>Fotogramas (se rotan en bucle)</span>
            <button onClick={addFrame}
              style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: 'var(--accent)', border: 'none', color: '#fff',
              }}>
              + Agregar frame
            </button>
          </div>

          {frames.map((f, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: 8, borderRadius: 8,
              background: activeFrame === idx ? 'var(--bg-deep)' : 'transparent',
              border: activeFrame === idx ? '1px solid var(--border-default)' : '1px solid transparent',
            }}>
              {/* Thumbnail */}
              <div onClick={() => { saveCurrentFrame(); setActiveFrame(idx); }}
                style={{
                  width: 48, height: 48, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                  border: '1px solid var(--border-default)', background: '#000', flexShrink: 0,
                }}>
                {f ? (
                  <img src={f} alt={`Frame ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'var(--text-muted)' }}>Vacio</div>
                )}
              </div>

              {/* Frame number */}
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', minWidth: 20 }}>#{idx + 1}</span>

              {/* Speed slider */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 8, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Vel:</span>
                <input type="range" min={100} max={3000} step={100} value={speeds[idx] || 1000}
                  onChange={e => updateSpeed(idx, parseInt(e.target.value))}
                  style={{ flex: 1, height: 3, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span style={{ fontSize: 9, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right', fontFamily: 'monospace' }}>
                  {(speeds[idx] || 1000)}ms
                </span>
              </div>

              {/* Delete */}
              {frames.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); removeFrame(idx); }}
                  style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,50,50,0.2)', border: 'none', color: 'var(--error)', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  X
                </button>
              )}
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {frameCount > 1
              ? `Ciclo: ${speeds.slice(0, frameCount).map((s, i) => `F${i + 1} (${s}ms)`).join(' → ')} → vuelve al inicio`
              : 'Un solo frame (sin ciclo)'}
          </div>
        </div>

        {/* Preview within bar */}
        <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Preview en la barra</div>
          <div style={{ position: 'relative', height: 48, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
              <div style={{ width: '45%', height: '100%', borderRadius: 2, background: 'var(--accent)' }} />
            </div>
            {previewUrl && (
              <div style={{ position: 'absolute', left: '45%', bottom: '50%', transform: 'translate(-50%, 0px)' }}>
                <div style={{ width: Math.min(characterSize, 40), height: Math.min(characterSize, 40), borderRadius: 8, overflow: 'hidden' }}>
                  <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button onClick={saveAll} style={{ padding: '10px 24px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff' }}>
            Guardar y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, unit, onChange, accent, displayMap }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void; accent: string; displayMap?: Record<number, string>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {displayMap ? displayMap[value] ?? `${value}${unit}` : `${value}${unit}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 4, borderRadius: 2, outline: 'none', cursor: 'pointer',
          background: `linear-gradient(90deg, ${accent}60, ${accent} ${((value - min) / (max - min || 1)) * 100}%, var(--bg-deep) ${((value - min) / (max - min || 1)) * 100}%)`,
          WebkitAppearance: 'none', appearance: 'none', accentColor: accent,
        }}
        className="slider-row" />
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>{label}</span>
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <div onClick={() => setIsOpen(!isOpen)}
          style={{
            width: 32, height: 24, borderRadius: 6, cursor: 'pointer', border: '2px solid var(--border-default)',
            background: value || 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: 'var(--text-muted)',
          }}>
          {!value && <span>—</span>}
        </div>
        {isOpen && (
          <div style={{ position: 'absolute', top: 30, right: 0, zIndex: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', width: 168 }}>
              {['#E11D48', '#F43F5E', '#FB7185', '#F97316', '#F59E0B', '#FBBF24', '#10B981', '#34D399', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#ffffff', '#94A3B8', '#64748B'].map(c => (
                <div key={c} onClick={() => { onChange(c); setIsOpen(false); }}
                  style={{
                    width: 22, height: 22, borderRadius: 6, cursor: 'pointer', background: c,
                    border: value === c ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                    boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
                  }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="text" value={value} onChange={e => onChange(e.target.value)}
                placeholder="#hex"
                style={{ flex: 1, height: 28, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 8px', fontSize: 10, fontFamily: 'monospace', outline: 'none' }} />
              <button onClick={() => { onChange(''); setIsOpen(false); }}
                style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-muted)', fontSize: 9, cursor: 'pointer' }}>
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

