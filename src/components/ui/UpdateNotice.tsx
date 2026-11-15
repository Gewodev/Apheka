import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Download, X } from 'lucide-react';
import { updaterStore } from '../../lib/updaterStore';
import '../../update-notice.css';

/**
 * Aviso de version nueva. Aparece dentro de la app (nunca como modal que
 * bloquea el trabajo) con un boton "Actualizar" que descarga el instalador
 * firmado y lo aplica en segundo plano.
 */
export default function UpdateNotice() {
  const state = useSyncExternalStore(updaterStore.subscribe, updaterStore.snapshot, updaterStore.snapshot);

  useEffect(() => {
    if (!updaterStore.snapshot().status || updaterStore.snapshot().status === 'idle') {
      const timer = window.setTimeout(() => { void updaterStore.check(false); }, 6000);
      return () => window.clearTimeout(timer);
    }
  }, [state.status]);

  if (state.status !== 'available' && state.status !== 'downloading' && state.status !== 'error') return null;
  const version = state.version || '';
  const percent = Math.round((state.progress ?? 0) * 100);
  return createPortal(
    <aside className="west-update-notice" role="status" aria-live="polite">
      <div className="west-update-notice-head">
        <span className="west-update-notice-tag">Actualización</span>
        <button className="west-update-notice-close" aria-label="Cerrar aviso de actualización" disabled={state.status === 'downloading'} onClick={() => updaterStore.dismiss(version)}><X size={15}/></button>
      </div>
      <h3>{version ? `West ${version} está disponible` : 'Hay una versión nueva'}</h3>
      {state.status === 'downloading'
        ? <div className="west-update-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: percent + '%' }}/><small>Descargando… {percent}%</small></div>
        : <p>{state.status === 'error' ? state.error : 'Tu notas, cursos, música y actividad se conservan durante la actualización.'}</p>}
      {state.status !== 'downloading' && (
        <footer>
          <button className="btn-secondary" onClick={() => updaterStore.dismiss(version)}>Ahora no</button>
          <button className="btn-primary" onClick={() => { void updaterStore.install(); }}><Download size={15}/>Actualizar<ArrowUpRight size={15}/></button>
        </footer>
      )}
    </aside>,
    document.body,
  );
}
