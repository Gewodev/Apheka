import React, { useEffect, useState, useRef } from 'react';
import {
  User, Palette, Brain, Cloud, Download, Bell,
  Moon, Sun, Type, Check,
  Timer, Target, Zap, BookOpen,
  FolderOpen, RefreshCw, ExternalLink, Shield,
  LogOut, Sliders, ListTodo, Music, GraduationCap, FileText, Sheet,
  PlayCircle, Calendar, Database, Upload, ArrowDownToLine, Search,
  Wifi, CheckCircle, Image, Coffee, X
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { open } from '@tauri-apps/plugin-dialog';
import NotificationBell from '../ui/NotificationBell';
import { copyFile, mkdir, exists, readFile } from '@tauri-apps/plugin-fs';
import { appCacheDir, join, extname } from '@tauri-apps/api/path';
import { getDownloadPath, setDownloadPath } from '../../lib/musicApi';
import {
  signIn, signOut, isSignedIn, onAuthChange, configureGoogle, ensureToken,
} from '../../lib/google/index';
import { syncAppEventsToGoogle } from '../../lib/google/calendar';
import { isTauri } from '../../lib/tauri';
import {
  supabase, signInWithGoogle as supabaseSignIn, signOutSupabase, getCurrentUser, syncAllToSupabase,
} from '../../lib/supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

type SettingsTab = 'perfil' | 'Apariencia' | 'estudio' | 'Notificaciones';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'Apariencia', label: 'Apariencia', icon: Palette },
  { id: 'estudio', label: 'Estudio', icon: Brain },

  { id: 'Notificaciones', label: 'Sonidos y Alertas', icon: Bell },
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
  { name: 'Clásico', colors: ['#E11D48', '#3B82F6', '#10B981'], desc: 'Rojo acento clásico' },
  { name: 'Tecnológico', colors: ['#06B6D4', '#3B82F6', '#8B5CF6'], desc: 'Cian, azul y violeta' },
  { name: 'One Piece', colors: ['#0EA5E9', '#FBBF24', '#EF4444'], desc: 'Azul, amarillo y rojo' },
  { name: 'Marvel', colors: ['#E11D48', '#3B82F6', '#F59E0B'], desc: 'Rojo, azul y dorado' },
  { name: 'Naturaleza', colors: ['#10B981', '#84CC16', '#14B8A6'], desc: 'Verde esmeralda y lima' },
  { name: 'Galaxia', colors: ['#8B5CF6', '#D946EF', '#6366F1'], desc: 'Púrpura, rosa e índigo' },
  { name: 'Ocaso', colors: ['#F97316', '#EC4899', '#F59E0B'], desc: 'Naranja, rosa y ámbar' },
  { name: 'Minimal', colors: ['#ffffff', '#94A3B8', '#64748B'], desc: 'Blanco y grises' },
  { name: 'Energía', colors: ['#EF4444', '#F59E0B', '#10B981'], desc: 'Rojo, ámbar y verde' },
  { name: 'Oscuro', colors: ['#1E1E2E', '#CBA6F7', '#89B4FA'], desc: 'Violeta, lavanda y azul' },
  { name: 'Retro', colors: ['#FF6B6B', '#FFE66D', '#4ECDC4'], desc: 'Rojo pastel, amarillo y turquesa' },
  { name: 'Otoño', colors: ['#D35400', '#E67E22', '#F39C12'], desc: 'Naranja, calabaza y ámbar' },
];

