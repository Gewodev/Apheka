// ═══════════════════════════════════════════════════
//  CHARVIS — Catálogo de proveedores de IA
// ═══════════════════════════════════════════════════
// Cada proveedor es un endpoint OpenAI-compatible (`POST /chat/completions` y
// `GET /models`) o nativo de Anthropic (`POST /messages` y `GET /models`).
// La app solo guarda la clave en localStorage (nunca se sube a ningún servidor).

import { getFetch } from './aiProvider';

export interface CharvisProvider {
  id: string;
  name: string;
  /** Color de marca (tile del logo, ring de selección). */
  brandColor: string;
  /** Modelo por defecto sugerido. */
  defaultModel: string;
  /** Modelos exactos conocidos (fallback si el endpoint /models no responde). */
  defaultModels: string[];
  /** Modelos del catálogo con visión (imágenes). Vacío = ninguno del catálogo. */
  visionModels?: string[];
  /** Visión por defecto para modelos personalizados no listados. */
  defaultVision?: boolean;
  /** URL base oficial. */
  baseUrl: string;
  /** URL de documentación oficial. */
  docsUrl: string;
  /** Texto breve que explica cómo obtener la clave. */
  keyHint: string;
}

export interface CharvisProviderState {
  apiKey: string;
  baseUrl: string;
  model: string;
  models: string[];
  validatedAt: number | null;
}

export const CHARVIS_PROVIDERS: CharvisProvider[] = [
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    brandColor: '#22c55e',
    defaultModel: 'big-pickle',
    defaultModels: [
      'big-pickle',
      'glm-5.2',
      'glm-5.1',
      'glm-5',
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'kimi-k2.6',
      'minimax-m2.7',
    ],
    baseUrl: 'https://opencode.ai/zen/v1',
    docsUrl: 'https://opencode.ai',
    keyHint: 'Clave en opencode.ai/auth. Cada cuenta tiene su propia API key privada. Requiere suscripción activa.',
    visionModels: ['glm-5.2', 'glm-5.1', 'glm-5'],
    defaultVision: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    brandColor: '#10a37f',
    defaultModel: 'gpt-4o',
    defaultModels: [
      'gpt-5.6',
      'gpt-5.6-mini',
      'gpt-5',
      'gpt-4o',
      'gpt-4o-mini',
      'o3',
      'o4-mini',
    ],
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'Crea tu clave en platform.openai.com/api-keys. Requiere créditos en tu cuenta de OpenAI.',
    visionModels: ['gpt-5.6', 'gpt-5.6-mini', 'gpt-5', 'gpt-4o', 'gpt-4o-mini'],
    defaultVision: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    brandColor: '#4285F4',
    defaultModel: 'gemini-3.7-flash',
    defaultModels: [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-pro',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'Clave en aistudio.google.com/apikey. Endpoint OpenAI-compatible oficial de Google.',
    defaultVision: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    brandColor: '#D97757',
    defaultModel: 'claude-sonnet-4-6',
    defaultModels: [
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-sonnet-4-6',
      'claude-opus-4-7',
      'claude-haiku-4-5',
      'claude-3-7-sonnet-latest',
    ],
    baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'Clave en console.anthropic.com/settings/keys. Conexión nativa con Claude API.',
    defaultVision: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    brandColor: '#4D6BFE',
    defaultModel: 'deepseek-v4-pro',
    defaultModels: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
    baseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com',
    keyHint: 'Clave en platform.deepseek.com/api_keys. La URL base oficial es https://api.deepseek.com.',
    visionModels: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    defaultVision: false,
  },
  {
    id: 'kimi',
    name: 'Moonshot Kimi',
    brandColor: '#4F46E5',
    defaultModel: 'kimi-k3',
    defaultModels: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6'],
    baseUrl: 'https://api.moonshot.ai/v1',
    docsUrl: 'https://platform.kimi.ai/docs',
    keyHint: 'Clave en platform.moonshot.ai/console/api-keys. Recarga mínima de 1 dólar.',
    defaultVision: false,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    brandColor: '#FA520F',
    defaultModel: 'mistral-large-latest',
    defaultModels: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'codestral-latest',
      'pixtral-large-latest',
    ],
    baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://console.mistral.ai/api-keys',
    keyHint: 'Clave en console.mistral.ai/api-keys. Los alias -latest apuntan a la versión estable.',
    visionModels: ['pixtral-large-latest'],
    defaultVision: false,
  },
  {
    id: 'groq',
    name: 'Groq',
    brandColor: '#F55036',
    defaultModel: 'openai/gpt-oss-120b',
    defaultModels: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'groq/compound',
      'groq/compound-mini',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'qwen/qwen3-32b',
      'moonshotai/kimi-k2-instruct-0905',
    ],
    baseUrl: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/keys',
    keyHint: 'Clave en console.groq.com/keys. Inferencia ultra veloz en LPU.',
    defaultVision: false,
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    brandColor: '#a1a1aa',
    defaultModel: 'grok-4',
    defaultModels: ['grok-4.6', 'grok-4', 'grok-4-fast', 'grok-4-mini', 'grok-3', 'grok-3-mini'],
    baseUrl: 'https://api.x.ai/v1',
    docsUrl: 'https://console.x.ai',
    keyHint: 'Clave en console.x.ai. Modelos Grok de xAI con gran contexto.',
    visionModels: ['grok-4.6', 'grok-4', 'grok-4-fast', 'grok-3'],
    defaultVision: false,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    brandColor: '#76B900',
    defaultModel: 'deepseek-ai/deepseek-v3.1',
    defaultModels: [
      'deepseek-ai/deepseek-v3.1',
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.3-nemotron-super-49b-v1',
      'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      'mistralai/mistral-large',
      'qwen/qwen2.5-72b-instruct',
    ],
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    docsUrl: 'https://build.nvidia.com',
    keyHint: 'Clave en build.nvidia.com. Modelos de NVIDIA NIM con inferencia acelerada.',
    visionModels: ['nvidia/llava-v1.6-34b', 'nvidia/neva-22b'],
    defaultVision: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    brandColor: '#8B5CF6',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    defaultModels: [
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-5.6',
      'openai/gpt-4o',
      'google/gemini-3.1-pro',
      'meta-llama/llama-4-maverick',
      'deepseek/deepseek-chat-v3-0324',
      'qwen/qwen3-235b-a22b',
    ],
    baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys',
    keyHint: 'Clave en openrouter.ai/keys. Un solo endpoint para cientos de modelos de todos los proveedores.',
    visionModels: [
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-5.6',
      'openai/gpt-4o',
      'google/gemini-3.1-pro',
      'meta-llama/llama-4-maverick',
    ],
    defaultVision: false,
  },
  {
    id: 'custom',
    name: 'Personalizado',
    brandColor: '#94a3b8',
    defaultModel: '',
    defaultModels: [],
    baseUrl: 'https://api.ejemplo.com/v1',
    docsUrl: '',
    keyHint: 'Proveedor OpenAI-compatible configurable: escribe tu propia URL base, clave y modelo.',
    defaultVision: true,
  },
];

