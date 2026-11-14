// Cloudflare Worker: proxy compatible con Anthropic Messages para Claude Code.
// Todo el trafico se enruta exclusivamente a traves de OpenRouter.
// Soporte integral de modelos gratuitos de OpenRouter (openrouter/free, prefijo free/*, sufijo :free/-free)
// y fallback automatico a openrouter/free si un modelo de pago agota saldo.
//
// Rutas soportadas:
//   GET  /
//   GET  /health
//   GET  /v1/models
//   POST /v1/messages              (streaming SSE y no-streaming)
//   POST /v1/messages/count_tokens
//   POST /v1/chat/completions      (alias OpenAI-compatible)

const VERSION = 'v17';
const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_ROUTER = 'openrouter/free';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-api-key,anthropic-version,anthropic-beta,x-proxy-token',
};

const OPENROUTER_ALIASES = {
  // Enrutadores y Prefijos Free de OpenRouter
  'openrouter/free': 'openrouter/free',
  'free': 'openrouter/free',
  'auto-free': 'openrouter/free',
  'free/auto': 'openrouter/free',
  'free/any': 'openrouter/free',
  'free/nemotron': 'nvidia/nemotron-3.5-lightning:free',
  'free/nemotron-vl': 'nvidia/nemotron-3.5-super-vl:free',
  'free/gemma': 'google/gemma-4-31b-it:free',
  'free/flint': 'recursive/flint-v1.0:free',
  'free/mimo': 'xiaomi/mimo-v2.6-flash:free',
  'free/minimax': 'minimax/minimax-m3.1-flash:free',
  'free/deepseek': 'deepseek/deepseek-v4.1-flash-1017:free',
  'free/glm': 'z-ai/glm-5.3-flashx-legal:free',

  // Modelos Gratuitos Específicos OpenRouter
  'nemotron-3.5-lightning-free': 'nvidia/nemotron-3.5-lightning:free',
  'nemotron-3.5-lightning:free': 'nvidia/nemotron-3.5-lightning:free',
  'nemotron-3.5-super-vl-free': 'nvidia/nemotron-3.5-super-vl:free',
  'nemotron-3.5-super-vl:free': 'nvidia/nemotron-3.5-super-vl:free',
  'nemotron-3-ultra:free': 'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nemotron-3-nano:free': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'gemma-4-31b:free': 'google/gemma-4-31b-it:free',
  'gemma-4-26b:free': 'google/gemma-4-26b-a4b-it:free',
  'gemma-4-free': 'google/gemma-4-31b-it:free',
  'flint-40b-free': 'recursive/flint-v1.0:free',
  'flint:free': 'recursive/flint-v1.0:free',
  'beam-free': 'openrouter/free',
  'mimo-v2.6-flash-free': 'xiaomi/mimo-v2.6-flash:free',
  'mimo-free': 'xiaomi/mimo-v2.6-flash:free',
  'minimax-m3.1-flash-free': 'minimax/minimax-m3.1-flash:free',
  'minimax-free': 'minimax/minimax-m3.1-flash:free',
  'glm-5.3-flash-free': 'z-ai/glm-5.3-flashx-legal:free',
  'glm-free': 'z-ai/glm-5.3-flashx-legal:free',
  'deepseek-v4.1-flash-free': 'deepseek/deepseek-v4.1-flash-1017:free',
  'deepseek-free': 'deepseek/deepseek-v4.1-flash-1017:free',
  'inkling-2-small-free': 'thinkingmachines/inkling-2-small:free',
  'longcat-2.5-free': 'liquid/lfm-3-1.7b:free',
  'iceman-free': 'openrouter/free',

  // Google / Gemini (vía OpenRouter)
  'gemini-4-carbon': 'google/gemini-4-carbon',
  'gemini-4-argon': 'google/gemini-4-argon',
  'gemini-4-hydrogen': 'google/gemini-4-hydrogen',
  'gemini-3.8-flash': 'google/gemini-3.8-flash',
  'gemini-3.7-flash': 'google/gemini-3.7-flash',
  'gemini-3.6-flash': 'google/gemini-3.6-flash',
  'gemini-3.5-flash': 'google/gemini-3.5-flash',
  'gemini-3.5-flash-lite': 'google/gemini-3.5-flash-lite',
  'gemini-3.1-pro': 'google/gemini-2.5-pro',
  'gemini-2.5-pro': 'google/gemini-2.5-pro',
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'google/gemini-2.5-flash-lite',
  'gemini-pro-latest': 'google/gemini-2.5-pro',
  'gemini-flash-latest': 'google/gemini-2.5-flash',

  // Anthropic / Claude
  'claude-opus-5-5': 'anthropic/claude-opus-5.5',
  'claude-sonnet-5-5': 'anthropic/claude-sonnet-5.5',
  'claude-haiku-5-5': 'anthropic/claude-haiku-5.5',
  'claude-fable-5-1': 'anthropic/claude-fable-5.1',
  'claude-fable-5-2': 'anthropic/claude-fable-5.2',

  // OpenAI / GPT
  'gpt-5.3-codex': 'openai/gpt-5.3-codex',
  'gpt-5.3-codex-spark': 'openai/gpt-5.3-codex',
  'gpt-5.4-mini': 'openai/gpt-5.4-mini',
  'gpt-5.4-nano': 'openai/gpt-5.4-mini',
  'gpt-5.5': 'openai/gpt-5.5-pro',
  'gpt-5.5-pro': 'openai/gpt-5.5-pro',
  'gpt-5.6-terra': 'openai/gpt-5.5-pro',
  'gpt-6-astra': 'openai/gpt-5.5-pro',
  'gpt-6-luna': 'openai/gpt-5.5-pro',
  'gpt-6.1-sol': 'openai/gpt-5.5-pro',

  // DeepSeek & Otros
  'deepseek-v4-pro': 'deepseek/deepseek-v4-pro-0813',
  'deepseek-v4.1-flash': 'deepseek/deepseek-v4.1-flash-1017',
  'minimax-m3': 'minimax/minimax-m3.1-flash',
  'glm-5.3': 'z-ai/glm-5.3-flashx-legal',
  'glm-5.3-flash': 'z-ai/glm-5.3-flashx-legal',
  'grok-4.7': 'x-ai/grok-4.7',
  'grok-build-0.1': 'x-ai/grok-4.7',
  'kimi-k2.7-code': 'moonshotai/kimi-k2.7-code',
  'kimi-k3': 'moonshotai/kimi-k3.1-pro',
  'mistral-large-4': 'mistralai/mistral-large-4-0',
  'muse-ember-1.0': 'meta-llama/llama-3.3-70b-instruct',
  'muse-wonder-1.0': 'meta-llama/llama-3.3-70b-instruct',
  'big-pickle': 'meta-llama/llama-3.3-70b-instruct',
  'qwen3.8-flash': 'qwen/qwen3.8-flash',
};

