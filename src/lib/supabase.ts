import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isTauri } from './tauri';
import { getStoredToken, isValidToken, getCurrentUser as getAuthUser } from './auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export function initSupabase(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing — cloud sync disabled');
    return false;
  }
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return true;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) initSupabase();
  return supabaseInstance;
}

function nullFn() {}
function chainableStub(): any {
  return new Proxy(async () => {}, {
    get: () => chainableStub(),
    apply: async () => {},
  });
}

const mockAuth = {
  signInWithOAuth: async () => { console.warn('Supabase not initialized'); return { data: null, error: null }; },
  signOut: async () => {},
  getUser: async () => ({ data: { user: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: nullFn } } }),
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const s = getSupabase();
    if (!s) {
      if (prop === 'auth') return mockAuth;
      return chainableStub();
    }
    return (s as any)[prop];
  },
});

/** Ensure we have a valid auth token before proceeding */
async function requireAuth(): Promise<void> {
  const token = getStoredToken();
  if (!isValidToken(token)) {
    throw new Error('Authentication required');
  }
}

export async function signInWithGoogle() {
  if (isTauri()) {
    localStorage.setItem('owa_auth_pending', 'supabase');
    const redirectTo = encodeURIComponent(window.location.origin + '/auth/callback');
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback',
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutSupabase() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  // First check local auth token
  const localUser = getAuthUser();
  if (localUser) return localUser;
  // Fallback to Supabase session
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function syncToSupabase(table: string, data: Record<string, unknown>) {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    await supabase.from(table).upsert(
      { ...data, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  } catch (error) {
    console.error('syncToSupabase failed:', error);
    throw error;
  }
}

export async function fetchFromSupabase(table: string): Promise<Record<string, unknown>[]> {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(`fetchFromSupabase (${table}) failed:`, error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('fetchFromSupabase error:', error);
    return [];
  }
}

export async function deleteFromSupabase(table: string, id: string) {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      console.error(`deleteFromSupabase (${table}) failed:`, error);
      throw error;
    }
  } catch (error) {
    console.error('deleteFromSupabase error:', error);
    throw error;
  }
}

export function onAuthStateChange(callback: (user: unknown) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

export async function syncAllToSupabase(allData: {
  tasks?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  studySessions?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
}) {
  const tables = ['tasks', 'notes', 'events', 'study_sessions'] as const;
  for (const table of tables) {
    const items = allData[table as keyof typeof allData];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await syncToSupabase(table, item);
      }
    }
  }
}
