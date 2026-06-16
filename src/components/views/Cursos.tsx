import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  GraduationCap, ChevronLeft, Pencil, PlusCircle, Layers, Trash2, 
  Book, Upload, X, MoreVertical, Search, Filter, Play, Edit3, 
  Plus, Eye, EyeOff, LayoutGrid, ChevronRight, HardDrive, RefreshCw,
  File, Sigma, Lightbulb, Key, Type, HelpCircle, ListChecks, ExternalLink,
  ChevronDown, Check, Folder, Sparkles
} from 'lucide-react';
import { 
  DndContext, closestCorners, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, useDroppable, DragOverlay, DragStartEvent, DragEndEvent 
} from '@dnd-kit/core';
import { 
  SortableContext, rectSortingStrategy, useSortable, arrayMove 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp, Course, SubjectGroup, SubjectTopic, SubjectMaterial } from '../../store/AppContext';
import toast from 'react-hot-toast';

export const MATERIAL_META = {
  resource: { label: 'Recurso', icon: File },
  formula: { label: 'Fórmula', icon: Sigma },
  concept: { label: 'Concepto', icon: Lightbulb },
  'key-data': { label: 'Dato Clave', icon: Key },
  meaning: { label: 'Significado', icon: Type },
  quiz: { label: 'Cuestionario', icon: HelpCircle },
  procedure: { label: 'Procedimiento', icon: ListChecks },
};

type MaterialType = keyof typeof MATERIAL_META;

// --- Droppable Column for Drag and Drop ---
interface ColumnProps {
  id: string;
  items: SubjectMaterial[];
  children: React.ReactNode;
}

function DroppableColumn({ id, items, children }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items.map(m => m.id)} strategy={rectSortingStrategy}>
      <div 
        ref={setNodeRef} 
        className="aether-column" 
        style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 320 }}
      >
        {children}
      </div>
    </SortableContext>
  );
}

// --- Sortable Wrapper ---
interface SortableWrapperProps {
  id: string;
  children: (dragProps: { attributes: any; listeners: any }) => React.ReactNode;
}

function SortableWrapper({ id, children }: SortableWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      {children({ attributes, listeners })}
    </div>
  );
}

// --- Individual Material Card ---
interface MaterialCardProps {
  mat: SubjectMaterial;
  dragAttributes?: any;
  dragListeners?: any;
  onEdit: (mat: SubjectMaterial) => void;
  onDelete: (mat: SubjectMaterial) => void;
  onOpenResource: (mat: SubjectMaterial) => void;
}

