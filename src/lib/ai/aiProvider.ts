// ═══════════════════════════════════════════════════
//  CHARVIS — AI Provider Layer (OpenCode Zen)
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
 * https://opencode.ai/zen/v1 desde el webview: el navegador/bloquea la respuesta
 * porque OpenCode Zen no envía el header Access-Control-Allow-Origin. Fuera de
 * Tauri (navegador de desarrollo) se usa window.fetch normal.
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

/** True si la URL base apunta al servicio de OpenCode Zen (donde vive la key). */
export function isOpenCodeZenUrl(baseUrl?: string): boolean {
  if (!baseUrl) return true;
  return baseUrl.includes(ZEN_HOST);
}

/**
 * Normaliza la configuración: limpia la API key y la URL base.
 *
 * La clave se depura eliminando TODO el espacio en blanco (espacios, tabs y
 * saltos de línea que se cuelan al pegar una clave multilínea) y las comillas
 * externas accidentales. Una clave con "\n" o espacios internos se envía como
 * "Bearer sk-xxx\nxxx" y el servidor responde 401/Invalid API key, de ahí que
 * un usuario con una clave válida vea "Tu API key es inválida". Las claves de
 * OpenCode Zen son alfanuméricas (sk-…), por lo que quitar el whitespace es
 * seguro. La URL base se normaliza sin barras finales para no generar
 * "…/v1//chat/completions".
 */
function normalizeConfig(config: AIProviderConfig): AIProviderConfig {
  const apiKey = (config.apiKey || '')
    .replace(/\s+/g, '')
    .replace(/^["']+|["']+$/g, '');
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return { ...config, apiKey, baseUrl };
}

/** Modelos gratuitos sin visión (no aceptan imágenes → HTTP 500). */
function isVisionlessModel(model: string): boolean {
  return model === DEFAULT_MODEL;
}

/**
 * Sin API key solo funcionan los modelos gratuitos (keyless). Si el usuario
 * seleccionó un modelo de pago sin clave, lo degradamos al modelo gratuito
 * por defecto para evitar el error "Missing API key / Missing Authentication".
 */
function resolveModel(config: AIProviderConfig): string {
  if (!config.apiKey && config.model && config.model !== DEFAULT_MODEL) {
    return DEFAULT_MODEL;
  }
  return config.model || DEFAULT_MODEL;
}

/**
 * Builds the request payload for chat completions.
 */
function buildBody(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools: AIToolDefinition[] | undefined,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: resolveModel(config),
    messages: messages.map(m => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      // reasoning_content es un campo específico de modelos de razonamiento
      // (Zen/DeepSeek). Otros proveedores OpenAI-compat pueden rechazar campos
      // desconocidos, así que solo se reenvía hacia endpoints de OpenCode Zen.
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
 * Executes a chat completion request. Returns the parsed body plus the raw
 * response so callers can inspect status codes.
 */
async function requestChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools: AIToolDefinition[] | undefined,
  stream: boolean,
): Promise<{ response: Response; data: any }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://owa-studio.app',
    'X-Title': 'OWA Studio',
  };
  // Solo se envía autenticación si hay una clave configurada. OpenCode Zen
  // sirve el modelo por defecto sin clave (modelo libre / stealth).
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const response = await (await getFetch())(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildBody(config, messages, tools, stream)),
    signal: config.signal,
  });

  // Para streaming NO se debe tocar el body aquí: `response.json()` (o cualquier
  // lectura) consume y lockea el ReadableStream del plugin HTTP, y además falla
  // porque el body SSE ("data: {...}") no es JSON. El consumidor (streamChat)
  // hace `getReader()` sobre ese body; si está locked/leído lanza
  // "ReadableStreamDefaultReader constructor can only accept readable streams
  // that are not yet locked to a reader". Solo en no-streaming se lee el JSON.
  let data: any = null;
  if (!stream) {
    try {
      data = await response.json();
    } catch {}
  }

  return { response, data };
}