function resolveOpenRouterModel(model) {
  if (!model) return FREE_ROUTER;
  const trimmed = String(model).trim();
  if (OPENROUTER_ALIASES[trimmed]) return OPENROUTER_ALIASES[trimmed];

  // Prefijo free/
  if (trimmed.startsWith('free/')) {
    const sub = trimmed.slice(5);
    if (OPENROUTER_ALIASES[sub]) return OPENROUTER_ALIASES[sub];
    if (OPENROUTER_ALIASES[sub + '-free']) return OPENROUTER_ALIASES[sub + '-free'];
    return FREE_ROUTER;
  }

  // Sufijo -free
  if (trimmed.endsWith('-free')) {
    const colonVersion = trimmed.replace(/-free$/, ':free');
    if (OPENROUTER_ALIASES[colonVersion]) return OPENROUTER_ALIASES[colonVersion];
  }

  // Si ya es un slug con proveedor/modelo (ej. google/gemini-2.5-flash)
  if (trimmed.includes('/')) return trimmed;

  // Gemini prefix
  if (trimmed.startsWith('gemini-')) return 'google/' + trimmed;

  return trimmed;
}

function clientToken(request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const apiKey = (request.headers.get('x-api-key') || '').trim();
  const proxy = (request.headers.get('x-proxy-token') || '').trim();
  const raw = proxy || bearer || apiKey;
  return raw.split('|')[0].trim();
}

