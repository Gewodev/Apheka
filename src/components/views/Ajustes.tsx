import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  User, Palette, Brain, Download, Bell,
  Moon, Sun,
  Timer, Zap,
  RefreshCw, Shield,
  Sliders, Music,
  Calendar, Database, Upload,
  Wifi, WifiOff, Image, Coffee, X, Trash2, Save,
  Monitor, Activity, Sparkles, LogOut, Eye, EyeOff, CalendarDays, Clock, ChevronDown,
  FolderOpen, Boxes, AppWindow, HardDrive, Copy, Check, RefreshCcw,
  CheckSquare, GraduationCap, FileText, ExternalLink, Loader2, CalendarPlus, ListTodo, Keyboard
} from 'lucide-react';
import { GoogleCalendarIcon, GoogleTasksIcon, GoogleClassroomIcon, GoogleDriveIcon, GoogleDocsIcon, GoogleSheetsIcon } from '../ui/GoogleIcons';
import { useApp, fmtClock } from '../../store/AppContext';
import CharvisProviders from '../ui/CharvisProviders';
import { del } from 'idb-keyval';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { open, save } from '@tauri-apps/plugin-dialog';
import NotificationBell from '../ui/NotificationBell';
import { copyFile, mkdir, exists, readFile, writeFile, readTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir, appConfigDir, appDataDir, appLocalDataDir, appLogDir, resourceDir, join, extname } from '@tauri-apps/api/path';
import { getVersion, getName, getTauriVersion } from '@tauri-apps/api/app';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import {
  signIn, signOut, isSignedIn, onAuthChange, configureGoogle, restoreSession,
} from '../../lib/google/index';
import { isTauri } from '../../lib/tauri';
import { exportOwaBackup, pickAndImportOwaBackup, importOwaBackupFromFile, getOwaDataFolder, revealOwaDataFolder } from '../../lib/owaBackup';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

type SettingsTab = 'perfil' | 'apariencia' | 'estudio' | 'musica' | 'sistema' | 'notificaciones';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
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

const CHARVIS_COLORS = [
  { name: 'Esmeralda', value: '#34d399' },
  { name: 'Verde LED', value: '#22c55e' },
  { name: 'Cian', value: '#22d3ee' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Violeta', value: '#a78bfa' },
  { name: 'Rosa', value: '#f472b6' },
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Rojo', value: '#ef4444' },
];

const DocsSheetsIcon = ({ size = 17 }: { size?: number }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <GoogleDocsIcon size={size} />
    <GoogleSheetsIcon size={size} />
  </span>
);

const GoogleProfileIcon = ({ size = 15, color = '#5F6368' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ flexShrink: 0, display: 'block' }}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const GOOGLE_SERVICES: { id: string; name: string; desc: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }[] = [
  { id: 'calendar', name: 'Calendar', desc: 'Eventos bidireccionales con tu agenda de Google', icon: GoogleCalendarIcon, color: '#1A73E8' },
  { id: 'tasks', name: 'Tasks', desc: 'Tareas bidireccionales con tu lista de Google', icon: GoogleTasksIcon, color: '#34A853' },
  { id: 'classroom', name: 'Classroom', desc: 'Importa cursos y entregas pendientes', icon: GoogleClassroomIcon, color: '#0F9D58' },
  { id: 'drive', name: 'Drive', desc: 'Crea un respaldo de tus datos en la nube', icon: GoogleDriveIcon, color: '#EA4335' },
  { id: 'docs', name: 'Docs y Sheets', desc: 'Exporta tus notas y estadísticas', icon: DocsSheetsIcon, color: '#4285F4' },
  { id: 'profile', name: 'Perfil', desc: 'Sincroniza foto, nombre y datos de la cuenta', icon: GoogleProfileIcon, color: '#5F6368' },
];

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="bento-card hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
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

function CardHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
        color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 10%, transparent)',
      }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', lineHeight: 1.2 }}>{title}</span>
        {desc && <span style={{ fontSize: 12, color: 'var(--text-primary)', display: 'block', marginTop: 3, fontWeight: 400 }}>{desc}</span>}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, color, last }: { label: string; value: React.ReactNode; mono?: boolean; color?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, color: color || 'var(--text-primary)',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
        textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%',
      }}>{value}</span>
    </div>
  );
}

const fmtBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`;

// ── REAL network measurement (not simulated) ────────────────────────────────
const LATENCY_URL = 'https://www.gstatic.com/generate_204';
const SPEED_URL = 'https://speed.cloudflare.com/__down?bytes=1000000';

async function measureLatency(): Promise<number | null> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      await fetch(LATENCY_URL, { cache: 'no-store', mode: 'cors' });
      samples.push(performance.now() - t0);
    } catch { /* sample perdido */ }
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a - b);
  return Math.round(samples[0]);
}

async function measureDownSpeed(latencyMs: number | null): Promise<number | null> {
  const t0 = performance.now();
  try {
    const res = await fetch(SPEED_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const seconds = (performance.now() - t0) / 1000;
    const corrected = Math.max(seconds - (latencyMs ? latencyMs / 1000 : 0), 0.05);
    return Math.round((buf.byteLength * 8) / (corrected * 1_000_000) * 10) / 10;
  } catch {
    return null;
  }
}

function CopyButton({ text, size }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch { /* sin permisos de portapapeles */ }
    }} title={copied ? '¡Copiado!' : 'Copiar'}
      style={{ width: size || 24, height: size || 24, borderRadius: 6, flexShrink: 0, background: copied ? 'rgba(16,185,129,0.1)' : 'var(--bg-deep)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`, color: copied ? '#10B981' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function Ajustes() {
  const {
    settings, updateSettings, googleConnected, setGoogleConnected,
    setCalendarSyncEnabled, lastCalendarSync, setLastCalendarSync, calendarSyncEnabled,
    triggerCalendarSync, importGoogleEvents, syncCalendarTwoWay, syncTasksTwoWay,
    triggerTasksSync, importGoogleTasks, loadGoogleProfile,
    importClassroomCourses, importClassroomAssignments,
    triggerDriveBackup, exportNotesToGoogleDoc, exportStatsToGoogleSheets,
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
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleBusy, setGoogleBusy] = useState<string | null>(null);
  const [lastTasksSync, setLastTasksSync] = useState<string | null>(null);
  const [serviceResults, setServiceResults] = useState<Record<string, string>>({});
  const [showClearAllMusic, setShowClearAllMusic] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [clearAllMusicText, setClearAllMusicText] = useState('');
  const [appInfo, setAppInfo] = useState<{ name: string; version: string; tauriVersion: string } | null>(null);
  const [appDirs, setAppDirs] = useState<{ label: string; path: string; root?: boolean }[]>([]);
  const [idbUsage, setIdbUsage] = useState<number | null>(null);
  const [storageQuota, setStorageQuota] = useState<number | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [dataFolder, setDataFolder] = useState('');
  const backupFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTauri()) return;
    getOwaDataFolder().then(d => { if (d) setDataFolder(d); }).catch(() => {});
  }, []);

  const handleExportBackup = async () => {
    const res = await exportOwaBackup();
    addNotification(res.message, res.ok ? 'success' : 'error');
  };

  const handleImportBackup = async () => {
    if (!isTauri()) { backupFileRef.current?.click(); return; }
    const res = await pickAndImportOwaBackup();
    addNotification(res.message, res.ok ? 'success' : 'error');
    if (res.ok) setTimeout(() => window.location.reload(), 800);
  };

  const handleBackupFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await importOwaBackupFromFile(file);
    addNotification(res.message, res.ok ? 'success' : 'error');
    if (res.ok) setTimeout(() => window.location.reload(), 800);
    e.target.value = '';
  };

  const handleRevealData = async () => {
    const dir = await revealOwaDataFolder();
    if (dir) {
      addNotification(`Carpeta de datos: ${dir}`, 'success');
    } else {
      addNotification('La carpeta de datos solo está disponible en la app instalada', 'error');
    }
  };

  // Peso de la app: uso de la base de datos IndexedDB (localStorage se mide directo).
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      navigator.storage.estimate().then(e => {
        setIdbUsage(typeof e.usage === 'number' ? e.usage : null);
        setStorageQuota(typeof e.quota === 'number' ? e.quota : null);
      }).catch(() => { setIdbUsage(null); setStorageQuota(null); });
    }
  }, []);

  // ─── Charvis configuration state ───
  const [capturingShortcut, setCapturingShortcut] = useState(false);

  useEffect(() => {
    if (!capturingShortcut) return;
    document.body.dataset.capturingShortcut = '1';
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const mods: string[] = [];
      if (e.altKey) mods.push('Alt');
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.shiftKey) mods.push('Shift');
      if (e.metaKey) mods.push('Meta');
      if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;
      const combo = [...mods, e.code].join('+');
      if (!mods.length) {
        addNotification('Añade al menos un modificador (Alt, Ctrl, Shift o Meta)', 'error');
        return;
      }
      updateSettings({ owaBrainShortcut: combo });
      setCapturingShortcut(false);
      addNotification(`Atajo actualizado: ${combo.replace('Key', ' ').replace('+', ' + ')}`, 'success');
    };
    window.addEventListener('keydown', handler, true);
    return () => {
      delete document.body.dataset.capturingShortcut;
      window.removeEventListener('keydown', handler, true);
    };
  }, [capturingShortcut, updateSettings, addNotification]);

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { addNotification('El archivo debe ser una imagen', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { addNotification('La imagen debe pesar menos de 5 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ profilePhoto: reader.result as string });
      addNotification('Foto de perfil actualizada', 'success');
    };
    reader.onerror = () => addNotification('No se pudo leer la imagen', 'error');
    reader.readAsDataURL(file);
  };

  // Internet / network status — datos reales medidos, no simulados
  const [netInfo, setNetInfo] = useState<{
    online: boolean;
    type?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    latency?: number | null;
    downSpeed?: number | null;
    lastChecked?: string;
    checking?: boolean;
  }>(() => ({ online: typeof navigator !== 'undefined' ? navigator.onLine : true }));
  const [speedTesting, setSpeedTesting] = useState(false);
  const [showNet, setShowNet] = useState(false);
  const netRef = useRef<HTMLDivElement>(null);
  const netBusyRef = useRef(false);
  const downSpeedRef = useRef<number | null>(null);

  const refreshNet = async (opts?: { speed?: boolean }) => {
    if (netBusyRef.current) return;
    netBusyRef.current = true;
    if (!navigator.onLine) {
      setNetInfo(n => ({ ...n, online: false, latency: null, downSpeed: null, lastChecked: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }));
      netBusyRef.current = false;
      return;
    }
    setNetInfo(n => ({ ...n, checking: true }));
    const latency = await measureLatency();
    let downSpeed = downSpeedRef.current;
    if (opts?.speed) {
      setSpeedTesting(true);
      downSpeed = await measureDownSpeed(latency);
      downSpeedRef.current = downSpeed;
      setSpeedTesting(false);
    }
    setNetInfo(n => ({
      ...n,
      online: true,
      latency,
      downSpeed,
      checking: false,
      lastChecked: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));
    netBusyRef.current = false;
  };

  useEffect(() => {
    const update = () => {
      const c = (navigator as any).connection;
      setNetInfo(prev => ({
        ...prev,
        online: navigator.onLine,
        type: c?.type as string | undefined,
        effectiveType: c?.effectiveType as string | undefined,
        downlink: c?.downlink != null ? Number(c.downlink) : undefined,
        rtt: c?.rtt != null ? Number(c.rtt) : undefined,
        saveData: c?.saveData,
      }));
    };
    update();
    const onOnline = () => { update(); refreshNet(); };
    const onOffline = () => { update(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const c = (navigator as any).connection;
    if (c?.addEventListener) {
      c.addEventListener('change', update);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        c.removeEventListener('change', update);
      };
    }
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      if (navigator.onLine) refreshNet();
    }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (netRef.current && !netRef.current.contains(e.target as Node)) setShowNet(false);
    };
    if (showNet) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showNet]);

  // Cargar información real de la app (no del equipo)
  useEffect(() => {
    if (!isTauri()) {
      setAppInfo({ name: 'OWA Studio', version: '1.0.0', tauriVersion: '—' });
      return;
    }
    (async () => {
      try {
        const [name, version, tauriVersion] = await Promise.all([getName(), getVersion(), getTauriVersion()]);
        setAppInfo({ name, version, tauriVersion });
        const [data, config, local, cache, log, res] = await Promise.all([appDataDir(), appConfigDir(), appLocalDataDir(), appCacheDir(), appLogDir(), resourceDir()]);
        setAppDirs([
          { label: 'Carpeta de datos', path: data },
          { label: 'Carpeta de configuración', path: config },
          { label: 'Carpeta local', path: local },
          { label: 'Carpeta de caché', path: cache },
          { label: 'Carpeta de registros', path: log },
          { label: 'Carpeta raíz (recursos)', path: res, root: true },
        ]);
      } catch (e) {
        console.error('Error cargando información de la app', e);
      }
    })();
  }, []);

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
    if (!GOOGLE_CLIENT_ID) return;
    configureGoogle(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    let mounted = true;
    restoreSession().then(ok => {
      if (!mounted) return;
      setGoogleConnected(ok);
      if (ok) {
        loadGoogleProfile().then(profile => {
          if (mounted && profile) setGoogleProfile(profile);
        });
      }
    });
    const unsub = onAuthChange(connected => setGoogleConnected(connected));
    return () => { mounted = false; unsub(); };
  }, [loadGoogleProfile, setGoogleConnected]);

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

  const openGoogleUrl = (url: string | null | undefined) => {
    if (!url) { addNotification('No se pudo generar el enlace', 'error'); return; }
    if (isTauri()) {
      openUrl(url).catch(() => window.open(url, '_blank'));
    } else {
      window.open(url, '_blank');
    }
  };

  const syncAllGoogle = async () => {
    if (googleBusy) return;
    setGoogleBusy('all');
    try {
      const rc = await syncCalendarTwoWay();
      const rt = await syncTasksTwoWay();
      setLastTasksSync(new Date().toISOString());
      if (rc.errors > 0 || rt.errors > 0) addNotification('Sync completado con algunos errores', 'error');
      else addNotification(`Sync completo: Calendar ${rc.pushed} enviados, Tasks ${rt.pushed} enviadas`, 'success');
    } catch {
      addNotification('Error al sincronizar con Google', 'error');
    } finally {
      setGoogleBusy(null);
    }
  };

  const runGoogleService = async (id: string) => {
    if (googleBusy) return;
    setGoogleBusy(id);
    try {
      switch (id) {
        case 'calendar': {
          const r = await syncCalendarTwoWay();
          if (r.errors > 0) addNotification('Calendar: hubo errores al sincronizar', 'error');
          else addNotification(`Calendar: ${r.pushed} enviados a Google, ${r.created} nuevos en la app`, 'success');
          break;
        }
        case 'tasks': {
          const r = await syncTasksTwoWay();
          setLastTasksSync(new Date().toISOString());
          if (r.errors > 0) addNotification('Tasks: hubo errores al sincronizar', 'error');
          else addNotification(`Tasks: ${r.pushed} enviadas a Google, ${r.created} nuevas en la app`, 'success');
          break;
        }
        case 'classroom': {
          await importClassroomCourses();
          const n = await importClassroomAssignments();
          addNotification(n > 0 ? `Classroom: ${n} entregas importadas como tareas` : 'Classroom: cursos importados', 'success');
          break;
        }
        case 'drive': {
          const url = await triggerDriveBackup();
          if (url) { addNotification('Respaldo creado en Google Drive', 'success'); openGoogleUrl(url); }
          else addNotification('No se pudo crear el respaldo en Drive', 'error');
          break;
        }
        case 'docs': {
          const url = await exportNotesToGoogleDoc();
          openGoogleUrl(url);
          break;
        }
        case 'profile': {
          const p = await loadGoogleProfile();
          if (p) { setGoogleProfile(p); addNotification('Perfil de Google actualizado', 'success'); }
          else addNotification('No se pudo actualizar el perfil', 'error');
          break;
        }
      }
    } catch (e) {
      console.error('Google service failed:', e);
      addNotification('Error al ejecutar la acción de Google', 'error');
    } finally {
      setGoogleBusy(null);
    }
  };

  const handleFontChange = (font: string) => {
    updateSettings({ fontFamily: font });
    document.documentElement.style.setProperty('--font-primary', font);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HEADER ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26, paddingTop: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", margin: 0 }}>Configuración</h1>
            <Sliders size={17} style={{ color: 'var(--accent)', opacity: 0.9 }} />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 5, fontWeight: 300, letterSpacing: '0.03em' }}>Personaliza cada aspecto de tu entorno</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Internet status — datos reales medidos de la conexión */}
          <div ref={netRef} style={{ position: 'relative' }}>
            <button onClick={() => { setShowNet(!showNet); if (!showNet && navigator.onLine) refreshNet(); }} className="btn-ghost"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 12,
                border: `1px solid ${netInfo.online ? 'var(--border-default)' : 'rgba(239,68,68,0.4)'}`,
                background: netInfo.online ? 'var(--bg-elevated-alpha, var(--bg-elevated))' : 'rgba(239,68,68,0.08)',
                cursor: 'pointer', transition: 'all 200ms', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
              }}>
              {netInfo.online ? <Wifi size={15} style={{ color: '#10B981' }} /> : <WifiOff size={15} style={{ color: '#EF4444' }} />}
              <span style={{ color: netInfo.online ? '#10B981' : '#EF4444' }}>{netInfo.online ? 'Conectado' : 'Sin conexión'}</span>
              {netInfo.online && netInfo.latency != null && (
                <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", paddingLeft: 8, borderLeft: '1px solid var(--border-subtle)' }}>
                  {netInfo.latency} ms
                </span>
              )}
              <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', transform: showNet ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>

            {showNet && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 280, zIndex: 60,
                background: 'color-mix(in srgb, var(--bg-elevated) 96%, transparent)', border: '1px solid var(--border-default)',
                borderRadius: 14, padding: 16, boxShadow: '0 18px 44px rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: netInfo.online ? '#10B981' : '#EF4444', boxShadow: `0 0 8px ${netInfo.online ? '#10B981' : '#EF4444'}` }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{netInfo.online ? 'Conexión activa' : 'Sin conexión a internet'}</span>
                </div>
                {[
                  { label: 'Estado', value: netInfo.online ? 'En línea' : 'Desconectado', color: netInfo.online ? '#10B981' : '#EF4444' },
                  { label: 'Tipo de red', value: netInfo.type ? ({ wifi: 'Wi-Fi', ethernet: 'Ethernet (cable)', cellular: 'Datos móviles', wimax: 'WiMax', bluetooth: 'Bluetooth', other: 'Otra', none: 'Sin red', unknown: 'Desconocida' } as Record<string, string>)[netInfo.type] || netInfo.type : '—' },
                  { label: 'Conectividad', value: netInfo.effectiveType ? ({ 'slow-2g': '2G lenta', '2g': '2G', '3g': '3G', '4g': '4G / 5G' } as Record<string, string>)[netInfo.effectiveType] || netInfo.effectiveType.toUpperCase() : '—' },
                  { label: 'Latencia (medida)', value: netInfo.latency != null ? `${netInfo.latency} ms` : (netInfo.checking ? 'Midiendo…' : '—'), color: netInfo.latency != null ? (netInfo.latency < 60 ? '#10B981' : netInfo.latency < 150 ? '#F59E0B' : '#EF4444') : undefined },
                  { label: 'Descarga (medida)', value: speedTesting ? 'Probando…' : netInfo.downSpeed != null ? `${netInfo.downSpeed} Mbps` : 'Pulsa "Medir"', color: netInfo.downSpeed != null ? (netInfo.downSpeed >= 10 ? '#10B981' : netInfo.downSpeed >= 3 ? '#F59E0B' : '#EF4444') : undefined },
                  { label: 'Ahorro de datos', value: netInfo.saveData ? 'Activado' : 'Desactivado' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 11, padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{row.label}</span>
                    <span style={{ color: row.color || 'var(--text-primary)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => refreshNet({ speed: true })} disabled={speedTesting || !netInfo.online}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                      background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)',
                      opacity: speedTesting || !netInfo.online ? 0.5 : 1, transition: 'all 150ms',
                    }}>
                    <RefreshCcw size={12} /> {speedTesting ? 'Midiendo…' : 'Medir conexión'}
                  </button>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.4, paddingTop: 4 }}>
                  {netInfo.lastChecked ? `Comprobado a las ${netInfo.lastChecked} · medición real, no estimada.` : 'Latencia y descarga se miden en tiempo real.'}
                </div>
              </div>
            )}
          </div>

          <NotificationBell />

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16, position: 'relative' }}>
            {/* Clock background illumination */}
            <div style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              width: 110,
              height: 72,
              background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)',
              opacity: 0.35,
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              zIndex: 0
            }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
              <div className="led-display" style={{ fontSize: 25, lineHeight: 1, color: 'var(--accent)', textShadow: '0 0 15px var(--accent-glow)' }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 13, color: 'var(--accent)', opacity: 0.8 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4, position: 'relative', zIndex: 1 }}>
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                onMouseEnter={e => { if (activeTab !== tab.id) { e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                onMouseLeave={e => { if (activeTab !== tab.id) { e.currentTarget.style.background = 'transparent'; } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, position: 'relative',
                  background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 28%, transparent)' : 'transparent'}`,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms'
                }}>
                {active && <span style={{ position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)', width: 3, height: 22, borderRadius: 2, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />}
                <Icon size={17} style={{ opacity: active ? 1 : 0.85 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* MAIN AREA */}
        <main className="bento-card" style={{ flex: 1, padding: '32px 40px', minHeight: 600 }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>

            {/* â•â•â•â•â•â•â•â•â•â•â• PERFIL â•â•â•â•â•â•â•â•â•â•â• */}
            {activeTab === 'perfil' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      <User size={15} />
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Perfil de Usuario</h2>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Tu identidad y conexiones en OWA Studio</p>
                </div>

                {/* Avatar + Nombre + Foto */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ flexShrink: 0 }}>
                    {settings.profilePhoto ? (
                      <div style={{ width: 108, height: 108, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent), 0 8px 24px rgba(0,0,0,0.25)', background: 'var(--bg-deep)' }}>
                        <img src={settings.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--accent-dim)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 300, color: 'var(--accent)', fontFamily: "'Inter Tight', sans-serif" }}>
                        {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'O'}
                      </div>
                    )}
                    <input ref={profilePhotoInputRef} type="file" accept="image/*" onChange={handleProfilePhotoUpload} style={{ display: 'none' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre</label>
                      <input type="text" value={settings.userName}
                        onChange={e => updateSettings({ userName: e.target.value })}
                        className="input-base" style={{ width: '100%', height: 40, fontSize: 14, fontWeight: 500 }}
                        placeholder="Tu nombre" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => profilePhotoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)', color: 'var(--accent)', transition: 'all 150ms' }}>
                        <Image size={14} /> {settings.profilePhoto ? 'Cambiar foto' : 'Subir foto desde tu equipo'}
                      </button>
                      {settings.profilePhoto && (
                        <button onClick={() => updateSettings({ profilePhoto: undefined })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444', transition: 'all 150ms' }}>
                          <Trash2 size={13} /> Quitar
                        </button>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: 200 }}>
                        Se guarda localmente en tu dispositivo. JPG, PNG o WebP (máx. 5 MB).
                      </span>
                    </div>
                  </div>
                </div>

                {/* Connected Services */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', marginBottom: 16 }}>Autenticación y Nube</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Google */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {googleConnected && googleProfile?.photoUrl ? (
                          <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', flexShrink: 0 }}>
                            <img src={googleProfile.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                          </div>
                        ) : (
                          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{googleProfile?.displayName || 'Google'}</span>
                          <span style={{ fontSize: 10, color: googleConnected ? '#10B981' : 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>{googleConnected ? (googleProfile?.email || 'Conectado') : 'Desconectado'}</span>
                        </div>
                      </div>
                      <button onClick={() => { if (googleConnected) { handleGoogleSignOut(); } else { setShowGoogleModal(true); } }}
                        style={{ fontSize: 10, fontWeight: 600, padding: '0 14px', height: 30, borderRadius: 6, cursor: 'pointer', border: googleConnected ? '1px solid rgba(239,68,68,0.2)' : 'none', background: googleConnected ? 'rgba(239,68,68,0.08)' : '#4285F4', color: googleConnected ? '#EF4444' : '#fff', transition: 'all 150ms' }}>
                        {googleConnected ? 'Desconectar' : 'Conectar'}
                      </button>
                    </div>
                  </div>
                  {googleConnected && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => { signOut(); setGoogleConnected(false); setCalendarSyncEnabled(false); setLastCalendarSync(null); setGoogleProfile(null); addNotification('Google desconectado exitosamente', 'success'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms', width: 'fit-content' }}>
                        <LogOut size={14} /> Cerrar sesión de Google
                      </button>
                    </div>
                  )}
                </div>

                {/* Servicios de Google */}
                {googleConnected && (
                  <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', marginBottom: 4 }}>Servicios de Google</h3>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cada servicio explica cómo se usa dentro de OWA</span>
                      </div>
                      <button onClick={syncAllGoogle}
                        disabled={!!googleBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)', color: 'var(--accent)', opacity: googleBusy ? 0.6 : 1, transition: 'all 150ms' }}>
                        <RefreshCcw size={13} className={googleBusy ? 'spin' : ''} /> Sincronizar todo
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 12, cursor: 'pointer' }} onClick={() => { setCalendarSyncEnabled(!calendarSyncEnabled); if (!calendarSyncEnabled) addNotification('Sincronización automática activada', 'success'); }}>
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Sincronización automática</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.4 }}>Calendar y Tasks se sincronizan al iniciar la app y cada 15 minutos</span>
                      </div>
                      <div style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, background: calendarSyncEnabled ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)', transition: 'all 200ms', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 2 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: calendarSyncEnabled ? 'translateX(18px)' : 'translateX(0)', transition: 'all 200ms', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))', gap: 10 }}>
                      {GOOGLE_SERVICES.map(s => {
                        const Icon = s.icon;
                        const busy = googleBusy === s.id;
                        const okLabel = s.id === 'calendar' ? (lastCalendarSync ? `Última: ${new Date(lastCalendarSync).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : null)
                          : s.id === 'tasks' ? (lastTasksSync ? `Última: ${new Date(lastTasksSync).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : null)
                          : serviceResults[s.id];
                        return (
                          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', transition: 'border-color 150ms' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${s.color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`, color: s.color, flexShrink: 0 }}>
                                <Icon size={15} color={s.color} />
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{s.name}</span>
                                <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', display: 'block', lineHeight: 1.35 }}>{okLabel || 'No sincronizado aún'}</span>
                              </div>
                            </div>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{s.desc}</span>
                            <button onClick={() => runGoogleService(s.id)} disabled={!!googleBusy}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 28, borderRadius: 7, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', background: `color-mix(in srgb, ${s.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${s.color} 26%, transparent)`, color: s.color, opacity: googleBusy ? 0.6 : 1, transition: 'all 150ms' }}>
                              {busy ? <Loader2 size={12} className="spin" /> : s.id === 'drive' || s.id === 'docs' ? <ExternalLink size={12} /> : <RefreshCcw size={12} />}
                              {busy ? 'Trabajando…' : s.id === 'calendar' ? 'Sincronizar ahora' : s.id === 'tasks' ? 'Sincronizar ahora' : s.id === 'classroom' ? 'Importar cursos' : s.id === 'drive' ? 'Crear respaldo' : s.id === 'docs' ? 'Exportar notas' : 'Actualizar perfil'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Apariencia */}
            {activeTab === 'apariencia' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                          <Palette size={15} />
                        </span>
                        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Apariencia y Diseño</h2>
                      </div>
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
                          flex: 1, padding: '14px 12px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      <Brain size={15} />
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Tiempos y Metas de Estudio</h2>
                  </div>
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

                {/* Colores de Temporizadores */}
                <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      <Music size={15} />
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Configuración de Música</h2>
                  </div>
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
                          flex: 1, padding: '14px 12px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
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
                          flex: 1, padding: '14px 12px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
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

                {/* Reproducción — grouped card for toggles + info */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Reproducción y Descargas
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Toggle checked={settings.includeCover !== false} onChange={v => updateSettings({ includeCover: v })}
                      label="Incluir portada" desc="Incrustar la imagen de portada en el archivo de audio descargado." />
                    <Toggle checked={settings.autoRetryOnError !== false} onChange={v => updateSettings({ autoRetryOnError: v })}
                      label="Reintentar al fallar" desc="Reintentar automáticamente la reproducción hasta 3 veces si ocurre un error de audio." />
                  </div>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    Las canciones descargadas se guardan en la carpeta configurada del sistema. Puedes cambiarla desde la sección de música.
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

                {/* Respaldo de biblioteca */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Save size={14} style={{ color: 'var(--accent)' }} /> Respaldo de Música
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

                {/* Zona de Peligro */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Trash2 size={14} style={{ color: '#EF4444' }} />
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', margin: 0 }}>Zona de Peligro</h3>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 14 }}>Acciones destructivas sobre tu biblioteca y datos de tareas. No se pueden deshacer.</p>
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

            {activeTab === 'notificaciones' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      <Bell size={15} />
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Sonidos y Alertas de Sistema</h2>
                  </div>
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
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Prueba de Notificaciones</span>
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
                </div>
              </section>
            )}

            {/* SISTEMA */}
            {activeTab === 'sistema' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      <Shield size={15} />
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Sistema</h2>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 300, letterSpacing: '0.02em' }}>Información de la aplicación, sus datos y almacenamiento local</p>
                </div>

                {/* App info */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<AppWindow size={14} />} title="Sobre OWA" desc="Aplicación instalada" />
                  <div>
                    <InfoRow label="Nombre" value={appInfo?.name || 'OWA Studio'} mono />
                    <InfoRow label="Versión" value={appInfo?.version || '6.7'} mono />
                    <InfoRow label="Tauri" value={appInfo?.tauriVersion || '—'} mono />
                    <InfoRow label="Entorno" value={isTauri() ? 'Aplicación nativa (Tauri)' : 'Navegador web'} last />
                  </div>
                </div>

                {/* Peso de la app */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<Database size={14} />} title="Peso de la app" desc="En qué se gastan los datos guardados" />
                  {(() => {
                    const keys = Object.keys(localStorage);
                    let lsTotal = 0;
                    const entries: { key: string; size: number }[] = [];
                    for (const k of keys) {
                      const sz = new Blob([localStorage.getItem(k) || '']).size;
                      lsTotal += sz;
                      entries.push({ key: k, size: sz });
                    }
                    const idb = idbUsage ?? 0;
                    const grand = lsTotal + idb;
                    const KNOWN: [string, string, string][] = [
                      ['owa_studio', 'Datos de la app', '#6366F1'],
                      ['owa_course', 'Cursos', '#F59E0B'],
                      ['owa_planner', 'Planificador', '#3B82F6'],
                      ['owa_sched', 'Horario', '#06B6D4'],
                      ['owa_habit', 'Hábitos', '#10B981'],
                      ['owa_study', 'Estudio', '#EF4444'],
                      ['owa_estudio', 'Estudio', '#EF4444'],
                      ['owa_timer', 'Temporizador', '#EC4899'],
                      ['owa_task', 'Tareas', '#8B5CF6'],
                      ['owa_note', 'Notas', '#F472B6'],
                      ['owa_music', 'Música', '#10B981'],
                      ['owa_yt', 'Música', '#10B981'],
                      ['owa_brain', 'Charvis', '#22c55e'],
                      ['owa_charvis', 'Charvis', '#22c55e'],
                      ['owa_google', 'Google', '#4285F4'],
                      ['owa_event', 'Eventos', '#3B82F6'],
                    ];
                    const groups = new Map<string, { size: number; color: string }>();
                    for (const [prefix, label, color] of KNOWN) {
                      const sum = entries.filter(e => e.key.startsWith(prefix)).reduce((a, e) => a + e.size, 0);
                      if (sum > 0) {
                        const g = groups.get(label) || { size: 0, color };
                        g.size += sum;
                        groups.set(label, g);
                      }
                    }
                    const other = entries.filter(e => !KNOWN.some(([p]) => e.key.startsWith(p))).reduce((a, e) => a + e.size, 0);
                    if (other > 0) groups.set('Otras claves', { size: other, color: '#6B7280' });
                    const rows: { label: string; size: number; color: string }[] = [];
                    for (const [label, g] of groups) rows.push({ label, size: g.size, color: g.color });
                    if (idb > 0) rows.push({ label: 'Base de datos (IndexedDB)', size: idb, color: '#9CA3AF' });
                    rows.sort((a, b) => b.size - a.size);
                    const barMax = Math.max(1, rows.length ? rows[0].size : 1);
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)', marginBottom: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Peso total</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace" }}>{fmtBytes(grand)}</span>
                        </div>
                        {(() => {
                          const quota = storageQuota && storageQuota > 0 ? storageQuota : 0;
                          const totalPct = quota > 0 ? Math.min(100, (grand / quota) * 100) : 0;
                          const totalColor = totalPct >= 80 ? '#EF4444' : totalPct >= 55 ? '#F59E0B' : '#10B981';
                          return quota > 0 ? (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Uso de almacenamiento</span>
                                <span style={{ fontSize: 9.5, fontFamily: "'Share Tech Mono', monospace", color: totalColor }}>{totalPct.toFixed(1)}% de {fmtBytes(quota)}</span>
                              </div>
                              <div style={{ height: 8, borderRadius: 6, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.28)' }}>
                                <div style={{ height: '100%', width: `${Math.max(0.6, totalPct)}%`, borderRadius: 6, background: `linear-gradient(90deg, ${totalColor}88, ${totalColor})`, boxShadow: `0 0 12px ${totalColor}55`, transition: 'width 400ms ease' }} />
                              </div>
                            </div>
                          ) : null;
                        })()}
                        {rows.map(r => {
                          const pct = grand > 0 ? (r.size / grand) * 100 : 0;
                          return (
                            <div key={r.label} style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                                <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  <span style={{ width: 9, height: 9, borderRadius: 3, background: `linear-gradient(135deg, ${r.color}, ${r.color}77)`, boxShadow: `0 0 6px ${r.color}55`, flexShrink: 0 }} />
                                  {r.label}
                                </span>
                                <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: 'var(--text-muted)', flexShrink: 0 }}>
                                  {fmtBytes(r.size)} <span style={{ color: r.color }}>· {pct.toFixed(1)}%</span>
                                </span>
                              </div>
                              <div style={{ height: 7, borderRadius: 5, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.28)' }}>
                                <div style={{ height: '100%', width: `${Math.max(1.5, (r.size / barMax) * 100)}%`, borderRadius: 5, background: `linear-gradient(180deg, ${r.color}ee, ${r.color}77)`, boxShadow: `0 0 10px ${r.color}44`, transition: 'width 400ms ease', position: 'relative' }}>
                                  <div style={{ position: 'absolute', inset: '0 0 50% 0', background: 'rgba(255,255,255,0.16)', borderRadius: 5 }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                          {keys.length} claves en localStorage · {idb > 0 ? `la base de datos IndexedDB ocupa ${fmtBytes(idb)}` : 'la base de datos IndexedDB no está disponible en este navegador'}.
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Charvis */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<Brain size={14} />} title="Charvis" desc="Asistente de IA que controla tu aplicación" />

                  {/* Motor siempre activo + atajo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 15px', borderRadius: 11, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <span style={{ position: 'relative', width: 13, height: 13, flexShrink: 0, display: 'inline-block' }}>
                        <span style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981, 0 0 4px #10B981 inset' }} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Motor de IA activo</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.4 }}>Chat lateral con herramientas que controlan toda la app</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setCapturingShortcut(true); addNotification('Pulsa la nueva combinación de teclas…', 'info'); }}
                      title="Cambiar atajo de teclado"
                      style={{
                        height: 34, borderRadius: 9, cursor: 'pointer', padding: '0 12px',
                        background: capturingShortcut ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-deep)',
                        border: `1px solid ${capturingShortcut ? 'var(--accent)' : 'var(--border-default)'}`,
                        color: capturingShortcut ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 11.5, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        transition: 'all 150ms', flexShrink: 0,
                      }}
                    >
                      {capturingShortcut ? <><Keyboard size={13} /> Pulsa la combinación…</> : <><Keyboard size={13} /> {(settings.owaBrainShortcut || 'Alt+KeyQ').replace(/Key/g, '').split('+').join(' + ')}</>}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>El motor siempre está habilitado. Ábrelo con el atajo o pasando el ratón por el borde derecho.</p>

                  {/* Proveedores de IA */}
                  <CharvisProviders />

                  {/* Charvis color */}
                  <div style={{ marginTop: 18 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Color de Charvis</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 8, marginBottom: 8 }}>
                      {CHARVIS_COLORS.map(c => {
                        const active = (settings.owaBrainColor || '#34d399').toLowerCase() === c.value;
                        return (
                          <button key={c.value} title={c.name} onClick={() => updateSettings({ owaBrainColor: c.value } as any)}
                            style={{ height: 30, borderRadius: 9, background: c.value, border: active ? '2px solid #fff' : '1px solid var(--border-default)', cursor: 'pointer', position: 'relative', boxShadow: active ? `0 0 0 2px ${c.value}55, 0 0 14px ${c.value}66` : 'none', transition: 'all 150ms' }}>
                            {active && <Check size={14} style={{ color: '#0b0b0f', position: 'absolute', inset: 0, margin: 'auto' }} />}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>Color unicolor del acento de Charvis (LED, burbujas y glow). El efecto arcoíris solo se activa en modo profundo.</p>
                  </div>
                </div>

                {/* App folders */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<FolderOpen size={14} />} title="Rutas de la aplicación" desc="Dónde guarda OWA sus datos" />
                  {isTauri() ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {appDirs.map((d, i) => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < appDirs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 7, background: d.root ? 'rgba(16,185,129,0.08)' : 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: d.root ? '#10B981' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {d.root ? <Boxes size={13} /> : <HardDrive size={13} />}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{d.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.path}>{d.path}</div>
                          </div>
                          <CopyButton text={d.path} />
                          <button onClick={() => { openPath(d.path).catch(() => addNotification('No se pudo abrir la carpeta', 'error')); }}
                            title="Abrir en el Explorador" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FolderOpen size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      Las rutas de carpetas solo están disponibles dentro de la aplicación nativa.
                    </p>
                  )}
                </div>

                {/* Cache & Storage */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
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
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Total localStorage</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace" }}>{fmtBytes(totalSize)} ({keys.length} entradas)</span>
                          </div>
                          {items.sort((a, b) => b.size - a.size).slice(0, 6).map(it => (
                            <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.key}</span>
                              <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>{fmtBytes(it.size)}</span>
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

                {/* Formato de Hora */}
                <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

                {/* Respaldo y migración */}
                <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Respaldo y migración de datos</span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    Exporta todo tu contenido (notas, tareas, cursos, eventos, hábitos, música, ajustes) a un archivo
                    para pasarlo a otra computadora o a una futura versión. Al instalar una versión nueva sobre esta
                    app, tus datos se conservan automáticamente. Las cuentas y claves de Google no se incluyen en el
                    respaldo por seguridad (se reconectan al importar).
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={handleExportBackup} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)' }}>
                      <Download size={14} /> Exportar respaldo
                    </button>
                    <button onClick={handleImportBackup} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}>
                      <Upload size={14} /> Importar respaldo
                    </button>
                    <button onClick={handleRevealData} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}>
                      <FolderOpen size={14} /> Abrir carpeta de datos
                    </button>
                  </div>
                  {dataFolder && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Share Tech Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dataFolder}>
                      {dataFolder}
                    </div>
                  )}
                  <input ref={backupFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleBackupFilePicked} />
                </div>

                {/* Hecho por */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '18px 0 6px' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hecho por</span>
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>MaxCB</span>
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
                    <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-deep)', flexShrink: 0 }}>
                      <img src={googleProfile.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                    </div>
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

