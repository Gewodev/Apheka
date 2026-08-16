// ═══════════════════════════════════════════════════
//  CHARVIS — Tool Registry & Executor
// ═══════════════════════════════════════════════════
// Define todas las capacidades que la IA puede invocar,
// mapeadas a funciones reales de AppContext y a los
// stores reales de la app (owa_planner_v3, owa_planned_goal…).
// Todo se ejecuta en segundo plano: NUNCA navega al usuario.

import type { AIToolDefinition } from './aiProvider';
import { getFetch } from './aiProvider';

// ─── Stores reales de la app (mismos que usa la UI) ───
const PLANNER_STORE = 'owa_planner_v3';   // { events: PlanEvent[], classes: [] }
const GOAL_KEY = 'owa_planned_goal';      // id del evento anclado en Inicio

// Formato EXACTO de PlanEvent usado por Planificacion.tsx (EventModal.tsx)
interface PlanEvent {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD
  allDay: boolean;
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  courseId?: string;
  color: string;
  description?: string;
  taskId?: string;
  googleEventId?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'custom_days';
  repeatDays?: number[]; // 0=Mon..6=Sun
  repeatUntil?: string;
  attachments?: { type: 'link' | 'file'; name: string; url: string; size?: string }[];
}

function loadPlanner(): { events: PlanEvent[]; classes: unknown[] } {
  try {
    const d = JSON.parse(localStorage.getItem(PLANNER_STORE) || '{}');
    return { events: d.events || [], classes: d.classes || [] };
  } catch { return { events: [], classes: [] }; }
}
function savePlanner(events: PlanEvent[], classes: unknown[]): boolean {
  try {
    localStorage.setItem(PLANNER_STORE, JSON.stringify({ events, classes }));
    return true;
  } catch { return false; }
}
function readGoal(): string | null {
  try { return localStorage.getItem(GOAL_KEY); } catch { return null; }
}
function writeGoal(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(GOAL_KEY);
    else localStorage.setItem(GOAL_KEY, id);
  } catch { /* noop */ }
}
function uid(): string {
  try { return crypto.randomUUID(); } catch { return 'ev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

const COURSE_COLORS = ['#E11D48', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444', '#14B8A6', '#6366F1'];

// ─── Tool Definitions (OpenAI function-calling format) ───

export const AI_TOOL_DEFINITIONS: AIToolDefinition[] = [
  // ═══ TASKS ═══
  {
    type: 'function',
    function: {
      name: 'createTask',
      description: 'Crea una nueva tarea (mismo formato que el creador de tareas de Owa). El usuario puede especificar título, curso, prioridad, fecha de entrega, urgente/importante.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título de la tarea' },
          course: { type: 'string', description: 'Nombre del curso al que pertenece' },
          courseColor: { type: 'string', description: 'Color hex del curso (se auto-detecta si no se especifica)' },
          priority: { type: 'string', enum: ['high', 'medium', 'low', 'none'], description: 'Prioridad de la tarea' },
          dueDate: { type: 'string', description: 'Fecha de entrega en formato YYYY-MM-DD' },
          urgent: { type: 'boolean', description: 'Si es urgente' },
          important: { type: 'boolean', description: 'Si es importante' },
          notes: { type: 'string', description: 'Descripción o notas en texto plano' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateTask',
      description: 'Actualiza una tarea existente por su ID o título. Puede cambiar título, estado, prioridad, fecha, urgente/importante, notas.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'ID de la tarea (o texto que coincida con su título)' },
          title: { type: 'string', description: 'Nuevo título' },
          status: { type: 'string', enum: ['inicio', 'progreso', 'completado'], description: 'Nuevo estado' },
          priority: { type: 'string', enum: ['high', 'medium', 'low', 'none'], description: 'Nueva prioridad' },
          dueDate: { type: 'string', description: 'Nueva fecha de entrega (YYYY-MM-DD)' },
          urgent: { type: 'boolean', description: 'Marcar/desmarcar urgente' },
          important: { type: 'boolean', description: 'Marcar/desmarcar importante' },
          notes: { type: 'string', description: 'Nuevas notas/descripción' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteTask',
      description: 'Elimina una tarea por su ID o título.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string', description: 'ID o título de la tarea a eliminar' } },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeTask',
      description: 'Marca una tarea como completada por su ID o título.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string', description: 'ID o título de la tarea' } },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggleTaskStatus',
      description: 'Cambia el estado de una tarea al siguiente en el ciclo (inicio → progreso → completado), o a un estado concreto si se indica.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'ID o título de la tarea' },
          status: { type: 'string', enum: ['inicio', 'progreso', 'completado'], description: 'Estado concreto deseado (opcional)' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listTasks',
      description: 'Lista todas las tareas. Puede filtrar por curso, estado o prioridad.',
      parameters: {
        type: 'object',
        properties: {
          course: { type: 'string', description: 'Filtrar por nombre de curso' },
          status: { type: 'string', enum: ['inicio', 'progreso', 'completado'], description: 'Filtrar por estado' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Filtrar por prioridad' },
        },
      },
    },
  },

  // ═══ NOTES ═══
  {
    type: 'function',
    function: {
      name: 'createNote',
      description: 'Crea una nueva nota/apunte (formato de Notas de Owa: HTML rich text, curso, color).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título de la nota' },
          content: { type: 'string', description: 'Contenido de la nota (texto plano; se guarda como HTML)' },
          course: { type: 'string', description: 'Nombre del curso asociado' },
          courseColor: { type: 'string', description: 'Color hex del curso' },
          isPinned: { type: 'boolean', description: 'Si debe quedar destacada' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateNote',
      description: 'Edita una nota existente (título, contenido, curso, color, anclada).',
      parameters: {
        type: 'object',
        properties: {
          noteIdOrTitle: { type: 'string', description: 'ID o título de la nota a editar' },
          title: { type: 'string', description: 'Nuevo título' },
          content: { type: 'string', description: 'Nuevo contenido (texto plano)' },
          course: { type: 'string', description: 'Nuevo curso' },
          isPinned: { type: 'boolean', description: 'Anclar/desanclar' },
        },
        required: ['noteIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteNote',
      description: 'Elimina una nota (a la papelera). Se puede recuperar desde la papelera.',
      parameters: {
        type: 'object',
        properties: { noteIdOrTitle: { type: 'string', description: 'ID o título de la nota a eliminar' } },
        required: ['noteIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchNotes',
      description: 'Busca notas por título o contenido.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Texto a buscar en títulos y contenido de las notas' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readNote',
      description: 'Lee el contenido completo de una nota por su título o ID.',
      parameters: {
        type: 'object',
        properties: { noteIdOrTitle: { type: 'string', description: 'ID o título de la nota a leer' } },
        required: ['noteIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listNotes',
      description: 'Lista notas, opcionalmente filtradas por curso.',
      parameters: {
        type: 'object',
        properties: { course: { type: 'string', description: 'Filtrar por nombre de curso' } },
      },
    },
  },

  // ═══ COURSES ═══
  {
    type: 'function',
    function: {
      name: 'createCourse',
      description: 'Crea un nuevo curso.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del curso' },
          color: { type: 'string', description: 'Color hex del curso (ej: #6366f1)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateCourse',
      description: 'Edita un curso existente (nombre, color, profesor).',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre actual del curso' },
          name: { type: 'string', description: 'Nuevo nombre' },
          color: { type: 'string', description: 'Nuevo color hex' },
          teacherName: { type: 'string', description: 'Nombre del profesor' },
        },
        required: ['courseName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteCourse',
      description: 'Elimina un curso por su nombre.',
      parameters: {
        type: 'object',
        properties: { courseName: { type: 'string', description: 'Nombre del curso a eliminar' } },
        required: ['courseName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listCourses',
      description: 'Lista todos los cursos disponibles con sus datos.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setTopicReviewLevel',
      description: 'Establece el nivel de dominio (0-10) de un tema de un curso. Es la barra tipo velocímetro de dominio. 8-10 = dominado, 1-7 = en estudio, 0 = pendiente.',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre del curso' },
          topicTitle: { type: 'string', description: 'Título del tema' },
          level: { type: 'number', minimum: 0, maximum: 10, description: 'Nivel de dominio 0-10' },
        },
        required: ['courseName', 'topicTitle', 'level'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTopic',
      description: 'Crea un tema nuevo dentro de un curso (formato SubjectTopic de Owa).',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre del curso' },
          title: { type: 'string', description: 'Título del tema' },
        },
        required: ['courseName', 'title'],
      },
    },
  },

  // ═══ PLANNER / PLANNED SESSIONS ═══
  {
    type: 'function',
    function: {
      name: 'createPlannedSession',
      description: 'Crea una sesión de estudio planificada (formato PlannedSession de Owa).',
      parameters: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'ID del curso' },
          courseName: { type: 'string', description: 'Nombre del curso (se busca el ID automáticamente)' },
          date: { type: 'string', description: 'Fecha de la sesión (YYYY-MM-DD)' },
          title: { type: 'string', description: 'Título de la sesión' },
          durationMinutes: { type: 'number', description: 'Duración en minutos' },
          type: { type: 'string', enum: ['estudio', 'repaso', 'ejercicio', 'lectura', 'otro'], description: 'Tipo de sesión' },
          startTime: { type: 'string', description: 'Hora de inicio (HH:MM)' },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updatePlannedSession',
      description: 'Edita una sesión planificada (fecha, duración, título, tipo, completada).',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID de la sesión' },
          title: { type: 'string', description: 'Nuevo título' },
          date: { type: 'string', description: 'Nueva fecha (YYYY-MM-DD)' },
          durationMinutes: { type: 'number', description: 'Nueva duración en minutos' },
          type: { type: 'string', description: 'Nuevo tipo' },
          startTime: { type: 'string', description: 'Nueva hora de inicio (HH:MM)' },
          completed: { type: 'boolean', description: 'Marcar completada o no' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completePlannedSession',
      description: 'Marca una sesión planificada como completada (o la desmarca).',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID de la sesión' },
          completed: { type: 'boolean', description: 'Completada (true por defecto)' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listPlannedSessions',
      description: 'Lista las sesiones planificadas, opcionalmente filtradas por fecha.',
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'Fecha a consultar (YYYY-MM-DD). Si no se especifica, muestra hoy.' } },
      },
    },
  },

  // ═══ EVENTS (Planificador — formato real PlanEvent/owa_planner_v3) ═══
  {
    type: 'function',
    function: {
      name: 'createEvent',
      description: 'Crea un evento en el Planificador con el MISMO formato que el modal de eventos de Owa (PlanEvent). Aparecerá en la vista del planificador y sincroniza con Google Calendar si está activo.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del evento' },
          date: { type: 'string', description: 'Fecha (YYYY-MM-DD)' },
          startTime: { type: 'string', description: 'Hora inicio (HH:MM). Por defecto 09:00' },
          endTime: { type: 'string', description: 'Hora fin (HH:MM). Por defecto 10:00' },
          allDay: { type: 'boolean', description: 'Si es evento de todo el día' },
          description: { type: 'string', description: 'Descripción del evento' },
          course: { type: 'string', description: 'Nombre del curso asociado' },
          color: { type: 'string', description: 'Color del evento (hex)' },
          repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'custom_days'], description: 'Repetición' },
          repeatDays: { type: 'array', items: { type: 'number' }, description: 'Días de repetición si custom_days (0=Lun..6=Dom)' },
          repeatUntil: { type: 'string', description: 'Fecha límite de repetición (YYYY-MM-DD)' },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateEvent',
      description: 'Edita un evento del Planificador (fecha, horas, título, color, repetición, todo el día).',
      parameters: {
        type: 'object',
        properties: {
          eventIdOrTitle: { type: 'string', description: 'ID del evento o texto que coincida con su título' },
          title: { type: 'string', description: 'Nuevo título' },
          date: { type: 'string', description: 'Nueva fecha (YYYY-MM-DD)' },
          startTime: { type: 'string', description: 'Nueva hora inicio (HH:MM)' },
          endTime: { type: 'string', description: 'Nueva hora fin (HH:MM)' },
          allDay: { type: 'boolean', description: 'Todo el día' },
          description: { type: 'string', description: 'Nueva descripción' },
          color: { type: 'string', description: 'Nuevo color (hex)' },
        },
        required: ['eventIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteEvent',
      description: 'Elimina un evento del Planificador por su ID o título. Si era la meta anclada en Inicio, la desancla.',
      parameters: {
        type: 'object',
        properties: { eventIdOrTitle: { type: 'string', description: 'ID del evento o texto que coincida con su título' } },
        required: ['eventIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listEvents',
      description: 'Lista eventos del Planificador, opcionalmente en un rango de fechas o por texto.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Desde (YYYY-MM-DD). Por defecto hoy' },
          toDate: { type: 'string', description: 'Hasta (YYYY-MM-DD). Por defecto +7 días' },
          query: { type: 'string', description: 'Filtrar por texto en el título' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pinToHome',
      description: 'Ancla un evento del Planificador como "Meta planificada" en la vista Inicio (misma lógica que el botón de la app: guarda el id en owa_planned_goal).',
      parameters: {
        type: 'object',
        properties: {
          eventIdOrTitle: { type: 'string', description: 'ID del evento o texto que coincida con su título' },
        },
        required: ['eventIdOrTitle'],
      },
    },
  },

  // ═══ HABITS ═══
  {
    type: 'function',
    function: {
      name: 'createHabit',
      description: 'Crea un nuevo hábito para seguimiento diario.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Nombre del hábito' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeHabit',
      description: 'Marca un hábito como completado hoy.',
      parameters: {
        type: 'object',
        properties: { habitName: { type: 'string', description: 'Nombre del hábito a completar' } },
        required: ['habitName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'uncompleteHabit',
      description: 'Deshace la marca de hoy en un hábito.',
      parameters: {
        type: 'object',
        properties: { habitName: { type: 'string', description: 'Nombre del hábito' } },
        required: ['habitName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listHabits',
      description: 'Lista los hábitos y su racha/estado de hoy.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteHabit',
      description: 'Elimina un hábito por su nombre.',
      parameters: {
        type: 'object',
        properties: { habitName: { type: 'string', description: 'Nombre del hábito' } },
        required: ['habitName'],
      },
    },
  },

  // ═══ STUDY TIMER ═══
  {
    type: 'function',
    function: {
      name: 'startTimer',
      description: 'Inicia el temporizador de estudio (pomodoro o cronómetro) EN SEGUNDO PLANO, sin cambiar de pantalla.',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', enum: ['pomodoro', 'chrono'], description: 'Tipo de temporizador' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stopTimer',
      description: 'Detiene y reinicia el temporizador de estudio a cero (EN SEGUNDO PLANO).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pauseTimer',
      description: 'Pausa el temporizador si está en marcha (EN SEGUNDO PLANO).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumeTimer',
      description: 'Reanuda el temporizador si está pausado (EN SEGUNDO PLANO).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTimerStatus',
      description: 'Consulta el estado actual del temporizador (activo/pausado, tipo, tiempo transcurrido, restante).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setTimerType',
      description: 'Cambia el tipo de temporizador (pomodoro o cronómetro).',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', enum: ['pomodoro', 'chrono'], description: 'Tipo' } },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjustTimer',
      description: 'Ajusta el tiempo del temporizador actual en segundos (adelantar o atrasar la sesión en curso).',
      parameters: {
        type: 'object',
        properties: { seconds: { type: 'number', description: 'Segundos a establecer (0 reinicia, p.ej. 1500 = 25 min)' } },
        required: ['seconds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getStudyStats',
      description: 'Obtiene las estadísticas de estudio del día (tiempo total, pomodoros, etc.).',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ═══ MUSIC ═══
  {
    type: 'function',
    function: {
      name: 'playMusic',
      description: 'Reproduce música. Puede reproducir una canción por nombre, una playlist por nombre, un artista, o simplemente reanudar la reproducción.',
      parameters: {
        type: 'object',
        properties: { trackName: { type: 'string', description: 'Nombre de canción, artista o playlist a reproducir. Si no se especifica, reanuda.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pauseMusic',
      description: 'Pausa la reproducción de música.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'nextTrack',
      description: 'Salta a la siguiente canción en la cola (misma lógica que el botón de Música).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'previousTrack',
      description: 'Vuelve a la canción anterior en el pool de reproducción (misma lógica que el botón de Música).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setVolume',
      description: 'Ajusta el volumen de la música.',
      parameters: {
        type: 'object',
        properties: { volume: { type: 'number', description: 'Volumen de 0 a 100' } },
        required: ['volume'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchTracks',
      description: 'Busca canciones en la biblioteca local por nombre o artista.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Texto a buscar en títulos y artistas' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchYouTubeMusic',
      description: 'Busca música en internet (YouTube) con el MISMO buscador que usa la app en Música.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Texto a buscar (canción, artista, género)' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addYouTubeTrack',
      description: 'Añade una canción de YouTube (por videoId de un resultado de searchYouTubeMusic) a la biblioteca como pista youtube.',
      parameters: {
        type: 'object',
        properties: { videoId: { type: 'string', description: 'El videoId de un resultado de búsqueda de YouTube' } },
        required: ['videoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addToQueue',
      description: 'Añade canciones a la cola de reproducción (se reproducirán cuando acabe la actual).',
      parameters: {
        type: 'object',
        properties: { trackName: { type: 'string', description: 'Nombre o parte del nombre de la canción' } },
        required: ['trackName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setShuffleMode',
      description: 'Activa o desactiva la reproducción aleatoria.',
      parameters: {
        type: 'object',
        properties: { enabled: { type: 'boolean', description: 'Activar/desactivar shuffle' } },
        required: ['enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setRepeatMode',
      description: 'Configura el modo de repetición: none (ninguno), all (repetir lista), one (repetir una).',
      parameters: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['none', 'all', 'one'], description: 'Modo de repetición' } },
        required: ['mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createPlaylist',
      description: 'Crea una playlist con las canciones indicadas (por nombre o ID).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la playlist' },
          trackNames: { type: 'array', items: { type: 'string' }, description: 'Nombres o partes de nombres de canciones a incluir' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listPlaylists',
      description: 'Lista las playlists y sus canciones.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deletePlaylist',
      description: 'Elimina una playlist por su nombre.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Nombre de la playlist' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggleFavorite',
      description: 'Añade o quita una canción de Favoritas.',
      parameters: {
        type: 'object',
        properties: { trackName: { type: 'string', description: 'Nombre o parte del nombre de la canción' } },
        required: ['trackName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlaybackState',
      description: 'Consulta el estado del reproductor: canción actual, reproduciendo/pausado, cola, shuffle, repeat, volumen.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ═══ NAVIGATION (SOLO si el usuario lo pide explícitamente) ═══
  {
    type: 'function',
    function: {
      name: 'navigateTo',
      description: 'Navega a una vista de la app SOLO cuando el usuario lo pide explícitamente ("llévame a cursos", "abre música"). No usar por defecto.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['inicio', 'estudio', 'tareas', 'notas', 'musica', 'planificacion', 'cursos', 'ajustes'], description: 'Vista a la que navegar' },
        },
        required: ['view'],
      },
    },
  },

  // ═══ SYSTEM ═══
  {
    type: 'function',
    function: {
      name: 'getAppState',
      description: 'Obtiene un snapshot consolidado de la app: cursos, tareas pendientes, eventos próximos, sesiones planificadas, hábitos, temporizador, música.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'webSearch',
      description: 'Busca en TODO internet con investigación profunda en vivo (DuckDuckGo, Mojeek, Bing, Wikipedia), LEE el contenido de los artículos más relevantes (contenido extraído como Claude/Perplexity) y devuelve resultados con extractos reales para responder con datos actuales, noticias, tutoriales y fuentes oficiales.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Concepto o pregunta a buscar' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readWebPage',
      description: 'Lee y extrae el texto completo y limpio de cualquier página web o artículo a partir de su URL. Ideal para profundizar en fuentes, noticias o enlaces.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL de la página web a leer' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createQuizTopic',
      description: 'Crea una pregunta de Quiz/Flashcard como apunte en un curso.',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre del curso' },
          question: { type: 'string', description: 'Pregunta del quiz' },
          answer: { type: 'string', description: 'Respuesta correcta' },
        },
        required: ['courseName', 'question', 'answer'],
      },
    },
  },

  // ═══ MUSIC — LIBRERÍA & PLAYLISTS ═══
  {
    type: 'function',
    function: {
      name: 'listTracks',
      description: 'Lista la biblioteca musical. Filtra por artista o por favoritas.',
      parameters: {
        type: 'object',
        properties: {
          artist: { type: 'string', description: 'Filtro opcional por artista' },
          favorite: { type: 'boolean', description: 'Mostrar solo favoritas' },
          limit: { type: 'number', description: 'Máximo de resultados (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteTrack',
      description: 'Elimina una canción de la biblioteca por su título o artista.',
      parameters: {
        type: 'object',
        properties: { trackName: { type: 'string', description: 'Título o artista de la canción' } },
        required: ['trackName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addToPlaylist',
      description: 'Añade una canción de la biblioteca a una playlist existente.',
      parameters: {
        type: 'object',
        properties: {
          playlistName: { type: 'string', description: 'Nombre de la playlist' },
          trackName: { type: 'string', description: 'Título o artista de la canción' },
        },
        required: ['playlistName', 'trackName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeFromPlaylist',
      description: 'Quita una canción de una playlist.',
      parameters: {
        type: 'object',
        properties: {
          playlistName: { type: 'string', description: 'Nombre de la playlist' },
          trackName: { type: 'string', description: 'Título de la canción a quitar' },
        },
        required: ['playlistName', 'trackName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'renamePlaylist',
      description: 'Renombra una playlist existente.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre actual de la playlist' },
          newName: { type: 'string', description: 'Nuevo nombre' },
        },
        required: ['name', 'newName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearQueue',
      description: 'Vacía la cola de reproducción (no detiene la canción actual).',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ═══ NOTES — PAPELERA ═══
  {
    type: 'function',
    function: {
      name: 'listDeletedNotes',
      description: 'Lista las notas de la papelera (eliminadas pero aún recuperables).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'restoreNote',
      description: 'Recupera una nota desde la papelera por su ID o título.',
      parameters: {
        type: 'object',
        properties: { noteIdOrTitle: { type: 'string', description: 'ID o título de la nota' } },
        required: ['noteIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'permanentlyDeleteNote',
      description: 'Elimina una nota definitivamente (sin recuperación posible) por su ID o título.',
      parameters: {
        type: 'object',
        properties: { noteIdOrTitle: { type: 'string', description: 'ID o título de la nota' } },
        required: ['noteIdOrTitle'],
      },
    },
  },

  // ═══ COURSES — CONTENIDO ═══
  {
    type: 'function',
    function: {
      name: 'getCourseDetails',
      description: 'Obtiene el detalle completo de un curso: temas con nivel de dominio, agrupaciones, materiales y estadísticas de tareas.',
      parameters: {
        type: 'object',
        properties: { courseName: { type: 'string', description: 'Nombre del curso' } },
        required: ['courseName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createGroup',
      description: 'Crea una agrupación dentro de un curso.',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre del curso' },
          groupName: { type: 'string', description: 'Nombre de la agrupación' },
        },
        required: ['courseName', 'groupName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteTopic',
      description: 'Elimina un tema de un curso por su título.',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre del curso' },
          topicTitle: { type: 'string', description: 'Título del tema a eliminar' },
        },
        required: ['courseName', 'topicTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addMaterial',
      description: 'Añade un material o enlace a un tema de un curso.',
      parameters: {
        type: 'object',
        properties: {
          courseName: { type: 'string', description: 'Nombre del curso' },
          topicTitle: { type: 'string', description: 'Título del tema' },
          name: { type: 'string', description: 'Nombre visible del material' },
          dataUrl: { type: 'string', description: 'URL del recurso (http) o datos' },
        },
        required: ['courseName', 'topicTitle', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listMaterials',
      description: 'Lista todos los materiales de un curso agrupados por tema.',
      parameters: {
        type: 'object',
        properties: { courseName: { type: 'string', description: 'Nombre del curso' } },
        required: ['courseName'],
      },
    },
  },

  // ═══ PLANNER — AGENDA ═══
  {
    type: 'function',
    function: {
      name: 'getTodayAgenda',
      description: 'Resumen de hoy: eventos del planificador, sesiones de estudio planificadas, tareas con entrega hoy y hábitos. Úsala para responder "¿qué tengo hoy?"',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlannerOverview',
      description: 'Vista general del planificador: eventos y sesiones de estudio en un rango de fechas.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (default hoy)' },
          to: { type: 'string', description: 'Fecha fin YYYY-MM-DD (default +7 días)' },
        },
      },
    },
  },

  // ═══ SYSTEM ═══
  {
    type: 'function',
    function: {
      name: 'getSettings',
      description: 'Muestra la configuración actual de la app (tema, tiempos de estudio, objetivos).',
      parameters: { type: 'object', properties: {} },
    },
  },
];


// ─── Tool Executor ───

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface AppContextActions {
  // Tasks
  addTask: (task: any) => void;
  updateTask: (id: string, updates: any) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  tasks: any[];
  // Notes
  addNote: (note: any) => string;
  updateNote: (id: string, updates: any) => void;
  deleteNote: (id: string) => void;
  restoreNote?: (id: string) => void;
  permanentlyDeleteNote?: (id: string) => void;
  notes: any[];
  // Courses
  addCourse: (course: any) => string;
  updateCourse: (id: string, updates: any) => void;
  deleteCourse: (id: string) => void;
  courses: any[];
  // Planner events bridge (el store real lo maneja aiTools vía owa_planner_v3)
  planEvents: any[];
  setPlanEvents: (updater: any) => void;
  // Habits
  addHabit: (name: string) => void;
  updateHabit: (id: string, updates: any) => void;
  deleteHabit: (id: string) => void;
  habits: any[];
  // Music
  playTrack: (id: string) => void;
  toggleMusicPlayback: () => void;
  setIsPlayingMusic: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMusicVolume: (v: number) => void;
  setMusicProgress?: (v: number) => void;
  tracks: any[];
  currentTrackId: string | null;
  isPlayingMusic: boolean;
  musicQueue: string[];
  setMusicQueue: (q: string[]) => void;
  queueSource: { pool: string[]; name?: string } | null;
  setQueueSource: (s: { pool: string[]; name?: string } | null) => void;
  shuffleMode: boolean;
  setShuffleMode: (v: boolean) => void;
  repeatMode: 'none' | 'all' | 'one';
  setRepeatMode: (v: 'none' | 'all' | 'one') => void;
  playlists: any[];
  addPlaylist: (name: string, trackIds: string[], coverImage?: string, isPublic?: boolean) => void;
  updatePlaylist: (id: string, updates: any) => void;
  deletePlaylist: (id: string) => void;
  toggleTrackFavorite: (id: string) => void;
  addTrack: (track: any) => string;
  updateTrack?: (id: string, updates: any) => void;
  deleteTrack?: (id: string) => void;
  musicVolume: number;
  searchYouTubeMusic?: (query: string) => Promise<{ videoId: string; title: string; channel: string; thumbnail: string }[]>;
  // Planner sessions
  plannedSessions: any[];
  addPlannedSession: (session: any) => void;
  updatePlannedSession: (id: string, updates: any) => void;
  // Timer
  isTimerActive: boolean;
  sessionType: string;
  sessionTime: number;
  dailyStudyTime: number;
  pomodoroSessions: number;
  setSessionType: (v: 'pomodoro' | 'chrono') => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  setIsTimerActive: (v: boolean | ((prev: boolean) => boolean)) => void;
  setSessionTime: (v: number | ((prev: number) => number)) => void;
  isRest: boolean;
  setIsRest: (v: boolean | ((prev: boolean) => boolean)) => void;
  // Navigation (solo explícita)
  setNavigateTo: (view: any) => void;
  setFocusedTaskId?: (id: string | null) => void;
  setFocusedEventId?: (id: string | null) => void;
  // Settings
  settings: any;
  updateSettings: (updates: any) => void;
  // Feedback
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── Helpers de búsqueda por ID/título ───

function findTask(ctx: AppContextActions, ref: string) {
  return ctx.tasks.find(t => t.id === ref) ||
    ctx.tasks.find(t => t.title?.toLowerCase().includes(ref.toLowerCase()));
}
function findNote(ctx: AppContextActions, ref: string) {
  return ctx.notes.find(n => n.id === ref) ||
    ctx.notes.find(n => n.title?.toLowerCase().includes(ref.toLowerCase()));
}
function findCourse(ctx: AppContextActions, name: string) {
  const q = (name || '').toLowerCase();
  return ctx.courses.find(c => c.name?.toLowerCase() === q) ||
    ctx.courses.find(c => c.name?.toLowerCase().includes(q));
}
function findTrack(ctx: AppContextActions, name: string) {
  const q = (name || '').toLowerCase();
  return ctx.tracks.find(t => t.title?.toLowerCase().includes(q)) ||
    ctx.tracks.find(t => t.artist?.toLowerCase().includes(q));
}
function findHabit(ctx: AppContextActions, name: string) {
  const q = (name || '').toLowerCase();
  return ctx.habits.find(h => h.name?.toLowerCase() === q) ||
    ctx.habits.find(h => h.name?.toLowerCase().includes(q));
}
const stripHtml = (s: string) => (s || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

/**
 * Ejecuta una llamada a una herramienta.
 * Puente entre las respuestas de la IA y las acciones reales de la app.
 */
export async function executeToolCall(
  toolName: string,
  argsStr: string,
  ctx: AppContextActions,
): Promise<ToolExecutionResult> {
  let args: Record<string, any>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return { success: false, message: 'Error parseando argumentos: JSON inválido' };
  }

  try {
    switch (toolName) {
      // ═══ KNOWLEDGE & WEB SEARCH ═══
      case 'webSearch': {
        const query = (args.query || '').trim();
        if (!query) return { success: true, message: 'Se requiere una consulta para buscar. Pregúntame con más detalle.' };
        const truncate = (s: string, n = 900) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);
        const snip = (s: string, n = 160) => {
          const t = (s || '').replace(/\s+/g, ' ').trim();
          return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
        };
        const f = await getFetch();

        const cleanUrl = (raw: string): string => {
          try {
            const u = new URL(raw.startsWith('//') ? 'https:' + raw : raw);
            const uddg = u.searchParams.get('uddg');
            if (uddg) return decodeURIComponent(uddg);
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'yclid'].forEach(k => u.searchParams.delete(k));
            return u.toString();
          } catch { return raw; }
        };

        // ── Relevancia: cuántos tokens de la consulta (sin stopwords) aparecen en título/URL/snippet ──
        const STOP = new Set('el la los las de del en y a al con por para que un una es son se su sus como cual cuando donde qué cuál cómo cuándo dónde quién cuánto the of to in and is are for on with at from what how why when where who which a an it this that i you we they he she not no or but if then'.split(' '));
        const queryTokens = query.toLowerCase().split(/[^a-z0-9áéíóúñü]+/i).filter((t: string) => t.length > 2 && !STOP.has(t));
        const scoreResult = (title: string, url: string, snippet: string): number => {
          if (queryTokens.length === 0) return 1;
          const hay = `${title} ${url} ${snippet}`.toLowerCase();
          let hits = 0;
          for (const t of queryTokens) if (hay.includes(t)) hits++;
          return hits / queryTokens.length;
        };

        const seen = new Set<string>();
        const results: { title: string; url: string; snippet: string; source: string; score: number }[] = [];
        const addResult = (title: string, url: string, snippet: string, source: string) => {
          if (!title || !url) return;
          const u = cleanUrl(url);
          if (!u || !/^https?:\/\//i.test(u)) return;
          let key = '';
          try {
            const p = new URL(u);
            key = `${p.hostname.replace(/^www\./, '').toLowerCase()}${p.pathname.toLowerCase().replace(/\/+$/, '')}`;
          } catch { return; }
          if (seen.has(key)) return;
          const score = scoreResult(title, u, snippet);
          if (score < 0.25 && results.length >= 4) return;
          seen.add(key);
          results.push({ title, url: u, snippet: snip(snippet), source, score });
        };

        // 1) DuckDuckGo HTML — resultados reales de la web (2 páginas)
        if (typeof DOMParser !== 'undefined') {
          for (const offset of [0, 30]) {
            try {
              const htmlRes = await f(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${offset}`);
              if (!htmlRes.ok) break;
              const doc = new DOMParser().parseFromString(await htmlRes.text(), 'text/html');
              const nodes = doc.querySelectorAll('.result');
              for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i].querySelector('.result__a');
                if (!a) continue;
                const title = (a.textContent || '').trim();
                const href = (a.getAttribute('href') || '').trim();
                const snippet = (nodes[i].querySelector('.result__snippet')?.textContent || '').trim();
                addResult(title, href, snippet, 'Web');
              }
            } catch { break; }
          }
        }

        // 2) Mojeek — buscador independiente, HTML limpio y sin consentimientos
        if (typeof DOMParser !== 'undefined') {
          try {
            const mojRes = await f(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`);
            if (mojRes.ok) {
              const doc = new DOMParser().parseFromString(await mojRes.text(), 'text/html');
              const nodes = doc.querySelectorAll('.ob');
              for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i].querySelector('h2 a');
                if (!a) continue;
                const title = (a.textContent || '').trim();
                const href = (a.getAttribute('href') || '').trim();
                const snippet = (nodes[i].querySelector('.s')?.textContent || '').trim();
                addResult(title, href, snippet, 'Web');
              }
            }
          } catch {}
        }

        // 3) Bing — tercera fuente, solo enlaces externos reales (sin basura de redirección)
        if (typeof DOMParser !== 'undefined') {
          try {
            const bingRes = await f(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=15`);
            if (bingRes.ok) {
              const doc = new DOMParser().parseFromString(await bingRes.text(), 'text/html');
              const nodes = doc.querySelectorAll('li.b_algo');
              for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i].querySelector('h2 a');
                if (!a) continue;
                const title = (a.textContent || '').trim();
                const href = (a.getAttribute('href') || '').trim();
                if (/bing\.com|microsoft\.com|go\.microsoft/.test(href)) continue;
                const snippet = (nodes[i].querySelector('.b_caption p')?.textContent || '').trim();
                addResult(title, href, snippet, 'Bing');
              }
            }
          } catch {}
        }

        // 4) DuckDuckGo Instant Answer (respuesta breve estructurada)
        let instantAnswer = '';
        try {
          const ddgRes = await f(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
          if (ddgRes.ok) {
            const ddgData = await ddgRes.json();
            instantAnswer = ddgData.AbstractText || ddgData.Definition || '';
            if (ddgData.AbstractURL) addResult(ddgData.Answer || query, ddgData.AbstractURL, instantAnswer, 'Instant Answer');
          }
        } catch {}

        // 5) Wikipedia directa + búsqueda (entrada enciclopédica fiable)
        let wikiTitle = '';
        let wikiUrl = '';
        let wikiExtract = '';
        try {
          const direct = await f(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
          if (direct.ok) {
            const d = await direct.json();
            if (d.extract && d.extract.length > 30) {
              wikiTitle = d.title || query; wikiUrl = d.content_urls?.desktop?.page || ''; wikiExtract = d.extract;
            }
          }
        } catch {}
        if (!wikiExtract) {
          try {
            const sr = await f(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`);
            if (sr.ok) {
              const sd = await sr.json();
              const top = sd?.query?.search?.[0];
              if (top?.title) {
                const sr2 = await f(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title)}`);
                if (sr2.ok) {
                  const d = await sr2.json();
                  if (d.extract && d.extract.length > 30) {
                    wikiTitle = d.title; wikiUrl = d.content_urls?.desktop?.page || ''; wikiExtract = d.extract;
                  }
                }
              }
            }
          } catch {}
        }
        if (wikiUrl) addResult(`Wikipedia — ${wikiTitle}`, wikiUrl, wikiExtract, 'Wikipedia');

        // Ordenar por relevancia real (tokens de la consulta presentes en el resultado)
        results.sort((a, b) => b.score - a.score);
        const shown = results.slice(0, 40);

        // 6) LECTURA DE ARTÍCULOS: entrar en las páginas top y extraer el contenido real
        //    (como Claude/Perplexity: no basta con los snippets, hay que leer el artículo)
        type Digest = { title: string; url: string; excerpt: string; host: string };
        const digests: Digest[] = [];
        const topUrls = shown.filter(r => !r.url.includes('wikipedia.org')).slice(0, 6);
        if (typeof DOMParser !== 'undefined' && topUrls.length > 0) {
          await Promise.allSettled(topUrls.map(async (r) => {
            try {
              const ac = new AbortController();
              const timer = setTimeout(() => ac.abort(), 6000);
              const res = await f(r.url, { signal: ac.signal });
              clearTimeout(timer);
              if (!res.ok) return;
              const html = await res.text();
              if (html.length > 3_000_000) return;
              const doc = new DOMParser().parseFromString(html, 'text/html');
              doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,select,[class*="ad"],[id*="ad"],[class*="menu"],[class*="nav"],[class*="cookie"]').forEach(n => n.remove());
              const main = doc.querySelector('article, main, [role="main"], .content, .article, .post, .entry-content');
              const pool = main || doc.body;
              if (!pool) return;
              const paras = Array.from(pool.querySelectorAll('p'))
                .map(p => (p.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(t => t.length > 80 && t.length < 3000);
              const text = paras.join(' ').trim();
              if (text.length < 350) return;
              const title = (doc.querySelector('h1')?.textContent || doc.title || r.title || '').replace(/\s+/g, ' ').trim();
              let host = '';
              try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch {}
              digests.push({ title: snip(title || r.title, 140), url: r.url, excerpt: text.slice(0, 1400), host });
            } catch {}
          }));
        }

        // 7) Listado final numerado + contenido extraído para responder con datos reales
        const webLines = shown.slice(0, 30).map((r, i) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${snip(r.snippet || '—')}`
        ).join('\n');
        const instantBlock = instantAnswer ? `Respuesta breve: ${truncate(instantAnswer)}\n\n` : '';
        const digestBlock = digests.length
          ? `\n\n📰 CONTENIDO EXTRAÍDO DE LOS ARTÍCULOS (${digests.length} páginas leídas en vivo — úsalo para responder con datos reales):\n${digests.map((d, i) => `${i + 1}. ${d.title} [${d.host}]\n   ${truncate(d.excerpt, 420)}`).join('\n\n')}`
          : '';
        const more = results.length > shown.length ? `\n… y ${results.length - shown.length} resultados más en la lista completa.` : '';
        const sources = shown.slice(0, 8).map(r => r.url).join(' | ');
        if (results.length > 0) {
          return {
            success: true,
            message: `🔎 ${results.length} resultados relevantes para "${query}" (en vivo):\n\n${instantBlock}${webLines}${more}${digestBlock}\n\nFuentes destacadas: ${sources}`,
            data: { results: shown.map(({ score: _s, ...r }) => r), instantAnswer, digests },
          };
        }
        return {
          success: true,
          message: `No hay conexión con los buscadores en este momento para "${query}". Continuo con mi conocimiento propio sobre el tema.`,
          data: { offline: true },
        };
      }

      case 'readNote': {
        const note = findNote(ctx, args.noteIdOrTitle || '');
        if (!note) return { success: false, message: `No se encontró ninguna nota con "${args.noteIdOrTitle}"` };
        return {
          success: true,
          message: `📖 Nota "${note.title || 'Sin título'}" (${note.course || 'General'}):\n\n${stripHtml(note.content).slice(0, 1500)}`,
          data: { id: note.id, title: note.title, course: note.course, content: note.content },
        };
      }

      case 'createQuizTopic': {
        const course = findCourse(ctx, args.courseName);
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const noteTitle = `Quiz: ${(args.question || '').slice(0, 30)}...`;
        const content = `<p><strong>Pregunta:</strong> ${args.question}</p><p><strong>Respuesta:</strong> ${args.answer}</p>`;
        ctx.addNote({
          title: noteTitle,
          content,
          course: course.name,
          courseColor: course.color,
          isPinned: false,
        });
        return { success: true, message: `Quiz/Flashcard creado en el curso "${course.name}"` };
      }

      // ═══ TASKS ═══
      case 'createTask': {
        const courseName = args.course || 'General';
        const courseMatch = findCourse(ctx, courseName);
        const courseColor = args.courseColor || courseMatch?.color || '#6366f1';
        ctx.addTask({
          title: args.title,
          course: courseMatch?.name || courseName,
          courseColor,
          priority: args.priority || 'none',
          urgent: !!args.urgent,
          important: !!args.important,
          dueDate: args.dueDate,
          notes: args.notes || '',
        });
        ctx.addNotification?.(`Tarea creada: ${args.title}`, 'success');
        return { success: true, message: `Tarea "${args.title}" creada en ${courseMatch?.name || courseName}` };
      }

      case 'updateTask': {
        const task = findTask(ctx, args.taskId);
        if (!task) return { success: false, message: `Tarea no encontrada: ${args.taskId}` };
        const updates: any = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.status !== undefined) updates.status = args.status;
        if (args.priority !== undefined) updates.priority = args.priority;
        if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
        if (args.urgent !== undefined) updates.urgent = args.urgent;
        if (args.important !== undefined) updates.important = args.important;
        if (args.notes !== undefined) updates.notes = args.notes;
        if (args.status === 'completado' && !task.completedAt) updates.completedAt = new Date().toISOString();
        ctx.updateTask(task.id, updates);
        return { success: true, message: `Tarea "${task.title}" actualizada` };
      }

      case 'deleteTask': {
        const task = findTask(ctx, args.taskId);
        if (!task) return { success: false, message: `Tarea no encontrada: ${args.taskId}` };
        ctx.deleteTask(task.id);
        ctx.addNotification?.(`Tarea eliminada: ${task.title}`, 'info');
        return { success: true, message: `Tarea "${task.title}" eliminada` };
      }

      case 'completeTask': {
        const task = findTask(ctx, args.taskId);
        if (!task) return { success: false, message: `Tarea no encontrada` };
        ctx.updateTask(task.id, { status: 'completado', completedAt: new Date().toISOString() });
        return { success: true, message: `Tarea "${task.title}" completada ✓` };
      }

      case 'toggleTaskStatus': {
        const task = findTask(ctx, args.taskId);
        if (!task) return { success: false, message: `Tarea no encontrada: ${args.taskId}` };
        if (args.status) {
          ctx.updateTask(task.id, { status: args.status, completedAt: args.status === 'completado' ? new Date().toISOString() : undefined });
          return { success: true, message: `Tarea "${task.title}" → ${args.status === 'completado' ? 'completada ✓' : args.status}` };
        }
        const next = task.status === 'inicio' ? 'progreso' : task.status === 'progreso' ? 'completado' : 'inicio';
        ctx.updateTask(task.id, { status: next, completedAt: next === 'completado' ? new Date().toISOString() : undefined });
        return { success: true, message: `Tarea "${task.title}" → ${next === 'completado' ? 'completada ✓' : next}` };
      }

      case 'listTasks': {
        let filtered = [...ctx.tasks];
        if (args.course) filtered = filtered.filter(t => t.course?.toLowerCase().includes(args.course.toLowerCase()));
        if (args.status) filtered = filtered.filter(t => t.status === args.status);
        if (args.priority) filtered = filtered.filter(t => t.priority === args.priority);
        const summary = filtered.slice(0, 15).map(t =>
          `• "${t.title}" (${t.course}, ${t.priority}, ${t.status}${t.dueDate ? ` — ${t.dueDate}` : ''})`
        ).join('\n');
        return {
          success: true,
          message: `${filtered.length} tarea(s):\n${summary}`,
          data: filtered.slice(0, 15).map(t => ({ id: t.id, title: t.title, course: t.course, priority: t.priority, status: t.status, dueDate: t.dueDate })),
        };
      }

      // ═══ NOTES ═══
      case 'createNote': {
        const courseName = args.course || '';
        const courseMatch = findCourse(ctx, courseName);
        const html = `<p>${(args.content || '').replace(/\n/g, '<br/>')}</p>`;
        const id = ctx.addNote({
          title: args.title || '',
          content: html,
          course: courseMatch?.name || courseName,
          courseColor: args.courseColor || courseMatch?.color || '#6366f1',
          isPinned: !!args.isPinned,
        });
        ctx.addNotification?.(`Nota creada: ${args.title || 'Sin título'}`, 'success');
        return { success: true, message: `Nota creada${args.title ? `: "${args.title}"` : ''}`, data: { id } };
      }

      case 'updateNote': {
        const note = findNote(ctx, args.noteIdOrTitle);
        if (!note) return { success: false, message: `Nota no encontrada: ${args.noteIdOrTitle}` };
        const updates: any = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.content !== undefined) updates.content = `<p>${args.content.replace(/\n/g, '<br/>')}</p>`;
        if (args.course !== undefined) {
          const cm = findCourse(ctx, args.course);
          updates.course = cm?.name || args.course;
          updates.courseColor = cm?.color || note.courseColor;
        }
        if (args.isPinned !== undefined) updates.isPinned = args.isPinned;
        ctx.updateNote(note.id, updates);
        return { success: true, message: `Nota "${note.title || 'Sin título'}" actualizada` };
      }

      case 'deleteNote': {
        const note = findNote(ctx, args.noteIdOrTitle);
        if (!note) return { success: false, message: `Nota no encontrada: ${args.noteIdOrTitle}` };
        ctx.deleteNote(note.id);
        ctx.addNotification?.(`Nota movida a la papelera: ${note.title || 'Sin título'}`, 'info');
        return { success: true, message: `Nota "${note.title || 'Sin título'}" eliminada (a la papelera)` };
      }

      case 'searchNotes': {
        const query = (args.query || '').toLowerCase();
        const results = ctx.notes
          .filter(n => !n.deletedAt)
          .filter(n => n.title?.toLowerCase().includes(query) || n.content?.toLowerCase().includes(query))
          .slice(0, 10);
        const summary = results.map(n => `• "${n.title || '(sin título)'}" — ${n.course}`).join('\n');
        return {
          success: true,
          message: results.length > 0 ? `${results.length} nota(s):\n${summary}` : `No se encontraron notas con "${args.query}"`,
          data: results.map(n => ({ id: n.id, title: n.title, course: n.course })),
        };
      }

      case 'listNotes': {
        let filtered = ctx.notes.filter(n => !n.deletedAt);
        if (args.course) filtered = filtered.filter(n => n.course?.toLowerCase().includes(args.course.toLowerCase()));
        const summary = filtered.slice(0, 20).map(n => `• "${n.title || '(sin título)'}" — ${n.course}${n.isPinned ? ' ⭐' : ''}`).join('\n');
        return {
          success: true,
          message: `${filtered.length} nota(s):\n${summary}`,
          data: filtered.slice(0, 20).map(n => ({ id: n.id, title: n.title, course: n.course, isPinned: n.isPinned })),
        };
      }

      // ═══ COURSES ═══
      case 'createCourse': {
        const color = args.color || COURSE_COLORS[ctx.courses.length % COURSE_COLORS.length];
        const id = ctx.addCourse({
          name: args.name,
          color,
          progress: 0,
          totalTasks: 0,
          completedTasks: 0,
          hoursStudied: 0,
          studyTopics: [],
          groups: [],
        });
        ctx.addNotification?.(`Curso creado: ${args.name}`, 'success');
        return { success: true, message: `Curso "${args.name}" creado`, data: { id } };
      }

      case 'updateCourse': {
        const course = findCourse(ctx, args.courseName);
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const updates: any = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.color !== undefined) updates.color = args.color;
        if (args.teacherName !== undefined) { updates.teacher = args.teacherName; updates.teacherName = args.teacherName; }
        ctx.updateCourse(course.id, updates);
        return { success: true, message: `Curso "${course.name}" actualizado` };
      }

      case 'deleteCourse': {
        const course = findCourse(ctx, args.courseName);
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        ctx.deleteCourse(course.id);
        ctx.addNotification?.(`Curso eliminado: ${course.name}`, 'info');
        return { success: true, message: `Curso "${course.name}" eliminado` };
      }

      case 'listCourses': {
        const summary = ctx.courses.map(c =>
          `• "${c.name}" (${c.studyTopics?.length || 0} temas, ${c.groups?.length || 0} agrupaciones)`
        ).join('\n');
        return {
          success: true,
          message: `${ctx.courses.length} curso(s):\n${summary}`,
          data: ctx.courses.map(c => ({ id: c.id, name: c.name, color: c.color })),
        };
      }

      case 'setTopicReviewLevel': {
        const course = findCourse(ctx, args.courseName);
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const topics = course.studyTopics || [];
        const topic = topics.find((t: any) => t.title?.toLowerCase().includes((args.topicTitle || '').toLowerCase()));
        if (!topic) return { success: false, message: `Tema "${args.topicTitle}" no encontrado en "${course.name}"` };
        const level = Math.max(0, Math.min(10, Math.round(Number(args.level) || 0)));
        ctx.updateCourse(course.id, {
          studyTopics: topics.map((t: any) => t.id === topic.id ? { ...t, reviewLevel: level, status: level >= 8 ? 'done' : level >= 1 ? 'studying' : 'pending' } : t),
        });
        const label = level >= 8 ? 'dominado' : level >= 1 ? 'en estudio' : 'pendiente';
        ctx.addNotification?.(`Dominio de "${topic.title}" → ${level}/10 (${label})`, 'success');
        return { success: true, message: `Dominio de "${topic.title}" establecido en ${level}/10 (${label})` };
      }

      case 'createTopic': {
        const course = findCourse(ctx, args.courseName);
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const topics = course.studyTopics || [];
        ctx.updateCourse(course.id, {
          studyTopics: [...topics, { id: Math.random().toString(), title: args.title, status: 'pending', createdAt: Date.now(), reviewLevel: 0, nextReview: Date.now(), materials: [] }],
        });
        ctx.addNotification?.(`Tema creado: ${args.title}`, 'success');
        return { success: true, message: `Tema "${args.title}" creado en "${course.name}"` };
      }

      // ═══ PLANNER SESSIONS ═══
      case 'createPlannedSession': {
        let courseId = args.courseId;
        if (!courseId && args.courseName) {
          const match = findCourse(ctx, args.courseName);
          if (match) courseId = match.id;
        }
        if (!courseId && ctx.courses.length > 0) courseId = ctx.courses[0].id;
        ctx.addPlannedSession({
          courseId: courseId || '',
          date: args.date || new Date().toISOString().split('T')[0],
          title: args.title,
          durationMinutes: args.durationMinutes || 30,
          type: args.type || 'estudio',
          startTime: args.startTime,
          completed: false,
        });
        ctx.addNotification?.(`Sesión planificada: ${args.title}`, 'success');
        return { success: true, message: `Sesión planificada: "${args.title}" — ${args.date || 'hoy'}` };
      }

      case 'updatePlannedSession': {
        const s = ctx.plannedSessions.find(x => x.id === args.sessionId);
        if (!s) return { success: false, message: `Sesión no encontrada: ${args.sessionId}` };
        const updates: any = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.date !== undefined) updates.date = args.date;
        if (args.durationMinutes !== undefined) updates.durationMinutes = args.durationMinutes;
        if (args.type !== undefined) updates.type = args.type;
        if (args.startTime !== undefined) updates.startTime = args.startTime;
        if (args.completed !== undefined) updates.completed = args.completed;
        ctx.updatePlannedSession(s.id, updates);
        return { success: true, message: `Sesión "${s.title}" actualizada` };
      }

      case 'completePlannedSession': {
        const s = ctx.plannedSessions.find(x => x.id === args.sessionId);
        if (!s) return { success: false, message: `Sesión no encontrada: ${args.sessionId}` };
        ctx.updatePlannedSession(s.id, { completed: args.completed !== false });
        return { success: true, message: `Sesión "${s.title}" ${args.completed === false ? 'desmarcada' : 'completada ✓'}` };
      }

      case 'listPlannedSessions': {
        const date = args.date || new Date().toISOString().split('T')[0];
        const sessions = ctx.plannedSessions.filter(s => s.date === date);
        if (sessions.length === 0) return { success: true, message: `No hay sesiones planificadas para ${date}` };
        const summary = sessions.map(s =>
          `• "${s.title}" (${s.durationMinutes}min, ${s.type}${s.completed ? ' ✓' : ''})`
        ).join('\n');
        return { success: true, message: `Sesiones para ${date}:\n${summary}`, data: sessions };
      }

      // ═══ EVENTS — formato real del Planificador (owa_planner_v3) ═══
      case 'createEvent': {
        const store = loadPlanner();
        const courseMatch = args.course ? findCourse(ctx, args.course) : undefined;
        const allDay = !!args.allDay;
        const ev: PlanEvent = {
          id: uid(),
          title: String(args.title || '').trim(),
          date: String(args.date || new Date().toISOString().split('T')[0]),
          allDay,
          startTime: allDay ? '00:00' : args.startTime || '09:00',
          endTime: allDay ? '23:59' : args.endTime || '10:00',
          courseId: courseMatch?.id,
          color: args.color || courseMatch?.color || '#E11D48',
          description: args.description || undefined,
          repeat: args.repeat || 'none',
          repeatDays: args.repeat === 'custom_days' && Array.isArray(args.repeatDays) ? args.repeatDays : undefined,
          repeatUntil: args.repeat && args.repeat !== 'none' && args.repeatUntil ? args.repeatUntil : undefined,
          attachments: [],
        };
        if (!ev.title) return { success: false, message: 'El título del evento es obligatorio' };
        store.events.push(ev);
        savePlanner(store.events, store.classes);
        ctx.setPlanEvents((prev: any[]) => [...prev, {
          id: ev.id, title: ev.title, description: ev.description || '', date: ev.date,
          startTime: ev.startTime, endTime: ev.endTime, allDay, color: ev.color,
        }]);
        ctx.addNotification?.(`Evento creado: ${ev.title}`, 'success');
        return {
          success: true,
          message: `Evento "${ev.title}" creado para ${ev.date}${allDay ? ' (todo el día)' : ` de ${ev.startTime} a ${ev.endTime}`}`,
          data: { id: ev.id },
        };
      }

      case 'updateEvent': {
        const store = loadPlanner();
        const ev = store.events.find(e => e.id === args.eventIdOrTitle) ||
          store.events.find(e => e.title?.toLowerCase().includes((args.eventIdOrTitle || '').toLowerCase()));
        if (!ev) return { success: false, message: `Evento no encontrado: ${args.eventIdOrTitle}` };
        if (args.title !== undefined) ev.title = String(args.title).trim();
        if (args.date !== undefined) ev.date = String(args.date);
        if (args.startTime !== undefined) ev.startTime = String(args.startTime);
        if (args.endTime !== undefined) ev.endTime = String(args.endTime);
        if (args.allDay !== undefined) {
          ev.allDay = !!args.allDay;
          if (ev.allDay) { ev.startTime = '00:00'; ev.endTime = '23:59'; }
        }
        if (args.description !== undefined) ev.description = args.description || undefined;
        if (args.color !== undefined) ev.color = String(args.color);
        savePlanner(store.events, store.classes);
        ctx.setPlanEvents((prev: any[]) => prev.map(p => p.id === ev.id ? { ...p, title: ev.title, description: ev.description || '', date: ev.date, startTime: ev.startTime, endTime: ev.endTime, allDay: ev.allDay, color: ev.color } : p));
        ctx.addNotification?.(`Evento actualizado: ${ev.title}`, 'success');
        return { success: true, message: `Evento "${ev.title}" actualizado` };
      }

      case 'deleteEvent': {
        const store = loadPlanner();
        const ev = store.events.find(e => e.id === args.eventIdOrTitle) ||
          store.events.find(e => e.title?.toLowerCase().includes((args.eventIdOrTitle || '').toLowerCase()));
        if (!ev) return { success: false, message: `Evento no encontrado: ${args.eventIdOrTitle}` };
        store.events = store.events.filter(e => e.id !== ev.id);
        savePlanner(store.events, store.classes);
        if (readGoal() === ev.id) writeGoal(null);
        ctx.setPlanEvents((prev: any[]) => prev.filter(p => p.id !== ev.id));
        ctx.addNotification?.(`Evento eliminado: ${ev.title}`, 'info');
        return { success: true, message: `Evento "${ev.title}" eliminado${readGoal() === ev.id ? '' : ''}` };
      }

      case 'listEvents': {
        const store = loadPlanner();
        const today = new Date().toISOString().split('T')[0];
        const from = args.fromDate || today;
        const to = args.toDate || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })();
        let evs = store.events.filter(e => e.date >= from && e.date <= to);
        if (args.query) evs = evs.filter(e => e.title?.toLowerCase().includes(String(args.query).toLowerCase()));
        evs.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
        const summary = evs.slice(0, 15).map(e =>
          `• ${e.date} ${e.allDay ? '(todo el día)' : `${e.startTime}-${e.endTime}`} — "${e.title}"${readGoal() === e.id ? ' ⭐ (meta en Inicio)' : ''}`
        ).join('\n');
        return {
          success: true,
          message: `${evs.length} evento(s) del ${from} al ${to}:\n${summary}`,
          data: evs.slice(0, 15).map(e => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime, allDay: e.allDay })),
        };
      }

      case 'pinToHome': {
        const store = loadPlanner();
        const ev = store.events.find(e => e.id === args.eventIdOrTitle) ||
          store.events.find(e => e.title?.toLowerCase().includes((args.eventIdOrTitle || '').toLowerCase()));
        if (!ev) return { success: false, message: `Evento no encontrado: ${args.eventIdOrTitle}. Crea primero el evento.` };
        writeGoal(ev.id);
        ctx.addNotification?.(`"${ev.title}" anclado como meta en Inicio`, 'success');
        return { success: true, message: `"${ev.title}" anclado como Meta planificada en Inicio ⭐` };
      }

      // ═══ HABITS ═══
      case 'createHabit': {
        ctx.addHabit(args.name);
        ctx.addNotification?.(`Hábito creado: ${args.name}`, 'success');
        return { success: true, message: `Hábito "${args.name}" creado` };
      }

      case 'completeHabit': {
        const habit = findHabit(ctx, args.habitName);
        if (!habit) return { success: false, message: `Hábito "${args.habitName}" no encontrado` };
        const today = new Date().toISOString().split('T')[0];
        if ((habit.completedOn || []).includes(today)) {
          return { success: true, message: `El hábito "${habit.name}" ya está completado hoy` };
        }
        ctx.updateHabit(habit.id, { completedOn: [...(habit.completedOn || []), today] });
        return { success: true, message: `Hábito "${habit.name}" completado hoy ✓` };
      }

      case 'uncompleteHabit': {
        const habit = findHabit(ctx, args.habitName);
        if (!habit) return { success: false, message: `Hábito "${args.habitName}" no encontrado` };
        const today = new Date().toISOString().split('T')[0];
        ctx.updateHabit(habit.id, { completedOn: ((habit.completedOn as string[]) || []).filter((d: string) => d !== today) });
        return { success: true, message: `Hábito "${habit.name}" desmarcado de hoy` };
      }

      case 'listHabits': {
        const today = new Date().toISOString().split('T')[0];
        const summary = ctx.habits.map(h => {
          const on = h.completedOn || [];
          let streak = 0;
          const d = new Date();
          for (let i = 0; i < 365; i++) {
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (on.includes(iso)) streak++; else break;
            d.setDate(d.getDate() - 1);
          }
          return `• "${h.name}" — hoy: ${on.includes(today) ? '✓' : '—'} · racha: ${streak}d`;
        }).join('\n');
        return { success: true, message: `${ctx.habits.length} hábito(s):\n${summary}`, data: ctx.habits };
      }

      case 'deleteHabit': {
        const habit = findHabit(ctx, args.habitName);
        if (!habit) return { success: false, message: `Hábito "${args.habitName}" no encontrado` };
        ctx.deleteHabit(habit.id);
        ctx.addNotification?.(`Hábito eliminado: ${habit.name}`, 'info');
        return { success: true, message: `Hábito "${habit.name}" eliminado` };
      }

      // ═══ TIMER (siempre en segundo plano) ═══
      case 'startTimer': {
        if (args.type && args.type !== ctx.sessionType) ctx.setSessionType(args.type);
        if (!ctx.isTimerActive) ctx.toggleTimer();
        ctx.addNotification?.(`Timer ${args.type || ctx.sessionType} iniciado`, 'success');
        return { success: true, message: `Timer ${args.type || ctx.sessionType} iniciado (en segundo plano)` };
      }

      case 'stopTimer': {
        if (ctx.isTimerActive || ctx.sessionTime > 0) ctx.resetTimer();
        ctx.addNotification?.('Timer detenido y reiniciado', 'info');
        return { success: true, message: 'Timer detenido y reiniciado a cero' };
      }

      case 'pauseTimer': {
        if (ctx.isTimerActive) {
          ctx.toggleTimer();
          return { success: true, message: 'Timer pausado ⏸' };
        }
        return { success: true, message: 'El timer ya está pausado' };
      }

      case 'resumeTimer': {
        if (!ctx.isTimerActive) {
          ctx.toggleTimer();
          return { success: true, message: 'Timer reanudado ▶' };
        }
        return { success: true, message: 'El timer ya está en marcha' };
      }

      case 'getTimerStatus': {
        const total = ctx.sessionType === 'pomodoro' ? (ctx.settings?.pomodoroTime || 25 * 60) : (ctx.settings?.chronoGoal || 25 * 60);
        const remaining = Math.max(0, total - ctx.sessionTime);
        const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
        return {
          success: true,
          message: `⏱ Timer: ${ctx.isTimerActive ? (ctx.isRest ? 'en descanso' : 'en marcha') : 'pausado'}\n• Tipo: ${ctx.sessionType}\n• Transcurrido: ${fmt(ctx.sessionTime)}\n• Restante: ${fmt(remaining)}\n• Descanso: ${ctx.isRest ? 'sí' : 'no'}`,
        };
      }

      case 'setTimerType': {
        ctx.setSessionType(args.type);
        return { success: true, message: `Tipo de timer: ${args.type}` };
      }

      case 'adjustTimer': {
        const seconds = Math.max(0, Math.round(Number(args.seconds) || 0));
        ctx.setSessionTime(seconds);
        return { success: true, message: `Tiempo del timer ajustado a ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` };
      }

      case 'getStudyStats': {
        const mins = Math.floor(ctx.dailyStudyTime / 60);
        return {
          success: true,
          message: `📊 Estadísticas de hoy:\n• Tiempo estudiado: ${mins} min\n• Pomodoros: ${ctx.pomodoroSessions}\n• Timer activo: ${ctx.isTimerActive ? 'sí' : 'no'}\n• Tipo: ${ctx.sessionType}`,
        };
      }

      // ═══ MUSIC ═══
      case 'playMusic': {
        if (args.trackName) {
          const q = args.trackName.toLowerCase();
          const inPlaylist = ctx.playlists.find(p => p.name?.toLowerCase().includes(q));
          if (inPlaylist && inPlaylist.trackIds?.length > 0) {
            ctx.setQueueSource({ pool: [...inPlaylist.trackIds], name: inPlaylist.name });
            ctx.playTrack(inPlaylist.trackIds[0]);
            const t = ctx.tracks.find(tr => tr.id === inPlaylist.trackIds[0]);
            return { success: true, message: `Reproduciendo playlist "${inPlaylist.name}": "${t?.title || ''}"` };
          }
          const byArtist = ctx.tracks.filter(t => t.artist?.toLowerCase().includes(q));
          if (byArtist.length > 0) {
            ctx.setQueueSource({ pool: byArtist.map(t => t.id), name: byArtist[0].artist });
            ctx.playTrack(byArtist[0].id);
            return { success: true, message: `Reproduciendo "${byArtist[0].title}" de ${byArtist[0].artist} (${byArtist.length} canciones de este artista)` };
          }
          const match = findTrack(ctx, args.trackName);
          if (match) {
            ctx.playTrack(match.id);
            return { success: true, message: `Reproduciendo: "${match.title}" — ${match.artist}` };
          }
          return { success: false, message: `No se encontró la canción "${args.trackName}". Tienes ${ctx.tracks.length} canciones en tu biblioteca.` };
        }
        if (ctx.currentTrackId && !ctx.isPlayingMusic) {
          ctx.toggleMusicPlayback();
          const t = ctx.tracks.find(tr => tr.id === ctx.currentTrackId);
          return { success: true, message: `Reproducción reanudada${t ? `: "${t.title}"` : ''}` };
        }
        if (ctx.tracks.length > 0) {
          const randomTrack = ctx.tracks[Math.floor(Math.random() * ctx.tracks.length)];
          ctx.playTrack(randomTrack.id);
          return { success: true, message: `Reproduciendo: "${randomTrack.title}" — ${randomTrack.artist}` };
        }
        return { success: false, message: 'No hay canciones en la biblioteca' };
      }

      case 'pauseMusic': {
        if (ctx.isPlayingMusic) {
          ctx.toggleMusicPlayback();
          return { success: true, message: 'Música pausada ⏸' };
        }
        return { success: true, message: 'La música ya está pausada' };
      }

      case 'nextTrack': {
        if (ctx.musicQueue.length > 0) {
          ctx.setMusicQueue(ctx.musicQueue.slice(1));
          ctx.playTrack(ctx.musicQueue[0]);
          const t = ctx.tracks.find(tr => tr.id === ctx.musicQueue[0]);
          return { success: true, message: `Siguiente: "${t?.title || 'desconocida'}"` };
        }
        const pool = ctx.queueSource?.pool ?? ctx.tracks.map(t => t.id);
        const cur = ctx.currentTrackId;
        if (cur && pool.length > 1) {
          const idx = pool.indexOf(cur);
          if (ctx.shuffleMode) {
            const rest = pool.filter(tid => tid !== cur);
            if (rest.length > 0) { const pick = rest[Math.floor(Math.random() * rest.length)]; ctx.playTrack(pick); return { success: true, message: `Siguiente (aleatorio): "${ctx.tracks.find(t => t.id === pick)?.title}"` }; }
          } else if (idx < pool.length - 1) {
            ctx.playTrack(pool[idx + 1]);
            return { success: true, message: `Siguiente: "${ctx.tracks.find(t => t.id === pool[idx + 1])?.title}"` };
          } else if (ctx.repeatMode === 'all') {
            ctx.playTrack(pool[(idx + 1) % pool.length]);
            return { success: true, message: 'Siguiente (repite lista)' };
          }
        }
        return { success: false, message: 'No hay más canciones en la cola' };
      }

      case 'previousTrack': {
        const pool = ctx.queueSource?.pool ?? ctx.tracks.map(t => t.id);
        const cur = ctx.currentTrackId;
        if (cur) {
          const idx = pool.indexOf(cur);
          if (idx > 0) {
            ctx.playTrack(pool[idx - 1]);
            return { success: true, message: `Anterior: "${ctx.tracks.find(t => t.id === pool[idx - 1])?.title}"` };
          }
          if (ctx.repeatMode !== 'none' && pool.length > 0) {
            ctx.playTrack(pool[pool.length - 1]);
            return { success: true, message: 'Anterior (vuelta al final)' };
          }
        }
        return { success: false, message: 'No hay canción anterior' };
      }

      case 'setVolume': {
        const vol = Math.max(0, Math.min(100, args.volume));
        ctx.setMusicVolume(vol / 100);
        return { success: true, message: `Volumen ajustado a ${vol}%` };
      }

      case 'searchTracks': {
        const query = (args.query || '').toLowerCase();
        const results = ctx.tracks
          .filter(t => t.title?.toLowerCase().includes(query) || t.artist?.toLowerCase().includes(query))
          .slice(0, 10);
        if (results.length === 0) return { success: true, message: `No se encontraron canciones con "${args.query}" en la biblioteca` };
        const summary = results.map(t => `• "${t.title}" — ${t.artist}`).join('\n');
        return { success: true, message: `${results.length} canción(es):\n${summary}`, data: results.map(t => ({ id: t.id, title: t.title, artist: t.artist })) };
      }

      case 'searchYouTubeMusic': {
        if (!ctx.searchYouTubeMusic) return { success: false, message: 'Búsqueda de YouTube no disponible' };
        const query = (args.query || '').trim();
        if (!query) return { success: false, message: 'Indica qué música buscar' };
        const found = await ctx.searchYouTubeMusic(query);
        if (!found || found.length === 0) return { success: true, message: `No se encontraron resultados de "${query}" en YouTube` };
        const list = found.slice(0, 5).map((r, i) => `${i + 1}. "${r.title}" — ${r.channel} (videoId: ${r.videoId})`).join('\n');
        return {
          success: true,
          message: `🎵 Resultados de YouTube para "${query}":\n${list}\n\nUsa addYouTubeTrack con el videoId para añadirla a la biblioteca.`,
          data: found,
        };
      }

      case 'addYouTubeTrack': {
        const videoId = String(args.videoId || '').trim();
        if (!videoId) return { success: false, message: 'Falta el videoId' };
        if (!ctx.searchYouTubeMusic) return { success: false, message: 'Búsqueda de YouTube no disponible' };
        const found = await ctx.searchYouTubeMusic('');
        // Buscar en el snapshot de la última búsqueda: si no, intentar con el videoId como query no sirve;
        // mejor: si el videoId ya está como pista, avisamos.
        const existing = ctx.tracks.find(t => t.url?.includes(videoId));
        if (existing) return { success: false, message: `Esa canción ya está en tu biblioteca: "${existing.title}"` };
        const results = found && found.length ? found : [];
        const match = results.find(r => r.videoId === videoId);
        if (!match) return { success: true, message: 'No se pudo resolver ese videoId (la búsqueda previa ya no está disponible). Pide de nuevo la búsqueda y luego el alta.' };
        ctx.addTrack({
          title: match.title,
          artist: match.channel || 'Artista Desconocido',
          duration: 0,
          source: 'youtube',
          url: `https://www.youtube.com/watch?v=${match.videoId}`,
          coverImage: match.thumbnail,
          isFavorite: false,
          listenedTime: 0,
        });
        ctx.addNotification?.(`Añadida de YouTube: ${match.title}`, 'success');
        return { success: true, message: `"${match.title}" añadida a tu biblioteca` };
      }

      case 'addToQueue': {
        const track = findTrack(ctx, args.trackName);
        if (!track) return { success: false, message: `Canción no encontrada: "${args.trackName}"` };
        if (!ctx.musicQueue.includes(track.id)) {
          ctx.setMusicQueue([...ctx.musicQueue, track.id]);
        }
        ctx.addNotification?.(`"${track.title}" añadida a la cola`, 'success');
        return { success: true, message: `"${track.title}" añadida a la cola (sonará al terminar la actual)` };
      }

      case 'setShuffleMode': {
        ctx.setShuffleMode(!!args.enabled);
        return { success: true, message: `Reproducción aleatoria ${args.enabled ? 'activada' : 'desactivada'}` };
      }

      case 'setRepeatMode': {
        const mode = args.mode || 'none';
        ctx.setRepeatMode(mode);
        const label = mode === 'all' ? 'repetir lista' : mode === 'one' ? 'repetir una' : 'sin repetición';
        return { success: true, message: `Modo de repetición: ${label}` };
      }

      case 'createPlaylist': {
        const names: string[] = Array.isArray(args.trackNames) ? args.trackNames : [];
        const ids: string[] = [];
        for (const n of names) {
          const t = findTrack(ctx, n);
          if (t && !ids.includes(t.id)) ids.push(t.id);
        }
        ctx.addPlaylist(args.name, ids);
        ctx.addNotification?.(`Playlist creada: ${args.name}`, 'success');
        return { success: true, message: `Playlist "${args.name}" creada con ${ids.length} canción(es)` };
      }

      case 'listPlaylists': {
        if (ctx.playlists.length === 0) return { success: true, message: 'No hay playlists todavía' };
        const summary = ctx.playlists.map(p => `• "${p.name}" — ${p.trackIds?.length || 0} canciones`).join('\n');
        return { success: true, message: `${ctx.playlists.length} playlist(s):\n${summary}`, data: ctx.playlists };
      }

      case 'deletePlaylist': {
        const p = ctx.playlists.find(x => x.name?.toLowerCase().includes((args.name || '').toLowerCase()));
        if (!p) return { success: false, message: `Playlist "${args.name}" no encontrada` };
        ctx.deletePlaylist(p.id);
        ctx.addNotification?.(`Playlist eliminada: ${p.name}`, 'info');
        return { success: true, message: `Playlist "${p.name}" eliminada` };
      }

      case 'toggleFavorite': {
        const track = findTrack(ctx, args.trackName);
        if (!track) return { success: false, message: `Canción no encontrada: "${args.trackName}"` };
        ctx.toggleTrackFavorite(track.id);
        return { success: true, message: `${track.isFavorite ? 'Quitada de' : 'Añadida a'} Favoritas: "${track.title}"` };
      }

      case 'getPlaybackState': {
        const cur = ctx.tracks.find(t => t.id === ctx.currentTrackId);
        return {
          success: true,
          message: `🎵 Reproductor:\n• Actual: ${cur ? `"${cur.title}" — ${cur.artist}` : 'ninguna'}\n• Estado: ${ctx.isPlayingMusic ? 'reproduciendo' : 'pausado'}\n• Cola: ${ctx.musicQueue.length} canción(es)\n• Shuffle: ${ctx.shuffleMode ? 'sí' : 'no'}\n• Repeat: ${ctx.repeatMode === 'none' ? 'no' : ctx.repeatMode}\n• Volumen: ${Math.round((ctx.musicVolume || 0) * 100)}%`,
        };
      }

      // ═══ NAVIGATION (solo explícita) ═══
      case 'navigateTo': {
        const viewMap: Record<string, string> = {
          inicio: 'inicio', home: 'inicio',
          estudio: 'estudio', study: 'estudio', timer: 'estudio',
          tareas: 'tareas', tasks: 'tareas',
          notas: 'apuntes', notes: 'apuntes', apuntes: 'apuntes',
          musica: 'musica', music: 'musica', música: 'musica',
          planificacion: 'flujo', planner: 'flujo', planificador: 'flujo', calendario: 'flujo',
          cursos: 'cursos', courses: 'cursos',
          ajustes: 'ajustes', settings: 'ajustes',
        };
        const target = viewMap[(args.view || '').toLowerCase()] || args.view;
        ctx.setNavigateTo(target);
        return { success: true, message: `Navegando a ${args.view}` };
      }

      // ═══ SYSTEM ═══
      case 'getAppState': {
        const today = new Date().toISOString().split('T')[0];
        const pending = ctx.tasks.filter(t => t.status !== 'completado');
        const upcoming = loadPlanner().events
          .filter(e => e.date >= today && e.date <= (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })())
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);
        const sessionsToday = ctx.plannedSessions.filter(s => s.date === today && !s.completed);
        return {
          success: true,
          message: `📋 Estado de Owa Studio:\n• Cursos: ${ctx.courses.length}\n• Tareas pendientes: ${pending.length}\n• Notas: ${ctx.notes.filter(n => !n.deletedAt).length}\n• Eventos próximos (7d): ${upcoming.length}\n• Sesiones de hoy: ${sessionsToday.length}\n• Hábitos: ${ctx.habits.length}\n• Canciones: ${ctx.tracks.length}\n• Música: ${ctx.isPlayingMusic ? 'reproduciendo' : 'detenida'}\n• Timer: ${ctx.isTimerActive ? 'en marcha' : 'pausado'} (${ctx.sessionType})\n• Meta en Inicio: ${readGoal() ? 'sí' : 'no'}`,
        };
      }

      // ═══ MUSIC — LIBRERÍA & PLAYLISTS (extendido) ═══
      case 'listTracks': {
        const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
        let list = [...ctx.tracks];
        if (args.artist) list = list.filter(t => t.artist?.toLowerCase().includes(String(args.artist).toLowerCase()));
        if (args.favorite) list = list.filter(t => t.isFavorite);
        if (list.length === 0) return { success: true, message: `No hay canciones${args.artist ? ` de "${args.artist}"` : ''} en la biblioteca` };
        const summary = list.slice(0, limit).map(t => `• "${t.title}" — ${t.artist}${t.isFavorite ? ' ❤' : ''}`).join('\n');
        return {
          success: true,
          message: `${list.length} canción(es)${args.artist ? ` de "${args.artist}"` : ''}:\n${summary}`,
          data: list.slice(0, limit).map(t => ({ id: t.id, title: t.title, artist: t.artist, isFavorite: !!t.isFavorite })),
        };
      }

      case 'deleteTrack': {
        const track = findTrack(ctx, String(args.trackName || ''));
        if (!track) return { success: false, message: `Canción no encontrada: "${args.trackName}"` };
        ctx.deleteTrack?.(track.id);
        ctx.addNotification?.(`Canción eliminada: ${track.title}`, 'info');
        return { success: true, message: `"${track.title}" eliminada de la biblioteca` };
      }

      case 'addToPlaylist': {
        const p = ctx.playlists.find(x => x.name?.toLowerCase().includes(String(args.playlistName || '').toLowerCase()));
        if (!p) return { success: false, message: `Playlist "${args.playlistName}" no encontrada` };
        const track = findTrack(ctx, String(args.trackName || ''));
        if (!track) return { success: false, message: `Canción no encontrada: "${args.trackName}"` };
        if ((p.trackIds || []).includes(track.id)) return { success: true, message: `"${track.title}" ya está en "${p.name}"` };
        ctx.updatePlaylist(p.id, { trackIds: [...(p.trackIds || []), track.id] });
        ctx.addNotification?.(`"${track.title}" añadida a "${p.name}"`, 'success');
        return { success: true, message: `"${track.title}" añadida a la playlist "${p.name}"` };
      }

      case 'removeFromPlaylist': {
        const p = ctx.playlists.find(x => x.name?.toLowerCase().includes(String(args.playlistName || '').toLowerCase()));
        if (!p) return { success: false, message: `Playlist "${args.playlistName}" no encontrada` };
        const track = findTrack(ctx, String(args.trackName || ''));
        if (!track) return { success: false, message: `Canción no encontrada: "${args.trackName}"` };
        ctx.updatePlaylist(p.id, { trackIds: (p.trackIds || []).filter((id: string) => id !== track.id) });
        ctx.addNotification?.(`"${track.title}" quitada de "${p.name}"`, 'info');
        return { success: true, message: `"${track.title}" quitada de "${p.name}"` };
      }

      case 'renamePlaylist': {
        const p = ctx.playlists.find(x => x.name?.toLowerCase().includes(String(args.name || '').toLowerCase()));
        if (!p) return { success: false, message: `Playlist "${args.name}" no encontrada` };
        const newName = String(args.newName || '').trim();
        if (!newName) return { success: false, message: 'El nuevo nombre es obligatorio' };
        ctx.updatePlaylist(p.id, { name: newName });
        ctx.addNotification?.(`Playlist renombrada a "${newName}"`, 'success');
        return { success: true, message: `Playlist renombrada: "${p.name}" → "${newName}"` };
      }

      case 'clearQueue': {
        if (ctx.musicQueue.length === 0) return { success: true, message: 'La cola ya está vacía' };
        const n = ctx.musicQueue.length;
        ctx.setMusicQueue([]);
        return { success: true, message: `Cola vaciada (${n} canción(es) eliminadas de la cola)` };
      }

      // ═══ NOTES — PAPELERA ═══
      case 'listDeletedNotes': {
        const deleted = ctx.notes.filter(n => n.deletedAt);
        if (deleted.length === 0) return { success: true, message: 'La papelera está vacía' };
        const summary = deleted.slice(0, 15).map(n => `• "${n.title || '(sin título)'}" — ${n.course}`).join('\n');
        return { success: true, message: `${deleted.length} nota(s) en la papelera:\n${summary}`, data: deleted.slice(0, 15).map(n => ({ id: n.id, title: n.title })) };
      }

      case 'restoreNote': {
        const note = ctx.notes.find(n => n.id === String(args.noteIdOrTitle)) ||
          ctx.notes.find(n => n.title?.toLowerCase().includes(String(args.noteIdOrTitle || '').toLowerCase()));
        if (!note) return { success: false, message: `Nota no encontrada: ${args.noteIdOrTitle}` };
        if (!note.deletedAt) return { success: true, message: `La nota "${note.title || 'Sin título'}" no está en la papelera` };
        ctx.restoreNote?.(note.id);
        ctx.addNotification?.(`Nota restaurada: ${note.title || 'Sin título'}`, 'success');
        return { success: true, message: `Nota "${note.title || 'Sin título'}" restaurada` };
      }

      case 'permanentlyDeleteNote': {
        const note = ctx.notes.find(n => n.id === String(args.noteIdOrTitle)) ||
          ctx.notes.find(n => n.title?.toLowerCase().includes(String(args.noteIdOrTitle || '').toLowerCase()));
        if (!note) return { success: false, message: `Nota no encontrada: ${args.noteIdOrTitle}` };
        ctx.permanentlyDeleteNote?.(note.id);
        ctx.addNotification?.(`Nota eliminada definitivamente: ${note.title || 'Sin título'}`, 'info');
        return { success: true, message: `Nota "${note.title || 'Sin título'}" eliminada definitivamente` };
      }

      // ═══ COURSES — CONTENIDO ═══
      case 'getCourseDetails': {
        const course = findCourse(ctx, String(args.courseName || ''));
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const topics = course.studyTopics || [];
        const groups = course.groups || [];
        const tasks = ctx.tasks.filter(t => t.course?.toLowerCase() === course.name.toLowerCase());
        const matCount = topics.reduce((acc: number, t: any) => acc + (t.materials?.length || 0), 0);
        const mastered = topics.filter((t: any) => (t.reviewLevel || 0) >= 8).length;
        const inProgress = topics.filter((t: any) => (t.reviewLevel || 0) >= 1 && (t.reviewLevel || 0) < 8).length;
        const lines = [
          `📚 "${course.name}"`,
          `• Temas: ${topics.length} (${mastered} dominados, ${inProgress} en estudio)`,
          `• Agrupaciones: ${groups.map((g: any) => g.name).join(', ') || 'ninguna'}`,
          `• Materiales: ${matCount}`,
          `• Tareas: ${tasks.length} (${tasks.filter(t => t.status === 'completado').length} completadas)`,
        ];
        topics.slice(0, 12).forEach((t: any) => {
          lines.push(`   — ${t.title}: ${t.reviewLevel || 0}/10 dominio${(t.materials?.length || 0) > 0 ? `, ${t.materials.length} materiales` : ''}`);
        });
        return { success: true, message: lines.join('\n'), data: { course: { id: course.id, name: course.name, color: course.color }, topics, groups, tasks: tasks.slice(0, 10) } };
      }

      case 'createGroup': {
        const course = findCourse(ctx, String(args.courseName || ''));
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const name = String(args.groupName || '').trim();
        if (!name) return { success: false, message: 'El nombre de la agrupación es obligatorio' };
        ctx.updateCourse(course.id, { groups: [...(course.groups || []), { id: Math.random().toString(), name }] });
        ctx.addNotification?.(`Agrupación creada: ${name}`, 'success');
        return { success: true, message: `Agrupación "${name}" creada en "${course.name}"` };
      }

      case 'deleteTopic': {
        const course = findCourse(ctx, String(args.courseName || ''));
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const q = String(args.topicTitle || '').toLowerCase();
        const topic = (course.studyTopics || []).find((t: any) => t.title?.toLowerCase().includes(q));
        if (!topic) return { success: false, message: `Tema "${args.topicTitle}" no encontrado en "${course.name}"` };
        ctx.updateCourse(course.id, { studyTopics: (course.studyTopics || []).filter((t: any) => t.id !== topic.id) });
        ctx.addNotification?.(`Tema eliminado: ${topic.title}`, 'info');
        return { success: true, message: `Tema "${topic.title}" eliminado de "${course.name}"` };
      }

      case 'addMaterial': {
        const course = findCourse(ctx, String(args.courseName || ''));
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const q = String(args.topicTitle || '').toLowerCase();
        const topic = (course.studyTopics || []).find((t: any) => t.title?.toLowerCase().includes(q));
        if (!topic) return { success: false, message: `Tema "${args.topicTitle}" no encontrado en "${course.name}"` };
        const name = String(args.name || '').trim();
        if (!name) return { success: false, message: 'El nombre del material es obligatorio' };
        const newMat: any = { id: Math.random().toString(), type: 'resource', createdAt: Date.now(), columnIndex: 0, name };
        if (args.dataUrl) newMat.dataUrl = String(args.dataUrl);
        ctx.updateCourse(course.id, { studyTopics: (course.studyTopics || []).map((t: any) => t.id === topic.id ? { ...t, materials: [...(t.materials || []), newMat] } : t) });
        ctx.addNotification?.(`Material añadido: ${name}`, 'success');
        return { success: true, message: `Material "${name}" añadido a "${topic.title}" en "${course.name}"` };
      }

      case 'listMaterials': {
        const course = findCourse(ctx, String(args.courseName || ''));
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        const topics = (course.studyTopics || []).filter((t: any) => (t.materials || []).length > 0);
        if (topics.length === 0) return { success: true, message: `"${course.name}" no tiene materiales todavía` };
        const lines: string[] = [];
        topics.forEach((t: any) => {
          const ms = (t.materials || []).slice(0, 8).map((m: any) => m.name || m.title || 'Material').join(', ');
          lines.push(`• ${t.title}: ${ms}${(t.materials?.length || 0) > 8 ? '…' : ''}`);
        });
        return { success: true, message: `Materiales de "${course.name}":\n${lines.join('\n')}`, data: topics.map((t: any) => ({ topic: t.title, materials: t.materials })) };
      }

      // ═══ PLANNER — AGENDA ═══
      case 'getTodayAgenda': {
        const today = new Date().toISOString().split('T')[0];
        const store = loadPlanner();
        const events = store.events.filter(e => e.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const sessions = ctx.plannedSessions.filter(s => s.date === today && !s.completed);
        const tasksToday = ctx.tasks.filter(t => t.status !== 'completado' && t.dueDate === today);
        const habits = ctx.habits;
        const habitsDone = habits.filter(h => (h.completedOn || []).includes(today)).length;
        const lines = [`📅 Agenda de hoy (${today}):`];
        if (events.length === 0 && sessions.length === 0 && tasksToday.length === 0) lines.push('Sin eventos, sesiones ni tareas para hoy.');
        if (events.length > 0) {
          lines.push('\n📌 Eventos:');
          events.forEach(e => lines.push(`  ${e.allDay ? 'Todo el día' : `${e.startTime}–${e.endTime}`} — ${e.title}${readGoal() === e.id ? ' ⭐' : ''}`));
        }
        if (sessions.length > 0) {
          lines.push('\n⏳ Sesiones de estudio:');
          sessions.forEach(s => lines.push(`  ${s.startTime || '—'} · ${s.title} (${s.durationMinutes} min)`));
        }
        if (tasksToday.length > 0) {
          lines.push('\n✅ Tareas con entrega hoy:');
          tasksToday.forEach(t => lines.push(`  ${t.priority === 'high' ? '⚠' : '·'} ${t.title}`));
        }
        lines.push(`\n🔥 Hábitos: ${habitsDone}/${habits.length} completados hoy`);
        lines.push(`⏱ Estudiado hoy: ${Math.floor(ctx.dailyStudyTime / 60)} min`);
        return { success: true, message: lines.join('\n'), data: { events, sessions, tasksToday, habitsDone } };
      }

      case 'getPlannerOverview': {
        const store = loadPlanner();
        const today = new Date().toISOString().split('T')[0];
        const from = String(args.from || today);
        const to = String(args.to || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })());
        const events = store.events.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
        const sessions = ctx.plannedSessions.filter(s => s.date >= from && s.date <= to);
        const lines = [
          `📅 Planificador del ${from} al ${to}:`,
          `• Eventos: ${events.length}`,
          `• Sesiones de estudio: ${sessions.length} (${sessions.filter(s => s.completed).length} completadas)`,
        ];
        events.slice(0, 12).forEach(e => lines.push(`  ${e.date} — ${e.title}${readGoal() === e.id ? ' ⭐' : ''}`));
        return { success: true, message: lines.join('\n'), data: { events: events.slice(0, 20), sessions } };
      }

      // ═══ SYSTEM ═══
      case 'getSettings': {
        const s = ctx.settings || {};
        const fmt = (sec: number) => `${Math.floor(sec / 60)} min`;
        return {
          success: true,
          message: `⚙️ Configuración actual:\n• Tema: ${s.theme || 'oscuro'}\n• Pomodoro: ${fmt(s.pomodoroTime || 25 * 60)}\n• Descanso corto: ${fmt(s.shortBreakTime || 5 * 60)}\n• Descanso largo: ${fmt(s.longBreakTime || 15 * 60)}\n• Objetivo cronómetro: ${fmt(s.chronoGoal || 25 * 60)}\n• Enfoque diario: ${s.dailyStudyGoal ? fmt(s.dailyStudyGoal) : '—'}\n• Racha diaria: ${s.dailyStreakGoal ? `${s.dailyStreakGoal} días` : '—'}`,
        };
      }

      default:
        return { success: false, message: `Herramienta desconocida: ${toolName}` };
    }
  } catch (err) {
    return { success: false, message: `Error ejecutando ${toolName}: ${err instanceof Error ? err.message : String(err)}` };
  }
}
