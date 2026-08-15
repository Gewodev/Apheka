// ═══════════════════════════════════════════════════
//  CHARVIS — Catálogo de proveedores de IA
// ═══════════════════════════════════════════════════
// Cada proveedor es un endpoint OpenAI-compatible (`POST /chat/completions` y
// `GET /models`). La app solo guarda la clave en localStorage (nunca se sube).

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
  /** URL base OpenAI-compatible. */
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
    keyHint: 'Clave gratuita en opencode.ai/auth. Crea tu clave y pégala aquí.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    brandColor: '#10a37f',
    defaultModel: 'gpt-4o',
    defaultModels: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'Crea tu clave en platform.openai.com/api-keys. Los modelos GPT requieren crédito en tu cuenta.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    brandColor: '#4285F4',
    defaultModel: 'gemini-3.6-flash',
    defaultModels: ['gemini-3.6-flash', 'gemini-3.1-pro', 'gemini-3-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'Clave gratuita en aistudio.google.com/apikey. Endpoint OpenAI-compatible de Google.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    brandColor: '#D97757',
    defaultModel: 'claude-sonnet-4-6',
    defaultModels: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest'],
    baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'Clave en console.anthropic.com/settings/keys. Capa OpenAI-compatible oficial (no expone /models).',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    brandColor: '#4D6BFE',
    defaultModel: 'deepseek-v4-pro',
    defaultModels: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    baseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com',
    keyHint: 'Clave en platform.deepseek.com. La URL base no lleva /v1 (lo añade el SDK).',
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
  },
  {
    id: 'mistral',
    name: 'Mistral',
    brandColor: '#FA520F',
    defaultModel: 'mistral-large-latest',
    defaultModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-large-latest'],
    baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://console.mistral.ai/api-keys',
    keyHint: 'Clave en console.mistral.ai/api-keys. Los alias -latest apuntan a la versión estable.',
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
    keyHint: 'Clave gratuita en console.groq.com/keys. Inferencia ultrarrápida con GPT-OSS, Groq Compound y Llama.',
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    brandColor: '#a1a1aa',
    defaultModel: 'grok-4',
    defaultModels: ['grok-4', 'grok-4-fast', 'grok-4-mini', 'grok-3', 'grok-3-mini'],
    baseUrl: 'https://api.x.ai/v1',
    docsUrl: 'https://console.x.ai',
    keyHint: 'Clave en console.x.ai. Grok-4 con 2M de contexto.',
  },
];

export const DEFAULT_PROVIDER_ID = 'opencode';

export function getProvider(id: string): CharvisProvider {
  return CHARVIS_PROVIDERS.find(p => p.id === id) || CHARVIS_PROVIDERS[0];
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
 * Lanza un error si el endpoint no existe o rechaza la clave.
 */
export async function fetchProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const f = await getFetch();
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await f(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  return arr.map((m: any) => (typeof m === 'string' ? m : m?.id)).filter(Boolean).filter((x: unknown) => typeof x === 'string') as string[];
}