function checkAuth(request, env) {
  const rawExpected = String(env.PROXY_TOKEN || '').trim();
  if (!rawExpected) return true;
  const token = clientToken(request);
  if (!token) return false;
  const allowed = rawExpected.split(/[,;\s]+/).map((t) => t.split('|')[0].trim()).filter(Boolean);
  return allowed.includes(token) || rawExpected === token || rawExpected.split('|')[0].trim() === token;
}

function getOpenRouterToken(request, env) {
  const token = clientToken(request);
  if (token && token.startsWith('sk-or-')) return token;
  if (env.OPENROUTER_API_KEY) return String(env.OPENROUTER_API_KEY).trim();
  const rawExpected = String(env.PROXY_TOKEN || '');
  const found = rawExpected.split(/[,;\s]+/).find((t) => t.trim().startsWith('sk-or-'));
  if (found) return found.trim();
  return token;
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const url = new URL(request.url);

      if (url.pathname === '/' || url.pathname === '/health') {
        return json({
          status: 'ok',
          version: VERSION,
          provider: 'openrouter',
          free_router: FREE_ROUTER,
          models_supported: Object.keys(OPENROUTER_ALIASES).length,
        });
      }

      if (!checkAuth(request, env)) {
        return json({ type: 'error', error: { type: 'authentication_error', message: 'Token de proxy no valido.' } }, 401);
      }

      if (url.pathname === '/v1/models' && request.method === 'GET') {
        return handleModels();
      }

      if (url.pathname === '/v1/messages' && request.method === 'POST') {
        return await handleMessages(request, env);
      }

      if (url.pathname === '/v1/messages/count_tokens' && request.method === 'POST') {
        return await handleCountTokens(request);
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

function handleModels() {
  const data = Object.keys(OPENROUTER_ALIASES).map((id) => ({
    id,
    object: 'model',
    owned_by: id.includes('free') ? 'openrouter-free' : id.startsWith('gemini') ? 'google' : id.startsWith('claude') ? 'anthropic' : 'openrouter',
    display_name: id,
  }));
  return json({ object: 'list', data });
}

async function handleCountTokens(request) {
  const body = await request.json();
  const text = JSON.stringify(body.messages || []) + ' ' + JSON.stringify(body.system || '') + ' ' + JSON.stringify(body.tools || '');
  const approx = Math.max(1, Math.ceil(text.length / 4));
  return json({ input_tokens: approx });
}

async function handleMessages(request, env) {
  const body = await request.json();
  const stream = body.stream === true;
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

// ---------------------------------------------------------------------------
// Traduccion Anthropic -> OpenRouter
// ---------------------------------------------------------------------------
function openRouterRequest(request, env) {
  const headers = {
    'content-type': 'application/json',
    authorization: 'Bearer ' + getOpenRouterToken(request, env),
  };
  if (env.HTTP_REFERER) headers['http-referer'] = env.HTTP_REFERER;
  else headers['http-referer'] = 'https://claude.ai';
  if (env.X_TITLE) headers['x-title'] = env.X_TITLE;
  else headers['x-title'] = 'Claude Code OpenRouter Proxy';
  return { url: env.OPENROUTER_URL || DEFAULT_OPENROUTER_URL, headers };
}

function anthropicToOpenAI(body, overrideModel, overrideMaxTokens) {
  const messages = [];
  const sys = flattenText(body.system);
  if (sys) messages.push({ role: 'system', content: sys });

  for (const msg of body.messages || []) {
    if (msg.role === 'tool') {
      messages.push({
        role: 'tool',
        tool_call_id: msg.tool_call_id || msg.tool_use_id || msg.name,
        content: stringifyContent(msg.content),
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const text = flattenText(msg.content);
      const calls = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            calls.push({
              id: block.id,
              type: 'function',
              function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
            });
          }
        }
      }
      for (const call of msg.tool_calls || []) {
        calls.push({
          id: call.id || ('call_' + randomId()),
          type: 'function',
          function: {
            name: call.function?.name || call.name,
            arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function?.arguments ?? call.input ?? {}),
          },
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
        if (block.type === 'tool_result') {
          toolMsgs.push({
            role: 'tool',
            tool_call_id: block.tool_use_id || block.id,
            content: extractToolResult(block),
          });
        } else if (block.type === 'text') {
          parts.push({ type: 'text', text: block.text });
        } else if (block.type === 'image' || block.type === 'image_url') {
          parts.push(block);
        }
      }
      messages.push(...toolMsgs);
      if (parts.length) {
        messages.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
      }
    } else {
      messages.push({ role: 'user', content: msg.content });
    }
  }

  const resolved = overrideModel || resolveOpenRouterModel(body.model);
  const out = { model: resolved, messages };

  const rawMax = typeof overrideMaxTokens === 'number' ? overrideMaxTokens : body.max_tokens;
  if (typeof rawMax === 'number') {
    const isFree = resolved.includes('free') || resolved.endsWith(':free');
    out.max_tokens = isFree ? Math.min(rawMax, 4096) : Math.min(rawMax, 2048);
  }

  if (typeof body.temperature === 'number') out.temperature = body.temperature;
  if (typeof body.top_p === 'number') out.top_p = body.top_p;
  if (body.stop_sequences) out.stop = body.stop_sequences;

  if (Array.isArray(body.tools) && body.tools.length) {
    out.tools = body.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name || t.function?.name,
        description: t.description || t.function?.description,
        parameters: t.input_schema || t.function?.parameters,
      },
    }));
    out.tool_choice = 'auto';
  }
  return out;
}

