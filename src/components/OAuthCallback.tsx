import { useEffect } from 'react';
import { isTauri } from '../lib/tauri';

export default function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (isTauri()) {
      if (code) {
        import('../lib/google/index').then(async ({ exchangeCode, configureGoogle, isSignedIn }) => {
          configureGoogle(
            import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
            import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
          );
          const ok = await exchangeCode(code);
          if (ok) {
            try { localStorage.setItem('owa_auth_success', 'google'); } catch { /* cuota */ }
          } else {
            localStorage.setItem('owa_auth_error', 'google');
          }
          localStorage.removeItem('owa_auth_pending');
          window.location.href = window.location.origin;
        });
      } else if (error) {
        try { localStorage.setItem('owa_auth_error', error); } catch { /* cuota */ }
        localStorage.removeItem('owa_auth_pending');
        window.location.href = window.location.origin;
      } else {
        window.location.href = window.location.origin;
      }
    } else if (window.opener) {
      if (code) {
        window.opener.postMessage({ type: 'google:authcode', code }, window.location.origin);
      } else if (error) {
        window.opener.postMessage({ type: 'google:error', error }, window.location.origin);
      }
      window.close();
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-textDim">Completando autenticación...</p>
      </div>
    </div>
  );
}
