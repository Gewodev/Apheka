# OWA Studio - Agente de Desarrollo

## Identidad
OWA Studio es una aplicación de escritorio para estudio preuniversitario, repaso y productividad máxima. El agente debe mantener coherencia absoluta en diseño, funcionalidad y experiencia de usuario.

## Habilidades del Agente

### 1. Diseño UI/UX Profesional
- **Minimalismo profesional**: Espacios limpios, sin desorden visual
- **Proporción exacta**: Espacios consistentes, jerarquía clara
- **Semilluminación**: Fondos con subtle gradientes, no planos
- **Bloques cohesionados**: Elementos relacionados juntos, bordes armonizados
- **Animaciones fluidas**: Transiciones de 150-300ms con easing cubic-bezier(0.16, 1, 0.3, 1)

### 2. Sistema de Diseño
- **Colors**: Fondo base (#020203), superficie (#08080A), elevación (#0C0C0F), acento (#E11D48)
- **Typography**: Outfit para headings (black, tracking-tight), Inter para body
- **Spacing**: Escala base de 4px (4, 8, 12, 16, 24, 32, 40, 48, 64)
- **Radius**: 8, 12, 16, 24, 28, 40px - nunca menos de 8px
- **Shadows**: Capas sutiles, nunca negro puro

### 3. Componentes Reutilizables
- **Bento Card**: Fondo superficie, borde sutil, radius 40px, shadow-md, hover con translateY(-4px)
- **Botones**: Variantes primary (accent), secondary (ghost), tertiary (outline)
- **Inputs**: Fondo white/[0.02], borde white/[0.05], radius 12px, focus:border-accent
- **Progress**: Track white/[0.05], thumb accent con glow
- **Modals**: Overlay rgba(0,0,0,0.8) con blur, bento-card con shadow-lg

### 4. Vistas y Funcionalidades

#### Inicio (Dashboard)
- Header con hora actual en tiempo real
- Métricas operativas en bento cards (cola, base, log, días)
- Heatmap de actividad de 32 días
- Progreso diario vs meta
- Tareas activas prioritarias
- Notas recientes

#### Tareas (Operaciones)
- Filtro por curso y búsqueda
- Diagnóstico: pendientes/ejecutadas
- Lista de tareas con check interactivo
- Estados: inicio, progreso, completado, simple_done
- Prioridad: high (crítico), medium, low
- Urgent flag
- Modal crear/editar tareas

#### Notas (Archivo)
- Editor de notas con preview
- Selector de curso
- Buscador
- Notas recientes
- Modo edición inline

#### Estudio (Enfoque)
- Timer Pomodoro con progress ring SVG
- Modos: Pomodoro, Descanso, Chrono
- Controles: play/pause, reset, complete
- Métricas: sesiones, tiempo total, intensidad
- Atajo a música para sonidos

#### Música (Ambiente)
- Player con progress bar interactivo
- Playlist con tracks
- Sonidos ambiente: lluvia, olas, viento, fogata
- Volume control
- Like tracks

#### Planificación (Cronograma)
- Vista semanal con navegación
- Selector de día
- Bloques de horario por curso
- Stats: tiempo foco, operaciones, sectores
- Modal agregar bloque

#### Cursos (Sectores)
- **Dashboard completo de rendimiento**:
  - Vista general de todos los cursos
  - Progress bar por curso
  - Estadísticas: tareas total/completadas, horas estudiadas
  - Próximo examen
  - Calificación actual
  - Selector de curso para detalle
  - Tareas asociadas al curso
  - Notas asociadas al curso
  - Historial de estudio

#### Ajustes
- Theme toggle (oscuro/claro)
- Configuración de preferencias

### 5. Lógica de Negocio
- **Persistencia**: localStorage con debounce de 500ms
- **Estados**: Todos los datos en AppContext
- **Tipos**: Task, Note, Course, ScheduleBlock, Settings
- **Validación**: Check de strings vacíos, horarios válidos

### 6. Estilo de Código
- TypeScript con tipos explícitos
- Componentes funcionales con FC
- useCallback para handlers
- useMemo para cálculos derivados
- clsx para clases condicionales

### 7. Convenciones de Naming
- Vistas: Nombre descriptivo en español (Tareas, Notas, etc.)
- Labels: uppercase con tracking amplio
- Icons: lucide-react, size consistente (16, 18, 20)
- Classes: Tailwind con variables CSS

### 8. Reglas de Coherencia
- NUNCA usar negro puro (#000000) - siempre con alpha
- NUNCA bordes blancos brillantes - siempre white/[0.02-0.08]
- TODOS los interactive elements tienen transition
- TODOS los modals tienen backdrop blur
- TODOS los headers siguen mismo patrón

## Ejemplo de Estructura de Componente

```tsx
export default function NombreComponente() {
  const { data, actions } = useApp();
  
  // hooks
  const filtered = useMemo(() => ..., [deps]);
  
  // handlers
  const handleAction = useCallback(() => ..., []);
  
  return (
    <div className="page-container">
      <header>...</header>
      <div className="two-column">
        <div>...</div>
        <div>...</div>
      </div>
      {/* modals */}
    </div>
  );
}
```

## Errores a Evitar
- No anidar más de 3 niveles
- No usar color hardcoded fuera de variables CSS
- No olvidar cleanup en useEffect
- No dejar console.log en producción
- No hardcodear datos - usar contexto