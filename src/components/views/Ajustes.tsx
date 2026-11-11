import MusicConnectionSettings from '../music/MusicConnectionSettings';
import CommandsSettings from '../ui/CommandsSettings';
import AppearanceStudio from '../ui/AppearanceStudio';
import {useAppSlice} from "../../store/AppContext";
import BackgroundGallery from '../ui/BackgroundGallery';
import WorkspaceAppearance from '../ui/WorkspaceAppearance';
import BackgroundMotionControls from '../ui/BackgroundMotionControls';
import { FLOATING_FONTS } from '../../lib/floatingFonts';
import FloatingVisibilityControls from '../ui/FloatingVisibilityControls';
import DurationControl from '../ui/DurationControl';
import WorkspaceHeader from '../ui/WorkspaceHeader';
﻿import React, { useEffect, useState, useRef, useMemo } from 'react';
import LiveClock from '../ui/LiveClock';
import {
  User, Palette, Brain, Download, Bell, Search, Keyboard,
  Moon, Sun,
  Timer, Zap,
  RefreshCw, Shield, ShieldCheck,
  Sliders, Music, Plug,
  Database, Upload,
  Wifi, WifiOff, Image, Coffee, X, Trash2, Save,
  Monitor, Activity, Sparkles, LogOut, Eye, EyeOff, CalendarDays, Clock, ChevronDown,
  FolderOpen, Boxes, AppWindow, HardDrive, Copy, Check, RefreshCcw,
  CheckSquare, GraduationCap, FileText, ExternalLink, Loader2, CalendarPlus, ListTodo, Minus, Plus,
  BookOpen, Sprout, Star, Waves, Leaf, Circle
} from 'lucide-react';
import { GoogleCalendarIcon, GoogleTasksIcon, GoogleClassroomIcon, GoogleDriveIcon, GoogleDocsIcon, GoogleSheetsIcon } from '../ui/GoogleIcons';
import { useApp, fmtClock } from '../../store/AppContext';
import { del } from 'idb-keyval';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import NotificationBell from '../ui/NotificationBell';
import { copyFile, mkdir, exists, readFile, writeFile, writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir, appConfigDir, appDataDir, appLocalDataDir, appLogDir, resourceDir, join, extname } from '@tauri-apps/api/path';
import { getVersion, getName, getTauriVersion } from '@tauri-apps/api/app';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import {
  signIn, signOut, isSignedIn, onAuthChange, configureGoogle, restoreSession,
} from '../../lib/google/index';
import { isTauri } from '../../lib/tauri';
import { exportOwaBackup, pickAndImportOwaBackup, importOwaBackupFromFile, getOwaDataFolder, revealOwaDataFolder } from '../../lib/owaBackup';
import ToolsRepairCard from '../ui/ToolsRepairCard';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

type SettingsTab = 'perfil' | 'apariencia' | 'estudio' | 'musica' | 'sistema' | 'notificaciones' | 'comandos';

