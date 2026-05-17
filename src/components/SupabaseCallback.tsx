import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function SupabaseCallback() {
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('owa_supabase_auth_success', 'true');
        window.location.href = window.location.origin;
      }
    });
  }, []);

  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-textDim">Completando autenticación con Supabase...</p>
      </div>
    </div>
  );
}