const ACCENT_COLORS = ['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316', '#84CC16', '#D946EF', '#14B8A6', '#6366F1'];

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="bento-card hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', border: '1px solid var(--border-subtle)', cursor: 'pointer', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{label}</span>
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
    triggerTasksSync, importGoogleTasks,
    searchYouTubeMusic, importClassroomCourses, importClassroomAssignments,
    exportNotesToGoogleDoc, exportStatsToGoogleSheets,
    loadGoogleProfile, triggerDriveBackup,
    events, tasks, notes, courses, clearAllMusicData, addNotification, deleteCompletedTasks
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [downloadPath, setDownloadPathState] = useState('');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>('mp3');
  const [syncing, setSyncing] = useState(false);
  const [backupUrl, setBackupUrl] = useState<string | null>(null);
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [ytSearch, setYtSearch] = useState('');
  const [ytResults, setYtResults] = useState<{ videoId: string; title: string; channel: string; thumbnail: string }[]>([]);
  const [googleProfile, setGoogleProfile] = useState<{ displayName: string; givenName: string; photoUrl: string; email: string } | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showClearAllMusic, setShowClearAllMusic] = useState(false);
  const [clearAllMusicText, setClearAllMusicText] = useState('');

  // Load theme colors from saved settings on mount
  useEffect(() => {
    const saved = settings.accentColor;
    if (saved) {
      const match = THEME_PRESETS.find(t => t.colors[0] === saved);
      if (match) {
        setSelectedTheme(match.name);
        if (match.colors[1]) document.documentElement.style.setProperty('--theme-secondary', match.colors[1]);
        if (match.colors[2]) document.documentElement.style.setProperty('--theme-tertiary', match.colors[2]);
      } else {
        setSelectedTheme(null);
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

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  useEffect(() => {
    getDownloadPath().then(setDownloadPathState).catch(() => {});
  }, []);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) {
      configureGoogle(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      setGoogleConnected(isSignedIn());
      const unsub = onAuthChange(connected => setGoogleConnected(connected));
      return unsub;
    }
  }, [setGoogleConnected]);

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
    getCurrentUser().then(user => setSupabaseConnected(!!user));
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

  const handleSupabaseSignOut = async () => {
    await signOutSupabase();
    setSupabaseConnected(false);
    addNotification('Supabase desconectado exitosamente', 'success');
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
    setGoogleProfile(null); setDocsUrl(null); setSheetsUrl(null); setYtResults([]);
    addNotification('Google desconectado exitosamente', 'success');
  };

  const handleCalendarSync = async () => {
    setSyncing(true);
    try {
      await triggerCalendarSync();
      const count = await importGoogleEvents();
      addNotification(count > 0 ? `${count} eventos importados de Google Calendar` : 'Eventos sincronizados exitosamente', 'success');
    } catch { addNotification('Error de Sincronización con Google Calendar', 'error'); }
    setSyncing(false);
  };

  const handleTasksSync = async () => {
    setSyncing(true);
    try {
      await triggerTasksSync();
      const count = await importGoogleTasks();
      addNotification(count > 0 ? `${count} tareas importadas de Google Tasks` : 'Tareas sincronizadas exitosamente', 'success');
    } catch { addNotification('Error al sincronizar con Google Tasks', 'error'); }
    setSyncing(false);
  };

  const handleYouTubeSearch = async () => {
    if (!ytSearch.trim()) { addNotification('Escribe un término de búsqueda', 'error'); return; }
    setSyncing(true);
    try {
      const results = await searchYouTubeMusic(ytSearch);
      setYtResults(results);
      if (results.length === 0) addNotification('Sin resultados encontrados', 'error');
      else addNotification(`${results.length} resultados encontrados`, 'success');
    } catch { addNotification('Error al buscar en YouTube Music', 'error'); }
    setSyncing(false);
  };

  const handleClassroomImport = async () => {
    setSyncing(true);
    try {
      await importClassroomCourses();
      const count = await importClassroomAssignments();
      addNotification(count > 0 ? `${count} tareas importadas de Classroom` : 'Classroom sincronizado exitosamente', 'success');
    } catch { addNotification('Error al importar de Google Classroom', 'error'); }
    setSyncing(false);
  };

  const handleExportNotes = async () => {
    setSyncing(true);
    try {
      const url = await exportNotesToGoogleDoc();
      if (url) { setDocsUrl(url); addNotification('Notas exportadas a Google Docs', 'success'); }
    } catch { addNotification('Error al exportar notas a Google Docs', 'error'); }
    setSyncing(false);
  };

  const handleExportStats = async () => {
    setSyncing(true);
    try {
      const url = await exportStatsToGoogleSheets();
      if (url) { setSheetsUrl(url); addNotification('Estadísticas exportadas a Google Sheets', 'success'); }
    } catch { addNotification('Error al exportar estadísticas a Google Sheets', 'error'); }
    setSyncing(false);
  };

  const handleDriveBackup = async () => {
    setSyncing(true);
    try {
      const url = await triggerDriveBackup();
      if (url) { setBackupUrl(url); addNotification('Backup creado en Google Drive exitosamente', 'success'); }
    } catch { addNotification('Error al crear backup en Google Drive', 'error'); }
    setSyncing(false);
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
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Personaliza y optimiza tu entorno de estudio.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
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
        <aside className="bento-card" style={{ width: 240, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 8px' }}>
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
        <main className="bento-card" style={{ flex: 1, padding: '32px 40px', minHeight: 600, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>

            {/* â•â•â•â•â•â•â•â•â•â•â• PERFIL â•â•â•â•â•â•â•â•â•â•â• */}
            {activeTab === 'perfil' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Perfil de Usuario</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Tu identidad y conexiones en OWA Studio</p>
                </div>

                {/* Avatar + Name + Photo URL */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 24, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', marginBottom: 16 }}>Servicios Vinculados</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Google */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Google</span>
                      </div>
                      <button onClick={() => { if (googleConnected) { handleGoogleSignOut(); } else { setShowGoogleModal(true); } }} className={googleConnected ? 'btn-secondary' : 'btn-primary'} style={{ fontSize: 10, fontWeight: 600, padding: '0 12px', height: 28 }}>
                        {googleConnected ? 'Desconectar' : 'Conectar'}
                      </button>
                    </div>
                    {/* Google Calendar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Calendar size={16} style={{ color: '#4285F4' }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Calendar</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: googleConnected ? '#10B981' : 'var(--text-muted)' }}>{googleConnected ? 'Sincronizado' : 'Inactivo'}</span>
                      </div>
                    </div>
                    {/* Google Tasks */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ListTodo size={16} style={{ color: '#F59E0B' }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Tasks</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: googleConnected ? '#10B981' : 'var(--text-muted)' }}>{googleConnected ? 'Vinculado' : 'Inactivo'}</span>
                      </div>
                    </div>
                    {/* Google Classroom */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <GraduationCap size={16} style={{ color: '#8B5CF6' }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Classroom</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: googleConnected ? '#10B981' : 'var(--text-muted)' }}>{googleConnected ? 'Disponible' : 'Inactivo'}</span>
                      </div>
                    </div>
                    {/* YouTube Music */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <PlayCircle size={16} style={{ color: '#EF4444' }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>YouTube Music</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: googleConnected ? '#10B981' : 'var(--text-muted)' }}>{googleConnected ? 'Disponible' : 'Inactivo'}</span>
                      </div>
                    </div>
                    {/* Google Drive */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}><path fill="#FFD04B" d="M19 13h-6v6h6v-6z"/><path fill="#4285F4" d="M13 19h-6v-6h6v6z"/><path fill="#0F9D58" d="M7 13h6V7H7v6z"/><path fill="#DB4437" d="M19 7h-6v6h6V7z"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Drive</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: googleConnected ? '#10B981' : 'var(--text-muted)' }}>{googleConnected ? 'Vinculado' : 'Inactivo'}</span>
                      </div>
                    </div>
                    {/* Supabase */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Database size={16} style={{ color: '#3DCF8E' }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Supabase Cloud</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: supabaseConnected ? '#10B981' : 'var(--text-muted)' }}>{supabaseConnected ? 'Conectado' : 'Desconectado'}</span>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: supabaseConnected ? '#10B981' : 'var(--text-muted)', boxShadow: supabaseConnected ? '0 0 6px rgba(16,185,129,0.5)' : 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logout */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => setShowClearAllMusic(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms' }}>
                    <Music size={14} /> Borrar toda la música
                  </button>
                  <button onClick={() => {
                    if (confirm('¿Cerrar sesión? Se perderán las conexiones activas.')) {
                      handleGoogleSignOut();
                      handleSupabaseSignOut();
                    }
                  }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms' }}>
                    <LogOut size={14} /> Cerrar Sesión
                  </button>
                </div>

                <div className="bento-card" style={{ padding: '24px', border: '1px solid rgba(239,68,68,0.2)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 4 }}>Datos de Tareas</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300 }}>Borra todas las tareas completadas. Las tareas antiguas (&gt;2 meses) se eliminan automáticamente al iniciar.</p>
                    </div>
                    <button onClick={() => {
                      const completedCount = tasks.filter(t => t.status === 'completado').length;
                      if (completedCount === 0) { addNotification('No hay tareas completadas para eliminar', 'info'); return; }
                      if (confirm(`¿Eliminar ${completedCount} tarea${completedCount !== 1 ? 's' : ''} completada${completedCount !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) {
                        deleteCompletedTasks();
                      }
                    }} style={{ padding: '0 20px', height: 38, borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#EF4444', border: 'none', color: '#fff', cursor: 'pointer' }}>
                      Borrar completadas
                    </button>
                  </div>
                </div>

                {/* Floating Timer Customization */}
                <div className="bento-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Timer Flotante</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Color de fondo</span>
                      <input type="color" value={settings.floatingBgColor || '#020203'} onChange={e => updateSettings({ floatingBgColor: e.target.value })}
                        style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-default)', cursor: 'pointer', background: 'transparent', padding: 0 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Estilo de reloj</span>
                      <select value={settings.floatingClockType || 'led'} onChange={e => updateSettings({ floatingClockType: e.target.value as any })}
                        style={{ padding: '6px 10px', borderRadius: 6, fontSize: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
                        <option value="led">LED Digital</option>
                        <option value="digital">Texto Simple</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Animación en pausa</span>
                      <button onClick={() => updateSettings({ floatingShowAnimation: !settings.floatingShowAnimation })}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: settings.floatingShowAnimation ? 'var(--accent)' : 'var(--bg-deep)', color: settings.floatingShowAnimation ? '#fff' : 'var(--text-secondary)', transition: 'all 150ms' }}>
                        {settings.floatingShowAnimation ? 'Activado' : 'Desactivado'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Apariencia */}
            {activeTab === 'Apariencia' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', marginBottom: 4 }}>Apariencia y Diseño</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Personaliza cada aspecto visual de OWA Studio</p>
                </div>

                {/* Modo Visual */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>Modo Visual</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { id: 'oscuro' as const, label: 'Modo Oscuro', icon: Moon },
                      { id: 'claro' as const, label: 'Modo Claro', icon: Sun },
                    ].map(t => {
                      const Icon = t.icon;
                      const active = settings.theme === t.id;
                      return (
                        <button key={t.id} onClick={() => updateSettings({ theme: t.id })} className="hover-lift" style={{
                          flex: 1, padding: '16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.02em'
                        }}>
                          <Icon size={18} /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Temas Predefinidos */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>Temas de Color</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {THEME_PRESETS.map(theme => {
                      const active = selectedTheme === theme.name;
                      return (
                        <button key={theme.name} onClick={() => {
                          setSelectedTheme(theme.name);
                          updateSettings({ accentColor: theme.colors[0] });
                          if (theme.colors[1]) document.documentElement.style.setProperty('--theme-secondary', theme.colors[1]);
                          if (theme.colors[2]) document.documentElement.style.setProperty('--theme-tertiary', theme.colors[2]);
                        }} style={{
                          padding: '16px', borderRadius: 12, cursor: 'pointer', background: active ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                          border: active ? `1px solid ${theme.colors[0]}` : '1px solid var(--border-default)', transition: 'all 200ms', textAlign: 'left'
                        }}>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {theme.colors.map((c, i) => (
                              <div key={i} style={{ flex: 1, height: 16, borderRadius: 4, background: c, boxShadow: i === 0 && active ? `0 0 8px ${c}` : 'none' }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>{theme.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 300, color: 'var(--text-tertiary)', display: 'block', marginTop: 2 }}>{theme.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tipografía */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
                    <button onClick={async () => {
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
                    }} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                      <Image size={16} /> {settings.backgroundImage ? 'Cambiar Imagen de Fondo' : 'Cargar Imagen de Fondo'}
                    </button>

                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Opacidad de Paneles</span>
                        <span>{Math.round((settings.uiOpacity ?? 0.85) * 100)}%</span>
                      </label>
                      <input type="range" min="0.1" max="1" step="0.05"
                        value={settings.uiOpacity ?? 0.85}
                        onChange={(e) => updateSettings({ uiOpacity: parseFloat(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Brillo del Fondo</span>
                        <span>{settings.backgroundBrightness ?? 100}%</span>
                      </label>
                      <input type="range" min="30" max="200" step="5"
                        value={settings.backgroundBrightness ?? 100}
                        onChange={e => updateSettings({ backgroundBrightness: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 400 }}>
                        <span>Desenfoque de Paneles</span>
                        <span>{settings.backgroundBlur ?? 0}px</span>
                      </label>
                      <input type="range" min="0" max="30" step="1"
                        value={settings.backgroundBlur ?? 0}
                        onChange={e => updateSettings({ backgroundBlur: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>

                    <div style={{ marginTop: 12 }}>
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

                {/* Color Acento */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>Color de Acento Principal</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, justifyItems: 'center' }}>
                    {ACCENT_COLORS.map(color => (
                      <button key={color} onClick={() => {
                        setSelectedTheme(null);
                        updateSettings({ accentColor: color });
                        document.documentElement.style.setProperty('--theme-secondary', color);
                        document.documentElement.style.setProperty('--theme-tertiary', color);
                      }} className="hover-lift" style={{
                        width: 56, height: 56, borderRadius: '50%', background: color, border: settings.accentColor === color ? '3px solid #fff' : '2px solid transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: settings.accentColor === color ? `0 0 20px ${color}` : '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'all 200ms'
                      }}>
                        {settings.accentColor === color && <Check size={22} color="#fff" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
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

                <div className="bento-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <RangeSlider label="Enfoque" value={settings.pomodoroTime / 60} min={10} max={120} unit="min" onChange={v => updateSettings({ pomodoroTime: v * 60 })} color="#E11D48" />
                    <RangeSlider label="Descanso Corto" value={settings.shortBreakTime / 60} min={1} max={30} unit="min" onChange={v => updateSettings({ shortBreakTime: v * 60 })} color="#10B981" />
                    <RangeSlider label="Cronómetro (meta por ronda)" value={(settings.chronoGoal || 1500) / 60} min={25} max={180} unit="min" onChange={v => updateSettings({ chronoGoal: v * 60 })} color="#3B82F6" />
                    <RangeSlider label="Meta Diaria" value={settings.dailyGoal} min={30} max={600} unit="min" onChange={v => updateSettings({ dailyGoal: v })} color="#8B5CF6" />
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <RangeSlider label="Descanso Largo" value={settings.longBreakTime / 60} min={5} max={60} unit="min" onChange={v => updateSettings({ longBreakTime: v * 60 })} color="#F59E0B" />
                    <RangeSlider label="Ciclos antes de Descanso Largo" value={settings.pomodoroGoal} min={1} max={20} unit=" ciclos" onChange={v => updateSettings({ pomodoroGoal: v })} color="#6366F1" />
                  </div>
                </div>

                {/* Timer Colors */}
                <div className="bento-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Colores de Temporizadores</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>Enfoque</span>
                      <input type="color" value={settings.timerFocusColor || '#E11D48'} onChange={e => updateSettings({ timerFocusColor: e.target.value })}
                        style={{ width: '100%', height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>Descanso</span>
                      <input type="color" value={settings.timerBreakColor || '#10B981'} onChange={e => updateSettings({ timerBreakColor: e.target.value })}
                        style={{ width: '100%', height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>Cronómetro</span>
                      <input type="color" value={settings.timerChronoColor || '#3B82F6'} onChange={e => updateSettings({ timerChronoColor: e.target.value })}
                        style={{ width: '100%', height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }} />
                    </div>
                  </div>
                </div>
              </section>
            )}



            {/* â•â•â•â•â•â•â•â•â•â•â• Notificaciones â•â•â•â•â•â•â•â•â•â•â• */}
            {activeTab === 'Notificaciones' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Sonidos y Alertas de Sistema</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Controla el comportamiento acústico y Notificaciones del entorno</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Toggle checked={settings.notifications} onChange={v => updateSettings({ notifications: v })}
                    label="Alertas de Temporizador Pomodoro" desc="Emitir notificación visual y acústica al finalizar ciclos de estudio o descansos programados." />
                  <Toggle checked={settings.soundEffects} onChange={v => updateSettings({ soundEffects: v })}
                    label="Efectos de Sonido Hápticos" desc="Reproducir sutiles retroalimentaciones acústicas al interactuar con botones, pestañas y modales del sistema." />
                </div>
              </section>
            )}

          </div>
        </main>
      </div>

      {/* Google Connect Modal */}
      {showGoogleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowGoogleModal(false)}>
          <div className="bento-card" style={{ width: '100%', maxWidth: 420, padding: '28px 32px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => { handleTasksSync(); }} style={{ padding: '8px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    Sincronizar Tasks
                  </button>
                  <button onClick={() => { handleClassroomImport(); }} style={{ padding: '8px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    Sincronizar Classroom
                  </button>
                </div>
                <button onClick={handleGoogleSignOut} style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                  Desconectar Google
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Conecta tu cuenta de Google para sincronizar tareas, calendario, Classroom y acceder a Google Drive desde OWA Studio.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['Calendar', 'Tasks', 'Classroom', 'Drive', 'YouTube'].map(s => (
                    <div key={s} style={{ flex: 1, padding: '6px 0', borderRadius: 6, background: 'var(--bg-deep)', textAlign: 'center', fontSize: 8, fontWeight: 600, color: 'var(--text-muted)' }}>{s}</div>
                  ))}
                </div>
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
          <div className="bento-card" style={{ padding: 28, width: 360, maxWidth: '90vw', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Eliminar toda la biblioteca de música</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Se eliminarán todas las canciones, playlists y descargas. Esta acción no se puede deshacer.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Escribe <strong style={{ color: 'var(--error)' }}>Deseoborrartodo</strong> para confirmar:
            </p>
            <input type="text" value={clearAllMusicText} onChange={e => setClearAllMusicText(e.target.value)}
              placeholder="Escribe Deseoborrartodo"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowClearAllMusic(false); setClearAllMusicText(''); }} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => {
                if (clearAllMusicText !== 'Deseoborrartodo') return;
                clearAllMusicData();
                setShowClearAllMusic(false);
                setClearAllMusicText('');
                addNotification('Biblioteca de música eliminada por completo', 'success');
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12, background: clearAllMusicText === 'Deseoborrartodo' ? 'var(--error)' : 'var(--bg-deep)', borderColor: clearAllMusicText === 'Deseoborrartodo' ? 'var(--error)' : 'var(--border-default)', opacity: clearAllMusicText === 'Deseoborrartodo' ? 1 : 0.4, cursor: clearAllMusicText === 'Deseoborrartodo' ? 'pointer' : 'not-allowed' }}>
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