const TABS: { id: SettingsTab; label: string; desc: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
  { id: 'perfil', label: 'Perfil', desc: 'Tu nombre, portada y cuenta', icon: User },
  { id: 'apariencia', label: 'Apariencia', desc: 'Tema, tipografía y estilo', icon: Palette },
  { id: 'estudio', label: 'Estudio', desc: 'Pomodoro, metas y enfoque', icon: Brain },
  { id: 'musica', label: 'Música', desc: 'Reproducción, biblioteca y descargas', icon: Music },
  { id: 'comandos', label: 'Comandos', desc: 'Atajos y acceso rápido al horario', icon: Keyboard },
  { id: 'sistema', label: 'Sistema', desc: 'Datos, respaldos y herramientas', icon: Shield },
  { id: 'notificaciones', label: 'Sonidos y Alertas', desc: 'Tonos y avisos por sección', icon: Bell },
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
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', lineHeight: 1.2 }}>{title}</span>
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
const LATENCY_URL = 'https://speed.cloudflare.com/__down?bytes=0';
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
    <button data-ui-control="" onClick={async (e) => {
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
    tracks, updateTrack, addTrack, courses, studySessions, plannedSessions, artists, playlists,
  } = useAppSlice(["settings","updateSettings","googleConnected","setGoogleConnected","setCalendarSyncEnabled","lastCalendarSync","setLastCalendarSync","calendarSyncEnabled","triggerCalendarSync","importGoogleEvents","syncCalendarTwoWay","syncTasksTwoWay","triggerTasksSync","importGoogleTasks","loadGoogleProfile","importClassroomCourses","importClassroomAssignments","triggerDriveBackup","exportNotesToGoogleDoc","exportStatsToGoogleSheets","events","tasks","notes","clearAllMusicData","addNotification","deleteCompletedTasks","exportMusicLibrary","importMusicLibrary","tracks","updateTrack","addTrack","courses","studySessions","plannedSessions","artists","playlists"]);
  const [pesoTick, setPesoTick] = useState(0);

  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsOutline, setSettingsOutline] = useState<{id:string;label:string}[]>([]);
  const settingsContentRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(()=>{try {const saved=localStorage.getItem('owa_settings_category_v1');return TABS.some(tab=>tab.id===saved) ? saved as SettingsTab : 'perfil';}catch{return 'perfil';}});
  useEffect(()=>{try{localStorage.setItem('owa_settings_category_v1',activeTab);}catch{}},[activeTab]);

  useEffect(()=>{const open=()=>{setActiveTab('musica');setSettingsSearch('');};window.addEventListener('apheka:open-music-network-settings',open);return()=>window.removeEventListener('apheka:open-music-network-settings',open);},[]);
  useEffect(()=>{const open=()=>{setActiveTab('sistema');setSettingsSearch('');requestAnimationFrame(()=>document.getElementById('charvis-settings-title')?.scrollIntoView({block:'start'}));};window.addEventListener('apheka:charvis-settings',open);return()=>window.removeEventListener('apheka:charvis-settings',open);},[]);

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

  // Peso de la app: se calcula una vez por cambio relevante (no en cada render).
  const pesoStats = useMemo(() => {
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
    return { grand, rows, barMax: Math.max(1, rows.length ? rows[0].size : 1), keyCount: keys.length, idb };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesoTick, idbUsage, tracks.length, tasks.length, notes.length, courses.length, events.length, studySessions.length, plannedSessions.length, artists.length, playlists.length]);

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
      setAppInfo({ name: 'APHEKA', version: '1.0.0', tauriVersion: '—' });
      return;
    }
    (async () => {
      try {
        const [name, version, tauriVersion] = await Promise.all([getName(), getVersion(), getTauriVersion()]);
        setAppInfo({ name, version, tauriVersion });
        const [data, config, local, cache, log, res] = await Promise.all([appDataDir(), appConfigDir(), appLocalDataDir(), appCacheDir(), appLogDir(), resourceDir()]);
        let music = '';
        try {
          const { getMusicDir } = await import('../../lib/musicDb');
          music = await getMusicDir();
        } catch { /* sin carpeta de música aún */ }
        setAppDirs([
          { label: 'Carpeta de datos', path: data },
          ...(music ? [{ label: 'Carpeta de música', path: music }] : []),
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

  useEffect(() => {
    const cards=Array.from(settingsContentRef.current?.querySelectorAll('.bento-card') || []);
    const headings=cards.filter(card=>!card.parentElement?.closest('.bento-card')).map(card=>({element:card,label:card.getAttribute('data-settings-title') || (card.querySelector('h3') || card.querySelector('span'))?.textContent?.trim() || ''}));
    setSettingsOutline(headings.map((heading,i)=>{
      const id=heading.element.id||`settings-${activeTab}-${i}`;heading.element.id=id;
      return {id,label:heading.label};
    }).filter(item=>item.label));
  },[activeTab,googleConnected]);

  return (
    <div className="page-container apheka-settings" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HEADER ── */}
      <WorkspaceHeader title="Ajustes">
        <button className="btn-secondary" onClick={()=>{setActiveTab('sistema');setSettingsSearch('');requestAnimationFrame(()=>document.getElementById('mcp-settings-title')?.scrollIntoView({block:'start'}));}}><Plug size={16}/>Conectores IA</button>
        <span className="workspace-status"><span className={netInfo.online ? 'is-online' : ''} />{netInfo.online ? 'Conectado' : 'Sin conexión'}</span>
      </WorkspaceHeader>

      <nav className="settings-category-nav" aria-label="Categorías de ajustes">
        {TABS.map(tab => { const Icon=tab.icon;return <button data-ui-control="" key={tab.id} aria-label={tab.label} aria-current={activeTab===tab.id?'page':undefined}
          onClick={()=>{setActiveTab(tab.id);setSettingsSearch('');}}>
          <Icon size={18} /><span className="settings-category-copy"><strong>{tab.label}</strong><small>{tab.desc}</small></span>
        </button>;})}
      </nav>
      <div className={`settings-workspace ${activeTab==='perfil' ? 'settings-profile' : ''}`}>
        {/* MAIN AREA */}
        <main ref={settingsContentRef} className="apheka-settings-content" data-category={activeTab}>
          {activeTab!=='perfil'&&<header className="settings-section-heading"><h2>{TABS.find(t=>t.id===activeTab)?.label}</h2><p>{TABS.find(t=>t.id===activeTab)?.desc}</p><span>{settingsOutline.length} secciones</span></header>}
          <div className="settings-panels">
          <div key={activeTab}>
            {activeTab==='comandos'&&<CommandsSettings/>}

            {/* â•â•â•â•â•â•â•â•â•â•â• PERFIL â•â•â•â•â•â•â•â•â•â•â• */}
            {activeTab === 'perfil' && (
              <section className="settings-profile-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      <User size={15} />
                    </span>
                    <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', margin: 0 }}>Perfil de Usuario</h2>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>Tu identidad y conexiones en APHEKA</p>
                </div>

                {/* Avatar + Nombre + Foto */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ flexShrink: 0 }}>
                    {settings.profilePhoto ? (
                      <div style={{ width: 108, height: 108, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent), 0 8px 24px rgba(0,0,0,0.25)', background: 'var(--bg-deep)' }}>
                        <img src={settings.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--accent-dim)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 500, color: 'var(--accent)', fontFamily: "'Inter Tight', sans-serif" }}>
                        {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'O'}
                      </div>
                    )}
                    <input ref={profilePhotoInputRef} type="file" accept="image/*" onChange={handleProfilePhotoUpload} style={{ display: 'none' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre</label>
                      <input type="text" aria-label="Tu nombre" maxLength={80} value={settings.userName}
                        onChange={e => updateSettings({ userName: e.target.value })}
                        className="input-base" style={{ width: '100%', height: 40, fontSize: 14, fontWeight: 500 }}
                        placeholder="Tu nombre" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button data-ui-control="" onClick={() => profilePhotoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)', color: 'var(--accent)', transition: 'all 150ms' }}>
                        <Image size={14} /> {settings.profilePhoto ? 'Cambiar foto' : 'Subir foto desde tu equipo'}
                      </button>
                      {settings.profilePhoto && (
                        <button data-ui-control="" onClick={() => updateSettings({ profilePhoto: undefined })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444', transition: 'all 150ms' }}>
                          <Trash2 size={13} /> Quitar
                        </button>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: 200 }}>
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
                          <span style={{ fontSize: 11, color: googleConnected ? '#10B981' : 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>{googleConnected ? (googleProfile?.email || 'Conectado') : 'Desconectado'}</span>
                        </div>
                      </div>
                      <button data-ui-control="" onClick={() => { if (googleConnected) { handleGoogleSignOut(); } else { setShowGoogleModal(true); } }}
                        style={{ fontSize: 11, fontWeight: 600, padding: '0 14px', height: 30, borderRadius: 6, cursor: 'pointer', border: googleConnected ? '1px solid rgba(239,68,68,0.2)' : 'none', background: googleConnected ? 'rgba(239,68,68,0.08)' : '#4285F4', color: googleConnected ? '#EF4444' : '#fff', transition: 'all 150ms' }}>
                        {googleConnected ? 'Desconectar' : 'Conectar'}
                      </button>
                    </div>
                  </div>
                  {googleConnected && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                      <button data-ui-control="" onClick={() => { signOut(); setGoogleConnected(false); setCalendarSyncEnabled(false); setLastCalendarSync(null); setGoogleProfile(null); addNotification('Google desconectado exitosamente', 'success'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms', width: 'fit-content' }}>
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
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cada servicio explica cómo se usa dentro de APHEKA</span>
                      </div>
                      <button data-ui-control="" onClick={syncAllGoogle}
                        disabled={!!googleBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)', color: 'var(--accent)', opacity: googleBusy ? 0.6 : 1, transition: 'all 150ms' }}>
                        <RefreshCcw size={13} className={googleBusy ? 'spin' : ''} /> Sincronizar todo
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', marginBottom: 12, cursor: 'pointer' }} onClick={() => { setCalendarSyncEnabled(!calendarSyncEnabled); if (!calendarSyncEnabled) addNotification('Sincronización automática activada', 'success'); }}>
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Sincronización automática</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.4 }}>Calendar y Tasks se sincronizan al iniciar la app y cada 15 minutos</span>
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
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', lineHeight: 1.35 }}>{okLabel || 'No sincronizado aún'}</span>
                              </div>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{s.desc}</span>
                            <button data-ui-control="" onClick={() => runGoogleService(s.id)} disabled={!!googleBusy}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 28, borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: `color-mix(in srgb, ${s.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${s.color} 26%, transparent)`, color: s.color, opacity: googleBusy ? 0.6 : 1, transition: 'all 150ms' }}>
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
            {activeTab === 'apariencia' && <AppearanceStudio/>}

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
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>Configura los intervalos de tu método Pomodoro y objetivos</p>
                </div>

                <div className="bento-card" data-settings-title="Tiempos y descansos" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="study-duration-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <DurationControl presets={[25,45,60]} label="Enfoque" value={settings.pomodoroTime / 60} min={1} max={120} unit="min" onChange={v => updateSettings({ pomodoroTime: v * 60 })} />
                    <DurationControl presets={[0,25,45,60]} label="Cronómetro (meta por ronda)" description="0 min: medición libre, sin rondas" value={(settings.chronoGoal ?? 1500) / 60} min={0} max={180} unit="min" onChange={v => updateSettings({ chronoGoal: v * 60 })} />
                    <DurationControl presets={[120,240,360]} step={5} label="Meta Diaria" value={settings.dailyGoal} min={30} max={600} unit="min" onChange={v => updateSettings({ dailyGoal: v })} />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -2 }}>
                      Escribe los minutos, usa las flechas o elige un intervalo. Los cambios se guardan automáticamente.
                    </p>
                  </div>

                  {/* Break section with visual cycle indicator */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ciclo de Descansos</span>
                      <div className="pomodoro-cycle-preview" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                        {Array.from({ length: settings.pomodoroGoal || 4 }, (_, i) => (
                          <div key={i} style={{
                            width: 16, height: 16, borderRadius: 4,
                            background: i === (settings.pomodoroGoal || 4) - 1 ? '#F59E0B' : '#10B981',
                            opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: i === (settings.pomodoroGoal || 4) - 1 ? '0 0 6px #F59E0B60' : 'none',
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="study-break-grid">
                      <DurationControl label="Descanso corto" value={settings.shortBreakTime / 60} min={1} max={30} presets={[5,10,15]} onChange={value=>updateSettings({shortBreakTime:value*60})}/>
                      <DurationControl label="Descanso largo" value={settings.longBreakTime / 60} min={5} max={60} presets={[15,20,30]} onChange={value=>updateSettings({longBreakTime:value*60})}/>
                      <DurationControl label="Ciclos" value={settings.pomodoroGoal} min={1} max={20} unit="ses." presets={[2,4,6]} description="Sesiones antes del descanso largo" onChange={value=>updateSettings({pomodoroGoal:value})}/>
                    </div>
                  </div>
                </div>

                {/* Colores de Temporizadores */}
                <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Colores de Temporizadores</span>
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
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>{c.label}</span>
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
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Timer Flotante</span>
                      <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", margin: '4px 0 2px' }}>Ventana independiente</h3>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, margin: 0 }}>Aparece al iniciar un enfoque desde el panel de estudio</p>
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
                        fontSize: 13, fontWeight: 500, lineHeight: 1, letterSpacing: '0.04em',
                        fontFamily: FLOATING_FONTS[settings.floatingFont]?.family || FLOATING_FONTS.led.family,
                      }}>25:00</span>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 24px' }} />

                  <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Background mode */}
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Fondo</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>Color de la app o personalizado</span>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {[
                          { value: 'app', label: 'App' },
                          { value: 'custom', label: 'Personalizado' },
                        ].map(o => (
                          <button data-ui-control="" key={o.value} aria-pressed={(settings.floatingBgMode || 'custom')===o.value} onClick={() => updateSettings({ floatingBgMode: o.value as any })}
                            style={{
                              padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 500,
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
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{settings.floatingBgColor || '#020203'}</span>
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
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>Elige el estilo del reloj</span>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8,
                      }}>
                        {Object.entries(FLOATING_FONTS).map(([value,font])=>({value,label:font.name,preview:'88:88',font:font.family})).map(opt => (
                          <button data-ui-control="" key={opt.value} aria-pressed={settings.floatingFont===opt.value} onClick={() => updateSettings({ floatingFont: opt.value })}
                            style={{
                              padding: '10px 6px', borderRadius: 8, fontSize: 11,
                              border: settings.floatingFont === opt.value ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                              background: settings.floatingFont === opt.value ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-deep)',
                              color: settings.floatingFont === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                              cursor: 'pointer', transition: 'all 150ms',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            }}>
                            <span style={{ fontFamily: opt.font, fontSize: 16, fontWeight: 400, lineHeight: 1, color: 'currentColor' }}>{opt.preview}</span>
                            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7, letterSpacing: '0.02em' }}>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <FloatingVisibilityControls hidden={!!settings.floatingHideInFocus} animation={settings.floatingAnimationType || 'plant'} color={settings.timerFocusColor || '#E11D48'} font={settings.floatingFont || 'led'} onChange={updateSettings}/>
                    {/* Ventanas: retirado — la gestión vive en la extensión del navegador (v2.0) */}
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
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>Preferencias de audio, descargas y reproducción</p>
                </div>

                <MusicConnectionSettings/>
                {/* Audio Format */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    Formato de Descarga
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'mp3' as const, label: 'MP3', desc: 'Compatibilidad universal' },
                      { id: 'm4a' as const, label: 'M4A', desc: 'Audio compacto' },
                      { id: 'mp4' as const, label: 'MP4', desc: 'Vídeo' },
                    ].map(opt => {
                      const active = (settings.downloadFormat || 'mp3') === opt.id;
                      return (
                        <button data-ui-control="" key={opt.id} onClick={() => updateSettings({ downloadFormat: opt.id })} style={{
                          flex: 1, padding: '14px 12px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 200ms',
                        }}>
                          <span>{opt.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.65 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audio Quality */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                    {settings.downloadFormat==='mp4'?'Calidad de vídeo':'Calidad de audio'}
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(settings.downloadFormat==='mp4'?[{id:'720',label:'720p',desc:'Menos espacio'},{id:'1080',label:'1080p',desc:'Alta definición'},{id:'best',label:'Hasta 4K',desc:'Según la fuente'}]:[
                      { id: '5', label: 'Estándar', desc: 'Menos espacio' },
                      { id: '3', label: 'Alta', desc: 'Equilibrada' },
                      { id: '0', label: 'Máxima', desc: 'Según la fuente' },
                    ]).map(opt => {
                      const active = (settings.downloadFormat==='mp4'?(settings.downloadVideoQuality||'1080'):(settings.audioQuality || '3')) === opt.id;
                      return (
                        <button data-ui-control="" key={opt.id} onClick={() => updateSettings(settings.downloadFormat==='mp4'?{downloadVideoQuality:opt.id as '720'|'1080'|'best'}:{ audioQuality: opt.id })} style={{
                          flex: 1, padding: '14px 12px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          background: active ? 'var(--accent)' : 'var(--bg-deep)', border: '1px solid var(--border-default)',
                          color: active ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 200ms',
                        }}>
                          <span>{opt.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.65 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reproducción — grouped card for toggles + info */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
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

                <ToolsRepairCard />

                {/* Import / Export metadata */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Importar / Exportar Metadatos
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 14 }}>
                    Exporta nombre, portada y datos de todas tus canciones a un archivo JSON.
                    Al importar, cada canción se reconoce por su ID, su ruta o su nombre.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button data-ui-control="" onClick={async () => {
                      try {
                        const dest = await save({
                          filters: [{ name: 'JSON', extensions: ['json'] }],
                          defaultPath: 'owa_music_metadata.json',
                          title: 'Exportar metadatos de música',
                        });
                        if (!dest) return;
                        if (tracks.length === 0) {
                          addNotification('No hay canciones en tu biblioteca para exportar', 'info');
                          return;
                        }
                        const metadata = tracks.map((t: any) => ({
                          id: t.id, title: t.title, artist: t.artist,
                          coverImage: t.coverImage, coverUrl: t.coverUrl,
                          duration: t.duration, source: t.source,
                          url: t.url, filePath: t.filePath, audioFile: t.audioFile,
                          isFavorite: t.isFavorite, listenedTime: t.listenedTime ?? 0,
                        }));
                        // writeTextFile (texto) en vez de writeFile (binario): el permiso
                        // fs:allow-write-text-file ya cubre la ruta elegida en el diálogo.
                        await writeTextFile(dest as string,
                          JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tracks: metadata }, null, 2)
                        );
                        addNotification(`Metadatos exportados: ${metadata.length} ${metadata.length === 1 ? 'canción' : 'canciones'}`, 'success');
                      } catch (e: any) {
                        addNotification(`Error al exportar metadatos: ${e?.message || 'revisa la carpeta elegida'}`, 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <Upload size={14} /> Exportar metadatos
                    </button>
                    <button data-ui-control="" onClick={async () => {
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
                        const norm = (s: any) =>
                          String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
                        let byId = 0, byPath = 0, byName = 0, missing = 0;
                        for (const raw of imported) {
                          // Claves tolerantes: acepta el JSON de corrección (title/url/filePath/id/artist)
                          // y variantes con mayúscula o en español (Title/Titulo/File/ruta/Artista).
                          const meta = {
                            id: (raw as any).id ?? (raw as any).Id ?? (raw as any).ID,
                            filePath: (raw as any).filePath ?? (raw as any).url ?? (raw as any).File ?? (raw as any).ruta ?? (raw as any).path,
                            title: (raw as any).title ?? (raw as any).Title ?? (raw as any).titulo ?? (raw as any).Titulo ?? (raw as any)['título'],
                            artist: (raw as any).artist ?? (raw as any).Artist ?? (raw as any).artista ?? (raw as any).Artista,
                            coverImage: (raw as any).coverImage,
                            coverUrl: (raw as any).coverUrl,
                            isFavorite: (raw as any).isFavorite,
                          };
                          // 1) ID único (exportado por esta misma app)
                          let existing = tracks.find((t: any) => t.id === meta.id);
                          let how = 'id';
                          // 2) Ruta original o URL (misma canción, distinto ID; \ y / equivalen)
                          if (!existing && meta.filePath) {
                            const p = String(meta.filePath).replace(/\\/g, '/');
                            existing = tracks.find((t: any) => String(t.filePath || t.url || '').replace(/\\/g, '/') === p);
                            how = 'ruta';
                          }
                          // 3) Título + artista normalizados (tildes, mayúsculas y puntuación aparte)
                          if (!existing && meta.title) {
                            const k = `${norm(meta.title)}|${norm(meta.artist)}`;
                            existing = tracks.find((t: any) => `${norm(t.title)}|${norm(t.artist)}` === k);
                            how = 'nombre';
                          }
                          if (existing) {
                            // skipRename: los archivos se renombran después, de una sola
                            // vez, con el botón "Normalizar nombres" de Música.
                            // toDisplayName deja título/artista con mayúsculas y tildes
                            // donde corresponden (solo si vienen planos).
                            const { toDisplayName: toDN } = await import('../../lib/musicDb');
                            updateTrack(existing.id, {
                              title: meta.title ? toDN(meta.title) : existing.title,
                              artist: meta.artist || meta.artist === '' ? toDN(meta.artist) : existing.artist,
                              coverImage: meta.coverImage ?? (meta as any).coverUrl ?? existing.coverImage,
                              isFavorite: meta.isFavorite ?? existing.isFavorite,
                            }, true);
                            if (how === 'id') byId++;
                            else if (how === 'ruta') byPath++;
                            else byName++;
                          } else {
                            missing++;
                          }
                        }
                        const updated = byId + byPath + byName;
                        if (updated === 0) {
                          addNotification(`No se reconoció ninguna canción de las ${imported.length} del archivo en tu biblioteca`, 'error');
                        } else {
                          const parts = [];
                          if (byId > 0) parts.push(`${byId} por ID`);
                          if (byPath > 0) parts.push(`${byPath} por ruta`);
                          if (byName > 0) parts.push(`${byName} por nombre`);
                          addNotification(
                            `Metadatos importados: ${updated} de ${imported.length} (${parts.join(', ')})${missing > 0 ? `. ${missing} sin coincidencia` : ''}`,
                            'success'
                          );
                        }
                      } catch (e) {
                        addNotification('Error al importar metadatos', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10B981' }}>
                      <Download size={14} /> Importar metadatos
                    </button>
                  </div>
                </div>

                {/* Biblioteca completa: audios + nombres idénticos */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Biblioteca completa de música
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 14 }}>
                    Descarga TODA tu música (audios + nombres) a una carpeta. Al importarla en otro
                    entorno, cada canción se detecta y queda con su nombre idéntico al exportado.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button data-ui-control="" onClick={async () => {
                      if (!isTauri()) { addNotification('Disponible en la app instalada', 'info'); return; }
                      try {
                        const dir = await open({ directory: true, title: 'Carpeta para descargar toda la música' });
                        if (!dir || Array.isArray(dir)) return;
                        const { getTrackFileFromDB, buildAudioFileName, toDisplayName } = await import('../../lib/musicDb');
                        const { readFile, writeFile, writeTextFile } = await import('@tauri-apps/plugin-fs');
                        const { join } = await import('@tauri-apps/api/path');
                        const locals = tracks.filter((t: any) => t.source === 'local');
                        if (locals.length === 0) { addNotification('No hay canciones locales para descargar', 'info'); return; }
                        const taken = new Set<string>();
                        const manifest: any[] = [];
                        let ok = 0, skipped = 0;
                        for (const t of locals) {
                          try {
                            let bytes: Uint8Array | null = null;
                            try { const f = await getTrackFileFromDB(t.id); if (f) bytes = new Uint8Array(await f.arrayBuffer()); } catch { /* sin blob */ }
                            if (!bytes) {
                              const p = t.filePath || t.url || '';
                              if (p && !p.startsWith('http') && !p.startsWith('blob:')) { try { bytes = await readFile(p); } catch { /* sin archivo */ } }
                            }
                            if (!bytes) { skipped++; continue; }
                            const ext = ((t.audioFile || t.url || 'mp3').split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
                            const file = buildAudioFileName('', toDisplayName(t.title) || t.title, ext, taken);
                            await writeFile(await join(dir as string, file), bytes);
                            manifest.push({ file, id: t.id, title: t.title, artist: t.artist, coverImage: t.coverImage, isFavorite: !!t.isFavorite, duration: t.duration || 0 });
                            ok++;
                          } catch { skipped++; }
                        }
                        await writeTextFile(
                          await join(dir as string, 'owa-musica-biblioteca.json'),
                          JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tracks: manifest }, null, 2)
                        );
                        addNotification(`Música descargada: ${ok} de ${locals.length}${skipped > 0 ? ` (${skipped} sin audio disponible)` : ''}`, ok > 0 ? 'success' : 'info');
                      } catch (e) {
                        addNotification('No se pudo descargar la música', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <Download size={14} /> Descargar toda la música
                    </button>
                    <button data-ui-control="" onClick={async () => {
                      if (!isTauri()) { addNotification('Disponible en la app instalada', 'info'); return; }
                      try {
                        const dir = await open({ directory: true, title: 'Carpeta con la música a importar' });
                        if (!dir || Array.isArray(dir)) return;
                        const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
                        const { join } = await import('@tauri-apps/api/path');
                        const { toDisplayName } = await import('../../lib/musicDb');
                        const entries = await readDir(dir as string);
                        const audios = entries.filter(e => !(e as any).isDirectory && /\.(mp3|m4a|aac|mp4|flac|ogg|opus|wav|wma)$/i.test((e as any).name || ''));
                        if (audios.length === 0) { addNotification('No se encontraron audios en esa carpeta', 'info'); return; }
                        const manifest: Record<string, any> = {};
                        try {
                          const man = JSON.parse(await readTextFile(await join(dir as string, 'owa-musica-biblioteca.json')));
                          for (const m of (man.tracks || [])) {
                            if (m && m.file) manifest[String(m.file).toLowerCase()] = m;
                          }
                        } catch { /* sin manifiesto: se detecta por nombre de archivo */ }
                        let added = 0, named = 0;
                        for (const a of audios) {
                          const fname = (a as any).name as string;
                          const full = await join(dir as string, fname);
                          const meta = manifest[fname.toLowerCase()];
                          const title = meta?.title || toDisplayName(fname.replace(/\.[^.]+$/, ''));
                          const artist = meta?.artist || '';
                          const id = addTrack({
                            title, artist, duration: meta?.duration ?? 0, source: 'local',
                            url: full, filePath: full, coverImage: meta?.coverImage,
                            isFavorite: !!meta?.isFavorite, listenedTime: 0, audioFile: fname,
                          });
                          if (meta && (meta.title || meta.artist)) {
                            await updateTrack(id, {
                              title: meta.title || title, artist: meta.artist || '',
                              coverImage: meta.coverImage, isFavorite: !!meta.isFavorite,
                            }, true);
                            named++;
                          }
                          added++;
                        }
                        addNotification(
                          `Música importada: ${added} ${added === 1 ? 'canción' : 'canciones'}${named > 0 ? ` (${named} con sus nombres originales)` : ''}`,
                          'success'
                        );
                      } catch (e) {
                        addNotification('No se pudo importar la música', 'error');
                        console.error(e);
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10B981' }}>
                      <Upload size={14} /> Importar toda la música
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
                    <button data-ui-control="" onClick={() => setShowClearAllMusic(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', transition: 'all 200ms' }}>
                      <Music size={14} /> Borrar toda la música
                    </button>
                    <button data-ui-control="" onClick={() => {
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
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>Controla el comportamiento acústico y notificaciones del entorno de estudio</p>
                </div>

                {/* General Toggles */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Configuración General</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Toggle checked={settings.notifications} onChange={v => updateSettings({ notifications: v })}
                      label="Notificaciones Visuales del Temporizador" desc="Mostrar notificación nativa al finalizar ciclos de estudio o descansos programados." />
                    <Toggle checked={settings.soundEffects} onChange={v => updateSettings({ soundEffects: v })}
                      label="Sonidos de Interfaz" desc="Reproducir retroalimentación acústica al interactuar con botones, pestañas, modales y arrastrar elementos." />
                  </div>
                </div>

                {/* Event-specific settings */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Eventos de Temporizador</span>
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
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>{ev.desc}</span>
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

                {/* Alertas y Notificaciones */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, display: 'block' }}>Alertas y Notificaciones</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Notificaciones nativas del sistema</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Aparecen fuera de la app con el icono de APHEKA</div>
                      </div>
                      <button data-app-action="primary" data-ui-control="" onClick={async () => {
                        const { requestNativePermission } = await import('../../lib/notifications');
                        const ok = await requestNativePermission();
                        addNotification(ok ? 'Permiso concedido' : 'Permiso denegado', ok ? 'success' : 'error');
                      }} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff' }}>
                        <ShieldCheck size={14} /> Solicitar Permiso
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button data-app-action="primary" data-ui-control="" onClick={async () => {
                        const { sendNativeNotification } = await import('../../lib/notifications');
                        sendNativeNotification('APHEKA', 'Notificación nativa de prueba enviada',{kind:'settings'});
                      }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff', transition: 'all 200ms' }}>
                        <Bell size={14} /> Probar Nativa
                      </button>
                      <button data-app-action="secondary" data-ui-control="" onClick={() => { addNotification('Notificación de prueba enviada', 'success'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', transition: 'all 200ms' }}>
                        <Bell size={14} /> Probar Toast
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Los recordatorios reales (tareas por vencer, tareas vencidas, eventos y sesiones de estudio) llegan solos cuando corresponde, una vez por ocurrencia.</p>
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
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>Información de la aplicación, sus datos y almacenamiento local</p>
                </div>

                <PointerSettings />
                <AssistantWorkspace />
                {/* App info */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<AppWindow size={14} />} title="Sobre APHEKA" desc="Aplicación instalada" />
                  <div>
                    <InfoRow label="Nombre" value={appInfo?.name || 'APHEKA'} mono />
                    <InfoRow label="Versión" value={appInfo?.version || '6.7'} mono />
                    <InfoRow label="Tauri" value={appInfo?.tauriVersion || '—'} mono />
                    <InfoRow label="Entorno" value={isTauri() ? 'Aplicación nativa (Tauri)' : 'Navegador web'} last />
                  </div>
                </div>

                {/* Peso de la app */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<Database size={14} />} title="Peso de la app" desc="En qué se gastan los datos guardados" />
                  {(() => {
                    const { grand, rows, barMax, keyCount, idb } = pesoStats;
                    const quota = storageQuota && storageQuota > 0 ? storageQuota : 0;
                    const totalPct = quota > 0 ? Math.min(100, (grand / quota) * 100) : 0;
                    const totalColor = totalPct >= 80 ? '#EF4444' : totalPct >= 55 ? '#F59E0B' : '#10B981';
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)', marginBottom: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Peso total</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace" }}>{fmtBytes(grand)}</span>
                            <button data-ui-control="" onClick={() => setPesoTick(t => t + 1)} title="Volver a medir" style={{ display: 'flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                              <RefreshCw size={11} /> Actualizar
                            </button>
                          </span>
                        </div>
                        {quota > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Uso de almacenamiento</span>
                              <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: totalColor }}>{totalPct.toFixed(1)}% de {fmtBytes(quota)}</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 6, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.max(0.6, totalPct)}%`, borderRadius: 6, background: totalColor, transition: 'width 400ms ease' }} />
                            </div>
                          </div>
                        )}
                        {rows.map(r => {
                          const pct = grand > 0 ? (r.size / grand) * 100 : 0;
                          return (
                            <div key={r.label} style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                                  {r.label}
                                </span>
                                <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'var(--text-muted)', flexShrink: 0 }}>
                                  {fmtBytes(r.size)} <span style={{ color: r.color }}>· {pct.toFixed(1)}%</span>
                                </span>
                              </div>
                              <div style={{ height: 7, borderRadius: 5, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.max(1.5, (r.size / barMax) * 100)}%`, borderRadius: 5, background: r.color, opacity: 0.85, transition: 'width 400ms ease' }} />
                              </div>
                            </div>
                          );
                        })}
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                          {keyCount} claves en localStorage · {idb > 0 ? `la base de datos IndexedDB ocupa ${fmtBytes(idb)}` : 'la base de datos IndexedDB no está disponible en este navegador'}.
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* App folders */}
                <div className="bento-card" style={{ padding: '24px', border: '1px solid var(--border-subtle)' }}>
                  <CardHeader icon={<FolderOpen size={14} />} title="Rutas de la aplicación" desc="Dónde guarda APHEKA sus datos" />
                  {isTauri() ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {appDirs.map((d, i) => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < appDirs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 7, background: d.root ? 'rgba(16,185,129,0.08)' : 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: d.root ? '#10B981' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {d.root ? <Boxes size={13} /> : <HardDrive size={13} />}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{d.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.path}>{d.path}</div>
                          </div>
                          <CopyButton text={d.path} />
                          <button data-ui-control="" onClick={() => { openPath(d.path).catch(() => addNotification('No se pudo abrir la carpeta', 'error')); }}
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
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.key}</span>
                              <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>{fmtBytes(it.size)}</span>
                            </div>
                          ))}
                          {items.length > 6 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>… y {items.length - 6} entradas más</span>
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
                    <button data-ui-control="" onClick={() => {
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

                {/* Respaldo y migración */}
                <div className="bento-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Respaldo y migración de datos</span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    Exporta todo tu contenido (notas, tareas, cursos, eventos, hábitos, música, ajustes) a un archivo
                    para pasarlo a otra computadora o a una futura versión. Al instalar una versión nueva sobre esta
                    app, tus datos se conservan automáticamente. Las cuentas y claves de Google no se incluyen en el
                    respaldo por seguridad (se reconectan al importar).
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button data-ui-control="" onClick={handleExportBackup} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)' }}>
                      <Download size={14} /> Exportar respaldo
                    </button>
                    <button data-ui-control="" onClick={handleImportBackup} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}>
                      <Upload size={14} /> Importar respaldo
                    </button>
                    <button data-ui-control="" onClick={handleRevealData} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}>
                      <FolderOpen size={14} /> Abrir carpeta de datos
                    </button>
                  </div>
                  {dataFolder && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Share Tech Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={dataFolder}>
                        {dataFolder}
                      </div>
                      {dataFolder && (
                        <button data-app-action="secondary" data-ui-control="" onClick={() => openPath(dataFolder).catch(() => { })} title="Abrir la carpeta raíz de datos de APHEKA en el explorador"
                          style={{ height: 26, padding: '0 11px', borderRadius: 7, border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                          Abrir carpeta
                        </button>
                      )}
                    </div>
                  )}
                  <input ref={backupFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleBackupFilePicked} />
                </div>

                {/* Zona de riesgo: desinstalación (fase de producción) */}
                <UninstallSection />

                {/* Hecho por */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '18px 0 6px' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hecho por</span>
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>MaxCB</span>
                </div>

              </section>
            )}
          </div>

          </div>
        </main>
        {activeTab!=='perfil' && <aside className="settings-outline">
          <p className="workspace-eyebrow">En esta sección</p>
          <label className="settings-search"><Search size={15}/><input aria-label="Buscar opción en esta sección" value={settingsSearch} onChange={e=>setSettingsSearch(e.target.value)} placeholder="Buscar opción…" /></label>
          <nav aria-label="Opciones de la categoría">
            {settingsOutline.filter(item=>item.label.toLocaleLowerCase().includes(settingsSearch.toLocaleLowerCase())).map(item=><button data-ui-control="" key={item.id}
              onClick={()=>document.getElementById(item.id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>{item.label}</button>)}
            {settingsSearch.trim().length>0 && !settingsOutline.some(item=>item.label.toLocaleLowerCase().includes(settingsSearch.toLocaleLowerCase())) && <p>No hay coincidencias en esta categoría.</p>}
          </nav>
        </aside>}

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
              <button data-ui-control="" onClick={() => setShowGoogleModal(false)} style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={16} /></button>
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
                <button data-ui-control="" onClick={handleGoogleSignOut} style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
                  Desconectar Google
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Conecta tu cuenta de Google para usar tu identidad en APHEKA.
                </p>
                <button data-ui-control="" onClick={handleGoogleSignIn} style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#4285F4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
              <button data-ui-control="" onClick={() => { setShowClearAllMusic(false); setClearAllMusicText(''); }} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button data-ui-control="" onClick={() => {
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
          <button data-ui-control="" onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
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
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color:</span>
            <input type="color" value={drawColor} onChange={e => { setDrawColor(e.target.value); setIsEraser(false); }}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', padding: 1, cursor: 'pointer' }} />
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grosor:</span>
            <input type="range" min={2} max={20} step={1} value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))}
              style={{ width: 60, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 16 }}>{brushSize}</span>
          </div>

          <button data-ui-control="" onClick={() => setIsEraser(!isEraser)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              background: isEraser ? 'var(--accent)' : 'var(--bg-deep)',
              border: '1px solid var(--border-default)',
              color: isEraser ? '#fff' : 'var(--text-secondary)',
            }}>
            {isEraser ? 'Borrando' : 'Dibujar'}
          </button>

          <button data-ui-control="" onClick={clearFrame}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              background: 'var(--bg-deep)', border: '1px solid var(--border-default)',
              color: 'var(--text-muted)',
            }}>
            Limpiar
          </button>

          <button data-ui-control="" onClick={saveCurrentFrame}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
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
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>Fotogramas (se rotan en bucle)</span>
            <button data-app-action="primary" data-ui-control="" onClick={addFrame}
              style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
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
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Vacio</div>
                )}
              </div>

              {/* Frame number */}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', minWidth: 20 }}>#{idx + 1}</span>

              {/* Speed slider */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Vel:</span>
                <input type="range" min={100} max={3000} step={100} value={speeds[idx] || 1000}
                  onChange={e => updateSpeed(idx, parseInt(e.target.value))}
                  style={{ flex: 1, height: 3, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right', fontFamily: 'monospace' }}>
                  {(speeds[idx] || 1000)}ms
                </span>
              </div>

              {/* Delete */}
              {frames.length > 1 && (
                <button data-ui-control="" onClick={(e) => { e.stopPropagation(); removeFrame(idx); }}
                  style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,50,50,0.2)', border: 'none', color: 'var(--error)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  X
                </button>
              )}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {frameCount > 1
              ? `Ciclo: ${speeds.slice(0, frameCount).map((s, i) => `F${i + 1} (${s}ms)`).join(' → ')} → vuelve al inicio`
              : 'Un solo frame (sin ciclo)'}
          </div>
        </div>

        {/* Preview within bar */}
        <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Preview en la barra</div>
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
          <button data-ui-control="" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button data-app-action="primary" data-ui-control="" onClick={saveAll} style={{ padding: '10px 24px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff' }}>
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
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>{label}</span>
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

// ── Zona de riesgo: desinstalación con confirmación escrita ──────────────────
function UninstallSection() {
  const CONFIRM = 'DESINSTALAR APHEKA';
  const [text, setText] = useState('');
  const [wiping, setWiping] = useState(false);
  const [status, setStatus] = useState('');
  const confirmed = text.trim().toUpperCase() === CONFIRM;
  const doWipe = () => {
    setWiping(true);
    try {
      localStorage.clear();
      sessionStorage.clear();
      // Bases locales de OWA: datos principales (idb-keyval) y biblioteca de música
      ['keyval-store', 'OwaMusicDB'].forEach(name => { try { indexedDB.deleteDatabase(name); } catch { } });
      setStatus('Datos eliminados. La app se cerrará en unos segundos…');
      setTimeout(() => { try { window.close(); } catch { } }, 1400);
    } catch {
      setWiping(false);
      setStatus('No se pudieron borrar los datos por completo.');
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Trash2 size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', fontFamily: "'Inter Tight', sans-serif" }}>Desinstalar APHEKA</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        Para desinstalar por completo: <b style={{ color: 'var(--text-secondary)' }}>1)</b> exporta tu respaldo arriba, <b style={{ color: 'var(--text-secondary)' }}>2)</b> escribe la confirmación y abre el desinstalador de Windows — elimina el programa y todos sus paquetes. Opcionalmente, borra también tus datos locales antes de salir.
      </div>
      <input value={text} onChange={e => setText(e.target.value)} placeholder={`Escribe "${CONFIRM}" para confirmar`}
        style={{ width: '100%', boxSizing: 'border-box', height: 36, borderRadius: 9, border: `1px solid ${confirmed ? '#EF444455' : 'var(--border-soft)'}`, background: 'var(--bg-deep)', color: confirmed ? '#EF4444' : 'var(--text-primary)', padding: '0 12px', fontSize: 12, outline: 'none', fontFamily: "'JetBrains Mono', monospace" }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button data-ui-control=""
          onClick={() => { if (confirmed) { setStatus('Abriendo el desinstalador de Windows…'); openUrl('ms-settings:appsfeatures').catch(() => setStatus('No se pudo abrir Ajustes de Windows.')); } }}
          disabled={!confirmed}
          style={{ flex: 1, minWidth: 170, height: 36, borderRadius: 9, border: 'none', background: confirmed ? '#EF4444' : 'var(--border-subtle)', color: confirmed ? '#fff' : 'var(--text-muted)', fontSize: 11.5, fontWeight: 700, cursor: confirmed ? 'pointer' : 'default', opacity: confirmed ? 1 : 0.55, fontFamily: "'Inter Tight', sans-serif" }}>
          Abrir desinstalador de Windows
        </button>
        <button data-ui-control=""
          onClick={() => { if (confirmed && !wiping) doWipe(); }}
          disabled={!confirmed || wiping}
          style={{ flex: 1, minWidth: 170, height: 36, borderRadius: 9, border: '1px solid rgba(239,68,68,0.35)', background: 'transparent', color: confirmed ? '#EF4444' : 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, cursor: confirmed && !wiping ? 'pointer' : 'default', opacity: confirmed && !wiping ? 1 : 0.55 }}>
          Borrar mis datos y cerrar
        </button>
      </div>
      {status && <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{status}</div>}
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
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>{label}</span>
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <div onClick={() => setIsOpen(!isOpen)}
          style={{
            width: 32, height: 24, borderRadius: 6, cursor: 'pointer', border: '2px solid var(--border-default)',
            background: value || 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--text-muted)',
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
                style={{ flex: 1, height: 28, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 8px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
              <button data-ui-control="" onClick={() => { onChange(''); setIsOpen(false); }}
                style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import AssistantWorkspace from '../ui/AssistantWorkspace';
import PointerSettings from '../ui/PointerSettings';
