# OWA Studio

Plataforma de productividad y estudio personal para Windows, construida con Tauri 2 + React 19 + TypeScript. Integra planificador académico, reproductor musical, gestor de tareas, notas enriquecidas, cursos con seguimiento de progreso, temporizador Pomodoro/Cronómetro, asistente de IA (Charvis), voz en vivo, y sincronización con Google (Calendar/Tasks/Classroom).

## Stack

| Capa | Tecnologías |
|---|---|
| Desktop | Tauri 2.16 (Rust), WebView2, Capacidades: fs/opener/dialog/shell/notification |
| Frontend | React 19, Vite 7.3.3, TypeScript 5.9 |
| UI | Tailwind-like tokens via `src/theme/tokens.css`, Lucide React, Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| Notas | contentEditable con FormatToolbar compartido (bold/italic/lists/headings) |
| Math/LaTeX | KaTeX via MarkdownRenderer |
| Markdown | marked + sanitize |
| Música local | music-metadata-browser, AudioContext nativo |
| YouTube | YouTube IFrame API + fallback iframe embed |
| IA (Charvis) | Multi-proveedor OpenAI-compatible, 64+ tools, voice overlay |
| Persistencia | localStorage + IndexedDB (idb-keyval) + backup JSON exportable |
| Paqueteo | pnpm (recomendado) / npm |

## Git y branching

### Clonar

```bash
git clone https://github.com/AuthomiaAgency/Owa_Studio.git
cd Owa_Studio
```

### Ramas

| Rama | Uso |
|---|---|
| `main` | Producción. **No commitear directamente.** Solo merge desde branches de trabajo. |
| `camicon-cambios` | Branch de trabajo para Cami |
| `gemommits` | Branch de trabajo para Gemma |

### Workflow

1. Crear un branch desde `main` (o desde tu branch de trabajo):
   ```bash
   git checkout main
   git pull
   git checkout -b mi-feature
   ```
2. Trabajar y commitear con mensajes descriptivos
3. Push al remote:
   ```bash
   git push -u origin mi-feature
   ```
4. Abrir Pull Request hacia `main` o pedir merge

### Convención de commits

Formato:

```
tipo: descripción corta
```

Tipos válidos:

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `ui:` cambio visual / estético
- `refactor:` reestructura sin cambiar comportamiento
- `docs:` documentación
- `chore:` configs, dependencias, limpieza

Ejemplo:
```
feat: agregar selector de color en el modal de cursos
fix: arreglar crash al arrastrar apuntes en modo overview
ui: mejorar spacing del panel lateral de tareas
```

### Commitear sin archivos de configuración / build

Nunca commitear estos archivos (ya están en `.gitignore`):

- `node_modules/` — dependencias
- `dist/` — build del frontend
- `src-tauri/target/` — build de Rust
- `.env*` — secretos
- `*.local` — configuraciones locales
- `.claude/` — configuración de IA

---

## Setup

### Prerrequisitos

- **Node.js** >= 18
- **pnpm** (recomendado) o npm
- **Rust** + **cargo** (para build de Tauri)
- **WebView2** (ya viene con Windows 10/11)

### Instalar dependencias

```bash
pnpm install
```

### Desarrollo (solo frontend, sin Tauri)

```bash
pnpm dev
```

### Desarrollo con Tauri

```bash
pnpm tauri dev
```

### Build de producción

```bash
pnpm run build          # solo frontend
pnpm tauri build        # ejecutable Windows (.exe + .msi)
```

Build de Tauri toma ~6-10 minutos la primera vez (compilación Rust release).

---

## Estructura del proyecto

```
Owa_Studio/
├── .github/workflows/     # CI/CD — release automático en push a main
├── .opencode/             # Configuración de opencode (agente IA)
├── design.md              # Design system maestro (colores, spacing, tipografía)
├── design-tokens.json     # Tokens de diseño importados por src/design/system.ts
├── docs/
│   ├── archive/           # Docs históricos (IMPLEMENTATION_PLAN_V5, etc.)
│   ├── landing/           # Landing page estática (index.html)
│   ├── legal/             # Términos y condiciones
│   └── study-methods-research.json  # Datos de investigación pedagógica
├── public/                # Assets estáticos (owa_logo.png)
├── scripts/release.mjs    # Script de release para versionado
├── src/
│   ├── App.tsx            # Root — routing, sidebar, GlobalPlayer, error boundary
│   ├── FloatingTimer.tsx  # Temporizador flotante (Pomodoro/Cronómetro)
│   ├── main.tsx           # Entry point React
│   ├── index.css          # Estilos globales + keyframes (2900+ líneas)
│   ├── components/
│   │   ├── ui/            # Componentes compartidos (ver abajo)
│   │   └── views/         # Vistas principales (ver abajo)
│   ├── data/phrases.ts    # Frases motivacionales semanales
│   ├── design/system.ts   # Helper que lee design-tokens.json
│   ├── hooks/useTimer.ts  # Hook del temporizador
│   ├── lib/               # Utilidades y módulos de negocio (ver abajo)
│   ├── store/AppContext.tsx # Estado global (context + reducer, ~3500 líneas)
│   └── theme/tokens.css   # Variables CSS del design system
├── src-tauri/
│   ├── Cargo.toml         # Dependencias Rust
│   ├── tauri.conf.json    # Configuración Tauri (permisos, ventana, bundler)
│   ├── capabilities/default.json  # Permisos de plugins Tauri
│   └── src/               # Código Rust (main, lib, comandos)
└── supabase/migrations/   # Schema SQL de la DB
```

