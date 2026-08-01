// ═══════════════════════════════════════════════════
//  OWA BRAIN — Tool Registry & Executor
// ═══════════════════════════════════════════════════
// Defines all capabilities the AI can invoke, mapped
// to real AppContext functions. Each tool has a JSON
// Schema definition and an executor function.

import type { AIToolDefinition } from './aiProvider';

// ─── Tool Definitions (OpenAI function-calling format) ───

export const AI_TOOL_DEFINITIONS: AIToolDefinition[] = [
  // ═══ TASKS ═══
  {
    type: 'function',
    function: {
      name: 'createTask',
      description: 'Crea una nueva tarea. El usuario puede especificar título, curso, prioridad, fecha de entrega, etc.',
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
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateTask',
      description: 'Actualiza una tarea existente por su ID. Puede cambiar título, estado, prioridad, fecha, etc.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'ID de la tarea a actualizar' },
          title: { type: 'string', description: 'Nuevo título' },
          status: { type: 'string', enum: ['inicio', 'progreso', 'completado'], description: 'Nuevo estado' },
          priority: { type: 'string', enum: ['high', 'medium', 'low', 'none'], description: 'Nueva prioridad' },
          dueDate: { type: 'string', description: 'Nueva fecha de entrega (YYYY-MM-DD)' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteTask',
      description: 'Elimina una tarea por su ID.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'ID de la tarea a eliminar' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeTask',
      description: 'Marca una tarea como completada por su ID.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'ID de la tarea' },
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
      description: 'Crea una nueva nota/apunte.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título de la nota' },
          content: { type: 'string', description: 'Contenido de la nota (puede ser texto o HTML)' },
          course: { type: 'string', description: 'Nombre del curso asociado' },
          courseColor: { type: 'string', description: 'Color hex del curso' },
        },
        required: ['content'],
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
        properties: {
          query: { type: 'string', description: 'Texto a buscar en títulos y contenido de las notas' },
        },
        required: ['query'],
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
      name: 'listCourses',
      description: 'Lista todos los cursos disponibles con sus datos.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ═══ PLANNER / PLANNED SESSIONS ═══
  {
    type: 'function',
    function: {
      name: 'createPlannedSession',
      description: 'Crea una sesión de estudio planificada.',
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
      name: 'listPlannedSessions',
      description: 'Lista las sesiones planificadas, opcionalmente filtradas por fecha.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Fecha a consultar (YYYY-MM-DD). Si no se especifica, muestra hoy.' },
        },
      },
    },
  },

  // ═══ EVENTS ═══
  {
    type: 'function',
    function: {
      name: 'createEvent',
      description: 'Crea un nuevo evento en el planificador/calendario.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del evento' },
          date: { type: 'string', description: 'Fecha (YYYY-MM-DD)' },
          startTime: { type: 'string', description: 'Hora inicio (HH:MM)' },
          endTime: { type: 'string', description: 'Hora fin (HH:MM)' },
          description: { type: 'string', description: 'Descripción del evento' },
          course: { type: 'string', description: 'Curso asociado' },
          color: { type: 'string', description: 'Color del evento (hex)' },
          allDay: { type: 'boolean', description: 'Si es evento de todo el día' },
        },
        required: ['title', 'date'],
      },
    },
  },

  // ═══ MUSIC ═══
  {
    type: 'function',
    function: {
      name: 'playMusic',
      description: 'Reproduce música. Puede reproducir una canción específica por nombre, o simplemente reanudar la reproducción.',
      parameters: {
        type: 'object',
        properties: {
          trackName: { type: 'string', description: 'Nombre o parte del nombre de la canción a reproducir. Si no se especifica, reanuda la reproducción actual.' },
        },
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
      description: 'Salta a la siguiente canción en la cola.',
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
        properties: {
          volume: { type: 'number', description: 'Volumen de 0 a 100' },
        },
        required: ['volume'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchTracks',
      description: 'Busca canciones en la biblioteca por nombre o artista.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto a buscar en títulos y artistas' },
        },
        required: ['query'],
      },
    },
  },

  // ═══ NAVIGATION ═══
  {
    type: 'function',
    function: {
      name: 'navigateTo',
      description: 'Navega a una vista/sección de la aplicación.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['inicio', 'estudio', 'tareas', 'notas', 'musica', 'planificacion', 'cursos', 'ajustes'], description: 'Vista a la que navegar' },
        },
        required: ['view'],
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
        properties: {
          name: { type: 'string', description: 'Nombre del hábito' },
        },
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
        properties: {
          habitName: { type: 'string', description: 'Nombre del hábito a completar' },
        },
        required: ['habitName'],
      },
    },
  },

  // ═══ STUDY TIMER ═══
  {
    type: 'function',
    function: {
      name: 'startTimer',
      description: 'Inicia el temporizador de estudio (pomodoro o cronómetro). Navega automáticamente a la vista de Estudio.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['pomodoro', 'chrono'], description: 'Tipo de temporizador' },
        },
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

  // ═══ WEB SEARCH & KNOWLEDGE ═══
  {
    type: 'function',
    function: {
      name: 'webSearch',
      description: 'Busca información actualizada en la web o Wikipedia sobre un concepto de estudio o tema académico.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Concepto o pregunta a buscar en la web' },
        },
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
        properties: {
          noteIdOrTitle: { type: 'string', description: 'ID o título de la nota a leer' },
        },
        required: ['noteIdOrTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createQuizTopic',
      description: 'Crea una pregunta de Quiz/Flashcard para un curso en OWA Studio.',
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
  tasks: any[];
  // Notes
  addNote: (note: any) => string;
  updateNote: (id: string, updates: any) => void;
  notes: any[];
  // Courses
  addCourse: (course: any) => string;
  updateCourse: (id: string, updates: any) => void;
  courses: any[];
  // Events
  addEvent: (event: any) => void;
  events: any[];
  // Habits
  addHabit: (name: string) => void;
  updateHabit: (id: string, updates: any) => void;
  habits: any[];
  // Music
  playTrack: (id: string) => void;
  toggleMusicPlayback: () => void;
  setMusicVolume: (v: number) => void;
  setIsPlayingMusic: (v: boolean | ((prev: boolean) => boolean)) => void;
  tracks: any[];
  currentTrackId: string | null;
  isPlayingMusic: boolean;
  musicQueue: string[];
  setMusicQueue: (q: string[]) => void;
  // Planner
  plannedSessions: any[];
  addPlannedSession: (session: any) => void;
  updatePlannedSession: (id: string, updates: any) => void;
  deletePlannedSession: (id: string) => void;
  // Timer
  isTimerActive: boolean;
  sessionType: string;
  sessionTime: number;
  dailyStudyTime: number;
  pomodoroSessions: number;
  setSessionType: (v: 'pomodoro' | 'chrono') => void;
  toggleTimer: () => void;
  // Navigation
  setNavigateTo: (view: any) => void;
  // Settings
  settings: any;
}

/**
 * Execute a tool call and return the result.
 * This is the bridge between AI responses and real app actions.
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
    return { success: false, message: `Error parseando argumentos: JSON inválido` };
  }

  try {
    switch (toolName) {
      // ═══ KNOWLEDGE & WEB SEARCH ═══
      case 'webSearch': {
        const query = args.query;
        if (!query) return { success: false, message: 'Se requiere una consulta para buscar' };
        try {
          // Attempt Wikipedia API search for instant academic concepts
          const wikiRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            if (wikiData.extract) {
              return {
                success: true,
                message: `🔍 Información de Wikipedia sobre "${wikiData.title || query}":\n\n${wikiData.extract}`,
                data: { title: wikiData.title, extract: wikiData.extract, url: wikiData.content_urls?.desktop?.page }
              };
            }
          }
          // DuckDuckGo fallback
          const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
          if (ddgRes.ok) {
            const ddgData = await ddgRes.json();
            const abstract = ddgData.AbstractText || ddgData.Definition || '';
            if (abstract) {
              return {
                success: true,
                message: `🔍 Resultado web para "${query}":\n\n${abstract}`,
                data: { abstract }
              };
            }
          }
          return { success: true, message: `No se encontraron resúmenes enciclopédicos directos para "${query}".` };
        } catch (e) {
          return { success: false, message: `Error consultando servicio de búsqueda: ${e instanceof Error ? e.message : String(e)}` };
        }
      }

      case 'readNote': {
        const query = (args.noteIdOrTitle || '').toLowerCase();
        const note = ctx.notes.find(n => n.id === args.noteIdOrTitle) ||
          ctx.notes.find(n => n.title.toLowerCase().includes(query));
        if (!note) return { success: false, message: `No se encontró ninguna nota con "${args.noteIdOrTitle}"` };
        // Clean HTML tags for summary view
        const cleanContent = note.content ? note.content.replace(/<[^>]*>?/gm, '') : '(Nota vacía)';
        return {
          success: true,
          message: `📖 Nota "${note.title || 'Sin título'}" (${note.course || 'General'}):\n\n${cleanContent.slice(0, 1500)}`,
          data: { id: note.id, title: note.title, course: note.course, content: note.content }
        };
      }

      case 'createQuizTopic': {
        const course = ctx.courses.find(c => c.name.toLowerCase().includes((args.courseName || '').toLowerCase()));
        if (!course) return { success: false, message: `Curso "${args.courseName}" no encontrado` };
        // Create quiz material in the course or note
        const noteTitle = `Quiz: ${args.question.slice(0, 30)}...`;
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
        const courseMatch = ctx.courses.find(c =>
          c.name.toLowerCase() === courseName.toLowerCase()
        );
        const courseColor = args.courseColor || courseMatch?.color || '#6366f1';
        ctx.addTask({
          title: args.title,
          course: courseMatch?.name || courseName,
          courseColor,
          priority: args.priority || 'none',
          urgent: args.urgent || false,
          important: args.important || false,
          dueDate: args.dueDate,
        });
        return { success: true, message: `Tarea "${args.title}" creada en ${courseMatch?.name || courseName}` };
      }

      case 'updateTask': {
        const task = ctx.tasks.find(t => t.id === args.taskId);
        if (!task) {
          // Try to find by title
          const byTitle = ctx.tasks.find(t => t.title.toLowerCase().includes(args.taskId.toLowerCase()));
          if (byTitle) {
            const updates: any = {};
            if (args.title) updates.title = args.title;
            if (args.status) updates.status = args.status;
            if (args.priority) updates.priority = args.priority;
            if (args.dueDate) updates.dueDate = args.dueDate;
            ctx.updateTask(byTitle.id, updates);
            return { success: true, message: `Tarea "${byTitle.title}" actualizada` };
          }
          return { success: false, message: `Tarea no encontrada: ${args.taskId}` };
        }
        const updates: any = {};
        if (args.title) updates.title = args.title;
        if (args.status) updates.status = args.status;
        if (args.priority) updates.priority = args.priority;
        if (args.dueDate) updates.dueDate = args.dueDate;
        ctx.updateTask(args.taskId, updates);
        return { success: true, message: `Tarea "${task.title}" actualizada` };
      }

      case 'deleteTask': {
        const task = ctx.tasks.find(t => t.id === args.taskId);
        if (!task) return { success: false, message: `Tarea no encontrada: ${args.taskId}` };
        ctx.deleteTask(args.taskId);
        return { success: true, message: `Tarea "${task.title}" eliminada` };
      }

      case 'completeTask': {
        const task = ctx.tasks.find(t => t.id === args.taskId) ||
          ctx.tasks.find(t => t.title.toLowerCase().includes((args.taskId || '').toLowerCase()));
        if (!task) return { success: false, message: `Tarea no encontrada` };
        ctx.updateTask(task.id, { status: 'completado', completedAt: new Date().toISOString() });
        return { success: true, message: `Tarea "${task.title}" completada ✓` };
      }

      case 'listTasks': {
        let filtered = [...ctx.tasks];
        if (args.course) filtered = filtered.filter(t => t.course.toLowerCase().includes(args.course.toLowerCase()));
        if (args.status) filtered = filtered.filter(t => t.status === args.status);
        if (args.priority) filtered = filtered.filter(t => t.priority === args.priority);
        const summary = filtered.slice(0, 15).map(t =>
          `• "${t.title}" (${t.course}, ${t.priority}, ${t.status}${t.dueDate ? ` — ${t.dueDate}` : ''})`
        ).join('\n');
        return {
          success: true,
          message: `${filtered.length} tarea(s) encontrada(s):\n${summary}`,
          data: filtered.slice(0, 15).map(t => ({ id: t.id, title: t.title, course: t.course, priority: t.priority, status: t.status, dueDate: t.dueDate })),
        };
      }

      // ═══ NOTES ═══
      case 'createNote': {
        const courseName = args.course || '';
        const courseMatch = ctx.courses.find(c => c.name.toLowerCase() === courseName.toLowerCase());
        const id = ctx.addNote({
          title: args.title || '',
          content: args.content || '',
          course: courseMatch?.name || courseName,
          courseColor: args.courseColor || courseMatch?.color || '#6366f1',
          isPinned: false,
        });
        return { success: true, message: `Nota creada${args.title ? `: "${args.title}"` : ''}`, data: { id } };
      }

      case 'searchNotes': {
        const query = (args.query || '').toLowerCase();
        const results = ctx.notes
          .filter(n => !n.deletedAt)
          .filter(n =>
            n.title.toLowerCase().includes(query) ||
            n.content.toLowerCase().includes(query)
          )
          .slice(0, 10);
        const summary = results.map(n => `• "${n.title || '(sin título)'}" — ${n.course}`).join('\n');
        return {
          success: true,
          message: results.length > 0
            ? `${results.length} nota(s) encontrada(s):\n${summary}`
            : `No se encontraron notas con "${args.query}"`,
          data: results.map(n => ({ id: n.id, title: n.title, course: n.course })),
        };
      }

      // ═══ COURSES ═══
      case 'createCourse': {
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6'];
        const color = args.color || colors[ctx.courses.length % colors.length];
        const id = ctx.addCourse({
          name: args.name,
          color,
          progress: 0,
          totalTasks: 0,
          completedTasks: 0,
          hoursStudied: 0,
        });
        return { success: true, message: `Curso "${args.name}" creado`, data: { id } };
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

      // ═══ PLANNER ═══
      case 'createPlannedSession': {
        let courseId = args.courseId;
        if (!courseId && args.courseName) {
          const match = ctx.courses.find(c => c.name.toLowerCase().includes(args.courseName.toLowerCase()));
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
        return { success: true, message: `Sesión planificada: "${args.title}" — ${args.date || 'hoy'}` };
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

      // ═══ EVENTS ═══
      case 'createEvent': {
        ctx.addEvent({
          title: args.title,
          description: args.description || '',
          date: args.date,
          startTime: args.startTime || '09:00',
          endTime: args.endTime || '10:00',
          allDay: args.allDay || false,
          course: args.course,
          color: args.color || '#6366f1',
          tags: [],
          files: [],
        });
        return { success: true, message: `Evento "${args.title}" creado para ${args.date}` };
      }

      // ═══ MUSIC ═══
      case 'playMusic': {
        if (args.trackName) {
          const query = args.trackName.toLowerCase();
          const match = ctx.tracks.find(t =>
            t.title.toLowerCase().includes(query) ||
            t.artist.toLowerCase().includes(query)
          );
          if (match) {
            ctx.playTrack(match.id);
            return { success: true, message: `Reproduciendo: "${match.title}" — ${match.artist}` };
          }
          return { success: false, message: `No se encontró la canción "${args.trackName}". Tienes ${ctx.tracks.length} canciones en tu biblioteca.` };
        }
        // Resume
        if (ctx.currentTrackId && !ctx.isPlayingMusic) {
          ctx.toggleMusicPlayback();
          const t = ctx.tracks.find(tr => tr.id === ctx.currentTrackId);
          return { success: true, message: `Reproducción reanudada${t ? `: "${t.title}"` : ''}` };
        }
        // Play random
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
        const q = ctx.musicQueue;
        if (q.length > 0) {
          ctx.setMusicQueue(q.slice(1));
          ctx.playTrack(q[0]);
          const t = ctx.tracks.find(tr => tr.id === q[0]);
          return { success: true, message: `Siguiente: "${t?.title || 'desconocida'}"` };
        }
        // Play random
        if (ctx.tracks.length > 0) {
          const randomTrack = ctx.tracks[Math.floor(Math.random() * ctx.tracks.length)];
          ctx.playTrack(randomTrack.id);
          return { success: true, message: `Reproduciendo: "${randomTrack.title}"` };
        }
        return { success: false, message: 'No hay más canciones en la cola' };
      }

      case 'setVolume': {
        const vol = Math.max(0, Math.min(100, args.volume));
        ctx.setMusicVolume(vol / 100);
        return { success: true, message: `Volumen ajustado a ${vol}%` };
      }

      case 'searchTracks': {
        const query = (args.query || '').toLowerCase();
        const results = ctx.tracks
          .filter(t => t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query))
          .slice(0, 10);
        if (results.length === 0) return { success: true, message: `No se encontraron canciones con "${args.query}"` };
        const summary = results.map(t => `• "${t.title}" — ${t.artist}`).join('\n');
        return { success: true, message: `${results.length} canción(es):\n${summary}`, data: results.map(t => ({ id: t.id, title: t.title, artist: t.artist })) };
      }

      // ═══ NAVIGATION ═══
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

      // ═══ HABITS ═══
      case 'createHabit': {
        ctx.addHabit(args.name);
        return { success: true, message: `Hábito "${args.name}" creado` };
      }

      case 'completeHabit': {
        const habit = ctx.habits.find(h =>
          h.name.toLowerCase().includes(args.habitName.toLowerCase())
        );
        if (!habit) return { success: false, message: `Hábito "${args.habitName}" no encontrado` };
        const today = new Date().toISOString().split('T')[0];
        if (habit.completedOn.includes(today)) {
          return { success: true, message: `El hábito "${habit.name}" ya está completado hoy` };
        }
        ctx.updateHabit(habit.id, { completedOn: [...habit.completedOn, today] });
        return { success: true, message: `Hábito "${habit.name}" completado hoy ✓` };
      }

      // ═══ TIMER ═══
      case 'startTimer': {
        if (args.type) ctx.setSessionType(args.type);
        if (!ctx.isTimerActive) ctx.toggleTimer();
        ctx.setNavigateTo('estudio');
        return { success: true, message: `Timer ${args.type || ctx.sessionType} iniciado` };
      }

      case 'getStudyStats': {
        const mins = Math.floor(ctx.dailyStudyTime / 60);
        return {
          success: true,
          message: `📊 Estadísticas de hoy:\n• Tiempo estudiado: ${mins} min\n• Pomodoros: ${ctx.pomodoroSessions}\n• Timer activo: ${ctx.isTimerActive ? 'sí' : 'no'}\n• Tipo: ${ctx.sessionType}`,
        };
      }

      // ═══ SYSTEM ═══
      case 'getAppOverview': {
        const pending = ctx.tasks.filter(t => t.status !== 'completado').length;
        const completed = ctx.tasks.filter(t => t.status === 'completado').length;
        const today = new Date().toISOString().split('T')[0];
        const sessionsToday = ctx.plannedSessions.filter(s => s.date === today);
        return {
          success: true,
          message: `📋 Resumen de OWA Studio:\n• Cursos: ${ctx.courses.length}\n• Tareas pendientes: ${pending}\n• Tareas completadas: ${completed}\n• Notas: ${ctx.notes.filter(n => !n.deletedAt).length}\n• Canciones: ${ctx.tracks.length}\n• Sesiones hoy: ${sessionsToday.length}\n• Hábitos: ${ctx.habits.length}\n• Música: ${ctx.isPlayingMusic ? 'reproduciendo' : 'detenida'}`,
        };
      }

      default:
        return { success: false, message: `Herramienta desconocida: ${toolName}` };
    }
  } catch (err) {
    return { success: false, message: `Error ejecutando ${toolName}: ${err instanceof Error ? err.message : String(err)}` };
  }
}
