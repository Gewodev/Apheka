import { useState, useEffect, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon } from 'lucide-react';

interface NotePayload {
  id: string;
  title: string;
  content: string;
  coverColor?: string;
  coverImage?: string;
}

export default function FloatingNoteWindow() {
  const [note, setNote] = useState<NotePayload | null>(null);
  const [title, setTitle] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const noteIdRef = useRef<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ch = new BroadcastChannel('owa_notes_sync');
    channelRef.current = ch;

    ch.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'OPEN_NOTE') {
        noteIdRef.current = data.noteId;
        setNote(data.note);
        setTitle(data.note.title || '');
        if (editorRef.current) {
          editorRef.current.innerHTML = data.note.content || '';
        }
      } else if (data.type === 'NOTE_UPDATED_FROM_MAIN') {
        if (data.noteId === noteIdRef.current && editorRef.current) {
          editorRef.current.innerHTML = data.content || '';
          setTitle(data.title || '');
        }
      }
    };

    ch.postMessage({ type: 'FLOATING_NOTE_READY' });
    return () => ch.close();
  }, []);

  const persist = useCallback(() => {
    if (!noteIdRef.current || !editorRef.current) return;
    channelRef.current?.postMessage({
      type: 'SAVE_NOTE',
      noteId: noteIdRef.current,
      content: editorRef.current.innerHTML,
      title,
    });
  }, [title]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setTimeout(persist, 0);
  }, [persist]);

  const handleInput = useCallback(() => {
    persist();
  }, [persist]);

  const handleFormat = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    persist();
  }, [persist]);

  const handlePhoto = useCallback(() => {
    photoRef.current?.click();
  }, []);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      document.execCommand("insertHTML", false, `<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:6px;margin:6px 0;" />`);
      persist();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [persist]);

  if (!note) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#1a1a2e',
        color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif', fontSize: 13,
        flexDirection: 'column', gap: 8,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>Nota flotante lista</span>
        <span style={{ fontSize: 10, color: '#555' }}>Selecciona "Abrir en flotante" desde una nota</span>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#fef9ef',
      color: '#1a1a1a',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Title */}
      <div style={{ padding: '16px 16px 8px' }}>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Título"
          style={{
            fontSize: 20, fontWeight: 600, fontFamily: "'Segoe UI', system-ui, sans-serif",
            background: 'transparent', border: 'none', outline: 'none',
            width: '100%', padding: 0, color: '#1a1a1a',
          }}
        />
      </div>

      {/* Mini toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '4px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        {[
          { cmd: 'bold', icon: Bold },
          { cmd: 'italic', icon: Italic },
          { cmd: 'underline', icon: Underline },
          { cmd: 'insertUnorderedList', icon: List },
          { cmd: 'insertOrderedList', icon: ListOrdered },
        ].map(b => (
          <button key={b.cmd} onClick={() => handleFormat(b.cmd)}
            style={{
              width: 28, height: 28, borderRadius: 4,
              border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#555',
            }}
            className="hover:bg-black/10">
            <b.icon size={14} />
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />
        <button onClick={handlePhoto}
          style={{
            width: 28, height: 28, borderRadius: 4,
            border: 'none', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#555',
          }}
          className="hover:bg-black/10">
          <ImageIcon size={14} />
        </button>
        <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          flex: 1, outline: 'none', padding: '10px 16px 16px',
          fontSize: 14, lineHeight: 1.7, overflow: 'auto',
          color: '#1a1a1a', caretColor: '#2563eb',
        }}
        onInput={handleInput}
      />
    </div>
  );
}
