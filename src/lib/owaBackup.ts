import { get, set } from 'idb-keyval';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { isTauri } from './tauri';
import { getAllTracksMetadata, saveTrackMetadata } from './musicDb';
import type { Track } from '../store/AppContext';

const STATE_KEY = 'owa_studio_data';
const SECRET_RE = /token|secret|credential|google|supabase/i;

export interface OwaBackupFile {
  format: 'owa-studio-backup';
  version: 1;
  exportedAt: string;
  appVersion: string;
  localStorage: Record<string, string>;
  idb: { key: string; value: unknown } | null;
  // Biblioteca de música completa (metadatos + portadas + nombres personalizados).
  // Los audios viven en la carpeta de música (misma PC); al restaurar en otra
  // PC usa "Limpiar faltantes" y vuelve a añadir los archivos.
  musicTracks: Track[] | null;
}

export interface BackupResult {
  ok: boolean;
  message: string;
  path?: string;
}

function lsEntries(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith('owa_')) continue;
    if (SECRET_RE.test(k)) continue;
    out[k] = localStorage.getItem(k) || '';
  }
  return out;
}

export async function collectBackup(): Promise<OwaBackupFile> {
  let idbValue: unknown = null;
  try {
    idbValue = await get(STATE_KEY);
  } catch { /* noop */ }
  let musicTracks: Track[] | null = null;
  try {
    const all = await getAllTracksMetadata();
    if (Array.isArray(all) && all.length > 0) musicTracks = all;
  } catch { /* sin biblioteca */ }
  return {
    format: 'owa-studio-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '6.7',
    localStorage: lsEntries(),
    idb: idbValue !== null && idbValue !== undefined ? { key: STATE_KEY, value: idbValue } : null,
    musicTracks,
  };
}

export async function exportOwaBackup(): Promise<BackupResult> {
  const backup = await collectBackup();
  const json = JSON.stringify(backup);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const fileName = `owa-respaldo-${stamp}.json`;
  if (isTauri()) {
    try {
      const dest = await save({
        defaultPath: fileName,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!dest) return { ok: false, message: 'Exportación cancelada' };
      await writeTextFile(dest, json);
      return { ok: true, message: `Respaldo guardado (${Math.round(json.length / 1024)} KB)`, path: dest };
    } catch (e: any) {
      return { ok: false, message: `No se pudo guardar el respaldo: ${e?.message || e}` };
    }
  }
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { ok: true, message: `Respaldo descargado (${Math.round(json.length / 1024)} KB)` };
}

export async function applyBackup(backup: OwaBackupFile): Promise<{ ok: boolean; message: string }> {
  if (!backup || backup.format !== 'owa-studio-backup') {
    return { ok: false, message: 'El archivo no es un respaldo válido de Owa Studio' };
  }
  const ls = backup.localStorage || {};
  for (const [k, v] of Object.entries(ls)) {
    try { localStorage.setItem(k, v); } catch { /* skip oversized */ }
  }
  if (backup.idb) {
    try { await set(backup.idb.key, backup.idb.value); } catch { /* noop */ }
  }
  // Música: fusiona por ID (no duplica, no borra lo nuevo). Respaldos viejos
  // sin musicTracks se saltan este paso sin errores.
  let musicAdded = 0;
  if (Array.isArray(backup.musicTracks) && backup.musicTracks.length > 0) {
    try {
      const current = await getAllTracksMetadata().catch(() => [] as Track[]);
      const currentIds = new Set((current || []).map(t => t.id));
      for (const t of backup.musicTracks) {
        if (!t || typeof t !== 'object' || !t.id || currentIds.has(t.id)) continue;
        await saveTrackMetadata(t as Track).catch(() => {});
        currentIds.add(t.id);
        musicAdded++;
      }
    } catch { /* noop */ }
  }
  if (isTauri()) {
    try {
      const diskPath = await join(await appDataDir(), 'owa_studio_data.json');
      const rawState = ls[STATE_KEY] || (backup.idb ? JSON.stringify(backup.idb.value) : '');
      if (rawState) await writeTextFile(diskPath, rawState);
    } catch { /* noop */ }
  }
  return { ok: true, message: musicAdded > 0 ? `Datos restaurados (${musicAdded} ${musicAdded === 1 ? 'canción recuperada' : 'canciones recuperadas'}). La app se recargará...` : 'Datos restaurados. La app se recargará...' };
}

export async function pickAndImportOwaBackup(): Promise<BackupResult> {
  if (!isTauri()) return { ok: false, message: 'Usa el selector de archivos del navegador' };
  try {
    const picked = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!picked || Array.isArray(picked)) return { ok: false, message: 'Importación cancelada' };
    const raw = await readTextFile(picked);
    const backup = JSON.parse(raw) as OwaBackupFile;
    const res = await applyBackup(backup);
    return { ok: res.ok, message: res.message, path: picked };
  } catch (e: any) {
    return { ok: false, message: `No se pudo importar el respaldo: ${e?.message || e}` };
  }
}

export async function importOwaBackupFromFile(file: File): Promise<BackupResult> {
  try {
    const raw = await file.text();
    const backup = JSON.parse(raw) as OwaBackupFile;
    const res = await applyBackup(backup);
    return { ok: res.ok, message: res.message };
  } catch (e: any) {
    return { ok: false, message: `No se pudo importar el respaldo: ${e?.message || e}` };
  }
}

export async function getOwaDataFolder(): Promise<string> {
  if (!isTauri()) return '';
  try { return await appDataDir(); } catch { return ''; }
}

export async function revealOwaDataFolder(): Promise<string> {
  const dir = await getOwaDataFolder();
  if (!dir) return '';
  try { await revealItemInDir(dir); return dir; } catch { return dir; }
}