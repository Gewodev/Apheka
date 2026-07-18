# Build
- `pnpm run build` (runs `tsc && vite build`)

# Summary

## Task Detail Panel — Professional Redesign
- **All modals portaled to `document.body`**: Subtasks, Notes, Preview, Confirm‑delete modals now use `createPortal(…, document.body)` at `zIndex: 99995`. Fixes the stacking‑context bug where `backdrop-filter` on `.page-container` trapped inline `position: fixed` elements, making them appear below the sidebar.
- **Panel header**: Clean close‑button + status pill (dot + subtle bg) + action buttons. No gradients.
- **Title**: Standalone `bento-card` section, larger typography (20px, weight 500), no bottom border.
- **Info grid (Course, Date, Priority, Time)**: 4 clean bento‑cards in 2×2 layout, each with a tiny uppercase label (8px, `Inter Tight` font). Compact select/input styling, no unnecessary icons.
- **Study progress**: Subtle 3px solid bar, no gradient. Uppercase label. Compact stat row.
- **Subtareas / Notas**: Full‑width clickable cards with icon, count summary, chevron. Hover border‑color transition.
- **Materiales**: Tighter file cards (7px padding, 22px icon box), smaller badges, cleaner embedded previews (YouTube, audio, image, PDF, Office, Web, Drive). Add‑material form uses compact `9px` UI.
- **Estudiar CTA**: Tinted border + background, full‑width, clean type.
- **Every card** uses `bento-card` with consistent `border: 1px solid var(--border-soft)`. No gradient fills anywhere.

## Timer
- Pomodoro completion is detected globally (any view) via a `useEffect` in AppContext. When `isTimerActive && !isRest && sessionType === 'pomodoro' && sessionTime >= settings.pomodoroTime`, a `showRestPrompt` flag is set.
- When `showRestPrompt` is true and the user is not in Estudio, App.tsx shows an amber banner: "Te espera un descanso" with an "Ir a Estudio" button (`ArrowRight` icon). On click, it navigates to Estudio and clears the prompt.
- FloatingTimer has distinct colors: short break → green (`timerBreakColor`), long break → amber (`timerLongBreakColor`). For `pomodoroComplete` state (done but not yet in rest): shows `00:00` with "Completado" label in chrono color.
- `pomodoroCompletedRef` resets only when `sessionTime < settings.pomodoroTime` (not when the timer pauses), preventing premature re-detection.

## Floating Timer
- Timer sync events include `pomodoroComplete` (computed: `!isRest && sessionType === 'pomodoro' && sessionTime >= pomodoroTime`) in all 4 sync paths (interval, pause, isRest change, sync request).
- Settings sync events include `timerLongBreakColor` (already in `Settings` interface, maps to `customColors.longBrk`, defaults to `#F59E0B`).

## Music Player Desync Fixes
Three root causes fixed:

1. **`visibilitychange` visible** (`AppContext.tsx`): `setIsPlayingMusic(true)` was called BEFORE `globalAudio.play()` resolved, and `.catch(() => {})` silently swallowed failures. Now state updates live inside `.then()`/`.catch()` — if `play()` fails, `isPlayingMusic` is set to `false` instead of staying `true`.

2. **`visibilitychange` hidden** (`AppContext.tsx`): Used `isPlayingMusicRef.current` (a React ref that could be stale during races). Changed to `!globalAudio.paused` (the actual audio element state).

3. **`toggleMusicPlayback`** (`AppContext.tsx`): Added `readyState < 2` guard — if the audio element hasn't loaded enough data, defers to `autoPlayRef` + `canplay` handler instead of calling `playAudioInstance` (which would fail). Also allows toggling off while waiting for `canplay` (second click cancels the pending playback).

4. **Auto-save sanity check** (`AppContext.tsx`): Saved `isPlayingMusic` is now `isPlayingMusic && !globalAudio.paused`, preventing a desync state from persisting across restarts.

## Planificador — View Persistence
- **Internal view state** (`planView` → `'week' | 'day' | 'month'`) persists via localStorage key `owa_planner_view`.
- **Horario/Hábitos** toggles (`showScheduleBuilder`, `showHabits`) now persist via `owa_show_schedule` and `owa_show_habits` localStorage keys, surviving navigation away and back.
- All view components (Tareas `viewMode`, Notas `viewState`, Planificador `planView` + Horario/Hábitos) use localStorage for state persistence, so switching views and returning preserves the last active view state.

## Download Sidebar (Musica)
- Active items show progress bar + Cancel button (no X)
- Completed/cancelled/error items show X to delete
- Cancel sets status to `'cancelled'`, then X appears

