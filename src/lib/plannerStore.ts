import { get, set } from 'idb-keyval';
import type { PlanEvent } from '../components/views/planificacion/EventModal';
import type { ScheduleClass } from '../components/views/planificacion/ScheduleBuilder';

export const PLANNER_CHANGED = 'owa-planner-changed';
const KEY = 'owa_planner_v3';
export interface PlannerSnapshot { events: PlanEvent[]; classes: ScheduleClass[]; updatedAt?: number }
let current: PlannerSnapshot | null = null;
let loading: Promise<PlannerSnapshot> | null = null;
let writes: Promise<unknown> = Promise.resolve();
function parse(raw: unknown): PlannerSnapshot | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || !Array.isArray(data.events) || !Array.isArray(data.classes)) return null;
    return data;
  } catch { return null; }
}
function mirror(): PlannerSnapshot | null {
  try { return parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function peekPlanner(): PlannerSnapshot | null { return current || mirror(); }
export function loadPlanner(): Promise<PlannerSnapshot> {
  if (current) return Promise.resolve(current);
  if (loading) return loading;
  loading = (async () => {
    const local = mirror();
    let disk: PlannerSnapshot | null;
    try { disk = parse(await get(KEY)); }
    catch (error) { if (!local) throw error; disk = null; }
    // A deletion is a newer snapshot too. Never prefer the longest array.
    const selected = disk && local
      ? ((local.updatedAt || 0) > (disk.updatedAt || 0) ? local : disk)
      : disk || local || { events: [], classes: [] };
    return current || (current = selected);
  })().finally(() => { loading = null; });
  return loading;
}
export function savePlanner(events: PlanEvent[], classes: ScheduleClass[]): Promise<void> {
  current = { events, classes, updatedAt: Math.max(Date.now(), (current?.updatedAt || 0) + 1) };
  const json = JSON.stringify(current);
  let mirrored = false;
  try { localStorage.setItem(KEY, json); mirrored = localStorage.getItem(KEY) === json; } catch { /* IDB is primary */ }
  // Serialize writes so an older transaction cannot replace newer edits.
  const write = writes.catch(() => {}).then(() => set(KEY, json)).catch(error => {
    if (!mirrored) throw error;
  });
  writes = write;
  window.dispatchEvent(new Event(PLANNER_CHANGED));
  return write;
}
