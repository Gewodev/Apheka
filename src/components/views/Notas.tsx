import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Plus, Folder as FolderIcon, Pin, Trash2, 
  ChevronLeft, FolderPlus, 
  Star, FileText, Download,
  Bold, Italic, Underline, List, Heading, Code,
} from 'lucide-react';
import { useApp, Note } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.04)',
      borderLeft: `3px solid ${note.courseColor}`,
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column',
      padding: '12px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      minHeight: 80,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${note.courseColor}40`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ fontSize: 8, fontWeight: 600, color: note.courseColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{note.course}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 'auto' }}>{note.title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 500 }}>{format(new Date(note.updatedAt), 'd MMM')}</span>
        {note.isPinned && <Star size={10} fill="var(--accent)" color="var(--accent)" />}
      </div>
    </div>
  );
}

export default function Notas() {
  const { notes, noteFolders, addNote, updateNote, deleteNote, addNoteFolder } = useApp();

  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'pinned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const editorRef = useRef<HTMLDivElement>(null);
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const handleBold = useCallback(() => document.execCommand('bold'), []);
  const handleItalic = useCallback(() => document.execCommand('italic'), []);
  const handleUnderline = useCallback(() => document.execCommand('underline'), []);
  const handleBulletList = useCallback(() => document.execCommand('insertUnorderedList'), []);
  const handleHeading = useCallback(() => document.execCommand('formatBlock', false, 'h3'), []);
  const handleCode = useCallback(() => document.execCommand('insertHTML', false, '<code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;font-size:0.9em">$1</code>'), []);

  useEffect(() => {
    if (selectedNote && editorRef.current) {
      editorRef.current.innerHTML = selectedNote.content;
    }
  }, [selectedNoteId]);

  const handleSave = () => {
    if (!selectedNoteId || !selectedNote) return;
    const content = editorRef.current?.innerHTML || '';
    updateNote(selectedNote.id, { content });
    toast.success('Nota guardada');
  };

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = activeFolderId === 'all' ? true :
                         activeFolderId === 'pinned' ? n.isPinned :
                         activeFolderId === 'borradores' ? n.content.length < 50 :
                         n.folderId === activeFolderId;
    return matchesSearch && matchesFolder;
  });

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    addNoteFolder({ name: newFolderName.trim(), color: '#E11D48', isManual: true });
    setNewFolderName('');
    setShowFolderModal(false);
    toast.success('Carpeta creada');
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', overflow: 'hidden', position: 'relative' }}>
      
      <aside style={{ width: 200, borderRight: '1px solid rgba(255,255,255,0.04)', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 20, flexShrink: 0, boxShadow: '4px 0 24px rgba(0,0,0,0.15)' }}>
         <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
               <h2 style={{ fontSize: 13, fontWeight: 600 }}>Notas</h2>
               <button onClick={() => setShowFolderModal(true)} className="btn-ghost" style={{ padding: 3, cursor: 'pointer' }}><FolderPlus size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
               {[{ id: 'all', label: 'Todas', icon: FileText }, { id: 'pinned', label: 'Destacadas', icon: Star }].map(item => (
                 <button key={item.id} onClick={() => setActiveFolderId(item.id as any)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: activeFolderId === item.id ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent', border: 'none', color: activeFolderId === item.id ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms' }}>
                   <item.icon size={14} /> {item.label}
                 </button>
               ))}
            </div>
         </div>
         <div>
            <h3 style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 4px' }}>Carpetas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
               {noteFolders.map(folder => (
                 <button key={folder.id} onClick={() => setActiveFolderId(folder.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: activeFolderId === folder.id ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: activeFolderId === folder.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms' }}>
                   <FolderIcon size={14} style={{ color: folder.color }} /> {folder.name}
                 </button>
               ))}
            </div>
         </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selectedNoteId ? (
          <>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setActiveFolderId('all')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeFolderId === 'all' ? 'var(--accent)' : 'transparent', color: activeFolderId === 'all' ? '#fff' : 'var(--text-tertiary)' }}>Notas</button>
                  <button onClick={() => setActiveFolderId('borradores')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeFolderId === 'borradores' ? 'var(--accent)' : 'transparent', color: activeFolderId === 'borradores' ? '#fff' : 'var(--text-tertiary)' }}>Borradores</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 200 }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-base" style={{ paddingLeft: 28, fontSize: 10, height: 28, width: '100%' }} />
                </div>
                <button onClick={() => {
                  const newNote = addNote({ title: 'Nueva Nota', content: '', course: 'General', courseColor: '#E11D48', isPinned: false });
                  if (newNote) setSelectedNoteId(newNote);
                }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, height: 28, padding: '0 12px' }}>
                  <Plus size={13} /> Nueva
                </button>
              </div>
            </header>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {filteredNotes.map(note => (
                  <NoteCard key={note.id} note={note} onClick={() => setSelectedNoteId(note.id)} />
                ))}
              </div>
              {filteredNotes.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <FileText size={40} style={{ opacity: 0.1, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)' }}>Sin notas aún</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Crea una nueva nota para empezar</div>
                </div>
              )}
            </div>
          </>
        ) : null}

      {/* Editor panel — full screen if editing */}
      {selectedNoteId && selectedNote && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', overflow: 'hidden', minHeight: 0 }}>
          <header style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSelectedNoteId(null)} className="btn-ghost" style={{ padding: 3, cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
              <input type="text" value={selectedNote.title} onChange={e => updateNote(selectedNote.id, { title: e.target.value })} style={{ background: 'transparent', border: 'none', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', width: 400, padding: '2px 0' }} />
              {selectedNote.content.length < 10 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', background: 'var(--bg-base)', padding: '2px 8px', borderRadius: 4 }}>Borrador</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => updateNote(selectedNote.id, { isPinned: !selectedNote.isPinned })} className="btn-ghost" style={{ color: selectedNote.isPinned ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}><Pin size={15} /></button>
              <button onClick={handleSave} className="btn-primary" style={{ fontSize: 10, height: 28, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                Guardar
              </button>
              <button onClick={() => {
                const blob = new Blob([selectedNote.content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${selectedNote.title}.html`; a.click();
                URL.revokeObjectURL(url);
                toast.success('Nota descargada');
              }} className="btn-ghost" style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }} title="Descargar">
                <Download size={15} />
              </button>
              <button onClick={() => { deleteNote(selectedNote.id); setSelectedNoteId(null); }} className="btn-ghost" style={{ color: 'var(--error)', cursor: 'pointer', padding: 4, display: 'flex' }}><Trash2 size={15} /></button>
            </div>
          </header>

          {/* Rich text toolbar */}
          <div style={{ display: 'flex', gap: 2, padding: '6px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
            {[
              { icon: Bold, action: handleBold, label: 'Negrita' },
              { icon: Italic, action: handleItalic, label: 'Itálica' },
              { icon: Underline, action: handleUnderline, label: 'Subrayado' },
              { icon: Heading, action: handleHeading, label: 'Título' },
              { icon: List, action: handleBulletList, label: 'Lista' },
              { icon: Code, action: handleCode, label: 'Código' },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} title={btn.label} style={{ padding: '5px 7px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 150ms' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                <btn.icon size={14} />
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
            <div ref={editorRef} contentEditable style={{ minHeight: '100%', outline: 'none', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 800, margin: '0 auto' }} />
          </div>
        </div>
      )}

      </main>

      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowFolderModal(false)}>
           <div className="bento-card" style={{ width: 320, padding: 20 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Nueva Carpeta</h3>
              <input type="text" placeholder="Nombre de la carpeta" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="input-base" autoFocus />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                 <button onClick={() => setShowFolderModal(false)} className="btn-secondary" style={{ fontSize: 11, padding: '6px 14px' }}>Cancelar</button>
                 <button onClick={handleCreateFolder} className="btn-primary" style={{ fontSize: 11, padding: '6px 14px' }}>Crear</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
