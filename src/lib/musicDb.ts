import type { Track } from '../store/AppContext';
import { readFile, writeFile, mkdir, exists, remove, copyFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

// --- Nombres de archivo legibles: "Artista - Título.ext" ---
// Sin caracteres prohibidos en Windows, sin puntos/espacios al final,
// longitud acotada y primera letra en mayúscula (el resto se respeta tal cual
// para no romper nombres como AC/DC o will.i.am).

export function sanitizeFileName(s: string): string {
  const clean = String(s || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return clean;
}

const MINOR_WORDS_ES = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'u', 'en', 'con', 'por',
  'para', 'sin', 'sobre', 'entre', 'del', 'al', 'un', 'una', 'unos', 'unas',
  'lo', 'le', 'les', 'se', 'su', 'sus', 'mi', 'tu', 'que', 'como', 'más', 'mas',
]);

// Mayúsculas tipo título en español: primera letra de cada palabra en
// mayúscula salvo artículos/preposiciones/conjunciones (que van en minúscula
// excepto al inicio o tras signo). SOLO se aplica si el texto viene TODO en
// mayúsculas o TODO en minúsculas; si ya mezcla (AC/DC, Dj Tiësto, will.i.am),
// se respeta tal cual.
export function toTitleCaseEs(s: string): string {
  const clean = String(s || '').replace(/\s+/g, ' ').trim();
  if (!clean) return clean;
  const letters = clean.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (!letters) return clean;
  const hasUpper = /[A-ZÁÉÍÓÚÜÑ]/.test(letters);
  const hasLower = /[a-záéíóúüñ]/.test(letters);
  if (hasUpper && hasLower) return clean;
  const lower = clean.toLowerCase();
  const parts = lower.split(' ');
  return parts
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && MINOR_WORDS_ES.has(w) && !/[¿¡("'.…!?:\-]$/.test(parts[i - 1])) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

// Tildes que se pueden restaurar con seguridad: la forma sin tilde casi
// nunca es correcta en títulos/nombres (se excluyen ambiguas como
// esta/solo/papa/tu/mi/si/para/como/martin/torres/etc.).
const ACCENT_DICT: Record<string, string> = {
  cancion: 'canci\u00F3n', corazon: 'coraz\u00F3n', adios: 'adi\u00F3s',
  limon: 'lim\u00F3n', frances: 'franc\u00E9s', avion: 'avi\u00F3n',
  arbol: '\u00E1rbol', angel: '\u00E1ngel', pasion: 'pasi\u00F3n',
  ilusion: 'ilusi\u00F3n', musica: 'm\u00FAsica', camara: 'c\u00E1mara',
  telefono: 'tel\u00E9fono', lapiz: 'l\u00E1piz', album: '\u00E1lbum',
  heroe: 'h\u00E9roe', dia: 'd\u00EDa', mia: 'm\u00EDa', tio: 't\u00EDo',
  rio: 'r\u00EDo', duo: 'd\u00FAo', facil: 'f\u00E1cil', dificil: 'dif\u00EDcil',
  mas: 'm\u00E1s', atras: 'atr\u00E1s', despues: 'despu\u00E9s',
  tambien: 'tambi\u00E9n', jamas: 'jam\u00E1s', ademas: 'adem\u00E1s',
  exito: '\u00E9xito', exitos: '\u00E9xitos', ultimo: '\u00FAltimo',
  ultimos: '\u00FAltimos', proximo: 'pr\u00F3ximo',
  jose: 'Jos\u00E9', maria: 'Mar\u00EDa', jesus: 'Jes\u00FAs',
  ramon: 'Ram\u00F3n', ruben: 'Rub\u00E9n', nino: 'Ni\u00F1o',
  suarez: 'Su\u00E1rez', lopez: 'L\u00F3pez', perez: 'P\u00E9rez',
  garcia: 'Garc\u00EDa', sanchez: 'S\u00E1nchez', diaz: 'D\u00EDaz',
  gomez: 'G\u00F3mez', hernandez: 'Hern\u00E1ndez', alvarez: '\u00C1lvarez',
  rodriguez: 'Rodr\u00EDguez', fernandez: 'Fern\u00E1ndez',
  jimenez: 'Jim\u00E9nez', nunez: 'N\u00FA\u00F1ez', ibanez: 'Ib\u00E1\u00F1ez',
  ramirez: 'Ram\u00EDrez', gonzalez: 'Gonz\u00E1lez', cardenas: 'C\u00E1rdenas',
  roman: 'Rom\u00E1n', simon: 'Sim\u00F3n', tomas: 'Tom\u00E1s',
  nicolas: 'Nicol\u00E1s', andres: 'Andr\u00E9s', sebastian: 'Sebasti\u00E1n',
  victor: 'V\u00EDctor', oscar: '\u00D3scar', cesar: 'C\u00E9sar',
  hector: 'H\u00E9ctor', adrian: 'Adri\u00E1n', ivan: 'Iv\u00E1n',
  raul: 'Ra\u00FAl', saul: 'Sa\u00FAl',
};

// Restaura tildes palabra por palabra (solo ASCII puro sin diacríticos;
// si la palabra ya trae tildes u otro formato intencional, se respeta).
export function restoreAccents(s: string): string {
  return String(s || '').split(/(\s+)/).map(tok => {
    if (/^\s*$/.test(tok)) return tok;
    const m = tok.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
    if (!m) return tok;
    const [, pre, core, post] = m;
    if (/[^\x00-\x7F]/.test(core)) return tok;
    const hit = ACCENT_DICT[core.toLowerCase()];
    if (!hit) return tok;
    if (core === core.toUpperCase() && core.length > 1) return pre + hit.toUpperCase() + post;
    if (core === core.toLowerCase()) return pre + hit.toLowerCase() + post;
    return pre + hit + post;
  }).join('');
}

export function toDisplayName(s: string): string {
  return restoreAccents(toTitleCaseEs(s));
}

// Devuelve un nombre único dentro de `taken` (agrega " (2)", " (3)"... si choca).
export function buildAudioFileName(artist: string, title: string, ext: string, taken?: Set<string>): string {
  const a = sanitizeFileName(artist) || 'Desconocido';
  const t = sanitizeFileName(title) || 'Sin título';
  const e = (ext || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
  let base = `${a} - ${t}`.slice(0, 100);
  let name = `${base}.${e}`;
  if (taken) {
    let n = 2;
    const lower = new Set([...taken].map(x => x.toLowerCase()));
    while (lower.has(name.toLowerCase())) {
      const suff = ` (${n++})`;
      name = `${base.slice(0, 100 - suff.length - e.length - 1)}${suff}.${e}`;
    }
    taken.add(name);
  }
  return name;
}

const DB_NAME = 'OwaMusicDB';
const METADATA_STORE_NAME = 'tracks_metadata';
const FILES_STORE_NAME = 'tracks_files';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;

      if (!dbInstance.objectStoreNames.contains(METADATA_STORE_NAME)) {
        dbInstance.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
      }

      if (!dbInstance.objectStoreNames.contains(FILES_STORE_NAME)) {
        dbInstance.createObjectStore(FILES_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// --- METADATA OPERATIONS (exact AETHER pattern) ---

export async function saveTrackMetadata(track: Track): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.put(track);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(`Error saving metadata for track ${track.id}: ${request.error}`);
  });
}

export async function getAllTracksMetadata(): Promise<Track[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(METADATA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject('Error fetching all track metadata: ' + request.error);
  });
}

export async function deleteTrackMetadata(id: string): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error deleting track metadata: ' + request.error);
  });
}

