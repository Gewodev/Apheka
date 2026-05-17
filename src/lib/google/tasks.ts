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
}

interface TaskListsResponse {
  items: TaskList[];
}

interface TasksResponse {
  items: TaskItem[];
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
    `/tasks/v1/lists/${taskListId}/tasks?showCompleted=true`,
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

export async function deleteTask(taskListId: string, taskId: string): Promise<void> {
  await apiFetch<void>(`/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export async function syncAppTasksToGoogle(
  appTasks: { id: string; title: string; description: string; status: 'pending' | 'in_progress' | 'completed'; dueDate?: string }[],
): Promise<{ synced: number }> {
  const listId = await createDefaultList();
  let synced = 0;
  for (const t of appTasks) {
    try {
      await createTask(listId, t.title, t.description, t.dueDate || undefined);
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
    dueDate: t.due || undefined,
    status: t.status === 'completed' ? 'completed' as const : 'pending' as const,
  }));
  return { imported };
}
