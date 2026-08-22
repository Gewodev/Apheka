# OWA Studio

Plataforma de productividad y estudio personal para Windows, construida con Tauri 2 + React 19 + TypeScript. Integra planificador academico, reproductor musical, gestor de tareas, notas enriquecidas, cursos con seguimiento de progreso, temporizador Pomodoro/Cronometro, asistente de IA (Charvis), voz en vivo, y sincronizacion con Google (Calendar/Tasks/Classroom).

## Stack

| Capa | Tecnologias |
|---|---|
| Desktop | Tauri 2.16 (Rust), WebView2, Capacidades: fs/opener/dialog/shell/notification |
| Frontend | React 19, Vite 7.3.3, TypeScript 5.9 |
| UI | Tailwind-like tokens via `src/theme/tokens.css`, Lucide React, Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| Notas | contentEditable con FormatToolbar compartido (bold/italic/lists/headings) |
| Math/LaTeX | KaTeX via MarkdownRenderer |
| Markdown | marked + sanitize |
| Musica local | music-metadata-browser, AudioContext nativo |
| YouTube | YouTube IFrame API + fallback iframe embed |
| IA (Charvis) | Multi-proveedor OpenAI-compatible, 64+ tools, voice overlay |
| Persistencia | localStorage + IndexedDB (idb-keyval) + backup JSON exportable |
| Paqueteo | pnpm (recomendado) / npm |

---

## Git y colaboracion

### Conceptos fundamentales

**Repositorio remoto** (`origin`): la copia del proyecto en GitHub (`https://github.com/AuthomiaAgency/Owa_Studio.git`). Todas las ramas de trabajo se sincronizan aqui.

**Repositorio local**: tu copia del proyecto en tu computadora. Aqui editas, commiteas y testeas.

**Branch (rama)**: una linea independiente de desarrollo. Permite que cada persona trabaje en su funcionalidad SIN afectar el codigo de los demas. `main` es la rama "produccion" -- siempre debe estar funcional.

**Commit**: una fotografia del codigo en un momento dado. Cada commit tiene un mensaje descriptivo y un autor.

**Push**: subir tus commits desde tu computadora al servidor de GitHub. Sin push, tus cambios solo existen en tu maquina.

**Pull**: descargar y fusionar los cambios que otros subieron a la misma rama. Si no haces pull antes de trabajar, puedes generar conflictos.

**Merge**: fusionar una rama en otra (por ejemplo, tu feature branch -> main).

**Pull Request (PR)**: una solicitud formal para fusionar tu branch en `main`. Permite revision, comentarios y verificacion antes de integrar.

**Conflict**: ocurre cuando dos personas editaron las mismas lineas del mismo archivo. Git no sabe cual version usar y te pide resolverlo manualmente.

---

### Configuracion inicial (una sola vez)

```bash
# 1. Clonar el repositorio
git clone https://github.com/AuthomiaAgency/Owa_Studio.git
cd Owa_Studio

# 2. Instalar dependencias
pnpm install

# 3. Configurar tu nombre y email (para que tus commits tengan tu firma)
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

### Ramas del proyecto

| Rama | Uso | Quien la usa |
|---|---|---|
| `main` | Produccion -- siempre funcional. **Nunca commitear directamente.** Solo merges aprobados. | Todos (solo via PR) |
| `camicon-cambios` | Branch de trabajo | Cami |
| `gemommits` | Branch de trabajo | MaxCB |

---

### Flujo de trabajo diario: pull -> trabajar -> commit -> push

#### Paso 1: Actualizar tu rama (SIEMPRE antes de trabajar)

```bash
# Cambiar a tu rama de trabajo
git checkout camicon-cambios    # o gemommits

# Traer los cambios mas recientes del remote
git pull origin camicon-cambios
```

**Que hace `git pull`?**
Descarga y fusiona los cambios que otros (u otro computador) subieron a la misma rama. Si no haces pull antes de trabajar, puedes generar **conflictos de merge** (dos personas editaron lo mismo).

Si `main` tiene cambios nuevos que necesitas traer a tu branch:

```bash
# Opcion A: merge (crea un commit de merge)
git fetch origin
git merge origin/main

# Opcion B: rebase (re-escribe tu historial encima de main, mas limpio)
git fetch origin
git rebase origin/main
# Si hay conflictos, los resuelves y luego:
git rebase --continue
```

**Merge vs Rebase:**
- `merge` preserva el historial completo (incluyendo el commit de merge). Mas seguro.
- `rebase` re-escribe tu historial encima de main (linea limpia). Mas elegante pero puede causar conflictos mas frecuentes.
- **Para principiantes: usa `merge`.**

#### Paso 2: Crear una rama para tu feature (recomendado)

Aunque ya tienes tu branch personal, para cada funcionalidad nueva es buena practica crear una sub-rama:

```bash
# Desde tu branch de trabajo
git checkout camicon-cambios
git pull origin camicon-cambios

