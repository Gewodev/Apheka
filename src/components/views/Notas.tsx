import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Plus, Folder as FolderIcon, Pin, Trash2, Edit3,
  ChevronLeft, FolderPlus, FileText, Download, Check, X,
  Bold, Italic, Underline, List, Code, CheckCircle, Clock,
  Image as ImageIcon, Palette, Highlighter, Type, Link, Upload,
  MoreVertical, Share2, HelpCircle, AlertCircle, Copy, Move, ArrowLeft,
  ChevronDown, BookOpen, Star, RefreshCw, PenTool, Calculator, Sigma,
  Eye, Info, AlertTriangle, FileVideo, Music, Paperclip
} from 'lucide-react';
import { useApp, Note, NoteFolder, NoteAttachment } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// ── SORTABLE NOTE CARD COMPONENT ──
interface SortableNoteCardProps {
  note: Note;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent, note: Note) => void;
}

function SortableNoteCard({ note, isSelected, onClick, onContextMenu }: SortableNoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const hasCover = note.coverImage || note.coverColor;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`note-card rounded-xl border ${
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
      } overflow-hidden flex flex-col`}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, note)}
    >
      {/* Cover image or color block */}
      {hasCover && (
        <div
          className="note-card-cover"
          style={{
            backgroundImage: note.coverImage ? `url(${note.coverImage})` : 'none',
            backgroundColor: note.coverColor || 'transparent',
          }}
        >
          <div className="absolute top-2 right-2 text-white/90 drop-shadow">
            {note.isPinned && <Pin size={12} fill="white" />}
          </div>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 flex-grow relative">
        {/* Course color spine on left if it belongs to a course and has no cover */}
        {!hasCover && note.courseColor && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: note.courseColor }}
          />
        )}

        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-sm text-[var(--text-primary)] line-clamp-1 flex-grow">
            {note.title || 'Sin título'}
          </h4>
          {!hasCover && note.isPinned && (
            <Pin size={11} fill="var(--accent)" className="text-[var(--accent)] shrink-0 mt-0.5" />
          )}
        </div>

        {note.subtitle && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-1 italic">
            {note.subtitle}
          </p>
        )}

        <div
          className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: note.content ? note.content.replace(/<[^>]*>/g, ' ') : 'Sin contenido...',
          }}
        />

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)]">
          <span>{format(new Date(note.updatedAt), 'd MMM, yyyy', { locale: es })}</span>
          <div className="flex gap-1">
            {note.tags && note.tags.slice(0, 2).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-[var(--bg-deep)] text-[var(--text-secondary)]">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN NOTAS MODULE ──
export default function Notas() {
  const {
    notes = [],
    noteFolders = [],
    courses = [],
    settings,
    addNote,
    updateNote,
    deleteNote,
    addNoteFolder,
    deleteNoteFolder,
    reorderNotes,
    updateNoteFolder,
    duplicateNote,
  } = useApp();

  // Navigation states
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'pinned'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Time & Clock state
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = format(currentTime, settings?.timeFormat === '12h' ? 'hh:mm' : 'HH:mm');
  const periodStr = settings?.timeFormat === '12h' ? format(currentTime, ' a') : '';
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Editor states
  const selectedNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const [editorWordCount, setEditorWordCount] = useState(0);
  const [editorCharCount, setEditorCharCount] = useState(0);
  const [editorReadingTime, setEditorReadingTime] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Floating tools panels state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showFormulaEditor, setShowFormulaEditor] = useState(false);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; note: Note } | null>(null);

  // Modals state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#E11D48');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMoveFolderModal, setShowMoveFolderModal] = useState<string | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Floating formatting popup state
  const [formatPopup, setFormatPopup] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  // Tag creation / editing state
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  // Auto-fill editor content when selecting a note
  useEffect(() => {
    if (editorRef.current && selectedNote) {
      if (editorRef.current.innerHTML !== selectedNote.content) {
        editorRef.current.innerHTML = selectedNote.content;
      }
      updateEditorStats();
    }
  }, [selectedNoteId]);

  // Handle escape & clicks outside to close floating elements
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (contextMenu) setContextMenu(null);
      if (showDownloadMenu) setShowDownloadMenu(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewFolderModal(false);
        setShowDeleteConfirm(null);
        setShowMoveFolderModal(null);
        setContextMenu(null);
        setShowCalculator(false);
        setShowWhiteboard(false);
        setShowFormulaEditor(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, showDownloadMenu]);

  // ── AUTO-SAVE WITH DEBOUNCE ──
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!selectedNoteId) return;
      const html = editorRef.current?.innerHTML || '';
      const title = titleInputRef.current?.value || 'Sin título';
      const subtitle = subtitleInputRef.current?.value || '';

      updateNote(selectedNoteId, {
        content: html,
        title,
        subtitle,
        updatedAt: new Date().toISOString(),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 1200);
    }, 500);
  }, [selectedNoteId, updateNote]);

  // Update statistics
  const updateEditorStats = () => {
    const text = editorRef.current?.innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const minutes = Math.ceil(words / 200); // Average reading speed

    setEditorWordCount(words);
    setEditorCharCount(chars);
    setEditorReadingTime(minutes);
  };

  // Selection change for floating formatting bar
  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) {
      setFormatPopup(prev => ({ ...prev, show: false }));
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    if (rect.top >= editorRect.top && rect.bottom <= editorRect.bottom) {
      setFormatPopup({
        x: rect.left - editorRect.left + rect.width / 2,
        y: rect.top - editorRect.top - 48,
        show: true
      });
    }
  };

  // ── FORMAT COMMANDS ──
  const applyFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    triggerAutoSave();
    updateEditorStats();
  };

  // ── TAGS COMPUTATION ──
  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach(n => {
      (n.tags || []).forEach(tag => {
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [notes]);

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim() || !selectedNote) return;
    const tag = newTagInput.trim().toLowerCase();
    const currentTags = selectedNote.tags || [];
    if (!currentTags.includes(tag)) {
      updateNote(selectedNote.id, { tags: [...currentTags, tag] });
    }
    setNewTagInput('');
  };

  const handleRenameTagGlobal = (oldTag: string, newTag: string) => {
    if (!newTag.trim() || oldTag === newTag) {
      setEditingTag(null);
      return;
    }
    notes.forEach(n => {
      if (n.tags?.includes(oldTag)) {
        const nextTags = n.tags.map(t => t === oldTag ? newTag.trim() : t);
        updateNote(n.id, { tags: nextTags });
      }
    });
    if (selectedTag === oldTag) setSelectedTag(newTag);
    setEditingTag(null);
    toast.success('Etiqueta renombrada');
  };

  const handleDeleteTagGlobal = (tag: string) => {
    notes.forEach(n => {
      if (n.tags?.includes(tag)) {
        updateNote(n.id, { tags: n.tags.filter(t => t !== tag) });
      }
    });
    if (selectedTag === tag) setSelectedTag(null);
    setTagToDelete(null);
    toast.success('Etiqueta eliminada');
  };

  // ── FOLDER DEFINITIONS ──
  const allFolders = useMemo(() => {
    const courseFolders: NoteFolder[] = courses.map(c => ({
      id: `course-${c.id}`,
      name: c.name,
      color: c.color,
      courseId: c.id,
      isManual: false
    }));
    return [...courseFolders, ...noteFolders];
  }, [courses, noteFolders]);

  const activeFolderName = useMemo(() => {
    if (activeFolderId === 'all') return 'Todas las notas';
    if (activeFolderId === 'pinned') return 'Destacadas';
    const f = allFolders.find(x => x.id === activeFolderId);
    return f ? f.name : 'Carpeta';
  }, [activeFolderId, allFolders]);

  const handleCreateFolderSubmit = () => {
    if (!newFolderName.trim()) return;
    addNoteFolder({
      name: newFolderName.trim(),
      color: newFolderColor,
      isManual: true,
      description: newFolderDesc
    });
    setNewFolderName('');
    setNewFolderDesc('');
    setShowNewFolderModal(false);
    toast.success('Carpeta creada');
  };

  // ── FILTERED NOTES LIST ──
  const filteredNotes = useMemo(() => {
    let result = notes;
    if (activeFolderId === 'pinned') {
      result = result.filter(n => n.isPinned);
    } else if (activeFolderId !== 'all') {
      // Find if it matches a course folder or custom folder
      const folder = allFolders.find(f => f.id === activeFolderId);
      if (folder) {
        if (folder.courseId) {
          // It's a course folder, filter by course name matching
          result = result.filter(n => n.course === folder.name);
        } else {
          result = result.filter(n => n.folderId === folder.id);
        }
      }
    }
    if (selectedTag) {
      result = result.filter(n => n.tags?.includes(selectedTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.subtitle && n.subtitle.toLowerCase().includes(q)) ||
        n.content.toLowerCase().includes(q)
      );
    }
    // Sort by sortOrder then updatedAt descending
    return [...result].sort((a, b) => {
      const sortA = a.sortOrder ?? 99999;
      const sortB = b.sortOrder ?? 99999;
      if (sortA !== sortB) return sortA - sortB;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, activeFolderId, selectedTag, searchQuery, allFolders]);

  // DND kit reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeIdx = filteredNotes.findIndex(n => n.id === active.id);
      const overIdx = filteredNotes.findIndex(n => n.id === over.id);
      const newOrderIds = [...filteredNotes.map(n => n.id)];
      // move activeIdx to overIdx
      newOrderIds.splice(activeIdx, 1);
      newOrderIds.splice(overIdx, 0, active.id as string);
      reorderNotes(newOrderIds);
    }
  };

  // Create Note
  const handleCreateNote = () => {
    // Determine course or folder
    let courseName = 'General';
    let courseColor = '#E11D48';
    let folderId: string | undefined = undefined;

    if (activeFolderId !== 'all' && activeFolderId !== 'pinned') {
      const folder = allFolders.find(f => f.id === activeFolderId);
      if (folder) {
        if (folder.courseId) {
          courseName = folder.name;
          courseColor = folder.color;
        } else {
          folderId = folder.id;
        }
      }
    }

    const newId = addNote({
      title: 'Nueva nota',
      subtitle: 'Descripción breve',
      content: 'Comienza a escribir...',
      course: courseName,
      courseColor,
      folderId,
      isPinned: false,
      tags: selectedTag ? [selectedTag] : [],
      attachments: [],
      coverColor: '#0F172A'
    });

    setSelectedNoteId(newId);
    toast.success('Nota creada');
  };

  // Delete Note
  const handleDeleteNoteConfirm = () => {
    if (!showDeleteConfirm) return;
    deleteNote(showDeleteConfirm);
    if (selectedNoteId === showDeleteConfirm) setSelectedNoteId(null);
    setShowDeleteConfirm(null);
    toast.success('Nota eliminada');
  };

  // Move Folder note
  const handleMoveFolder = (folderId: string | undefined) => {
    if (!showMoveFolderModal) return;
    updateNote(showMoveFolderModal, { folderId });
    setShowMoveFolderModal(null);
    toast.success('Nota movida de carpeta');
  };

  // Context Menu triggers
  const handleContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      note
    });
  };

  // File Attachments base64 convert
  const handleFileAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNote) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const type: NoteAttachment['type'] = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio'
        : file.type === 'application/pdf' ? 'pdf'
        : 'file';

      const attachment: NoteAttachment = {
        id: Date.now().toString(),
        name: file.name,
        type,
        dataUrl,
        size: file.size
      };

      const prevAttachments = selectedNote.attachments || [];
      updateNote(selectedNote.id, {
        attachments: [...prevAttachments, attachment]
      });

      // Insert link/preview directly in editor
      if (type === 'image') {
        document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%; border-radius:10px; margin: 12px 0;" />`);
      } else if (type === 'video') {
        document.execCommand('insertHTML', false, `<video src="${dataUrl}" controls style="max-width:100%; border-radius:10px; margin: 12px 0;"></video>`);
      } else if (type === 'audio') {
        document.execCommand('insertHTML', false, `<audio src="${dataUrl}" controls style="width:100%; margin: 8px 0;"></audio>`);
      } else {
        document.execCommand('insertHTML', false, `<a href="${dataUrl}" download="${file.name}" style="color:var(--accent); text-decoration: underline; font-weight:600;">📎 ${file.name}</a>`);
      }
      triggerAutoSave();
      updateEditorStats();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // HTML / TXT download logic
  const downloadNote = (type: 'html' | 'txt') => {
    if (!selectedNote) return;
    let filename = `${selectedNote.title.replace(/\s+/g, '_')}`;
    let blob: Blob;

    if (type === 'html') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selectedNote.title}</title>
