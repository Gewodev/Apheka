// ═══════════════════════════════════════════════════
//  CHARVIS — AI Provider Layer
//  Soporte universal para OpenAI-compatible y Anthropic nativo
// ═══════════════════════════════════════════════════

export interface AIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | AIContentPart[] | null;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
  /** Reasoning/thinking content — requerido al reenviar mensajes de assistant con tool_calls en modelos de razonamiento. */
  reasoning_content?: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIStreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error' | 'aborted';
  text?: string;
  toolCall?: AIToolCall;
  error?: string;
  /** Reasoning acumulado del turno (para reenviarlo en la segunda pasada con tool_calls). */
  reasoning?: string;
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  /** Señal de cancelación: al abortar, el stream se corta limpiamente. */
  signal?: AbortSignal;
}

export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/v1';
export const ZEN_HOST = 'opencode.ai';
export const DEFAULT_MODEL = 'big-pickle';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/** True si la app corre dentro de Tauri (webview con acceso a plugins nativos). */
function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

let tauriFetch: ((input: any, init?: any) => Promise<Response>) | null | undefined;

/**
 * Devuelve el fetch a usar. Dentro de Tauri usamos @tauri-apps/plugin-http (HTTP
 * nativo de Rust, sin CORS), que es el único transporte capaz de llegar a
 * endpoints externos desde el webview sin bloqueo de CORS.
 */
export async function getFetch(): Promise<typeof fetch> {
  if (isTauri()) {
    if (tauriFetch === undefined) {
      try {
        const mod = await import('@tauri-apps/plugin-http');
        tauriFetch = mod.fetch as unknown as typeof fetch;
      } catch {
        tauriFetch = null;
      }
    }
    if (tauriFetch) return tauriFetch;
  }
  return window.fetch.bind(window);
}

/** True si la URL base apunta al servicio de OpenCode Zen. */
export function isOpenCodeZenUrl(baseUrl?: string): boolean {
  if (!baseUrl) return true;
  return baseUrl.includes(ZEN_HOST);
}

/** True si la URL base apunta a la API oficial de Anthropic Claude. */
export function isAnthropicUrl(baseUrl?: string): boolean {
  if (!baseUrl) return false;
  return baseUrl.includes('anthropic.com');
}

/**
 * Normaliza la configuración: limpia la API key y la URL base.
 */