# Crear branch para la nueva feature
git checkout -b feat/nombre-del-feature
```

Esto mantiene tu branch principal limpia y te permite trabajar en multiples features sin contaminarlas entre si.

**Convencion de nombres de branch:**
- `feat/descripcion` -- nueva funcionalidad
- `fix/descripcion` -- correccion de bug
- `ui/descripcion` -- cambio visual
- `docs/descripcion` -- documentacion
- `refactor/descripcion` -- reestructura sin cambiar comportamiento

#### Paso 3: Trabajar y commitear

Edita archivos libremente. Cuando tengas un cambio listo:

```bash
# Ver que cambiaste
git status

# Ver los cambios detallados (linea por linea)
git diff

# Agregar archivos especificos
git add src/components/views/Musica.tsx
git add src/components/ui/FormatToolbar.tsx

# O agregar TODO lo que cambio
git add -A

# Commitear con mensaje descriptivo
git commit -m "feat: agregar boton de favorito en la vista de musica"
```

**Regla de oro**: un commit = un cambio logico. No metas 10 cambios diferentes en un solo commit.

**Que NO commitear** (ya estan en `.gitignore`):

- `node_modules/` -- dependencias
- `dist/` -- build del frontend
- `src-tauri/target/` -- build de Rust
- `.env*` -- secretos
- `*.local` -- configuraciones locales
- `.claude/` -- configuracion de IA

#### Paso 4: Push (subir al remote)

```bash
# Primera vez que subes una branch nueva
git push -u origin feat/nombre-del-feature

# Las veces siguientes (sin -u)
git push
```

**Que hace `git push`?** Sube tus commits desde tu computadora al servidor de GitHub. Sin push, tus cambios solo existen en tu maquina.

---

### Pull Requests (PR)

Un Pull Request es la forma **segura** de fusionar codigo de una branch en `main`. Permite revisiones, comentarios y verificacion antes de integrar.

#### Crear un Pull Request

1. Asegurate de que tu codigo esta subido:
   ```bash
   git push origin feat/nombre-del-feature
   ```

2. Ve a GitHub -> el repositorio `AuthomiaAgency/Owa_Studio`

3. Haz click en **"Compare & pull request"** (aparece una notificacion azul)

4. Completa el PR:
   - **Title**: nombre descriptivo del cambio
   - **Description**: que hiciste, por que, como probarlo
   - **Base**: `main` <- **Compare**: tu branch

5. Click en **"Create pull request"**

#### Revisar un Pull Request

- Ve a la pestana **"Files changed"** para ver que archivos se modificaron
- Haz comentarios en lineas especificas si algo necesita cambio
- Si todo esta bien, click en **"Merge pull request"** -> **"Confirm merge"**

#### Despues de merge

```bash
# En tu computadora, volver a main y traer los cambios
git checkout main
git pull origin main

# Tu feature branch ya no se necesita (opcional: eliminarla)
git branch -d feat/nombre-del-feature
git push origin --delete feat/nombre-del-feature
```

---

### Resolver conflictos de merge

Un **conflict** ocurre cuando dos personas editaron las mismas lineas del mismo archivo. Git no sabe cual version usar.

```
# Git te avisa:
# CONFLICT (content): Merge conflict in src/components/views/Musica.tsx

# Abre el archivo conflictuado. Veras algo asi:

