import { Router } from 'express';
import { one, q } from './db.js';
import { requireAuth } from './auth.js';
import { MODELS, MODEL_ALIASES, FREE_DAILY_LIMIT, SYSTEM_PROMPT, PLAN_RANK, IMAGE_MODELS, NVIDIA_API_CONFIG, THINK_EFFORTS, DEFAULT_THINK_EFFORT, EFFORT_PROMPTS } from './models.js';
import { MODES } from './modes.js';
import { webSearch } from './routes-search.js';
import { gatherMedia } from './routes-media.js';
import { execCode } from './routes-sandbox.js';
import { OpenRouter } from '@openrouter/sdk';
import OpenAI from 'openai';
import { generatePptxBuffer, generateDocxBuffer, generateXlsxBuffer, generateWebsiteHtml, savePublicFile } from './fileGenerators.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { lintHtml } from './lib/htmlLint.js';
import { detectCliSkillCommand, installSkillForUser, getUserActiveSkills } from './skills.js';
import { getUserStorageDir, ensureUserWorkspace, saveUserFile, readUserFile } from './user-storage.js';
import { encryptText, decryptText } from './lib/crypto.js';

// Inicializar tabla de uso de generación de imágenes.
// Neon puede tardar en aceptar la primera conexión (cold start): reintentos
// con backoff para no perder la tabla si el primer intento expira.
async function initImageGenerationTable(retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      await q(`
        CREATE TABLE IF NOT EXISTS image_generation_usage (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          month DATE NOT NULL,
          count INT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, month)
        )
      `);
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      console.error(`initImageGenerationTable intento ${i + 1} falló: ${e.message}; reintentando…`);
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
  }
}
initImageGenerationTable().catch(console.error);

// Workspace persistente por usuario para modo Agentes
function getWorkspaceDir(userId) {
  const base = getUserStorageDir(userId);
  return base;
}

async function ensureWorkspace(userId) {
  const dir = getWorkspaceDir(userId);
  await ensureUserWorkspace(userId);
  return dir;
}

