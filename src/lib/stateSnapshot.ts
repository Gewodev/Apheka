// Snapshot freshness belongs to the save, not to a future task deadline.
export function snapshotScore(data: Record<string, unknown>): number {
  if (typeof data._savedAt === 'number' && Number.isFinite(data._savedAt)) return data._savedAt;
  let latest = 0;
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (['createdAt','updatedAt','completedAt','endedAt','evaluatedAt'].includes(key) && typeof entry === 'string') {
        const time = Date.parse(entry);
        if (Number.isFinite(time)) latest = Math.max(latest, Math.min(time, Date.now()));
      } else if (entry && typeof entry === 'object') visit(entry);
    }
  };
  visit(data);
  return latest;
}
export function isStateSnapshot(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  return ['tasks','notes','courses','studySessions','plannedSessions','events'].some(key => Array.isArray(value[key])) || !!(value.settings && typeof value.settings === 'object');
}