async function openRouterOnce(body, request, env) {
  const { url, headers } = openRouterRequest(request, env);
  let payload = anthropicToOpenAI(body);
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: false }),
  });
  let data = await res.json();

  // Si OpenRouter devuelve 402 (sin saldo, credit hold o limite excedido),
  // intentar fallback automatico a openrouter/free
  if (res.status === 402 && payload.model !== FREE_ROUTER) {
    payload = anthropicToOpenAI(body, FREE_ROUTER);
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, stream: false }),
    });
    data = await res.json();
  }

  if (!res.ok) {
    return json({ type: 'error', error: { type: 'api_error', message: data?.error?.message || 'OpenRouter error' } }, res.status);
  }
  return json(openAIToAnthropicMessage(data, body.model));
}

function openAIToAnthropicMessage(data, model) {
  const choice = data?.choices?.[0];
  const msg = choice?.message || {};
  const content = [];
  let stopReason = choice?.finish_reason === 'tool_calls' ? 'tool_use' : choice?.finish_reason === 'length' ? 'max_tokens' : 'end_turn';

  if (msg.content) {
    content.push({ type: 'text', text: typeof msg.content === 'string' ? msg.content : flattenText(msg.content) });
  }
  for (const call of msg.tool_calls || []) {
    content.push({
      type: 'tool_use',
      id: call.id || ('toolu_' + randomId()),
      name: call.function?.name,
      input: parseMaybeJson(call.function?.arguments),
    });
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
    usage: {
      input_tokens: data?.usage?.prompt_tokens || 0,
      output_tokens: data?.usage?.completion_tokens || 0,
    },
  };
}

