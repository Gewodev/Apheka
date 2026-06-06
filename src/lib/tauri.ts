export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

import { getStoredToken, isValidToken } from './auth';

export async function invoke<T>(command: string, args?: any): Promise<T> {
  if (!isTauri()) {
    console.warn(`[Tauri] Not in Tauri environment, skipping: ${command}`);
    throw new Error('Not in Tauri environment');
  }
  const tokenObj = getStoredToken();
  if (!isValidToken(tokenObj)) {
    throw new Error('Authentication required for Tauri commands');
  }
  // Inject token into args so Rust side can verify
  const enrichedArgs = { ...args, auth_token: tokenObj?.token };
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  try {
    return await tauriInvoke(command, enrichedArgs);
  } catch (error) {
    console.error(`Tauri Invoke Error [${command}]:`, error);
    throw error;
  }
}
