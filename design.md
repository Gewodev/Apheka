# 🧠 West — MASTER DESIGN SYSTEM (v2.0)

## Creative North Star: "Cognitive Control Interface"

> Un sistema de interfaz diseñado para maximizar enfoque, reducir carga cognitiva y operar como una extensión del pensamiento del usuario. No es una app — es un **sistema de control cognitivo**.

---

## 1. PRINCIPIOS FUNDAMENTALES

### 1.1 Single Focus Dominance
Siempre existe **1 elemento dominante por vista**. Sin competencia visual.

### 1.2 Cognitive Silence
Eliminar ruido visual. Sin decoraciones innecesarias. Sin sobrecarga de información.

### 1.3 Structural Predictability
Patrones repetibles. Comportamiento consistente. Layouts predecibles.

### 1.4 Modular Intelligence
Todo es componente reutilizable. Sin lógica duplicada. Todo responde al sistema.

---

## 2. COLOR SYSTEM

### Base Surfaces
```css
--bg-base:     #0a0a0c;   /* Fondo principal de la app */
--bg-surface:  #111114;   /* Cards, sidebar, panels */
--bg-elevated: #18181b;   /* Cards hover, modals, dropdowns */
--bg-hover:    rgba(255, 255, 255, 0.03);
--bg-active:   rgba(255, 255, 255, 0.05);
```

### Accent (Acción)
```css
--accent:      #E11D48;   /* Rojo rosado — acción primaria */
--accent-soft: rgba(225, 29, 72, 0.12);
--accent-glow: rgba(225, 29, 72, 0.30);
```

### Text
```css
--text-primary:   rgba(255, 255, 255, 0.92);
--text-secondary: rgba(255, 255, 255, 0.55);
--text-tertiary:  rgba(255, 255, 255, 0.35);
--text-muted:     rgba(255, 255, 255, 0.18);
```

### Borders
```css
--border-default: rgba(255, 255, 255, 0.06);
--border-subtle:  rgba(255, 255, 255, 0.03);
--border-strong:  rgba(255, 255, 255, 0.10);
```

### Semantic
```css
--success: #10B981;
--warning: #F59E0B;
--error:   #EF4444;
--info:    #3B82F6;
```

