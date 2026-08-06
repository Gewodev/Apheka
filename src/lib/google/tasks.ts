import { apiFetch } from './index';

interface TaskList {
  id: string;
  title: string;
}

interface TaskItem {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  completed?: string;
  updated?: string;
}

interface TaskListsResponse {
  items: TaskList[];
}

interface TasksResponse {
  items: TaskItem[];
}

export interface AppTaskLike {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
  googleTaskId?: string;
}

export interface TasksSyncResult {
  created: number;    // tareas de Google importadas a la app
  updated: number;    // tareas actualizadas (en la app o en Google)
  pushed: number;     // tareas de la app creadas/actualizadas en Google
  deleted: number;    // tareas eliminadas en Google
  errors: number;
  newMappings: { appTaskId: string; googleTaskId: string }[];
  imported: { title: string; notes: string; dueDate?: string; status: 'pending' | 'completed'; googleTaskId: string }[];
  updates: { id: string; changes: { title: string; notes: string; dueDate?: string; status: 'pending' | 'in_progress' | 'completed' } }[];
}

export async function listTaskLists(): Promise<TaskList[]> {
  const res = await apiFetch<TaskListsResponse>('/tasks/v1/users/@me/lists');
  return res.items || [];
}

export async function createDefaultList(): Promise<string> {
  const lists = await listTaskLists();
  const owa = lists.find(l => l.title === 'OWA Studio');
  if (owa) return owa.id;
  const created = await apiFetch<TaskList>('/tasks/v1/users/@me/lists', {
    method: 'POST',
    body: JSON.stringify({ title: 'OWA Studio' }),
  });
  return created.id;
}

export async function listTasks(taskListId: string): Promise<TaskItem[]> {
  const res = await apiFetch<TasksResponse>(
    `/tasks/v1/lists/${taskListId}/tasks?showCompleted=true&maxResults=100`,
  );
  return res.items || [];
}

export async function createTask(
  taskListId: string,
  title: string,
  notes?: string,
  due?: string,
): Promise<TaskItem> {
  return apiFetch<TaskItem>(`/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title, notes, due, status: 'needsAction' }),
  });
}

export async function updateTaskStatus(
  taskListId: string,
  taskId: string,
  completed: boolean,
): Promise<TaskItem> {
  return apiFetch<TaskItem>(`/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: completed ? 'completed' : 'needsAction', completed: completed ? new Date().toISOString() : undefined }),
  });
}