function MaterialCard({ mat, dragAttributes, dragListeners, onEdit, onDelete, onOpenResource }: MaterialCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = MATERIAL_META[mat.type];
  const Icon = meta.icon;
  const isKeyData = mat.type === 'key-data';
  const isExpandable = ['concept', 'key-data', 'meaning', 'quiz', 'procedure'].includes(mat.type);

  // Helper getters
  const title = mat.name || mat.title || mat.word || mat.question || 'Sin título';
  const body = mat.content || mat.meaning || mat.answer || '';

  return (
    <div className="aether-glass-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div 
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          borderBottom: '1px solid var(--aether-border-glass)', padding: '6px 12px', background: 'rgba(0,0,0,0.1)' 
        }}
        className="group-hover-visible"
      >
        <button 
          onClick={() => onEdit(mat)} 
          className="btn-ghost" 
          style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}
          title="Editar"
        >
          <Edit3 size={11} />
        </button>

        <div 
          {...dragAttributes} 
          {...dragListeners} 
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'grab', padding: '2px 0' }}
          title="Arrastrar"
        >
          <Icon size={12} className="aether-text-primary" />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            {meta.label}
          </span>
        </div>

        <button 
          onClick={() => onDelete(mat)} 
          className="btn-ghost text-red-500" 
          style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
          title="Eliminar"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Body content */}
      <div 
        style={{ padding: 14, cursor: isExpandable ? 'pointer' : 'default' }}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
          {title}
        </h4>

        {mat.type === 'formula' && mat.clarification && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: 1.4 }}>
            {mat.clarification}
          </p>
        )}

        {mat.type === 'procedure' && mat.description && (
          <p style={{ fontSize: 11, color: 'var(--aether-primary)', fontStyle: 'italic', marginBottom: 8 }}>
            {mat.description}
          </p>
        )}

        {isExpandable && (
          <p 
            style={{ 
              fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, 
              whiteSpace: 'pre-wrap', display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}
          >
            {body}
          </p>
        )}

        {mat.image && expanded && (
          <div style={{ marginTop: 10, width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--aether-border-glass)', background: 'rgba(0,0,0,0.2)' }}>
            <img src={mat.image} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        )}

        {mat.type === 'resource' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenResource(mat); }}
            className="aether-text-primary"
            style={{ padding: 0, height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}
          >
            Ver archivo <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Main Cursos Detailed Component ---
export default function Cursos({ initialCourseId }: { initialCourseId?: string }) {
  const { courses = [], updateCourse, setNavigateTo } = useApp();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || courses[0]?.id || '');
  const [currentView, setCurrentView] = useState<'subject' | 'topic'>('subject');
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [filterMaterialType, setFilterMaterialType] = useState<MaterialType | 'all'>('all');

  // Course updates fields
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCover, setEditCourseCover] = useState<string | undefined>(undefined);

  // Group modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupCover, setGroupCover] = useState<string | undefined>(undefined);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // Topic modals
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  // Material modals
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<SubjectMaterial | null>(null);
  const [materialColIndex, setMaterialColIndex] = useState(0);

  // Material Form fields
  const [mName, setMName] = useState('');
  const [mClarification, setMClarification] = useState('');
  const [mTitle, setMTitle] = useState('');
  const [mContent, setMContent] = useState('');
  const [mWord, setMWord] = useState('');
  const [mMeaning, setMMeaning] = useState('');
  const [mQuestion, setMQuestion] = useState('');
  const [mAnswer, setMAnswer] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [mImage, setMImage] = useState<string | undefined>(undefined);

  // File Upload Refs
  const courseCoverInputRef = useRef<HTMLInputElement>(null);
  const groupCoverInputRef = useRef<HTMLInputElement>(null);
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const materialImageInputRef = useRef<HTMLInputElement>(null);

  // Active course resolution
  const course = useMemo(() => courses.find(c => c.id === selectedCourseId) || courses[0], [courses, selectedCourseId]);

  // Sync edits
  useEffect(() => {
    if (course) {
      setEditCourseName(course.name);
      setEditCourseCover(course.coverUrl || course.coverImage);
    }
  }, [course]);

  // Active topic resolution
  const activeTopic = useMemo(() => {
    if (!course || !activeTopicId) return null;
    return (course.studyTopics || []).find(t => t.id === activeTopicId) || null;
  }, [course, activeTopicId]);

  if (!course) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-base)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Asignatura no encontrada.</p>
        <button onClick={() => setNavigateTo('cursos')} className="aether-btn-primary" style={{ marginTop: 16, height: 38, padding: '0 20px', border: 'none', cursor: 'pointer' }}>
          Volver a Asignaturas
        </button>
      </div>
    );
  }

  // --- Sub-View Functions ---

  const handleSaveCourseSettings = () => {
    if (!editCourseName.trim()) return;
    updateCourse(course.id, {
      name: editCourseName.trim(),
      coverImage: editCourseCover,
      coverUrl: editCourseCover,
    });
    setShowEditCourse(false);
    toast.success('Configuración guardada');
  };

  const handleAddTopic = () => {
    if (!topicName.trim()) return;
    const currentTopics = course.studyTopics || [];
    
    if (editingTopicId) {
      // Edit
      const updated = currentTopics.map(t => 
        t.id === editingTopicId ? { ...t, title: topicName.trim() } : t
      );
      updateCourse(course.id, { studyTopics: updated });
      toast.success('Tema actualizado');
    } else {
      // Create
      const newTopic: SubjectTopic = {
        id: Math.random().toString(),
        title: topicName.trim(),
        status: 'pending',
        createdAt: Date.now(),
        reviewLevel: 0,
        nextReview: Date.now(),
        materials: []
      };
      updateCourse(course.id, { studyTopics: [...currentTopics, newTopic] });
      toast.success('Tema integrado');
    }
    
    setTopicName('');
    setEditingTopicId(null);
    setShowTopicModal(false);
  };

  const handleDeleteTopic = (id: string) => {
    const currentTopics = course.studyTopics || [];
    updateCourse(course.id, {
      studyTopics: currentTopics.filter(t => t.id !== id)
    });
    toast.success('Tema eliminado');
  };

  const handleSaveGroup = () => {
    if (!groupName.trim()) return;
    const currentGroups = course.groups || [];
    const groupId = editingGroupId || Math.random().toString();

    let updatedGroups = [...currentGroups];
    if (editingGroupId) {
      updatedGroups = updatedGroups.map(g => 
        g.id === editingGroupId ? { ...g, name: groupName.trim(), image: groupCover } : g
      );
    } else {
      updatedGroups.push({
        id: groupId,
        name: groupName.trim(),
        image: groupCover,
        createdAt: Date.now()
      });
    }

    // Assign topics' groupIds
    const updatedTopics = (course.studyTopics || []).map(t => {
      if (selectedTopicIds.includes(t.id)) {
        return { ...t, groupId };
      } else if (t.groupId === groupId) {
        return { ...t, groupId: undefined };
      }
      return t;
    });

    updateCourse(course.id, {
      groups: updatedGroups,
      studyTopics: updatedTopics
    });

    setGroupName('');
    setGroupCover(undefined);
    setSelectedTopicIds([]);
    setEditingGroupId(null);
    setShowGroupModal(false);
    toast.success(editingGroupId ? 'Agrupación actualizada' : 'Agrupación creada');
  };

  const startEditGroup = (g: SubjectGroup) => {
    const members = (course.studyTopics || []).filter(t => t.groupId === g.id).map(t => t.id);
    setEditingGroupId(g.id);
    setGroupName(g.name);
    setGroupCover(g.image);
    setSelectedTopicIds(members);
    setShowGroupModal(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    const currentGroups = course.groups || [];
    const updatedTopics = (course.studyTopics || []).map(t => 
      t.groupId === groupId ? { ...t, groupId: undefined } : t
    );
    updateCourse(course.id, {
      groups: currentGroups.filter(g => g.id !== groupId),
      studyTopics: updatedTopics
    });
    toast.success('Agrupación eliminada');
  };

  // --- Topic Material Management ---

  const handleAddMaterialClick = (type: MaterialType, colIdx: number) => {
    if (type === 'resource') {
      setMaterialColIndex(colIdx);
      resourceInputRef.current?.click();
      return;
    }
    setMaterialType(type);
    setMaterialColIndex(colIdx);
    setEditingMaterial(null);
    
    // Clear forms
    setMName('');
    setMClarification('');
    setMTitle('');
    setMContent('');
    setMWord('');
    setMMeaning('');
    setMQuestion('');
    setMAnswer('');
    setMDescription('');
    setMImage(undefined);
    
    setShowMaterialModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTopic) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newMaterial: SubjectMaterial = {
        id: Math.random().toString(),
        type: 'resource',
        createdAt: Date.now(),
        columnIndex: materialColIndex,
        name: file.name,
        fileType: file.type,
        dataUrl
      };

      const updatedTopics = (course.studyTopics || []).map(t => 
        t.id === activeTopic.id ? { ...t, materials: [...(t.materials || []), newMaterial] } : t
      );
      updateCourse(course.id, { studyTopics: updatedTopics });
      toast.success('Archivo integrado correctamente');
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleSaveMaterial = () => {
    if (!materialType || !activeTopic) return;

    let payload: Partial<SubjectMaterial> = {};
    switch (materialType) {
      case 'formula':
        if (!mName.trim()) return;
        payload = { name: mName.trim(), clarification: mClarification.trim(), image: mImage };
        break;
      case 'concept':
        if (!mTitle.trim()) return;
        payload = { title: mTitle.trim(), content: mContent.trim() };
        break;
      case 'key-data':
        if (!mContent.trim()) return;
        payload = { title: mTitle.trim(), content: mContent.trim() };
        break;
      case 'meaning':
        if (!mWord.trim() || !mMeaning.trim()) return;
        payload = { word: mWord.trim(), meaning: mMeaning.trim() };
        break;
      case 'quiz':
        if (!mQuestion.trim() || !mAnswer.trim()) return;
        payload = { question: mQuestion.trim(), answer: mAnswer.trim() };
        break;
      case 'procedure':
        if (!mTitle.trim() || !mContent.trim()) return;
        payload = { title: mTitle.trim(), description: mDescription.trim(), content: mContent.trim(), image: mImage };
        break;
    }

    const currentTopics = course.studyTopics || [];
    const updatedTopics = currentTopics.map(t => {
      if (t.id === activeTopic.id) {
        let updatedMaterials = t.materials || [];
        if (editingMaterial) {
          // Edit
          updatedMaterials = updatedMaterials.map(m => 
            m.id === editingMaterial.id ? { ...m, ...payload } : m
          );
        } else {
          // Create
          const newMaterial: SubjectMaterial = {
            id: Math.random().toString(),
            type: materialType,
            createdAt: Date.now(),
            columnIndex: materialColIndex,
            ...payload
          };
          updatedMaterials = [...updatedMaterials, newMaterial];
        }
        return { ...t, materials: updatedMaterials };
      }
      return t;
    });

    updateCourse(course.id, { studyTopics: updatedTopics });
    setShowMaterialModal(false);
    toast.success(editingMaterial ? 'Material actualizado' : 'Material guardado');
  };

  const startEditMaterial = (mat: SubjectMaterial) => {
    setEditingMaterial(mat);
    setMaterialType(mat.type);
    setMaterialColIndex(mat.columnIndex);
    
    setMName(mat.name || '');
    setMClarification(mat.clarification || '');
    setMTitle(mat.title || '');
    setMContent(mat.content || '');
    setMWord(mat.word || '');
    setMMeaning(mat.meaning || '');
    setMQuestion(mat.question || '');
    setMAnswer(mat.answer || '');
    setMDescription(mat.description || '');
    setMImage(mat.image);

    setShowMaterialModal(true);
  };

  const handleDeleteMaterial = (mat: SubjectMaterial) => {
    if (!activeTopic) return;
    const currentTopics = course.studyTopics || [];
    const updatedTopics = currentTopics.map(t => {
      if (t.id === activeTopic.id) {
        return { ...t, materials: (t.materials || []).filter(m => m.id !== mat.id) };
      }
      return t;
    });
    updateCourse(course.id, { studyTopics: updatedTopics });
    toast.success('Material removido');
  };

  const handleOpenResource = (mat: SubjectMaterial) => {
    if (!mat.dataUrl) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${mat.dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; position:fixed;" allowfullscreen></iframe>`
      );
    } else {
      toast.error('Las ventanas emergentes están bloqueadas por el navegador');
    }
  };

  const setTopicReviewLevel = (topicId: string, level: number) => {
    const currentTopics = course.studyTopics || [];
    const updated = currentTopics.map(t => 
      t.id === topicId ? { ...t, reviewLevel: level, status: level >= 4 ? ('done' as const) : ('studying' as const) } : t
    );
    updateCourse(course.id, { studyTopics: updated });
    toast.success(`Nivel de retención: ${level}`);
  };

  // --- Drag and Drop Handlers for Materials ---

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeTopicMaterials = useMemo(() => {
    if (!activeTopic) return [];
    const all = activeTopic.materials || [];
    return filterMaterialType === 'all' ? all : all.filter(m => m.type === filterMaterialType);
  }, [activeTopic, filterMaterialType]);

  const columns = useMemo(() => {
    const cols: SubjectMaterial[][] = [[], [], []];
    activeTopicMaterials.forEach(mat => {
      const ci = mat.columnIndex;
      if (typeof ci === 'number' && ci >= 0 && ci <= 2) {
        cols[ci].push(mat);
      } else {
        cols[0].push(mat);
      }
    });
    // Sort descending
    cols.forEach(c => c.sort((a, b) => b.createdAt - a.createdAt));
    return cols;
  }, [activeTopicMaterials]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !activeTopic) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find containers (columns)
    let activeColIdx = -1;
    let overColIdx = -1;

    for (let i = 0; i < 3; i++) {
      if (columns[i].some(m => m.id === activeId)) activeColIdx = i;
      if (columns[i].some(m => m.id === overId)) overColIdx = i;
    }

    if (overId.startsWith('col-')) {
      overColIdx = parseInt(overId.split('-')[1]);
    }

    if (activeColIdx === -1 || overColIdx === -1) return;

    // Reorder materials array
    const currentMaterials = [...(activeTopic.materials || [])];
    const targetMat = currentMaterials.find(m => m.id === activeId);

    if (targetMat) {
      targetMat.columnIndex = overColIdx;
      targetMat.createdAt = Date.now(); // Put to top

      const updatedTopics = (course.studyTopics || []).map(t => 
        t.id === activeTopic.id ? { ...t, materials: currentMaterials } : t
      );
      updateCourse(course.id, { studyTopics: updatedTopics });
    }
  };

  // UI calculations
  const parsedTopics = course.studyTopics || [];
  const groups = course.groups || [];
  const ungroupedTopics = parsedTopics.filter(t => !t.groupId);

  return (
    <div className="page-container" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-base)' }}>
      
      {/* ────────────────── VIEW: SUBJECT DETAILS (TOPICS GRID) ────────────────── */}
      {currentView === 'subject' && (
        <div className="animate-in fade-in duration-300 pb-16">
          {/* Cover Banner */}
          <div 
            style={{ 
              position: 'relative', width: '100%', height: 260, 
              background: `linear-gradient(135deg, ${course.color}33 0%, var(--bg-surface) 100%)`,
              overflow: 'hidden' 
            }}
          >
            {(course.coverUrl || course.coverImage) ? (
              <img 
                src={course.coverUrl || course.coverImage} 
                alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom right, ${course.color}22, rgba(0,0,0,0.6))` }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-base) 0%, transparent 80%)' }} />

            {/* Back Button */}
            <button 
              onClick={() => setNavigateTo('cursos')} 
              className="aether-glass-card"
                style={{ 
                  position: 'absolute', top: 20, left: 24, display: 'flex', alignItems: 'center', gap: 6, 
                  height: 34, padding: '0 14px', border: 'none', cursor: 'pointer', zIndex: 10, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' 
                }}
            >
              <ChevronLeft size={16} className="aether-text-primary" /> Asignaturas
            </button>

            {/* Title Banner */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'end', paddingBottom: 28 }}>
              <h2 style={{ fontSize: 38, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.8)', fontFamily: "'Inter Tight', sans-serif" }}>
                {course.name}
              </h2>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--aether-primary)', marginTop: 6 }}>
                Repositorio Académico
              </p>
            </div>

            {/* Actions top-right */}
            <div style={{ position: 'absolute', top: 20, right: 24, display: 'flex', gap: 10, zIndex: 10 }}>
              <button 
                onClick={() => setShowEditCourse(true)} 
                className="aether-glass-card" 
                style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                title="Configurar asignatura"
              >
                <Pencil size={14} style={{ color: 'var(--text-primary)' }} />
              </button>
              <button 
                onClick={() => { setEditingTopicId(null); setTopicName(''); setShowTopicModal(true); }} 
                className="aether-glass-card" 
                style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                title="Añadir tema"
              >
                <PlusCircle size={14} style={{ color: 'var(--text-primary)' }} />
              </button>
              <button 
                onClick={() => { setEditingGroupId(null); setGroupName(''); setGroupCover(undefined); setSelectedTopicIds([]); setShowGroupModal(true); }} 
                className="aether-glass-card" 
                style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                title="Agrupar temas"
              >
                <Layers size={14} style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>
          </div>

          {/* Grid content */}
          <div style={{ maxWidth: 1200, margin: '32px auto 0', padding: '0 24px' }}>
            
            {/* Thematic Groups */}
            {groups.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--aether-primary)', opacity: 0.7, marginBottom: 16 }}>
                  Agrupaciones Temáticas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {groups.map(group => {
                    const members = parsedTopics.filter(t => t.groupId === group.id);
                    return (
                      <div 
                        key={group.id} 
                        className="aether-glass-card group" 
                        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
                      >
                        {/* Edit Group trigger */}
                        <button 
                          onClick={() => startEditGroup(group)}
                          className="btn-ghost group-hover-visible"
                          style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', zIndex: 5, color: '#fff', opacity: 0, transition: 'opacity 150ms' }}
                        >
                          <Edit3 size={11} />
                        </button>
                        <button 
                          onClick={() => handleDeleteGroup(group.id)}
                          className="btn-ghost text-red-500 group-hover-visible"
                          style={{ position: 'absolute', top: 10, right: 42, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', zIndex: 5, opacity: 0, transition: 'opacity 150ms' }}
                        >
                          <Trash2 size={11} />
                        </button>

                        <div style={{ height: 80, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--aether-primary) 0%, var(--bg-surface) 100%)' }}>
                          {group.image && <img src={group.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{group.name}</h4>
                          </div>
                        </div>

                        <div style={{ padding: 14, background: 'rgba(0,0,0,0.05)', flex: 1 }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 10 }}>
                            {members.length} temas integrados
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {members.map(t => (
                              <div 
                                key={t.id}
                                onClick={() => { setActiveTopicId(t.id); setCurrentView('topic'); }}
                                style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--aether-primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                              >
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--aether-primary)' }} />
                                <span className="truncate">{t.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Independent Topics */}
            <div>
              <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--aether-primary)', opacity: 0.7, marginBottom: 16 }}>
                Temas Independientes
              </h3>
              {ungroupedTopics.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {ungroupedTopics.map(topic => (
                    <div 
                      key={topic.id} 
                      className="aether-glass-card group" 
                      style={{ padding: 18, position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}
                    >
                      {/* Left accent border */}
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: 'var(--aether-primary)', borderRadius: '3px 0 0 3px' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 
                          onClick={() => { setActiveTopicId(topic.id); setCurrentView('topic'); }}
                          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', flex: 1, marginRight: 12 }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--aether-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        >
                          {topic.title}
                        </h4>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button 
                            onClick={() => { setEditingTopicId(topic.id); setTopicName(topic.title); setShowTopicModal(true); }}
                            className="btn-ghost group-hover-visible"
                            style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 150ms', color: 'var(--text-secondary)' }}
                          >
                            <Edit3 size={11} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTopic(topic.id)}
                            className="btn-ghost text-red-500 group-hover-visible"
                            style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 150ms' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Dots progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Familiaridad:</span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[...Array(5)].map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setTopicReviewLevel(topic.id, i + 1)}
                              style={{ 
                                width: 10, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
                                background: i < topic.reviewLevel ? 'var(--aether-primary)' : 'rgba(255,255,255,0.05)',
                                transition: 'all 200ms ease'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.5 }}>
                  <Book size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Aún no hay temas agregados.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ────────────────── VIEW: TOPIC DETAILS (MATERIALS GRID) ────────────────── */}
      {currentView === 'topic' && activeTopic && (
        <div className="animate-in fade-in duration-300 pb-16" style={{ padding: '24px 32px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid var(--aether-border-glass)', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button 
                onClick={() => setCurrentView('subject')} 
                className="btn-ghost" 
                style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--aether-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Tema de {course.name}
                </span>
                <h2 style={{ fontSize: 26, fontWeight: 300, color: 'var(--text-primary)', marginTop: 2, fontFamily: "'Inter Tight', sans-serif" }}>
                  {activeTopic.title}
                </h2>
              </div>
            </div>

            {/* Retention Dots selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Comprensión:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[...Array(5)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTopicReviewLevel(activeTopic.id, i + 1)}
                    style={{ 
                      width: 14, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer',
                      background: i < activeTopic.reviewLevel ? 'var(--aether-primary)' : 'rgba(255,255,255,0.05)',
                      transition: 'all 200ms ease'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Filtering bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 12, borderBottom: '1px dashed var(--aether-border-glass)' }}>
            <button 
              onClick={() => setFilterMaterialType('all')}
              className={filterMaterialType === 'all' ? 'aether-btn-primary' : 'btn-ghost'}
              style={{ height: 30, padding: '0 12px', fontSize: 11, borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 150ms' }}
            >
              Todos ({activeTopic.materials?.length || 0})
            </button>
            {(Object.keys(MATERIAL_META) as MaterialType[]).map(type => {
              const count = (activeTopic.materials || []).filter(m => m.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setFilterMaterialType(type)}
                  className={filterMaterialType === type ? 'aether-btn-primary' : 'btn-ghost'}
                  style={{ height: 30, padding: '0 12px', fontSize: 11, borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 150ms' }}
                >
                  {MATERIAL_META[type].label} ({count})
                </button>
              );
            })}
          </div>

          {/* 3-Column layout with Drag and Drop */}
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCorners} 
            onDragEnd={handleDragEnd}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {[0, 1, 2].map(colIndex => {
                const colItems = columns[colIndex] || [];
                return (
                  <div key={colIndex} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Columna {colIndex + 1}
                      </span>
                      
                      {/* Quick Add floating trigger for this column */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          onClick={() => handleAddMaterialClick('concept', colIndex)}
                          style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--aether-border-glass)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                          title="Añadir Concepto"
                        >
                          <Plus size={10} />
                        </button>
                        <button 
                          onClick={() => handleAddMaterialClick('formula', colIndex)}
                          style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--aether-border-glass)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                          title="Añadir Fórmula"
                        >
                          <Sigma size={10} />
                        </button>
                        <button 
                          onClick={() => handleAddMaterialClick('resource', colIndex)}
                          style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--aether-border-glass)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                          title="Subir archivo"
                        >
                          <Upload size={10} />
                        </button>
                      </div>
                    </div>

                    <DroppableColumn id={`col-${colIndex}`} items={colItems}>
                      {colItems.map(mat => (
                        <SortableWrapper key={mat.id} id={mat.id}>
                          {({ attributes, listeners }) => (
                            <MaterialCard 
                              mat={mat}
                              dragAttributes={attributes}
                              dragListeners={listeners}
                              onEdit={startEditMaterial}
                              onDelete={handleDeleteMaterial}
                              onOpenResource={handleOpenResource}
                            />
                          )}
                        </SortableWrapper>
                      ))}
                      
                      {colItems.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 140, opacity: 0.3, border: '1px dashed var(--aether-border-glass)', borderRadius: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>Vacío</span>
                        </div>
                      )}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          </DndContext>

          <input type="file" ref={resourceInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>
      )}

      {/* ────────────────── MODALS & DIALOGS ────────────────── */}

      {/* 1. Edit Course Modal */}
      {showEditCourse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowEditCourse(false)}>
          <div className="aether-glass-card" style={{ width: 420, padding: 28, background: 'var(--bg-surface)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Configurar Asignatura</h3>
              <button onClick={() => setShowEditCourse(false)} className="btn-ghost" style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre</label>
                <input
                  type="text"
                  value={editCourseName}
                  onChange={e => setEditCourseName(e.target.value)}
                  className="input-base"
                  style={{ width: '100%', height: 38, fontSize: 13, padding: '0 12px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Banner (Imagen)</label>
                {editCourseCover ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16/7', borderRadius: 10, overflow: 'hidden' }}>
                    <img src={editCourseCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => setEditCourseCover(undefined)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => courseCoverInputRef.current?.click()}
                    style={{
                      width: '100%', height: 80, borderRadius: 10, border: '2px dashed var(--aether-border-glass)',
                      background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <Upload size={16} />
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Subir Imagen</span>
                  </button>
                )}
                <input type="file" ref={courseCoverInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) {
                    const r = new FileReader(); r.onload = (ev) => setEditCourseCover(ev.target?.result as string); r.readAsDataURL(f);
                  }
                }} />
              </div>

              <button
                onClick={handleSaveCourseSettings}
                className="aether-btn-primary"
                style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer', marginTop: 8 }}
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Topic Modal */}
      {showTopicModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowTopicModal(false)}>
          <div className="aether-glass-card" style={{ width: 400, padding: 24, background: 'var(--bg-surface)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{editingTopicId ? 'Editar Tema' : 'Nuevo Tema'}</h3>
              <button onClick={() => setShowTopicModal(false)} className="btn-ghost" style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="text"
                value={topicName}
                onChange={e => setTopicName(e.target.value)}
                className="input-base"
                style={{ width: '100%', height: 38, fontSize: 13, padding: '0 12px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
                placeholder="Nombre del tema..."
                autoFocus
              />
              <button
                onClick={handleAddTopic}
                className="aether-btn-primary"
                disabled={!topicName.trim()}
                style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer' }}
              >
                {editingTopicId ? 'Guardar Cambios' : 'Integrar Tema'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Group Topics Modal */}
      {showGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowGroupModal(false)}>
          <div className="aether-glass-card" style={{ width: 440, padding: 28, background: 'var(--bg-surface)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingGroupId ? 'Editar Agrupación' : 'Crear Agrupación'}
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="btn-ghost" style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre del Grupo</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="input-base"
                  style={{ width: '100%', height: 38, fontSize: 13, padding: '0 12px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
                  placeholder="Ej: Álgebra Lineal, Mecánica de Fluidos..."
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Banner (Opcional)</label>
                {groupCover ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16/7', borderRadius: 10, overflow: 'hidden' }}>
                    <img src={groupCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => setGroupCover(undefined)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => groupCoverInputRef.current?.click()}
                    style={{
                      width: '100%', height: 70, borderRadius: 10, border: '2px dashed var(--aether-border-glass)',
                      background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <Upload size={14} />
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>Subir Banner</span>
                  </button>
                )}
                <input type="file" ref={groupCoverInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) {
                    const r = new FileReader(); r.onload = (ev) => setGroupCover(ev.target?.result as string); r.readAsDataURL(f);
                  }
                }} />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Seleccionar Temas</label>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--aether-border-glass)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(0,0,0,0.15)' }}>
                  {parsedTopics.map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={selectedTopicIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTopicIds([...selectedTopicIds, t.id]);
                          } else {
                            setSelectedTopicIds(selectedTopicIds.filter(id => id !== t.id));
                          }
                        }}
                      />
                      <span>{t.title}</span>
                    </label>
                  ))}
                  {parsedTopics.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No hay temas disponibles.</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleSaveGroup}
                className="aether-btn-primary"
                disabled={!groupName.trim()}
                style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer', marginTop: 8 }}
              >
                {editingGroupId ? 'Guardar Cambios' : 'Crear Agrupación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add/Edit Material Modal */}
      {showMaterialModal && materialType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowMaterialModal(false)}>
          <div className="aether-glass-card" style={{ width: 440, padding: 28, background: 'var(--bg-surface)', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingMaterial ? 'Editar ' : 'Añadir '} {MATERIAL_META[materialType].label}
              </h3>
              <button onClick={() => setShowMaterialModal(false)} className="btn-ghost" style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Type specific fields */}
              {materialType === 'formula' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nombre de la Fórmula</label>
                    <input type="text" value={mName} onChange={e => setMName(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Ej: E = mc²" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Explicación o Variables</label>
                    <textarea value={mClarification} onChange={e => setMClarification(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="Describe las constantes o aplicación..." />
                  </div>
                </>
              )}

              {materialType === 'concept' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Título del Concepto</label>
                    <input type="text" value={mTitle} onChange={e => setMTitle(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Ej: Ley de Inercia" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Desarrollo del Concepto</label>
                    <textarea value={mContent} onChange={e => setMContent(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 120, padding: 10, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="Escribe la explicación teórica..." />
                  </div>
                </>
              )}

              {materialType === 'key-data' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Título (Opcional)</label>
                    <input type="text" value={mTitle} onChange={e => setMTitle(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Ej: Constante G" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Dato Clave</label>
                    <textarea value={mContent} onChange={e => setMContent(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="Define el dato clave indispensable..." />
                  </div>
                </>
              )}

              {materialType === 'meaning' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Término o Palabra</label>
                    <input type="text" value={mWord} onChange={e => setMWord(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Ej: Mitosis" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Significado / Definición</label>
                    <textarea value={mMeaning} onChange={e => setMMeaning(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="Define el concepto..." />
                  </div>
                </>
              )}

              {materialType === 'quiz' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Pregunta de Evaluación</label>
                    <input type="text" value={mQuestion} onChange={e => setMQuestion(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Ej: ¿Qué acelera una reacción química?" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Respuesta Correcta</label>
                    <textarea value={mAnswer} onChange={e => setMAnswer(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="Escribe la respuesta..." />
                  </div>
                </>
              )}

              {materialType === 'procedure' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Título del Procedimiento</label>
                    <input type="text" value={mTitle} onChange={e => setMTitle(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Ej: Destilación simple" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Descripción rápida (Opcional)</label>
                    <input type="text" value={mDescription} onChange={e => setMDescription(e.target.value)} className="input-base" style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }} placeholder="Resumen del procedimiento..." />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Pasos / Instrucciones</label>
                    <textarea value={mContent} onChange={e => setMContent(e.target.value)} className="input-base" style={{ width: '100%', minHeight: 120, padding: 10, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="Paso 1: ...&#10;Paso 2: ..." />
                  </div>
                </>
              )}

              {/* Supportive image block (for formula and procedure) */}
              {['formula', 'procedure'].includes(materialType) && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Imagen Ilustrativa (Opcional)</label>
                  {mImage ? (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--aether-border-glass)' }}>
                      <img src={mImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'rgba(0,0,0,0.2)' }} />
                      <button
                        onClick={() => setMImage(undefined)}
                        style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => materialImageInputRef.current?.click()}
                      style={{
                        width: '100%', height: 64, borderRadius: 8, border: '2px dashed var(--aether-border-glass)',
                        background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4
                      }}
                    >
                      <Upload size={12} />
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>Cargar Imagen</span>
                    </button>
                  )}
                  <input type="file" ref={materialImageInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if (f) {
                      const r = new FileReader(); r.onload = (ev) => setMImage(ev.target?.result as string); r.readAsDataURL(f);
                    }
                  }} />
                </div>
              )}

              <button
                onClick={handleSaveMaterial}
                className="aether-btn-primary"
                style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer', marginTop: 8 }}
              >
                {editingMaterial ? 'Guardar Cambios' : 'Guardar Material'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