export async function clearAllTracksMetadata(): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error clearing track metadata: ' + request.error);
  });
}

// --- FILE OPERATIONS (exact AETHER pattern) ---

export async function addTrackFileToDB(id: string, file: File): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FILES_STORE_NAME);
    const request = store.put({ id, file });

    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error adding track file to DB: ' + request.error);
  });
}

export async function getTrackFileFromDB(id: string): Promise<File | undefined> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FILES_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.file);
      } else {
        resolve(undefined);
      }
    };
    request.onerror = () => reject('Error fetching track file from DB: ' + request.error);
  });
}

export async function deleteTrackFileFromDB(id: string): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FILES_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error deleting track file from DB: ' + request.error);
  });
}

export async function clearAllTrackFiles(): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FILES_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error clearing track files: ' + request.error);
  });
}

// --- LEGACY: keep saveAllTracks/loadAllTracks for backward compat with the debounced save ---
// These will no longer be used for primary persistence but keep for migration

const MUSIC_TRACKS_KEY = 'owa_music_tracks';

export async function saveAllTracks(tracks: Track[]): Promise<void> {
  const { set } = await import('idb-keyval');
  await set(MUSIC_TRACKS_KEY, JSON.stringify(tracks));
}

export async function loadAllTracks(): Promise<Track[]> {
  const { get } = await import('idb-keyval');
  const raw = await get(MUSIC_TRACKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Track[];
  } catch {
    return [];
  }
}

// --- AETHER PATTERN: Store audio files in IndexedDB for reliable playback ---

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
  ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
  wma: 'audio/x-ms-wma', opus: 'audio/opus', mp4: 'audio/mp4',
  aiff: 'audio/aiff', ape: 'audio/ape',
};

export async function storeTrackFileInDB(id: string, filePath: string, preloadedData?: Uint8Array): Promise<void> {
  const data = preloadedData || await readFile(filePath);
  const ext = (filePath.split('.').pop() || 'mp3').toLowerCase();
  const mime = MIME_MAP[ext] || 'audio/mpeg';
  const fileName = filePath.split(/[/\\]/).pop() || `${id}.${ext}`;
  const blob = new Blob([data], { type: mime });
  const file = new File([blob], fileName, { type: mime });
  await addTrackFileToDB(id, file);
}

// --- FILESYSTEM OPS (keep for export/import) ---

export async function getMusicDir(): Promise<string> {
  return await join(await appDataDir(), 'music');
}

