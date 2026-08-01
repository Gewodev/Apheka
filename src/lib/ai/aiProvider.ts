// ═══════════════════════════════════════════════════
//  OWA BRAIN — AI Provider Layer (OpenRouter)
// ═══════════════════════════════════════════════════

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
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
  type: 'text' | 'tool_call' | 'done' | 'error';
  text?: string;
  toolCall?: AIToolCall;
  error?: string;
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Send a message to the AI provider and get a streaming response.
 * Yields chunks as they arrive (text deltas, tool calls, done, or error).
 */
export async function* streamChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools?: AIToolDefinition[],
): AsyncGenerator<AIStreamChunk> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: messages.map(m => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      return msg;
    }),
    max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    stream: true,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://owa-studio.app',
        'X-Title': 'OWA Studio',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    yield { type: 'error', error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
    return;
  }

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody?.error?.message || errBody?.message || errMsg;
    } catch {}
    yield { type: 'error', error: errMsg };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  // Accumulate tool calls across chunks
  const pendingToolCalls: Record<string, { id: string; name: string; args: string }> = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
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
          yield { type: 'done' };
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
  yield { type: 'done' };
}

/**
 * Non-streaming chat (for simpler use cases or fallback).
 */
export async function sendChat(
  config: AIProviderConfig,
  messages: AIMessage[],
  tools?: AIToolDefinition[],
): Promise<{ content: string | null; toolCalls: AIToolCall[] }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    stream: false,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://owa-studio.app',
      'X-Title': 'OWA Studio',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody?.error?.message || errBody?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const result = await response.json();
  const choice = result?.choices?.[0]?.message;
  return {
    content: choice?.content || null,
    toolCalls: choice?.tool_calls || [],
  };
}

/** Popular models for UI selector */
export const AI_MODELS = [
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google', tier: 'fast' },
  { id: 'big-pickle', name: 'Big Pickle (OpenCode)', provider: 'OpenCode', tier: 'balanced' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'fast' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', tier: 'balanced' },
  { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 'fast' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'advanced' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta', tier: 'balanced' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', tier: 'advanced' },
] as const;

export const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