## Cursos — Overview & Study Modes
- **Two view modes**: "Tareas+Notas" (default) and "Temas+Archivos" (Modo Estudio), toggled via an `ArrowLeftRight` swap button that rotates 180°.
- **Tareas+Notas mode**: Left panel shows full task creator + task cards with 3-state cycle (inicio→progreso→completado). Right panel shows notes with inline editing. No icon picker in Cursos overview — icon picker is only in Notas Generales.
- **Task creator**: Large name input with elegant typography (`Inter Tight`), thin gradient divider under it, auto-resizing description textarea. Date picker (date + optional time) with days-remaining counter (<0 → red "Atrasada Xd", 0 → "Hoy", ≤3 → amber, else → course color). Priority selector (high/medium/low) with colored `Flag` icon. Outline-style `PlusCircle` add button (colored border, transparent bg, 40×40). Date inputs 42px height / 170px width / 13px font.
- **Task cards (overview)**: No priority-colored left border. Completed tasks render at bottom with strikethrough title, dimmed opacity, green checkmark. Section header has an eye toggle to show/hide completed tasks.
- **Temas+Archivos mode**: 4-card stats row (Temas, Materiales, Dominados, Tareas). Groups & topics listed left, file uploads on right. "Añadir Tema" and "Añadir Agrupación" buttons at top. PDF preview modal for resources.
- **3-state task cycle**: Empty circle (inicio), blue dot (progreso), green check (completado). Visual indicators in both overview and detail view.
- **Note interaction (Cursos — Notes tab)**: Inline editing with `FormatToolbar` (shared). Expanded view: contentEditable body + star/delete icons. Auto-save: debounced (800ms) + onBlur. Collapsed view shows content preview + pin star icon.
- **Apuntes overview**: Block‑style notes in the "Mis apuntes" section. No title shown anywhere — content is displayed directly as rich HTML (max 4 lines preview via `-webkit-line-clamp: 4`). Click expands (not editable) with icon-only action buttons on the right: Star (destacar), Pencil (editar), Trash2 (eliminar), X (cerrar). Double‑click anywhere on expanded note enters edit mode with `FormatToolbar` at top. Click outside or X closes. Action buttons (Destacar/Eliminar) remain visible during editing. Delete confirmation via inline "¿Eliminar apunte?" bar. Drag‑and‑drop reordering via `@dnd-kit/sortable`. Eye icon next to `+` toggles aesthetic creation-date display per note (uses `date-fns` `format` with `es` locale). Auto‑save on blur + unmount. Creation via `+` button opens in edit mode immediately.
- **NoteEditor component** (`Cursos.tsx`): Uses `editable` boolean prop (replaces old `showToolbar`/`readOnly`). Internal `activeFormats` state polls `document.queryCommandState` during mouse/key events and passes to `FormatToolbar` for per-button active highlighting. Double‑Enter inside a list exits list mode (`lastEnterEmpty` ref). Tab inserts non‑breaking spaces. Backspace merges adjacent blocks. Markdown triggers (`#`, `##`, `###`, `-`, `*`, `1.`) activate on Space. Image paste support via `FileReader` + `execCommand('insertHTML')`.
- **Shared FormatToolbar**: `src/components/ui/FormatToolbar.tsx` — Bold, Italic, Underline, Strikethrough, List, Ordered List, Heading 3, Highlight, Align Left, Align Center. Accepts `onFormat` callback, optional `color` prop, optional `toolbarItems` (filter which buttons render), and optional `activeFormats: Record<string, boolean>` (buttons show tinted active state when the format is toggled). Used by both Notes tab and Apuntes overview.
- **Course color selector**: 28px swatches with gradient, check mark overlay, glow ring on selected.
- **Notas title**: Bigger (42px, weight 200) with `StickyNote` icon and glow effect.
- **Sidebar collapsed**: Restored original popup behavior (collapsed shows popup instead of navigating to CursosHub). Popup centered vertically via `top: 50%; transform: translateY(-50%)` with `max-height: min(400px, 70vh); overflow-y: auto` to prevent off-screen overflow.
- **Sidebar navigation fix**: `useEffect` in `Cursos` component syncs `initialCourseId` prop to internal `selectedCourseId` state, resetting tabs and overview state when the prop changes. Fixes course switching from collapsed sidebar popup.

## Notas — Sidebar & Context Header
### Carpetas
- Each folder shows a **neutral count badge** (`var(--text-tertiary)` / `var(--bg-hover)`), no color tint.
- No edit button in sidebar. Instead, when a folder is selected, a **context header** appears at the top of the main panel showing the folder name + a `PenTool` edit button (uses folder color for visibility on any background).
- PenTool opens the folder edit modal (rename + color grid + **Eliminar carpeta** button inside).
- **Course folder delete**: soft-hide (folder stays in DB, hidden from sidebar list). Restore button appears in the **Papelera section** ("Carpetas ocultas").
- Regular folder delete: moves notes to papelera, calls `deleteNoteFolder`.

