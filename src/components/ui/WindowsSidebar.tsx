import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  X, Plus, Link2, Pencil, Check, Trash2, Folder, FolderOpen, Globe,
  ChevronRight, ChevronDown, Copy, Shield, Clock, ExternalLink, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Modelo ───────────────────────────────────────────────────────────────────
export interface WinUrl { id: string; url: string; title?: string }
export interface WinFolder { id: string; name: string; parentId: string | null; urls: WinUrl[] }
export interface WinBlock { id: string; domain: string; from: string; to: string; enabled: boolean }
export interface WindowsState {
  folders: WinFolder[];
  blocks: WinBlock[];
  openRequests: { id: string; folderId: string; at: number; opener: string }[];
  lastOpener: string;
}

const STATE_KEY = 'owa_windows_v1';
const DEFAULT_STATE: WindowsState = { folders: [], blocks: [], openRequests: [], lastOpener: '' };
const EASE = 'cubic-bezier(0.16,1,0.3,1)';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function loadState(): WindowsState {
  try {
    const d = JSON.parse(localStorage.getItem(STATE_KEY) || '');
    return {
      folders: Array.isArray(d.folders) ? d.folders : [],
      blocks: Array.isArray(d.blocks) ? d.blocks : [],
      openRequests: Array.isArray(d.openRequests) ? d.openRequests : [],
      lastOpener: typeof d.lastOpener === 'string' ? d.lastOpener : '',
    };
  } catch { return { ...DEFAULT_STATE }; }
}

function cleanDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return s;
}

const DOMAIN_COLORS = ['#E11D48', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4'];

// Paleta de grupos de pestañas de Chrome + hash estable: cada carpeta tiene el
// MISMO color en la app y en la extensión (misma función en popup.js).
const GROUP_COLORS = ['#8AB4F8', '#78D9EC', '#81C995', '#FDD663', '#FABA6E', '#F28B82', '#F890CB', '#C58AF9'];
const folderColor = (id: string) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
};

interface Props { open: boolean; onClose: () => void }

