import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Type, Heading1, Heading2, List, ListOrdered, Quote, Code2, Minus, Table } from 'lucide-react';
type Command = {
    id: string;
    label: string;
    hint: string;
    icon: typeof Type;
    command?: string;
    value?: string;
    html?: string;
};
const commands: Command[] = [{ id: 'paragraph', label: 'Párrafo', hint: 'Texto para desarrollar una idea', icon: Type, command: 'formatBlock', value: 'p' }, { id: 'heading1', label: 'Título principal', hint: 'Sección de primer nivel', icon: Heading1, command: 'formatBlock', value: 'h1' }, { id: 'heading2', label: 'Encabezado', hint: 'Organiza una sección', icon: Heading2, command: 'formatBlock', value: 'h2' }, { id: 'list', label: 'Lista de puntos', hint: 'Ideas sin un orden fijo', icon: List, command: 'insertUnorderedList' }, { id: 'ordered', label: 'Lista numerada', hint: 'Pasos y procedimientos', icon: ListOrdered, command: 'insertOrderedList' }, { id: 'quote', label: 'Cita', hint: 'Un fragmento para destacar', icon: Quote, command: 'formatBlock', value: 'blockquote' }, { id: 'code', label: 'Código', hint: 'Un bloque de texto monoespaciado', icon: Code2, command: 'formatBlock', value: 'pre' }, { id: 'divider', label: 'Separador', hint: 'Una pausa dentro del documento', icon: Minus, html: '<hr><p><br></p>' }, { id: 'table', label: 'Tabla', hint: 'Dos columnas para comparar', icon: Table, html: '<table><tbody><tr><th>Concepto</th><th>Detalle</th></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>' }];
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
type Menu = {
    left: number;
    top: number;
    query: string;
    active: number;
};
export default function EditorBlockMenu() {
    const [menu, setMenu] = useState<Menu | null>(null), state = useRef<Menu | null>(null), popup = useRef<HTMLDivElement>(null), editor = useRef<HTMLElement | null>(null), selection = useRef<Range | null>(null);
    state.current = menu;
    const restore = () => { const host = editor.current, range = selection.current; if (!host?.isConnected || !range?.commonAncestorContainer.isConnected || !host.contains(range.commonAncestorContainer))
        return false; host.focus({ preventScroll: true }); const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(range); return true; };
    const close = () => setMenu(null);
    const choose = (item: Command) => { if (!restore()) {
        close();
        return;
    } if (item.html)
        document.execCommand('insertHTML', false, item.html);
    else
        document.execCommand(item.command!, false, item.value); editor.current?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatBlock' })); close(); };
    const actions = useRef({ restore, close, choose });
    actions.current = { restore, close, choose };
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (event.isComposing)
                return;
            if (event.ctrlKey || event.metaKey || event.altKey) {
                actions.current.close();
                return;
            }
            const open = state.current;
            if (open && !editor.current?.contains(document.activeElement)) {
                actions.current.close();
                return;
            }
            if (open) {
                const filtered = commands.filter(c => fold(c.label + ' ' + c.hint).includes(fold(open.query))), index = Math.min(open.active, Math.max(0, filtered.length - 1));
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    actions.current.restore();
                    actions.current.close();
                    return;
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    setMenu({ ...open, active: filtered.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0 });
                    return;
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    if (filtered[index])
                        actions.current.choose(filtered[index]);
                    return;
                }
                if (event.key === 'Backspace' || event.key.length === 1) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    setMenu({ ...open, query: event.key === 'Backspace' ? open.query.slice(0, -1) : (open.query + event.key).slice(0, 40), active: 0 });
                    return;
                }
                actions.current.close();
                return;
            }
            if (event.key !== '/')
                return;
            const element = event.target instanceof Element ? event.target : null, host = element?.closest<HTMLElement>('[contenteditable="true"]'), selected = window.getSelection();
            if (!host || !selected?.isCollapsed || !selected.rangeCount)
                return;
            const range = selected.getRangeAt(0);
            if (!host.contains(range.startContainer))
                return;
            const node = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement, block = node?.closest('p,h1,h2,h3,li,blockquote,pre') || host, before = range.cloneRange();
            before.selectNodeContents(block);
            before.setEnd(range.startContainer, range.startOffset);
            if (before.toString().trim() || block.querySelector('img,svg,table,video'))
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            editor.current = host;
            selection.current = range.cloneRange();
            const caret = range.getBoundingClientRect(), rect = caret.height ? caret : block.getBoundingClientRect();
            setMenu({ left: Math.max(12, Math.min(innerWidth - 292, rect.left)), top: Math.max(12, Math.min(innerHeight - 390, rect.bottom + 7)), query: '', active: 0 });
        }, outside = (event: PointerEvent) => { if (state.current && !popup.current?.contains(event.target as Node))
            actions.current.close(); }, scroll = (event: Event) => { if (state.current && !popup.current?.contains(event.target as Node))
            actions.current.close(); };
        document.addEventListener('keydown', key, true);
        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('scroll', scroll, true);
        return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', scroll, true); };
    }, []);
    useEffect(() => { popup.current?.querySelector<HTMLElement>('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [menu?.active]);
    if (!menu)
        return null;
    const filtered = commands.filter(c => fold(c.label + ' ' + c.hint).includes(fold(menu.query))), active = Math.min(menu.active, Math.max(0, filtered.length - 1));
    return createPortal(<div ref={popup} className="editor-block-menu" style={{ left: menu.left, top: menu.top }} role="listbox" aria-label="Insertar un bloque"><header><span>/ {menu.query || 'Insertar bloque'}</span><kbd>Esc</kbd></header><div>{filtered.map((item, index) => <button key={item.id} role="option" aria-selected={index === active} tabIndex={-1} onMouseDown={e => e.preventDefault()} onPointerEnter={() => setMenu({ ...menu, active: index })} onClick={() => choose(item)}><item.icon size={18}/><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}{!filtered.length && <p>No hay bloques con ese nombre.</p>}</div><footer>↑ ↓ para elegir · Entrar para insertar</footer></div>, document.body);
}