### Rules
- ❌ Nunca negro puro (#000)
- ❌ Nunca blanco puro (#FFF)
- ❌ Nunca colores saturados fuera del accent/semantic
- ✔ Todo usa alpha channels para layering natural

---

## 3. TYPOGRAPHY SYSTEM

### Font Stack
- **Headings**: `'Inter', system-ui, sans-serif` — weight 600
- **Body**: `'Inter', system-ui, sans-serif` — weight 400–500
- **Labels/Micro**: `'Inter'` — weight 500, uppercase, letter-spacing 0.1em+

### Scale
```
display:  28px  weight-600  tracking -0.02em  (h1 de vistas)
heading:  20px  weight-600  tracking -0.01em  (h2 de secciones)
subhead:  16px  weight-500  tracking -0.01em  (h3 de cards)
body:     14px  weight-400  tracking  0       (contenido)
small:    12px  weight-400  tracking  0       (metadata)
label:    11px  weight-500  uppercase  tracking 0.08em
micro:     9px  weight-500  uppercase  tracking 0.15em
```

### Rules
- h1 en cada vista: máximo 28px, font-weight 600. NUNCA más grande.
- Subtítulos descriptivos debajo del h1: 14px, text-secondary, weight 400.
- Labels de cards: 11px uppercase tracking ancho.
- Valores numéricos grandes en metric cards: 28–32px weight 600.
- NUNCA font-black ni text-8xl. Máximo font-semibold (600).

---

## 4. SPACING SYSTEM

Base: **4px**

```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48
```

### Reglas de aplicación
- **Card internal padding**: 20px
- **Gap entre cards**: 16px (gap-4)
- **Header margin-bottom**: 24px (mb-6)
- **Sección margin-bottom**: 16px
- **Inter-element gap dentro de card**: 12px
- **Gap de metric grids**: 12–16px

---

## 5. BORDER RADIUS

```css
--radius-sm:  6px;   /* Tags, badges */
--radius-md:  8px;   /* Inputs, buttons small */
--radius-lg:  12px;  /* Cards, panels */
--radius-xl:  16px;  /* Modal, large cards */
--radius-full: 9999px; /* Pills, avatars */
```

### Rules
- Cards principales: `border-radius: 12px`
- Buttons: `border-radius: 8px`
- Inputs: `border-radius: 8px`
- Tags/badges: `border-radius: 6px`
- Modals: `border-radius: 16px`
- NUNCA radius > 16px. Sin `rounded-[40px]` ni `rounded-[32px]`.

---

## 6. LAYOUT SYSTEM

### Estructura universal
```
[Sidebar 220px] [Main Content flex-1] [Optional Context Panel 320px]
```

### Sidebar
- Width: 220px (colapsado: 64px)
- Background: var(--bg-surface)
- Border-right: 1px solid var(--border-default)
- Nav items: 40px height, 12px padding horizontal, radius-md
- Active state: bg-accent/10, text-accent, left accent bar 3px
- Font: 13px weight 500 (no uppercase, no tracking extremo)

### Main Content
- Padding: 32px (horizontal), 24px (vertical)
- Max-width: sin límite (ocupa todo flex-1)
- Scroll vertical automático

### Tipos de Layout por Vista
| Vista | Layout | Notas |
|-------|--------|-------|
| Inicio | Data Grid (4 metrics + heatmap + session + active tasks) | Bento grid 12 cols |
| Tareas | Flow + Side Panel (lista + detail panel derecho) | 3 columnas |
| Notas | Tri-panel (folders + list + editor + details) | 4 columnas fijas |
| Estudio | Focus Center (timer central + metrics lateral) | 2 columnas |
| Música | Player + playlist (hero player + ambient + list) | 2 columnas |
| Planificación | Calendar Grid (stats + week calendar + sidebar) | Full calendar grid |
| Cursos | Detail page (tabs + metrics + tasks + notes) | Single course view |

---

## 7. COMPONENT SYSTEM

### 7.1 Bento Card
```css
background: var(--bg-surface);
border: 1px solid var(--border-default);
border-radius: 12px;
padding: 20px;
transition: all 200ms ease;
```
- Hover: `border-color: var(--border-strong);`
- Nunca box-shadow pesadas. Máximo: `0 1px 3px rgba(0,0,0,0.2)`

### 7.2 Metric Card (dentro de dashboard)
```css
background: var(--bg-surface);
border: 1px solid var(--border-default);
border-radius: 12px;
padding: 16px 20px;
```
- Label: 11px uppercase tracking-wide text-tertiary
- Value: 28px weight-600 text-primary
- Icon: 20px text-tertiary, en la esquina superior derecha
- Separador vertical entre metrics: 1px solid var(--border-subtle)

### 7.3 Buttons
| Tipo | Background | Border | Text |
|------|-----------|--------|------|
| Primary | var(--accent) | none | white |
| Secondary | transparent | 1px border-default | text-secondary |
| Ghost | transparent | none | text-tertiary |
| Danger | var(--error) | none | white |

- Border-radius: 8px
- Padding: 8px 16px
- Font: 13px weight 500
- Height: 36px (standard), 32px (compact)

### 7.4 Inputs
```css
background: rgba(255, 255, 255, 0.03);
border: 1px solid var(--border-default);
border-radius: 8px;
padding: 8px 12px;
height: 36px;
font-size: 13px;
color: var(--text-primary);
```
- Focus: `border-color: var(--accent);`
- Placeholder: `color: var(--text-muted);`

### 7.5 Nav Item
```css
height: 40px;
padding: 0 12px;
border-radius: 8px;
font-size: 13px;
font-weight: 500;
color: var(--text-tertiary);
display: flex;
align-items: center;
gap: 10px;
```
- Active: `background: rgba(225,29,72,0.08); color: var(--accent);`
- Active indicator: `3px left bar, bg-accent, border-radius 0 3px 3px 0`

### 7.6 Progress Bar
```css
track: height 3px, bg rgba(255,255,255,0.06), border-radius full
fill: bg var(--accent), border-radius full
```

### 7.7 Heatmap Cell
```css
width: 14px;
height: 14px;
border-radius: 3px;
background: rgba(255,255,255,0.03); /* inactive */
background: var(--accent); /* active */
```

### 7.8 Modal
```css
overlay: rgba(0,0,0,0.6), backdrop-filter blur(8px)
card: bg-elevated, border-radius 16px, padding 24px
max-width: 480px
```

### 7.9 Tag/Badge
```css
padding: 2px 8px;
border-radius: 6px;
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
```
- HIGH: bg-accent/15, text-accent
- MEDIUM: bg-warning/15, text-warning
- LOW: bg-info/15, text-info
- COMPLETED: bg-success/15, text-success

---

## 8. INTERACTION SYSTEM

### Transitions
```css
transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
```

### Principios
- Rápido pero suave (200ms máximo)
- Sin rebotes exagerados
- Feedback inmediato
- Hover: color change, NO scale transforms exagerados (máximo scale 1.02)

---

## 9. VISTA: ESTRUCTURA DETALLADA

### Inicio (Dashboard)
```
Header: "Hola, {nombre} 👋"  |  Reloj HH:MM:SS  |  Botón "Enfoque"
4x Metric Cards: Cola, Notas, Tiempo, Racha
Heatmap 32 días (full width)
Progreso diario (bar)       |  Sesión activa (timer circular)
Tareas activas (lista)      |  Notas recientes      |  Métricas estudio (bar chart)
```

### Tareas
```
Header: "Tareas" + descripción + search + botón "+ Nueva tarea"
4x Metric Cards: Pendientes, En progreso, Completadas, Eficiencia
Filtros: asignaturas, estados, prioridades + tabs
Lista de tareas (scrollable) | Panel detalle derecho (selected task)
```

### Notas
```
Header: "Notas" + search + botón "+ Nueva nota"
4 columnas: Carpetas | Lista notas | Editor | Detalles
```

### Estudio
```
Header: "Estudio" + subtítulo + botones atajos
Tabs: Pomodoro | Descanso corto | Descanso largo | Chrono
Timer circular grande (center) | Métricas + historial (right)
3x cards bottom: Objetivo, Consejo, Sonidos
Footer: Modo enfoque status bar
```

### Música
```
Header: "Música" + search + botón "Sonidos"
Hero player card | Ambiente actual panel
Playlists grid (thumbnails)
Tabla canciones full width
Player bar fixed bottom
```

### Planificación
```
Header: "Planificación" + date range + botón "+ Agregar bloque"
4x Metric Cards: Tiempo enfoque, Operaciones, Sectores, Productividad
Weekly calendar grid (7 cols, hour rows) | Sidebar: resumen + mini calendar + próximos
```

### Cursos (Detail)
```
Breadcrumb: Cursos > Curso Name
Header: nombre + estrella + selector + tabs
4x Metric Cards: progreso, tareas, tiempo, próximo examen
Tareas del curso | Notas del curso | Rendimiento chart | Distribución donut
Temas principales | Recursos del curso
```

---

## 10. PROHIBICIONES ABSOLUTAS

- ❌ font-black (weight 900)
- ❌ text-7xl, text-8xl (máximo text-3xl para h1)
- ❌ rounded-[32px], rounded-[40px] (máximo rounded-xl = 16px)
- ❌ tracking-[0.5em] (máximo tracking-wider = 0.1em)
- ❌ gap-16, p-16, mb-24 (espaciado excesivo)
- ❌ shadow-3xl, shadow-[0_40px_80px...] (sombras exageradas)
- ❌ Colores fuera del sistema
- ❌ Animaciones innecesarias (máximo pulse en indicadores activos)
- ❌ uppercase en todo (solo en labels/micro text)
- ❌ Layouts improvisados

---

## 11. MANTRA FINAL

> **Legible. Preciso. Silencioso. Funcional.**
>
> Cada pixel tiene un propósito. Si no lo tiene, se elimina.
> La densidad de información es alta, pero la carga cognitiva es baja.
> El diseño no impresiona — **funciona**.


## West — desktop refinement, 2026-10-12
The desktop workspace uses restrained neobrutalist blocks: 5–6px corners, visible borders, small solid offset shadows and flat surfaces. Shared WorkspaceHeader and workspace.css define the current system. Keep the existing logo, accent customization, and Estudio composition. West lettering is larger, matte and separated with subtle cuts. Settings use top categories and a searchable contextual index. Support dark/light themes and compact 1200×800 desktop windows. Fonts are bundled for offline use.


### Current finish (supersedes the earlier solid-shadow pass)
Preserve the familiar desktop composition. Use quiet borders, 7–9px corners, flat soft surfaces and no hard offset shadows. `refinement.css` is the final finish. Planner controls remain in their original positions, with icon view buttons. West uses the bundled Inter Tight face and tiny internal cuts, rather than hand-drawn glyphs. DurationControl is shared by Settings and the small right-click pomodoro popup; no circular selector or additional study header button. Use container width for time-control density and maintain layouts with the sidebar expanded/collapsed.

Final desktop details: Inicio keeps its three overview blocks in one row at desktop widths; appearance opacity applies to workspace surfaces while dialogs stay opaque. Music uses flat bordered tiles, subtle hover borders and a stable expanded cover without 3D tilt. Course tools share the same readable dialog spacing and explicit color choices.

6.7.1 desktop correction: WorkspaceClock defines the shared 42–46px thin clock; keep titles at 34–36px and metrics around 96px high. Main content must have min-width:0. Planner keeps one toolbar row; use compact date/year and accessible icon actions only when the container is narrow. Dialogs and shared popovers render through portals; popover layers follow their owner and scrolling repositions the menu instead of closing it prematurely.


## Revisión de escritorio 6.7.2

El reloj analógico queda dentro del emergente de clic derecho del pomodoro, con hora actual y final elegido. Inicio usa cifras finas de 48–52 px; Estudio, 42–44 px. Las métricas y los tres bloques originales mantienen su organización. Curso/prioridad se identifican con bordes y tintes discretos. El editor usa Inter Tight 16,5 px / 1,85, guarda los espacios intencionales y conserva el cursor de forma estructural. Banners directos con encuadre opcional; avisos de 16 px en un panel propio. El diálogo de actualización mantiene el wordmark y acredita a Gewodev sin efectos metálicos. Véase `docs/APHEKA-6.7.2.md`.
### Última revisión de Cursos e instalación (13 de octubre)

Los controles de alta de tareas usan filas de 44 px y separación de 10 px. Tareas y apuntes conservan dos columnas cuando disponen de ancho suficiente y pasan a una columna si el menú reduce el espacio útil. En el modo de estudio, materiales, sesiones y agrupaciones conservan tres columnas en ventanas amplias; en ventanas menores se distribuyen sin comprimir las gráficas. Los emergentes se montan fuera del contenedor animado y mantienen el centro de la ventana.

El instalador usa Segoe UI, español, superficies claras planas y el logo existente. La banda lateral y el encabezado se generan con `scripts/create-installer-art.ps1`; los recursos originales del logo no se modifican.