export default function WindowsSidebar({ open, onClose }: Props) {
  const [state, setState] = useState<WindowsState>(loadState);
  const [editMode, setEditMode] = useState(false);
  const [codeModal, setCodeModal] = useState<{ code: string; left: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [linked, setLinked] = useState(false);
  const [browserCount, setBrowserCount] = useState(0);
  const [blockForm, setBlockForm] = useState<{ domain: string; from: string; to: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null);
  const [addingUrlIn, setAddingUrlIn] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState({ url: '', title: '' });
  const codeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTokens = useRef(0);
  // Espejos para el listener de Escape (evita capturar estados viejos)
  const codeModalRef = useRef<{ code: string; left: number } | null>(null);
  const blockFormRef = useRef<{ domain: string; from: string; to: string } | null>(null);
  codeModalRef.current = codeModal;
  blockFormRef.current = blockForm;

  const refreshStatus = useCallback(async (): Promise<number> => {
    try {
      const s = await invoke('windows_server_status') as any;
      const n = s && typeof s.tokens === 'number' ? s.tokens : 0;
      setLinked(n > 0);
      setBrowserCount(n);
      return n;
    } catch { return 0; }
  }, []);

  // persistir + empujar al servidor
  const push = useCallback((next: WindowsState) => {
    setState(next);
    try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch { }
    void invoke('windows_server_set_state', { state: JSON.stringify(next) }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!open) return;
    void invoke('windows_server_start').catch(() => { });
    void refreshStatus().then(n => { prevTokens.current = n; });
    // empuja el estado local más reciente por si la app se reinició con el servidor vacío
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) void invoke('windows_server_set_state', { state: raw }).catch(() => { });
    } catch { }
    let un: (() => void) | undefined;
    void listen<string>('windows-state-changed', e => {
      try {
        const incoming = JSON.parse(e.payload);
        setState({
          folders: Array.isArray(incoming.folders) ? incoming.folders : [],
          blocks: Array.isArray(incoming.blocks) ? incoming.blocks : [],
          openRequests: Array.isArray(incoming.openRequests) ? incoming.openRequests : [],
          lastOpener: typeof incoming.lastOpener === 'string' ? incoming.lastOpener : '',
        });
      } catch { }
    }).then(u => { un = u; });
    // conexión viva: sondeo del estado de vínculo mientras la barra está abierta;
    // si un navegador NUEVO aparece mientras el código está en pantalla, ciérralo solo
    const iv = setInterval(() => {
      void refreshStatus().then(n => {
        if (n > 0 && prevTokens.current === 0) {
          setCodeModal(c => {
            if (!c) return null;
            toast.success(`Extensión vinculada${n > 1 ? ` · ${n} navegadores` : ''}`);
            return null;
          });
        }
        prevTokens.current = n;
      });
    }, 4000);
    // Escape: cierra el formulario activo primero, luego la barra
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (codeModalRef.current) { setCodeModal(null); return; }
      if (blockFormRef.current) { setBlockForm(null); return; }
      onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => { if (un) un(); clearInterval(iv); window.removeEventListener('keydown', onEsc); };
  }, [open, refreshStatus, onClose]);

  // expiración del código
  useEffect(() => {
    if (!codeModal) { if (codeTimer.current) clearInterval(codeTimer.current); return; }
    codeTimer.current = setInterval(() => {
      setCodeModal(c => {
        if (!c) return null;
        if (c.left <= 1) { toast.error('El código de vínculo expiró'); return null; }
        return { ...c, left: c.left - 1 };
      });
    }, 1000);
    return () => { if (codeTimer.current) clearInterval(codeTimer.current); };
  }, [codeModal?.code]);

  const generateCode = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    try {
      await invoke('windows_server_register_code', { code });
      setCodeModal({ code, left: 300 });
      toast.success('Código activo por 5 minutos — pégalo en la extensión');
    } catch (e: any) { toast.error(String(e)); }
  };

  const copyCode = () => {
    if (!codeModal) return;
    navigator.clipboard.writeText(codeModal.code).then(() => toast.success('Código copiado')).catch(() => { });
  };

  // ── carpetas ──
  const childrenOf = (parentId: string | null) => state.folders.filter(f => f.parentId === parentId);
  const openFolder = (folderId: string) => {
    if (editMode) return;
    if (!linked) { toast.error('Vincula la extensión primero (icono de enlace)'); return; }
    // si hay más de un navegador vinculado, abre en el último que abrió
    const req = { id: uid(), folderId, at: Date.now(), opener: state.lastOpener || 'default' };
    push({ ...state, openRequests: [...state.openRequests.slice(-9), req] });
    const f = state.folders.find(x => x.id === folderId);
    toast.success(`Abriendo «${f?.name || 'carpeta'}» en el navegador vinculado`);
  };

  const addFolder = (parentId: string | null, name: string) => {
    if (!name.trim()) return;
    push({ ...state, folders: [...state.folders, { id: uid(), name: name.trim(), parentId, urls: [] }] });
    setNewFolderName(''); setCreatingFolderIn(null);
    if (parentId) setExpanded(prev => new Set(prev).add(parentId));
  };
  const renameFolder = (id: string, name: string) => {
    if (!name.trim()) return;
    push({ ...state, folders: state.folders.map(f => f.id === id ? { ...f, name: name.trim() } : f) });
  };
  const deleteFolder = (id: string) => {
    // elimina la carpeta y toda su descendencia
    const doomed = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      state.folders.forEach(f => { if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) { doomed.add(f.id); grew = true; } });
    }
    push({ ...state, folders: state.folders.filter(f => !doomed.has(f.id)) });
  };
  const addUrl = (folderId: string) => {
    let u = urlDraft.url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const title = urlDraft.title.trim() || cleanHost(u);
    push({ ...state, folders: state.folders.map(f => f.id === folderId ? { ...f, urls: [...f.urls, { id: uid(), url: u, title }] } : f) });
    setUrlDraft({ url: '', title: '' }); setAddingUrlIn(null);
  };
  const deleteUrl = (folderId: string, urlId: string) => {
    push({ ...state, folders: state.folders.map(f => f.id === folderId ? { ...f, urls: f.urls.filter(x => x.id !== urlId) } : f) });
  };

  // ── bloqueos ──
  const addBlock = () => {
    if (!blockForm) return;
    const domain = cleanDomain(blockForm.domain);
    if (!domain || !blockForm.from || !blockForm.to) { toast.error('Completa dominio y horario'); return; }
    push({ ...state, blocks: [...state.blocks, { id: uid(), domain, from: blockForm.from, to: blockForm.to, enabled: true }] });
    setBlockForm(null);
    toast.success(`${domain} se bloqueará de ${blockForm.from} a ${blockForm.to}`);
  };

  // ── árbol ──
  const renderFolder = (f: WinFolder, depth: number): React.ReactNode => {
    const kids = childrenOf(f.id);
    const isExpanded = expanded.has(f.id) || editMode;
    return (
      <div key={f.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 9,
          paddingLeft: 8 + depth * 16, border: '1px solid transparent', background: 'transparent',
          cursor: 'pointer', transition: `all 150ms ${EASE}`,
        }}
          onClick={() => openFolder(f.id)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
          {kids.length > 0
            ? <span onClick={e => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; }); }}
              title={isExpanded ? 'Colapsar' : 'Expandir'}
              style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', color: 'var(--text-muted)' }}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            : <span style={{ width: 14, flexShrink: 0 }} />}
          {isExpanded
            ? <FolderOpen size={14} style={{ color: folderColor(f.id), flexShrink: 0 }} />
            : <Folder size={14} style={{ color: folderColor(f.id), flexShrink: 0 }} />}
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
          {f.urls.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>{f.urls.length}</span>}
          {editMode && (
            <button onClick={e => { e.stopPropagation(); deleteFolder(f.id); }} title="Eliminar carpeta"
              style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
        {/* URLs de la carpeta */}
        {(isExpanded || f.urls.length > 0) && f.urls.map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 7, paddingLeft: 24 + depth * 16 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <Favicon url={u.url} />
            <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</span>
            {!editMode && (
              <button onClick={e => { e.stopPropagation(); window.open(u.url, '_blank'); }} title="Abrir aquí"
                style={{ width: 18, height: 18, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.5 }}>
                <ExternalLink size={10} />
              </button>
            )}
            {editMode && (
              <button onClick={e => { e.stopPropagation(); deleteUrl(f.id, u.id); }} title="Quitar"
                style={{ width: 18, height: 18, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        {/* añadir URL en edición */}
        {editMode && addingUrlIn === f.id && (
          <div style={{ padding: '4px 8px 6px', paddingLeft: 24 + depth * 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input autoFocus value={urlDraft.url} onChange={e => setUrlDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://…"
              style={{ height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 10.5, padding: '0 8px', outline: 'none' }} />
            <input value={urlDraft.title} onChange={e => setUrlDraft(d => ({ ...d, title: e.target.value }))} placeholder="Nombre (opcional)"
              style={{ height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 10.5, padding: '0 8px', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => addUrl(f.id)} style={{ flex: 1, height: 26, borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Añadir</button>
              <button onClick={() => { setAddingUrlIn(null); setUrlDraft({ url: '', title: '' }); }} style={{ height: 26, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
        {editMode && addingUrlIn !== f.id && (
          <div style={{ paddingLeft: 24 + depth * 16, paddingBottom: 2 }}>
            <button onClick={e => { e.stopPropagation(); setAddingUrlIn(f.id); }} title="Añadir página a la carpeta"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 9.5, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
              <Plus size={9} /> página
            </button>
          </div>
        )}
        {/* subcarpetas */}
        {isExpanded && kids.map(k => renderFolder(k, depth + 1))}
        {editMode && creatingFolderIn === f.id && (
          <div style={{ padding: '4px 8px 6px', paddingLeft: 24 + depth * 16 }}>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addFolder(f.id, newFolderName); if (e.key === 'Escape') setCreatingFolderIn(null); }}
              placeholder="Nombre de la subcarpeta…"
              style={{ width: '100%', height: 28, borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 10.5, padding: '0 8px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        {editMode && (
          <div style={{ paddingLeft: 24 + depth * 16, paddingBottom: 2 }}>
            <button onClick={e => { e.stopPropagation(); setCreatingFolderIn(f.id); setNewFolderName(''); }} title="Crear subcarpeta"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 9.5, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
              <Plus size={9} /> subcarpeta
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  const roots = childrenOf(null);
  const btn = (active?: boolean) => ({
    width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${active ? 'var(--accent)55' : 'var(--border-subtle)'}`,
    background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
  } as React.CSSProperties);

  return (
    <>
      {/* Fondo atenuado: clic fuera cierra la barra */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 98990, background: 'rgba(0,0,0,0.35)',
        animation: 'owaWindowsBack 200ms ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '92vw', zIndex: 99000,
        background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-default)',
        boxShadow: '-18px 0 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column',
        animation: `owaWindowsIn 260ms ${EASE}`,
      }}>
      <style>{`@keyframes owaWindowsIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } } @keyframes owaWindowsBack { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <img src="/owa_logo.png" alt="" width={28} height={28} style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', padding: 2, flexShrink: 0, boxSizing: 'border-box' }} />
        <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', flex: 1 }}>Ventanas</span>
        <button onClick={generateCode} title="Código de vínculo con la extensión (5 min)" style={btn(codeModal !== null)}>
          <Link2 size={14} />
        </button>
        <button onClick={() => setEditMode(v => !v)} title="Editar carpetas y páginas" style={btn(editMode)}>
          {editMode ? <Check size={14} /> : <Pencil size={13} />}
        </button>
        <button onClick={onClose} title="Cerrar (Alt+Q)" style={btn()}>
          <X size={14} />
        </button>
      </div>
      {/* Estado de vínculo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: linked ? '#10B981' : 'var(--text-tertiary)', boxShadow: linked ? '0 0 8px rgba(16,185,129,0.6)' : 'none', flexShrink: 0, transition: 'background 400ms' }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: linked ? 'var(--text-secondary)' : 'var(--text-tertiary)', letterSpacing: '0.06em', flex: 1 }}>
          {linked ? `Extensión vinculada${browserCount > 1 ? ` · ${browserCount} navegadores` : ''}` : 'Sin vincular'}
        </span>
        <button onClick={() => { void refreshStatus().then(n => { if (n === 0) toast('Ningún navegador vinculado aún'); }); }}
          title="Refrescar estado" style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 9.5, fontWeight: 600, padding: 0 }}>
          <RefreshCw size={9} /> refrescar
        </button>
      </div>

      {/* Código de vínculo */}
      {codeModal && (
        <div style={{ margin: '14px 18px 0', padding: 16, borderRadius: 14, border: `1px solid var(--accent)45`, background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)' }}>Código de vínculo</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(codeModal.left / 60)}:{String(codeModal.left % 60).padStart(2, '0')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.22em', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", flex: 1 }}>{codeModal.code}</span>
            <button onClick={copyCode} title="Copiar código"
              style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--accent)45', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Copy size={15} />
            </button>
          </div>
          {/* barra de expiración */}
          <div style={{ height: 3, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${(codeModal.left / 300) * 100}%`, height: '100%', background: codeModal.left < 60 ? '#F59E0B' : 'var(--accent)', borderRadius: 2, transition: 'width 1s linear, background 300ms' }} />
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 9, lineHeight: 1.6 }}>
            En la extensión del navegador: icono de OWA → pega el código → <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Vincular</b>. Al conectar, este panel se cierra solo.
          </div>
        </div>
      )}
      {/* Guía rápida si no hay vínculo ni código en pantalla */}
      {!linked && !codeModal && (
        <div style={{ margin: '12px 18px 0', padding: '11px 13px', borderRadius: 12, border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link2 size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5, flex: 1 }}>
            Vincula tu navegador con el icono <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>de enlace</b> para guardar y abrir carpetas de pestañas.
          </span>
        </div>
      )}

      {/* Árbol de carpetas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px' }} className="no-scrollbar">
        {roots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-tertiary)' }}>
            <Folder size={30} style={{ opacity: 0.25, marginBottom: 10 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>Sin carpetas aún</div>
            <div style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.5 }}>
              {editMode ? 'Crea la primera carpeta con el botón de abajo.' : 'Activa el modo edición (icono del lápiz) para crear carpetas de pestañas.'}
            </div>
          </div>
        )}
        {roots.map(f => renderFolder(f, 0))}
        {editMode && creatingFolderIn !== 'root' && (
          <button onClick={() => { setCreatingFolderIn('root'); setNewFolderName(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 9, border: `1.5px dashed var(--accent)45`, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, width: '100%', marginTop: 6, fontFamily: "'Inter Tight', sans-serif" }}>
            <Plus size={13} /> Nueva carpeta
          </button>
        )}
        {editMode && creatingFolderIn === 'root' && (
          <div style={{ padding: '6px 2px' }}>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addFolder(null, newFolderName); if (e.key === 'Escape') setCreatingFolderIn(null); }}
              placeholder="Nombre de la carpeta…"
              style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 11.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
      </div>

      {/* Bloqueo de páginas */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 18px 14px', flexShrink: 0, maxHeight: '38%', overflowY: 'auto' }} className="no-scrollbar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Shield size={10} /> Bloqueo de páginas
          </span>
          {editMode && !blockForm && (
            <button onClick={() => setBlockForm({ domain: '', from: '09:00', to: '12:00' })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 9.5, fontWeight: 700, padding: 0 }}>
              <Plus size={10} /> añadir
            </button>
          )}
        </div>
        {blockForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', marginBottom: 8 }}>
            <input autoFocus value={blockForm.domain} onChange={e => setBlockForm(f => f ? { ...f, domain: e.target.value } : f)} placeholder="ej. youtube.com"
              style={{ height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, padding: '0 8px', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Clock size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input type="time" value={blockForm.from} onChange={e => setBlockForm(f => f ? { ...f, from: e.target.value } : f)}
                style={{ flex: 1, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, padding: '0 6px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>a</span>
              <input type="time" value={blockForm.to} onChange={e => setBlockForm(f => f ? { ...f, to: e.target.value } : f)}
                style={{ flex: 1, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, padding: '0 6px', outline: 'none', colorScheme: 'dark' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addBlock} style={{ flex: 1, height: 28, borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>Bloquear</button>
              <button onClick={() => setBlockForm(null)} style={{ height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 10.5, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
        {state.blocks.length === 0 && !blockForm && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Bloquea dominios durante un horario para concentrarte. La extensión los intercepta en el navegador.
          </div>
        )}
        {state.blocks.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', marginBottom: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: b.enabled ? '#EF4444' : 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.domain}</span>
            <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{b.from}–{b.to}</span>
            {editMode && (
              <button onClick={() => push({ ...state, blocks: state.blocks.filter(x => x.id !== b.id) })} title="Eliminar bloqueo"
                style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}

function cleanHost(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u.slice(0, 30); }
}

// Favicon con fallback al globo si el dominio no sirve icono
function Favicon({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  const host = cleanHost(url);
  if (err || !host) return <Globe size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
  return (
    <span style={{ width: 14, height: 14, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" width={12} height={12} style={{ borderRadius: 2, display: 'block' }}
        onError={() => setErr(true)} />
    </span>
  );
}
