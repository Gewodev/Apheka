export interface OccurrenceEvent {
  id: string; date: string; startTime?: string; allDay?: boolean;
  repeat?: string; repeatDays?: number[]; repeatUntil?: string;
  exceptions?: string[]; occurrenceOverrides?: Record<string, Partial<OccurrenceEvent>>;
}
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function nextOccurrence<T extends OccurrenceEvent>(event: T, now = new Date()): T | null {
  if (!event.date || !Number.isFinite(new Date(event.date + 'T12:00:00').getTime())) return null;
  const today = localDate(now);
  const base = new Date(event.date + 'T12:00:00');
  const overrides = event.occurrenceOverrides || {};
  const candidates: T[] = [];
  const future = (e: T) => e.date >= today && (e.allDay || !e.startTime || new Date(e.date+'T'+e.startTime).getTime() >= now.getTime());
  const add = (date: string) => {
    if (event.exceptions?.includes(date)) return;
    const value = { ...event, date, ...overrides[date], id: event.id } as T;
    if (future(value)) candidates.push(value);
  };
  if (!event.repeat || event.repeat === 'none') { add(event.date); return candidates[0] || null; }
  // Moved occurrences can be earlier/later than their original day.
  for (const date of Object.keys(overrides)) {
    if (date >= event.date && (!event.repeatUntil || date <= event.repeatUntil)) add(date);
  }
  const cursor = new Date((event.date > today ? event.date : today) + 'T12:00:00');
  // Each exception/override can skip one occurrence; a full extra week finds the next.
  const limit = ((event.exceptions?.length || 0) + Object.keys(overrides).length + 2) * 7;
  for (let i=0; i<limit; i++, cursor.setDate(cursor.getDate()+1)) {
    const date = localDate(cursor);
    if (event.repeatUntil && date > event.repeatUntil) break;
    const weekday = (cursor.getDay()+6)%7;
    const matches = event.repeat === 'daily' || (event.repeat === 'weekly' && cursor.getDay() === base.getDay()) || (event.repeat === 'custom_days' && event.repeatDays?.includes(weekday));
    if (!matches) continue;
    add(date);
    if (candidates.some(e => e.date === date)) break;
  }
  return candidates.sort((a,b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))[0] || null;
}