async function openRouterStream(body, request, env) {
  const { url, headers } = openRouterRequest(request, env);
  let payload = anthropicToOpenAI(body);
  let upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    let errJson = null;
    try { errJson = JSON.parse(errText); } catch (_) {}
    const msg = errJson?.error?.message || errText;

    // Fallback automático si es 402 a openrouter/free
    if (upstream.status === 402 && payload.model !== FREE_ROUTER) {
      payload = anthropicToOpenAI(body, FREE_ROUTER);
      upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, stream: true }),
      });
    }

    if (!upstream.ok) {
      const finalErr = await upstream.json().catch(() => ({}));
      return json({ type: 'error', error: { type: 'api_error', message: finalErr?.error?.message || msg || 'OpenRouter error' } }, upstream.status);
    }
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      const send = (event, p) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(p)}\n\n`));
      let index = -1;
      let textOpen = false;
      let stopReason = 'end_turn';
      const toolSlots = new Map();

      send('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_' + randomId(),
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });

      const closeText = () => {
        if (textOpen) {
          send('content_block_stop', { type: 'content_block_stop', index });
          textOpen = false;
        }
      };

      try {
        for await (const line of readLines(upstream.body)) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const rawPayload = trimmed.slice(5).trim();
          if (rawPayload === '[DONE]') break;
          let chunk;
          try { chunk = JSON.parse(rawPayload); } catch (_) { continue; }

          const choice = chunk?.choices?.[0] || {};
          const delta = choice.delta || {};

          if (typeof delta.content === 'string' && delta.content.length) {
            if (!textOpen) {
              index += 1;
              send('content_block_start', {
                type: 'content_block_start',
                index,
                content_block: { type: 'text', text: '' },
              });
              textOpen = true;
            }
            send('content_block_delta', {
              type: 'content_block_delta',
              index,
              delta: { type: 'text_delta', text: delta.content },
            });
          }

          for (const call of delta.tool_calls || []) {
            const slot = call.index ?? 0;
            if (!toolSlots.has(slot)) {
              closeText();
              index += 1;
              toolSlots.set(slot, index);
              stopReason = 'tool_use';
              send('content_block_start', {
                type: 'content_block_start',
                index,
                content_block: {
                  type: 'tool_use',
                  id: call.id || ('toolu_' + randomId()),
                  name: call.function?.name || 'tool',
                  input: {},
                },
              });
            }
            if (call.function?.arguments) {
              send('content_block_delta', {
                type: 'content_block_delta',
                index: toolSlots.get(slot),
                delta: { type: 'input_json_delta', partial_json: call.function.arguments },
              });
            }
          }

          if (choice.finish_reason === 'length') stopReason = 'max_tokens';
        }

        closeText();
        for (const idx of toolSlots.values()) {
          send('content_block_stop', { type: 'content_block_stop', index: idx });
        }
        send('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: { output_tokens: 0 },
        });
        send('message_stop', { type: 'message_stop' });
        controller.close();
      } catch (cause) {
        send('error', { type: 'error', error: { type: 'api_error', message: String(cause && cause.message ? cause.message : cause) } });
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      ...CORS,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
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

function extractToolResult(block) {
  if (block == null) return '';
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) return flattenText(block.content) || JSON.stringify(block.content);
  if (block.content && typeof block.content === 'object') return JSON.stringify(block.content);
  return '';
}

function parseMaybeJson(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return { value }; }
}

function openAItoAnthropic(body) {
  const messages = [];
  let system = '';
  for (const msg of body.messages || []) {
    if (msg.role === 'system') {
      system += (system ? '\n' : '') + stringifyContent(msg.content);
      continue;
    }
    if (msg.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: msg.content || '',
        tool_calls: (msg.tool_calls || []).map((c) => ({
          id: c.id,
          function: { name: c.function?.name, arguments: c.function?.arguments },
        })),
      });
      continue;
    }
    if (msg.role === 'tool') {
      messages.push({
        role: 'tool',
        tool_call_id: msg.tool_call_id,
        name: msg.tool_call_id,
        content: msg.content,
      });
      continue;
    }
    messages.push({ role: 'user', content: msg.content });
  }

  return {
    model: body.model,
    system: system || undefined,
    messages,
    max_tokens: body.max_tokens || body.max_completion_tokens,
    temperature: body.temperature,
    tools: (body.tools || []).map((t) => ({
      name: t.function?.name,
      description: t.function?.description,
      input_schema: t.function?.parameters,
    })),
    stream: !!body.stream,
  };
}

function randomId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
