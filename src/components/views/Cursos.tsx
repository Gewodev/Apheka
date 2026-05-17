import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BookOpen, Clock, List as ListIcon, Layers, Star, Plus,
  Target, GraduationCap, ChevronRight, CheckCircle,
  FileText, BrainCircuit, NotebookPen, ExternalLink,
  Image as ImageIcon, Folder, X, Upload, MoreVertical,
  Search, Filter, Trash2, Edit3, Eye, Check, Calendar,
  CheckSquare, Play, RotateCw, FileQuestion, ThumbsUp,
  AlertCircle, ArrowUp, ArrowDown, Share2, Paperclip,
  BarChart2, PieChart, Sparkles, BookMarked, Globe,
  Video, File, Circle, Loader, Award, HelpCircle
} from 'lucide-react';
import { useApp, Course, Task, Note } from '../../store/AppContext';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Cursos({ initialCourseId }: { initialCourseId?: string }) {
  const { 
    courses, tasks, notes, addCourse, updateCourse, deleteCourse,
    addTask, updateTask, deleteTask, toggleTaskStatus,
    addNote, updateNote, deleteNote 
  } = useApp();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId === 'NEW' ? (courses[0]?.id || '') : (initialCourseId || courses[0]?.id || '')
  );
  const [activeTab, setActiveTab] = useState<'resumen' | 'tareas' | 'notas' | 'recursos' | 'repasos'>('resumen');
  
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
  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

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
  const progressPct = courseTasks.length > 0 ? Math.round((completedTasksCount / courseTasks.length) * 100) : 0;

  // Anchored images array (from course or default fallback)
  const anchoredImages = selectedCourse?.anchoredImages || [
    { id: '1', name: 'Esquema_Estructural_01.png', url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=600&auto=format&fit=crop', date: '2 May 2025', tag: 'Tema 1 - Cabecera' },
    { id: '2', name: 'Tabla_Formulas_Avanzadas.webp', url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=600&auto=format&fit=crop', date: '28 Abr 2025', tag: 'Fórmulas Clave' },
    { id: '3', name: 'Diagrama_Flujo_Proyecto.jpg', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop', date: '15 Abr 2025', tag: 'Anexo B - Laboratorio' }
  ];

  // Resources list (from course or default fallback)
  const defaultResources = [
    { id: 'r1', title: 'Página del curso oficial', url: 'https://miscurso.edu/matematica', type: 'link', date: 'Hoy, 14:30' },
    { id: 'r2', title: 'Documentos y Normativas oficiales', url: 'https://docs.miscurso.edu', type: 'doc', date: 'Ayer, 18:45' },
    { id: 'r3', title: 'Biblioteca digital y Repositorio', url: 'https://biblio.miscurso.edu', type: 'link', date: '2 May, 16:20' },
    { id: 'r4', title: 'Foro de dudas y discusión grupal', url: 'https://foro.miscurso.edu', type: 'link', date: '1 May, 20:10' },
    { id: 'r5', title: 'Set de Problemas Resueltos PDF', url: 'https://miscurso.edu/files/problemas.pdf', type: 'pdf', date: '30 Abr, 19:05' },
  ];
  const resourcesList = selectedCourse?.resources || defaultResources;

  // Flashcards / Repaso list (from course or default fallback)
  const defaultFlashcards = [
    { id: 'fc1', question: '¿Cuál es la derivada de e^(2x)?', answer: '2e^(2x)', difficulty: 'bueno' as const, lastReviewed: 'Ayer', nextReview: '4 May' },
    { id: 'fc2', question: 'Teorema Fundamental del Cálculo (Parte 1)', answer: 'La integral de la derivada de una función es la función original evaluada en los límites.', difficulty: 'dificil' as const, lastReviewed: 'Hace 3 días', nextReview: '5 May' },
    { id: 'fc3', question: 'Definición de Límite de una función', answer: 'Para todo ε > 0 existe un δ > 0 tal que si 0 < |x - c| < δ entonces |f(x) - L| < ε.', difficulty: 'facil' as const, lastReviewed: 'Hace 5 días', nextReview: '10 May' },
    { id: 'fc4', question: 'Criterio de la Segunda Derivada para Extremos', answer: 'Si f\'\'(c) > 0 es un mínimo local. Si f\'\'(c) < 0 es un máximo local.', difficulty: 'bueno' as const, lastReviewed: 'Hace 1 semana', nextReview: '12 May' },
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
    if (!newCourseName.trim()) { toast.error('Ingresa el nombre del curso'); return; }
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
    toast.success('Curso creado exitosamente');
  };

  const handleSaveCourseEdit = () => {
    updateCourse(selectedCourse.id, {
      description: editDesc,
      level: editLevel,
      credits: editCredits,
    });
    setShowEditCourse(false);
    toast.success('Información del curso actualizada');
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) { toast.error('Ingresa un título para la tarea'); return; }
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
    toast.success('Tarea añadida al curso');
  };

  const handleCreateNote = () => {
    if (!newNoteTitle.trim()) { toast.error('Ingresa el título de la nota'); return; }
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
    toast.success('Nota creada exitosamente');
  };

  const handleCreateResource = () => {
    if (!newResTitle.trim() || !newResUrl.trim()) { toast.error('Completa todos los campos'); return; }
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
    toast.success('Recurso añadido al curso');
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
      toast.error('Completa el nombre, la etiqueta de posición y selecciona una imagen');
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
    toast.success('Imagen anclada exitosamente');
  };

  const handleDeleteAnchoredImage = (id: string) => {
    const updatedImages = anchoredImages.filter(img => img.id !== id);
    updateCourse(selectedCourse.id, { anchoredImages: updatedImages });
    toast.success('Imagen anclada eliminada');
  };

  const handleCreateFlashcard = () => {
    if (!newFcQuestion.trim() || !newFcAnswer.trim()) { toast.error('Ingresa pregunta y respuesta'); return; }
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
    toast.success('Tarjeta de repaso creada');
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
    toast.success(`Calificado como: ${rating.toUpperCase()}`);
  };

  // Cover image upload
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateCourse(selectedCourse.id, { coverImage: ev.target?.result as string });
      toast.success('Imagen de portada actualizada');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="page-container flex h-full bg-background overflow-hidden select-none">
      
      {/* ── 1. LEFT SIDEBAR (Course List Navigation) ── */}
      <aside className="w-20 border-r border-borderDark/40 bg-gradient-to-b from-surface to-background flex flex-col items-center py-6 gap-4 shadow-sm z-10 flex-shrink-0">
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
            <GraduationCap size={22} strokeWidth={2.5} />
          </div>
          <span className="text-[9px] font-semibold text-textDim uppercase tracking-wider mt-1">Cursos</span>
        </div>

        <div className="w-12 h-[1px] bg-borderDark/60 my-1" />

        {/* Course Icons List */}
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 w-full items-center px-2 py-1">
          {courses.map(course => {
            const isSelected = selectedCourseId === course.id;
            return (
              <button 
                key={course.id} 
                onClick={() => { setSelectedCourseId(course.id); setActiveTab('resumen'); }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-base transition-all relative cursor-pointer group ${
                  isSelected ? 'text-white shadow-sm' : 'bg-surface2 border border-borderDark text-textDim hover:text-textMain hover:border-borderDark/80'
                }`}
                style={{
                  backgroundColor: isSelected ? course.color : undefined,
                  boxShadow: isSelected ? `0 8px 20px ${course.color}40` : undefined
                }}
                title={course.name}
              >
                <span>{course.name.substring(0, 2).toUpperCase()}</span>
                
                {/* Active Indicator */}
                {isSelected && (
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-accent animate-pulse" />
                )}

                {/* Tooltip */}
                <span className="absolute left-16 px-3 py-1.5 rounded-xl bg-surface border border-borderDark text-xs font-semibold text-textMain whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-50 pointer-events-none">
                  {course.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-12 h-[1px] bg-borderDark/60 my-1" />

        {/* Add Course Button */}
        <button 
          onClick={() => setShowNewCourse(true)} 
          className="w-12 h-12 rounded-xl bg-surface border border-dashed border-borderDark hover:border-accent flex items-center justify-center text-textDim hover:text-accent transition-all cursor-pointer shadow-sm group"
          title="Añadir nuevo curso"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
        </button>
      </aside>

      {/* ── 2. MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background">
        
        {selectedCourse ? (
          <div className="flex flex-col flex-1 animate-fadeIn">
            
            {/* ── COURSE HEADER & METRICS ── */}
            <header className="p-8 border-b border-borderDark/40 bg-surface/30 flex flex-col gap-8 flex-shrink-0">
              
              {/* Top Row: Cover Icon + Title + Info Badges + Edit Button */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                <div className="flex items-center gap-6 min-w-0">
                  {/* Decorative Course Wave Box */}
                  <div 
                    className="w-24 h-24 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm relative overflow-hidden border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${selectedCourse.color}, color-mix(in srgb, ${selectedCourse.color} 40%, black))` }}
                  >
                    {/* Abstract Wave Simulation */}
                    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                    <Sparkles size={36} className="text-white animate-pulse" strokeWidth={2} />
                  </div>

                  {/* Title & Badges */}
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold text-textMain tracking-tight truncate">{selectedCourse.name}</h1>
                      <button 
                        onClick={() => setShowEditCourse(true)}
                        className="p-1.5 rounded-xl bg-surface border border-borderDark hover:border-borderDark/80 text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm"
                        title="Editar información del curso"
                      >
                        <Edit3 size={16} />
                      </button>
                    </div>

                    <p className="text-xs text-textDim font-medium max-w-2xl line-clamp-2">{courseDescription}</p>

                    {/* Pill Badges */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="px-3 py-1 rounded-xl bg-surface border border-borderDark text-[10px] font-semibold text-textDim uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <BookMarked size={12} className="text-accent" /> Asignatura
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-surface border border-borderDark text-[10px] font-semibold text-textDim uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <Award size={12} className="text-info" /> {courseLevel}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-surface border border-borderDark text-[10px] font-semibold text-textDim uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <Target size={12} className="text-success" /> {courseCredits}
                      </span>
                      <button onClick={() => setShowEditCourse(true)} className="px-2 py-1 rounded-xl bg-surface border border-dashed border-borderDark hover:border-accent text-[10px] font-semibold text-textDim hover:text-accent transition-all cursor-pointer">
                        + Añadir info
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button 
                    onClick={() => setShowEditCourse(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-surface border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textMain transition-all cursor-pointer shadow-sm"
                  >
                    <Edit3 size={16} className="text-accent" /> Editar curso
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`¿Estás seguro de eliminar el curso "${selectedCourse.name}"?`)) {
                        deleteCourse(selectedCourse.id);
                        toast.success('Curso eliminado');
                      }
                    }}
                    className="p-3 rounded-xl bg-error/10 border border-error/20 text-error hover:bg-error/20 transition-all cursor-pointer shadow-sm shadow-error/10"
                    title="Eliminar curso"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>

              {/* Bottom Row: 5 Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 pt-2">
                
                {/* Metric 1: Tiempo estudiado */}
                <div className="bento-card p-5 flex items-center justify-between bg-surface border border-borderDark rounded-xl shadow-sm hover:border-borderDark/80 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Tiempo estudiado</span>
                    <span className="text-2xl font-semibold text-textMain mt-1">
                      {Math.floor(selectedCourse.hoursStudied || 0)}h {Math.round(((selectedCourse.hoursStudied || 0) % 1) * 60)}m
                    </span>
                    <span className="text-[10px] text-textDim mt-1 font-medium">Este mes</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-surface2 border border-borderDark flex items-center justify-center text-accent shadow-inner">
                    <Clock size={22} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Metric 2: Progreso general */}
                <div className="bento-card p-5 flex items-center justify-between bg-surface border border-borderDark rounded-xl shadow-sm hover:border-borderDark/80 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Progreso general</span>
                    <span className="text-2xl font-semibold text-textMain mt-1">{progressPct}%</span>
                    <span className="text-[10px] text-textDim mt-1 font-medium">Completado</span>
                  </div>
                  {/* Circular Progress Simulation */}
                  <div className="relative w-12 h-12 rounded-full border-4 border-surface2 flex items-center justify-center shadow-inner flex-shrink-0">
                    <div className="absolute inset-0 rounded-full border-4 border-success border-t-transparent border-l-transparent rotate-45" />
                    <CheckCircle size={16} className="text-success" strokeWidth={3} />
                  </div>
                </div>

                {/* Metric 3: Notas totales */}
                <div className="bento-card p-5 flex items-center justify-between bg-surface border border-borderDark rounded-xl shadow-sm hover:border-borderDark/80 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Notas totales</span>
                    <span className="text-2xl font-semibold text-textMain mt-1">{courseNotes.length}</span>
                    <span className="text-[10px] text-textDim mt-1 font-medium">Notas guardadas</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center text-info shadow-inner">
                    <FileText size={22} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Metric 4: Tareas totales */}
                <div className="bento-card p-5 flex items-center justify-between bg-surface border border-borderDark rounded-xl shadow-sm hover:border-borderDark/80 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Tareas totales</span>
                    <span className="text-2xl font-semibold text-textMain mt-1">{courseTasks.length}</span>
                    <span className="text-[10px] text-textDim mt-1 font-medium">{pendingTasksCount} pendientes</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning shadow-inner">
                    <CheckSquare size={22} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Metric 5: Próximo repaso */}
                <div className="bento-card p-5 flex items-center justify-between bg-surface border border-borderDark rounded-xl shadow-sm hover:border-borderDark/80 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Próximo repaso</span>
                    <span className="text-2xl font-semibold text-accent mt-1">
                      {format(addDays(new Date(), 2), "d MMM", { locale: es })}
                    </span>
                    <span className="text-[10px] text-textDim mt-1 font-medium">En 2 días</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner animate-pulse">
                    <Calendar size={22} strokeWidth={2.5} />
                  </div>
                </div>

              </div>

              {/* ── NAVIGATION TABS (Resumen, Tareas, Notas, Recursos, Repasos - NO ESTADÍSTICAS) ── */}
              <div className="flex items-center gap-8 border-b border-borderDark pt-2 -mb-8">
                {[
                  { id: 'resumen', label: 'Resumen', icon: Layers },
                  { id: 'tareas', label: 'Tareas', icon: ListIcon },
                  { id: 'notas', label: 'Notas', icon: NotebookPen },
                  { id: 'recursos', label: 'Recursos', icon: Globe },
                  { id: 'repasos', label: 'Repasos', icon: BrainCircuit },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2.5 pb-4 text-xs font-semibold border-b-2 transition-all cursor-pointer relative ${
                      activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-textMain'
                    }`}
                  >
                    <tab.icon size={16} className={activeTab === tab.id ? 'text-accent' : 'text-textDim'} strokeWidth={2.5} />
                    <span>{tab.label}</span>
                    {tab.id === 'tareas' && pendingTasksCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[9px]">
                        {pendingTasksCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

            </header>

            {/* ── MAIN BODY CONTENT & RIGHT SIDEBAR ── */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 p-5 overflow-y-auto">
              
              {/* ── LEFT TAB CONTENT AREA (flex-1) ── */}
              <div className="flex-1 flex flex-col min-w-0 gap-8">
                
                {/* ════════════════════════════════════════════════════════ */}
                {/*  TAB 1: RESUMEN (Overview matching reference image)     */}
                {/* ════════════════════════════════════════════════════════ */}
                {activeTab === 'resumen' && (
                  <div className="flex flex-col gap-8 animate-fadeIn">
                    
                    {/* Top Row: Últimas Notas + Próximas Tareas + Recursos Rápidos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Últimas Notas */}
                      <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm h-80">
                        <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-4">
                          <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                            <NotebookPen size={16} className="text-accent" /> Últimas notas
                          </span>
                          <button onClick={() => setActiveTab('notas')} className="text-xs font-semibold text-accent hover:underline cursor-pointer">
                            Ver todas
                          </button>
                        </div>

                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                          {courseNotes.slice(0, 5).map(note => (
                            <div key={note.id} onClick={() => setActiveTab('notas')} className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all cursor-pointer shadow-2xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileText size={14} className="text-accent flex-shrink-0" />
                                <span className="text-xs font-semibold text-textMain truncate">{note.title}</span>
                              </div>
                              <span className="text-[10px] font-medium text-textDim flex-shrink-0 pl-2">
                                {format(new Date(note.updatedAt), "d MMM", { locale: es })}
                              </span>
                            </div>
                          ))}

                          {courseNotes.length === 0 && (
                            <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-2 py-8">
                              <FileText size={24} className="opacity-30" />
                              <p className="text-xs font-medium text-center">No hay notas recientes para este curso.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Próximas Tareas */}
                      <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm h-80">
                        <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-4">
                          <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                            <CheckSquare size={16} className="text-accent" /> Próximas tareas
                          </span>
                          <button onClick={() => setActiveTab('tareas')} className="text-xs font-semibold text-accent hover:underline cursor-pointer">
                            Ver todas
                          </button>
                        </div>

                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                          {courseTasks.filter(t => t.status !== 'completado').slice(0, 5).map(task => (
                            <div key={task.id} onClick={() => setActiveTab('tareas')} className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all cursor-pointer shadow-2xs">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
                                  className="w-4 h-4 rounded-full border border-borderDark hover:border-accent flex items-center justify-center transition-all flex-shrink-0 cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-textMain truncate">{task.title}</span>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-semibold border ${
                                  task.priority === 'high' ? 'bg-error/10 border-error/20 text-error' :
                                  task.priority === 'medium' ? 'bg-warning/10 border-warning/20 text-warning' :
                                  'bg-success/10 border-success/20 text-success'
                                }`}>
                                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                                </span>
                                <span className="text-[10px] font-semibold text-textDim">
                                  {task.dueDate ? format(new Date(task.dueDate), "d MMM", { locale: es }) : 'Hoy'}
                                </span>
                              </div>
                            </div>
                          ))}

                          {courseTasks.filter(t => t.status !== 'completado').length === 0 && (
                            <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-2 py-8">
                              <CheckCircle size={24} className="opacity-30" />
                              <p className="text-xs font-medium text-center">¡Al día! No hay tareas pendientes.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recursos Rápidos */}
                      <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm h-80">
                        <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-4">
                          <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                            <Globe size={16} className="text-accent" /> Recursos rápidos
                          </span>
                          <button onClick={() => setActiveTab('recursos')} className="text-xs font-semibold text-accent hover:underline cursor-pointer">
                            Ver todos
                          </button>
                        </div>

                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                          {resourcesList.slice(0, 4).map(res => (
                            <a 
                              key={res.id} 
                              href={res.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all cursor-pointer shadow-2xs group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-surface border border-borderDark flex items-center justify-center flex-shrink-0 text-textDim group-hover:text-accent transition-colors">
                                  {res.type === 'pdf' ? <FileText size={12} className="text-error" /> : res.type === 'doc' ? <File size={12} className="text-info" /> : <Globe size={12} />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-textMain truncate group-hover:text-accent transition-colors">{res.title}</span>
                                  <span className="text-[9px] font-medium text-textDim truncate">{res.url}</span>
                                </div>
                              </div>
                              <ExternalLink size={14} className="text-textDim group-hover:text-accent flex-shrink-0 ml-2 transition-colors" />
                            </a>
                          ))}
                        </div>

                        <button 
                          onClick={() => setShowNewResource(true)}
                          className="w-full mt-3 py-2.5 bg-surface2 border border-dashed border-borderDark hover:border-accent rounded-xl text-xs font-semibold text-textDim hover:text-accent transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Plus size={14} strokeWidth={2.5} /> Añadir recurso
                        </button>
                      </div>

                    </div>

                    {/* Bottom Row: Tiempo Estudiado por Semana + Distribución de Temas + Historial de Calificaciones */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Tiempo Estudiado por Semana */}
                      <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm h-80">
                        <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-6">
                          <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                            <BarChart2 size={16} className="text-accent" /> Tiempo estudiado por semana
                          </span>
                          <span className="text-xs font-semibold text-accent">Esta semana: 7h 45m</span>
                        </div>

                        <div className="flex items-end justify-between flex-1 gap-3 px-4 pt-4">
                          {[
                            { day: 'L', h: 45 }, { day: 'M', h: 75 }, { day: 'M', h: 60 },
                            { day: 'J', h: 95 }, { day: 'V', h: 40 }, { day: 'S', h: 25 }, { day: 'D', h: 15 }
                          ].map((bar, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                              <div 
                                className="w-full bg-accent hover:bg-accent/80 rounded-xl transition-all shadow-sm shadow-accent/20 cursor-pointer"
                                style={{ height: `${bar.h}%` }}
                                title={`${bar.h} min`}
                              />
                              <span className="text-[10px] font-semibold text-textDim">{bar.day}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Distribución de Temas */}
                      <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm h-80">
                        <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-6">
                          <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                            <PieChart size={16} className="text-accent" /> Distribución de temas
                          </span>
                        </div>

                        <div className="flex items-center gap-6 flex-1 px-2">
                          {/* Simulated Donut Chart */}
                          <div className="relative w-32 h-32 rounded-full border-8 border-surface2 flex items-center justify-center flex-shrink-0 shadow-inner">
                            <div className="absolute inset-0 rounded-full border-8 border-accent border-t-transparent border-l-transparent rotate-45" />
                            <div className="absolute inset-0 rounded-full border-8 border-info border-b-transparent border-r-transparent -rotate-12" />
                            <div className="flex flex-col items-center justify-center z-10 text-center">
                              <span className="text-2xl font-semibold text-textMain">100%</span>
                              <span className="text-[9px] font-semibold text-textDim uppercase tracking-wider">Cobertura</span>
                            </div>
                          </div>

                          {/* Legend */}
                          <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-44 pr-1">
                            {[
                              { label: 'Teoría', pct: '35%', color: '#E11D48' },
                              { label: 'Ejercicios', pct: '28%', color: '#3B82F6' },
                              { label: 'Prácticas', pct: '20%', color: '#10B981' },
                              { label: 'Lecturas', pct: '10%', color: '#F59E0B' },
                              { label: 'Otros', pct: '7%', color: '#8B5CF6' },
                            ].map(item => (
                              <div key={item.label} className="flex items-center justify-between text-xs font-semibold">
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                  <span className="text-textMain truncate">{item.label}</span>
                                </div>
                                <span className="font-semibold text-textMain flex-shrink-0 pl-2">{item.pct}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Historial de Calificaciones */}
                      <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm h-80">
                        <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-4">
                          <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                            <Award size={16} className="text-accent" /> Historial de calificaciones
                          </span>
                          <span className="text-xs font-semibold text-accent">Promedio: 8.7</span>
                        </div>

                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                          {[
                            { title: 'Parcial 1', grade: '8.7', date: '28 Abr', type: 'Examen' },
                            { title: 'Tarea 3: Derivadas', grade: '9.2', date: '20 Abr', type: 'Tarea' },
                            { title: 'Quiz 2: Límites', grade: '7.5', date: '15 Abr', type: 'Quiz' },
                            { title: 'Participación activa', grade: '10.0', date: '10 Abr', type: 'Oral' },
                            { title: 'Tarea 2: Funciones', grade: '8.3', date: '5 Abr', type: 'Tarea' },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-borderDark shadow-2xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-surface border border-borderDark flex items-center justify-center flex-shrink-0 text-accent font-semibold text-xs shadow-inner">
                                  {item.grade}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-textMain truncate">{item.title}</span>
                                  <span className="text-[9px] font-medium text-textDim uppercase">{item.type}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-textDim flex-shrink-0 pl-2">{item.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                  </div>
                )}


                {/* ════════════════════════════════════════════════════════ */}
                {/*  TAB 2: TAREAS (Task Management specifically for Course) */}
                {/* ════════════════════════════════════════════════════════ */}
                {activeTab === 'tareas' && (
                  <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm animate-fadeIn min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-borderDark pb-6 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
                          <CheckSquare size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="text-lg font-semibold text-textMain tracking-tight">Gestión de Tareas</h2>
                          <p className="text-xs text-textDim mt-0.5">Administra las tareas y asignaciones de {selectedCourse.name}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowNewTask(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
                      >
                        <Plus size={16} strokeWidth={2.5} /> Nueva tarea
                      </button>
                    </div>

                    {/* Task List Table */}
                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                      {courseTasks.map(task => {
                        const isDone = task.status === 'completado';
                        return (
                          <div 
                            key={task.id}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                              isDone ? 'bg-surface2/40 border-borderDark/40 opacity-60' : 'bg-surface2 border-borderDark hover:border-borderDark/80 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <button 
                                onClick={() => toggleTaskStatus(task.id)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                                  isDone ? 'bg-success border-success text-white shadow-sm shadow-success/20' : 'border-borderDark hover:border-accent'
                                }`}
                              >
                                {isDone && <Check size={14} strokeWidth={3} />}
                              </button>

                              <div className="flex flex-col min-w-0 flex-1">
                                <span className={`text-sm font-semibold truncate ${isDone ? 'line-through text-textDim' : 'text-textMain'}`}>
                                  {task.title}
                                </span>
                                <div className="flex items-center gap-4 mt-1 text-[10px] font-medium text-textDim">
                                  <span>Fecha límite: {task.dueDate ? format(new Date(task.dueDate), "d MMMM yyyy", { locale: es }) : 'Sin fecha'}</span>
                                  {task.subtasks.length > 0 && (
                                    <span className="flex items-center gap-1"><CheckSquare size={10} /> {task.subtasks.filter(s => s.done).length}/{task.subtasks.length} subtareas</span>
                                  )}
                                  {task.files.length > 0 && (
                                    <span className="flex items-center gap-1"><Paperclip size={10} /> {task.files.length} archivos</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                              <span className={`px-3 py-1 rounded-xl text-[10px] font-semibold border ${
                                task.priority === 'high' ? 'bg-error/10 border-error/20 text-error' :
                                task.priority === 'medium' ? 'bg-warning/10 border-warning/20 text-warning' :
                                'bg-success/10 border-success/20 text-success'
                              }`}>
                                {task.priority === 'high' ? 'Prioridad Alta' : task.priority === 'medium' ? 'Prioridad Media' : 'Prioridad Baja'}
                              </span>

                              <button 
                                onClick={() => deleteTask(task.id)}
                                className="p-2 rounded-xl text-textDim hover:text-error hover:bg-surface transition-all cursor-pointer"
                                title="Eliminar tarea"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                          </div>
                        );
                      })}

                      {courseTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-3 py-16">
                          <CheckSquare size={40} className="opacity-30" />
                          <p className="text-sm font-medium text-center">No hay tareas registradas para este curso.</p>
                          <button onClick={() => setShowNewTask(true)} className="px-5 py-2.5 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textMain transition-all cursor-pointer shadow-sm mt-2">
                            Crear primera tarea
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* ════════════════════════════════════════════════════════ */}
                {/*  TAB 3: NOTAS (Notes Management specifically for Course) */}
                {/* ════════════════════════════════════════════════════════ */}
                {activeTab === 'notas' && (
                  <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm animate-fadeIn min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-borderDark pb-6 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
                          <NotebookPen size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="text-lg font-semibold text-textMain tracking-tight">Apuntes y Notas</h2>
                          <p className="text-xs text-textDim mt-0.5">Registra resúmenes, ideas y apuntes de clase de {selectedCourse.name}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowNewNote(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
                      >
                        <Plus size={16} strokeWidth={2.5} /> Nueva nota
                      </button>
                    </div>

                    {/* Notes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 pr-1">
                      {courseNotes.map(note => (
                        <div key={note.id} className="bento-card p-5 flex flex-col bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl shadow-sm transition-all group relative">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h3 className="text-sm font-semibold text-textMain line-clamp-1 group-hover:text-accent transition-colors">{note.title}</h3>
                            <button 
                              onClick={() => deleteNote(note.id)}
                              className="p-1.5 rounded-xl text-textDim hover:text-error hover:bg-surface transition-all cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0"
                              title="Eliminar nota"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="text-xs text-textDim line-clamp-4 flex-1 mb-4 font-normal leading-relaxed" dangerouslySetInnerHTML={{ __html: note.content }} />

                          <div className="flex items-center justify-between border-t border-borderDark pt-4 text-[10px] font-semibold text-textDim">
                            <span>Actualizado: {format(new Date(note.updatedAt), "d MMM yyyy", { locale: es })}</span>
                            <button onClick={() => toast.success('Función de edición avanzada en desarrollo')} className="text-accent hover:underline cursor-pointer">
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}

                      {courseNotes.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center text-textDim gap-3 py-16">
                          <NotebookPen size={40} className="opacity-30" />
                          <p className="text-sm font-medium text-center">No hay notas guardadas para este curso.</p>
                          <button onClick={() => setShowNewNote(true)} className="px-5 py-2.5 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textMain transition-all cursor-pointer shadow-sm mt-2">
                            Crear primera nota
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* ════════════════════════════════════════════════════════ */}
                {/*  TAB 4: RECURSOS (Course Resources & Links)              */}
                {/* ════════════════════════════════════════════════════════ */}
                {activeTab === 'recursos' && (
                  <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm animate-fadeIn min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-borderDark pb-6 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
                          <Globe size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="text-lg font-semibold text-textMain tracking-tight">Recursos y Bibliografía</h2>
                          <p className="text-xs text-textDim mt-0.5">Enlaces web, bibliotecas digitales y documentos de consulta de {selectedCourse.name}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowNewResource(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
                      >
                        <Plus size={16} strokeWidth={2.5} /> Añadir recurso
                      </button>
                    </div>

                    {/* Resources List */}
                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                      {resourcesList.map(res => (
                        <div key={res.id} className="flex items-center justify-between p-4 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all shadow-sm">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-surface border border-borderDark flex items-center justify-center flex-shrink-0 text-textDim shadow-inner">
                              {res.type === 'pdf' ? <FileText size={18} className="text-error" /> : res.type === 'doc' ? <File size={18} className="text-info" /> : <Globe size={18} className="text-accent" />}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold text-textMain truncate">{res.title}</span>
                              <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-textDim hover:text-accent truncate transition-colors mt-0.5 flex items-center gap-1">
                                <span>{res.url}</span>
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                            <span className="text-[10px] font-semibold text-textDim uppercase tracking-wider">{res.date}</span>
                            <button 
                              onClick={() => {
                                updateCourse(selectedCourse.id, { resources: resourcesList.filter(r => r.id !== res.id) });
                                toast.success('Recurso eliminado');
                              }}
                              className="p-2 rounded-xl text-textDim hover:text-error hover:bg-surface transition-all cursor-pointer"
                              title="Eliminar recurso"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {/* ════════════════════════════════════════════════════════ */}
                {/*  TAB 5: REPASOS (Spaced Repetition & Flashcards)         */}
                {/* ════════════════════════════════════════════════════════ */}
                {activeTab === 'repasos' && (
                  <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm animate-fadeIn min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-borderDark pb-6 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
                          <BrainCircuit size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="text-lg font-semibold text-textMain tracking-tight">Repaso Activo (Flashcards)</h2>
                          <p className="text-xs text-textDim mt-0.5">Sistema de repetición espaciada para consolidar el aprendizaje de {selectedCourse.name}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowNewRepaso(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
                      >
                        <Plus size={16} strokeWidth={2.5} /> Crear tarjeta
                      </button>
                    </div>

                    {/* Interactive Flashcard Simulator */}
                    {flashcards.length > 0 ? (
                      <div className="flex flex-col items-center justify-center flex-1 max-w-2xl mx-auto w-full gap-8 py-4">
                        
                        {/* Progress Bar */}
                        <div className="w-full flex items-center justify-between text-xs font-semibold text-textDim">
                          <span>Tarjeta {activeFlashcardIndex + 1} de {flashcards.length}</span>
                          <span className="text-accent">Nivel de dificultad actual: {flashcards[activeFlashcardIndex]?.difficulty?.toUpperCase() || 'BUENO'}</span>
                        </div>

                        {/* Flashcard Box */}
                        <div 
                          onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
                          className="w-full h-80 rounded-xl bg-surface2 border border-borderDark hover:border-accent p-5 flex flex-col items-center justify-center text-center shadow-sm transition-all cursor-pointer relative group overflow-hidden"
                        >
                          <div className="absolute top-6 right-6 flex items-center gap-2 text-[10px] font-semibold text-textDim uppercase tracking-wider bg-surface px-3 py-1.5 rounded-xl border border-borderDark shadow-inner">
                            <RotateCw size={12} className="text-accent group-hover:rotate-180 transition-transform duration-500" />
                            <span>Clic para voltear</span>
                          </div>

                          {!showFlashcardAnswer ? (
                            <div className="flex flex-col items-center gap-4 animate-fadeIn">
                              <HelpCircle size={36} className="text-accent opacity-40 mb-2" strokeWidth={2} />
                              <span className="text-xs font-semibold text-textDim uppercase tracking-wider">Pregunta</span>
                              <h3 className="text-xl font-semibold text-textMain max-w-lg leading-relaxed">{flashcards[activeFlashcardIndex]?.question}</h3>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-4 animate-fadeIn">
                              <Sparkles size={36} className="text-success opacity-40 mb-2" strokeWidth={2} />
                              <span className="text-xs font-semibold text-success uppercase tracking-wider">Respuesta</span>
                              <p className="text-lg font-semibold text-textMain max-w-lg leading-relaxed">{flashcards[activeFlashcardIndex]?.answer}</p>
                            </div>
                          )}
                        </div>

                        {/* Rating Buttons (Only visible when answer is shown) */}
                        {showFlashcardAnswer && (
                          <div className="flex flex-col items-center gap-3 w-full animate-fadeInScale">
                            <span className="text-xs font-semibold text-textDim uppercase tracking-wider">¿Qué tan fácil fue recordar la respuesta?</span>
                            <div className="flex items-center gap-4 w-full max-w-md justify-center">
                              <button onClick={() => handleRateFlashcard('dificil')} className="flex-1 py-3 bg-error/10 border border-error/20 hover:bg-error/20 text-error rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-error/10">
                                Difícil (Repetir pronto)
                              </button>
                              <button onClick={() => handleRateFlashcard('bueno')} className="flex-1 py-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 text-warning rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-warning/10">
                                Bueno (3 días)
                              </button>
                              <button onClick={() => handleRateFlashcard('facil')} className="flex-1 py-3 bg-success/10 border border-success/20 hover:bg-success/20 text-success rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-success/10">
                                Fácil (5 días)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Navigation controls */}
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => { setShowFlashcardAnswer(false); setActiveFlashcardIndex((activeFlashcardIndex - 1 + flashcards.length) % flashcards.length); }}
                            className="px-5 py-2.5 rounded-xl bg-surface border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm"
                          >
                            Anterior
                          </button>
                          <button 
                            onClick={() => { setShowFlashcardAnswer(false); setActiveFlashcardIndex((activeFlashcardIndex + 1) % flashcards.length); }}
                            className="px-5 py-2.5 rounded-xl bg-surface border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm"
                          >
                            Siguiente
                          </button>
                        </div>

                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-3 py-16">
                        <BrainCircuit size={40} className="opacity-30" />
                        <p className="text-sm font-medium text-center">No hay tarjetas de repaso creadas para este curso.</p>
                        <button onClick={() => setShowNewRepaso(true)} className="px-5 py-2.5 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textMain transition-all cursor-pointer shadow-sm mt-2">
                          Crear primera tarjeta
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>


              {/* ── RIGHT SIDEBAR AREA (Cover Upload + Anchored Images Table, NO INFO, NO ETIQUETAS) ── */}
              <div className="w-full lg:w-80 flex flex-col gap-8 flex-shrink-0">
                
                {/* 1. IMAGEN DEL CURSO (Cover Upload matching reference image) */}
                <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm">
                  <span className="text-xs font-semibold text-textDim uppercase tracking-wider mb-4 border-b border-borderDark pb-3 flex items-center gap-2">
                    <ImageIcon size={16} className="text-accent" /> Imagen del curso
                  </span>

                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-borderDark hover:border-accent rounded-xl bg-surface2 transition-all group relative cursor-pointer overflow-hidden shadow-inner h-48">
                    {selectedCourse.coverImage ? (
                      <img src={selectedCourse.coverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="flex flex-col items-center text-center gap-2 z-10">
                        <Upload size={28} className="text-textDim group-hover:text-accent transition-colors animate-bounce" strokeWidth={1.5} />
                        <span className="text-xs font-semibold text-textMain">Subir imagen</span>
                        <span className="text-[10px] font-medium text-textDim">PNG, JPG o WEBP · Recomendado 16:9</span>
                      </div>
                    )}

                    <input type="file" onChange={handleCoverUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" accept="image/*" title="Cambiar imagen de portada" />
                  </div>

                  <button onClick={() => toast.success('Haz clic directamente en el recuadro para cambiar la imagen')} className="w-full mt-4 py-2.5 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all shadow-sm cursor-pointer">
                    Cambiar imagen
                  </button>
                </div>


                {/* 2. IMÁGENES ANCLADAS EN UNA TABLA PARA POSICIONAR (Replacing Info & Etiquetas) */}
                <div className="bento-card p-5 flex flex-col bg-surface border border-borderDark rounded-xl shadow-sm flex-1">
                  <div className="flex items-center justify-between border-b border-borderDark pb-4 mb-4">
                    <span className="text-xs font-semibold text-textDim uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon size={16} className="text-accent" /> Imágenes ancladas (Posición)
                    </span>
                    <button onClick={() => setShowNewImage(true)} className="p-1 rounded-xl bg-surface2 border border-borderDark hover:border-accent text-textDim hover:text-accent transition-all cursor-pointer shadow-sm">
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>

                  <p className="text-[11px] text-textDim mb-4 leading-relaxed font-medium">
                    Tabla de imágenes, diagramas y capturas ancladas para posicionamiento y consulta rápida del curso.
                  </p>

                  {/* Table / Grid of Anchored Images */}
                  <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 max-h-[400px]">
                    {anchoredImages.map(img => (
                      <div key={img.id} className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 transition-all shadow-2xs group">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Thumbnail */}
                          <div 
                            onClick={() => setPreviewImageUrl(img.url)}
                            className="w-10 h-10 rounded-xl bg-surface border border-borderDark overflow-hidden flex-shrink-0 cursor-pointer relative group/thumb shadow-inner"
                          >
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                              <Eye size={14} className="text-white" />
                            </div>
                          </div>

                          {/* Name & Tag */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-semibold text-textMain truncate">{img.name}</span>
                            <span className="text-[10px] font-semibold text-accent truncate mt-0.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> {img.tag}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 pl-2">
                          <button 
                            onClick={() => setPreviewImageUrl(img.url)}
                            className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface transition-all cursor-pointer"
                            title="Ver imagen completa"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteAnchoredImage(img.id)}
                            className="p-2 rounded-xl text-textDim hover:text-error hover:bg-surface transition-all cursor-pointer"
                            title="Eliminar imagen anclada"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {anchoredImages.length === 0 && (
                      <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-2 py-8 text-center">
                        <ImageIcon size={28} className="opacity-30" />
                        <span className="text-xs font-medium">No hay imágenes ancladas en la tabla.</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setShowNewImage(true)}
                    className="w-full mt-4 py-3 bg-surface2 border border-dashed border-borderDark hover:border-accent rounded-xl text-xs font-semibold text-textDim hover:text-accent transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Plus size={16} strokeWidth={2.5} /> Añadir imagen a la tabla
                  </button>
                </div>

              </div>

            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-textDim gap-4 py-24 animate-fadeIn">
            <GraduationCap size={64} className="opacity-20" />
            <p className="text-lg font-semibold text-textMain">Selecciona un curso de la barra lateral o crea uno nuevo</p>
            <button onClick={() => setShowNewCourse(true)} className="px-6 py-3 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer mt-2">
              Crear nuevo curso
            </button>
          </div>
        )}

      </main>


      {/* ── 3. MODALS & FORMS ── */}
      
      {/* NEW COURSE MODAL */}
      {showNewCourse && (
        <div role="dialog" aria-modal="true" aria-label="Nuevo curso" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewCourse(false)}>
          <div className="bento-card w-full max-w-md p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <GraduationCap size={20} className="text-accent" strokeWidth={2.5} /> Nuevo Curso
              </h2>
              <button onClick={() => setShowNewCourse(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Nombre del Curso</label>
                <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Ej. Álgebra Lineal Avanzada" className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Color Distintivo</label>
                <div className="flex items-center gap-3 flex-wrap bg-surface2 border border-borderDark p-4 rounded-xl shadow-inner">
                  {['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'].map(color => (
                    <button 
                      key={color} 
                      onClick={() => setNewCourseColor(color)} 
                      className={`w-8 h-8 rounded-xl transition-all cursor-pointer ${
                        newCourseColor === color ? 'border-2 border-white scale-110 shadow-sm' : 'border border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color, boxShadow: newCourseColor === color ? `0 0 16px ${color}` : undefined }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewCourse(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleCreateCourse} disabled={!newCourseName.trim()} className="px-8 py-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Crear curso</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT COURSE MODAL */}
      {showEditCourse && (
        <div role="dialog" aria-modal="true" aria-label="Editar curso" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowEditCourse(false)}>
          <div className="bento-card w-full max-w-md p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <Edit3 size={20} className="text-accent" strokeWidth={2.5} /> Editar Información de {selectedCourse.name}
              </h2>
              <button onClick={() => setShowEditCourse(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Descripción del curso</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción breve del curso..." className="w-full h-24 bg-surface2 border border-borderDark rounded-xl p-4 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Nivel Académico</label>
                  <input type="text" value={editLevel} onChange={e => setEditLevel(e.target.value)} placeholder="Ej. Nivel Intermedio" className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all shadow-inner" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Créditos</label>
                  <input type="text" value={editCredits} onChange={e => setEditCredits(e.target.value)} placeholder="Ej. 5 Créditos" className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all shadow-inner" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowEditCourse(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleSaveCourseEdit} className="px-8 py-3 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW TASK MODAL */}
      {showNewTask && (
        <div role="dialog" aria-modal="true" aria-label="Nueva tarea" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewTask(false)}>
          <div className="bento-card w-full max-w-md p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <CheckSquare size={20} className="text-accent" strokeWidth={2.5} /> Nueva Tarea para {selectedCourse.name}
              </h2>
              <button onClick={() => setShowNewTask(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Título de la tarea</label>
                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Ej. Resolver guía de ejercicios..." className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Prioridad</label>
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)} className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner">
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Fecha límite</label>
                  <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain focus:border-accent focus:outline-none transition-all cursor-pointer shadow-inner color-scheme-dark" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewTask(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleCreateTask} disabled={!newTaskTitle.trim()} className="px-8 py-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Crear tarea</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW NOTE MODAL */}
      {showNewNote && (
        <div role="dialog" aria-modal="true" aria-label="Nueva nota" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewNote(false)}>
          <div className="bento-card w-full max-w-lg p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <NotebookPen size={20} className="text-accent" strokeWidth={2.5} /> Nueva Nota para {selectedCourse.name}
              </h2>
              <button onClick={() => setShowNewNote(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Título de la nota</label>
                <input type="text" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} placeholder="Ej. Resumen Capítulo 4..." className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Contenido / Apuntes</label>
                <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Escribe tus apuntes, ideas o resúmenes aquí..." className="w-full h-48 bg-surface2 border border-borderDark rounded-xl p-4 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner resize-none" />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewNote(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleCreateNote} disabled={!newNoteTitle.trim()} className="px-8 py-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Guardar nota</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW RESOURCE MODAL */}
      {showNewResource && (
        <div role="dialog" aria-modal="true" aria-label="Nuevo recurso" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewResource(false)}>
          <div className="bento-card w-full max-w-md p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <Globe size={20} className="text-accent" strokeWidth={2.5} /> Añadir Recurso a {selectedCourse.name}
              </h2>
              <button onClick={() => setShowNewResource(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Tipo de recurso</label>
                <div className="flex items-center gap-2 bg-surface2 border border-borderDark p-1 rounded-xl shadow-inner">
                  {(['link', 'pdf', 'doc', 'video'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewResType(type)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase transition-all cursor-pointer ${
                        newResType === type ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-textDim hover:text-textMain'
                      }`}
                    >
                      {type === 'link' ? 'Web' : type === 'pdf' ? 'PDF' : type === 'doc' ? 'Doc' : 'Video'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Título del recurso</label>
                <input type="text" value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="Ej. Repositorio de exámenes pasados..." className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">URL o Enlace</label>
                <input type="text" value={newResUrl} onChange={e => setNewResUrl(e.target.value)} placeholder="https://..." className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewResource(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleCreateResource} disabled={!newResTitle.trim() || !newResUrl.trim()} className="px-8 py-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Añadir recurso</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW ANCHORED IMAGE MODAL */}
      {showNewImage && (
        <div role="dialog" aria-modal="true" aria-label="Añadir imagen anclada" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewImage(false)}>
          <div className="bento-card w-full max-w-md p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <ImageIcon size={20} className="text-accent" strokeWidth={2.5} /> Añadir Imagen Anclada (Posición)
              </h2>
              <button onClick={() => setShowNewImage(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Nombre del archivo / Imagen</label>
                <input type="text" value={newImgName} onChange={e => setNewImgName(e.target.value)} placeholder="Ej. Esquema_Tema_04.png" className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Etiqueta de Posicionamiento / Tema</label>
                <input type="text" value={newImgTag} onChange={e => setNewImgTag(e.target.value)} placeholder="Ej. Tema 4 - Cabecera / Fórmula Clave" className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Seleccionar Imagen</label>
                <input type="file" ref={imageInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                <div className="flex items-center gap-3">
                  <input type="text" value={newImgUrl} onChange={e => setNewImgUrl(e.target.value)} placeholder="URL de la imagen o subir archivo..." className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" />
                  <button onClick={() => imageInputRef.current?.click()} className="px-5 py-3 rounded-xl bg-surface2 border border-borderDark hover:border-borderDark/80 text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm flex-shrink-0 flex items-center gap-2">
                    <Upload size={16} /> Subir
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewImage(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleAddAnchoredImage} disabled={!newImgName.trim() || !newImgTag.trim() || !newImgUrl.trim()} className="px-8 py-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Anclar imagen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW FLASHCARD MODAL */}
      {showNewRepaso && (
        <div role="dialog" aria-modal="true" aria-label="Nueva tarjeta de flashcard" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowNewRepaso(false)}>
          <div className="bento-card w-full max-w-md p-6 bg-surface border border-borderDark rounded-xl shadow-sm flex flex-col gap-6 animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-borderDark pb-4">
              <h2 className="text-lg font-semibold text-textMain flex items-center gap-3">
                <BrainCircuit size={20} className="text-accent" strokeWidth={2.5} /> Crear Tarjeta de Repaso (Flashcard)
              </h2>
              <button onClick={() => setShowNewRepaso(false)} className="p-2 rounded-xl text-textDim hover:text-textMain hover:bg-surface2 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Pregunta o Concepto</label>
                <input type="text" value={newFcQuestion} onChange={e => setNewFcQuestion(e.target.value)} placeholder="Ej. ¿Cuál es la fórmula de la velocidad de escape?" className="w-full bg-surface2 border border-borderDark rounded-xl px-4 py-3 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner" autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-textDim uppercase tracking-wider">Respuesta o Explicación</label>
                <textarea value={newFcAnswer} onChange={e => setNewFcAnswer(e.target.value)} placeholder="Ej. v = √(2GM/R)..." className="w-full h-32 bg-surface2 border border-borderDark rounded-xl p-4 text-xs text-textMain placeholder:text-textDim focus:border-accent focus:outline-none transition-all shadow-inner resize-none" />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-borderDark pt-6 mt-2">
                <button onClick={() => setShowNewRepaso(false)} className="px-6 py-3 bg-surface2 border border-borderDark hover:border-borderDark/80 rounded-xl text-xs font-semibold text-textDim hover:text-textMain transition-all cursor-pointer shadow-sm">Cancelar</button>
                <button onClick={handleCreateFlashcard} disabled={!newFcQuestion.trim() || !newFcAnswer.trim()} className="px-8 py-3 bg-accent hover:opacity-90 disabled:opacity-30 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer">Crear tarjeta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewImageUrl && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa de imagen" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-8 animate-fadeIn" onClick={() => setPreviewImageUrl(null)}>
          <div className="relative max-w-5xl max-h-[85vh] rounded-xl overflow-hidden shadow-sm border border-borderDark animate-fadeInScale" onClick={e => e.stopPropagation()}>
            <img src={previewImageUrl} alt="Preview" className="w-full h-full object-contain max-h-[85vh]" />
            <button onClick={() => setPreviewImageUrl(null)} className="absolute top-6 right-6 p-3 rounded-xl bg-surface/80 border border-borderDark hover:bg-surface text-white transition-all cursor-pointer shadow-sm backdrop-blur-md">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
