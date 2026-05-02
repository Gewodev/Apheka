# Plan de Refactorización App Scholar

## Problemas identificados
- **No hay timer activo en App.tsx**: El `useEffect` que maneja el countdown del timer NO existe en App.tsx - el estado solo se guarda pero nunca se decrementa
- **Tareas**: El click en la tarjeta cambia estado sin aviso visual claro, falta botón de editar (hay un estado pero no se usa bien)
- **Estudio**: Sin lógica de cronómetro funcional, sin notificaciones, sin sidebar de tareas sincronizada
- **PIP**: Funciona pero no hay sync bidireccional real con la app principal
- **Sin notificaciones de sesión completada**
- **Sin botón minimizar en Tareas**
- **Sin sync de tiempo estudiado con meta diaria en sidebar**

## Cambios a realizar

### 1. App.tsx - Agregar lógica del timer (crítico, no existe)
- useEffect con setInterval que decrementa `segundos` cuando `activo`
- Manejo de fase cambio (enfoque → descanso y viceversa)
- Emisión de evento 'timer-tick' para PIP sync
- Cuando pomodoro termina: enviar notificación nativa
- Cuando cronómetro termina: registrar tiempo sin notificación
- Registrar tiempo estudiado en tareas vinculadas
- Actualizar daily_stats

### 2. App.tsx - Agregar BroadcastChannel para PIP sync
- BroadcastChannel entre la app principal y la PIP
- Sync bidireccional de play/pause/reset

### 3. Tareas.tsx - Editar tareas y estado visible
- Botón de editar (Edit3) en cada tarea → abre modal de edición
- Mejor transición visual en cambio de estado (animación + badge)
- Botón "Minimizar" encima de tareas → abre PiP de timer
- Diseño estético del botón minimizar

### 4. Estudio.tsx - Rediseño completo
- Pomodoro y Cronómetro bien implementados
- Botones principales: Play/Pause + Reiniciar (grandes, visibles, organizados)
- Notificación académica al terminar sesión pomodoro (Notification API)
- Sidebar derecha con tareas visibles con fecha/curso
- Tiempo estudiado visible conectado a meta diaria
- Botón minimizar → abre PiP sincronizado
- Sync perfecto con FloatingTimer y PIP

### 5. FloatingTimer.tsx - PIP sync mejorado
- Sync real con timerState de App.tsx
- Cuando cambia modo, PiP también se actualiza
- Mismo tiempo en ambos lados
- Play/pause/reset sync
