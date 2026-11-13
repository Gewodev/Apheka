// Cloudflare Worker: proxy compatible con la API Anthropic Messages para Claude Code.
//
// Enruta por prefijo de modelo:
//   - gemini-*       -> Google Gemini (AI Studio), usando el secreto GEMINI_API_KEY
//   - cualquier otro -> OpenRouter (comportamiento previo), usando el token del cliente
//
// Traduce Anthropic <-> Gemini (contenido, herramientas y streaming) y
// Anthropic <-> OpenAI (para OpenRouter). Mantiene el contrato que Claude Code espera:
//   GET  /v1/models
//   POST /v1/messages              (streaming y no streaming)
//   POST /v1/messages/count_tokens
//   POST /v1/chat/completions      (alias OpenAI-compatible)
//
// Secretos en Cloudflare:
//   npx wrangler secret put GEMINI_API_KEY   # clave de Google AI Studio (AIza... / AQ...)
//   npx wrangler secret put PROXY_TOKEN      # token que envía Claude Code en Authorization
//
// Variables opcionales: OPENROUTER_URL, HTTP_REFERER, X_TITLE.

const VERSION = 'v13';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-api-key,anthropic-version,anthropic-beta,x-proxy-token',
};

const FALLBACK_GEMINI_MODELS = [
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-pro-latest',
  'gemini-flash-latest',
];

function getGeminiApiKey(env) {
  return String(env.GEMINI_API_KEY || '').trim();
}

let modelsCache = { at: 0, data: null };

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const url = new URL(request.url);

      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ status: 'ok', version: VERSION, providers: ['gemini', 'openrouter'] });
      }

      if (!checkAuth(request, env)) {
        return json({ type: 'error', error: { type: 'authentication_error', message: 'Token de proxy no valido.' } }, 401);
      }

      if (url.pathname === '/v1/models' && request.method === 'GET') {
        return await handleModels(env);
      }

      if (url.pathname === '/v1/messages' && request.method === 'POST') {
        return await handleMessages(request, env);
      }
      if (url.pathname === '/v1/messages/count_tokens' && request.method === 'POST') {
        return await handleCountTokens(request, env);
      }
      if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
        return await handleOpenAIChat(request, env);
      }

      return json({ type: 'error', error: { type: 'not_found_error', message: 'Ruta no encontrada: ' + url.pathname } }, 404);
    } catch (cause) {
      return json({ type: 'error', error: { type: 'api_error', message: String(cause && cause.message ? cause.message : cause) } }, 500);
    }
  },
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

function clientToken(request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const apiKey = (request.headers.get('x-api-key') || '').trim();
  const proxy = (request.headers.get('x-proxy-token') || '').trim();
  const raw = proxy || bearer || apiKey;
  // Compatibilidad con el formato antiguo "clave|extra": se usa la primera parte.
  return raw.split('|')[0].trim();
}

function checkAuth(request, env) {
  const rawExpected = String(env.PROXY_TOKEN || '').trim();
  if (!rawExpected) return true; // modo abierto si no se configuro secreto
  const token = clientToken(request);
  if (!token) return false;
  const allowed = rawExpected.split(/[,;\s]+/).map((t) => t.split('|')[0].trim()).filter(Boolean);
  return allowed.includes(token) || rawExpected === token || rawExpected.split('|')[0].trim() === token;
}

function isGemini(model) {
  return typeof model === 'string' && /^gemini-[a-z0-9.\-]+$/i.test(model);
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------
async function fetchGeminiModels(env) {
  if (!getGeminiApiKey(env)) return [];
  const now = Date.now();
  if (modelsCache.data && now - modelsCache.at < 3600_000) return modelsCache.data;
  const res = await fetch(GEMINI_BASE + '/models?pageSize=1000', {
    headers: { 'x-goog-api-key': getGeminiApiKey(env) },
  });
  if (!res.ok) return [];
  const body = await res.json();
  const list = (body.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((id) => /^gemini-/.test(id) && !/embedding|-image$|tts|transcribe|live|computer-use|robotics/.test(id));
  modelsCache = { at: now, data: list };
  return list;
}

async function handleModels(env) {
  const gemini = await fetchGeminiModels(env);
  const data = gemini.map((id) => ({ id, object: 'model', owned_by: 'google', display_name: id }));
  return json({ object: 'list', data });
}

// ---------------------------------------------------------------------------
// Anthropic Messages
// ---------------------------------------------------------------------------
async function handleMessages(request, env) {
  const body = await request.json();
  const model = body.model || '';
  const stream = body.stream === true;

  if (isGemini(model)) {
    if (!getGeminiApiKey(env)) {
      return json({ type: 'error', error: { type: 'authentication_error', message: 'Falta el secreto GEMINI_API_KEY en el Worker.' } }, 500);
    }
    return stream ? geminiStream(body, env) : geminiOnce(body, env);
  }

  return stream ? openRouterStream(body, request, env) : openRouterOnce(body, request, env);
}

async function handleOpenAIChat(request, env) {
  const body = await request.json();
  const anthropic = openAItoAnthropic(body);
  const fake = new Request(request.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '' },
    body: JSON.stringify(anthropic),
  });
  return handleMessages(fake, env);
}

