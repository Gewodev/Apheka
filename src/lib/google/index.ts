import { isTauri } from '../tauri';

const TOKEN_KEY = 'owa_google_tokens';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
];

interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
  scope: string;
}

let currentTokens: GoogleTokens | null = null;
type AuthCallback = (connected: boolean) => void;
const listeners = new Set<AuthCallback>();

function notify(connected: boolean) {
  listeners.forEach(fn => fn(connected));
}

export function onAuthChange(fn: AuthCallback): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loadTokens(): GoogleTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as GoogleTokens;
    // El access token puede haber expirado, pero mientras exista refresh token
    // la sesión sigue viva (se refresca automáticamente al usar la API).
    // Solo se descarta si no hay forma de renovar la sesión.
    if (t.expiryDate < Date.now() && !t.refreshToken) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    currentTokens = t;
    return t;
  } catch { return null; }
}

function saveTokens(t: GoogleTokens) {
  currentTokens = t;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  notify(true);
}

export function clearTokens() {
  currentTokens = null;
  localStorage.removeItem(TOKEN_KEY);
  notify(false);
}

let clientId = '';
let clientSecret = '';

export function configureGoogle(clientId_: string, clientSecret_?: string) {
  clientId = clientId_;
  clientSecret = clientSecret_ || '';
  loadTokens();
}

export function isSignedIn(): boolean {
  return currentTokens !== null && (currentTokens.expiryDate > Date.now() || !!currentTokens.refreshToken);
}

export function getAccessToken(): string | null {
  if (!currentTokens) return null;
  if (currentTokens.expiryDate > Date.now()) return currentTokens.accessToken;
  // Access token expirado: la sesión se mantiene vía refresh token (ensureToken lo renueva).
  return null;
}

/**
 * Restaura la sesión persistida y, si el access token está expirado,
 * lo renueva automáticamente usando el refresh token. Devuelve si hay sesión.
 */
export async function restoreSession(): Promise<boolean> {
  loadTokens();
  if (!currentTokens) return false;
  if (currentTokens.expiryDate > Date.now()) return true;
  const token = await refreshAccessToken();
  return token !== null;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!currentTokens?.refreshToken) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        ...(clientSecret && { client_secret: clientSecret }),
        refresh_token: currentTokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!r.ok) { clearTokens(); return null; }
    const data = await r.json();
    const tokens: GoogleTokens = {
      accessToken: data.access_token,
      refreshToken: currentTokens.refreshToken,
      expiryDate: Date.now() + (data.expires_in || 3600) * 1000,
      scope: currentTokens.scope,
    };
    saveTokens(tokens);
    return data.access_token;
  } catch { clearTokens(); return null; }
}

export async function ensureToken(): Promise<string | null> {
  const t = getAccessToken();
  if (t) return t;
  return refreshAccessToken();
}

function buildAuthUrl(): URL {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', window.location.origin + '/oauth/callback');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', crypto.randomUUID());
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  return authUrl;
}

export function signIn(): Promise<boolean> {
  if (isTauri()) {
    localStorage.setItem('owa_auth_pending', 'google');
    window.location.href = buildAuthUrl().toString();
    return new Promise(() => {});
  }

  return new Promise((resolve) => {
    if (!clientId) { resolve(false); return; }
    const authUrl = buildAuthUrl();
    const popup = window.open(authUrl.toString(), 'google-oauth', 'width=600,height=700,menubar=no,toolbar=no');
    if (!popup) { resolve(false); return; }

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'google:authcode') {
        window.removeEventListener('message', handler);
        exchangeCode(e.data.code).then(resolve);
      }
    };
    window.addEventListener('message', handler);

    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        window.removeEventListener('message', handler);
        resolve(!!getAccessToken());
      }
    }, 500);
  });
}

export async function exchangeCode(code: string): Promise<boolean> {
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        ...(clientSecret && { client_secret: clientSecret }),
        redirect_uri: window.location.origin + '/oauth/callback',
        grant_type: 'authorization_code',
      }),
    });
    if (!r.ok) return false;
    const data = await r.json();
    const tokens: GoogleTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiryDate: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || SCOPES.join(' '),
    };
    saveTokens(tokens);
    return true;
  } catch { return false; }
}

export function signOut() {
  const token = currentTokens?.accessToken;
  clearTokens();
  if (token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {});
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await ensureToken();
  if (!token) throw new Error('Not authenticated');
  const r = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) throw new Error(`Google API error: ${r.status} ${await r.text()}`);
  return r.json();
}
