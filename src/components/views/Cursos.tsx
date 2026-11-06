import NoteEditorToolbar from '../ui/NoteEditorToolbar';
import {useObservedSize} from '../../hooks/useObservedSize';
import {applyEditorHighlight} from '../../lib/editorHighlight';
import type {BannerCrop} from '../../lib/bannerCrop';
import 'katex/dist/katex.min.css';
import {useCoverPalette} from '../../hooks/useCoverPalette';
import {useTaskPresentationSlice} from "../../store/AppContext";
import {courseStudySeconds} from '../../lib/courseStudy';
import {productiveSessions} from '../../lib/studyAnalytics';
import { localPathFromUrl } from '../../lib/externalTarget';
import { resolveExternalResource } from '../../lib/openFileSmart';
import BannerField from '../ui/BannerField';
import PlanSelectDropdown from '../ui/PlanSelectDropdown';
import CourseSessionDialog from './cursos/CourseSessionDialog';
import CourseSessionPreview from './cursos/CourseSessionPreview';
import { sessionLinkUnavailable } from '../../lib/linkEligibility';
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Pencil, PlusCircle, Layers, Trash2,
  Book, Upload, X, Quote, Search, Edit3, Plus, File, Sigma, Lightbulb, Key, Type, HelpCircle, ListChecks, ExternalLink,
  Check, StickyNote, BookOpen, ArrowUpRight, ArrowLeft, Play,
  NotebookPen, ListTodo, Bold, Italic, Underline, Heading1, Heading2, Heading3,
  List, ListOrdered, Highlighter, Paperclip, MoreHorizontal, Eye, FolderOpen,
  ArrowLeftRight, BarChart3, Calendar, Flag, ArrowUpDown, Star, EyeOff, Strikethrough, AlignLeft, AlignCenter, AlertTriangle, ArrowRight,
  Users, MoreVertical, FileText, CheckCircle, FileSpreadsheet, Image as ImageIcon, Music, Link2, Lock,
  Download, ArrowDownToLine, ArrowUpFromLine, Package, PackageOpen, FileDown, FileUp, Mic,
  ScrollText, Shuffle, Workflow, Puzzle, Clock, Minus, Sparkles, Brain, Timer,
  TreePine, Map as MapIcon, Split, Tag,
  Zap, DollarSign, CalendarDays,
  Library, Files, ClipboardList, Trophy,
} from 'lucide-react';
import { GoogleClassroomIcon, GoogleDriveIcon, GoogleDocsIcon, GoogleSheetsIcon, GoogleSlidesIcon, GoogleFormsIcon, WordIcon, ExcelIcon, PowerPointIcon } from '../ui/GoogleIcons';
import {
  DndContext, closestCenter, closestCorners, useSensor, useSensors, PointerSensor, useDroppable, DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { useApp, Course, SubjectGroup, SubjectTopic, SubjectMaterial, TopicFlashcard, PlannedSession } from '../../store/AppContext';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, stat } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import toast from 'react-hot-toast';
import { createEditorHistory } from '../../lib/editorHistory';
import { latexToHtml, latexTextToHtml, upgradeLatexInText } from '../../lib/latexRender';
import { renderMathAtCaret, editMathSource, prepareMathClipboard } from '../../lib/latex';
import { fuzzyMatch } from '../../lib/fuzzy';
import { usePlannerDay } from '../../lib/plannerDay';
import { useMaterialMenu } from '../ui/MaterialContextMenu';
import { normalizeEditorHtml, sanitizePastedHtml, plainTextToHtml } from '../../lib/editorHtml';
import ImageEditorModal from '../ui/ImageEditorModal';
import { DeckEditorModal, DeckRunner, DECK_META, type ToolDeckMode } from './cursos/ToolDecks';

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

export const BUILT_IN_SESSION_TYPES = [
  { id: 'estudio', label: 'Estudio', color: '#8B5CF6' },
  { id: 'repaso', label: 'Repaso', color: '#3B82F6' },
  { id: 'ejercicio', label: 'Ejercicio', color: '#10B981' },
  { id: 'lectura', label: 'Lectura', color: '#F59E0B' },
  { id: 'otro', label: 'Otro', color: '#6B7280' },
];
export const SESSION_TYPE_COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#6366F1','#84CC16','#F97316','#14B8A6','#A855F7'];


// --- Specialized tool creators (each tool has its own tailored form) ---
// Teoría de cada técnica: qué es, cómo se aplica y evidencia científica.
export type ToolTheory = { what: string; how: string[]; evidence: string; ref: string };
export const TOOL_CREATOR_META = {
  quizzes: { name: 'Quiz rápido', hint: 'Pregunta y respuesta para autoevaluarte', color: '#EF4444', icon: HelpCircle,
    theory: { what: 'Recuperación activa: responder SIN mirar la respuesta fortalece la memoria mucho más que releer.', how: ['Escribe una pregunta concreta.', 'Responde de memoria, en voz alta o por escrito.', 'Comprueba solo después de intentarlo.', 'Repite las falladas en la siguiente ronda.'], evidence: 'El testing effect muestra ganancias grandes frente a relectura.', ref: 'Roediger & Karpicke (2006), Psychological Science' } },
  blurting: { name: 'Blurting', hint: 'Escribe todo lo que recuerdes sin mirar apuntes', color: '#3B82F6', icon: NotebookPen,
    theory: { what: 'Vaciado libre: volcar TODO lo que recuerdas de memoria expone tus huecos al instante.', how: ['Cierra apuntes, hoja en blanco.', 'Escribe 5-10 min todo lo que recuerdes.', 'Abre apuntes y marca en otro color lo faltado.', 'Estudia SOLO lo marcado y repite mañana.'], evidence: 'Generar contenido de memoria supera a releer en retención a largo plazo.', ref: 'Karpicke & Blunt (2011), Science' } },
  feynman: { name: 'Feynman', hint: 'Explícalo en palabras simples, como para un niño', color: '#F59E0B', icon: Lightbulb,
    theory: { what: 'Si no puedes explicarlo simple, no lo entiendes: la explicación simple destapa la jerga que oculta huecos.', how: ['Elige UN concepto.', 'Explícalo como a un niño de 12 años.', 'Donde te trabes ahí está el hueco: vuelve a la fuente.', 'Simplifica con analógicas propias.'], evidence: 'Explicar en simple revela lagunas y crea organizadores mentales profundos.', ref: 'R. Feynman; popularizado por Scott Young (2011)' } },
  matching: { name: 'Matching', hint: 'Relaciona pares: concepto y su pareja', color: '#10B981', icon: Shuffle,
    theory: { what: 'Emparejar término-definición afina la memoria discriminativa entre opciones parecidas.', how: ['Lista conceptos y parejas.', 'Mezcla una columna y une de memoria.', 'Los pares que falles repetidamente son los débiles.'], evidence: 'La práctica de emparejar da aprendizaje robusto en menos tiempo que el pasivo.', ref: 'Dickinson & OConnell (1990), J. Applied Behavior Analysis' } },
  cloze: { name: 'Cloze', hint: 'Texto con huecos para completar', color: '#06B6D4', icon: Type,
    theory: { what: 'Borrar palabras clave y completarlas fuerza reconstruir el contexto completo activamente.', how: ['Copia una definición o proceso clave.', 'Borra las 2-5 palabras más importantes.', 'Rellena de memoria.', 'Los huecos fallados son prioridad de repaso.'], evidence: 'Cloze deletion es base de los SRS modernos por eficiencia por minuto.', ref: 'Richmond & Cummings (2005), Psychological Record' } },
  categorization: { name: 'Categorizar', hint: 'Agrupa elementos por categoría', color: '#EC4899', icon: Puzzle,
    theory: { what: 'Clasificar en categorías construye esquemas: lo organizado se recuerda mejor que lo suelto.', how: ['Lista elementos mezclados.', 'Define tú 3-5 categorías (no las copies).', 'Clasifica y justifica cada decisión.', 'Compara con el material y ajusta.'], evidence: 'El clustering mejora el recuerdo libre frente a listas sin estructura.', ref: 'Bousfield (1953), J. General Psychology' } },
  mnemonics: { name: 'Mnemotecnia', hint: 'Regla mnemotécnica para un dato clave', color: '#6366F1', icon: Key,
    theory: { what: 'Acrónimos, frases absurdas e historias convierten información arbitraria en memorable mediante asociación vívida.', how: ['Toma el dato o lista difícil.', 'Construye acrónimo/frase/historia absurda.', 'Cuanto más vívida y rara, mejor se pega.', 'Recupérala de memoria 3 veces hoy.'], evidence: 'Efectos grandes en listas y orden arbitrario.', ref: 'McCarty (1980), Review of Educational Research' } },
  spacedRep: { name: 'Repaso espaciado', hint: 'Intervalos crecientes: 1d · 3d · 1sem · 1mes', color: '#22C55E', icon: LI.CalendarClock,
    theory: { what: 'Repasar justo antes de olvidar multiplica la retención; cada espaciado exitoso alarga el siguiente intervalo.', how: ['Repasa a: 1 día, 3 días, 1 semana, 2 semanas, 1 mes.', 'Si fallas un repaso, vuelve al intervalo anterior.', 'Marca tu dominio (0-10) tras cada repaso.'], evidence: 'El espaciado duplica retención frente a masificar con igual tiempo total.', ref: 'Cepeda et al. (2006), Psychological Bulletin' } },
  leitner: { name: 'Cajas Leitner', hint: 'Acertar sube de caja, fallar vuelve al inicio', color: '#0EA5E9', icon: Layers,
    theory: { what: 'Sistema de cajas con frecuencias distintas: acertar sube la tarjeta, fallar la devuelve al inicio — tu tiempo se concentra en lo débil.', how: ['Caja 1 diaria, caja 2 cada 3 días, caja 3 semanal...', 'Acierto sube; fallo baja a la 1.', 'Revisa solo las cajas que tocan hoy.'], evidence: 'Automatiza el espaciado adaptativo comparable a software SRS.', ref: 'Leitner (1972), So lernt man lernen' } },
  interleaving: { name: 'Intercalado', hint: 'Mezcla tipos de problema en vez de bloques', color: '#F97316', icon: LI.ArrowLeftRight,
    theory: { what: 'Alternar tipos (ABCABC) cuesta más ahora pero produce aprendizaje flexible y transferencia real.', how: ['Alterna 2-3 temas o tipos relacionados por sesión.', 'Antes de resolver pregúntate: qué tipo es y qué estrategia pide.', 'Sentirte peor al inicio es normal: ese esfuerzo ES el aprendizaje.'], evidence: 'Mejora tests tardíos y resolución en matemáticas y categorización.', ref: 'Rohrer & Taylor (2007), Instructional Science' } },
  selfExplain: { name: 'Autoexplicación', hint: 'Explica EN VOZ ALTA cada paso que estudias', color: '#14B8A6', icon: LI.Brain,
    theory: { what: 'Narrar en voz alta por qué sigue cada paso integra lo nuevo con lo conocido y destapa inferencias falsas.', how: ['Lee un paso o ejemplo.', 'Di en voz alta: qué hizo y POR Qué.', 'Conecta: "es igual que X pero...".', 'Lo no explicable = a revisar ya.'], evidence: 'Efecto grande en resolución de problemas y comprensión lectora.', ref: 'Chi et al. (1994), Cognitive Science' } },
  elaborate: { name: 'Interrogación elaborativa', hint: 'Pregúntate ¿POR QUÉ es cierto esto?', color: '#8B5CF6', icon: HelpCircle,
    theory: { what: 'Responder por qué es cierto enlaza lo nuevo con lo previo y crea múltiples rutas de recuperación.', how: ['Ante cada dato: por qué? y si no fuera así?', 'Responde CON TUS PALABRAS con ejemplos propios.', 'No avances sin una respuesta, aunque sea imperfecta.'], evidence: 'Supera leer dos veces en hechos factuales.', ref: 'Pressley et al. (1992), J. Educational Psychology' } },
  dualCoding: { name: 'Codificación dual', hint: 'Palabra + dibujo propio del concepto', color: '#EC4899', icon: LI.Palette,
    theory: { what: 'Codificar verbal Y visual crea dos huellas independientes; dibujarlo tú importa más que verlo hecho (drawing effect).', how: ['Cierra el material y dibuja el diagrama de memoria.', 'Etiqueta palabras clave junto al dibujo.', 'Explícalo usando solo tu dibujo.'], evidence: 'Codificación dual + drawing effect mejoran el recuerdo claramente.', ref: 'Paivio (1971); Wammes et al. (2016)' } },
  cornell: { name: 'Notas Cornell', hint: 'Notas · señales al margen · resumen abajo', color: '#3B82F6', icon: LI.PenLine,
    theory: { what: 'Página en 3 zonas: notas libres, preguntas-Señal al margen y resumen · convierte tomar apuntes en repasar.', how: ['Derecha: notas normales de clase.', 'Izquierda (tras clase): preguntas clave.', 'Abajo: resumen en 2-3 líneas con tus palabras.', 'Estudia tapando la derecha, respondiendo señales.'], evidence: 'Integra captura + recuperación estructurada; el valor está en las señales.', ref: 'Pauk & Owens (2010), How to Study in College' } },
  memoryPalace: { name: 'Palacio de memoria', hint: 'Cada dato en un lugar de una ruta conocida', color: '#A78BFA', icon: LI.Landmark,
    theory: { what: 'Método de loci: engancha datos vívidos a puntos fijos de una ruta conocida y recupéralos recorriéndola mentalmente.', how: ['Elige una ruta que conozcas al detalle.', 'Define 10-20 puntos fijos ordenados.', 'Coloca UN dato absurdo/vívido por punto.', 'Recorre la ruta para recuperarlos en orden.'], evidence: 'Entre los métodos más potentes para listas ordenadas; usado por campeones de memoria.', ref: 'Yates (1966); Maguire et al. (2003), Nature Neuroscience' } },
  chunking: { name: 'Fragmentación', hint: 'Bloques pequeños dominados uno a uno', color: '#F59E0B', icon: LI.Blocks,
    theory: { what: 'La memoria de trabajo maneja ~4 unidades; agrupar en trozos significativos multiplica lo retenible.', how: ['Divide el tema en bloques de 5-15 min.', 'Domina UN bloque antes del siguiente.', 'Nómbralo con 1-3 palabras: el nombre ES el chunk.'], evidence: 'La capacidad limitada explica el beneficio de segmentar (segmenting).', ref: 'Miller (1956); Mayer & Moreno (2003)' } },
  retrievalGrid: { name: 'Cuadrícula de recuperación', hint: 'Tabla temas × aspectos para rellenar de memoria', color: '#84CC16', icon: LI.LayoutGrid,
    theory: { what: 'Tabla vacía que rellenas SIN apuntes: visión global instantánea de tus huecos.', how: ['Filas = temas; columnas = aspectos (causas/fechas/fórmulas).', 'Rellena toda celda posible de memoria.', 'Las vacías en rojo son tu plan de estudio.'], evidence: 'Combina recuperación activa con organización del conocimiento.', ref: 'Agarwal et al. (2014), J. Applied Research in Memory and Cognition' } },
  errorAnalysis: { name: 'Análisis de errores', hint: 'Diario: qué falló · por qué · regla anti-repetir', color: '#EF4444', icon: LI.Bug,
    theory: { what: 'Catalogar TUS errores reales convierte cada fallo en una regla personal anti-repetición.', how: ['Tras un test, lista cada error.', 'Clasifica: descuido / concepto / procedimiento / lectura.', 'Escribe corrección Y regla para evitarlo.', 'Relee el diario antes del próximo examen.'], evidence: 'El feedback específico sobre errores propios supera repetir práctica sin análisis.', ref: 'Hattie & Timperley (2007), Review of Educational Research' } },
  timeline: { name: 'Línea de tiempo', hint: 'Eventos en el tiempo con causa-efecto', color: '#0891B2', icon: LI.History,
    theory: { what: 'El eje temporal añade estructura ordinal y causal: recuerdas cuándo porque sabes qué precedió a qué.', how: ['Dibuja el eje del tema.', 'Marcas cortas: fecha + 3 palabras.', 'Flechas causa ? efecto entre eventos.', 'Recítala de memoria hacia adelante y Atrás.'], evidence: 'La organización secuencial mejora el recuerdo serial y causal.', ref: 'Deese & Kaufman (1957), J. Exp. Psychology' } },
  mindmap: { name: 'Mapa mental', hint: 'Centro + ramas jerárquicas de memoria', color: '#10B981', icon: LI.Network,
    theory: { what: 'Jerarquía visual desde un centro para ver la estructura general — hazlo DE MEMORIA para que sea recuperación, no copia.', how: ['Centro: tema principal.', 'Ramas gruesas: ideas madre; subramas: detalles.', 'Una palabra clave por rama + color distintivo.', 'redibújalo de memoria mañana.'], evidence: 'Beneficio cuando se construye activamente; como transcripción aporta poco.', ref: 'Farrand et al. (2002), Medical Education' } },
  teach: { name: 'Enseñar (Protégé)', hint: 'Prepárate para enséñrselo a otro de verdad', color: '#EAB308', icon: Users,
    theory: { what: 'Solo ESPERAR enseñar ya cambia cómo estudias; enseñar de verdad lo multiplica.', how: ['Decide: mañana explico este tema a alguien.', 'Prepara como profesor: qué, orden, ejemplos.', 'Da la clase en voz alta sin apuntes 5-10 min.', 'Donde dudaste, ahí estudia más.'], evidence: 'Expectativa de enseñanza mejora recuerdo; enseñar activamente aún más.', ref: 'Nestojko et al. (2014); Fiorella & Mayer (2013)' } },
  sq3r: { name: 'SQ3R', hint: 'Explora · Pregunta · Lee · Recita · Repasa', color: '#2563EB', icon: LI.BookMarked,
    theory: { what: 'Protocolo de lectura en 5 pasos que convierte leer en recuperar.', how: ['Survey: títulos y negritas (2 min).', 'Question: cada título ? pregunta.', 'Read: busca SOLO esas respuestas.', 'Recite: respóndelas SIN mirar.', 'Review: mañana repite el paso 4.'], evidence: 'Mejora comprensión frente a lectura lineal cuando se cumple el recitado.', ref: 'Robinson (1946); Thomas & Robinson PQ4R (1972)' } },
  concrete: { name: 'Ejemplos concretos', hint: '2-3 ejemplos propios por idea abstracta', color: '#059669', icon: LI.Boxes,
    theory: { what: 'Lo abstracto se recuerda anclado a casos concretos variados: uno propio vale más que tres copiados.', how: ['Por definición: 2 ejemplos propios + 1 contraejemplo.', 'Varía contextos.', 'Contrasta por qué el contraejemplo NO es el concepto.'], evidence: 'Generar ejemplos concretos mejora comprensión abstracta.', ref: 'Weinstein & Mayer (1986); Rawson et al. (2015)' } },
  summarize: { name: 'Resumen progresivo', hint: '1 frase por sección · luego todo en 5', color: '#64748B', icon: AlignLeft,
    theory: { what: 'Resumir SIN mirar obliga a seleccionar lo esencial; progresivo = primero por sección, luego fusión global.', how: ['Cierra el material: UNA frase por sección.', 'Fusiona en un total de 5 líneas.', 'Compara y corrige solo lo esencial.'], evidence: 'Ayuda si se genera desde la memoria; copiar no aporta.', ref: 'Dunlosky et al. (2013), PSPI' } },
  rubberDuck: { name: 'Pato de goma', hint: 'Explícale tu proceso a un objeto sin pausas', color: '#F472B6', icon: LI.Bird,
    theory: { what: 'Explicar en voz alta e ininterrumpida obliga a verbalizar supuestos ocultos · clásico de programación y debugging.', how: ['Pon cualquier objeto delante (el pato).', 'Explícale TODO tu razonamiento sin saltos.', 'La solución suele aparecer al verbalizar el supuesto falso.'], evidence: 'verbalización estructurada expone supuestos implícitos.', ref: 'Hunt & Thomas, The Pragmatic Programmer (1999)' } },
} as const;
type ToolCreatorMode = keyof typeof TOOL_CREATOR_META;
const TOOL_MATERIAL_TYPE: Record<ToolCreatorMode, SubjectMaterial['type']> = {
  quizzes: 'quiz', blurting: 'concept', feynman: 'meaning', matching: 'quiz', cloze: 'key-data', categorization: 'concept', mnemonics: 'key-data',
  spacedRep: 'procedure', leitner: 'quiz', interleaving: 'procedure', selfExplain: 'meaning', elaborate: 'concept', dualCoding: 'resource',
  cornell: 'concept', memoryPalace: 'meaning', chunking: 'procedure', retrievalGrid: 'key-data', errorAnalysis: 'key-data', timeline: 'concept',
  mindmap: 'resource', teach: 'procedure', sq3r: 'procedure', concrete: 'concept', summarize: 'concept', rubberDuck: 'procedure',
};

const TOOL_ITEMS = {
  flashcards: { icon: BookOpen, label: 'Flashcards', color: '#8B5CF6', sub: 'Pregunta · Respuesta · Repetición espaciada' },
} as const;
type ToolKey = keyof typeof TOOL_ITEMS;
const TOOL_DEFAULT_ORDER: ToolKey[] = ['flashcards'];

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const REVIEW_LEVEL_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#FBBF24', '#EAB308', '#A3E635', '#84CC16', '#4ADE80', '#22C55E', '#10B981'];

const safeArr = <T,>(arr: T[] | null | undefined): T[] =>
  (Array.isArray(arr) ? arr : []).filter((x): x is T => !!x && typeof x === 'object');

function expandsToDate(s: { date: string; repeat?: 'none' | 'daily' | 'weekly' | 'custom_days'; repeatDays?: number[]; repeatUntil?: string; exceptions?: string[] }, iso: string): boolean {
  if (s.exceptions && s.exceptions.includes(iso)) return false;
  if (s.repeatUntil && s.repeatUntil < iso) return false;
  if (s.date === iso) return true;
  if (iso < s.date) return false;
  if (s.repeat === 'daily') return true;
  if (s.repeat === 'weekly') {
    const orig = new Date(s.date + 'T12:00:00');
    const tgt = new Date(iso + 'T12:00:00');
    return orig.getDay() === tgt.getDay();
  }
  if (s.repeat === 'custom_days' && s.repeatDays) {
    const tgt = new Date(iso + 'T12:00:00');
    const mappedDay = (tgt.getDay() + 6) % 7;
    return s.repeatDays.includes(mappedDay);
  }
  return false;
}

// Texto legible sobre un color de fondo hex: si el color es claro ? negro, si es oscuro ? blanco
function dateContrast(hex: string, th?: string | null): string {
  const h = (hex || '#6366F1').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.72) return 'rgba(0,0,0,0.55)';
  if (lum < 0.28) return 'rgba(255,255,255,0.55)';
  const darkTheme = !th || th === 'oscuro' || th === 'vibrante';
  return darkTheme ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
}

const SPINE_COLORS = [
  "#E11D48", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#D946EF", "#0EA5E9", "#22C55E", "#EAB308",
];

function formatTime(s: number) { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }

// Reuse SPINE_COLORS token in case the user wants the same selection.
// --- Icon Picker Stuff ---
import * as LI from 'lucide-react';
import { openFileSmart, pickAndPersistFile } from '../../lib/openFileSmart';
const AVAILABLE_ICONS: { name: string; icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; label: string }[] = (() => {
  const NAMES = [
    "FileText","BookOpen","Code","Folder","Brain","Target","Coffee","Compass","Award",
    "Briefcase","GraduationCap","Shield","Heart","Lightbulb","Zap","Globe","Feather",
    "Sun","Moon","CloudRain","Mountain","Music","Camera","Eye","Flag","Gift","Anchor",
    "Key","Rocket","Scissors","Watch","Wifi","Activity","Lock","Star","Hash","CheckSquare","Clock","File","Layers","Pin",
    "Search","Plus","Trash2","Download","X","Copy","Move","AlertTriangle","Check","Bold","Italic","Underline","List","Link","Paperclip",
    "Image","Type","Library","Info","AlignJustify","ChevronDown","ChevronLeft","ChevronRight","MoreHorizontal",
    "ListOrdered","Quote","Upload","History","Table","Edit3","FileOutput","Filter","SortAsc","Tag",
    "Maximize2","Minimize2","Palette","ArrowLeft","Unlink","Minus","Strikethrough",
    "AlignLeft","AlignCenter","AlignRight","Eraser","Sigma",
    "Bell","BellRing","Bookmark","BookmarkCheck","Box","BoxSelect","Brush","Bug",
    "Building","Calculator","Calendar","Car","Cast","ChartBar","ChartLine","CheckCircle",
    "ChevronUp","Circle","Clipboard","Clock4","Cloud","CloudSun","Clover","Columns",
    "Command","Construction","Contact","Container","Cookie","CopyCheck","CopyX","CornerDownRight",
    "Cpu","CreditCard","Crop","Cross","Crosshair","Crown","Cube","Database","Delete",
    "Dices","Disc","DiscAlbum","Dock","DollarSign","DoorOpen","Dot","DownloadCloud",
    "Droplet","Drumstick","Earth","Egg","Equal","EqualNot","Euro","Expand","ExternalLink",
    "EyeOff","FaceSmile","Fingerprint","Fish","FishSymbol","Flame","Flashlight","FlaskConical",
    "FlaskRound","Flower","FolderOpen","FolderPlus","FolderTree","Footprints","ForkKnife",
    "FormInput","Forward","Frame","Frown","Fuel","Funnel","GalleryHorizontal","GalleryVertical",
    "Gamepad","GanttChart","Gauge","Gem","Ghost","GiftCard","Glasses","GlobeLock","Grab",
    "Grip","GripHorizontal","GripVertical",
    "Hammer","Hand","HandCoins","HardDrive","HardHat","Headphones","HeartCrack",
    "HeartHandshake","HeartPulse","HelpCircle","Hexagon","Highlighter","Home","Hospital",
    "IceCream","ImageDown","ImageUp","Inbox","Indent","IndianRupee","Infinity","Inspect",
    "Instagram","Ironing","IterationCcw","IterationCw","JapaneseYen","Joystick","Kanban",
    "KeyRound","KeySquare","Keyboard","Landmark","Languages","Laptop","Lasso","LassoSelect",
    "Layers3","LayoutDashboard","LayoutGrid","LayoutList","LayoutPanelLeft","LayoutPanelTop",
    "LayoutTemplate","Leaf","Lectern","LetterText","LifeBuoy","LightbulbOff",
    "LineChart","Link2","Linkedin","ListChecks","ListEnd","ListMinus","ListPlus","ListRestart",
    "ListStart","ListTodo","ListTree","Loader","LoaderCircle","Locate","LocateFixed",
    "LocateOff","LockKeyhole","LogIn","LogOut","Lollipop","Luggage","Magnet","Mail",
    "MailCheck","MailOpen","Map","MapPin","MapPinOff","Martini","Maximize","Medal",
    "Megaphone","Meh","MemoryStick","Menu","MessageCircle","MessageCircleMore",
    "MessageSquare","MessageSquareMore","MessagesSquare","Mic","MicOff","Microscope",
    "Microwave","Milestone","Milk","Minimize","MinusCircle","Monitor","MonitorDot",
    "MonitorDotCog","MonitorDown","MonitorOff","MonitorSmartphone","MonitorUp","MoonStar",
    "MoreVertical","Mouse","MousePointer2","MousePointerClick","Move3d",
    "MoveDiagonal","MoveDown","MoveHorizontal","MoveLeft","MoveRight","MoveUp",
    "MoveVertical","Movie","Music2","Music3","Music4","Navigation","Navigation2","Network",
    "Newspaper","Nfc","Notebook","NotebookPen","NotebookTabs","NotebookText","NotepadText",
    "Nut","NutOff","Octagon","Option","Orbit","Origami","Package","PackageCheck",
    "PackageMinus","PackageOpen","PackagePlus","PackageSearch","PackageX","PaintBucket",
    "PaintRoller","PanelBottom","PanelBottomClose","PanelBottomOpen","PanelLeft",
    "PanelLeftClose","PanelLeftOpen","PanelRight","PanelRightClose","PanelRightOpen",
    "PanelTop","PanelTopClose","PanelTopOpen","PanelsLeftBottom","PanelsRightBottom",
    "PanelsTopLeft","PanelsTopRight","Parentheses","ParkingMeter","PartyPopper",
    "Pause","PcCase","Pen","PenLine","PenOff","PenTool","Pencil","PencilLine","PencilOff",
    "PencilRuler","Percent","PersonStanding","Phone","PhoneCall","PhoneForwarded",
    "PhoneIncoming","PhoneMissed","PhoneOff","PhoneOutgoing","Pi","Piano","Pickaxe",
    "PictureInPicture","PieChart","PiggyBank","Pilcrow","Pill","PillBottle","PinOff",
    "Pipette","Pizza","Plane","Plant","Play","Plug","Plug2","PlugZap","PlusCircle",
    "PlusSquare","Pocket","PocketKnife","Podcast","Pointer","Popcorn","Popsicle",
    "Power","PowerOff","Presentation","Printer","Projector","Puzzle","QrCode",
    "Radar","Radiation","Radio","RadioReceiver","Rainbow","Rat","Receipt","ReceiptCent",
    "ReceiptEuro","ReceiptIndian","ReceiptJapaneseYen","ReceiptPound","ReceiptRussianRuble",
    "ReceiptSterling","ReceiptSwissFranc","ReceiptText","RectangleEllipsis",
    "RectangleHorizontal","RectangleVertical","Recycle","Redo","RefreshCcw","RefreshCw",
    "Refrigerator","Regex","Repeat","Repeat1","Repeat2","Replace","ReplaceAll","Reply",
    "ReplyAll","Rewind","Ribbon","RockingChair","RollerCoaster","Rotate3d",
    "RotateCcw","RotateCw","Route","Router","Rows","Rows2","Rows4","Rss","Ruler",
    "RussianRuble","Sailboat","Salad","Sandwich","Satellite","SatelliteDish","Save",
    "SaveAll","Scale","Scale3d","Scaling","Scan","ScanFace","ScanLine","ScanSearch",
    "ScanText","School","School2","Scroll","ScrollText",
    "SearchCheck","SearchCode","SearchSlash","SearchX","Section",
    "Send","SendHorizonal","SendToBack","SeparatorHorizontal","SeparatorVertical",
    "Server","ServerCog","ServerCrash","ServerOff","Settings","Settings2","Share",
    "Share2","Sheet","Shell","ShieldAlert","ShieldBan","ShieldCheck","ShieldClose",
    "ShieldEllipsis","ShieldHalf","ShieldMinus","ShieldOff","ShieldPlus","ShieldQuestion",
    "ShieldX","Ship","Shirt","ShoppingBag","ShoppingBasket","ShoppingCart","Shovel",
    "ShowerHead","Shrink","Shrub","Shuffle","Sidebar","SidebarClose","SidebarOpen",
    "Signal","SignalHigh","SignalLow","SignalMedium","SignalZero","Signpost",
    "SignpostBig","Siren","SkipBack","SkipForward","Skull","Slash","Slice","SlidersHorizontal",
    "SlidersVertical","Smartphone","SmartphoneCharging","Smile","SmilePlus","Snail",
    "Snowflake","Sofa","SortAsc","SortDesc","Sparkle","Sparkles","Speaker","Speech",
    "SpellCheck","Spider","Split","SplitSquareHorizontal","SplitSquareVertical","SprayCan",
    "Sprout","Square","SquareActivity","SquareArrowOutUpRight","SquareCheckBig",
    "SquareCode","SquareDashed","SquareDashedKanban","SquareDashedMousePointer",
    "SquareFunction","SquareGanttChart","SquareLibrary","SquareM","SquareMenu",
    "SquareMinus","SquareMousePointer","SquareParking","SquareParkingOff","SquarePen",
    "SquarePercent","SquarePi","SquarePilcrow","SquarePlay","SquarePlus","SquarePower",
    "SquareRadical","SquareScissors","SquareSigma","SquareSlash","SquareSplitHorizontal",
    "SquareSplitVertical","SquareSquare","SquareStack","SquareTerminal","SquareUser",
    "SquareUserRound","SquareX","Squircle","Squirrel","Stamp","StarHalf","StarOff",
    "Stars","StepBack","StepForward","Stethoscope","Sticker","StickyNote","StopCircle",
    "Store","StretchHorizontal","StretchVertical","Subscript","Subtitles",
    "SunDim","SunMedium","SunMoon","SunSnow","Sunrise","Sunset","Superscript","SwatchBook",
    "SwissFranc","SwitchCamera","Sword","Swords","Syringe","Table","Table2","Tablets",
    "TableOfContents","Tally1","Tally2","Tally3","Tally4","Tally5","Tangent",
    "Tent","Terminal","TestTube","TestTubeDiagonal","TestTubes","Text","TextCursor",
    "TextCursorInput","TextQuote","TextSearch","TextSelect","TextSelection","Theater",
    "Thermometer","ThermometerSnowflake","ThermometerSun","ThumbsDown","ThumbsUp",
    "Ticket","TicketCheck","TicketMinus","TicketPercent","TicketPlus","TicketSlash","Timer",
    "TimerOff","TimerReset","ToggleLeft","ToggleRight","Tornado","Torus","Touchpad",
    "TouchpadOff","TowerControl","ToyBrick","Train","TrainTrack","TramFront",
    "TreeDeciduous","TreePalm","TreePine","Trees","Trello","TrendingDown",
    "TrendingUp","Triangle","TriangleAlert","TriangleRight","Trophy","Truck","Turtle",
    "Tv","TvMinimal","TvMinimalPlay","Twitch","Twitter","Umbrella","UnfoldHorizontal",
    "UnfoldVertical","Ungroup","University","Unlink","Unplug","Upload","Usb",
    "UserCheck","UserCog","UserMinus","UserPlus","UserRound","UserRoundCheck","UserRoundCog",
    "UserRoundMinus","UserRoundPlus","UserRoundSearch","UserRoundX","UserSearch",
    "Users","UsersRound","Utensils","UtensilsCrossed","UtilityPole","Variable","Vault",
    "Vegan","VenetianMask","Verified","Vibrate","VibrateOff","Video","VideoOff",
    "Videotape","View","Voicemail","Volleyball","Volume","Volume1","Volume2","VolumeOff",
    "VolumeX","Vote","Wallet","WalletCards","WalletMinimal","Wallpaper","Wand","WandSparkles",
    "Warehouse","WashingMachine","Waves","Waypoints","Webcam","Webhook","Weight",
    "Wheat","WheatOff","WholeWord","WifiHigh","WifiLow","WifiOff","WifiZero",
    "Wind","Wine","WineOff","Workflow","Worm","WrapText","Wrench","X","XClose","XOctagon",
    "Youtube","ZapOff","ZoomIn","ZoomOut",
  ];
  const seen = new Set<string>();
  const result: { name: string; icon: any; label: string }[] = [];
  for (const name of NAMES) {
    if (seen.has(name)) continue;
    seen.add(name);
    const icon = (LI as any)[name];
    if (typeof icon === 'function') {
      result.push({
        name,
        icon,
        label: name.replace(/([A-Z])/g, ' $1').replace(/\d/g, '').trim().slice(0, 14) || name,
      });
    }
  }
  return result;
})();

function NoteIconRenderer({ iconName, color, size = 16 }: { iconName?: string; color: string; size?: number }) {
  const IconComponent = (() => {
    const item = AVAILABLE_ICONS.find(i => i.name === iconName);
    return item ? item.icon : null;
  })();
  if (!IconComponent) return null;
  return <IconComponent size={size} style={{ color }} />;
}

function IconPicker({ currentIcon, currentColor, noteTitle, onSelect, onClose }:
  { currentIcon?: string; currentColor?: string; noteTitle?: string; onSelect: (iconName: string, colorHex: string) => void; onClose: () => void }) {
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || "FileText");
  const [selectedColor, setSelectedColor] = useState(currentColor || "#E11D48");
  const [view, setView] = useState<'grid' | 'preview'>('grid');

  const IconForName = useCallback((name: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === name);
    return found ? found.icon : LI.FileText;
  }, []);

  const SelIcon = IconForName(selectedIcon);

  return (
    <div style={{
      width: 420, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
      borderRadius: 14, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    }} onClick={e => e.stopPropagation()}>
      {view === 'grid' ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Seleccionar Icono</span>
            <button data-ui-control="" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}><LI.X size={13} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {SPINE_COLORS.slice(0, 10).map(c => (
              <button data-ui-control="" key={c} onClick={() => setSelectedColor(c)}
                style={{ width: 20, height: 20, borderRadius: "50%", border: selectedColor === c ? `2px solid ${c}` : "1px solid " + c + "40", background: selectedColor === c ? c : c + "20", cursor: "pointer", transition: "all 120ms", transform: selectedColor === c ? "scale(1.2)" : "none" }} />
            ))}
            <div style={{ flex: 1 }} />
            <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
              style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid var(--border-subtle)", padding: 0, cursor: "pointer", background: "none" }} />
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, borderTop: "1px solid var(--border-default)", paddingTop: 10 }}>
            {AVAILABLE_ICONS.map(i => {
              const Icon = i.icon;
              const isSel = selectedIcon === i.name;
              return (
                <button data-ui-control="" key={i.name} onClick={() => { setSelectedIcon(i.name); setView('preview'); }} title={i.label}
                  style={{ height: 36, borderRadius: 6, border: `1px solid ${isSel ? selectedColor : "var(--border-default)"}`, background: isSel ? selectedColor + "16" : "transparent", color: isSel ? selectedColor : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" }}>
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button data-ui-control="" onClick={() => setView('grid')} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LI.ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vista Previa</span>
            <div style={{ flex: 1 }} />
            <button data-ui-control="" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}><LI.X size={13} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${selectedColor}25`, transition: "all 200ms" }}>
              <SelIcon size={42} style={{ color: selectedColor }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{noteTitle || "Sin título"}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}</div>
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {SPINE_COLORS.map(c => (
              <button data-ui-control="" key={c} onClick={() => setSelectedColor(c)}
                style={{ width: 22, height: 22, borderRadius: "50%", border: selectedColor === c ? `2px solid ${c}` : "1px solid " + c + "30", background: c, cursor: "pointer", transition: "all 120ms", transform: selectedColor === c ? "scale(1.15)" : "none", boxShadow: selectedColor === c ? `0 0 8px ${c}60` : "none" }} />
            ))}
            <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--border-subtle)", padding: 0, cursor: "pointer", background: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button data-ui-control="" onClick={() => setView('grid')} style={{ flex: 1, height: 34, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Atrás</button>
            <button data-ui-control="" onClick={() => { onSelect(selectedIcon, selectedColor); onClose(); }} style={{ flex: 1, height: 34, borderRadius: 8, border: "none", background: selectedColor, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Seleccionar</button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Subcomponents ---
function DroppableColumn({ id, items, children }: { id: string; items: SubjectMaterial[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items.map(m => m.id)} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, padding: 8, borderRadius: 8, border: `1px dashed ${isOver ? 'var(--accent)' : 'transparent'}`, background: isOver ? 'var(--accent)06' : 'transparent', transition: 'all 200ms ' + EASE }}>{children}</div>
    </SortableContext>
  );
}

function SortableWrapper({ id, children, style }: { id: string; style?: React.CSSProperties; children: (p: { attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.5 : 1, position: 'relative' as const, ...style }}>{children({ attributes, listeners, isDragging })}</div>;
}

// Iconos elegibles para enlaces (solo links): 'auto' = el original detectado.
const LINK_ICON_CHOICES = [
  { id: 'auto', label: 'Original', Icon: LI.Sparkles },
  { id: 'link', label: 'Enlace', Icon: LI.Link2 },
  { id: 'globe', label: 'Web', Icon: LI.Globe },
  { id: 'bookmark', label: 'Marcador', Icon: LI.Bookmark },
  { id: 'star', label: 'Destacado', Icon: LI.Star },
  { id: 'play', label: 'Video', Icon: LI.Play },
  { id: 'music', label: 'Música', Icon: LI.Music },
  { id: 'doc', label: 'Documento', Icon: LI.FileText },
  { id: 'news', label: 'Noticia', Icon: LI.Newspaper },
  { id: 'study', label: 'Estudio', Icon: LI.GraduationCap },
];
function renderLinkChoiceIcon(iconId: string | undefined, size: number, color: string) {
  const found = LINK_ICON_CHOICES.find(c => c.id === iconId);
  if (!found || found.id === 'auto') return null;
  const Cmp = found.Icon;
  return <Cmp size={size} style={{ color, display: 'block', flexShrink: 0 }} />;
}

function MaterialCard({ mat, dragAttributes, dragListeners, onEdit, onDelete, onOpenResource, onPractice, onView, clickSuppressed, onContextMenu, groupName, onUngroup, onPickIcon, selected }: {
  mat: SubjectMaterial; dragAttributes?: any; dragListeners?: any; onEdit: (m: SubjectMaterial) => void; onDelete: (m: SubjectMaterial) => void; onOpenResource: (m: SubjectMaterial) => void; onPractice?: (m: SubjectMaterial) => void; onView?: (m: SubjectMaterial) => void; clickSuppressed?: () => boolean; onContextMenu?: (e: React.MouseEvent, m: SubjectMaterial) => void; groupName?: string; onUngroup?: () => void; onPickIcon?: (m: SubjectMaterial, x: number, y: number) => void; selected?: boolean; }) {
  const meta = MATERIAL_META[mat.type];
  const typeColors: Record<string, string> = { formula: '#8B5CF6', concept: '#3B82F6', 'key-data': '#F59E0B', meaning: '#10B981', quiz: '#EF4444', procedure: '#EC4899', resource: '#6366F1' };
  const toolMeta = mat.toolMode ? TOOL_CREATOR_META[mat.toolMode as ToolCreatorMode] : undefined;
  // Nodos de herramienta especializados (Flashcards / Prueba / Emparejar)
  const deckMeta = mat.toolMode ? (DECK_META as any)[mat.toolMode] as { icon: any; label: string; color: string } | undefined : undefined;
  // Detección de TIPO REAL del recurso (idéntica a Materiales de curso)
  const _url = mat.dataUrl || '';
  const _nm = (mat.name || '').toLowerCase();
  const _ext = _nm.split('.').pop() || '';
  const _lk = /^https?:\/\//i.test(_url);
  const _isYT = _lk && (_url.includes('youtube.com') || _url.includes('youtu.be'));
  const _isDrive = _lk && _url.includes('drive.google.com');
  const _isClassroom = _lk && _url.includes('classroom.google.com');
  const _isGDocs = _lk && _url.includes('docs.google.com');
  const _isGSheets = _lk && _url.includes('sheets.google.com');
  const _isGSlides = _lk && _url.includes('slides.google.com');
  const _isGForms = _lk && _url.includes('forms.google.com');
  const _isPdf = _ext === 'pdf' || _url.startsWith('data:application/pdf');
  const _isDoc = ['doc', 'docx'].includes(_ext);
  const _isXls = ['xls', 'xlsx', 'csv'].includes(_ext);
  const _isPpt = ['ppt', 'pptx'].includes(_ext);
  const _isAud = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(_ext) || _url.startsWith('data:audio');
  const _isVid = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(_ext) || _url.startsWith('data:video');
  const _isImgE = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(_ext) || _url.startsWith('data:image');
  const _isWeb = _lk && !_isYT && !_isDrive && !_isClassroom && !_isGDocs && !_isGSheets && !_isGSlides && !_isGForms;
  let Icon: any = deckMeta ? deckMeta.icon : toolMeta ? toolMeta.icon : meta.icon;
  let accent: string = (mat as any).color || deckMeta?.color || toolMeta?.color || typeColors[mat.type] || 'var(--accent)';
  // Icono personalizado del enlace (persistente en el material; 'auto' = detectado)
  const customLinkIcon = mat.type === 'resource' && (mat as any).icon && (mat as any).icon !== 'auto';
  let cardLabel = deckMeta?.label || toolMeta?.name || meta.label;
  if (!toolMeta && mat.type === 'resource') {
    if (_isYT) { Icon = (p: any) => (<svg viewBox="0 0 24 24" width={p.size || 17} height={p.size || 17} fill="#EF4444" style={{ display: 'block', flexShrink: 0 }}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>); accent = '#EF4444'; cardLabel = 'YouTube'; }
    else if (_isPdf) { Icon = (p: any) => (<svg viewBox="0 0 24 24" width={p.size || 17} height={p.size || 17} fill="#EF4444" style={{ display: 'block', flexShrink: 0 }}><path d="M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704z"/></svg>); accent = '#EF4444'; cardLabel = 'PDF'; }
    else if (_isDoc) { Icon = WordIcon; accent = '#2563EB'; cardLabel = 'Word'; }
    else if (_isGDocs) { Icon = GoogleDocsIcon; accent = '#2563EB'; cardLabel = 'Docs'; }
    else if (_isXls) { Icon = ExcelIcon; accent = '#10B981'; cardLabel = 'Excel'; }
    else if (_isGSheets) { Icon = GoogleSheetsIcon; accent = '#10B981'; cardLabel = 'Sheets'; }
    else if (_isPpt) { Icon = PowerPointIcon; accent = '#F97316'; cardLabel = 'PowerPoint'; }
    else if (_isGSlides) { Icon = GoogleSlidesIcon; accent = '#F97316'; cardLabel = 'Slides'; }
    else if (_isGForms) { Icon = GoogleFormsIcon; accent = '#7C3AED'; cardLabel = 'Forms'; }
    else if (_isDrive) { Icon = GoogleDriveIcon; accent = '#4285F4'; cardLabel = 'Drive'; }
    else if (_isClassroom) { Icon = GoogleClassroomIcon; accent = '#0F9D58'; cardLabel = 'Classroom'; }
    else if (_isAud) { Icon = Music; accent = '#8B5CF6'; cardLabel = 'Audio'; }
    else if (_isVid) { Icon = LI.Film; accent = '#EC4899'; cardLabel = 'Video'; }
    else if (_isImgE) { Icon = ImageIcon; accent = '#F59E0B'; cardLabel = 'Imagen'; }
    else if (_isWeb) {
      const _dom = (() => { try { return new URL(_url).hostname; } catch { return ''; } })();
      Icon = (p: any) => (<span style={{ position: 'relative', width: p.size || 17, height: p.size || 17, display: 'inline-flex', flexShrink: 0 }}>
        <img src={`https://www.google.com/s2/favicons?domain=${_dom}&sz=32`} alt="" style={{ width: '100%', height: '100%', borderRadius: 3, position: 'absolute', inset: 0 }}
          onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.lk-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
        <span className="lk-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><Link2 size={12} /></span>
      </span>);
      accent = '#10B981'; cardLabel = 'Sitio web';
    }
    else if (_url && !_lk) { Icon = File; accent = '#64748B'; cardLabel = 'Archivo'; }
  }
  // El color personalizado (clic derecho → Color para todas…) SIEMPRE gana:
  // la detección de tipo de arriba solo fija el color cuando no hay uno elegido.
  if ((mat as any).color) accent = (mat as any).color;
  const title = mat.name || mat.title || mat.word || mat.question || 'Sin título';
  const practice = (deckMeta || toolMeta) && onPractice;
  const canOpen = !!mat.dataUrl && !practice;
  return (
    <div {...dragAttributes} {...(dragListeners ? { ...dragListeners, onPointerDown: (e: React.PointerEvent) => { if (e.button !== 0) return; (dragListeners as any).onPointerDown?.(e); } } : {})}
      className={selected ? 'owa-mat-selected' : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, mat) : undefined}
      title={practice ? 'mantén pulsado para arrastrar · Toca para practicar' : canOpen ? 'mantén pulsado para arrastrar · Toca para abrir' : 'mantén pulsado para arrastrar'}
      onClick={practice ? () => onPractice(mat) : canOpen ? () => { if (clickSuppressed && clickSuppressed()) return; onOpenResource(mat); } : () => { if (clickSuppressed && clickSuppressed()) return; onView?.(mat); }}
      style={{ display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', transition: 'all 200ms ' + EASE, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', minHeight: 118, touchAction: 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}50`; e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.boxShadow = `0 8px 24px ${accent}12`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 8px' }}>
        <div
          onPointerDown={e => e.stopPropagation()}
          onClick={_lk && onPickIcon ? (e) => { e.stopPropagation(); if (clickSuppressed && clickSuppressed()) return; onPickIcon(mat, e.clientX, e.clientY); } : undefined}
          title={_lk ? 'Cambiar icono del enlace' : undefined}
          style={{ width: 38, height: 38, borderRadius: 11, background: `${accent}10`, border: `1px solid ${accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: _lk && onPickIcon ? 'pointer' : undefined }}
        >
          {customLinkIcon ? renderLinkChoiceIcon((mat as any).icon, 17, accent) : <Icon size={17} style={{ color: accent }} />}
        </div>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, fontFamily: "'Inter Tight', sans-serif" }}>{cardLabel}</span>
        {(practice || _lk) && (
          <button data-ui-control="" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(mat); }} title="Editar"
            style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${accent}14`; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}><Edit3 size={11} /></button>
        )}
        {(mat as any).groupName && onUngroup && (
          <button data-ui-control="" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onUngroup(); }} title="Sacar al tema principal"
            style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#F59E0B', opacity: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(245,158,11,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.background = 'transparent'; }}><LI.FolderMinus size={11} /></button>
        )}
        <button data-ui-control="" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(mat); }} title="Eliminar"
          style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#EF444414'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.55)'; }}><Trash2 size={11} /></button>
      </div>
      <div style={{ flex: 1, padding: '0 14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.35, fontFamily: "'Inter Tight', sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>
        {practice ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <Play size={9} /> Practicar
          </div>
        ) : mat.type === 'resource' ? null : null}
      </div>
    </div>
  );
}

// --- Tool row (Herramientas panel) · long-press to reorder ---
// Tarjeta de carpeta arrastrable-destino (drop de materiales dentro de ella)
function FolderTile({ g, color, onOpen, onRename, onDelete }: { g: string; color: string; count?: number; onOpen: () => void; onRename: () => void; onDelete: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'grp-' + g });
  const [hovered, setHovered] = useState(false);
  const folderName = g.split('/').pop() || g;
  return (
    <div ref={setNodeRef} onClick={onOpen} title="Abrir grupo / carpeta · arrastra materiales aquí"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 108, borderRadius: 14, position: 'relative',
        border: isOver ? `1.5px solid ${color}` : `1px solid var(--border-subtle)`,
        background: isOver ? `color-mix(in srgb, ${color} 10%, var(--bg-elevated))` : 'var(--bg-elevated)',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '16px 16px 14px',
        justifyContent: 'space-between', transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
        transform: hovered && !isOver ? 'translateY(-2px)' : 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FolderOpen size={19} style={{ color, opacity: isOver ? 1 : 0.9 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, opacity: hovered ? 1 : 0, transition: 'opacity 180ms ease' }}>
          <button data-ui-control="" onClick={(e) => { e.stopPropagation(); onRename(); }} title="Editar nombre del grupo"
            style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
            <Pencil size={12} />
          </button>
          <button data-ui-control="" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Eliminar grupo"
            style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(239,68,68,0.12)', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div style={{ marginTop: 12, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {folderName}
        </div>
      </div>
    </div>
  );
}
const courseColorSafe = (c: string) => c;

// --- Per-tool practice overlay (each tool has its own review flow) ---
const shuffleArr = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const normWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/gi, '');
const normalizePhrase = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const parseCloze = (text: string): { text: string; answer?: string }[] => {
  const parts: { text: string; answer?: string }[] = [];
  const re = /\[___:?([^\]]*)\]/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: '', answer: (m[1] || '').trim() });
    last = m.index + m[0].length;
  }
  parts.push({ text: text.slice(last) });
  return parts;
};

function ToolPracticeModal({ mat, topicMaterials, onClose }: { mat: SubjectMaterial; topicMaterials: SubjectMaterial[]; onClose: () => void }) {
  const mode = (mat.toolMode && TOOL_CREATOR_META[mat.toolMode as ToolCreatorMode]) ? mat.toolMode as ToolCreatorMode : 'quizzes';
  const meta = TOOL_CREATOR_META[mode];
  const ToolIcon = meta.icon;
  const accent = meta.color;

  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizChecked, setQuizChecked] = useState(false);
  const [catText, setCatText] = useState('');
  const [catResult, setCatResult] = useState<{ recalled: number; total: number; list: { el: string; hit: boolean }[] } | null>(null);
  const [clozeChecked, setClozeChecked] = useState(false);

  const clozeParts = parseCloze(mat.content || '');
  const gapParts = clozeParts.filter(p => p.answer !== undefined);
  const [gaps, setGaps] = useState<string[]>(() => gapParts.map(() => ''));

  const pairs = topicMaterials.filter(m => m.toolMode === 'matching' && m.question && m.answer).map(m => ({ q: m.question!, a: m.answer! }));
  const [rightOrder, setRightOrder] = useState<number[]>(() => shuffleArr(pairs.map((_, i) => i)));
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [fails, setFails] = useState(0);

  const words = (mat.content || '').split(/\s+/).filter(Boolean);
  const [mneWords, setMneWords] = useState<{ w: string }[]>(() => shuffleArr(words).map(w => ({ w })));
  const [mneAnswer, setMneAnswer] = useState<number[]>([]);
  const [mneChecked, setMneChecked] = useState(false);

  const resetMatching = () => { setRightOrder(shuffleArr(pairs.map((_, i) => i))); setSelL(null); setSelR(null); setMatched([]); setFails(0); };
  const attemptMatch = () => {
    if (selL === null || selR === null) return;
    if (selL === rightOrder[selR]) { setMatched(m => m.includes(selL) ? m : [...m, selL]); setSelL(null); setSelR(null); }
    else setFails(f => f + 1);
  };
  const resetMne = () => { setMneWords(shuffleArr(words).map(w => ({ w }))); setMneAnswer([]); setMneChecked(false); };

  const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif" };
  const ghostBtn: React.CSSProperties = { ...btnBase, background: 'transparent', color: accent, border: `1px solid ${accent}40` };

  const origText = mode === 'feynman' ? (mat.meaning || '') : (mat.content || '');
  const origWords = origText.split(/\s+/).filter(Boolean);
  const userSet = new Set(text.toLowerCase().split(/\s+/).map(normWord));
  const recCount = origWords.filter(w => userSet.has(normWord(w))).length;

  const wrap = (children: React.ReactNode) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2003, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bento-card" style={{ width: 560, padding: 0, borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxHeight: '86vh', overflowY: 'auto', boxShadow: `0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px ${accent}08`, animation: 'fadeInScale 220ms cubic-bezier(0.16,1,0.3,1)' }} onClick={e => e.stopPropagation()}>
        {/* Header strip */}
        <div style={{ height: 4, borderRadius: '18px 18px 0 0', background: `linear-gradient(90deg, ${accent}, ${accent}60)` }} />
        <div style={{ padding: '20px 26px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ width: 42, height: 42, borderRadius: 13, background: `${accent}10`, border: `1.5px solid ${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ToolIcon size={18} style={{ color: accent }} />
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-primary)', lineHeight: 1.25 }}>{mat.title || meta.name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, marginTop: 3, fontFamily: "'Inter Tight', sans-serif" }}>{meta.name}</div>
              </div>
            </div>
            <button data-ui-control="" onClick={onClose} title="Cerrar" style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF444455'; e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}><X size={14} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  // --- Quiz ---
  if (mode === 'quizzes') {
    const q = mat.question || '';
    const a = mat.answer || '';
    const correct = quizChecked && normalizePhrase(quizAnswer) === normalizePhrase(a);
    return wrap(
      <>
        <div style={{ borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '22px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, marginBottom: 10, fontFamily: "'Inter Tight', sans-serif" }}>Pregunta</div>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{q}</div>
        </div>
        {!quizChecked ? (
          <>
            <textarea value={quizAnswer} onChange={e => setQuizAnswer(e.target.value)} placeholder="Escribe tu respuesta…" autoFocus
              style={{ width: '100%', minHeight: 90, padding: 14, borderRadius: 12, fontSize: 13.5, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.55 }} />
            <button data-ui-control="" onClick={() => setQuizChecked(true)} disabled={!quizAnswer.trim()} style={{ ...btnBase, width: '100%', height: 40, borderRadius: 11, marginTop: 14, fontSize: 12.5, opacity: !quizAnswer.trim() ? 0.4 : 1 }}>Comprobar respuesta</button>
          </>
        ) : (
          <div style={{ borderRadius: 14, border: `1px solid ${correct ? '#10B98135' : '#EF444435'}`, background: correct ? '#10B9810a' : '#EF44440a', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 700, color: correct ? '#10B981' : '#EF4444', fontFamily: "'Inter Tight', sans-serif" }}>
              {correct ? <Check size={16} /> : <X size={16} />}{correct ? '¡Correcto!' : 'No coincide'}
            </div>
            {quizAnswer.trim() && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.04)' }}><span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Tu respuesta: </span>{quizAnswer.trim()}</div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${accent}08`, border: `1px solid ${accent}15` }}>
              <span style={{ color: accent, fontWeight: 600 }}>Respuesta correcta: </span>{a}
            </div>
            <button data-ui-control="" onClick={() => { setQuizAnswer(''); setQuizChecked(false); }} style={{ ...ghostBtn, marginTop: 14, width: '100%', height: 36, borderRadius: 10 }}>Practicar otra vez</button>
          </div>
        )}
      </>
    );
  }

  // --- Matching ---
  if (mode === 'matching') {
    if (pairs.length === 0) {
      return wrap(
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Aún no hay pares para practicar</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>Crea al menos una tarjeta de Matching y vuelve aquí.</div>
          <button data-ui-control="" onClick={onClose} style={{ ...ghostBtn, margin: '18px auto 0' }}>Entendido</button>
        </div>
      );
    }
    const allMatched = matched.length === pairs.length;
    return wrap(
      <>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>Pulsa un elemento de cada columna y después <b style={{ color: 'var(--text-secondary)' }}>Comprobar pareja</b>.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pairs.map((p, i) => {
              const done = matched.includes(i);
              const sel = selL === i;
              return (
                <button data-ui-control="" key={i} disabled={done} onClick={() => setSelL(i)}
                  style={{ textAlign: 'left', minHeight: 40, padding: '8px 10px', borderRadius: 9, border: `1px solid ${done ? '#10B98140' : sel ? `${accent}55` : 'var(--border-soft)'}`, background: done ? '#10B9810d' : sel ? `${accent}0e` : 'var(--bg-deep)', color: done ? '#10B981' : 'var(--text-primary)', fontSize: 11.5, fontWeight: 500, cursor: done ? 'default' : 'pointer', lineHeight: 1.4, transition: 'all 120ms', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {done && <Check size={11} style={{ flexShrink: 0 }} />}
                  <span style={{ opacity: done ? 0.75 : 1 }}>{p.q}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rightOrder.map((pairIdx, j) => {
              const done = matched.includes(pairIdx);
              const sel = selR === j;
              const wrongSel = sel && selL !== null && selL !== pairIdx;
              const borderColor = done ? '#10B98140' : wrongSel ? '#EF444450' : sel ? `${accent}55` : 'var(--border-soft)';
              const bg = done ? '#10B9810d' : wrongSel ? '#EF44440e' : sel ? `${accent}0e` : 'var(--bg-deep)';
              const color = done ? '#10B981' : wrongSel ? '#EF4444' : 'var(--text-primary)';
              return (
                <button data-ui-control="" key={j} disabled={done} onClick={() => setSelR(j)}
                  style={{ textAlign: 'left', minHeight: 40, padding: '8px 10px', borderRadius: 9, border: `1px solid ${borderColor}`, background: bg, color, fontSize: 11.5, fontWeight: 500, cursor: done ? 'default' : 'pointer', lineHeight: 1.4, transition: 'all 120ms', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {done && <Check size={11} style={{ flexShrink: 0 }} />}
                  <span style={{ opacity: done ? 0.75 : 1 }}>{pairs[pairIdx].a}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{matched.length}/{pairs.length} conectados{fails > 0 ? ` · ${fails} ${fails === 1 ? 'fallo' : 'fallos'}` : ''}</span>
          {allMatched ? (
            <button data-ui-control="" onClick={resetMatching} style={ghostBtn}>Repetir</button>
          ) : (
            <button data-ui-control="" onClick={attemptMatch} disabled={selL === null || selR === null} style={{ ...btnBase, opacity: selL === null || selR === null ? 0.4 : 1 }}>Comprobar pareja</button>
          )}
        </div>
      </>
    );
  }

  // --- Blurting / Feynman ---
  if (mode === 'blurting' || mode === 'feynman') {
    const isFey = mode === 'feynman';
    const missing = origWords.filter(w => !userSet.has(normWord(w)));
    return wrap(
      <>
        {isFey && (
          <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '14px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Concepto</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{mat.word || mat.title}</div>
          </div>
        )}
        {!revealed ? (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 10 }}>{isFey ? 'Explícalo con tus palabras, como si tu interlocutor tuviera 10 años.' : 'Escribe todo lo que recuerdes sin mirar tus apuntes.'}</div>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={isFey ? 'Explica el concepto…' : 'Escribe aquí todo lo que recuerdas…'} autoFocus
              style={{ width: '100%', minHeight: 200, padding: 12, borderRadius: 10, fontSize: 13, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{text.trim().split(/\s+/).filter(Boolean).length} palabras</span>
              <button data-ui-control="" onClick={() => setRevealed(true)} disabled={!text.trim()} style={{ ...btnBase, opacity: !text.trim() ? 0.4 : 1 }}>{isFey ? 'Revelar modelo' : 'Revelar original'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 10 }}>
              Comparado con tu texto: <b style={{ color: '#10B981' }}>{recCount}</b> de <b style={{ color: 'var(--text-secondary)' }}>{origWords.length}</b> palabras.
              {missing.length > 0 && <span style={{ display: 'block', marginTop: 4 }}>Faltan: <span style={{ color: '#EF4444' }}>{missing.slice(0, 10).join(', ')}{missing.length > 10 ? '…' : ''}</span></span>}
            </div>
            <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '16px 18px', fontSize: 13, lineHeight: 1.9, color: 'var(--text-primary)' }}>
              {origWords.map((w, i) => {
                const hit = userSet.has(normWord(w));
                return <span key={i} style={{ color: hit ? '#10B981' : '#EF4444', textDecoration: hit ? 'none' : 'line-through', opacity: hit ? 1 : 0.85 }}>{w} </span>;
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button data-ui-control="" onClick={() => { setText(''); setRevealed(false); }} style={ghostBtn}>Volver a intentar</button>
            </div>
          </>
        )}
      </>
    );
  }

  // --- Cloze ---
  if (mode === 'cloze') {
    let gi = 0;
    const correctGaps = clozeChecked ? gapParts.filter((p, i) => p.answer ? normalizePhrase(gaps[i]) === normalizePhrase(p.answer) : gaps[i].trim().length > 0).length : 0;
    return wrap(
      <>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 12 }}>Completa los huecos. Al comprobar, los correctos se marcan en verde.</div>
        <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '16px 18px', fontSize: 13.5, lineHeight: 2.1, color: 'var(--text-primary)' }}>
          {clozeParts.map((p, i) => {
            if (p.answer === undefined) return <span key={i}>{p.text}</span>;
            const idx = gi++;
            const val = gaps[idx];
            const isCorrect = clozeChecked && (p.answer ? normalizePhrase(val) === normalizePhrase(p.answer) : val.trim().length > 0);
            const isWrong = clozeChecked && !isCorrect;
            return (
              <input key={i} value={val} disabled={clozeChecked} onChange={e => { const next = [...gaps]; next[idx] = e.target.value; setGaps(next); }}
                placeholder="…"
                style={{ width: Math.min(180, Math.max(70, (p.answer?.length || 6) * 9)), height: 30, margin: '0 4px', padding: '0 9px', borderRadius: 7, fontSize: 12.5, border: `1px solid ${isCorrect ? '#10B98160' : isWrong ? '#EF444460' : 'var(--border-soft)'}`, background: isCorrect ? '#10B9810d' : isWrong ? '#EF44440d' : 'var(--bg-deep)', color: isCorrect ? '#10B981' : isWrong ? '#EF4444' : 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', textAlign: 'center', fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {clozeChecked ? `${correctGaps}/${gapParts.length} huecos correctos` : `${gaps.filter(g => g.trim()).length}/${gapParts.length} completados`}
          </span>
          {clozeChecked ? (
            <button data-ui-control="" onClick={() => { setClozeChecked(false); setGaps(gapParts.map(() => '')); }} style={ghostBtn}>Reiniciar</button>
          ) : (
            <button data-ui-control="" onClick={() => setClozeChecked(true)} disabled={gaps.some(g => !g.trim())} style={{ ...btnBase, opacity: gaps.some(g => !g.trim()) ? 0.4 : 1 }}>Comprobar</button>
          )}
        </div>
      </>
    );
  }

  // --- Categorización ---
  if (mode === 'categorization') {
    const items = (mat.content || '').split('\n').map(s => s.trim()).filter(Boolean);
    const count = catText.trim().split(/\s+/).filter(Boolean).length;
    return wrap(
      <>
        {!catResult ? (
          <>
            <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '14px 18px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>categoría</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{mat.title || 'Sin título'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{items.length} {items.length === 1 ? 'elemento' : 'elementos'} guardados</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 10 }}>Escribe de memoria todos los elementos de la categoría (uno por línea).</div>
            <textarea value={catText} onChange={e => setCatText(e.target.value)} placeholder={'Perro\nGato\n…'} autoFocus
              style={{ width: '100%', minHeight: 160, padding: 12, borderRadius: 10, fontSize: 13, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{count} {count === 1 ? 'palabra' : 'palabras'}</span>
              <button data-ui-control="" onClick={() => {
                const t = catText.toLowerCase();
                const list = items.map(el => ({ el, hit: t.includes(el.toLowerCase()) }));
                setCatResult({ recalled: list.filter(x => x.hit).length, total: items.length, list });
              }} disabled={!catText.trim()} style={{ ...btnBase, opacity: !catText.trim() ? 0.4 : 1 }}>Recordar</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", color: catResult.recalled === catResult.total ? '#10B981' : '#F59E0B' }}>
              <Check size={14} /> Recordaste {catResult.recalled} de {catResult.total} {catResult.total === 1 ? 'elemento' : 'elementos'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {catResult.list.map((x, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: x.hit ? '#10B981' : '#EF4444', padding: '8px 12px', borderRadius: 8, background: x.hit ? '#10B9810a' : '#EF44440a', border: `1px solid ${x.hit ? '#10B98122' : '#EF444422'}` }}>
                  {x.hit ? <Check size={11} style={{ flexShrink: 0 }} /> : <X size={11} style={{ flexShrink: 0 }} />}
                  {x.el}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button data-ui-control="" onClick={() => { const missing = catResult.list.filter(x => !x.hit).map(x => x.el).join('\n'); setCatText(missing); setCatResult(null); }} style={{ ...btnBase, flex: 1 }}>Reintentar con lo que faltó</button>
              <button data-ui-control="" onClick={() => { setCatText(''); setCatResult(null); }} style={{ ...ghostBtn, flex: 1 }}>Empezar de nuevo</button>
            </div>
          </>
        )}
      </>
    );
  }

  // --- Mnemotecnia ---
  if (mode === 'mnemonics') {
    const usedSet = new Set(mneAnswer);
    const built = mneAnswer.map(i => mneWords[i].w).join(' ');
    const correct = mneChecked && built === (mat.content || '').trim();
    return wrap(
      <>
        <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '14px 18px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Dato a recordar</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{mat.title}</div>
        </div>
        {!revealed ? (
          <>
            {mneChecked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: correct ? '#10B981' : '#EF4444', marginBottom: 10 }}>
                {correct ? <Check size={13} /> : <X size={13} />}{correct ? '¡Regla reconstruida!' : 'Aún no es la regla exacta'}
              </div>
            )}
            <div style={{ borderRadius: 12, border: '1px dashed var(--border-subtle)', minHeight: 48, padding: '10px 14px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, background: 'var(--bg-deep)' }}>
              {built ? mneAnswer.map(i => (
                <button data-ui-control="" key={i} onClick={() => setMneAnswer(m => m.filter(x => x !== i))} title="Quitar"
                  style={{ height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${accent}45`, background: `${accent}0d`, color: accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{mneWords[i].w}</button>
              )) : <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Construye la regla aquí</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '12px 0 8px' }}>Palabras disponibles · pulsa para añadir</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {mneWords.map((wObj, i) => usedSet.has(i) ? null : (
                <button data-ui-control="" key={i} onClick={() => setMneAnswer(m => [...m, i])}
                  style={{ height: 28, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', transition: 'all 120ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}50`; e.currentTarget.style.color = accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>{wObj.w}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button data-ui-control="" onClick={() => setMneChecked(true)} disabled={mneAnswer.length === 0} style={{ ...btnBase, opacity: mneAnswer.length === 0 ? 0.4 : 1 }}>Comprobar</button>
              <button data-ui-control="" onClick={() => setRevealed(true)} style={ghostBtn}>Ver la regla</button>
              <button data-ui-control="" onClick={resetMne} style={ghostBtn}>Barajar</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 10 }}>La regla mnemotécnica completa:</div>
            <div style={{ borderRadius: 12, border: '1px solid #10B98140', background: '#10B9810d', padding: '16px 18px', fontSize: 14, fontWeight: 600, lineHeight: 1.7, color: '#10B981', fontFamily: "'Inter Tight', sans-serif" }}>{mat.content}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button data-ui-control="" onClick={() => { setRevealed(false); resetMne(); }} style={ghostBtn}>Volver a jugar</button>
            </div>
          </>
        )}
      </>
    );
  }

  return wrap(<div style={{ textAlign: 'center', padding: '40px 20px' }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{mat.title || meta.name}</div>
    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{mat.content || mat.question || 'Sin contenido para practicar.'}</div>
  </div>);
}

// --- Tag Assign Inline (per-item tag popover) ---
function TagAssignInline({ defs, assigned, onToggle, accent }: {
  defs: { id: string; name: string; color: string }[];
  assigned: string[];
  onToggle: (tagId: string) => void;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  if (defs.length === 0) return null;
  const active = defs.filter(d => assigned.includes(d.id));
  const togglePop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 190)), y: r.bottom + 6 });
    setOpen(true);
  };
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--bg-surface)' }}>
      {active.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>Sin etiquetas</span>}
      {active.map(d => (
        <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${d.color}14`, color: d.color, letterSpacing: '0.03em' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: d.color }} />{d.name}
        </span>
      ))}
      <div style={{ marginLeft: 'auto' }}>
        <button data-ui-control="" ref={btnRef} onClick={togglePop} title="Etiquetar"
          style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${open ? `${accent}55` : 'var(--border-subtle)'}`, background: open ? `${accent}12` : 'transparent', cursor: 'pointer', color: open ? accent : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
          <Tag size={10} />
        </button>
      </div>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99988 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div style={{ position: 'fixed', left: pos?.x ?? 0, top: pos?.y ?? 0, zIndex: 99990, minWidth: 170, maxWidth: 190, borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', boxShadow: '0 10px 34px rgba(0,0,0,0.32)', padding: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', padding: '4px 8px 6px' }}>Etiquetas</div>
            {defs.map(d => {
              const on = assigned.includes(d.id);
              return (
                <button data-ui-control="" key={d.id} onClick={(e) => { e.stopPropagation(); onToggle(d.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', background: on ? `${d.color}12` : 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, boxShadow: on ? `0 0 0 2px ${d.color}30` : 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {on && <Check size={11} style={{ color: d.color }} />}
                </button>
              );
            })}
          </div>
        </>, document.body)}
    </div>
  );
}

// --- Note Card ---
function NoteCard({ note, courseColor, onSelect }: { note: any; courseColor: string; onSelect: (id: string) => void }) {
  const preview = useMemo(() => note.content?.replace(/<[^>]+>/g, '').trim().slice(0, 120) || 'Sin contenido', [note.content]);
  return (
    <div onClick={() => onSelect(note.id)} style={{
      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
      border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
      transition: 'all 200ms ' + EASE,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${courseColor}40`; e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {note.title || 'Sin título'}
        </span>
        <MoreHorizontal size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {preview}
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(note.tags || []).slice(0, 2).map((t: string) => (
          <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: `${courseColor}12`, color: courseColor }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// --- Task Card ---
function TaskRow({ task, onToggle, onDelete, courseColor }: { task: any; onToggle: () => void; onDelete: () => void; courseColor: string }) {
  const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
  const isDone = task.status === 'completado';
  const isProg = task.status === 'progreso';
  const statusColor = isDone ? '#10B981' : isProg ? '#3B82F6' : courseColor;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', transition: 'all 150ms' }}>
      <div onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
        border: `1.5px solid ${statusColor}${isDone ? '' : '40'}`,
        background: isDone ? '#10B981' : isProg ? '#3B82F6' : `${courseColor}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        {isDone && <Check size={11} strokeWidth={2.5} color="#fff" />}
        {isProg && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
        {!isDone && !isProg && <div style={{ width: 6, height: 6, borderRadius: '50%', background: courseColor, opacity: 0.45 }} />}
      </div>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: task.status === 'completado' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'completado' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      {task.priority !== 'none' && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: `${priorityColors[task.priority]}18`, color: priorityColors[task.priority], textTransform: 'uppercase' }}>{task.priority}</span>
      )}
      {task.dueDate && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{task.dueDate}</span>}
      <button data-ui-control="" onClick={onDelete} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={10} /></button>
    </div>
  );
}

// --- Note Full Editor ---
const liveNoteEditors = new Map<string, () => string | null>();

// Comprime imágenes pegadas en apuntes: dataURLs gigantes rompían el guardado
function compressImageForNote(dataUrl: string, maxSize = 1400): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const needsWork = img.width > maxSize || dataUrl.length > 350_000;
        if (!needsWork) { resolve(dataUrl); return; }
        const scale = Math.min(1, maxSize / img.width);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function NoteEditor({ note, courseColor, onSave, editable, toolbarEnd, hideToolbar, onImageClick, onActiveFormatsChange }: {
  note: any; courseColor: string; onSave: (id: string, data: any) => void; editable?: boolean; toolbarEnd?: React.ReactNode; hideToolbar?: boolean; onImageClick?: (src: string) => void; onActiveFormatsChange?: (f: Record<string, boolean>) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const histRef = useRef(createEditorHistory(() => editorRef.current));
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const lastEnterEmpty = useRef(false);
  const trackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    liveNoteEditors.set(note.id, () => (editorRef.current ? editorRef.current.innerHTML : null));
    return () => { liveNoteEditors.delete(note.id); };
  }, [note.id]);

  const saveRef = useRef(onSave); saveRef.current=onSave;
  const saveDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>{
    const sync=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.args?.entity!=='notes'||detail.args.id!==note.id)return;
      if(saveDelay.current){clearTimeout(saveDelay.current);saveDelay.current=null;}
      if(editorRef.current)editorRef.current.innerHTML=note.content||'';
      dirtyRef.current=false;histRef.current.reset();
    };
    window.addEventListener('apheka:mcp-committed',sync);
    return()=>window.removeEventListener('apheka:mcp-committed',sync);
  },[note.id,note.content]);
  useLayoutEffect(() => {
    const editor=editorRef.current;
    if(!editor)return;
    editor.innerHTML=note?.content || '';
    dirtyRef.current=false;
    histRef.current.reset();
    return()=>{
      if(saveDelay.current)clearTimeout(saveDelay.current);
      if(dirtyRef.current)saveRef.current(note.id,{content:editor.innerHTML});
      if(trackTimeout.current)clearTimeout(trackTimeout.current);
    };
  }, [note.id]);
  useEffect(()=>{
    const editor=editorRef.current;
    if(editor && !dirtyRef.current && document.activeElement!==editor && editor.innerHTML!==note.content) editor.innerHTML=note.content || '';
  },[note.content]);

  // Historial undo/redo propio: se reinicia SOLO al cambiar de apunte
  // (no con cada commit del autosave, que re-renderiza el contenido)
  useEffect(() => {
    histRef.current.reset();
  }, [note.id]);

  const markDirty = () => {
    if(!editable)return;
    dirtyRef.current=true;
    if(saveDelay.current)clearTimeout(saveDelay.current);
    saveDelay.current=setTimeout(autoSave,600);
  };

  const autoSave = () => {
    if (!editable || !dirtyRef.current) return;
    const content = editorRef.current?.innerHTML || '';
    saveRef.current(note.id, { content });
    dirtyRef.current = false;
  };

  const trackFormats = () => {
    if(!onActiveFormatsChange)return;
    const sel = window.getSelection();
    let bold = false, italic = false, underline = false, strikeThrough = false;
    let insertUnorderedList = false, insertOrderedList = false;
    let heading1 = false, heading2 = false, heading3 = false, blockquote = false;
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      let el = node as HTMLElement | null;
      while (el && el !== editorRef.current) {
        const tag = el.tagName;
        if (tag === 'B' || tag === 'STRONG') bold = true;
        else if (tag === 'I' || tag === 'EM') italic = true;
        else if (tag === 'U') underline = true;
        else if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') strikeThrough = true;
        else if (tag === 'UL') insertUnorderedList = true;
        else if (tag === 'OL') insertOrderedList = true;
        else if (tag === 'H1') heading1 = true;
        else if (tag === 'H2') heading2 = true;
        else if (tag === 'H3') heading3 = true;
        else if (tag === 'BLOCKQUOTE') blockquote = true;
        el = el.parentElement;
      }
      bold = bold || document.queryCommandState('bold');
      italic = italic || document.queryCommandState('italic');
      underline = underline || document.queryCommandState('underline');
      strikeThrough = strikeThrough || document.queryCommandState('strikeThrough');
      insertUnorderedList = insertUnorderedList || document.queryCommandState('insertUnorderedList');
      insertOrderedList = insertOrderedList || document.queryCommandState('insertOrderedList');
    }
    setActiveFormats({ bold, italic, underline, strikeThrough, insertUnorderedList, insertOrderedList, heading1, heading2, heading3, blockquote });
    onActiveFormatsChange?.({ bold, italic, underline, strikeThrough, insertUnorderedList, insertOrderedList, heading1, heading2, heading3, blockquote });
  };

  const scheduleTrack = () => {
    if(!onActiveFormatsChange)return;
    if (trackTimeout.current) clearTimeout(trackTimeout.current);
    trackTimeout.current = setTimeout(trackFormats, 0);
  };

  useEffect(() => {
    if (!editable || !onActiveFormatsChange) return;
    const onSelChange = () => scheduleTrack();
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [editable]);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    for (const item of e.clipboardData.items) {
      const file = item.getAsFile();
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const raw = ev.target?.result as string;
          if (!raw) return;
          compressImageForNote(raw).then(dataUrl => {
            if (dataUrl && editorRef.current) {
              document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="" style="max-width:100%;max-height:360px;border-radius:6px;margin:6px 0;cursor:pointer;object-fit:contain;" />`);
              histRef.current.capture(false);
              markDirty();
            }
          });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    const html = e.clipboardData.getData('text/html');
    const clean=html?sanitizePastedHtml(prepareMathClipboard(html)):latexTextToHtml(e.clipboardData.getData('text/plain'));
    if(clean)document.execCommand('insertHTML',false,upgradeLatexInText(clean));
    histRef.current.capture(false);
    markDirty();
    scheduleTrack();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    if(e.nativeEvent.isComposing || e.key==='Process')return;
    histRef.current.capture(true);
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const uk = e.key.toLowerCase();
      if (uk === "z" && !e.shiftKey) {
        e.preventDefault();
        if (histRef.current.undo()) markDirty();
        return;
      }
      if (uk === "y" || (uk === "z" && e.shiftKey)) {
        e.preventDefault();
        if (histRef.current.redo()) markDirty();
        return;
      }
    }
    if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertHTML", false, "&#09;"); histRef.current.capture(false); markDirty(); return; }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;

    if (e.key === "Enter" && !e.shiftKey) {
      const block=(node.nodeType===Node.TEXT_NODE?node.parentElement:node as HTMLElement)?.closest('h1,h2,h3,h4,blockquote');
      if(range.collapsed && block && editorRef.current?.contains(block)) {
        const tail=range.cloneRange();tail.selectNodeContents(block);tail.setStart(range.startContainer,range.startOffset);
        if(!tail.toString()){
          e.preventDefault();const p=document.createElement('p');p.innerHTML='<br>';block.after(p);
          const next=document.createRange();next.selectNodeContents(p);next.collapse(true);sel.removeAllRanges();sel.addRange(next);histRef.current.capture(false);markDirty();return;
        }
      }
      try {
        let listItem: HTMLElement | null = null;
        let lp = node.parentElement;
        while (lp && lp !== editorRef.current) {
          if (lp.tagName === "LI") { listItem = lp; break; }
          lp = lp.parentElement;
        }
        if (listItem) {
          const text = listItem.textContent?.trim() || "";
          if (text === "") {
            e.preventDefault();
            if (lastEnterEmpty.current) {
              const list = listItem.closest("ul, ol");
              const p = document.createElement("p");
              p.innerHTML = "<br>";
              if (list && !list.querySelector("li")) { list.after(p); list.remove(); }
              else { listItem.remove(); if (list && !list.querySelector("li")) { list.after(p); list.remove(); } }
              const newRange = document.createRange();
              newRange.selectNodeContents(p); newRange.collapse(true);
              sel.removeAllRanges(); sel.addRange(newRange);
              lastEnterEmpty.current = false;
              histRef.current.capture(false);
              markDirty(); return;
            }
            lastEnterEmpty.current = true;
            setTimeout(() => { lastEnterEmpty.current = false; }, 400);
            const list = listItem.closest("ul, ol");
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            const parent = listItem.parentElement;
            listItem.remove();
            if (list && !list.querySelector("li")) { list.after(p); list.remove(); }
            else if (parent) { parent.after(p); }
            const newRange = document.createRange();
            newRange.selectNodeContents(p); newRange.collapse(true);
            sel.removeAllRanges(); sel.addRange(newRange);
            histRef.current.capture(false);
            markDirty(); return;
          }
        }
      } catch {}
      lastEnterEmpty.current = false;
    }

    if (e.key === " ") {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        const before = text.substring(0, range.startOffset);
        let cmd = "";
        if (before === "#") cmd = "h1";
        else if (before === "##") cmd = "h2";
        else if (before === "###") cmd = "h3";
        else if (before === "-" || before === "*") cmd = "ul";
        else if (before === "1.") cmd = "ol";
        if (cmd) {
          e.preventDefault();
          (node as Text).deleteData(0, range.startOffset);
          if (cmd === "h1") document.execCommand("formatBlock", false, "<h1>");
          else if (cmd === "h2") document.execCommand("formatBlock", false, "<h2>");
          else if (cmd === "h3") document.execCommand("formatBlock", false, "<h3>");
          else if (cmd === "ul") document.execCommand("insertUnorderedList", false);
          else if (cmd === "ol") document.execCommand("insertOrderedList", false);
          markDirty(); return;
        }
      }
    }
  };

  const blockquoteButtonRef = useRef<HTMLButtonElement>(null);
  const applyFormat = (cmd: string, value?: string) => {
    histRef.current.capture(true);
    if(cmd==='hiliteColor'){if(editorRef.current)applyEditorHighlight(editorRef.current,value);}
    else if(cmd==='codeBlock'){insertCode();histRef.current.capture(false);trackFormats();return;}
    else if(cmd==='styledQuote'){document.execCommand('formatBlock',false,'<blockquote>');}
    else if(cmd==='insertHR'){document.execCommand('insertHTML',false,'<hr><p><br></p>');}
    else if(cmd==='insertTable'){const [cols,rows]=(value||'3x3').split('x').map(Number);document.execCommand('insertHTML',false,'<table><tbody>'+Array.from({length:Math.min(10,rows||3)},()=>'<tr>'+Array.from({length:Math.min(10,cols||3)},()=>'<td><br></td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>');}
    else if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3') {
      const block = document.queryCommandValue('formatBlock')?.replace(/[<>]/g, '')?.toLowerCase() || '';
      document.execCommand('formatBlock', false, block === cmd ? '<p>' : `<${cmd}>`);
    } else if (cmd === 'blockquote') {
      const block = document.queryCommandValue('formatBlock')?.replace(/[<>]/g, '')?.toLowerCase() || '';
      if (block === 'blockquote') {
        document.execCommand('formatBlock', false, '<p>');
      } else {
        document.execCommand('formatBlock', false, '<blockquote>');
      }
    } else {
      document.execCommand(cmd, false, value);
    }
    editorRef.current?.focus();
    histRef.current.capture(false);
    markDirty();
    trackFormats();
  };

  const insertLink = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const url = prompt('URL del enlace:');
    if (url) {
      document.execCommand('createLink', false, url);
      markDirty();
      trackFormats();
    }
  };

  const insertCode = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    document.execCommand('insertHTML', false, `<code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;font-size:13px;font-family:'JetBrains Mono',monospace">${sel.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>`);
    markDirty();
  };

  // --- Ecuaciones / notación matemática ---
  const applyMathFormat = (cmd: 'superscript' | 'subscript') => {
    document.execCommand(cmd, false);
    markDirty();
    histRef.current.capture(true);
  };
  // Convierte ^ y _ en super/subíndices y envuelve el resultado en un span matemático.
  // Con texto seleccionado lo transforma; sin selección inserta x² editable.
  const insertMathAtCaret = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const raw = sel.toString().trim() || 'x^2';
    document.execCommand('insertHTML', false, latexToHtml(raw) + '&nbsp;');
    markDirty();
    histRef.current.capture(true);
  };

  return (
    <div className="course-note-surface" onPointerDown={e=>{if(editable)e.stopPropagation();}} style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {editable && !hideToolbar && (
        <div className="course-writing-toolbar course-note-controls" onMouseDown={e=>{if(e.button===0&&(e.target as HTMLElement).closest('button'))e.preventDefault();}}>
          <NoteEditorToolbar key={note.id} variant="essential" editorRef={editorRef} onFormat={applyFormat}
            />
          {toolbarEnd&&<div className="course-note-actions">{toolbarEnd}</div>}
        </div>
      )}
      <div ref={editorRef} contentEditable={editable} suppressContentEditableWarning
        onBeforeInput={event=>{if(!(event.nativeEvent as InputEvent).isComposing)histRef.current.capture(true);}} onCompositionStart={()=>histRef.current.capture(true)} role="textbox" aria-label="Contenido del apunte" aria-multiline="true" onPaste={handlePaste} onInput={e => { if(!(e.nativeEvent as InputEvent).isComposing && editorRef.current)renderMathAtCaret(editorRef.current); markDirty(); if(!(e.nativeEvent as InputEvent).isComposing)histRef.current.capture(true); }} onCompositionEnd={()=>{if(editorRef.current)renderMathAtCaret(editorRef.current);markDirty();histRef.current.capture(true);}}
        onBlur={()=>{const editor=editorRef.current;if(editable&&editor){const rendered=upgradeLatexInText(editor.innerHTML);if(rendered!==editor.innerHTML){histRef.current.capture(true);editor.innerHTML=rendered;dirtyRef.current=true;histRef.current.capture(false);}}autoSave();}} onKeyDown={handleEditorKeyDown}
        onDoubleClick={e=>{if(editable&&editorRef.current){histRef.current.capture(true);if(editMathSource(e.target,editorRef.current)){e.preventDefault();markDirty();histRef.current.capture(false);}}}}
        onMouseUp={scheduleTrack}
        onClick={(e) => { const t = e.target as HTMLElement; if (t.tagName === 'IMG' && onImageClick) { e.stopPropagation(); onImageClick((t as HTMLImageElement).src); } }}
        className="notes-editor-area course-note-editor"
        style={{ padding: '12px 16px', minHeight: 80, fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)',
          background: 'transparent', outline: 'none',
          fontFamily: "'Atkinson Hyperlegible', system-ui, serif",
          caretColor: editable ? courseColor : 'transparent',
          userSelect: 'text', cursor: editable ? 'text' : 'default' }} />
    </div>
  );
}

// --- Desplegable custom (agrupación / tema): siempre hacia arriba, con buscador y scroll interno acotado ---

// --- Main Component ---
export default function Cursos({ initialCourseId, initialTab = 'overview', onNavigate }: { initialCourseId?: string; initialTab?: 'overview' | 'tareas' | 'notas' | 'archivos'; onNavigate?: (view: string) => void }) {
  const { hydrated, courses = [], tasks = [], notes = [], noteFolders = [], updateCourse, deleteCourse, setNavigateTo, setFocusedTaskId, addTask, updateTask, deleteTask, addNote, updateNote, deleteNote, reorderNotes, reorderTasks, plannedSessions, addPlannedSession, updatePlannedSession, deletePlannedSession, reorderPlannedSessions, studySessions, activePlannedSessionId, linkPlannedSessionToTimer, unlinkPlannedSessionFromTimer, courseDeepLink, setCourseDeepLink, navigateToCourse, activeTaskId, addNotification, flushNoteContent } = useTaskPresentationSlice(["hydrated","courses","tasks","notes","noteFolders","updateCourse","deleteCourse","setNavigateTo","setFocusedTaskId","addTask","updateTask","deleteTask","addNote","updateNote","deleteNote","reorderNotes","reorderTasks","plannedSessions","addPlannedSession","updatePlannedSession","deletePlannedSession","reorderPlannedSessions","studySessions","activePlannedSessionId","linkPlannedSessionToTimer","unlinkPlannedSessionFromTimer","courseDeepLink","setCourseDeepLink","navigateToCourse","activeTaskId","addNotification","flushNoteContent"]);
  const courseTimeTotals=useMemo(()=>courseStudySeconds(courses,tasks,studySessions),[courses,tasks,studySessions]);
  const th = document.documentElement.getAttribute('data-theme');
  const isDarkSelect = !th || th === 'oscuro' || th === 'vibrante';
  const selectBorder = isDarkSelect ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)';

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || courses[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'tareas' | 'notas' | 'archivos'>('overview');

  useEffect(() => {
    if (initialCourseId && initialCourseId !== selectedCourseId) {
      // Snapshot ÚNICO al salir: guarda la ruta del curso actual con el estado
      // VIGENTE (antes de los resets de abajo). Escribir después pisaría la
      // agrupación con overview/null y al volver no redirigiría a ella.
      if (selectedCourseId) {
        try { localStorage.setItem(`owa_course_route_${selectedCourseId}`, JSON.stringify({ tab: activeTab, view: currentView, topicId: activeTopicId, groupId: selectedGroupId, toolGroup: activeToolGroup, overviewMode })); } catch { }
      }
      setSelectedCourseId(initialCourseId);
      setActiveTab('overview');
      setSelectedOverviewNoteId(null);
      setOverviewNoteEditMode(false);
      setCurrentView('overview');
      setSelectedGroupId(null);
      setStudyToolMode('none');
      setShowMaterialsDropdown(false);
    }
  }, [initialCourseId]);

  // Per-course route persistence · each course remembers the tab/view/topic/group it was left open in
  const routeRestoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedCourseId || routeRestoredForRef.current === selectedCourseId) return;
    routeRestoredForRef.current = selectedCourseId;
    try {
      const raw = localStorage.getItem(`owa_course_route_${selectedCourseId}`);
      if (!raw) return;
      const r = JSON.parse(raw);
      if (!r || typeof r !== 'object') return;
      if ((r.tab === 'tareas' || r.tab === 'notas' || r.tab === 'archivos' || r.tab === 'overview')) setActiveTab(r.tab);
      // El modo (Tareas/Notas vs Estudio) también se restaura POR CURSO
      if (r.overviewMode === 'tareas_notas' || r.overviewMode === 'temas_archivos') setOverviewMode(r.overviewMode);
      if (r.view === 'topic' && r.topicId && parsedTopics.some(t => t.id === r.topicId)) {
        setActiveTopicId(r.topicId);
        setCurrentView('topic');
        // Restaura también el grupo de herramientas activo dentro del tema (si aún existe)
        const rtp = parsedTopics.find(t => t.id === r.topicId);
        const rGroups = (((rtp as any)?.toolGroups || []) as string[]);
        if (typeof r.toolGroup === 'string' && (r.toolGroup === 'todos' || rGroups.includes(r.toolGroup) || rGroups.some(g => r.toolGroup.startsWith(g + '/')))) {
          setActiveToolGroup(r.toolGroup);
        } else {
          setActiveToolGroup('todos');
        }
      } else if (r.view === 'group' && r.groupId && groups.some(g => g.id === r.groupId)) {
        setSelectedGroupId(r.groupId);
        setCurrentView('group');
        // Subcarpeta: si el último tema visto pertenece a esta agrupación,
        // queda seleccionado también (mismo JSON, misma lógica).
        if (r.topicId && parsedTopics.some(t => t.id === r.topicId && (t as any).groupId === r.groupId)) {
          setActiveTopicId(r.topicId);
        }
      }
      setTopicSearch('');
      setActiveTagFilter(null);
    } catch { /* ignore */ }
  }, [selectedCourseId]);

  // Topic view state
  const [currentView, setCurrentView] = useState<'overview' | 'topic' | 'group'>('overview');
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

  // Course edit
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCover, setEditCourseCover] = useState<string | undefined>(undefined);
  const [editEditorSrc, setEditEditorSrc] = useState<string | null>(null);
  const [editCourseOriginal,setEditCourseOriginal]=useState<string|undefined>();
  const [editCourseCrop,setEditCourseCrop]=useState<BannerCrop|undefined>();
  const [editCourseTeacher, setEditCourseTeacher] = useState('');
  const [editCourseColor, setEditCourseColor] = useState('#6366f1');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Group modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupCover, setGroupCover] = useState<string | undefined>(undefined);
  const [inlineEditGroupId, setInlineEditGroupId] = useState<string | null>(null);
  const [inlineGroupName, setInlineGroupName] = useState('');
  const [inlineGroupCover, setInlineGroupCover] = useState<string | undefined>(undefined);
  const [showAgrupacionImportExport, setShowAgrupacionImportExport] = useState(false);
  const [importExportMode, setImportExportMode] = useState<'export' | 'import' | 'choose'>('choose');
  const [importTargetGroupId, setImportTargetGroupId] = useState<string | null>(null);
  const [hoverEdgePanel, setHoverEdgePanel] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [confirmDeleteMatId, setConfirmDeleteMatId] = useState<string | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<{ group: { name: string; image?: string }; topics: any[] }[] | null>(null);
  const [importSelected, setImportSelected] = useState<boolean[][]>([]);
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);
  const groupCoverInputInlineRef = useRef<HTMLInputElement>(null);

  // Topic modals
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState('');

  // Material modals
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<SubjectMaterial | null>(null);
  const [materialColIndex, setMaterialColIndex] = useState(0);
  const [materialForm, setMaterialForm] = useState({ name: '', clarification: '', title: '', content: '', word: '', meaning: '', question: '', answer: '', description: '', image: undefined as string | undefined });
  const setForm = (p: Partial<typeof materialForm>) => setMaterialForm(prev => ({ ...prev, ...p }));
  const resetForm = () => setMaterialForm({ name: '', clarification: '', title: '', content: '', word: '', meaning: '', question: '', answer: '', description: '', image: undefined });
  const [loadingMatId, setLoadingMatId] = useState<string | null>(null);
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const materialImageInputRef = useRef<HTMLInputElement>(null);
  const [toolModal, setToolModal] = useState<{ mode: ToolCreatorMode; editingId: string | null } | null>(null);
  const [toolFields, setToolFields] = useState<Record<string, string>>({});
  const setToolField = (k: string, v: string) => setToolFields(f => ({ ...f, [k]: v }));
  const [searchFocused, setSearchFocused] = useState(false);
  const clozeRef = useRef<HTMLTextAreaElement>(null);
  // Practice modal (per-tool review of created materials)
  const [practiceMat, setPracticeMat] = useState<SubjectMaterial | null>(null);
  const openPractice = (mat: SubjectMaterial) => {
    // Los nodos de herramienta especializados se ejecutan DENTRO del panel del tema
    if (mat.toolMode === 'flashcardsDeck' || mat.toolMode === 'quizDeck' || mat.toolMode === 'matchDeck' || mat.toolMode === 'clozeDeck' || mat.toolMode === 'feynmanDeck' || mat.toolMode === 'vfDeck' || mat.toolMode === 'seqDeck' || mat.toolMode === 'catDeck') { setDeckRunner(mat); return; }
    setPracticeMat(mat);
  };
  const closePractice = () => setPracticeMat(null);
  const viewMaterial = (mat: SubjectMaterial) => setViewingMat(mat);
  // Herramientas reorder (long-press drag), persisted
  const toolDragRef = useRef(false);
  const [toolOrder, setToolOrder] = useState<ToolKey[]>(() => {
    let stored: ToolKey[] = [];
    try {
      const s = localStorage.getItem('owa_tools_order');
      if (s) { const p = JSON.parse(s); if (Array.isArray(p)) stored = p.filter((m: string) => (TOOL_DEFAULT_ORDER as string[]).includes(m)); }
    } catch { /* ignore */ }
    const merged: ToolKey[] = [];
    [...stored, ...TOOL_DEFAULT_ORDER].forEach(m => { if (!merged.includes(m)) merged.push(m); });
    return merged;
  });
  try { useEffect(() => { try { localStorage.setItem('owa_tools_order', JSON.stringify(toolOrder)); } catch { /* ignore */ } }, [toolOrder]); } catch { /* cuota */ }
  const toolSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 350, tolerance: 6 } }));
  const handleToolDragStart = () => { toolDragRef.current = true; };
  const handleToolDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setToolOrder(prev => {
        const a = prev.indexOf(active.id as ToolKey);
        const b = prev.indexOf(over.id as ToolKey);
        if (a < 0 || b < 0) return prev;
        return arrayMove(prev, a, b);
      });
    }
    setTimeout(() => { toolDragRef.current = false; }, 0);
  };
  const handleToolDragCancel = () => { setTimeout(() => { toolDragRef.current = false; }, 0); };
  const insertClozeGap = () => {
    const ta = clozeRef.current;
    if (ta) {
      const start = ta.selectionStart ?? (toolFields.body || '').length;
      const end = ta.selectionEnd ?? start;
      const selected = (toolFields.body || '').slice(start, end).trim();
      const marker = selected ? `[___:${selected}]` : '[___]';
      const next = (toolFields.body || '').slice(0, start) + marker + (toolFields.body || '').slice(end);
      setToolField('body', next);
      requestAnimationFrame(() => { ta.focus(); const pos = start + marker.length; ta.setSelectionRange(pos, pos); });
    } else {
      setToolField('body', (toolFields.body || '') + ' [___] ');
    }
  };

  // Add link modal
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  // Tema destino del enlace: undefined = comportamiento clásico (primer tema);
  // cuando se abre desde Herramientas apunta AL TEMA ACTIVO de la agrupación.
  const [addLinkTargetTopic, setAddLinkTargetTopic] = useState<string | undefined>(undefined);
  // Selector de icono de enlace (solo links): { matId, x, y } del click
  const [linkIconPick, setLinkIconPick] = useState<{ matId: string; x: number; y: number } | null>(null);
  const setMaterialIcon = (matId: string, icon: string | null) => {
    if (!course) return;
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => ({
        ...t,
        materials: (safeArr((t as any).materials)).map((m: any) => {
          if (!m || m.id !== matId) return m;
          const nm = { ...m };
          if (!icon || icon === 'auto') delete nm.icon;
          else nm.icon = icon;
          return nm;
        }),
      })),
    } as any);
    setLinkIconPick(null);
    toast.success(!icon || icon === 'auto' ? 'Icono original restaurado' : 'Icono actualizado');
  };
  const [addLinkUrl, setAddLinkUrl] = useState('');
  const [addLinkName, setAddLinkName] = useState('');

  // Edit link modal
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editLinkName, setEditLinkName] = useState('');

  // Plan session modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planEditId, setPlanEditId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState('');
  const { plannerDate, setPlannerDate, markManual } = usePlannerDay(selectedCourseId);
  // Deep-link para editar una sesión desde otro curso: el panel escribe owa_course_edit_session antes de navegar
  useEffect(() => {
    if (!hydrated || !selectedCourseId) return;
    try {
      const pending = localStorage.getItem('owa_course_edit_session');
      if (!pending) return;
      localStorage.removeItem('owa_course_edit_session');
      const target = (plannedSessions || []).find(s => s && s.id === pending && s.courseId === selectedCourseId);
      if (!target) return;
      setPlanEditId(target.id);
      setPlanDate(target.date);
      setPlanStartTime(target.startTime || '09:00');
      setPlanTitle(target.title || '');
      setPlanGroupId(target.groupId || '');
      setPlanTopicId(target.topicId || '');
      setPlanType(target.type || 'estudio');
      setPlanDuration(target.durationMinutes || 30);
      setPlanIntensity(target.intensity || 5);
      setPlanRepeat(target.repeat || 'none');
      setPlanRepeatDays(target.repeatDays || []);
      setPlanRepeatUntil(target.repeatUntil || '');
      setShowPlanModal(true);
    } catch { /* noop */ }
  }, [hydrated, selectedCourseId, plannedSessions]);
  const [planStartTime, setPlanStartTime] = useState('09:00');
  const [planTitle, setPlanTitle] = useState('');
  const [planGroupId, setPlanGroupId] = useState('');
  const [planTopicId, setPlanTopicId] = useState('');
  const [planType, setPlanType] = useState<string>('estudio');
  const [planDuration, setPlanDuration] = useState(30);
  const [planIntensity, setPlanIntensity] = useState(5);
  const [planRepeat, setPlanRepeat] = useState<'none' | 'daily' | 'weekly' | 'custom_days'>('none');
  const [planRepeatDays, setPlanRepeatDays] = useState<number[]>([]);
  const [planRepeatUntil, setPlanRepeatUntil] = useState('');
  // Session detail horizontal panel
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<PlannedSession | null>(null);
  const [changeCourseFor, setChangeCourseFor] = useState<PlannedSession | null>(null);
  const [ccSelId, setCcSelId] = useState('');

  // The session preview stays open after navigating away and back: persist the open session id
  useEffect(() => {
    try {
      if (detailSessionId) localStorage.setItem('owa_session_detail_v1', detailSessionId);
      else localStorage.removeItem('owa_session_detail_v1');
    } catch { /* noop */ }
  }, [detailSessionId]);
  useEffect(() => {
    if (!selectedCourseId) return;
    try {
      if (localStorage.getItem('owa_course_edit_session')) return;
      const saved = localStorage.getItem('owa_session_detail_v1');
      if (!saved) return;
      const target = (plannedSessions || []).find(s => s && s.id === saved && s.courseId === selectedCourseId);
      if (target) setDetailSessionId(saved);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  // Track the latest topics visited per course (the session preview shows them as "Últimos ingresos a temas")
  useEffect(() => {
    if (!selectedCourseId || !activeTopicId || currentView !== 'topic') return;
    try {
      const key = `owa_recent_topics_${selectedCourseId}`;
      const raw = localStorage.getItem(key);
      let arr: { id: string; at: number }[] = [];
      try { const p = raw ? JSON.parse(raw) : []; if (Array.isArray(p)) arr = p; } catch { /* ignore */ }
      arr = [{ id: activeTopicId, at: Date.now() }, ...arr.filter(x => x && typeof x.id === 'string' && x.id !== activeTopicId)].slice(0, 6);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch { /* ignore */ }
  }, [selectedCourseId, activeTopicId, currentView]);

  // Custom session types (persisted)
  const [customTypes, setCustomTypes] = useState<{ id: string; label: string; color: string }[]>(() => {
    try {
      const raw = localStorage.getItem('owa_session_types');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((t: any) => t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.color === 'string') : [];
    } catch { return []; }
  });
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#8B5CF6');
  useEffect(() => {
    try { localStorage.setItem('owa_session_types', JSON.stringify(customTypes)); } catch { /* noop */ }
  }, [customTypes]);
  const allSessionTypes = [...BUILT_IN_SESSION_TYPES, ...customTypes];
  const sessionTypeColor = useCallback((id: string) => allSessionTypes.find(t => t.id === id)?.color || '#8B5CF6', [allSessionTypes]);
  const sessionTypeLabel = useCallback((id: string) => allSessionTypes.find(t => t.id === id)?.label || 'Otro', [allSessionTypes]);
  const addCustomType = () => {
    const name = newTypeName.trim();
    if (!name) return;
    if (allSessionTypes.some(t => t.label.toLowerCase() === name.toLowerCase())) return;
    const id = `custom_${Date.now()}`;
    setCustomTypes(prev => [...prev, { id, label: name, color: newTypeColor }]);
    setPlanType(id);
    setNewTypeName('');
    setNewTypeColor('#8B5CF6');
    setShowAddType(false);
  };
  const removeCustomType = (id: string) => {
    setCustomTypes(prev => prev.filter(t => t.id !== id));
    if (planType === id) setPlanType('estudio');
  };

  // Week navigation
  const [weekOffset] = useState(0);

  // Day detail modal
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState('');

  // Radar chart filter & modal
  const [radarFilter, setRadarFilter] = useState<'agrupaciones' | 'dias' | 'tipos'>('agrupaciones');
  const [showChartsModal, setShowChartsModal] = useState(false);
  const [radarHover, setRadarHover] = useState<number | null>(null);
  const {ref:observeRadar,size:radarDims,element:radarWrapRef}=useObservedSize<HTMLDivElement>();
  const radarSvgRef = useRef<SVGSVGElement>(null);

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low' | 'none'>('none');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');

  // Note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const editContentRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const sync=(event:Event)=>{
      const args=(event as CustomEvent).detail?.args;
      if(args?.entity!=='notes'||args.id!==editingNoteId)return;
      const note=notes.find(n=>n.id===editingNoteId&&!n.deletedAt);
      if(!note){setEditingNoteId(null);return;}
      if(editContentRef.current)editContentRef.current.innerHTML=note.content||'';
      setEditContent(note.content||'');
    };
    window.addEventListener('apheka:mcp-committed',sync);
    return()=>window.removeEventListener('apheka:mcp-committed',sync);
  },[notes,editingNoteId]);
  const topicHistRef = useRef(createEditorHistory(() => editContentRef.current));
  const [noteActiveFormats, setNoteActiveFormats] = useState<Record<string, boolean>>({});
  const noteTrackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesSearch, setNotesSearch] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Note context menu
  const [noteMenuTarget, setNoteMenuTarget] = useState<string | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);
  // Notas tab context menu
  const [notasTabMenuTarget, setNotasTabMenuTarget] = useState<string | null>(null);
  const notasTabMenuRef = useRef<HTMLDivElement>(null);

  // Auto-focus contentEditable when entering editing mode
  useEffect(() => {
    if (editingNoteId) {
      setTimeout(() => editContentRef.current?.focus(), 60);
      topicHistRef.current.reset();
    }
  }, [editingNoteId]);
  // Study mode state
  const [showMaterialsDropdown, setShowMaterialsDropdown] = useState(false);
  type StudyTool = 'none' | 'flashcards';
  const [studyToolMode, setStudyToolMode] = useState<StudyTool>('none');
  // Topic toolbar: tag filters
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  // Tag CRUD modal
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagNameInput, setTagNameInput] = useState('');
  const [tagColorInput, setTagColorInput] = useState('#8B5CF6');
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(false);

  // Flashcard modal
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [fcQuestion, setFcQuestion] = useState('');
  const [fcAnswer, setFcAnswer] = useState('');
  const [fcDifficulty, setFcDifficulty] = useState<'facil' | 'bueno' | 'dificil'>('bueno');
  const [editingFlashcard, setEditingFlashcard] = useState<TopicFlashcard | null>(null);
  // Modo de creación: individual (1 pregunta/respuesta) o masivo estilo Quizlet
  // (una tarjeta por línea: "pregunta - respuesta", admite fórmulas/texto libre)
  const [fcMode, setFcMode] = useState<'uno' | 'masivo'>('uno');
  const [fcBulk, setFcBulk] = useState('');

  // Review session
  const [reviewing, setReviewing] = useState(false);
  const [reviewDeck, setReviewDeck] = useState<TopicFlashcard[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewStats, setReviewStats] = useState({ correct: 0, again: 0 });

  const openFlashcardModal = (fc?: TopicFlashcard) => {
    setEditingFlashcard(fc || null);
    setFcQuestion(fc?.question || '');
    setFcAnswer(fc?.answer || '');
    setFcDifficulty(fc?.difficulty || 'bueno');
    setFcMode(fc ? 'uno' : fcMode);
    setFcBulk('');
    setShowFlashcardModal(true);
  };

  // Parsea el bloque masivo: cada línea "pregunta - respuesta" (primer " - " separa).
  // Líneas vacías se ignoran; fórmulas/texto pasan tal cual.
  const parseBulkFlashcards = (): { q: string; a: string }[] => {
    return fcBulk.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const sep = line.indexOf(' - ') !== -1 ? ' - ' : line.indexOf('\t') !== -1 ? '\t' : line.indexOf('-') === 0 ? '' : ' - ';
      if (!sep) { return { q: line, a: '' }; }
      const i = line.indexOf(sep);
      return { q: line.slice(0, i).trim(), a: line.slice(i + sep.length).trim() };
    }).filter(c => c.q);
  };

  const handleSaveFlashcard = () => {
    if (!activeTopic) return;
    const targetGroup = activeToolGroup !== 'todos' ? activeToolGroup : undefined;
    if (fcMode === 'masivo' && !editingFlashcard) {
      const cards = parseBulkFlashcards().filter(c => c.a);
      if (cards.length === 0) { toast.error('Formato: pregunta - respuesta (una por línea)'); return; }
      const now = Date.now();
      const newFcs: TopicFlashcard[] = cards.map((c, i) => ({
        id: Math.random().toString() + i,
        question: c.q, answer: c.a, difficulty: fcDifficulty,
        lastReviewed: now, nextReview: now,
        ...(targetGroup ? { groupName: targetGroup } : {}),
      }));
      updateCourse(course.id, {
        studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic.id
          ? { ...t, flashcards: [...(safeArr(t.flashcards)), ...newFcs] }
          : t)
      });
      toast.success(`${newFcs.length} flashcards creadas`);
      setShowFlashcardModal(false); setEditingFlashcard(null); setFcBulk('');
      return;
    }
    if (!fcQuestion.trim() || !fcAnswer.trim()) return;
    const now = Date.now();
    const newFc: TopicFlashcard = (editingFlashcard
      ? { ...editingFlashcard, question: fcQuestion.trim(), answer: fcAnswer.trim(), difficulty: fcDifficulty, ...(targetGroup && !(editingFlashcard as any).groupName ? { groupName: targetGroup } : {}) }
      : { id: Math.random().toString(), question: fcQuestion.trim(), answer: fcAnswer.trim(), difficulty: fcDifficulty, lastReviewed: now, nextReview: now, ...(targetGroup ? { groupName: targetGroup } : {}) }) as any;
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic.id ? {
        ...t,
        flashcards: editingFlashcard
          ? (safeArr(t.flashcards)).map(f => f.id === editingFlashcard.id ? newFc : f)
          : [...(safeArr(t.flashcards)), newFc],
      } : t)
    });
    setShowFlashcardModal(false); setEditingFlashcard(null);
    toast.success(editingFlashcard ? 'Flashcard actualizada' : 'Flashcard creada');
  };

  const handleDeleteFlashcard = (fcId: string) => {
    if (!activeTopic) return;
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic.id ? {
        ...t,
        flashcards: (safeArr(t.flashcards)).filter(f => f.id !== fcId),
      } : t)
    });
    toast.success('Flashcard eliminada');
  };

  const startReview = () => {
    const allFcs = safeArr(activeTopic?.flashcards);
    // El repaso respeta el grupo activo: si estás dentro de una carpeta, solo repasa ese set
    const fcs = activeToolGroup !== 'todos'
      ? allFcs.filter(f => { const gn = ((f as any).groupName || '') as string; return gn === activeToolGroup || gn.startsWith(activeToolGroup + '/'); })
      : allFcs;
    if (fcs.length === 0) { toast.error(activeToolGroup !== 'todos' ? 'No hay flashcards en este grupo' : 'No hay flashcards para repasar'); return; }
    const shuffled = [...fcs].sort((a, b) => a.nextReview - b.nextReview);
    setReviewDeck(shuffled); setReviewIndex(0); setReviewFlipped(false);
    setReviewStats({ correct: 0, again: 0 }); setReviewing(true);
  };

  const closeReview = () => { setReviewing(false); setReviewFlipped(false); };

  // --- Topic tags (CRUD + assignment) ---
  const openTagModal = (tag?: { id: string; name: string; color: string }) => {
    setEditingTagId(tag?.id || null);
    setTagNameInput(tag?.name || '');
    setTagColorInput(tag?.color || '#8B5CF6');
    setConfirmDeleteTag(false);
    setTagModalOpen(true);
  };

  const handleSaveTag = () => {
    const name = tagNameInput.trim();
    if (!name) { toast.error('Escribe un nombre para la etiqueta'); return; }
    const defs = course.topicTagDefs || [];
    if (editingTagId) {
      updateCourse(course.id, { topicTagDefs: defs.map(d => d.id === editingTagId ? { ...d, name, color: tagColorInput } : d) });
      toast.success('Etiqueta actualizada');
    } else {
      updateCourse(course.id, { topicTagDefs: [...defs, { id: Math.random().toString(36).slice(2, 10), name, color: tagColorInput }] });
      toast.success('Etiqueta creada');
    }
    setTagModalOpen(false);
    setEditingTagId(null);
  };

  const handleDeleteTag = () => {
    if (!editingTagId) return;
    updateCourse(course.id, {
      topicTagDefs: (course.topicTagDefs || []).filter(d => d.id !== editingTagId),
      studyTopics: (safeArr(course.studyTopics)).map(t => ({
        ...t,
        materials: (safeArr(t.materials)).map(m => ({ ...m, tagIds: (m.tagIds || []).filter(x => x !== editingTagId) })),
        flashcards: (safeArr(t.flashcards)).map(f => ({ ...f, tagIds: (f.tagIds || []).filter(x => x !== editingTagId) })),
        recordings: (safeArr(t.recordings)).map(r => ({ ...r, tagIds: (r.tagIds || []).filter(x => x !== editingTagId) })),
      })),
    });
    setActiveTagFilter(af => af === editingTagId ? null : af);
    setTagModalOpen(false);
    setEditingTagId(null);
    toast.success('Etiqueta eliminada');
  };

  const toggleIn = (arr: string[], id: string) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  const handleToggleItemTag = (kind: 'flashcard' | 'material' | 'recording', itemId: string, tagId: string) => {
    if (!activeTopic) return;
    const idx = (safeArr(course.studyTopics)).findIndex(t => t.id === activeTopic.id);
    if (idx === -1) return;
    const t = { ...(safeArr(course.studyTopics))[idx] };
    if (kind === 'flashcard') t.flashcards = (safeArr(t.flashcards)).map(f => f.id === itemId ? { ...f, tagIds: toggleIn(f.tagIds || [], tagId) } : f);
    if (kind === 'material') t.materials = (safeArr(t.materials)).map(m => m.id === itemId ? { ...m, tagIds: toggleIn(m.tagIds || [], tagId) } : m);
    if (kind === 'recording') t.recordings = (safeArr(t.recordings)).map(r => r.id === itemId ? { ...r, tagIds: toggleIn(r.tagIds || [], tagId) } : r);
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map((tp, i) => i === idx ? t : tp) });
  };

  const gradeFlashcard = (grade: 'again' | 'hard' | 'good' | 'easy') => {
    const fc = reviewDeck[reviewIndex];
    if (!fc || !activeTopic) return;
    const now = Date.now();
    const DAY = 86400000;
    const intervals: Record<string, number> = { again: 10 * 60 * 1000, hard: DAY, good: 3 * DAY, easy: 7 * DAY };
    const updated: TopicFlashcard = { ...fc, lastReviewed: now, nextReview: now + intervals[grade], difficulty: fc.difficulty };
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic.id ? {
        ...t,
        flashcards: (safeArr(t.flashcards)).map(f => f.id === fc.id ? updated : f),
      } : t)
    });
    setReviewFlipped(false);
    setReviewStats(s => grade === 'again' ? { ...s, again: s.again + 1 } : { ...s, correct: s.correct + 1 });
    if (grade === 'again') {
      setReviewDeck(d => { const next = [...d]; next.splice(reviewIndex, 1); next.push(updated); return next; });
    } else if (reviewIndex + 1 >= reviewDeck.length) {
      setReviewing(false);
      toast.success('Repaso completado');
    } else {
      setReviewIndex(i => i + 1);
    }
  };

  const [overviewMode, setOverviewMode] = useState<'tareas_notas' | 'temas_archivos'>(() => {
    try { return (localStorage.getItem('owa_course_overview_mode') as 'tareas_notas' | 'temas_archivos') || 'tareas_notas'; } catch { return 'tareas_notas'; }
  });
  useEffect(() => { localStorage.setItem('owa_course_overview_mode', overviewMode); }, [overviewMode]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (overviewMode === 'temas_archivos' && selectedCourseId) {
      return localStorage.getItem(`owa_estudio_last_group_${selectedCourseId}`) || null;
    }
    return null;
  });

  useEffect(() => {
    if (overviewMode === 'temas_archivos' && selectedCourseId) {
      if (selectedGroupId) {
        try { localStorage.setItem(`owa_estudio_last_group_${selectedCourseId}`, selectedGroupId); } catch { /* cuota */ }
      } else {
        localStorage.removeItem(`owa_estudio_last_group_${selectedCourseId}`);
      }
    }
  }, [selectedGroupId, selectedCourseId]);

  // Persist study view state per course
  useEffect(() => {
    if (selectedCourseId && overviewMode === 'temas_archivos') {
      try { localStorage.setItem(`owa_study_view_${selectedCourseId}`, currentView); } catch { /* cuota */ }
    }
  }, [currentView, selectedCourseId]);
  useEffect(() => {
    if (selectedCourseId && activeTopicId && overviewMode === 'temas_archivos') {
      try { localStorage.setItem(`owa_study_topic_${selectedCourseId}`, activeTopicId); } catch { /* cuota */ }
    }
  }, [activeTopicId, selectedCourseId]);

  // La ruta por curso (owa_course_route_*) es la ÚNICA fuente de restauración
  // (vista + agrupación + tema). El bloque anterior que leía owa_study_view_*
  // competía con ella y reseteaba a overview al volver de otro curso.

  // Consume course deep links · navigate straight to the group/topic of a planned session
  useEffect(() => {
    if (!courseDeepLink || courseDeepLink.courseId !== selectedCourseId) return;
    if (overviewMode !== 'temas_archivos') setOverviewMode('temas_archivos');
    if (courseDeepLink.topicId) {
      if (courseDeepLink.groupId) setSelectedGroupId(courseDeepLink.groupId);
      setActiveTopicId(courseDeepLink.topicId);
      setCurrentView('topic');
    } else if (courseDeepLink.groupId) {
      setSelectedGroupId(courseDeepLink.groupId);
      setCurrentView('group');
    } else {
      setCurrentView('overview');
    }
    setCourseDeepLink(null);
  }, [courseDeepLink, selectedCourseId, overviewMode]);

  const [modeAnimating, setModeAnimating] = useState(false);
  const [modePhase, setModePhase] = useState<'idle' | 'out' | 'in'>('idle');
  const prevMode = useRef(overviewMode);

  const handleToggleMode = () => {
    if (modeAnimating) return;
    setModeAnimating(true);
    setModePhase('out');
    setTimeout(() => {
      const nextMode = overviewMode === 'tareas_notas' ? 'temas_archivos' : 'tareas_notas';
      setOverviewMode(nextMode);
      setCurrentView('overview');
      setSelectedGroupId(null);
      setStudyToolMode('none');
      setModePhase('in');
      setTimeout(() => { setModePhase('idle'); setModeAnimating(false); }, 350);
    }, 200);
  };
  const [selectedOverviewNoteId, setSelectedOverviewNoteId] = useState<string | null>(null);
  const [overviewNoteEditMode, setOverviewNoteEditMode] = useState(false);
  const [overviewActiveFormats, setOverviewActiveFormats] = useState<Record<string, boolean>>({});
  const [taskMenu, setTaskMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [overviewNoteHighlights, setOverviewNoteHighlights] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('owa_course_note_highlights') || '[]'); } catch { return []; }
  });
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [pendingTaskDeleteId, setPendingTaskDeleteId] = useState<string | null>(null);
  const [showOverviewNoteDates, setShowOverviewNoteDates] = useState(false);
  const [showCourseNotesInOverview, setShowCourseNotesInOverview] = useState(() => {
    try { return JSON.parse(localStorage.getItem('owa_show_course_notes') || 'false'); } catch { return false; }
  });
  useEffect(() => { localStorage.setItem('owa_show_course_notes', JSON.stringify(showCourseNotesInOverview)); }, [showCourseNotesInOverview]);
  const eyePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewNoteContainerRef = useRef<HTMLDivElement>(null);
  // Inline note creator state (Mode 1)
  const [overviewNoteContent, setOverviewNoteContent] = useState('');
  const overviewNoteRef = useRef<HTMLTextAreaElement>(null);
  const [overviewAddingNote, setOverviewAddingNote] = useState(false);
  const [overviewEditContent, setOverviewEditContent] = useState('');
  const [overviewNotesSort, setOverviewNotesSort] = useState<'date' | 'title'>('date');
  // Comportamiento nativo en editores de apuntes: si el encabezado/cita donde está
// el cursor queda vacío (borraste su texto), se convierte en párrafo limpio para
// que el siguiente texto NO herede el estilo del título borrado.
function fixEmptyHeadingCaret(ed: HTMLElement | null) {
  try {
    if (!ed) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    let block: HTMLElement | null = null;
    while (node && node !== ed) {
      if (node.nodeType === 1) { block = node as HTMLElement; break; }
      node = node.parentNode;
    }
    if (!block || !ed.contains(block)) return;
    if (!/^(H[1-4]|BLOCKQUOTE|PRE)$/.test(block.tagName)) return;
    if ((block.textContent || '').replace(/ /g, '').trim()) return;
    if (block.querySelector('img, video, audio, iframe')) return;
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    block.replaceWith(p);
    const r = document.createRange();
    r.setStart(p, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  } catch { /* noop */ }
}

// Comportamiento nativo: Enter al FINAL de un encabezado/cita crea un párrafo
// nuevo (no repite el estilo). Devuelve true si consumió el evento.
function enterEndHeading(e: KeyboardEvent, ed: HTMLElement | null): boolean {
  try {
    if (!ed) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    let node: Node | null = range.startContainer;
    let block: HTMLElement | null = null;
    while (node && node !== ed) {
      if (node.nodeType === 1) { block = node as HTMLElement; break; }
      node = node.parentNode;
    }
    if (!block || !ed.contains(block) || !/^(H[1-4]|BLOCKQUOTE)$/.test(block.tagName)) return false;
    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(range.endContainer, range.endOffset);
    const beforeLen = pre.toString().length;
    const totalLen = (block.textContent || '').length;
    if (range.collapsed && beforeLen >= totalLen && beforeLen > 0) {
      e.preventDefault();
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      block.insertAdjacentElement('afterend', p);
      const r = document.createRange();
      r.setStart(p, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
    }
    return false;
  } catch { return false; }
}

const saveCourseNoteContent = (id: string, html: string) => {
    updateNote(id, { content: normalizeEditorHtml(html || '') });
  };
  const flushOverviewEditors = () => {
    for (const [id, read] of Array.from(liveNoteEditors.entries())) {
      try {
        const html = read();
        if (html !== null) saveCourseNoteContent(id, html);
      } catch { }
    }
  };
  const [showCompletedTasks, setShowCompletedTasks] = useState(() => {
    try { return localStorage.getItem('owa_course_tasks_show_completed_v1') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('owa_course_tasks_show_completed_v1', showCompletedTasks ? '1' : '0'); } catch { /* cuota */ }
  }, [showCompletedTasks]);

  // Escape key closes expanded overview note or editing mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedOverviewNoteId) {
          flushOverviewEditors();
          setSelectedOverviewNoteId(null);
          setOverviewNoteEditMode(false);
          setConfirmDeleteNoteId(null);
        } else if (editingNoteId) {
          const html = liveNoteEditors.get(editingNoteId)?.();
          if (html !== undefined && html !== null) saveCourseNoteContent(editingNoteId, html);
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          setEditingNoteId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedOverviewNoteId, editingNoteId]);

  useEffect(() => {
    const flushAll = () => {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      for (const [id, read] of Array.from(liveNoteEditors.entries())) {
        try {
          const html = read();
          if (html !== null) flushNoteContent(id, html);
        } catch { }
      }
      if (editingNoteId && !liveNoteEditors.has(editingNoteId)) {
        const html = editContentRef.current?.innerHTML ?? editContent;
        try { flushNoteContent(editingNoteId, html || ''); } catch { }
      }
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flushAll(); };
    window.addEventListener('apheka:flush-editors', flushAll);
    window.addEventListener('beforeunload', flushAll);
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('apheka:flush-editors', flushAll);
      window.removeEventListener('beforeunload', flushAll);
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [editingNoteId, editContent, flushNoteContent]);

  // Click outside the expanded overview note: closes only in view mode (edit mode persists)
  useEffect(() => {
    if (!selectedOverviewNoteId) return;
    const handler = (e: MouseEvent) => {
      if (overviewNoteEditMode) return;
      // No cerrar el apunte ni las ventanas de confirmación mientras un modal
      // está abierto: el mousedown mataría el click del botón Eliminar (el modal
      // se desmonta antes del evento click → el borrado nunca ocurría)
      if (confirmDeleteNoteId || confirmDeleteTaskId) return;
      const t = e.target as HTMLElement;
      if (overviewNoteContainerRef.current && !overviewNoteContainerRef.current.contains(t)) {
        setSelectedOverviewNoteId(null);
        setOverviewNoteEditMode(false);
        setConfirmDeleteNoteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedOverviewNoteId, overviewNoteEditMode, confirmDeleteNoteId, confirmDeleteTaskId]);

  useEffect(() => {
    try { localStorage.setItem('owa_course_note_highlights', JSON.stringify(overviewNoteHighlights)); } catch { /* cuota */ }
  }, [overviewNoteHighlights]);

  const toggleHighlight = (id: string) => {
    setOverviewNoteHighlights(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // PDF preview modal
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewName, setPdfPreviewName] = useState('');
  const [viewingMat, setViewingMat] = useState<SubjectMaterial | null>(null);

  // Inline audio player
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setAudioProgress(a.currentTime);
    const onDur = () => setAudioDuration(a.duration || 0);
    const onEnd = () => { setPlayingAudioId(null); setAudioProgress(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('loadedmetadata', onDur); a.removeEventListener('ended', onEnd); };
  }, []);

  // Image preview modal
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offX: 0, offY: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setPreviewZoom(z => {
      const next = Math.max(1, Math.min(2.5, z + delta));
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, offX: panOffset.x, offY: panOffset.y };
  }, [panOffset]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    const limit = previewZoom <= 1 ? 0 : Math.max(20, (previewZoom - 1) * 300);
    setPanOffset({
      x: Math.max(-limit, Math.min(limit, panStartRef.current.offX + dx)),
      y: Math.max(-limit, Math.min(limit, panStartRef.current.offY + dy)),
    });
  }, [isPanning, previewZoom]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);



  const [confirmDelToolMat, setConfirmDelToolMat] = useState<{ id: string; name: string } | null>(null);
  const [moveToGroupMat, setMoveToGroupMat] = useState<{ id: string; name: string } | null>(null);
  // Grupos dentro del tema (Herramientas): separan materiales por carpeta lógica
  const [topicGroupModal, setTopicGroupModal] = useState<{ mode: 'create' | 'rename'; orig?: string } | null>(null);
  const [confirmDelGroup, setConfirmDelGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [activeToolGroup, setActiveToolGroup] = useState<string>('todos');

  // Persist per-course route (tab/view/topic/group) so each course reopens where it was left
  useEffect(() => {
    if (!selectedCourseId) return;
    // No guardar hasta que la restauración de ESTE curso se haya aplicado
    // (evita escribir estado mezclado del curso anterior sobre la clave del nuevo)
    if (routeRestoredForRef.current !== selectedCourseId) return;
    try {
        localStorage.setItem(`owa_course_route_${selectedCourseId}`, JSON.stringify({ tab: activeTab, view: currentView, topicId: activeTopicId, groupId: selectedGroupId, toolGroup: activeToolGroup, overviewMode }));
    } catch { /* ignore */ }
  }, [selectedCourseId, activeTab, currentView, activeTopicId, selectedGroupId, activeToolGroup, overviewMode]);
  // Nodos de herramienta especializados: cada herramienta es UN bloque del tema
  // (SubjectMaterial con toolMode) cuyo content es JSON con todo su interior.
  const [deckEditor, setDeckEditor] = useState<{ mode: ToolDeckMode; mat?: SubjectMaterial } | null>(null);
  // Ejecución de una herramienta: SIEMPRE dentro del panel del tema (reemplaza la cuadrícula)
  const [deckRunner, setDeckRunner] = useState<SubjectMaterial | null>(null);
  const closeDeckRunner = () => setDeckRunner(null);
  const saveDeck = (mode: ToolDeckMode, name: string, color: string, content: string) => {
    const editing = deckEditor?.mat;
    if (editing) {
      updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic?.id ? { ...t, materials: (safeArr(t.materials)).map(m => m.id === editing.id ? { ...m, name, title: name, color, content } : m) } : t) } as any);
      toast.success('Bloque actualizado');
    } else {
      const meta = DECK_META[mode];
      const newMat = { id: Math.random().toString(36).slice(2), type: mode === 'quizDeck' ? 'quiz' : 'concept', name, title: name, color, content, toolMode: mode, ...(pendingGroupNameRef.current ? { groupName: pendingGroupNameRef.current } : {}) } as any;
      updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic?.id ? { ...t, materials: [...(safeArr(t.materials)), newMat] } : t) } as any);
      toast.success(`${meta.label} añadido: vive como un bloque del tema`);
    }
    setDeckEditor(null);
  };

  // Refs
  const courseCoverInputRef = useRef<HTMLInputElement>(null);
  const groupCoverInputRef = useRef<HTMLInputElement>(null);

  const course = useMemo(() => {
    const base = courses.find(c => c && c.id === selectedCourseId) || courses[0];
    if (!base) return {} as Course;
    return {
      ...base,
      studyTopics: (Array.isArray(base.studyTopics) ? base.studyTopics : []).filter((t: any) => !!t && typeof t === 'object').map((t: any) => ({
        ...t,
        materials: (Array.isArray(t.materials) ? t.materials : []).filter((m: any) => !!m && typeof m === 'object'),
        flashcards: (Array.isArray(t.flashcards) ? t.flashcards : []).filter((f: any) => !!f && typeof f === 'object'),
        recordings: (Array.isArray(t.recordings) ? t.recordings : []).filter((r: any) => !!r && typeof r === 'object'),
      })),
      groups: (Array.isArray(base.groups) ? base.groups : []).filter((g: any) => !!g && typeof g === 'object'),
      topicTagDefs: (Array.isArray(base.topicTagDefs) ? base.topicTagDefs : []).filter((d: any) => !!d && typeof d === 'object'),
    } as Course;
  }, [courses, selectedCourseId]);

  const matMenu = useMaterialMenu((m) => toast.error(m));

  // ── Selección de materiales por presión larga (clic derecho sostenido ≥550ms) ──
  // Sostener = seleccionar (borde animado). Clic derecho normal tras seleccionar
  // = menú con "Abrir seleccionados". Esc o abrir un material limpia la selección.
  const [selMats, setSelMats] = useState<Set<string>>(new Set());
  const matKey = (m: SubjectMaterial) => m.id || m.dataUrl || m.name || '';
  const clearSelMats = useCallback(() => setSelMats(new Set()), []);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelMats(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [clearSelMats]);
  const openSelectedMats = useCallback(() => {
    if (!course) return;
    const all: SubjectMaterial[] = [];
    (safeArr(course.studyTopics)).forEach((t: any) => safeArr(t.materials).forEach((mm: any) => all.push(mm)));
    const targets = all.filter(mm => selMats.has(matKey(mm)) && !!mm.dataUrl);
    if (targets.length === 0) { toast.error('Ninguno de los seleccionados tiene archivo o enlace'); return; }
    targets.forEach(mm => handleOpenResource(mm));
    toast.success(`Abriendo ${targets.length} recurso(s) seleccionado(s)`);
    clearSelMats();
  }, [course, selMats, clearSelMats]);
  const toggleSelMat = useCallback((id: string) => {
    setSelMats(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  // Clic derecho sobre materiales: UNA sola interacción. El menú abre al
  // instante con "Seleccionar / Quitar de la selección" y, si hay selección,
  // "Abrir seleccionados (N)". preventDefault siempre: el menú nativo del
  // navegador no interfiere nunca.
  const matRmb = useCallback((e: React.MouseEvent, m: SubjectMaterial, buildMenu: () => Parameters<ReturnType<typeof useMaterialMenu>['openMenu']>[1]) => {
    e.preventDefault();
    e.stopPropagation();
    const extra: Parameters<ReturnType<typeof useMaterialMenu>['openMenu']>[1] = buildMenu();
    matMenu.openMenu(e, {
      ...extra,
      onToggleSelect: () => toggleSelMat(matKey(m)),
      isSel: selMats.has(matKey(m)),
      onOpenSelected: selMats.size > 0 ? openSelectedMats : undefined,
      selectedCount: selMats.size,
    });
  }, [matMenu, selMats, openSelectedMats, toggleSelMat, matKey]);

  useEffect(() => {
    if (course) {
      setEditCourseName(course.name);
      setEditCourseCover(course.coverUrl || course.coverImage);setEditCourseOriginal(course.coverOriginal);setEditCourseCrop(course.coverCrop);
      setEditCourseTeacher(course.teacher || course.teacherName || '');
    }
  }, [selectedCourseId, course?.name, course?.coverUrl, course?.coverImage, course?.teacher, course?.teacherName,course?.coverOriginal,course?.coverCrop]);

  // Save last active tab per course to localStorage for hub recall
  useEffect(() => {
    if (selectedCourseId && activeTab !== 'overview') {
      try {
        const raw = localStorage.getItem('owa_last_course_tab') || '{}';
        const map = JSON.parse(raw);
        map[selectedCourseId] = activeTab;
        try { localStorage.setItem('owa_last_course_tab', JSON.stringify(map)); } catch { /* cuota */ }
      } catch {}
    }
  }, [selectedCourseId, activeTab]);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (noteMenuTarget) { setNoteMenuTarget(null); return; }
        if (notasTabMenuTarget) { setNotasTabMenuTarget(null); return; }
        if (deckEditor) { setDeckEditor(null); return; }
        if (deckRunner) { closeDeckRunner(); return; }
        if (topicGroupModal) { setTopicGroupModal(null); return; }
        if (moveToGroupMat) { setMoveToGroupMat(null); return; }
        if (confirmDelToolMat) { setConfirmDelToolMat(null); return; }
        if (confirmDelGroup) { setConfirmDelGroup(null); return; }
        if (showAddLinkModal) { setShowAddLinkModal(false); return; }
        if (showMaterialModal) setShowMaterialModal(false);
        else if (showFlashcardModal) setShowFlashcardModal(false);
        else if (showGroupModal) setShowGroupModal(false);
        else if (showTopicModal) setShowTopicModal(false);
        else if (showEditCourse) setShowEditCourse(false);
        else if (reviewing) { setReviewing(false); setReviewFlipped(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMaterialModal, showFlashcardModal, showGroupModal, showTopicModal, showEditCourse, noteMenuTarget, notasTabMenuTarget, reviewing, deckEditor, deckRunner, topicGroupModal, moveToGroupMat, confirmDelToolMat, confirmDelGroup, showAddLinkModal]);

  // Close note menus on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (noteMenuTarget && noteMenuRef.current && !noteMenuRef.current.contains(e.target as Node)) {
        setNoteMenuTarget(null);
      }
      if (notasTabMenuTarget && notasTabMenuRef.current && !notasTabMenuRef.current.contains(e.target as Node)) {
        setNotasTabMenuTarget(null);
      }
    };
    if (noteMenuTarget || notasTabMenuTarget) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [noteMenuTarget, notasTabMenuTarget]);

  const activeTopic = useMemo(() => {
    if (!course || !activeTopicId) return null;
    return (safeArr(course.studyTopics)).find(t => t.id === activeTopicId) || null;
  }, [course, activeTopicId]);

  // Topic content items (flashcards + materials + recordings) for search/filter.
  // Los recursos marcados generalOnly viven en la vista general del modo
  // estudio: dentro de un tema NO se muestran (aunque estén hospedados en él).
  const topicItems = useMemo(() => {
    const mats = safeArr(activeTopic?.materials).filter(m => !(m as any)?.generalOnly);
    const fcs = safeArr(activeTopic?.flashcards);
    const recs = safeArr(activeTopic?.recordings);
    return [
      ...fcs.map(fc => ({ id: fc.id, type: 'flashcard' as const, item: fc })),
      ...mats.map(m => ({ id: m.id, type: m.type as MaterialType, item: m })),
      ...recs.map(r => ({ id: r.id, type: 'recording' as const, item: r })),
    ];
  }, [activeTopic]);

  const topicFiltered = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    return topicItems.filter(entry => {
      if (activeTagFilter && !((entry.item.tagIds as string[]) || []).includes(activeTagFilter)) return false;
      if (!q) return true;
      const it = entry.item as any;
      const text = [it.question, it.answer, it.title, it.name, it.word, it.content, it.meaning, it.description, it.clarification].filter(Boolean).join(' ');
      return fuzzyMatch(text, topicSearch);
    });
  }, [topicItems, topicSearch, activeTagFilter]);

  // Course tasks
  const coursePalette=useCoverPalette(course?.coverUrl||course?.coverImage);
  const courseTasks = useMemo(() => tasks.filter(t => !!t && typeof t === 'object' && t.course === course?.name), [tasks, course]);
  const courseTaskStats = useMemo(() => {
    const total = courseTasks.length;
    const done = courseTasks.filter(t => t.status === 'completado').length;
    const pending = courseTasks.filter(t => t.status === 'inicio').length;
    const progress = courseTasks.filter(t => t.status === 'progreso').length;
    return { total, done, pending, progress, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [courseTasks]);
  const pendingTasks = useMemo(() => courseTasks.filter(t => t.status !== 'completado'), [courseTasks]);

  // Course notes
  const courseNotes = useMemo(() => notes.filter(n => !!n && typeof n === 'object' && n.course === course?.name && !n.deletedAt), [notes, course]);
  const filteredCourseNotes = useMemo(() => {
    return showCourseNotesInOverview ? courseNotes : courseNotes.filter(n => n.isCoursePrivate);
  }, [courseNotes, showCourseNotesInOverview]);
  const sortedIds = useMemo(() => {
    const arr = [...filteredCourseNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr.map(n => n.id);
  }, [filteredCourseNotes]);

  const handleDeleteImage = useCallback(() => {
    if (!selectedOverviewNoteId || !previewImageSrc) return;
    const note = filteredCourseNotes.find(n => n.id === selectedOverviewNoteId);
    if (!note || !note.content) { setShowImagePreview(false); return; }
    const temp = document.createElement('div');
    temp.innerHTML = note.content;
    const imgs = temp.querySelectorAll('img');
    for (const img of imgs) {
      if (img.getAttribute('src') === previewImageSrc) {
        img.remove();
        break;
      }
    }
    const newContent = temp.innerHTML;
    if (newContent !== note.content) updateNote(note.id, { content: newContent });
    setShowImagePreview(false);
    setPreviewZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [selectedOverviewNoteId, previewImageSrc, filteredCourseNotes, updateNote]);



  const expandedFirst = useMemo(() => {
    const arr = [...filteredCourseNotes].sort((a, b) => {
      if (a.id === selectedOverviewNoteId) return -1;
      if (b.id === selectedOverviewNoteId) return 1;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr;
  }, [filteredCourseNotes, selectedOverviewNoteId]);
  const filteredNotes = useMemo(() => {
    if (!notesSearch.trim()) return courseNotes;
    return courseNotes.filter(n => fuzzyMatch(n.title || '', notesSearch) || fuzzyMatch(n.content || '', notesSearch));
  }, [courseNotes, notesSearch]);
  const sortedNotes = useMemo(() => {
    return [...courseNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [courseNotes]);
  const allCourseTags = useMemo(() => {
    const s = new Set<string>();
    courseNotes.forEach(n => n.tags?.forEach((t: string) => s.add(t)));
    try { JSON.parse(localStorage.getItem("owa_created_tags") || "[]").forEach((t: string) => s.add(t)); } catch {}
    if (course?.name) s.add(course.name);
    return Array.from(s);
  }, [courseNotes, course]);

  // Course resources (from all topics)
  const allCourseMaterials = useMemo(() => {
    const mats: SubjectMaterial[] = [];
    (Array.isArray(course?.studyTopics) ? course!.studyTopics : []).forEach(t => {
      if (!t || typeof t !== 'object') return;
      (Array.isArray(t.materials) ? t.materials : []).forEach(m => {
        if (!m || typeof m !== 'object') return;
        mats.push({ ...m, _topicTitle: t.title } as SubjectMaterial & { _topicTitle: string });
      });
    });
    return mats.filter(m => m.type === 'resource' && !(m as any).topicOnly);
  }, [course]);

  // --- Handlers ---
  const handleEditCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setEditEditorSrc(event.target?.result as string); };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleEditCoverConfirm = (dataUrl: string,crop:BannerCrop) => {
    setEditCourseOriginal(previous=>previous||editEditorSrc||undefined);setEditCourseCrop(crop);
    setEditCourseCover(dataUrl);
    setEditEditorSrc(null);
    toast.success('Imagen aplicada');
  };

  const handleSaveCourseSettings = () => {
    if (!editCourseName.trim()) return;
    updateCourse(course.id, { name: editCourseName.trim(), coverImage: editCourseCover, coverUrl: editCourseCover,coverOriginal:editCourseOriginal,coverCrop:editCourseCrop, color: editCourseColor, teacher: editCourseTeacher.trim() || undefined, teacherName: editCourseTeacher.trim() || undefined });
    setShowEditCourse(false);
    toast.success('Guardado');
  };

  const handleConfirmDeleteCourse = () => {
    if (deleteConfirmName.trim() !== course.name) return;
    deleteCourse(course.id);
    setShowDeleteConfirm(false);
    setShowEditCourse(false);
    setDeleteConfirmName('');
    setCurrentView('overview');
    setOverviewMode('tareas_notas');
    toast.success('Asignatura eliminada');
  };

  // --- Topic CRUD ---
  const handleAddTopic = () => {
    if (!topicName.trim()) return;
    const current = safeArr(course.studyTopics);
    if (editingTopicId) {
      updateCourse(course.id, { studyTopics: current.map(t => t.id === editingTopicId ? { ...t, title: topicName.trim() } : t) });
      toast.success('Tema actualizado');
    } else {
      updateCourse(course.id, { studyTopics: [...current, { id: Math.random().toString(), title: topicName.trim(), status: 'pending' as const, createdAt: Date.now(), reviewLevel: 0, nextReview: Date.now(), materials: [], groupId: selectedGroupId || undefined }] });
      toast.success('Tema creado');
    }
    setTopicName(''); setEditingTopicId(null); setShowTopicModal(false);
  };

  const handleDeleteTopic = (id: string) => {
    const current = safeArr(course.studyTopics);
    updateCourse(course.id, { studyTopics: current.filter(t => t.id !== id) });
    toast.success('Tema eliminado');
  };

  // --- Group CRUD ---
  const handleSaveGroup = () => {
    if (!groupName.trim()) return;
    const currentGroups = safeArr(course.groups);
    let updatedGroups = [...currentGroups];
    if (editingGroupId) updatedGroups = updatedGroups.map(g => g.id === editingGroupId ? { ...g, name: groupName.trim(), image: groupCover } : g);
    else updatedGroups.push({ id: editingGroupId || Math.random().toString(), name: groupName.trim(), image: groupCover, createdAt: Date.now() });
    updateCourse(course.id, { groups: updatedGroups });
    setGroupName(''); setGroupCover(undefined); setEditingGroupId(null); setShowGroupModal(false);
    toast.success(editingGroupId ? 'Agrupacion actualizada' : 'Agrupacion creada');
  };

  const startEditGroup = (g: SubjectGroup) => {
    setEditingGroupId(g.id); setGroupName(g.name); setGroupCover(g.image); setShowGroupModal(true);
  };
  const handleDeleteGroup = (groupId: string) => {
    const currentGroups = safeArr(course.groups);
    updateCourse(course.id, { groups: currentGroups.filter(g => g.id !== groupId), studyTopics: (safeArr(course.studyTopics)).map(t => t.groupId === groupId ? { ...t, groupId: undefined } : t) });
    toast.success('Agrupación eliminada');
  };

  // --- Materials ---
  const handleAddMaterialClick = (type: MaterialType, colIdx: number) => {
    if (type === 'resource') { setMaterialColIndex(colIdx); generalOnlyRef.current = false; handleAddFileBtn(undefined, colIdx); return; }
    setMaterialType(type); setMaterialColIndex(colIdx); setEditingMaterial(null); resetForm(); setShowMaterialModal(true);
  };

  const openToolCreator = (mode: StudyTool) => {
    if (mode === 'flashcards') { openFlashcardModal(); return; }
    setToolFields({});
    setToolModal({ mode: mode as ToolCreatorMode, editingId: null });
  };

  // Info-first: al pulsar una técnica se abre su Teoría (qué es · cómo · evidencia)
  const startEditToolMaterial = (mat: SubjectMaterial) => {
    // Los nodos de herramienta especializados se editan en SU propio asistente (con su contenido cargado)
    const dm = mat.toolMode as ToolDeckMode | undefined;
    if (dm && (DECK_META as any)[dm]) { setDeckEditor({ mode: dm, mat }); return; }
    const mode = mat.toolMode as ToolCreatorMode | undefined;
    if (mode && TOOL_CREATOR_META[mode]) {
      const f: Record<string, string> = {};
      if (mode === 'quizzes' || mode === 'matching') { f.title = mat.title || ''; f.a = mat.question || ''; f.b = mat.answer || ''; }
      if (mode === 'feynman') { f.title = mat.title || ''; f.a = mat.word || ''; f.b = mat.meaning || ''; }
      if (mode === 'blurting' || mode === 'cloze') { f.title = mat.title || ''; f.body = mat.content || ''; }
      if (mode === 'categorization') { f.title = mat.title || ''; f.content = mat.content || ''; }
      if (mode === 'mnemonics') { f.title = mat.title || ''; f.content = mat.content || ''; }
      setToolFields(f);
      setToolModal({ mode, editingId: mat.id });
      return;
    }
    startEditMaterial(mat);
  };

  const handleSaveToolModal = () => {
    if (!toolModal || !activeTopic) return;
    const f = toolFields;
    if (!f.title?.trim()) { toast.error('Escribe un título'); return; }
    let payload: Partial<SubjectMaterial> = {};
    switch (toolModal.mode) {
      case 'quizzes': case 'matching':
        if (!f.a?.trim() || !f.b?.trim()) { toast.error('Completa los dos campos'); return; }
        payload = { title: f.title.trim(), question: f.a.trim(), answer: f.b.trim() };
        break;
      case 'blurting': case 'cloze':
        if (!f.body?.trim()) { toast.error('Escribe el contenido'); return; }
        payload = { title: f.title.trim(), content: f.body.trim() };
        break;
      case 'feynman':
        if (!f.a?.trim() || !f.b?.trim()) { toast.error('Completa el concepto y la explicación'); return; }
        payload = { title: f.title.trim(), word: f.a.trim(), meaning: f.b.trim() };
        break;
      case 'categorization':
        payload = { title: f.title.trim(), content: (f.content || '').trim() };
        break;
      case 'mnemonics':
        payload = { title: f.title.trim(), content: (f.content || '').trim() };
        break;
      default:
        payload = { title: f.title.trim(), content: (f.body || '').trim() };
        break;
    }
    const type = TOOL_MATERIAL_TYPE[toolModal.mode];
    const meta = TOOL_CREATOR_META[toolModal.mode];
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(topic => {
        if (topic.id !== activeTopic.id) return topic;
        const ms = safeArr(topic.materials);
        return {
          ...topic,
          materials: toolModal.editingId
            ? ms.map(m => m.id === toolModal.editingId ? { ...m, ...payload, toolMode: toolModal.mode } : m)
            : [...ms, { id: Math.random().toString(), type, createdAt: Date.now(), columnIndex: 0, ...payload, toolMode: toolModal.mode } as SubjectMaterial],
        };
      }),
    });
    setToolModal(null); setToolFields({});
    toast.success(toolModal.editingId ? 'Actualizado' : `${meta.name} creado`);
  };

  const estudioFileInputRef = useRef<HTMLInputElement>(null);

  // Añade un material a un tema garantizando que SIEMPRE aterrice visible:
  // si llega un topicId inválido/unset usa el primer tema y, si el curso NO tiene
  // temas (caso "no aparece nada al subir"), crea el tema "Materiales" al vuelo.
  const withMaterial = useCallback((tid: string | undefined, mat: SubjectMaterial, colIndex: number) => {
    const ts = (safeArr(course.studyTopics)).filter(t => !!t && typeof t === 'object');
    const target = tid ? ts.find(t => t.id === tid) : undefined;
    if (target) return ts.map(t => t.id === target.id ? { ...t, materials: [...(safeArr(t.materials)), mat] } : t);
    if (ts.length) return ts.map((t, i) => i === 0 ? { ...t, materials: [...(safeArr(t.materials)), mat] } : t);
    return [{ id: Math.random().toString(), title: 'Materiales', status: 'pending' as const, createdAt: Date.now(), reviewLevel: 0, nextReview: Date.now(), materials: [mat], groupId: selectedGroupId || undefined }];
  }, [course, selectedGroupId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, overrideTopicId?: string) => {
    const file = e.target.files?.[0]; if (!file) { generalOnlyRef.current = false; return; }
    // En vista general (generalOnlyRef) se IGNORA el tema activo aunque exista
    // (puede ser obsoleto): el material va al apartado general, no a un tema.
    const tid = generalOnlyRef.current ? undefined : (overrideTopicId || activeTopic?.id);
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const newMat: SubjectMaterial = { id: Math.random().toString(), type: 'resource', createdAt: Date.now(), columnIndex: materialColIndex, name: file.name, fileType: file.type, dataUrl: url, ...(topicOnlyRef.current ? { topicOnly: true } : {}), ...(generalOnlyRef.current ? { generalOnly: true } : {}) } as unknown as SubjectMaterial;
    topicOnlyRef.current = false;
    generalOnlyRef.current = false;
    pendingGroupNameRef.current = undefined;
    updateCourse(course.id, { studyTopics: withMaterial(tid, newMat, materialColIndex) });
    toast.success('Archivo subido');
    if (e.target) e.target.value = '';
  };

  const handleAddFileBtn = useCallback(async (topicId?: string, colIndex?: number) => {
    if (isTauri()) {
      let r: { path: string; name: string } | null;
      try { r = await pickAndPersistFile(); }
      catch { generalOnlyRef.current = false; toast.error('No se pudo abrir el selector de archivos'); return; }
      if (!r) { generalOnlyRef.current = false; return; }
      const tid = generalOnlyRef.current ? undefined : (topicId || activeTopic?.id);
      const newMat: SubjectMaterial = { id: Math.random().toString(), type: 'resource', createdAt: Date.now(), columnIndex: colIndex ?? materialColIndex, name: r.name, dataUrl: r.path, ...(topicOnlyRef.current ? { topicOnly: true } : {}), ...(generalOnlyRef.current ? { generalOnly: true } : {}), ...(pendingGroupNameRef.current ? { groupName: pendingGroupNameRef.current } : {}) } as unknown as SubjectMaterial;
      topicOnlyRef.current = false;
      generalOnlyRef.current = false;
      pendingGroupNameRef.current = undefined;
      updateCourse(course.id, { studyTopics: withMaterial(tid, newMat, colIndex ?? materialColIndex) });
      toast.success('Archivo subido');
      return;
    }
    if (colIndex !== undefined) setMaterialColIndex(colIndex);
    resourceInputRef.current?.click();
  }, [activeTopic?.id, course, materialColIndex, updateCourse, withMaterial]);

  const handleAddLink = () => {
    if (!addLinkUrl.trim()) return;
    const url = addLinkUrl.trim();
    const name = addLinkName.trim() || url;
    const newMat: SubjectMaterial = { id: Math.random().toString(), type: 'resource', createdAt: Date.now(), columnIndex: 0, name, dataUrl: url, ...(addLinkTargetTopic ? { topicOnly: true } : { generalOnly: true }), ...(addLinkTargetTopic && pendingGroupNameRef.current ? { groupName: pendingGroupNameRef.current } : {}) } as unknown as SubjectMaterial;
    pendingGroupNameRef.current = undefined;
    updateCourse(course.id, { studyTopics: withMaterial(addLinkTargetTopic, newMat, 0) });
    setAddLinkUrl(''); setAddLinkName(''); setAddLinkTargetTopic(undefined); setShowAddLinkModal(false);
    toast.success(addLinkTargetTopic ? 'Enlace agregado al tema' : 'Enlace agregado');
  };

  const handleSaveEditLink = () => {
    if (!editLinkId || !editLinkUrl.trim()) return;
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => ({
        ...t,
        materials: (safeArr(t.materials)).map(m => m.id === editLinkId ? { ...m, name: editLinkName.trim() || editLinkUrl.trim(), dataUrl: editLinkUrl.trim() } : m)
      }))
    });
    setEditLinkId(null); setEditLinkUrl(''); setEditLinkName('');
    toast.success('Enlace actualizado');
  };

  const handleSaveMaterial = () => {
    if (!materialType || !activeTopic) return;
    const { name, clarification, title, content, word, meaning, question, answer, description, image } = materialForm;
    let payload: Partial<SubjectMaterial> = {};
    switch (materialType) {
      case 'formula': if (!name.trim()) return; payload = { name: name.trim(), clarification: clarification.trim(), image }; break;
      case 'concept': if (!title.trim()) return; payload = { title: title.trim(), content: content.trim() }; break;
      case 'key-data': if (!content.trim()) return; payload = { title: title.trim(), content: content.trim() }; break;
      case 'meaning': if (!word.trim() || !meaning.trim()) return; payload = { word: word.trim(), meaning: meaning.trim() }; break;
      case 'quiz': if (!question.trim() || !answer.trim()) return; payload = { question: question.trim(), answer: answer.trim() }; break;
      case 'procedure': if (!title.trim() || !content.trim()) return; payload = { title: title.trim(), description: description.trim(), content: content.trim(), image }; break;
    }
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => {
        if (t.id === activeTopic.id) {
          let ms = safeArr(t.materials);
          if (editingMaterial) ms = ms.map(m => m.id === editingMaterial.id ? { ...m, ...payload } : m);
          else ms = [...ms, { id: Math.random().toString(), type: materialType, createdAt: Date.now(), columnIndex: materialColIndex, ...payload } as SubjectMaterial];
          return { ...t, materials: ms };
        }
        return t;
      })
    });
    setShowMaterialModal(false); toast.success(editingMaterial ? 'Actualizado' : 'Guardado');
  };

  const startEditMaterial = (mat: SubjectMaterial) => {
    setEditingMaterial(mat); setMaterialType(mat.type); setMaterialColIndex(mat.columnIndex);
    setForm({ name: mat.name || '', clarification: mat.clarification || '', title: mat.title || '', content: mat.content || '', word: mat.word || '', meaning: mat.meaning || '', question: mat.question || '', answer: mat.answer || '', description: mat.description || '', image: mat.image });
    setShowMaterialModal(true);
  };

  const handleDeleteMaterial = (mat: SubjectMaterial) => {
    setConfirmDelToolMat({ id: mat.id, name: mat.name || mat.title || 'Material' });
  };
  const confirmDeleteMaterialNow = () => {
    if (!confirmDelToolMat || !activeTopic) return;
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic.id ? { ...tp, materials: (safeArr(tp.materials)).filter(m => m.id !== confirmDelToolMat.id) } : tp) });
    toast.success('Material eliminado');
    setConfirmDelToolMat(null);
  };

  const renameToolGroup = (oldV: string, newV: string) => {
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? { ...tp, toolGroups: (((tp as any).toolGroups || []) as string[]).map(x => x === oldV ? newV : (x.startsWith(oldV + '/') ? newV + x.slice(oldV.length) : x)), materials: (safeArr(tp.materials)).map(m => { const gn = (m as any).groupName || ''; if (gn === oldV) return { ...m, groupName: newV }; if (gn.startsWith(oldV + '/')) return { ...m, groupName: newV + gn.slice(oldV.length) }; return m; }) } : tp) } as any);
    if (activeToolGroup === oldV) setActiveToolGroup(newV);
  };
  const deleteToolGroup = (g: string) => {
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? {
      ...tp,
      toolGroups: ((((tp as any).toolGroups || []) as string[])).filter(x => x !== g && !x.startsWith(g + '/')),
      materials: (safeArr(tp.materials)).filter(m => { const gn = (m as any).groupName || ''; return gn !== g && !gn.startsWith(g + '/'); }),
      // Las flashcards del grupo también se eliminan (antes quedaban huérfanas)
      flashcards: (safeArr(tp.flashcards)).filter(f => { const gn = ((f as any).groupName || '') as string; return gn !== g && !gn.startsWith(g + '/'); }),
    } : tp) } as any);
    if (activeToolGroup === g || activeToolGroup.startsWith(g + '/')) setActiveToolGroup('todos');
    toast.success('Carpeta eliminada con su contenido');
  };
  const ungroupMaterial = (matId: string) => {
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? { ...tp, materials: (safeArr(tp.materials)).map(m => m.id === matId ? ({ ...m, groupName: undefined } as any) : m) } : tp) } as any);
    toast.success('Movido al tema principal');
  };
  const handleDeleteResourceFromOverview = (matId: string) => {
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(t => ({ ...t, materials: (safeArr(t.materials)).filter(m => m.id !== matId) })) });
    toast.success('Material eliminado');
    setConfirmDeleteMatId(null);
  };

  // onMoved de openFileSmart: el archivo fue hallado en OTRA carpeta ? actualiza su ruta en el material
  const handleMatMoved = (matId: string, newPath: string) => {
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(t => ({ ...t, materials: (safeArr(t.materials)).map(m => m.id === matId ? { ...m, dataUrl: newPath } : m) })) });
    toast.success('Material actualizado a su nueva ubicación');
  };

  const handleOpenResource = (mat: SubjectMaterial) => {
    if (!mat.dataUrl) return;
    // Idéntico a Materiales de curso: openFileSmart resuelve nativo (ruta real,
    // editable), http → navegador del sistema, media → PiP. Sin visor interno,
    // sin copias asset. Los enlaces con predeterminado usan ESE navegador y los
    // PDF con app predeterminada usan ESA app (curso > global). Sin errores.
    if (!localPathFromUrl(mat.dataUrl) && /^https?:\/\//i.test(mat.dataUrl)) {
      const url = mat.dataUrl;
      const name = mat.name || 'Archivo';
      const id = mat.id;
      (async () => {
        try {
          const { resolveDefaultBrowserExe, openUrlInBrowser } = await import('../../lib/browsers');
          const exe = await resolveDefaultBrowserExe(course.id);
          if (exe) { await openUrlInBrowser(exe, url); return; }
        } catch { /* cae al flujo normal */ }
        openFileSmart(url, name, { onError: (m) => toast.error(m), onMoved: (np) => handleMatMoved(id, np) }).catch(() => toast.error('No se pudo abrir el recurso'));
      })();
      return;
    }
    if (/\.pdf($|[?#])/i.test(mat.dataUrl)) {
      const id = mat.id;
      const name = mat.name || 'Archivo';
      const pdfUrl: string = mat.dataUrl;
      (async () => {
        try {
          const { resolveDefaultPdfAppExe, openUrlInBrowser } = await import('../../lib/browsers');
          const exe = await resolveDefaultPdfAppExe(course.id);
          if (exe && exe !== 'sys') {
            const target = await resolveExternalResource(pdfUrl, name, path => handleMatMoved(id, path));
            await openUrlInBrowser(exe, target);
            return;
          }
        } catch { /* cae al flujo normal */ }
        openFileSmart(pdfUrl, name, { onError: (m) => toast.error(m), onMoved: (np) => handleMatMoved(id, np) }).catch(() => toast.error('No se pudo abrir el recurso'));
      })();
      return;
    }
    openFileSmart(mat.dataUrl, mat.name || 'Archivo', { onError: (m) => toast.error(m), onMoved: (np) => handleMatMoved(mat.id, np) }).catch(() => toast.error('No se pudo abrir el recurso'));
  };

  const setTopicReviewLevel = (topicId: string, level: number) => {
    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(t => t.id === topicId ? { ...t, reviewLevel: level, status: level >= 8 ? 'done' as const : 'studying' as const } : t) });
  };

  // --- Drag and Drop (long-press: mantener pulsado ~300ms en TODOS los elementos) ---
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } }));
  const [activeMatDragId, setActiveMatDragId] = useState<string | null>(null);
  const matDragSuppressRef = useRef(false);
  // Los materiales añadidos desde Herramientas (dentro de un tema) son de ecosistema
  // "tema": viven SOLO en su tema y NO aparecen en el panel Materiales del curso.
  const topicOnlyRef = useRef(false);
  // true = el alta viene de la vista GENERAL (overview modo estudio): el
  // material va al apartado general, no dentro de ningún tema.
  const generalOnlyRef = useRef(false);
  // Grupo destino para el siguiente material creado desde Herramientas
  const pendingGroupNameRef = useRef<string | undefined>(undefined);
  // Guard anti click-fantasma para la lista de materiales del tema: si hubo un
  // drag (reordenar), el click posterior NO debe abrir el enlace/material.
  const matLinkDragRef = useRef(false);
  const [activeTopicDragId, setActiveTopicDragId] = useState<string | null>(null);
  const [activeGroupDragId, setActiveGroupDragId] = useState<string | null>(null);
  const studySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const planSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } }));



  const handleTopicGridDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTopicDragId(null);
    const { active, over } = event;
    // Soltar sobre una carpeta → mover el material O herramienta dentro de ella
    const overGrpId = String((over as any)?.id || '');
    if (overGrpId.startsWith('grp-')) {
      const gName = overGrpId.slice(4);
      const activeId = active.id as string;
      const isMat = (safeArr(activeTopic?.materials)).some(m => m.id === activeId);
      const isFc = (safeArr(activeTopic?.flashcards)).some(f => f.id === activeId);
      const isRec = (safeArr(activeTopic?.recordings)).some(r => r.id === activeId);
      if (isMat) {
        updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? { ...tp, materials: (safeArr(tp.materials)).map(m => m.id === activeId ? ({ ...m, groupName: gName } as any) : m) } : tp) } as any);
        toast.success('Movido a ' + gName.split('/').pop());
      } else if (isFc) {
        updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? { ...tp, flashcards: (safeArr(tp.flashcards)).map(f => f.id === activeId ? ({ ...f, groupName: gName } as any) : f) } : tp) } as any);
        toast.success('Flashcard movida a ' + gName.split('/').pop());
      } else if (isRec) {
        updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? { ...tp, recordings: (safeArr(tp.recordings)).map(r => r.id === activeId ? ({ ...r, groupName: gName } as any) : r) } : tp) } as any);
        toast.success('Grabación movida a ' + gName.split('/').pop());
      }
      setActiveTopicDragId(null); return;
    }
    if (active.id === over?.id) return;
    const visible = topicFiltered;
    const ids = visible.map(e => e.id);
    const oldIdx = ids.indexOf(active.id as string);
    let newIdx = over ? ids.indexOf(over.id as string) : ids.length - 1;
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    const orderMap = new Map<string, number>(newOrder.map((id, i) => [id, i]));
    const rank = (id?: string) => (id && orderMap.has(id) ? orderMap.get(id)! : 999);
    const t = activeTopic;
    if (!t) return;
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === t.id ? {
        ...tp,
        flashcards: [...(safeArr(tp.flashcards))].sort((a, b) => rank(a.id) - rank(b.id)),
        materials: [...(safeArr(tp.materials))].sort((a, b) => rank(a.id) - rank(b.id)),
        recordings: [...(safeArr(tp.recordings))].sort((a, b) => rank(a.id) - rank(b.id)),
      } : tp),
    });
  }, [topicFiltered, activeTopic, course?.id, updateCourse]);

  const handleStudyMatDragEnd = useCallback((event: DragEndEvent) => {
    const d = event.delta ?? { x: 0, y: 0 };
    matDragSuppressRef.current = Math.abs(d.x) + Math.abs(d.y) > 4;
    setTimeout(() => { matDragSuppressRef.current = false; }, 200);
    setActiveMatDragId(null);
    const { active, over } = event;
    if (!over) {
      // Soltado fuera de cualquier destino: mover al final de la lista.
      const matIds = allCourseMaterials.filter(m => !!m).map(m => m.id);
      const oldIdx = matIds.indexOf(active.id as string);
      if (oldIdx < 0 || oldIdx === matIds.length - 1) return;
      const endOrder = [...matIds.filter(id => id !== active.id), active.id];
      updateCourse(course.id, {
        studyTopics: (safeArr(course.studyTopics)).map(t => {
          const reordered = (safeArr(t.materials)).sort((a, b) => {
            const ai = endOrder.indexOf(a.id), bi = endOrder.indexOf(b.id);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
          return t.id === activeTopic?.id ? { ...t, materials: reordered } : t;
        })
      });
      return;
    }
    if (active.id === over.id) return;
    const ids = allCourseMaterials.filter(m => !!m).map(m => m.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    updateCourse(course.id, {
      studyTopics: (safeArr(course.studyTopics)).map(t => {
        const reordered = (safeArr(t.materials)).sort((a, b) => {
          const ai = newOrder.indexOf(a.id), bi = newOrder.indexOf(b.id);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        return t.id === activeTopic?.id ? { ...t, materials: reordered } : t;
      })
    });
  }, [allCourseMaterials, activeTopic, course?.id, updateCourse]);

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    setActiveGroupDragId(null);
    const { active, over } = event;
    if (!over) {
      const currentGroups = safeArr(course.groups);
      const ids = currentGroups.map(g => g.id);
      const oldIdx = ids.indexOf(active.id as string);
      if (oldIdx < 0 || oldIdx === ids.length - 1) return;
      const newOrder = [...ids.filter(id => id !== active.id), active.id];
      const reordered = [...currentGroups].sort((a, b) => {
        const ai = newOrder.indexOf(a.id), bi = newOrder.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      updateCourse(course.id, { groups: reordered });
      return;
    }
    if (active.id === over.id) return;
    const currentGroups = safeArr(course.groups);
    const ids = currentGroups.map(g => g.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    const reordered = [...currentGroups].sort((a, b) => {
      const ai = newOrder.indexOf(a.id), bi = newOrder.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    updateCourse(course.id, { groups: reordered });
  }, [course?.id, course?.groups, updateCourse]);

  // Long-press drag & drop de los bloques de tema dentro de una agrupación
  const handleGroupTopicDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTopicDragId(null);
    const { active, over } = event;
    if (active.id === over?.id) return;
    const current = safeArr(course.studyTopics);
    const ids = current.map(t => t.id);
    const oldIdx = ids.indexOf(active.id as string);
    const groupSet = new Set(current.filter(t => t.groupId === selectedGroupId).map(t => t.id));
    let newIdx: number;
    if (over) {
      newIdx = ids.indexOf(over.id as string);
    } else {
      if (oldIdx < 0 || !groupSet.has(active.id as string)) return;
      const groupIds = current.filter(t => groupSet.has(t.id)).map(t => t.id);
      if (active.id === groupIds[groupIds.length - 1]) return;
      const newOrderEnd = [...ids.filter(id => id !== active.id)];
      const lastGroupId = groupIds[groupIds.length - 1];
      newOrderEnd.splice(newOrderEnd.indexOf(lastGroupId) + 1, 0, active.id as string);
      const reorderedEnd = [...current].sort((a, b) => {
        const inA = groupSet.has(a.id), inB = groupSet.has(b.id);
        if (inA !== inB) return inA ? -1 : 1;
        if (inA) return newOrderEnd.indexOf(a.id) - newOrderEnd.indexOf(b.id);
        return ids.indexOf(a.id) - ids.indexOf(b.id);
      });
      updateCourse(course.id, { studyTopics: reorderedEnd });
      return;
    }
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    const reordered = [...current].sort((a, b) => {
      const inA = groupSet.has(a.id), inB = groupSet.has(b.id);
      if (inA !== inB) return inA ? -1 : 1;
      if (inA) return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
      return ids.indexOf(a.id) - ids.indexOf(b.id);
    });
    updateCourse(course.id, { studyTopics: reordered });
  }, [course?.id, course?.studyTopics, selectedGroupId, updateCourse]);

  const notesDragRef = useRef(false);
  const tasksDragRef = useRef(false);

  const handleNoteDragEnd = (event: DragEndEvent) => {
    setTimeout(() => { notesDragRef.current = false; }, 80);
    if (notesSearch) return;
    const { active, over } = event;
    if (active.id === over?.id) return;
    const ids = sortedNotes.map(n => n.id);
    const oldIdx = ids.indexOf(active.id as string);
    let newIdx = over ? ids.indexOf(over.id as string) : ids.length - 1;
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
    const newIds = [...ids];
    const [moved] = newIds.splice(oldIdx, 1);
    newIds.splice(newIdx, 0, moved);
    reorderNotes(newIds);
  };

  const handleOverviewNoteDragEnd = (event: DragEndEvent) => {
    setTimeout(() => { notesDragRef.current = false; }, 80);
    const { active, over } = event;
    if (active.id === over?.id) return;
    const sorted = [...courseNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    const ids = sorted.map(n => n.id);
    const oldIdx = ids.indexOf(active.id as string);
    let newIdx = over ? ids.indexOf(over.id as string) : ids.length - 1;
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
    const newIds = [...ids];
    const [moved] = newIds.splice(oldIdx, 1);
    newIds.splice(newIdx, 0, moved);
    reorderNotes(newIds);
  };

  const buildTaskIds = (includeCompleted: boolean) => {
    const byOrder = (a: any, b: any) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
    return (includeCompleted
      ? [...courseTasks].sort((a, b) => {
          if (a.status === 'completado' && b.status !== 'completado') return 1;
          if (a.status !== 'completado' && b.status === 'completado') return -1;
          return byOrder(a, b);
        })
      : [...pendingTasks].sort(byOrder)).map(t => t.id);
  };

  const handleTaskDragEnd = (event: DragEndEvent, includeCompleted: boolean) => {
    setTimeout(() => { tasksDragRef.current = false; }, 80);
    const { active, over } = event;
    if (!over) return;
    const ids = buildTaskIds(includeCompleted);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
    reorderTasks(arrayMove(ids, oldIdx, newIdx));
  };

  // --- Task Handlers ---
  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !course) return;
    const dueDateTime = newTaskDueDate ? (newTaskDueTime ? `${newTaskDueDate}T${newTaskDueTime}` : newTaskDueDate) : undefined;
    addTask({ title: newTaskTitle.trim(), course: course.name, courseColor: course.color, priority: newTaskPriority, urgent: false, important: false, dueDate: dueDateTime, notes: newTaskDescription.trim() || '', estimatedMinutes: undefined });
    setNewTaskTitle(''); setNewTaskDescription(''); setNewTaskPriority('none'); setNewTaskDueDate(''); setNewTaskDueTime('');
    toast.success('Tarea añadida');
  };

  const handleToggleTask = (taskId: string) => {
    if (tasksDragRef.current) return;
    const task = courseTasks.find(t => t.id === taskId);
    if (!task) return;
    const nextStatus = task.status === 'inicio' ? 'progreso' as const : task.status === 'progreso' ? 'completado' as const : 'inicio' as const;
    updateTask(taskId, { status: nextStatus, completedAt: nextStatus === 'completado' ? new Date().toISOString() : undefined });
  };

  const handleBackTaskStatus = (taskId: string) => {
    const task = courseTasks.find(t => t.id === taskId);
    if (!task) return;
    const backStatus = task.status === 'completado' ? 'progreso' as const : task.status === 'progreso' ? 'inicio' as const : null;
    if (!backStatus) return;
    updateTask(taskId, { status: backStatus, completedAt: undefined });
    toast.success(backStatus === 'progreso' ? 'Estado retrocedido a Progreso' : 'Estado retrocedido a Inicio');
  };

  const handleSaveTaskTitle = () => {
    if (!editingTaskId || !editTaskTitle.trim()) return;
    updateTask(editingTaskId, { title: editTaskTitle.trim() });
    setEditingTaskId(null); setEditTaskTitle('');
    toast.success('Tarea actualizada');
  };

  // --- Note Handlers ---
  const handleSaveNoteData = (id: string, data: any) => {
    if (id === 'new') {
      addNote({ title: data.title, content: data.content, tags: data.tags || [course.name], folderId: '', isPinned: false, course: course.name, courseColor: course.color });
      setEditingNoteId(null);
    } else {
      updateNote(id, data);
    }
  };

  const handleCreateNote = () => {
    const courseFolder = noteFolders.find(f => f.courseId === course.id);
    const id = addNote({ title: '', content: '', tags: courseFolder ? [] : [course.name], folderId: courseFolder?.id || '', isPinned: false, course: course.name, courseColor: course.color });
    setEditingNoteId(id);
    setEditContent('');
    setSelectedNoteId(id);
  };

  const handleOverviewCreateNote = () => {
    if (!overviewNoteContent.trim() || !course) return;
    const content = `<p>${overviewNoteContent.trim()}</p>`;
    addNote({ title: '', content, tags: [course.name], folderId: '', isPinned: false, course: course.name, courseColor: course.color });
    setOverviewNoteContent('');
    setOverviewAddingNote(false);
    toast.success('Apunte creado');
  };

  const handleTogglePinNote = (id: string) => {
    const note = courseNotes.find(n => n.id === id);
    if (note) updateNote(id, { isPinned: !note.isPinned });
  };

  const handleNoteFormat = (cmd: string, value?: string) => {
    editContentRef.current?.focus();
    document.execCommand(cmd, false, value);
    scheduleNoteTrack();
  };

  const trackNoteFormats = () => {
    const sel = window.getSelection();
    const ed = editContentRef.current;
    if (!ed) return;
    let bold = false, italic = false, underline = false, strikeThrough = false;
    let insertUnorderedList = false, insertOrderedList = false;
    let heading1 = false, heading2 = false, heading3 = false, blockquote = false;
    if (sel && sel.rangeCount > 0 && ed.contains(sel.anchorNode)) {
      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      let el = node as HTMLElement | null;
      while (el && el !== ed) {
        const tag = el.tagName;
        if (tag === 'B' || tag === 'STRONG') bold = true;
        else if (tag === 'I' || tag === 'EM') italic = true;
        else if (tag === 'U') underline = true;
        else if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') strikeThrough = true;
        else if (tag === 'UL') insertUnorderedList = true;
        else if (tag === 'OL') insertOrderedList = true;
        else if (tag === 'H1') heading1 = true;
        else if (tag === 'H2') heading2 = true;
        else if (tag === 'H3') heading3 = true;
        else if (tag === 'BLOCKQUOTE') blockquote = true;
        el = el.parentElement;
      }
      bold = bold || document.queryCommandState('bold');
      italic = italic || document.queryCommandState('italic');
      underline = underline || document.queryCommandState('underline');
      strikeThrough = strikeThrough || document.queryCommandState('strikeThrough');
      insertUnorderedList = insertUnorderedList || document.queryCommandState('insertUnorderedList');
      insertOrderedList = insertOrderedList || document.queryCommandState('insertOrderedList');
    }
    setNoteActiveFormats({ bold, italic, underline, strikeThrough, insertUnorderedList, insertOrderedList, heading1, heading2, heading3, blockquote });
  };

  const scheduleNoteTrack = () => {
    if (noteTrackTimeout.current) clearTimeout(noteTrackTimeout.current);
    noteTrackTimeout.current = setTimeout(trackNoteFormats, 0);
  };

  useEffect(() => {
    if (!editingNoteId) return;
    const onSel = () => scheduleNoteTrack();
    document.addEventListener('selectionchange', onSel);
    document.addEventListener('keyup', onSel);
    document.addEventListener('mouseup', onSel);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('keyup', onSel);
      document.removeEventListener('mouseup', onSel);
      if (noteTrackTimeout.current) clearTimeout(noteTrackTimeout.current);
    };
  }, [editingNoteId]);

  const handleOverviewDeleteNote = (id: string) => {
    deleteNote(id);
    if (selectedOverviewNoteId === id) setSelectedOverviewNoteId(null);
    toast.success('Nota eliminada');
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    if (selectedNoteId === id) setSelectedNoteId(null);
    if (editingNoteId === id) setEditingNoteId(null);
    toast.success('Nota eliminada');
  };

  // --- Stats ---
  const topicMasteryStats = useMemo(() => {
    const pt = safeArr(course?.studyTopics);
    const total = pt.length;
    const mastered = pt.filter(t => t.reviewLevel >= 8).length;
    const progressPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, studying: pt.filter(t => t.reviewLevel > 0 && t.reviewLevel < 8).length, pending: pt.filter(t => t.reviewLevel === 0).length, totalMaterials: pt.reduce((s, t) => s + (t.materials?.length || 0), 0), progressPct };
  }, [course]);

  if (!course) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, gap: 12 }}>
        <GraduationCap size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Asignatura no encontrada</p>
        <button data-app-action="secondary" data-ui-control="" onClick={() => setNavigateTo('cursos')} style={{ height: 36, padding: '0 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Volver</button>
      </div>
    );
  }

  const parsedTopics = (safeArr(course.studyTopics)).filter(t => !!t && typeof t === 'object');
  const groups = (safeArr(course.groups)).filter(g => !!g && typeof g === 'object');
  const ungroupedTopics = parsedTopics.filter(t => !t.groupId);
  const topicTagDefs = course.topicTagDefs || [];

  // --- RENDER ---

  return (
    <div className="cursos-root-view" style={{ "--course-cover-accent":coursePalette?.accentColor||"var(--accent)", height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' } as React.CSSProperties}>
      {/* Content */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflowY: currentView === 'overview' ? 'hidden' : 'auto', overflowX: 'hidden' }}>
        {currentView === 'topic' && activeTopic ? (
          /* --- TOPIC VIEW with Big Banner --- */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Big banner */}
            <div className="course-context-banner" style={{ position: 'relative', height: 184, overflow: 'hidden', background: "var(--bg-surface)" }}>
              {(() => {
                const grp = groups.find(g => g.id === activeTopic.groupId);
                const imgSrc = grp?.image || course.coverUrl || course.coverImage;
                return imgSrc ? (
                  <><img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 1 }} /><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 60%)' }} /></>
                ) : <div style={{ position: 'absolute', inset: 0, background: "var(--bg-surface)" }} />;
              })()}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 36px', gap: 36 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
                  <h1 style={{ fontSize: 32, fontWeight: 500, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 2px 20px rgba(0,0,0,0.6)', lineHeight: 1.15 }}>{activeTopic.title}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.01em', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 2 }}>{course.name}</span>
                    {(() => { const g = groups.find(gr => gr.id === activeTopic.groupId); return g ? <><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>/</span><span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.01em', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 2 }}>{g.name}</span></> : null; })()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {activeToolGroup === 'todos' ? (
                  <>
                  <button data-ui-control="" onClick={() => { setEditingTopicId(activeTopic.id); setTopicName(activeTopic.title); setShowTopicModal(true); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} title="Editar tema"><Pencil size={13} /></button>
                  <button data-ui-control="" onClick={() => { setStudyToolMode('none'); setReviewing(false); setReviewFlipped(false); setTopicSearch(''); setActiveTagFilter(null); if (activeTopic.groupId) { setSelectedGroupId(activeTopic.groupId); setCurrentView('group'); } else { setCurrentView('overview'); } }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }} title={activeTopic.groupId ? `Volver a ${groups.find(g => g.id === activeTopic.groupId)?.name || 'la agrupación'}` : 'Volver'}><ArrowLeft size={14} /></button>
                  </>
                  ) : (
                  <>
                  <button data-ui-control="" onClick={() => { setTopicGroupModal({ mode: 'rename', orig: activeToolGroup }); setNewGroupName(activeToolGroup.includes('/') ? activeToolGroup.split('/').pop()! : activeToolGroup); }} title="Editar nombre de la carpeta"
                    style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><Pencil size={13} /></button>
                  <button data-ui-control="" onClick={() => setActiveToolGroup(activeToolGroup.includes('/') ? activeToolGroup.split('/').slice(0, -1).join('/') || 'todos' : 'todos')} title="Salir de la carpeta al tema"
                    style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}>
                    <LI.CornerUpLeft size={14} />
                  </button>
                  </>
                  )}
                </div>
              </div>
            </div>
            {/* Content: viewer (left/center) + create sidebar (right) */}
            <div className="course-topic-layout" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
              <div className="course-topic-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Toolbar: buscador con efecto de foco · al ejecutarse, barra de ejecución */}
              <div style={{ flexShrink: 0, padding: '16px 28px 8px' }}>
                {deckRunner && deckRunner.toolMode && ['flashcardsDeck', 'quizDeck', 'matchDeck', 'clozeDeck', 'feynmanDeck', 'vfDeck', 'seqDeck', 'catDeck'].includes(deckRunner.toolMode) ? (() => {
                  return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 46, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '0 8px 0 16px' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {deckRunner.name || deckRunner.title}
                    </span>
                    <button data-ui-control="" onClick={closeDeckRunner} title="Terminar ejecución"
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={13} />
                    </button>
                  </div>
                  );
                })() : (
                <div style={{ position: 'relative', width: '100%', borderRadius: 12, boxShadow: searchFocused ? `0 0 0 3px ${course.color}12` : 'none', transition: 'box-shadow 250ms ' + EASE }}>
                  <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: topicSearch || searchFocused ? course.color : 'var(--text-muted)', transition: 'color 200ms', zIndex: 1 }} />
                  <input value={topicSearch} onChange={e => setTopicSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Buscar en el tema…"
                    style={{ width: '100%', height: 40, borderRadius: 12, border: `1px solid ${topicSearch || searchFocused ? `${course.color}60` : 'var(--border-soft)'}`, background: topicSearch || searchFocused ? `linear-gradient(90deg, ${course.color}0e, var(--bg-elevated-alpha, var(--bg-elevated)))` : 'var(--bg-elevated-alpha, var(--bg-elevated))', padding: '0 40px 0 40px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'all 250ms ' + EASE, fontWeight: 500, boxShadow: topicSearch ? `0 6px 20px ${course.color}16` : searchFocused ? '0 6px 20px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)' }} />
                  {topicSearch && (
                    <span style={{ position: 'absolute', right: 34, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: course.color, fontFamily: "'Inter Tight', sans-serif" }}>{topicFiltered.length}</span>
                  )}
                  {topicSearch && (
                    <button data-ui-control="" onClick={() => setTopicSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 7, border: 'none', background: `${course.color}16`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms' }} title="Limpiar búsqueda"><X size={11} /></button>
                  )}
                </div>
                )}
              </div>
              {deckRunner ? (
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '6px 20px 14px', display: 'flex', flexDirection: 'column' }}>
                  <DeckRunner mat={deckRunner} accent={(deckRunner as any).color || course.color} onClose={closeDeckRunner} />
                </div>
              ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 60px' }} className="no-scrollbar">
                {(() => {
                  const typeMeta: Record<string, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }> = {
                  concept: { icon: Lightbulb, color: '#3B82F6' },
                  meaning: { icon: Type, color: '#10B981' },
                  formula: { icon: Sigma, color: '#8B5CF6' },
                  'key-data': { icon: Key, color: '#F59E0B' },
                  quiz: { icon: HelpCircle, color: '#EF4444' },
                  procedure: { icon: ListChecks, color: '#EC4899' },
                  resource: { icon: File, color: '#6366F1' },
                };

                const noItems = topicItems.length === 0;
                const filtered = topicFiltered;
                const filteredEmpty = !noItems && filtered.length === 0;

                return reviewing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '60%', padding: '0 8px' }}>
                    {/* Review header with Progress Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button data-ui-control="" onClick={closeReview} title="Salir del repaso"
                          style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
                          <X size={14} />
                        </button>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: '#8B5CF616', border: '1px solid #8B5CF630', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={16} style={{ color: '#8B5CF6' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>REPASO DE FLASHCARDS</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{activeTopic?.title}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif" }}>{Math.min(reviewIndex + 1, reviewDeck.length)} / {reviewDeck.length}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: '#10B98114', border: '1px solid #10B98125', padding: '3px 9px', borderRadius: 99 }}>{reviewStats.correct} acertadas</span>
                          {reviewStats.again > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: '#EF444414', border: '1px solid #EF444425', padding: '3px 9px', borderRadius: 99 }}>{reviewStats.again} a repetir</span>}
                        </div>
                      </div>
                      {/* Barra de progreso */}
                      <div style={{ width: '100%', height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(((reviewIndex + 1) / Math.max(1, reviewDeck.length)) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #8B5CF6, #10B981)', transition: 'width 250ms ' + EASE }} />
                      </div>
                    </div>

                    {/* Card */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                      <div onClick={() => setReviewFlipped(f => !f)}
                        className="bento-card"
                        style={{
                          width: 'min(620px, 100%)', minHeight: 280, borderRadius: 22,
                          border: reviewFlipped ? '1.5px solid #10B98150' : '1.5px solid #8B5CF650',
                          background: reviewFlipped ? 'linear-gradient(150deg, #10B98112 0%, var(--bg-surface) 100%)' : 'linear-gradient(150deg, #8B5CF615 0%, var(--bg-surface) 100%)',
                          boxShadow: reviewFlipped ? '0 20px 60px rgba(16,185,129,0.18)' : '0 20px 60px rgba(139,92,246,0.18)',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          padding: '36px 42px', textAlign: 'center', gap: 14, transition: 'all 250ms ' + EASE, position: 'relative',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: reviewFlipped ? '#10B98116' : '#8B5CF616', border: `1px solid ${reviewFlipped ? '#10B98130' : '#8B5CF630'}` }}>
                          {reviewFlipped ? <CheckCircle size={12} style={{ color: '#10B981' }} /> : <HelpCircle size={12} style={{ color: '#8B5CF6' }} />}
                          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: reviewFlipped ? '#10B981' : '#8B5CF6', fontFamily: "'Inter Tight', sans-serif" }}>
                            {reviewFlipped ? 'Respuesta · Revelada' : 'Pregunta'}
                          </span>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.55, maxWidth: 520, fontFamily: "'Inter Tight', sans-serif", wordBreak: 'break-word' }}>
                          {reviewFlipped ? reviewDeck[reviewIndex]?.answer : reviewDeck[reviewIndex]?.question}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, opacity: 0.8, fontFamily: "'Inter', sans-serif" }}>
                          {reviewFlipped ? 'Haz clic para ver la pregunta' : 'Toca para revelar la respuesta'}
                        </span>
                      </div>

                      {reviewFlipped && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: 'min(620px, 100%)' }}>
                          {([
                            { grade: 'again', label: 'Otra vez', sub: '10 min', color: '#EF4444' },
                            { grade: 'hard', label: 'Difícil', sub: '1 día', color: '#F59E0B' },
                            { grade: 'good', label: 'Bien', sub: '3 días', color: '#3B82F6' },
                            { grade: 'easy', label: 'Fácil', sub: '7 días', color: '#10B981' },
                          ] as { grade: 'again' | 'hard' | 'good' | 'easy'; label: string; sub: string; color: string }[]).map(b => (
                            <button data-ui-control="" key={b.grade} onClick={() => gradeFlashcard(b.grade)}
                              style={{ flex: 1, minWidth: 110, padding: '12px 16px', borderRadius: 14, border: `1px solid ${b.color}40`, background: `linear-gradient(135deg, ${b.color}14 0%, var(--bg-surface) 100%)`, cursor: 'pointer', transition: 'all 180ms ' + EASE, textAlign: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = `${b.color}22`; e.currentTarget.style.borderColor = `${b.color}70`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${b.color}25`; }}
                              onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${b.color}14 0%, var(--bg-surface) 100%)`; e.currentTarget.style.borderColor = `${b.color}40`; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: b.color, fontFamily: "'Inter Tight', sans-serif" }}>{b.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Repaso en {b.sub}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : noItems ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60%', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: `${course.color}10`, border: `1.5px dashed ${course.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={24} style={{ color: course.color, opacity: 0.5 }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>Este tema está vacío</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>Agrega flashcards, materiales o grabaciones desde la barra lateral.</span>
                  </div>
                ) : filteredEmpty ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60%', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: `${course.color}0c`, border: `1.5px dashed ${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Search size={20} style={{ color: course.color, opacity: 0.45 }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>Sin resultados</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>Ningún elemento coincide con tu búsqueda o etiqueta seleccionada. Ajusta el filtro para continuar.</span>
                    <button data-ui-control="" onClick={() => { setTopicSearch(''); setActiveTagFilter(null); }} style={{ height: 28, padding: '0 14px', borderRadius: 8, border: `1px solid ${course.color}40`, background: `${course.color}0d`, cursor: 'pointer', color: course.color, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><X size={11} /> Limpiar filtros</button>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => { setActiveTopicDragId(e.active.id as string); }} onDragEnd={handleTopicGridDragEnd}>
                    <SortableContext items={filtered.map(e => e.id)} strategy={rectSortingStrategy}>
                      <div className="course-material-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(235px, 100%), 1fr))', gap: 14, alignItems: 'start' }}>
                {activeToolGroup === 'todos' && ((activeTopic as any)?.toolGroups || []).filter((g: string) => !g.includes('/')).map((g: string) => (
                  <FolderTile key={'grp-' + g} g={g} color={course.color} onRename={() => { setTopicGroupModal({ mode: 'rename', orig: g }); setNewGroupName(g.split('/').pop()!); }} onDelete={() => setConfirmDelGroup(g)} count={filtered.filter(e => e.type === 'resource' && ((e.item as any).groupName === g || String((e.item as any).groupName || '').startsWith(g + '/'))).length} onOpen={() => setActiveToolGroup(g)} />
                ))}
                {filtered.map(entry => {
                  if (!entry || !entry.item) return null;
                  if (activeToolGroup !== 'todos' && entry.type !== 'resource') return null;
                  if (entry.type === 'flashcard') {
                            const fc = entry.item;
                            return (
                              <SortableWrapper key={fc.id} id={fc.id}>
                                {({ attributes, listeners, isDragging }) => (
                                  <div {...attributes} {...listeners}
                                    title="Arrastra para reordenar · Toca para repasar"
                                    style={{ opacity: isDragging ? 0.55 : 1, touchAction: 'none', cursor: isDragging ? 'grabbing' : 'pointer', display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', transition: 'all 200ms ' + EASE, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', minHeight: 118 }}
                                    onClick={startReview}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B5CF650'; e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(139,92,246,0.12)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 8px' }}>
                                      <div style={{ width: 38, height: 38, borderRadius: 11, background: '#8B5CF610', border: '1px solid #8B5CF61a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <BookOpen size={17} style={{ color: '#8B5CF6' }} />
                                      </div>
                                      <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B5CF6', fontFamily: "'Inter Tight', sans-serif" }}>Flashcards</span>
                                      {fc.nextReview <= Date.now() && (
                                        <span style={{ fontSize: 7.5, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: '#8B5CF612', color: '#8B5CF6', letterSpacing: '0.08em' }}>REPASAR</span>
                                      )}
                                      <button data-ui-control="" onPointerDown={e => e.stopPropagation()} title="Editar" onClick={e => { e.stopPropagation(); openFlashcardModal(fc); }} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={11} /></button>
                                      <button data-ui-control="" onPointerDown={e => e.stopPropagation()} title="Eliminar" onClick={e => { e.stopPropagation(); handleDeleteFlashcard(fc.id); }} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={11} /></button>
                                    </div>
                                    <div style={{ flex: 1, padding: '0 14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.35, fontFamily: "'Inter Tight', sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{fc.question}</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, fontWeight: 700, color: '#10B981', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                        <Play size={9} /> Repasar
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </SortableWrapper>
                            );
                          }
                          if (entry.type === 'recording') {
                            const r = entry.item;
                            return (
                              <SortableWrapper key={r.id} id={r.id}>
                                {({ attributes, listeners, isDragging }) => (
                                  <div {...attributes} {...listeners}
                                    title="Arrastra para reordenar"
                                    style={{ opacity: isDragging ? 0.55 : 1, touchAction: 'none', cursor: isDragging ? 'grabbing' : 'pointer', display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', transition: 'all 200ms ' + EASE, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', minHeight: 118 }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#06B6D450'; e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(6,182,212,0.10)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 8px' }}>
                                      <div style={{ width: 38, height: 38, borderRadius: 11, background: '#06B6D410', border: '1px solid #06B6D41a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Mic size={17} style={{ color: '#06B6D4' }} />
                                      </div>
                                      <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#06B6D4', fontFamily: "'Inter Tight', sans-serif" }}>Grabación</span>
                                    </div>
                                    <div style={{ flex: 1, padding: '0 14px 12px', display: 'flex', alignItems: 'center' }}>
                                      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.35, fontFamily: "'Inter Tight', sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.name || 'Grabación'}</div>
                                    </div>
                                  </div>
                                )}
                              </SortableWrapper>
                            );
                          }
                          const mat = entry.item as SubjectMaterial;
                          const _gn = (mat as any).groupName as string | undefined;
                          if (activeToolGroup === 'todos') { if (_gn) return null; }
                          else if (_gn !== activeToolGroup) return null;
                          return (
                            <SortableWrapper key={mat.id} id={mat.id}>
                              {({ attributes, listeners, isDragging }) => (
                                <div style={{ opacity: isDragging ? 0.55 : 1 }}>
                                  <MaterialCard mat={mat} dragAttributes={attributes} dragListeners={listeners} onEdit={startEditToolMaterial} onDelete={handleDeleteMaterial} onOpenResource={handleOpenResource} onPractice={openPractice} onView={viewMaterial} clickSuppressed={() => matDragSuppressRef.current} groupName={(mat as any).groupName} onUngroup={() => ungroupMaterial(mat.id)} onPickIcon={(m, x, y) => setLinkIconPick({ matId: m.id, x, y })} onContextMenu={(e, m) => matRmb(e, m, () => ({ url: m.dataUrl || '', name: m.name || m.title || 'Material', color: course.color, onMoveToGroup: () => setMoveToGroupMat({ id: m.id, name: m.name || m.title || 'Material' }), onRemoveFromGroup: (m as any).groupName ? () => ungroupMaterial(m.id) : undefined, onBatchColor: (c) => { updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(t => t.id === activeTopic?.id ? { ...t, materials: (safeArr(t.materials)).map(mm => ({ ...mm, color: c })) } : t) } as any); toast.success('Color aplicado a todas las herramientas del tema'); }, onOpenAll: () => { const withUrl = (safeArr(activeTopic?.materials)).filter(mm => mm.dataUrl); if (withUrl.length === 0) { toast.error('No hay recursos con archivo o enlace para abrir'); return; } withUrl.forEach(mm => handleOpenResource(mm)); toast.success(`Abriendo ${withUrl.length} recurso(s)`); } }))} selected={selMats.has(matKey(mat))} />
                                </div>
                              )}
                            </SortableWrapper>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                );
              })()}
              <input type="file" ref={resourceInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              </div>
              )}
              </div>
              {/* Right lateral: Herramientas — tool blocks */}
              {(() => {
                return (
                <div className="course-topic-tools" style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* --- Header --- */}
                    <div style={{ padding: '20px 20px 14px', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif" }}>Herramientas</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {activeToolGroup === 'todos' && (
                        <button data-ui-control="" onClick={() => { setTopicGroupModal({ mode: 'create' }); setNewGroupName(''); }}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                          title="Crear grupo (carpeta para separar materiales)">
                          <LI.FolderPlus size={15} />
                        </button>
                        )}
                        <button data-ui-control="" onClick={() => { topicOnlyRef.current = true; generalOnlyRef.current = false; pendingGroupNameRef.current = activeToolGroup !== 'todos' ? activeToolGroup : undefined; handleAddFileBtn(activeTopic?.id); }}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                          title="Subir archivo al tema activo">
                          <Upload size={15} />
                        </button>
                        <button data-ui-control="" onClick={() => { generalOnlyRef.current = false; setAddLinkTargetTopic(activeTopic?.id); pendingGroupNameRef.current = activeToolGroup !== 'todos' ? activeToolGroup : undefined; setShowAddLinkModal(true); setAddLinkUrl(''); setAddLinkName(''); }}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                          title="Añadir enlace">
                          <Link2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 14px 14px', flex: 1, minHeight: 0, overflowY: 'auto' }} className="no-scrollbar">
                      {(() => {
                        const toolsList = [
                          { mode: 'flashcardsDeck' as const, icon: LI.Layers, label: 'FLASHCARDS', color: '#8B5CF6', action: () => setDeckEditor({ mode: 'flashcardsDeck' }) },
                          { mode: 'quizDeck' as const, icon: HelpCircle, label: 'PRUEBA', color: '#F59E0B', action: () => setDeckEditor({ mode: 'quizDeck' }) },
                          { mode: 'matchDeck' as const, icon: Shuffle, label: 'EMPAREJAR', color: '#10B981', action: () => setDeckEditor({ mode: 'matchDeck' }) },
                          { mode: 'vfDeck' as const, icon: LI.CheckSquare, label: 'VERDADERO O FALSO', color: '#06B6D4', action: () => setDeckEditor({ mode: 'vfDeck' }) },
                          { mode: 'clozeDeck' as const, icon: LI.Pencil, label: 'COMPLETAR', color: '#3B82F6', action: () => setDeckEditor({ mode: 'clozeDeck' }) },
                          { mode: 'feynmanDeck' as const, icon: LI.Lightbulb, label: 'FEYNMAN', color: '#EC4899', action: () => setDeckEditor({ mode: 'feynmanDeck' }) },
                          { mode: 'seqDeck' as const, icon: LI.ListOrdered, label: 'SECUENCIAS', color: '#F97316', action: () => setDeckEditor({ mode: 'seqDeck' }) },
                          { mode: 'catDeck' as const, icon: LI.Shapes, label: 'CATEGORIZAR', color: '#A855F7', action: () => setDeckEditor({ mode: 'catDeck' }) },
                        ];
                        return toolsList.map(t => (
                          <button data-ui-control="" key={t.mode}
                            onClick={t.action}
                            title={`Agregar ${t.label}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14,
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-elevated)',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                              cursor: 'pointer', transition: 'all 200ms ' + EASE, textAlign: 'left', width: '100%',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${t.color}60`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none'; }}
                          >
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in srgb, ${t.color} 10%, transparent)`, border: `1px solid ${t.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <t.icon size={19} style={{ color: t.color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                            </div>
                            <div style={{ width: 24, height: 24, borderRadius: 8, background: `color-mix(in srgb, ${t.color} 12%, transparent)`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Plus size={14} />
                            </div>
                          </button>
                        ));
                      })()}
                    </div>

                  </div>
                );
              })()}
              </div>
            </div>
          ) : activeTab === 'overview' ? (
            /* --- OVERVIEW TAB --- */
          <div className="course-overview-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Big banner */}
            <div className="course-context-banner" style={{ position: 'relative', height: 184, overflow: 'hidden', background: "var(--bg-surface)" }}>
              {(() => {
                const grpImage = currentView === 'group' && selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.image : undefined;
                const imgSrc = grpImage || course.coverUrl || course.coverImage;
                return imgSrc ? (
                  <><img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 1 }} /><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 60%)' }} /></>
                ) : <div style={{ position: 'absolute', inset: 0, background: "var(--bg-surface)" }} />;
              })()}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  {currentView === 'group' && selectedGroupId ? (() => {
                    const activeGrp = groups.find(g => g.id === selectedGroupId);
                    return activeGrp ? (
                      <>
                        <h1 style={{ fontSize: 32, fontWeight: 500, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>{activeGrp.name}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 2 }}>{course.name}</span>
                        </div>
                      </>
                    ) : null;
                  })() : (
                    <>
                      <h1 className="course-overview-title" style={{ fontSize: 48, fontWeight: 500, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>{course.name}</h1>
                      {(course.teacher || course.teacherName) && <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 1.4, letterSpacing: '0.02em' }}>{course.teacher || course.teacherName}</span>}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {currentView === 'group' ? (
                    <>
                      <button data-ui-control="" onClick={() => { setCurrentView('overview'); setSelectedGroupId(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><ChevronLeft size={14} /></button>
                       <button data-ui-control="" onClick={() => { const grp = groups.find(g => g.id === selectedGroupId); if (grp) { setEditingGroupId(grp.id); setGroupName(grp.name); setGroupCover(grp.image); setShowGroupModal(true); } }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><Pencil size={13} /></button>
                       <button data-ui-control="" onClick={() => {
                          const currentGrp = groups.find(g => g.id === selectedGroupId);
                          const grpTopics = parsedTopics.filter(t => t.groupId === selectedGroupId);
                          const hasTopics = grpTopics.length > 0;
                          if (currentGrp && !hasTopics) { toast.error('No hay temas dentro de esta agrupacion'); return; }
                          if (currentGrp && selectedGroupId) { setExportSelectedIds(new Set(grpTopics.map(t => t.id))); setImportExportMode('export'); }
                          else { setImportExportMode('choose'); }
                          setImportPreviewData(null); setImportSelected([]); setImportTargetGroupId(selectedGroupId); setShowAgrupacionImportExport(true);
                        }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} title="Importar / Exportar"><Package size={13} /></button>

                    </>
                  ) : (
                    <>
                      <button data-ui-control="" aria-label="Configurar curso" onClick={() => { setEditCourseName(course.name); setEditCourseTeacher(course.teacher || course.teacherName || ''); setEditCourseCover(course.coverUrl || course.coverImage);setEditCourseOriginal(course.coverOriginal);setEditCourseCrop(course.coverCrop); setEditCourseColor(course.color); setDeleteConfirmName(''); setShowEditCourse(true); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><Pencil size={13} /></button>
                      <button data-ui-control="" onClick={handleToggleMode}
                        title={overviewMode === 'tareas_notas' ? 'Modo Estudio' : 'Vista General'}
                        style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <ArrowLeftRight size={13} style={{ transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)', transform: overviewMode === 'temas_archivos' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Content based on mode — with crossfade animation */}
            <div style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
              transition: 'opacity 160ms ease-out, transform 160ms ease-out',
              opacity: modePhase === 'out' ? 0 : 1,
              transform: modePhase === 'out' ? 'translateY(8px) scale(0.97)' : modePhase === 'in' ? 'translateY(-4px) scale(1.005)' : 'none',
              // Avoid rasterizing the entire course through an animated blur.
              filter: 'none',
            }}>
            {overviewMode === 'tareas_notas' ? (
              <div key="tasks_notes" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', gap: 48, padding: '32px 40px 60px', width: '100%', boxSizing: 'border-box' }} className="course-overview-columns no-scrollbar">
                {/* --- LEFT: Tasks --- */}
                <div className="course-task-section" style={{ flex: 4, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
                  {/* Task Creator Card */}
                  <div className="bento-card course-task-creator" style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', padding: 0, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                      <div className="course-task-creator-body" style={{ padding: '24px 28px' }}>
                      <input aria-label="Nombre de la tarea del curso" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nombre de la tarea"
                        style={{ width: '100%', border: 'none', borderBottom: 'none', height: 'auto', padding: '4px 0', fontSize: 18, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif", borderRadius: 0, letterSpacing: '-0.02em' }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAddTask(); }} />
                      <div style={{ padding: '0 0', margin: '6px 0' }}>
                        <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${course.color}30, transparent)` }} />
                      </div>
                      <textarea aria-label="Descripción de la tarea del curso" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} placeholder="Descripción (opcional)"
                        rows={1} style={{ width: '100%', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-tertiary)', background: 'transparent', outline: 'none', resize: 'none', fontFamily: "'Inter', sans-serif", overflow: 'hidden', lineHeight: 1.6 }}
                        onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />

                      <div className="course-task-create-fields" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 }}>
                        <input aria-label="Fecha de entrega de la tarea del curso" type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)}
                          style={{ height: 42, borderRadius: 8, border: selectBorder, background: newTaskDueDate ? `${course.color}08` : 'var(--bg-surface)', color: newTaskDueDate ? course.color : 'var(--text-tertiary)', padding: '0 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", outline: 'none', width: 170, minWidth: 170, boxSizing: 'border-box' }} />
                        <PlanSelectDropdown label="Prioridad de la tarea del curso" value={newTaskPriority==='none'?'':newTaskPriority} onChange={value=>setNewTaskPriority((value||'none') as typeof newTaskPriority)} options={[{id:'high',label:'Alta',color:'#EF4444'},{id:'medium',label:'Media',color:'#F59E0B'},{id:'low',label:'Baja',color:'#10B981'}]} noneLabel="Sin prioridad" color={course.color} searchable={false}/>
                        <div style={{ flex: 1 }} />
                        <button data-ui-control="" onClick={handleAddTask} disabled={!newTaskTitle.trim()}
                          style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${newTaskTitle.trim() ? course.color : 'var(--border-subtle)'}`, background: 'transparent', color: newTaskTitle.trim() ? course.color : 'var(--text-muted)', cursor: newTaskTitle.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          title="Añadir tarea">
                          <PlusCircle size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Task list header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, marginBottom: 16 }}>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${course.color}25)` }} />
                    <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Tareas académicas</h3>
                    <button data-ui-control="" onClick={() => setShowCompletedTasks(prev => !prev)}
                      style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 200ms' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                      title={showCompletedTasks ? 'Ocultar completadas' : 'Mostrar completadas'}>
                      {showCompletedTasks ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${course.color}25)` }} />
                  </div>
                  {/* Task list */}
                  {(() => {
                    const tasksToShow = showCompletedTasks
                      ? [...courseTasks].sort((a, b) => {
                          if (a.status === 'completado' && b.status !== 'completado') return 1;
                          if (a.status !== 'completado' && b.status === 'completado') return -1;
                          return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
                        })
                      : [...pendingTasks].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
                    return tasksToShow.length > 0 ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParentElement]} onDragStart={() => { tasksDragRef.current = true; }} onDragEnd={(e) => handleTaskDragEnd(e, showCompletedTasks)}>
                        <SortableContext items={tasksToShow.map(t => t.id)} strategy={rectSortingStrategy}>
                      <div className="course-tasks-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 232, overflowY: 'auto', paddingRight: 4 }}>
                        {tasksToShow.map(task => {
                          const descPreview = (task.notes || '').replace(/<[^>]+>/g, '').trim().slice(0, 45);
                          let dueDisplay = '';
                          let isOverdue = false;
                          if (task.dueDate) {
                            const dueStr = task.dueDate.split('T')[0];
                            const today = new Date(); today.setHours(0,0,0,0);
                            const due = new Date(dueStr + 'T12:00:00');
                            const day = due.getDate().toString().padStart(2, '0');
                            const month = (due.getMonth() + 1).toString().padStart(2, '0');
                            const year = due.getFullYear();
                            dueDisplay = `${day}/${month}/${year}`;
                            isOverdue = Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24)) < 0;
                          }
                          const isDone = task.status === 'completado';
                          const isProgress = task.status === 'progreso';
                          const prioColors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
                          const prioLevel = task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : task.priority === 'low' ? 1 : 0;
                          const pCol = prioLevel > 0 ? (prioColors[task.priority] || '#EF4444') : '';
                          const pct = prioLevel === 3 ? '100%' : prioLevel === 2 ? '66.67%' : prioLevel === 1 ? '33.33%' : '0%';
                          return (
                            <SortableWrapper key={task.id} id={task.id} style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', flexShrink: 0 }}>
                              {({ attributes, listeners, isDragging }) => (
                            <div {...attributes} {...listeners} className={isDone ? '' : 'item-card'} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated-alpha, var(--bg-elevated))', overflow: 'hidden', flexShrink: 0, transition: 'all 200ms ' + EASE, opacity: isDone ? 0.65 : isDragging ? 0.35 : 1, cursor: isDone ? 'default' : isDragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                              onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = `${course.color}45`; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setTaskMenu({ id: task.id, x: e.clientX, y: e.clientY }); }}>
                              {prioLevel > 0 && (
                                <>
                                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: 16, display: 'flex', alignItems: 'center', zIndex: 0, pointerEvents: 'none' }}>
                                    <span style={{ fontSize: 34, fontWeight: 800, fontStyle: 'normal', letterSpacing: '0.24em', color: pCol, opacity: 0.12, fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', userSelect: 'none' }}>{prioLevel === 3 ? 'A L T O' : prioLevel === 2 ? 'M E D I O' : 'B A J O'}</span>
                                  </div>
                                  {[0, 1, 2].map(seg => (
                                    <div key={seg} style={{ position: 'absolute', left: `${seg * 33.3333}%`, top: 0, bottom: 0, width: '33.3333%', background: seg < prioLevel ? `linear-gradient(180deg, ${pCol}1f 0%, ${pCol}0a 100%)` : 'transparent', zIndex: 1, pointerEvents: 'none' }} />
                                  ))}
                                  <div style={{ position: 'absolute', left: '33.3333%', top: 0, bottom: 0, borderLeft: '1px dashed var(--border-default)', zIndex: 1, pointerEvents: 'none' }} />
                                  <div style={{ position: 'absolute', left: '66.6666%', top: 0, bottom: 0, borderLeft: '1px dashed var(--border-default)', zIndex: 1, pointerEvents: 'none' }} />
                                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1.5, background: `linear-gradient(90deg, ${pCol} 0%, ${pCol} ${pct}, transparent ${pct})`, zIndex: 1, pointerEvents: 'none' }} />
                                </>
                              )}
                              <div onClick={() => handleToggleTask(task.id)}
                                style={{ position: 'relative', zIndex: 2, width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
                                  border: `1.5px solid ${isDone ? course.color : isProgress ? `${course.color}80` : `${course.color}4d`}`,
                                  background: isDone ? course.color : isProgress ? `linear-gradient(180deg, ${course.color}75 0%, ${course.color}2e 100%)` : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 200ms ' + EASE }}
                                onMouseEnter={e => { if (!isDone && !isProgress) { e.currentTarget.style.background = `${course.color}12`; e.currentTarget.style.borderColor = `${course.color}88`; } }}
                                onMouseLeave={e => { if (!isDone && !isProgress) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${course.color}4d`; } }}>
                                {isDone && <Check size={17} strokeWidth={2.5} color="#fff" />}
                              </div>
                              <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15.5, fontWeight: 600, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter Tight', sans-serif", textDecoration: isDone ? 'line-through' : 'none', letterSpacing: '-0.01em' }}>{task.title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  <LI.Calendar size={11} style={{ opacity: 0.55, flexShrink: 0, color: isOverdue && dueDisplay ? '#EF4444' : 'var(--text-tertiary)' }} />
                                  <span style={{ fontSize: 11.5, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", color: !dueDisplay ? 'var(--text-tertiary)' : isDone ? 'var(--text-tertiary)' : isOverdue ? '#EF4444' : 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                                    {dueDisplay ? `Entrega: ${dueDisplay}` : 'Sin fecha de entrega'}
                                  </span>
                                  {descPreview && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 6, flex: 1, minWidth: 0 }}>{descPreview}</span>}
                                </div>
                              </div>
                              <button data-ui-control="" onClick={(e) => { e.stopPropagation(); setFocusedTaskId(task.id); setNavigateTo('tareas'); }} title="Ir a Tareas"
                                style={{ position: 'relative', zIndex: 2, width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0, transition: 'all 150ms ' + EASE }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.color = course.color; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                              )}
                            </SortableWrapper>
                          );
                        })}
                      </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)' }}>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay tareas para este curso.</p>
                      </div>
                    );
                  })()}
                </div>
                {/* --- RIGHT: Mis Apuntes · Vertical Expandable Blocks --- */}
                  <div className="course-note-section" style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>{showCourseNotesInOverview ? 'Mi conocimiento' : 'Mis apuntes'}</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button data-ui-control=""
                        onMouseDown={() => { eyePressTimerRef.current = setTimeout(() => { setShowCourseNotesInOverview((prev: boolean) => !prev); eyePressTimerRef.current = null; }, 500); }}
                        onMouseUp={() => { if (eyePressTimerRef.current) { clearTimeout(eyePressTimerRef.current); eyePressTimerRef.current = null; setShowOverviewNoteDates((prev: boolean) => !prev); } }}
                        onMouseLeave={(e) => { if (eyePressTimerRef.current) { clearTimeout(eyePressTimerRef.current); eyePressTimerRef.current = null; } e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                        title={showOverviewNoteDates ? 'Ocultar fechas' : 'Mostrar fechas'}
                        style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: showOverviewNoteDates ? course.color : `${course.color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}>
                        {showOverviewNoteDates ? <LI.CalendarDays size={13} /> : <LI.CalendarX size={13} />}
                      </button>
                      <button data-ui-control="" onClick={() => {
                        const newId = addNote({ title: '', content: '', course: course.name, courseColor: course.color, isCoursePrivate: true, isPinned: false });
                        setSelectedOverviewNoteId(newId);
                        setOverviewNoteEditMode(true);
                      }}
                        title="Nuevo apunte"
                        style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Note Blocks · always collapsed */}
                  {filteredCourseNotes.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={() => { notesDragRef.current = true; }} onDragCancel={()=>{notesDragRef.current=false;}} onDragEnd={handleOverviewNoteDragEnd}>
                      <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
                        <div ref={overviewNoteContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', zIndex: 2, padding: '0 12px 8px', maxHeight: 'clamp(300px, 52vh, 640px)', overflowY: 'auto', overscrollBehavior: 'contain' }} className="course-notes-scroll">
                          {expandedFirst.map(n => {
                            const isHighlighted = overviewNoteHighlights.includes(n.id);
                            const isCourseNote = !n.isCoursePrivate;
                            // En "Mi conocimiento" las notas NO se editan; los apuntes
                            // propios (isCoursePrivate) sí se pueden editar/borrar.
                            const canModifyNote = !showCourseNotesInOverview || n.isCoursePrivate;
                            const isExpanded = selectedOverviewNoteId === n.id;
                            const noteActions = <>
                                          {showOverviewNoteDates && !overviewNoteEditMode && (
                                            <span style={{ fontSize: 11, fontWeight: 600, color: dateContrast(course.color, th), marginRight: 6, letterSpacing: '0.03em', fontFamily: "'JetBrains Mono', monospace", opacity: 0.85 }}>
                                              {format(new Date(n.createdAt), "dd/MM/yy · HH:mm", { locale: es })}
                                            </span>
                                          )}
                                          {!overviewNoteEditMode&&<div style={{flex:1}}/>}
                                          <button data-ui-control="" onClick={() => { toggleHighlight(n.id); }}
                                            title="Destacar"
                                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: isHighlighted ? '#D4A017' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                            onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <Star size={11} fill={isHighlighted ? '#D4A017' : 'none'} />
                                          </button>
                                          {!overviewNoteEditMode && canModifyNote && (
                                            <button data-ui-control="" onClick={() => { setOverviewNoteEditMode(true); setOverviewActiveFormats({}); }}
                                              title="Editar"
                                              style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                              onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                              <Pencil size={11} />
                                            </button>
                                          )}
                                          {canModifyNote && (
                                            <button data-ui-control="" onClick={() => setConfirmDeleteNoteId(n.id)}
                                              title="Eliminar"
                                              style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                              onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                              <Trash2 size={11} />
                                            </button>
                                          )}
                                          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
                                           <button data-ui-control="" aria-label="Cerrar apunte" title="Cerrar apunte" onClick={() => { flushOverviewEditors(); setSelectedOverviewNoteId(null); setOverviewNoteEditMode(false); setConfirmDeleteNoteId(null); }}
                                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <X size={12} />
                                          </button>
                            </>;
                            return (
                              <SortableWrapper key={n.id} id={n.id}>
                                {({ attributes, listeners, isDragging }) => (
                                  <div className="course-note-block" data-highlighted={isHighlighted} style={{
                                    borderRadius: 12, position: 'relative',
                                    border: isHighlighted ? `1.5px solid #D4A017` : isCourseNote ? `1px solid ${course.color}25` : `1px solid var(--border-subtle)`,
                                    borderLeft: isHighlighted ? `3px solid #D4A017` : isCourseNote ? `3px solid ${course.color}50` : `1px solid var(--border-subtle)`,
                                    background: isHighlighted ? `linear-gradient(135deg, rgba(212,160,23,0.06), rgba(212,160,23,0.015))` : isCourseNote ? `linear-gradient(135deg, var(--bg-elevated), ${course.color}03)` : 'var(--bg-elevated)',
                                    overflow: 'hidden', transition: 'all 200ms ' + EASE,
                                    boxShadow: isHighlighted ? `0 0 0 2px #D4A01720, 0 2px 16px #D4A01710` : 'none',
                                    cursor: isExpanded ? 'default' : 'grab',
                                    opacity: isDragging ? 0.4 : 1,
                                  }}
                                    {...(!isExpanded && canModifyNote ? { ...attributes, ...listeners } : {})}
                                    onClick={() => { if (!isExpanded && !notesDragRef.current) { setSelectedOverviewNoteId(n.id); setOverviewNoteEditMode(false); } }}
                                    onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.background = isHighlighted ? 'rgba(212,160,23,0.09)' : isCourseNote ? `linear-gradient(135deg, var(--bg-surface), ${course.color}06)` : 'var(--bg-surface)'; } }}
                                    onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.background = isHighlighted ? `linear-gradient(135deg, rgba(212,160,23,0.06), rgba(212,160,23,0.015))` : isCourseNote ? `linear-gradient(135deg, var(--bg-elevated), ${course.color}03)` : 'var(--bg-elevated)'; } }}
                                  >
                                    {isExpanded ? (
                                      <>
                                        {/* -- EXPANDED -- */}
                                        {!overviewNoteEditMode && (<div className="course-writing-toolbar" onMouseDown={e=>{if(e.button===0&&(e.target as HTMLElement).closest('button'))e.preventDefault();}} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, padding: '4px 10px', borderBottom: '1px solid var(--border-subtle)', background: `${course.color}05`, flexWrap: 'wrap', minHeight: 32 }}>
                                          {noteActions}
                                        </div>)}
                                        <div style={{ maxHeight: 420, overflowY: 'auto', minHeight: 0 }}>
                                          <NoteEditor
                                            toolbarEnd={noteActions}
                                            note={n}
                                            courseColor={course.color}
                                            onSave={(id, data) => saveCourseNoteContent(id, data?.content ?? '')}
                                            editable={overviewNoteEditMode && canModifyNote}
                                            onImageClick={(src) => { setPreviewImageSrc(src); setShowImagePreview(true); }}
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="course-note-summary"><NotebookPen size={15}/><span>{n.title?.trim() || 'Apunte sin título'}</span><ChevronRight size={14}/></div>
                                        {/* Date display */}
                                        {showOverviewNoteDates && (
                                          <div style={{ padding: '8px 16px 0', fontSize: 11, fontWeight: 600, color: dateContrast(course.color, th), fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.03em', opacity: 0.8 }}>
                                            {format(new Date(n.createdAt), "dd/MM/yy", { locale: es })}
                           </div>
                                         )}
                                         {/* -- COLLAPSED (preview) -- */}
                                        <div className="course-note-excerpt" style={{ padding: showOverviewNoteDates ? '6px 16px 12px' : '12px 16px' }}>
                                          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', fontFamily: "'Atkinson Hyperlegible', system-ui, serif", wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
                                            dangerouslySetInnerHTML={{ __html: n.content?.replace(/<img[^>]+style="([^"]*)"/g, (m: string, s: string) => m.replace(s, s + ';max-height:100px;width:auto') ) || '<span style="color:var(--text-muted);font-style:italic;font-size:12px">Vacío</span>' }} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </SortableWrapper>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{showCourseNotesInOverview ? 'Vacío' : 'No hay apuntes. Crea el primero.'}</p>
                    </div>
                  )}
                </div>
              </div>
              ) : currentView === 'group' && selectedGroupId ? (
                /* --- GROUP DETAIL VIEW --- */
                (() => {
                  const grp = groups.find(g => g.id === selectedGroupId);
                  const grpTopics = parsedTopics.filter(t => t.groupId === selectedGroupId);
                  if (!grp) return null;
                  return (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 40px' }} className="no-scrollbar">
                        {grpTopics.length === 0 ? (
                          <div onClick={() => { setEditingTopicId(null); setTopicName(''); setShowTopicModal(true); }}
                            style={{ padding: '64px 24px', textAlign: 'center', borderRadius: 16, border: `2px dashed ${course.color}30`, background: `linear-gradient(145deg, ${course.color}06, transparent 70%)`, cursor: 'pointer', transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}55`; e.currentTarget.style.background = `linear-gradient(145deg, ${course.color}0c, ${course.color}04)`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${course.color}10`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.background = `linear-gradient(145deg, ${course.color}06, transparent 70%)`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${course.color}12`, border: `1.5px solid ${course.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${course.color}10` }}>
                              <Plus size={24} style={{ color: course.color, opacity: 0.7 }} />
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 4 }}>Agregar tema</span>
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>Organiza tu contenido en temas dentro de esta agrupacion</span>
                            </div>
                          </div>
                        ) : (
                          <DndContext sensors={studySensors} collisionDetection={closestCorners} onDragStart={e => { setActiveTopicDragId(e.active.id as string); }} onDragEnd={handleGroupTopicDragEnd}>
                            <SortableContext items={grpTopics.map(t => t.id)} strategy={rectSortingStrategy}>
                          <div className="course-topic-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                            {grpTopics.map(topic => {
                                const mats = safeArr(topic.materials);
                                const typeColors: Record<string, string> = { resource: '#3B82F6', concept: '#8B5CF6', 'key-data': '#10B981', formula: '#F59E0B', meaning: '#EC4899', quiz: '#EF4444', procedure: '#06B6D4' };
                                const typeLabels: Record<string, string> = { resource: 'Recursos', concept: 'Conceptos', 'key-data': 'Datos clave', formula: 'fórmulas', meaning: 'Significados', quiz: 'Quizzes', procedure: 'Procedimientos' };
                                const toolNames: Record<string, { label: string; color: string }> = {
                                  flashcards: { label: 'Flashcards', color: '#8B5CF6' },
                                  quizzes: { label: 'Quiz rápido', color: '#EF4444' },
                                  blurting: { label: 'Blurting', color: '#3B82F6' },
                                  feynman: { label: 'Feynman', color: '#F59E0B' },
                                  matching: { label: 'Matching', color: '#10B981' },
                                  cloze: { label: 'Cloze', color: '#06B6D4' },
                                  categorization: { label: 'Categorizar', color: '#EC4899' },
                                  mnemonics: { label: 'Mnemotecnia', color: '#6366F1' },
                                };
                                const createdItems: { count: number; label: string; color: string }[] = [];
                                const addCreated = (label: string, color: string) => {
                                  const ex = createdItems.find(e => e.label === label);
                                  if (ex) ex.count++;
                                  else createdItems.push({ count: 1, label, color });
                                };
                                (topic.flashcards || []).forEach(() => addCreated('Flashcards', toolNames.flashcards.color));
                                mats.forEach(m => {
                                  const tool = (m.toolMode || '') as string;
                                  if (tool && toolNames[tool]) addCreated(toolNames[tool].label, toolNames[tool].color);
                                  else addCreated(typeLabels[m.type] || m.type, typeColors[m.type] || '#6B7280');
                                });
                                const totalCreated = createdItems.reduce((s, e) => s + e.count, 0);
                                return (
                                  <SortableWrapper key={topic.id} id={topic.id}>
                                    {({ attributes, listeners, isDragging }) => (
                                  <div {...attributes} {...listeners} onClick={() => { setActiveTopicId(topic.id); setCurrentView('topic'); setTopicSearch(''); setActiveTagFilter(null); }}
                                    title="mantén pulsado para arrastrar · Toca para abrir"
                                    style={{ borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'pointer', transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)', display: 'flex', flexDirection: 'column', position: 'relative', touchAction: 'none', opacity: isDragging ? 0.45 : 1, transform: isDragging ? 'scale(0.98)' : 'none', zIndex: isDragging ? 20 : 1 }}
                                    className="topic-card"
                                    onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 36px ${course.color}14`; } const a = e.currentTarget; a.querySelectorAll('.topic-actions').forEach(el => (el as HTMLElement).style.opacity = '1'); }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = isDragging ? 'scale(0.98)' : 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; const a = e.currentTarget; a.querySelectorAll('.topic-actions').forEach(el => (el as HTMLElement).style.opacity = '0'); }}>
                                    <div style={{ padding: '22px 20px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <h4 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.25, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{topic.title}</h4>
                                        <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0, transition: 'opacity 150ms' }}
                                          className="topic-actions">
                                          <button data-ui-control="" onClick={(e) => { e.stopPropagation(); setEditingTopicId(topic.id); setTopicName(topic.title); setShowTopicModal(true); }}
                                            style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                            onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--bg-hover)'; ev.currentTarget.style.color = 'var(--text-secondary)'; }}
                                            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; }}>
                                            <Edit3 size={12} />
                                          </button>
                                          <button data-ui-control="" onClick={(e) => { e.stopPropagation(); setDeleteTopicId(topic.id); }}
                                            style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                            onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.08)'; ev.currentTarget.style.color = '#EF4444'; }}
                                            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; }}>
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif" }}>Dominio</span>
                                          <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: topic.reviewLevel > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', letterSpacing: '-0.02em' }}>{topic.reviewLevel > 0 ? `${topic.reviewLevel}/10` : 'Sin repasar'}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 2.5, cursor: 'pointer', touchAction: 'none' }} title="Clic para fijar el dominio">
                                          {REVIEW_LEVEL_COLORS.map((col, i) => {
                                            const filled = i < topic.reviewLevel;
                                            const lastFilled = filled && i === topic.reviewLevel - 1;
                                            return (
                                              <div key={i}
                                                style={{ flex: 1, height: 7, borderRadius: 3, background: filled ? col : 'var(--bg-hover)', border: filled ? 'none' : '1px solid var(--border-subtle)', boxShadow: lastFilled ? `0 0 10px ${col}88` : 'none', transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)' }}
                                                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setTopicReviewLevel(topic.id, i + 1 === topic.reviewLevel ? 0 : i + 1); }}
                                                onMouseEnter={e => { if (e.buttons === 1) setTopicReviewLevel(topic.id, i + 1); }}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                      {totalCreated > 0 ? (
                                        createdItems.map((e, i) => (
                                          <div key={`${e.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 5, background: `${e.color}10`, border: `1px solid ${e.color}18` }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                                            <span>{e.count} {e.label}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: '2px 0' }}>Sin materiales</span>
                                      )}
                                    </div>
                                  </div>
                                  )}
                                  </SortableWrapper>
                                );
                            })}
                            <div onClick={() => { setEditingTopicId(null); setTopicName(''); setShowTopicModal(true); }}
                              style={{ borderRadius: 14, border: `2px dashed ${course.color}30`, background: `${course.color}05`, cursor: 'pointer', transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 140 }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}60`; e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${course.color}12`; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.background = `${course.color}05`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${course.color}14`, border: `1.5px dashed ${course.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={22} style={{ color: course.color, opacity: 0.7 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>Agregar tema</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>Haz clic para crear</span>
                            </div>
                          </div>
                          </SortableContext>
                          </DndContext>
                        )}
                    </div>
                  );
                })()
              ) : (
/* --- ESTUDIO MODE --- */
                <>
                <div className="course-study-layout" style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

                  {/* -- LEFT COLUMN: PANEL RESUMEN (4 Métricas + CRONOGRAMA) + MATERIALES -- */}
                  <div className="course-material-section" style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>

                    {/* -- PANEL Métricas: UN SOLO BLOQUE (estética bloques de temas) CON LOS 4 DATOS EN 2×2 + DIVISORES ANIMADOS -- */}
                    <div style={{ flexShrink: 0, padding: '14px 16px 0' }}>
                      {(() => {
                        const totalTopics = parsedTopics.length;
                        const matCount = allCourseMaterials.length;
                        const taskTotal = courseTasks.length;
                        const masteredCount = topicMasteryStats.mastered;
                        const topicsInProgress = parsedTopics.filter(t => (t.reviewLevel || 0) > 0).length;
                        const tasksDone = courseTasks.filter(t => t.status === 'completado').length;
                        const metricCell = (Icon: React.ElementType, color: string, value: React.ReactNode, label: string, sub: string) => (
                          <div className="course-metric-cell" style={{ position: 'relative', minWidth: 0, overflow: 'hidden', padding: '11px 14px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 62, height: 62, borderRadius: '50%', border: `1.5px solid ${color}`, opacity: 0.04, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                              <Icon size={30} strokeWidth={1.1} style={{ color, opacity: 0.9 }} />
                            </div>
                            <span style={{ fontSize: 7.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap' }}>{label}</span>
                            <div>
                              <div style={{ fontSize: 23, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{value}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                                <div style={{ width: 14, height: 2, borderRadius: 1, background: color, opacity: 0.55, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
                              </div>
                            </div>
                          </div>
                        );
                        return (
                          <div className="course-summary-metrics" style={{ height: 186, position: 'relative', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'linear-gradient(160deg, var(--bg-elevated-alpha, var(--bg-elevated)) 0%, color-mix(in srgb, var(--bg-elevated-alpha, var(--bg-elevated)) 82%, transparent) 100%)', overflow: 'hidden', boxShadow: `0 1px 0 rgba(255,255,255,0.035) inset, 0 8px 24px ${course.color}0d` }}>
                            <div style={{ position: 'absolute', left: '50%', top: '8%', bottom: '8%', width: 1, background: 'var(--border-soft)', boxShadow: `0 0 14px ${course.color}3f`, animation: 'metricDividerPulse 4.5s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }} />
                            <div style={{ position: 'absolute', top: '50%', left: '8%', right: '8%', height: 1, background: 'var(--border-soft)', boxShadow: `0 0 14px ${course.color}3f`, animation: 'metricDividerPulse 4.5s ease-in-out 1.1s infinite', pointerEvents: 'none', zIndex: 1 }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100%' }}>
                              {metricCell(Library, course.color, totalTopics, 'Temas', `${topicsInProgress} en progreso`)}
                              {metricCell(Files, '#3B82F6', matCount, 'Materiales', 'recursos y enlaces')}
                              {metricCell(ClipboardList, '#F59E0B', taskTotal, 'Tareas', `${tasksDone} completadas`)}
                              {metricCell(Trophy, '#10B981', masteredCount, 'Dominados', `de ${totalTopics} temas`)}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* -- MATERIALES -- */}
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0, alignSelf: 'stretch' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px 10px', flexShrink: 0 }}>
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Materiales</h3>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button data-ui-control="" onClick={() => { topicOnlyRef.current = false; generalOnlyRef.current = true; handleAddFileBtn(undefined); }}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                              onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                              onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                              title="Subir archivo">
                              <Upload size={15} />
                            </button>
                            <button data-ui-control="" onClick={() => { topicOnlyRef.current = false; setAddLinkTargetTopic(undefined); setShowAddLinkModal(true); setAddLinkUrl(''); setAddLinkName(''); }}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                              onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                              onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                              title="Anadir enlace">
                              <Link2 size={15} />
                            </button>
                          </div>
                        </div>
                        <input type="file" ref={estudioFileInputRef} style={{ display: 'none' }} onChange={e => { generalOnlyRef.current = true; handleFileUpload(e, undefined); }} />
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px 40px', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-scrollbar">
                          {allCourseMaterials.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 12, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)', gap: 8 }}>
                              <File size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Sin materiales todavia</p>
                            </div>
                          ) : (
                          <DndContext sensors={studySensors} collisionDetection={closestCorners}
                            onDragStart={e => { setActiveMatDragId(e.active.id as string); matLinkDragRef.current = true; }}
                            onDragCancel={() => { setActiveMatDragId(null); setTimeout(() => { matLinkDragRef.current = false; }, 250); }}
                            onDragEnd={(e) => { handleStudyMatDragEnd(e); setActiveMatDragId(null); setTimeout(() => { matLinkDragRef.current = false; }, 250); }}>
                          <SortableContext items={allCourseMaterials.filter(m => !!m).map(m => m.id)} strategy={verticalListSortingStrategy}>
                          {allCourseMaterials.filter(m => !!m && typeof m === 'object').map((mat, idx) => {
                            const matName = mat.name || 'Sin nombre';
                            const dataUrl = mat.dataUrl || '';
                            const isLink = dataUrl.startsWith('http');
                            const ext = (mat.name || '').split('.').pop()?.toLowerCase() || '';
                            const isImg = ['png','jpg','jpeg','webp','gif','svg'].includes(ext) || dataUrl.startsWith('data:image');
                            const isPdf = ext === 'pdf';
                            const isDoc = ['doc','docx'].includes(ext);
                            const isXls = ['xls','xlsx','csv'].includes(ext);
                            const isPpt = ['ppt','pptx'].includes(ext);
                            const isAudio = ['mp3','wav','ogg','flac','aac'].includes(ext) || dataUrl.startsWith('data:audio');
                            const isVideo = ['mp4','webm','avi','mov','mkv'].includes(ext) || dataUrl.startsWith('data:video');
                            const isYouTube = isLink && (dataUrl.includes('youtube.com') || dataUrl.includes('youtu.be'));
                            const isClassroom = isLink && dataUrl.includes('classroom.google.com');
                            const isDrive = isLink && dataUrl.includes('drive.google.com');
                            const isGoogleDocs = isLink && dataUrl.includes('docs.google.com');
                            const isGoogleSheets = isLink && dataUrl.includes('sheets.google.com');
                            const isGoogleSlides = isLink && dataUrl.includes('slides.google.com');
                            const isGoogleForms = isLink && dataUrl.includes('forms.google.com');
                            const isWeb = isLink && !isYouTube && !isDrive && !isClassroom && !isGoogleDocs && !isGoogleSheets && !isGoogleSlides && !isGoogleForms;
                            const isLocal = dataUrl && !dataUrl.startsWith('http') && !dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:');

                            const handleMatClick = async () => {
                              // Enlaces y PDF pasan por handleOpenResource para
                              // respetar el navegador/app predeterminados.
                              if (isLink || isPdf) {
                                setLoadingMatId(mat.id || `idx_${idx}`);
                                try { handleOpenResource(mat); } catch { /* noop */ }
                                setTimeout(() => setLoadingMatId(null), 400);
                                return;
                              }
                              setLoadingMatId(mat.id || `idx_${idx}`);
                              try {
                                await openFileSmart(dataUrl, matName, { onError: (m) => toast.error(m), onMoved: (np) => handleMatMoved(mat.id, np) });
                              } catch { /* noop */ }
                              setTimeout(() => setLoadingMatId(null), 400);
                            };

                            const svgIcon = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;
                            let iconEl: React.ReactNode;
                            let badgeColor = '#888';
                            if (isDoc) { badgeColor = '#2563EB'; iconEl = <WordIcon />; }
                            else if (isGoogleDocs) { badgeColor = '#2563EB'; iconEl = <GoogleDocsIcon />; }
                            else if (isXls) { badgeColor = '#10B981'; iconEl = <ExcelIcon />; }
                            else if (isGoogleSheets) { badgeColor = '#10B981'; iconEl = <GoogleSheetsIcon />; }
                            else if (isPpt) { badgeColor = '#F97316'; iconEl = <PowerPointIcon />; }
                            else if (isGoogleSlides) { badgeColor = '#F97316'; iconEl = <GoogleSlidesIcon />; }
                            else if (isPdf) { badgeColor = '#EF4444'; iconEl = svgIcon('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704z', '#EF4444'); }
                            else if (isYouTube) { badgeColor = '#EF4444'; iconEl = svgIcon('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#EF4444'); }
                            else if (isClassroom) { badgeColor = '#0F9D58'; iconEl = <GoogleClassroomIcon />; }
                            else if (isDrive) { badgeColor = '#4285F4'; iconEl = <GoogleDriveIcon />; }
                            else if (isGoogleForms) { badgeColor = '#7C3AED'; iconEl = <GoogleFormsIcon />; }
                            else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={13} />; }
                            else if (isImg) { badgeColor = '#F59E0B'; iconEl = <ImageIcon size={13} />; }
                            else if (isVideo) { badgeColor = '#EC4899'; iconEl = <File size={13} />; }
                            else if (isWeb) {
                              badgeColor = '#10B981';
                              let domain = ''; try { domain = new URL(dataUrl).hostname; } catch {}
                              iconEl = (
                                <span style={{ position: 'relative', width: 17, height: 17, display: 'inline-flex', flexShrink: 0 }}>
                                  <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" style={{ width: 17, height: 17, borderRadius: 3, position: 'absolute', inset: 0 }}
                                    onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.link-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                                  <span className="link-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><Link2 size={12} /></span>
                                </span>
                              );
                            }
                            else { iconEl = <File size={13} />; }

                            return (
                              <SortableWrapper key={mat.id || idx} id={String(mat.id || idx)}>
                              {({ attributes, listeners, isDragging }) => (
                              <div {...attributes} {...(listeners ? { ...listeners, onPointerDown: (e: React.PointerEvent) => { if (e.button !== 0) return; (listeners as any).onPointerDown?.(e); } } : {})} onContextMenu={(e) => matRmb(e, mat, () => ({ url: mat.dataUrl || '', name: mat.name || 'Material', color: badgeColor }))} className={selMats.has(matKey(mat)) ? 'owa-mat-selected' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 7, background: loadingMatId === (mat.id || `idx_${idx}`) ? `${badgeColor}15` : isAudio && playingAudioId === mat.id ? `${badgeColor}08` : 'var(--bg-elevated)', border: `1px solid ${loadingMatId === (mat.id || `idx_${idx}`) ? `${badgeColor}50` : isAudio && playingAudioId === mat.id ? `${badgeColor}30` : 'var(--border-soft)'}`, cursor: loadingMatId === (mat.id || `idx_${idx}`) ? 'default' : 'pointer', transition: 'all 150ms', opacity: isDragging ? 0.5 : 1 }}
                                  onMouseEnter={e => { if (loadingMatId !== (mat.id || `idx_${idx}`)) { e.currentTarget.style.borderColor = `${badgeColor}40`; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                                  onMouseLeave={e => { if (loadingMatId !== (mat.id || `idx_${idx}`)) { e.currentTarget.style.borderColor = isAudio && playingAudioId === mat.id ? `${badgeColor}30` : 'var(--border-soft)'; e.currentTarget.style.background = isAudio && playingAudioId === mat.id ? `${badgeColor}08` : 'var(--bg-elevated)'; } }}>
                                  <div onClick={(e) => {
                                    if (isLink) { e.stopPropagation(); setLinkIconPick({ matId: mat.id, x: e.clientX, y: e.clientY }); return; }
                                    if (matLinkDragRef.current) return;
                                    if (isAudio) {
                                      if (playingAudioId === mat.id && audioRef.current) {
                                        audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
                                      } else {
                                        setPlayingAudioId(mat.id);
                                        setTimeout(() => { if (audioRef.current) { audioRef.current.src = dataUrl; audioRef.current.play().catch(() => {}); } }, 50);
                                      }
                                    } else { handleMatClick(); }
                                  }} title={isLink ? 'Cambiar icono del enlace' : undefined} style={{ width: 30, height: 30, borderRadius: 7, background: `${badgeColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', color: badgeColor, position: 'relative', cursor: isLink ? 'pointer' : undefined }}>
                                    {(isLink && (mat as any).icon && (mat as any).icon !== 'auto') ? renderLinkChoiceIcon((mat as any).icon, 15, badgeColor) : iconEl}
                                  </div>
                                  <div onClick={() => {
                                    if (matLinkDragRef.current) return;
                                    if (isAudio) {
                                      if (playingAudioId === mat.id && audioRef.current) {
                                        audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
                                      } else {
                                        setPlayingAudioId(mat.id);
                                        setTimeout(() => { if (audioRef.current) { audioRef.current.src = dataUrl; audioRef.current.play().catch(() => {}); } }, 50);
                                      }
                                    } else { handleMatClick(); }
                                  }} style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{matName}</span>
                                  </div>
                                  {isAudio && playingAudioId === mat.id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(audioProgress)}</span>
                                      <div style={{ width: 60, height: 3, borderRadius: 2, background: 'var(--bg-hover)', cursor: 'pointer', position: 'relative' }}
                                        onClick={e => { if (audioRef.current) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * audioDuration; } }}>
                                        <div style={{ width: `${(audioProgress / (audioDuration || 1)) * 100}%`, height: '100%', borderRadius: 2, background: badgeColor, transition: 'width 100ms linear' }} />
                                      </div>
                                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28, fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(audioDuration)}</span>
                                    </div>
                                  )}
                                  {isLink ? (
                                    <button data-ui-control="" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setEditLinkId(mat.id); setEditLinkUrl(dataUrl); setEditLinkName(matName); }}
                                      style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms', opacity: 0.4 }}
                                      onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--bg-hover)'; ev.currentTarget.style.color = 'var(--text-primary)'; ev.currentTarget.style.opacity = '1'; }}
                                      onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; ev.currentTarget.style.opacity = '0.4'; }}
                                      title="Editar enlace">
                                      <Edit3 size={11} />
                                    </button>
                                  ) : (
                                    <button data-ui-control="" onClick={e => { e.stopPropagation(); setConfirmDeleteMatId(mat.id); }}
                                      style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms', opacity: 0.4 }}
                                      onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.1)'; ev.currentTarget.style.color = '#EF4444'; ev.currentTarget.style.opacity = '1'; }}
                                      onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; ev.currentTarget.style.opacity = '0.4'; }}
                                      title="Eliminar">
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              )}
                              </SortableWrapper>
                            );
                          })}
                          </SortableContext>
                          </DndContext>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* -- CENTER: PLANNER SEMANAL (superior) + RADAR DE RENDIMIENTO (inferior) -- */}
                    <div className="course-session-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                      {/* -- PLANNER SEMANAL · franja de días (solo días) + sesiones del día seleccionado -- */}
                      <div className="crono-block" style={{ flexShrink: 0, margin: '14px 20px 0', height: 168, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'linear-gradient(160deg, var(--bg-elevated-alpha, var(--bg-elevated)) 0%, color-mix(in srgb, var(--bg-elevated-alpha, var(--bg-elevated)) 82%, transparent) 100%)', position: 'relative', overflow: 'hidden', boxShadow: `0 1px 0 rgba(255,255,255,0.035) inset, 0 8px 24px ${course.color}0d`, display: 'flex', flexDirection: 'column' }}>
                        {(() => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          const ws = startOfWeek(new Date(plannerDate + 'T12:00:00'), { weekStartsOn: 1 });
                          const weekDays = Array.from({ length: 7 }, (_, i) => {
                            const d = addDays(ws, i);
                            const full = format(d, 'EEEE', { locale: es });
                            return { iso: format(d, 'yyyy-MM-dd'), name: full.charAt(0).toUpperCase() + full.slice(1) };
                          });
                          const daySessionsRaw = (plannedSessions || []).filter(s => !!s && expandsToDate(s, plannerDate));
                          const manualOrder = daySessionsRaw.some(s => typeof s.sortOrder === 'number');
                          const daySessions = [...daySessionsRaw].sort((a, b) => {
                            if (manualOrder) return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
                            const ad = a.completed ? 1 : 0, bd = b.completed ? 1 : 0;
                            if (ad !== bd) return ad - bd;
                            return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
                          });
                          const fmtTime = (s?: string) => s ? s.slice(0, 5) : '';
                          const openAddSession = () => { setPlanEditId(null); setPlanDate(plannerDate); setPlanStartTime('09:00'); setPlanTitle(''); setPlanGroupId(''); setPlanTopicId(''); setPlanType('estudio'); setPlanDuration(30); setPlanIntensity(5);
                            setPlanRepeat('none'); setPlanRepeatDays([]); setPlanRepeatUntil(''); setShowPlanModal(true); };
                          const handlePlanDragEnd = (e: DragEndEvent) => {
                            const { active, over } = e;
                            if (!over || active.id === over.id) return;
                            const ids = daySessions.map(s => s.id);
                            const from = ids.indexOf(String(active.id));
                            const to = ids.indexOf(String(over.id));
                            if (from < 0 || to < 0) return;
                            reorderPlannedSessions(arrayMove(ids, from, to));
                            toast.success('Orden de sesiones actualizado');
                          };
                          return (
                            <>
                              {/* header: franja de días · solo el nombre del día, sin números ni flechas, con botón + */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 40, padding: '0 12px', flexShrink: 0 }}>
                                {weekDays.map(d => {
                                  const isTodayDay = d.iso === today;
                                  const isSel = d.iso === plannerDate;
                                  return (
                                    <button data-ui-control="" key={d.iso} onClick={() => markManual(d.iso)}
                                      title={format(new Date(d.iso + 'T12:00:00'), 'EEEE d MMMM', { locale: es })}
                                      style={{ flex: 1, minWidth: 0, cursor: 'pointer', height: 28, padding: '0 4px', borderRadius: 8, border: isSel ? `1px solid ${course.color}` : '1px solid transparent', background: 'transparent', transition: 'all 180ms ' + EASE, fontFamily: 'inherit' }}
                                      onMouseEnter={e => { if (!isTodayDay && !isSel) { e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                                      onMouseLeave={e => { if (!isTodayDay && !isSel) { e.currentTarget.style.background = 'transparent'; } }}>
                                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: isTodayDay ? 700 : 500, color: isTodayDay ? course.color : 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", lineHeight: '28px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.02em', transition: 'color 180ms ' + EASE }}>{d.name}</span>
                                    </button>
                                  );
                                })}
                                <button data-ui-control="" onClick={openAddSession} title="Añadir sesión de estudio"
                                  style={{ flex: '0 0 auto', width: 26, height: 26, boxSizing: 'border-box', marginLeft: 6, borderRadius: 9, border: `1.5px solid ${course.color}40`, background: `${course.color}08`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 0, transition: 'all 200ms ' + EASE }}
                                  onMouseEnter={e => { e.currentTarget.style.background = `${course.color}18`; e.currentTarget.style.borderColor = `${course.color}60`; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = `${course.color}08`; e.currentTarget.style.borderColor = `${course.color}40`; }}>
                                  <Plus size={13} strokeWidth={2.4} />
                                </button>
                              </div>

                              {/* separador fino */}
                              <div style={{ margin: '0 12px', height: 1, background: 'var(--border-soft)', opacity: 0.8, flexShrink: 0 }} />

                              {/* sesiones del día seleccionado · SOLO 2 visibles, sin scroll */}
                              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 14px 6px', display: 'flex', flexDirection: 'column', gap: 6 }} className="no-scrollbar">
                                {daySessions.length === 0 ? (
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 9, padding: '0 12px' }}>
                                    <Calendar size={30} strokeWidth={1.1} style={{ color: 'var(--text-tertiary)', opacity: 0.8 }} />
                                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.03em' }}>Sin sesiones este día</span>
                                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.02em', opacity: 0.9 }}>Programa una con el botón + de arriba</span>
                                  </div>
                                ) : (
                                  <DndContext sensors={planSensors} collisionDetection={closestCorners} onDragEnd={handlePlanDragEnd}>
                                    <SortableContext items={daySessions.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                {daySessions.map(sess => {
                                  const isDone = !!sess.completed;
                                  const intensity = Math.max(0, Math.min(10, sess.intensity || 0));
                                  const otherCourse = sess.courseId !== course.id ? (courses || []).find(c => c.id === sess.courseId) : null;
                                  const rowBg = isDone ? 'color-mix(in srgb, var(--bg-hover) 72%, transparent)' : 'var(--bg-elevated-alpha, var(--bg-elevated))';
                                  return (
                                    <SortableWrapper key={sess.id} id={sess.id} style={{ flexGrow: 1, minHeight: 56, display: 'flex' }}>
                                      {({ attributes, listeners, isDragging }) => (
                                    <div {...attributes} {...listeners}
                                      onClick={() => setDetailSessionId(sess.id)}
                                      title={(isDone ? 'Sesión completada · ' : '') + 'mantén pulsado para mover · Toca para ver detalle'}
                                      style={{ touchAction: 'none', flexGrow: 1, minHeight: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '16px 14px', borderRadius: 10, border: isDragging ? `1px solid ${course.color}60` : '1px solid var(--border-subtle)', background: isDragging ? `${course.color}0d` : rowBg, boxShadow: isDragging ? `0 10px 26px ${course.color}22` : 'none', transition: 'all 200ms ' + EASE, cursor: 'grab', position: 'relative', overflow: 'hidden', opacity: isDragging ? 0.85 : (isDone ? 0.85 : 1) }}
                                      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = `${course.color}45`; e.currentTarget.style.background = `${course.color}08`; } }}
                                      onMouseLeave={e => { if (!isDragging) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = rowBg; } }}>
                                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                        <div style={{ fontSize: 15.5, fontWeight: 500, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em', lineHeight: 1.25, textDecoration: isDone ? 'line-through' : 'none' }}>{sess.title || 'Sesión de estudio'}</div>
                                      </div>
                                      {otherCourse && (
                                        <span title={otherCourse.name} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif", color: otherCourse.color, background: `${otherCourse.color}10`, border: `1px solid ${otherCourse.color}28`, padding: '2.5px 7px', borderRadius: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80, lineHeight: 1.3 }}>{otherCourse.name}</span>
                                      )}
                                      {intensity > 0 && (
                                        <div style={{ flex: 1, minWidth: 96, maxWidth: 210, display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }} title={`Intensidad programada ${intensity}/10`}>
                                          {REVIEW_LEVEL_COLORS.map((col, i) => (
                                            <div key={i} style={{ flex: 1, height: 18, borderRadius: 2, background: i < intensity ? col : 'var(--bg-hover)', boxShadow: i === intensity - 1 ? `0 0 8px ${col}99` : 'none', transition: 'all 160ms' }} />
                                          ))}
                                        </div>
                                      )}
                                      {sess.startTime && (
                                        <div style={{ width: 38, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: isDone ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{fmtTime(sess.startTime)}</span>
                                        </div>
                                      )}
                                      {isDone && (
                                        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(135deg, color-mix(in srgb, var(--bg-surface) 88%, transparent) 0%, color-mix(in srgb, var(--bg-elevated) 80%, transparent) 100%)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent)', border: '1px dashed color-mix(in srgb, var(--accent) 42%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, pointerEvents: 'none', zIndex: 1 }}>
                                          <Check size={13} strokeWidth={2.5} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />
                                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: "'Inter Tight', sans-serif", color: 'var(--accent)', whiteSpace: 'nowrap', textShadow: '0 1px 5px rgba(0,0,0,0.55)' }}>Sesión de estudio lograda</span>
                                        </div>
                                      )}
                                      {isDone ? (
                                        <button data-ui-control="" onClick={e => { e.stopPropagation(); updatePlannedSession(sess.id, { completed: false }); }} title="Desmarcar como completada"
                                          style={{ width: 22, height: 22, borderRadius: '50%', background: '#22C55E14', border: '1px solid #22C55E45', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0, transition: 'all 180ms ' + EASE, position: 'relative', zIndex: 2 }}>
                                          <Check size={11.5} strokeWidth={2.6} />
                                        </button>
                                      ) : (
                                        <button data-ui-control="" onClick={e => { e.stopPropagation(); updatePlannedSession(sess.id, { completed: true }); }} title="Marcar como completada"
                                          style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-soft)', background: 'transparent', flexShrink: 0, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', transition: 'all 180ms ' + EASE, position: 'relative', zIndex: 2 }}>
                                          <Check size={11.5} strokeWidth={2.6} style={{ opacity: 0, transition: 'opacity 180ms ' + EASE }} />
                                        </button>
                                      )}
                                      </div>
                                      )}
                                    </SortableWrapper>
                                  );
                                })}
                                    </SortableContext>
                                  </DndContext>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* -- PANEL DE DETALLE DE Sesión · overlay rectangular horizontal (estética bloques de temas) -- */}
                      {detailSessionId && (() => {
                        const ds=(plannedSessions||[]).find(s=>s.id===detailSessionId);if(!ds)return null;
                        const owner=courses.find(c=>c.id===ds.courseId)||course;
                        const group=(owner.groups||[]).find(g=>g.id===ds.groupId),topic=(owner.studyTopics||[]).find(t=>t.id===ds.topicId);
                        const close=()=>{setDetailSessionId(null);setConfirmDeleteSession(null);setChangeCourseFor(null);};
                        const edit=()=>{
                          setDetailSessionId(null);setConfirmDeleteSession(null);
                          if(owner.id!==course.id){try{localStorage.setItem('owa_course_edit_session',ds.id);}catch{}navigateToCourse(owner.id);return;}
                          setPlanEditId(ds.id);setPlanDate(ds.date);setPlanStartTime(ds.startTime||'09:00');setPlanTitle(ds.title||'');setPlanGroupId(ds.groupId||'');setPlanTopicId(ds.topicId||'');setPlanType(ds.type||'estudio');setPlanDuration(ds.durationMinutes||30);setPlanIntensity(ds.intensity||5);setPlanRepeat(ds.repeat||'none');setPlanRepeatDays(ds.repeatDays||[]);setPlanRepeatUntil(ds.repeatUntil||'');setShowPlanModal(true);
                        };
                        const go=(groupId?:string,topicId?:string)=>{close();try{localStorage.removeItem('owa_session_detail_v1');}catch{}navigateToCourse(owner.id,groupId,topicId);};
                        let recentTopics:SubjectTopic[]=[];
                        try{const raw=JSON.parse(localStorage.getItem(`owa_recent_topics_${owner.id}`)||'[]');if(Array.isArray(raw))recentTopics=raw.filter(x=>x&&typeof x.id==='string'&&x.id!==ds.topicId).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,3).map(x=>(owner.studyTopics||[]).find(t=>t.id===x.id)).filter(Boolean) as SubjectTopic[];}catch{}
                        return <CourseSessionPreview session={ds} course={owner} group={group} topic={topic} recentTopics={recentTopics} studySessions={studySessions||[]} confirmationOpen={!!confirmDeleteSession} unavailable={sessionLinkUnavailable(ds)} onClose={close} onEdit={edit} onDelete={()=>setConfirmDeleteSession(ds)} onComplete={()=>updatePlannedSession(ds.id,{completed:!ds.completed})} onStart={()=>{const reason=sessionLinkUnavailable(ds);if(reason){addNotification(reason,'info');return;}linkPlannedSessionToTimer(ds.id);setNavigateTo('estudio');}} onResume={()=>setNavigateTo('estudio')} onGroup={()=>go(ds.groupId||undefined)} onTopic={()=>go(ds.groupId||undefined,ds.topicId||undefined)} onRecent={item=>go(item.groupId||undefined,item.id)}/>;
                      })()}

                      {/* -- VENTANA DE confirmación · eliminar sesión (evita borrados accidentales) -- */}
                      {detailSessionId && confirmDeleteSession && createPortal(
                        <div onClick={() => setConfirmDeleteSession(null)} style={{ position: 'fixed', inset: 0, zIndex: 99996, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', animation: 'fadeIn 180ms ' + EASE }}>
                          <div onClick={e => e.stopPropagation()} className="bento-card" style={{ width: 400, maxWidth: 'calc(100% - 48px)', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Trash2 size={13} style={{ color: '#EF4444' }} />
                              </div>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Eliminar sesión</span>
                            </div>
                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", lineHeight: 1.55 }}>
                              ¿Eliminar <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>“{confirmDeleteSession.title || 'Sesión de estudio'}</b>? Se quitará del cronograma y no se puede deshacer.
                            </span>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                              <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteSession(null)}
                                style={{ padding: '8px 14px', borderRadius: 9, fontSize: 11, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", border: '1px solid var(--border-soft)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms ' + EASE }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}>
                                Cancelar
                              </button>
                              <button data-ui-control="" onClick={() => { deletePlannedSession(confirmDeleteSession.id); setConfirmDeleteSession(null); setDetailSessionId(null); }}
                                style={{ padding: '8px 14px', borderRadius: 9, fontSize: 11, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", border: '1px solid rgba(239,68,68,0.4)', background: '#EF4444', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(239,68,68,0.35)', transition: 'all 150ms ' + EASE }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.boxShadow = '0 5px 18px rgba(239,68,68,0.5)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239,68,68,0.35)'; }}>
                                Sí, eliminar
                              </button>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}

                      {/* -- RADAR DE RENDIMIENTO · centro inferior -- */}
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {(() => {
                          const AXIS_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6', '#A855F7', '#84CC16', '#E11D48', '#0EA5E9', '#D946EF', '#F43F5E', '#4ADE80', '#FBBF24', '#22D3EE', '#C084FC', '#FB923C'];
                          const cAxis = (i: number) => AXIS_COLORS[i % AXIS_COLORS.length];

                          // Measured course-wide real activity (timer sessions actually studied)
                          const courseStudy = productiveSessions(studySessions || []).filter(s => s.courseId ? s.courseId === course.id : s.taskId ? tasks.find(t=>t.id===s.taskId)?.course===course.name : s.subjects?.includes(course.id));
                          const withVol = courseStudy.filter(ss => ss.volmeter != null && ss.volmeter !== undefined);

                          // Real, countable data per grouping (or topic when no groups exist)
                          const axisItems = groups.length > 0
                            ? groups.slice(0, 50).map(g => {
                                const gTopics = parsedTopics.filter(t => t.groupId === g.id);
                                const matCount = gTopics.reduce((s, t) => s + (t.materials?.length || 0), 0);
                                const mastery = gTopics.length > 0 ? gTopics.reduce((s, t) => s + Math.min(1, (t.reviewLevel || 0) / 10), 0) / gTopics.length : 0;
                                const activeTopics = gTopics.filter(t => (t.reviewLevel || 0) > 0).length;
                                const ses = (plannedSessions || []).filter(s => s.courseId === course.id && s.groupId === g.id);
                                const sesIds = new Set(ses.map(s => s.id));
                                const study = courseStudy.filter(ss => ss.plannedSessionId && sesIds.has(ss.plannedSessionId));
                                const planInt = ses.length > 0 ? ses.reduce((sm, s) => sm + (s.intensity || 0), 0) / ses.length : 0;
                                const realInt = study.length > 0 ? study.reduce((sm, ss) => sm + Math.min(10, (ss.volmeter ?? 0) / (ss.plannedSessionId ? 1 : 2)), 0) / study.length : 0;
                                return { name: g.name, matCount, mastery, activeTopics, topicCount: gTopics.length, ses, planInt, realInt };
                              })
                            : parsedTopics.slice(0, 50).map(t => {
                                const matCount = t.materials?.length || 0;
                                const mastery = Math.min(1, (t.reviewLevel || 0) / 10);
                                const activeTopics = (t.reviewLevel || 0) > 0 ? 1 : 0;
                                const ses = (plannedSessions || []).filter(s => s.courseId === course.id && s.topicId === t.id);
                                const sesIds = new Set(ses.map(s => s.id));
                                const study = courseStudy.filter(ss => ss.plannedSessionId && sesIds.has(ss.plannedSessionId));
                                const planInt = ses.length > 0 ? ses.reduce((sm, s) => sm + (s.intensity || 0), 0) / ses.length : 0;
                                const realInt = study.length > 0 ? study.reduce((sm, ss) => sm + Math.min(10, (ss.volmeter ?? 0) / (ss.plannedSessionId ? 1 : 2)), 0) / study.length : 0;
                                return { name: t.title, matCount, mastery, activeTopics, topicCount: 1, ses, planInt, realInt };
                              });

                          const maxMat = Math.max(1, ...axisItems.map(a => a.matCount));
                          const doneOf = (ses: PlannedSession[]) => ses.length > 0 ? ses.filter(s => s.completed).length / ses.length : 0;
                          const labels = axisItems.map(a => a.name);
                          const courseRealMin = Math.round((courseTimeTotals[course.id]||0) / 60);
                          const courseRealSessions = courseStudy.length;
                          const coursePlan = (plannedSessions || []).filter(s => s.courseId === course.id);
                          const coursePlanMin = coursePlan.reduce((sm, s) => sm + (s.durationMinutes || 0), 0);
                          const coursePlanDone = coursePlan.filter(s => s.completed).length;
                          const realIntensity = Math.min(1, courseRealMin / Math.max(60, coursePlanMin || 0));

                          const courseNotes = notes.filter(nn => nn.course === course.name && !nn.deletedAt).length;
                          const courseTasksDone = courseTasks.filter(t => t.status === 'completado').length;
                          const coursePlanPct = coursePlanMin > 0 ? Math.round((courseRealMin / coursePlanMin) * 100) : (courseRealMin > 0 ? 100 : 0);
                          const coursePlanInt = coursePlan.length > 0 ? coursePlan.reduce((sm, s) => sm + (s.intensity || 0), 0) / coursePlan.length : 0;
                          const courseRealInt = withVol.length > 0
                            ? withVol.reduce((sm, ss) => sm + Math.min(10, (ss.volmeter as number) / (ss.plannedSessionId ? 1 : 2)), 0) / withVol.length
                            : 0;
                          const courseMat = parsedTopics.reduce((s, t) => s + (t.materials?.length || 0), 0);
                          const courseMastery = parsedTopics.length > 0 ? parsedTopics.reduce((s, t) => s + Math.min(1, (t.reviewLevel || 0) / 10), 0) / parsedTopics.length : 0;

                          // Unified course-performance score · a weighted blend of EVERYTHING
                          // measurable. Every term comes from real, countable data:
                          //   mastery   ? avg topic reviewLevel/10 inside the grouping
                          //   materials ? material count of the grouping, normalized by the
                          //               busiest grouping (so the top grouping scores 1.0)
                          //   sessions  ? completed · planned sessions of the grouping
                          //   intensity ? real intensity achieved (volmeter 1-10 of linked
                          //               study sessions) · programmed intensity (1-10);
                          //               falls back to course minutes studied · planned
                          //               minutes (60 min floor) when nothing is programmed
                          //   progress  ? topics with reviewLevel > 0 · total topics
                          //   tasks     ? completed course tasks · total course tasks
                          //   notes     ? course notes · topics (clamped to 1)
                          // Weights sum to 1.0, so the result is a true 0–100 % performance.
                          const WEIGHTS = { mastery: 0.22, materials: 0.18, sessions: 0.18, intensity: 0.16, progress: 0.12, tasks: 0.10, notes: 0.04 } as const;
                          const WLABELS: Record<keyof typeof WEIGHTS, string> = { mastery: 'Dominio', materials: 'Materiales', sessions: 'Sesiones', intensity: 'Intensidad', progress: 'Progreso', tasks: 'Tareas', notes: 'Notas' };
                          const courseTaskRatio = courseTasks.length > 0 ? courseTasksDone / courseTasks.length : 0;
                          const notesRatio = Math.min(1, courseNotes / Math.max(1, parsedTopics.length));
                          const metricsOf = (a: typeof axisItems[number]) => ({
                            mastery: a.mastery,
                            materials: a.matCount / maxMat,
                            sessions: doneOf(a.ses),
                            intensity: a.planInt > 0 ? Math.min(1, a.realInt / a.planInt) : (a.realInt > 0 ? Math.min(1, a.realInt / 10) : realIntensity),
                            progress: a.topicCount > 0 ? a.activeTopics / a.topicCount : 0,
                            tasks: courseTaskRatio,
                            notes: notesRatio,
                          });
                          const scoreOf = (a: typeof axisItems[number]) => {
                            const m = metricsOf(a);
                            return Math.min(1,
                              m.mastery * WEIGHTS.mastery +
                              m.materials * WEIGHTS.materials +
                              m.sessions * WEIGHTS.sessions +
                              m.intensity * WEIGHTS.intensity +
                              m.progress * WEIGHTS.progress +
                              m.tasks * WEIGHTS.tasks +
                              m.notes * WEIGHTS.notes
                            );
                          };

                          const rawValues = axisItems.map(scoreOf);
                          const VIEW_W = Math.max(380, radarDims?.w ?? 500);
                          const VIEW_H = Math.max(340, radarDims?.h ?? 450);
                          const radarCx = VIEW_W / 2, radarCy = VIEW_H / 2;
                          const n = Math.max(3, labels.length);
                          const manyAxes = n > 14;
                          const rotated = n > 12;
                          const radarR = Math.max(84, Math.min(Math.min(VIEW_W, VIEW_H) / 2 - 70, (VIEW_W * 1.04) / Math.sqrt(n)));
                          const angleStep = (2 * Math.PI) / n;
                          const gridLevels = [0.33, 0.66, 1];

                          const getPoint = (idx: number, val: number) => {
                            const angle = angleStep * idx - Math.PI / 2;
                            return { x: radarCx + radarR * val * Math.cos(angle), y: radarCy + radarR * val * Math.sin(angle) };
                          };

                          // Posiciona el tooltip pegado al vértice pero siempre dentro del recuadro,
                          // con margen y sin cortarse (medidas exactas del SVG renderizado).
                          const tooltipLayout = (pt: { x: number; y: number }) => {
                            const wrap = radarWrapRef.current?.getBoundingClientRect();
                            const svg = radarSvgRef.current?.getBoundingClientRect();
                            const TT_W = 250, TT_H = 340;
                            if (!wrap || !svg) return { left: '40%', top: '50%' };
                            const scale = Math.min(svg.width / VIEW_W, svg.height / VIEW_H);
                            const ox = (svg.width - VIEW_W * scale) / 2;
                            const oy = (svg.height - VIEW_H * scale) / 2;
                            const vx = svg.left + ox + pt.x * scale;
                            const vy = svg.top + oy + pt.y * scale;
                            let lx = vx - wrap.left - TT_W / 2;
                            let ty = vy - wrap.top;
                            const above = ty - TT_H - 12 >= 12;
                            ty = above ? ty - TT_H - 12 : ty + 12;
                            lx = Math.max(12, Math.min(wrap.width - TT_W - 12, lx));
                            ty = Math.max(12, Math.min(wrap.height - TT_H - 12, ty));
                            return { left: `${lx}px`, top: `${ty}px` };
                          };

                          const pts = rawValues.map((v, i) => getPoint(i, Math.max(0.18, Math.min(1, v))));
                          const dataPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

                          const fmtVal = (a: typeof axisItems[number]) => `${Math.round(scoreOf(a) * 100)}%`;

                          const headerEl = (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px 10px', flexShrink: 0 }}>
                              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Progreso y rendimiento</h3>
                            </div>
                          );

                          /* -- DIAGNOSTIC RADAR: 0–2 agrupaciones (incluye sin agrupaciones ?
                             análisis COMPLETO del curso en 7 pilares geométricos) O más de 30 → se
                             mantiene el radar geométrico midiendo las variables del curso (dominio,
                             materiales, tareas, notas, sesiones, tiempo, intensidad) en 7 esquinas.
                             Nunca donut, nunca listado, nunca empty state · siempre la telaraña
                             geométrica conectada con todos los datos del curso. -- */
                          if (axisItems.length <= 2 || axisItems.length > 30) {
                            const diagAxes = [
                              { label: 'Dominio', value: courseMastery, detail: courseMastery > 0 ? `${Math.round(courseMastery * 100)}% de dominio medio` : 'sin repaso todavía' },
                              { label: 'Materiales', value: Math.min(1, courseMat / 10), detail: `${courseMat} archivo${courseMat === 1 ? '' : 's'}` },
                              { label: 'Tareas', value: courseTaskRatio, detail: courseTasks.length > 0 ? `${courseTasksDone}/${courseTasks.length} completadas` : 'sin tareas' },
                              { label: 'Notas', value: notesRatio, detail: courseNotes > 0 ? `${courseNotes} apunte${courseNotes === 1 ? '' : 's'}` : 'sin apuntes' },
                              { label: 'Sesiones', value: coursePlan.length > 0 ? coursePlanDone / coursePlan.length : 0, detail: coursePlan.length > 0 ? `${coursePlanDone}/${coursePlan.length} planificadas` : 'sin sesiones planificadas' },
                              { label: 'Tiempo', value: realIntensity, detail: coursePlanMin > 0 ? `${coursePlanPct}% del plan estudiado` : (courseRealMin > 0 ? `${courseRealMin} min reales` : 'sin tiempo registrado') },
                              { label: 'Intensidad', value: coursePlanInt > 0 ? Math.min(1, courseRealInt / coursePlanInt) : (courseRealInt > 0 ? Math.min(1, courseRealInt / 10) : 0), detail: coursePlanInt > 0 ? `${Math.round(courseRealInt)}/10 real vs ${Math.round(coursePlanInt)}/10 programada` : (courseRealInt > 0 ? `${Math.round(courseRealInt)}/10 intensidad real` : 'sin sesiones evaluadas') },
                            ];
                            const dN = diagAxes.length;
                            const dR = Math.max(96, Math.min(Math.min(VIEW_W, VIEW_H) / 2 - 70, (VIEW_W * 1.04) / Math.sqrt(dN)));
                            const dAngleStep = (2 * Math.PI) / dN;
                            const dGetPoint = (idx: number, val: number) => {
                              const angle = dAngleStep * idx - Math.PI / 2;
                              return { x: radarCx + dR * val * Math.cos(angle), y: radarCy + dR * val * Math.sin(angle) };
                            };
                            const dPts = diagAxes.map((a, i) => dGetPoint(i, Math.max(0.18, Math.min(1, a.value))));
                            const dPath = dPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
                            const dTip = radarHover !== null && diagAxes[radarHover] ? tooltipLayout(dGetPoint(radarHover, 1)) : null;
                            const dCol = (i: number) => cAxis(i);
                            return (
                              <>
                                {headerEl}
                                <div style={{ flex: 1, minHeight: 0, padding: '6px 22px 14px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  <div ref={observeRadar} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                                    <svg ref={radarSvgRef} width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" style={{ maxHeight: '100%', margin: '0 auto', display: 'block', overflow: 'visible' }}>
                                      <defs>
                                        <radialGradient id="spiderFillDiag" cx="50%" cy="50%" r="60%">
                                          <stop offset="0%" stopColor={course.color} stopOpacity="0.14" />
                                          <stop offset="100%" stopColor={course.color} stopOpacity="0.02" />
                                        </radialGradient>
                                      </defs>

                                      {[0.33, 0.66, 1].map(lv => (
                                        <polygon key={lv}
                                          points={Array.from({ length: dN }, (_, i) => { const p = dGetPoint(i, lv); return `${p.x},${p.y}`; }).join(' ')}
                                          fill="none" stroke="var(--border-subtle)" strokeWidth="1" opacity={lv === 1 ? 0.45 : 0.24} />
                                      ))}

                                      {Array.from({ length: dN }, (_, i) => {
                                        const p1 = dPts[i];
                                        const p2 = dPts[(i + 1) % dN];
                                        return (
                                          <polygon key={`ds${i}`} points={`${radarCx},${radarCy} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                                            fill={dCol(i)} opacity={0.06} stroke={dCol(i)} strokeOpacity={0.18} strokeWidth={1} strokeLinejoin="round" />
                                        );
                                      })}

                                      {Array.from({ length: dN }, (_, i) => {
                                        const p = dGetPoint(i, 1);
                                        return <line key={`dsp${i}`} x1={radarCx} y1={radarCy} x2={p.x} y2={p.y} stroke={dCol(i)} strokeOpacity={0.12} strokeWidth={1} />;
                                      })}

                                      <path d={dPath} fill="url(#spiderFillDiag)" style={{ transition: 'all 500ms cubic-bezier(0.16,1,0.3,1)' }} />

                                      {Array.from({ length: dN }, (_, i) => {
                                        const a = dPts[i];
                                        const b = dPts[(i + 1) % dN];
                                        return <line key={`dbd${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={dCol(i)} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />;
                                      })}

                                      {dPts.map((p, i) => (
                                        <g key={`dv${i}`}
                                          onMouseEnter={() => setRadarHover(i)}
                                          onMouseLeave={() => setRadarHover(null)}
                                          style={{ cursor: 'crosshair' }}>
                                          <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                                          <circle cx={p.x} cy={p.y} r={radarHover === i ? 7 : 5} fill={radarHover === i ? dCol(i) : 'var(--bg-elevated)'} stroke={dCol(i)} strokeWidth={radarHover === i ? 3 : 2.5} style={{ transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)' }} />
                                          {radarHover === i && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={dCol(i)} strokeOpacity={0.35} strokeWidth={1.5} />}
                                        </g>
                                      ))}

                                      {diagAxes.map((a, i) => {
                                        const p = dGetPoint(i, 1.24);
                                        const col = dCol(i);
                                        const hover = radarHover === i;
                                        const tx = Math.max(46, Math.min(VIEW_W - 46, p.x));
                                        const ty = Math.max(20, Math.min(VIEW_H - 20, p.y));
                                        const anchor = p.x < radarCx - 30 ? 'end' : p.x > radarCx + 30 ? 'start' : 'middle';
                                        return (
                                          <g key={`dl${i}`}
                                            onMouseEnter={() => setRadarHover(i)}
                                            onMouseLeave={() => setRadarHover(null)}
                                            style={{ cursor: 'crosshair' }}>
                                            <text x={tx} y={ty} textAnchor={anchor} dominantBaseline="middle"
                                              fill={hover ? col : 'var(--text-secondary)'}
                                              fontSize={hover ? 12 : 10.5} fontFamily="'Inter Tight', sans-serif"
                                              fontWeight={hover ? 800 : 700} letterSpacing="-0.01em"
                                              style={{ transition: 'fill 200ms' }}>{a.label}</text>
                                          </g>
                                        );
                                      })}

                                      <circle cx={radarCx} cy={radarCy} r={3} fill={course.color} opacity={0.85} />
                                    </svg>

                                    {radarHover !== null && diagAxes[radarHover] && dTip && (
                                      <div className="no-scrollbar" style={{
                                        position: 'absolute', zIndex: 30, pointerEvents: 'none',
                                        left: dTip.left, top: dTip.top,
                                        width: 224,
                                        background: 'color-mix(in srgb, var(--bg-elevated-alpha, var(--bg-elevated)) 97%, transparent)',
                                        border: '1px solid var(--border-subtle)',
                                        borderTop: `1px solid ${dCol(radarHover)}66`,
                                        borderRadius: 12, padding: '12px 15px 13px',
                                        boxShadow: `0 14px 34px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.05) inset`,
                                        display: 'flex', flexDirection: 'column', gap: 8,
                                        backdropFilter: 'blur(18px)',
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                          <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', background: dCol(radarHover), boxShadow: `0 0 8px ${dCol(radarHover)}66` }} />
                                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{diagAxes[radarHover].label}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                          <span style={{ fontSize: 26, fontWeight: 500, color: dCol(radarHover), fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>{Math.round(diagAxes[radarHover].value * 100)}%</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif" }}>curso</span>
                                        </div>
                                        <div style={{ height: 1, background: 'var(--border-subtle)', opacity: 0.7 }} />
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', minWidth: 0 }}>
                                          <span style={{ fontWeight: 500, flexShrink: 0, fontFamily: "'Inter Tight', sans-serif" }}>Detalle</span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{diagAxes[radarHover].detail}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            );
                          }

                          return (
                            <>
                              {headerEl}

                              {/* -- MULTI-COLOR SPIDER CHART -- */}
                              <div style={{ flex: 1, minHeight: 0, padding: '6px 22px 14px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                <div ref={observeRadar} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                                <svg ref={radarSvgRef} width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" style={{ maxHeight: '100%', margin: '0 auto', display: 'block', overflow: 'visible' }}>
                                  <defs>
                                    <radialGradient id="spiderFill" cx="50%" cy="50%" r="60%">
                                      <stop offset="0%" stopColor={course.color} stopOpacity="0.13" />
                                      <stop offset="100%" stopColor={course.color} stopOpacity="0.02" />
                                    </radialGradient>
                                  </defs>

                                  {/* concentric grid rings */}
                                  {gridLevels.map(lv => (
                                    <polygon key={lv}
                                      points={Array.from({ length: n }, (_, i) => { const p = getPoint(i, lv); return `${p.x},${p.y}`; }).join(' ')}
                                      fill="none" stroke="var(--border-subtle)" strokeWidth="1" opacity={lv === 1 ? 0.45 : 0.24} />
                                  ))}

                                  {/* tinted wedge sectors · one color per axis */}
                                  {Array.from({ length: n }, (_, i) => {
                                    const p1 = pts[i];
                                    const p2 = pts[(i + 1) % n];
                                    return (
                                      <polygon key={`sec${i}`} points={`${radarCx},${radarCy} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                                        fill={cAxis(i)} opacity={0.055} stroke={cAxis(i)} strokeOpacity={0.16} strokeWidth={1} strokeLinejoin="round" />
                                    );
                                  })}

                                  {/* colored spokes */}
                                  {Array.from({ length: n }, (_, i) => {
                                    const p = getPoint(i, 1);
                                    return <line key={`sp${i}`} x1={radarCx} y1={radarCy} x2={p.x} y2={p.y} stroke={cAxis(i)} strokeOpacity={0.10} strokeWidth={1} />;
                                  })}

                                  {/* data area (translucent glow, no heavy fill) */}
                                  <path d={dataPath} fill="url(#spiderFill)" style={{ transition: 'all 500ms cubic-bezier(0.16,1,0.3,1)' }} />

                                  {/* multi-color boundary · each segment in its own axis color */}
                                  {Array.from({ length: n }, (_, i) => {
                                    const a = pts[i];
                                    const b = pts[(i + 1) % n];
                                    return <line key={`bd${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cAxis(i)} strokeWidth={manyAxes ? 1.2 : 2.5} strokeLinecap="round" opacity={0.9} />;
                                  })}

                                  {/* vertex dots + hover hit areas */}
                                  {pts.map((p, i) => (
                                    <g key={`v${i}`}
                                      onMouseEnter={() => setRadarHover(i)}
                                      onMouseLeave={() => setRadarHover(null)}
                                      style={{ cursor: 'crosshair' }}>
                                      <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                                      <circle cx={p.x} cy={p.y} r={radarHover === i ? 7 : (manyAxes ? 3 : 5)} fill={radarHover === i ? cAxis(i) : 'var(--bg-elevated)'} stroke={cAxis(i)} strokeWidth={radarHover === i ? 3 : (manyAxes ? 1.5 : 2.5)} style={{ transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)' }} />
                                      {radarHover === i && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={cAxis(i)} strokeOpacity={0.35} strokeWidth={1.5} />}
                                    </g>
                                  ))}

                                  {/* vertex labels · rotated along the spoke when crowded (>12 ejes,
                                      así cada nombre se lee sin chocar con el vecino); =12 horizontales */}
                                  {labels.map((lbl, i) => {
                                    const p = getPoint(i, rotated ? 1.2 : 1.24);
                                    const col = cAxis(i);
                                    const hover = radarHover === i;
                                    if (rotated) {
                                      const rot = (angleStep * i - Math.PI / 2) * (180 / Math.PI);
                                      const shown = lbl.length > 12 ? lbl.slice(0, 11) + '…' : lbl;
                                      return (
                                        <g key={`l${i}`}
                                          onMouseEnter={() => setRadarHover(i)}
                                          onMouseLeave={() => setRadarHover(null)}
                                          style={{ cursor: 'crosshair' }}>
                                          <text x={p.x} y={p.y} transform={`rotate(${rot} ${p.x} ${p.y})`} textAnchor="start" dominantBaseline="middle"
                                            fill={hover ? col : 'var(--text-secondary)'}
                                            fontSize={hover ? 10.5 : 9} fontFamily="'Inter Tight', sans-serif"
                                            fontWeight={hover ? 800 : 600} letterSpacing="-0.01em"
                                            style={{ transition: 'fill 200ms' }}>{shown}</text>
                                        </g>
                                      );
                                    }
                                    const tx = Math.max(46, Math.min(VIEW_W - 46, p.x));
                                    const ty = Math.max(20, Math.min(VIEW_H - 20, p.y));
                                    const anchor = p.x < radarCx - 30 ? 'end' : p.x > radarCx + 30 ? 'start' : 'middle';
                                    return (
                                      <g key={`l${i}`}
                                        onMouseEnter={() => setRadarHover(i)}
                                        onMouseLeave={() => setRadarHover(null)}
                                        style={{ cursor: 'crosshair' }}>
                                        <text x={tx} y={ty} textAnchor={anchor} dominantBaseline="middle"
                                          fill={hover ? col : 'var(--text-secondary)'}
                                          fontSize={hover ? 12 : 10.5} fontFamily="'Inter Tight', sans-serif"
                                          fontWeight={hover ? 800 : 700} letterSpacing="-0.01em"
                                          style={{ transition: 'fill 200ms' }}>{lbl}</text>
                                      </g>
                                    );
                                  })}

                                  {/* center point */}
                                  <circle cx={radarCx} cy={radarCy} r={3} fill={course.color} opacity={0.85} />
                                </svg>

                                {/* Hover tooltip · full course-stat breakdown */}
                                {radarHover !== null && axisItems[radarHover] && (
                                  (() => {
                                    const item = axisItems[radarHover];
                                    const pt = getPoint(radarHover, 1);
                                    const axisCol = cAxis(radarHover);
                                    const done = item.ses.filter(s => s.completed).length;
                                    const tipLayout = tooltipLayout(pt);
                                    return (
                                      <div className="no-scrollbar" style={{
                                        position: 'absolute', zIndex: 30, pointerEvents: 'none',
                                        left: tipLayout.left,
                                        top: tipLayout.top,
                                        width: 252, maxHeight: 340, overflowY: 'auto',
                                        background: 'color-mix(in srgb, var(--bg-elevated-alpha, var(--bg-elevated)) 97%, transparent)',
                                        border: '1px solid var(--border-subtle)',
                                        borderTop: `1px solid ${axisCol}66`,
                                        borderRadius: 12, padding: '13px 15px 14px',
                                        boxShadow: `0 14px 34px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.05) inset`,
                                        display: 'flex', flexDirection: 'column',
                                        backdropFilter: 'blur(18px)',
                                      }}>
                                        {/* cabecera: punto + nombre */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                          <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', background: axisCol, boxShadow: `0 0 8px ${axisCol}66` }} />
                                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{item.name}</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{Math.round(item.mastery * 100)}%</span>
                                        </div>

                                        {/* valor principal */}
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, margin: '9px 0 10px' }}>
                                          <span style={{ fontSize: 25, fontWeight: 500, color: axisCol, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtVal(item)}</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Inter Tight', sans-serif" }}>Rendimiento</span>
                                          <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${axisCol}30, transparent)` }} />
                                        </div>

                                        <div style={{ height: 1, background: 'var(--border-subtle)', opacity: 0.7 }} />

                                        {/* En esta agrupación */}
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '10px 0 5px', fontFamily: "'Inter Tight', sans-serif" }}>En esta agrupación</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 500 }}>Materiales</span><span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{item.matCount}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 500 }}>Sesiones planificadas</span>
                                            <span style={{ fontWeight: 600, color: item.ses.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{item.ses.length > 0 ? `${done}/${item.ses.length}` : '—'}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 500 }}>Intensidad real/plan</span>
                                            <span style={{ fontWeight: 600, color: item.planInt > 0 ? axisCol : 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{item.planInt > 0 || item.realInt > 0 ? `${Math.round(item.realInt)} / ${item.planInt > 0 ? Math.round(item.planInt) : '—'}` : '—'}</span>
                                          </div>
                                          {item.topicCount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                              <span style={{ fontWeight: 500 }}>Temas en progreso</span><span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{item.activeTopics}/{item.topicCount}</span>
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ height: 1, background: 'var(--border-subtle)', opacity: 0.7, marginTop: 10 }} />

                                        {/* Actividad real del curso */}
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '10px 0 5px', fontFamily: "'Inter Tight', sans-serif" }}>Actividad real del curso</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 500 }}>Sesiones reales</span><span style={{ fontWeight: 600, color: courseRealSessions > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{courseRealSessions > 0 ? courseRealSessions : '—'}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 500 }}>Minutos estudiados</span><span style={{ fontWeight: 600, color: courseRealMin > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{courseRealMin > 0 ? `${courseRealMin} min` : '—'}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 500 }}>Tiempo vs. plan</span><span style={{ fontWeight: 600, color: coursePlanMin > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{coursePlanMin > 0 ? `${coursePlanPct}%` : '—'}</span>
                                          </div>
                                        </div>

                                        <div style={{ height: 1, background: 'var(--border-subtle)', opacity: 0.7, marginTop: 10 }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif", flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 600 }}>Tareas {courseTasksDone}/{courseTasks.length}</span>
                                          <span style={{ opacity: 0.5 }}>·</span>
                                          <span style={{ fontWeight: 600 }}>{courseNotes} notas</span>
                                          <span style={{ opacity: 0.5 }}>·</span>
                                          <span style={{ fontWeight: 600 }}>{coursePlanDone}/{coursePlan.length} planif.</span>
                                        </div>
                                      </div>
                                    );
                                  })()
                                )}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                  {/* -- RIGHT: AGRUPACIONES · FULL LATERAL -- */}
                  <div className="course-group-section" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px 10px', flexShrink: 0 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Agrupaciones</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button data-ui-control="" onClick={() => { setEditingGroupId(null); setGroupName(''); setGroupCover(undefined); setShowGroupModal(true); }}
                          style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${course.color}40`, background: `${course.color}08`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${course.color}18`; e.currentTarget.style.borderColor = `${course.color}60`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${course.color}08`; e.currentTarget.style.borderColor = `${course.color}40`; }}
                          title="Nueva agrupacion">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 12px 40px', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-scrollbar">
                      {groups.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)', gap: 6 }}>
                          <Layers size={18} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Sin agrupaciones</p>
                        </div>
                      ) : (
                      <DndContext sensors={studySensors} collisionDetection={closestCorners} onDragStart={e => { setActiveGroupDragId(e.active.id as string); }} onDragEnd={handleGroupDragEnd}>
                      <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                      {groups.map(group => {
                        return (
                          <SortableWrapper key={group.id} id={group.id}>
                          {({ attributes, listeners, isDragging }) => (
                          <div {...attributes} {...listeners}
                            style={{ flexShrink: 0, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated-alpha, var(--bg-elevated))', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'pointer', transition: 'all 200ms ' + EASE, position: 'relative', opacity: isDragging ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!group.image) { e.currentTarget.style.borderColor = `${course.color}40`; } e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${course.color}12`; }}
                            onMouseLeave={e => { if (!group.image) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; } e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            onClick={() => { setSelectedGroupId(group.id); setCurrentView('group'); }}>
                            {group.image ? (
                                <div style={{ width: '100%', height: 88, overflow: 'hidden', position: 'relative' }}>
                                <img src={group.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 400ms cubic-bezier(0.16,1,0.3,1)' }}
                                  onMouseEnter={ev => { ev.currentTarget.style.transform = 'scale(1.04)'; }}
                                  onMouseLeave={ev => { ev.currentTarget.style.transform = 'scale(1)'; }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 1px 6px rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{group.name}</div>
                                  </div>
                                  <button data-ui-control="" onClick={e => { e.stopPropagation(); setInlineEditGroupId(group.id); setInlineGroupName(group.name); setInlineGroupCover(group.image); }}
                                    style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', opacity: 0.7 }}
                                    onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.22)'; ev.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.12)'; ev.currentTarget.style.opacity = '0.7'; }}
                                    title="Editar">
                                    <Edit3 size={11} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, ${course.color} 10%, transparent)`, border: `1px solid ${course.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 200ms ' + EASE }}>
                                  <Layers size={16} style={{ color: course.color }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{group.name}</div>
                                </div>
                                <button data-ui-control="" onClick={e => { e.stopPropagation(); setInlineEditGroupId(group.id); setInlineGroupName(group.name); setInlineGroupCover(group.image); }}
                                  style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', opacity: 0 }}
                                  onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--bg-hover)'; ev.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.opacity = '0'; }}
                                  title="Editar">
                                  <Edit3 size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                          )}
                          </SortableWrapper>
                        );
                      })}
                      </SortableContext>
                      </DndContext>
                      )}
                    </div>
                  </div>
                </div>

                {/* -- DAY DETAIL MODAL -- */}
                {showDayDetail && dayDetailDate && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowDayDetail(false); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 540, maxHeight: '78vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="bento-card">
                      {(() => {
                        const daySessions = (plannedSessions || [])
                          .filter(s => !!s)
                          .filter(s => s.courseId === course.id && expandsToDate(s, dayDetailDate))
                          .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
                          .sort((a, b) => Number(a.completed) - Number(b.completed));
                        const pending = daySessions.filter(s => !s.completed);
                        const doneCount = daySessions.length - pending.length;
                        const allDone = daySessions.length > 0 && pending.length === 0;
                        const totalMins = daySessions.reduce((a, s) => a + s.durationMinutes, 0);
                        const dayInfo = new Date(dayDetailDate + 'T12:00:00');
                        const openPlanForDay = () => { setPlanDate(dayDetailDate); setPlanStartTime('09:00'); setPlanTitle(''); setPlanGroupId(''); setPlanTopicId(''); setPlanType('estudio'); setPlanDuration(30); setPlanIntensity(5); setShowDayDetail(false); setShowPlanModal(true); };
                        const toggleMarkDay = () => {
                          if (pending.length > 0) { pending.forEach(s => updatePlannedSession(s.id, { completed: true })); }
                          else if (daySessions.length > 0) { daySessions.forEach(s => updatePlannedSession(s.id, { completed: false })); }
                        };
                        return (
                          <>
                            {/* Top accent bar */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${course.color}, ${course.color}66, transparent)`, pointerEvents: 'none' }} />
                            {/* Header */}
                            <div style={{ padding: '36px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}25`, flexDirection: 'column', flexShrink: 0 }}>
                                  <span style={{ fontSize: 17, fontWeight: 800, color: course.color, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{format(dayInfo, 'd')}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: `${course.color}90`, fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{format(dayInfo, 'EEE', { locale: es })}</span>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {format(dayInfo, "d 'de' MMMM", { locale: es })}
                                  </h3>
                                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                                    {daySessions.length === 0 ? 'Sin sesiones planificadas' : `${daySessions.length} sesiones · ${totalMins} min${doneCount > 0 ? ` · ${doneCount} completadas` : ''}`}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <button data-ui-control="" onClick={openPlanForDay}
                                  style={{ height: 32, borderRadius: 9, border: `1px solid ${course.color}40`, background: `${course.color}14`, cursor: 'pointer', color: course.color, padding: '0 14px', fontSize: 11, fontWeight: 800, fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms', boxShadow: `0 2px 10px ${course.color}12` }}
                                  onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}60`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = `${course.color}14`; e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                  <Plus size={12} /> Agregar evento
                                </button>
                                <button data-ui-control="" onClick={() => setShowDayDetail(false)}
                                  style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                  <X size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Corner completion tag */}
                            {daySessions.length > 0 && (
                              <button data-ui-control="" onClick={toggleMarkDay}
                                title={allDone ? 'Desmarcar día como pendiente' : 'Marcar día como completado'}
                                style={{
                                  position: 'absolute', top: 0, right: 0, borderTopRightRadius: 16, borderBottomLeftRadius: 14,
                                  background: allDone ? '#10B981' : `${course.color}12`,
                                  border: allDone ? 'none' : `1px dashed ${course.color}55`,
                                  cursor: 'pointer', color: allDone ? '#fff' : course.color,
                                  padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 6,
                                  fontFamily: "'Inter Tight', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                                  transition: 'all 200ms',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}>
                                {allDone ? <Check size={12} /> : <Flag size={11} />} {allDone ? 'Completado' : 'Marcar'}
                              </button>
                            )}

                            {/* Session list */}
                            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 24px' }} className="no-scrollbar">
                              {daySessions.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 0', gap: 10 }}>
                                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${course.color}0d`, border: `1px dashed ${course.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={20} style={{ color: `${course.color}70` }} />
                                  </div>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>No hay sesiones planificadas</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", textAlign: 'center', maxWidth: 250 }}>Usa el botón "Agregar evento" para planificar un bloque de estudio, repaso o ejercicio para este día.</span>
                                </div>
                              ) : (
                                <>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>{pending.length > 0 ? 'Por completar' : 'Todas completadas'}</span>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{doneCount}/{daySessions.length} · {totalMins} min</span>
                                    </div>
                                    <div style={{ height: 4, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                                      <div style={{ width: `${(doneCount / daySessions.length) * 100}%`, height: '100%', borderRadius: 3, background: allDone ? '#10B981' : course.color, transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)' }} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {daySessions.map(s => {
                                      const tc = sessionTypeColor(s.type);
                                      const grp = s.groupId ? groups.find(g => g.id === s.groupId) : null;
                                      const tpc = s.topicId ? parsedTopics.find(t => t.id === s.topicId) : null;
                                      const openLinked = () => {
                                        setShowDayDetail(false);
                                        if (s.topicId) {
                                          setActiveTopicId(s.topicId); setCurrentView('topic'); setTopicSearch(''); setActiveTagFilter(null);
                                        } else if (s.groupId) {
                                          setSelectedGroupId(s.groupId); setCurrentView('group');
                                        }
                                      };
                                      return (
                                        <div key={s.id}
                                          onClick={openLinked}
                                          title={s.topicId || s.groupId ? 'Abrir agrupación o tema vinculado' : undefined}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 11,
                                            padding: '11px 10px 11px 13px', borderRadius: 11,
                                            background: s.completed ? 'var(--bg-deep)' : 'var(--bg-elevated)',
                                            border: '1px solid var(--border-subtle)',
                                            borderLeft: `3px solid ${tc}`,
                                            opacity: s.completed ? 0.6 : 1,
                                            cursor: s.topicId || s.groupId ? 'pointer' : 'default',
                                            transition: 'all 150ms',
                                          }}
                                          onMouseEnter={e => { if (!s.completed) { e.currentTarget.style.borderColor = `${tc}45`; e.currentTarget.style.borderLeftColor = tc; e.currentTarget.style.background = `${tc}06`; } }}
                                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.borderLeftColor = tc; e.currentTarget.style.background = s.completed ? 'var(--bg-deep)' : 'var(--bg-elevated)'; }}>
                                          {/* Time chip */}
                                          {s.startTime && (
                                            <div style={{ width: 44, flexShrink: 0, textAlign: 'center', padding: '5px 0', borderRadius: 7, background: `${tc}10`, border: `1px solid ${tc}22` }}>
                                              <span style={{ fontSize: 11, fontWeight: 800, color: tc, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{s.startTime}</span>
                                            </div>
                                          )}
                                          {/* Type icon */}
                                          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${tc}12`, border: `1px solid ${tc}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {s.completed ? <Check size={12} style={{ color: tc }} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: tc }} />}
                                          </div>
                                          {/* Info */}
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: s.completed ? 'line-through' : 'none' }}>{s.title}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: 11, fontWeight: 700, color: tc, fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sessionTypeLabel(s.type)}</span>
                                              {grp && <><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{grp.name}</span></>}
                                              {tpc && <><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{tpc.title}</span></>}
                                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{s.durationMinutes} min</span>
                                            </div>
                                          </div>
                                          {/* Delete */}
                                          <button data-ui-control="" onClick={(e) => { e.stopPropagation(); setConfirmDeleteSession(s); }}
                                            title="Eliminar sesión"
                                            style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', flexShrink: 0, opacity: 0.5 }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.opacity = '1'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.5'; }}>
                                            <Trash2 size={12} />
                                          </button>
                                          {(s.topicId || s.groupId) && (
                                            <ChevronRight size={15} style={{ color: 'var(--text-muted)', opacity: 0.35, flexShrink: 0 }} />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* -- CHARTS & ANALYTICS MODAL -- */}
                {showChartsModal && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowChartsModal(false); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }} />
                    <div style={{ position: 'relative', width: 660, maxHeight: '85vh', background: 'var(--bg-surface)', borderRadius: 18, border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="bento-card">
                      {/* Header */}
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${course.color}15`, border: `1px solid ${course.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart3 size={18} style={{ color: course.color }} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Estadísticas y Análisis de Estudio</h3>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>Métricas algorítmicas y polígono de rendimiento</span>
                          </div>
                        </div>
                        <button data-ui-control="" onClick={() => setShowChartsModal(false)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <X size={14} />
                        </button>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }} className="no-scrollbar">

                        {/* Top Stats Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          {(() => {
                            const courseSessions = (plannedSessions || []).filter(s => s.courseId === course.id);
                            const totalMins = courseSessions.reduce((a, s) => a + s.durationMinutes, 0);
                            const doneSessions = courseSessions.filter(s => s.completed).length;
                            const totalSessions = courseSessions.length;
                            const pct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 75;

                            return [
                              { label: 'Tiempo Planificado', val: `${Math.round(totalMins / 60)}h ${totalMins % 60}m`, sub: `${totalSessions} sesiones`, color: course.color },
                              { label: 'Completado', val: `${doneSessions} / ${totalSessions}`, sub: `${pct}% completado`, color: '#10B981' },
                              { label: 'Rendimiento', val: `${pct}%`, sub: 'Índice de enfoque', color: '#8B5CF6' },
                            ].map((st, i) => (
                              <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif" }}>{st.label}</span>
                                <span style={{ fontSize: 20, fontWeight: 800, color: st.color, fontFamily: "'Inter Tight', sans-serif" }}>{st.val}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.sub}</span>
                              </div>
                            ));
                          })()}
                        </div>

                        {/* Enlarged Radar Chart */}
                        <div style={{ padding: '18px', borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Polígono de Rendimiento Multidimensional</span>
                            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                              {([['agrupaciones','Agrupaciones'],['dias','Días'],['tipos','Tipos']] as const).map(([key, lbl]) => (
                                <button data-ui-control="" key={key} onClick={() => setRadarFilter(key)}
                                  style={{ height: 24, borderRadius: 6, border: 'none', background: radarFilter === key ? course.color : 'transparent', cursor: 'pointer', color: radarFilter === key ? '#fff' : 'var(--text-muted)', padding: '0 10px', fontSize: 11, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                                  {lbl}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Large SVG Radar */}
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                            {(() => {
                              const rCx = 200, rCy = 150, rR = 110;
                              const typeColors4: Record<string, string> = { estudio: '#8B5CF6', repaso: '#3B82F6', ejercicio: '#10B981', lectura: '#F59E0B', otro: '#6B7280' };
                              const dayLabels = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
                              const ws4 = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });

                              let labels: string[] = [];
                              let values: number[] = [];

                              if (radarFilter === 'agrupaciones' && groups.length > 0) {
                                labels = groups.slice(0, 8).map(g => g.name);
                                values = groups.slice(0, 8).map(g => {
                                  const gs = (plannedSessions || []).filter(s => s.courseId === course.id && s.groupId === g.id);
                                  const done = gs.filter(s => s.completed).length;
                                  return gs.length > 0 ? (done + 1) / (gs.length + 1) : 0.5;
                                });
                              } else if (radarFilter === 'dias') {
                                labels = dayLabels;
                                values = Array.from({ length: 7 }, (_, i) => {
                                  const d = format(addDays(ws4, i), 'yyyy-MM-dd');
                                  const ds = (plannedSessions || []).filter(s => s.courseId === course.id && s.date === d);
                                  const done = ds.filter(s => s.completed).length;
                                  return ds.length > 0 ? (done + 1) / (ds.length + 1) : 0.4 + (i % 3) * 0.2;
                                });
                              } else {
                                labels = Object.keys(typeColors4).map(k => k.charAt(0).toUpperCase() + k.slice(1));
                                values = Object.keys(typeColors4).map((t, idx) => {
                                  const ts = (plannedSessions || []).filter(s => s.courseId === course.id && s.type === t);
                                  const done = ts.filter(s => s.completed).length;
                                  return ts.length > 0 ? (done + 1) / (ts.length + 1) : 0.55 + (idx % 2) * 0.2;
                                });
                              }

                              const n = Math.max(3, labels.length);
                              const angleStep = (2 * Math.PI) / n;
                              const gridLevels = [0.25, 0.5, 0.75, 1];

                              const getPoint = (idx: number, val: number) => {
                                const angle = angleStep * idx - Math.PI / 2;
                                return { x: rCx + rR * val * Math.cos(angle), y: rCy + rR * val * Math.sin(angle) };
                              };

                              const dataPoints = values.map((v, i) => getPoint(i, Math.max(0.18, Math.min(1, v))));
                              const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

                              return (
                                <svg width="100%" viewBox="0 0 400 300" style={{ maxWidth: 440, overflow: 'visible' }}>
                                  {gridLevels.map(lv => (
                                    <polygon key={lv}
                                      points={Array.from({ length: n }, (_, i) => { const p = getPoint(i, lv); return `${p.x},${p.y}`; }).join(' ')}
                                      fill="none" stroke="var(--border-subtle)" strokeWidth="0.8" opacity={0.6} />
                                  ))}
                                  {Array.from({ length: n }, (_, i) => {
                                    const p = getPoint(i, 1);
                                    return <line key={i} x1={rCx} y1={rCy} x2={p.x} y2={p.y} stroke="var(--border-subtle)" strokeWidth="0.8" opacity={0.5} />;
                                  })}
                                  <path d={dataPath} fill={`${course.color}25`} stroke={course.color} strokeWidth="2.5" strokeLinejoin="round" style={{ transition: 'all 500ms cubic-bezier(0.16,1,0.3,1)' }} />
                                  {dataPoints.map((p, i) => (
                                    <g key={i}>
                                      <circle cx={p.x} cy={p.y} r={4.5} fill={course.color} stroke="var(--bg-surface)" strokeWidth="2" />
                                    </g>
                                  ))}
                                  {labels.map((lbl, i) => {
                                    const p = getPoint(i, 1.2);
                                    const anchor = p.x < rCx - 10 ? 'end' : p.x > rCx + 10 ? 'start' : 'middle';
                                    const pctVal = Math.round(values[i] * 100);
                                    return (
                                      <g key={i}>
                                        <text x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fill="var(--text-primary)" fontSize="10" fontFamily="'Inter Tight', sans-serif" fontWeight="700">{lbl}</text>
                                        <text x={p.x} y={p.y + 12} textAnchor={anchor} dominantBaseline="middle" fill={course.color} fontSize="8.5" fontFamily="'Inter Tight', sans-serif" fontWeight="800">{pctVal}%</text>
                                      </g>
                                    );
                                  })}
                                  <circle cx={rCx} cy={rCy} r={3} fill={course.color} opacity={0.6} />
                                </svg>
                              );
                            })()}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                {/* -- INLINE EDIT MODAL OVERLAY -- */}
                {inlineEditGroupId && (() => {
                  const editingGroup = groups.find(g => g.id === inlineEditGroupId);
                  if (!editingGroup) return null;
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { if (e.target === e.currentTarget) setInlineEditGroupId(null); }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                      <div style={{ position: 'relative', width: 440, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', padding: 0, overflow: 'hidden' }} className="bento-card">
                        {/* Header */}
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Editar agrupacion</h3>
                          <button data-ui-control="" onClick={() => setInlineEditGroupId(null)}
                            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                            <X size={14} />
                          </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Name */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                            <input value={inlineGroupName} onChange={e => setInlineGroupName(e.target.value)} placeholder="Nombre de la agrupacion"
                              style={{ width: '100%', height: 40, borderRadius: 10, padding: '0 14px', fontSize: 13, fontWeight: 500, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", transition: 'border-color 150ms' }}
                              onFocus={e => { e.currentTarget.style.borderColor = `${course.color}60`; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }} />
                          </div>

                          {/* Banner */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>Banner</label>
                            {inlineGroupCover ? (
                              <div style={{ position: 'relative', width: '100%', height: 100, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                                <img src={inlineGroupCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button data-ui-control="" onClick={() => setInlineGroupCover(undefined)}
                                  style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 7, background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.85)'; }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button data-ui-control="" onClick={() => groupCoverInputInlineRef.current?.click()}
                                style={{ width: '100%', height: 80, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', transition: 'all 150ms', fontSize: 12, fontWeight: 500 }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}50`; e.currentTarget.style.background = `${course.color}08`; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                                <Upload size={16} />
                                <span>Subir imagen de portada</span>
                              </button>
                            )}
                            <input type="file" ref={groupCoverInputInlineRef} style={{ display: 'none' }} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setInlineGroupCover(ev.target?.result as string); r.readAsDataURL(f); } }} />
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button data-ui-control="" onClick={() => setConfirmDeleteGroupId(inlineEditGroupId)}
                            style={{ height: 36, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}>
                            <Trash2 size={13} /> Eliminar
                          </button>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button data-app-action="secondary" data-ui-control="" onClick={() => setInlineEditGroupId(null)}
                              style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                              Cancelar
                            </button>
                            <button data-ui-control="" onClick={() => {
                              if (inlineGroupName.trim()) {
                                const currentGroups = safeArr(course.groups);
                                updateCourse(course.id, { groups: currentGroups.map(g => g.id === inlineEditGroupId ? { ...g, name: inlineGroupName.trim(), image: inlineGroupCover } : g) });
                                toast.success('Agrupacion actualizada');
                              }
                              setInlineEditGroupId(null);
                            }}
                              style={{ height: 36, borderRadius: 8, border: 'none', background: inlineGroupName.trim() ? course.color : 'var(--bg-hover)', color: inlineGroupName.trim() ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: inlineGroupName.trim() ? 'pointer' : 'default', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                              onMouseEnter={e => { if (inlineGroupName.trim()) e.currentTarget.style.opacity = '0.9'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                              Guardar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* -- DELETE CONFIRMATION DIALOG -- */}
                {confirmDeleteGroupId && (() => {
                  const delGroup = groups.find(g => g.id === confirmDeleteGroupId);
                  const delCount = parsedTopics.filter(t => t.groupId === confirmDeleteGroupId).length;
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteGroupId(null); }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
                      <div style={{ position: 'relative', width: 380, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <AlertTriangle size={24} style={{ color: '#EF4444' }} />
                          </div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Eliminar agrupacion</h3>
                          {delGroup && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>"{delGroup.name}" sera eliminada</p>}
                          {delCount > 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{delCount} tema{delCount !== 1 ? 's' : ''} se desvincular{delCount !== 1 ? 'an' : 'a'}</p>}
                        </div>
                        <div style={{ padding: '12px 24px 24px', display: 'flex', gap: 10, justifyContent: 'center' }}>
                          <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteGroupId(null)}
                            style={{ height: 38, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            Cancelar
                          </button>
                          <button data-ui-control="" onClick={() => { handleDeleteGroup(confirmDeleteGroupId); setConfirmDeleteGroupId(null); if (inlineEditGroupId === confirmDeleteGroupId) setInlineEditGroupId(null); }}
                            style={{ height: 38, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </>
              )
            }
            </div>
          </div>
        ) : activeTab === 'tareas' ? (
          /* --- TAREAS TAB --- */
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 60px' }}>
            {/* Create task card */}
            <div className="bento-card course-task-creator" style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', marginBottom: 20, padding: 0, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 16px' }}>
                <input aria-label="Nombre de la tarea del curso" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nombre de la tarea"
                  style={{ width: '100%', border: 'none', borderBottom: 'none', height: 'auto', padding: '2px 0', fontSize: 16, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif", borderRadius: 0, letterSpacing: '-0.02em' }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAddTask(); }} />
                <div style={{ padding: '0 0', margin: '6px 0' }}>
                  <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${course.color}30, transparent)` }} />
                </div>
                <textarea aria-label="Descripción de la tarea del curso" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} placeholder="Descripción (opcional)"
                  rows={1} style={{ width: '100%', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-tertiary)', background: 'transparent', outline: 'none', resize: 'none', fontFamily: "'Inter', sans-serif", overflow: 'hidden', lineHeight: 1.6 }}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />
                <div className="course-task-create-fields" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 }}>
                  <input aria-label="Fecha de entrega de la tarea del curso" type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)}
                    style={{ height: 42, borderRadius: 8, border: selectBorder, background: newTaskDueDate ? `${course.color}08` : 'var(--bg-surface)', color: newTaskDueDate ? course.color : 'var(--text-tertiary)', padding: '0 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", outline: 'none', width: 170, minWidth: 170, boxSizing: 'border-box' }} />
                  <PlanSelectDropdown label="Prioridad de la tarea del curso" value={newTaskPriority==='none'?'':newTaskPriority} onChange={value=>setNewTaskPriority((value||'none') as typeof newTaskPriority)} options={[{id:'high',label:'Alta',color:'#EF4444'},{id:'medium',label:'Media',color:'#F59E0B'},{id:'low',label:'Baja',color:'#10B981'}]} noneLabel="Sin prioridad" color={course.color} searchable={false}/>
                  <div style={{ flex: 1 }} />
                  <button data-ui-control="" onClick={handleAddTask} disabled={!newTaskTitle.trim()}
                    style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${newTaskTitle.trim() ? course.color : 'var(--border-subtle)'}`, background: 'transparent', color: newTaskTitle.trim() ? course.color : 'var(--text-muted)', cursor: newTaskTitle.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                    title="Añadir tarea">
                    <PlusCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
            {/* Task list header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${course.color}25)` }} />
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Tareas académicas</h3>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${course.color}25)` }} />
            </div>
            {/* Task list */}
            {pendingTasks.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParentElement]} onDragStart={() => { tasksDragRef.current = true; }} onDragEnd={(e) => handleTaskDragEnd(e, false)}>
                <SortableContext items={[...pendingTasks].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)).map(t => t.id)} strategy={rectSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...pendingTasks].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)).map((task, idx) => {
                  const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
                  const priorityLabels: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
                  const descPreview = (task.notes || '').replace(/<[^>]+>/g, '').trim().slice(0, 45);
                  let dueDisplay = ''; let isOverdue = false;
                  if (task.dueDate) {
                    const dueStr = task.dueDate.split('T')[0];
                    const today = new Date(); today.setHours(0,0,0,0);
                    const due = new Date(dueStr + 'T12:00:00');
                    const day = due.getDate().toString().padStart(2, '0');
                    const month = (due.getMonth() + 1).toString().padStart(2, '0');
                    const year = due.getFullYear();
                    dueDisplay = `${day}/${month}/${year}`;
                    isOverdue = Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24)) < 0;
                  }
                  return (
                    <SortableWrapper key={task.id} id={task.id} style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
                      {({ attributes, listeners, isDragging }) => (
                    <div {...attributes} {...listeners} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', borderLeft: task.priority !== 'none' && task.priority ? `3px solid ${priorityColors[task.priority]}` : '3px solid transparent', background: 'var(--bg-elevated-alpha, var(--bg-elevated))', transition: 'all 200ms ' + EASE, boxShadow: '0 0 0 0 rgba(0,0,0,0)', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', opacity: isDragging ? 0.4 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.boxShadow = `0 2px 10px ${course.color}08`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)'; }}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setTaskMenu({ id: task.id, x: e.clientX, y: e.clientY }); }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', minWidth: 14, textAlign: 'right', flexShrink: 0, fontFamily: "'Inter Tight', sans-serif" }}>{idx + 1}</span>
                      <div onClick={() => handleToggleTask(task.id)} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: `1.5px solid ${task.status === 'progreso' ? '#3B82F6' : task.status === 'completado' ? '#10B981' : `${course.color}40`}`, background: task.status === 'progreso' ? '#3B82F6' : task.status === 'completado' ? '#10B981' : `${course.color}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}>
                        {task.status === 'completado' && <Check size={11} strokeWidth={2.5} color="#fff" />}
                        {task.status === 'progreso' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        {task.status === 'inicio' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: course.color, opacity: 0.4 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif" }}>{task.title}</div>
                        {descPreview && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{descPreview}</div>}
                      </div>
                      <div style={{ width: 52, flexShrink: 0, textAlign: 'center' }}>
                        {task.priority !== 'none' && task.priority && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority], textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap' }}>{priorityLabels[task.priority]}</span>
                        )}
                      </div>
                      <div style={{ width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {dueDisplay && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: isOverdue ? '#EF4444' : 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap' }}>
                            <LI.Calendar size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                            {dueDisplay}
                          </span>
                        )}
                      </div>
                    </div>
                      )}
                    </SortableWrapper>
                  );
                })}
                </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
                <ListTodo size={28} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
                <p style={{ fontSize: 12 }}>Vacío</p>
              </div>
            )}
            {/* Completed tasks */}
            {courseTasks.filter(t => t.status === 'completado').length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
                  <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${course.color}20)` }} />
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif" }}>Completadas</h4>
                  <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${course.color}20)` }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {courseTasks.filter(t => t.status === 'completado').map((task, idx) => {
                    const isConfirm = pendingTaskDeleteId === task.id;
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-alpha, var(--bg-surface))', opacity: 0.7 }}>
                        <Check size={12} style={{ color: '#10B981', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif", textDecoration: 'line-through' }}>{task.title}</div>
                        </div>
                        {isConfirm ? (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button data-app-action="secondary" data-ui-control="" onClick={() => setPendingTaskDeleteId(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>Cancelar</button>
                            <button data-ui-control="" onClick={() => { deleteTask(task.id); setPendingTaskDeleteId(null); toast.success('Tarea eliminada'); }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
                          </div>
                        ) : (
                          <button data-app-action="danger" data-ui-control="" onClick={() => setPendingTaskDeleteId(task.id)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: 'rgba(239,68,68,0.6)', fontSize: 11, cursor: 'pointer', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; }}>
                            <Trash2 size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} /> Eliminar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'notas' ? (
          /* --- APUNTES TAB --- */
          <div style={{ maxWidth: 800, margin: '0 auto', padding: editingNoteId ? '20px 24px 20px' : '20px 24px 60px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 15, borderRadius: 2, background: course.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif" }}>Apuntes</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-hover)', height: 18, padding: '0 7px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', fontFamily: "'Inter Tight', sans-serif" }}>{courseNotes.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {courseNotes.length > 0 && (
                  <>
                    <div style={{ position: 'relative', width: 140 }}>
                      <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', marginTop: -5.5, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input value={notesSearch} onChange={e => setNotesSearch(e.target.value)} placeholder="Buscar..."
                        style={{ width: '100%', height: 28, padding: '0 10px 0 26px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 11, outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }} />
                    </div>
                  </>
                )}
                <button data-ui-control="" onClick={handleCreateNote} disabled={!!editingNoteId}
                  title={editingNoteId ? 'Termina de editar el apunte actual' : 'Nuevo apunte'}
                  style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${editingNoteId ? 'var(--border-subtle)' : course.color}`, background: 'transparent', color: editingNoteId ? 'var(--text-muted)' : course.color, cursor: editingNoteId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE, opacity: editingNoteId ? 0.35 : 1 }}
                  onMouseEnter={e => { if (!editingNoteId) { e.currentTarget.style.background = course.color; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={e => { if (!editingNoteId) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = course.color; } }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
            {(notesSearch ? filteredNotes : sortedNotes).length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={() => { notesDragRef.current = true; }} onDragCancel={()=>{notesDragRef.current=false;}} onDragEnd={handleNoteDragEnd}>
                <SortableContext items={(notesSearch ? filteredNotes : sortedNotes).map(n => n.id)} strategy={rectSortingStrategy}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                    {(notesSearch ? filteredNotes : sortedNotes).map(n => {
                      const isEditing = editingNoteId === n.id;
                      const handleStartEdit = () => {
                        if (!isEditing && !editingNoteId) {
                          setEditingNoteId(n.id);
                          setEditContent(n.content || '');
                        }
                      };
                      const handleDoneEditing = () => {
                        saveCourseNoteContent(n.id, liveNoteEditors.get(n.id)?.() ?? n.content);
                        setEditingNoteId(null);
                      };
                      return (
                        <SortableWrapper key={n.id} id={n.id}>
                          {({ attributes, listeners, isDragging }) => (
                            <div style={{
                              borderRadius: 16, border: `1px solid ${isEditing ? `${course.color}40` : 'var(--border-subtle)'}`, background: 'var(--bg-elevated-alpha, var(--bg-elevated))', transition: 'all 200ms ' + EASE, cursor: !isEditing && !editingNoteId ? 'pointer' : 'default', boxShadow: isEditing ? `0 4px 24px ${course.color}14` : 'none', minHeight: isEditing ? 'auto' : 140,
                              position: 'relative', opacity: isDragging ? 0.4 : 1, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
                            }}
                              {...(!isEditing ? { ...attributes, ...listeners } : {})}
                              onClick={() => { if (!isEditing && !editingNoteId && !notesDragRef.current) handleStartEdit(); }}
                              onMouseEnter={e => { if (!isEditing && !editingNoteId) { e.currentTarget.style.borderColor = `${course.color}28`; e.currentTarget.style.background = `${course.color}03`; } }}
                              onMouseLeave={e => { if (!isEditing && !editingNoteId) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated-alpha, var(--bg-elevated))'; } }}>
                              {/* -- NOT EDITING -- */}
                              {!isEditing ? (
                                <div className="course-note-preview" style={{ padding: '18px' }}>
                                  <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-primary)', fontFamily: "'Atkinson Hyperlegible', system-ui, serif", wordBreak: 'break-word', maxHeight: 360, overflowY: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: n.content || '<span style="color:var(--text-muted);font-style:italic;font-size:13px">Haz clic para añadir contenido...</span>' }} />
                                </div>
                              ) : (
                                /* -- EDITING -- */
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <NoteEditor key={n.id} note={n} courseColor={course.color} editable onSave={(id,data)=>saveCourseNoteContent(id,data.content)} toolbarEnd={<>
                                    <button data-ui-control="" onClick={() => handleTogglePinNote(n.id)}
                                      style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: n.isPinned ? '#F59E0B' : 'var(--text-muted)', transition: 'color 150ms ' + EASE }}
                                      title={n.isPinned ? 'Quitar destacado' : 'Destacar'}>
                                      <Star size={13} fill={n.isPinned ? '#F59E0B' : 'none'} />
                                    </button>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button data-ui-control="" onClick={() => setConfirmDeleteNoteId(n.id)}
                                        style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms ' + EASE }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.4)'}
                                        title="Eliminar">
                                        <Trash2 size={13} />
                                      </button>
                                      <button data-ui-control="" onClick={handleDoneEditing}
                                        style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.55, transition: 'opacity 150ms ' + EASE }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
                                        title="Cerrar apunte" aria-label="Cerrar apunte">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </>}/>
                                </div>
                              )}
                            </div>
                          )}
                        </SortableWrapper>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : notesSearch ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Search size={24} style={{ margin: '0 auto 6px', opacity: 0.25 }} />
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Sin resultados para "{notesSearch}"</p>
              </div>
            ) : (
              <div onClick={handleCreateNote} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 12, cursor: 'pointer', transition: 'all 200ms ' + EASE }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.background = `${course.color}04`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'transparent'; }}>
                <StickyNote size={26} style={{ margin: '0 auto 6px', opacity: 0.25 }} />
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Nuevo apunte</p>
              </div>
            )}
          </div>
        ) : activeTab === 'archivos' ? (
          /* --- ARCHIVOS TAB --- */
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 60px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, fontFamily: "'Inter Tight', sans-serif" }}>Archivos de {course.name}</h2>
            {allCourseMaterials.filter(m => !!m && m.type === 'resource').length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {allCourseMaterials.filter(m => !!m && m.type === 'resource').map(mat => (
                  <div key={mat.id} onContextMenu={(e) => matRmb(e, mat, () => ({ url: mat.dataUrl || '', name: mat.name || 'Archivo', color: course.color }))} className={selMats.has(matKey(mat)) ? 'owa-mat-selected' : undefined} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'context-menu' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <File size={16} style={{ color: course.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name || 'Archivo'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(mat as any)._topicTitle || 'Tema general'}</div>
                    </div>
                    {mat.dataUrl && (
                      <button data-ui-control="" onClick={() => handleOpenResource(mat)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
                <FolderOpen size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>No hay archivos subidos en los temas de este curso</p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Los archivos se añaden desde la vista de cada tema</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ----------- MODALS ----------- */}
      {createPortal(<div className="course-portals" style={{ display: 'contents', '--course-color': course.color } as React.CSSProperties}>
      {showEditCourse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowEditCourse(false)}>
          <div role="dialog" aria-modal="true" aria-label="Configurar curso" className="bento-card course-settings-dialog" style={{ width: 432, padding: '26px 28px', borderRadius: 16, background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)", border: '1px solid var(--border-default)', boxShadow: "var(--shadow-elevated)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <GraduationCap size={16} style={{ color: course.color }} /> Configurar curso
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>Ajusta la información de la asignatura</p>
              </div>
              <button data-ui-control="" onClick={() => setShowEditCourse(false)} title="Cerrar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 6, transition: 'all 150ms ' + EASE }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Nombre</div>
                <input value={editCourseName} onChange={e => setEditCourseName(e.target.value)} placeholder="Nombre del curso"
                  style={{ width: '100%', height: 42, borderRadius: 10, padding: '0 13px', fontSize: 13, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 180ms ' + EASE }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Profesor</div>
                <input value={editCourseTeacher} onChange={e => setEditCourseTeacher(e.target.value)} placeholder="Nombre del profesor"
                  style={{ width: '100%', height: 42, borderRadius: 10, padding: '0 13px', fontSize: 13, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 180ms ' + EASE }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'} />
               </div>
               <div>
               <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: editCourseColor, flexShrink: 0, border: '2px solid var(--bg-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'background 200ms ' + EASE }} />
                <div style={{ flex: 1, position: 'relative', height: 30, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to right, #E11D48, #EC4899, #8B5CF6, #3B82F6, #06B6D4, #10B981, #84CC16, #F59E0B, #F97316)', borderRadius: 6 }} />
                  <input type="color" value={editCourseColor} onChange={e => setEditCourseColor(e.target.value)}
                    style={{ position: 'absolute', top: -4, left: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: 'pointer' }} />
                </div>
                <input value={editCourseColor.toUpperCase()} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setEditCourseColor(v.toLowerCase()); }} style={{ width: 68, height: 26, borderRadius: 4, padding: '0 6px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
              </div>
              <BannerField value={editCourseCover} onChange={value=>{setEditCourseCover(value);setEditCourseOriginal(value);setEditCourseCrop(undefined);}} onEdit={value=>setEditEditorSrc(editCourseOriginal||value)}/>
              <button className="course-settings-save" data-ui-control="" onClick={handleSaveCourseSettings}
                style={{ width: '100%', height: 42, borderRadius: 10, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.03em', cursor: 'pointer', transition: "all 200ms " + EASE, boxShadow: `0 6px 20px color-mix(in srgb, ${course.color} 28%, transparent)` }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
                Guardar cambios
              </button>
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 14, display: 'flex', justifyContent: 'center' }}>
                <button data-app-action="danger" data-ui-control="" onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmName(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: 'rgba(239,68,68,0.7)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', letterSpacing: '0.02em' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.color = '#EF4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; }}>
                  <Trash2 size={11} /> Eliminar asignatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor de imagen del banner (se abre al subir o al pulsar el lápiz) */}
      {editEditorSrc && (
        <ImageEditorModal src={editEditorSrc} initialCrop={editCourseCrop} title="Banner de la asignatura"
          onConfirm={handleEditCoverConfirm} onCancel={() => setEditEditorSrc(null)} />
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowDeleteConfirm(false)}>
          <div className="bento-card" style={{ width: 380, padding: 24, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.12)' }}>
                <Trash2 size={16} style={{ color: '#EF4444' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Eliminar asignatura</h3>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.4 }}>Esta acción no se puede deshacer.</p>
              </div>
              <button data-ui-control="" onClick={() => setShowDeleteConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Escribe <strong style={{ color: '#EF4444' }}>{course.name}</strong> para confirmar:
            </div>
            <input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} autoFocus
              placeholder="Nombre de la asignatura..."
              style={{ width: '100%', height: 38, borderRadius: 8, padding: '0 12px', fontSize: 12, fontFamily: "'Inter Tight', sans-serif", border: `1px solid ${deleteConfirmName.trim() === course.name ? 'rgba(239,68,68,0.5)' : 'var(--border-soft)'}`, background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button data-app-action="secondary" data-ui-control="" onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
              <button data-ui-control="" onClick={handleConfirmDeleteCourse} disabled={deleteConfirmName.trim() !== course.name}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: deleteConfirmName.trim() === course.name ? '#EF4444' : 'var(--bg-hover)', color: deleteConfirmName.trim() === course.name ? '#fff' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: deleteConfirmName.trim() === course.name ? 'pointer' : 'default', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={11} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {showTopicModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowTopicModal(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20` }}>
                  <Book size={14} style={{ color: course.color }} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>{editingTopicId ? 'Editar' : 'Nuevo'} Tema</h3>
              </div>
              <button data-ui-control="" onClick={() => setShowTopicModal(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                <input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="Ej: Capitulo 1 - Introduccion" autoFocus
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 150ms' }}
                  onFocus={e => { e.currentTarget.style.borderColor = `${course.color}60`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && topicName.trim()) handleAddTopic(); }} />
              </div>
            </div>
            <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button data-app-action="secondary" data-ui-control="" onClick={() => setShowTopicModal(false)}
                style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                Cancelar
              </button>
              <button data-ui-control="" onClick={handleAddTopic} disabled={!topicName.trim()}
                style={{ height: 36, borderRadius: 8, border: 'none', background: topicName.trim() ? course.color : 'var(--bg-hover)', color: topicName.trim() ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: topicName.trim() ? 'pointer' : 'default', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={e => { if (topicName.trim()) e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                {editingTopicId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGroupModal(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 440, maxHeight: '80vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20` }}>
                  <Layers size={14} style={{ color: course.color }} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>{editingGroupId ? 'Editar' : 'Nueva'} Agrupacion</h3>
              </div>
              <button data-ui-control="" onClick={() => setShowGroupModal(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ej: Unidad 1 - Fundamentos"
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 150ms' }}
                  onFocus={e => { e.currentTarget.style.borderColor = `${course.color}60`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Banner</label>
                {groupCover ? (
                  <div style={{ position: 'relative', width: '100%', height: 100, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <img src={groupCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button data-ui-control="" onClick={() => setGroupCover(undefined)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 7, background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.85)'; }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button data-ui-control="" onClick={() => groupCoverInputRef.current?.click()}
                    style={{ width: '100%', height: 80, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', transition: 'all 150ms', fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}50`; e.currentTarget.style.background = `${course.color}08`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                    <Upload size={16} />
                    <span>Subir imagen de portada</span>
                  </button>
                )}
                <input type="file" ref={groupCoverInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setGroupCover(ev.target?.result as string); r.readAsDataURL(f); } }} />
              </div>
            </div>
            <div style={{ padding: '12px 24px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 8 }}>
                {editingGroupId ? (
                  <button data-ui-control="" onClick={() => {
                    if (confirm('¿Eliminar esta agrupación? Los temas dentro pasarán a temas sueltos.')) {
                      handleDeleteGroup(editingGroupId);
                      setShowGroupModal(false);
                      if (currentView === 'group') setCurrentView('overview');
                    }
                  }} style={{ height: 36, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Inter Tight', sans-serif" }}>
                    <Trash2 size={13} /> Eliminar agrupación
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button data-app-action="secondary" data-ui-control="" onClick={() => setShowGroupModal(false)}
                    style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    Cancelar
                  </button>
                  <button data-ui-control="" onClick={handleSaveGroup} disabled={!groupName.trim()}
                    style={{ height: 36, borderRadius: 8, border: 'none', background: groupName.trim() ? course.color : 'var(--bg-hover)', color: groupName.trim() ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: groupName.trim() ? 'pointer' : 'default', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                    onMouseEnter={e => { if (groupName.trim()) e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                    {editingGroupId ? 'Guardar' : 'Crear'}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
      {/* Agrupacion Import/Export Modal */}
      {showAgrupacionImportExport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAgrupacionImportExport(false); setImportPreviewData(null); } }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 420, maxHeight: '80vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20` }}>
                  {importPreviewData ? <FileUp size={14} style={{ color: course.color }} /> : importExportMode === 'choose' ? <Package size={14} style={{ color: course.color }} /> : importExportMode === 'import' ? <FileUp size={14} style={{ color: course.color }} /> : <FileDown size={14} style={{ color: course.color }} />}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>{importPreviewData ? 'Vista previa de importacion' : importExportMode === 'choose' ? 'Importar / Exportar' : importExportMode === 'import' ? 'Importar temas' : 'Exportar temas'}</h3>
              </div>
              <button data-ui-control="" onClick={() => { setShowAgrupacionImportExport(false); setImportPreviewData(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflowY: 'auto', maxHeight: 'calc(80vh - 70px)' }} className="no-scrollbar">
              {importPreviewData ? (
                <>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Selecciona los temas que deseas importar.</p>
                  {!selectedGroupId && groups.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <Layers size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Destino:</span>
                      <select value={importTargetGroupId || ''} onChange={e => setImportTargetGroupId(e.target.value)}
                        style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 500, padding: '0 8px', outline: 'none', cursor: 'pointer' }}>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }} className="no-scrollbar">
                    {importPreviewData.map((item, gi) => {
                      const allSelected = item.topics.every((_, ti) => importSelected[gi]?.[ti]);
                      const someSelected = item.topics.some((_, ti) => importSelected[gi]?.[ti]);
                      return (
                        <div key={gi} style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', overflow: 'hidden' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', transition: 'all 150ms', background: allSelected ? `${course.color}08` : 'transparent' }}
                            onClick={() => {
                              const next = importSelected.map((row: boolean[]) => row ? [...row] : []);
                              const newVal = !allSelected;
                              next[gi] = item.topics.map(() => newVal);
                              setImportSelected(next);
                            }}>
                            <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${allSelected ? course.color : someSelected ? `${course.color}60` : 'var(--text-muted)'}`, background: allSelected ? course.color : someSelected ? `${course.color}30` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                              {allSelected && <Check size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                              {!allSelected && someSelected && <div style={{ width: 6, height: 2, borderRadius: 1, background: '#fff' }} />}
                            </div>
                            <Layers size={12} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>{item.group.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.topics.length} tema{item.topics.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
                            {item.topics.map((topic: any, ti: number) => {
                              const checked = importSelected[gi]?.[ti] ?? false;
                              return (
                                <div key={ti}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', transition: 'all 150ms', background: checked ? `${course.color}08` : 'transparent' }}
                                  onClick={() => {
                                    const next = importSelected.map((row: boolean[]) => row ? [...row] : []);
                                    if (!next[gi]) next[gi] = [];
                                    next[gi][ti] = !checked;
                                    setImportSelected(next);
                                  }}>
                                  <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${checked ? course.color : 'var(--text-muted)'}`, background: checked ? course.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                                    {checked && <Check size={8} style={{ color: '#fff', strokeWidth: 3 }} />}
                                  </div>
                                  <Book size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{topic.title || 'Sin titulo'}</span>
                                  {topic.materials?.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{topic.materials.length} material{topic.materials.length !== 1 ? 'es' : ''}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button data-ui-control="" onClick={() => { setImportPreviewData(null); setImportSelected([]); setImportExportMode('choose'); }}
                      style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                      Volver
                    </button>
                    <button data-ui-control="" onClick={() => {
                      if (!importPreviewData) return;
                      const totalSelectedTopics = importSelected.reduce((sum, row) => sum + (row?.filter(Boolean).length || 0), 0);
                      if (totalSelectedTopics === 0) { toast.error('Selecciona al menos un tema'); return; }
                      const currentTopics = course.studyTopics || [];
                      const newTopics = [...currentTopics];
                      let importedCount = 0;
                      importPreviewData.forEach((data, gi) => {
                        const selectedTopics = data.topics.filter((_: any, ti: number) => importSelected[gi]?.[ti]);
                        selectedTopics.forEach((t: any) => {
                          newTopics.push({ id: Math.random().toString(), title: t.title || 'Sin titulo', status: t.status || 'pending', createdAt: Date.now(), reviewLevel: t.reviewLevel || 0, nextReview: Date.now(), groupId: selectedGroupId || importTargetGroupId || (groups[0]?.id || ''), materials: t.materials || [] });
                          importedCount++;
                        });
                      });
                      updateCourse(course.id, { studyTopics: newTopics });
                      setShowAgrupacionImportExport(false);
                      setImportPreviewData(null);
                      setImportSelected([]);
                      toast.success(`${importedCount} tema${importedCount !== 1 ? 's' : ''} importado${importedCount !== 1 ? 's' : ''} en esta agrupacion`);
                    }}
                      style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms', boxShadow: `0 2px 8px ${course.color}35` }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                      Importar {importSelected.reduce((sum, row) => sum + (row?.filter(Boolean).length || 0), 0) > 0 ? `(${importSelected.reduce((sum, row) => sum + (row?.filter(Boolean).length || 0), 0)})` : ''}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {importExportMode === 'choose' ? (
                    /* -- CHOOSE: Two Elegant Blocks -- */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                      <button data-ui-control="" onClick={() => setImportExportMode('import')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.background = `${course.color}06`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${course.color}12`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${course.color}12`, border: `1px solid ${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileUp size={18} style={{ color: course.color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 2 }}>Importar</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>Cargar temas desde un archivo JSON exportado</div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                      </button>
                      <button data-ui-control="" onClick={() => setImportExportMode('export')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.background = `${course.color}06`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${course.color}12`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${course.color}12`, border: `1px solid ${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileDown size={18} style={{ color: course.color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 2 }}>Exportar</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>Exportar temas de las agrupaciones a un archivo JSON</div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                      </button>
                    </div>
                  ) : importExportMode === 'export' ? (
                    /* -- EXPORT -- */
                    selectedGroupId ? (
                      /* -- Export topics within current group -- */
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>Selecciona los temas que deseas exportar de esta agrupacion.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }} className="no-scrollbar">
                          {(() => {
                            const currentGrp = groups.find(g => g.id === selectedGroupId);
                            const grpTopics = parsedTopics.filter(t => t.groupId === selectedGroupId);
                            if (grpTopics.length === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No hay temas en esta agrupacion</span>;
                            return grpTopics.map(topic => {
                              const isSelected = exportSelectedIds.has(topic.id);
                              return (
                                <div key={topic.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms', background: isSelected ? `${course.color}08` : 'transparent', border: `1px solid ${isSelected ? `${course.color}25` : 'var(--border-subtle)'}` }}
                                  onClick={() => { const next = new Set(exportSelectedIds); if (isSelected) next.delete(topic.id); else next.add(topic.id); setExportSelectedIds(next); }}>
                                  <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${isSelected ? course.color : 'var(--text-muted)'}`, background: isSelected ? course.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                                    {isSelected && <Check size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                                  </div>
                                  <Book size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{topic.title}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(topic.materials || []).length} material{(topic.materials || []).length !== 1 ? 'es' : ''}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button data-ui-control="" onClick={() => setImportExportMode('choose')}
                            style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                            Volver
                          </button>
                          <button data-ui-control="" onClick={async () => {
                            const currentGrp = groups.find(g => g.id === selectedGroupId);
                            if (!currentGrp) { toast.error('Agrupacion no encontrada'); return; }
                            const selectedTopics = parsedTopics.filter(t => exportSelectedIds.has(t.id));
                            if (selectedTopics.length === 0) { toast.error('Selecciona al menos un tema'); return; }
                            try {
                              const dest = await save({ filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: `${currentGrp.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`, title: 'Exportar temas' });
                              if (!dest) return;
                              const exportData = { group: { name: currentGrp.name, image: currentGrp.image }, topics: selectedTopics.map(t => ({ title: t.title, status: t.status, reviewLevel: t.reviewLevel, materials: (safeArr(t.materials)).map(m => ({ ...m, dataUrl: m.dataUrl && m.dataUrl.startsWith('data:') ? '[BASE64_DATA]' : m.dataUrl })) })) };
                              await writeTextFile(dest, JSON.stringify(exportData, null, 2));
                              toast.success(`${selectedTopics.length} tema${selectedTopics.length !== 1 ? 's' : ''} exportado${selectedTopics.length !== 1 ? 's' : ''}`);
                              setShowAgrupacionImportExport(false);
                            } catch (err) { console.error('Export error:', err); toast.error('Error al exportar'); }
                          }}
                            style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', boxShadow: `0 2px 8px ${course.color}35` }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            {exportSelectedIds.size > 0 ? `Exportar ${exportSelectedIds.size} seleccionado${exportSelectedIds.size !== 1 ? 's' : ''}` : 'Selecciona un tema'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* -- Export groups (fallback when no group selected) -- */
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>Selecciona las agrupaciones cuyos temas deseas exportar.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }} className="no-scrollbar">
                          {groups.length === 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No hay agrupaciones</span>
                          ) : groups.map(g => {
                            const count = parsedTopics.filter(t => t.groupId === g.id).length;
                            const isSelected = exportSelectedIds.has(g.id);
                            return (
                              <div key={g.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms', background: isSelected ? `${course.color}08` : 'transparent', border: `1px solid ${isSelected ? `${course.color}25` : 'var(--border-subtle)'}` }}
                                onClick={() => { const next = new Set(exportSelectedIds); if (isSelected) next.delete(g.id); else next.add(g.id); setExportSelectedIds(next); }}>
                                <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${isSelected ? course.color : 'var(--text-muted)'}`, background: isSelected ? course.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                                  {isSelected && <Check size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                                </div>
                                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{g.name}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count} tema{count !== 1 ? 's' : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                        {groups.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button data-ui-control="" onClick={() => setImportExportMode('choose')}
                              style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                              Volver
                            </button>
                            <button data-ui-control="" onClick={async () => {
                              const selected = groups.filter(g => exportSelectedIds.has(g.id));
                              if (selected.length === 0) { toast.error('Selecciona al menos una agrupacion'); return; }
                              try {
                                const dest = await save({ filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: `${selected.length === 1 ? selected[0].name.replace(/[^a-zA-Z0-9]/g, '_') : 'agrupaciones'}_export.json`, title: 'Exportar temas' });
                                if (!dest) return;
                                const exportData = selected.map(g => {
                                  const gTopics = parsedTopics.filter(t => t.groupId === g.id);
                                  return { group: { name: g.name, image: g.image }, topics: gTopics.map(t => ({ title: t.title, status: t.status, reviewLevel: t.reviewLevel, materials: (safeArr(t.materials)).map(m => ({ ...m, dataUrl: m.dataUrl && m.dataUrl.startsWith('data:') ? '[BASE64_DATA]' : m.dataUrl })) })) };
                                });
                                await writeTextFile(dest, JSON.stringify(exportData.length === 1 ? exportData[0] : exportData, null, 2));
                                toast.success(`${selected.length} agrupacion${selected.length !== 1 ? 'es' : ''} exportada${selected.length !== 1 ? 's' : ''}`);
                                setShowAgrupacionImportExport(false);
                              } catch (err) { console.error('Export error:', err); toast.error('Error al exportar'); }
                            }}
                              style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', boxShadow: `0 2px 8px ${course.color}35` }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                              {exportSelectedIds.size > 0 ? `Exportar ${exportSelectedIds.size} seleccionada${exportSelectedIds.size !== 1 ? 's' : ''}` : 'Selecciona una agrupacion'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    /* -- IMPORT -- */
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>Selecciona un archivo JSON exportado desde APHEKA.</p>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 8, border: '1px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.background = `${course.color}06`; e.currentTarget.style.color = course.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        <FileUp size={13} /> Seleccionar archivo
                        <input type="file" style={{ display: 'none' }} accept=".json" onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const r = new FileReader(); r.onload = ev => {
                            try {
                              const raw = JSON.parse(ev.target?.result as string);
                              const items = (Array.isArray(raw) ? raw : [raw]).filter((d: any) => d.group && d.topics);
                              if (items.length === 0) { toast.error('No se encontraron agrupaciones validas'); return; }
                              setImportPreviewData(items);
                              setImportSelected(items.map((item: any) => item.topics.map(() => true)));
                            } catch { toast.error('Error al leer el archivo'); }
                          }; r.readAsText(f); e.target.value = '';
                        }} />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete Topic Confirmation Modal */}
      {deleteTopicId && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99995, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDeleteTopicId(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 360, padding: '28px 32px 24px', borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={20} style={{ color: '#EF4444' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", textAlign: 'center' }}>Eliminar tema</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center', lineHeight: 1.5, maxWidth: 260 }}>
              Esta acción eliminara permanentemente este tema y todo su contenido. No se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
              <button data-ui-control="" onClick={() => setDeleteTopicId(null)}
                style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                Cancelar
              </button>
              <button data-ui-control="" onClick={() => { if (deleteTopicId) handleDeleteTopic(deleteTopicId); setDeleteTopicId(null); }}
                style={{ flex: 1, height: 36, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms', boxShadow: '0 2px 8px rgba(239,68,68,0.35)' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {taskMenu && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99996 }} onClick={() => setTaskMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTaskMenu(null); }} onWheel={() => setTaskMenu(null)} />
          <div style={{ position: 'fixed', top: Math.min(taskMenu.y, window.innerHeight - 150), left: Math.min(taskMenu.x, window.innerWidth - 200), zIndex: 99997, width: 190, padding: 4, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(() => {
              const mt = courseTasks.find(t => t.id === taskMenu.id);
              const canBack = !!mt && mt.status !== 'inicio';
              return (
                <>
                  {canBack && (
                    <button data-app-action="secondary" data-ui-control="" onClick={() => { handleBackTaskStatus(taskMenu.id); setTaskMenu(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", transition: 'all 120ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                      <LI.Undo2 size={12} /> Retroceder
                    </button>
                  )}
                  <button data-app-action="secondary" data-ui-control="" onClick={() => { const mt = courseTasks.find(t => t.id === taskMenu.id); if (mt) { setFocusedTaskId(mt.id); setNavigateTo('tareas'); } setTaskMenu(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", transition: 'all 120ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                    <LI.ExternalLink size={12} /> Abrir en Tareas
                  </button>
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 6px' }} />
                  <button data-app-action="danger" data-ui-control="" onClick={() => { setConfirmDeleteTaskId(taskMenu.id); setTaskMenu(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.75)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", transition: 'all 120ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.75)'; }}>
                    <Trash2 size={12} /> Borrar
                  </button>
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}
      {confirmDeleteTaskId && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99996, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmDeleteTaskId(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 360, padding: '28px 32px 24px', borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={20} style={{ color: '#EF4444' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", textAlign: 'center' }}>Eliminar tarea</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center', lineHeight: 1.5, maxWidth: 260 }}>
              ¿Eliminar "{courseTasks.find(t => t.id === confirmDeleteTaskId)?.title || ''}"? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
              <button data-ui-control="" onClick={() => setConfirmDeleteTaskId(null)}
                style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                Cancelar
              </button>
              <button data-ui-control="" onClick={() => { deleteTask(confirmDeleteTaskId); setConfirmDeleteTaskId(null); toast.success('Tarea eliminada'); }}
                style={{ flex: 1, height: 36, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms', boxShadow: '0 2px 8px rgba(239,68,68,0.35)' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showPdfPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} onClick={() => setShowPdfPreview(false)}>          <div className="bento-card" style={{ width: '90vw', height: '90vh', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <File size={14} style={{ color: course?.color }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfPreviewName}</span>
              <a href={pdfPreviewUrl} download={pdfPreviewName} style={{ height: 26, padding: '0 10px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={9} /> Abrir
              </a>
              <button data-ui-control="" onClick={() => setShowPdfPreview(false)} style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
            </div>
            <div style={{ flex: 1, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {pdfPreviewUrl.match(/\.(pdf|PDF)$/) || pdfPreviewUrl.startsWith('data:application/pdf') ? (
                <object data={pdfPreviewUrl} type="application/pdf" style={{ width: '100%', height: '100%', border: 'none' }}>
                  <iframe src={pdfPreviewUrl} title={pdfPreviewName} style={{ width: '100%', height: '100%', border: 'none' }} />
                </object>
              ) : pdfPreviewUrl.startsWith('data:image/') ? (
                <img src={pdfPreviewUrl} alt={pdfPreviewName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe src={pdfPreviewUrl} title={pdfPreviewName} style={{ width: '100%', height: '100%', border: 'none' }} />
              )}
            </div>
          </div>
        </div>
      )}
      {viewingMat && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setViewingMat(null)}>
          <div className="bento-card" style={{ width: 480, maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto', padding: 0, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            {(() => {
              const vm = viewingMat;
              const vMeta = MATERIAL_META[vm.type];
              const VIcon = vMeta?.icon || File;
              const vColor: Record<string, string> = { formula: '#8B5CF6', concept: '#3B82F6', 'key-data': '#F59E0B', meaning: '#10B981', quiz: '#EF4444', procedure: '#EC4899', resource: '#6366F1' };
              const vAccent = vColor[vm.type] || 'var(--accent)';
              const vTitle = vm.name || vm.title || vm.word || vm.question || 'Sin título';
              const vBody = vm.content || vm.meaning || vm.answer || vm.clarification || vm.description || '';
              const vBodyLabel = vm.type === 'concept' || vm.type === 'key-data' ? 'Contenido' : vm.type === 'formula' ? 'Clarificación' : vm.type === 'meaning' ? 'definición' : vm.type === 'quiz' ? 'Respuesta' : vm.type === 'procedure' ? 'Descripción' : 'Contenido';
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${vAccent}10`, border: `1px solid ${vAccent}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <VIcon size={15} style={{ color: vAccent }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: vAccent, fontFamily: "'Inter Tight', sans-serif" }}>{vMeta?.label || 'Material'}</span>
                    <span style={{ flex: 1 }} />
                    <button data-ui-control="" onClick={() => setViewingMat(null)} title="Cerrar"
                      style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                  </div>
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.4, fontFamily: "'Inter Tight', sans-serif" }}>{vTitle}</div>
                    {vBody && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: vAccent, fontFamily: "'Inter Tight', sans-serif", marginBottom: 6 }}>{vBodyLabel}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{vBody}</div>
                      </div>
                    )}
                    {vm.type === 'quiz' && vm.answer && (
                      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: `1px dashed ${vAccent}45`, background: `${vAccent}0a`, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 700, color: vAccent, fontFamily: "'Inter Tight', sans-serif" }}>Respuesta: </span>{vm.answer}
                      </div>
                    )}
                    {vm.image && (
                      <img src={vm.image} alt={vTitle} style={{ marginTop: 14, maxWidth: '100%', maxHeight: 300, borderRadius: 10, objectFit: 'contain', display: 'block', border: '1px solid var(--border-soft)' }} />
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {showMaterialModal && materialType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowMaterialModal(false)}>
          <div className="bento-card" style={{ width: 420, padding: 22, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                  <>{editingMaterial ? 'Editar' : 'Añadir'} {materialType && MATERIAL_META[materialType]?.label}</>
                </h3>
                <button data-ui-control="" onClick={() => setShowMaterialModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {materialType === 'formula' && (
                <><input value={materialForm.name} onChange={e => setForm({ name: e.target.value })} placeholder="Nombre" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.clarification} onChange={e => setForm({ clarification: e.target.value })} placeholder="Explicación..." style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'concept' && (
                <><input value={materialForm.title} onChange={e => setForm({ title: e.target.value })} placeholder="Título" autoFocus style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.content} onChange={e => setForm({ content: e.target.value })} placeholder="Desarrollo..." style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'key-data' && (
                <><input value={materialForm.title} onChange={e => setForm({ title: e.target.value })} placeholder="Título (opcional)" autoFocus style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.content} onChange={e => setForm({ content: e.target.value })} placeholder="Dato clave..." style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'meaning' && (
                <><input value={materialForm.word} onChange={e => setForm({ word: e.target.value })} placeholder="terminó" autoFocus style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.meaning} onChange={e => setForm({ meaning: e.target.value })} placeholder="Significado..." style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'quiz' && (
                <><input value={materialForm.question} onChange={e => setForm({ question: e.target.value })} placeholder="Pregunta" autoFocus style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.answer} onChange={e => setForm({ answer: e.target.value })} placeholder="Respuesta..." style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'procedure' && (
                <><input value={materialForm.title} onChange={e => setForm({ title: e.target.value })} placeholder="Título" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <input value={materialForm.description} onChange={e => setForm({ description: e.target.value })} placeholder="Descripción" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.content} onChange={e => setForm({ content: e.target.value })} placeholder="Pasos..." style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {['formula', 'procedure'].includes(materialType) && (
                <div>{materialForm.image ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <img src={materialForm.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--bg-deep)' }} />
                    <button data-ui-control="" onClick={() => setForm({ image: undefined })} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={9} /></button>
                  </div>
                ) : (
                  <button data-ui-control="" onClick={() => materialImageInputRef.current?.click()} style={{ width: '100%', height: 48, borderRadius: 6, border: '1px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)' }}>
                    <Upload size={10} /><span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Imagen</span>
                  </button>
                )}</div>
              )}
              <button data-ui-control="" onClick={handleSaveMaterial} style={{ width: '100%', height: 34, borderRadius: 6, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{editingMaterial ? 'Guardar' : 'Crear Material'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TOOL CREATOR MODAL (formulario especializado por herramienta) ===== */}
      {toolModal && (() => {
        const meta = TOOL_CREATOR_META[toolModal.mode];
        const ToolIcon = meta.icon;
        const baseField: React.CSSProperties = { width: '100%', borderRadius: 9, fontSize: 12, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 150ms, box-shadow 150ms' };
        const inputStyle: React.CSSProperties = { ...baseField, height: 38, padding: '0 12px' };
        const textareaStyle: React.CSSProperties = { ...baseField, padding: '10px 12px', resize: 'vertical', lineHeight: 1.55, minHeight: 80 };
        const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = `0 0 0 3px ${meta.color}12`; };
        const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.boxShadow = 'none'; };
        const titlePh: Partial<Record<ToolCreatorMode, string>> = {
          quizzes: 'Ej. Quiz: divisiones',
          blurting: 'Ej. Repaso del tema 3',
          feynman: 'Ej. La fotosíntesis',
          matching: 'Ej. Capitales de Europa',
          cloze: 'Ej. Texto del Renacimiento',
          categorization: 'Ej. Animales vertebrados',
          mnemonics: 'Ej. Los 8 planetas del sistema solar',
        };
        const Field = ({ txt, children }: { txt: string; children: React.ReactNode }) => (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: meta.color, marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>{txt}</div>
            {children}
          </div>
        );
        return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2002, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => { setToolModal(null); setToolFields({}); }}>
          <div className="bento-card" style={{ width: 440, padding: 24, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxHeight: '82vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${meta.color}22` }}>
                  <ToolIcon size={15} style={{ color: meta.color }} />
                </span>
                {meta.name}
              </h3>
              <button data-ui-control="" onClick={() => { setToolModal(null); setToolFields({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 16px 44px', fontStyle: 'italic', lineHeight: 1.5 }}>{meta.hint}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field txt="Título">
                <input value={toolFields.title || ''} onChange={e => setToolField('title', e.target.value)} placeholder={titlePh[toolModal.mode]} autoFocus style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
              </Field>

              {toolModal.mode === 'quizzes' && (
                <>
                  <Field txt="Pregunta">
                    <textarea value={toolFields.a || ''} onChange={e => setToolField('a', e.target.value)} placeholder="Escribe la pregunta…" style={textareaStyle} onFocus={focusIn} onBlur={focusOut} />
                  </Field>
                  <Field txt="Respuesta">
                    <textarea value={toolFields.b || ''} onChange={e => setToolField('b', e.target.value)} placeholder="Escribe la respuesta…" style={{ ...textareaStyle, minHeight: 60 }} onFocus={focusIn} onBlur={focusOut} />
                  </Field>
                </>
              )}

              {toolModal.mode === 'matching' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field txt="Elemento A">
                    <input value={toolFields.a || ''} onChange={e => setToolField('a', e.target.value)} placeholder="Concepto / pista" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </Field>
                  <Field txt="Elemento B">
                    <input value={toolFields.b || ''} onChange={e => setToolField('b', e.target.value)} placeholder="Su pareja o definición" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </Field>
                </div>
              )}

              {toolModal.mode === 'blurting' && (
                <Field txt="Texto libre">
                  <textarea value={toolFields.body || ''} onChange={e => setToolField('body', e.target.value)} placeholder="Escribe todo lo que recuerdes del tema…" style={{ ...textareaStyle, minHeight: 160 }} onFocus={focusIn} onBlur={focusOut} />
                </Field>
              )}

              {toolModal.mode === 'feynman' && (
                <>
                  <Field txt="Concepto">
                    <input value={toolFields.a || ''} onChange={e => setToolField('a', e.target.value)} placeholder="¿Qué concepto vas a explicar?" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </Field>
                  <Field txt="Explicación simple">
                    <textarea value={toolFields.b || ''} onChange={e => setToolField('b', e.target.value)} placeholder="Con palabras sencillas, como si se lo explicaras a un niño…" style={{ ...textareaStyle, minHeight: 90 }} onFocus={focusIn} onBlur={focusOut} />
                  </Field>
                </>
              )}

              {toolModal.mode === 'cloze' && (
                <Field txt="Texto con huecos">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
                    <span onClick={insertClozeGap} title="Selecciona una palabra y plsalo para convertirla en hueco (guardará la respuesta)" style={{ display: 'flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${meta.color}40`, background: `${meta.color}0d`, color: meta.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = `${meta.color}1a`} onMouseLeave={e => e.currentTarget.style.background = `${meta.color}0d`}><Plus size={10} /> Insertar hueco</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>Selecciona texto para guardar la respuesta</span>
                  </div>
                  <textarea ref={clozeRef} value={toolFields.body || ''} onChange={e => setToolField('body', e.target.value)} placeholder="Escribe el texto aquí" style={{ ...textareaStyle, minHeight: 140 }} onFocus={focusIn} onBlur={focusOut} />
                </Field>
              )}

              {toolModal.mode === 'categorization' && (
                <Field txt="Elementos (uno por línea)">
                  <textarea value={toolFields.content || ''} onChange={e => setToolField('content', e.target.value)} placeholder={'Perro\nGato\nBallena'} style={{ ...textareaStyle, minHeight: 110 }} onFocus={focusIn} onBlur={focusOut} />
                </Field>
              )}

              {toolModal.mode === 'mnemonics' && (
                <Field txt="Regla mnemotécnica">
                  <textarea value={toolFields.content || ''} onChange={e => setToolField('content', e.target.value)} placeholder="Ej. Mi vieja hace mucho fro este mes…" style={{ ...textareaStyle, minHeight: 80 }} onFocus={focusIn} onBlur={focusOut} />
                </Field>
              )}

              {!['quizzes', 'matching', 'blurting', 'feynman', 'cloze', 'categorization', 'mnemonics'].includes(toolModal.mode) && (
                <Field txt="Desarrollo de la técnica">
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.55, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: `${meta.color}0a`, border: `1px dashed ${meta.color}30` }}>
                    {TOOL_CREATOR_META[toolModal.mode].theory.how.map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6 }}><span style={{ color: meta.color, fontWeight: 700 }}>{i + 1}.</span><span>{h}</span></div>
                    ))}
                  </div>
                  <textarea value={toolFields.body || ''} onChange={e => setToolField('body', e.target.value)} placeholder={`Aplica aquí ${meta.name} a tu tema`} style={{ ...textareaStyle, minHeight: 130 }} onFocus={focusIn} onBlur={focusOut} />
                </Field>
              )}
            </div>
            <button data-ui-control="" onClick={handleSaveToolModal} style={{ width: '100%', height: 38, borderRadius: 9, border: 'none', background: meta.color, color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', marginTop: 18, boxShadow: `0 6px 20px ${meta.color}30`, transition: 'transform 150ms ' + EASE, fontFamily: "'Inter Tight', sans-serif" }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {toolModal.editingId ? 'Guardar cambios' : `Crear ${meta.name}`}
            </button>
          </div>
        </div>
        );
      })()}

                {/* ===== ENLACE / MATERIAL (nivel raiz: se ven desde cualquier vista/tema) ===== */}
                {/* -- DELETE MATERIAL CONFIRMATION -- */}
                {confirmDeleteMatId && (() => {
                  const delMat = allCourseMaterials.find(m => m.id === confirmDeleteMatId);
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteMatId(null); }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                      <div style={{ position: 'relative', width: 380, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <AlertTriangle size={24} style={{ color: '#EF4444' }} />
                          </div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Eliminar material</h3>
                          {delMat && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>"{delMat.name || 'Sin nombre'}" sera eliminado</p>}
                        </div>
                        <div style={{ padding: '12px 24px 24px', display: 'flex', gap: 10, justifyContent: 'center' }}>
                          <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteMatId(null)}
                            style={{ height: 38, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            Cancelar
                          </button>
                          <button data-ui-control="" onClick={() => { handleDeleteResourceFromOverview(confirmDeleteMatId); }}
                            style={{ height: 38, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* -- ADD LINK MODAL -- */}
                {showAddLinkModal && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAddLinkModal(false); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Agregar enlace</h3>
                          {(() => {
                            const target = parsedTopics.find(t => t.id === addLinkTargetTopic);
                            return target ? (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Se guardará en el tema: <span style={{ color: course.color, fontWeight: 600 }}>{target.title}</span></div>
                            ) : null;
                          })()}
                        </div>
                        <button data-ui-control="" onClick={() => setShowAddLinkModal(false)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>URL del enlace</label>
                          <input value={addLinkUrl} onChange={e => setAddLinkUrl(e.target.value)}
                            placeholder="https://..."
                            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
                            autoFocus
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>Nombre <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                          <input value={addLinkName} onChange={e => setAddLinkName(e.target.value)}
                            placeholder="Mi enlace"
                            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                      </div>
                      <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button data-app-action="secondary" data-ui-control="" onClick={() => setShowAddLinkModal(false)}
                          style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          Cancelar
                        </button>
                        <button data-ui-control="" onClick={handleAddLink}
                          style={{ height: 36, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* -- SELECTOR DE ICONO DE ENLACE -- */}
                {linkIconPick && (() => {
                  const px = Math.max(8, Math.min(linkIconPick.x - 110, window.innerWidth - 240));
                  const py = Math.max(8, Math.min(linkIconPick.y + 12, window.innerHeight - 190));
                  let current: string = 'auto';
                  try {
                    outer: for (const t of (safeArr(course?.studyTopics))) {
                      for (const m of (safeArr((t as any)?.materials))) {
                        if (m && (m as any).id === linkIconPick.matId) { current = (m as any).icon || 'auto'; break outer; }
                      }
                    }
                  } catch { /* noop */ }
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }} onClick={() => setLinkIconPick(null)} onContextMenu={e => { e.preventDefault(); setLinkIconPick(null); }}>
                      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: px, top: py, width: 220, borderRadius: 12, padding: 10, background: 'color-mix(in srgb, var(--bg-elevated) 96%, transparent)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-soft)', boxShadow: '0 18px 50px rgba(0,0,0,0.42)', animation: 'fadeInScale 160ms ease' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '2px 6px 8px', fontFamily: "'Inter Tight', sans-serif" }}>Icono del enlace</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                          {LINK_ICON_CHOICES.map(c => {
                            const active = (current || 'auto') === c.id;
                            const Cmp = c.Icon;
                            return (
                              <button data-ui-control="" key={c.id} onClick={() => setMaterialIcon(linkIconPick.matId, c.id === 'auto' ? null : c.id)} title={c.id === 'auto' ? 'Original' : c.label}
                                style={{ height: 34, borderRadius: 8, border: active ? `1.5px solid ${course?.color || 'var(--accent)'}` : '1px solid var(--border-subtle)', background: active ? `${course?.color || 'var(--accent)'}12` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? (course?.color || 'var(--accent)') : 'var(--text-secondary)' }}>
                                <Cmp size={15} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* -- EDIT LINK MODAL -- */}
                {editLinkId && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setEditLinkId(null); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Editar enlace</h3>
                        <button data-ui-control="" onClick={() => setEditLinkId(null)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>URL del enlace</label>
                          <input value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)}
                            placeholder="https://..."
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditLink(); }}
                            autoFocus
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>Nombre</label>
                          <input value={editLinkName} onChange={e => setEditLinkName(e.target.value)}
                            placeholder="Nombre del enlace"
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditLink(); }}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                      </div>
                      <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                        <button data-ui-control="" onClick={() => { setConfirmDeleteMatId(editLinkId); setEditLinkId(null); }}
                          style={{ height: 36, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}>
                          Eliminar
                        </button>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button data-app-action="secondary" data-ui-control="" onClick={() => setEditLinkId(null)}
                            style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            Cancelar
                          </button>
                          <button data-ui-control="" onClick={handleSaveEditLink}
                            style={{ height: 36, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

      {/* ===== MOVER A GRUPO (ventana emergente) ===== */}
      {moveToGroupMat && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2003, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setMoveToGroupMat(null)}>
          <div className="bento-card" style={{ width: 340, padding: 22, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: `${course.color}12`, border: `1px solid ${course.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LI.FolderInput size={17} style={{ color: course.color }} />
              </span>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>Mover a grupo</h3>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{moveToGroupMat.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
              {(((activeTopic as any)?.toolGroups || []) as string[]).length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No hay grupos creados. Crea uno desde Herramientas.</div>
              )}
              {(((activeTopic as any)?.toolGroups || []) as string[]).map((g: string) => {
                const currentGn = String(((activeTopic as any)?.materials || []) as any[]).length >= 0;
                const mat = (safeArr(activeTopic?.materials)).find(m => m.id === moveToGroupMat.id);
                const isCurrent = (mat as any)?.groupName === g;
                return (
                  <button data-ui-control="" key={g} onClick={() => {
                    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic?.id ? { ...tp, materials: (safeArr(tp.materials)).map(m => m.id === moveToGroupMat.id ? ({ ...m, groupName: g } as any) : m) } : tp) } as any);
                    toast.success('Movido a ' + g.split('/').pop());
                    setMoveToGroupMat(null);
                  }}
                    disabled={isCurrent}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: `1px solid ${isCurrent ? 'transparent' : 'var(--border-subtle)'}`, background: isCurrent ? 'var(--bg-hover)' : 'transparent', cursor: isCurrent ? 'default' : 'pointer', transition: 'all 130ms', textAlign: 'left' }}
                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = `${course.color}08`; }}
                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}>
                    <LI.Folder size={13} style={{ color: course.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: isCurrent ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{g}</span>
                    {isCurrent && <Check size={12} style={{ color: course.color }} />}
                  </button>
                );
              })}
            </div>
            <button data-ui-control="" onClick={() => { ungroupMaterial(moveToGroupMat.id); setMoveToGroupMat(null); }} style={{ width: '100%', height: 34, borderRadius: 9, border: '1px dashed var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif" }}>
              Sacar al tema principal (sin grupo)
            </button>
          </div>
        </div>
      )}

      {/* ===== EDITAR / NUEVO GRUPO (temas) ===== */}
      {topicGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2003, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setTopicGroupModal(null)}>
          <div className="bento-card" style={{ width: 380, padding: 22, borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: `${course.color}12`, border: `1px solid ${course.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {topicGroupModal.mode === 'rename' ? <Pencil size={17} style={{ color: course.color }} /> : <LI.FolderPlus size={17} style={{ color: course.color }} />}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                  {topicGroupModal.mode === 'rename' ? 'Editar grupo' : 'Nuevo grupo'}
                </h3>
              </div>
              <button data-ui-control="" onClick={() => setTopicGroupModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={15} /></button>
            </div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Nombre del grupo</label>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter' && newGroupName.trim() && activeTopic) {
                if (topicGroupModal.mode === 'rename' && topicGroupModal.orig) {
                  renameToolGroup(topicGroupModal.orig, newGroupName.trim());
                } else {
                  updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic.id ? { ...tp, toolGroups: [...((tp as any).toolGroups || []), newGroupName.trim()] } : tp) } as any);
                  setActiveToolGroup(newGroupName.trim());
                }
                setTopicGroupModal(null);
              }
            }} autoFocus placeholder="Ej. Parciales · Laboratorio · Lecturas" style={{ width: '100%', height: 40, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", marginBottom: 16 }} />
            
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {topicGroupModal.mode === 'rename' && topicGroupModal.orig && (
                <button data-ui-control="" onClick={() => { const orig = topicGroupModal.orig!; setTopicGroupModal(null); setConfirmDelGroup(orig); }}
                  title="Eliminar grupo y sus contenidos"
                  style={{ height: 38, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Inter Tight', sans-serif" }}>
                  <Trash2 size={13} /> Eliminar
                </button>
              )}
              <button data-ui-control="" onClick={() => setTopicGroupModal(null)} style={{ flex: 1, height: 38, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif" }}>Cancelar</button>
              <button data-ui-control="" onClick={() => {
                if (newGroupName.trim() && activeTopic) {
                  if (topicGroupModal.mode === 'rename' && topicGroupModal.orig) {
                    renameToolGroup(topicGroupModal.orig, newGroupName.trim());
                  } else {
                    updateCourse(course.id, { studyTopics: (safeArr(course.studyTopics)).map(tp => tp.id === activeTopic.id ? { ...tp, toolGroups: [...((tp as any).toolGroups || []), newGroupName.trim()] } : tp) } as any);
                    setActiveToolGroup(newGroupName.trim());
                  }
                  setTopicGroupModal(null);
                }
              }} disabled={!newGroupName.trim()} style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !newGroupName.trim() ? 0.4 : 1, boxShadow: `0 6px 20px ${course.color}30`, fontFamily: "'Inter Tight', sans-serif" }}>
                {topicGroupModal.mode === 'rename' ? 'Guardar' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelGroup && (() => {
        const g = confirmDelGroup;
        const mats = (safeArr(activeTopic?.materials)).filter(m => { const gn = ((m as any).groupName || '') as string; return gn === g || gn.startsWith(g + '/'); }).length;
        const fcs = (safeArr(activeTopic?.flashcards)).filter(f => { const gn = ((f as any).groupName || '') as string; return gn === g || gn.startsWith(g + '/'); }).length;
        const subs = (((activeTopic as any)?.toolGroups || []) as string[]).filter(x => x.startsWith(g + '/')).length;
        return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2003, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setConfirmDelGroup(null)}>
          <div className="bento-card" style={{ width: 400, padding: 22, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={17} style={{ color: '#EF4444' }} />
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>Eliminar grupo</h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 10px' }}>
              Se eliminará <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>“{g}”</b> con todo su contenido:
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[`${mats} material${mats === 1 ? '' : 'es'}`, `${fcs} tarjet${fcs === 1 ? 'a' : 'as'}`, subs > 0 ? `${subs} subgrupo${subs === 1 ? '' : 's'}` : null].filter(Boolean).map((t, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '4px 10px', borderRadius: 8 }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '0 0 16px' }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button data-ui-control="" onClick={() => setConfirmDelGroup(null)} style={{ flex: 1, height: 38, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif" }}>Cancelar</button>
              <button data-ui-control="" onClick={() => { deleteToolGroup(g); setConfirmDelGroup(null); }} style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(239,68,68,0.30)', fontFamily: "'Inter Tight', sans-serif" }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
        );
      })()}
      {deckEditor && (
        <DeckEditorModal mode={deckEditor.mode} accent={course.color}
          initialName={deckEditor.mat ? (deckEditor.mat.name || deckEditor.mat.title) : undefined}
          initialColor={deckEditor.mat ? (deckEditor.mat as any).color : undefined}
          initialContent={deckEditor.mat?.content}
          onClose={() => setDeckEditor(null)}
          onSave={(name, color, content) => saveDeck(deckEditor.mode, name, color, content)} />
      )}
      {confirmDelToolMat && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2003, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setConfirmDelToolMat(null)}>
          <div className="bento-card" style={{ width: 380, padding: 22, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={17} style={{ color: '#EF4444' }} />
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>Eliminar material</h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 18px' }}>
              ¿Eliminar <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>“{confirmDelToolMat.name}”</b> del tema? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button data-ui-control="" onClick={() => setConfirmDelToolMat(null)} style={{ flex: 1, height: 38, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif" }}>Cancelar</button>
              <button data-ui-control="" onClick={confirmDeleteMaterialNow} style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(239,68,68,0.30)', fontFamily: "'Inter Tight', sans-serif" }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FLASHCARD MODAL ===== */}
      {showFlashcardModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)' }} onClick={() => { setShowFlashcardModal(false); setEditingFlashcard(null); }}>
          <div className="bento-card" style={{ width: 460, maxWidth: 'calc(100vw - 32px)', padding: 24, borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                  <Sparkles size={17} style={{ color: '#8B5CF6' }} />
                  {editingFlashcard ? 'Editar Flashcard' : 'Crear Flashcard'}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '3px 0 0', fontFamily: "'Inter', sans-serif" }}>
                  {activeToolGroup !== 'todos' ? `Añadiendo al grupo “${activeToolGroup.split('/').pop()}”` : 'Se vinculará al tema activo'}
                </p>
              </div>
              <button data-ui-control="" onClick={() => { setShowFlashcardModal(false); setEditingFlashcard(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!editingFlashcard && (
                <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                  {([['uno', 'Individual'], ['masivo', 'Grupo / Masivo (pregunta - respuesta)']] as const).map(([v, lbl]) => (
                    <button data-ui-control="" key={v} onClick={() => setFcMode(v)}
                      style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 180ms ' + EASE, fontFamily: "'Inter Tight', sans-serif", background: fcMode === v ? '#8B5CF6' : 'transparent', color: fcMode === v ? '#fff' : 'var(--text-tertiary)', boxShadow: fcMode === v ? '0 4px 14px rgba(139,92,246,0.35)' : 'none' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              )}

              {fcMode === 'uno' || editingFlashcard ? (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B5CF6', display: 'block', marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Pregunta / Término</label>
                    <textarea value={fcQuestion} onChange={e => setFcQuestion(e.target.value)} placeholder="Escribe la pregunta, fórmula, concepto o código…" autoFocus style={{ width: '100%', minHeight: 76, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981', display: 'block', marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Respuesta / Explicación</label>
                    <textarea value={fcAnswer} onChange={e => setFcAnswer(e.target.value)} placeholder="Escribe la respuesta detallada, definición o solución…" style={{ width: '100%', minHeight: 76, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B5CF6', fontFamily: "'Inter Tight', sans-serif" }}>Una por línea · pregunta - respuesta</label>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8B5CF6', background: '#8B5CF614', padding: '2px 8px', borderRadius: 99 }}>
                      {parseBulkFlashcards().filter(c => c.a).length} detectadas
                    </span>
                  </div>
                  <textarea value={fcBulk} onChange={e => setFcBulk(e.target.value)} placeholder={'Formato:\npregunta - respuesta\n\nEjemplos:\nMitosis - Proceso de división celular en dos células hijas\nFórmula de Euler - e^(iπ) + 1 = 0\nCapital de Perú - Lima'} autoFocus style={{ width: '100%', minHeight: 180, padding: 12, borderRadius: 10, fontSize: 12, lineHeight: 1.6, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  
                  {parseBulkFlashcards().filter(c => c.a).length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 80, overflowY: 'auto', padding: 4 }}>
                      {parseBulkFlashcards().filter(c => c.a).slice(0, 6).map((c, i) => (
                        <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '3px 8px', borderRadius: 6, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <b style={{ color: '#8B5CF6' }}>{c.q}</b>: {c.a}
                        </span>
                      ))}
                      {parseBulkFlashcards().filter(c => c.a).length > 6 && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '3px 6px' }}>+{parseBulkFlashcards().filter(c => c.a).length - 6} más</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Dificultad inicial</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { v: 'facil', label: 'Fácil', color: '#10B981' },
                    { v: 'bueno', label: 'Medio', color: '#F59E0B' },
                    { v: 'dificil', label: 'Difícil', color: '#EF4444' },
                  ] as { v: 'facil' | 'bueno' | 'dificil'; label: string; color: string }[]).map(o => (
                    <button data-ui-control="" key={o.v} onClick={() => setFcDifficulty(o.v)}
                      style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${fcDifficulty === o.v ? o.color : 'var(--border-soft)'}`, background: fcDifficulty === o.v ? `${o.color}14` : 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: fcDifficulty === o.v ? o.color : 'var(--text-muted)', transition: 'all 150ms', fontFamily: "'Inter Tight', sans-serif" }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {fcMode === 'masivo' && !editingFlashcard ? (
                <button data-ui-control="" onClick={handleSaveFlashcard} disabled={parseBulkFlashcards().filter(c => c.a).length === 0} style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: parseBulkFlashcards().filter(c => c.a).length === 0 ? 0.4 : 1, boxShadow: '0 6px 20px rgba(139,92,246,0.35)', fontFamily: "'Inter Tight', sans-serif", marginTop: 4 }}>
                  Crear grupo de {parseBulkFlashcards().filter(c => c.a).length} flashcards
                </button>
              ) : (
                <button data-ui-control="" onClick={handleSaveFlashcard} disabled={!fcQuestion.trim() || !fcAnswer.trim()} style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !fcQuestion.trim() || !fcAnswer.trim() ? 0.4 : 1, boxShadow: '0 6px 20px rgba(139,92,246,0.35)', fontFamily: "'Inter Tight', sans-serif", marginTop: 4 }}>
                  {editingFlashcard ? 'Guardar cambios' : 'Crear flashcard'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== TOOL PRACTICE MODAL (review per tool) ===== */}
      {practiceMat && <ToolPracticeModal key={practiceMat.id} mat={practiceMat} topicMaterials={safeArr(activeTopic?.materials)} onClose={closePractice} />}

      {/* ===== IMAGE PREVIEW (zoom + pan + delete) ===== */}
      {showImagePreview && previewImageSrc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={() => { setShowImagePreview(false); setPreviewZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
          {/* TOP BAR · floating bare icons */}
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 24, right: 24, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button data-ui-control="" onClick={handleDeleteImage} title="Eliminar imagen"
              style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.Trash2 size={14} />
            </button>
            <button data-ui-control="" onClick={() => { setShowImagePreview(false); setPreviewZoom(1); setPanOffset({ x: 0, y: 0 }); }} title="Cerrar"
              style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.X size={15} />
            </button>
          </div>
          {/* IMAGE with pan + zoom */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', minHeight: 0, cursor: isPanning ? 'grabbing' : 'grab', padding: '32px' }}
            onClick={e => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handlePanStart}
            onMouseMove={(e) => { handlePanMove(e); }}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}>
            <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${previewZoom})`, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 150ms' }}>
              <img src={previewImageSrc} alt="" style={{ maxWidth: '75vw', maxHeight: '60vh', borderRadius: 10, display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
            </div>
          </div>
          {/* Zoom controls */}
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <button data-ui-control="" onClick={() => setPreviewZoom(z => Math.max(1, z - 0.1))} title="Alejar"
              style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.ZoomOut size={16} />
            </button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500, minWidth: 38, textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{Math.round(previewZoom * 100)}%</span>
            <button data-ui-control="" onClick={() => setPreviewZoom(z => Math.min(2.5, z + 0.1))} title="Acercar"
              style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.ZoomIn size={16} />
            </button>
            <button data-ui-control="" onClick={() => setPreviewZoom(1)} title="Restablecer"
              style={{ height: 34, padding: '0 14px', borderRadius: 17, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', transition: 'all 120ms' }}>100%</button>
          </div>
        </div>
      )}

      {/* ===== DELETE NOTE CONFIRM MODAL ===== */}
      {confirmDeleteNoteId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setConfirmDeleteNoteId(null)}>
          <div className="bento-card" style={{
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: 14, padding: 24, minWidth: 300, maxWidth: 380,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                Eliminar apunte
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              ¿Estás seguro de eliminar este apunte?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteNoteId(null)}
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: 8,
                  padding: "7px 16px", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", fontWeight: 500,
                }}>Cancelar</button>
              <button data-ui-control="" onClick={() => { deleteNote(confirmDeleteNoteId); if (selectedOverviewNoteId === confirmDeleteNoteId) { setSelectedOverviewNoteId(null); setOverviewNoteEditMode(false); } if (editingNoteId === confirmDeleteNoteId) setEditingNoteId(null); if (selectedNoteId === confirmDeleteNoteId) setSelectedNoteId(null); setConfirmDeleteNoteId(null); toast.success('Apunte eliminado'); }}
                style={{
                  background: "#EF4444", color: "#fff", border: "none", borderRadius: 8,
                  padding: "7px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

                {showPlanModal && <CourseSessionDialog editing={!!planEditId} course={course} groups={groups} topics={parsedTopics}
                  initialValue={{title:planTitle,date:planDate,startTime:planStartTime,durationMinutes:planDuration,intensity:planIntensity,type:planType,groupId:planGroupId,topicId:planTopicId,repeat:planRepeat,repeatDays:planRepeatDays,repeatUntil:planRepeatUntil}}
                  onClose={()=>setShowPlanModal(false)} onSave={draft=>{
                    const payload:Omit<PlannedSession,'id'|'createdAt'>={courseId:course.id,...draft,groupId:draft.groupId||undefined,topicId:draft.topicId||undefined,startTime:draft.startTime||undefined,completed:false,repeatDays:draft.repeat==='custom_days'?[...draft.repeatDays].sort():undefined,repeatUntil:draft.repeat!=='none'&&draft.repeatUntil?draft.repeatUntil:undefined};
                    if(planEditId){const {completed:_completed,...rest}=payload;updatePlannedSession(planEditId,rest);}else addPlannedSession(payload);
                    setShowPlanModal(false);setDetailSessionId(null);
                  }}/>}


      {/* Hidden inline audio player */}
      <audio ref={audioRef} preload="metadata" />

      {/* ===== TAG CRUD MODAL (external box) ===== */}
      {tagModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99995, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => { setTagModalOpen(false); setEditingTagId(null); setConfirmDeleteTag(false); }}>
          <div className="bento-card" style={{ width: 400, padding: 22, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                <Tag size={14} style={{ color: tagColorInput }} />
                {editingTagId ? 'Editar etiqueta' : 'Nueva etiqueta'}
              </h3>
              <button data-ui-control="" onClick={() => { setTagModalOpen(false); setEditingTagId(null); setConfirmDeleteTag(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!editingTagId && topicTagDefs.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Etiquetas existentes</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {topicTagDefs.map(d => (
                      <button data-ui-control="" key={d.id} onClick={() => openTagModal(d)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 13, border: '1px solid var(--border-subtle)', background: `${d.color}0c`, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', transition: 'all 120ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = d.color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color }} />{d.name}
                        <Pencil size={9} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 5 }}>Nombre</div>
                <input value={tagNameInput} onChange={e => setTagNameInput(e.target.value)} placeholder="Ej. fórmulas, Examen, Repaso..." autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTag(); }}
                  style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 8, fontSize: 13, fontFamily: "'Inter Tight', sans-serif", fontWeight: 500, border: `1px solid ${tagNameInput ? `${tagColorInput}50` : 'var(--border-soft)'}`, background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Color</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: tagColorInput, flexShrink: 0, border: '2px solid var(--bg-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'background 200ms ' + EASE }} />
                  <div style={{ flex: 1, position: 'relative', height: 28, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to right, #E11D48, #EC4899, #8B5CF6, #3B82F6, #06B6D4, #10B981, #84CC16, #F59E0B, #F97316)', borderRadius: 6 }} />
                    <input type="color" value={tagColorInput} onChange={e => setTagColorInput(e.target.value)}
                      style={{ position: 'absolute', top: -4, left: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: 'pointer' }} />
                  </div>
                  <input value={tagColorInput.toUpperCase()} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setTagColorInput(v.toLowerCase()); }} style={{ width: 66, height: 26, borderRadius: 4, padding: '0 6px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SPINE_COLORS.map(c => (
                    <button data-ui-control="" key={c} onClick={() => setTagColorInput(c)} title={c}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: tagColorInput === c ? '2px solid var(--bg-surface)' : '2px solid transparent', boxShadow: tagColorInput === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 120ms', padding: 0 }} />
                  ))}
                </div>
              </div>
              <button data-ui-control="" onClick={handleSaveTag} disabled={!tagNameInput.trim()}
                style={{ width: '100%', height: 34, borderRadius: 8, border: 'none', background: tagColorInput, color: '#fff', fontSize: 11, fontWeight: 700, cursor: tagNameInput.trim() ? 'pointer' : 'default', opacity: tagNameInput.trim() ? 1 : 0.4, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.02em' }}>
                {editingTagId ? 'Guardar cambios' : 'Crear etiqueta'}
              </button>
              {editingTagId && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', justifyContent: 'center' }}>
                  {confirmDeleteTag ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>¿Eliminar esta etiqueta?</span>
                      <button data-ui-control="" onClick={handleDeleteTag} style={{ height: 26, padding: '0 12px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                      <button data-app-action="secondary" data-ui-control="" onClick={() => setConfirmDeleteTag(false)} style={{ height: 26, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  ) : (
                    <button data-app-action="danger" data-ui-control="" onClick={() => setConfirmDeleteTag(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: 'rgba(239,68,68,0.75)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.color = '#EF4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = 'rgba(239,68,68,0.75)'; }}>
                      <Trash2 size={11} /> Eliminar etiqueta
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
      </div>
      )}
      </div>, document.body)}
      </div>
    );
  }



