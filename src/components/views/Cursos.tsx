import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BookOpen, Clock, List as ListIcon, Layers, Star, Plus,
  Target, GraduationCap, CheckCircle,
  FileText, BrainCircuit, NotebookPen, ExternalLink,
  Image as ImageIcon, Folder, X, Upload, MoreVertical,
  Search, Filter, Trash2, Edit3, Eye, Check, Calendar,
  CheckSquare, Play, RotateCw, FileQuestion, ThumbsUp,
  AlertCircle, ArrowUp, ArrowDown, Share2, Paperclip,
  BarChart2, PieChart, Sparkles, BookMarked, Globe,
  Video, File, Circle, Loader, Award, HelpCircle, Wifi
} from 'lucide-react';
import { useApp, Course, Task, Note, fmtClock } from '../../store/AppContext';
import NotificationBell from '../ui/NotificationBell';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
export default function Cursos({ initialCourseId }: { initialCourseId?: string }) {
  const { 
    courses, tasks, notes, addCourse, updateCourse, deleteCourse,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    addNote, updateNote, deleteNote, addNotification,
    settings,
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

  const timeStr = fmtClock(format(currentTime, 'HH:mm'), settings?.timeFormat);
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
  const courseDescription = selectedCourse?.description || 'Descripción breve del curso, objetivos principales y lo que aprenderás durante el semestre.';
  const courseLevel = selectedCourse?.level || 'Nivel Intermedio';
  const courseCredits = selectedCourse?.credits || '5 Créditos';
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
    { id: '2', name: 'Tabla_Formulas_Avanzadas.webp', url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=600&auto=format&fit=crop', date: '28 Abr 2025', tag: 'Fórmulas Clave' },
    { id: '3', name: 'Diagrama_Flujo_Proyecto.jpg', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop', date: '15 Abr 2025', tag: 'Anexo B - Laboratorio' }
  ];

  // Resources list matching the screenshot exactly
  const defaultResources = [
    { id: 'r1', title: 'Página del curso oficial', url: 'https://miscurso.edu/matematica', type: 'link', date: 'Hoy, 14:30' },
    { id: 'r2', title: 'Documentos y Normativas oficiales', url: 'https://docs.miscurso.edu', type: 'doc', date: 'Ayer, 18:45' },
    { id: 'r3', title: 'Biblioteca digital y Repositorio', url: 'https://biblio.miscurso.edu', type: 'link', date: '2 May, 16:20' },
    { id: 'r4', title: 'Foro de dudas y discusión grupal', url: 'https://foro.miscurso.edu', type: 'link', date: '1 May, 20:10' },
  ];
  const resourcesList = selectedCourse?.resources || defaultResources;

  // Flashcards / Repaso list matching the screenshot exactly
  const defaultFlashcards = [
    { id: 'fc1', question: '¿Cuál es la derivada de e^(2x)?', answer: '2e^(2x)', difficulty: 'bueno' as const, lastReviewed: 'Ayer', nextReview: '4 May' },
    { id: 'fc2', question: 'Teorema Fundamental del Cálculo (Parte 1)', answer: 'La integral de la derivada de una función es la función original evaluada en los límites.', difficulty: 'dificil' as const, lastReviewed: 'Hace 3 días', nextReview: '5 May' },
    { id: 'fc3', question: 'Definición de Límite de una función', answer: 'Para todo ε > 0 existe un δ > 0 tal que si 0 < |x - c| < δ entonces |f(x) - L| < ε.', difficulty: 'facil' as const, lastReviewed: 'Hace 5 días', nextReview: '10 May' },
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
      setEditDesc(selectedCourse.description || 'Descripción breve del curso, objetivos principales y lo que aprenderás durante el semestre.');
      setEditLevel(selectedCourse.level || 'Nivel Intermedio');
      setEditCredits(selectedCourse.credits || '5 Créditos');
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
    if (!newTaskTitle.trim()) { addNotification('Ingresa un título para la tarea', 'error'); return; }
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
    if (!newNoteTitle.trim()) { addNotification('Ingresa el título de la nota', 'error'); return; }
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
      addNotification('Completa el nombre, la etiqueta de posición y selecciona una imagen', 'error');
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
    if (!newFcQuestion.trim() || !newFcAnswer.trim()) { addNotification('Ingresa Pregunta y Respuesta', 'error'); return; }
    const newFc = {
      id: Date.now().toString(),
      question: newFcQuestion.trim(),
      answer: newFcAnswer.trim(),
      difficulty: 'bueno' as const,
      lastReviewed: 'Nunca',
      nextReview: 'Mañana'
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
      nextReview: rating === 'facil' ? 'En 5 días' : rating === 'bueno' ? 'En 3 días' : 'Mañana'
    } : fc);
    updateCourse(selectedCourse.id, { flashcards: updatedFcs });
    setShowFlashcardAnswer(false);
    setActiveFlashcardIndex((activeFlashcardIndex + 1) % flashcards.length);
  };

  const courseImageUrl = selectedCourse?.color ? `https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=1200&auto=format&fit=crop` : '';

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HERO HEADER with blurred cover ── */}
      {selectedCourse && (
        <div style={{ position: 'relative', marginBottom: 24, borderRadius: 16, overflow: 'hidden', minHeight: 200 }}>
          {/* Blurred cover background */}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${selectedCourse.color}22 0%, var(--bg-base) 100%)`, opacity: 0.6 }} />
          {selectedCourse.anchoredImages?.[0]?.url && (
            <img src={selectedCourse.anchoredImages[0].url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px) saturate(1.2)', opacity: 0.25 }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(2,2,3,0.85) 0%, rgba(11,12,15,0.6) 100%)' }} />

          <div style={{ position: 'relative', padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedCourse.color, boxShadow: `0 0 12px ${selectedCourse.color}` }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{courseLevel.toUpperCase()} · {courseCode}</span>
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: "'Outfit', 'Inter Tight', sans-serif" }}>
                {selectedCourse.name}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8, fontWeight: 400, maxWidth: 480 }}>
                {courseDescription}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                Conectado
              </div>
              <NotificationBell />
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 20, textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 52, fontWeight: 200, lineHeight: 0.85, color: selectedCourse.color, letterSpacing: '0.02em', textShadow: `0 0 30px ${selectedCourse.color}66` }}>
                    {timeStr}
                  </span>
                  <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 200, color: selectedCourse.color, opacity: 0.7 }}>
                    {secondsStr}
                  </span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {dateStrCapitalized}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCourse ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
          
          {/* Workspace Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-deep)', padding: 3, borderRadius: 10 }}>
              {[
                { id: 'resumen', label: 'Resumen', icon: Layers },
                { id: 'tareas', label: 'Tareas', icon: ListIcon },
                { id: 'notas', label: 'Notas', icon: NotebookPen },
                { id: 'recursos', label: 'Recursos', icon: Globe },
                { id: 'repasos', label: 'Repaso', icon: BrainCircuit },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
                  padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 200ms',
                }}>
                  <tab.icon size={13} />
                  {tab.label}
                  {tab.id === 'tareas' && pendingTasksCount > 0 && (
                    <span style={{ padding: '1px 5px', borderRadius: 8, background: 'rgba(255,255,255,0.2)', fontSize: 9 }}>{pendingTasksCount}</span>
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
                  {/* Top Stats Bar — minimal premium */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Progreso', value: `${progressPct}%`, sub: 'Completado', icon: CheckCircle, color: 'var(--success)' },
                      { label: 'Tareas', value: courseTasks.length || 12, sub: `${pendingTasksCount || 3} pendientes`, icon: CheckSquare, color: 'var(--warning)' },
                      { label: 'Notas', value: courseNotes.length || 8, sub: 'Guardadas', icon: FileText, color: 'var(--info)' },
                      { label: 'Horas', value: '24h 30m', sub: 'Estudiadas', icon: Clock, color: 'var(--accent)' },
                    ].map(stat => (
                      <div key={stat.label} className="bento-card" style={{ padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <stat.icon size={13} color={stat.color} />
                          </div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8, fontFamily: "'Inter Tight', sans-serif" }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{stat.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Imágenes Ancladas */}
                  <div className="bento-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                        <ImageIcon size={16} /> Imágenes Ancladas
                      </h3>
                      <button onClick={() => setShowNewImage(true)} className="btn-secondary" style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', height: 28 }}>
                        + Añadir
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      {anchoredImages.map(img => (
                        <div key={img.id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                          <div onClick={() => setPreviewImageUrl(img.url)} style={{ width: '100%', height: 130, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                            <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 200ms' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                              <Eye size={18} color="#fff" />
                            </div>
                          </div>
                          <div style={{ padding: '8px 10px' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                              <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>{img.tag}</span>
                              <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{img.date}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recursos del Curso */}
                  <div className="bento-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                        <Globe size={16} /> Recursos del Curso
                      </h3>
                      <button onClick={() => setShowNewResource(true)} className="btn-secondary" style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', height: 28 }}>
                        + Añadir
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {resourcesList.map(res => (
                        <a key={res.id} href={res.url} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', transition: 'background 200ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {res.type === 'pdf' ? <FileText size={15} color="var(--error)" /> : res.type === 'doc' ? <File size={15} color="var(--info)" /> : <Globe size={15} color="var(--accent)" />}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.url}</div>
                            </div>
                          </div>
                          <ExternalLink size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAREAS TAB */}
              {activeTab === 'tareas' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <CheckSquare size={17} /> Gestión de Tareas
                    </h2>
                    <button onClick={() => setShowNewTask(true)} className="btn-primary" style={{ fontSize: 11, fontWeight: 600, padding: '0 14px', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Nueva tarea
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {courseTasks.map(task => {
                      const isDone = task.status === 'completado';
                      return (
                        <div key={task.id} style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', borderLeft: '3px solid ' + (task.priority === 'high' ? 'var(--error)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--border-default)'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button onClick={() => toggleTaskStatus(task.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: isDone ? 'none' : '2px solid var(--border-default)', background: isDone ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              {isDone && <Check size={11} color="#fff" />}
                            </button>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Fecha límite: {task.dueDate ? format(new Date(task.dueDate), "d MMMM yyyy", { locale: es }) : 'Sin fecha'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {task.priority !== 'none' ? (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 5, background: task.priority === 'high' ? 'var(--error-dim)' : task.priority === 'medium' ? 'var(--warning-dim)' : 'var(--success-dim)', color: task.priority === 'high' ? 'var(--error)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                            </span>
                            ) : (
                            <span style={{ fontSize: 10, fontWeight: 400, padding: '3px 7px', borderRadius: 5, background: 'var(--bg-hover)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Sin prioridad
                            </span>
                            )}
                            <button onClick={() => deleteTask(task.id)} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {courseTasks.length === 0 && (
                      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <CheckSquare size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No hay tareas registradas para este curso.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NOTAS TAB */}
              {activeTab === 'notas' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <NotebookPen size={17} /> Apuntes y Notas
                    </h2>
                    <button onClick={() => setShowNewNote(true)} className="btn-primary" style={{ fontSize: 11, fontWeight: 600, padding: '0 14px', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Nueva nota
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {courseNotes.map(note => (
                      <div key={note.id} style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{note.title}</h3>
                          <button onClick={() => deleteNote(note.id)} className="btn-ghost" style={{ padding: 3, borderRadius: 5 }}><Trash2 size={13} /></button>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: note.content }} />
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                          Actualizado: {format(new Date(note.updatedAt), "d MMM yyyy", { locale: es })}
                        </div>
                      </div>
                    ))}
                    {courseNotes.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <NotebookPen size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No hay notas guardadas para este curso.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RECURSOS TAB */}
              {activeTab === 'recursos' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <Globe size={17} /> Recursos y Bibliografía
                    </h2>
                    <button onClick={() => setShowNewResource(true)} className="btn-primary" style={{ fontSize: 11, fontWeight: 600, padding: '0 14px', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Añadir recurso
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {resourcesList.map(res => (
                      <div key={res.id} style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {res.type === 'pdf' ? <FileText size={16} color="var(--error)" /> : res.type === 'doc' ? <File size={16} color="var(--info)" /> : <Globe size={16} color="var(--accent)" />}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{res.title}</div>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {res.url} <ExternalLink size={10} />
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{res.date}</span>
                          <button onClick={() => updateCourse(selectedCourse.id, { resources: resourcesList.filter(r => r.id !== res.id) })} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REPASO TAB */}
              {activeTab === 'repasos' && (
                <div className="bento-card" style={{ padding: '24px 20px', minHeight: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <BrainCircuit size={17} /> Repaso Activo (Flashcards)
                    </h2>
                    <button onClick={() => setShowNewRepaso(true)} className="btn-primary" style={{ fontSize: 11, fontWeight: 600, padding: '0 14px', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Crear tarjeta
                    </button>
                  </div>

                  {flashcards.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 560, margin: '0 auto', padding: '16px 0' }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                        <span>Tarjeta {activeFlashcardIndex + 1} de {flashcards.length}</span>
                        <span style={{ color: 'var(--accent)' }}>Dificultad: {flashcards[activeFlashcardIndex]?.difficulty?.toUpperCase() || 'BUENO'}</span>
                      </div>

                      <div onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)} style={{ width: '100%', minHeight: 260, borderRadius: 12, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '28px 24px', cursor: 'pointer', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                          Clic para voltear
                        </div>
                        {!showFlashcardAnswer ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <HelpCircle size={32} style={{ color: 'var(--accent)', opacity: 0.4 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Pregunta</span>
                            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{flashcards[activeFlashcardIndex]?.question}</h3>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <Sparkles size={32} style={{ color: 'var(--success)', opacity: 0.4 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase' }}>Respuesta</span>
                            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{flashcards[activeFlashcardIndex]?.answer}</p>
                          </div>
                        )}
                      </div>

                      {showFlashcardAnswer && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>¿Qué tan fácil fue recordar?</span>
                          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            {[
                              { label: 'Difícil', rating: 'dificil' as const, color: 'var(--error)', bg: 'var(--error-dim)' },
                              { label: 'Bueno', rating: 'bueno' as const, color: 'var(--warning)', bg: 'var(--warning-dim)' },
                              { label: 'Fácil', rating: 'facil' as const, color: 'var(--success)', bg: 'var(--success-dim)' },
                            ].map(opt => (
                              <button key={opt.rating} onClick={() => handleRateFlashcard(opt.rating)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: opt.bg, border: `1px solid ${opt.color}`, color: opt.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{opt.label}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={() => { setShowFlashcardAnswer(false); setActiveFlashcardIndex((activeFlashcardIndex - 1 + flashcards.length) % flashcards.length); }} className="btn-secondary" style={{ padding: '6px 16px', fontSize: 11, fontWeight: 600 }}>Anterior</button>
                        <button onClick={() => { setShowFlashcardAnswer(false); setActiveFlashcardIndex((activeFlashcardIndex + 1) % flashcards.length); }} className="btn-secondary" style={{ padding: '6px 16px', fontSize: 11, fontWeight: 600 }}>Siguiente</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      <BrainCircuit size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No hay tarjetas de repaso creadas para este curso.</div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Información del Curso */}
              <div className="bento-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Información del Curso</h3>
                  <button onClick={() => setShowEditCourse(true)} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}><Edit3 size={14} /></button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                  {courseDescription}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {['ASIGNATURA', courseLevel.toUpperCase(), courseCredits.toUpperCase()].map(label => (
                    <span key={label} style={{ fontSize: 9, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', background: 'var(--bg-deep)' }}>{label}</span>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{courseTeacher}</div>
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{courseCode}</div>
                </div>
              </div>

              {/* Tarjetas de Repaso sidebar */}
              <div className="bento-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Tarjetas de Repaso</h3>
                  <button onClick={() => setShowNewRepaso(true)} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}><Plus size={14} /></button>
                </div>

                {flashcards.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: '16px 14px', border: '1px solid var(--border-subtle)', borderRadius: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{flashcards[activeFlashcardIndex]?.question}</span>
                      {showFlashcardAnswer && (
                        <div style={{ padding: '10px', borderRadius: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600, width: '100%' }}>
                          {flashcards[activeFlashcardIndex]?.answer}
                        </div>
                      )}
                    </div>

                    {!showFlashcardAnswer ? (
                      <button onClick={() => setShowFlashcardAnswer(true)} className="btn-primary" style={{ width: '100%', height: 34, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Ver Respuesta
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { label: 'Difícil', rating: 'dificil' as const, color: 'var(--error)', bg: 'var(--error-dim)' },
                          { label: 'Bueno', rating: 'bueno' as const, color: 'var(--warning)', bg: 'var(--warning-dim)' },
                          { label: 'Fácil', rating: 'facil' as const, color: 'var(--success)', bg: 'var(--success-dim)' },
                        ].map(opt => (
                          <button key={opt.rating} onClick={() => handleRateFlashcard(opt.rating)} style={{ flex: 1, padding: '6px', borderRadius: 6, background: opt.bg, border: `1px solid ${opt.color}`, color: opt.color, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{opt.label.toUpperCase()}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
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
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <GraduationCap size={22} className="text-accent" /> Nuevo Curso
              </h2>
              <button onClick={() => setShowNewCourse(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Nombre del Curso</label>
                <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Ej. Álgebra Lineal Avanzada" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
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
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <Edit3 size={22} className="text-accent" /> Editar Información
              </h2>
              <button onClick={() => setShowEditCourse(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Descripción del curso</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción breve..." className="input-base" style={{ width: '100%', height: 80, fontSize: 13, padding: 12 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Nivel Académico</label>
                  <input type="text" value={editLevel} onChange={e => setEditLevel(e.target.value)} placeholder="Ej. Nivel Intermedio" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Créditos</label>
                  <input type="text" value={editCredits} onChange={e => setEditCredits(e.target.value)} placeholder="Ej. 5 Créditos" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
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
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <CheckSquare size={22} className="text-accent" /> Nueva Tarea
              </h2>
              <button onClick={() => setShowNewTask(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Título de la tarea</label>
                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Ej. Resolver guía de ejercicios..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Fecha límite</label>
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
          <div className="bento-card" style={{ width: 480, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <NotebookPen size={22} className="text-accent" /> Nueva Nota
              </h2>
              <button onClick={() => setShowNewNote(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Título de la nota</label>
                <input type="text" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} placeholder="Ej. Resumen Capítulo 4..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Contenido / Apuntes</label>
                <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Escribe tus apuntes, ideas o resúmenes aquí..." className="input-base" style={{ width: '100%', height: 160, fontSize: 13, padding: 12 }} />
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
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <Globe size={22} className="text-accent" /> Añadir Recurso
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
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Título del recurso</label>
                <input type="text" value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="Ej. Repositorio de exámenes pasados..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>URL o Enlace</label>
                <input type="text" value={newResUrl} onChange={e => setNewResUrl(e.target.value)} placeholder="https://..." className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowNewResource(false)} className="btn-secondary" style={{ padding: '0 20px', height: 40, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleCreateResource} disabled={!newResTitle.trim() || !newResUrl.trim()} className="btn-primary hover-lift" style={{ padding: '0 24px', height: 40, fontSize: 13, fontWeight: 600 }}>Añadir recurso</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW ANCHORED IMAGE MODAL */}
      {showNewImage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setShowNewImage(false)}>
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <ImageIcon size={22} className="text-accent" /> Añadir Imagen Anclada
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
          <div className="bento-card" style={{ width: 440, padding: 28, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <BrainCircuit size={22} className="text-accent" /> Crear Tarjeta de Repaso
              </h2>
              <button onClick={() => setShowNewRepaso(false)} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Pregunta o Concepto</label>
                <input type="text" value={newFcQuestion} onChange={e => setNewFcQuestion(e.target.value)} placeholder="Ej. ¿Cuál es la fórmula de la velocidad de escape?" className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} autoFocus />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Respuesta o Explicación</label>
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

