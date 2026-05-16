import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export async function invoke<T>(command: string, args?: any): Promise<T> {
  try {
    return await tauriInvoke(command, args);
  } catch (error) {
    console.error(`Tauri Invoke Error [${command}]:`, error);
    throw error;
  }
}

export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}
