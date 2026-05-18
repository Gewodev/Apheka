import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Search, Plus, Folder as FolderIcon, Pin, Trash2, 
  ChevronLeft, FolderPlus, Star, FileText, Download,
  Bold, Italic, Underline, List, Heading, Code, BookOpen,
  Wifi, Bell, CheckCircle, Tag, ArrowUp, ArrowDown, Clock, Eye
} from 'lucide-react';
import { useApp, Note } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const AVAILABLE_TAGS = [
  'Examen', 'Resumen', 'Fórmula', 'Proyecto', 
  'Investigación', 'Lectura', 'Ideas', 'Importante'
];

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const priorityColors = {
    high: { bg: 'rgba(239,68,68,0.1)', text: '#EF4444', label: 'Alta' },
    medium: { bg: 'rgba(245,158,11,0.1)', text: '#F59E0B', label: 'Media' },
    low: { bg: 'rgba(16,185,129,0.1)', text: '#10B981', label: 'Baja' }
  };

  const pConf = priorityColors[note.priority || 'medium'];

  return (
    <div className="bento-card hover-lift" onClick={onClick} style={{
      background: 'var(--bg-surface)',
      borderRadius: 14,
      border: '1px solid var(--border-subtle)',
      borderLeft: `4px solid ${note.courseColor || 'var(--accent)'}`,
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column',
      padding: '18px 20px',
      transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      minHeight: 140,
      position: 'relative',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: note.courseColor || 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {note.course || 'General'}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, background: pConf.bg, color: pConf.text, padding: '2px 6px', borderRadius: 6 }}>
            {pConf.label}
          </span>
        </div>
        {note.isPinned && <Star size={14} fill="var(--accent)" color="var(--accent)" />}
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>
        {note.title || 'Sin título'}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', display: '-webkit-box', marginBottom: 'auto', lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]+>/g, '').slice(0, 110) || 'Sin contenido...' }} 
      />

      {/* Tags / Characteristics */}
      {note.tags && note.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12, marginBottom: 4 }}>
          {note.tags.slice(0, 3).map(t => (
            <span key={t} style={{ fontSize: 9, background: 'var(--bg-deep)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
              #{t}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', alignSelf: 'center' }}>+{note.tags.length - 3}</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{format(new Date(note.updatedAt || Date.now()), "d MMM yyyy", { locale: es })}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '2px 8px', borderRadius: 6 }}>Nota</span>
      </div>
    </div>
  );
}

export default function Notas() {
  const { notes, noteFolders, courses, addNote, updateNote, deleteNote, addNoteFolder } = useApp();

  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'pinned' | 'borradores'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  
  // Real-time clock for header
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const editorRef = useRef<HTMLDivElement>(null);
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const handleBold = useCallback(() => document.execCommand('bold'), []);
  const handleItalic = useCallback(() => document.execCommand('italic'), []);
  const handleUnderline = useCallback(() => document.execCommand('underline'), []);
  const handleBulletList = useCallback(() => document.execCommand('insertUnorderedList'), []);
  const handleHeading = useCallback(() => document.execCommand('formatBlock', false, 'h3'), []);
  const handleCode = useCallback(() => document.execCommand('insertHTML', false, '<code style="background:var(--bg-deep);padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:monospace;border:1px solid var(--border-subtle)">$1</code>'), []);

  useEffect(() => {
    if (selectedNote && editorRef.current) {
      if (editorRef.current.innerHTML !== selectedNote.content) {
        editorRef.current.innerHTML = selectedNote.content;
      }
    }
  }, [selectedNoteId]);

  const handleSave = () => {
    if (!selectedNoteId || !selectedNote) return;
    const content = editorRef.current?.innerHTML || '';
    updateNote(selectedNote.id, { content });
    toast.success('Nota guardada exitosamente');
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = activeFolderId === 'all' ? true :
                           activeFolderId === 'pinned' ? n.isPinned :
                           activeFolderId === 'borradores' ? n.content.length < 50 :
                           n.folderId === activeFolderId;
      const matchesTag = selectedTag ? n.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesFolder && matchesTag;
    });
  }, [notes, searchQuery, activeFolderId, selectedTag]);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    addNoteFolder({ name: newFolderName.trim(), color: '#8B5CF6', isManual: true });
    setNewFolderName('');
    setShowFolderModal(false);
    toast.success('Carpeta creada exitosamente');
  };

  const toggleNoteTag = (tag: string) => {
    if (!selectedNote) return;
    const currentTags = selectedNote.tags || [];
    const newTags = currentTags.includes(tag) 
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    updateNote(selectedNote.id, { tags: newTags });
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTagInput.trim() && selectedNote) {
      const tag = customTagInput.trim();
      const currentTags = selectedNote.tags || [];
      if (!currentTags.includes(tag)) {
        updateNote(selectedNote.id, { tags: [...currentTags, tag] });
      }
      setCustomTagInput('');
    }
  };

  // Editor stats calculation
  const editorStats = useMemo(() => {
    if (!selectedNote) return { words: 0, chars: 0, readingTime: 0 };
    const text = selectedNote.content.replace(/<[^>]+>/g, '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const readingTime = Math.ceil(words / 200); // 200 words per minute average
    return { words, chars, readingTime };
  }, [selectedNote?.content]);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HEADER ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8, flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Notas</h1>
            <BookOpen size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>
            Sistema de captura de conocimiento estructurado. Escribe, clasifica y organiza.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Bell size={16} /></button>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <div className="led-display" style={{ fontSize: 28, lineHeight: 1 }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 14 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA (SIDEBAR + NOTES GRID/EDITOR) */}
      <div style={{ display: 'flex', flex: 1, gap: 24, minHeight: 600, alignItems: 'flex-start' }}>
        
        {/* INNER SIDEBAR */}
        <aside className="bento-card" style={{ width: 250, padding: '20px 16px', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column', gap: 24, flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Navegación</h2>
              <button onClick={() => setShowFolderModal(true)} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}><FolderPlus size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { id: 'all', label: 'Todas las notas', icon: FileText, count: notes.length },
                { id: 'pinned', label: 'Destacadas', icon: Star, count: notes.filter(n => n.isPinned).length },
                { id: 'borradores', label: 'Borradores', icon: BookOpen, count: notes.filter(n => n.content.length < 50).length }
              ].map(item => (
                <button key={item.id} onClick={() => { setActiveFolderId(item.id as any); setSelectedTag(null); setSelectedNoteId(null); }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8,
                  background: activeFolderId === item.id && !selectedTag && !selectedNoteId ? 'var(--accent)' : 'transparent',
                  border: 'none', color: activeFolderId === item.id && !selectedTag && !selectedNoteId ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 11, background: activeFolderId === item.id && !selectedTag && !selectedNoteId ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface)', padding: '2px 8px', borderRadius: 10 }}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* CARPETAS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Carpetas</h3>
              <button onClick={() => setShowFolderModal(true)} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}><Plus size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {noteFolders.map(folder => {
                const count = notes.filter(n => n.folderId === folder.id).length;
                return (
                  <button key={folder.id} onClick={() => { setActiveFolderId(folder.id); setSelectedTag(null); setSelectedNoteId(null); }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8,
                    background: activeFolderId === folder.id && !selectedTag && !selectedNoteId ? 'var(--bg-surface)' : 'transparent',
                    border: '1px solid', borderColor: activeFolderId === folder.id && !selectedTag && !selectedNoteId ? 'var(--border-subtle)' : 'transparent',
                    color: activeFolderId === folder.id && !selectedTag && !selectedNoteId ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 200ms'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FolderIcon size={16} style={{ color: folder.color || 'var(--accent)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{folder.name}</span>
                    </div>
                    <span style={{ fontSize: 11, background: 'var(--bg-deep)', padding: '2px 8px', borderRadius: 10 }}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {noteFolders.length === 0 && (
                <div style={{ padding: '16px 4px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  Sin carpetas personalizadas
                </div>
              )}
            </div>
          </div>

          {/* ETIQUETAS / CARACTERÍSTICAS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Características</h3>
              {selectedTag && (
                <button onClick={() => setSelectedTag(null)} className="btn-ghost" style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 6px' }}>Limpiar</button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AVAILABLE_TAGS.map(tag => {
                const isSel = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => { setSelectedTag(isSel ? null : tag); setSelectedNoteId(null); }}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                      background: isSel ? 'var(--accent)' : 'var(--bg-surface)',
                      color: isSel ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid', borderColor: isSel ? 'var(--accent)' : 'var(--border-subtle)',
                      transition: 'all 150ms'
                    }}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="bento-card" style={{ flex: 1, background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column', minHeight: 600 }}>
          {!selectedNoteId ? (
            <>
              {/* TOOLBAR */}
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedTag ? `Etiqueta: #${selectedTag}` : activeFolderId === 'all' ? 'Todas las notas' : activeFolderId === 'pinned' ? 'Notas Destacadas' : activeFolderId === 'borradores' ? 'Borradores' : noteFolders.find(f => f.id === activeFolderId)?.name || 'Notas'}
                  </h2>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                    {filteredNotes.length} notas
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 260 }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="Buscar en notas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-base" style={{ paddingLeft: 40, fontSize: 13, height: 40, width: '100%' }} />
                  </div>
                  <button onClick={() => {
                    const newId = addNote({ title: 'Nueva Nota', content: '<p>Escribe aquí tu contenido...</p>', course: 'General', courseColor: '#8B5CF6', isPinned: false, tags: selectedTag ? [selectedTag] : [], priority: 'medium' });
                    if (newId) setSelectedNoteId(newId);
                  }} className="btn-primary hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, height: 40, padding: '0 20px', fontWeight: 600 }}>
                    <Plus size={16} /> Nueva Nota
                  </button>
                </div>
              </header>

              {/* NOTES GRID */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {filteredNotes.map(note => (
                    <NoteCard key={note.id} note={note} onClick={() => setSelectedNoteId(note.id)} />
                  ))}
                </div>
                {filteredNotes.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0', color: 'var(--text-muted)' }}>
                    <FileText size={64} style={{ opacity: 0.2, marginBottom: 16 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>No se encontraron notas</div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Crea una nueva nota o cambia los filtros de búsqueda</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* EDITOR PANEL */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflow: 'hidden', borderRadius: 12 }}>
              <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => setSelectedNoteId(null)} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
                    <ChevronLeft size={18} />
                  </button>
                  <input type="text" value={selectedNote?.title || ''} onChange={e => updateNote(selectedNote!.id, { title: e.target.value })} style={{ background: 'transparent', border: 'none', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', width: 400, padding: '4px 0' }} placeholder="Título de la nota..." />
                  {(selectedNote?.content?.length ?? 0) < 50 && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-deep)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>Borrador</span>}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button onClick={() => updateNote(selectedNote!.id, { isPinned: !selectedNote!.isPinned })} className="btn-ghost" style={{ color: selectedNote?.isPinned ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: 8, borderRadius: 8, background: selectedNote?.isPinned ? 'var(--accent-dim)' : 'transparent' }} title="Destacar">
                    <Pin size={18} />
                  </button>
                  <button onClick={handleSave} className="btn-primary hover-lift" style={{ fontSize: 13, height: 38, padding: '0 20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={16} /> Guardar
                  </button>
                  <button onClick={() => {
                    const blob = new Blob([selectedNote!.content], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${selectedNote!.title}.html`; a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Nota descargada exitosamente');
                  }} className="btn-ghost" style={{ color: 'var(--text-secondary)', cursor: 'pointer', padding: 8, borderRadius: 8 }} title="Descargar HTML">
                    <Download size={18} />
                  </button>
                  <button onClick={() => { deleteNote(selectedNote!.id); setSelectedNoteId(null); toast.success('Nota eliminada'); }} className="btn-ghost" style={{ color: 'var(--error)', cursor: 'pointer', padding: 8, borderRadius: 8 }} title="Eliminar nota">
                    <Trash2 size={18} />
                  </button>
                </div>
              </header>

              {/* METADATA & CHARACTERISTICS BAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                {/* Curso Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Curso:</span>
                  <select
                    value={selectedNote?.course || 'General'}
                    onChange={e => {
                      const course = courses.find(c => c.name === e.target.value);
                      updateNote(selectedNote!.id, { course: e.target.value, courseColor: course?.color || '#8B5CF6' });
                    }}
                    style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                  >
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>

                {/* Prioridad Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Prioridad:</span>
                  <select
                    value={selectedNote?.priority || 'medium'}
                    onChange={e => updateNote(selectedNote!.id, { priority: e.target.value as any })}
                    style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>

                {/* Etiquetas / Características */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflowX: 'auto' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Características:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {AVAILABLE_TAGS.map(tag => {
                      const active = selectedNote?.tags?.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleNoteTag(tag)}
                          style={{
                            fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 10, cursor: 'pointer',
                            background: active ? 'var(--accent)' : 'var(--bg-deep)',
                            color: active ? '#fff' : 'var(--text-secondary)',
                            border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                            transition: 'all 150ms'
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    placeholder="+ Agregar etiqueta..."
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '4px 10px', fontSize: 10, color: 'var(--text-primary)', outline: 'none', width: 120 }}
                  />
                </div>
              </div>

              {/* RICH TEXT TOOLBAR */}
              <div style={{ display: 'flex', gap: 6, padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', flexShrink: 0 }}>
                {[
                  { icon: Bold, action: handleBold, label: 'Negrita' },
                  { icon: Italic, action: handleItalic, label: 'Itálica' },
                  { icon: Underline, action: handleUnderline, label: 'Subrayado' },
                  { icon: Heading, action: handleHeading, label: 'Subtítulo' },
                  { icon: List, action: handleBulletList, label: 'Lista con viñetas' },
                  { icon: Code, action: handleCode, label: 'Bloque de código' },
                ].map((btn, i) => (
                  <button key={i} onClick={btn.action} title={btn.label} className="btn-ghost hover-lift" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                    <btn.icon size={16} />
                    <span>{btn.label}</span>
                  </button>
                ))}
              </div>

              {/* EDITOR AREA */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px', background: 'var(--bg-deep)' }}>
                <div ref={editorRef} contentEditable onBlur={handleSave} style={{ minHeight: '100%', outline: 'none', fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.8, maxWidth: 800, margin: '0 auto', paddingBottom: 64 }} />
              </div>

              {/* FOOTER STATS BAR */}
              <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span>Palabras: <strong style={{ color: 'var(--text-secondary)' }}>{editorStats.words}</strong></span>
                  <span>Caracteres: <strong style={{ color: 'var(--text-secondary)' }}>{editorStats.chars}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} />
                  <span>Tiempo de lectura estimado: <strong style={{ color: 'var(--text-secondary)' }}>{editorStats.readingTime} min</strong></span>
                </div>
              </footer>
            </div>
          )}
        </main>
      </div>

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowFolderModal(false)}>
          <div className="bento-card" style={{ width: 400, padding: 28, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Nueva Carpeta</h3>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Nombre de la carpeta</label>
            <input type="text" placeholder="Ej. Proyectos, Exámenes..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowFolderModal(false)} className="btn-secondary" style={{ fontSize: 13, padding: '0 20px', height: 40, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="btn-primary hover-lift" style={{ fontSize: 13, padding: '0 24px', height: 40, fontWeight: 600 }}>Crear carpeta</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