### `src/components/ui/` — Componentes compartidos

| Archivo | Descripción |
|---|---|
| `AIBrainSidebar.tsx` | Panel derecho de Charvis (chat IA) |
| `CharvisProviders.tsx` | Gestión de proveedores de IA (multi-provider config modal) |
| `VoiceLiveOverlay.tsx` | Overlay de voz en vivo (Alt+A) |
| `FormatToolbar.tsx` | Toolbar de formato para editores de notas (bold/italic/lists) |
| `MarkdownRenderer.tsx` | Renderizador Markdown con KaTeX y sanitize |
| `MaterialContextMenu.tsx` | Menú contextual para materiales de archivos |
| `ImageContextMenu.tsx` | Menú contextual global para imágenes (copiar/descargar) |
| `ImageEditorModal.tsx` | Editor de imagen para banners (solo posición, cover) |
| `PlanSelectDropdown.tsx` | Dropdown desplegable para Agrupación/Tema (cascada) |
| `DownloadManager.tsx` | Gestor de descargas con progreso |
| `NotificationBell.tsx` | Campana de notificaciones |
| `AnalyticsDrawer.tsx` | Drawer de estadísticas/analíticas |
| `GoogleIcons.tsx` | Iconos SVG oficiales de Google (Calendar, Tasks, etc.) |
| `badge.tsx` `button.tsx` `card.tsx` `input.tsx` `modal.tsx` `progress.tsx` `select.tsx` `tabs.tsx` `textarea.tsx` `toggle.tsx` `empty-state.tsx` | Primitivas UI base |

### `src/components/views/` — Vistas principales

| Archivo | Descripción |
|---|---|
| `Inicio.tsx` | Dashboard principal — stats, eventos próximos, meta diaria |
| `Estudio.tsx` | Temporizador + sesión vinculada + historial + evaluación |
| `Tareas.tsx` | Gestor de tareas con drag & drop, calendario, panel lateral |
| `Notas.tsx` | Notas enriquecidas con carpetas, estante, drag & drop, icon picker |
| `Musica.tsx` | Biblioteca musical, playlists, YouTube, explorador, favoritas |
| `Planificacion.tsx` | Planificador semanal/mensual con eventos + sesiones de estudio |
| `Cursos.tsx` | Vista detallada de curso — temas, agrupaciones, radar, cronograma |
| `CursosHub.tsx` | Hub de cursos — grid de tarjetas con drag & drop |
| `Ajustes.tsx` | Configuración — perfil, Google, Charvis, sistema, almacenamiento |

### `src/lib/` — Módulos de negocio

| Archivo | Descripción |
|---|---|
| `ai/aiProvider.ts` | Cliente OpenAI-compatible (streaming + non-streaming, fallbacks) |
| `ai/aiPrompts.ts` | System prompt de Charvis + reglas de voz |
| `ai/aiTools.ts` | 64+ tools para Charvis (tareas, notas, cursos, música, búsqueda web, etc.) |
| `ai/aiContext.ts` | Construye snapshot del contexto de la app para el prompt |
| `ai/aiProviders.ts` | Catálogo de proveedores (opencode, OpenAI, Gemini, Anthropic, etc.) |
| `ai/providerBrands.tsx` | Logos SVG de cada proveedor |
| `google/` | OAuth, Calendar sync, Tasks sync, Classroom import |
| `musicApi.ts` `musicDb.ts` | API de música + persistencia IDB |
| `fuzzy.ts` | Motor de búsqueda difusa (Levenshtein + subsequence) |
| `openFileSmart.ts` | Apertura inteligente de archivos (local/Web/Tauri) |
| `owaBackup.ts` | Exportar/importar respaldo de datos |
| `ytEngine.ts` | YouTube IFrame API wrapper + helpers |
| `brainDrop.ts` | Protocolo drag & drop → Charvis |
| `audioMetadata.ts` | Extracción de metadatos de audio |
| `notifications.ts` | Sistema de notificaciones toast |
| `auth.ts` `firebase.ts` | Autenticación |
| `tauri.ts` | Helpers específicos de Tauri |
| `utils.ts` | Utilidades generales |

---

## Charvis — Asistente IA

Charvis es un asistente multi-proveedor compatible con la API de OpenAI. Configurable desde **Ajustes → Sistema → Charvis**.

### Proveedor por defecto

**opencode** (Zen) — funciona sin API key. Modelos: `big-pickle`, `deepseek-v4-flash`, `deepseek-v4-pro`.

### Proveedores soportados

opencode, OpenAI, Gemini, Anthropic, DeepSeek, Kimi, Mistral, Groq, xAI

### Configuración

1. Ajustes → Sistema → Charvis
2. Seleccionar proveedor
3. Pegar API key (opcional para opencode)
4. Validar API
5. Elegir modelo
6. Activar proveedor

### Voz en vivo (Alt+A)

Dictado continuo + respuesta hablada. Auto-envío por silencio (1.7s). Botón Detener. Ver `VoiceLiveOverlay.tsx`.

---

## Issues conocidos

- `src/store/AppContext.tsx` línea 2164: bug en `reorderNotes` — **no tocar sin revisar**
- Evaluación de `file-type` en `node_modules` (warning de `eval` en build Vite) — inofensivo
- Chunks >500kB en build — esperado (chunks intencionales: index ~576kB, Cursos ~896kB)

---

## Licencia

Proyecto privado — Authomia Agency. Todos los derechos reservados.