export const DEFAULT_PROVIDER_ID = 'opencode';

export function getProvider(id: string): CharvisProvider {
  return CHARVIS_PROVIDERS.find(p => p.id === id) || CHARVIS_PROVIDERS[0];
}

/** ¿El modelo concreto tiene visión? (autoconciencia real de capacidades del modelo activo). */
export function providerModelHasVision(p: CharvisProvider, model: string): boolean {
  const list = p.visionModels || [];
  if (list.length === 0) return !!p.defaultVision;
  if (list.includes(model)) return true;
  if (!(p.defaultModels || []).includes(model)) return !!p.defaultVision;
  return false;
}

const STORAGE_KEY = 'owa_charvis_providers_v1';

export function loadProviderStates(): Record<string, CharvisProviderState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CharvisProviderState>) : {};
  } catch {
    return {};
  }
}

export function saveProviderStates(states: Record<string, CharvisProviderState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {}
}

export function emptyProviderState(p: CharvisProvider): CharvisProviderState {
  return {
    apiKey: '',
    baseUrl: p.baseUrl,
    model: p.defaultModel,
    models: p.defaultModels,
    validatedAt: null,
  };
}

/** Estado guardado del proveedor (con valores por defecto si aún no existe). */
export function providerState(states: Record<string, CharvisProviderState>, p: CharvisProvider): CharvisProviderState {
  return { ...emptyProviderState(p), ...(states[p.id] || {}) };
}

/**
 * Consulta el listado de modelos exacto del proveedor (`GET {baseUrl}/models`).
 * Maneja tanto endpoints OpenAI-compatible como la API nativa de Anthropic.
 */
export async function fetchProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const f = await getFetch();
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/models`;
  const headers: Record<string, string> = {};

  if (cleanBase.includes('anthropic.com')) {
    if (apiKey) headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await f(url, { method: 'GET', headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
    const list = arr.map((m: any) => (typeof m === 'string' ? m : m?.id)).filter(Boolean).filter((x: unknown) => typeof x === 'string') as string[];
    if (list.length === 0) throw new Error('Sin modelos');
    return list.sort((a, b) => {
      const ra = favoriteRank(a);
      const rb = favoriteRank(b);
      return ra === rb ? a.localeCompare(b) : ra - rb;
    });
  } finally {
    clearTimeout(timer);
  }
}

function favoriteRank(model: string): number {
  const m = model.toLowerCase();
  const rank =
    /(^|[-_/])(gpt-5\.6|gpt-5\b|gpt-4o)/i.test(m) ? 1 :
    /(^|[-_/])(claude|sonnet|opus|haiku)/i.test(m) ? 1 :
    /(^|[-_/])(gemini)/i.test(m) ? 1 :
    /(^|[-_/])(deepseek)/i.test(m) ? 1 :
    /(^|[-_/])(big-pickle|glm|kimi|minimax)/i.test(m) ? 1 :
    /(^|[-_/])(grok)/i.test(m) ? 2 :
    /(^|[-_/])(mistral|pixtral|codestral)/i.test(m) ? 2 :
    /(^|[-_/])(llama|qwen|moonshotai|compound)/i.test(m) ? 2 : 3;
  return rank;
}

