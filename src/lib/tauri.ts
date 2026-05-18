export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export async function invoke<T>(command: string, args?: any): Promise<T> {
  if (!isTauri()) {
    console.warn(`[Tauri] Not in Tauri environment, skipping: ${command}`);
    throw new Error('Not in Tauri environment');
  }
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  try {
    return await tauriInvoke(command, args);
  } catch (error) {
    console.error(`Tauri Invoke Error [${command}]:`, error);
    throw error;
  }
}
