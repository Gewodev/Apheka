import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BookOpen, Clock, List as ListIcon, Layers, Star, Plus,
  Target, GraduationCap, ChevronLeft, ChevronRight, CheckCircle,
  FileText, BrainCircuit, NotebookPen, ExternalLink,
  Image as ImageIcon, Folder, X, Upload, MoreVertical,
  Search, Filter, Trash2, Edit3, Eye, Check, Calendar,
  CheckSquare, Play, RotateCw, FileQuestion, ThumbsUp,
  AlertCircle, ArrowUp, ArrowDown, Share2, Paperclip,
  BarChart2, PieChart, Sparkles, BookMarked, Globe,
  Video, File, Circle, Loader, Award, HelpCircle, Wifi
} from 'lucide-react';
import { useApp, Course, Task, Note } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
export default function Cursos({ initialCourseId }: { initialCourseId?: string }) {
  const { 
    courses, tasks, notes, addCourse, updateCourse, deleteCourse,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    addNote, updateNote, deleteNote, addNotification
  } = useApp();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId === 'NEW' ? (courses[0]?.id || '') : (initialCourseId || courses[0]?.id || '')
  );
  const [activeTab, setActiveTab] = useState<'resumen' | 'tareas' | 'notas' | 'recursos' | 'repasos'>('resumen');
  
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

  // Modals & Forms state
  const [showNewCourse, setShowNewCourse] = useState(initialCourseId === 'NEW');
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewResource, setShowNewResource] = useState(false);
  const [showNewImage, setShowNewImage] = useState(false);
  const [showNewRepaso, setShowNewRepaso] = useState(false);

  useEffect(() => {
    if (initialCourseId === 'NEW') {
      setShowNewCourse(true);
      if (courses[0]) setSelectedCourseId(courses[0].id);
    } else if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    }
  }, [initialCourseId, courses]);
  
  // Selected course object
  const selectedCourseIndex = courses.findIndex(c => c.id === selectedCourseId);
  const selectedCourse = courses[selectedCourseIndex] || courses[0];

  const handlePrevCourse = () => {
    if (courses.length <= 1) return;
    const newIdx = (selectedCourseIndex - 1 + courses.length) % courses.length;
    setSelectedCourseId(courses[newIdx].id);
  };

  const handleNextCourse = () => {
    if (courses.length <= 1) return;
    const newIdx = (selectedCourseIndex + 1) % courses.length;
    setSelectedCourseId(courses[newIdx].id);
  };

  // Course custom local state or fallbacks if not in Course interface
  const courseDescription = selectedCourse?.description || 'DescripciÃ³n breve del curso, objetivos principales y lo que aprenderÃ¡s durante el semestre.';
  const courseLevel = selectedCourse?.level || 'Nivel Intermedio';
  const courseCredits = selectedCourse?.credits || '5 CrÃ©ditos';
  const courseCode = selectedCourse?.code || 'MAT-401';
  const courseTeacher = selectedCourse?.teacher || 'Dr. Alexander Wright';

  // Filtered items for selected course
  const courseTasks = useMemo(() => tasks.filter(t => t.course === selectedCourse?.name), [tasks, selectedCourse]);
  const courseNotes = useMemo(() => notes.filter(n => n.course === selectedCourse?.name), [notes, selectedCourse]);
  
  const completedTasksCount = courseTasks.filter(t => t.status === 'completado').length;
  const pendingTasksCount = courseTasks.filter(t => t.status !== 'completado').length;
  const progressPct = courseTasks.length > 0 ? Math.round((completedTasksCount / courseTasks.length) * 100) : 75;

  // Anchored images array matching the screenshot exactly
  const anchoredImages = selectedCourse?.anchoredImages || [
    { id: '1', name: 'Esquema_Estructural_01.png', url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=600&auto=format&fit=crop', date: '2 May 2025', tag: 'Tema 1 - Cabecera' },
    { id: '2', name: 'Tabla_Formulas_Avanzadas.webp', url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=600&auto=format&fit=crop', date: '28 Abr 2025', tag: 'FÃ³rmulas Clave' },
    { id: '3', name: 'Diagrama_Flujo_Proyecto.jpg', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop', date: '15 Abr 2025', tag: 'Anexo B - Laboratorio' }
  ];

  // Resources list matching the screenshot exactly
  const defaultResources = [
    { id: 'r1', title: 'PÃ¡gina del curso oficial', url: 'https://miscurso.edu/matematica', type: 'link', date: 'Hoy, 14:30' },
    { id: 'r2', title: 'Documentos y Normativas oficiales', url: 'https://docs.miscurso.edu', type: 'doc', date: 'Ayer, 18:45' },
    { id: 'r3', title: 'Biblioteca digital y Repositorio', url: 'https://biblio.miscurso.edu', type: 'link', date: '2 May, 16:20' },
    { id: 'r4', title: 'Foro de dudas y discusiÃ³n grupal', url: 'https://foro.miscurso.edu', type: 'link', date: '1 May, 20:10' },
  ];
  const resourcesList = selectedCourse?.resources || defaultResources;

  // Flashcards / Repaso list matching the screenshot exactly
  const defaultFlashcards = [
    { id: 'fc1', question: 'Â¿CuÃ¡l es la derivada de e^(2x)?', answer: '2e^(2x)', difficulty: 'bueno' as const, lastReviewed: 'Ayer', nextReview: '4 May' },
    { id: 'fc2', question: 'Teorema Fundamental del CÃ¡lculo (Parte 1)', answer: 'La integral de la derivada de una funciÃ³n es la funciÃ³n original evaluada en los lÃ­mites.', difficulty: 'dificil' as const, lastReviewed: 'Hace 3 dÃ­as', nextReview: '5 May' },
    { id: 'fc3', question: 'DefiniciÃ³n de LÃ­mite de una funciÃ³n', answer: 'Para todo Îµ > 0 existe un Î´ > 0 tal que si 0 < |x - c| < Î´ entonces |f(x) - L| < Îµ.', difficulty: 'facil' as const, lastReviewed: 'Hace 5 dÃ­as', nextReview: '10 May' },
  ];
  const flashcards = selectedCourse?.flashcards || defaultFlashcards;

  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  // New Course Form State
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#8B5CF6');

  // Edit Course Form State
  const [editDesc, setEditDesc] = useState(courseDescription);
  const [editLevel, setEditLevel] = useState(courseLevel);
  const [editCredits, setEditCredits] = useState(courseCredits);

  // Sync Edit Form with Selected Course
  useEffect(() => {
    if (selectedCourse) {
      setEditDesc(selectedCourse.description || 'DescripciÃ³n breve del curso, objetivos principales y lo que aprenderÃ¡s durante el semestre.');
      setEditLevel(selectedCourse.level || 'Nivel Intermedio');
      setEditCredits(selectedCourse.credits || '5 CrÃ©ditos');
      setActiveFlashcardIndex(0);
      setShowFlashcardAnswer(false);
    }
  }, [selectedCourse]);

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // New Note Form State
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // New Resource Form State
  const [newResTitle, setNewResTitle] = useState('');
  const [newResUrl, setNewResUrl] = useState('');
  const [newResType, setNewResType] = useState<'link' | 'pdf' | 'doc' | 'video'>('link');

  // New Anchored Image Form State
  const [newImgName, setNewImgName] = useState('');
  const [newImgTag, setNewImgTag] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  // New Flashcard Form State
  const [newFcQuestion, setNewFcQuestion] = useState('');
  const [newFcAnswer, setNewFcAnswer] = useState('');

  // Preview Image Modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Handlers
  const handleCreateCourse = () => {
    if (!newCourseName.trim()) { addNotification('Ingresa el nombre del curso', 'error'); return; }
    const newId = addCourse({
      name: newCourseName.trim(),
      color: newCourseColor,
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      hoursStudied: 0
    });
    setSelectedCourseId(newId);
    setNewCourseName('');
    setShowNewCourse(false);
  };

  const handleSaveCourseEdit = () => {
    updateCourse(selectedCourse.id, {
      description: editDesc,
      level: editLevel,
      credits: editCredits,
    });
    setShowEditCourse(false);
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) { addNotification('Ingresa un tÃ­tulo para la tarea', 'error'); return; }
    addTask({
      title: newTaskTitle.trim(),
      course: selectedCourse.name,
      courseColor: selectedCourse.color,
      priority: newTaskPriority,
      urgent: newTaskPriority === 'high',
      important: newTaskPriority === 'high',
      dueDate: newTaskDueDate || undefined,
      estimatedMinutes: 60
    });
    setNewTaskTitle('');
    setNewTaskDueDate('');
    setShowNewTask(false);
  };

  const handleCreateNote = () => {
    if (!newNoteTitle.trim()) { addNotification('Ingresa el tÃ­tulo de la nota', 'error'); return; }
    addNote({
      title: newNoteTitle.trim(),
      content: newNoteContent.trim() || '<p>Contenido de la nota...</p>',
      course: selectedCourse.name,
      courseColor: selectedCourse.color,
      isPinned: false
    });
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowNewNote(false);
  };

  const handleCreateResource = () => {
    if (!newResTitle.trim() || !newResUrl.trim()) { addNotification('Completa todos los campos', 'error'); return; }
    const newRes = {
      id: Date.now().toString(),
      title: newResTitle.trim(),
      url: newResUrl.trim(),
      type: newResType,
      date: 'Hoy, ' + format(new Date(), 'HH:mm')
    };
    updateCourse(selectedCourse.id, { resources: [newRes, ...resourcesList] });
    setNewResTitle('');
    setNewResUrl('');
    setShowNewResource(false);
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewImgUrl(ev.target?.result as string);
      if (!newImgName) setNewImgName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddAnchoredImage = () => {
    if (!newImgName.trim() || !newImgUrl.trim() || !newImgTag.trim()) {
      addNotification('Completa el nombre, la etiqueta de posiciÃ³n y selecciona una imagen', 'error');
      return;
    }
    const updatedImages = [{
      id: Date.now().toString(),
      name: newImgName.trim(),
      url: newImgUrl,
      date: format(new Date(), "d MMM yyyy", { locale: es }),
      tag: newImgTag.trim()
    }, ...anchoredImages];
    
    updateCourse(selectedCourse.id, { anchoredImages: updatedImages });
    setNewImgName('');
    setNewImgTag('');
    setNewImgUrl('');
    setShowNewImage(false);
  };

  const handleDeleteAnchoredImage = (id: string) => {
    const updatedImages = anchoredImages.filter(img => img.id !== id);
    updateCourse(selectedCourse.id, { anchoredImages: updatedImages });
  };

  const handleCreateFlashcard = () => {
    if (!newFcQuestion.trim() || !newFcAnswer.trim()) { addNotification('Ingresa pregunta y respuesta', 'error'); return; }
    const newFc = {
      id: Date.now().toString(),
      question: newFcQuestion.trim(),
      answer: newFcAnswer.trim(),
      difficulty: 'bueno' as const,
      lastReviewed: 'Nunca',
      nextReview: 'MaÃ±ana'
    };
    updateCourse(selectedCourse.id, { flashcards: [...flashcards, newFc] });
    setNewFcQuestion('');
    setNewFcAnswer('');
    setShowNewRepaso(false);
  };

  const handleRateFlashcard = (rating: 'facil' | 'bueno' | 'dificil') => {
    const updatedFcs = flashcards.map((fc, i) => i === activeFlashcardIndex ? {
      ...fc,
      difficulty: rating,
      lastReviewed: 'Hoy',
      nextReview: rating === 'facil' ? 'En 5 dÃ­as' : rating === 'bueno' ? 'En 3 dÃ­as' : 'MaÃ±ana'
    } : fc);
    updateCourse(selectedCourse.id, { flashcards: updatedFcs });
    setShowFlashcardAnswer(false);
    setActiveFlashcardIndex((activeFlashcardIndex + 1) % flashcards.length);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* â”€â”€ HEADER â”€â”€ */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>Cursos</h1>
            <GraduationCap size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Gestiona tu aprendizaje, domina tu carrera.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <NotificationBell />
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <div className="led-display" style={{ fontSize: 28, fontWeight: 300, lineHeight: 1 }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 14 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </header>

      {selectedCourse ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
          
          {/* Navigation Bar matching screenshot */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={handlePrevCourse} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-default)' }}><ChevronLeft size={16} /></button>
              <h2 style={{ fontSize: 16, fontWeight: 600, minWidth: 220, textAlign: 'center', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                {selectedCourse.name}
              </h2>
              <button onClick={handleNextCourse} className="btn-ghost hover-lift" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-default)' }}><ChevronRight size={16} /></button>
              <button onClick={() => setShowNewCourse(true)} className="btn-secondary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', height: 34, marginLeft: 8 }}>
                + Nuevo
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, border: '1px solid var(--border-default)' }}>
              {[
                { id: 'resumen', label: 'Resumen', icon: Layers },
                { id: 'tareas', label: 'Tareas', icon: ListIcon },
                { id: 'notas', label: 'Notas', icon: NotebookPen },
                { id: 'recursos', label: 'Recursos', icon: Globe },
                { id: 'repasos', label: 'Repaso', icon: BrainCircuit },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
                  padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 200ms',
                }}>
                  <tab.icon size={14} />
                  {tab.label}
                  {tab.id === 'tareas' && pendingTasksCount > 0 && (
                    <span style={{ padding: '2px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{pendingTasksCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT AREA (GRID 1fr 300px) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, flex: 1, alignItems: 'flex-start' }}>
            
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {activeTab === 'resumen' && (
                <>
                  {/* Top Stats Bar matching screenshot (4 cards) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    
                    {/* Progreso */}
                    <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progreso</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{progressPct}%</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Completado</div>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--success-dim)', border: '1px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                        <CheckCircle size={20} />
                      </div>
                    </div>

                    {/* Tareas */}
                    <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tareas</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{courseTasks.length || 12}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{pendingTasksCount || 3} pendientes</div>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--warning-dim)', border: '1px solid var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
                        <CheckSquare size={20} />
                      </div>
                    </div>

                    {/* Notas */}
                    <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notas</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{courseNotes.length || 8}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Guardadas</div>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--info-dim)', border: '1px solid var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }}>
                        <FileText size={20} />
                      </div>
                    </div>

                    {/* Horas */}
                    <div className="bento-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Horas</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>24h 30m</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Estudiadas</div>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <Clock size={20} />
                      </div>
                    </div>

                  </div>

                  {/* ImÃ¡genes Ancladas Section matching screenshot */}
                  <div className="bento-card" style={{ padding: '24px 20px', background: 'var(--bg-deep)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                        <ImageIcon size={20} className="text-accent" /> ImÃ¡genes Ancladas
                      </h3>
                      <button onClick={() => setShowNewImage(true)} className="btn-secondary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', height: 34 }}>
                        + AÃ±adir
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {anchoredImages.map(img => (
                        <div key={img.id} className="bento-card" style={{ padding: 12, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div onClick={() => setPreviewImageUrl(img.url)} style={{ width: '100%', height: 140, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                            <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 200ms' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                              <Eye size={20} color="#fff" />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{img.tag}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{img.date}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recursos del Curso Section matching screenshot */}
                  <div className="bento-card" style={{ padding: '24px 20px', background: 'var(--bg-deep)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                        <Globe size={20} className="text-accent" /> Recursos del Curso
                      </h3>
                      <button onClick={() => setShowNewResource(true)} className="btn-secondary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', height: 34 }}>
                        + AÃ±adir
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {resourcesList.map(res => (
                        <a key={res.id} href={res.url} target="_blank" rel="noopener noreferrer" className="bento-card" style={{ padding: '14px 16px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                              {res.type === 'pdf' ? <FileText size={18} className="text-error" /> : res.type === 'doc' ? <File size={18} className="text-info" /> : <Globe size={18} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{res.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{res.url}</div>
                            </div>
                          </div>
                          <ExternalLink size={16} style={{ color: 'var(--text-tertiary)' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAREAS TAB */}
              {activeTab === 'tareas' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 500 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <CheckSquare size={20} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>GestiÃ³n de Tareas</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Administra las tareas y asignaciones de {selectedCourse.name}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowNewTask(true)} className="btn-primary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> Nueva tarea
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {courseTasks.map(task => {
                      const isDone = task.status === 'completado';
                      return (
                        <div key={task.id} className="bento-card" style={{ padding: '16px', background: isDone ? 'var(--bg-surface)' : 'var(--bg-base)', border: '1px solid var(--border-subtle)', opacity: isDone ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <button onClick={() => toggleTaskStatus(task.id)} style={{ width: 24, height: 24, borderRadius: '50%', border: isDone ? 'none' : '2px solid var(--border-default)', background: isDone ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              {isDone && <Check size={14} color="#fff" />}
                            </button>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Fecha lÃ­mite: {task.dueDate ? format(new Date(task.dueDate), "d MMMM yyyy", { locale: es }) : 'Sin fecha'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: task.priority === 'high' ? 'var(--error-dim)' : task.priority === 'medium' ? 'var(--warning-dim)' : 'var(--success-dim)', color: task.priority === 'high' ? 'var(--error)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                              {task.priority === 'high' ? 'Prioridad Alta' : task.priority === 'medium' ? 'Prioridad Media' : 'Prioridad Baja'}
                            </span>
                            <button onClick={() => deleteTask(task.id)} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {courseTasks.length === 0 && (
                      <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <CheckSquare size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>No hay tareas registradas para este curso.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NOTAS TAB */}
              {activeTab === 'notas' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 500 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <NotebookPen size={20} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Apuntes y Notas</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Registra resÃºmenes, ideas y apuntes de clase de {selectedCourse.name}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowNewNote(true)} className="btn-primary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> Nueva nota
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    {courseNotes.map(note => (
                      <div key={note.id} className="bento-card" style={{ padding: 20, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{note.title}</h3>
                          <button onClick={() => deleteNote(note.id)} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}><Trash2 size={14} /></button>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }} dangerouslySetInnerHTML={{ __html: note.content }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          <span>Actualizado: {format(new Date(note.updatedAt), "d MMM yyyy", { locale: es })}</span>
                        </div>
                      </div>
                    ))}
                    {courseNotes.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', padding: '64px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <NotebookPen size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>No hay notas guardadas para este curso.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RECURSOS TAB */}
              {activeTab === 'recursos' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 500 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <Globe size={20} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Recursos y BibliografÃ­a</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Enlaces web, bibliotecas digitales y documentos de consulta de {selectedCourse.name}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowNewResource(true)} className="btn-primary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> AÃ±adir recurso
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {resourcesList.map(res => (
                      <div key={res.id} className="bento-card" style={{ padding: '16px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                            {res.type === 'pdf' ? <FileText size={20} className="text-error" /> : res.type === 'doc' ? <File size={20} className="text-info" /> : <Globe size={20} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{res.title}</div>
                            <a href={res.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                              <span>{res.url}</span> <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{res.date}</span>
                          <button onClick={() => updateCourse(selectedCourse.id, { resources: resourcesList.filter(r => r.id !== res.id) })} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REPASO TAB */}
              {activeTab === 'repasos' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 500 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <BrainCircuit size={20} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Repaso Activo (Flashcards)</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Sistema de repeticiÃ³n espaciada para consolidar el aprendizaje de {selectedCourse.name}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowNewRepaso(true)} className="btn-primary hover-lift" style={{ fontSize: 12, fontWeight: 600, padding: '0 16px', height: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> Crear tarjeta
                    </button>
                  </div>

                  {flashcards.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 640, margin: '0 auto', padding: '20px 0' }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                        <span>Tarjeta {activeFlashcardIndex + 1} de {flashcards.length}</span>
                        <span style={{ color: 'var(--accent)' }}>Dificultad: {flashcards[activeFlashcardIndex]?.difficulty?.toUpperCase() || 'BUENO'}</span>
                      </div>

                      <div onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)} className="bento-card" style={{ width: '100%', height: 320, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32, cursor: 'pointer', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', padding: '6px 12px', borderRadius: 12 }}>
                          Clic para voltear
                        </div>
                        {!showFlashcardAnswer ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                            <HelpCircle size={40} style={{ color: 'var(--accent)', opacity: 0.5 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Pregunta</span>
                            <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{flashcards[activeFlashcardIndex]?.question}</h3>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                            <Sparkles size={40} style={{ color: 'var(--success)', opacity: 0.5 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase' }}>Respuesta</span>
                            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{flashcards[activeFlashcardIndex]?.answer}</p>
                          </div>
                        )}
                      </div>

                      {showFlashcardAnswer && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Â¿QuÃ© tan fÃ¡cil fue recordar la respuesta?</span>
                          <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                            <button onClick={() => handleRateFlashcard('dificil')} style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--error-dim)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>DifÃ­cil</button>
                            <button onClick={() => handleRateFlashcard('bueno')} style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--warning-dim)', border: '1px solid var(--warning)', color: 'var(--warning)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Bueno</button>
                            <button onClick={() => handleRateFlashcard('facil')} style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--success-dim)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>FÃ¡cil</button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 16 }}>
                        <button onClick={() => { setShowFlashcardAnswer(false); setActiveFlashcardIndex((activeFlashcardIndex - 1 + flashcards.length) % flashcards.length); }} className="btn-secondary" style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600 }}>Anterior</button>
                        <button onClick={() => { setShowFlashcardAnswer(false); setActiveFlashcardIndex((activeFlashcardIndex + 1) % flashcards.length); }} className="btn-secondary" style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600 }}>Siguiente</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      <BrainCircuit size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>No hay tarjetas de repaso creadas para este curso.</div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* RIGHT COLUMN matching screenshot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* InformaciÃ³n del Curso Card */}
              <div className="bento-card" style={{ padding: '24px 20px', background: 'var(--bg-deep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>InformaciÃ³n del Curso</h3>
                  <button onClick={() => setShowEditCourse(true)} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}><Edit3 size={16} /></button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  {courseDescription}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>ASIGNATURA</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{courseLevel.toUpperCase()}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{courseCredits.toUpperCase()}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{courseTeacher}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{courseCode}</div>
                </div>
              </div>

              {/* Tarjetas de Repaso Card matching screenshot */}
              <div className="bento-card" style={{ padding: '24px 20px', background: 'var(--bg-deep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Tarjetas de Repaso</h3>
                  <button onClick={() => setShowNewRepaso(true)} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}><Plus size={16} /></button>
                </div>

                {flashcards.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ padding: '20px 16px', border: '1px solid var(--border-subtle)', borderRadius: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{flashcards[activeFlashcardIndex]?.question}</span>
                      {showFlashcardAnswer && (
                        <div style={{ padding: '12px', borderRadius: 8, fontSize: 12, color: 'var(--success)', fontWeight: 600, width: '100%', marginTop: 8 }}>
                          {flashcards[activeFlashcardIndex]?.answer}
                        </div>
                      )}
                    </div>

                    {!showFlashcardAnswer ? (
                      <button onClick={() => setShowFlashcardAnswer(true)} className="btn-primary hover-lift" style={{ width: '100%', height: 38, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Ver Respuesta
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleRateFlashcard('dificil')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--error-dim)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>DIFÃCIL</button>
                        <button onClick={() => handleRateFlashcard('bueno')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--warning-dim)', border: '1px solid var(--warning)', color: 'var(--warning)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>BUENO</button>
                        <button onClick={() => handleRateFlashcard('facil')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--success-dim)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>FÃCIL</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                    No hay tarjetas de repaso creadas.
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div style={{ padding: '128px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <GraduationCap size={64} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Selecciona un curso o crea uno nuevo</div>
          <button onClick={() => setShowNewCourse(true)} className="btn-primary" style={{ marginTop: 16, padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Crear nuevo curso</button>
        </div>
      )}

      {/* â”€â”€ MODALS & FORMS â”€â”€ */}
      
      {/* NEW COURSE MODAL */}
      {showNewCourse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewCourse(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <GraduationCap size={22} className="text-accent" /> Nuevo Curso
              </h2>
              <button onClick={() => setShowNewCourse(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Nombre del Curso</label>
                <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Ej. Ãlgebra Lineal Avanzada" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Color Distintivo</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  {['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'].map(color => (
                    <button key={color} onClick={() => setNewCourseColor(color)} style={{ width: 32, height: 32, borderRadius: 8, background: color, border: newCourseColor === color ? '2px solid #fff' : 'none', cursor: 'pointer', transform: newCourseColor === color ? 'scale(1.1)' : 'none', transition: 'all 200ms', boxShadow: newCourseColor === color ? `0 0 12px ${color}` : 'none' }} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewCourse(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleCreateCourse} disabled={!newCourseName.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Crear curso</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT COURSE MODAL */}
      {showEditCourse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowEditCourse(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <Edit3 size={22} className="text-accent" /> Editar InformaciÃ³n
              </h2>
              <button onClick={() => setShowEditCourse(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>DescripciÃ³n del curso</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="DescripciÃ³n breve..." className="input-base" style={{ width: '100%', height: 80, fontSize: 13, padding: 12 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Nivel AcadÃ©mico</label>
                  <input type="text" value={editLevel} onChange={e => setEditLevel(e.target.value)} placeholder="Ej. Nivel Intermedio" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>CrÃ©ditos</label>
                  <input type="text" value={editCredits} onChange={e => setEditCredits(e.target.value)} placeholder="Ej. 5 CrÃ©ditos" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowEditCourse(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleSaveCourseEdit} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW TASK MODAL */}
      {showNewTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewTask(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <CheckSquare size={22} className="text-accent" /> Nueva Tarea
              </h2>
              <button onClick={() => setShowNewTask(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>TÃ­tulo de la tarea</label>
                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Ej. Resolver guÃ­a de ejercicios..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Prioridad</label>
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)} className="input-base" style={{ width: '100%', height: 40, fontSize: 13, background: 'var(--bg-surface)' }}>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Fecha lÃ­mite</label>
                  <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewTask(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleCreateTask} disabled={!newTaskTitle.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Crear tarea</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW NOTE MODAL */}
      {showNewNote && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewNote(false)}>
          <div className="bento-card" style={{ width: 480, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <NotebookPen size={22} className="text-accent" /> Nueva Nota
              </h2>
              <button onClick={() => setShowNewNote(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>TÃ­tulo de la nota</label>
                <input type="text" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} placeholder="Ej. Resumen CapÃ­tulo 4..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Contenido / Apuntes</label>
                <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Escribe tus apuntes, ideas o resÃºmenes aquÃ­..." className="input-base" style={{ width: '100%', height: 160, fontSize: 13, padding: 12 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewNote(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleCreateNote} disabled={!newNoteTitle.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Guardar nota</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW RESOURCE MODAL */}
      {showNewResource && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewResource(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <Globe size={22} className="text-accent" /> AÃ±adir Recurso
              </h2>
              <button onClick={() => setShowNewResource(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Tipo de recurso</label>
                <div style={{ display: 'flex', gap: 8, padding: 6, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  {(['link', 'pdf', 'doc', 'video'] as const).map(type => (
                    <button key={type} onClick={() => setNewResType(type)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: newResType === type ? 'var(--accent)' : 'transparent', color: newResType === type ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms' }}>
                      {type === 'link' ? 'Web' : type === 'pdf' ? 'PDF' : type === 'doc' ? 'Doc' : 'Video'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>TÃ­tulo del recurso</label>
                <input type="text" value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="Ej. Repositorio de exÃ¡menes pasados..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>URL o Enlace</label>
                <input type="text" value={newResUrl} onChange={e => setNewResUrl(e.target.value)} placeholder="https://..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewResource(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleCreateResource} disabled={!newResTitle.trim() || !newResUrl.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>AÃ±adir recurso</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW ANCHORED IMAGE MODAL */}
      {showNewImage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewImage(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <ImageIcon size={22} className="text-accent" /> AÃ±adir Imagen Anclada
              </h2>
              <button onClick={() => setShowNewImage(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Nombre del archivo / Imagen</label>
                <input type="text" value={newImgName} onChange={e => setNewImgName(e.target.value)} placeholder="Ej. Esquema_Tema_04.png" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Etiqueta de Posicionamiento / Tema</label>
                <input type="text" value={newImgTag} onChange={e => setNewImgTag(e.target.value)} placeholder="Ej. Tema 4 - Cabecera" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Seleccionar Imagen</label>
                <input type="file" ref={imageInputRef} onChange={handleImageSelected} style={{ display: 'none' }} accept="image/*" />
                <div style={{ display: 'flex', gap: 12 }}>
                  <input type="text" value={newImgUrl} onChange={e => setNewImgUrl(e.target.value)} placeholder="URL de la imagen o subir archivo..." className="input-base" style={{ flex: 1, height: 40, fontSize: 13 }} />
                  <button onClick={() => imageInputRef.current?.click()} className="btn-secondary" style={{ padding: '0 16px', height: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Upload size={16} /> Subir
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewImage(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleAddAnchoredImage} disabled={!newImgName.trim() || !newImgTag.trim() || !newImgUrl.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Anclar imagen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW FLASHCARD MODAL */}
      {showNewRepaso && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewRepaso(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <BrainCircuit size={22} className="text-accent" /> Crear Tarjeta de Repaso
              </h2>
              <button onClick={() => setShowNewRepaso(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Pregunta o Concepto</label>
                <input type="text" value={newFcQuestion} onChange={e => setNewFcQuestion(e.target.value)} placeholder="Ej. Â¿CuÃ¡l es la fÃ³rmula de la velocidad de escape?" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Respuesta o ExplicaciÃ³n</label>
                <textarea value={newFcAnswer} onChange={e => setNewFcAnswer(e.target.value)} placeholder="Ej. v = âˆš(2GM/R)..." className="input-base" style={{ width: '100%', height: 100, fontSize: 13, padding: 12 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewRepaso(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleCreateFlashcard} disabled={!newFcQuestion.trim() || !newFcAnswer.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Crear tarjeta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewImageUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }} onClick={() => setPreviewImageUrl(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <img src={previewImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '90vh' }} />
            <button onClick={() => setPreviewImageUrl(null)} className="btn-ghost" style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.8)', padding: 8, borderRadius: '50%', color: '#fff' }}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