function normalizeConfig(config: AIProviderConfig): AIProviderConfig {
  const apiKey = (config.apiKey || '')
    .replace(/\s+/g, '')
    .replace(/^["']+|["']+$/g, '');
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = config.model || DEFAULT_MODEL;
  return { ...config, apiKey, baseUrl, model };
}

/**
 * Construye el payload para OpenAI-compatible `/chat/completions`.
 */
function buildOpenAIBody(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools: AIToolDefinition[] | undefined,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: messages.map(m => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      if (m.reasoning_content && isOpenCodeZenUrl(config.baseUrl)) msg.reasoning_content = m.reasoning_content;
      return msg;
    }),
    max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    stream,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  return body;
}

/**
 * Construye el payload para Anthropic Messages API (`/v1/messages`).
 */
function buildAnthropicBody(
  config: AIProviderConfig,
  messages: AIMessage[],
  stream: boolean,
): Record<string, unknown> {
  let systemPrompt = '';
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: any }> = [];

  for (const m of messages) {
    if (m.role === 'system') {
      const text = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(p => p.text || '').join('\n') : '';
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${text}` : text;
    } else if (m.role === 'user' || m.role === 'assistant') {
      let content: any = m.content;
      if (Array.isArray(m.content)) {
        content = m.content.map(part => {
          if (part.type === 'text') return { type: 'text', text: part.text || '' };
          if (part.type === 'image_url' && part.image_url?.url) {
            const url = part.image_url.url;
            if (url.startsWith('data:')) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2],
                  },
                };
              }
            }
            return { type: 'text', text: `[Imagen adjunta: ${url}]` };
          }
          return { type: 'text', text: '' };
        });
      }
      anthropicMessages.push({ role: m.role, content });
    }
  }

  const body: Record<string, unknown> = {
    model: config.model || 'claude-sonnet-4-6',
    max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    messages: anthropicMessages.length ? anthropicMessages : [{ role: 'user', content: 'Hola' }],
    stream,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  return body;
}

/**
 * Ejecuta una petición de chat (OpenAI-compatible o Anthropic nativo).
 */
async function requestChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools: AIToolDefinition[] | undefined,
  stream: boolean,
): Promise<{ response: Response; data: any }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const isAnthropic = isAnthropicUrl(baseUrl);
  const url = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://owa-studio.app',
    'X-Title': 'OWA Studio',
  };

  if (isAnthropic) {
    if (config.apiKey) headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const bodyObj = isAnthropic
    ? buildAnthropicBody(config, messages, stream)
    : buildOpenAIBody(config, messages, tools, stream);

  const fetchFn = await getFetch();
  const response = await fetchFn(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
    signal: config.signal,
  });

  let data: any = null;
  if (!stream) {
    try {
      data = await response.json();
    } catch {}
  }

  return { response, data };
}

function rawError(response: Response, data: any): string {
  const raw =
    data?.error?.message ||
    data?.error?.detail ||
    data?.message ||
    data?.error ||
    `API error ${response.status}`;
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

function isAuthFailure(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('api key is invalid') ||
    lower.includes('api key has expired') ||
    lower.includes('api key was revoked') ||
    lower.includes('missing api key') ||
    lower.includes('missing authentication') ||
    lower.includes('authentication required') ||
    lower.includes('authentication failed') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid access token') ||
    lower.includes('no auth')
  );
}

function classifyError(
  response: Response,
  data: any,
  hadKey: boolean,
): string {
  const status = response.status || 0;
  const rawMsg = rawError(response, data);
  const lower = String(rawMsg).toLowerCase();

  const creditsIssue =
    lower.includes('no payment method') ||
    lower.includes('payment method') ||
    lower.includes('creditserror') ||
    lower.includes('insufficient credits') ||
    lower.includes('not enough credits') ||
    lower.includes('billing') ||
    lower.includes('insufficient_quota');
  if (creditsIssue) {
    return `Tu cuenta no tiene créditos o saldo disponible para este modelo (${rawMsg}).`;
  }

  if (status === 401 || status === 403 || isAuthFailure(rawMsg)) {
    if (hadKey) {
      return `Tu API key fue rechazada (${status}): ${rawMsg}. Revísala en Ajustes → Proveedor de IA.`;
    }
    return `El modelo seleccionado requiere una API key configurada en Ajustes → Proveedor de IA.`;
  }

  if (status === 404) {
    return `El endpoint o modelo no fue encontrado (HTTP 404: ${rawMsg}). Revisa la URL base y el modelo en Ajustes.`;
  }

  if (status === 429) {
    return 'Límite de peticiones alcanzado (HTTP 429). Espera unos segundos y vuelve a intentarlo.';
  }

  if (status === 0) {
    return 'No se pudo conectar con el servicio de IA. Revisa tu conexión a internet o la URL del proveedor.';
  }

  return rawMsg && !rawMsg.startsWith('API error')
    ? `Error (${status}): ${rawMsg}`
    : `El servicio de IA no respondió correctamente (HTTP ${status}).`;
}

/**
 * Send a message to the AI provider and get a response stream.
 */
export async function* streamChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools?: AIToolDefinition[],
): AsyncGenerator<AIStreamChunk> {
  const cfg = normalizeConfig(config);
  const signal = cfg.signal;
  const aborted = () => !!signal?.aborted;
  const isAnthropic = isAnthropicUrl(cfg.baseUrl);

  async function tryRequest(
    c: AIProviderConfig,
    msgs: AIMessage[],
    tls: AIToolDefinition[] | undefined,
    st: boolean,
  ): Promise<{ response: Response; data: any }> {
    try {
      return await requestChat(c, msgs, tls, st);
    } catch (err) {
      return {
        response: { ok: false, status: 0 } as Response,
        data: { error: { message: `Error de red: ${err instanceof Error ? err.message : String(err)}` } },
      };
    }
  }

  let attempt = await tryRequest(cfg, messages, tools, true);

  if (aborted()) {
    yield { type: 'aborted' };
    return;
  }

  // Si streaming falló, intentar en modo no-streaming con la misma clave y modelo
  if (!attempt.response.ok) {
    attempt = await tryRequest(cfg, messages, tools, false);
    if (aborted()) {
      yield { type: 'aborted' };
      return;
    }

    // Si aún falla y el proveedor es OpenCode Zen sin clave, probar keyless big-pickle
    if (!attempt.response.ok && !cfg.apiKey && isOpenCodeZenUrl(cfg.baseUrl)) {
      const keyless = { ...cfg, apiKey: '', model: DEFAULT_MODEL };
      attempt = await tryRequest(keyless, messages, undefined, false);
      if (aborted()) {
        yield { type: 'aborted' };
        return;
      }
    }

    if (!attempt.response.ok) {
      yield { type: 'error', error: classifyError(attempt.response, attempt.data, !!cfg.apiKey) };
      return;
    }

    // Procesar respuesta no-streaming
    if (isAnthropic) {
      const textParts = attempt.data?.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || '';
      if (textParts) yield { type: 'text', text: textParts };
      yield { type: 'done' };
      return;
    } else {
      const choice = attempt.data?.choices?.[0]?.message || attempt.data?.message;
      const tcs = choice?.tool_calls;
      if (Array.isArray(tcs) && tcs.length) {
        for (const tc of tcs) {
          yield { type: 'tool_call', toolCall: tc };
        }
      }
      const content: string = choice?.content || choice?.reasoning_content || '';
      if (content) yield { type: 'text', text: content };
      yield { type: 'done', reasoning: choice?.reasoning_content || undefined };
      return;
    }
  }

  const reader = attempt.response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No se pudo leer la respuesta del servidor' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const pendingToolCalls: Record<string, { id: string; name: string; args: string }> = {};
  let accumulatedReasoning = '';

  try {
    while (true) {
      let readResult: { done: boolean; value?: Uint8Array };
      try {
        readResult = await reader.read();
      } catch (readErr) {
        if (aborted()) {
          yield { type: 'aborted' };
          return;
        }
        throw readErr;
      }
      if (aborted()) {
        yield { type: 'aborted' };
        return;
      }
      const { done, value } = readResult;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (isAnthropic) {
          // Anthropic SSE: data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "..."}}
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield { type: 'text', text: parsed.delta.text };
              } else if (parsed.type === 'message_stop') {
                yield { type: 'done' };
                return;
              }
            } catch {}
          }
          continue;
        }

        // OpenAI-compatible SSE
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          for (const tc of Object.values(pendingToolCalls)) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.args },
              },
            };
          }
          yield { type: 'done', reasoning: accumulatedReasoning || undefined };
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = parsed?.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          const text = Array.isArray(delta.content)
            ? delta.content
                .filter((p: any) => p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string')
                .map((p: any) => p.text)
                .join('')
            : delta.content;
          if (text) yield { type: 'text', text };
        }

        if (delta.reasoning_content) {
          accumulatedReasoning += delta.reasoning_content;
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = String(tc.index ?? 0);
            if (!pendingToolCalls[idx]) {
              pendingToolCalls[idx] = {
                id: tc.id || `call_${idx}_${Date.now()}`,
                name: tc.function?.name || '',
                args: tc.function?.arguments || '',
              };
            } else {
              if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
              if (tc.function?.arguments) pendingToolCalls[idx].args += tc.function.arguments;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  for (const tc of Object.values(pendingToolCalls)) {
    yield {
      type: 'tool_call',
      toolCall: {
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.args },
      },
    };
  }
  yield { type: 'done', reasoning: accumulatedReasoning || undefined };
}

/**
 * Non-streaming chat.
 */
export async function sendChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools?: AIToolDefinition[],
): Promise<{ content: string | null; toolCalls: AIToolCall[] }> {
  const cfg = normalizeConfig(config);
  const isAnthropic = isAnthropicUrl(cfg.baseUrl);

  let attempt: { response: Response; data: any };
  try {
    attempt = await requestChat(cfg, messages, tools, false);
  } catch (err) {
    attempt = {
      response: { ok: false, status: 0 } as Response,
      data: { error: { message: `Error de red: ${err instanceof Error ? err.message : String(err)}` } },
    };
  }

  if (!attempt.response.ok) {
    throw new Error(classifyError(attempt.response, attempt.data, !!cfg.apiKey));
  }

  if (isAnthropic) {
    const textParts = attempt.data?.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || null;
    return {
      content: textParts,
      toolCalls: [],
    };
  }

  const choice = attempt.data?.choices?.[0]?.message || attempt.data?.message;
  return {
    content: choice?.content || choice?.reasoning_content || null,
    toolCalls: choice?.tool_calls || [],
  };
}

/**
 * Prueba la conexión con UNA petición directa al proveedor.
 */
export async function probeProvider(
  config: AIProviderConfig,
): Promise<{ ok: boolean; status: number; message: string; latencyMs: number }> {
  const cfg = normalizeConfig(config);
  const started = Date.now();
  let attempt: { response: Response; data: any };
  try {
    attempt = await requestChat(
      cfg,
      [
        { role: 'system', content: 'Responde únicamente con la palabra OK.' },
        { role: 'user', content: 'Prueba de conexión' },
      ],
      undefined,
      false,
    );
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: `Error de red: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - started,
    };
  }
  const latencyMs = Date.now() - started;
  if (attempt.response.ok) {
    return { ok: true, status: attempt.response.status, message: 'OK', latencyMs };
  }
  return {
    ok: false,
    status: attempt.response.status,
    message: classifyError(attempt.response, attempt.data, !!cfg.apiKey),
    latencyMs,
  };
}

/** Modelos de OpenCode Zen para selector rápido */
export const AI_MODELS = [
  { id: 'big-pickle', name: 'Big Pickle (OpenCode)', provider: 'OpenCode Zen', tier: 'balanced', free: true },
  { id: 'glm-5.2', name: 'GLM 5.2', provider: 'GLM', tier: 'advanced' },
  { id: 'glm-5.1', name: 'GLM 5.1', provider: 'GLM', tier: 'advanced' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', tier: 'advanced' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', tier: 'fast' },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', provider: 'Kimi', tier: 'advanced' },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', provider: 'MiniMax', tier: 'advanced' },
  { id: 'glm-5', name: 'GLM 5', provider: 'GLM', tier: 'balanced' },
] as const;

export const FREE_MODELS = AI_MODELS.filter(m => (m as any).free).map(m => m.id);
