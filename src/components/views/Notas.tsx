import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Pin, X, FileText, BookOpen, Clock, ArrowRight, Save, Sparkles, ChevronRight, Activity, Command, StickyNote, AlertTriangle } from 'lucide-react';
import { useApp, Note } from '../../store/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Notas() {
  const { notes, courses, addNote, updateNote, deleteNote } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteCourse, setNewNoteCourse] = useState(courses[0]?.name || 'General');

  useEffect(() => {
    if (notes.length === 0) {
      setSelectedNote(null);
      return;
    }
    if (!selectedNote || !notes.find(n => n.id === selectedNote.id)) {
      setSelectedNote(notes[0]);
      setEditTitle(notes[0].title);
      setEditContent(notes[0].content);
      setEditMode(false);
    }
  }, [notes, selectedNote]);

  const filteredNotes = useMemo(() => {
    return notes.filter(n =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

  const selectNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditMode(false);
  }, []);

  const createNote = useCallback(() => {
    const course = courses.find(c => c.name === newNoteCourse) || courses[0];
    const newNoteData = {
      title: 'Nueva Entrada',
      content: '',
      course: course?.name || 'General',
      courseColor: course?.color || '#E11D48',
      isPinned: false,
    };
    addNote(newNoteData);
    setShowNewNoteModal(false);
  }, [courses, newNoteCourse, addNote]);

  const saveNote = useCallback(() => {
    if (selectedNote) {
      updateNote(selectedNote.id, { title: editTitle, content: editContent });
      setEditMode(false);
    }
  }, [selectedNote, editTitle, editContent, updateNote]);

  const handleDelete = useCallback(() => {
    if (deleteId) {
      deleteNote(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, deleteNote]);

  return (
    <div className="page-container">
      
      {/* ARCHITECTURAL HEADER - REFINED */}
      <header className="flex justify-between items-end mb-24 relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StickyNote size={20} className="text-accent" />
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.5em]">Repositorio Documental</span>
          </div>
          <h1 className="text-8xl font-black text-primary tracking-tighter leading-none">
            Apuntes
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl text-secondary font-medium tracking-tight opacity-60">
            {notes.length} ENTRADAS REGISTRADAS EN TU SISTEMA
          </p>
        </div>

        <div className="flex gap-8 items-center">
          <div className="relative group">
            <Search size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" />
            <input
              type="text"
              placeholder="Buscar entradas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/[0.02] border border-white/5 h-20 pl-16 pr-10 rounded-[32px] text-lg font-bold text-primary focus:border-accent outline-none transition-all w-96 placeholder:text-muted/30"
            />
          </div>
          <button 
            onClick={() => setShowNewNoteModal(true)}
            className="px-12 h-20 rounded-[32px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all flex items-center gap-4"
          >
            <Plus size={24} /> Nueva Entrada
          </button>
        </div>
      </header>

      <div className="bento-card p-0 flex h-[800px] overflow-hidden border-white/[0.02] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none opacity-20" />
        
        {/* SIDEBAR - REFINED */}
        <div className="w-[450px] flex flex-col bg-white/[0.01] backdrop-blur-3xl border-r border-white/[0.03] z-10">
          <div className="p-12 border-b border-white/[0.03] flex justify-between items-center bg-white/[0.01]">
            <span className="text-[11px] font-black text-tertiary uppercase tracking-[0.4em]">Directorio</span>
            <div className="px-5 py-2 rounded-full bg-accent/10 border border-accent/20">
               <span className="text-[10px] font-black text-accent uppercase tracking-widest">{filteredNotes.length} Ítems</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => selectNote(note)}
                className={`p-10 rounded-[48px] border transition-all duration-500 relative group flex flex-col gap-4 ${
                  selectedNote?.id === note.id 
                  ? 'bg-elevated border-white/10 shadow-2xl scale-[1.02] z-10' 
                  : 'bg-transparent border-transparent text-tertiary hover:bg-white/[0.03] hover:translate-x-2'
                }`}
              >
                {selectedNote?.id === note.id && (
                  <div className="absolute left-4 top-10 bottom-10 w-2 bg-accent rounded-full shadow-[0_0_15px_var(--accent)]" />
                )}
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-white/5" style={{ color: note.courseColor, backgroundColor: `${note.courseColor}15` }}>{note.course}</span>
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">{format(new Date(note.updatedAt), 'dd MMM')}</span>
                </div>
                <h3 className="text-3xl font-black text-primary truncate tracking-tighter">{note.title || 'Sin Título'}</h3>
                <p className="text-[13px] text-secondary line-clamp-2 font-medium leading-relaxed opacity-40 group-hover:opacity-80 transition-opacity">{note.content || 'Sin contenido registrado...'}</p>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteId(note.id); }}
                  className="absolute top-10 right-8 w-12 h-12 rounded-2xl bg-accent/5 text-accent opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-accent/10 hover:scale-110"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}

            {filteredNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-48 opacity-10">
                <FileText size={80} className="mb-6" />
                <p className="font-black uppercase tracking-[0.4em] text-center">Sin Coincidencias</p>
              </div>
            )}
          </div>
        </div>

        {/* EDITOR AREA - REFINED */}
        <div className="flex-1 flex flex-col bg-white/[0.005] backdrop-blur-sm z-10">
          {selectedNote ? (
            <>
              <div className="p-12 border-b border-white/[0.03] flex justify-between items-center bg-white/[0.01]">
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[28px] bg-accent/5 flex items-center justify-center border border-accent/20">
                    <Command size={28} className="text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <p className="text-[11px] font-black text-accent uppercase tracking-[0.4em]">{selectedNote.course}</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                      <p className="text-[11px] font-black text-muted uppercase tracking-widest">{format(new Date(selectedNote.updatedAt), 'dd MMMM, yyyy', { locale: es }).toUpperCase()}</p>
                    </div>
                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest flex items-center gap-3">
                      <Activity size={12} className="text-accent/50" /> Protocolo de Registro Activo
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  {editMode ? (
                    <button onClick={saveNote} className="px-10 h-16 rounded-[24px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                      <Save size={20} /> Guardar Cambios
                    </button>
                  ) : (
                    <button onClick={() => setEditMode(true)} className="px-10 h-16 rounded-[24px] bg-white/[0.03] border border-white/10 text-primary hover:bg-white/5 transition-all font-black text-[11px] uppercase tracking-[0.3em] flex items-center gap-3">
                      <Edit2 size={20} /> Editar Entrada
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 p-24 overflow-y-auto">
                <div className="max-w-4xl mx-auto flex flex-col h-full relative">
                  <div className="absolute -left-24 top-0 text-[180px] font-black text-accent/5 select-none pointer-events-none leading-none">"</div>
                  {editMode ? (
                    <div className="flex flex-col gap-16 h-full">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título de la entrada..."
                        className="bg-transparent text-7xl font-black text-primary outline-none border-none tracking-tighter placeholder:text-white/5"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Inicia el registro de ideas..."
                        className="flex-1 bg-transparent text-2xl text-secondary outline-none border-none resize-none leading-relaxed placeholder:text-white/5 font-medium font-inter opacity-80"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-16 animate-fadeIn">
                      <h2 className="text-8xl font-black text-primary tracking-tighter leading-none group relative">
                        {selectedNote.title || 'Sin Título'}
                        <span className="text-accent opacity-0 group-hover:opacity-100 transition-opacity absolute -right-8 bottom-0">.</span>
                      </h2>
                      <div className="text-3xl text-secondary leading-relaxed whitespace-pre-wrap font-medium pb-48 opacity-60 font-inter tracking-tight">
                        {selectedNote.content || 'Este sector del repositorio no contiene datos registrados aún.'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-10">
              <Sparkles size={160} />
              <p className="mt-12 font-black uppercase tracking-[0.8em] text-center">Repositorio Optimizado</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS - REFINED */}
      {showNewNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNewNoteModal(false)}>
          <div className="bento-card max-w-2xl w-full p-16 bg-surface shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-white/10 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-16">
              <div>
                <h2 className="text-5xl font-black tracking-tighter mb-4">Nueva Entrada</h2>
                <p className="text-[11px] font-black text-muted uppercase tracking-widest">Protocolo de Documentación</p>
              </div>
              <button onClick={() => setShowNewNoteModal(false)} className="w-16 h-16 rounded-full flex items-center justify-center hover:bg-white/5 transition-all">
                <X size={32} className="text-muted" />
              </button>
            </div>
            
            <div className="space-y-12">
              <div className="flex flex-col gap-5">
                <label className="text-[11px] font-black text-muted uppercase tracking-[0.3em]">Asignación de Sector</label>
                <div className="relative">
                  <select 
                    className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[32px] text-primary font-black text-2xl outline-none appearance-none cursor-pointer focus:border-accent transition-all"
                    value={newNoteCourse}
                    onChange={(e) => setNewNoteCourse(e.target.value)}
                  >
                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <ChevronRight size={32} className="absolute right-8 top-1/2 -translate-y-1/2 text-muted pointer-events-none rotate-90" />
                </div>
              </div>
              <div className="flex gap-6 pt-8">
                <button onClick={() => setShowNewNoteModal(false)} className="flex-1 py-6 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] text-tertiary hover:bg-white/5 transition-all">Cancelar</button>
                <button onClick={createNote} className="flex-[2] py-6 rounded-[28px] bg-accent text-white font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Generar Ítem</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="bento-card max-w-lg w-full p-16 bg-surface border-accent/20 animate-fadeIn" onClick={e => e.stopPropagation()}>
             <div className="flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-[48px] bg-accent/5 flex items-center justify-center text-accent mb-12 border border-accent/20">
                <AlertTriangle size={64} />
              </div>
              <h2 className="text-5xl font-black tracking-tighter mb-6">¿Purgar Registro?</h2>
              <p className="text-secondary text-lg font-medium mb-16 opacity-60 leading-relaxed">Esta entrada será eliminada permanentemente del repositorio central.</p>
              
              <div className="flex gap-6 w-full">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-6 rounded-[28px] bg-white/[0.02] border border-white/5 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Abortar</button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-6 rounded-[28px] bg-accent text-white text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}