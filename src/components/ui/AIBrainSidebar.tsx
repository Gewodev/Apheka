import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Paperclip, Mic, Square, Link2, FileText, Loader2, Brain,
  RotateCcw, GripVertical, ChevronDown, ChevronRight, Check,
  Copy, SquareX, Search, MessageSquareText, Undo2,
  Globe, CheckCircle2, XCircle, ExternalLink, Sparkles, Music,
  CheckSquare, Clock, Calendar, BookOpen
} from 'lucide-react';
import {
  BRAIN_DROP_MIME, readBrainAnchor, subscribeBrainDrag,
  type BrainAnchor, type BrainAnchorKind,
} from '../../lib/brainDrop';
import { useApp } from '../../store/AppContext';
import { streamChat, type AIMessage, type AIContentPart, type AIToolCall } from '../../lib/ai/aiProvider';
import { getProvider, DEFAULT_PROVIDER_ID, providerModelHasVision } from '../../lib/ai/aiProviders';
import { buildContextSnapshot } from '../../lib/ai/aiContext';
import { composeSystemPrompt } from '../../lib/ai/aiPrompts';
import { AI_TOOL_DEFINITIONS, executeToolCall, type AppContextActions } from '../../lib/ai/aiTools';
import MarkdownRenderer from './MarkdownRenderer';

/**
 * Algoritmo avanzado de refinamiento y estructuración para transcripciones de voz.
 * Detecta preguntas, entonaciones, restaura puntuación, mayúsculas iniciales
 * y limpia repeticiones para una gramática coherente.
 */
function formatSpeechTranscription(raw: string): string {
  let text = raw.trim();
  if (!text) return '';

  text = text.replace(/\s+/g, ' ');

  text = text.replace(/\s+([.,;:!?])/g, '$1');

  const words = text.split(' ');
  const deduped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (i > 0 && w === words[i - 1].toLowerCase() && /^[a-záéíóúñü]+$/i.test(w)) continue;
    deduped.push(words[i]);
  }
  text = deduped.join(' ');

  const spanishQuestionStarters = /^(cómo|como|qué|que|cuándo|cuando|dónde|donde|por qué|porque|quién|quien|cuál|cual|cuánto|cuanto|puedes|podrías|podrias|me puedes|sabes|crees|habrá|habria|acaso|sería|seria|me ayudarías|me ayudarias|tienes|quieres|dime|hay)\b/i;
  const englishQuestionStarters = /^(what|how|why|when|where|who|which|can you|could you|is there|do you|would you|are you|will you)\b/i;

  const sentences = text.split(/(?<=[.?!])\s+/);
  const formatted = sentences.map(sentence => {
    let s = sentence.trim();
    if (!s) return '';

    s = s.charAt(0).toUpperCase() + s.slice(1);
    s = s.replace(/\bi\b/g, 'I');

    if (spanishQuestionStarters.test(s)) {
      s = s.replace(/\.+$/, '');
      if (!s.endsWith('?')) s = `${s}?`;
      if (!s.startsWith('¿')) s = `¿${s}`;
    } else if (englishQuestionStarters.test(s)) {
      s = s.replace(/\.+$/, '');
      if (!s.endsWith('?')) s = `${s}?`;
    } else if (!/[.?!]$/.test(s)) {
      const wc = s.split(' ').length;
      if (wc > 2 && !/^(sí|no|si|ok|vale|listo|perfecto|gracias)\b/i.test(s)) {
        s = `${s}.`;
      }
    }

    s = s.replace(/\?+/g, '?');
    return s;
  });

  return formatted.filter(Boolean).join(' ');
}

/**
 * Tarjeta interactiva y detallada de ejecución de herramientas estilo Claude/Perplexity.
 */
// Skills externas visibles como pills en el chat (estilo Perplexity).
// Las tools internas (notas, música, cursos, agenda…) se ocultan: no son "skills" del agente.
const VISIBLE_SKILLS = new Set(['webSearch', 'searchYouTubeMusic']);

