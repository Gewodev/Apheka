import { apiFetch } from './index';

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  colorId?: string;
  recurrence?: string[];
  status?: string;
  updated?: string;
  extendedProperties?: { private?: Record<string, string> };
}

interface CalendarEventInput {
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  extendedProperties?: { private?: Record<string, string> };
}

interface EventsResponse {
  items: GoogleEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

export interface AppEventLike {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  color: string;
  googleEventId?: string;
}

export interface CalendarSyncResult {
  created: number;    // eventos externos de Google importados a la app
  updated: number;    // eventos actualizados (en la app o en Google)
  pushed: number;     // eventos de la app creados/actualizados en Google
  deleted: number;    // eventos eliminados en el lado de Google
  errors: number;
  newMappings: { appEventId: string; googleEventId: string }[];
  imported: { title: string; description: string; date: string; startTime: string; endTime: string; color: string; googleEventId: string; allDay: boolean }[];
  updates: { id: string; changes: { title: string; description: string; date: string; startTime: string; endTime: string; color: string; allDay: boolean } }[];
}

export async function listEvents(
  timeMin: string,
  timeMax: string,
  syncToken?: string,
): Promise<EventsResponse> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    orderBy: 'startTime',
    singleEvents: 'true',
  });
  if (syncToken) params.set('syncToken', syncToken);

  return apiFetch<EventsResponse>(
    `/calendar/v3/calendars/primary/events?${params}`,
  );
}

async function listAllEvents(timeMin: string, timeMax: string): Promise<GoogleEvent[]> {
  const all: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      orderBy: 'startTime',
      singleEvents: 'true',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await apiFetch<EventsResponse>(`/calendar/v3/calendars/primary/events?${params}`);
    all.push(...(res.items || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return all;
}

export async function createEvent(event: CalendarEventInput): Promise<GoogleEvent> {
  return apiFetch<GoogleEvent>('/calendar/v3/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({ ...event, status: 'confirmed' }),
  });
}

export async function updateEvent(
  eventId: string,
  event: Partial<CalendarEventInput>,
): Promise<GoogleEvent> {
  return apiFetch<GoogleEvent>(`/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await apiFetch<void>(`/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
  });
}

// ── Conversión de fechas (local ↔ Google) ──────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function toGoogleDateTime(date: string, time: string, endOffsetHours = 0): { dateTime: string; timeZone?: string } {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  dt.setHours(dt.getHours() + endOffsetHours);
  return { dateTime: dt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function fromGoogleDateTime(start: { dateTime?: string; date?: string }): { date: string; time: string; allDay: boolean } {
  if (start.date) return { date: start.date, time: '', allDay: true };
  const dt = new Date(start.dateTime!);
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    allDay: false,
  };
}

function toGoogleInput(a: AppEventLike) {
  const start = a.allDay
    ? { date: a.date }
    : toGoogleDateTime(a.date, a.startTime || '09:00');
  const end = a.allDay
    ? { date: addDaysISO(a.date, 1) }
    : toGoogleDateTime(a.date, a.endTime || a.startTime || '09:00', 1);
  return { summary: a.title, description: a.description, start, end };
}

function eventDirty(a: AppEventLike, g: GoogleEvent): boolean {
  const want = toGoogleInput(a);
  const wantStart = 'dateTime' in want.start ? want.start.dateTime : want.start.date;
  const wantEnd = 'dateTime' in want.end ? want.end.dateTime : want.end.date;
  const sameStart = wantStart
    ? Math.abs(new Date(g.start?.dateTime || 0).getTime() - new Date(wantStart).getTime()) < 60000
    : g.start?.date === wantStart;
  const sameEnd = wantEnd
    ? Math.abs(new Date(g.end?.dateTime || 0).getTime() - new Date(wantEnd).getTime()) < 60000
    : g.end?.date === wantEnd;
  return (
    g.summary !== a.title ||
    (g.description || '') !== (a.description || '') ||
    !sameStart ||
    !sameEnd
  );
}