export async function updateTaskItem(
  taskListId: string,
  taskId: string,
  fields: { title?: string; notes?: string; due?: string; status?: 'needsAction' | 'completed' },
): Promise<TaskItem> {
  return apiFetch<TaskItem>(`/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

export async function deleteTask(taskListId: string, taskId: string): Promise<void> {
  await apiFetch<void>(`/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// ── Conversión de fechas (local ↔ Google Tasks RFC3339) ────────────────────
function toGoogleDue(dueDate?: string): string | undefined {
  if (!dueDate) return undefined;
  try {
    const d = dueDate.includes('T') ? new Date(dueDate) : new Date(`${dueDate}T00:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch { return undefined; }
}

function fromGoogleDue(due?: string): string | undefined {
  if (!due) return undefined;
  return due.slice(0, 10);
}

function toGoogleStatus(s: AppTaskLike['status']): 'needsAction' | 'completed' {
  return s === 'completed' ? 'completed' : 'needsAction';
}

function fromGoogleStatus(s: TaskItem['status']): 'pending' | 'completed' {
  return s === 'completed' ? 'completed' : 'pending';
}

function taskDirty(a: AppTaskLike, g: TaskItem): boolean {
  const expectedStatus = a.status === 'completed' ? 'completed' : 'pending';
  return (
    g.title !== a.title ||
    (g.notes || '') !== (a.notes || '') ||
    fromGoogleDue(g.due) !== (a.dueDate || undefined) ||
    fromGoogleStatus(g.status) !== expectedStatus
  );
}

/**
 * Sincronización bidireccional real entre OWA y Google Tasks.
 * Todo el tráfico usa la lista "OWA Studio" de Google Tasks.
 *
 *  - App → Google: crea/actualiza tareas de la app (por googleTaskId).
 *  - Google → App: importa tareas añadidas directamente en la lista OWA y
 *    actualiza en la app las que ya existen.
 *  - Eliminación: tareas borradas en la app se eliminan en Google y viceversa.
 */
export async function syncTasksTwoWay(appTasks: AppTaskLike[]): Promise<TasksSyncResult> {
  const result: TasksSyncResult = { created: 0, updated: 0, pushed: 0, deleted: 0, errors: 0, newMappings: [], imported: [], updates: [] };
  let listId: string;
  try {
    listId = await createDefaultList();
  } catch (e) {
    console.error('Tasks sync: no se pudo acceder a la lista', e);
    return result;
  }

  let googleTasks: TaskItem[] = [];
  try {
    googleTasks = await listTasks(listId);
  } catch (e) {
    console.error('Tasks sync: no se pudieron listar tareas', e);
    return result;
  }

  const googleById = new Map(googleTasks.map(t => [t.id, t]));
  const appById = new Map(appTasks.map(a => [a.id, a]));
  const matchedGoogleIds = new Set<string>();

  // 1) App → Google
  for (const a of appTasks) {
    // Sin googleTaskId: se intenta emparejar con tareas ya enviadas en un sync de una sola vía (mismo título).
    const existing = a.googleTaskId
      ? googleById.get(a.googleTaskId)
      : googleTasks.find(g => !matchedGoogleIds.has(g.id) && (g.title || '').trim().toLowerCase() === a.title.trim().toLowerCase());
    const due = toGoogleDue(a.dueDate);
    try {
      if (existing) {
        matchedGoogleIds.add(existing.id);
        if (taskDirty(a, existing)) {
          await updateTaskItem(listId, existing.id, {
            title: a.title,
            notes: a.notes,
            due,
            status: toGoogleStatus(a.status),
          });
          result.pushed++;
        }
        if (!a.googleTaskId) result.newMappings.push({ appTaskId: a.id, googleTaskId: existing.id });
      } else {
        const created = await createTask(listId, a.title, a.notes, due);
        result.newMappings.push({ appTaskId: a.id, googleTaskId: created.id });
        result.pushed++;
      }
    } catch { result.errors++; }
  }

  // 2) Google → App
  for (const g of googleTasks) {
    if (matchedGoogleIds.has(g.id)) continue;
    const appMatch = appTasks.find(a => a.googleTaskId === g.id);
    if (appMatch) {
      // La app ya la conoce: la app es fuente de verdad en la lista OWA.
      continue;
    }
    const title = (g.title || '').trim();
    if (!title) {
      // Tarea vacía o huérfana → limpiar
      try { await deleteTask(listId, g.id); result.deleted++; } catch { result.errors++; }
      continue;
    }
    // Tarea sin mapping en la app: se importa como nueva (evita pérdida de datos).
    const st = fromGoogleStatus(g.status);
    result.imported.push({
      title,
      notes: g.notes || '',
      dueDate: fromGoogleDue(g.due),
      status: st,
      googleTaskId: g.id,
    });
    result.created++;
  }

  return result;
}

// ── Funciones heredadas (usadas por otros flujos de la app) ────────────────
export async function syncAppTasksToGoogle(
  appTasks: { id: string; title: string; description: string; status: 'pending' | 'in_progress' | 'completed'; dueDate?: string }[],
): Promise<{ synced: number }> {
  const listId = await createDefaultList();
  let synced = 0;
  for (const t of appTasks) {
    try {
      await createTask(listId, t.title, t.description, toGoogleDue(t.dueDate));
      synced++;
    } catch { /* skip */ }
  }
  return { synced };
}

export async function importGoogleTasks(): Promise<{
  imported: { title: string; description: string; dueDate?: string; status: 'pending' | 'completed' }[];
}> {
  const listId = await createDefaultList();
  const items = await listTasks(listId);
  const imported = items.map(t => ({
    title: t.title,
    description: t.notes || '',
    dueDate: fromGoogleDue(t.due),
    status: fromGoogleStatus(t.status),
  }));
  return { imported };
}