function ToolExecutionCard({ tc, index }: { tc: { name: string; args: string; result?: string; status: 'pending' | 'success' | 'error' }; index: number }) {
  const [expanded, setExpanded] = useState(true);

  const isSkill = VISIBLE_SKILLS.has(tc.name);

  let parsedArgs: Record<string, any> = {};
  try { parsedArgs = JSON.parse(tc.args || '{}'); } catch {}

  let parsedResult: any = null;
  let resultData: any = null;
  let resultMsg = tc.result || '';
  if (tc.result) {
    try {
      parsedResult = JSON.parse(tc.result);
      if (parsedResult && typeof parsedResult === 'object') {
        resultData = parsedResult.data || null;
        resultMsg = parsedResult.message || tc.result;
      }
    } catch {}
  }

  const isWebSearch = tc.name === 'webSearch';
  const isMusic = tc.name.toLowerCase().includes('music') || tc.name.toLowerCase().includes('track') || tc.name.toLowerCase().includes('playlist');
  const isTask = tc.name.toLowerCase().includes('task');
  const isTimer = tc.name.toLowerCase().includes('timer');
  const isEvent = tc.name.toLowerCase().includes('event') || tc.name.toLowerCase().includes('agenda');
  const isNote = tc.name.toLowerCase().includes('note');

  let title = `${index + 1}) ${tc.name}`;
  let subtitle = 'Se ejecutó en la app';
  if (isWebSearch) {
    title = `${index + 1}) web_search — motor de búsqueda (snippets en vivo)`;
    subtitle = 'Se buscó en la web';
  } else if (isTask) {
    title = `${index + 1}) ${tc.name} — gestión de tareas`;
    subtitle = 'Acción en Tareas de Owa';
  } else if (isMusic) {
    title = `${index + 1}) ${tc.name} — reproductor musical`;
    subtitle = 'Control de audio de Owa';
  } else if (isTimer) {
    title = `${index + 1}) ${tc.name} — temporizador de estudio`;
    subtitle = 'Control de enfoque';
  } else if (isEvent) {
    title = `${index + 1}) ${tc.name} — agenda y planificador`;
    subtitle = 'Planificador de Owa';
  } else if (isNote) {
    title = `${index + 1}) ${tc.name} — notas y apuntes`;
    subtitle = 'Base de conocimientos';
  }

  const searchResults: Array<{ title: string; url: string; snippet?: string; source?: string }> =
    resultData?.results || [];
  const digests: Array<{ title: string; url: string; excerpt?: string; host?: string }> =
    resultData?.digests || [];

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span>{title}</span>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>
        {subtitle}
      </div>

      <div
        style={{
          background: isSkill
            ? 'color-mix(in srgb, var(--accent) 5%, rgba(255,255,255,0.03))'
            : 'rgba(255, 255, 255, 0.03)',
          border: isSkill
            ? '1px solid color-mix(in srgb, var(--accent) 45%, transparent)'
            : '1px solid var(--border-soft)',
          borderRadius: 12,
          padding: '10px 12px',
          boxShadow: isSkill
            ? '0 4px 16px rgba(0,0,0,0.18), 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent)'
            : '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        <div
          onClick={() => setExpanded(e => !e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            {isWebSearch ? (
              <Globe size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            ) : isTask ? (
              <CheckSquare size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
            ) : isMusic ? (
              <Music size={14} style={{ color: '#ec4899', flexShrink: 0 }} />
            ) : isTimer ? (
              <Clock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            ) : isEvent ? (
              <Calendar size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />
            ) : isNote ? (
              <BookOpen size={14} style={{ color: '#10b981', flexShrink: 0 }} />
            ) : (
              <Sparkles size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            )}
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {parsedArgs.query || parsedArgs.title || parsedArgs.trackName || parsedArgs.name || tc.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isWebSearch && digests.length > 0 && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  color: 'var(--accent)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {digests.length} artículos leídos
              </span>
            )}
            {isWebSearch && searchResults.length > 0 && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-tertiary)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {searchResults.length} resultados
              </span>
            )}
            <ChevronDown
              size={13}
              style={{
                color: 'var(--text-tertiary)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 180ms ease',
              }}
            />
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 9 }}>
            {isWebSearch && searchResults.length > 0 ? (
              <div
                className="no-scrollbar"
                style={{
                  maxHeight: 190,
                  overflowY: 'auto',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  padding: '4px 0',
                }}
              >
                {searchResults.map((r, i) => {
                  let hostname = '';
                  try { hostname = new URL(r.url).hostname.replace(/^www\./, ''); } catch { hostname = r.url; }
                  return (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '6px 10px',
                        textDecoration: 'none',
                        color: 'var(--text-primary)',
                        fontSize: 11,
                        borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                        <Globe size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 400 }}>
                          {r.title}
                        </span>
                      </div>
                      <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                        {hostname}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '7px 10px', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 110, overflowY: 'auto' }}>
                {resultMsg || 'Ejecutando acción…'}
              </div>
            )}

            {digests.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FileText size={10} />
                  Contenido extraído de los artículos
                </div>
                <div className="no-scrollbar" style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {digests.slice(0, 5).map((d, i) => (
                    <a
                      key={i}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: 'none',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        padding: '7px 9px',
                        display: 'block',
                        transition: 'border-color 120ms, background 120ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 55%, transparent)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <FileText size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                        {d.host && (
                          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                            {d.host}
                          </span>
                        )}
                      </div>
                      {d.excerpt && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {d.excerpt}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
          {tc.status === 'pending' ? (
            <>
              <Loader2 size={12} className="spin" style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Ejecutando…</span>
            </>
          ) : tc.status === 'success' ? (
            <>
              <CheckCircle2 size={12} style={{ color: '#34d399' }} />
              <span style={{ color: '#34d399', fontWeight: 600 }}>Listo</span>
            </>
          ) : (
            <>
              <XCircle size={12} style={{ color: '#f87171' }} />
              <span style={{ color: '#f87171', fontWeight: 600 }}>Error</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pill de skill externa (estilo Perplexity/Claude): icono de marca + nombre + estado.
 * Solo se muestran las skills visibles (webSearch, searchYouTubeMusic); las tools
 * internas quedan ocultas de la fila de pills (pero siguen en sus ToolExecutionCard).
 */
function SkillPill({ tc }: { tc: { name: string; args: string; result?: string; status: 'pending' | 'success' | 'error' } }) {
  const isWeb = tc.name === 'webSearch';
  const Icon = isWeb ? Globe : Music;
  const label = isWeb ? 'Búsqueda web' : 'Buscar en YouTube';
  const iconColor = isWeb ? 'var(--accent)' : '#ef4444';

  const stateColor =
    tc.status === 'error' ? '#ef4444' :
    tc.status === 'success' ? '#34d399' :
    'var(--text-tertiary)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 8px',
        borderRadius: 999,
        background:
          tc.status === 'error' ? 'rgba(239,68,68,0.10)' :
          tc.status === 'success' ? 'rgba(16,185,129,0.08)' :
          'rgba(255,255,255,0.045)',
        border: `1px solid ${
          tc.status === 'error' ? 'rgba(239,68,68,0.35)' :
          tc.status === 'success' ? 'rgba(16,185,129,0.30)' :
          'var(--border-soft)'
        }`,
        fontSize: 10.5,
        fontWeight: 500,
        color: 'var(--text-primary)',
        transition: 'border-color 140ms, background 140ms, transform 140ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor =
          tc.status === 'error' ? 'rgba(239,68,68,0.35)' :
          tc.status === 'success' ? 'rgba(16,185,129,0.30)' : 'var(--border-soft)';
        e.currentTarget.style.transform = 'translateY(0px)';
      }}
    >
      <Icon size={11} style={{ color: iconColor, flexShrink: 0 }} />
      <span>{label}</span>
      {tc.status === 'pending' ? (
        <Loader2 size={10} className="spin" style={{ color: stateColor, flexShrink: 0 }} />
      ) : tc.status === 'success' ? (
        <Check size={10} style={{ color: stateColor, flexShrink: 0 }} />
      ) : (
        <X size={10} style={{ color: stateColor, flexShrink: 0 }} />
      )}
    </div>
  );
}

interface AIBrainSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  anchor?: BrainAnchor | null;
}

interface Attachment {
  id: string;
  kind: 'image' | 'file' | 'link' | 'audio' | 'transcript' | 'anchor';
  name: string;
  mime?: string;
  url?: string;
  size?: number;
  text?: string;
  anchorType?: BrainAnchorKind;
}

interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: Attachment[];
  toolCalls?: { name: string; args: string; result?: string; status: 'pending' | 'success' | 'error' }[];
  reasoning?: string;
  timestamp: string;
  isStreaming?: boolean;
}

const STORAGE_KEY_MESSAGES = 'owa_brain_messages_v1';
const STORAGE_KEY_ARCHIVE = 'owa_brain_messages_archive_v1';

function buildUserContent(text: string, attachments: Attachment[]): string | AIContentPart[] {
  if (!attachments.length) return text;

  const parts: AIContentPart[] = [{ type: 'text', text }];
  const notes: string[] = [];

  for (const a of attachments) {
    if (a.kind === 'image' && a.url) {
      parts.push({ type: 'image_url', image_url: { url: a.url } });
    } else if (a.kind === 'link') {
      notes.push(`Enlace: ${a.name}`);
    } else if (a.kind === 'audio') {
      notes.push(`Grabación de audio${a.text ? ` con transcripción: "${a.text}"` : ' (sin transcripción)'}`);
    } else if (a.kind === 'transcript') {
      notes.push(`Audio transcripción: "${a.text || ''}"`);
    } else if (a.kind === 'anchor') {
      notes.push(`Elemento anclado (${a.anchorType || 'item'}): ${a.name}. Tómalo como contexto al responder.`);
    } else if (a.kind === 'file') {
      notes.push(`Archivo adjunto: ${a.name}${a.text ? `\nContenido:\n${a.text.slice(0, 8000)}` : ''}`);
    }
  }
  if (notes.length) parts.push({ type: 'text', text: notes.join('\n') });
  return parts;
}

function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/g);
  return matches ? [...new Set(matches)] : [];
}

function fmtBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(52, 211, 153, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function AIBrainSidebar({ isOpen, onClose, onOpen, anchor }: AIBrainSidebarProps) {
  const appCtx = useApp();
  const { settings, updateSettings } = appCtx;
  const brainColor = settings.owaBrainColor || '#34d399';

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [deepMode, setDeepMode] = useState(false);
  const [dragHint, setDragHint] = useState<string | null>(null);
  const [openThinking, setOpenThinking] = useState<string>('');
  const [isResizing, setIsResizing] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('owa_brain_width'));
      if (saved >= 380 && saved <= Math.min(900, window.innerWidth * 0.5)) return saved;
    } catch {}
    return 420;
  });
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('owa_brain_height'));
      if (saved >= 320 && saved <= window.innerHeight) return saved;
    } catch {}
    return window.innerHeight;
  });

  const messagesWrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveAnimRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // AbortController para el botón "Detener" durante el streaming.
  const abortRef = useRef<AbortController | null>(null);
  // Scroll libre: si el usuario sube para leer mientras Charvis escribe, no
  // forzamos el scroll abajo otra vez (solo cuando está pegado al final).
  const stickToBottomRef = useRef(true);

  // Auto-resize inteligente del textarea al escribir o transcribir audio (hasta 300px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const scrollH = el.scrollHeight;
    const newHeight = Math.min(Math.max(scrollH, 28), 300);
    el.style.height = `${newHeight}px`;
  }, [input]);

  const [messages, setMessages] = useState<ChatItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatItem[];
        return parsed.map((m: ChatItem) => ({ ...m, attachments: undefined }));
      }
    } catch {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `**Charvis** en línea. Asistente especializado de OWA Studio.\n\nPuedo gestionar tus tareas, apuntes, cursos, calendario, sesiones de estudio y música, y ejecutar acciones directamente en la app.\n\nEscribe lo que necesites.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  // Guardar historial (sin attachments para no saturar localStorage)
  useEffect(() => {
    try {
      const clean = messages.map(({ attachments: _a, ...m }) => m).slice(-30);
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(clean));
    } catch {}
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    // Scroll del CONTENEDOR del chat únicamente. Antes se usaba scrollIntoView,
    // que también hacía scroll de la página entera → con el modo arcoíris la
    // app "subía" y el chat quedaba cortado con hueco oscuro abajo.
    if (!stickToBottomRef.current) return;
    const el = messagesWrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Scroll libre: al hacer scroll manual, si el usuario sube dejamos de
  // perseguirlo; si vuelve al final, reenganchamos el auto-scroll.
  const handleMessagesScroll = useCallback(() => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    stickToBottomRef.current = nearBottom;
  }, []);

  const toggleExpanded = useCallback(() => {
    // Click en el título CHARVIS: alterna entre compacto (420px) y una ventana
    // flotante más ancha (~58% de la pantalla, máximo 760px).
    setPanelWidth(prev => {
      const wide = Math.min(Math.round(window.innerWidth * 0.58), 760);
      const next = prev <= 480 ? wide : 420;
      try {
        localStorage.setItem('owa_brain_width', String(next));
        localStorage.setItem('owa_brain_expanded', next > 480 ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  // ─── Modo "amigo flotante": al hacer clic en el nombre CHARVIS el panel se
  // desacopla y se convierte en una ventana arrastrable por toda la app. ───
  const FLOAT_W = 400;
  const FLOAT_H = 600;
  const FLOAT_KEY = 'owa_brain_float_mode';
  const FLOAT_POS_KEY = 'owa_brain_float_pos';
  const [floatMode, setFloatMode] = useState(() => localStorage.getItem(FLOAT_KEY) === '1');
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(FLOAT_POS_KEY);
      if (saved) {
        const p = JSON.parse(saved) as { x: number; y: number };
        if (typeof p.x === 'number' && typeof p.y === 'number') {
          return {
            x: Math.max(8, Math.min(window.innerWidth - FLOAT_W - 8, p.x)),
            y: Math.max(8, Math.min(window.innerHeight - 70, p.y)),
          };
        }
      }
    } catch { /* localStorage corrupto → posición por defecto */ }
    return {
      x: Math.max(16, window.innerWidth - FLOAT_W - 24),
      y: Math.max(16, Math.round(window.innerHeight / 2) - Math.round(FLOAT_H / 2)),
    };
  });
  const floatPosRef = useRef(floatPos);
  floatPosRef.current = floatPos;

  const toggleFloatMode = useCallback(() => {
    setFloatMode(prev => {
      const next = !prev;
      if (next) {
        const pos = {
          x: Math.max(16, window.innerWidth - FLOAT_W - 24),
          y: Math.max(16, Math.round(window.innerHeight / 2) - Math.round(FLOAT_H / 2)),
        };
        setFloatPos(pos);
        localStorage.setItem(FLOAT_POS_KEY, JSON.stringify(pos));
        setPanelHeight(h => Math.min(h, Math.round(window.innerHeight * 0.7)));
      } else {
        setPanelHeight(window.innerHeight);
      }
      try {
        if (next) localStorage.setItem(FLOAT_KEY, '1');
        else localStorage.removeItem(FLOAT_KEY);
      } catch { /* almacenamiento no disponible */ }
      return next;
    });
  }, []);

  const floatDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const handleFloatDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    floatDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: floatPosRef.current.x,
      originY: floatPosRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const handleFloatDragMove = useCallback((e: React.PointerEvent) => {
    const d = floatDragRef.current;
    if (!d) return;
    const x = Math.max(8, Math.min(window.innerWidth - FLOAT_W - 8, d.originX + (e.clientX - d.startX)));
    const y = Math.max(8, Math.min(window.innerHeight - 70, d.originY + (e.clientY - d.startY)));
    setFloatPos({ x, y });
  }, []);
  const handleFloatDragEnd = useCallback(() => {
    floatDragRef.current = null;
    try {
      localStorage.setItem(FLOAT_POS_KEY, JSON.stringify(floatPosRef.current));
    } catch { /* almacenamiento no disponible */ }
  }, []);

  // ─── Redimensionado: bordes laterales (izq anclado / der flotante) y abajo — máx. media pantalla ───
  const resizeDragRef = useRef<{ startX: number; startY: number; startW: number; startH: number; mode: 'w' | 'e' | 's' } | null>(null);
  const handleResizeStart = useCallback((mode: 'w' | 'e' | 's') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeDragRef.current = { startX: e.clientX, startY: e.clientY, startW: panelWidthRef.current, startH: panelHeightRef.current, mode };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    const d = resizeDragRef.current;
    if (!d) return;
    const maxW = Math.max(380, Math.round(window.innerWidth * 0.5));
    const maxH = window.innerHeight - 8;
    if (d.mode === 'w') {
      setPanelWidth(Math.max(380, Math.min(maxW, d.startW + (d.startX - e.clientX))));
    } else if (d.mode === 'e') {
      setPanelWidth(Math.max(380, Math.min(maxW, d.startW + (e.clientX - d.startX))));
    } else if (d.mode === 's') {
      setPanelHeight(Math.max(320, Math.min(maxH, d.startH + (e.clientY - d.startY))));
    }
  }, []);
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeDragRef.current = null;
    try {
      localStorage.setItem('owa_brain_width', String(panelWidthRef.current));
      localStorage.setItem('owa_brain_height', String(panelHeightRef.current));
      localStorage.setItem('owa_brain_expanded', panelWidthRef.current > 480 ? '1' : '0');
    } catch {}
  }, []);

  // Refs espejo para los handlers de resize (evita closures stale)
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const panelHeightRef = useRef(panelHeight);
  panelHeightRef.current = panelHeight;

  useEffect(() => {
    if (isOpen) {
      stickToBottomRef.current = true;
      scrollToBottom();
    }
  }, [isOpen, messages, scrollToBottom]);

  useEffect(() => () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (waveAnimRef.current) cancelAnimationFrame(waveAnimRef.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
  }, []);

  const getContextActions = (): AppContextActions => ({
    addTask: appCtx.addTask,
    updateTask: appCtx.updateTask,
    deleteTask: appCtx.deleteTask,
    toggleTaskStatus: appCtx.toggleTaskStatus,
    tasks: appCtx.tasks,
    addNote: appCtx.addNote,
    updateNote: appCtx.updateNote,
    deleteNote: appCtx.deleteNote,
    restoreNote: appCtx.restoreNote,
    permanentlyDeleteNote: appCtx.permanentlyDeleteNote,
    notes: appCtx.notes,
    addCourse: appCtx.addCourse,
    updateCourse: appCtx.updateCourse,
    deleteCourse: appCtx.deleteCourse,
    courses: appCtx.courses,
    planEvents: appCtx.planEvents,
    setPlanEvents: appCtx.setPlanEvents,
    addHabit: appCtx.addHabit,
    updateHabit: appCtx.updateHabit,
    deleteHabit: appCtx.deleteHabit,
    habits: appCtx.habits,
    playTrack: appCtx.playTrack,
    toggleMusicPlayback: appCtx.toggleMusicPlayback,
    setMusicVolume: appCtx.setMusicVolume,
    setIsPlayingMusic: appCtx.setIsPlayingMusic,
    tracks: appCtx.tracks,
    currentTrackId: appCtx.currentTrackId,
    isPlayingMusic: appCtx.isPlayingMusic,
    musicQueue: appCtx.musicQueue,
    setMusicQueue: appCtx.setMusicQueue,
    queueSource: appCtx.queueSource,
    setQueueSource: appCtx.setQueueSource,
    shuffleMode: appCtx.shuffleMode,
    setShuffleMode: appCtx.setShuffleMode,
    repeatMode: appCtx.repeatMode,
    setRepeatMode: appCtx.setRepeatMode,
    playlists: appCtx.playlists,
    addPlaylist: appCtx.addPlaylist,
    updatePlaylist: appCtx.updatePlaylist,
    deletePlaylist: appCtx.deletePlaylist,
    toggleTrackFavorite: appCtx.toggleTrackFavorite,
    addTrack: appCtx.addTrack,
    updateTrack: appCtx.updateTrack,
    deleteTrack: appCtx.deleteTrack,
    musicVolume: appCtx.musicVolume,
    searchYouTubeMusic: appCtx.searchYouTubeMusic,
    plannedSessions: appCtx.plannedSessions,
    addPlannedSession: appCtx.addPlannedSession,
    updatePlannedSession: appCtx.updatePlannedSession,
    isTimerActive: appCtx.isTimerActive,
    sessionType: appCtx.sessionType,
    sessionTime: appCtx.sessionTime,
    dailyStudyTime: appCtx.dailyStudyTime,
    pomodoroSessions: appCtx.pomodoroSessions,
    setSessionType: appCtx.setSessionType,
    toggleTimer: appCtx.toggleTimer,
    resetTimer: appCtx.resetTimer,
    setIsTimerActive: appCtx.setIsTimerActive,
    setSessionTime: appCtx.setSessionTime,
    isRest: appCtx.isRest,
    setIsRest: appCtx.setIsRest,
    setNavigateTo: appCtx.setNavigateTo,
    settings: appCtx.settings,
    updateSettings: appCtx.updateSettings,
    addNotification: appCtx.addNotification,
  });

  // ─── Anclar elementos arrastrados (cursos, materiales, apuntes, tareas, grupos) ───
  const consumedAnchorRef = useRef<string | null>(null);

  const resolveAnchorName = useCallback((a: BrainAnchor): string => {
    const labelMap: Record<BrainAnchorKind, string> = {
      course: 'Curso',
      material: 'Material',
      note: 'Apunte',
      task: 'Tarea',
      group: 'Agrupación',
    };
    const { kind, id } = a;
    let name = '';
    if (kind === 'course') {
      name = appCtx.courses.find((c: any) => c.id === id)?.name || '';
    } else if (kind === 'task') {
      name = appCtx.tasks.find((t: any) => t.id === id)?.title || '';
    } else if (kind === 'note') {
      name = appCtx.notes.find((n: any) => n.id === id)?.title || '';
    } else if (kind === 'group') {
      for (const c of appCtx.courses) {
        const g = (c.groups || []).find((gr: any) => gr.id === id);
        if (g) { name = g.name; break; }
      }
    } else if (kind === 'material') {
      for (const c of appCtx.courses) {
        for (const t of (c.studyTopics || [])) {
          const m = (t.materials || []).find((mat: any) => mat.id === id);
          if (m) { name = m.name || m.title || ''; break; }
        }
        if (name) break;
      }
    }
    const label = labelMap[kind];
    return name ? `${label}: ${name}` : `${label} anclado`;
  }, [appCtx.courses, appCtx.tasks, appCtx.notes]);

  const addAnchorAttachment = useCallback((a: BrainAnchor) => {
    const label = resolveAnchorName(a);
    setAttachments(prev => [...prev, {
      id: `anc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'anchor',
      name: label,
      anchorType: a.kind,
    }]);
    textareaRef.current?.focus();
  }, [resolveAnchorName]);

  const anchorKey = anchor ? `${anchor.kind}:${anchor.id}` : null;
  useEffect(() => {
    if (!anchor || consumedAnchorRef.current === anchorKey) return;
    consumedAnchorRef.current = anchorKey;
    addAnchorAttachment(anchor);
  }, [anchor, anchorKey, addAnchorAttachment]);

  // Zona de soltado para drags nativos (tareas del tablero, apuntes de Notas)
  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types || []);
    const hasAnchor = types.includes(BRAIN_DROP_MIME);
    const hasText = types.includes('text/plain');
    if (!hasAnchor && !hasText) return;
    e.preventDefault();
    if (hasAnchor) {
      setDragHint('Suelta para anclar en Charvis');
    }
    if (!isDragOver) setIsDragOver(true);
  }, [isDragOver]);

  // Overlay global "Suelta aquí": cualquier arrastre (cursos, materiales, grupos,
  // tareas, apuntes) que entre en la franja derecha activa el overlay del chat.
  useEffect(() => {
    return subscribeBrainDrag((over, hint) => {
      setIsDragOver(over);
      setDragHint(hint || (over ? 'Suelta para anclar en Charvis' : null));
    });
  }, []);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDragHint(null);
    }
  }, []);

  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragHint(null);
    const anchorData = readBrainAnchor(e.nativeEvent);
    if (anchorData) addAnchorAttachment(anchorData);
  }, [addAnchorAttachment]);

  const handleSendMessage = async (customPrompt?: string) => {
    const userText = (customPrompt ?? input).trim();
    if ((!userText && attachments.length === 0) || isGenerating) return;
    if (!customPrompt) setInput('');

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `asst_${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMsg: ChatItem = {
      id: userMsgId,
      role: 'user',
      content: userText,
      attachments: [...attachments],
      timestamp,
    };

    const newAsstMsg: ChatItem = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp,
      isStreaming: true,
    };

    setMessages(prev => [...prev, newUserMsg, newAsstMsg]);
    setAttachments([]);
    setIsGenerating(true);
    stickToBottomRef.current = true;

    // Controlador de cancelación para el botón "Detener".
    const controller = new AbortController();
    abortRef.current = controller;
    let wasAborted = false;

    try {
      const snapshot = buildContextSnapshot({
        currentView: 'app',
        tasks: appCtx.tasks,
        notes: appCtx.notes,
        courses: appCtx.courses,
        tracks: appCtx.tracks,
        habits: appCtx.habits,
        plannedSessions: appCtx.plannedSessions,
        events: appCtx.events,
        weeklyStudyTime: appCtx.weeklyStudyTime,
        settings,
        currentTrackId: appCtx.currentTrackId,
        isPlayingMusic: appCtx.isPlayingMusic,
        isTimerActive: appCtx.isTimerActive,
        sessionType: appCtx.sessionType,
        sessionTime: appCtx.sessionTime,
        dailyStudyTime: appCtx.dailyStudyTime,
        pomodoroSessions: appCtx.pomodoroSessions,
      });
      const providerId = settings.owaBrainProvider || DEFAULT_PROVIDER_ID;
      const provider = getProvider(providerId);
      const apiKey = (settings.owaBrainApiKey || '').trim();
      const baseUrl = (settings.owaBrainBaseUrl || provider.baseUrl).replace(/\/+$/, '');
      const model = settings.owaBrainModel || provider.defaultModel;

      // Autoconciencia del modelo: el prompt sabe exactamente quién lo impulsa
      // (proveedor + modelo) y si tiene visión, para responder con identidad real.
      const providerName = provider.name || providerId;
      const vision = providerModelHasVision(provider, model);
      const systemPrompt = composeSystemPrompt(snapshot, deepMode, {
        providerId,
        providerName,
        modelName: model,
        vision,
      });

      const history = messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10);
      const apiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.role === 'user' ? buildUserContent(m.content, m.attachments || []) : m.content,
        })),
        { role: 'user', content: buildUserContent(userText, attachments) },
      ];

      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let lastError: string | null = null;
      let runningMessages: AIMessage[] = [...apiMessages];
      const toolStatusList: NonNullable<ChatItem['toolCalls']> = [];
      const MAX_TOOL_ROUNDS = 4;

      const updateAsst = (patch: Partial<ChatItem>) =>
        setMessages(prev => prev.map(m => (m.id === assistantMsgId ? { ...m, ...patch } : m)));

      // Loop multi-paso: cada ronda puede emitir tools → se ejecutan → se reenvían
      // sus resultados al modelo para la siguiente ronda (hasta MAX_TOOL_ROUNDS).
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const stream = streamChat(
          { apiKey, model, baseUrl, temperature: 0.6, signal: controller.signal },
          runningMessages,
          AI_TOOL_DEFINITIONS,
        );
        const toolCallsThisRound: AIToolCall[] = [];
        let roundReasoning = '';
        let hadError = false;

        for await (const chunk of stream) {
          if (chunk.type === 'aborted') {
            wasAborted = true;
            break;
          }
          if (chunk.type === 'text' && chunk.text) {
            accumulatedContent += chunk.text;
            updateAsst({ content: accumulatedContent });
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolCallsThisRound.push(chunk.toolCall);
          } else if (chunk.type === 'done' && chunk.reasoning) {
            roundReasoning = chunk.reasoning;
          } else if (chunk.type === 'error' && chunk.error) {
            hadError = true;
            lastError = chunk.error;
          }
        }

        if (wasAborted) break;

        // Razonamiento del modelo → bloque colapsable en "segundo plano"
        if (roundReasoning) accumulatedReasoning = roundReasoning;
        if (round === 0 && accumulatedReasoning) {
          setOpenThinking(assistantMsgId);
        }

        // Sin tools en esta ronda → la conversación termina aquí
        if (toolCallsThisRound.length === 0) {
          if (hadError && !accumulatedContent && toolStatusList.length === 0) {
            updateAsst({ content: `⚠️ Error: ${lastError}`, isStreaming: false });
          }
          break;
        }

        // Ejecutar tools: chips en vivo debajo del mensaje (estilo ChatGPT/Claude)
        for (const tc of toolCallsThisRound) {
          const idx = toolStatusList.length;
          toolStatusList.push({ name: tc.function.name, args: tc.function.arguments, status: 'pending' });
          updateAsst({ toolCalls: [...toolStatusList] });

          const result = await executeToolCall(tc.function.name, tc.function.arguments, getContextActions());
          toolStatusList[idx] = {
            name: tc.function.name,
            args: tc.function.arguments,
            result: result.message,
            status: result.success ? 'success' : 'error',
          };
          updateAsst({ toolCalls: [...toolStatusList] });

          runningMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: [tc],
            reasoning_content: roundReasoning || undefined,
          });
          runningMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result),
          });
        }

        if (round === MAX_TOOL_ROUNDS) break;
      }

      // Finalización: si hay contenido real, el razonamiento se muestra en su
      // bloque colapsable; si solo hay razonamiento (modelo de razonamiento),
      // ese razonamiento ES el contenido (no se deja el mensaje en blanco).
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== assistantMsgId) return m;
          let finalContent = accumulatedContent || (accumulatedReasoning ? accumulatedReasoning.trim() : '');
          const patch: Partial<ChatItem> = { isStreaming: false };
          if (wasAborted) {
            // El usuario detuvo la respuesta: si ya había texto se conserva.
            patch.content = finalContent ? finalContent + '\n\n*⏹ Respuesta detenida.*' : '*⏹ Respuesta detenida.*';
            if (accumulatedContent && accumulatedReasoning) patch.reasoning = accumulatedReasoning;
            return { ...m, ...patch };
          }
          if (accumulatedContent && accumulatedReasoning) patch.reasoning = accumulatedReasoning;
          patch.content = finalContent;
          return { ...m, ...patch };
        })
      );
    } catch (err) {
      const aborted = controller.signal.aborted;
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: aborted
                  ? '*⏹ Respuesta detenida.*'
                  : `⚠️ Hubo un problema conectando con el motor de IA: ${err instanceof Error ? err.message : String(err)}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
      setShowStopConfirm(false);
      abortRef.current = null;
      scrollToBottom();
    }
  };

  const handleStopGeneration = () => {
    abortRef.current?.abort();
  };

  // ─── Copiar mensaje al portapapeles ───
  const handleCopyMessage = async (msg: ChatItem) => {
    const text = msg.content || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopiedId(msg.id);
    window.setTimeout(() => setCopiedId(c => (c === msg.id ? null : c)), 1600);
  };

  // ─── Borrado con confirmación (soft delete: archiva los datos) ───
  const handleClearHistory = () => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY_ARCHIVE);
      const batch = JSON.stringify(messages);
      localStorage.setItem(STORAGE_KEY_ARCHIVE, existing ? `${existing}\n${batch}` : batch);
    } catch {}
    const welcomeMsg: ChatItem = {
      id: 'welcome',
      role: 'assistant',
      content: `**Charvis** en línea. Historial archivado.\n\nEscribe lo que necesites.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMsg]);
    setConfirmClear(false);
  };

  // ─── Historial: últimas conversaciones con título automático ───
  const archivedSessions = useMemo(() => {
    if (!showHistory) return [] as ChatItem[][];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ARCHIVE);
      if (!raw) return [];
      return raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        try { return JSON.parse(l) as ChatItem[]; } catch { return null; }
      }).filter(Boolean) as ChatItem[][];
    } catch { return []; }
  }, [showHistory]);

  const lastSessions = archivedSessions.slice(-5).reverse();

  const restoreSession = (session: ChatItem[]) => {
    setMessages(session.length ? [...session] : [{
      id: 'welcome',
      role: 'assistant',
      content: `**Charvis** en línea. Historial restaurado.\n\nEscribe lo que necesites.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setShowHistory(false);
    setConfirmClear(false);
    scrollToBottom();
  };

  const sessionTitle = (session: ChatItem[]): string => {
    const userMsg = session.find(m => m.role === 'user' && m.content && m.content.trim());
    if (userMsg) {
      const t = userMsg.content.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
      return t.length > 42 ? t.slice(0, 42).trimEnd() + '…' : t;
    }
    const first = session[0];
    return first ? `Conversación (${first.timestamp})` : 'Conversación';
  };

  const sessionDate = (session: ChatItem[]): string => {
    const first = session[0];
    if (first?.timestamp) return first.timestamp;
    return '';
  };

  // ─── Adjuntos ───
  const addImageAttachment = useCallback((dataUrl: string, name: string, size?: number) => {
    setAttachments(prev => [...prev, { id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind: 'image', name, url: dataUrl, mime: 'image/*', size }]);
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => addImageAttachment(reader.result as string, `imagen_${Date.now()}.png`, file.size);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => addImageAttachment(reader.result as string, file.name, file.size);
        reader.readAsDataURL(file);
        continue;
      }
      const isTextLike = /text\/|json|markdown|\/pdf/.test(file.type) || /\.(txt|md|json|csv|ts|tsx|js|css|html|py|log)$/i.test(file.name);
      if (isTextLike && file.size < 256 * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result || '');
          setAttachments(prev => [...prev, { id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind: 'file', name: file.name, mime: file.type, size: file.size, text }]);
        };
        reader.readAsText(file);
      } else {
        setAttachments(prev => [...prev, { id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind: 'file', name: file.name, mime: file.type, size: file.size }]);
      }
    }
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  // ─── Grabadora de audio con transcripción ───
  const drawWaveform = useCallback(() => {
    const canvas = waveCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, W, H);
    const bars = 56;
    const barW = (W - (bars - 1) * 2) / bars;
    const center = H / 2;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * data.length);
      const v = (data[idx] - 128) / 128;
      const barH = Math.max(2, Math.abs(v) * (H - 8));
      const x = i * (barW + 2);
      const hue = (i / bars) * 360;
      const g = ctx.createLinearGradient(0, center - barH / 2, 0, center + barH / 2);
      g.addColorStop(0, `hsla(${hue}, 100%, 62%, 0.9)`);
      g.addColorStop(1, `hsla(${hue}, 100%, 42%, 0.55)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, center - barH / 2, barW, barH, barW / 2);
      ctx.fill();
    }
    waveAnimRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const stopWaveform = useCallback(() => {
    if (waveAnimRef.current) cancelAnimationFrame(waveAnimRef.current);
    waveAnimRef.current = 0;
    analyserRef.current = null;
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    sourceNodeRef.current = null;
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      isRecordingRef.current = true;
      setLiveTranscript('');

      // ─── Analizador de forma de onda en tiempo real ───
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          audioCtxRef.current = new AC();
          sourceNodeRef.current = audioCtxRef.current.createMediaStreamSource(stream);
          const analyser = audioCtxRef.current.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.82;
          analyserRef.current = analyser;
          sourceNodeRef.current.connect(analyser);
          drawWaveform();
        }
      } catch {}

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      transcriptRef.current = '';
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        stopWaveform();
        const raw = transcriptRef.current.trim();
        if (raw) {
          const formatted = formatSpeechTranscription(raw);
          // Escribir la transcripción formateada directamente en el input del chat
          setInput(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${formatted}` : formatted;
          });
          setAttachments(prev => [...prev, {
            id: `trs_${Date.now()}`,
            kind: 'transcript',
            name: 'Audio transcripción',
            text: formatted,
          }]);
        }
        setLiveTranscript('');
        setIsPreparingAudio(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      };
      mr.start();
      setIsRecording(true);
      setRecTime(0);
      recTimerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const rec = new SR();
          // Detectar idioma del navegador o sistema de forma automática y continua
          rec.lang = navigator.language || 'es-ES';
          rec.continuous = true;
          rec.interimResults = true;
          rec.maxAlternatives = 1;
          rec.onresult = (e: any) => {
            let interim = '';
            let finalText = '';
            for (let i = 0; i < e.results.length; i++) {
              const res = e.results[i];
              if (res.isFinal) finalText += res[0].transcript + ' ';
              else interim += res[0].transcript;
            }
            const current = (finalText + interim).trim();
            transcriptRef.current = current;
            setLiveTranscript(formatSpeechTranscription(current));
          };
          rec.onerror = () => {};
          rec.onend = () => {
            if (isRecordingRef.current && recognitionRef.current === rec) {
              try { rec.start(); } catch {}
            }
          };
          recognitionRef.current = rec;
          rec.start();
        } catch {}
      }
    } catch {
      setIsPreparingAudio(false);
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPreparingAudio(true);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopWaveform();
      setIsPreparingAudio(false);
    }
  };

  const recLabel = recTime < 60 ? `0:${recTime.toString().padStart(2, '0')}` : `${Math.floor(recTime / 60)}:${(recTime % 60).toString().padStart(2, '0')}`;

  const sendDisabled = (!input.trim() && attachments.length === 0) || isGenerating;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="charvis-panel"
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className={deepMode ? 'charvis-deep' : ''}
          onDragEnter={handleDropZoneDragOver}
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
          style={{
            position: 'fixed',
            top: floatMode ? floatPos.y : 0,
            left: floatMode ? floatPos.x : undefined,
            right: floatMode ? undefined : 0,
            width: `${panelWidth}px`,
            height: `${panelHeight}px`,
            maxWidth: '100vw',
            maxHeight: floatMode ? 'calc(100vh - 16px)' : '100vh',
            borderRadius: floatMode ? 16 : undefined,
            zIndex: 99990,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-primary)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            border: floatMode ? '1px solid var(--border-default)' : undefined,
            borderLeft: floatMode ? undefined : deepMode ? '1px solid var(--border-strong)' : '1px solid var(--border-default)',
            boxShadow: floatMode ? `0 24px 64px rgba(0, 0, 0, 0.45), 0 0 32px ${hexToRgba(brainColor, 0.14)}` : deepMode ? '0 0 40px rgba(167,77,255,0.22), -16px 0 48px rgba(0, 0, 0, 0.3)' : '-16px 0 48px rgba(0, 0, 0, 0.3)',
            color: 'var(--text-primary)',
            fontFamily: "'JetBrains Mono', monospace",
            transition: isResizing ? 'none' : 'width 260ms cubic-bezier(0.4, 0, 0.2, 1), height 260ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Asas de redimensionado: lateral (izq si anclado / der si flotante) y abajo — máx. media pantalla */}
          {!floatMode && (
            <div
              onPointerDown={handleResizeStart('w')}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              title="Arrastra para estirar el chat"
              style={{
                position: 'absolute',
                left: -4,
                top: 0,
                bottom: 0,
                width: 9,
                cursor: 'ew-resize',
                zIndex: 35,
                touchAction: 'none',
                background: 'transparent',
              }}
            />
          )}
          {floatMode && (
            <div
              onPointerDown={handleResizeStart('e')}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              title="Arrastra para estirar el chat"
              style={{
                position: 'absolute',
                right: -4,
                top: 0,
                bottom: 0,
                width: 9,
                cursor: 'ew-resize',
                zIndex: 35,
                touchAction: 'none',
                background: 'transparent',
              }}
            />
          )}
          <div
            onPointerDown={handleResizeStart('s')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            title="Arrastra para cambiar la altura"
            style={{
              position: 'absolute',
              bottom: -4,
              left: 0,
              right: 0,
              height: 9,
              cursor: 'ns-resize',
              zIndex: 35,
              touchAction: 'none',
              background: 'transparent',
            }}
          />

          {deepMode && <div className="charvis-deep-aura" />}

          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--bg-base) 55%, transparent)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              pointerEvents: 'none',
            }}>
              <div style={{
                padding: '14px 22px', borderRadius: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(167, 139, 250, 0.45)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 24px rgba(167,139,250,0.18)',
                fontSize: 12.5, color: '#a78bfa',
                fontFamily: "'Inter Tight', sans-serif",
                display: 'flex', alignItems: 'center', gap: 9,
                fontWeight: 600, letterSpacing: '0.02em',
              }}>
                <GripVertical size={15} style={{ color: '#a78bfa' }} />
                {dragHint || 'Suelta para anclar en Charvis'}
              </div>
            </div>
          )}

          {/* ─── Header ─── */}
          <div
            onPointerDown={floatMode ? handleFloatDragStart : undefined}
            onPointerMove={floatMode ? handleFloatDragMove : undefined}
            onPointerUp={floatMode ? handleFloatDragEnd : undefined}
            onPointerCancel={floatMode ? handleFloatDragEnd : undefined}
            style={{
              padding: '20px 22px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: floatMode ? 'move' : undefined,
              userSelect: floatMode ? 'none' : undefined,
              touchAction: floatMode ? 'none' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={toggleFloatMode}
                title={floatMode ? 'Anclar a la derecha' : 'Hacer Charvis amigo flotante (arrastrable)'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span
                  className={deepMode ? 'charvis-deep-title' : ''}
                  style={{
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 34,
                    fontWeight: 200,
                    letterSpacing: '0.08em',
                    lineHeight: 1,
                    color: 'var(--text-primary)',
                    textShadow: `0 0 22px ${brainColor}66`,
                    transition: 'opacity 150ms',
                  }}
                >
                  CHARVIS
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 5,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8.5,
                    letterSpacing: '0.06em',
                    color: 'var(--text-tertiary)',
                    textTransform: 'none',
                  }}
                >
                  {settings.owaBrainModel || getProvider(settings.owaBrainProvider || DEFAULT_PROVIDER_ID).defaultModel}
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => setShowHistory(true)} title="Ver historial de conversaciones"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-secondary)',
                  padding: '8px 11px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 150ms, background 150ms, border-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = brainColor; e.currentTarget.style.background = hexToRgba(brainColor, 0.1); e.currentTarget.style.borderColor = hexToRgba(brainColor, 0.35); }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
              >
                <MessageSquareText size={14} />
              </button>
              <button onClick={() => setConfirmClear(true)} title="Iniciar conversación nueva"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-secondary)',
                  padding: '8px 11px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 150ms, background 150ms, border-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)'; e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
              >
                <RotateCcw size={13} />
              </button>
              <button onClick={onClose} title="Ocultar Charvis"
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-primary)',
                  padding: 7,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ─── Messages ─── */}
          <div
            ref={messagesWrapRef}
            onScroll={handleMessagesScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            className="no-scrollbar"
          >
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.role !== 'user' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 5,
                      padding: '0 4px',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: brainColor,
                      textShadow: `0 0 8px ${hexToRgba(brainColor, 0.5)}`,
                      width: '100%',
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: brainColor, boxShadow: `0 0 6px ${hexToRgba(brainColor, 0.8)}` }} />
                    CHARVIS
                    <span style={{ flex: 1 }} />
                    {msg.content && (
                      <button
                        onClick={() => handleCopyMessage(msg)}
                        title={copiedId === msg.id ? 'Copiado' : 'Copiar mensaje'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 3,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: copiedId === msg.id ? brainColor : 'var(--text-muted)',
                          transition: 'color 150ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = copiedId === msg.id ? brainColor : 'var(--text-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = copiedId === msg.id ? brainColor : 'var(--text-muted)')}
                      >
                        {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                )}

                <div
                  className={deepMode ? 'charvis-deep-item' : ''}
                  style={{
                    maxWidth: '92%',
                    padding: '11px 14px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user' ? hexToRgba(brainColor, 0.08) : 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)',
                    border: msg.role === 'user' ? `1px solid ${hexToRgba(brainColor, 0.22)}` : '1px solid var(--border-soft)',
                    boxShadow:
                      msg.role === 'user'
                        ? `0 0 0 1px ${hexToRgba(brainColor, 0.06)}, 0 0 18px ${hexToRgba(brainColor, 0.07)}`
                        : 'none',
                    fontSize: 13,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.role === 'user' ? (
                    <>
                      {msg.content}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {msg.attachments.map(a => (
                            a.kind === 'transcript' || (a.kind === 'audio' && a.text) ? (
                              <div key={a.id} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(52, 211, 153, 0.06)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#34d399', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                                  <Mic size={10} /> Audio transcripción
                                </div>
                                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflowY: 'auto' }} className="no-scrollbar">
                                  “{a.text}”
                                </div>
                              </div>
                            ) : a.kind === 'audio' ? (
                              <span key={a.id} style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Mic size={11} style={{ color: '#34d399' }} /> Audio (sin transcripción)
                              </span>
                            ) : a.kind === 'anchor' ? (
                              <span key={a.id} style={{ fontSize: 10.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 7, background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.22)' }}>
                                <GripVertical size={11} style={{ color: '#a78bfa' }} /> {a.name}
                              </span>
                            ) : (
                              <span key={a.id} style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Paperclip size={11} /> {a.name}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {msg.reasoning && msg.reasoning.trim().length > 0 && (
                        <div
                          style={{
                            marginBottom: 10,
                            paddingBottom: 10,
                            borderBottom: '1px dashed var(--border-subtle)',
                          }}
                        >
                          <button
                            onClick={() => setOpenThinking(o => (o === msg.id ? '' : msg.id))}
                            title="Mostrar / ocultar el razonamiento de Charvis"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              fontFamily: "'Inter Tight', sans-serif",
                              fontSize: 10.5,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontWeight: 600,
                              transition: 'color 150ms',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                          >
                            {openThinking === msg.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            Pensamiento
                          </button>
                          {openThinking === msg.id && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 11.5,
                                lineHeight: 1.6,
                                color: 'var(--text-muted)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 180,
                                overflowY: 'auto',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontStyle: 'italic',
                              }}
                              className="no-scrollbar"
                            >
                              {msg.reasoning}
                            </div>
                          )}
                        </div>
                      )}
                      <MarkdownRenderer content={msg.content} />
                      {msg.isStreaming && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-tertiary)', fontSize: 11.5 }}>
                          <Loader2 size={13} className="spin" /> procesando…
                        </div>
                      )}
                    </>
                  )}
                </div>

                {msg.role !== 'user' && msg.toolCalls && msg.toolCalls.length > 0 && (() => {
                  const skillCalls = msg.toolCalls.filter(tc => VISIBLE_SKILLS.has(tc.name));
                  return (
                    <>
                      {skillCalls.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {skillCalls.map((tc, i) => (
                            <SkillPill key={i} tc={tc} />
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: skillCalls.length > 0 ? 6 : 10 }}>
                        {msg.toolCalls.map((tc, idx) => (
                          <ToolExecutionCard key={idx} tc={tc} index={idx} />
                        ))}
                      </div>
                    </>
                  );
                })()}

                {msg.role === 'user' && (
                  <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 4, padding: '0 4px', letterSpacing: '0.08em' }}>
                    {msg.timestamp}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ─── Composer ─── */}
          <div
            style={{
              padding: '10px 14px 14px',
              background: 'var(--bg-deep)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {attachments.map(a => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 6px 3px 4px',
                      borderRadius: 8,
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-soft)',
                      fontSize: 10.5,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {a.kind === 'image' && a.url ? (
                      <img src={a.url} alt="" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover' }} />
                    ) : a.kind === 'link' ? (
                      <Link2 size={12} style={{ color: '#7dd3fc' }} />
                    ) : a.kind === 'audio' ? (
                      <Mic size={12} style={{ color: '#34d399' }} />
                    ) : a.kind === 'transcript' ? (
                      <Mic size={12} style={{ color: '#34d399' }} />
                    ) : a.kind === 'anchor' ? (
                      <GripVertical size={12} style={{ color: '#a78bfa' }} />
                    ) : (
                      <FileText size={12} style={{ color: '#c4b5fd' }} />
                    )}
                    <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name}
                    </span>
                    {a.kind === 'transcript' && a.text && (
                      <span style={{ color: '#34d399', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{a.text}”</span>
                    )}
                    {a.kind === 'audio' && a.text && <span style={{ color: '#34d399' }}>transcrito</span>}
                    {a.size ? <span style={{ color: 'var(--text-muted)' }}>{fmtBytes(a.size)}</span> : null}
                    <button onClick={() => removeAttachment(a.id)} title="Quitar"
                      style={{ width: 15, height: 15, borderRadius: 4, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
              className={deepMode ? 'charvis-deep-item' : ''}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'color-mix(in srgb, var(--bg-elevated) 65%, transparent)',
                border: isRecording ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-soft)',
                borderRadius: 12,
                padding: '8px 8px 6px 8px',
                transition: 'border-color 200ms',
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // El input queda escribible mientras Charvis responde, pero
                    // no se envía hasta que termina (o se detiene).
                    if (isGenerating) return;
                    handleSendMessage();
                  }
                }}
                onPaste={handlePaste}
                placeholder="Escribe algo o dicta con el micrófono…"
                rows={1}
                className="no-scrollbar"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '4px 4px 2px 4px',
                  minHeight: 28,
                  maxHeight: 300,
                  overflowY: 'auto',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 5,
                  paddingTop: 6,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setDeepMode(d => !d)}
                  title={deepMode ? 'Desactivar modo profundo' : 'Modo profundo (análisis con fuentes)'}
                  className={deepMode ? 'charvis-deep-item charvis-deep-btn-active' : ''}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: 'transparent',
                    border: deepMode ? '1px solid var(--border-default)' : 'none',
                    color: deepMode ? 'var(--text-primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                    position: 'relative',
                  }}
                >
                  <Brain size={14} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording) stopRecording();
                    else { setIsPreparingAudio(true); startRecording(); }
                  }}
                  title={isRecording ? 'Detener grabación' : 'Grabar audio y transcribir'}
                  className={deepMode ? 'charvis-deep-item' : ''}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: 'transparent',
                    border: 'none',
                    color: isRecording ? '#f87171' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = isRecording ? '#f87171' : 'var(--text-muted)')}
                >
                  {isRecording ? <Square size={13} fill="#f87171" /> : <Mic size={14} />}
                </button>
                <button
                  type="button"
                  onClick={handleAttachClick}
                  title="Adjuntar archivo o imagen"
                  className={deepMode ? 'charvis-deep-item' : ''}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#7dd3fc')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Paperclip size={14} />
                </button>

                <div style={{ flex: 1 }} />

                <button
                  type={isGenerating ? 'button' : 'submit'}
                  disabled={!isGenerating && sendDisabled}
                  onClick={isGenerating ? () => setShowStopConfirm(true) : undefined}
                  title={isGenerating ? 'Detener la respuesta' : 'Enviar'}
                  className={deepMode && !sendDisabled && !isGenerating ? 'charvis-deep-item' : ''}
                  style={{
                    height: 30,
                    padding: '0 16px',
                    borderRadius: 8,
                    flexShrink: 0,
                    background: isGenerating
                      ? 'rgba(239, 68, 68, 0.12)'
                      : sendDisabled
                        ? 'rgba(255, 255, 255, 0.06)'
                        : hexToRgba(brainColor, 0.16),
                    border: isGenerating
                      ? '1px solid rgba(239, 68, 68, 0.45)'
                      : sendDisabled
                        ? '1px solid var(--border-soft)'
                        : `1px solid ${hexToRgba(brainColor, 0.35)}`,
                    color: isGenerating ? '#f87171' : sendDisabled ? 'var(--text-muted)' : brainColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isGenerating || sendDisabled ? 'pointer' : 'pointer',
                    boxShadow: isGenerating
                      ? '0 0 16px rgba(239, 68, 68, 0.25)'
                      : sendDisabled
                        ? 'none'
                        : `0 0 14px ${hexToRgba(brainColor, 0.2)}`,
                    transition: 'all 150ms',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10.5,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    gap: 6,
                  }}
                >
                  {isGenerating ? <SquareX size={12} /> : <Send size={12} />}
                  {isGenerating ? 'detener' : 'enviar'}
                </button>
              </div>
            </form>
            {isPreparingAudio && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                <Loader2 size={11} className="spin" /> procesando audio…
              </div>
            )}
            {isRecording && (
              <div
                className="charvis-recorder"
                style={{
                  marginTop: 8,
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.22)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 8px rgba(248,113,113,0.8)', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, color: '#f87171', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
                    {recLabel}
                  </span>
                  <span style={{ flex: 1, fontSize: 9.5, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    transcribiendo en vivo
                  </span>
                  <button
                    type="button"
                    onClick={stopRecording}
                    title="Detener y transcribir"
                    style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.45)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Square size={11} fill="#f87171" />
                  </button>
                </div>
                <canvas ref={waveCanvasRef} width={380} height={54} className="charvis-waveform" style={{ width: '100%', height: 54, display: 'block', marginTop: 8 }} />
                {liveTranscript && (
                  <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)', fontStyle: 'italic', maxHeight: 48, overflowY: 'auto', wordBreak: 'break-word' }}>
                    “{liveTranscript}”
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json,.ts,.tsx,.js,.css,.html,.py,.log" onChange={handleFileSelected} style={{ display: 'none' }} />
          </div>

          {/* ─── Modal de confirmación de borrado (centrado) ─── */}
          <AnimatePresence>
            {confirmClear && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmClear(false)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  background: 'color-mix(in srgb, var(--bg-base) 55%, transparent)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                }}
              >
                <motion.div
                  initial={{ scale: 0.92, y: 8, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 300,
                    borderRadius: 14,
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(251, 191, 36, 0.28)',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 24px rgba(251, 191, 36, 0.1)',
                    padding: '22px 20px 18px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.28)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Undo2 size={15} />
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¿Reiniciar conversación?</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Se guardará en el historial (no se pierde)</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={() => setConfirmClear(false)} title="Cancelar"
                      style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', transition: 'background 150ms' }}>
                      Cancelar
                    </button>
                    <button onClick={handleClearHistory} title="Sí, reiniciar historial"
                      style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'rgba(251, 191, 36, 0.14)', border: '1px solid rgba(251, 191, 36, 0.4)', color: '#fbbf24', transition: 'background 150ms' }}>
                      Sí, reiniciar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Modal de confirmación para detener la respuesta ─── */}
          <AnimatePresence>
            {showStopConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowStopConfirm(false)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  background: 'color-mix(in srgb, var(--bg-base) 55%, transparent)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                }}
              >
                <motion.div
                  initial={{ scale: 0.92, y: 8, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 300,
                    borderRadius: 14,
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(239, 68, 68, 0.32)',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 24px rgba(239, 68, 68, 0.12)',
                    padding: '22px 20px 18px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SquareX size={15} />
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>¿Detener la respuesta?</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Se conserva lo que Charvis ya escribió</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={() => setShowStopConfirm(false)} title="Seguir esperando"
                      style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-hover)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', transition: 'background 150ms' }}>
                      Seguir
                    </button>
                    <button onClick={handleStopGeneration} title="Detener ahora"
                      style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', transition: 'background 150ms' }}>
                      Detener
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Historial de conversaciones (últimas 5 con título automático) ─── */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  background: 'color-mix(in srgb, var(--bg-base) 55%, transparent)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                }}
              >
                <motion.div
                  initial={{ scale: 0.92, y: 8, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    maxHeight: '70%',
                    borderRadius: 14,
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(167, 139, 250, 0.28)',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 24px rgba(167, 139, 250, 0.1)',
                    padding: '20px 16px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
                      <MessageSquareText size={15} style={{ color: '#a78bfa' }} /> Historial
                    </div>
                    <button onClick={() => setShowHistory(false)} title="Cerrar"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      <X size={15} />
                    </button>
                  </div>

                  {lastSessions.length === 0 ? (
                    <div style={{ padding: '26px 10px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Aún no hay conversaciones archivadas.
                      <br />Usa “Reiniciar” para guardar la actual en el historial.
                    </div>
                  ) : (
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }} className="no-scrollbar">
                      {lastSessions.map((session, i) => {
                        const count = session.filter(m => m.role === 'user').length;
                        return (
                          <button
                            key={i}
                            onClick={() => restoreSession(session)}
                            title="Restaurar conversación"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                              background: 'rgba(167, 139, 250, 0.05)',
                              border: '1px solid rgba(167, 139, 250, 0.15)',
                              cursor: 'pointer', color: 'var(--text-primary)',
                              transition: 'all 150ms',
                              width: '100%',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.12)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.35)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.05)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.15)'; }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px rgba(167,139,250,0.8)', flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {sessionTitle(session)}
                              </span>
                              <span style={{ display: 'block', fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.05em' }}>
                                {sessionDate(session)} · {count} {count === 1 ? 'mensaje' : 'mensajes'}
                              </span>
                            </span>
                            <Undo2 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
      </AnimatePresence>
    </>,
    document.body
  );
}
