import { localPathFromUrl } from './externalTarget';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { isTauri } from '@tauri-apps/api/core';

async function saveDataUrlToTempFile(dataUrl: string, fileName: string): Promise<string | null> {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mime = (parts[0].match(/data:([^;]+)/)?.[1]) || 'application/octet-stream';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

    const pathMod = await import('@tauri-apps/api/path');
    const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
    const appDataDirPath = await pathMod.appDataDir();
    const tempDir = await pathMod.join(appDataDirPath, 'temp_files');
    if (!await exists(tempDir)) await mkdir(tempDir, { recursive: true });
    const safeName = (fileName || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_') || 'archivo';
    const filePath = await pathMod.join(tempDir, `vw_${Date.now()}_${safeName}`);
    await writeFile(filePath, new Uint8Array(ab));
    return filePath;
  } catch { return null; }
}

// Selecciona UN archivo con UN SOLO diálogo nativo (Tauri) y devuelve SU RUTA ORIGINAL,
// sin copiar nada: los cambios que el usuario guarde (Word, Excel, etc.) quedan en su archivo.
// Devuelve { path: ruta original, name } o null si el usuario CANCELÓ.
// Si el diálogo FALLA de verdad (plugin/permiso/binario viejo) LANZA excepción — el caller
// debe mostrar el error ("No se pudo abrir el selector de archivos") para no fallar en silencio.
// En web devuelve null — el caller debe usar su <input type="file"> (FileReader → dataURL).
export async function pickAndPersistFile(): Promise<{ path: string; name: string } | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ multiple: false });
  const p = Array.isArray(picked) ? picked[0] : picked;
  if (typeof p !== 'string') return null;
  return { path: p, name: p.split(/[\\/]/).pop() || 'archivo' };
}

async function blobToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob(); });
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(new Error('read failed'));
      fr.onloadend = () => { if (!fr.result) rej(new Error('no result')); };
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

function dataUrlToBlobUrl(dataUrl: string): string {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return dataUrl;
    const mime = (parts[0].match(/^data:([^;]+)/)?.[1]) || 'application/octet-stream';
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch { return dataUrl; }
}

function openInNewTab(url: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    try { window.open(url, '_blank'); return true; } catch { return false; }
  }
}

// Descarga un dataURL con el download nativo de la webview (NO requiere permisos fs):
// la webview descarga el archivo a la carpeta de descargas del sistema. Si falla,
// lo abre en una pestaña nueva como blob URL.
function downloadDataUrl(dataUrl: string, fileName: string): boolean {
  try {
    const blobUrl = dataUrlToBlobUrl(dataUrl);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'archivo';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return openInNewTab(dataUrlToBlobUrl(dataUrl));
  }
}

export interface OpenFileSmartOpts {
  onError?: (message: string) => void;
  onMoved?: (newPath: string) => void;
  onResolving?: () => void;
  onResolvingDone?: () => void;
}

function tauriOpenHint(e: unknown, fileExists: boolean): string {
  if (fileExists) return ' (¿binario desactualizado? cierra la app y ábrela con "pnpm tauri dev")';
  const msg = e instanceof Error ? e.message : String(e);
  if (/not a function|plugin|opener|invoke|__TAURI__|Cannot read|not allowed|Forbidden|scope|denied|rejected/i.test(msg)) {
    return ' (¿binario desactualizado? cierra la app y ábrela con "pnpm tauri dev")';
  }
  if (/No such file|ENOENT|not found|no existe/i.test(msg)) {
    return ' (el archivo ya no existe en esa ruta)';
  }
  return '';
}

async function statSafe(p: string): Promise<{ isFile: boolean; mtimeMs: number } | null> {
  try {
    const { stat } = await import('@tauri-apps/plugin-fs');
    const s = await stat(p);
    if (!s || s.isFile === false) return null;
    const raw = s.mtime as unknown;
    const mtimeMs = typeof raw === 'number' ? raw : raw ? Date.parse(String(raw)) : 0;
    return { isFile: true, mtimeMs: Number.isFinite(mtimeMs) ? mtimeMs : 0 };
  } catch { return null; }
}

async function readDirSafe(dir: string): Promise<{ name: string; isDir: boolean }[] | null> {
  try {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(dir);
    return entries.map(e => ({
      name: e.name,
      isDir: e.isDirectory === true || (e as any).isDir === true,
    }));
  } catch { return null; }
}