export async function ensureMusicDir(): Promise<string> {
  const dir = await getMusicDir();
  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function copyAudioToStorage(sourcePath: string, trackId: string, preloadedData?: Uint8Array, fileName?: string): Promise<string> {
  const musicDir = await ensureMusicDir();
  const ext = (sourcePath.split('.').pop() || 'mp3').toLowerCase();
  const destPath = await join(musicDir, fileName || `${trackId}.${ext}`);
  const data = preloadedData || await readFile(sourcePath);
  await writeFile(destPath, data);
  return destPath;
}

// Renombra dentro de la carpeta propia (copy+delete: no requiere permiso rename).
// Devuelve la ruta nueva o lanza si falla (el llamador conserva la anterior).
export async function renameAudioInStorage(oldFileName: string, newFileName: string): Promise<string> {
  if (!oldFileName || !newFileName || oldFileName === newFileName) {
    throw new Error('Nada que renombrar');
  }
  const musicDir = await getMusicDir();
  const oldPath = await join(musicDir, oldFileName);
  const newPath = await join(musicDir, newFileName);
  if (!(await exists(oldPath))) throw new Error('El archivo original ya no existe');
  if (await exists(newPath)) throw new Error('Ya existe un archivo con ese nombre');
  await copyFile(oldPath, newPath);
  await remove(oldPath).catch(() => {});
  return newPath;
}

export async function removeAudioFromStorage(trackId: string, fileName?: string): Promise<void> {
  const musicDir = await getMusicDir();
  if (fileName) {
    try {
      const p = await join(musicDir, fileName);
      if (await exists(p)) await remove(p);
      return;
    } catch { /* cae al modo legacy */ }
  }
  const exts = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'opus', 'mp4'];
  for (const ext of exts) {
    const p = await join(musicDir, `${trackId}.${ext}`);
    try {
      const fileExists = await exists(p);
      if (fileExists) {
        await remove(p);
        return;
      }
    } catch { /* try next extension */ }
  }
}

export async function clearAllAudioFiles(): Promise<number> {
  const musicDir = await getMusicDir();
  const dirExists = await exists(musicDir);
  if (!dirExists) return 0;
  const exts = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'opus', 'mp4'];
  let count = 0;
  for (const ext of exts) {
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(musicDir);
      for (const entry of entries) {
        if (entry.isFile) {
          const fullPath = await join(musicDir, entry.name);
          try {
            await remove(fullPath);
            count++;
          } catch { /* skip */ }
        }
      }
      return count;
    } catch { /* try readDir */ }
  }
  return count;
}

export async function exportMusicLibrary(tracks: Track[], destDir: string): Promise<number> {
  await ensureMusicDir();
  const metadata = JSON.stringify({ tracks, exportedAt: new Date().toISOString() }, null, 2);
  const metadataPath = await join(destDir, 'owa_music_metadata.json');
  await writeFile(metadataPath, new TextEncoder().encode(metadata));

  let exportedCount = 0;
  for (const track of tracks) {
    if (track.source !== 'local') continue;
    let srcPath = track.url;
    if (!srcPath) continue;
    let localSrcPath = srcPath;
    try {
      const { exists: fileExists } = await import('@tauri-apps/plugin-fs');
      if (!(await fileExists(localSrcPath))) {
        const musicDir = await getMusicDir();
        const ext = (srcPath.split('.').pop() || 'mp3').toLowerCase();
        const maybeLocal = await join(musicDir, `${track.id}.${ext}`);
        if (await fileExists(maybeLocal)) {
          localSrcPath = maybeLocal;
        } else {
          continue;
        }
      }
      const data = await readFile(localSrcPath);
      const fileName = `${track.id}.${(localSrcPath.split('.').pop() || 'mp3').toLowerCase()}`;
      const destFile = await join(destDir, fileName);
      await writeFile(destFile, data);
      exportedCount++;
    } catch { /* skip this track */ }
  }
  return exportedCount;
}

export async function importMusicLibrary(destDir: string): Promise<{ tracks: Track[]; imported: number }> {
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
  const metadataPath = await join(destDir, 'owa_music_metadata.json');
  const metaExists = await exists(metadataPath);
  if (!metaExists) {
    throw new Error('No se encontró owa_music_metadata.json en la carpeta seleccionada');
  }
  const metaJson = await readTextFile(metadataPath);
  const { tracks: importedTracks } = JSON.parse(metaJson) as { tracks: Track[]; exportedAt: string };

  const musicDir = await ensureMusicDir();
  let imported = 0;
  for (const track of importedTracks) {
    if (track.source !== 'local') continue;
    const ext = ((track.url || '').split('.').pop() || 'mp3').toLowerCase();
    const srcFile = await join(destDir, `${track.id}.${ext}`);
    const srcExists = await exists(srcFile);
    if (!srcExists) continue;
    const destPath = await join(musicDir, `${track.id}.${ext}`);
    const data = await readFile(srcFile);
    await writeFile(destPath, data);
    track.url = destPath;
    imported++;
  }
  return { tracks: importedTracks, imported };
}