/**
 * Sincronización bidireccional real entre OWA y Google Calendar.
 *
 *  - App → Google: crea/actualiza los eventos de la app (identificados por
 *    extendedProperties.private.owaId o por googleEventId).
 *  - Google → App: importa eventos externos (sin owaId) y actualiza en la app
 *    los que ya existen.
 *  - Eliminación: si un evento de la app se borró, se elimina en Google; si un
 *    evento de OWA se borró en Google, se elimina de la app.
 */
export async function syncCalendarTwoWay(appEvents: AppEventLike[]): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = { created: 0, updated: 0, pushed: 0, deleted: 0, errors: 0, newMappings: [], imported: [], updates: [] };
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 9, 0, 23, 59, 59).toISOString();

  let googleEvents: GoogleEvent[] = [];
  try {
    googleEvents = await listAllEvents(timeMin, timeMax);
  } catch (e) {
    console.error('Calendar sync: no se pudo listar eventos', e);
    return result;
  }

  const googleById = new Map(googleEvents.map(g => [g.id, g]));
  const googleByOwa = new Map<string, GoogleEvent>();
  for (const g of googleEvents) {
    const owaId = g.extendedProperties?.private?.['owaId'];
    if (owaId) googleByOwa.set(owaId, g);
  }
  const appById = new Map(appEvents.map(a => [a.id, a]));

  // 1) App → Google
  for (const a of appEvents) {
    const existing = a.googleEventId ? googleById.get(a.googleEventId) : undefined;
    try {
      if (existing) {
        if (eventDirty(a, existing)) {
          await updateEvent(existing.id, { ...toGoogleInput(a), extendedProperties: { private: { owaId: a.id } } });
          result.pushed++;
        }
      } else {
        const created = await createEvent({ ...toGoogleInput(a), extendedProperties: { private: { owaId: a.id } } });
        result.newMappings.push({ appEventId: a.id, googleEventId: created.id });
        result.pushed++;
      }
    } catch { result.errors++; }
  }

  // 2) Google → App
  for (const g of googleEvents) {
    if (g.status === 'cancelled') continue;
    const owaId = g.extendedProperties?.private?.['owaId'];
    if (owaId) {
      // Es un evento creado por OWA: si ya no existe en la app, se borró aquí → borrar en Google.
      if (!appById.has(owaId)) {
        try {
          await deleteEvent(g.id);
          result.deleted++;
        } catch { result.errors++; }
      }
      continue;
    }
    // Evento externo
    const s = fromGoogleDateTime(g.start);
    const e = fromGoogleDateTime(g.end || g.start);
    const clean: CalendarSyncResult['imported'][number] = {
      title: g.summary,
      description: g.description || '',
      date: s.date,
      startTime: s.allDay ? '09:00' : s.time,
      endTime: e.allDay ? '10:00' : e.time,
      color: g.colorId ? `var(--color-${g.colorId})` : 'var(--accent)',
      googleEventId: g.id,
      allDay: s.allDay,
    };
    const appMatch = appEvents.find(a => a.googleEventId === g.id);
    if (appMatch) {
      // Actualizar la app con los datos de Google (Google es fuente para eventos externos)
      result.updates.push({ id: appMatch.id, changes: clean });
      result.updated++;
    } else {
      result.imported.push(clean);
      result.created++;
    }
  }

  return result;
}

// ── Funciones heredadas (usadas por otros flujos de la app) ────────────────
export async function syncAppEventsToGoogle(
  appEvents: AppEventLike[],
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;
  for (const ev of appEvents) {
    try {
      await createEvent({ ...toGoogleInput(ev), extendedProperties: { private: { owaId: ev.id } } });
      synced++;
    } catch { errors++; }
  }
  return { synced, errors };
}

export async function importGoogleEvents(): Promise<{
  imported: { title: string; date: string; startTime: string; endTime: string; color: string }[];
}> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
  const res = await listEvents(start, end);
  const imported = res.items
    .filter(e => e.status !== 'cancelled')
    .map(e => {
      const s = fromGoogleDateTime(e.start);
      const endT = fromGoogleDateTime(e.end || e.start);
      return {
        title: e.summary,
        date: s.date,
        startTime: s.allDay ? '09:00' : s.time,
        endTime: endT.allDay ? '10:00' : endT.time,
        color: e.colorId ? `var(--color-${e.colorId})` : 'var(--accent)',
      };
    });
  return { imported };
}
