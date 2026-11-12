import { isStateSnapshot, snapshotScore } from './stateSnapshot';
import { loadPlanner, savePlanner } from './plannerStore';
import { readFeatured, hydrateFeatured, setFeaturedEvent } from './featuredEvent';
import { get, set } from 'idb-keyval';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { isTauri } from './tauri';
import { getAllTracksMetadata, saveTrackMetadata } from './musicDb';
import { safeSet } from './safeStorage';
import type { Track } from '../store/AppContext';

const STATE_KEY = 'owa_studio_data';
const SECRET_RE = /token|secret|credential|google|supabase/i;
function withoutLegacySecrets(value:unknown):unknown{
  if(!value||typeof value!=='object'||Array.isArray(value))return value;
  const state=value as Record<string,unknown>,settings=state.settings;
  if(!settings||typeof settings!=='object'||Array.isArray(settings))return value;
  return {...state,settings:Object.fromEntries(Object.entries(settings as Record<string,unknown>).filter(([key])=>!/api.?key|token|secret|credential/i.test(key)))};
}

export interface OwaBackupFile {
  format: 'owa-studio-backup';
  version: 2;
  exportedAt: string;
  appVersion: string;
  localStorage: Record<string, string>;
  idb: { key: string; value: unknown } | null;
  // Eventos EXPLÍCITOS (todos los que el usuario colocó, incluidos los del
  // planificador): se restauran sí o sí aunque el estado genérico falle.
  plannerV3: string | null;
  stateEvents: any[] | null;
  // v1 incluía la música aquí; desde v2 la música tiene su propio
  // export ("Biblioteca completa") y el respaldo del sistema NO la trae.
  // Se conserva el campo solo para leer respaldos viejos.
  musicTracks?: Track[] | null;
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
    if (!k.startsWith('owa_')&&!k.startsWith('apheka_')) continue;
    if(k.startsWith('apheka_mcp_')||k==='owa_charvis_providers_v1')continue;
    if (SECRET_RE.test(k)) continue;
    const value=localStorage.getItem(k)||'';
    if(k===STATE_KEY){try{out[k]=JSON.stringify(withoutLegacySecrets(JSON.parse(value)));}catch{out[k]=value;}}else out[k]=value;
  }
  return out;
}

export async function collectBackup(): Promise<OwaBackupFile> {
  let idbValue: unknown = null;
  try {
    idbValue = await get(STATE_KEY);
  } catch { /* noop */ }
  // Prefer the latest complete snapshot, including a deliberately empty one.
  const candidates: Record<string, unknown>[] = [];
  for (const raw of [idbValue, localStorage.getItem(STATE_KEY)]) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (isStateSnapshot(parsed)) candidates.push(parsed);
    } catch { /* A corrupt mirror must not hide the durable snapshot. */ }
  }
  candidates.sort((a,b) => snapshotScore(b) - snapshotScore(a));
  if (candidates.length) idbValue = withoutLegacySecrets(candidates[0]);
  // Eventos explícitos: del estado IDB o, en su defecto, del espejo local.
  // Así el JSON trae TODOS los eventos colocados, garantizado.
  let stateEvents: any[] | null = null;
  try {
    const rawState: any =
      (idbValue !== null && idbValue !== undefined)
        ? idbValue
        : JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    const parsed = typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
    stateEvents = parsed && Array.isArray(parsed.events) ? parsed.events : null;
  } catch { /* noop */ }
  // Planificador explícito (eventos con repetición, clases, etc.).
  let plannerV3: string | null = null;
  try { plannerV3 = JSON.stringify(await loadPlanner()); } catch { /* Keep the export usable if this store is unavailable. */ }
  await hydrateFeatured();
  const localEntries = lsEntries();
  localEntries.owa_featured_v2 = JSON.stringify(readFeatured());
  return {
    format: 'owa-studio-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    appVersion: '6.7',
    localStorage: localEntries,
    idb: idbValue !== null && idbValue !== undefined ? { key: STATE_KEY, value: idbValue } : null,
    plannerV3,
    stateEvents,
    musicTracks: null,
  };
}

