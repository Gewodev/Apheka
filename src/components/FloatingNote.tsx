import { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bold, Italic, Image as ImageIcon, Minus, Expand } from 'lucide-react';
import { useApp } from '../store/AppContext';

export default function FloatingNote() {
  const { floatingNoteId, setFloatingNoteId, notes, updateNote, addNote } = useApp();
  const note = notes.find(n => n.id === floatingNoteId);

  const [pos, setPos] = useState({ x: 120, y: 80 });
  const [size, setSize] = useState({ w: 480, h: 360 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const resizeStart = useRef({ x: 0, y: 0, pw: 0, ph: 0 });
  const noteIdRef = useRef<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const zIndex = 9999;

  useEffect(() => {
    const id = floatingNoteId;
    if (!id) { noteIdRef.current = null; return; }
    noteIdRef.current = id;
    if (editorRef.current) {
      const n = notes.find(x => x.id === id);
      editorRef.current.innerHTML = n?.content || '';
    }
  }, [floatingNoteId, notes]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const id = noteIdRef.current;
    if (id) updateNote(id, { title: e.target.value });
  }, [updateNote]);

  const handleEditorInput = useCallback(() => {
    const id = noteIdRef.current;
    if (id && editorRef.current) {
      updateNote(id, { content: editorRef.current.innerHTML });
    }
  }, [updateNote]);

  const handleFormat = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    const id = noteIdRef.current;
    if (id && editorRef.current) updateNote(id, { content: editorRef.current.innerHTML });
  }, [updateNote]);

  const handleAddPhoto = useCallback(() => {
    photoInputRef.current?.click();
  }, []);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editorRef.current) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          document.execCommand("insertHTML", false, `<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:6px;margin:6px 0;" />`);
          const id = noteIdRef.current;
          if (id) updateNote(id, { content: editorRef.current!.innerHTML });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, [updateNote]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, pw: size.w, ph: size.h };
  }, [size]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: dragStart.current.px + (e.clientX - dragStart.current.x),
          y: dragStart.current.py + (e.clientY - dragStart.current.y),
        });
      }
      if (isResizing) {
        setSize({
          w: Math.max(300, resizeStart.current.pw + (e.clientX - resizeStart.current.x)),
          h: Math.max(200, resizeStart.current.ph + (e.clientY - resizeStart.current.y)),
        });
      }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, isResizing]);

  const handleNewNote = useCallback(() => {
    const id = addNote({
      title: 'Nota rápida',
      content: '',
      subtitle: '',
      course: '',
      courseColor: '',
      tags: [],
      isPinned: false,
    });
    setFloatingNoteId(id);
  }, [addNote, setFloatingNoteId]);

  if (!floatingNoteId) return null;
  if (!note) {
    return ReactDOM.createPortal(
      <div style={{
        position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h,
        background: 'var(--bg-elevated)', borderRadius: 12,
        boxShadow: '0 16px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        zIndex, backdropFilter: 'blur(20px)',
      }}>
        <div onMouseDown={handleMouseDown} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 14px', cursor: 'grab', userSelect: 'none',
          background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0, position: 'relative',
        }}>
          <div style={{ position: 'absolute', left: 12, display: 'flex', gap: 6 }}>
            <div onClick={() => setFloatingNoteId(null)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', cursor: 'pointer' }} />
            <div onClick={() => setIsMinimized(!isMinimized)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E', cursor: 'pointer' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Nota no encontrada</span>
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: isMinimized ? 40 : size.h,
      background: 'var(--bg-elevated)', borderRadius: 12,
      boxShadow: '0 16px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      zIndex, backdropFilter: 'blur(20px)',
      transition: isMinimized ? 'height 200ms ease' : 'none',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Title bar — Mac-style traffic lights */}
      <div onMouseDown={handleMouseDown} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10px 14px', cursor: 'grab', userSelect: 'none',
        background: 'rgba(255,255,255,0.02)', borderBottom: isMinimized ? 'none' : '1px solid var(--border-subtle)',
        flexShrink: 0, position: 'relative', minHeight: 40,
      }}>
        <div style={{ position: 'absolute', left: 12, display: 'flex', gap: 6 }}>
          <div onClick={() => setFloatingNoteId(null)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', cursor: 'pointer' }} title="Cerrar" />
          <div onClick={() => setIsMinimized(!isMinimized)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E', cursor: 'pointer' }} title={isMinimized ? 'Expandir' : 'Minimizar'} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} title="Poner al frente" />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.02em', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.title || 'Sin título'}
        </span>
        <span style={{ position: 'absolute', right: 12, fontSize: 10, color: 'var(--text-muted)' }}>
          {note.tags?.length ? note.tags[0] : ''}
        </span>
      </div>

      {!isMinimized && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Mini toolbar: bold, italic, photo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2, padding: '6px 12px',
            borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <button onClick={() => handleFormat('bold')} title="Negrita" style={{ width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-[var(--bg-hover)]"><Bold size={13} /></button>
            <button onClick={() => handleFormat('italic')} title="Cursiva" style={{ width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-[var(--bg-hover)]"><Italic size={13} /></button>
            <button onClick={handleAddPhoto} title="Añadir foto" style={{ width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-[var(--bg-hover)]"><ImageIcon size={13} /></button>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

          <div style={{ padding: '8px 14px 0' }}>
            <input
              ref={titleRef}
              type="text"
              defaultValue={note.title}
              placeholder="Título"
              onChange={handleTitleChange}
              style={{
                fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
                fontFamily: "'Outfit', sans-serif",
                background: 'transparent', border: 'none', outline: 'none',
                width: '100%', padding: 0, boxSizing: 'border-box',
                caretColor: 'var(--accent)',
              }}
            />
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            style={{
              flex: 1, outline: 'none', padding: '8px 14px 14px',
              fontSize: 13.5, lineHeight: 1.7,
              color: 'var(--text-primary)',
              fontFamily: "'Inter', system-ui, sans-serif",
              caretColor: 'var(--accent)',
              overflow: 'auto',
            }}
            onInput={handleEditorInput}
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
          cursor: 'nwse-resize', zIndex: 1,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', bottom: 3, right: 3 }}>
          <line x1="0" y1="10" x2="10" y2="0" stroke="var(--text-muted)" strokeWidth="1.5" opacity={0.4} />
          <line x1="3" y1="10" x2="10" y2="3" stroke="var(--text-muted)" strokeWidth="1.5" opacity={0.4} />
        </svg>
      </div>
    </div>,
    document.body
  );
}
