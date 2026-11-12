import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import {
  Check, ChevronDown, Copy, Eye, Film, Loader2, LogOut,
  PanelLeft, PanelRight, Pencil, Plus, RotateCcw, Send, Settings2,
  Square, SquareTerminal, Trash2, X, HardDrive, Moon, Sun,
} from 'lucide-react';
import GoogleDriveModal from '@/components/GoogleDriveModal';
import {
  EstudioIcon,
  InvestigacionProfundaIcon,
  SitiosWebIcon,
  DocumentacionIcon,
  HojasIcon,
  ImagenesVideoIcon,
  SubirArchivosIcon,
  GaleryIcon,
  ProyectosIcon,
  BuscarConversacionesIcon,
  BusquedaWebIcon,
  ContextoIcon,
} from '@/components/LottieIcons';
import Markdown, { type Artifact, MdImage } from '@/components/Markdown';
import { type Sources, type TerminalRun } from '@/components/SandboxPanel';
import { type StudyDocument } from '@/components/DocumentPanel';
import { CodeRunCard, ToolList, type ToolEvent } from '@/components/ToolCards';
import StepsView from '@/components/StepsView';
import ArtifactCanvas, { type CanvasPayload, type CanvasType } from '@/components/ArtifactCanvas';
import MinimapNav from '@/components/MinimapNav';
import AnnouncementModal from '@/components/AnnouncementModal';
import SuggestionChips from '@/components/SuggestionChips';
import SettingsModal, { type Settings } from '@/components/SettingsModal';
import ProjectsPanel from '@/components/ProjectsPanel';
import SkillsModal from '@/components/SkillsModal';
import { useAuth } from '@/lib/auth';
import { api, getToken } from '@/lib/api';
import { addToGallery, getGallery, GALLERY_EVENT } from '@/lib/gallery';
import { PAYMENTS_BETA } from '@/lib/beta';
import { parseStreamingToolCall, type ParsedStreamingTool } from '@/lib/streamingToolParser';

interface MsgAttachment { name: string; kind: string; dataUrl?: string; text?: string; fileId?: string; remoteUrl?: string }
type Step = { kind: 'reasoning' | 'text'; text: string } | { kind: 'tool'; tool: ToolEvent };
interface Msg { id?: string; role: 'user' | 'assistant'; content: string; reasoning?: string | null; model?: string; tools?: ToolEvent[] | null; steps?: Step[] | null; attachments?: MsgAttachment[]; at?: string }
interface Attachment { name: string; kind: 'doc' | 'image' | 'video'; text?: string; dataUrl?: string; remoteUrl?: string; status: 'loading' | 'ready' | 'error'; note?: string; file?: File; mimeType?: string; fileId?: string }
interface Conv { id: string; title: string; model: string; updated_at: string }
interface ModelInfo { id: string; name: string; tagline: string; reasoning: boolean; free: boolean }

// Catálogo base del cliente: X0 y X1 como entradas independientes, siempre
// visibles aunque el servidor tarde en desplegar o falle. El servidor añade
// modelos nuevos a esta lista; nunca sobrescribe los MAVERICK base.
const BASE_MODELS: ModelInfo[] = [
  { id: 'x0', name: 'X0', tagline: 'Rápido y directo — sin pensamiento, entiende imágenes y video', reasoning: false, free: true },
  { id: 'x1', name: 'X1', tagline: 'Razonamiento visible — effort ajustable, entiende imágenes y video', reasoning: true, free: true },
];
// Modelos con razonamiento visible (selector de nivel de pensamiento).
const REASONING_MODELS = new Set(['x1']);

// Niveles de think effort (nivel de pensamiento) — aplica a X0 y X1.
const THINK_EFFORTS = [
  { id: 'low', label: 'Bajo', desc: 'Respuesta rápida y directa' },
  { id: 'medium', label: 'Medio', desc: 'Equilibrio entre velocidad y profundidad' },
  { id: 'high', label: 'Alto', desc: 'Análisis profundo y verificación' },
  { id: 'max', label: 'Máximo', desc: 'Piensa todo lo posible, hasta el límite' },
] as const;
type ThinkEffortId = typeof THINK_EFFORTS[number]['id'];
const EFFORT_KEY = 'maverick-think-effort';
// Migración desde la clave previa al rebrand: conserva la preferencia.
const LEGACY_EFFORT_KEY = 'kronos-think-effort';

function loadThinkEffort(): ThinkEffortId {
  try {
    let v = localStorage.getItem(EFFORT_KEY);
    if (!v) {
      const legacy = localStorage.getItem(LEGACY_EFFORT_KEY);
      if (legacy) {
        v = legacy;
        try { localStorage.setItem(EFFORT_KEY, legacy); localStorage.removeItem(LEGACY_EFFORT_KEY); } catch { /* noop */ }
      }
    }
    return THINK_EFFORTS.some((e) => e.id === v) ? (v as ThinkEffortId) : 'medium';
  } catch { return 'medium'; }
}

// El servidor guarda { tools, steps } (nuevo) o un array plano (legado).
function parseStored(raw: any): { tools: ToolEvent[] | null; steps: Step[] | null } {
  if (!raw) return { tools: null, steps: null };
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return { tools: null, steps: null }; } }
  if (Array.isArray(v)) return { tools: v, steps: null };
  if (v && Array.isArray(v.steps)) return { tools: v.tools || null, steps: v.steps };
  return { tools: null, steps: null };
}

// Rangos de plan (X0 está disponible para todos los planes)
const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, plus: 2, pro: 3, ultra: 4 };

let runId = 0;

const TOOLS = [
  { id: 'study', label: 'Estudio', icon: EstudioIcon, placeholder: 'Sube un documento para estudiar, resolver o editar…' },
  { id: 'research', label: 'Investigación profunda', icon: InvestigacionProfundaIcon, placeholder: 'Tema a investigar a fondo…' },
  { id: 'slides', label: 'Diapositivas', icon: HojasIcon, placeholder: '¿Sobre qué tema es la presentación?' },
  { id: 'web', label: 'Sitios web', icon: SitiosWebIcon, placeholder: 'Describe el sitio web que quieres…' },
  { id: 'docs', label: 'Documentación', icon: DocumentacionIcon, placeholder: '¿Qué documento técnico necesitas?' },
  { id: 'sheets', label: 'Hojas', icon: HojasIcon, placeholder: '¿Qué datos quieres en la hoja?' },
  { id: 'media', label: 'Imágenes y video', icon: ImagenesVideoIcon, placeholder: '¿Qué imágenes o videos necesitas?' },
  { id: 'agents', label: 'Agentes', icon: InvestigacionProfundaIcon, placeholder: 'Describe la tarea de código para los agentes…' },
] as const;

type ModeId = typeof TOOLS[number]['id'];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

// Agrupa mensajes por día natural (clave ISO de la fecha local).
function dayKey(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Etiqueta del separador: Hoy / Ayer / fecha local legible.
function dayLabel(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d.toISOString()) === dayKey(today.toISOString())) return 'Hoy';
  if (dayKey(d.toISOString()) === dayKey(yesterday.toISOString())) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

// Hora corta para el badge del asistente (p. ej. "14:32").
function timeLabel(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// Imágenes generadas por herramientas dentro de un mensaje (sin duplicados),
// para mostrarlas incrustadas en el cuerpo del chat.
function generatedImages(m: Msg): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (u?: string) => { if (u && !seen.has(u)) { seen.add(u); urls.push(u); } };
  m.tools?.forEach((t) => { if (t.type === 'generate_image') add(t.imageUrl); });
  m.steps?.forEach((s) => { if (s.kind === 'tool' && s.tool.type === 'generate_image') add(s.tool.imageUrl); });
  return urls;
}

