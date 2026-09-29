import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, FolderOpen, FolderSearch, ChevronRight, ExternalLink, Check, Palette } from 'lucide-react';
import { isTauri, convertFileSrc } from '@tauri-apps/api/core';
import { revealItemInDir, openPath, openUrl as openUrlSystem } from '@tauri-apps/plugin-opener';
import { openFileSmart, resolveLocalPath } from '../../lib/openFileSmart';
import { BrowserIcon, PdfAppIcon } from './BrowserIcons';
import {
  DetectedBrowser,
  PdfApp,
  getInstalledBrowsers,
  getPdfApps,
  getDefaultBrowserId,
  getSelectedCourseName,
  setDefaultBrowser,
  getDefaultPdfAppId,
  setDefaultPdfApp,
  openUrlInBrowser,
} from '../../lib/browsers';

export interface MatMenuEntry {
  url: string;
  name: string;
  color?: string;
  courseId?: string;
  onMoveToGroup?: () => void;
  onRemoveFromGroup?: () => void;
  // Acciones por lote sobre TODAS las herramientas/archivos del tema
  onBatchColor?: (color: string) => void;
  onOpenAll?: () => void;
  // Selección por presión larga: abre los materiales marcados
  onOpenSelected?: () => void;
  selectedCount?: number;
}

interface MenuState {
  x: number;
  y: number;
  entry: MatMenuEntry;
}

const Z_MENU = 100001;
const Z_MODAL = 100002;

const itemBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, height: 30, padding: '0 10px',
  borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  color: 'var(--text-secondary)', transition: 'background 100ms',
  fontFamily: "'Inter Tight', sans-serif", userSelect: 'none',
};

function Item({ icon, label, onClick, danger, accent, trailing }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; accent?: string; trailing?: React.ReactNode;
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
      {trailing}
    </div>
  );
}

const Divider = () => <div style={{ height: 1, margin: '4px 6px', background: 'var(--border-subtle)' }} />;

