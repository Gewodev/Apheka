import { get, set } from 'idb-keyval';
import type { OccurrenceEvent } from './eventOccurrence';
export const FEATURED_CHANGED = 'owa-featured-changed';
const ID = 'owa_planned_goal';
const DATA = 'owa_planned_goal_data';
const RECORD = 'owa_featured_v2';
export type FeaturedEvent = OccurrenceEvent & { title: string; color?: string };
interface FeaturedRecord { id: string | null; event: FeaturedEvent | null; updatedAt: number }
let cached: FeaturedRecord | undefined;
let revision = 0;
let queue: Promise<unknown> = Promise.resolve();
export function readFeatured(): FeaturedRecord {
  if (cached) return cached;
  try {
    const record = JSON.parse(localStorage.getItem(RECORD) || 'null');
    if (record && typeof record.updatedAt === 'number') return cached = record;
    const id = localStorage.getItem(ID);
    const event = JSON.parse(localStorage.getItem(DATA) || 'null');
    return cached = { id, event: event?.id === id ? event : null, updatedAt: 0 };
  } catch { return cached = { id: null, event: null, updatedAt: 0 }; }
}
export async function hydrateFeatured(): Promise<void> {
  const version = revision;
  const local = readFeatured();
  try {
    const saved = await get<FeaturedRecord>(RECORD);
    if (revision === version && saved && saved.updatedAt > local.updatedAt) {
      cached = saved;
      window.dispatchEvent(new Event(FEATURED_CHANGED));
    }
  } catch { /* Keep last known selection on a transient read failure. */ }
}
export function setFeaturedEvent(event: FeaturedEvent | null): Promise<void> {
  const record = { id: event?.id || null, event, updatedAt: Math.max(Date.now(), readFeatured().updatedAt + 1) };
  revision++;
  cached = record;
  let mirrored = false;
  try {
    const json = JSON.stringify(record);
    localStorage.setItem(RECORD, json);
    mirrored = localStorage.getItem(RECORD) === json;
    if (event) { localStorage.setItem(ID, event.id); localStorage.setItem(DATA, JSON.stringify(event)); }
    else { localStorage.removeItem(ID); localStorage.removeItem(DATA); }
  } catch { /* Durable fallback below. */ }
  window.dispatchEvent(new Event(FEATURED_CHANGED));
  const write = queue.catch(() => {}).then(() => set(RECORD, record)).catch(error => { if (!mirrored) throw error; });
  queue = write;
  return write;
}
export function clearFeaturedEvent(id: string): void {
  if (readFeatured().id === id) void setFeaturedEvent(null).catch(console.error);
}