/**
 * Detección de fallo de autenticación PRECISA.
 *
 * Antes esto matcheaba cualquier mensaje que contuviera "api key" o "bearer",
 * lo que producía falsos positivos: un 500 por streaming+tools con un mensaje
 * como "The provided API key does not grant access…" se clasificaba como clave
 * inválida y la UI mostraba "Tu API key es inválida" aunque la clave fuera válida.
 *
 * Ahora solo se considera fallo de auth cuando el STATUS HTTP es 401/403, o cuando
 * el texto coincide con frases inequívocas de autenticación.
 */
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

function rawError(response: Response, data: any): string {
  const raw =
    data?.error?.message ||
    data?.error?.detail ||
    data?.message ||
    data?.error ||
    `API error ${response.status}`;
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

/**
 * Clasifica el error final con un mensaje honesto y en español.
 *
 * La clave solo se acusa de inválida si el servidor respondió 401/403 a una
 * petición que LA LLEVABA (status de auth), nunca por heurísticas de texto.
 * Cualquier otro fallo muestra el mensaje crudo del proveedor sin culpar a la key.
 *
 * `hadKey` = si la petición que falló llevaba la clave. `keyConfigured` = si el
 * usuario tiene una clave guardada (aunque el intento que falló fuera keyless),
 * para no sugerirle que "añada una clave" cuando ya tiene una.
 */
function classifyError(
  response: Response,
  data: any,
  hadKey: boolean,
  keyConfigured = hadKey,
  baseUrl?: string,
): string {
  const status = response.status || 0;
  const rawMsg = rawError(response, data);

  // Sin créditos/método de pago (GLM, DeepSeek…): la cuenta no da acceso al modelo
  // aunque la key sea válida. big-pickle es gratis con la clave de OpenCode.
  const lower = String(rawMsg).toLowerCase();
  const creditsIssue =
    lower.includes('no payment method') ||
    lower.includes('payment method') ||
    lower.includes('creditserror') ||
    lower.includes('insufficient credits') ||
    lower.includes('not enough credits') ||
    lower.includes('billing');
  if (creditsIssue) {
    return `El modelo seleccionado requiere créditos o un método de pago en tu cuenta. Big Pickle (OpenCode) es gratis con tu clave y no necesita tarjeta.`;
  }

  if (status === 401 || status === 403 || isAuthFailure(rawMsg)) {
    if (hadKey) {
      return `Tu API key de Charvis es inválida o ha expirado. Revísala en Ajustes → Sistema → Charvis (o vacíala para usar el modelo gratuito big-pickle).`;
    }
    if (keyConfigured) {
      return `El servicio de IA no respondió con la clave configurada ni sin ella. Revisa tu conexión o la URL base en Ajustes → Sistema → Charvis.`;
    }
    return `El modelo seleccionado requiere una API key. Añade tu clave en Ajustes → Sistema → Charvis (o usa el modelo gratuito big-pickle).`;
  }

  if (status === 429) {
    return 'El servicio de IA está saturado (límite de peticiones). Espera unos segundos y vuelve a intentarlo.';
  }

  if (status === 0) {
    return 'No se pudo conectar con el servicio de IA. Revisa tu conexión a internet o la URL base en Ajustes → Sistema → Charvis.';
  }

  const msg = rawMsg;
  return msg && !msg.startsWith('API error')
    ? msg
    : `El servicio de IA no está disponible (HTTP ${status}). Inténtalo de nuevo en unos segundos.`;
}

/** True si algún mensaje incluye partes de imagen. */
function hasImages(messages: AIMessage[]): boolean {
  return messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
}

/**
 * Reduce los mensajes a lo esencial para los fallbacks keyless/gratuito:
 * quita los mensajes `tool`, las `tool_calls` y el `reasoning_content` de los
 * assistant (el modelo gratuito los rechaza en modo no-streaming) y conserva
 * solo system/user/assistant con contenido de texto. Aplica también stripImages
 * porque big-pickle no tiene visión.
 */
function sanitizeForFallback(messages: AIMessage[]): AIMessage[] {
  return stripImages(
    messages
      .filter(m => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
      .map(m => {
        if (m.role === 'assistant') {
          const { tool_calls, reasoning_content, tool_call_id, name, ...rest } = m;
          void tool_calls; void reasoning_content; void tool_call_id; void name;
          return rest;
        }
        return m;
      })
      .filter(m => m.content !== null && m.content !== '')
      .map(m => {
        if (Array.isArray(m.content)) {
          const parts = m.content.filter(p => p.type === 'text' && p.text);
          return parts.length ? { ...m, content: parts } : null;
        }
        return m;
      })
      .filter((m): m is AIMessage => m !== null),
  );
}

/**
 * Reemplaza las imágenes por una nota de texto. El modelo gratuito (big-pickle)
 * no soporta visión y el proveedor responde 500; al degradar evitamos el error
 * y Charvis igualmente sabe que se adjuntó una imagen.
 */
function stripImages(messages: AIMessage[]): AIMessage[] {
  return messages.map(m => {
    if (!Array.isArray(m.content)) return m;
    const parts: AIContentPart[] = [];
    let noted = false;
    for (const p of m.content) {
      if (p.type === 'image_url') {
        if (!noted) {
          parts.push({ type: 'text', text: '[Imagen adjunta: el modelo gratuito no procesa imágenes; añade una API key para que Charvis pueda analizarla]' });
          noted = true;
        }
      } else {
        parts.push(p);
      }
    }
    return { ...m, content: parts };
  });
}

/**
 * Send a message to the AI provider and get a response stream.
 *
 * Estrategia resiliente (nunca deja al usuario sin respuesta):
 *  1. Normaliza la clave (trim) y resuelve el modelo real (keyless → big-pickle).
 *  2. Intenta streaming con herramientas.
 *  3. Si falla por autenticación (401/403 o mensaje de auth), reintenta keyless
 *     con big-pickle (self-healing) en modo no-streaming sin tools.
 *  4. Si falla por HTTP 500 u otro error, reintenta no-streaming sin tools
 *     conservando la clave; si sigue fallando y hay imágenes, las degrada a
 *     texto (los modelos sin visión responden 500 con imágenes).
 *  5. Como último recurso, si la clave configurada no da acceso al modelo,
 *     reintenta big-pickle con clave y, si eso falla, keyless.
 *  6. Los errores siempre son mensajes limpios en español, nunca texto crudo.
 *
 * Yields chunks as they arrive (text deltas, tool calls, done, or error).
 */
export async function* streamChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools?: AIToolDefinition[],
): AsyncGenerator<AIStreamChunk> {
  const cfg = normalizeConfig(config);
  const signal = cfg.signal;
  const aborted = () => !!signal?.aborted;

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
        data: { error: { message: `Network error: ${err instanceof Error ? err.message : String(err)}` } },
      };
    }
  }

  // Escalones de fallback en orden de fiabilidad. Cada uno se prueba SIEMPRE
  // cuando el anterior falla, sin depender de heurísticas de texto que puedan
  // clasificar mal el error. Así, con una clave válida cualquier modelo responde
  // (escalón A/B), y sin clave siempre se cae al modelo gratuito big-pickle.
  // `attemptHadKey` refleja si el intento que ESTÁ en `attempt` llevaba clave,
  // para que el error final no culpe a la key del usuario si falló uno keyless.
  const escalones: (() => Promise<boolean>)[] = [];

  // Escalón A: no-streaming CONSERVANDO herramientas, misma clave y modelo.
  // streaming+tools es la parte frágil de Zen; en modo no-streaming responde y
  // además puede llamar tools. Antes se descartaban las tools aquí y Charvis
  // respondía en texto sin tocar la app → las acciones SÍ se ejecutan ahora.
  escalones.push(async () => {
    if (!cfg.apiKey) return false;
    let ok = false;
    attempt = await tryRequest(cfg, messages, tools, false);
    attemptHadKey = !!cfg.apiKey;
    if (!attempt.response.ok && hasImages(messages)) {
      attempt = await tryRequest(cfg, stripImages(messages), tools, false);
      attemptHadKey = !!cfg.apiKey;
    }
    ok = attempt.response.ok;
    return ok;
  });

  // Escalón B: keyless big-pickle (self-healing — el modelo gratuito responde
  // sin clave; se sanean los mensajes porque no soporta tools ni imágenes).
  escalones.push(async () => {
    const keyless = { ...cfg, apiKey: '', model: DEFAULT_MODEL };
    const msgs = sanitizeForFallback(messages);
    attempt = await tryRequest(keyless, msgs, undefined, false);
    attemptHadKey = false;
    if (!attempt.response.ok && hasImages(msgs)) {
      attempt = await tryRequest(keyless, stripImages(msgs), undefined, false);
      attemptHadKey = false;
    }
    return attempt.response.ok;
  });

  // Escalón C: la clave no da acceso al modelo seleccionado → big-pickle con clave.
  escalones.push(async () => {
    if (!cfg.apiKey || cfg.model === DEFAULT_MODEL) return false;
    const withFree = { ...cfg, model: DEFAULT_MODEL };
    const msgs = sanitizeForFallback(messages);
    attempt = await tryRequest(withFree, msgs, undefined, false);
    attemptHadKey = !!cfg.apiKey;
    if (!attempt.response.ok && hasImages(msgs)) {
      attempt = await tryRequest(withFree, stripImages(msgs), undefined, false);
      attemptHadKey = !!cfg.apiKey;
    }
    return attempt.response.ok;
  });

  // Escalón D: último recurso — big-pickle keyless con SOLO el último mensaje
  // del usuario y un system mínimo. Si un historial complejo o un contenido
  // demasiado grande provoca el HTTP 500, este escalón mínimo casi siempre
  // responde y el turno nunca muere con un error visible.
  escalones.push(async () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return false;
    const lastText = Array.isArray(lastUser.content)
      ? lastUser.content.filter(p => p.type === 'text').map(p => p.text).join(' ').slice(0, 4000)
      : String(lastUser.content || '').slice(0, 4000);
    if (!lastText.trim()) return false;
    const keyless = { ...cfg, apiKey: '', model: DEFAULT_MODEL };
    const minimal: AIMessage[] = [
      { role: 'system', content: 'Eres Charvis, el asistente de OWA Studio. Responde en español, de forma útil y directa, sin decir que vas a hacer nada: hazlo.' },
      { role: 'user', content: lastText },
    ];
    attempt = await tryRequest(keyless, minimal, undefined, false);
    attemptHadKey = false;
    return attempt.response.ok;
  });

  let attempt = await tryRequest(cfg, messages, tools, true);
  let attemptHadKey = !!cfg.apiKey;

  if (aborted()) {
    yield { type: 'aborted' };
    return;
  }

  if (!attempt.response.ok) {
    if (isOpenCodeZenUrl(cfg.baseUrl)) {
      // Zen tiene sus propias particularidades (keyless, big-pickle, HTTP 500
      // con streaming+tools…): se prueban los escalones de autocomprobación.
      for (const es of escalones) {
        if (attempt.response.ok) break;
        await es();
        if (aborted()) {
          yield { type: 'aborted' };
          return;
        }
      }
    } else {
      // Proveedor externo OpenAI-compatible (OpenAI, Gemini, Groq, Mistral…):
      // el fallo del streaming NO es de los fallbacks de Zen. Se reintenta en
      // no-streaming sin tools para capturar el mensaje de error REAL del
      // proveedor (con status + cuerpo) y mostrarlo tal cual.
      attempt = await tryRequest(cfg, sanitizeForFallback(messages), undefined, false);
      attemptHadKey = !!cfg.apiKey;
      if (aborted()) {
        yield { type: 'aborted' };
        return;
      }
    }

    if (!attempt.response.ok) {
      yield { type: 'error', error: classifyError(attempt.response, attempt.data, attemptHadKey, !!cfg.apiKey, cfg.baseUrl) };
      return;
    }

    const choice = attempt.data?.choices?.[0]?.message || attempt.data?.message;
    // Una respuesta no-streaming también puede contener tool_calls: emitirlas
    // (antes se descartaban → Charvis "respondía" sin ejecutar ninguna acción).
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

  const reader = attempt.response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  // Accumulate tool calls across chunks
  const pendingToolCalls: Record<string, { id: string; name: string; args: string }> = {};
  // Accumulate reasoning/thinking content (debe reenviarse en la 2ª pasada)
  let accumulatedReasoning = '';

  try {
    while (true) {
      let readResult: { done: boolean; value?: Uint8Array };
      try {
        readResult = await reader.read();
      } catch (readErr) {
        // Si la cancelación aborta el fetch a mitad de lectura, reader.read()
        // rechaza con AbortError en lugar de resolver. Tratarlo como stop.
        if (aborted()) {
          yield { type: 'aborted' };
          return;
        }
        throw readErr;
      }
      if (aborted()) {
        // No emitimos error: es una cancelación del usuario, no un fallo.
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          // Emit any pending tool calls
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

        // Text content
        if (delta.content) {
          yield { type: 'text', text: delta.content };
        }

        // Reasoning content (modelos de razonamiento)
        if (delta.reasoning_content) {
          accumulatedReasoning += delta.reasoning_content;
        }

        // Tool calls (streamed incrementally)
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

  // Emit remaining tool calls if stream ended without [DONE]
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
 * Non-streaming chat (for simpler use cases or fallback).
 */
export async function sendChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools?: AIToolDefinition[],
): Promise<{ content: string | null; toolCalls: AIToolCall[] }> {
  const cfg = normalizeConfig(config);
  let attempt = await (async () => {
    try {
      return await requestChat(cfg, messages, tools, false);
    } catch (err) {
      return {
        response: { ok: false, status: 0 } as Response,
        data: { error: { message: `Network error: ${err instanceof Error ? err.message : String(err)}` } },
      };
    }
  })();

  if (!attempt.response.ok) {
    // Self-healing: si la petición configurada falla, reintenta con el modelo
    // gratuito sin clave (big-pickle) antes de rendirse. Así "Probar conexión"
    // responde incluso si el modelo de pago no está disponible con la clave.
    const originalAttempt = attempt;
    const keyless = { ...cfg, apiKey: '', model: DEFAULT_MODEL };
    const msgs = sanitizeForFallback(messages);
    const fb = await requestChat(keyless, msgs, undefined, false).catch(() => attempt);
    if (fb.response.ok) {
      attempt = fb;
    } else {
      // El fallback keyless también falló. Si el intento original (con clave)
      // fue un fallo de autenticación REAL, ese es el diagnóstico útil; si no,
      // el problema es de red/servicio y no hay que culpar a la clave.
      const originalWasAuth =
        originalAttempt.response.status === 401 ||
        originalAttempt.response.status === 403 ||
        isAuthFailure(rawError(originalAttempt.response, originalAttempt.data));
      const useOriginal = !!cfg.apiKey && originalWasAuth;
      throw new Error(
        classifyError(
          useOriginal ? originalAttempt.response : fb.response,
          useOriginal ? originalAttempt.data : fb.data,
          useOriginal ? !!cfg.apiKey : false,
          !!cfg.apiKey,
          cfg.baseUrl,
        ),
      );
    }
  }

  const choice = attempt.data?.choices?.[0]?.message || attempt.data?.message;
  return {
    content: choice?.content || choice?.reasoning_content || null,
    toolCalls: choice?.tool_calls || [],
  };
}

/**
 * Prueba la conexión con UNA petición directa (sin fallbacks self-healing) y
 * reporta el código HTTP real. La usa "Probar conexión" para que el usuario vea
 * la causa exacta: 401/403 = clave rechazada, 500 = servicio de inferencia caído,
 * 404 = URL base incorrecta, 0 = error de red/CORS.
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
    message: classifyError(attempt.response, attempt.data, !!cfg.apiKey, !!cfg.apiKey, cfg.baseUrl),
    latencyMs,
  };
}

/** Popular models for UI selector (OpenCode Zen OpenAI-compatible models) */
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

/** Modelos que funcionan sin API key (gratuitos / keyless) */
export const FREE_MODELS = AI_MODELS.filter(m => (m as any).free).map(m => m.id);

export const DEFAULT_MODEL = 'big-pickle';