// Ventana de confirmación de predeterminado (long-press en navegador o app PDF)
function DefaultBrowserModal({ browserName, courseName, kind, onPick, onCancel }: {
  browserName: string; courseName?: string; kind: 'browser' | 'pdf';
  onPick: (scope: 'course' | 'global') => void; onCancel: () => void;
}) {
  const hasCourse = !!courseName;
  const isPdf = kind === 'pdf';
  return (
    <>
      <div onClick={onCancel} onContextMenu={e => { e.preventDefault(); onCancel(); }} onMouseDown={e => e.stopPropagation()}
        style={{ position: 'fixed', inset: 0, zIndex: Z_MODAL, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
      <div
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: Z_MODAL + 1, width: 340, borderRadius: 14, padding: '16px 18px 14px',
          background: 'color-mix(in srgb, var(--bg-elevated) 96%, transparent)',
          backdropFilter: 'blur(18px)', border: '1px solid var(--border-soft)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          fontFamily: "'Inter Tight', sans-serif", animation: 'fadeInScale 160ms ease',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          ¿Cambiar a {browserName} como predeterminado?
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.45, marginBottom: 13 }}>
          {isPdf
            ? `Los PDF se abrirán con esta aplicación${hasCourse ? `. Elige si solo para ${courseName} o en todos los cursos.` : ' en todos los cursos.'}`
            : `Los enlaces se abrirán con este navegador${hasCourse ? `. Elige si solo para ${courseName} o en todos los cursos.` : ' en todos los cursos.'}`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {hasCourse && (
            <button
              onClick={() => onPick('course')}
              style={{ height: 32, borderRadius: 8, border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: "'Inter Tight', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 16%, transparent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; }}
            >
              Para {courseName}
            </button>
          )}
          <button
            onClick={() => onPick('global')}
            style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: "'Inter Tight', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
          >
            Para todos los cursos
          </button>
          <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
            Haz clic fuera para no cambiar nada
          </div>
        </div>
      </div>
    </>
  );
}

const BATCH_COLORS = ['#E11D48', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F4F4F5'];

function BatchColorRow({ onPick }: { onPick: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Item icon={<Palette size={13} />} label="Color para todas…" accent="#3B82F6" onClick={() => setOpen(o => !o)} />
      {open && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '6px 10px 8px', background: 'var(--bg-deep)', borderRadius: 8, margin: '2px 6px' }}>
          {BATCH_COLORS.map(c => (
            <button key={c} onClick={() => onPick(c)} title={c}
              style={{ width: 18, height: 18, borderRadius: 6, background: c, border: '1px solid var(--border-subtle)', cursor: 'pointer', padding: 0 }} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuPanel(props: {
  state: MenuState;
  close: () => void;
  runOpen: () => void;
  runReveal: () => void;
  runCopy: () => void;
  runOpenAppPdf: () => void;
  openPdfWithApp: (exe: string) => void;
  resolveToOpenable: (url: string) => Promise<string>;
  notify?: (msg: string) => void;
}) {
  const { state, close, runOpen, runReveal, runCopy, runOpenAppPdf, openPdfWithApp, resolveToOpenable, notify } = props;
  const { x, y, entry } = state;
  const inTauri = isTauri();
  const isLink = /^https?:\/\//i.test(entry.url);
  const isData = entry.url.startsWith('data:');
  const isLocal = !isLink && !isData;
  const isPdf = /\.pdf($|[?#])/i.test(entry.url) || entry.url.startsWith('data:application/pdf');
  const canOpenWith = isLink || isPdf;

  const [subOpen, setSubOpen] = useState(false);
  const [browsers, setBrowsers] = useState<DetectedBrowser[]>([]);
  const [pdfApps, setPdfApps] = useState<PdfApp[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [defaultPdfId, setDefaultPdfId] = useState<string | null>(null);
  const [defaultModal, setDefaultModal] = useState<{ id: string; name: string; kind: 'browser' | 'pdf'; exe?: string } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const armDefaultPress = (item: { id: string; name: string; kind: 'browser' | 'pdf'; exe?: string }) => {
    longPressedRef.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longPressedRef.current = true; setDefaultModal(item); }, 500);
  };
  const disarmDefaultPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const selCourseId = (): string | undefined => {
    try { return entry.courseId ?? (localStorage.getItem('owa_selected_course_id') || undefined); } catch { return undefined; }
  };
  const [courseName, setCourseName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!inTauri || !canOpenWith) return;
    let alive = true;
    (async () => {
      const list = await getInstalledBrowsers();
      if (!alive) return;
      setBrowsers(list);
      if (isPdf) {
        const apps = await getPdfApps();
        if (!alive) return;
        setPdfApps(apps);
      }
      setDefaultId(getDefaultBrowserId(selCourseId()));
      setDefaultPdfId(getDefaultPdfAppId(selCourseId()));
      setCourseName(getSelectedCourseName());
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTauri, isLink, entry.courseId]);

  useEffect(() => () => { if (pressTimer.current) clearTimeout(pressTimer.current); }, []);

  const openWith = async (b: DetectedBrowser) => {
    close();
    try { await openUrlInBrowser(b.exe, await resolveToOpenable(entry.url)); }
    catch (e) { console.warn(e); }
  };

  const openWithExe = async (exe: string) => {
    close();
    try { await openUrlInBrowser(exe, await resolveToOpenable(entry.url)); }
    catch (e) { console.warn(e); }
  };

  // Guarda el predeterminado, lo VERIFICA releyendo y lo ejecuta al instante
  // con este material. Así "queda guardado" y "se ejecuta como tal".
  const pickDefault = (scope: 'course' | 'global') => {
    if (!defaultModal) return;
    const picked = defaultModal;
    const cid = scope === 'course' ? selCourseId() : undefined;
    const where = scope === 'course' ? 'este curso' : 'toda la app';
    if (picked.kind === 'pdf') {
      setDefaultPdfApp(picked.id, cid);
      const check = getDefaultPdfAppId(cid ?? selCourseId());
      setDefaultPdfId(getDefaultPdfAppId(selCourseId()));
      setDefaultModal(null);
      if (check !== picked.id) { notify?.('No se pudo guardar el predeterminado'); return; }
      notify?.(`PDF predeterminado: ${picked.name} (${where})`);
      if (picked.exe) openPdfWithApp(picked.exe);
      else runOpenAppPdf();
    } else {
      setDefaultBrowser(picked.id, cid);
      const check = getDefaultBrowserId(cid ?? selCourseId());
      setDefaultId(getDefaultBrowserId(selCourseId()));
      setDefaultModal(null);
      if (check !== picked.id) { notify?.('No se pudo guardar el predeterminado'); return; }
      notify?.(`Navegador predeterminado: ${picked.name} (${where})`);
      if (picked.exe) openWith({ id: picked.id, name: picked.name, exe: picked.exe });
    }
  };

  const showSubmenu = subOpen && browsers.length > 0;

  const menuW = 226;
  const baseH = 70 + (inTauri && isLocal ? 64 : 0) + 36 + (canOpenWith && browsers.length > 0 ? 34 : 0) + (isPdf ? 30 : 0);
  const menuH = baseH + (showSubmenu ? Math.min(browsers.length, 6) * 32 + 8 : 0);
  const posX = Math.max(8, Math.min(x, window.innerWidth - menuW - 8));
  const rawPosY = Math.max(8, Math.min(y, window.innerHeight - Math.min(menuH, 420) - 8));

  // Anti-tapado: tras renderizar se mide la altura REAL del panel y se re-clampa,
  // así nunca queda cortado aunque el material esté abajo del todo.
  const panelRef = useRef<HTMLDivElement>(null);
  const [adjTop, setAdjTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    const maxTop = window.innerHeight - h - 8;
    setAdjTop(rawPosY > maxTop ? Math.max(8, maxTop) : null);
  }, [rawPosY, subOpen, browsers.length]);

  return (
    <>
      {defaultModal && (
        <DefaultBrowserModal
          browserName={defaultModal.name}
          courseName={selCourseId() ? (courseName || 'este curso') : undefined}
          kind={defaultModal.kind}
          onPick={pickDefault}
          onCancel={() => setDefaultModal(null)}
        />
      )}
      <div
        id="owa-mat-menu-panel"
        ref={panelRef}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: posX, top: adjTop ?? rawPosY, zIndex: Z_MENU, minWidth: menuW,
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

        {(!canOpenWith || !inTauri || (browsers.length === 0 && pdfApps.length === 0)) && (
          <Item icon={<FolderOpen size={13} />} label="Abrir" accent={entry.color} onClick={runOpen} />
        )}
        {inTauri && canOpenWith && (browsers.length > 0 || pdfApps.length > 0) && (
          <Item
            icon={<ExternalLink size={13} />}
            label="Abrir con"
            onClick={() => setSubOpen(v => !v)}
            trailing={
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                {defaultId && <span title="Predeterminado"><Check size={11} /></span>}
                <ChevronRight size={12} style={{ transform: subOpen ? 'rotate(90deg)' : 'none', transition: 'transform 140ms' }} />
              </span>
            }
          />
        )}
        {showSubmenu && (
          <div style={{ margin: '3px 4px 2px', paddingTop: 3, borderTop: '1px dashed var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 220, overflowY: 'auto' }}>
            {isPdf && pdfApps.length === 0 && (
              <div
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; disarmDefaultPress(); }}
                onMouseDown={() => armDefaultPress({ id: 'sys', name: 'App de PDF del sistema', kind: 'pdf' })}
                onMouseUp={disarmDefaultPress}
                onClick={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } runOpenAppPdf(); }}
                title={`App de PDF del sistema${defaultPdfId === 'sys' ? ' · predeterminado' : ''} — mantén pulsado para predeterminar`}
                style={{ ...itemBase, height: 28 }}
              >
                <span style={{ display: 'flex', width: 17, justifyContent: 'center' }}><PdfAppIcon id="sys" size={15} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>App de PDF del sistema</span>
                {defaultPdfId === 'sys' && <Check size={11} style={{ color: 'var(--accent)' }} />}
              </div>
            )}
            {isPdf && pdfApps.map(a => (
              <div
                key={a.id}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; disarmDefaultPress(); }}
                onMouseDown={() => armDefaultPress({ id: a.id, name: a.name, kind: 'pdf', exe: a.exe })}
                onMouseUp={disarmDefaultPress}
                onClick={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } openWithExe(a.exe); }}
                title={`Abrir con ${a.name}${defaultPdfId === a.id ? ' · predeterminado' : ''} — mantén pulsado para predeterminar`}
                style={{ ...itemBase, height: 28 }}
              >
                <span style={{ display: 'flex', width: 17, justifyContent: 'center' }}><PdfAppIcon id={a.id} size={15} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                {defaultPdfId === a.id && <Check size={11} style={{ color: 'var(--accent)' }} />}
              </div>
            ))}
            {browsers.map(b => (
              <div
                key={b.id}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; disarmDefaultPress(); }}
                onMouseDown={() => armDefaultPress({ id: b.id, name: b.name, kind: 'browser', exe: b.exe })}
                onMouseUp={disarmDefaultPress}
                onClick={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } openWith(b); }}
                title={`${b.name}${getDefaultBrowserId(entry.courseId) === b.id ? ' · predeterminado' : ''} — mantén pulsado para predeterminar`}
                style={{ ...itemBase, height: 28 }}
              >
                <span style={{ display: 'flex', width: 17, justifyContent: 'center' }}><BrowserIcon id={b.id} size={15} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                {defaultId === b.id && <Check size={11} style={{ color: 'var(--accent)' }} />}
              </div>
            ))}
          </div>
        )}
        {inTauri && isLocal && !isPdf && (
          <Item icon={<FolderSearch size={13} />} label="Mostrar en carpeta" onClick={runReveal} />
        )}
        {entry.onOpenSelected && (
          <Item
            icon={<Check size={13} />}
            label={`Abrir seleccionados (${entry.selectedCount ?? 0})`}
            accent="#E11D48"
            onClick={() => { close(); entry.onOpenSelected!(); }}
          />
        )}
        {entry.onOpenSelected && <Divider />}
        {entry.onBatchColor && <BatchColorRow onPick={c => { close(); entry.onBatchColor!(c); }} />}
        {entry.onOpenAll && (
          <Item icon={<FolderOpen size={13} />} label="Abrir todos los recursos" accent="#10B981" onClick={() => { close(); entry.onOpenAll!(); }} />
        )}
        {entry.onMoveToGroup && (
          <Item icon={<FolderOpen size={13} />} label="Mover a grupo" accent="#8B5CF6" onClick={() => { close(); entry.onMoveToGroup!(); }} />
        )}
        {entry.onRemoveFromGroup && (
          <Item icon={<ExternalLink size={13} />} label="Sacar del grupo" accent="#F59E0B" onClick={() => { close(); entry.onRemoveFromGroup!(); }} />
        )}
        {(!isPdf) && <Divider />}
        {(!isPdf) && (
          <Item icon={<Copy size={13} />} label={isLink ? 'Copiar enlace' : 'Copiar ruta'} onClick={runCopy} />
        )}
      </div>
    </>
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

  // Montaje imperativo del menú: el root se crea UNA sola vez y persiste.
  // Nunca unmount síncrono durante el render (evita el warning de React 19);
  // al cerrar solo se renderiza null y se oculta el host.
  const rootRef = useRef<any>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let host = document.getElementById('owa-mat-menu');
    if (!host) {
      host = document.createElement('div');
      host.id = 'owa-mat-menu';
      host.style.cssText = `position:fixed;left:0;top:0;z-index:${Z_MENU};width:0;height:0;`;
      document.body.appendChild(host);
    }
    hostRef.current = host;
    if (!rootRef.current) {
      rootRef.current = createRoot(host);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) return;
    if (!state) {
      host.style.display = 'none';
      root.render(null);
      return;
    }
    host.style.display = '';
      root.render(
        <MenuPanel
          state={state}
          close={closeMenu}
          runOpen={runOpen}
          runReveal={runReveal}
          runCopy={runCopy}
          runOpenAppPdf={runOpenAppPdf}
          openPdfWithApp={openPdfWithApp}
          resolveToOpenable={resolveToOpenable}
          notify={notify}
        />
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const readCourseId = (): string | undefined => {
    try { return localStorage.getItem('owa_selected_course_id') || undefined; } catch { return undefined; }
  };

  // Convierte cualquier entrada (http / ruta local / data) en URL abrible:
  // http queda igual; rutas locales se exponen vía asset protocol.
  const resolveToOpenable = async (url: string): Promise<string> => {
    if (/^https?:\/\//i.test(url)) return url;
    const loc = toLocal(url);
    if (loc) {
      const resolved = await resolveOrDirect(loc, stateRef.current?.entry.name || '');
      return convertFileSrc(resolved);
    }
    return url;
  };

  const openPdfWithApp = async (exe: string): Promise<void> => {
    const s = stateRef.current;
    if (!s) return;
    closeMenu();
    try {
      const loc = toLocal(s.entry.url);
      if (loc) {
        const resolved = await resolveOrDirect(loc, s.entry.name);
        // Con la app ELEGIDA (no la del sistema): se abre vía asset URL.
        await openUrlInBrowser(exe, convertFileSrc(resolved));
        return;
      }
      await openUrlInBrowser(exe, s.entry.url);
    } catch { notify?.('No se pudo abrir el PDF'); }
  };

  const runOpen = async () => {
    const s = stateRef.current;
    if (!s) return;
    const { url, name } = s.entry;
    closeMenu();
    // Enlaces: si hay navegador predeterminado (curso > global), ábrelo CON ESE navegador
    if (isTauri() && /^https?:\/\//i.test(url)) {
      try {
        const { resolveDefaultBrowserExe } = await import('../../lib/browsers');
        const exe = await resolveDefaultBrowserExe(s.entry.courseId ?? readCourseId());
        if (exe) {
          await openUrlInBrowser(exe, url);
          return;
        }
      } catch { /* cae al flujo normal */ }
    }
    // PDF local: si hay app PDF predeterminada (curso > global), úsala
    if (isTauri() && /\.pdf($|[?#])/i.test(url)) {
      try {
        const { resolveDefaultPdfAppExe } = await import('../../lib/browsers');
        const exe = await resolveDefaultPdfAppExe(s.entry.courseId ?? readCourseId());
        if (exe === 'sys') {
          await runOpenAppPdfInner(url, name);
          return;
        }
        if (exe) {
          const loc = toLocal(url);
          const target = loc ? convertFileSrc(await resolveOrDirect(loc, name)) : url;
          await openUrlInBrowser(exe, target);
          return;
        }
      } catch { /* cae al flujo normal */ }
    }
    await openFileSmart(url, name, { onError: (m) => notify?.(m) });
  };

  const runOpenAppPdfInner = async (url: string, name: string) => {
    try {
      const loc = toLocal(url);
      if (loc) {
        const resolved = await resolveOrDirect(loc, name);
        await openPath(resolved);
      } else {
        await openFileSmart(url, name, { onError: (m) => notify?.(m) });
      }
    } catch { notify?.('No se pudo abrir con una aplicación'); }
  };

  const runOpenAppPdf = async () => {
    const s = stateRef.current;
    if (!s) return;
    const { url, name } = s.entry;
    closeMenu();
    try {
      const loc = toLocal(url);
      if (loc) {
        const resolved = await resolveOrDirect(loc, name);
        await openPath(resolved);
      } else {
        // data:/http → el sistema decide la app PDF
        await openFileSmart(url, name, { onError: (m) => notify?.(m) });
      }
    } catch { notify?.('No se pudo abrir con una aplicación'); }
  };

  const runOpenBrowserPdf = async () => {
    const s = stateRef.current;
    if (!s) return;
    const { url } = s.entry;
    closeMenu();
    try {
      if (/^https?:\/\//i.test(url)) { await openUrlSystem(url); return; }
      const loc = toLocal(url);
      if (loc) {
        const resolved = await resolveOrDirect(loc, s.entry.name);
        await openUrlSystem(convertFileSrc(resolved));
        return;
      }
      await openUrlSystem(url);
    } catch { notify?.('No se pudo abrir en el navegador'); }
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
    try { await navigator.clipboard.writeText(p); notify?.(toLocal(url) ? 'Ruta copiada al portapapeles' : 'Enlace copiado al portapapeles'); }
    catch { notify?.('No se pudo copiar'); }
  };

  const openMenu = (e: React.MouseEvent, entry: MatMenuEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, entry });
  };

  return { openMenu, closeMenu };
}