export async function exportOwaBackup(): Promise<BackupResult> {
  const backup = await collectBackup();
  const json = JSON.stringify(backup);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const fileName = `pouh-respaldo-${stamp}.json`;
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

export const RESTORE_MARKER = 'owa_restore_pending';

export async function applyBackup(backup: OwaBackupFile): Promise<{ ok: boolean; message: string }> {
  if (!backup || backup.format !== 'owa-studio-backup') {
    return { ok: false, message: 'El archivo no es un respaldo válido de POUH' };
  }
  // Marcador anti-pisado: el auto-guardado (cada segundo por el temporizador)
  // NO debe sobrescribir lo restaurado antes de la recarga. Se limpia al
  // terminar loadData tras recargar (sessionStorage sobrevive al reload).
  try { sessionStorage.setItem(RESTORE_MARKER, '1'); } catch { /* noop */ }
  const ls = backup.localStorage || {};
  for (const [k, v] of Object.entries(ls)) {
    // safeSet con auto-liberación: con la cuota llena el setItem crudo fallaba
    // en silencio y el planificador quedaba sin sus eventos (solo se veían
    // las tareas, que viajan por IDB). Compat v1: misma lectura.
    safeSet(k, v);
  }
  // Planificador explícito: TODOS los eventos colocados (incluidos los que se
  // repiten semana tras semana) quedan restaurados sí o sí.
  if (typeof (backup as any).plannerV3 === 'string' && (backup as any).plannerV3) {
    safeSet('owa_planner_v3', (backup as any).plannerV3);
  } else if (typeof ls['owa_planner_v3'] === 'string' && ls['owa_planner_v3']) {
    // Respaldos v1: la clave ya vino en el barrido genérico, pero se fuerza
    // de nuevo con liberación de cuota por si el bucle la saltó.
    safeSet('owa_planner_v3', ls['owa_planner_v3']);
  }
  const plannerRaw = backup.plannerV3 || ls.owa_planner_v3;
  if (plannerRaw) {
    try {
      const planner = JSON.parse(plannerRaw);
      if (!Array.isArray(planner.events) || !Array.isArray(planner.classes)) throw new Error('Formato inválido');
      await savePlanner(planner.events, planner.classes);
    } catch {
      try { sessionStorage.removeItem(RESTORE_MARKER); } catch {}
      return { ok: false, message: 'No se pudo restaurar el planificador. Conserva el archivo de respaldo y vuelve a intentarlo.' }; }
  }
  try {
    const selection = JSON.parse(ls.owa_featured_v2 || 'null');
    const legacy = JSON.parse(ls.owa_planned_goal_data || 'null');
    const planner = plannerRaw ? JSON.parse(plannerRaw) : null;
    await setFeaturedEvent(selection ? selection.event : legacy || planner?.events?.find((e: any) => e.id === ls.owa_planned_goal) || null);
    if (ls.owa_timer_link_v1) await set('owa_timer_link_v1', JSON.parse(ls.owa_timer_link_v1));
  } catch { /* Older backups may have no selection metadata. */ }
  // Estado fusionado: el respaldo manda sus eventos explícitos dentro del
  // estado (local + IDB + disco), para que aparezcan al recargar.
  let mergedState: any = (backup as any).idb ? (backup as any).idb.value : null;
  if ((mergedState === null || mergedState === undefined) && ls[STATE_KEY]) {
    try { mergedState = JSON.parse(ls[STATE_KEY]); } catch { mergedState = null; }
  }
  if (typeof mergedState === 'string') { try { mergedState = JSON.parse(mergedState); } catch {} }
  if (Array.isArray((backup as any).stateEvents)) {
    try {
      const base = (mergedState && typeof mergedState === 'object') ? { ...(mergedState as any) } : {};
      base.events = (backup as any).stateEvents;
      mergedState = base;
    } catch { /* noop */ }
  }
  if (mergedState && typeof mergedState === 'object') mergedState = { ...mergedState, _savedAt: Date.now() };
  if (mergedState !== null && mergedState !== undefined) {
    let durable = false;
    try { await set(STATE_KEY, mergedState); durable = true; } catch { /* Try the local mirror next. */ }
    const raw = typeof mergedState === 'string' ? mergedState : JSON.stringify(mergedState);
    try { localStorage.setItem(STATE_KEY, raw); durable = durable || localStorage.getItem(STATE_KEY) === raw; } catch {}
    if (!durable) {
      try { sessionStorage.removeItem(RESTORE_MARKER); } catch {}
      return { ok: false, message: 'No se pudo guardar el respaldo restaurado. Conserva el archivo y vuelve a intentarlo.' };
    }
  } else if (backup.idb) {
    try { await set(backup.idb.key, backup.idb.value); } catch { /* noop */ }
  }
  // Música: UPSERT por ID (el respaldo manda: actualiza nombre/artista/portada
  // si el ID ya existe, agrega si es nuevo; nunca borra ni duplica).
  // Respaldos viejos sin musicTracks se saltan este paso sin errores.
  let musicAdded = 0;
  if (Array.isArray(backup.musicTracks) && backup.musicTracks.length > 0) {
    try {
      const current = await getAllTracksMetadata().catch(() => [] as Track[]);
      const currentById = new Map((current || []).filter(t => t && t.id).map(t => [t.id, t]));
      for (const t of backup.musicTracks) {
        if (!t || typeof t !== 'object' || !t.id) continue;
        const prev = currentById.get(t.id);
        const merged = prev
          ? { ...prev, title: t.title ?? prev.title, artist: t.artist ?? prev.artist, coverImage: (t as any).coverImage ?? (t as any).coverUrl ?? prev.coverImage, isFavorite: t.isFavorite ?? prev.isFavorite }
          : (t as Track);
        await saveTrackMetadata(merged as Track).catch(() => {});
        if (!prev) currentById.set(t.id, merged as Track);
        musicAdded++;
      }
    } catch { /* noop */ }
  }
  if (isTauri()) {
    try {
      const diskPath = await join(await appDataDir(), 'owa_studio_data.json');
      const mergedRaw = (mergedState !== null && mergedState !== undefined)
        ? (typeof mergedState === 'string' ? mergedState : JSON.stringify(mergedState))
        : '';
      const rawState = mergedRaw || ls[STATE_KEY] || (backup.idb ? JSON.stringify(backup.idb.value) : '');
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
