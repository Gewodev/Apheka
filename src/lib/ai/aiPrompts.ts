// ═══════════════════════════════════════════════════
//  OWA BRAIN — Dynamic Prompt Composer
// ═══════════════════════════════════════════════════

import type { AppContextSnapshot } from './aiContext';

const SYSTEM_PROMPT = `Eres **Owa Brain**, el asistente de IA integrado en OWA Studio — una aplicación de productividad y estudio.

Tu rol:
- Eres un asistente académico y de productividad inteligente
- Controlas toda la aplicación mediante herramientas (tools)
- Responde SIEMPRE en español
- Sé conciso y directo, no uses texto excesivo
- Cuando el usuario pida una acción (crear tarea, poner música, etc.), USA las herramientas disponibles
- Cuando el usuario pregunte algo, responde con conocimiento y contexto
- Si ejecutas una acción, confirma brevemente qué hiciste
- Nunca inventes datos que no tienes. Si no sabes algo, dilo.

Personalidad:
- Profesional pero amigable
- Enfocado en productividad y estudio
- Directo y eficiente
- Usa emojis con moderación (máximo 1-2 por mensaje)

Reglas de herramientas:
- SIEMPRE usa tool calls cuando el usuario pide una acción
- No describas lo que harías, HAZLO con las herramientas
- Si necesitas múltiples acciones, ejecuta todas las herramientas necesarias
- Confirma las acciones completadas al usuario`;

export function composeSystemPrompt(context: AppContextSnapshot): string {
  const parts: string[] = [SYSTEM_PROMPT];

  // Current state context
  parts.push(`\n\n--- CONTEXTO ACTUAL DE LA APP ---`);
  parts.push(`Vista activa: ${context.currentView}`);
  parts.push(`Fecha/hora actual: ${context.currentDate}`);

  if (context.userName) {
    parts.push(`Usuario: ${context.userName}`);
  }

  // Active course
  if (context.activeCourse) {
    parts.push(`\nCurso activo: ${context.activeCourse.name} (color: ${context.activeCourse.color})`);
    if (context.activeCourse.groupCount > 0) {
      parts.push(`  Agrupaciones: ${context.activeCourse.groupCount}`);
    }
    if (context.activeCourse.topicCount > 0) {
      parts.push(`  Temas: ${context.activeCourse.topicCount}`);
    }
  }

  // Courses summary
  if (context.courses.length > 0) {
    parts.push(`\nCursos disponibles (${context.courses.length}):`);
    for (const c of context.courses) {
      parts.push(`  - "${c.name}" (id: ${c.id}, color: ${c.color})`);
    }
  }

  // Pending tasks
  if (context.pendingTasks.length > 0) {
    parts.push(`\nTareas pendientes (${context.pendingTasks.length}):`);
    for (const t of context.pendingTasks.slice(0, 10)) {
      const due = t.dueDate ? ` | vence: ${t.dueDate}` : '';
      parts.push(`  - "${t.title}" (${t.course}, ${t.priority}${due})`);
    }
    if (context.pendingTasks.length > 10) {
      parts.push(`  ... y ${context.pendingTasks.length - 10} más`);
    }
  }

  // Study session
  if (context.timerActive) {
    parts.push(`\nSesión de estudio activa: ${context.sessionType} — ${Math.floor(context.sessionTime / 60)}min`);
  }

  // Current music
  if (context.currentTrack) {
    parts.push(`\nReproduciendo: "${context.currentTrack.title}" — ${context.currentTrack.artist}`);
    parts.push(`  Estado: ${context.isPlayingMusic ? 'reproduciendo' : 'pausado'}`);
  }

  // Tracks available
  if (context.trackCount > 0) {
    parts.push(`Canciones en biblioteca: ${context.trackCount}`);
  }

  // Planned sessions today
  if (context.plannedToday.length > 0) {
    parts.push(`\nSesiones planificadas hoy:`);
    for (const s of context.plannedToday) {
      parts.push(`  - "${s.title}" (${s.durationMinutes}min, ${s.type}${s.completed ? ' ✓' : ''})`);
    }
  }

  // Stats
  parts.push(`\nEstadísticas de hoy:`);
  parts.push(`  Tiempo estudiado: ${Math.floor(context.dailyStudyTime / 60)} min`);
  parts.push(`  Pomodoros completados: ${context.pomodoroSessions}`);

  // Habits
  if (context.habits.length > 0) {
    parts.push(`\nHábitos (${context.habits.length}):`);
    for (const h of context.habits) {
      parts.push(`  - "${h.name}" (${h.completedToday ? '✓ hoy' : 'pendiente'})`);
    }
  }

  // Notes count
  if (context.noteCount > 0) {
    parts.push(`\nTotal de notas/apuntes: ${context.noteCount}`);
  }

  parts.push(`\n--- FIN DEL CONTEXTO ---`);

  return parts.join('\n');
}