async function workspaceWriteFile(userId, relPath, content) {
  const base = await ensureWorkspace(userId);
  const fullPath = path.join(base, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await saveUserFile(userId, relPath, content);
  return `Archivo escrito: ${relPath} (${content.length} chars)`;
}

async function workspaceReadFile(userId, relPath) {
  const base = await ensureWorkspace(userId);
  const fullPath = path.join(base, relPath);
  try {
    const content = await fs.readFile(fullPath, 'utf8');
    return content;
  } catch (e) {
    return `Error leyendo ${relPath}: ${e instanceof Error ? e.message : 'no existe'}`;
  }
}

async function workspaceListFiles(userId, relPath = '.') {
  const base = await ensureWorkspace(userId);
  const fullPath = path.join(base, relPath);
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const lines = entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}${e.isDirectory() ? '/' : ''}`);
    return lines.join('\n') || '(vacío)';
  } catch (e) {
    return `Error listando ${relPath}: ${e instanceof Error ? e.message : 'no existe'}`;
  }
}

// Rangos de plan: free < basic < plus < pro < ultra
const RANK = { free: 0, basic: 1, plus: 2, pro: 3, ultra: 4 };
const MAX_AGENT_STEPS = 10; // aumentado para agentes

function logTool(name, args, latencyMs, result) {
  try {
    const log = {
      tool: name,
      args: typeof args === 'string' ? args.substring(0, 200) : args,
      latencyMs,
      resultLength: result ? result.length : 0,
      timestamp: new Date().toISOString()
    };
    console.log('[TOOL]', JSON.stringify(log));
  } catch (_) { /* logging should not break */ }
}

// Placeholder URL detection
const PLACEHOLDER_DOMAINS = [
  /placehold\.co/i,
  /via\.placeholder\.com/i,
  /dummyimage\.com/i,
  /picsum\.(photos|png|jpg|jpeg|webp|avif|gif)/i,
  /loremflickr\.com/i,
];
function isPlaceholderUrl(url) {
  try {
    const u = new URL(url);
    return PLACEHOLDER_DOMAINS.some(re => re.test(u.hostname));
  } catch {
    return false;
  }
}

const router = Router();
router.use(requireAuth);

router.get('/models', (_req, res) => {
  res.json({ models: Object.values(MODELS).map(({ upstream, ...m }) => m) });
});

// Uso diario del plan gratis (para el contador del cliente).
router.get('/usage', async (req, res) => {
  const rank = RANK[req.plan] ?? 0;
  const usage = await one('SELECT messages FROM usage_daily WHERE user_id = $1 AND day = CURRENT_DATE', [req.user.id]);
  res.json({ used: usage?.messages || 0, limit: rank === 0 ? FREE_DAILY_LIMIT : null });
});

router.get('/conversations', async (req, res) => {
  const r = await q('SELECT id, title, model, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100', [req.user.id]);
  res.json({ conversations: r.rows });
});

router.post('/conversations', async (req, res) => {
  const requested = MODEL_ALIASES[req.body?.model] || req.body?.model;
  const model = MODELS[requested] ? requested : 'x0';
  const c = await one('INSERT INTO conversations (user_id, model) VALUES ($1, $2) RETURNING id, title, model, created_at, updated_at', [req.user.id, model]);
  res.json({ conversation: c });
});

router.get('/conversations/:id/messages', async (req, res) => {
  const conv = await one('SELECT id, title, model FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!conv) return res.status(404).json({ error: 'not_found' });

  // Paginación descendente: últimos 100 mensajes por defecto, ?before=TIMESTAMP para ver más
  const before = typeof req.query.before === 'string' ? req.query.before : null;
  const r = await q(
    `SELECT id, role, content, reasoning, model, tools, steps, created_at
     FROM messages
     WHERE conversation_id = $1 ${before ? 'AND created_at < $2' : ''}
     ORDER BY created_at DESC LIMIT 100`,
    before ? [conv.id, before] : [conv.id],
  );
  const decryptedMessages = r.rows.map((m) => ({
    ...m,
    content: decryptText(m.content),
    reasoning: m.reasoning ? decryptText(m.reasoning) : null,
  }));
  res.json({ conversation: conv, messages: decryptedMessages.reverse(), hasMore: r.rows.length === 100 });
});

router.delete('/conversations/:id', async (req, res) => {
  await q('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ── YouTube: transcripción (subtítulos) vía youtube-transcript-api ──
// YouTube exige tokens pot a los clientes directos; la librería de Python
// youtube-transcript-api (gratuita, sin claves) los maneja internamente.
// Se ejecuta como proceso aparte — NO usa el sandbox de código.

function youtubeId(raw) {
  const m = String(raw).trim().match(/(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(String(raw).trim())) return String(raw).trim();
  return null;
}

function runPythonTranscript(videoId, lang) {
  return new Promise((resolve, reject) => {
    const script = [
      'import json, sys',
      'try:',
      '    from youtube_transcript_api import YouTubeTranscriptApi',
      '    api = YouTubeTranscriptApi()',
      `    f = api.fetch(${JSON.stringify(videoId)}, languages=[${JSON.stringify(lang)}, "es", "en"])`,
      '    print(json.dumps({"ok": True, "lang": f.language_code, "frags": [{"start": s.start, "text": s.text} for s in f]}))',
      'except Exception as e:',
      '    print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))',
    ].join('\n');
    const py = process.platform === 'win32' ? 'python' : 'python3';
    const p = spawn(py, ['-c', script]);
    let out = '';
    let errS = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.stderr.on('data', (d) => { errS += d.toString(); });
    p.on('error', (e) => reject(new Error(`Python no está disponible en el servidor: ${e.message}`)));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`python exit ${code}: ${errS.slice(0, 200)}`));
      try {
        const data = JSON.parse(out.trim().split('\n').pop());
        if (!data.ok) return reject(new Error(String(data.error).slice(0, 300)));
        resolve(data);
      } catch { reject(new Error(`Salida de python no legible: ${(out || errS).slice(0, 200)}`)); }
    });
    const killer = setTimeout(() => { try { p.kill(); } catch { /* noop */ } }, 45000);
    killer.unref();
  });
}

async function fetchYoutubeTranscript(raw, preferredLang = 'es') {
  const videoId = youtubeId(raw);
  if (!videoId) throw new Error('No es una URL de YouTube válida.');
  const data = await runPythonTranscript(videoId, preferredLang);
  const frags = (data.frags || []).map((f) => ({ text: String(f.text || '').replace(/\n+/g, ' ').trim(), start: Number(f.start) || 0 })).filter((f) => f.text);
  if (!frags.length) throw new Error('La transcripción llegó vacía.');
  return { videoId, title: '', lang: data.lang || '?', frags };
}

// ── Herramientas autónomas del agente (function calling OpenAI-compatible) ──
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
name: 'web_search',
       description: 'Busca en Internet información actualizada: noticias, datos recientes, precios, eventos, documentación. Úsala siempre que la respuesta dependa de información posterior a tu entrenamiento o de datos frescos. Puedes especificar opciones como recencyDays (días atrás), domainWhitelist (lista de dominios permitidos), y includeCredibility (boolean).',
       parameters: {
         type: 'object',
         properties: { 
           query: { type: 'string', description: 'Consulta de búsqueda, breve y específica.' },
           recencyDays: { type: 'number', description: 'Limitar resultados a los últimos N días (ej: 7 para última semana)' },
           domainWhitelist: { 
             type: 'array', 
             items: { type: 'string' },
             description: 'Lista de dominios permitidos (ej: ["reuters.com", "bbc.com"])'
           },
           includeCredibility: { 
             type: 'boolean', 
             description: 'Incluir puntuación de credibilidad en los resultados (por defecto: true)' 
           }
         },
         required: ['query'],
       },
    },
  },
  {
    type: 'function',
    function: {
      name: 'media_search',
      description: 'Obtiene imágenes y videos REALES sobre un tema. Devuelve URLs verificadas que puedes incrustar en tu respuesta con Markdown. Úsala cuando el usuario pida ver algo, cuando una imagen enriquezca la respuesta, o cuando pidas material visual.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Tema a buscar (mejor en inglés o nombre propio).' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Ejecuta código en tu propia terminal (sandbox aislado) y devuelve stdout/stderr reales. Lenguajes: javascript (Node.js), python, bash. Úsala para cálculos exactos, probar código antes de entregarlo, procesar datos, generar archivos o verificar cualquier resultado en vez de adivinarlo.',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['javascript', 'python', 'bash'] },
          code: { type: 'string', description: 'Código completo y ejecutable.' },
        },
        required: ['language', 'code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo en el workspace persistente del agente. Úsalo para escribir código, configs, docs, etc. El path es relativo a la raíz del workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta relativa del archivo (ej: src/main.js, package.json)' },
          content: { type: 'string', description: 'Contenido completo del archivo' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lee un archivo del workspace persistente del agente. El path es relativo a la raíz del workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta relativa del archivo a leer' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Lista el contenido de un directorio en el workspace persistente del agente. El path es relativo a la raíz (por defecto ".").',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta relativa del directorio a listar (opcional, default: ".")' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_document',
      description: 'Edita el documento que el usuario está estudiando. Úsala cuando el usuario te pida resolver ejercicios, escribir respuestas, corregir errores, añadir notas o modificar el documento de cualquier forma. El documento se muestra en un panel lateral junto al chat.',
      parameters: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            description: 'Lista de operaciones de edición a aplicar en orden.',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['replace', 'insert', 'delete'], description: 'Tipo de operación' },
                start: { type: 'number', description: 'Posición inicial (índice de carácter)' },
                end: { type: 'number', description: 'Posición final (índice de carácter)' },
                text: { type: 'string', description: 'Texto a insertar (para replace e insert)' },
              },
              required: ['type', 'start', 'end'],
            },
          },
        },
required: ['operations'],
      },
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Genera una imagen usando IA. Solo disponible para planes Pro y superiores. Máximo 3 generaciones por mes. Úsala cuando el usuario pida crear, dibujar, diseñar o generar una imagen.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Descripción detallada de la imagen a generar en inglés (máx 1000 caracteres).' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_youtube',
      description: 'Obtiene la transcripción completa (subtítulos) de un video de YouTube a partir de su URL o ID. Úsala SIEMPRE que el usuario comparta un enlace de YouTube para poder "ver" su contenido: resúmenes, puntos clave, qué dice, responder preguntas sobre el video, etc.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL o ID del video de YouTube (ej: https://www.youtube.com/watch?v=..., https://youtu.be/...)' },
          lang: { type: 'string', description: 'Idioma preferido de los subtítulos (código ISO como es o en). Opcional.' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_website',
      description: 'Genera un sitio web HTML completo, profesional y multi-página funcional en un único archivo. ARQUITECTURA DE RUTAS: El sitio es 100% autocontenido en este archivo. Si tiene barra de navegación con varias páginas o secciones (por ejemplo: Inicio, Modelos, Servicios, Nosotros, Contacto, Inventario), implementa TODAS esas páginas o vistas dentro del código como vistas SPA (ej: <div id="inicio" class="page-view">...</div>, <div id="modelos" class="page-view hidden">...</div>) y usa enlaces href="#inicio", href="#modelos", href="#servicios", href="#contacto" junto con un script interactivo en JS para alternar suavemente entre ellas sin recargar la página. NUNCA uses href="/" ni href="/servicios" externos.',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'HTML completo del sitio: <!DOCTYPE html>, <style> dentro de <head> y <script> antes de </body>. Un único archivo, sin bloques markdown ni fragmentos sueltos.' },
          title: { type: 'string', description: 'Título del sitio web' },
        },
        required: ['html'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_pptx',
      description: 'Genera una presentación PowerPoint (.pptx) nativa y descargable a partir de markdown simple. Úsala cuando el usuario pida diapositivas o una presentación.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título de la presentación' },
          markdown: { type: 'string', description: 'Contenido en markdown simple: "# Slide 1" para cada diapositiva, "## Subtítulo", "- viñeta"' },
        },
        required: ['title', 'markdown'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_docx',
      description: 'Genera un documento Word (.docx) nativo y descargable a partir de markdown simple. Úsala cuando el usuario pida un documento de Word.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del documento' },
          markdown: { type: 'string', description: 'Contenido en markdown simple: "# Título", "## Subtítulo", "- lista", texto normal' },
        },
        required: ['title', 'markdown'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_xlsx',
      description: 'Genera una hoja de cálculo Excel (.xlsx) nativa y descargable. Úsala cuando el usuario pida una hoja de cálculo o tabla Excel.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Nombre de la hoja' },
          headers: { type: 'array', items: { type: 'string' }, description: 'Encabezados de columnas' },
          rows: { type: 'array', items: { type: 'array', items: {} }, description: 'Filas de datos, cada fila es un array de valores alineado con los headers' },
        },
        required: ['sheetName', 'headers', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'install_skill',
      description: 'Instala y activa una Skill o template en el orquestador de MAVERICK. Soporta comandos como "npx claude-code-templates@latest --skill creative-design/frontend-design", "uipro init --ai claude", "uipro init --ai maverick", "npx skills add <skill>", "creative-design/frontend-design", "shadcn-architect", "fullstack-pro". Úsala SIEMPRE que el usuario pida instalar, activar o usar un comando npx/skill/template.',
      parameters: {
        type: 'object',
        properties: {
          skill: { type: 'string', description: 'ID o comando de la skill a instalar (ej: "uipro", "shadcn-architect", "uipro init --ai claude")' },
          customInstructions: { type: 'string', description: 'Reglas adicionales opcionales para la skill' },
        },
        required: ['skill'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_task',
      description: 'Crea o actualiza un plan de orquestación paso a paso visible en la interfaz para tareas complejas o multipaso.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del plan de ejecución' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Descripción del paso' },
                status: { type: 'string', enum: ['completed', 'in_progress', 'pending'], description: 'Estado actual del paso' },
              },
              required: ['label', 'status'],
            },
          },
        },
        required: ['title', 'steps'],
      },
    },
  },
];

// Filtro de stream: convierte etiquetas <thinking>…</thinking> que algunos modelos
// emiten dentro del contenido en eventos de razonamiento, de forma segura por chunks.
function createThinkingFilter(onReasoning, onContent) {
  const OPEN = '<thinking>';
  const CLOSE = '</thinking>';
  let inThink = false;
  let buf = '';
  const drain = (final = false) => {
    for (;;) {
      const tag = inThink ? CLOSE : OPEN;
      const i = buf.indexOf(tag);
      if (i === -1) {
        let cut = buf.length;
        if (!final) {
          const lt = buf.lastIndexOf('<');
          if (lt !== -1 && tag.startsWith(buf.slice(lt)) && buf.slice(lt).length < tag.length) cut = lt;
        }
        if (cut > 0) {
          const out = buf.slice(0, cut);
          buf = buf.slice(cut);
          if (inThink) onReasoning(out); else onContent(out);
        }
        return;
      }
      if (i > 0) {
        const out = buf.slice(0, i);
        buf = buf.slice(i);
        if (inThink) onReasoning(out); else onContent(out);
      }
      buf = buf.slice(tag.length);
      inThink = !inThink;
    }
  };
  return { feed: (t) => { buf += t; drain(); }, end: () => drain(true) };
}

// ── Streaming chat ──────────────────────────────────────────────────
router.post('/stream', async (req, res) => {
  const { conversationId, messages, webSearch: useSearch } = req.body || {};
  const bodyModelId = req.body?.model;
  const modelId = MODEL_ALIASES[bodyModelId] || bodyModelId;
  const modeId = req.body?.mode;
  const modeCfg = MODES[modeId] || null;
  const model = MODELS[modelId];
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  // Think effort: nivel de pensamiento elegido por el usuario. Solo aplica a
  // modelos con razonamiento (X1); X0 es rápido y directo por diseño.
  const effortId = model.reasoning && THINK_EFFORTS[req.body?.thinkEffort]
    ? req.body.thinkEffort
    : (model.reasoning ? DEFAULT_THINK_EFFORT : 'low');
  const thinkEffort = effortId;

  // Adjuntos: documentos (texto extraído) e imágenes/videos (data URL o URL
  // pública subida directo a Render — el proxy de Vercel limita el body).
  const atts = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 4) : [];
  const docAtts = atts.filter((a) => a && a.kind === 'doc' && typeof a.text === 'string' && a.text.trim()).slice(0, 4);
  const imgAtts = atts.filter((a) => a && a.kind === 'image' && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:image/')).slice(0, 2);
  const vidAtts = atts.filter((a) => a && a.kind === 'video' && (
    (typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:video/')) ||
    (typeof a.url === 'string' && /^https?:\/\//.test(a.url))
  )).slice(0, 1);

  // Videos subidos (URL /public/ de ESTE servidor): se resuelven a data URI
  // leyendo del disco local. NVIDIA no puede descargar el archivo desde un
  // backend frío de Render (timeout → 500 intermitente/determinista); el
  // payload inline sí funciona (NIM acepta hasta 25MB de request).
  const VIDEO_INLINE_SERVER_MAX = 15 * 1024 * 1024; // 15MB crudos ≈ 20MB base64
  const VIDEO_MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' };
  const videoTooBig = []; // videos que no se pudieron inlinear (para avisar al modelo)
  for (const v of vidAtts) {
    if (!v.dataUrl && v.url) {
      try {
        const u = new URL(v.url);
        const m = u.pathname.match(/^\/public\/([a-z0-9]{8,24}\.(?:mp4|webm|mov|mkv|avi))$/i);
        if (m) {
          const fsp = await import('fs/promises');
          const buf = await fsp.readFile(path.join(process.cwd(), 'public_files', m[1]));
          if (buf.length > VIDEO_INLINE_SERVER_MAX) {
            videoTooBig.push({ name: v.name || m[1], mb: (buf.length / 1048576).toFixed(1) });
            v.dataUrl = null;
            v.url = '';
          } else {
            const mime = VIDEO_MIME[path.extname(m[1]).toLowerCase()] || 'video/mp4';
            v.dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
            v.url = '';
          }
        }
      } catch (e) {
        console.error('resolveVideoUrl', e?.message || e);
      }
    }
  }
  const inlineVidAtts = vidAtts.filter((v) => v && v.dataUrl);
  // Solo cuenta como medio lo que realmente viaja al modelo (inline).
  const hasMedia = imgAtts.length > 0 || inlineVidAtts.length > 0;

  // Límites por plan
  const rank = RANK[req.plan] ?? 0;
  if (!model.free && rank < 2) {
    return res.status(402).json({ error: 'upgrade_required', message: `${model.name} requiere el plan Plus o superior.` });
  }

  // Consultas pre-stream en PARALELO: en Neon frío cada query puede tardar
  // 1-3 s; en serie duplicaban la espera antes del primer token del stream.
  const [usageRow, settingsRow, activeSkills] = await Promise.all([
    rank === 0
      ? one('SELECT messages FROM usage_daily WHERE user_id = $1 AND day = CURRENT_DATE', [req.user.id])
      : Promise.resolve(null),
    one('SELECT settings FROM users WHERE id = $1', [req.user.id]),
    getUserActiveSkills(req.user.id),
  ]);
  if (rank === 0 && (usageRow?.messages || 0) >= FREE_DAILY_LIMIT) {
    return res.status(402).json({ error: 'limit_reached', message: `Tu límite diario de ${FREE_DAILY_LIMIT} mensajes llegó a su fin. Vuelve mañana o mejora tu plan para seguir conversando.` });
  }

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let convId = conversationId || null;
  let reasoning = '';
  let content = '';
  let aborted = false;
  // Heartbeat SSE: comentarios cada 12 s mantienen viva la conexión a través
  // de los proxies (Render/Vercel) durante silencios largos — búsquedas
  // encadenadas, investigación profunda o arranques fríos del upstream.
  let hb = null;
  res.on('close', () => { aborted = true; if (hb) clearInterval(hb); });
  hb = setInterval(() => {
    if (aborted) { clearInterval(hb); return; }
    try { res.write(': hb\n\n'); } catch { /* socket cerrado */ }
  }, 12000);

  // Contexto extra: modo activo y documentos adjuntos.
  let tools = [];
  // Pasos ordenados cronológicamente (texto, razonamiento, herramientas) —
  // el cliente los renderiza intercalados estilo agente (Kimi/Claude).
  let steps = [];
  const stepText = (kind, d) => {
    const last = steps[steps.length - 1];
    if (last && last.kind === kind) last.text += d;
    else steps.push({ kind, text: d });
  };
  const stepTool = (tool) => { tools.push(tool); steps.push({ kind: 'tool', tool }); };
    const extraContext = [];
  if (modeCfg) extraContext.push({ role: 'system', content: modeCfg.prompt });

  // Auto-detección de comandos CLI de skills (ej: "$ uipro init --ai claude" o "$ maverick skill add ...")
  const lastUserMsgText = String(messages[messages.length - 1]?.content || '').trim();
  const detectedCliSkill = detectCliSkillCommand(lastUserMsgText);
  if (detectedCliSkill) {
    try {
      const installed = await installSkillForUser(req.user.id, detectedCliSkill.skillId, {
        rawCommand: detectedCliSkill.rawCommand,
      });
      const skillEvt = {
        type: 'skill_installed',
        skillId: installed.id,
        name: installed.name,
        version: installed.version,
        category: installed.category,
        command: installed.command,
        description: installed.description,
        filesCreated: installed.filesCreated,
        downloadMeta: installed.downloadMeta,
        storageUsage: installed.storageUsage,
      };
      stepTool(skillEvt);
      send(skillEvt);
      if (!activeSkills.some((s) => s.id === installed.id)) {
        activeSkills.unshift(installed);
      }
      const storageLine = installed.storageUsage
        ? `Almacenamiento dedicado del usuario: ${installed.storageUsage.usedMb} MB / ${installed.storageUsage.quotaMb} MB (${installed.storageUsage.percentUsed}% ocupado, ${installed.storageUsage.fileCount} archivos guardados en Postgres).`
        : '';
      const downloadLine = installed.downloadMeta
        ? `Paquete físico descargado desde npm registry: ${installed.downloadMeta.packageName}@${installed.downloadMeta.version} (${installed.downloadMeta.fileCount} archivos, ${(installed.downloadMeta.downloadSizeBytes / 1024).toFixed(1)} KB descargados).`
        : '';

      extraContext.push({
        role: 'system',
        content: `El usuario acaba de ejecutar el comando CLI "${detectedCliSkill.rawCommand}".
El sistema MAVERICK ya descargó físicamente el paquete y activó la skill "${installed.name}" (v${installed.version}) en el almacenamiento persistente del usuario.
Archivos guardados en disco y base de datos: ${installed.filesCreated.join(' y ')}.
${downloadLine}
${storageLine}
REGLA OBLIGATORIA: Confirma inmediatamente al usuario que el paquete y la skill se descargaron y guardaron con éxito en su almacenamiento asignado de 50 MB, y procede con entusiasmo aplicando sus directrices. NUNCA digas que no puedes ejecutar comandos npx o npm ni que es una simulación.`,
      });
    } catch (e) {
      console.error('CLI skill auto-install error:', e);
    }
  }

  if (Array.isArray(activeSkills) && activeSkills.length > 0) {
    const skillsPrompt = [
      '=== SKILLS ESPECIALIZADAS ACTIVAS EN EL ORQUESTADOR ===',
      'Aplica rigurosamente las directrices de las siguientes Skills activas del usuario:',
      ...activeSkills.map((s) => `\n--- [SKILL: ${s.name}] ---\n${s.instructions}`),
      '=== FIN DE SKILLS ACTIVAS ===',
    ].join('\n');
    extraContext.push({ role: 'system', content: skillsPrompt });
  }

  // Preferencias del usuario (Configuración): idioma, instrucciones y memoria.
  // (settingsRow ya se consultó en paralelo antes de abrir el stream).
  const userSettings = settingsRow?.settings || {};
  const prefBits = [];
  if (userSettings.language === 'es') prefBits.push('Responde siempre en español, sin importar el idioma del mensaje.');
  if (userSettings.language === 'en') prefBits.push('Always respond in English, regardless of the message language.');
  if (typeof userSettings.customInstructions === 'string' && userSettings.customInstructions.trim()) {
    prefBits.push(`Instrucciones del usuario sobre cómo debe responder Maverick:\n${userSettings.customInstructions.trim().slice(0, 2000)}`);
  }
  if (typeof userSettings.memory === 'string' && userSettings.memory.trim()) {
    prefBits.push(`Memoria — datos que el usuario quiere que recuerdes sobre él:\n${userSettings.memory.trim().slice(0, 2000)}`);
  }
  if (prefBits.length) extraContext.push({ role: 'system', content: prefBits.join('\n\n') });
  // Documentos adjuntos: el texto extraído viaja DENTRO del turno del usuario
  // (rol user) en vez de un mensaje de sistema — algunos upstreams solo
  // atienden el primer system message y el documento se perdía.
  const docBlock = docAtts.length
    ? [
        '\n\n--- DOCUMENTOS ADJUNTOS POR EL USUARIO ---',
        'Analiza su contenido con precisión y cita el nombre del archivo cuando lo uses.',
        ...docAtts.map((d) => `\n===== «${String(d.name).slice(0, 120)}» =====\n${d.text.slice(0, 20000)}`),
        '--- FIN DE LOS DOCUMENTOS ADJUNTOS ---',
      ].join('\n')
    : '';
  if (docAtts.length) {
    console.log('[DOCS]', docAtts.map((d) => `${d.name}:${(d.text || '').length}ch`).join(', '));
  }

  // Búsqueda web forzada por el usuario (toggle/modo) — además de la autónoma.
  const wantSearch = useSearch || !!modeCfg?.search;
  if (wantSearch) {
    const query = String(messages[messages.length - 1]?.content || '').slice(0, 300);
    const queries = modeCfg?.search === 'deep'
      ? [query, `${query} — análisis comparativa`, `${query} — novedades 2026`]
      : [query];
    send({ type: 'tool', tool: 'search', status: 'running', query });
    try {
      const seen = new Set();
      const all = [];
      for (const q2 of queries) {
        const r = await webSearch(q2, 8).catch(() => []);
        for (const item of r) {
          if (!seen.has(item.url)) { seen.add(item.url); all.push(item); }
        }
        if (aborted) return res.end();
        if (queries.length > 1) await new Promise((r2) => setTimeout(r2, 900));
      }
      let results = all.slice(0, modeCfg?.search === 'deep' ? 14 : 8);
      if (results.length === 0 && queries.length > 1) {
        await new Promise((r2) => setTimeout(r2, 1500));
        if (aborted) return res.end();
        results = await webSearch(query, 8).catch(() => []);
      }
      stepTool({ type: 'search', query, results });
      send({ type: 'search', query, results });
      if (results.length) {
        extraContext.push({
          role: 'system',
          content: [
            `Resultados actuales de Internet para «${query}».`,
            'Úsalos para responder con información fresca y cita las fuentes por su dominio entre corchetes, p. ej. [wikipedia.org].',
            '',
            ...results.map((r, i) => `${i + 1}. ${r.title} — ${r.domain}\n${r.snippet}\n${r.url}`),
          ].join('\n'),
        });
      }
    } catch (e) {
      console.error('webSearch', e);
      send({ type: 'search', query, results: [], failed: true });
    }
  }

  // Obtención de medios forzada por modo — además de la autónoma.
  if (modeCfg?.media) {
    const raw = String(messages[messages.length - 1]?.content || '').slice(0, 200);
    send({ type: 'tool', tool: 'media', status: 'running', query: raw });
    try {
      const { query, images, videos } = await gatherMedia(raw);
      if (aborted) return res.end();
      stepTool({ type: 'media', query, images, videos });
      send({ type: 'media', query, images, videos });
      if (images.length || videos.length) {
        extraContext.push({
          role: 'system',
          content: [
            `Se obtuvieron medios reales de Wikimedia Commons para «${query}».`,
            'Incrusta las imágenes directamente en tu respuesta con Markdown: ![título](url). Elige las más relevantes (3-6).',
            'Usa ÚNICAMENTE las URLs de estas listas; está terminantemente prohibido inventar otras URLs.',
            'Para los videos, enlázalos con su título en negrita.',
            '',
            'IMÁGENES:',
            ...images.map((im, i) => `${i + 1}. ${im.title} — ${im.url}`),
            'VIDEOS:',
            ...videos.map((v, i) => `${i + 1}. ${v.title} — ${v.url}`),
          ].join('\n'),
        });
      } else {
        extraContext.push({
          role: 'system',
          content: `No se encontraron imágenes ni videos reales para «${query}». NO incrustes imágenes ni enlaces de medios, NO inventes URLs. Responde solo con texto y ofrece intentarlo con otros términos.`,
        });
      }
    } catch (e) {
      console.error('media', e);
      send({ type: 'media', query: raw, images: [], videos: [], failed: true });
    }
  }

  // Ejecuta una herramienta autónoma y devuelve el string resultado para el modelo.
  const runTool = async (name, args) => {
if (name === 'web_search') {
        const query = String(args.query || '').slice(0, 300);
        if (!query) return 'Error: falta query.';
        const start = Date.now();
        send({ type: 'tool', tool: 'search', status: 'running', query });
        try {
          // Extract options from args
          const options = {};
          if (args.recencyDays !== undefined) options.recencyDays = args.recencyDays;
          if (args.domainWhitelist) options.domainWhitelist = Array.isArray(args.domainWhitelist) ? args.domainWhitelist : [args.domainWhitelist];
          if (args.includeCredibility !== undefined) options.includeCredibility = args.includeCredibility;
          
          const results = await webSearch(query, 8, options).catch(() => []);
          stepTool({ type: 'search', query, results });
          send({ type: 'search', query, results, failed: results.length === 0 });
          const latency = Date.now() - start;
          logTool('web_search', { query, options }, latency, results);
          if (!results.length) return 'La búsqueda no devolvió nada (posible límite de tasa o término ambiguo). NO te rindas: analiza por qué pudo fallar y REINTENTA con una consulta diferente — más corta, más específica o en inglés. Ríndete solo tras 2-3 intentos distintos y avisa al usuario.';
          return [
            `Resultados de Internet para «${query}». Cita las fuentes por dominio entre corchetes, p. ej. [wikipedia.org]:`,
            ...results.map((r, i) => {
              let line = `${i + 1}. ${r.title} — ${r.domain}\n${r.snippet}\n${r.url}`;
              if (r.credibilityScore !== undefined) {
                line += ` (Credibilidad: ${(r.credibilityScore * 100).toFixed(0)}%)`;
              }
              if (r.date) {
                line += ` (Fecha: ${r.date.toLocaleDateString()})`;
              }
              return line;
            }),
          ].join('\n').slice(0, 12000);
        } catch (err) {
          const latency = Date.now() - start;
          logTool('web_search', { query, options: {} }, latency, err);
          console.error('web_search error', err);
          return `Error en web_search: ${err.message}`;
        }
      }
if (name === 'media_search') {
       const raw = String(args.query || '').slice(0, 200);
       if (!raw) return 'Error: falta query.';
       const start = Date.now();
       send({ type: 'tool', tool: 'media', status: 'running', query: raw });
       try {
         const { query, images, videos } = await gatherMedia(raw);
         // Filter out placeholder URLs
         const filteredImages = images.filter(im => !isPlaceholderUrl(im.url));
         const filteredVideos = videos.filter(v => !isPlaceholderUrl(v.url));
         stepTool({ type: 'media', query, images: filteredImages, videos: filteredVideos });
         send({ type: 'media', query, images: filteredImages, videos: filteredVideos });
         const latency = Date.now() - start;
         logTool('media_search', { query: raw }, latency, { images: filteredImages.length, videos: filteredVideos.length });
         if (!filteredImages.length && !filteredVideos.length) {
           return 'No se encontraron imágenes ni videos reales. REINTENTA con otros términos — nombre propio, en inglés, o más general — antes de rendirte. Si tras reintentar sigue vacío, NO incrustes imágenes ni inventes URLs; responde solo con texto.';
         }
         return [
           `Medios reales para «${query}». Incrusta 3-6 imágenes con Markdown ![título](url) y enlaza los videos en negrita. Usa ÚNICAMENTE estas URLs:`,
           'IMÁGENES:',
           ...filteredImages.map((im, i) => `${i + 1}. ${im.title} — ${im.url}`),
           'VIDEOS:',
           ...filteredVideos.map((v, i) => `${i + 1}. ${v.title} — ${v.url}`),
         ].join('\n').slice(0, 12000);
       } catch (err) {
         const latency = Date.now() - start;
         logTool('media_search', { query: raw }, latency, err);
         console.error('media_search error', err);
         return `Error en media_search: ${err.message}`;
       }
     }
if (name === 'install_skill') {
        const rawArg = String(args.skill || 'uipro').trim();
        const start = Date.now();
        try {
          const parsedCli = detectCliSkillCommand(rawArg);
          const effectiveSkillId = parsedCli ? parsedCli.skillId : rawArg;
          const effectiveCommand = parsedCli ? parsedCli.rawCommand : rawArg;

          const installed = await installSkillForUser(req.user.id, effectiveSkillId, {
            instructions: args.customInstructions,
            rawCommand: effectiveCommand,
          });
          const skillEvt = {
            type: 'skill_installed',
            skillId: installed.id,
            name: installed.name,
            version: installed.version,
            category: installed.category,
            command: installed.command,
            description: installed.description,
            filesCreated: installed.filesCreated,
            downloadMeta: installed.downloadMeta,
            storageUsage: installed.storageUsage,
          };
          stepTool(skillEvt);
          send(skillEvt);
          logTool('install_skill', { skill: rawArg }, Date.now() - start, installed.id);

          const storageDetails = installed.storageUsage
            ? `Almacenamiento dedicado del usuario: ${installed.storageUsage.usedMb} MB / ${installed.storageUsage.quotaMb} MB (${installed.storageUsage.percentUsed}% en uso, ${installed.storageUsage.fileCount} archivos persistidos en Neon Postgres).`
            : '';
          const pkgDetails = installed.downloadMeta
            ? `Paquete descargado desde npm: ${installed.downloadMeta.packageName}@${installed.downloadMeta.version} (${installed.downloadMeta.fileCount} archivos descomprimidos en /packages/${installed.downloadMeta.packageName}).`
            : '';

          return `Skill "${installed.name}" (v${installed.version}) instalada y activada con éxito.\n${pkgDetails}\n${storageDetails}\nArchivos materializados:\n- ${installed.filesCreated.join('\n- ')}\n\nDirectrices de la Skill:\n${installed.instructions}\n\nConfirma al usuario de inmediato que la skill y el paquete se han descargado físicamente en su almacenamiento persistente de 50 MB y procede con la tarea aplicando sus directrices.`;
        } catch (err) {
         return `Error instalando la skill: ${err.message}`;
       }
     }
if (name === 'plan_task') {
       const title = String(args.title || 'Plan de ejecución').slice(0, 140);
       const planSteps = Array.isArray(args.steps)
         ? args.steps.slice(0, 10).map((s) => ({
             label: String(s.label || '').slice(0, 200),
             status: ['completed', 'in_progress', 'pending'].includes(s.status) ? s.status : 'pending',
           }))
         : [];
       if (!planSteps.length) return 'Error: faltan pasos en el plan.';
       const planEvt = { type: 'task_plan', title, steps: planSteps };
       stepTool(planEvt);
       send(planEvt);
       return `Plan "${title}" actualizado (${planSteps.filter((s) => s.status === 'completed').length}/${planSteps.length} completados).`;
     }
if (name === 'run_code') {
       const language = String(args.language || 'javascript');
       const code = String(args.code || '').slice(0, 50000);
       if (!code.trim()) return 'Error: código vacío.';
       if (language === 'bash') {
         const cliSkill = detectCliSkillCommand(code);
         if (cliSkill) {
           const installed = await installSkillForUser(req.user.id, cliSkill.skillId, {
             rawCommand: cliSkill.rawCommand,
           });
           const stdout = [
             `$ ${cliSkill.rawCommand}`,
             '✔ Inicializando MAVERICK Skill Engine & Persistent Storage...',
             `✔ Paquete resuelto: ${installed.name} (v${installed.version}) [target: ${cliSkill.targetAi}]`,
             ...(installed.downloadMeta
               ? [
                   `✔ Descargado desde npm: ${installed.downloadMeta.packageName}@${installed.downloadMeta.version}`,
                   `✔ Desempaquetados: ${installed.downloadMeta.fileCount} archivos en user_storage/packages`,
                 ]
               : []),
             ...(installed.storageUsage
               ? [`✔ Almacenamiento asignado: ${installed.storageUsage.usedMb} MB / ${installed.storageUsage.quotaMb} MB (${installed.storageUsage.percentUsed}% ocupado)`]
               : []),
             ...installed.filesCreated.map((f) => `✔ Creado: ${f}`),
             `✔ Skill "${installed.name}" activada y sincronizada en Postgres.`,
           ].join('\n');
           const run = { type: 'code', language: 'bash', code, stdout, stderr: '', exitCode: 0, durationMs: 42 };
           stepTool(run);
           send({ type: 'code', ...run });
           const skillEvt = {
             type: 'skill_installed',
             skillId: installed.id,
             name: installed.name,
             version: installed.version,
             category: installed.category,
             command: installed.command,
             description: installed.description,
             filesCreated: installed.filesCreated,
           };
           stepTool(skillEvt);
           send(skillEvt);
           return JSON.stringify({ exitCode: 0, stdout, stderr: '', durationMs: 42 });
         }
       }
       const start = Date.now();
       send({ type: 'tool', tool: 'code', status: 'running', language });
       const r = await execCode(language, code, req.user.id);
       const run = { type: 'code', language, code: code.slice(0, 4000), stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, durationMs: r.durationMs };
       stepTool(run);
       send({ type: 'code', ...run });
       const latency = Date.now() - start;
       logTool('run_code', { language, code: code.substring(0, 200) }, latency, JSON.stringify(r));
       return JSON.stringify({
         exitCode: r.exitCode,
         stdout: r.stdout.slice(0, 8000),
         stderr: r.stderr.slice(0, 4000),
         durationMs: r.durationMs,
       });
     }
 if (name === 'write_file') {
       const filePath = String(args.path || '').slice(0, 500);
       const content = String(args.content || '');
       if (!filePath) return 'Error: falta path.';
       const start = Date.now();
       send({ type: 'tool', tool: 'write_file', status: 'running', path: filePath });
       const result = await workspaceWriteFile(req.user.id, filePath, content);
       const latency = Date.now() - start;
       // El contenido (acotado) viaja en el evento para que el cliente
       // renderice el diff completo del archivo estilo Kimi. stepTool lo
       // persiste para que el historial lo muestre igual.
       send({ type: 'tool', tool: 'write_file', path: filePath, status: 'ok', content: content.slice(0, 6000) });
       stepTool({ type: 'write_file', path: filePath, status: 'ok', content: content.slice(0, 6000) });
       logTool('write_file', { filePath, contentLength: content.length }, latency, result);
       return result;
     }
if (name === 'read_file') {
       const filePath = String(args.path || '').slice(0, 500);
       if (!filePath) return 'Error: falta path.';
       const start = Date.now();
       const content = await workspaceReadFile(req.user.id, filePath);
       const latency = Date.now() - start;
       send({ type: 'tool', tool: 'read_file', path: filePath, status: 'ok' });
       logTool('read_file', { filePath }, latency, content);
       return content;
     }
if (name === 'list_files') {
       const filePath = String(args.path || '.').slice(0, 500);
       const start = Date.now();
       const listing = await workspaceListFiles(req.user.id, filePath);
       const latency = Date.now() - start;
       send({ type: 'tool', tool: 'list_files', path: filePath, status: 'ok' });
       logTool('list_files', { filePath }, latency, listing);
       return listing;
     }
if (name === 'edit_document') {
       const operations = Array.isArray(args.operations) ? args.operations : [];
       if (!operations.length) return 'Error: no hay operaciones de edición.';
       const start = Date.now();
       // Enviar evento al cliente para que aplique las ediciones
       send({ type: 'document_edit', operations });
       stepTool({ type: 'document_edit', operations });
       const latency = Date.now() - start;
       logTool('edit_document', { operationsCount: operations.length }, latency, `Documento editado: se aplicaron ${operations.length} operación(es).`);
       return `Documento editado: se aplicaron ${operations.length} operación(es). El usuario verá los cambios en el panel lateral.`;
     }
if (name === 'generate_image') {
       const prompt = String(args.prompt || '').slice(0, 1000);
       if (!prompt) return 'Error: falta prompt.';
       const start = Date.now();
       // Verificar plan del usuario
       const userPlan = req.plan || 'free';
       const userRank = PLAN_RANK[userPlan] ?? 0;
       if (userRank < PLAN_RANK.free) {
         const latency = Date.now() - start;
         logTool('generate_image', { prompt: prompt.substring(0, 100) }, latency, null);
         return 'Error: La generación de imágenes requiere plan Free o superior.';
       }
       // Verificar límite mensual
       const usage = await one(
         `SELECT count FROM image_generation_usage WHERE user_id = $1 AND month = date_trunc('month', CURRENT_DATE)`,
         [req.user.id]
       );
       const monthlyLimit = IMAGE_MODELS.krea.monthlyLimit;
       if (usage && usage.count >= monthlyLimit) {
         const latency = Date.now() - start;
         logTool('generate_image', { prompt: prompt.substring(0, 100) }, latency, null);
         return `Error: Límite mensual de ${monthlyLimit} generaciones de imagen alcanzado. Se reinicia el próximo mes.`;
       }
       send({ type: 'tool', tool: 'generate_image', status: 'running', prompt });
       try {
         const response = await fetch('https://openrouter.ai/api/v1/images', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             model: IMAGE_MODELS.krea.upstream,
             prompt,
           }),
         });
         const result = await response.json();
         const b64 = result.data?.[0]?.b64_json;
         if (!b64) throw new Error('No image generated');
         const imageUrl = `data:image/png;base64,${b64}`;
         // Incrementar contador
         if (usage) {
           await q(
             `UPDATE image_generation_usage SET count = count + 1 WHERE user_id = $1 AND month = date_trunc('month', CURRENT_DATE)`,
             [req.user.id]
           );
         } else {
           await q(
             `INSERT INTO image_generation_usage (user_id, month, count) VALUES ($1, date_trunc('month', CURRENT_DATE), 1)`,
             [req.user.id]
           );
         }
         stepTool({ type: 'generate_image', prompt, imageUrl });
         send({ type: 'generate_image', prompt, imageUrl });
         const latency = Date.now() - start;
         logTool('generate_image', { prompt: prompt.substring(0, 100) }, latency, imageUrl);
         return 'Imagen generada exitosamente.';
       } catch (e) {
         const latency = Date.now() - start;
         logTool('generate_image', { prompt: prompt.substring(0, 100) }, latency, e);
         console.error('generate_image error:', e);
         return `Error generando imagen: ${e.message}`;
       }
     }
 if (name === 'generate_website') {
       // Acepta HTML pelado o envuelto en bloques markdown ```html.
       const html = String(args.html || '').replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();
       const title = String(args.title || 'Sitio web').slice(0, 120);
       if (!html) return 'Error: falta el código HTML del sitio.';
       const start = Date.now();
       send({ type: 'tool', tool: 'website', status: 'running', query: title });
       try {
         const buffer = generateWebsiteHtml(html, { title });
         const { url, sharecode } = await savePublicFile(buffer, title, 'html', req.user.id, 'website');
         stepTool({ type: 'website_generated', url, sharecode, title, html });
         send({ type: 'website_generated', url, sharecode, title, html });
         logTool('generate_website', { title }, Date.now() - start, url);
         return `Sitio web generado y guardado con link compartible: ${url} (sharecode: ${sharecode}). El usuario ya puede abrirlo. Menciona el enlace en tu respuesta como [ver sitio](${url}).`;
       } catch (err) {
         const latency = Date.now() - start;
         logTool('generate_website', { title }, latency, err);
         console.error('generate_website error', err);
         send({ type: 'website_generated', url: '', sharecode: '', title, failed: true });
         return `Error generando el sitio web: ${err.message}`;
       }
     }
 if (name === 'generate_pptx') {
       const markdown = String(args.markdown || args.content || '').slice(0, 30000);
       const title = String(args.title || 'Presentación').slice(0, 120);
       if (!markdown.trim()) return 'Error: falta el contenido markdown de la presentación.';
       const start = Date.now();
       send({ type: 'tool', tool: 'pptx', status: 'running', query: title });
       try {
         const buffer = await generatePptxBuffer(title, markdown);
         const { url, filename } = await savePublicFile(buffer, title, 'pptx', req.user.id, 'file');
         stepTool({ type: 'file_generated', fileType: 'pptx', url, filename, title, preview: { markdown } });
         send({ type: 'file_generated', fileType: 'pptx', url, filename, title, preview: { markdown } });
         logTool('generate_pptx', { title }, Date.now() - start, url);
         return `Presentación PPTX generada: ${url} — ${filename}. Comparte el enlace al usuario.`;
       } catch (err) {
         const latency = Date.now() - start;
         logTool('generate_pptx', { title }, latency, err);
         console.error('generate_pptx error', err);
         return `Error generando la presentación: ${err.message}`;
       }
     }
 if (name === 'generate_docx') {
       const markdown = String(args.markdown || args.content || '').slice(0, 30000);
       const title = String(args.title || 'Documento').slice(0, 120);
       if (!markdown.trim()) return 'Error: falta el contenido markdown del documento.';
       const start = Date.now();
       send({ type: 'tool', tool: 'docx', status: 'running', query: title });
       try {
         const buffer = await generateDocxBuffer(title, markdown);
         const { url, filename } = await savePublicFile(buffer, title, 'docx', req.user.id, 'file');
         stepTool({ type: 'file_generated', fileType: 'docx', url, filename, title, preview: { markdown } });
         send({ type: 'file_generated', fileType: 'docx', url, filename, title, preview: { markdown } });
         logTool('generate_docx', { title }, Date.now() - start, url);
         return `Documento DOCX generado: ${url} — ${filename}. Comparte el enlace al usuario.`;
       } catch (err) {
         const latency = Date.now() - start;
         logTool('generate_docx', { title }, latency, err);
         console.error('generate_docx error', err);
         return `Error generando el documento: ${err.message}`;
       }
     }
 if (name === 'generate_xlsx') {
        const sheetName = String(args.sheetName || 'Hoja1').slice(0, 80);
        let headers = Array.isArray(args.headers) ? args.headers.map((h) => String(h).slice(0, 80)) : [];
        let rows = Array.isArray(args.rows) ? args.rows : [];

        // Soporte si rows viene vacío pero enviaron tabla o CSV en markdown
        if (!rows.length && (args.data || args.content || args.markdown)) {
          const rawText = String(args.data || args.content || args.markdown || '');
          const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
          const parsed = [];
          for (const line of lines) {
            if (line.includes('|')) {
              if (line.match(/^\s*\|?\s*[-:]+[-| :]*$/)) continue;
              const cells = line.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length);
              if (cells.length) parsed.push(cells);
            } else if (line.includes(',')) {
              parsed.push(line.split(',').map((c) => c.trim()));
            }
          }
          if (parsed.length > 0) {
            if (!headers.length) headers = parsed.shift();
            rows = parsed;
          }
        }

        // Soporte si rows es array de objetos [{ col: val }]
        if (rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
          if (!headers.length) headers = Object.keys(rows[0]);
          rows = rows.map((obj) => headers.map((h) => (obj && obj[h] !== undefined ? obj[h] : '')));
        }

        if (!headers.length || !rows.length) return 'Error: faltan headers o rows para la hoja de cálculo.';
        const start = Date.now();
        send({ type: 'tool', tool: 'xlsx', status: 'running', query: sheetName });
        try {
          const safeRows = rows.map((r) => (Array.isArray(r) ? r.map((v) => v ?? '') : [String(r)]));
          const buffer = await generateXlsxBuffer(sheetName, headers, safeRows);
          const title = `${sheetName}.xlsx`;
          const { url, filename } = await savePublicFile(buffer, title, 'xlsx', req.user.id, 'file');
          const preview = { headers, rows: safeRows.slice(0, 50) };
          stepTool({ type: 'file_generated', fileType: 'xlsx', url, filename, title: sheetName, preview });
          send({ type: 'file_generated', fileType: 'xlsx', url, filename, title: sheetName, preview });
          logTool('generate_xlsx', { sheetName, rows: safeRows.length }, Date.now() - start, url);
          return `Hoja de cálculo XLSX generada: ${url} — ${filename}. Comparte el enlace al usuario.`;
        } catch (err) {
          const latency = Date.now() - start;
          logTool('generate_xlsx', { sheetName }, latency, err);
          console.error('generate_xlsx error', err);
          return `Error generando la hoja de cálculo: ${err.message}`;
        }
      }
  if (name === 'get_youtube') {
       const raw = String(args.url || '').slice(0, 500);
       const lang = String(args.lang || 'es').slice(0, 8);
       if (!raw) return 'Error: falta la URL del video de YouTube.';
       const start = Date.now();
       send({ type: 'tool', tool: 'youtube', status: 'running', query: raw });
       try {
         const { videoId, title, lang: gotLang, frags } = await fetchYoutubeTranscript(raw, lang);
         // Texto con marcas de tiempo compactas [12s] para que el modelo pueda
         // citar momentos concretos del video. Acotado al presupuesto de tokens.
         let transcript = frags.map((f) => `[${Math.floor(f.start)}s] ${f.text}`).join('\n');
         if (transcript.length > 28000) {
           // Sin marcas si desborda: solo el texto corrido.
           transcript = frags.map((f) => f.text).join(' ').slice(0, 28000);
         }
         const header = `Transcripción del video de YouTube «${title}» (https://youtu.be/${videoId}, subtítulos en ${gotLang}):`;
         stepTool({ type: 'youtube', query: raw, title, lang: gotLang, preview: frags.slice(0, 12).map((f) => f.text).join(' ').slice(0, 400) });
         send({ type: 'youtube', query: raw, title, lang: gotLang, preview: frags.slice(0, 12).map((f) => f.text).join(' ').slice(0, 400) });
         const latency = Date.now() - start;
         logTool('get_youtube', { url: raw, lang: gotLang }, latency, `${frags.length} fragmentos`);
         return [
           header,
           '',
           transcript,
           '',
           'Usa esta transcripción como el contenido del video para responder lo que pidió el usuario (resumen, qué dice, preguntas). Cita el título del video y, si es útil, el segundo exacto [Xs] de cada punto.',
         ].join('\n');
       } catch (err) {
         const latency = Date.now() - start;
         logTool('get_youtube', { url: raw }, latency, err);
         console.error('get_youtube error', err);
         stepTool({ type: 'youtube', query: raw, failed: true });
         send({ type: 'youtube', query: raw, failed: true });
         return `No se pudo obtener la transcripción del video: ${err.message}. Comunícalo al usuario y ofrece responder con la información que tengas o que resuma el contenido él mismo.`;
       }
     }
    const start = Date.now();
 logTool('unknown_tool', { name }, Date.now() - start, null);
 return `La herramienta "${name}" no existe. Herramientas disponibles: web_search, media_search, run_code, write_file, read_file, list_files, edit_document, generate_image, generate_website, generate_pptx, generate_docx, generate_xlsx. Usa una de ellas para completar la tarea.`;
  };

  try {
    const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${EFFORT_PROMPTS[thinkEffort]}\n\nFecha actual: ${today}.`;
    const wireMessages = [
      { role: 'system', content: systemPrompt },
      ...extraContext,
      ...messages.map(({ role, content: c }) => ({ role, content: c })),
    ];
    if (hasMedia) {
      wireMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'El usuario adjuntó estos archivos multimedia (imágenes/video). Analízalos en detalle y responde a su último mensaje.' },
          ...imgAtts.map((a) => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
          ...vidAtts.map((a) => ({ type: 'video_url', video_url: { url: a.dataUrl || a.url } })),
        ],
      });
    }

    const filter = createThinkingFilter(
      (d) => { reasoning += d; stepText('reasoning', d); send({ type: 'reasoning', delta: d }); },
      (d) => { content += d; stepText('text', d); send({ type: 'content', delta: d }); },
    );

    let stepCount = 0;

const nvidia = new OpenAI({
       apiKey: process.env.NVIDIA_API_KEY,
       baseURL: NVIDIA_API_CONFIG.baseURL
     });

       let attempt = 0;
        const MAX_NVIDIA_ATTEMPTS = 5;
        const BASE_DELAY_MS = 800;
        // En 500/503 (backend intermitente del upstream, sobre todo con video)
        // el backoff es mucho más largo para salir de la ventana de fallo.
        let lastErrStatus = 0;
        let generated = false;
        // Si el upstream rechaza chat_template_kwargs (400), los reintentos van
        // sin ellos y el effort sigue aplicando vía prompt + max_tokens.
        let nativeParamsOk = true;
       // En effort máximo X1 piensa todo lo posible: el doble de tokens de salida.
       const effMaxTokens = thinkEffort === 'max' && model.reasoning
         ? Math.min(32768, (model.maxTokens || 16384) * 2)
         : (model.maxTokens || 16384);
         while (!generated && attempt < MAX_NVIDIA_ATTEMPTS && !aborted) {
          if (attempt > 0) {
            // En 500/503 el backoff es largo (5s·attempt): los fallos con
            // video son intermitentes del backend de NVIDIA y hay que salir
            // de la ventana de inestabilidad.
            const wait = lastErrStatus === 503 || lastErrStatus === 500 ? 5000 * attempt : BASE_DELAY_MS * attempt;
            await new Promise(res => setTimeout(res, wait));
          }
         // Reset per-attempt state
         tools = [];
         steps = [];
         reasoning = '';
         content = '';
         stepCount = 0;
        // Re-build wireMessages for this attempt.
        // Un ÚNICO system message (algunos upstreams ignoran los demás) con el
        // prompt + contexto extra fusionados; los documentos van en el turno
        // del usuario y los adjuntos visuales en su propio mensaje user.
         const extraSystemBits = extraContext.map((m) => m.content).filter(Boolean).join('\n\n');
         const userMsgs = messages.map(({ role, content: c }) => ({ role, content: c }));
         if (docBlock && userMsgs.length && userMsgs[userMsgs.length - 1].role === 'user') {
           userMsgs[userMsgs.length - 1].content = String(userMsgs[userMsgs.length - 1].content || '') + docBlock;
         }
         // Los medios van FUSIONADOS dentro del último turno del usuario (no en
         // un mensaje separado): el upstream falla intermitentemente (500) con
         // la estructura de mensaje multimedia aparte + tools.
         if (hasMedia && userMsgs.length && userMsgs[userMsgs.length - 1].role === 'user') {
           const last = userMsgs[userMsgs.length - 1];
           const parts = [
             ...(typeof last.content === 'string'
               ? [{ type: 'text', text: last.content }]
               : Array.isArray(last.content) ? last.content : []),
             { type: 'text', text: 'El usuario adjuntó estos archivos multimedia (imágenes/video). Analízalos en detalle y responde a su último mensaje.' },
             ...imgAtts.map((a) => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
             ...inlineVidAtts.map((a) => ({ type: 'video_url', video_url: { url: a.dataUrl || a.url } })),
             ...videoTooBig.map((v) => ({ type: 'text', text: `Nota del sistema: el video adjunto «${v.name}» (${v.mb} MB) es demasiado grande para procesar. Informale al usuario con amabilidad y pídele un recorte más corto o de menor peso.` })),
           ];
           userMsgs[userMsgs.length - 1] = { role: 'user', content: parts };
         } else if (hasMedia) {
           userMsgs.push({
             role: 'user',
             content: [
               { type: 'text', text: 'El usuario adjuntó estos archivos multimedia (imágenes/video). Analízalos en detalle y responde a su último mensaje.' },
               ...imgAtts.map((a) => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
               ...inlineVidAtts.map((a) => ({ type: 'video_url', video_url: { url: a.dataUrl || a.url } })),
             ],
           });
         } else if (videoTooBig.length) {
           // Video demasiado grande: sin parte visual, solo la nota.
           const note = videoTooBig.map((v) => `Nota del sistema: el video adjunto «${v.name}» (${v.mb} MB) es demasiado grande para procesar. Informale al usuario con amabilidad y pídele un recorte más corto o de menor peso.`).join('\n');
           if (userMsgs.length && userMsgs[userMsgs.length - 1].role === 'user') {
             userMsgs[userMsgs.length - 1].content = String(userMsgs[userMsgs.length - 1].content || '') + '\n\n' + note;
           } else {
             userMsgs.push({ role: 'user', content: note });
           }
         }
         const wireMessagesAttempt = [
           { role: 'system', content: extraSystemBits ? `${systemPrompt}\n\n${extraSystemBits}` : systemPrompt },
           ...userMsgs,
         ];

        const filterAttempt = createThinkingFilter(
         (d) => { if (!model.reasoning) return; reasoning += d; stepText('reasoning', d); send({ type: 'reasoning', delta: d }); },
         (d) => { content += d; stepText('text', d); send({ type: 'content', delta: d }); },
       );

         const nvidiaAttempt = new OpenAI({
           apiKey: process.env.NVIDIA_API_KEY,
           baseURL: NVIDIA_API_CONFIG.baseURL,
           timeout: 120000, // 2 min: evita colgar el stream indefinidamente
           maxRetries: 0,   // los reintentos los gestiona el bucle de attempt
         });

         try {
           for (;;) {
            stepCount += 1;
            // Control nativo del upstream (nemotron-3.5-super-vl):
            // chat_template_kwargs { enable_thinking, low_effort }. El effort
            // completo aplica al primer paso (el razonamiento principal que ve
            // el usuario); los pasos siguientes del bucle de agente usan
            // low_effort para continuar creando archivos sin quedarse
            // pensando minutos tras cada herramienta.
            const thinkingKwargs = stepCount === 1
              ? THINK_EFFORTS[thinkEffort].thinking
              : { enable_thinking: true, low_effort: true };
            const extraParams = nativeParamsOk
              ? { chat_template_kwargs: model.reasoning ? thinkingKwargs : { enable_thinking: false, low_effort: true } }
              : {};
            // Última bala con medios: si el backend del upstream falla por el
            // video (intermitente), el intento final va SIN herramientas y
            // SIN la parte visual — mejor una respuesta de texto honesta que
            // un error del servidor.
            const lastResort = hasMedia && attempt >= MAX_NVIDIA_ATTEMPTS - 1;
            const lastResortMsgs = lastResort
              ? wireMessagesAttempt.map((m) => (Array.isArray(m.content)
                  ? { role: m.role, content: [...m.content.filter((p) => p.type === 'text').map((p) => p.text), 'Nota del sistema: el video/imagen adjunto no pudo procesarse por una falla temporal del proveedor. Responde al resto del mensaje e informa al usuario brevemente que reintente el archivo en unos momentos.'].join('\n') }
                  : m))
              : wireMessagesAttempt;
            const stream = await nvidiaAttempt.chat.completions.create({
              // El upstream X0/X1 es VL: imágenes y video van al modelo
              // principal, con herramientas activas.
              model: model.upstream,
              messages: lastResort ? lastResortMsgs : wireMessagesAttempt,
              stream: true,
              max_tokens: effMaxTokens,
              temperature: 1,
              top_p: 0.95,
              ...(lastResort || stepCount > MAX_AGENT_STEPS ? {} : { parallel_tool_calls: true, tools: AGENT_TOOLS, tool_choice: 'auto' }),
              ...extraParams,
            });

           if (!stream) {
             throw new Error('Error del modelo: sin respuesta');
           }

           const toolCallsAttempt = [];
           for await (const chunk of stream) {
             if (aborted) { throw new Error('Aborted'); }
             const delta = chunk.choices?.[0]?.delta || {};
             
             // Razonamiento (reasoning tokens) - NVIDIA usa reasoning_content.
             // X0 es rápido y sin pensamiento visible: no se emite ni se persiste.
             const rDelta = delta.reasoning_content || delta.reasoning || '';
             if (rDelta && model.reasoning) { reasoning += rDelta; stepText('reasoning', rDelta); send({ type: 'reasoning', delta: rDelta }); }
             
             // Contenido normal
             if (delta.content) filterAttempt.feed(delta.content);
             
             // Tool calls
             if (Array.isArray(delta.tool_calls)) {
               for (const tc of delta.tool_calls) {
                 const idx = tc.index ?? toolCallsAttempt.length;
                 if (!toolCallsAttempt[idx]) toolCallsAttempt[idx] = { id: tc.id || `call_${idx}`, name: '', arguments: '' };
                 if (tc.id) toolCallsAttempt[idx].id = tc.id;
                 if (tc.function?.name) toolCallsAttempt[idx].name += tc.function.name;
                 if (tc.function?.arguments) {
                    toolCallsAttempt[idx].arguments += tc.function.arguments;
                    send({
                      type: 'tool_delta',
                      id: toolCallsAttempt[idx].id,
                      name: toolCallsAttempt[idx].name,
                      delta: tc.function.arguments,
                    });
                  }
               }
             }
             
             // Usage info (final chunk)
             if (chunk.usage) send({ type: 'usage', usage: chunk.usage });
           }
           filterAttempt.end();
           if (aborted) { throw new Error('Aborted'); }

           const callsAttempt = toolCallsAttempt.filter((c) => c && c.name);
           if (!callsAttempt.length || stepCount > MAX_AGENT_STEPS) {
             // Generation complete
             generated = true;
             break; // break for loop
           }

            // Ejecuta las herramientas pedidas y sigue el bucle.
            wireMessagesAttempt.push({
              role: 'assistant',
              content: '',
              tool_calls: callsAttempt.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })),
            });
                      const executedTools = await Promise.all(
             callsAttempt.map(async (call) => {
               if (aborted) { throw new Error('Aborted'); }
               let args = {};
               try { args = JSON.parse(call.arguments || '{}'); } catch { args = {}; }
               let result;
               try {
                 result = await runTool(call.name, args);
               } catch (e) {
                 console.error('tool', call.name, e);
                 result = `Error ejecutando ${call.name}: ${e.message}`;
               }
               let toolFeedback = String(result).slice(0, 12000);
               if (stepCount === 8) {
                 toolFeedback += '\n\n[AVISO DE SISTEMA: Has consumido 8 pasos operativos. Si los archivos clave están listos, sintetiza y entrega la solución final al usuario.]';
               } else if (stepCount >= MAX_AGENT_STEPS) {
                 toolFeedback += '\n\n[AVISO DE SISTEMA: Presupuesto de pasos completado. Sintetiza todo el trabajo realizado y presenta la entrega final al usuario ahora.]';
               }
               return { role: 'tool', tool_call_id: call.id, name: call.name, content: toolFeedback };
             })
           );
           wireMessagesAttempt.push(...executedTools);
           // loop continues
         }
         // If we break out of for loop with generated true, we break out of while
         if (generated) {
           // outer tools, steps, reasoning, content already updated via closures
           break;
         }
         } catch (err) {
           console.error(`NVIDIA attempt ${attempt+1} failed`, err?.message || err);
           // Los errores a mitad de stream traen status undefined: el código
           // real va en err.code o err.error.code (p. ej. 500 intermitente).
           const errStatus = err?.status || err?.code || err?.error?.code || 0;
           lastErrStatus = errStatus;
            // Si el upstream rechaza los parámetros nativos (chat_template_kwargs),
           // reintento va sin ellos en vez de repetir el mismo 400 tres veces.
           if (errStatus === 400) {
             nativeParamsOk = false;
           }
         attempt++;
         if (attempt >= MAX_NVIDIA_ATTEMPTS) {
           // Con contenido o herramientas ya ejecutadas, termina con elegancia
           // usando lo generado en vez de matar el stream con un error
           // genérico: la IA debe ser consecuente con lo que ya hizo.
           if (content || tools.length) {
             generated = true;
             break;
           }
           throw err; // will be caught by outer try-catch
         }
         // else retry
       }
     }

    // Persistencia — también con respuestas solo de herramientas (sin texto):
    // los archivos creados y pasos deben sobrevivir a la recarga.
    if (!aborted && (content || steps.length)) {
      if (!convId) {
        const title = (messages[messages.length - 1].content || 'Conversación').slice(0, 80);
        const c = await one('INSERT INTO conversations (user_id, title, model) VALUES ($1, $2, $3) RETURNING id', [req.user.id, title, model.id]);
        convId = c.id;
      }
      const lastUser = messages[messages.length - 1];
      await q('INSERT INTO messages (conversation_id, role, content, model) VALUES ($1, $2, $3, $4)', [convId, 'user', encryptText(lastUser.content), model.id]);
      await q('INSERT INTO messages (conversation_id, role, content, reasoning, model, tools) VALUES ($1, $2, $3, $4, $5, $6)', [convId, 'assistant', encryptText(content), reasoning ? encryptText(reasoning) : null, model.id, steps.length ? JSON.stringify({ tools, steps }) : null]);
      await q('UPDATE conversations SET updated_at = now(), model = $2 WHERE id = $1', [convId, model.id]);
      await q(
        `INSERT INTO usage_daily (user_id, day, messages) VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET messages = usage_daily.messages + 1`,
        [req.user.id],
      );
    }
    clearInterval(hb);
    send({ type: 'done', conversationId: convId });
    res.end();
  } catch (e) {
    console.error('stream', e);
    clearInterval(hb);
    if (!res.writableEnded) {
      // Mensaje útil según el tipo de fallo en vez de un genérico confuso.
      const msg = String(e?.message || e || '');
      let friendly = 'Error interno del servidor. Inténtalo de nuevo en un momento.';
      if (hasMedia && /internal server error|failed to generate|code.?:.?500|\b500\b/i.test(msg)) {
        friendly = 'El video/imagen no pudo procesarse ahora mismo (el proveedor está inestable). Reintenta en unos momentos.';
      } else if (/model.*(not|does not) (exist|found)|unsupported|invalid model|end of life|\bgone\b|\b410\b/i.test(msg)) {
        friendly = hasMedia
          ? 'El análisis de imágenes y videos no está disponible ahora mismo. Inténtalo sin el archivo o más tarde.'
          : 'El modelo no está disponible ahora mismo. Inténtalo más tarde.';
      } else if (/413|payload|too large|context length|maximum/i.test(msg)) {
        friendly = 'La petición es demasiado grande. Prueba con una imagen más pequeña o un texto más corto.';
      } else if (/rate.?limit|429|quota/i.test(msg)) {
        friendly = 'Límite de uso alcanzado en el proveedor. Espera un minuto y reintenta.';
      } else if (/timeout|timed out|ECONNRESET|ETIMEDOUT/i.test(msg)) {
        friendly = 'El proveedor tardó demasiado en responder. Reintenta.';
      }
      send({ type: 'error', message: friendly });
      res.end();
    }
  }
});

export default router;
