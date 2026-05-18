import React, { useEffect, useState } from 'react';
import {
  User, Palette, Brain, Cloud, Download, Bell,
  Moon, Sun, Type, Check,
  Timer, Target, Zap, BookOpen,
  FolderOpen, RefreshCw, ExternalLink, Shield,
  LogOut, Sliders, ListTodo, Music, GraduationCap, FileText, Sheet,
  PlayCircle, Calendar, Database, Upload, ArrowDownToLine, Search,
  Wifi, CheckCircle
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { open } from '@tauri-apps/plugin-dialog';
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

type SettingsTab = 'perfil' | 'apariencia' | 'estudio' | 'integraciones' | 'descargas' | 'notificaciones';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
  { id: 'estudio', label: 'Estudio', icon: Brain },
  { id: 'integraciones', label: 'Integraciones', icon: Cloud },
  { id: 'descargas', label: 'Descargas', icon: Download },
  { id: 'notificaciones', label: 'Sonidos y Alertas', icon: Bell },
];

const FONTS = [
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'Outfit', family: "'Outfit', sans-serif" },
  { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { name: 'Roboto', family: "'Roboto', sans-serif" },
];

const ACCENT_COLORS = ['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="bento-card hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
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

function InputCard({
  icon: Icon, label, value, unit, onChange, color, min, max,
}: {
  icon: React.ComponentType<any>;
  label: string; value: number; unit: string;
  onChange: (v: number) => void; color: string; min?: number; max?: number;
}) {
  return (
    <div className="bento-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="number" value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="input-base" style={{ width: '100%', height: 40, fontSize: 16, fontWeight: 700 }}
          min={min} max={max} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  );
}

export default function Ajustes() {
  const {
    settings, updateSettings, googleConnected, setGoogleConnected,
    setCalendarSyncEnabled, lastCalendarSync, setLastCalendarSync,
    triggerCalendarSync, importGoogleEvents,
    triggerTasksSync, importGoogleTasks,
    searchYouTubeMusic, importClassroomCourses,
    exportNotesToGoogleDoc, exportStatsToGoogleSheets,
    loadGoogleProfile, triggerDriveBackup,
    events, tasks, notes, courses,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil');
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
            toast.success(`Bienvenido, ${profile.givenName || profile.displayName}`);
          } else {
            toast.success('Google conectado exitosamente');
          }
        });
      }
    }
    const error = localStorage.getItem('owa_auth_error');
    if (error) {
      localStorage.removeItem('owa_auth_error');
      toast.error(`Error de autenticación: ${error}`);
    }
    const sbSuccess = localStorage.getItem('owa_supabase_auth_success');
    if (sbSuccess === 'true') {
      localStorage.removeItem('owa_supabase_auth_success');
      setSupabaseConnected(true);
      toast.success('Supabase conectado exitosamente');
    }
    getCurrentUser().then(user => setSupabaseConnected(!!user));
  }, [loadGoogleProfile, setGoogleConnected, updateSettings]);

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) { toast.error('Configura VITE_GOOGLE_CLIENT_ID en .env'); return; }
    const ok = await signIn();
    if (ok) {
      setGoogleConnected(true);
      const profile = await loadGoogleProfile();
      if (profile) {
        setGoogleProfile(profile);
        if (profile.givenName) updateSettings({ userName: profile.givenName });
        toast.success(`Bienvenido, ${profile.givenName || profile.displayName}`);
      } else {
        toast.success('Google conectado exitosamente');
      }
    } else if (!isTauri()) {
      toast.error('No se pudo conectar con Google');
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
      toast.success('Supabase conectado exitosamente');
    } catch {
      toast.error('No se pudo conectar con Supabase');
    }
  };

  const handleSupabaseSignOut = async () => {
    await signOutSupabase();
    setSupabaseConnected(false);
    toast.success('Supabase desconectado exitosamente');
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
      toast.success('Datos sincronizados con la nube exitosamente');
    } catch { toast.error('Error al sincronizar con Supabase'); }
    setSupabaseSyncing(false);
  };

  const handleGoogleSignOut = () => {
    signOut(); setGoogleConnected(false); setCalendarSyncEnabled(false); setLastCalendarSync(null);
    setGoogleProfile(null); setDocsUrl(null); setSheetsUrl(null); setYtResults([]);
    toast.success('Google desconectado exitosamente');
  };

  const handleCalendarSync = async () => {
    setSyncing(true);
    try {
      await triggerCalendarSync();
      const count = await importGoogleEvents();
      toast.success(count > 0 ? `${count} eventos importados de Google Calendar` : 'Eventos sincronizados exitosamente');
    } catch { toast.error('Error de sincronización con Google Calendar'); }
    setSyncing(false);
  };

  const handleTasksSync = async () => {
    setSyncing(true);
    try {
      await triggerTasksSync();
      const count = await importGoogleTasks();
      toast.success(count > 0 ? `${count} tareas importadas de Google Tasks` : 'Tareas sincronizadas exitosamente');
    } catch { toast.error('Error al sincronizar con Google Tasks'); }
    setSyncing(false);
  };

  const handleYouTubeSearch = async () => {
    if (!ytSearch.trim()) { toast.error('Escribe un término de búsqueda'); return; }
    setSyncing(true);
    try {
      const results = await searchYouTubeMusic(ytSearch);
      setYtResults(results);
      if (results.length === 0) toast.error('Sin resultados encontrados');
      else toast.success(`${results.length} resultados encontrados`);
    } catch { toast.error('Error al buscar en YouTube Music'); }
    setSyncing(false);
  };

  const handleClassroomImport = async () => {
    setSyncing(true);
    try {
      await importClassroomCourses();
      toast.success('Cursos importados de Google Classroom exitosamente');
    } catch { toast.error('Error al importar de Google Classroom'); }
    setSyncing(false);
  };

  const handleExportNotes = async () => {
    setSyncing(true);
    try {
      const url = await exportNotesToGoogleDoc();
      if (url) { setDocsUrl(url); toast.success('Notas exportadas a Google Docs'); }
    } catch { toast.error('Error al exportar notas a Google Docs'); }
    setSyncing(false);
  };

  const handleExportStats = async () => {
    setSyncing(true);
    try {
      const url = await exportStatsToGoogleSheets();
      if (url) { setSheetsUrl(url); toast.success('Estadísticas exportadas a Google Sheets'); }
    } catch { toast.error('Error al exportar estadísticas a Google Sheets'); }
    setSyncing(false);
  };

  const handleDriveBackup = async () => {
    setSyncing(true);
    try {
      const url = await triggerDriveBackup();
      if (url) { setBackupUrl(url); toast.success('Backup creado en Google Drive exitosamente'); }
    } catch { toast.error('Error al crear backup en Google Drive'); }
    setSyncing(false);
  };

  const handleFontChange = (font: string) => {
    updateSettings({ fontFamily: font });
    document.documentElement.style.setProperty('--font-primary', font);
    toast.success('Tipografía actualizada exitosamente');
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HEADER ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Configuración</h1>
            <Sliders size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Personaliza y optimiza tu entorno de estudio.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Bell size={16} /></button>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <div className="led-display" style={{ fontSize: 28, fontWeight: 300, lineHeight: 1 }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 14 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA (SIDEBAR + SETTINGS PANELS) */}
      <div style={{ display: 'flex', flex: 1, gap: 24, minHeight: 600, alignItems: 'flex-start' }}>
        
        {/* INNER SIDEBAR */}
        <aside className="bento-card" style={{ width: 240, padding: '20px 16px', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
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
          <button onClick={() => toast.success('Sesión cerrada')} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
            background: 'transparent', border: 'none', color: 'var(--error)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms'
          }}>
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </aside>

        {/* MAIN AREA */}
        <main className="bento-card" style={{ flex: 1, background: 'var(--bg-deep)', padding: '32px 40px', minHeight: 600 }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>

            {/* ═══════════ PERFIL ═══════════ */}
            {activeTab === 'perfil' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Perfil de Usuario</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Tu identidad en OWA Studio</p>
                </div>

                <div className="bento-card" style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-dim)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Nombre de visualización</label>
                    <input type="text" value={settings.userName}
                      onChange={e => updateSettings({ userName: e.target.value })}
                      className="input-base" style={{ width: '100%', height: 42, fontSize: 14, fontWeight: 600 }}
                      placeholder="Tu nombre" />
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ APARIENCIA ═══════════ */}
            {activeTab === 'apariencia' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Apariencia y Diseño</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Personaliza el aspecto visual y los tokens de diseño</p>
                </div>

                {/* Tema */}
                <div className="bento-card" style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'block' }}>Modo Visual</span>
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
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                        }}>
                          <Icon size={18} /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tipografía */}
                <div className="bento-card" style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'block' }}>Familia Tipográfica</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    {FONTS.map(font => {
                      const active = settings.fontFamily === font.family;
                      return (
                        <button key={font.name} onClick={() => handleFontChange(font.family)} className="hover-lift" style={{
                          padding: '20px 16px', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-primary)', cursor: 'pointer'
                        }}>
                          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: font.family, lineHeight: 1 }}>Aa</div>
                          <div style={{ fontSize: 12, fontWeight: 600, opacity: active ? 1 : 0.7 }}>{font.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Acento */}
                <div className="bento-card" style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'block' }}>Color de Acento Principal</span>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {ACCENT_COLORS.map(color => (
                      <button key={color} onClick={() => updateSettings({ accentColor: color })} className="hover-lift" style={{
                        width: 48, height: 48, borderRadius: '50%', background: color, border: settings.accentColor === color ? '3px solid #fff' : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: settings.accentColor === color ? `0 0 16px ${color}` : 'none'
                      }}>
                        {settings.accentColor === color && <Check size={20} color="#fff" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ ESTUDIO ═══════════ */}
            {activeTab === 'estudio' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Tiempos y Metas de Estudio</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Configura los intervalos de tu método Pomodoro y objetivos cognitivos</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                  <InputCard icon={Timer} label="Tiempo de Enfoque" value={settings.pomodoroTime / 60} unit="minutos"
                    onChange={v => updateSettings({ pomodoroTime: v * 60 || 1500 })} color="var(--accent)" min={1} max={120} />
                  <InputCard icon={Zap} label="Descanso Corto" value={settings.shortBreakTime / 60} unit="minutos"
                    onChange={v => updateSettings({ shortBreakTime: v * 60 || 300 })} color="#10B981" min={1} max={30} />
                  <InputCard icon={Target} label="Meta Diaria de Estudio" value={settings.dailyGoal} unit="minutos"
                    onChange={v => updateSettings({ dailyGoal: v || 240 })} color="#3B82F6" min={1} />
                  <InputCard icon={BookOpen} label="Objetivo Pomodoros" value={settings.pomodoroGoal} unit="ciclos"
                    onChange={v => updateSettings({ pomodoroGoal: v || 4 })} color="#F59E0B" min={1} max={20} />
                </div>
              </section>
            )}

            {/* ═══════════ INTEGRACIONES ═══════════ */}
            {activeTab === 'integraciones' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Integraciones en la Nube</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Conecta tus servicios externos para sincronización y respaldo</p>
                </div>

                {!GOOGLE_CLIENT_ID && (
                  <div style={{ padding: '16px 20px', background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>Falta Clave de API de Google</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Configura VITE_GOOGLE_CLIENT_ID en el archivo .env para activar los servicios de Google Calendar, Classroom y Drive.</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Cuenta Google */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: googleConnected ? 'var(--success-dim)' : 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Shield size={20} style={{ color: googleConnected ? 'var(--success)' : 'var(--text-tertiary)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Cuenta de Google</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {googleConnected ? (googleProfile?.email || 'Conectada exitosamente') : 'Desconectada'}
                          </p>
                        </div>
                      </div>
                      <button onClick={googleConnected ? handleGoogleSignOut : handleGoogleSignIn} className={googleConnected ? 'btn-secondary' : 'btn-primary'} style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36 }}>
                        {googleConnected ? 'Desconectar' : 'Conectar Cuenta'}
                      </button>
                    </div>
                    {googleProfile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                        {googleProfile.photoUrl ? (
                          <img src={googleProfile.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                            {googleProfile.displayName.charAt(0)}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{googleProfile.displayName}</span>
                          {googleProfile.email}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supabase Cloud */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: supabaseConnected ? 'var(--success-dim)' : 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Database size={20} style={{ color: supabaseConnected ? 'var(--success)' : 'var(--text-tertiary)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Supabase Cloud</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {supabaseConnected ? 'Conectado a la base de datos' : 'Sincronización en la nube'}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {supabaseConnected && (
                          <button onClick={handleSupabaseSync} disabled={supabaseSyncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {supabaseSyncing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
                            Sincronizar
                          </button>
                        )}
                        <button onClick={supabaseConnected ? handleSupabaseSignOut : handleSupabaseSignIn} className={supabaseConnected ? 'btn-secondary' : 'btn-primary'} style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36 }}>
                          {supabaseConnected ? 'Desconectar' : 'Conectar Supabase'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Google Calendar */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--info-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={20} style={{ color: 'var(--info)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Google Calendar</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {lastCalendarSync ? `Última sincronización: ${new Date(lastCalendarSync).toLocaleString()}` : 'Sincroniza tus eventos y planificador'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleCalendarSync} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sincronizar Eventos
                    </button>
                  </div>

                  {/* Google Tasks */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--warning-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ListTodo size={20} style={{ color: 'var(--warning)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Google Tasks</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{tasks.length} tareas locales disponibles</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleTasksSync} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sincronizar Tareas
                    </button>
                  </div>

                  {/* YouTube Music */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--error-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlayCircle size={20} style={{ color: 'var(--error)' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>YouTube Music</p>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Busca pistas de estudio y lofi para tu reproductor</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      <input type="text" value={ytSearch} onChange={e => setYtSearch(e.target.value)} placeholder="Ej. lofi hip hop beats..." className="input-base" style={{ flex: 1, height: 40, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && handleYouTubeSearch()} />
                      <button onClick={handleYouTubeSearch} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 20px', height: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={14} /> Buscar
                      </button>
                    </div>
                    {ytResults.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                        {ytResults.map(r => (
                          <a key={r.videoId} href={`https://youtube.com/watch?v=${r.videoId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8, background: 'var(--bg-deep)', textDecoration: 'none' }}>
                            <img src={r.thumbnail} alt="" style={{ width: 56, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.channel}</p>
                            </div>
                            <ExternalLink size={14} style={{ color: 'var(--text-tertiary)', marginRight: 8 }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Google Classroom */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <GraduationCap size={20} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Google Classroom</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{courses.length} cursos configurados</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleClassroomImport} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                      Importar Cursos
                    </button>
                  </div>

                  {/* Google Docs */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--info-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} style={{ color: 'var(--info)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Google Docs</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{notes.length} notas locales para exportar</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleExportNotes} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                      Exportar Notas a Docs
                    </button>
                    {docsUrl && (
                      <a href={docsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--info)', textDecoration: 'none', fontWeight: 600 }}>
                        <ExternalLink size={14} /> Abrir documento generado
                      </a>
                    )}
                  </div>

                  {/* Google Sheets */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--success-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sheet size={20} style={{ color: 'var(--success)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Google Sheets</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Exporta estadísticas e historial de estudio</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleExportStats} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Sheet size={14} />}
                      Exportar Estadísticas
                    </button>
                    {sheetsUrl && (
                      <a href={sheetsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--success)', textDecoration: 'none', fontWeight: 600 }}>
                        <ExternalLink size={14} /> Abrir hoja de cálculo
                      </a>
                    )}
                  </div>

                  {/* Google Drive Backup */}
                  <div className="bento-card" style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--success-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Database size={20} style={{ color: 'var(--success)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Respaldo en Google Drive</p>
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Crea copias de seguridad completas de tu entorno</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleDriveBackup} disabled={!googleConnected || syncing} className="btn-secondary" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
                      Respaldar Datos
                    </button>
                    {backupUrl && (
                      <a href={backupUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--success)', textDecoration: 'none', fontWeight: 600 }}>
                        <ExternalLink size={14} /> Ver archivo en Google Drive
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ DESCARGAS ═══════════ */}
            {activeTab === 'descargas' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Almacenamiento y Descargas</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Gestiona los directorios locales de música y formato de archivos</p>
                </div>

                <div className="bento-card" style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Directorio de Destino</label>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div className="input-base" style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
                        <FolderOpen size={16} style={{ color: 'var(--text-tertiary)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {downloadPath || 'Descargas/OWA Music'}
                        </span>
                      </div>
                      <button onClick={async () => {
                        try {
                          const folder = await open({ directory: true, multiple: false, title: 'Seleccionar carpeta de descargas' });
                          if (folder) { setDownloadPathState(String(folder)); await setDownloadPath(String(folder)); toast.success('Directorio actualizado exitosamente'); }
                        } catch { toast.error('No se pudo cambiar el directorio'); }
                      }} className="btn-secondary hover-lift" style={{ padding: '0 20px', height: 42, fontSize: 13, fontWeight: 600 }}>
                        Cambiar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Formato de Compresión de Audio</label>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {['mp3', 'm4a'].map(f => (
                        <button key={f} onClick={() => setAudioFormat(f as any)} className="hover-lift" style={{
                          padding: '12px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                          background: audioFormat === f ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: audioFormat === f ? '#fff' : 'var(--text-secondary)', cursor: 'pointer'
                        }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ NOTIFICACIONES ═══════════ */}
            {activeTab === 'notificaciones' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Sonidos y Alertas de Sistema</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Controla el comportamiento acústico y notificaciones del entorno</p>
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
    </div>
  );
}
