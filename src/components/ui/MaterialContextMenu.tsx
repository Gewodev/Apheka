import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, FolderOpen, FolderSearch } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { openFileSmart, resolveLocalPath } from '../../lib/openFileSmart';

export interface MatMenuEntry {
  url: string;
  name: string;
  color?: string;
}

interface MenuState {
  x: number;
  y: number;
  entry: MatMenuEntry;
}

const itemBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, height: 30, padding: '0 10px',
  borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  color: 'var(--text-secondary)', transition: 'background 100ms',
  fontFamily: "'Inter Tight', sans-serif", userSelect: 'none',
};

function Item({ icon, label, onClick, danger, accent }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; accent?: string;
}) {
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'var(--bg-hover)'; e.currentTarget.style.color = danger ? '#EF4444' : 'var(--text-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? '#EF4444' : 'var(--text-secondary)'; }}
      onClick={onClick}
      style={{ ...itemBase, color: danger ? '#EF4444' : 'var(--text-secondary)' }}
    >
      <span style={{ display: 'flex', width: 15, justifyContent: 'center', color: danger ? '#EF4444' : (accent || 'var(--text-muted)') }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

const Divider = () => <div style={{ height: 1, margin: '4px 6px', background: 'var(--border-subtle)' }} />;

function MenuPanel(props: {
  state: MenuState;
  close: () => void;
  runOpen: () => void;
  runReveal: () => void;
  runCopy: () => void;
}) {
  const { state, close, runOpen, runReveal, runCopy } = props;
  const { x, y, entry } = state;
  const inTauri = isTauri();
  const isLink = /^https?:\/\//i.test(entry.url);
  const isData = entry.url.startsWith('data:');
  const isLocal = !isLink && !isData;
  const menuW = 218;
  const menuH = 70 + (inTauri && isLocal ? 64 : 0) + 36;
  const posX = Math.max(8, Math.min(x, window.innerWidth - menuW - 8));
  const posY = Math.max(8, Math.min(y, window.innerHeight - menuH - 8));

  return (
    <div
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: posX, top: posY, zIndex: 99998, minWidth: menuW,
        borderRadius: 12, padding: 5,
        background: 'color-mix(in srgb, var(--bg-elevated) 94%, transparent)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-soft)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.42), 0 2px 8px rgba(0,0,0,0.25)',
        fontFamily: "'Inter Tight', sans-serif",
      }}
    >
      <div style={{ padding: '6px 10px 7px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4, maxWidth: menuW - 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name || 'Material'}
        </div>
      </div>

      <Item icon={<FolderOpen size={13} />} label="Abrir" accent={entry.color} onClick={runOpen} />
      {inTauri && isLocal && (
        <Item icon={<FolderSearch size={13} />} label="Mostrar en carpeta" onClick={runReveal} />
      )}
      <Divider />
      <Item icon={<Copy size={13} />} label={isLink ? 'Copiar enlace' : 'Copiar ruta'} onClick={runCopy} />
    </div>
  );
}

export function useMaterialMenu(notify?: (msg: string) => void) {
  const [state, setState] = useState<MenuState | null>(null);
  const stateRef = useRef<MenuState | null>(null);
  stateRef.current = state;

  const closeMenu = () => { setState(null); };

  // Listeners globales (Escape, clic fuera, blur, resize, scroll)
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    const onDown = (e: MouseEvent) => {
      const el = document.getElementById('owa-mat-menu');
      if (el && !el.contains(e.target as Node)) closeMenu();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [state]);

  // Montaje imperativo del menú (independiente del árbol del consumidor)
  useEffect(() => {
    let host = document.getElementById('owa-mat-menu');
    if (!state) {
      if (host) host.style.display = 'none';
      return;
    }
    if (!host) {
      host = document.createElement('div');
      host.id = 'owa-mat-menu';
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:99998;width:0;height:0;';
      document.body.appendChild(host);
    }
    host.style.display = '';
    const root = createRoot(host);
    root.render(
      <MenuPanel
        state={state}
        close={closeMenu}
        runOpen={runOpen}
        runReveal={runReveal}
        runCopy={runCopy}
      />
    );
    return () => { root.unmount(); };
  }, [state]);

  const toLocal = (url: string): string | null => {
    const m = url.match(/^https?:\/\/asset\.localhost\/(.+)$/);
    if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
    if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return null;
    return url;
  };

  // Patrón WhatsApp/Claude: intenta la ruta guardada DIRECTA primero; solo si falla
  // (archivo movido) resuelve por nombre.
  const resolveOrDirect = async (p: string, name: string): Promise<string> => {
    try { await statSafeLocal(p); return p; } catch { }
    const r = await resolveLocalPath(p, name);
    return r || p;
  };

  const statSafeLocal = async (p: string): Promise<void> => {
    const { stat } = await import('@tauri-apps/plugin-fs');
    const s = await stat(p);
    if (!s || s.isFile === false) throw new Error('not a file');
  };

  const runOpen = async () => {
    const s = stateRef.current;
    if (!s) return;
    const { url, name } = s.entry;
    closeMenu();
    await openFileSmart(url, name, { onError: (m) => notify?.(m) });
  };

  const runReveal = async () => {
    const s = stateRef.current;
    if (!s) return;
    const p = toLocal(s.entry.url);
    closeMenu();
    if (!p) { notify?.('Este material no es un archivo local'); return; }
    try {
      const resolved = await resolveOrDirect(p, s.entry.name);
      await revealItemInDir(resolved);
      // Windows crea la ventana de Explorer DETRÁS de la app (el proceso recién
      // lanzado no puede robar el foco). Minimizar + restaurar la app cede el foco
      // a Explorer y el foreground lock de Windows impide que la app se lo devuelva
      // al restaurarse → Explorer queda ENCIMA, delante de la app.
      if (isTauri()) {
        await new Promise(r => setTimeout(r, 400));
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        await win.minimize();
        await win.unminimize();
      }
    }
    catch { notify?.('No se pudo mostrar el archivo en su carpeta'); }
  };

  const runCopy = async () => {
    const s = stateRef.current;
    if (!s) return;
    const { url } = s.entry;
    const p = toLocal(url) || url;
    closeMenu();
    try { await navigator.clipboard.writeText(p); notify?.('Ruta copiada al portapapeles'); }
    catch { notify?.('No se pudo copiar la ruta'); }
  };

  const openMenu = (e: React.MouseEvent, entry: MatMenuEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, entry });
  };

  return { openMenu, closeMenu };
}
