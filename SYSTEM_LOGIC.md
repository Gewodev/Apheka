# 🧠 OWA Studio: Arquitectura de Hiper-Lógica

Este documento detalla el funcionamiento interno, la lógica de negocio y la infraestructura de datos de Owa Studio.

## 1. Núcleo de Datos (Persistence Layer)
La aplicación utiliza un sistema de persistencia híbrido:
- **Frontend State**: React Context/Hooks para estados volátiles.
- **LocalStorage/LocalForage**: Almacenamiento local para tareas, notas y sesiones.
- **Tauri FS API**: (En desarrollo) Para exportar notas como archivos `.md` reales en el disco del usuario.

## 2. Motores de Lógica (Logic Engines)

### A. Motor de Enfoque (Timer Engine)
- **Modos**: Pomodoro (25/5), Descanso Corto, Cronómetro.
- **Sincronización PIP**: Utiliza un `BroadcastChannel` llamado `owa_studio_sync`. Esto permite que la ventana principal y la ventana flotante (Picture-in-Picture) compartan el mismo segundero sin desincronizarse.
- **Lógica de Fondo**: El timer se calcula comparando `Date.now()` para evitar que el estrangulamiento de JS en pestañas inactivas lo detenga.

### B. Sistema de Recuerdo Activo (Active Recall)
- **Algoritmo de Dominio**: Las notas tienen un nivel de `domino` (0-5). 
- **Lógica de Comparación**: Se utiliza un algoritmo de distancia de Levenshtein simplificado para comparar el "Recuerdo" del usuario contra el "Contenido Original" de la nota, asignando un puntaje de precisión.

### C. Matriz de Prioridades (Eisenhower Logic)
- Las tareas se clasifican en un plano bidimensional:
  - **Urgente/Importante**: Foco inmediato.
  - **No Urgente/Importante**: Planificación.
  - **Urgente/No Importante**: Delegar/Rápido.
  - **No Urgente/No Importante**: Eliminar.

## 3. Estructura de Objetos (Schemas)

### Tarea (Task)
```typescript
{
  id: uuid,
  title: string,
  completed: boolean,
  courseId: string,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  quadrant: 1 | 2 | 3 | 4,
  createdAt: timestamp
}
```

### Nota (Note)
```typescript
{
  id: uuid,
  courseId: string,
  title: string,
  content: string (HTML/Markdown),
  domainLevel: 0-5,
  tags: string[],
  lastReview: timestamp
}
```

## 4. Backend (Rust/Tauri)
- **Window Management**: Controla la transparencia de la ventana y los bordes personalizados (decorations: false).
- **System Tray**: (Planeado) Para mantener el timer visible en la barra de tareas.
- **File System**: Maneja el guardado de backups encriptados.

---
*OWA Studio - Diseñado para la excelencia académica.*
