import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Check } from 'lucide-react';

/* ═══ MENÚ CONTEXTUAL GLOBAL DE IMÁGENES ═══
   Cualquier <img> de la app (materiales, apuntes, portadas, adjuntos) abre al
   hacer clic derecho un menú minimalista: Copiar imagen / Descargar imagen.
   Se excluyen las imágenes dentro de editores contentEditable (apuntes) para
   no robar el menú nativo (pegar/deshacer). */

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface MenuState {
  url: string;
  alt: string;
  x: number;
  y: number;
}

export default function ImageContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLElement)) return;
      /* No interferir dentro de nuestro propio menú ni en editores rich-text */
      if (target.closest('[data-img-menu]')) return;
      if (target.closest('[contenteditable="true"]')) return;
      const img = target.closest('img');
      if (!img) return;
      const url = img.currentSrc || img.src;
      if (!url || url.startsWith('blob:')) return;
      e.preventDefault();
      e.stopPropagation();
      const w = 196, h = 104;
      setCopied(false);
      setMenu({
        url,
        alt: img.alt || img.getAttribute('title') || '',
        x: Math.max(4, Math.min(e.clientX, window.innerWidth - w - 8)),
        y: Math.max(4, Math.min(e.clientY, window.innerHeight - h - 8)),
      });
    };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    const onScroll = () => setMenu(null);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  const finishCopy = () => {
    setCopied(true);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1100);
    setTimeout(() => setMenu(null), 250);
  };

  const copyImage = async () => {
    if (!menu) return;
    try {
      const res = await fetch(menu.url);
      const blob = await res.blob();
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        await navigator.clipboard.writeText(menu.url);
        finishCopy();
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      finishCopy();
    } catch {
      try {
        await navigator.clipboard.writeText(menu.url);
        finishCopy();
      } catch { setMenu(null); }
    }
  };

  const downloadImage = async () => {
    if (!menu) return;
    try {
      const res = await fetch(menu.url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const safeName = (menu.alt || 'imagen').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'imagen';
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${safeName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
      setMenu(null);
    } catch { setMenu(null); }
  };

  if (!menu) return null;

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px',
    border: 'none', background: 'transparent', color: 'var(--text-secondary)',
    fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif",
    cursor: 'pointer', borderRadius: 8, transition: 'all 120ms ' + EASE,
    textAlign: 'left',
  };

  return createPortal(
    <div
      ref={menuRef}
      data-img-menu
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      style={{
        position: 'fixed', left: menu.x, top: menu.y, zIndex: 99997,
        width: 196, padding: 5, borderRadius: 12,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)',
        boxShadow: '0 16px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.05) inset',
        display: 'flex', flexDirection: 'column', gap: 1,
        animation: 'fadeInScale 130ms ' + EASE,
      }}
    >
      <button
        onClick={() => { void copyImage(); }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        style={itemStyle}
      >
        {copied ? <Check size={13} style={{ color: '#22C55E' }} /> : <Copy size={13} style={{ opacity: 0.8 }} />}
        {copied ? 'Imagen copiada' : 'Copiar imagen'}
      </button>
      <button
        onClick={() => { void downloadImage(); }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        style={itemStyle}
      >
        <Download size={13} style={{ opacity: 0.8 }} />
        Descargar imagen
      </button>
    </div>,
    document.body
  );
}