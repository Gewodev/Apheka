import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';

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
  onMedia?: (url: string, fileName: string) => void;
  onError?: (message: string) => void;
  onMoved?: (newPath: string) => void;
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

// Resuelve la ruta local real de un archivo:
// 1) Si la ruta original aún existe → la devuelve.
// 2) Si fue MOVIDO/renombrado → lo busca por nombre en las carpetas gestionadas por la app
//    ($APPDATA/archivos, $APPDATA/temp_files), en Documentos/Descargas/Escritorio/Descargas
//    y en el árbol del directorio padre original (3 niveles, máx. 6000 entradas),
//    devolviendo el archivo más reciente.
// 3) No encontrado → null (fue eliminado o movido fuera de esas carpetas).
export async function resolveLocalPath(originalPath: string, fileName: string): Promise<string | null> {
  try {
    const existing = await statSafe(originalPath);
    if (existing) return originalPath;

    const pathMod = await import('@tauri-apps/api/path');
    const clean = (n: string) => (n || '').replace(/^vw_\d+_/, '').trim();
    const want = clean(fileName || originalPath.split(/[\\/]/).pop() || '').toLowerCase();
    if (!want) return null;

    const roots: string[] = [];
    try {
      const app = await pathMod.appDataDir();
      roots.push(await pathMod.join(app, 'archivos'), await pathMod.join(app, 'temp_files'));
    } catch { /* noop */ }
    // El árbol del directorio padre de la ruta original PRIMERO (el usuario suele mover
    // el archivo a una subcarpeta o a una carpeta hermana de donde estaba — se encuentra
    // al instante sin gastar el límite de archivos escaneando discos enteros).
    try {
      const seg = originalPath.split(/[\\/]/).filter(Boolean);
      if (seg.length > 1) roots.unshift(seg.slice(0, -1).join('/'));
    } catch { /* noop */ }
    try { roots.push(await pathMod.documentDir(), await pathMod.downloadDir(), await pathMod.desktopDir()); } catch { /* noop */ }
    // Carpetas virtuales "Libraries" de Windows (Documentos, Descargas, Imágenes, Música,
    // Vídeos): cubren perfiles con OneDrive o carpetas personalizadas donde documentDir()
    // podría apuntar a la carpeta real pero el usuario movió el archivo a la Librería.
    try {
      const home = await pathMod.homeDir();
      roots.push(home);
      const libs = ['Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
      for (const l of libs) roots.push(await pathMod.join(home, 'Libraries', l));
    } catch { /* noop */ }
    // Raíces de los discos locales NO-sistema (D:\, E:\...): cubre el caso típico
    // "moví el archivo de Descargas al disco D a una carpeta que creé". La C: se
    // omite (ya está cubierta por perfil home/Libraries/árbol padre).
    try {
      for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZ') roots.push(`${L}:/`);
    } catch { /* noop */ }

    const found: { p: string; mtimeMs: number }[] = [];
    const seen = new Set<string>();
    const queue: { dir: string; depth: number }[] = roots.map(d => ({ dir: d, depth: 0 }));
    let scanned = 0;
    const MAX_FILES = 60000;
    const MAX_DIRS = 40000;
    const MAX_DEPTH = 6;
    const TIME_BUDGET_MS = 7000;
    const startedAt = Date.now();
    // Directorios de sistema/caché que nunca contienen archivos del usuario: se podan
    // en la búsqueda por disco para no saturar los límites con Windows/Program Files...
    const SKIP_DIRS = new Set([
      'windows', 'program files', 'program files (x86)', 'programdata', 'recovery',
      '$recycle.bin', 'system volume information', 'perflogs', 'appdata',
      'node_modules', '.git', 'intel', 'msocache',
    ]);
    let visitedDirs = 0;

    while (queue.length && scanned < MAX_FILES && visitedDirs < MAX_DIRS && Date.now() - startedAt < TIME_BUDGET_MS) {
      const { dir, depth } = queue.shift()!;
      const norm = dir.replace(/\\/g, '/').toLowerCase();
      if (seen.has(norm) || depth > MAX_DEPTH) continue;
      seen.add(norm);
      const entries = await readDirSafe(dir);
      if (!entries) continue;
      visitedDirs++;
      for (const en of entries) {
        if (en.isDir) {
          if (depth < MAX_DEPTH && !en.name.startsWith('.') && !SKIP_DIRS.has(en.name.toLowerCase())) {
            queue.push({ dir: await pathMod.join(dir, en.name), depth: depth + 1 });
          }
          continue;
        }
        if (++scanned > MAX_FILES) break;
        if (clean(en.name).toLowerCase() !== want) continue;
        const full = await pathMod.join(dir, en.name);
        const st = await statSafe(full);
        if (st && st.isFile) found.push({ p: full, mtimeMs: st.mtimeMs });
      }
    }

    if (found.length) {
      found.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return found[0].p;
    }
    return null;
  } catch { return null; }
}

export async function openFileSmart(url: string, fileName: string, opts: OpenFileSmartOpts = {}): Promise<void> {
  const { onMedia, onError, onMoved } = opts;
  const fail = (msg: string) => { try { onError?.(msg); } catch { /* noop */ } };

  if (!url) { fail('El archivo no tiene una ruta de apertura'); return; }

  // URL del asset protocol (convertFileSrc) → ruta local real
  const assetMatch = url.match(/^https?:\/\/asset\.localhost\/(.+)$/);
  if (assetMatch) {
    try { url = decodeURIComponent(assetMatch[1]); } catch { url = assetMatch[1]; }
  }

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
    const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext) || (isData && url.startsWith('data:audio'));
    const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext) || (isData && url.startsWith('data:video'));
    const isYouTube = isLink && (url.includes('youtube.com') || url.includes('youtu.be'));
    const inTauri = isTauri();

    // ─── Media: YouTube/video → PiP. El AUDIO abre en el reproductor del sistema ───
    if (onMedia && (isYouTube || isVideo)) {
      let playUrl = url;
      if (inTauri && !isLink) playUrl = convertFileSrc(url);
      onMedia(playUrl, fileName);
      return;
    }

    // ─── Tauri: apertura nativa (app del sistema) ───
    if (inTauri) {
      if (isLink) {
        try { await openUrl(url); return; }
        catch (e) { if (openInNewTab(url)) return; fail('No se pudo abrir el enlace en el navegador' + tauriOpenHint(e, false)); return; }
      }
      if (isLocal) {
        // 1) PRIMERO abrir directo la ruta guardada (patrón WhatsApp/Claude: abrir ya).
        //    openPath solo necesita el permiso opener y falla ÚNICAMENTE si el archivo
        //    no existe o Windows lo rechaza — nunca concluye "movido" por stat/scope.
        try { await openPath(url); return; }
        catch { /* el archivo no está en esa ruta → seguir */ }
        // 2) Si falló → quizá fue MOVIDO/renombrado → búsqueda por nombre.
        const resolved = await resolveLocalPath(url, fileName);
        if (resolved) {
          try {
            await openPath(resolved);
            // Aviso "chip" con la NUEVA ubicación del archivo movido.
            try { onMoved?.(resolved); } catch { /* noop */ }
            return;
          } catch { /* sigue */ }
        }
        // 3) Fallback webview "file://" (como en la web): PDF e imágenes se muestran
        //    dentro de la app vía asset protocol, aunque el sistema no los asocie.
        if (isPdf || isImg) {
          try {
            const assetUrl = convertFileSrc(url);
            if (openInNewTab(assetUrl)) return;
          } catch { /* sigue */ }
        }
        fail('No se pudo abrir el archivo. Si lo moviste de carpeta, vuelve a subirlo.');
        return;
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
