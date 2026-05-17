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
}

interface CalendarEventInput {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
}

interface EventsResponse {
  items: GoogleEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
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

export async function syncAppEventsToGoogle(
  appEvents: { id: string; title: string; description: string; date: string; startTime: string; endTime: string; color: string }[],
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;
  for (const ev of appEvents) {
    try {
      const startDt = new Date(`${ev.date.split('T')[0]}T${ev.startTime || '09:00'}`);
      const endDt = ev.endTime
        ? new Date(`${ev.date.split('T')[0]}T${ev.endTime}`)
        : new Date(startDt.getTime() + 3600000);
      await createEvent({
        summary: ev.title,
        description: ev.description,
        start: { dateTime: startDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      synced++;
    } catch { errors++; }
  }
  return { synced, errors };
}

export async function importGoogleEvents(): Promise<{
  imported: { title: string; date: string; startTime: string; endTime: string; color: string }[];
}> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
  const res = await listEvents(start, end);
  const imported = res.items
    .filter(e => e.start?.dateTime && e.status !== 'cancelled')
    .map(e => ({
      title: e.summary,
      date: e.start.dateTime!.split('T')[0],
      startTime: e.start.dateTime!.split('T')[1]?.slice(0, 5) || '09:00',
      endTime: e.end?.dateTime?.split('T')[1]?.slice(0, 5) || '10:00',
      color: e.colorId ? `var(--color-${e.colorId})` : 'var(--accent)',
    }));
  return { imported };
}