export default function Chat() {
  const { user, loading, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState('x0');
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamReasoning, setStreamReasoning] = useState('');
  const [streamContent, setStreamContent] = useState('');
  const [streamSteps, setStreamSteps] = useState<Step[]>([]);
  const [searchPending, setSearchPending] = useState<string | null>(null);
  const [mediaPending, setMediaPending] = useState<string | null>(null);
  const [codePending, setCodePending] = useState<string | null>(null);
  const [writePending, setWritePending] = useState<string | null>(null);
  const [youtubePending, setYoutubePending] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [runs, setRuns] = useState<TerminalRun[]>([]);
  const [sources, setSources] = useState<Sources | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [canvasPayload, setCanvasPayload] = useState<CanvasPayload | null>(null);
  const [canvasTab, setCanvasTab] = useState<CanvasType>('website');
  const [activeToolStream, setActiveToolStream] = useState<ParsedStreamingTool | null>(null);
  const toolBuffersRef = useRef<Record<string, string>>({});
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [mode, setMode] = useState<ModeId | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [convQuery, setConvQuery] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    language: 'auto', customInstructions: '', memory: '', autoOpenSandbox: false,
    showThinking: true, expandToolsAuto: false, animations: true, sendOnEnter: true,
    fontSize: 'md', density: 'comfy',
  });

  // Tema y tipografía independientes de Maverick Class (Oscuro predeterminado)
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('mav_chat_theme') as 'dark' | 'light') || 'dark';
  });
  const [chatFont, setChatFont] = useState<'sans' | 'serif' | 'mono' | 'modern'>(() => {
    return (localStorage.getItem('mav_chat_font') as 'sans' | 'serif' | 'mono' | 'modern') || 'sans';
  });
  const [driveModalOpen, setDriveModalOpen] = useState(false);

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setChatTheme(newTheme);
    localStorage.setItem('mav_chat_theme', newTheme);
  };

  const handleFontChange = (newFont: 'sans' | 'serif' | 'mono' | 'modern') => {
    setChatFont(newFont);
    localStorage.setItem('mav_chat_font', newFont);
  };
  const [thinkEffort, setThinkEffortState] = useState<ThinkEffortId>(loadThinkEffort);
  const setThinkEffort = (v: ThinkEffortId) => {
    setThinkEffortState(v);
    try { localStorage.setItem(EFFORT_KEY, v); } catch { /* noop */ }
  };
  const currentModelName = BASE_MODELS.find((m) => m.id === model)?.name || models.find((m) => m.id === model)?.name || 'X0';
  const isReasoningModel = (id: string | undefined) => !!id && REASONING_MODELS.has(id);
  // Lista del selector: X0 y X1 base siempre; el servidor solo añade modelos nuevos.
  const modelList: ModelInfo[] = BASE_MODELS.map((f) => ({ ...f }));
  for (const m of models) {
    if (!modelList.some((b) => b.id === m.id)) modelList.push(m);
  }
  const autoOpenRef = useRef(false);
  const [usage, setUsage] = useState<{ used: number; limit: number | null }>({ used: 0, limit: null });
  // Avisos: 'info' = confirmación discreta con auto-cierre; 'warn' = alerta persistente.
  const [notice, setNoticeState] = useState('');
  const [noticeKind, setNoticeKind] = useState<'info' | 'warn'>('warn');
  const [noticePricing, setNoticePricing] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);
  const showNotice = (text: string, kind: 'info' | 'warn' = 'warn', pricing = false, autoCloseMs = 0) => {
    setNoticeState(text);
    setNoticeKind(kind);
    setNoticePricing(pricing);
    if (noticeTimerRef.current) { clearTimeout(noticeTimerRef.current); noticeTimerRef.current = null; }
    if (autoCloseMs > 0) noticeTimerRef.current = window.setTimeout(() => setNoticeState(''), autoCloseMs);
  };
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const atBottomRef = useRef(true);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [studyDocument, setStudyDocument] = useState<StudyDocument | null>(null);
  const [contextFiles, setContextFiles] = useState<Array<{name: string; kind: 'doc' | 'image' | 'video'; dataUrl?: string; remoteUrl?: string; fileId?: string; mimeType?: string}>>([]);
  const [galCount, setGalCount] = useState(() => getGallery().length);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [activeSkillsCount, setActiveSkillsCount] = useState(0);
  // New: Files panel state
  const [filesOpen, setFilesOpen] = useState(false);
  // Loading bar al cambiar de conversación
  const [convsLoading, setConvsLoading] = useState(false);
  // Usuario no está al final: mostrar botón flotante
  const [scrolledUp, setScrolledUp] = useState(false);
  // Reacciones del asistente: { msgId: 'up'|'down' }
  const [msgReactions, setMsgReactions] = useState<Record<string, 'up' | 'down'>>({});

  // Sincroniza el contador de la galería con la librería persistente.
  useEffect(() => {
    const sync = () => setGalCount(getGallery().length);
    window.addEventListener(GALLERY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(GALLERY_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  // Aplica los ajustes de apariencia al documento (tamaño, densidad, animaciones).
  useEffect(() => {
    document.body.classList.toggle('no-anim', !settings.animations);
    return () => { document.body.classList.remove('no-anim'); };
  }, [settings.animations]);

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true }); }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    api<{ models: ModelInfo[] }>('/chat/models').then((d) => setModels(d.models)).catch(() => {});
    api<{ settings: Settings }>('/user/settings')
      .then((d) => { setSettings(d.settings); autoOpenRef.current = d.settings.autoOpenSandbox; })
      .catch(() => {});
    api<{ used: number; limit: number | null }>('/chat/usage').then(setUsage).catch(() => {});
    api<{ catalog: any[] }>('/skills').then((d) => { if (d?.catalog) setActiveSkillsCount(d.catalog.filter((s) => s.installed && s.active).length); }).catch(() => {});
    loadConvs();
    // Regreso del checkout de Stripe: sincronizar el plan directamente con la API.
    if (new URLSearchParams(window.location.search).get('upgraded')) {
      api<{ plan?: string; synced?: boolean }>('/billing/sync', { method: 'POST' })
        .then(async (d) => {
          if (d.synced) {
            await refresh();
            showNotice(`Suscripción activada — plan ${d.plan}. ¡Gracias!`, 'info', false, 6000);
          }
        })
        .catch(() => {})
        .finally(() => window.history.replaceState({}, '', '/app'));
    }
  }, [user]);

  // Manejar herramienta / proyecto / conversación desde navegación
  // (ej: /tools → /app con state.tool, /projects → /app con state.projectId).
  useEffect(() => {
    const state = location.state as { tool?: ModeId; projectId?: string; conversationId?: string } | undefined;
    if (state?.tool && TOOLS.find(t => t.id === state.tool)) {
      selectTool(state.tool);
    }
    if (state?.projectId) setActiveProjectId(state.projectId);
    if (state?.conversationId) openConv(state.conversationId);
  }, [location.state]);

  // Cerrar el selector de modelo al hacer clic fuera
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!modelMenuRef.current?.contains(e.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [modelMenuOpen]);

  // Auto-scroll inteligente: solo sigue el stream si el usuario está al final.
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamContent, streamReasoning, streamSteps]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setScrolledUp(!atBottomRef.current);
  };

  // Ir al final del chat con animación suave
  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    atBottomRef.current = true;
  };

  // La navegación por mensajes la gestiona <MinimapNav/> vía [data-msg-id].

  const loadConvs = () => api<{ conversations: Conv[] }>('/chat/conversations').then((d) => setConvs(d.conversations)).catch(() => {});

  const openConv = async (id: string) => {
    setConvId(id);
    setConvsLoading(true);
    // Aislar vista previa por conversación: cerrar panel y limpiar artefactos del chat previo
    setPanelOpen(false);
    setCanvasPayload(null);
    setRuns([]);
    setSources(null);
    setActiveToolStream(null);
    try {
      const d = await api<{ messages: any[] }>(`/chat/conversations/${id}/messages`);
      const loadedMsgs = d.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        reasoning: m.reasoning,
        model: m.model,
        at: m.created_at,
        ...parseStored(m.tools),
      }));
      setMessages(loadedMsgs);

      // Rehidratar artefactos, ejecuciones y fuentes exclusivos de esta conversación
      const convRuns: TerminalRun[] = [];
      let convSources: Sources | null = null;
      let latestCanvas: CanvasPayload | null = null;
      for (const msg of loadedMsgs) {
        for (const t of (msg.tools || []) as ToolEvent[]) {
          if (t.type === 'code') {
            convRuns.push({
              id: Date.now() + Math.random(),
              language: t.language,
              code: t.code || '',
              stdout: t.stdout || '',
              stderr: t.stderr || '',
              exitCode: t.exitCode ?? 0,
              durationMs: t.durationMs || 0,
              running: false,
            });
          } else if (t.type === 'search' && t.results?.length) {
            convSources = { query: t.query, results: t.results };
          } else if (t.type === 'website_generated' && (t.url || t.html)) {
            latestCanvas = { type: 'website', title: t.title, url: t.url, html: t.html };
          } else if (t.type === 'file_generated' && t.url) {
            latestCanvas = {
              type: t.fileType === 'pptx' ? 'slides' : t.fileType === 'docx' ? 'document' : 'sheet',
              title: t.title || t.filename,
              url: t.url,
              filename: t.filename,
              markdown: t.preview?.markdown,
              headers: t.preview?.headers,
              rows: t.preview?.rows,
            };
          }
        }
      }
      setRuns(convRuns);
      setSources(convSources);
      setCanvasPayload(latestCanvas);
      if (latestCanvas) setCanvasTab(latestCanvas.type);
    } finally {
      setConvsLoading(false);
    }
    setStudyDocument(null);
    setContextFiles([]);
    atBottomRef.current = true;
  };

  const newChat = () => {
    setConvId(null);
    setMessages([]);
    setNoticeState('');
    setPanelOpen(false);
    setCanvasPayload(null);
    setRuns([]);
    setSources(null);
    setActiveToolStream(null);
    setStudyDocument(null);
    setContextFiles([]);
    setActiveProjectId(null);
    atBottomRef.current = true;
  };