<<<<<<< HEAD
const color = '#3b82f6';  // <- tu version
=======
const color = '#a78bfa';  // <- version de la otra persona
>>>>>>> origin/main
```

**Como resolverlo:**

1. Decide que version quieres (o combina ambas)
2. Elimina los marcadores `<<<<<<<`, `=======`, `>>>>>>>`
3. Guarda el archivo
4. Completa el merge:
   ```bash
   git add src/components/views/Musica.tsx
   git commit -m "fix: resolver conflicto de merge en Musica.tsx"
   ```

---

### Comandos de referencia rapida

| Accion | Comando |
|---|---|
| Ver estado actual | `git status` |
| Ver historial de commits | `git log --oneline -20` |
| Ver cambios sin staging | `git diff` |
| Ver cambios staged | `git diff --staged` |
| Deshacer ultimo commit (mantener cambios) | `git reset --soft HEAD~1` |
| Deshacer ultimo commit (borrar cambios) | `git reset --hard HEAD~1` |
| Ver todas las ramas (locales + remotas) | `git branch -a` |
| Cambiar de branch | `git checkout nombre-branch` |
| Crear y cambiar a branch nuevo | `git checkout -b nombre-nuevo` |
| Traer cambios del remote sin fusionar | `git fetch origin` |
| Fusionar rama actual con otra | `git merge nombre-branch` |
| Re-escribir tu historial encima de otra rama | `git rebase nombre-branch` |
| Subir al remote | `git push` |
| Bajar del remote | `git pull` |
| Eliminar branch local | `git branch -d nombre-branch` |
| Eliminar branch remota | `git push origin --delete nombre-branch` |
| Verificar si hay conflictos pendientes | `git diff --name-only --diff-filter=U` |
| Saltar un conflicto durante rebase | `git rebase --skip` |
| Abortar un merge en progreso | `git merge --abort` |
| Abortar un rebase en progreso | `git rebase --abort` |

---

### Convencion de commits

Formato:

```
tipo: descripcion corta
```

Tipos validos:

- `feat:` nueva funcionalidad
- `fix:` correccion de bug
- `ui:` cambio visual / estetico
- `refactor:` reestructura sin cambiar comportamiento
- `docs:` documentacion
- `chore:` configs, dependencias, limpieza

Ejemplo:
```
feat: agregar selector de color en el modal de cursos
fix: arreglar crash al arrastrar apuntes en modo overview
ui: mejorar spacing del panel lateral de tareas
```

---

## Setup

### Prerequisitos

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

### Build de produccion

```bash
pnpm run build          # solo frontend
pnpm tauri build        # ejecutable Windows (.exe + .msi)
```

Build de Tauri toma ~6-10 minutos la primera vez (compilacion Rust release).

---

## Estructura del proyecto

```
Owa_Studio/
├── .github/workflows/     # CI/CD -- release automatico en push a main
├── .opencode/             # Configuracion de opencode (agente IA)
├── design.md              # Design system maestro (colores, spacing, tipografia)
├── design-tokens.json     # Tokens de disenio importados por src/design/system.ts
├── docs/
│   ├── archive/           # Docs historicos (IMPLEMENTATION_PLAN_V5, etc.)
│   ├── landing/           # Landing page estatica (index.html)
│   ├── legal/             # Terminos y condiciones
│   └── study-methods-research.json  # Datos de investigacion pedagogica
├── public/                # Assets estaticos (owa_logo.png)
├── scripts/release.mjs    # Script de release para versionado
├── src/
│   ├── App.tsx            # Root -- routing, sidebar, GlobalPlayer, error boundary
│   ├── FloatingTimer.tsx  # Temporizador flotante (Pomodoro/Cronometro)
│   ├── main.tsx           # Entry point React
│   ├── index.css          # Estilos globales + keyframes (2900+ lineas)
│   ├── components/
│   │   ├── ui/            # Componentes compartidos (ver abajo)
│   │   └── views/         # Vistas principales (ver abajo)
│   ├── data/phrases.ts    # Frases motivacionales semanales
│   ├── design/system.ts   # Helper que lee design-tokens.json
│   ├── hooks/useTimer.ts  # Hook del temporizador
│   ├── lib/               # Utilidades y modulos de negocio (ver abajo)
│   ├── store/AppContext.tsx # Estado global (context + reducer, ~3500 lineas)
│   └── theme/tokens.css   # Variables CSS del design system
├── src-tauri/
│   ├── Cargo.toml         # Dependencias Rust
│   ├── tauri.conf.json    # Configuracion Tauri (permisos, ventana, bundler)
│   ├── capabilities/default.json  # Permisos de plugins Tauri
│   └── src/               # Codigo Rust (main, lib, comandos)
└── supabase/migrations/   # Schema SQL de la DB
```

### `src/components/ui/` -- Componentes compartidos

| Archivo | Descripcion |
|---|---|
| `AIBrainSidebar.tsx` | Panel derecho de Charvis (chat IA) |
| `CharvisProviders.tsx` | Gestion de proveedores de IA (multi-provider config modal) |
| `VoiceLiveOverlay.tsx` | Overlay de voz en vivo (Alt+A) |
| `FormatToolbar.tsx` | Toolbar de formato para editores de notas (bold/italic/lists) |
| `MarkdownRenderer.tsx` | Renderizador Markdown con KaTeX y sanitize |
| `MaterialContextMenu.tsx` | Menu contextual para materiales de archivos |
| `ImageContextMenu.tsx` | Menu contextual global para imagenes (copiar/descargar) |
| `ImageEditorModal.tsx` | Editor de imagen para banners (solo posicion, cover) |
| `PlanSelectDropdown.tsx` | Dropdown desplegable para Agrupacion/Tema (cascada) |
| `DownloadManager.tsx` | Gestor de descargas con progreso |
| `NotificationBell.tsx` | Campana de notificaciones |
| `AnalyticsDrawer.tsx` | Drawer de estadisticas/analiticas |
| `GoogleIcons.tsx` | Iconos SVG oficiales de Google (Calendar, Tasks, etc.) |
| `badge.tsx` `button.tsx` `card.tsx` `input.tsx` `modal.tsx` `progress.tsx` `select.tsx` `tabs.tsx` `textarea.tsx` `toggle.tsx` `empty-state.tsx` | Primitivas UI base |

### `src/components/views/` -- Vistas principales

| Archivo | Descripcion |
|---|---|
| `Inicio.tsx` | Dashboard principal -- stats, eventos proximos, meta diaria |
| `Estudio.tsx` | Temporizador + sesion vinculada + historial + evaluacion |
| `Tareas.tsx` | Gestor de tareas con drag & drop, calendario, panel lateral |
| `Notas.tsx` | Notas enriquecidas con carpetas, estante, drag & drop, icon picker |
| `Musica.tsx` | Biblioteca musical, playlists, YouTube, explorador, favoritas |
| `Planificacion.tsx` | Planificador semanal/mensual con eventos + sesiones de estudio |
| `Cursos.tsx` | Vista detallada de curso -- temas, agrupaciones, radar, cronograma |
| `CursosHub.tsx` | Hub de cursos -- grid de tarjetas con drag & drop |
| `Ajustes.tsx` | Configuracion -- perfil, Google, Charvis, sistema, almacenamiento |

### `src/lib/` -- Modulos de negocio

| Archivo | Descripcion |
|---|---|
| `ai/aiProvider.ts` | Cliente OpenAI-compatible (streaming + non-streaming, fallbacks) |
| `ai/aiPrompts.ts` | System prompt de Charvis + reglas de voz |
| `ai/aiTools.ts` | 64+ tools para Charvis (tareas, notas, cursos, musica, busqueda web, etc.) |
| `ai/aiContext.ts` | Construye snapshot del contexto de la app para el prompt |
| `ai/aiProviders.ts` | Catalogo de proveedores (opencode, OpenAI, Gemini, Anthropic, etc.) |
| `ai/providerBrands.tsx` | Logos SVG de cada proveedor |
| `google/` | OAuth, Calendar sync, Tasks sync, Classroom import |
| `musicApi.ts` `musicDb.ts` | API de musica + persistencia IDB |
| `fuzzy.ts` | Motor de busqueda difusa (Levenshtein + subsequence) |
| `openFileSmart.ts` | Apertura inteligente de archivos (local/Web/Tauri) |
| `owaBackup.ts` | Exportar/importar respaldo de datos |
| `ytEngine.ts` | YouTube IFrame API wrapper + helpers |
| `brainDrop.ts` | Protocolo drag & drop -> Charvis |
| `audioMetadata.ts` | Extraccion de metadatos de audio |
| `notifications.ts` | Sistema de notificaciones toast |
| `auth.ts` `firebase.ts` | Autenticacion |
| `tauri.ts` | Helpers especificos de Tauri |
| `utils.ts` | Utilidades generales |

---

## Charvis -- Asistente IA

Charvis es un asistente multi-proveedor compatible con la API de OpenAI. Configurable desde **Ajustes -> Sistema -> Charvis**.

### Proveedor por defecto

**opencode** (Zen) -- funciona sin API key. Modelos: `big-pickle`, `deepseek-v4-flash`, `deepseek-v4-pro`.

### Proveedores soportados

opencode, OpenAI, Gemini, Anthropic, DeepSeek, Kimi, Mistral, Groq, xAI

### Configuracion

1. Ajustes -> Sistema -> Charvis
2. Seleccionar proveedor
3. Pegar API key (opcional para opencode)
4. Validar API
5. Elegir modelo
6. Activar proveedor

### Voz en vivo (Alt+A)

Dictado continuo + respuesta hablada. Auto-envio por silencio (1.7s). Boton Detener. Ver `VoiceLiveOverlay.tsx`.

---

## Issues conocidos

- `src/store/AppContext.tsx` linea 2164: bug en `reorderNotes` -- **no tocar sin revisar**
- Evaluacion de `file-type` en `node_modules` (warning de `eval` en build Vite) -- inofensivo
- Chunks >500kB en build -- esperado (chunks intencionales: index ~576kB, Cursos ~896kB)

---

## Licencia

Proyecto privado -- Authomia Agency. Todos los derechos reservados.
