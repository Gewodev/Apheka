import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Plus, Folder as FolderIcon, Pin, Trash2, Edit3,
  ChevronLeft, FolderPlus, FileText, Download, Check, X,
  Bold, Italic, Underline, List, Code,
  CheckCircle, Clock, Image, Palette, Highlighter,
  Type, Link, Upload
} from 'lucide-react';
import { useApp, Note } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function NoteListItem({ note, onClick, isSelected }: { note: Note; onClick: () => void; isSelected: boolean }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', borderRadius: 6, cursor: 'pointer', overflow: 'hidden',
      background: isSelected ? 'var(--accent)08' : 'var(--bg-hover)',
      border: `1px solid ${isSelected ? 'var(--accent)25' : 'var(--border-subtle)'}`,
      transition: 'all 120ms', position: 'relative',
    }} className="hover:bg-white/[0.02]">
      {/* Book spine */}
      <div style={{
        width: 14, background: `linear-gradient(180deg, ${note.courseColor || 'var(--accent)'}, ${note.courseColor || 'var(--accent)'}dd)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, writingMode: 'vertical-rl', textOrientation: 'mixed',
        fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        letterSpacing: '0.15em', padding: '8px 0',
        textTransform: 'uppercase',
      }}>
        {(note.course || 'G').charAt(0)}
      </div>
      {/* Book content */}
      <div style={{ flex: 1, minWidth: 0, padding: '9px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title || 'Sin título'}
          </span>
          {note.isPinned && <Pin size={10} fill="var(--accent)" color="var(--accent)" style={{ flexShrink: 0 }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>
            {format(new Date(note.updatedAt), "d MMM", { locale: es })}
          </span>
          {note.tags && note.tags.length > 0 && (
            <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>
              #{note.tags[0]}
            </span>
          )}
        </div>
      </div>
      {/* Shelf line at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 14, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, var(--border-subtle), transparent)',
        opacity: 0.5,
      }} />
    </div>
  );
}

export default function Notas() {
  const app = useApp();
  const {
    notes = [],
    noteFolders = [],
    courses = [],
    addNote,
    updateNote,
    deleteNote,
    addNoteFolder,
  } = app || {};

  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'pinned'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Collect all unique tags from notes, sorted by frequency
  const allTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    notes.forEach(n => {
      (n.tags || []).forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });
    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [notes]);

  const renameTag = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    notes.forEach(n => {
      if (n.tags?.includes(oldName)) {
        const newTags = n.tags.filter(t => t !== oldName);
        if (!newTags.includes(newName)) newTags.push(newName);
        updateNote(n.id, { tags: newTags });
      }
    });
    if (selectedTag === oldName) setSelectedTag(newName);
    setEditingTag(null);
  };

  const deleteTagGlobal = (tagName: string) => {
    notes.forEach(n => {
      if (n.tags?.includes(tagName)) {
        updateNote(n.id, { tags: n.tags.filter(t => t !== tagName) });
      }
    });
    if (selectedTag === tagName) setSelectedTag(null);
    setConfirmDeleteTag(null);
  };

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedNote = notes.find(n => n.id === selectedNoteId);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBold = useCallback(() => {
    document.execCommand('bold'); setAutoSave(); hideToolbar();
  }, []);
  const handleItalic = useCallback(() => {
    document.execCommand('italic'); setAutoSave(); hideToolbar();
  }, []);
  const handleUnderline = useCallback(() => {
    document.execCommand('underline'); setAutoSave(); hideToolbar();
  }, []);
  const handleBulletList = useCallback(() => {
    document.execCommand('insertUnorderedList'); setAutoSave(); hideToolbar();
  }, []);
  const handleNumberedList = useCallback(() => {
    document.execCommand('insertOrderedList'); setAutoSave(); hideToolbar();
  }, []);
  const handleHeading = (level: string) => useCallback(() => {
    document.execCommand('formatBlock', false, level); setAutoSave(); hideToolbar();
  }, [])();
  const handleCodeBlock = useCallback(() => {
    document.execCommand('insertHTML', false, '<pre style="background:var(--bg-deep);padding:12px;border-radius:8px;font-size:13px;font-family:monospace;overflow-x:auto;border:1px solid var(--border-subtle);line-height:1.5"><code>código</code></pre>');
    setAutoSave(); hideToolbar();
  }, []);
  const handleInsertImage = useCallback(() => {
    const url = prompt('URL de la imagen:');
    if (url) {
      document.execCommand('insertImage', false, url);
      setAutoSave();
    }
    hideToolbar();
  }, []);
  const handleInsertLink = useCallback(() => {
    const url = prompt('URL del enlace:');
    if (url) {
      const sel = window.getSelection();
      if (sel && sel.toString()) {
        document.execCommand('createLink', false, url);
      } else {
        document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">${url}</a>`);
      }
      setAutoSave();
    }
    hideToolbar();
  }, []);

  const [showFormatPopup, setShowFormatPopup] = useState(false);
  const [formatPopupPos, setFormatPopupPos] = useState({ x: 0, y: 0 });
  const hideToolbar = () => setShowFormatPopup(false);

  const handleEditorInput = useCallback(() => {
    setAutoSave();
  }, []);

  const setAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!selectedNoteId || !selectedNote) return;
      const content = editorRef.current?.innerHTML || '';
      if (content !== selectedNote.content) {
        updateNote(selectedNote.id, { content });
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 1500);
      }
    }, 300);
  }, [selectedNoteId, selectedNote, updateNote]);

  useEffect(() => {
    if (selectedNote && editorRef.current) {
      if (editorRef.current.innerHTML !== selectedNote.content) {
        editorRef.current.innerHTML = selectedNote.content;
      }
    }
  }, [selectedNoteId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = activeFolderId === 'all' ? true :
        activeFolderId === 'pinned' ? n.isPinned :
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

  const handleCreateNote = (folderId?: string) => {
    const newId = addNote({
      title: 'Nueva nota',
      content: '<p>Escribe aquí...</p>',
      course: 'General',
      courseColor: '#8B5CF6',
      isPinned: false,
      tags: selectedTag ? [selectedTag] : [],
      folderId: folderId || undefined,
    });
    if (newId) {
      setSelectedNoteId(newId);
      setActiveFolderId(folderId || 'all');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      document.execCommand('insertHTML', false, `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0" />`);
    } else if (isVideo) {
      document.execCommand('insertHTML', false, `<video src="${url}" controls style="max-width:100%;border-radius:8px;margin:8px 0" width="100%">${file.name}</video>`);
    } else if (isAudio) {
      document.execCommand('insertHTML', false, `<audio src="${url}" controls style="width:100%;margin:8px 0">${file.name}</audio>`);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">${file.name}</a>`);
    }
    setAutoSave();
    e.target.value = '';
  };

  const handleKeyUp = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current?.getBoundingClientRect();
      if (editorRect) {
        setFormatPopupPos({ x: rect.left - editorRect.left + rect.width / 2, y: rect.top - editorRect.top - 40 });
        setShowFormatPopup(true);
      }
    } else {
      setShowFormatPopup(false);
    }
  }, []);

  const autoLinkify = useCallback(() => {
    if (!editorRef.current) return;
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    nodes.forEach(textNode => {
      const parent = textNode.parentElement;
      if (parent && (parent.tagName === 'A' || parent.closest('a'))) return;
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      if (urlRegex.test(textNode.textContent || '')) {
        const span = document.createElement('span');
        span.innerHTML = (textNode.textContent || '').replace(urlRegex,
          '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;font-weight:600">$1</a>');
        textNode.parentNode?.replaceChild(span, textNode);
        setAutoSave();
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedNote) return;
    const timer = setTimeout(autoLinkify, 1000);
    return () => clearTimeout(timer);
  }, [selectedNote?.content]);

  const editorStats = useMemo(() => {
    if (!selectedNote) return { words: 0, chars: 0, readingTime: 0 };
    const text = selectedNote.content.replace(/<[^>]+>/g, '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const readingTime = Math.ceil(words / 200);
    return { words, chars, readingTime };
  }, [selectedNote?.content]);

  const downloadTxt = () => {
    if (!selectedNote) return;
    const text = selectedNote.content.replace(/<[^>]+>/g, '');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedNote.title || 'nota'}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const sidebarFolders = useMemo(() => {
    const seen = new Set<string>();
    const courseFolders: ({ id: string; name: string; color: string; isCourse: boolean })[] = courses.map(c => ({
      id: `course_${c.id}`,
      name: c.name,
      color: c.color || '#8B5CF6',
      isCourse: true,
    }));
    const allFolders = [...courseFolders, ...noteFolders.map(f => ({ ...f, isCourse: false }))];
    return allFolders.filter(f => {
      const key = f.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [courses, noteFolders]);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8, flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 40, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 0 20px var(--accent-glow)' }}>Notas</h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 400, letterSpacing: '0.02em' }}>Captura, organiza y encuentra tu conocimiento.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 40, fontWeight: 200, lineHeight: 0.9, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>{timeStr}</span>
              <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 200, color: 'var(--text-tertiary)', opacity: 0.5 }}>{secondsStr}</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 4, letterSpacing: '0.04em', textTransform: 'capitalize' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div style={{ display: 'flex', flex: 1, gap: 20, minHeight: 0, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside className="bento-card" style={{ width: 240, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0, overflowY: 'auto', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { id: 'all', label: 'Todas las notas', icon: FileText, count: notes.length },
                { id: 'pinned', label: 'Destacadas', icon: Pin, count: notes.filter(n => n.isPinned).length },
              ].map(item => (
                <button key={item.id} onClick={() => { setActiveFolderId(item.id as any); setSelectedTag(null); setSelectedNoteId(null); }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6,
                  background: activeFolderId === item.id && !selectedTag ? 'var(--accent)' : 'transparent',
                  border: 'none', color: activeFolderId === item.id && !selectedTag ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 150ms'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 10, background: activeFolderId === item.id && !selectedTag ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)', padding: '1px 7px', borderRadius: 8 }}>{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* FOLDERS (courses + custom) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 2px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Carpetas</span>
              <button onClick={() => setShowFolderModal(true)} style={{ padding: 3, borderRadius: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><FolderPlus size={13} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sidebarFolders.map(folder => {
                const folderId = folder.isCourse ? folder.id : folder.id;
                const count = folder.isCourse
                  ? notes.filter(n => n.course === folder.name).length
                  : notes.filter(n => n.folderId === folder.id).length;
                return (
                  <button key={folderId} onClick={() => { setActiveFolderId(folderId); setSelectedTag(null); setSelectedNoteId(null); }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 5,
                    background: activeFolderId === folderId && !selectedTag ? 'var(--accent)' : 'transparent',
                    border: 'none', color: activeFolderId === folderId && !selectedTag ? '#fff' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 120ms'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden', minWidth: 0 }}>
                      <FolderIcon size={13} style={{ color: activeFolderId === folderId && !selectedTag ? '#fff' : (folder.color || 'var(--accent)'), flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{folder.name}</span>
                    </div>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, background: activeFolderId === folderId && !selectedTag ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)', flexShrink: 0 }}>{count}</span>
                  </button>
                );
              })}
              {sidebarFolders.length === 0 && (
                <div style={{ padding: '10px 2px', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>Crea una carpeta o agrega cursos</div>
              )}
            </div>
          </div>

          {/* TAGS as blocks like folders */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 2px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Etiquetas</span>
              {selectedTag && (
                <button onClick={() => setSelectedTag(null)} style={{ fontSize: 9, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}>Limpiar</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {allTags.map(tag => {
                const isSel = selectedTag === tag.name;
                const isEditing = editingTag === tag.name;
                return (
                  <div key={tag.name} style={{
                    display: 'flex', alignItems: 'center', borderRadius: 5,
                    background: isSel ? 'var(--accent)' : 'transparent',
                    overflow: 'hidden', transition: 'all 120ms',
                  }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '2px' }}>
                        <input type="text" value={editingTagValue} autoFocus
                          onChange={e => setEditingTagValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameTag(tag.name, editingTagValue);
                            if (e.key === 'Escape') setEditingTag(null);
                          }}
                          style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-deep)', border: '1px solid var(--accent)', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', outline: 'none' }} />
                        <button onClick={() => renameTag(tag.name, editingTagValue)}
                          style={{ padding: '4px 6px', background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', display: 'flex' }}><Check size={13} /></button>
                        <button onClick={() => setEditingTag(null)}
                          style={{ padding: '4px 6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
                      </div>
                    ) : confirmDeleteTag === tag.name ? (
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 4, padding: '6px 8px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#EF4444', flex: 1 }}>¿Eliminar?</span>
                        <button onClick={() => deleteTagGlobal(tag.name)}
                          style={{ padding: '3px 6px', borderRadius: 4, background: '#EF4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>Sí</button>
                        <button onClick={() => setConfirmDeleteTag(null)}
                          style={{ padding: '3px 6px', borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>No</button>
                      </div>
                    ) : (
                      <button onClick={() => { setSelectedTag(isSel ? null : tag.name); setSelectedNoteId(null); }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'none', border: 'none', color: isSel ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 120ms' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden', minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 400, flexShrink: 0 }}>#</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{tag.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: isSel ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)', flexShrink: 0 }}>{tag.count}</span>
                          <span onClick={(e) => { e.stopPropagation(); setEditingTag(tag.name); setEditingTagValue(tag.name); }}
                            style={{ opacity: 0, padding: 3, color: isSel ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', transition: 'opacity 120ms' }}
                            className="group-hover:opacity-100"><Edit3 size={11} /></span>
                          <span onClick={(e) => { e.stopPropagation(); setConfirmDeleteTag(tag.name); }}
                            style={{ opacity: 0, padding: 3, color: isSel ? 'rgba(255,255,255,0.6)' : '#EF4444', cursor: 'pointer', display: 'flex', transition: 'opacity 120ms' }}
                            className="group-hover:opacity-100"><Trash2 size={11} /></span>
                        </div>
                      </button>
                    )}
                  </div>
                );
              })}
              <div style={{ marginTop: 2 }}>
                <input type="text" placeholder="+ crear etiqueta..." value={customTagInput}
                  onChange={e => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customTagInput.trim()) {
                      const tag = customTagInput.trim();
                      setSelectedTag(tag);
                      setCustomTagInput('');
                    }
                  }}
                  style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 5, fontSize: 11, color: 'var(--text-primary)', outline: 'none' }} />
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="bento-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
          {!selectedNoteId ? (
            <>
              {/* TOOLBAR */}
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>
                    {selectedTag ? `#${selectedTag}` : activeFolderId === 'all' ? 'Todas las notas' : activeFolderId === 'pinned' ? 'Destacadas' : sidebarFolders.find(f => (f.isCourse ? f.id : f.id) === activeFolderId)?.name || 'Notas'}
                  </h2>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 5 }}>{filteredNotes.length}</span>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 200 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px 7px 32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                  <button onClick={() => handleCreateNote()}
                    style={{ padding: '7px 16px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={12} /> Nueva nota
                  </button>
                </div>
              </header>

              {/* NOTES LIST - shelf style grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredNotes.map(note => (
                    <NoteListItem key={note.id} note={note} isSelected={false} onClick={() => setSelectedNoteId(note.id)} />
                  ))}
                  {filteredNotes.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                      <FileText size={40} style={{ opacity: 0.12, marginBottom: 10 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No se encontraron notas</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Crea una o cambia los filtros</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : selectedNote ? (
            /* EDITOR */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <header style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <button onClick={() => setSelectedNoteId(null)} style={{ padding: 6, borderRadius: 6, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <input type="text" value={selectedNote.title} onChange={e => updateNote(selectedNote.id, { title: e.target.value })}
                    style={{ background: 'transparent', border: 'none', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', flex: 1, minWidth: 0, fontFamily: "'Inter Tight', sans-serif" }}
                    placeholder="Título de la nota..." />
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {savedIndicator && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle size={10} /> Guardado
                    </span>
                  )}
                  <button onClick={() => updateNote(selectedNote.id, { isPinned: !selectedNote.isPinned })}
                    style={{ padding: 6, borderRadius: 6, background: 'none', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: selectedNote.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}>
                    <Pin size={14} fill={selectedNote.isPinned ? 'var(--accent)' : 'none'} />
                  </button>
                  <button onClick={downloadTxt} style={{ padding: 6, borderRadius: 6, background: 'none', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                    <Download size={14} />
                  </button>
                  <button onClick={() => { if (confirm('¿Eliminar esta nota?')) { deleteNote(selectedNote.id); setSelectedNoteId(null); } }}
                    style={{ padding: 6, borderRadius: 6, background: 'none', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--error)', display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </header>

              {/* METADATA BAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, flexWrap: 'wrap', background: 'var(--bg-deep)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FolderIcon size={12} style={{ color: 'var(--text-muted)' }} />
                  <select value={selectedNote.folderId || ''} onChange={e => updateNote(selectedNote.id, { folderId: e.target.value || undefined })}
                    style={{ border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', background: 'var(--bg-elevated)' }}>
                    <option value="">Sin carpeta</option>
                    {sidebarFolders.map(f => (
                      <option key={f.id} value={f.isCourse ? f.id : f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
                  {allTags.map(tag => {
                    const active = selectedNote.tags?.includes(tag.name);
                    return (
                      <button key={tag.name} onClick={() => toggleNoteTag(tag.name)} style={{
                        fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'var(--bg-elevated)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                        transition: 'all 120ms', flexShrink: 0
                      }}>{tag.name}</button>
                    );
                  })}
                  <input type="text" placeholder="+ etiqueta" value={customTagInput} onChange={e => setCustomTagInput(e.target.value)} onKeyDown={handleAddCustomTag}
                    style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '3px 8px', fontSize: 9, color: 'var(--text-primary)', outline: 'none', width: 80, background: 'var(--bg-elevated)' }} />
                </div>
              </div>

              {/* FLOATING FORMAT POPUP */}
              {showFormatPopup && (
                <div style={{
                  position: 'absolute', zIndex: 100, left: formatPopupPos.x, top: formatPopupPos.y,
                  transform: 'translateX(-50%)', display: 'flex', gap: 2, padding: '4px 6px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}>
                  {[
                    { icon: Bold, action: () => { document.execCommand('bold'); setAutoSave(); hideToolbar(); } },
                    { icon: Italic, action: () => { document.execCommand('italic'); setAutoSave(); hideToolbar(); } },
                    { icon: Underline, action: () => { document.execCommand('underline'); setAutoSave(); hideToolbar(); } },
                    { icon: Type, action: () => { document.execCommand('strikeThrough'); setAutoSave(); hideToolbar(); } },
                    { icon: Link, action: handleInsertLink },
                    { icon: Highlighter, action: () => { document.execCommand('hiliteColor', false, '#FEF08A'); setAutoSave(); hideToolbar(); } },
                    { icon: Palette, action: () => { const c = prompt('Color hex:'); if (c) { document.execCommand('foreColor', false, c); setAutoSave(); } hideToolbar(); } },
                  ].map((btn, i) => (
                    <button key={i} onMouseDown={e => { e.preventDefault(); btn.action(); }} title={['Negrita','Itálica','Subrayado','Tachado','Enlace','Resaltar','Color'][i]}
                      style={{ padding: '5px 7px', borderRadius: 5, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                      <btn.icon size={14} />
                    </button>
                  ))}
                </div>
              )}

              {/* RICH TEXT TOOLBAR */}
              <div style={{ display: 'flex', gap: 4, padding: '8px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { icon: Bold, action: handleBold },
                  { icon: Italic, action: handleItalic },
                  { icon: Underline, action: handleUnderline },
                ].map((btn, i) => (
                  <button key={i} onMouseDown={e => { e.preventDefault(); btn.action(); }}
                    style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                    <btn.icon size={14} />
                  </button>
                ))}
                <span style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
                <button onMouseDown={e => { e.preventDefault(); document.execCommand('formatBlock', false, 'h1'); setAutoSave(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>H1</button>
                <button onMouseDown={e => { e.preventDefault(); document.execCommand('formatBlock', false, 'h2'); setAutoSave(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>H2</button>
                <button onMouseDown={e => { e.preventDefault(); document.execCommand('formatBlock', false, 'h3'); setAutoSave(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>H3</button>
                <button onMouseDown={e => { e.preventDefault(); document.execCommand('formatBlock', false, 'h4'); setAutoSave(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>H4</button>
                <span style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
                <button onMouseDown={e => { e.preventDefault(); handleBulletList(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><List size={14} /></button>
                <button onMouseDown={e => { e.preventDefault(); handleNumberedList(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', fontSize: 11, fontWeight: 700 }}>1.</button>
                <button onMouseDown={e => { e.preventDefault(); handleCodeBlock(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><Code size={14} /></button>
                <span style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
                <button onMouseDown={e => { e.preventDefault(); handleInsertImage(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><Image size={14} /></button>
                <button onMouseDown={e => { e.preventDefault(); handleInsertLink(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><Link size={14} /></button>
                <button onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><Upload size={14} /></button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" />
                <button onMouseDown={e => { e.preventDefault(); const c = prompt('Color del texto (hex):'); if (c) { document.execCommand('foreColor', false, c); setAutoSave(); } }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><Palette size={14} /></button>
                <button onMouseDown={e => { e.preventDefault(); document.execCommand('hiliteColor', false, '#FEF08A'); setAutoSave(); }}
                  style={{ padding: '6px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><Highlighter size={14} /></button>
              </div>

              {/* EDITOR */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px', background: 'var(--bg-deep)' }} onMouseUp={handleKeyUp} onKeyUp={handleKeyUp}>
                <div ref={editorRef} contentEditable onInput={handleEditorInput}
                  style={{ minHeight: '100%', outline: 'none', fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.8, maxWidth: 720, margin: '0 auto', paddingBottom: 64, fontFamily: "'Inter', sans-serif" }} />
              </div>

              {/* FOOTER */}
              <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>{editorStats.words} palabras</span>
                  <span>{editorStats.chars} caracteres</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} />
                  <span>{editorStats.readingTime} min lectura</span>
                </div>
              </footer>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Selecciona una nota para editarla
            </div>
          )}
        </main>
      </div>

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowFolderModal(false)}>
          <div className="bento-card" style={{ width: 380, padding: 24, border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 16 }}>Nueva carpeta</h3>
            <input type="text" placeholder="Nombre de la carpeta..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} autoFocus />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowFolderModal(false)}
                style={{ padding: '7px 16px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
                style={{ padding: '7px 20px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', opacity: newFolderName.trim() ? 1 : 0.3 }}>Crear</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