### Icon Picker (Notas Generales)
- Only accessible in Notas Generales (not in Cursos overview).
- Shows ~280+ lucide-react icons in a scrollable grid (7 columns).
- **Changes both icon AND color**: color swatches shown inline below icon grid. Preview updates live showing selected icon + selected color. Two-step flow: select icon + color, then "Seleccionar" button commits both to `coverImage` + `coverColor`.
- Color swatches are the same 20 used across Owa (course colors, tag colors, note folder colors). Uses `onNoteColorChange` to persist.
- "Seleccionar" or "OK" to confirm.

### Notas — Notes Tab
- No title header; a `StickyNote` icon button at top to create a new note.
- Clicking a note in the list opens an expanded editing view with title + rich text toolbar (bold, italic, lists, etc.).
- Edit/star/delete buttons appear at the top when editing.
- Auto-saves on blur; title + content preview shown in collapsed card view.
- Uses course folder for organization (falls back to a tag if no folder exists).
- **Tag colors** fall back to `note.courseColor` instead of `note.coverColor` — tags are colored by course context, not by the note's individual icon color.

### Etiquetas
- Each tag shows a `Hash` icon with just the tag's color, **no background container**.
- `Palette` button (replaces `MoreHorizontal`) opens a **full edit modal** (rename input + color grid + delete button).
- Color reactivity fixed: `tagColors` useMemo depends on `tagColorEdit` (re-reads localStorage on modal close).
- **Tag rename** updates the tag name across all notes and migrates custom colors in localStorage.
- Context header also shows `Hash` + tag name + edit button when a tag is selected in the main panel.

## Music — Smart Shuffle & Context Preservation
- **Weighted shuffle**: `weightedShuffle` in AppContext replaces `shuffleArray` — weight = `1/(playCount+1)` so unplayed tracks dominate over played ones. Used in all 4 queue-refill paths.
- **Context preservation**: `handlePlayWithTabCb` removed auto-detection (no longer auto-switches tabs). Single-track clicks from artista/playlist views now call `setQueueSource({ pool: artistTracks / plTracks })`, so "next" plays within the same context.
- **Statistics coherence**: `weeklyMusicTime` and `monthlyMusicTime` are now computed from `dailyMusicTime` via `useMemo` instead of separate accumulators, eliminating the week > month drift. Weekly/monthly state variables and reset logic removed.

## Background Image & Panel Opacity
- **`bg.jpg`** set as the `<html>` background via `coverPreview` state in `AppContext`. The `<html>` element gets `data-has-bg` and a `background-image: url(...)` style when a valid coverPath is detected.
- **Panel opacity slider** controls `--ui-opacity` (0.3–1.0, default 0.85) — only applies when `data-has-bg` is active. When no bg is set, all panels stay fully opaque.
- **Under `[data-has-bg]`**: `.page-container` and `.sidebar` get a translucent `--bg-base` layer + `backdrop-filter` blur — this is the main dimming layer controlled by the opacity slider.
- **`.bento-card` under `[data-has-bg]`**: `background: color-mix(in srgb, var(--bg-elevated-raw) 15%, transparent) !important` — subtle fill (15% elevated color) + `backdrop-filter` blur. Panels show the bg through but have enough base for content readability. Borders remain visible (inline `border-color` overridden by the base `.bento-card` CSS).
- **No global `--bg-elevated` override**: Form controls (inputs, selects, buttons, chips) that use `background: var(--bg-elevated)` stay fully opaque for usability. Only `.bento-card` panels become translucent.
- **All panel blocks across the app have `bento-card` class**: Inicio (7 grid blocks + 2 modals), Ajustes (27 panels + sidebar + 4 modals), Estudio (1 panel + 5 modals), Música (14 panels + 2 artist/playlist cards + YouTube modal), Tareas (list table + 6 modals), CursosHub (2 modals).
- **`--bg-elevated-raw`** defined in each theme as a reference value (not currently used in overrides).
- **backdrop-filter blur** on `.page-container`, `.sidebar`, `.bento-card`, and any element with inline `--bg-elevated`/`--bg-surface` styles via `[data-has-bg]` rules.
- **`.estudio-stats`** overrides `--ui-opacity: 0.92` for legibility.
- **Inicio stat blocks** redesigned with premium styling: small uppercase label, big value, thin colored right-border accent, subtle icon glow, compact layout.
- **Inicio mobile**: Racha stat card uses `col-span-2 lg:col-span-1` to prevent empty column on mobile.
