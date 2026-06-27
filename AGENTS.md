# Build
- `pnpm run build` (runs `tsc && vite build`)

# Summary

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

## Download Sidebar (Musica)
- Active items show progress bar + Cancel button (no X)
- Completed/cancelled/error items show X to delete
- Cancel sets status to `'cancelled'`, then X appears
- Build passes with zero errors

## Notas — Sidebar & Context Header
### Carpetas
- Each folder shows a **neutral count badge** (`var(--text-tertiary)` / `var(--bg-hover)`), no color tint.
- No edit button in sidebar. Instead, when a folder is selected, a **context header** appears at the top of the main panel showing the folder name + a `PenTool` edit button (uses folder color for visibility on any background).
- PenTool opens the folder edit modal (rename + color grid + **Eliminar carpeta** button inside).
- **Course folder delete**: soft-hide (folder stays in DB, hidden from sidebar list). Restore button appears in the **Papelera section** ("Carpetas ocultas").
- Regular folder delete: moves notes to papelera, calls `deleteNoteFolder`.

### Etiquetas
- Each tag shows a `Hash` icon with just the tag's color, **no background container**.
- `Palette` button (replaces `MoreHorizontal`) opens a **full edit modal** (rename input + color grid + delete button).
- Color reactivity fixed: `tagColors` useMemo depends on `tagColorEdit` (re-reads localStorage on modal close).
- **Tag rename** updates the tag name across all notes and migrates custom colors in localStorage.
- Context header also shows `Hash` + tag name + edit button when a tag is selected in the main panel.
