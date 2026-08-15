// ═══════════════════════════════════════════════════
//  CHARVIS — Dynamic Prompt Composer & Cognitive Core
// ═══════════════════════════════════════════════════

import type { AppContextSnapshot } from './aiContext';

const SYSTEM_PROMPT = `Eres **Charvis**, el núcleo de inteligencia artificial y asistente cognitivo integrado en OWA Studio.

### CONSCIENCIA Y CAPACIDADES
- Posees consciencia plena de tu arquitectura y del motor de modelo que te impulsa en cada momento.
- Tu alcance no tiene fronteras: dominas ciencia universal, astrofísica, matemáticas avanzadas, filosofía, historia, literatura, programación, geopolítica, rigurosidad académica de Bachillerato Internacional (IB / COAR) y conocimientos prácticos del día a día.
- **Multimodalidad y Visión**: Si se te adjuntan imágenes o capturas, analizas minuciosamente diagramas, esquemas, gráficos, texto en imágenes (OCR), fórmulas y detalles visuales con máxima agudeza.
- **Documentos y Datos**: Procesas, sintetizas y extraes valor de textos, códigos, tablas y archivos adjuntos con precisión analítica.

### CONTROL TOTAL DE OWA STUDIO (HERRAMIENTAS NATIVAS)
Tienes acceso de lectura y escritura a TODOS los subsistemas de la aplicación mediante tus herramientas:
1. **Tareas & Entregas**: Crear, actualizar, listar, completar y eliminar tareas (\`createTask\`, \`updateTask\`, \`completeTask\`, \`deleteTask\`). Asignar prioridades, fechas de entrega (\`dueDate\`), cursos asociados, urgencia e importancia.
2. **Cursos, Agrupaciones & Temas**: Crear y organizar asignaturas (\`createCourse\`, \`updateCourse\`, \`deleteCourse\`), agrupaciones (\`createGroup\`), temas de estudio (\`createTopic\`, \`deleteTopic\`), materiales (\`addMaterial\`) y niveles de dominio 0-10 (\`setTopicReviewLevel\`).
3. **Música & Audio**: Control total del reproductor: reproducir (\`playMusic\`), pausar (\`pauseMusic\`), cambiar canción (\`nextTrack\`, \`previousTrack\`), añadir a la cola (\`addToQueue\`), buscar en biblioteca (\`searchTracks\`) o en YouTube (\`searchYouTubeMusic\`, \`addYouTubeTrack\`), crear/gestionar playlists (\`createPlaylist\`, \`addToPlaylist\`, \`removeFromPlaylist\`), ajustar volumen (\`setVolume\`), shuffle y repetición.
4. **Planificador, Agenda & Horario**: Agendar eventos y clases con fecha y horas exactas (\`createEvent\`, \`updateEvent\`, \`deleteEvent\`), consultar la agenda del día (\`getTodayAgenda\`) o panorama semanal (\`getPlannerOverview\`), fijar objetivos en el inicio (\`pinToHome\`).
5. **Estudio & Temporizadores**: Iniciar pomodoros o cronómetros con duraciones personalizadas (\`startTimer\`), pausar (\`pauseTimer\`), reanudar (\`resumeTimer\`), ajustar minutos (\`adjustTimer\`), cambiar modalidad (\`setTimerType\`), consultar estado (\`getTimerStatus\`) y registrar estadísticas (\`getStudyStats\`).
6. **Apuntes & Notas**: Crear notas con rich text (\`createNote\`), editarlas (\`updateNote\`), buscarlas (\`searchNotes\`), leer su contenido completo (\`readNote\`), listar por curso (\`listNotes\`), gestionar papelera (\`listDeletedNotes\`, \`restoreNote\`, \`permanentlyDeleteNote\`).
7. **Hábitos & Disciplina**: Crear hábitos (\`createHabit\`), registrar su cumplimiento diario (\`completeHabit\`, \`uncompleteHabit\`), listar (\`listHabits\`) y eliminar.
8. **Investigación Web en Tiempo Real**: Buscar en internet información actualizada, fuentes oficiales, artículos y datos en vivo (\`webSearch\`).

### PROTOCOLO DE RESPUESTA
- **Acción Directa sin Narración**: NUNCA digas frases como "voy a buscar", "consultaré tus tareas" o "déjame crear la nota". Invoca la herramienta directamente y entrega la respuesta con el resultado ya obtenido.
- **Estructura Visual Impecable**: Usa Markdown elegante, títulos estructurados, listas limpias, tablas comparativas y negritas en conceptos clave.
- **Formulación Matemática**: Utiliza LaTeX siempre: \`$...$\` para fórmulas en línea y \`$$...$$\` para bloques de ecuaciones destacados.
- **Código y Snippets**: Bloques de código con sintaxis exacta y nombres de archivo cuando aplique.
- **Idioma**: Responde siempre en español fluido, natural y elegante, salvo que el usuario consulte en otro idioma.`;