<style>
body{font-family:'Inter',sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1e293b;line-height:1.8;background:#f8fafc;}
.container{background:#ffffff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.05);}
h1{font-size:32px;font-weight:800;color:#0f172a;margin-bottom:6px;}
h2{font-size:20px;font-weight:400;color:#64748b;margin-bottom:24px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;}
blockquote{border-left:4px solid #E11D48;padding:12px 20px;margin:20px 0;background:#fff1f2;border-radius:0 8px 8px 0;font-style:italic;}
pre{background:#0f172a;color:#f8fafc;padding:16px;border-radius:8px;font-family:monospace;overflow-x:auto;}
code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;color:#e11d48;}
pre code{background:none;color:inherit;padding:0;}
img{max-width:100%;border-radius:8px;}
a{color:#E11D48;text-decoration:none;}
a:hover{text-decoration:underline;}
</style></head>
<body><div class="container">
<h1>${selectedNote.title}</h1>
${selectedNote.subtitle ? `<h2>${selectedNote.subtitle}</h2>` : ''}
<div>${selectedNote.content}</div>
</div></body></html>`;
      blob = new Blob([html], { type: 'text/html' });
      filename += '.html';
    } else {
      const text = `${selectedNote.title}\n${selectedNote.subtitle || ''}\n\n${editorRef.current?.innerText || ''}`;
      blob = new Blob([text], { type: 'text/plain' });
      filename += '.txt';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Nota descargada como ${type.toUpperCase()}`);
  };

  // ── FLOATING PANEL - CALCULATOR ──
  const [calcExpr, setCalcExpr] = useState('');
  const [calcRes, setCalcRes] = useState('0');
  const [isDeg, setIsDeg] = useState(true);

  const handleCalcPress = (val: string) => {
    if (val === 'C') {
      setCalcExpr('');
      setCalcRes('0');
    } else if (val === '=') {
      try {
        let clean = calcExpr
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/π/g, 'Math.PI')
          .replace(/sin\(/g, isDeg ? 'Math.sin(Math.PI/180*' : 'Math.sin(')
          .replace(/cos\(/g, isDeg ? 'Math.cos(Math.PI/180*' : 'Math.cos(')
          .replace(/tan\(/g, isDeg ? 'Math.tan(Math.PI/180*' : 'Math.tan(')
          .replace(/log\(/g, 'Math.log10(')
          .replace(/ln\(/g, 'Math.log(')
          .replace(/√\(/g, 'Math.sqrt(')
          .replace(/\^/g, '**');

        const openP = (clean.match(/\(/g) || []).length;
        const closeP = (clean.match(/\)/g) || []).length;
        if (openP > closeP) clean += ')'.repeat(openP - closeP);

        const evalRes = new Function(`return (${clean})`)();
        if (typeof evalRes === 'number' && !isNaN(evalRes)) {
          setCalcRes(Number(evalRes.toFixed(8)).toString());
        } else {
          setCalcRes('Error');
        }
      } catch {
        setCalcRes('Error');
      }
    } else {
      setCalcExpr(prev => prev + val);
    }
  };

  const insertCalcResult = () => {
    if (calcRes === 'Error') return;
    document.execCommand('insertHTML', false, ` <code class="px-2 py-0.5 bg-[var(--bg-elevated)] text-[var(--accent)] font-mono rounded">${calcRes}</code> `);
    triggerAutoSave();
  };

  // ── FLOATING PANEL - WHITEBOARD ──
  const wbCanvasRef = useRef<HTMLCanvasElement>(null);
  const [wbColor, setWbColor] = useState('#FFFFFF');
  const [wbBrushSize, setWbBrushSize] = useState(5);
  const [wbTool, setWbTool] = useState<'pen' | 'eraser'>('pen');
  const isDrawingRef = useRef(false);

  const initWhiteboard = () => {
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0e0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (showWhiteboard) {
      setTimeout(initWhiteboard, 50);
    }
  }, [showWhiteboard]);

  const handleWbStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = wbTool === 'eraser' ? '#0e0e14' : wbColor;
    ctx.lineWidth = wbBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleWbDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleWbEnd = () => {
    isDrawingRef.current = false;
  };

  const insertWhiteboard = () => {
    const canvas = wbCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="Whiteboard Drawing" style="max-width:100%; border-radius:10px; border: 1px solid var(--border-subtle); margin:12px 0;" />`);
    setShowWhiteboard(false);
    triggerAutoSave();
  };

  // ── FLOATING PANEL - FORMULA EDITOR ──
  const [formulaInput, setFormulaInput] = useState('');
  const parsedFormulaHTML = useMemo(() => {
    let html = formulaInput;
    const symbols: Record<string, string> = {
      alpha: 'α', beta: 'β', theta: 'θ', delta: 'Δ', Delta: 'Δ', pi: 'π',
      sum: '∑', int: '∫', inf: '∞', neq: '≠', leq: '≤', geq: '≥', pm: '±',
      times: '×', div: '÷'
    };
    Object.entries(symbols).forEach(([k, v]) => {
      const reg = new RegExp(`\\\\${k}\\b`, 'g');
      html = html.replace(reg, v);
    });

    html = html.replace(/sqrt\(([^)]+)\)/g, '<div class="formula-sqrt"><span class="formula-sqrt-content">$1</span></div>');
    html = html.replace(/([^/\s()]+)\/([^/\s()]+)/g, '<div class="formula-fraction"><span class="formula-fraction-num">$1</span><span class="formula-fraction-bar"></span><span class="formula-fraction-den">$2</span></div>');
    html = html.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '<div class="formula-fraction"><span class="formula-fraction-num">$1</span><span class="formula-fraction-bar"></span><span class="formula-fraction-den">$2</span></div>');

    html = html.replace(/\^([^^(\s]+)/g, '<sup>$1</sup>');
    html = html.replace(/\^\(([^)]+)\)/g, '<sup>$1</sup>');

    html = html.replace(/_([^_(\s]+)/g, '<sub>$1</sub>');
    html = html.replace(/_\(([^)]+)\)/g, '<sub>$1</sub>');

    return `<span class="formula-rendered">${html}</span>`;
  }, [formulaInput]);

  const insertFormula = () => {
    if (!formulaInput.trim()) return;
    document.execCommand('insertHTML', false, parsedFormulaHTML);
    setFormulaInput('');
    setShowFormulaEditor(false);
    triggerAutoSave();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] text-[var(--text-primary)] select-none">
      
      {/* ── HEADER ── */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 font-sans">
        <div>
          <h2 className="text-xl font-bold font-headline text-white flex items-center gap-2">
            <FileText className="text-[var(--accent)]" size={20} />
            Módulo de Notas
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Organización y editor avanzado de apuntes</p>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-1.5 justify-end">
            <span className="font-mono text-3xl font-extralight text-[var(--accent)] text-shadow-glow">
              {timeStr}
            </span>
            {periodStr && <span className="text-xs text-[var(--accent)] font-semibold">{periodStr}</span>}
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mt-1">{dateStrCapitalized}</p>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="flex flex-1 overflow-hidden font-sans">
        
        {/* ── SIDEBAR ── */}
        <div className="w-[280px] border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col shrink-0">
          <div className="p-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-[var(--text-tertiary)]" size={14} />
              <input
                type="text"
                placeholder="Buscar apuntes..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg text-xs outline-none text-white focus:border-[var(--accent)]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-grow overflow-y-auto notes-sidebar p-3 space-y-4">
            
            {/* General buttons */}
            <div className="space-y-1">
              <button
                className={`notes-sidebar-item ${activeFolderId === 'all' ? 'active' : ''}`}
                onClick={() => { setActiveFolderId('all'); setSelectedTag(null); }}
              >
                <div className="flex items-center gap-2">
                  <FileText size={15} />
                  <span>Todos los apuntes</span>
                </div>
                <span className="count-badge">{notes.length}</span>
              </button>
              <button
                className={`notes-sidebar-item ${activeFolderId === 'pinned' ? 'active' : ''}`}
                onClick={() => { setActiveFolderId('pinned'); setSelectedTag(null); }}
              >
                <div className="flex items-center gap-2">
                  <Star size={15} />
                  <span>Destacadas</span>
                </div>
                <span className="count-badge">{notes.filter(n => n.isPinned).length}</span>
              </button>
            </div>

            {/* Folder section */}
            <div className="notes-sidebar-section">
              <div className="notes-sidebar-section-title">
                <span>Carpetas</span>
                <button
                  className="p-1 hover:bg-[var(--bg-hover)] rounded"
                  onClick={() => setShowNewFolderModal(true)}
                >
                  <FolderPlus size={13} />
                </button>
              </div>

              <div className="space-y-1 mt-1">
                {allFolders.map(folder => {
                  const isCourse = !!folder.courseId;
                  const count = notes.filter(n => isCourse ? n.course === folder.name : n.folderId === folder.id).length;
                  return (
                    <button
                      key={folder.id}
                      className={`notes-sidebar-item ${activeFolderId === folder.id ? 'active' : ''}`}
                      onClick={() => { setActiveFolderId(folder.id); setSelectedTag(null); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderIcon size={14} style={{ color: folder.color }} className="shrink-0" />
                        <span className="truncate">{folder.name}</span>
                        {isCourse && (
                          <span className="text-[8px] bg-[var(--bg-deep)] text-[var(--text-tertiary)] px-1 py-0.5 rounded leading-none shrink-0 font-semibold uppercase">
                            Curso
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="count-badge">{count}</span>
                        {folder.isManual && (
                          <Trash2
                            size={12}
                            className="text-red-500 hover:text-red-400 ml-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNoteFolder(folder.id);
                              if (activeFolderId === folder.id) setActiveFolderId('all');
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tag section */}
            <div className="notes-sidebar-section">
              <div className="notes-sidebar-section-title">
                <span>Etiquetas</span>
                {selectedTag && (
                  <button
                    className="text-[9px] text-[var(--accent)] font-semibold lowercase tracking-normal"
                    onClick={() => setSelectedTag(null)}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {allTags.map(({ name, count }) => {
                  const isEditing = editingTag === name;
                  const isConfirming = tagToDelete === name;

                  return (
                    <div
                      key={name}
                      className={`tag-chip ${selectedTag === name ? 'active' : ''} group flex items-center gap-1`}
                      onClick={() => !isEditing && setSelectedTag(name === selectedTag ? null : name)}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          className="bg-transparent text-white border-0 outline-none w-16 text-[10px]"
                          defaultValue={name}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTagGlobal(name, e.currentTarget.value);
                            if (e.key === 'Escape') setEditingTag(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : isConfirming ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px]">¿Borrar?</span>
                          <button onClick={() => handleDeleteTagGlobal(name)} className="hover:text-green-400 font-bold">Sí</button>
                          <button onClick={() => setTagToDelete(null)} className="hover:text-red-400 font-bold">No</button>
                        </div>
                      ) : (
                        <>
                          <span>#{name}</span>
                          <span className="text-[9px] opacity-60">({count})</span>
                          <div className="hidden group-hover:flex items-center gap-0.5 ml-1" onClick={e => e.stopPropagation()}>
                            <button
                              className="hover:text-white"
                              onClick={() => {
                                setEditingTag(name);
                                setEditingTagValue(name);
                              }}
                            >
                              <Edit3 size={9} />
                            </button>
                            <button
                              className="hover:text-white"
                              onClick={() => setTagToDelete(name)}
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {allTags.length === 0 && (
                  <span className="text-[10px] text-[var(--text-muted)] italic">Sin etiquetas</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── NOTES LIST OR EDITOR AREA ── */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {selectedNoteId ? (
            // ── EDITOR VIEW ──
            <div className="flex-grow flex flex-col h-full bg-[var(--bg-deep)] relative overflow-hidden">
              
              {/* Editor Header */}
              <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-secondary)]"
                    onClick={() => setSelectedNoteId(null)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex flex-col">
                    <input
                      ref={titleInputRef}
                      type="text"
                      className="bg-transparent font-bold text-sm text-white outline-none border-b border-transparent focus:border-[var(--accent)] w-[260px]"
                      placeholder="Título"
                      defaultValue={selectedNote?.title}
                      onChange={triggerAutoSave}
                    />
                    <input
                      ref={subtitleInputRef}
                      type="text"
                      className="bg-transparent text-[11px] text-[var(--text-secondary)] mt-0.5 outline-none border-b border-transparent focus:border-[var(--accent)] w-[260px] italic"
                      placeholder="Añadir subtítulo..."
                      defaultValue={selectedNote?.subtitle}
                      onChange={triggerAutoSave}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Saved Status */}
                  <span className="text-[10px] text-[var(--text-muted)] select-none mr-2">
                    {isSaved ? 'Guardado ✅' : 'Autoguardando...'}
                  </span>

                  <button
                    className={`p-2 rounded-lg border border-[var(--border-subtle)] ${
                      selectedNote?.isPinned
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                    onClick={() => {
                      if (selectedNote) updateNote(selectedNote.id, { isPinned: !selectedNote.isPinned });
                    }}
                  >
                    <Pin size={14} fill={selectedNote?.isPinned ? 'var(--accent)' : 'none'} />
                  </button>

                  {/* Download Selector */}
                  <div className="relative">
                    <button
                      className="p-2 bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDownloadMenu(prev => !prev);
                      }}
                    >
                      <Download size={14} />
                      <ChevronDown size={12} />
                    </button>
                    {showDownloadMenu && (
                      <div className="absolute right-0 mt-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1 w-48 z-50">
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-[var(--bg-hover)] text-xs text-white flex items-center gap-2 border-none"
                          onClick={() => downloadNote('txt')}
                        >
                          <FileText size={13} className="text-blue-400" /> Descargar (.txt)
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-[var(--bg-hover)] text-xs text-white flex items-center gap-2 border-none"
                          onClick={() => downloadNote('html')}
                        >
                          <Code size={13} className="text-red-400" /> Descargar (.html)
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    className="p-2 bg-transparent text-red-500 hover:bg-red-500/10 border border-red-500/20 rounded-lg"
                    onClick={() => selectedNote && setShowDeleteConfirm(selectedNote.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Metadata & Tags bar */}
              <div className="px-6 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 flex items-center justify-between gap-4 shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3">
                  {/* Folder Selector */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <FolderIcon size={13} className="text-[var(--text-secondary)]" />
                    <select
                      className="bg-transparent border-0 outline-none text-white font-semibold cursor-pointer text-xs"
                      value={selectedNote?.folderId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateNote(selectedNoteId, { folderId: val || undefined });
                        toast.success('Carpeta actualizada');
                      }}
                    >
                      <option value="" className="bg-[var(--bg-surface)] text-white">Sin carpeta</option>
                      {allFolders.filter(f => f.isManual).map(f => (
                        <option key={f.id} value={f.id} className="bg-[var(--bg-surface)] text-white">{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Course Indicator */}
                  {selectedNote?.course && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)] text-[10px] text-white">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedNote.courseColor }} />
                      <span>{selectedNote.course}</span>
                    </div>
                  )}
                </div>

                {/* Edit Tags of selected note */}
                <form onSubmit={handleCreateTag} className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    {selectedNote?.tags?.map(t => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-[9px] font-semibold flex items-center gap-1"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => {
                            const next = selectedNote.tags?.filter(tag => tag !== t) || [];
                            updateNote(selectedNote.id, { tags: next });
                          }}
                          className="hover:text-white border-none bg-transparent p-0 cursor-pointer"
                        >
                          <X size={8} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="+ etiqueta..."
                    className="bg-transparent border border-dashed border-[var(--border-subtle)] rounded-full px-2 py-0.5 text-[9px] text-white outline-none w-16 focus:w-24 focus:border-[var(--accent)] transition-all"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                  />
                </form>
              </div>

              {/* Rich Text Format Toolbar */}
              <div className="px-6 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
                
                {/* Format buttons */}
                <button className="editor-toolbar-btn border-none" onClick={() => applyFormat('bold')} data-tooltip="Negrita"><Bold size={14} /></button>
                <button className="editor-toolbar-btn border-none" onClick={() => applyFormat('italic')} data-tooltip="Cursiva"><Italic size={14} /></button>
                <button className="editor-toolbar-btn border-none" onClick={() => applyFormat('underline')} data-tooltip="Subrayado"><Underline size={14} /></button>
                
                <div className="editor-toolbar-divider" />
                
                <button className="editor-toolbar-btn border-none text-xs font-bold" onClick={() => applyFormat('formatBlock', '<h1>')} data-tooltip="Título 1">H1</button>
                <button className="editor-toolbar-btn border-none text-xs font-bold" onClick={() => applyFormat('formatBlock', '<h2>')} data-tooltip="Título 2">H2</button>
                <button className="editor-toolbar-btn border-none text-xs font-bold" onClick={() => applyFormat('formatBlock', '<h3>')} data-tooltip="Título 3">H3</button>

                <div className="editor-toolbar-divider" />

                <button className="editor-toolbar-btn border-none" onClick={() => applyFormat('insertUnorderedList')} data-tooltip="Lista Viñetas"><List size={14} /></button>
                <button className="editor-toolbar-btn border-none" onClick={() => applyFormat('insertOrderedList')} data-tooltip="Lista Numérica"><span className="text-[10px] font-bold">1.</span></button>
                
                <div className="editor-toolbar-divider" />

                <button
                  className="editor-toolbar-btn border-none"
                  onClick={() => {
                    const code = prompt('Ingresa bloque de código:');
                    if (code) applyFormat('insertHTML', `<pre><code>${code}</code></pre>`);
                  }}
                  data-tooltip="Código"
                >
                  <Code size={14} />
                </button>
                <button
                  className="editor-toolbar-btn border-none"
                  onClick={() => {
                    const quote = prompt('Ingresa cita:');
                    if (quote) applyFormat('insertHTML', `<blockquote>${quote}</blockquote>`);
                  }}
                  data-tooltip="Cita"
                >
                  <Type size={14} />
                </button>
                <button
                  className="editor-toolbar-btn border-none"
                  onClick={() => {
                    const text = prompt('Mensaje del Callout:');
                    if (text) applyFormat('insertHTML', `<div class="note-callout note-callout-info"><div>ℹ️</div><div>${text}</div></div>`);
                  }}
                  data-tooltip="Callout"
                >
                  <Info size={14} />
                </button>

                <div className="editor-toolbar-divider" />

                <button
                  className="editor-toolbar-btn border-none"
                  onClick={() => {
                    const url = prompt('URL de la imagen:');
                    if (url) applyFormat('insertImage', url);
                  }}
                  data-tooltip="Insertar Imagen"
                >
                  <ImageIcon size={14} />
                </button>
                
                <button
                  className="editor-toolbar-btn border-none"
                  onClick={() => {
                    const url = prompt('URL del enlace:');
                    if (url) {
                      const sel = window.getSelection();
                      if (sel && sel.toString()) {
                        applyFormat('createLink', url);
                      } else {
                        applyFormat('insertHTML', `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
                      }
                    }
                  }}
                  data-tooltip="Insertar Enlace"
                >
                  <Link size={14} />
                </button>

                {/* File Attachment Input Trigger */}
                <div className="relative">
                  <label className="editor-toolbar-btn cursor-pointer" data-tooltip="Adjuntar archivo">
                    <Paperclip size={14} />
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileAttachmentUpload}
                    />
                  </label>
                </div>

                <div className="editor-toolbar-divider" />

                {/* Dynamic Block Tools triggers */}
                <button
                  className={`editor-toolbar-btn border-none ${showWhiteboard ? 'active' : ''} flex items-center gap-1`}
                  onClick={() => {
                    setShowWhiteboard(!showWhiteboard);
                    setShowCalculator(false);
                    setShowFormulaEditor(false);
                  }}
                  data-tooltip="Pizarra / Whiteboard"
                >
                  <PenTool size={14} />
                  <span className="text-[10px] font-bold">Dibujar</span>
                </button>

                <button
                  className={`editor-toolbar-btn border-none ${showCalculator ? 'active' : ''} flex items-center gap-1`}
                  onClick={() => {
                    setShowCalculator(!showCalculator);
                    setShowWhiteboard(false);
                    setShowFormulaEditor(false);
                  }}
                  data-tooltip="Calculadora"
                >
                  <Calculator size={14} />
                  <span className="text-[10px] font-bold">Calc</span>
                </button>

                <button
                  className={`editor-toolbar-btn border-none ${showFormulaEditor ? 'active' : ''} flex items-center gap-1`}
                  onClick={() => {
                    setShowFormulaEditor(!showFormulaEditor);
                    setShowCalculator(false);
                    setShowWhiteboard(false);
                  }}
                  data-tooltip="Editor Fórmulas"
                >
                  <Sigma size={14} />
                  <span className="text-[10px] font-bold">Fórmula</span>
                </button>
              </div>

              {/* Main Content Editable Area */}
              <div className="flex-grow overflow-y-auto p-8 relative bg-[#0B0C0E]/50">
                
                {/* Floating formatting Popup */}
                {formatPopup.show && (
                  <div
                    className="format-popup"
                    style={{ left: formatPopup.x, top: formatPopup.y }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button onClick={() => applyFormat('bold')} className="p-1 hover:bg-[var(--bg-hover)] text-white rounded border-none bg-transparent"><Bold size={11} /></button>
                    <button onClick={() => applyFormat('italic')} className="p-1 hover:bg-[var(--bg-hover)] text-white rounded border-none bg-transparent"><Italic size={11} /></button>
                    <button onClick={() => applyFormat('underline')} className="p-1 hover:bg-[var(--bg-hover)] text-white rounded border-none bg-transparent"><Underline size={11} /></button>
                    <button
                      onClick={() => {
                        const url = prompt('URL del enlace:');
                        if (url) applyFormat('createLink', url);
                      }}
                      className="p-1 hover:bg-[var(--bg-hover)] text-white rounded border-none bg-transparent"
                    >
                      <Link size={11} />
                    </button>
                  </div>
                )}

                <div
                  ref={editorRef}
                  contentEditable
                  className="notes-editor-area"
                  onInput={() => {
                    triggerAutoSave();
                    updateEditorStats();
                  }}
                  onMouseUp={handleSelectionChange}
                  onKeyUp={handleSelectionChange}
                />
              </div>

              {/* Editor Footer Stats */}
              <div className="px-6 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex justify-between text-[10px] text-[var(--text-tertiary)] shrink-0">
                <div className="flex items-center gap-4">
                  <span>Palabras: <b className="text-white">{editorWordCount}</b></span>
                  <span>Caracteres: <b className="text-white">{editorCharCount}</b></span>
                </div>
                <span>Tiempo de lectura: <b className="text-white">{editorReadingTime} min</b></span>
              </div>

            </div>
          ) : (
            // ── NOTES LIST VIEW ──
            <div className="flex-grow flex flex-col h-full bg-[#0B0C0E]/30 relative overflow-hidden">
              
              {/* Toolbar */}
              <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-sm text-white">{activeFolderName}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--bg-deep)] text-[10px] font-semibold text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {filteredNotes.length} notas
                  </span>
                </div>

                <button
                  className="btn-primary flex items-center gap-1 text-xs py-1.5 px-3 cursor-pointer"
                  onClick={handleCreateNote}
                >
                  <Plus size={14} /> Nueva nota
                </button>
              </div>

              {/* Notes grid */}
              <div className="flex-grow overflow-y-auto p-6">
                {filteredNotes.length > 0 ? (
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={filteredNotes} strategy={verticalListSortingStrategy}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredNotes.map(note => (
                          <SortableNoteCard
                            key={note.id}
                            note={note}
                            isSelected={selectedNoteId === note.id}
                            onClick={() => setSelectedNoteId(note.id)}
                            onContextMenu={handleContextMenu}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] select-none">
                    <FileText size={48} className="text-[var(--text-tertiary)] opacity-30 mb-3" />
                    <p className="text-sm font-medium">No se encontraron apuntes</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Intenta cambiar de carpeta, filtro, o crea una nueva nota.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── FLOATING TOOL: SCIENTIFIC CALCULATOR ── */}
          {showCalculator && (
            <div className="tool-panel right-6 bottom-16 bg-[#0c0c10] shadow-2xl rounded-2xl border border-[var(--border-subtle)] p-4 w-[340px] flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Calculator size={13} className="text-[var(--accent)]" /> Calculadora Científica
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDeg(!isDeg)}
                    className="px-1.5 py-0.5 rounded bg-[var(--bg-deep)] text-[9px] font-bold text-white hover:bg-[var(--bg-hover)] border-none cursor-pointer"
                  >
                    {isDeg ? 'DEG' : 'RAD'}
                  </button>
                  <button onClick={() => setShowCalculator(false)} className="text-white hover:text-red-400 border-none bg-transparent cursor-pointer"><X size={14} /></button>
                </div>
              </div>

              {/* Display */}
              <div className="bg-[#050508] border border-white/[0.02] rounded-lg p-3 text-right">
                <p className="font-mono text-[10px] text-[var(--text-tertiary)] break-all min-h-[14px]">{calcExpr || '0'}</p>
                <h3 className="font-mono text-2xl font-semibold text-white break-all">{calcRes}</h3>
              </div>

              {/* Grid buttons */}
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {/* Memory row */}
                {['MC', 'MR', 'M+', 'M-'].map(btn => (
                  <button key={btn} onClick={() => toast.success('Memoria guardada')} className="calc-btn calc-btn-mem py-2 border-none">{btn}</button>
                ))}

                {/* Trigonometry and functions */}
                {['sin(', 'cos(', 'tan(', 'π'].map(btn => (
                  <button key={btn} onClick={() => handleCalcPress(btn)} className="calc-btn calc-btn-fn py-2 border-none">{btn === 'π' ? 'π' : btn.slice(0, 3)}</button>
                ))}

                {['√(', 'x²', '^', 'log('].map(btn => {
                  let lbl = btn;
                  if (btn === '√(') lbl = '√';
                  if (btn === 'x²') lbl = 'x²';
                  if (btn === '^') lbl = 'xʸ';
                  if (btn === 'log(') lbl = 'log';
                  return (
                    <button key={btn} onClick={() => handleCalcPress(btn === 'x²' ? '^2' : btn)} className="calc-btn calc-btn-fn py-2 border-none">{lbl}</button>
                  );
                })}

                {/* Arithmetic operators & numbers */}
                {['(', ')', '%', '÷'].map(btn => (
                  <button key={btn} onClick={() => handleCalcPress(btn)} className="calc-btn calc-btn-op py-2 border-none">{btn}</button>
                ))}

                {['7', '8', '9', '×'].map(btn => (
                  <button key={btn} onClick={() => handleCalcPress(btn === '×' ? '*' : btn)} className={`calc-btn py-2 border-none ${btn === '×' ? 'calc-btn-op' : 'calc-btn-num'}`}>{btn}</button>
                ))}

                {['4', '5', '6', '-'].map(btn => (
                  <button key={btn} onClick={() => handleCalcPress(btn)} className={`calc-btn py-2 border-none ${btn === '-' ? 'calc-btn-op' : 'calc-btn-num'}`}>{btn}</button>
                ))}

                {['1', '2', '3', '+'].map(btn => (
                  <button key={btn} onClick={() => handleCalcPress(btn)} className={`calc-btn py-2 border-none ${btn === '+' ? 'calc-btn-op' : 'calc-btn-num'}`}>{btn}</button>
                ))}

                <button onClick={() => handleCalcPress('C')} className="calc-btn calc-btn-clear py-2 border-none">C</button>
                <button onClick={() => handleCalcPress('0')} className="calc-btn calc-btn-num py-2 border-none">0</button>
                <button onClick={() => handleCalcPress('.')} className="calc-btn calc-btn-num py-2 border-none">.</button>
                <button onClick={() => handleCalcPress('=')} className="calc-btn calc-btn-eq py-2 border-none">=</button>
              </div>

              <button
                className="w-full btn-primary text-xs py-1.5 mt-1 border-none cursor-pointer"
                onClick={insertCalcResult}
              >
                Insertar resultado en nota
              </button>
            </div>
          )}

          {/* ── FLOATING TOOL: WHITEBOARD ── */}
          {showWhiteboard && (
            <div className="tool-panel right-6 bottom-16 bg-[#0c0c10] shadow-2xl rounded-2xl border border-[var(--border-subtle)] p-4 flex flex-col gap-3 z-50">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <PenTool size={13} className="text-[var(--accent)]" /> Pizarra de Dibujo
                </h4>
                <button onClick={() => setShowWhiteboard(false)} className="text-white hover:text-red-400 border-none bg-transparent cursor-pointer"><X size={14} /></button>
              </div>

              {/* Canvas toolbar */}
              <div className="flex items-center justify-between gap-4 bg-[var(--bg-deep)] p-2 rounded-lg border border-[var(--border-subtle)]">
                <div className="flex gap-2">
                  <button
                    className={`p-1.5 rounded text-xs font-semibold border-none cursor-pointer ${wbTool === 'pen' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-white bg-transparent'}`}
                    onClick={() => setWbTool('pen')}
                  >
                    Lápiz
                  </button>
                  <button
                    className={`p-1.5 rounded text-xs font-semibold border-none cursor-pointer ${wbTool === 'eraser' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-white bg-transparent'}`}
                    onClick={() => setWbTool('eraser')}
                  >
                    Borrador
                  </button>
                </div>

                {/* Brush size slider */}
                <div className="flex items-center gap-2 text-[10px]">
                  <span>Pincel:</span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    className="w-16 h-1 rounded-lg bg-[var(--bg-surface)] accent-[var(--accent)] cursor-pointer"
                    value={wbBrushSize}
                    onChange={e => setWbBrushSize(Number(e.target.value))}
                  />
                  <span>{wbBrushSize}px</span>
                </div>

                {/* Clear canvas */}
                <button
                  onClick={initWhiteboard}
                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[10px] font-semibold border-none cursor-pointer"
                >
                  Limpiar
                </button>
              </div>

              {/* Color dots row */}
              <div className="flex gap-2 justify-center py-1">
                {['#FFFFFF', '#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'].map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setWbColor(c);
                      setWbTool('pen');
                    }}
                    className="w-5 h-5 rounded-full border border-white/20 transition-all hover:scale-115 cursor-pointer"
                    style={{
                      backgroundColor: c,
                      boxShadow: wbColor === c && wbTool === 'pen' ? `0 0 10px ${c}` : 'none',
                      transform: wbColor === c && wbTool === 'pen' ? 'scale(1.15)' : 'scale(1)'
                    }}
                  />
                ))}
              </div>

              {/* Canvas area */}
              <canvas
                ref={wbCanvasRef}
                width={480}
                height={320}
                className="whiteboard-canvas rounded-lg border border-[var(--border-subtle)]"
                onMouseDown={handleWbStart}
                onMouseMove={handleWbDraw}
                onMouseUp={handleWbEnd}
                onMouseLeave={handleWbEnd}
                onTouchStart={handleWbStart}
                onTouchMove={handleWbDraw}
                onTouchEnd={handleWbEnd}
              />

              <button
                className="w-full btn-primary text-xs py-1.5 border-none cursor-pointer"
                onClick={insertWhiteboard}
              >
                Insertar pizarra en nota
              </button>
            </div>
          )}

          {/* ── FLOATING TOOL: FORMULA EDITOR ── */}
          {showFormulaEditor && (
            <div className="tool-panel right-6 bottom-16 bg-[#0c0c10] shadow-2xl rounded-2xl border border-[var(--border-subtle)] p-4 w-[380px] flex flex-col gap-3 z-50">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Sigma size={13} className="text-[var(--accent)]" /> Editor de Fórmulas Matemáticas
                </h4>
                <button onClick={() => setShowFormulaEditor(false)} className="text-white hover:text-red-400 border-none bg-transparent cursor-pointer"><X size={14} /></button>
              </div>

              {/* Preview */}
              <div className="bg-[#050508] border border-white/[0.02] rounded-lg p-6 min-h-[90px] flex items-center justify-center overflow-x-auto">
                <div dangerouslySetInnerHTML={{ __html: formulaInput ? parsedFormulaHTML : '<span class="italic text-[var(--text-muted)] text-xs">Vista previa de la fórmula...</span>' }} />
              </div>

              {/* Quick symbol triggers */}
              <div className="flex flex-wrap gap-1">
                {[
                  { sym: '\\alpha', lbl: 'α' }, { sym: '\\beta', lbl: 'β' },
                  { sym: '\\theta', lbl: 'θ' }, { sym: '\\Delta', lbl: 'Δ' },
                  { sym: '\\pi', lbl: 'π' }, { sym: '\\sum', lbl: '∑' },
                  { sym: '\\int', lbl: '∫' }, { sym: '\\inf', lbl: '∞' },
                  { sym: '\\neq', lbl: '≠' }, { sym: '\\leq', lbl: '≤' },
                  { sym: '\\geq', lbl: '≥' }, { sym: '\\pm', lbl: '±' },
                  { sym: '\\times', lbl: '×' }, { sym: '\\div', lbl: '÷' },
                  { sym: 'a/b', lbl: 'a/b' }, { sym: 'sqrt(x)', lbl: '√x' },
                  { sym: '^', lbl: 'xʸ' }, { sym: '_', lbl: 'x₁' }
                ].map(({ sym, lbl }) => (
                  <button
                    key={sym}
                    onClick={() => {
                      setFormulaInput(prev => prev + (sym === 'a/b' ? '(a)/(b)' : sym));
                    }}
                    className="px-2 py-1 bg-[var(--bg-deep)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] rounded font-mono text-[var(--text-secondary)] hover:text-white cursor-pointer"
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Escribe la fórmula sintaxis (ej. sqrt(a/b))"
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)] font-mono"
                value={formulaInput}
                onChange={e => setFormulaInput(e.target.value)}
              />

              <button
                className="w-full btn-primary text-xs py-1.5 border-none cursor-pointer"
                onClick={insertFormula}
              >
                Insertar fórmula en nota
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── CONTEXT MENU ── */}
      {contextMenu && (
        <div
          className="notes-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="notes-context-menu-item border-none bg-transparent"
            onClick={() => {
              if (contextMenu) {
                updateNote(contextMenu.note.id, { isPinned: !contextMenu.note.isPinned });
                setContextMenu(null);
                toast.success(contextMenu.note.isPinned ? 'Nota desfijada' : 'Nota fijada');
              }
            }}
          >
            <Pin size={13} /> {contextMenu.note.isPinned ? 'Desfijar' : 'Fijar nota'}
          </button>

          <button
            className="notes-context-menu-item border-none bg-transparent"
            onClick={() => {
              if (contextMenu) {
                duplicateNote(contextMenu.note.id);
                setContextMenu(null);
                toast.success('Nota duplicada');
              }
            }}
          >
            <Copy size={13} /> Duplicar nota
          </button>

          <button
            className="notes-context-menu-item border-none bg-transparent"
            onClick={() => {
              if (contextMenu) {
                setShowMoveFolderModal(contextMenu.note.id);
                setContextMenu(null);
              }
            }}
          >
            <Move size={13} /> Mover de carpeta
          </button>

          <div className="notes-context-menu-divider" />

          <button
            className="notes-context-menu-item danger border-none bg-transparent"
            onClick={() => {
              if (contextMenu) {
                setShowDeleteConfirm(contextMenu.note.id);
                setContextMenu(null);
              }
            }}
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      )}

      {/* ── MODAL: CREATE NEW FOLDER ── */}
      {showNewFolderModal && (
        <div className="notes-modal-overlay animate-fadeIn" onClick={() => setShowNewFolderModal(false)}>
          <div className="notes-modal w-96 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Nueva Carpeta Personal</h3>
              <button onClick={() => setShowNewFolderModal(false)} className="text-white hover:text-red-400 border-none bg-transparent cursor-pointer"><X size={16} /></button>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span>Nombre de la carpeta:</span>
              <input
                type="text"
                className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-white outline-none focus:border-[var(--accent)]"
                placeholder="Ej. Tesis / Proyectos"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span>Descripción (opcional):</span>
              <textarea
                className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-white outline-none focus:border-[var(--accent)] resize-none h-16"
                placeholder="Breve reseña..."
                value={newFolderDesc}
                onChange={e => setNewFolderDesc(e.target.value)}
              />
            </div>

            {/* Color Grid */}
            <div className="flex flex-col gap-2 text-xs">
              <span>Color identificador:</span>
              <div className="flex flex-wrap gap-2.5">
                {[
                  '#E11D48', '#EF4444', '#F59E0B', '#10B981',
                  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
                  '#EC4899', '#14B8A6', '#6B7280', '#0F172A'
                ].map(c => (
                  <button
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    className={`folder-color-option border-none ${newFolderColor === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2 text-xs">
              <button className="btn-secondary px-4 py-2 border-none cursor-pointer font-bold" onClick={() => setShowNewFolderModal(false)}>Cancelar</button>
              <button className="btn-primary px-4 py-2 border-none cursor-pointer font-bold" onClick={handleCreateFolderSubmit}>Crear Carpeta</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE NOTE CONFIRMATION ── */}
      {showDeleteConfirm && (
        <div className="notes-modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="notes-modal w-80 text-center flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase">¿Eliminar apunte?</h3>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">Esta acción no se puede deshacer. Se borrarán todos los bloques del repositorio.</p>
            </div>
            <div className="flex gap-3 w-full text-xs mt-2">
              <button className="flex-1 btn-secondary py-2 border-none cursor-pointer font-bold" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
              <button className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 font-bold border-none cursor-pointer" onClick={handleDeleteNoteConfirm}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MOVE NOTE TO FOLDER ── */}
      {showMoveFolderModal && (
        <div className="notes-modal-overlay" onClick={() => setShowMoveFolderModal(null)}>
          <div className="notes-modal w-80 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Mover a carpeta</h3>
              <button onClick={() => setShowMoveFolderModal(null)} className="text-white hover:text-red-400 border-none bg-transparent cursor-pointer"><X size={16} /></button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto notes-sidebar">
              <button
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] rounded-lg text-white flex items-center gap-2 border-none bg-transparent cursor-pointer"
                onClick={() => handleMoveFolder(undefined)}
              >
                <FolderIcon size={14} className="text-gray-400" />
                <span>Sin carpeta (Notas sueltas)</span>
              </button>

              {allFolders.filter(f => f.isManual).map(f => (
                <button
                  key={f.id}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] rounded-lg text-white flex items-center gap-2 border-none bg-transparent cursor-pointer"
                  onClick={() => handleMoveFolder(f.id)}
                >
                  <FolderIcon size={14} style={{ color: f.color }} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