// Activa un modo de herramienta (Investigación, Diapositivas, …) en una conversación limpia.
  const selectTool = (id: ModeId) => {
    const next = mode === id ? null : id;
    setMode(next);
    if (next && messages.length > 0) newChat();
    // En modo estudio, preparar el documento si hay uno adjunto (sin abrir panel automáticamente)
    if (next === 'study') {
      const docAtt = attachments.find(a => a.kind === 'doc' && a.status === 'ready');
      if (docAtt) {
        setStudyDocument({ ...docAtt, kind: 'doc' as const, file: docAtt.file, mimeType: docAtt.mimeType });
      }
    } else {
      setStudyDocument(null);
    }
    taRef.current?.focus();
  };

  const removeConv = async (id: string) => {
    await api(`/chat/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
    if (convId === id) newChat();
    loadConvs();
  };

  // Redimensiona imágenes adjuntas (máx 1280 px, JPEG 0.85) para no inflar la petición.
  const downscale = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });

  // Videos: el proxy de Vercel rechaza bodies >4.5MB — un video de 8MB se
  // vuelve ~11MB en base64 y el chat colapsa con "Error del servidor" (el
  // mismo cuello de botella que colapsaba las fotos antes del downscale).
  // Inline (data URL) solo hasta 2.5MB; los videos mayores suben DIRECTO al
  // backend de Render (bypass del proxy) y viajan al modelo como URL pública.
  const VIDEO_INLINE_MAX_BYTES = 2.5 * 1024 * 1024;
  const VIDEO_UPLOAD_MAX_BYTES = 15 * 1024 * 1024; // tope inline del modelo VL (15MB crudos ≈ 20MB base64)
  const RENDER_API_URL = (import.meta as any).env?.VITE_RENDER_URL || 'https://aleph-y6it.onrender.com';
  const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });

  // Sube un archivo al backend: directo a Render (bypass del proxy de Vercel
  // y su límite de 4.5MB) con fallback a la ruta relativa si CORS lo bloquea.
  const uploadFile = async (fd: FormData): Promise<any> => {
    const opts = { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd } as const;
    try {
      const res = await fetch(`${RENDER_API_URL}/api/files`, opts);
      return await res.json();
    } catch {
      const res = await fetch('/api/files', opts);
      return await res.json();
    }
  };

  // Sube documentos al servidor (extrae texto) o prepara imágenes en local. Acepta FileList o File[]
  const onFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    const room = Math.max(0, 4 - attachments.length);
    for (const file of Array.from(list).slice(0, room)) {
      if (file.type.startsWith('image/')) {
        const att: Attachment = { name: file.name, kind: 'image', status: 'loading' };
        setAttachments((a) => [...a, att]);
        try {
          const dataUrl = await downscale(file);
          setAttachments((a) => a.map((x) => (x === att ? { ...x, dataUrl, status: 'ready' } : x)));
          setContextFiles(prev => [...prev, { name: file.name, kind: 'image', dataUrl }]);
        } catch {
          setAttachments((a) => a.map((x) => (x === att ? { ...x, status: 'error', note: 'no legible' } : x)));
        }
      } else if (file.type.startsWith('video/')) {
        const att: Attachment = { name: file.name, kind: 'video', status: 'loading' };
        setAttachments((a) => [...a, att]);
        try {
          if (file.size <= VIDEO_INLINE_MAX_BYTES) {
            const dataUrl = await readAsDataUrl(file);
            setAttachments((a) => a.map((x) => (x === att ? { ...x, dataUrl, status: 'ready' } : x)));
            setContextFiles(prev => [...prev, { name: file.name, kind: 'video', dataUrl, mimeType: file.type }]);
          } else {
            if (file.size > VIDEO_UPLOAD_MAX_BYTES) throw new Error('too_big');
            const fd = new FormData();
            fd.append('files', file);
            const d = await uploadFile(fd);
            const f = d.files?.[0];
            if (!f?.publicUrl) throw new Error(f?.error || 'upload_failed');
            setAttachments((a) => a.map((x) => (x === att ? { ...x, remoteUrl: f.publicUrl, fileId: f.fileId, mimeType: file.type, status: 'ready' } : x)));
            setContextFiles(prev => [...prev, { name: file.name, kind: 'video', remoteUrl: f.publicUrl, fileId: f.fileId, mimeType: file.type }]);
          }
        } catch (e) {
          const tooBig = e instanceof Error && e.message === 'too_big';
          setAttachments((a) => a.map((x) => (x === att ? { ...x, status: 'error', note: tooBig ? 'máx 15 MB' : 'no legible' } : x)));
        }
      } else {
        const att: Attachment = { name: file.name, kind: 'doc', status: 'loading', file, mimeType: file.type };
        setAttachments((a) => [...a, att]);
        try {
          const fd = new FormData();
          fd.append('files', file);
          const d = await uploadFile(fd);
          const f = d.files?.[0];
          if (f?.text) {
            const readyAtt = { ...att, text: f.text, status: 'ready' as const, note: f.truncated ? 'truncado' : undefined, fileId: f.fileId };
            setAttachments((a) => a.map((x) => (x === att ? readyAtt : x)));
            // Actualizar contextFiles
            setContextFiles(prev => [...prev, { name: file.name, kind: 'doc', fileId: f.fileId, mimeType: file.type }]);
            // Si estamos en modo estudio, preparar el documento (sin abrir panel automáticamente)
            if (mode === 'study') {
              setStudyDocument({ ...readyAtt, kind: 'doc' as const, file, mimeType: file.type });
            }
          } else setAttachments((a) => a.map((x) => (x === att ? { ...x, status: 'error' as const, note: f?.error || 'error' } : x)));
        } catch {
          setAttachments((a) => a.map((x) => (x === att ? { ...x, status: 'error' as const, note: 'error de red' } : x)));
        }
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  // Pega archivos o capturas de pantalla directamente desde el portapapeles (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    const filesList = e.clipboardData?.files;
    const filesToUpload: File[] = [];

    if (filesList && filesList.length > 0) {
      for (let i = 0; i < filesList.length; i++) {
        filesToUpload.push(filesList[i]);
      }
    } else if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) filesToUpload.push(f);
        }
      }
    }

    if (filesToUpload.length > 0) {
      e.preventDefault();
      onFiles(filesToUpload);
    }
  };

  // Núcleo de streaming compartido por enviar / regenerar / editar.
  const streamReply = async (history: Msg[], attsPayload: any[] = []) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    setStreamReasoning('');
    setStreamContent('');
    setStreamSteps([]);
    setSearchPending(null);
    setMediaPending(null);
    setCodePending(null);
    setNoticeState('');

    let reasoning = '';
    let content = '';
    const tools: ToolEvent[] = [];
    const steps: Step[] = [];
    // Fusiona deltas con el último paso del mismo tipo (flujo cronológico).
    const pushDelta = (kind: 'reasoning' | 'text', d: string) => {
      const last = steps[steps.length - 1];
      if (last && last.kind === kind) (last as any).text += d;
      else steps.push({ kind, text: d });
      setStreamSteps([...steps]);
    };
    const pushTool = (tool: ToolEvent) => {
      tools.push(tool);
      steps.push({ kind: 'tool', tool });
      setStreamSteps([...steps]);
    };
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          conversationId: convId,
          model,
          thinkEffort,
          webSearch: webSearchOn,
          mode,
          attachments: attsPayload,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) showNotice(err.message || 'Límite del plan alcanzado.', 'warn', true);
        else showNotice(err.message || 'Error del servidor.', 'warn', true);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          let evt: any;
          try { evt = JSON.parse(t.slice(5).trim()); } catch { continue; }
          if (evt.type === 'tool_delta') {
            const toolId = evt.id || 'current';
            toolBuffersRef.current[toolId] = (toolBuffersRef.current[toolId] || '') + (evt.delta || '');
            const accumulated = toolBuffersRef.current[toolId];
                        const parsed = parseStreamingToolCall(evt.name, accumulated);
            if (parsed) {
              setActiveToolStream(parsed);
              setCanvasPayload((prev) => ({
                type: parsed.type,
                title: parsed.title,
                html: parsed.html,
                markdown: parsed.markdown,
                code: parsed.code,
                headers: parsed.headers,
                rows: parsed.rows,
                language: parsed.language,
                filename: prev?.filename,
                url: prev?.url,
              }));
              setCanvasTab(parsed.type);
            }
          } else if (evt.type === 'tool' && evt.status === 'running') {
            if (evt.tool === 'search') setSearchPending(evt.query || '');
            if (evt.tool === 'media') setMediaPending(evt.query || '');
            if (evt.tool === 'code') setCodePending(evt.language || 'código');
            if (evt.tool === 'write_file') setWritePending(evt.path || 'archivo');
            if (evt.tool === 'youtube') setYoutubePending(evt.query || 'video');
          } else if (evt.type === 'tool' && evt.status === 'ok') {
            // Workspace tools completados (write_file, read_file, list_files)
            setWritePending(null);
            if (evt.tool === 'write_file') {
              pushTool({ type: 'write_file', path: evt.path, status: evt.status, content: evt.content || '' });
            } else if (evt.tool === 'read_file') {
              // The content comes in the tool result from the model, but we need to capture it
              // For now, just push the tool event
              pushTool({ type: 'read_file', path: evt.path, content: '', status: evt.status });
            } else if (evt.tool === 'list_files') {
              pushTool({ type: 'list_files', path: evt.path, listing: '', status: evt.status });
            }
          } else if (evt.type === 'code') {
            setCodePending(null);
            const ct: ToolEvent = { type: 'code', language: evt.language, code: evt.code || '', stdout: evt.stdout || '', stderr: evt.stderr || '', exitCode: evt.exitCode ?? -1, durationMs: evt.durationMs || 0 };
            pushTool(ct);
            // Espejo en la terminal del sandbox (panel lateral) - solo si el usuario lo abre manualmente.
            setRuns((r) => [...r, { id: Date.now() + Math.random(), language: evt.language, code: evt.code || '', stdout: evt.stdout || '', stderr: evt.stderr || '', exitCode: evt.exitCode ?? -1, durationMs: evt.durationMs || 0, running: false }]);
          } else if (evt.type === 'youtube') {
            setYoutubePending(null);
            pushTool({ type: 'youtube', query: evt.query, title: evt.title, lang: evt.lang, preview: evt.preview, failed: !!evt.failed });
          } else if (evt.type === 'media') {
            setMediaPending(null);
            pushTool({ type: 'media', query: evt.query, images: evt.images || [], videos: evt.videos || [], failed: !!evt.failed });
          } else if (evt.type === 'document_edit') {
            // Aplicar ediciones al documento de estudio
            if (studyDocument && evt.operations && Array.isArray(evt.operations)) {
              let newText = studyDocument.text || '';
              // Aplicar operaciones en orden inverso para mantener los índices correctos
              const sortedOps = [...evt.operations].sort((a: any, b: any) => b.start - a.start);
              for (const op of sortedOps) {
                if (op.type === 'replace' && op.text !== undefined) {
                  newText = newText.slice(0, op.start) + op.text + newText.slice(op.end);
                } else if (op.type === 'insert' && op.text !== undefined) {
                  newText = newText.slice(0, op.start) + op.text + newText.slice(op.start);
                } else if (op.type === 'delete') {
                  newText = newText.slice(0, op.start) + newText.slice(op.end);
                }
              }
              setStudyDocument((prev: StudyDocument | null) => prev ? { ...prev, text: newText, file: prev.file, mimeType: prev.mimeType } : null);
}
        } else if (evt.type === 'generate_image') {
          // Mostrar imagen generada, guardarla en la galería e incrustarla en el mensaje.
          if (evt.imageUrl) {
            pushTool({ type: 'generate_image', prompt: evt.prompt, imageUrl: evt.imageUrl });
            const saved = addToGallery({ url: evt.imageUrl, prompt: evt.prompt || 'Imagen generada', timestamp: Date.now() });
            if (!saved) {
              showNotice('Galería llena: se eliminaron imágenes antiguas para hacer espacio', 'info');
            }
            const md = `\n\n![${(evt.prompt || 'Imagen generada').replace(/[\[\]]/g, '').slice(0, 120)}](${evt.imageUrl})\n\n`;
            content += md;
            setStreamContent(content);
            pushDelta('text', md);
          }
        } else if (evt.type === 'file_generated') {
            // Archivo generado (PPTX, DOCX, XLSX)
            if (evt.url && evt.filename) {
              pushTool({
                type: 'file_generated',
                fileType: evt.fileType || 'pptx',
                url: evt.url,
                filename: evt.filename,
                title: evt.title
              });
              const fileTypeLabel = evt.fileType === 'pptx' ? 'Presentación' : evt.fileType === 'docx' ? 'Documento' : 'Hoja de cálculo';
              const md = `\n\n[${fileTypeLabel} generado](${evt.url}) — ${evt.filename}\n\n`;
              content += md;
              setStreamContent(content);
              pushDelta('text', md);
            }
          } else if (evt.type === 'website_generated') {
            // Sitio web generado con link compartible
            if (evt.url && evt.sharecode) {
              pushTool({ 
                type: 'website_generated', 
                url: evt.url, 
                sharecode: evt.sharecode, 
                title: evt.title,
                html: evt.html,
              });
              const md = `\n\n[Sitio web generado](${evt.url}) — ${evt.title}\n\n`;
              content += md;
              setStreamContent(content);
              pushDelta('text', md);

              // Abrir e inyectar de inmediato el HTML generado en el Canvas lateral
              setCanvasPayload({
                type: 'website',
                title: evt.title,
                url: evt.url,
                html: evt.html,
              });
              setCanvasTab('website');
              setPanelOpen(true);
              setActiveToolStream(null);
            }
          } else if (evt.type === 'skill_installed') {
            pushTool({
              type: 'skill_installed',
              skillId: evt.skillId,
              name: evt.name,
              version: evt.version,
              category: evt.category,
              command: evt.command,
              description: evt.description,
              filesCreated: evt.filesCreated,
            });
            api<{ catalog: any[] }>('/skills')
              .then((d) => {
                if (d?.catalog) setActiveSkillsCount(d.catalog.filter((s) => s.installed && s.active).length);
              })
              .catch(() => {});
          } else if (evt.type === 'task_plan') {
            pushTool({
              type: 'task_plan',
              title: evt.title,
              steps: evt.steps || [],
            });
          } else if (evt.type === 'search') {
            setSearchPending(null);
            const st: ToolEvent = { type: 'search', query: evt.query, results: evt.results || [], failed: !!evt.failed };
            pushTool(st);
            if (st.results.length) {
              setSources({ query: st.query, results: st.results });
            }
          } else if (evt.type === 'reasoning') { reasoning += evt.delta; setStreamReasoning(reasoning); pushDelta('reasoning', evt.delta); }
          else if (evt.type === 'content') { content += evt.delta; setStreamContent(content); pushDelta('text', evt.delta); }
          else if (evt.type === 'error') { showNotice(evt.message, 'warn'); }
          else if (evt.type === 'done') {
            if (evt.conversationId && !convId) { setConvId(evt.conversationId); loadConvs(); }
            // Vincular automáticamente la conversación al proyecto activo.
            if (evt.conversationId && activeProjectId) {
              api(`/projects/${activeProjectId}/conversations`, {
                method: 'POST',
                body: JSON.stringify({ conversationId: evt.conversationId }),
              }).then(() => showNotice('Conversación vinculada al proyecto.', 'info', false, 4000))
                .catch(() => {});
            }
            setUsage((u) => (u.limit ? { ...u, used: u.used + 1 } : u));
          }
        }
      }
      if (content || reasoning || tools.length) {
        setMessages((m) => [...m, { role: 'assistant', content, reasoning: reasoning || null, model, tools: tools.length ? tools : null, steps: steps.length ? [...steps] : null, at: new Date().toISOString() }]);
      }
      // Modos de artefacto: abrir la vista previa automáticamente al terminar.
      if (mode && content) {
        const fence = content.match(/```([\w:+-]*)\n([\s\S]*?)```/);
        if (fence) {
          const lang = fence[1].replace(/^exec:/, '') || 'markdown';
          if (['html', 'markdown', 'md', 'csv', 'svg'].includes(lang)) {
            const fenceCode = fence[2].replace(/\n$/, '');
            const cType = lang === 'html' ? 'website' : 'code';
            setCanvasPayload({ type: cType, language: lang, code: fenceCode, html: lang === 'html' ? fenceCode : undefined });
            setCanvasTab(cType);
            setPanelOpen(true);
          }
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // Detenido por el usuario: conservar lo generado hasta el momento.
        if (content || reasoning || tools.length) {
          setMessages((m) => [...m, { role: 'assistant', content, reasoning: reasoning || null, model, tools: tools.length ? tools : null, steps: steps.length ? [...steps] : null, at: new Date().toISOString() }]);
        }
      } else {
        showNotice('Conexión interrumpida. Inténtalo de nuevo.', 'warn');
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamReasoning('');
      setStreamContent('');
      setStreamSteps([]);
      setSearchPending(null);
      setMediaPending(null);
      setCodePending(null);
      setWritePending(null);
      setYoutubePending(null);
    }
  };

  const send = () => {
    const text = input.trim();
    // No enviar mientras haya archivos cargando: se enviarían sin ellos.
    if (attachments.some((a) => a.status === 'loading')) {
      showNotice('Espera a que los archivos terminen de cargar.', 'warn');
      return;
    }
    const ready = attachments.filter((a) => a.status === 'ready');
    const failedCount = attachments.filter((a) => a.status === 'error').length;
    if ((!text && ready.length === 0) || streaming || !user) return;
    // Todos los adjuntos fallaron: avisar en vez de enviar sin nada.
    if (ready.length === 0 && failedCount > 0) {
      showNotice('Los archivos fallaron al cargar. Quita los fallidos o vuelve a adjuntarlos.', 'warn');
      return;
    }
    if (failedCount > 0) showNotice(`Enviados ${ready.length} archivo(s); ${failedCount} fallaron y fueron omitidos.`, 'info');
    if (usage.limit !== null && usage.used >= usage.limit) {
      showNotice(`Tu límite diario de ${usage.limit} mensajes llegó a su fin. Vuelve mañana o mejora tu plan para seguir conversando.`, 'warn', true);
      return;
    }
    setInput('');
    const payload = ready.map((a) => (a.kind === 'image' ? { name: a.name, kind: 'image', dataUrl: a.dataUrl } : a.kind === 'video' ? { name: a.name, kind: 'video', dataUrl: a.dataUrl, url: a.remoteUrl } : { name: a.name, kind: 'doc', text: a.text, fileId: a.fileId }));
    const displayAtts = ready.map((a) => ({ name: a.name, kind: a.kind, dataUrl: a.dataUrl, fileId: a.fileId, text: a.kind === 'doc' ? a.text : undefined, remoteUrl: a.kind === 'video' ? a.remoteUrl : undefined }));
    setAttachments([]);
    const next: Msg[] = [...messages, { role: 'user', content: text || 'Analiza los archivos adjuntos.', attachments: displayAtts.length ? displayAtts : undefined, at: new Date().toISOString() }];
    setMessages(next);
    atBottomRef.current = true;
    streamReply(next, payload);
  };

  const regenerate = () => {
    if (streaming || messages.length === 0) return;
    const lastAssistant = [...messages].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'assistant');
    const base = lastAssistant ? messages.slice(0, lastAssistant.i) : messages;
    if (base.length === 0 || base[base.length - 1].role !== 'user') return;
    setMessages(base);
    atBottomRef.current = true;
    // Reenvía también los adjuntos originales (docs con su texto) al regenerar.
    const attsPayload = (base[base.length - 1].attachments || []).map((a: any) => (
      a.kind === 'image'
        ? { name: a.name, kind: 'image', dataUrl: a.dataUrl }
        : a.kind === 'video'
        ? { name: a.name, kind: 'video', dataUrl: a.dataUrl, url: a.remoteUrl }
        : { name: a.name, kind: 'doc', text: a.text, fileId: a.fileId }
    )).filter((p: any) => p.kind !== 'doc' || (p.text && String(p.text).trim()));
    streamReply(base, attsPayload);
  };

  const editMessage = (idx: number) => {
    if (streaming) return;
    const m = messages[idx];
    if (m.role !== 'user') return;
    setInput(m.content);
    setMessages(messages.slice(0, idx));
    taRef.current?.focus();
  };

  const copyMessage = async (idx: number, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1600);
  };

  const handleOpenCanvas = (payload: CanvasPayload) => {
    setCanvasPayload(payload);
    setCanvasTab(payload.type);
    setPanelOpen(true);
  };

  const openPreview = (a: Artifact) => {
    handleOpenCanvas({
      type: a.language === 'html' ? 'website' : 'code',
      code: a.code,
      language: a.language,
      html: a.language === 'html' ? a.code : undefined,
    });
  };

  // Ejecución en el entorno aislado: visible inline (tarjeta) y en la terminal del panel.
  const runCode = async (a: Artifact, msgIdx: number) => {
    setCanvasTab('terminal');
    setPanelOpen(true);
    const id = ++runId;
    setRuns((r) => [...r, { id, language: a.language, code: a.code, stdout: '', stderr: '', exitCode: -1, durationMs: 0, running: true, msgIdx }]);
    try {
      const result = await api<Omit<TerminalRun, 'id' | 'language' | 'code'>>('/sandbox/run', {
        method: 'POST',
        body: JSON.stringify({ language: a.language === 'python' ? 'python' : a.language === 'bash' ? 'bash' : 'javascript', code: a.code }),
      });
      setRuns((r) => r.map((x) => (x.id === id ? { ...x, ...result, running: false } : x)));
    } catch (e: any) {
      setRuns((r) => r.map((x) => (x.id === id ? { ...x, stderr: e.message, exitCode: -1, running: false } : x)));
    }
  };

  if (loading || !user) return <div className="min-h-screen bg-ink grid place-items-center"><span className="font-brand text-4xl text-paper animate-pulse">M</span></div>;

  const activeTool = TOOLS.find((t) => t.id === mode) || null;
  const isGallery = location.pathname === '/galeria';
  const isPro = user.plan !== 'free';
  const userRank = PLAN_RANK[user.plan] ?? 0;
  const firstName = (user.name || '').split(' ')[0] || 'investigador';
  const filteredConvs = convQuery.trim()
    ? convs.filter((c) => c.title.toLowerCase().includes(convQuery.trim().toLowerCase()))
    : convs;

  const iconBtn = 'p-1.5 text-paper-dim/70 hover:text-paper transition-colors rounded-md hover:bg-white/5';

  return (
    <div className={`h-screen flex bg-ink text-paper overflow-hidden relative theme-${chatTheme} font-theme-${chatFont}`}>
      {/* Textura de grano (efecto film) sutil */}
      <div className="grain-overlay" />

      {/* Loading bar arriba (estilo NProgress) */}
      {convsLoading && (
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: '72%', animation: 'loadingIn 0.6s ease-out forwards' }} />
          <style>{`
            @keyframes loadingIn { from { width: 0; } to { width: 72%; } }
          `}</style>
        </div>
      )}

      {/* Sidebar (montado siempre: la apertura/cierre es animada por ancho) */}
      <aside className="panel-x z-20 w-[264px] h-full border-r border-line-dark flex flex-col dark-scroll" style={{ width: sidebarOpen ? 264 : 0, opacity: sidebarOpen ? 1 : 0, backdropFilter: 'blur(18px) saturate(150%)', WebkitBackdropFilter: 'blur(18px) saturate(150%)', background: chatTheme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(12,12,12,0.72)' }}>
          <div className="p-3 space-y-2 border-b border-line-dark">
            <div className="flex items-center justify-between px-1 py-1">
              <Link to="/" className="font-brand normal-case select-none" style={{ fontSize: 16, lineHeight: 1 }}>MAVERICK</Link>
              <button onClick={() => setSidebarOpen(false)} className={iconBtn} title="Contraer panel">
                <PanelLeft size={14} strokeWidth={1.8} />
              </button>
            </div>
            <button onClick={newChat} className="btn-glow btn-lift w-full bg-paper text-ink py-2.5 rounded-xl font-mono text-[11px] tracking-[0.15em] uppercase hover:opacity-90 flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <Plus size={13} strokeWidth={2} /> Nuevo chat
            </button>
            <div className="relative">
              <BuscarConversacionesIcon size={16} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-dim/60 pointer-events-none" />
              <input
                value={convQuery}
                onChange={(e) => setConvQuery(e.target.value)}
                placeholder="Buscar conversaciones"
                className="w-full bg-ink-2 border border-line-dark rounded-xl pl-9 pr-3 py-2 text-[12.5px] text-paper outline-none placeholder:text-paper-dim/50 focus:border-[#4f7ef0]/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <p className="px-2.5 pt-2 pb-1.5 font-mono text-[9px] tracking-[0.25em] uppercase text-paper-dim/50">Herramientas</p>
            <div className="stagger-enter">
                          {TOOLS.map(({ id, label, icon: Icon }, index) => (
                <button
                  key={id}
                  onClick={() => selectTool(id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-300 whitespace-nowrap border ${mode === id ? 'bg-ink-2 text-paper border-[var(--accent-bright)]/30 shadow-[inset_0_0_0_1px_rgba(79,126,240,0.2)]' : 'text-[#c8c8c8] hover:bg-ink-2/60 border-transparent'}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="icon shrink-0" style={mode === id ? { color: 'var(--accent-bright)' } : undefined}>
                    <Icon size={26} strokeWidth={1.8} />
                  </span>
                  {label}
                  {mode === id && <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 live-indicator" style={{ background: 'var(--accent-bright)' }} />}
                </button>
              ))}
            </div>
            <p className="px-2.5 pt-4 pb-1.5 font-mono text-[9px] tracking-[0.25em] uppercase text-paper-dim/50">Espacios</p>
            <Link
              to="/class"
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-300 text-[#c8c8c8] hover:bg-ink-2/60"
              title="Maverick Class — Estudio con X1, buscador académico, apuntes con IA y comunidad"
            >
              <span className="icon shrink-0" style={{ color: 'var(--accent-bright)' }}>
                <EstudioIcon size={26} strokeWidth={1.8} />
              </span>
              Maverick Class
              <span className="ml-auto px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#4f7ef0]/15 text-[#7aa2f7] border border-[#4f7ef0]/30">
                X1
              </span>
            </Link>
            <Link
              to="/galeria"
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-300 ${isGallery ? 'bg-ink-2 text-paper' : 'text-[#c8c8c8] hover:bg-ink-2/60'}`}
              style={{ animationDelay: '480ms' }}
              title="Ver imágenes generadas por la IA"
            >
              <span className="icon shrink-0" style={isGallery ? { color: 'var(--accent-bright)' } : undefined}>
                <GaleryIcon size={26} strokeWidth={1.8} />
              </span>
              Galería
              {galCount > 0 && (
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono rounded-full bg-[var(--accent-bright)]/20 text-[var(--accent-bright)]">
                  {galCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setProjectsOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-300 text-[#c8c8c8] hover:bg-ink-2/60"
              style={{ animationDelay: '540ms' }}
              title="Organiza archivos y conversaciones por proyecto"
            >
              <span className="icon shrink-0" style={{ color: 'var(--accent-bright)' }}>
                <ProyectosIcon size={26} strokeWidth={1.8} />
              </span>
              Proyectos
            </button>
            <button
              onClick={() => setSkillsOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-300 text-[#c8c8c8] hover:bg-ink-2/60"
              title="Instalar y gestionar Skills (ej: $ uipro init --ai claude)"
            >
              <span className="icon shrink-0 w-[26px] h-[26px] flex items-center justify-center">
                <SquareTerminal size={18} strokeWidth={1.8} />
              </span>
              Skills & CLI
              {activeSkillsCount > 0 && (
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono rounded-full bg-[#7ee2a8]/15 text-[#7ee2a8] border border-[#7ee2a8]/30">
                  {activeSkillsCount}
                </span>
              )}
            </button>
            <Link
              to="/asistente"
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-300 text-[#c8c8c8] hover:bg-ink-2/60"
              title="Instalar Maverick Code CLI en tu terminal local (Windows, macOS, Linux)"
            >
              <span className="icon shrink-0 w-[26px] h-[26px] flex items-center justify-center text-[#4f7ef0]">
                <SquareTerminal size={18} strokeWidth={1.8} />
              </span>
              Maverick Code
              <span className="ml-auto px-1.5 py-0.5 text-[9px] font-mono rounded bg-white/[0.06] text-paper-dim border border-white/10">
                CLI
              </span>
            </Link>
            <p className="px-2.5 pt-4 pb-1.5 font-mono text-[9px] tracking-[0.25em] uppercase text-paper-dim/50">Recientes</p>
            {filteredConvs.length === 0 && (
              <p className="px-2.5 py-3 text-[12px] text-paper-dim/60">{convQuery ? 'Sin resultados.' : 'Aún no hay conversaciones.'}</p>
            )}
            {filteredConvs.map((c) => (
              <div key={c.id} className={`group flex items-center gap-1 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-200 border ${
                convId === c.id ? 'bg-ink-2 border-line-dark' : 'hover:bg-ink-2/60 border-transparent'
              }`}>
                <button onClick={() => openConv(c.id)} className="flex-1 text-left text-[13px] truncate text-[#c8c8c8]">{c.title}</button>
                <button onClick={() => removeConv(c.id)} className="opacity-0 group-hover:opacity-100 text-paper-dim hover:text-red-400 p-1 rounded transition-opacity" aria-label="Eliminar conversación">
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-line-dark p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 shrink-0 rounded-full grid place-items-center font-mono text-[11px] uppercase bg-ink-2 border border-line-dark" style={{ color: 'var(--accent-bright)' }}>
                  {(user.name || 'A')[0]}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] truncate leading-tight">{user.name}</p>
                  <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-paper-dim whitespace-nowrap">
                    {PAYMENTS_BETA
                      ? 'planes βeta — próximamente'
                      : (isPro ? `${user.plan} · ${currentModelName}` : `plan gratis · ${currentModelName}`)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleThemeChange(chatTheme === 'dark' ? 'light' : 'dark')}
                  className={iconBtn}
                  title={chatTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                >
                  {chatTheme === 'dark' ? <Sun size={13} strokeWidth={1.8} /> : <Moon size={13} strokeWidth={1.8} />}
                </button>
                <button onClick={() => setSettingsOpen(true)} className={iconBtn} title="Configuración">
                  <Settings2 size={13} strokeWidth={1.8} />
                </button>
                <button onClick={() => { logout(); navigate('/'); }} className={iconBtn} title="Cerrar sesión">
                  <LogOut size={13} strokeWidth={1.8} />
                </button>
              </div>
            </div>
            {PAYMENTS_BETA && (
              <p className="mt-2.5 px-1 font-mono text-[8.5px] tracking-[0.18em] uppercase text-paper-dim/50">
                βeta · pagos y planes en pruebas
              </p>
            )}
            {!isPro && (
              <>
                {usage.limit !== null && (
                  <div className="mt-2.5 px-1">
                    <div className="flex justify-between font-mono text-[9px] tracking-[0.15em] uppercase text-paper-dim mb-1.5">
                      <span>Mensajes hoy</span>
                      <span style={usage.used >= usage.limit ? { color: '#f87171' } : undefined}>{usage.used} / {usage.limit}</span>
                    </div>
                    <div className="h-1 rounded-full bg-ink-2 border border-line-dark overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                          background: usage.used >= usage.limit ? '#f87171' : 'var(--accent-bright)',
                        }}
                      />
                    </div>
                  </div>
                )}
                <Link to="/pricing" className="mt-2.5 block text-center border border-line-dark rounded-xl py-2 font-mono text-[10px] tracking-[0.15em] uppercase hover:border-paper-dim transition-colors whitespace-nowrap" style={{ color: 'var(--accent-bright)' }}>
                  Ver planes
                </Link>
              </>
            )}
          </div>
        </aside>
      {/* Columna principal - Chat */}
      <main className="flex-1 flex flex-col min-w-0 bg-ink overflow-hidden relative">
        {/* Barra superior */}
        <div className="h-12 border-b border-line-dark flex items-center justify-between px-4 shrink-0 glass-overlay relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className={`${iconBtn} msg-enter`} title="Expandir panel">
                <PanelLeft size={14} strokeWidth={1.8} />
              </button>
            )}
            <div className="relative shrink-0">
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors max-w-[320px] ${modelMenuOpen ? 'bg-ink-2 text-paper' : 'text-paper-dim hover:text-paper hover:bg-ink-2/60'}`}
                title="Cambiar modelo"
              >
                <span className="truncate font-brand text-[15px]">
                  {currentModelName}
                </span>
                {isReasoningModel(model) && (
                  <span
                    className="px-1.5 py-0.5 rounded border border-[var(--accent-bright)]/40 font-mono text-[8.5px] uppercase tracking-wider shrink-0"
                    style={{ color: 'var(--accent-bright)' }}
                    title="Nivel de pensamiento"
                  >
                    {THINK_EFFORTS.find((e) => e.id === thinkEffort)?.label}
                  </span>
                )}
                <ChevronDown size={13} strokeWidth={2} className={`shrink-0 transition-transform duration-200 ${modelMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* Model Menu — anclado al botón, no tapa funciones laterales */}
              {modelMenuOpen && (
                <div
                  ref={modelMenuRef}
                  className="absolute top-full left-0 mt-1.5 z-50 glass-panel border border-white/10 rounded-xl p-1.5 shadow-xl dark-scroll animate-slide-up w-[320px] max-h-[70vh] overflow-y-auto"
                >
                  {modelList.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setModelMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[13px] transition-colors ${
                        model === m.id ? 'bg-ink-3 text-paper' : 'text-[#c8c8c8] hover:bg-ink-3'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="text-[10.5px] text-paper-dim truncate">{m.tagline}</p>
                      </div>
                      {model === m.id && <Check size={14} strokeWidth={2.2} className="shrink-0" style={{ color: 'var(--accent-bright)' }} />}
                      {!m.free && userRank < 1 && (
                        <span className="px-2 py-0.5 text-[8px] font-mono rounded bg-yellow-500/20 text-yellow-400 shrink-0">Plus</span>
                      )}
                    </button>
                  ))}
                  {/* Think effort: solo modelos con razonamiento (X1) */}
                  {isReasoningModel(model) && (
                    <div className="mt-1.5 border-t border-line-dark px-2.5 pt-2 pb-1.5">
                      <p className="font-mono text-[8.5px] tracking-[0.2em] uppercase text-paper-dim mb-1.5">Nivel de pensamiento</p>
                      <div className="grid grid-cols-4 gap-1">
                        {THINK_EFFORTS.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setThinkEffort(e.id)}
                            title={e.desc}
                            className={`py-1.5 rounded-lg font-mono text-[9.5px] tracking-[0.08em] uppercase border transition-colors ${
                              thinkEffort === e.id
                                ? 'border-[var(--accent-bright)]/60 bg-[var(--accent-bright)]/15 text-paper'
                                : 'border-line-dark text-paper-dim hover:text-paper hover:border-paper-dim/50'
                            }`}
                          >
                            {e.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10.5px] text-paper-dim/70">
                        {THINK_EFFORTS.find((e) => e.id === thinkEffort)?.desc}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-paper-dim truncate hidden md:inline">
              {convId ? (convs.find((c) => c.id === convId)?.title || 'Conversación') : ''}
            </span>
            {activeProjectId && (
              <button
                onClick={() => setActiveProjectId(null)}
                className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase px-2 py-1 rounded-full border border-[var(--accent-bright)]/40 text-[var(--accent-bright)] hover:bg-[var(--accent-bright)]/10 transition-colors shrink-0 msg-enter"
                title="Las conversaciones nuevas se vincularán a este proyecto. Click para desactivar."
              >
                <ProyectosIcon size={14} strokeWidth={2} />
                Vinculando a proyecto
                <X size={10} strokeWidth={2.2} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSkillsOpen(true)} className={`${iconBtn} flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase hover:text-paper transition-colors`} title="Skills & CLI Plugins ($ uipro init)">
              <SquareTerminal size={14} strokeWidth={1.8} />
              <span className="hidden sm:inline">Skills</span>
              {activeSkillsCount > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-[#7ee2a8]/15 text-[#7ee2a8] border border-[#7ee2a8]/30">
                  {activeSkillsCount}
                </span>
              )}
            </button>
            <Link
              to="/asistente"
              className={`${iconBtn} hidden md:flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase hover:text-paper transition-colors`}
              title="Maverick Code CLI (Terminal)"
            >
              <SquareTerminal size={14} strokeWidth={1.8} className="text-[#4f7ef0]" />
              <span>CLI</span>
            </Link>
            <button onClick={() => setProjectsOpen(true)} className={`${iconBtn} flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase hover:text-paper transition-colors`} title="Proyectos">
              <ProyectosIcon size={20} strokeWidth={1.8} />
              Proyectos
            </button>
            <button onClick={() => setFilesOpen(!filesOpen)} className={`${iconBtn} flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase ${filesOpen ? 'active' : ''}`} title="Archivos del chat">
              <ContextoIcon size={20} strokeWidth={1.8} />
              <span className="hidden sm:inline">Archivos</span>
              {contextFiles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono rounded-full bg-[var(--accent-bright)]/20 text-[var(--accent-bright)]">
                  {contextFiles.length}
                </span>
              )}
            </button>
            <button onClick={() => setPanelOpen(!panelOpen)} className={`${iconBtn} flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase ${panelOpen ? 'active' : ''}`}>
              <PanelRight size={13} strokeWidth={1.8} />
              {panelOpen ? 'Cerrar panel' : 'Panel'}
            </button>
          </div>
        </div>

{/* Files Panel - overlay lateral absoluto: no ocupa espacio en el layout
    cuando está cerrado (antes empujaba la respuesta hacia abajo) */}
        {contextFiles.length > 0 && (
          <div className="panel-x context-panel absolute right-0 top-12 bottom-0 z-30" style={{ width: filesOpen ? 360 : 0, opacity: filesOpen ? 1 : 0 }}>
            <aside className="w-[360px] h-full bg-ink border-l border-line-dark flex flex-col">
              <div className="border-b border-line-dark p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="icon"><ContextoIcon size={20} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} /></span>
                  <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-paper-dim">Archivos ({contextFiles.length})</span>
                </div>
                <button
                  onClick={() => setFilesOpen(false)}
                  className="p-1 text-paper-dim hover:text-paper transition-colors"
                  aria-label="Cerrar panel de archivos"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {contextFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="group relative flex items-start gap-3 px-3 py-3 bg-ink border border-line-dark rounded-xl text-[12px] font-mono"
                  >
                    {/* Preview */}
                    {f.kind === 'image' && f.dataUrl ? (
                      <img src={f.dataUrl} alt={f.name} className="w-16 h-16 rounded-lg object-cover border border-line-dark" />
                    ) : f.kind === 'video' && (f.dataUrl || f.remoteUrl) ? (
                      <video src={f.dataUrl || f.remoteUrl} className="w-16 h-16 rounded-lg object-cover border border-line-dark" muted />
                    ) : f.kind === 'image' || f.kind === 'video' ? (
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-ink-2 border border-line-dark">
                        <ImagenesVideoIcon size={24} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-ink-2 border border-line-dark">
                        <DocumentacionIcon size={24} strokeWidth={1.8} style={{ color: '#f59e0b' }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-paper font-medium text-[12px]">{f.name}</p>
                      <p className="text-[10px] text-paper-dim/60 font-mono">
                        {f.kind === 'doc' ? 'Documento' : f.kind === 'video' ? 'Video' : 'Imagen'}
                        {f.mimeType && ` · ${f.mimeType}`}
                      </p>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => {
                        setAttachments(prev => prev.filter((_, j) => j !== idx));
                        setContextFiles(prev => prev.filter((_, j) => j !== idx));
                      }}
                      className="absolute top-2 right-2 p-1 rounded-lg bg-white/5 text-paper-dim/50 hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Quitar ${f.name}`}
                    >
                      <X size={10} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
{/* Mensajes + minimapa anclado a esta columna */}
        <div className="flex-1 min-h-0 relative">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-auto dark-scroll relative" style={{ fontSize: settings.fontSize === 'sm' ? '14px' : settings.fontSize === 'lg' ? '17px' : undefined }}>
          <div className="max-w-[720px] mx-auto px-6 py-8">
            {messages.length === 0 && !streaming && (
              <div className="h-full min-h-[70vh] flex flex-col items-center justify-center text-center -mt-10 aurora-stage">
                <span className="aurora-extra" aria-hidden="true" />
                <h1 className="font-brand brand-wordmark brand-enter select-none text-[clamp(3.4rem,10vw,7rem)] leading-none" >
                  MAVERICK
                </h1>
                <p className="mt-5 font-mono text-[11px] tracking-[0.25em] uppercase text-paper-dim font-medium msg-enter" style={{ animationDelay: '260ms' }}>
                  {greeting()}, {firstName} — elige una herramienta o escribe para empezar
                </p>
                <div className="mt-8 msg-enter" style={{ animationDelay: '380ms' }}>
                  <SuggestionChips onSelect={selectTool} />
                </div>
              </div>
            )}


            {messages.map((m, i) => {
              const showDay = i === 0 || dayKey(m.at) !== dayKey(messages[i - 1].at);
              return (
              <div key={m.id || i} className={`${settings.density === 'compact' ? 'mb-4' : 'mb-7'} msg-enter group/msg`} data-msg-id={i}>
                {showDay && (
                  <div className="flex items-center gap-3 my-6" aria-hidden="true">
                    <div className="flex-1 h-px bg-line-dark/60" />
                    <span className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-paper-dim/60">{dayLabel(m.at)}</span>
                    <div className="flex-1 h-px bg-line-dark/60" />
                  </div>
                )}
                {m.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%]">
                      <div className="message-bubble-user bg-ink-2 rounded-2xl rounded-br-md px-4 py-3">
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                             {m.attachments.map((a, j) => (
                               <span key={j} className="flex items-center gap-1.5 border border-line-dark bg-ink rounded-lg px-2 py-1 font-mono text-[10px] text-paper-dim">
                                 {a.kind === 'image' && a.dataUrl ? (
                                   <img src={a.dataUrl} alt={a.name} className="w-5 h-5 rounded object-cover" />
                                 ) : a.kind === 'image' ? (
                                   <SubirArchivosIcon size={14} strokeWidth={1.8} />
                                 ) : a.kind === 'video' ? (
                                   a.dataUrl
                                     ? <video src={a.dataUrl} className="w-5 h-5 rounded object-cover" muted />
                                     : <Film size={14} strokeWidth={1.8} />
                                 ) : (
                                   <DocumentacionIcon size={14} strokeWidth={1.8} />
                                 )}
                                 <span className="max-w-[160px] truncate">{a.name}</span>
                               </span>
                             ))}
                          </div>
                        )}
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <div className="mt-1.5 flex justify-end gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                        <button onClick={() => copyMessage(i, m.content)} className={iconBtn} title="Copiar">
                          {copiedIdx === i ? <Check size={13} strokeWidth={1.8} /> : <Copy size={13} strokeWidth={1.8} />}
                        </button>
                        <button onClick={() => editMessage(i)} className={iconBtn} title="Editar y reenviar">
                          <Pencil size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5 opacity-80">
                      <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-paper-dim">
                        {(m.model || 'x0').toUpperCase()}
                      </span>
                      {m.at && <span className="font-mono text-[9px] text-paper-dim/50">{timeLabel(m.at)}</span>}
                    </div>
                    {m.steps?.length ? (
                      <StepsView steps={m.steps} onPreview={openPreview} onOpenCanvas={handleOpenCanvas} onExec={(a) => runCode(a, i)} showThinking={settings.showThinking && isReasoningModel(m.model || model)} defaultOpen={settings.expandToolsAuto} model={m.model || model} />
                    ) : (
                      <>
                        <ToolList tools={m.tools} defaultOpen={settings.expandToolsAuto} onOpenCanvas={handleOpenCanvas} />
                        {/* El razonamiento ya se muestra en StepsView; no duplicar con Proof */}
                        <Markdown content={m.content} dark={chatTheme === 'dark'} onPreview={openPreview} onExec={(a) => runCode(a, i)} />
                        {generatedImages(m).map((u, gi) => (
                          <div key={gi} className="mt-3 max-w-[420px]">
                            <MdImage src={u} alt="Imagen generada" title="Imagen generada por IA" />
                          </div>
                        ))}
                      </>
                    )}
                    {runs.filter((r) => r.msgIdx === i).map((r) => <CodeRunCard key={r.id} run={r} />)}
                    <div className="mt-2 flex gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity items-center">
                      <button onClick={() => copyMessage(i, m.content)} className={iconBtn} title="Copiar respuesta">
                        {copiedIdx === i ? <Check size={13} strokeWidth={1.8} /> : <Copy size={13} strokeWidth={1.8} />}
                      </button>
                      <button onClick={regenerate} disabled={streaming} className={`${iconBtn} disabled:opacity-30`} title="Regenerar respuesta">
                        <RotateCcw size={13} strokeWidth={1.8} />
                      </button>
                  {/* Reacciones */}
                      <button
                        onClick={() => setMsgReactions((r) => { const n = { ...r }; (n[m.id || String(i)] as any) = r[m.id || String(i)] === 'up' ? undefined : 'up'; return n; })}
                        className={`${iconBtn} ${msgReactions[m.id || String(i)] === 'up' ? 'text-[var(--accent-bright)]' : ''}`}
                        title="Buena respuesta"
                      >
                        <Check size={13} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => setMsgReactions((r) => { const n = { ...r }; (n[m.id || String(i)] as any) = r[m.id || String(i)] === 'down' ? undefined : 'down'; return n; })}
                        className={`${iconBtn} ${msgReactions[m.id || String(i)] === 'down' ? 'text-red-400' : ''}`}
                        title="Mala respuesta"
                      >
                        <X size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}

            {streaming && (
              <div className={`${settings.density === 'compact' ? 'mb-4' : 'mb-7'} msg-enter`}>
                <div className="flex items-center gap-2 mb-2.5 opacity-80">
                  <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-paper-dim">
                    Razonando…
                  </span>
                </div>
                {/* Pasos del agente en orden cronológico: piensa → busca → ejecuta → responde */}
                <StepsView steps={streamSteps} streaming onPreview={openPreview} onOpenCanvas={handleOpenCanvas} onExec={(a) => runCode(a, messages.length)} showThinking={settings.showThinking && isReasoningModel(model)} defaultOpen={settings.expandToolsAuto} model={model} />
                {activeToolStream && (
                  <div className="mb-3 rounded-xl border border-line-dark bg-ink-2/90 px-4 py-3 msg-enter shadow-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#4f7ef0] animate-ping absolute opacity-75" />
                          <span className="w-2 h-2 rounded-full bg-[#4f7ef0] relative" />
                        </div>
                        <span className="font-mono text-[11.5px] uppercase tracking-wider text-paper font-medium truncate">
                          {activeToolStream.toolName === 'generate_website'
                            ? 'Generando sitio web...'
                            : activeToolStream.toolName === 'generate_pptx'
                            ? 'Generando presentación PPTX...'
                            : activeToolStream.toolName === 'generate_docx'
                            ? 'Generando documento Word...'
                            : activeToolStream.toolName === 'generate_xlsx'
                            ? 'Generando hoja de datos Excel...'
                            : `Escribiendo archivo: ${activeToolStream.title}`}
                        </span>
                        {activeToolStream.title && (
                          <span className="text-[12px] text-paper-dim/80 truncate font-mono hidden sm:inline">
                            «{activeToolStream.title}»
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            handleOpenCanvas({
                              type: activeToolStream.type,
                              title: activeToolStream.title,
                              html: activeToolStream.html,
                              markdown: activeToolStream.markdown,
                              code: activeToolStream.code,
                              headers: activeToolStream.headers,
                              rows: activeToolStream.rows,
                              language: activeToolStream.language,
                            });
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-paper font-mono text-[11px] border border-line-dark transition-colors"
                          title="Ver en vista previa"
                        >
                          <Eye size={12} />
                          <span className="hidden sm:inline">Vista previa</span>
                        </button>
                        <Loader2 size={13} className="animate-spin text-paper-dim shrink-0" />
                      </div>
                    </div>

                    {/* BARRA DE PROGRESO ANIMADA */}
                    <div className="w-full">
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-[#7ee2a8] rounded-full transition-all duration-300 relative"
                          style={{
                            width: `${Math.min(95, Math.max(18, Math.round(((activeToolStream.linesCount || 10) / 750) * 100)))}%`,
                          }}
                        >
                          <div className="absolute inset-0 bg-white/30 animate-pulse" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10.5px] font-mono text-paper-dim/70">
                        <span>Construyendo estructura HTML y diseño interactivo...</span>
                        <span>{Math.min(95, Math.max(18, Math.round(((activeToolStream.linesCount || 10) / 750) * 100)))}%</span>
                      </div>
                    </div>
                  </div>
                )}
                {searchPending && (
                  <div className="mb-3 border border-line-dark bg-ink-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 msg-enter">
                    <BusquedaWebIcon size={16} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} />
                    <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-paper-dim">Buscar en la Web</span>
                    <span className="text-[12px] text-paper-dim/80 truncate font-mono">«{searchPending}»</span>
                    <Loader2 size={12} strokeWidth={2} className="ml-auto animate-spin text-paper-dim shrink-0" />
                  </div>
                )}
                {mediaPending && (
                  <div className="mb-3 border border-line-dark bg-ink-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 msg-enter">
                    <ImagenesVideoIcon size={16} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} />
                    <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-paper-dim">Obteniendo medios</span>
                    <span className="text-[12px] text-paper-dim/80 truncate font-mono">«{mediaPending}»</span>
                    <Loader2 size={12} strokeWidth={2} className="ml-auto animate-spin text-paper-dim shrink-0" />
                  </div>
                )}
                {codePending && (
                  <div className="mb-3 border border-line-dark bg-ink-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 msg-enter">
                    <HojasIcon size={16} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} />
                    <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-paper-dim">Ejecutando código</span>
                    <span className="text-[12px] text-paper-dim/80 truncate font-mono">({codePending})</span>
                    <Loader2 size={12} strokeWidth={2} className="ml-auto animate-spin text-paper-dim shrink-0" />
                  </div>
                )}
                {writePending && (
                  <div className="mb-3 border border-line-dark bg-ink-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 msg-enter">
                    <HojasIcon size={16} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} />
                    <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-paper-dim">Escribiendo archivo</span>
                    <span className="text-[12px] text-paper-dim/80 truncate font-mono">{writePending}</span>
                    <Loader2 size={12} strokeWidth={2} className="ml-auto animate-spin text-paper-dim shrink-0" />
                  </div>
                )}
                {youtubePending && (
                  <div className="mb-3 border border-line-dark bg-ink-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 msg-enter">
                    <BusquedaWebIcon size={16} strokeWidth={1.8} style={{ color: 'var(--accent-bright)' }} />
                    <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-paper-dim">Leyendo video de YouTube</span>
                    <span className="text-[12px] text-paper-dim/80 truncate font-mono">{youtubePending}</span>
                    <Loader2 size={12} strokeWidth={2} className="ml-auto animate-spin text-paper-dim shrink-0" />
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Minimapa de la conversación (borde derecho) + lista al hover */}
        <MinimapNav
          containerRef={scrollRef}
          messages={messages.map((m, i) => ({ idx: i, role: m.role, content: m.content, attachments: m.attachments }))}
          streaming={streaming}
        />

        {/* Botón flotante "Ir hacia abajo" — aparece cuando no estás al final */}
        {scrolledUp && (
          <div className="absolute bottom-6 right-6 z-30 animate-slide-up">
            <button
              onClick={() => scrollToBottom(true)}
              className="p-2.5 rounded-full glass-panel border hover:border-[#4f7ef0]/60 btn-lift group"
              title="Ver el mensaje más reciente"
            >
              <ChevronDown size={15} strokeWidth={2} className="text-paper-dim group-hover:text-paper transition-colors" />
            </button>
          </div>
        )}
        </div>

        {/* Composer bar */}
        <div className="px-4 pb-4 pt-2 composer-fade-bg" style={{ background: chatTheme === 'light' ? 'linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.96) 35%)' : 'linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.85) 40%)' }}>
          <div className="max-w-[720px] mx-auto">
            <div className="glass-panel-strong rounded-2xl transition-all composer-glow focus-within:border-[#4f7ef0]/70 relative">
              {/* Atajos visibles (aparecen cuando está vacío y no hay streaming) */}
              {input === '' && !streaming && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-3 text-paper-dim/50 pointer-events-none select-none font-mono text-[9px] tracking-[0.2em] uppercase whitespace-nowrap">
                  <span><kbd className="px-1.5 py-0.5 border border-line-dark rounded-[4px] text-[8.5px] font-medium">↵</kbd> enviar</span>
                  <span><kbd className="px-1.5 py-0.5 border border-line-dark rounded-[4px] text-[8.5px] font-medium">⇧↵</kbd> nueva línea</span>
                </div>
              )}
              {/* Adjuntos dentro de la caja — el estado es visible:
                  spinner mientras carga, rojo + nota si falló */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                    {attachments.map((a, i) => (
                      <span
                        key={i}
                        title={a.status === 'error' ? (a.note || 'error al cargar') : a.name}
                        className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 font-mono text-[10px] ${
                          a.status === 'error'
                            ? 'border-red-500/50 bg-red-500/10 text-red-300'
                            : 'border-line-dark bg-ink text-paper-dim'
                        }`}
                      >
                        {a.status === 'loading' ? (
                          <Loader2 size={14} strokeWidth={2} className="animate-spin text-paper-dim shrink-0" />
                        ) : a.kind === 'image' && a.dataUrl ? (
                          <img src={a.dataUrl} alt={a.name} className="w-5 h-5 rounded object-cover shrink-0" />
                        ) : a.kind === 'video' && (a.dataUrl || a.remoteUrl) ? (
                          <video src={a.dataUrl || a.remoteUrl} className="w-5 h-5 rounded object-cover shrink-0" muted />
                        ) : a.kind === 'video' ? (
                          <Film size={14} strokeWidth={1.8} className="shrink-0" />
                        ) : a.kind === 'image' ? (
                          <SubirArchivosIcon size={14} strokeWidth={1.8} className="shrink-0" />
                        ) : (
                          <DocumentacionIcon size={14} strokeWidth={1.8} className="shrink-0" />
                        )}
                        <span className="max-w-[160px] truncate">{a.name}</span>
                        {a.status === 'error' && a.note && (
                          <span className="text-[9px] text-red-400/80 truncate max-w-[100px]">{a.note}</span>
                        )}
                       <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 p-0.5 hover:bg-red-500/20 rounded shrink-0">
                         <X size={10} strokeWidth={2} />
                       </button>
                     </span>
                   ))}
                 </div>
               )}
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={activeTool ? activeTool.placeholder : (webSearchOn ? 'Pregunta con búsqueda web…' : 'Escribe un mensaje…')}
                rows={1}
                className="w-full bg-transparent px-4 pt-3.5 pb-1 text-[14px] text-paper outline-none resize-none placeholder:text-paper-dim/60"
                style={{ minHeight: '48px', maxHeight: '200px' }}
                disabled={streaming}
              />
              {/* Barra de acciones integrada */}
              <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`${iconBtn} flex-shrink-0`}
                  title="Adjuntar archivos (o pega con Ctrl+V)"
                  disabled={attachments.length >= 4}
                >
                  <SubirArchivosIcon size={24} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setDriveModalOpen(true)}
                  className={`${iconBtn} flex-shrink-0 hover:text-blue-400`}
                  title="Insertar desde Google Drive"
                  disabled={attachments.length >= 4}
                >
                  <HardDrive size={18} strokeWidth={1.8} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => onFiles(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => setWebSearchOn(!webSearchOn)}
                  className={`${iconBtn} ${webSearchOn ? 'active text-[var(--accent-bright)]' : ''}`}
                  title="Buscar en la web"
                  disabled={streaming}
                >
                  <BusquedaWebIcon size={24} strokeWidth={1.8} />
                </button>
                {webSearchOn && (
                  <span className="ml-1.5 font-mono text-[9px] tracking-[0.2em] uppercase truncate" style={{ color: 'var(--accent-bright)' }}>
                    búsqueda web
                  </span>
                )}
                <button
                  onClick={() => (streaming ? abortRef.current?.abort() : send())}
                  disabled={!streaming && !input.trim() && attachments.length === 0}
                  className={`ml-auto p-2 rounded-xl font-mono text-[11px] tracking-[0.15em] uppercase transition-colors flex-shrink-0 ${
                    streaming
                      ? 'bg-ink-3 text-paper hover:bg-ink-3/70'
                      : 'bg-[var(--accent-bright)] text-ink hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                  title={streaming ? 'Detener' : 'Enviar'}
                >
                  {streaming ? <Square size={12} strokeWidth={2.5} fill="currentColor" /> : <Send size={14} strokeWidth={2} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right panel: Definitive MAVERICK Canvas */}
      {panelOpen && (
        <aside className="w-full md:w-[500px] lg:w-[600px] xl:w-[680px] h-full shrink-0 z-30 transition-all duration-200">
          <ArtifactCanvas
            payload={canvasPayload}
            runs={runs}
            sources={sources}
            activeTab={canvasTab}
            onTabChange={setCanvasTab}
            onClose={() => setPanelOpen(false)}
          />
        </aside>
      )}

      {/* Skills & CLI Modal */}
      <SkillsModal
        open={skillsOpen}
        onClose={() => setSkillsOpen(false)}
        onChanged={setActiveSkillsCount}
        onRunCommandInChat={(cmd) => {
          setInput(cmd);
          taRef.current?.focus();
        }}
      />

      {/* Projects Modal */}
      {projectsOpen && (
        <ProjectsPanel
          open={projectsOpen}
          onClose={() => setProjectsOpen(false)}
          onChatWithProject={setActiveProjectId}
        />
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettings={setSettings}
          onClearHistory={() => {}}
          chatTheme={chatTheme}
          onChatThemeChange={handleThemeChange}
          chatFont={chatFont}
          onChatFontChange={handleFontChange}
          onOpenGoogleDrive={() => setDriveModalOpen(true)}
        />
      )}

      {/* Google Drive Modal */}
      <GoogleDriveModal
        open={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        onFileSelected={(file) => onFiles([file])}
      />

      {/* Anuncios del sistema (overlay fijo: no desplaza el chat) */}
      <AnnouncementModal />

      {/* Notices */}
      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 toast-premium">
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] border backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${
            noticeKind === 'warn' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-green-500/10 border-green-500/30 text-green-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${noticeKind === 'warn' ? 'bg-red-400' : 'bg-green-400'}`} />
            <span className="flex-1">{notice}</span>
            {noticePricing && (
              <button onClick={() => navigate('/pricing')} className="ml-2 px-3 py-1 text-[11px] font-mono rounded bg-white/10 hover:bg-white/20 transition-colors shrink-0">
                Ver planes
              </button>
            )}
            <button
              onClick={() => setNoticeState('')}
              className="ml-2 p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <X size={14} strokeWidth={2} className="text-paper-dim" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}