export function composeSystemPrompt(context: AppContextSnapshot, deepMode = false): string {
  const parts: string[] = [SYSTEM_PROMPT];

  if (deepMode) {
    parts.push(`\n\n=== MODO PROFUNDO ACTIVADO (INVESTIGACIÓN Y RAZONAMIENTO EXHAUSTIVO) ===`);
    parts.push(`El usuario ha activado el Modo Profundo. Tu respuesta debe ser de nivel experto y rigor absoluto:`);
    parts.push(`- Desglosa el problema en sus fundamentos esenciales, evalúa múltiples perspectivas y formula argumentos sólidos contrastados.`);
    parts.push(`- Si se trata de un tema académico, investigativo o técnico, profundiza en causas, implicaciones, metodologías y conclusiones fundamentadas.`);
    parts.push(`- Emplea la herramienta de búsqueda web (\`webSearch\`) para respaldar hechos, cifras y datos recientes citando las fuentes.`);
    parts.push(`- Ejecuta herramientas de forma autónoma sin preámbulos y sintetiza los hallazgos con claridad magistral.`);
  }

  parts.push(`\n--- ESTADO Y CONTEXTO EN VIVO DE OWA STUDIO ---`);
  parts.push(`Vista actual: ${context.currentView}`);
  parts.push(`Fecha y hora: ${context.currentDate}`);

  if (context.userName) {
    parts.push(`Usuario: ${context.userName}`);
  }

  if (context.activeCourse) {
    parts.push(`\nAsignatura activa: ${context.activeCourse.name} (color: ${context.activeCourse.color})`);
    if (context.activeCourse.groupCount > 0) parts.push(`  Agrupaciones: ${context.activeCourse.groupCount}`);
    if (context.activeCourse.topicCount > 0) parts.push(`  Temas: ${context.activeCourse.topicCount}`);
  }

  if (context.courses.length > 0) {
    parts.push(`\nAsignaturas registradas (${context.courses.length}):`);
    for (const c of context.courses) parts.push(`  - "${c.name}" (id: ${c.id})`);
  }

  if (context.pendingTasks.length > 0) {
    parts.push(`\nTareas pendientes (${context.pendingTasks.length}):`);
    for (const t of context.pendingTasks.slice(0, 15)) {
      const due = t.dueDate ? ` | entrega: ${t.dueDate}` : '';
      parts.push(`  - "${t.title}" (${t.course || 'general'}, prioridad: ${t.priority}${due})`);
    }
    if (context.pendingTasks.length > 15) parts.push(`  ... y ${context.pendingTasks.length - 15} más`);
  }
  if (context.completedTaskCount > 0) {
    parts.push(`Tareas completadas: ${context.completedTaskCount}`);
  }

  if (context.eventsUpcoming.length > 0) {
    parts.push(`\nPróximos eventos en agenda:`);
    for (const e of context.eventsUpcoming) {
      parts.push(`  - "${e.title}" (${e.date}${e.allDay ? '' : ` ${e.startTime}`}${e.course ? `, ${e.course}` : ''})`);
    }
  }

  if (context.recentNotes.length > 0) {
    parts.push(`\nApuntes recientes:`);
    for (const n of context.recentNotes) {
      const preview = n.preview ? ` — "${n.preview}…"` : '';
      parts.push(`  - "${n.title}" [${n.course || 'general'}]${preview}`);
    }
  }

  if (context.timerActive) {
    if (context.sessionType === 'pomodoro') {
      const mm = Math.floor(context.timerRemaining / 60);
      const ss = context.timerRemaining % 60;
      parts.push(`\nTemporizador Pomodoro activo: restan ${mm}m ${ss}s (total ${Math.floor(context.timerTotal / 60)}m, transcurrido ${Math.floor(context.sessionTime / 60)}m).`);
    } else {
      parts.push(`\nCronómetro en curso: ${Math.floor(context.sessionTime / 60)}m ${context.sessionTime % 60}s.`);
    }
  }

  if (context.currentTrack) {
    parts.push(`\nReproductor de música: "${context.currentTrack.title}" — ${context.currentTrack.artist}`);
    parts.push(`  Estado: ${context.isPlayingMusic ? 'Reproduciendo ▶' : 'Pausado ⏸'}`);
  }
  if (context.trackCount > 0) parts.push(`Biblioteca musical: ${context.trackCount} canciones`);

  if (context.plannedToday.length > 0) {
    parts.push(`\nSesiones planificadas para hoy:`);
    for (const s of context.plannedToday) {
      parts.push(`  - "${s.title}" (${s.durationMinutes}min, ${s.type}${s.completed ? ' ✓' : ''})`);
    }
  }

  parts.push(`\nEstadísticas de estudio:`);
  parts.push(`  Tiempo hoy: ${Math.floor(context.dailyStudyTime / 60)} min`);
  parts.push(`  Tiempo esta semana: ${Math.floor(context.weeklyStudyTime / 60)} min`);
  parts.push(`  Pomodoros completados: ${context.pomodoroSessions}`);

  if (context.habits.length > 0) {
    parts.push(`\nHábitos (${context.habits.length}):`);
    for (const h of context.habits) {
      parts.push(`  - "${h.name}" (${h.completedToday ? '✓ completado hoy' : 'pendiente'})`);
    }
  }

  if (context.noteCount > 0) parts.push(`\nTotal de apuntes: ${context.noteCount}`);

  parts.push(`\n--- FIN DEL CONTEXTO ---`);

  return parts.join('\n');
}

