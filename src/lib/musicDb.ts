import type { Track } from '../store/AppContext';
import { readFile, writeFile, mkdir, exists, remove } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

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

export async function copyAudioToStorage(sourcePath: string, trackId: string, preloadedData?: Uint8Array): Promise<string> {
  const musicDir = await ensureMusicDir();
  const ext = (sourcePath.split('.').pop() || 'mp3').toLowerCase();
  const destPath = await join(musicDir, `${trackId}.${ext}`);
  const data = preloadedData || await readFile(sourcePath);
  await writeFile(destPath, data);
  return destPath;
}

export async function removeAudioFromStorage(trackId: string): Promise<void> {
  const musicDir = await getMusicDir();
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
