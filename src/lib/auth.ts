function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
  user: AuthUser;
}

const TOKEN_STORAGE_KEY = 'owa_auth_token';
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer before expiry

export function getStoredToken(): AuthToken | null {
  if (!isTauri()) {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      try {
        const token: AuthToken = JSON.parse(stored);
        if (Date.now() < token.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
          return token;
        }
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    return null;
  }
  return null;
}

export function storeToken(token: AuthToken): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isValidToken(token: AuthToken | null): boolean {
  if (!token) return false;
  return Date.now() < token.expiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

export async function requestAuthToken(scope: string = 'api'): Promise<AuthToken | null> {
  if (!isTauri()) {
    console.warn('[auth] Token request only available in Tauri mode');
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<{ token: string; expiresAt: number; user: AuthUser }>('auth_request_token', { scope });
    const authToken: AuthToken = {
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
    };
    storeToken(authToken);
    return authToken;
  } catch (error) {
    console.error('[auth] Failed to request token:', error);
    return null;
  }
}

export function getCurrentUser(): AuthUser | null {
  const token = getStoredToken();
  return token?.user || null;
}