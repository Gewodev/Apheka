// ═══════════════════════════════════════════════════
//  CHARVIS — Dynamic Prompt Composer
// ═══════════════════════════════════════════════════

import type { AppContextSnapshot } from './aiContext';

const SYSTEM_PROMPT = `Eres **Charvis**, el asistente de IA integrado en OWA Studio, una plataforma de productividad académica.

Tu perfil:
- Asistente especializado, sobrio y formal. Respondes como un experto: claro, estructurado y sin lenguaje infantil ni exceso de emojis.
- Responde SIEMPRE en español, salvo que el usuario escriba en otro idioma.
- Estructura tus respuestas con markdown: negritas para lo relevante, listas cuando haya varios elementos, tablas cuando compares datos, y separadores "---" entre secciones cuando aporte claridad.
- Matemáticas: cuando incluyas fórmulas usa $...$ para inline y $$...$$ para bloque.
- Código: usa bloques de código \`\`\` con el lenguaje indicado.
- Sé preciso y directo. Si te falta información, indícalo con claridad en lugar de inventar.
- Cuando el usuario pida una acción concreta (crear tarea, planificar, reproducir música, añadir nota…), EJECÚTALA con las herramientas disponibles y confirma el resultado de forma breve.
- NUNCA anuncies lo que vas a hacer ni narres el proceso (no digas "voy a buscar", "consultaré tus datos", "déjame verificar"): usa la herramienta directamente y responde con el resultado ya obtenido.
- Cuando el usuario pregunte por sus datos (tareas, notas, cursos, calendario, estadísticas), usa el contexto que se te proporciona y cita la información real.`;

export function composeSystemPrompt(context: AppContextSnapshot, deepMode = false): string {
  const parts: string[] = [SYSTEM_PROMPT];

  if (deepMode) {
    parts.push(`\n\n=== MODO PROFUNDO ACTIVADO ===`);
    parts.push(`El usuario activó el modo profundo. Se espera una respuesta EXHAUSTIVA y de altísimo nivel:`);
    parts.push(`- Descompón el problema en partes, razona cada hipótesis, descarta las débiles y entrega la conclusión más sólida con su justificación.`);
    parts.push(`- Desarrolla el tema con profundidad real: contexto, argumentos, datos, contraargumentos y una síntesis clara al final.`);
    parts.push(`- Usa la herramienta de búsqueda web para contrastar datos, fechas, conceptos o hechos actuales, y cita las fuentes con su URL.`);
    parts.push(`- NUNCA anuncies lo que vas a hacer ni narras el proceso (no digas "voy a buscar", "consultaré", "déjame verificar"): ejecuta directamente y responde.`);
    parts.push(`- Si faltan datos, indícalo con precisión y propón cómo obtenerlos.`);
  }

  parts.push(`\n--- CONTEXTO ACTUAL DE LA APP ---`);
  parts.push(`Vista activa: ${context.currentView}`);
  parts.push(`Fecha/hora actual: ${context.currentDate}`);

  if (context.userName) {
    parts.push(`Usuario: ${context.userName}`);
  }

  if (context.activeCourse) {
    parts.push(`\nCurso activo: ${context.activeCourse.name} (color: ${context.activeCourse.color})`);
    if (context.activeCourse.groupCount > 0) parts.push(`  Agrupaciones: ${context.activeCourse.groupCount}`);
    if (context.activeCourse.topicCount > 0) parts.push(`  Temas: ${context.activeCourse.topicCount}`);
  }

  if (context.courses.length > 0) {
    parts.push(`\nCursos (${context.courses.length}):`);
    for (const c of context.courses) parts.push(`  - "${c.name}" (id: ${c.id})`);
  }

  if (context.pendingTasks.length > 0) {
    parts.push(`\nTareas pendientes (${context.pendingTasks.length}):`);
    for (const t of context.pendingTasks.slice(0, 12)) {
      const due = t.dueDate ? ` | vence: ${t.dueDate}` : '';
      parts.push(`  - "${t.title}" (${t.course || 'sin curso'}, prioridad: ${t.priority}${due})`);
    }
    if (context.pendingTasks.length > 12) parts.push(`  ... y ${context.pendingTasks.length - 12} más`);
  }
  if (context.completedTaskCount > 0) {
    parts.push(`Tareas completadas: ${context.completedTaskCount}`);
  }

  if (context.eventsUpcoming.length > 0) {
    parts.push(`\nPróximos eventos de calendario:`);
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
      parts.push(`\nPomodoro en curso: quedan ${mm} min ${ss} s (total ${Math.floor(context.timerTotal / 60)} min, llevas ${Math.floor(context.sessionTime / 60)} min).`);
    } else {
      parts.push(`\nCronómetro en curso: ${Math.floor(context.sessionTime / 60)} min ${context.sessionTime % 60} s transcurridos.`);
    }
  }

  if (context.currentTrack) {
    parts.push(`\nReproduciendo: "${context.currentTrack.title}" — ${context.currentTrack.artist}`);
    parts.push(`  Estado: ${context.isPlayingMusic ? 'reproduciendo' : 'pausado'}`);
  }
  if (context.trackCount > 0) parts.push(`Canciones en biblioteca: ${context.trackCount}`);

  if (context.plannedToday.length > 0) {
    parts.push(`\nSesiones planificadas hoy:`);
    for (const s of context.plannedToday) {
      parts.push(`  - "${s.title}" (${s.durationMinutes}min, ${s.type}${s.completed ? ' ✓' : ''})`);
    }
  }

  parts.push(`\nEstadísticas de estudio:`);
  parts.push(`  Hoy: ${Math.floor(context.dailyStudyTime / 60)} min`);
  parts.push(`  Semana: ${Math.floor(context.weeklyStudyTime / 60)} min`);
  parts.push(`  Pomodoros completados: ${context.pomodoroSessions}`);

  if (context.habits.length > 0) {
    parts.push(`\nHábitos (${context.habits.length}):`);
    for (const h of context.habits) {
      parts.push(`  - "${h.name}" (${h.completedToday ? '✓ completado hoy' : 'pendiente'})`);
    }
  }

  if (context.noteCount > 0) parts.push(`\nTotal de notas/apuntes: ${context.noteCount}`);

  parts.push(`\n--- FIN DEL CONTEXTO ---`);

  return parts.join('\n');
}
