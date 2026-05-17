import React, { useEffect, useState } from 'react';
import {
  User, Palette, Brain, Cloud, Download, Bell,
  Moon, Sun, Type, Check,
  Timer, Target, Zap, BookOpen,
  FolderOpen, RefreshCw, ExternalLink, Shield,
  LogOut, Sliders, ListTodo, Music, GraduationCap, FileText, Sheet,
  PlayCircle, Calendar, Database, Upload, ArrowDownToLine, Search,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
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
  { id: 'notificaciones', label: 'Sonidos', icon: Bell },
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
    <label className="flex items-center justify-between p-4 bg-background border border-borderDark rounded-xl cursor-pointer hover:border-borderDark/80 transition-all group">
      <div className="min-w-0">
        <span className="text-sm font-medium text-textMain block">{label}</span>
        <span className="text-[10px] text-textDim mt-0.5 block">{desc}</span>
      </div>
      <div className={`relative w-10 h-[22px] rounded-full transition-all duration-200 flex-shrink-0 ml-4 ${checked ? 'bg-accent' : 'bg-surface2 border border-borderDark'}`}>
        <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-200 ${checked ? 'left-[19px]' : 'left-[1px]'}`} />
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      </div>
    </label>
  );
}

export default function Ajustes() {
  const {
    settings, updateSettings, googleConnected, setGoogleConnected,
    setCalendarSyncEnabled,
    lastCalendarSync, setLastCalendarSync,
    triggerCalendarSync, importGoogleEvents,
    triggerTasksSync, importGoogleTasks,
    searchYouTubeMusic, importClassroomCourses,
    exportNotesToGoogleDoc, exportStatsToGoogleSheets,
    loadGoogleProfile,
    triggerDriveBackup,
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

  // Handle OAuth redirect return (Tauri full-page flow)
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
            toast.success('Google conectado');
          }
        });
      }
    }
    const error = localStorage.getItem('owa_auth_error');
    if (error) {
      localStorage.removeItem('owa_auth_error');
      toast.error(`Error de autenticación: ${error}`);
    }
    // Supabase auth return detection
    const sbSuccess = localStorage.getItem('owa_supabase_auth_success');
    if (sbSuccess === 'true') {
      localStorage.removeItem('owa_supabase_auth_success');
      setSupabaseConnected(true);
      toast.success('Supabase conectado');
    }
    // Check initial Supabase auth state
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
        toast.success('Google conectado');
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
      toast.success('Supabase conectado');
    } catch {
      toast.error('No se pudo conectar con Supabase');
    }
  };

  const handleSupabaseSignOut = async () => {
    await signOutSupabase();
    setSupabaseConnected(false);
    toast.success('Supabase desconectado');
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
      toast.success('Datos sincronizados con la nube');
    } catch { toast.error('Error al sincronizar'); }
    setSupabaseSyncing(false);
  };

  const handleGoogleSignOut = () => {
    signOut(); setGoogleConnected(false); setCalendarSyncEnabled(false); setLastCalendarSync(null);
    setGoogleProfile(null); setDocsUrl(null); setSheetsUrl(null); setYtResults([]);
    toast.success('Google desconectado');
  };

  const handleCalendarSync = async () => {
    setSyncing(true);
    try {
      await triggerCalendarSync();
      const count = await importGoogleEvents();
      toast.success(count > 0 ? `${count} eventos importados de Google Calendar` : 'Eventos sincronizados');
    } catch { toast.error('Error de sincronización'); }
    setSyncing(false);
  };

  const handleTasksSync = async () => {
    setSyncing(true);
    try {
      await triggerTasksSync();
      const count = await importGoogleTasks();
      toast.success(count > 0 ? `${count} tareas importadas de Google Tasks` : 'Tareas sincronizadas');
    } catch { toast.error('Error al sincronizar tareas'); }
    setSyncing(false);
  };

  const handleYouTubeSearch = async () => {
    if (!ytSearch.trim()) { toast.error('Escribe un término de búsqueda'); return; }
    setSyncing(true);
    try {
      const results = await searchYouTubeMusic(ytSearch);
      setYtResults(results);
      if (results.length === 0) toast.error('Sin resultados');
      else toast.success(`${results.length} resultados encontrados`);
    } catch { toast.error('Error al buscar en YouTube'); }
    setSyncing(false);
  };

  const handleClassroomImport = async () => {
    setSyncing(true);
    try {
      await importClassroomCourses();
      toast.success('Cursos importados de Google Classroom');
    } catch { toast.error('Error al importar cursos'); }
    setSyncing(false);
  };

  const handleExportNotes = async () => {
    setSyncing(true);
    try {
      const url = await exportNotesToGoogleDoc();
      if (url) { setDocsUrl(url); }
    } catch { toast.error('Error al exportar notas'); }
    setSyncing(false);
  };

  const handleExportStats = async () => {
    setSyncing(true);
    try {
      const url = await exportStatsToGoogleSheets();
      if (url) { setSheetsUrl(url); }
    } catch { toast.error('Error al exportar estadísticas'); }
    setSyncing(false);
  };

  const handleDriveBackup = async () => {
    setSyncing(true);
    try {
      const url = await triggerDriveBackup();
      if (url) { setBackupUrl(url); toast.success('Backup creado en Google Drive'); }
    } catch { toast.error('Error al respaldar'); }
    setSyncing(false);
  };

  const handleFontChange = (font: string) => {
    updateSettings({ fontFamily: font });
    document.documentElement.style.setProperty('--font-primary', font);
    toast.success('Tipografía cambiada');
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-borderDark/40">
        <h1 className="text-lg font-semibold text-textMain flex items-center gap-2.5">
          <Sliders size={18} className="text-accent" /> Configuración
        </h1>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-borderDark">
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-[10px] font-medium text-textDim">Activo</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 border-r border-borderDark/40 p-2 flex flex-col gap-0.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-surface text-textMain shadow-sm'
                    : 'text-textDim hover:text-textMain hover:bg-surface/50'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-textDim hover:text-danger hover:bg-danger/10 transition-all">
            <LogOut size={15} /> Cerrar Sesión
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scroll">
          <div className="max-w-2xl mx-auto">

            {/* ═══════════ PERFIL ═══════════ */}
            {activeTab === 'perfil' && (
              <section>
                <h2 className="text-base font-semibold text-textMain mb-1">Perfil</h2>
                <p className="text-[11px] text-textDim mb-5">Tu identidad en OWA Studio</p>
                <div className="bg-surface border border-borderDark rounded-xl p-5">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xl font-semibold text-accent shrink-0">
                      {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] text-textDim font-medium mb-1.5 uppercase tracking-wider">Nombre</label>
                      <input type="text" value={settings.userName}
                        onChange={e => updateSettings({ userName: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg bg-background border border-borderDark text-sm text-textMain placeholder:text-textDim outline-none focus:border-accent transition-colors"
                        placeholder="Tu nombre" />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ APARIENCIA ═══════════ */}
            {activeTab === 'apariencia' && (
              <section>
                <h2 className="text-base font-semibold text-textMain mb-1">Apariencia</h2>
                <p className="text-[11px] text-textDim mb-5">Personaliza el aspecto visual</p>
                <div className="bg-surface border border-borderDark rounded-xl p-5 space-y-6">
                  {/* Tema */}
                  <div>
                    <span className="text-xs font-medium text-textDim uppercase tracking-wider mb-3 block">Modo visual</span>
                    <div className="flex gap-2">
                      {[
                        { id: 'oscuro' as const, label: 'Oscuro', icon: Moon },
                        { id: 'claro' as const, label: 'Claro', icon: Sun },
                      ].map(t => {
                        const Icon = t.icon;
                        const active = settings.theme === t.id;
                        return (
                          <button key={t.id} onClick={() => updateSettings({ theme: t.id })}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                              active ? 'bg-accent text-white shadow-sm' : 'bg-background border border-borderDark text-textDim hover:text-textMain'
                            }`}>
                            <Icon size={14} /> {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tipografía */}
                  <div>
                    <span className="text-xs font-medium text-textDim uppercase tracking-wider mb-3 block">Tipografía</span>
                    <div className="grid grid-cols-4 gap-2">
                      {FONTS.map(font => {
                        const active = settings.fontFamily === font.family;
                        return (
                          <button key={font.name} onClick={() => handleFontChange(font.family)}
                            className={`p-3 rounded-xl border transition-all ${
                              active ? 'bg-accent text-white border-accent' : 'bg-background border-borderDark text-textMain hover:border-textDim/40'
                            }`}>
                            <div className="text-lg font-semibold mb-0.5 leading-none" style={{ fontFamily: font.family }}>Aa</div>
                            <div className="text-[9px] font-medium opacity-70">{font.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color acento */}
                  <div>
                    <span className="text-xs font-medium text-textDim uppercase tracking-wider mb-3 block">Color de acento</span>
                    <div className="flex gap-3">
                      {ACCENT_COLORS.map(color => (
                        <button key={color} onClick={() => updateSettings({ accentColor: color })}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
                            settings.accentColor === color ? 'ring-2 ring-white ring-offset-[2px] ring-offset-surface' : ''
                          }`}
                          style={{ backgroundColor: color }}>
                          {settings.accentColor === color && <Check size={14} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ ESTUDIO ═══════════ */}
            {activeTab === 'estudio' && (
              <section>
                <h2 className="text-base font-semibold text-textMain mb-1">Estudio</h2>
                <p className="text-[11px] text-textDim mb-5">Configura tu método Pomodoro</p>
                <div className="bg-surface border border-borderDark rounded-xl p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <InputCard icon={Timer} label="Enfoque" value={settings.pomodoroTime / 60} unit="min"
                      onChange={v => updateSettings({ pomodoroTime: v * 60 || 1500 })} color="var(--accent)" min={1} max={120} />
                    <InputCard icon={Zap} label="Descanso" value={settings.shortBreakTime / 60} unit="min"
                      onChange={v => updateSettings({ shortBreakTime: v * 60 || 300 })} color="#10B981" min={1} max={30} />
                    <InputCard icon={Target} label="Meta diaria" value={settings.dailyGoal} unit="min"
                      onChange={v => updateSettings({ dailyGoal: v || 240 })} color="#3B82F6" min={1} />
                    <InputCard icon={BookOpen} label="Pomodoros" value={settings.pomodoroGoal} unit="ciclos"
                      onChange={v => updateSettings({ pomodoroGoal: v || 4 })} color="#F59E0B" min={1} max={20} />
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ INTEGRACIONES ═══════════ */}
            {activeTab === 'integraciones' && (
              <section>
                <h2 className="text-base font-semibold text-textMain mb-1">Integraciones</h2>
                <p className="text-[11px] text-textDim mb-5">Conecta tus servicios externos</p>

                {!GOOGLE_CLIENT_ID && (
                  <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 mb-4">
                    <p className="text-xs text-warning font-semibold mb-1">API Key requerida</p>
                    <p className="text-[10px] text-textDim">Crea un archivo .env con VITE_GOOGLE_CLIENT_ID=tu_client_id para activar Google services.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Cuenta Google */}
                  <div className="bg-surface border border-borderDark rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${googleConnected ? 'bg-success/15' : 'bg-background border border-borderDark'}`}>
                          <Shield size={16} className={googleConnected ? 'text-success' : 'text-textDim'} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-textMain">Cuenta Google</p>
                          <p className="text-[10px] text-textDim">
                            {googleConnected
                              ? (googleProfile?.email || 'Conectada')
                              : 'Desconectada'}
                          </p>
                        </div>
                      </div>
                      <button onClick={googleConnected ? handleGoogleSignOut : handleGoogleSignIn}
                        className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          googleConnected
                            ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20'
                            : 'bg-accent text-white hover:bg-accent/90'
                        }`}>
                        {googleConnected ? 'Desconectar' : 'Conectar'}
                      </button>
                    </div>
                    {googleProfile && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-borderDark/40">
                        {googleProfile.photoUrl ? (
                          <img src={googleProfile.photoUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent">
                            {googleProfile.displayName.charAt(0)}
                          </div>
                        )}
                        <div className="text-xs text-textDim">
                          <span className="text-textMain font-medium block">{googleProfile.displayName}</span>
                          {googleProfile.email}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supabase Cloud Sync */}
                  <div className="bg-surface border border-borderDark rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${supabaseConnected ? 'bg-emerald-500/15' : 'bg-background border border-borderDark'}`}>
                          <Database size={15} className={supabaseConnected ? 'text-emerald-400' : 'text-textDim'} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-textMain">Supabase Cloud</p>
                          <p className="text-[10px] text-textDim">
                            {supabaseConnected ? 'Conectado' : 'Sincronización en la nube'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {supabaseConnected && (
                          <button onClick={handleSupabaseSync} disabled={supabaseSyncing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 disabled:opacity-40 transition-all">
                            {supabaseSyncing ? <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <ArrowDownToLine size={12} />}
                            Sincronizar
                          </button>
                        )}
                        <button onClick={supabaseConnected ? handleSupabaseSignOut : handleSupabaseSignIn}
                          className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            supabaseConnected
                              ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20'
                              : 'bg-accent text-white hover:bg-accent/90'
                          }`}>
                          {supabaseConnected ? 'Desconectar' : 'Conectar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Google Calendar */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                            <Calendar size={15} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-textMain">Google Calendar</p>
                            <p className="text-[10px] text-textDim">
                              {lastCalendarSync
                                ? `Última sincronización: ${new Date(lastCalendarSync).toLocaleString()}`
                                : 'Sincroniza tus eventos de estudio'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCalendarSync} disabled={!googleConnected || syncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-[11px] font-semibold hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                          {syncing ? <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={12} />}
                          Sincronizar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Google Tasks */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-yellow-500/15 flex items-center justify-center">
                            <ListTodo size={15} className="text-yellow-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-textMain">Google Tasks</p>
                            <p className="text-[10px] text-textDim">{tasks.length} tareas locales para sincronizar</p>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleTasksSync} disabled={!googleConnected || syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 text-[11px] font-semibold hover:bg-yellow-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {syncing ? <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={12} />}
                        Sincronizar tareas
                      </button>
                    </div>
                  </div>

                  {/* YouTube Music */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
                          <PlayCircle size={15} className="text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-textMain">YouTube Music</p>
                          <p className="text-[10px] text-textDim">Busca música de estudio / lofi</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <input type="text" value={ytSearch} onChange={e => setYtSearch(e.target.value)}
                          placeholder="lofi hip hop, study music..."
                          className="flex-1 h-9 px-3 rounded-lg bg-background border border-borderDark text-xs text-textMain placeholder:text-textDim outline-none focus:border-accent transition-colors"
                          onKeyDown={e => e.key === 'Enter' && handleYouTubeSearch()} />
                        <button onClick={handleYouTubeSearch} disabled={!googleConnected || syncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                          <Search size={12} /> Buscar
                        </button>
                      </div>
                      {ytResults.length > 0 && (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll">
                          {ytResults.map(r => (
                            <a key={r.videoId} href={`https://youtube.com/watch?v=${r.videoId}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-background transition-colors group">
                              <img src={r.thumbnail} alt="" className="w-10 h-7 rounded object-cover shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-textMain truncate">{r.title}</p>
                                <p className="text-[9px] text-textDim">{r.channel}</p>
                              </div>
                              <ExternalLink size={10} className="text-textDim opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Google Classroom */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                            <GraduationCap size={15} className="text-purple-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-textMain">Google Classroom</p>
                            <p className="text-[10px] text-textDim">{courses.length} cursos en OWA Studio</p>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleClassroomImport} disabled={!googleConnected || syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-[11px] font-semibold hover:bg-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {syncing ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : <Upload size={12} />}
                        Importar cursos
                      </button>
                    </div>
                  </div>

                  {/* Google Docs */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                            <FileText size={15} className="text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-textMain">Google Docs</p>
                            <p className="text-[10px] text-textDim">{notes.length} notas para exportar</p>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleExportNotes} disabled={!googleConnected || syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-[11px] font-semibold hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {syncing ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Upload size={12} />}
                        Exportar notas a Docs
                      </button>
                      {docsUrl && (
                        <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-2 text-[10px] text-indigo-400 hover:underline">
                          <ExternalLink size={10} /> Abrir en Google Docs
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Google Sheets */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
                            <Sheet size={15} className="text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-textMain">Google Sheets</p>
                            <p className="text-[10px] text-textDim">Exporta estadísticas de estudio</p>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleExportStats} disabled={!googleConnected || syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-[11px] font-semibold hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {syncing ? <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <Sheet size={12} />}
                        Exportar estadísticas
                      </button>
                      {sheetsUrl && (
                        <a href={sheetsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-2 text-[10px] text-green-400 hover:underline">
                          <ExternalLink size={10} /> Abrir en Google Sheets
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Google Drive Backup */}
                  <div className="bg-surface border border-borderDark rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <Database size={15} className="text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-textMain">Google Drive Backup</p>
                            <p className="text-[10px] text-textDim">Respaldos completos en la nube</p>
                          </div>
                        </div>
                      </div>
                      <button onClick={handleDriveBackup} disabled={!googleConnected || syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {syncing ? <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <ArrowDownToLine size={12} />}
                        Respaldar datos
                      </button>
                      {backupUrl && (
                        <a href={backupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400 hover:underline">
                          <ExternalLink size={10} /> Ver en Google Drive
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════ DESCARGAS ═══════════ */}
            {activeTab === 'descargas' && (
              <section>
                <h2 className="text-base font-semibold text-textMain mb-1">Descargas</h2>
                <p className="text-[11px] text-textDim mb-5">Gestión de descargas de música</p>
                <div className="bg-surface border border-borderDark rounded-xl p-5 space-y-5">
                  <div>
                    <label className="block text-[10px] text-textDim font-medium uppercase tracking-wider mb-2">Carpeta de destino</label>
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center gap-3 bg-background border border-borderDark rounded-lg px-3.5 py-2.5 min-w-0">
                        <FolderOpen size={14} className="text-textDim shrink-0" />
                        <span className="text-xs font-medium text-textMain truncate">{downloadPath || 'Descargas/OWA Music'}</span>
                      </div>
                      <button onClick={async () => {
                        try {
                          const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
                          if (folder) { setDownloadPathState(String(folder)); await setDownloadPath(String(folder)); toast.success('Carpeta actualizada'); }
                        } catch { toast.error('No se pudo cambiar la carpeta'); }
                      }} className="bg-background border border-borderDark hover:bg-surface text-textMain px-4 py-2.5 rounded-lg text-xs font-medium transition-colors shrink-0">
                        <FolderOpen size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-textDim font-medium uppercase tracking-wider mb-2">Formato de audio</label>
                    <div className="flex gap-2">
                      {['mp3', 'm4a'].map(f => (
                        <button key={f} onClick={() => setAudioFormat(f as 'mp3' | 'm4a')}
                          className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                            audioFormat === f ? 'bg-accent text-white' : 'bg-background border border-borderDark text-textDim hover:text-textMain'
                          }`}>
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
              <section>
                <h2 className="text-base font-semibold text-textMain mb-1">Sonidos</h2>
                <p className="text-[11px] text-textDim mb-5">Control de alertas y notificaciones</p>
                <div className="space-y-2.5">
                  <Toggle checked={settings.notifications} onChange={v => updateSettings({ notifications: v })}
                    label="Alertas de temporizador" desc="Notificar al completar ciclos de estudio o descansos" />
                  <Toggle checked={settings.soundEffects} onChange={v => updateSettings({ soundEffects: v })}
                    label="Efectos de sonido" desc="Reproducir sonidos al interactuar con la interfaz" />
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
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
    <div className="bg-background border border-borderDark rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={12} style={{ color }} />
        <span className="text-[9px] font-semibold text-textDim uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="number" value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-full bg-surface2 border border-borderDark rounded-lg px-3 py-1.5 text-sm text-textMain font-semibold outline-none focus:border-accent transition-colors"
          min={min} max={max} />
        <span className="text-[10px] text-textDim font-medium shrink-0">{unit}</span>
      </div>
    </div>
  );
}