// ─── Caché de rutas resueltas ─────────────────────────────────────────────
// Cuando la búsqueda (o el diálogo de re-localización) encuentra un archivo movido,
// recordamos `nombre → ruta` en localStorage. La siguiente apertura del MISMO archivo
// se resuelve con UN solo `stat` (sin escanear discos): el segundo click es instantáneo.
const PATH_CACHE_KEY = 'owa_path_cache_v1';
const PATH_CACHE_MAX = 300;

function loadPathCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(PATH_CACHE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(obj)) {
      if (k && typeof v === 'string' && v) m.set(k, v);
    }
    return m;
  } catch { return new Map(); }
}

function rememberPath(rawName: string, path: string) {
  try {
    const key = (rawName || '').replace(/^vw_\d+_/, '').trim().toLowerCase();
    if (!key || !path) return;
    const m = loadPathCache();
    m.set(key, path);
    while (m.size > PATH_CACHE_MAX) {
      const first = m.keys().next().value;
      if (first === undefined) break;
      m.delete(first);
    }
    localStorage.setItem(PATH_CACHE_KEY, JSON.stringify(Object.fromEntries(m)));
  } catch { /* noop */ }
}

// Resuelve la ruta local real de un archivo, POR ETAPAS EN ORDEN DE PROBABILIDAD:
// 1) Si la ruta original aún existe → la devuelve (sin escanear nada).
// 2) Caché de rutas ya resueltas → 1 solo stat (segundo click instantáneo).
// 3) Búsqueda por nombre en etapas priorizadas, DETENIÉNDOSE EN CUANTO ENCUENTRA:
//    árbol padre de la ruta original → carpetas de la app → Documentos/Descargas/
//    Escritorio → home + Libraries → discos D:-Z:. Cada etapa devuelve el archivo
//    más reciente de esa etapa; si la etapa padre encuentra el archivo, los discos
//    NO se escanean (el caso típico resuelve en milisegundos con pocos readDir).
// 4) No encontrado → null (eliminado o movido fuera de esas carpetas).
export async function resolveLocalPath(originalPath: string, fileName: string): Promise<string | null> {
  try {
    const existing = await statSafe(originalPath);
    if (existing) return originalPath;

    const pathMod = await import('@tauri-apps/api/path');
    const clean = (n: string) => (n || '').replace(/^vw_\d+_/, '').trim();
    const want = clean(fileName || originalPath.split(/[\\/]/).pop() || '').toLowerCase();
    if (!want) return null;

    // Etapa 2: caché de rutas resueltas (aperturas previas) — 1 solo stat, sin escanear.
    const cached = loadPathCache().get(want);
    if (cached) {
      const st = await statSafe(cached);
      if (st && st.isFile) { rememberPath(fileName || originalPath, cached); return cached; }
    }

    // Etapas de búsqueda en orden de probabilidad. La primera que encuentre un
    // archivo con el nombre buscado GANA y la búsqueda se detiene ahí.
    const roots: string[] = [];
    // 3a) El árbol del directorio padre de la ruta original PRIMERO (el usuario suele
    //     mover el archivo a una subcarpeta o a una carpeta hermana de donde estaba —
    //     se encuentra al instante, con pocos readDir y SIN tocar los discos).
    try {
      const seg = originalPath.split(/[\\/]/).filter(Boolean);
      if (seg.length > 1) roots.push(seg.slice(0, -1).join('/'));
    } catch { /* noop */ }
    // 3b) Carpetas gestionadas por la app.
    try {
      const app = await pathMod.appDataDir();
      roots.push(await pathMod.join(app, 'archivos'), await pathMod.join(app, 'temp_files'));
    } catch { /* noop */ }
    // 3c) Carpetas de usuario estándar.
    try { roots.push(await pathMod.documentDir(), await pathMod.downloadDir(), await pathMod.desktopDir()); } catch { /* noop */ }
    // 3d) home completo + carpetas virtuales "Libraries" de Windows (Documentos,
    //     Descargas, Imágenes, Música, Vídeos): cubre perfiles con OneDrive o
    //     carpetas personalizadas.
    try {
      const home = await pathMod.homeDir();
      roots.push(home);
      const libs = ['Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
      for (const l of libs) roots.push(await pathMod.join(home, 'Libraries', l));
    } catch { /* noop */ }
    // 3e) Raíces de los discos locales NO-sistema (D:\, E:\...): ÚLTIMO recurso —
    //     solo se alcanzan si ninguna etapa anterior encontró el archivo.
    try {
      for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZ') roots.push(`${L}:/`);
    } catch { /* noop */ }

    const MAX_DIRS = 8000;
    const MAX_DEPTH = 5;
    const MAX_FILES_PER_DIR = 20000;
    const TIME_BUDGET_MS = 2500;
    const startedAt = Date.now();
    // Directorios de sistema/caché que nunca contienen archivos del usuario: se podan
    // en la búsqueda por disco para no saturar los límites con Windows/Program Files...
    const SKIP_DIRS = new Set([
      'windows', 'program files', 'program files (x86)', 'programdata', 'recovery',
      '$recycle.bin', 'system volume information', 'perflogs', 'appdata', 'windows.old',
      '$windows.~bt', '$windows.~ws', 'node_modules', '.git', 'intel', 'msocache',
      'temp', 'tmp', '.cache', 'cookies', 'datareader', 'logs', 'common files',
    ]);

    for (const root of roots) {
      const found: { p: string; mtimeMs: number }[] = [];
      const seen = new Set<string>();
      const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
      let visitedDirs = 0;
      while (queue.length && visitedDirs < MAX_DIRS && Date.now() - startedAt < TIME_BUDGET_MS) {
        const { dir, depth } = queue.shift()!;
        const norm = dir.replace(/\\/g, '/').toLowerCase();
        if (seen.has(norm) || depth > MAX_DEPTH) continue;
        seen.add(norm);
        const entries = await readDirSafe(dir);
        if (!entries) continue;
        visitedDirs++;
        let scanned = 0;
        for (const en of entries) {
          if (en.isDir) {
            if (depth < MAX_DEPTH && !en.name.startsWith('.') && !SKIP_DIRS.has(en.name.toLowerCase())) {
              queue.push({ dir: await pathMod.join(dir, en.name), depth: depth + 1 });
            }
            continue;
          }
          if (++scanned > MAX_FILES_PER_DIR) break;
          if (clean(en.name).toLowerCase() !== want) continue;
          const full = await pathMod.join(dir, en.name);
          const st = await statSafe(full);
          if (st && st.isFile) found.push({ p: full, mtimeMs: st.mtimeMs });
        }
      }
      if (found.length) {
        found.sort((a, b) => b.mtimeMs - a.mtimeMs);
        const best = found[0].p;
        rememberPath(fileName || originalPath, best);
        return best;
      }
      // Si una etapa se comió el presupuesto de tiempo, no seguir escaneando discos.
      if (Date.now() - startedAt >= TIME_BUDGET_MS) break;
    }
    return null;
  } catch { return null; }
}

export async function openFileSmart(url: string, fileName: string, opts: OpenFileSmartOpts = {}): Promise<void> {
  const { onError, onMoved, onResolving, onResolvingDone } = opts;
  const fail = (msg: string) => { try { onError?.(msg); } catch { /* noop */ } };

  if (!url) { fail('El archivo no tiene una ruta de apertura'); return; }

  // Recover persisted legacy/file URLs before native opening.
  try { url = localPathFromUrl(url) || url; } catch { fail('La ruta del archivo está dañada.'); return; }

  // blob: (archivos guardados en sesiones anteriores) → rescate a dataURL y redespacho
  if (url.startsWith('blob:')) {
    const data = await blobToDataUrl(url);
    if (!data) {
      fail('El archivo ya no está disponible (fue creado en una sesión anterior)');
      return;
    }
    return openFileSmart(data, fileName, opts);
  }

  try {
    const isData = url.startsWith('data:');
    const isLink = /^https?:\/\//i.test(url);
    const isLocal = !isData && !isLink;
    const ext = (fileName || url).split('.').pop()?.toLowerCase() || '';
    const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || (isData && url.startsWith('data:image'));
    const isPdf = ext === 'pdf';
    const inTauri = isTauri();

    // Media attachments use the native application or browser, without a persistent overlay.
    // ─── Tauri: apertura nativa (app del sistema) ───
    if (inTauri) {
      if (isLink) {
        try { await openUrl(url); return; }
        catch (e) { if (openInNewTab(url)) return; fail('No se pudo abrir el enlace en el navegador' + tauriOpenHint(e, false)); return; }
      }
      if (isLocal) {
        // 1) PRIMERO verificar si el archivo EXISTE antes de pedirle a Windows que lo abra.
        //    Si llamamos openPath sobre una ruta inexistente, el sistema lanza el diálogo
        //    nativo "Windows no puede encontrar el archivo..." ANTES de que podamos actuar.
        const stats = await statSafe(url);
        if (stats && stats.isFile) {
          try { await openPath(url); return; }
          catch { /* archivo válido pero openPath rechazado por Windows/scope → buscarlo */ }
        }
        // 2) El archivo NO existe en la ruta guardada → fue MOVIDO/renombrado → búsqueda por nombre.
        onResolving?.();
        try {
          const resolved = await resolveLocalPath(url, fileName);
          if (resolved) {
            try {
              await openPath(resolved);
              try { onMoved?.(resolved); } catch { /* noop */ }
              return;
            } catch { /* sigue */ }
          }
          // 4) Último recurso: abrir el diálogo nativo de selección de archivo — el usuario
          //    elige la NUEVA ubicación y la app la guarda (onMoved) para abrir directo la próxima vez.
          //    Es 100% confiable (sin colgadas ni búsqueda Ciega por todo el disco).
          try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const picked = await open({ multiple: false, title: `Re-localizar archivo: ${fileName || url.split(/[\\/]/).pop() || ''}` });
            if (typeof picked === 'string' && picked) {
              try { await openPath(picked); rememberPath(fileName || url, picked); onMoved?.(picked); return; }
              catch { /* sigue */ }
            }
          } catch { /* diálogo cancelado o no disponible */ }
          fail(resolved
            ? 'El archivo se encontró pero no pudo abrirse. Si lo moviste, vuelve a subirlo desde su nueva ubicación.'
            : 'No se encontró el archivo en su ubicación original. Se abrió un diálogo para que lo selecciones manualmente.');
          return;
        } finally {
          onResolvingDone?.();
        }
      }
      // data: → archivo temporal + abrir nativo; si no se puede escribir (binario viejo
      // sin scope fs), descarga directa desde la webview: funciona SIEMPRE sin permisos.
      const tmp = await saveDataUrlToTempFile(url, fileName);
      if (tmp) {
        try { await openPath(tmp); return; }
        catch (e) { fail('No se pudo abrir el archivo con su aplicación' + tauriOpenHint(e, true)); return; }
      }
      if (downloadDataUrl(url, fileName)) return;
      fail('No se pudo preparar el archivo para abrirlo. ¿Binario desactualizado? Cierra la app y ábrela con "pnpm tauri dev".');
      return;
    }

    // ─── Web: enlaces → pestaña nueva; data: → blob URL + pestaña (los data: crudos se bloquean) ───
    if (isLink) {
      if (openInNewTab(url)) return;
      fail('No se pudo abrir el enlace en el navegador');
      return;
    }
    if (!isData) {
      fail('Este archivo es local y solo se abre desde la app instalada (ejecuta "pnpm tauri dev").');
      return;
    }
    const webUrl = dataUrlToBlobUrl(url);
    if (openInNewTab(webUrl)) return;
    fail('No se pudo abrir el archivo');
  } catch {
    fail('No se pudo abrir el material');
  }
}

/** Resolve a real disk file for an external browser/PDF viewer, preserving moved-file recovery. */
export async function resolveExternalResource(url: string, fileName: string, onMoved?: (path: string) => void): Promise<string> {
  const local = localPathFromUrl(url);
  if (local) {
    if (await statSafe(local)) return local;
    const resolved = await resolveLocalPath(local, fileName);
    if (!resolved) throw new Error('No se encontró el archivo en su ubicación guardada. Vuelve a seleccionarlo desde el curso.');
    onMoved?.(resolved);
    return resolved;
  }
  if (/^https?:\/\//i.test(url)) return url;
  const data = url.startsWith('blob:') ? await blobToDataUrl(url) : url;
  if (!data?.startsWith('data:')) throw new Error('El recurso no tiene una ruta válida.');
  const saved = await saveDataUrlToTempFile(data, fileName);
  if (!saved) throw new Error('No se pudo preparar el archivo para abrirlo.');
  return saved;
}