async function handleCountTokens(request, env) {
  const body = await request.json();
  const model = body.model || '';
  const approx = estimateTokens(body);
  if (isGemini(model) && getGeminiApiKey(env)) {
    try {
      const payload = { contents: toGeminiContents(body) };
      const sys = flattenText(body.system);
      if (sys) payload.systemInstruction = { parts: [{ text: sys }] };
      const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:countTokens`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': getGeminiApiKey(env) },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.totalTokens === 'number') return json({ input_tokens: data.totalTokens });
      }
    } catch (_) { /* cae al aproximado */ }
  }
  return json({ input_tokens: approx });
}

function estimateTokens(body) {
  const text = JSON.stringify(body.messages || []) + ' ' + JSON.stringify(body.system || '') + ' ' + JSON.stringify(body.tools || '');
  return Math.max(1, Math.ceil(text.length / 4));
}

// ---------------------------------------------------------------------------
// Anthropic -> Gemini
// ---------------------------------------------------------------------------
function toGeminiContents(body) {
  const contents = [];
  const nameById = new Map();

  const pushTurn = (role, parts) => {
    if (!parts.length) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else contents.push({ role, parts: parts.slice() });
  };

  const toolResponse = (block) => {
    const id = block.tool_use_id || block.tool_call_id || block.id;
    const name = block.name || nameById.get(id) || 'tool';
    return { functionResponse: { name, response: { result: extractToolResult(block) } } };
  };

  for (const msg of body.messages || []) {
    if (msg.role === 'assistant') {
      const parts = [];
      if (typeof msg.content === 'string') {
        if (msg.content) parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) parts.push({ text: block.text });
          else if (block.type === 'tool_use') {
            if (block.id && block.name) nameById.set(block.id, block.name);
            parts.push({ functionCall: { name: block.name, args: block.input || {} } });
          }
        }
      }
      for (const call of msg.tool_calls || []) {
        const name = call.function?.name || call.name;
        if (call.id && name) nameById.set(call.id, name);
        parts.push({ functionCall: { name, args: parseMaybeJson(call.function?.arguments ?? call.input ?? {}) } });
      }
      pushTurn('model', parts);
      continue;
    }

    if (msg.role === 'tool') {
      pushTurn('user', [toolResponse({ tool_use_id: msg.tool_call_id || msg.tool_use_id, name: msg.name, content: msg.content })]);
      continue;
    }

    // user
    const parts = [];
    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text' && typeof block.text === 'string') parts.push({ text: block.text });
        else if (block.type === 'tool_result') parts.push(toolResponse(block));
        else if (block.type === 'image' || block.type === 'image_url') {
          const inline = imageToInline(block);
          if (inline) parts.push(inline);
        }
      }
    }
    pushTurn('user', parts.length ? parts : [{ text: '' }]);
  }
  if (contents.length && contents[0].role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: '' }] });
  }
  return contents;
}

function imageToInline(block) {
  const source = block.source || {};
  if (source.type === 'base64' && source.data) {
    return { inlineData: { mimeType: source.media_type || 'image/png', data: source.data } };
  }
  if (source.type === 'url' && source.url) return { text: '[imagen: ' + String(source.url).slice(0, 200) + ']' };
  const url = block.image_url?.url || '';
  const data = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (data) return { inlineData: { mimeType: data[1], data: data[2] } };
  if (url) return { text: '[imagen: ' + url.slice(0, 200) + ']' };
  return null;
}

function extractToolResult(block) {
  if (block == null) return '';
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) return flattenText(block.content) || JSON.stringify(block.content);
  if (block.content && typeof block.content === 'object') return block.content;
  return '';
}

function toGeminiTools(body) {
  if (!Array.isArray(body.tools) || !body.tools.length) return undefined;
  const declarations = body.tools
    .filter((t) => t && (t.name || t.function?.name))
    .map((t) => ({
      name: t.name || t.function.name,
      description: t.description || t.function?.description || '',
      parameters: sanitizeSchema(t.input_schema || t.function?.parameters),
    }));
  return declarations.length ? [{ functionDeclarations: declarations }] : undefined;
}

const GEMINI_SCHEMA_ALLOWED_KEYS = new Set([
  'type', 'format', 'description', 'nullable', 'enum',
  'maxItems', 'minItems', 'properties', 'required', 'items', 'anyOf'
]);

function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);

  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (!GEMINI_SCHEMA_ALLOWED_KEYS.has(k) && k !== 'allOf' && k !== 'oneOf') continue;

    if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
      const props = {};
      for (const [pk, pv] of Object.entries(v)) {
        props[pk] = sanitizeSchema(pv);
      }
      out.properties = props;
    } else if (k === 'items') {
      out.items = Array.isArray(v) ? (v[0] ? sanitizeSchema(v[0]) : { type: 'string' }) : sanitizeSchema(v);
    } else if (k === 'required') {
      if (Array.isArray(v)) {
        const reqs = v.filter((x) => typeof x === 'string');
        if (reqs.length) out.required = reqs;
      }
    } else if (k === 'enum') {
      if (Array.isArray(v)) out.enum = v.map(String);
    } else if (k === 'anyOf' || k === 'oneOf' || k === 'allOf') {
      if (Array.isArray(v)) out.anyOf = v.map(sanitizeSchema);
    } else if (k === 'type') {
      out.type = typeof v === 'string' ? v.toLowerCase() : 'object';
    } else if (GEMINI_SCHEMA_ALLOWED_KEYS.has(k)) {
      out[k] = v;
    }
  }

  if (!out.type && !out.anyOf) {
    if (out.properties) out.type = 'object';
    else if (out.items) out.type = 'array';
    else out.type = 'string';
  }
  if (out.type === 'object' && !out.properties && !out.anyOf) {
    out.properties = {};
  }
  if (out.type === 'array' && !out.items) {
    out.items = { type: 'string' };
  }
  return out;
}

function buildGeminiRequest(body) {
  const req = { contents: toGeminiContents(body) };
  const tools = toGeminiTools(body);
  if (tools) req.tools = tools;
  const gl = {};
  if (typeof body.max_tokens === 'number') gl.maxOutputTokens = body.max_tokens;
  if (typeof body.temperature === 'number') gl.temperature = body.temperature;
  if (typeof body.top_p === 'number') gl.topP = body.top_p;
  if (typeof body.top_k === 'number') gl.topK = body.top_k;
  if (body.stop_sequences) gl.stopSequences = body.stop_sequences;
  if (Object.keys(gl).length) req.generationConfig = gl;
  const sys = flattenText(body.system);
  if (sys) req.systemInstruction = { parts: [{ text: sys }] };
  return req;
}

// ---------------------------------------------------------------------------
// Gemini -> Anthropic (no streaming)
// ---------------------------------------------------------------------------
async function geminiOnce(body, env) {
  const model = body.model;
  const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': getGeminiApiKey(env) },
    body: JSON.stringify(buildGeminiRequest(body)),
  });
  const data = await res.json();
  if (!res.ok) return json(mapGeminiError(data, res.status), res.status);
  return json(geminiToAnthropicMessage(data, model));
}

function geminiToAnthropicMessage(data, model) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const content = [];
  let stopReason = 'end_turn';
  for (const part of parts) {
    if (typeof part.text === 'string' && part.text.length) {
      content.push({ type: 'text', text: part.text });
    } else if (part.functionCall) {
      content.push({ type: 'tool_use', id: 'toolu_' + randomId(), name: part.functionCall.name, input: part.functionCall.args || {} });
      stopReason = 'tool_use';
    }
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  const u = data?.usageMetadata || {};
  return {
    id: 'msg_' + randomId(),
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: candidate?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : stopReason,
    stop_sequence: null,
    usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
  };
}

// ---------------------------------------------------------------------------
// Gemini -> Anthropic (streaming SSE)
// ---------------------------------------------------------------------------
async function geminiStream(body, env) {
  const model = body.model;
  const upstream = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': getGeminiApiKey(env) },
    body: JSON.stringify(buildGeminiRequest(body)),
  });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return json(mapGeminiError(data, upstream.status), upstream.status);
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      const send = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      let index = -1;
      let textOpen = false;
      let outputTokens = 0;
      let stopReason = 'end_turn';

      send('message_start', {
        type: 'message_start',
        message: { id: 'msg_' + randomId(), type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } },
      });

      const closeText = () => {
        if (textOpen) { send('content_block_stop', { type: 'content_block_stop', index }); textOpen = false; }
      };

      try {
        for await (const line of readLines(upstream.body)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
          if (!payload) continue;
          let chunk;
          try { chunk = JSON.parse(payload); } catch (_) { continue; }
          const obj = Array.isArray(chunk) ? chunk[0] : chunk;
          const cand = obj?.candidates?.[0];
          if (obj?.usageMetadata) outputTokens = obj.usageMetadata.candidatesTokenCount || outputTokens;
          for (const part of cand?.content?.parts || []) {
            if (typeof part.text === 'string' && part.text.length) {
              if (!textOpen) {
                index += 1;
                send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
                textOpen = true;
              }
              send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: part.text } });
            } else if (part.functionCall) {
              closeText();
              index += 1;
              stopReason = 'tool_use';
              send('content_block_start', {
                type: 'content_block_start',
                index,
                content_block: { type: 'tool_use', id: 'toolu_' + randomId(), name: part.functionCall.name, input: {} },
              });
              send('content_block_delta', {
                type: 'content_block_delta',
                index,
                delta: { type: 'input_json_delta', partial_json: JSON.stringify(part.functionCall.args || {}) },
              });
              send('content_block_stop', { type: 'content_block_stop', index });
            }
          }
          if (cand?.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
        }
        closeText();
        send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: outputTokens } });
        send('message_stop', { type: 'message_stop' });
        controller.close();
      } catch (cause) {
        send('error', { type: 'error', error: { type: 'api_error', message: String(cause && cause.message ? cause.message : cause) } });
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive', ...CORS },
  });
}

// ---------------------------------------------------------------------------
// OpenRouter (compatibilidad bidireccional)
// ---------------------------------------------------------------------------
function anthropicToOpenAI(body) {
  const messages = [];
  const sys = flattenText(body.system);
  if (sys) messages.push({ role: 'system', content: sys });

  for (const msg of body.messages || []) {
    if (msg.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: msg.tool_call_id || msg.tool_use_id || msg.name, content: stringifyContent(msg.content) });
      continue;
    }
    if (msg.role === 'assistant') {
      const text = flattenText(msg.content);
      const calls = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use') calls.push({ id: block.id, type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input || {}) } });
        }
      }
      for (const call of msg.tool_calls || []) {
        calls.push({
          id: call.id || ('call_' + randomId()),
          type: 'function',
          function: { name: call.function?.name || call.name, arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function?.arguments ?? call.input ?? {}) },
        });
      }
      const entry = { role: 'assistant', content: text || null };
      if (calls.length) entry.tool_calls = calls;
      messages.push(entry);
      continue;
    }

    // user
    if (Array.isArray(msg.content)) {
      const parts = [];
      const toolMsgs = [];
      for (const block of msg.content) {
        if (block.type === 'tool_result') toolMsgs.push({ role: 'tool', tool_call_id: block.tool_use_id || block.id, content: extractToolResult(block) });
        else if (block.type === 'text') parts.push({ type: 'text', text: block.text });
        else if (block.type === 'image' || block.type === 'image_url') parts.push(block);
      }
      messages.push(...toolMsgs);
      if (parts.length) messages.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
    } else {
      messages.push({ role: 'user', content: msg.content });
    }
  }

  const out = { model: body.model, messages };
  if (typeof body.max_tokens === 'number') out.max_tokens = body.max_tokens;
  if (typeof body.temperature === 'number') out.temperature = body.temperature;
  if (typeof body.top_p === 'number') out.top_p = body.top_p;
  if (body.stop_sequences) out.stop = body.stop_sequences;
  if (Array.isArray(body.tools) && body.tools.length) {
    out.tools = body.tools.map((t) => ({
      type: 'function',
      function: { name: t.name || t.function?.name, description: t.description || t.function?.description, parameters: t.input_schema || t.function?.parameters },
    }));
    out.tool_choice = 'auto';
  }
  return out;
}

function openRouterRequest(request, env) {
  const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + clientToken(request) };
  if (env.HTTP_REFERER) headers['http-referer'] = env.HTTP_REFERER;
  if (env.X_TITLE) headers['x-title'] = env.X_TITLE;
  return { url: env.OPENROUTER_URL || DEFAULT_OPENROUTER_URL, headers };
}

async function openRouterOnce(body, request, env) {
  const { url, headers } = openRouterRequest(request, env);
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...anthropicToOpenAI(body), stream: false }) });
  const data = await res.json();
  if (!res.ok) return json({ type: 'error', error: { type: 'api_error', message: data?.error?.message || 'OpenRouter error' } }, res.status);
  return json(openAIToAnthropicMessage(data, body.model));
}

function openAIToAnthropicMessage(data, model) {
  const choice = data?.choices?.[0];
  const msg = choice?.message || {};
  const content = [];
  let stopReason = choice?.finish_reason === 'tool_calls' ? 'tool_use' : choice?.finish_reason === 'length' ? 'max_tokens' : 'end_turn';
  if (msg.content) content.push({ type: 'text', text: typeof msg.content === 'string' ? msg.content : flattenText(msg.content) });
  for (const call of msg.tool_calls || []) {
    content.push({ type: 'tool_use', id: call.id || ('toolu_' + randomId()), name: call.function?.name, input: parseMaybeJson(call.function?.arguments) });
    stopReason = 'tool_use';
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  return {
    id: 'msg_' + randomId(),
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: data?.usage?.prompt_tokens || 0, output_tokens: data?.usage?.completion_tokens || 0 },
  };
}

async function openRouterStream(body, request, env) {
  const { url, headers } = openRouterRequest(request, env);
  const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...anthropicToOpenAI(body), stream: true }) });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return json({ type: 'error', error: { type: 'api_error', message: data?.error?.message || 'OpenRouter error' } }, upstream.status);
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      const send = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      let index = -1;
      let textOpen = false;
      let stopReason = 'end_turn';
      const toolSlots = new Map();
      send('message_start', { type: 'message_start', message: { id: 'msg_' + randomId(), type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } });
      const closeText = () => { if (textOpen) { send('content_block_stop', { type: 'content_block_stop', index }); textOpen = false; } };
      try {
        for await (const line of readLines(upstream.body)) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') break;
          let chunk;
          try { chunk = JSON.parse(payload); } catch (_) { continue; }
          const choice = chunk?.choices?.[0] || {};
          const delta = choice.delta || {};
          if (typeof delta.content === 'string' && delta.content.length) {
            if (!textOpen) { index += 1; send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }); textOpen = true; }
            send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: delta.content } });
          }
          for (const call of delta.tool_calls || []) {
            const slot = call.index ?? 0;
            if (!toolSlots.has(slot)) {
              closeText();
              index += 1;
              toolSlots.set(slot, index);
              stopReason = 'tool_use';
              send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: call.id || ('toolu_' + randomId()), name: call.function?.name || 'tool', input: {} } });
            }
            if (call.function?.arguments) {
              send('content_block_delta', { type: 'content_block_delta', index: toolSlots.get(slot), delta: { type: 'input_json_delta', partial_json: call.function.arguments } });
            }
          }
          if (choice.finish_reason === 'length') stopReason = 'max_tokens';
        }
        closeText();
        for (const idx of toolSlots.values()) send('content_block_stop', { type: 'content_block_stop', index: idx });
        send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 0 } });
        send('message_stop', { type: 'message_stop' });
        controller.close();
      } catch (cause) {
        send('error', { type: 'error', error: { type: 'api_error', message: String(cause && cause.message ? cause.message : cause) } });
        controller.close();
      }
    },
  });
  return new Response(sse, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive', ...CORS } });
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
async function* readLines(body) {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      yield buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer.length) yield buffer;
}

function flattenText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((p) => p && p.type === 'text').map((p) => p.text).join('\n');
  return '';
}

function stringifyContent(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return flattenText(content) || JSON.stringify(content);
  return JSON.stringify(content);
}

function parseMaybeJson(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return { value }; }
}

function mapGeminiError(data, status) {
  const message = data?.error?.message || 'Gemini error';
  const type = status === 401 || status === 403 ? 'authentication_error' : status === 429 ? 'rate_limit_error' : 'api_error';
  return { type: 'error', error: { type, message } };
}

function openAItoAnthropic(body) {
  const messages = [];
  let system = '';
  for (const msg of body.messages || []) {
    if (msg.role === 'system') { system += (system ? '\n' : '') + stringifyContent(msg.content); continue; }
    if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: (msg.tool_calls || []).map((c) => ({ id: c.id, function: { name: c.function?.name, arguments: c.function?.arguments } })) });
      continue;
    }
    if (msg.role === 'tool') { messages.push({ role: 'tool', tool_call_id: msg.tool_call_id, name: msg.tool_call_id, content: msg.content }); continue; }
    messages.push({ role: 'user', content: msg.content });
  }
  return {
    model: body.model,
    system: system || undefined,
    messages,
    max_tokens: body.max_tokens || body.max_completion_tokens,
    temperature: body.temperature,
    tools: (body.tools || []).map((t) => ({ name: t.function?.name, description: t.function?.description, input_schema: t.function?.parameters })),
    stream: !!body.stream,
  };
}

function randomId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
