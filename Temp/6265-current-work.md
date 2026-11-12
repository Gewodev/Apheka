# Work in progress 6.26.5 — 2026-11-10

User keeps expanding this task; latest full request covers all items below. Finish implementation, verification and installer, then give five useful future feature ideas. Do not pretend zero bugs/GPU certainty. Do not spawn agents (developer prohibits). Graph-first discovery required; project D-VIBE-Owa_Studio, stale graph often returns no relevant symbols, then read files directly.

## Baseline / constraints
- HEAD e9a0a48 = 6.26.4. Installed personal EXE verified 6.26.4; NEVER replaced or modified personal data during prep. QA uses com.apheka.qa.
- Unrelated dirty files: extension/background.js, block.html, manifest.json, popup.html, scripts/test-latex.ts. Preserve and never stage.
- Version bumped to 6.26.5 in package.json and four native manifests (own Cargo.lock only). Header/sidebar installer art regenerated once by canceled build; final build regenerates.
- Full final build was STARTED then CANCELED when user added UI work. Status release/build-6.26.5.status.json still says running; process is not an active build. Rerun scripts/build-apheka-6265.ps1 only after all product changes frozen. Build ~12 min. No installer 6.26.5 ready yet.
- Current Vite QA 1422 running session 70010 (escalated); browser/loopback commands also require escalated. Debug native QA stopped after cursor tests. Can restart: CARGO_INCREMENTAL=0, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224, pnpm exec tauri dev --config scripts/tauri-qa.json --no-watch, redirected release/native-6265.log. Final native source changes after earlier test require rebuilding debug if native notifications changed.
- Browser Playwright module C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright, channel msedge headless. native CDP 9224 when QA running. Cursor read-only probe scripts/read-native-pointer.ps1.
- Skills read: codebase-memory; impeccable fully context-loaded PRODUCT.md/DESIGN.md + reference/product.md (product UI, preserve existing dark/light tokens). No extra setup needed. Computer-use new skill 26.1103.60933 and guidance/confirmations read; sky through node_repl initialized. CUA selected debug QA but user concurrently active often blocks physical inputs; do not fight user. A correct QA fullscreen screenshot was observed with visible cursor, but no complete physical mouse-movement sequence. Do NOT claim GPU pixels verified.

## DONE product changes (not committed yet)
1. Cursor root lifecycle:
   - NEW src-tauri/src/floating_timer.rs: shared async mutex serializes open/close; toggle_floating_timer/close_floating_timer commands. Destroy (not close request/hide), await registry absence bounded 3s. New timer native opaque, shadow false, owner main on Windows, visible then focus only if main focused.
   - main.rs registers module and commands. Estudio.tsx study toggle now calls native coordinator, no JS hide/show/5s false-success timeout.
   - FloatingTimer.tsx X is a real button, invokes close command, error+retry visible, prevents dragging from X.
   - workspace_pointer.rs ignores deferred old close repair if a new floating-timer exists. Prior 6.26.4 native pointer repair retained.
   - Debug native final source compiled successfully. 12 actual Estudio/X destruction/reopen cycles (max/full/restored), blocking close-request listener bypassed, registry absent and old WebView target closed, chrono progress preserved, six concurrent closes idempotent. release/qa-6265-native-lifecycle.json (3 positive native visibility samples; others skipped outside foreground).
   - Extra 12 fullscreen-only cycles: native isFullscreen confirmed before and after every close, pointermove renderer input confirmed after each, close times 108..312ms avg166.92 includes automation/IPC. release/qa-6265-fullscreen.json. Only 1 sample had real foreground+pointer over QA and cursor visible; 11 skipped. Do not claim all 12 hardware visibility checked.
   - Close failure/retry + keyboard Enter + no drag from X passed mocked browser component test, release/qa-6265-close-retry.json.
   - Scripts: test-native-timer-lifecycle-6265.cjs (APHEKA_QA_FULLSCREEN_ONLY=1 for extra report), apheka-timer-lifecycle-preview.html/harness.tsx renders real Estudio+AppProvider, apheka-floating-component-preview.html, test-timer-close-retry-6265.cjs.

2. Course notes basic UI changed:
   - Cursos.tsx overview .course-note-block removes title summary completely, adds data-note-id/data-expanded/custom --note-accent.
   - Preview content first, footer date/highlight + Leer apunte button. Existing editor, save/delete/star/drag/permissions unchanged.
   - input-polish.css typography, table/image bounds, footer. USER LATEST asks mosaic layout + images use better space (screenshot old small image with large blank). Still need refine image preview: existing inline img width150px remains; CSS should override width for images within preview (not underlying saved HTML), maybe mosaic CSS columns/grid adaptive. Need visual QA and actual edit/save/reload checks.

3. Settings/commands/schedule UI added but UNTESTED:
   - Ajustes.tsx adds Comandos category, descriptive category rail, main category heading, retains all original category contents.
   - input-polish.css reorganizes settings desktop grid 220px left rail, main +174px local outline, responsive <=1100 hide outline and <=700 horizontal categories. Need visual tests for all categories and empty spaces.
   - NEW scheduleShortcut.ts: Ctrl+Shift+H default, alternatives Ctrl+Alt+H, Alt+H, disabled. Ignores repeated/composing/AltGraph/modifier conflicts.
   - NEW SchedulePeek.tsx global host: toggles internal right drawer on configured shortcut/event, skips input and other modal, loads readonly schedule images IDB owa_sched_images_v3 only on open; no persistence edits/no native window. Empty links Planificador.
   - NEW CommandsSettings.tsx renders all 11 actions + shortcut/reference.
   - NEW AppCommandsPanel.tsx global Ctrl+Shift+P independent portal; create note/apunte by course, open note filtered by course, create task/course/priority, navigate views and new event/schedule. Uses existing onOpenNote/onOpenTask. App.tsx mounts hosts. Planificacion.tsx listens for pending new-event and schedule events.
   - Last tsc had errors addTask returns void and priority must high/medium/low. Fixed AppCommandsPanel with useAppSnapshot before-ID set after flush to identify created task; priority English state/options. Current tsc session70500 was running; MUST poll/check compilation after all changes. Options were replaced via PS fixed literal strings.
   - BUG TO REVIEW: CommandsSettings non-form action buttons currently dispatch 'menu', causing extra menu click instead of direct command. Can improve host/props direct actions. AppCommandsPanel form select still check English option values and all access paths.
   - SchedulePeek IDB errors currently caught silently to empty; add explicit meaningful error if worthwhile, avoid loops. Date parsing/cache no polling.

4. New Event styling added:
   - EventModal.tsx style custom --event-accent=color.
   - input-polish.css event header tile/color, date/time groups, presets, responsive styles. Logic unchanged. Needs browser visual + save recurrence tests at 420/768/1440.

5. Task picker algorithm changed, UNTESTED:
   - taskIntelligence.ts studyTaskCandidates excludes parents with only completed/untitled pending subtasks and nonfinite scores; near-best band same urgency/importance now up to24 (was6 permanent tie starvation).
   - chooseStudyTask uses fresh candidates outside recent history, avoids immediate repeat if alternatives, smooth exponential weight plus small course alternation/progress signals.
   - TaskStudyPicker.tsx decorative reel only eligible candidates; recent up to24 unique; animation timer independent 1750ms, Jev response cannot change selection after settled/user sees result or reselect recent item. Jev requests still limited6 in jev.ts. Existing assessment already calculates total/progress/remaining, deadlines, workload, planned sessions/course balance. Need focused tests and actual picker with slow Jev mock, no performance unit tests (user preference).

6. Music changes in progress:
   - NEW SongArtwork.tsx uses metadata coverImage then coverUrl then exact YouTube video thumbnail fallback (catalogId ytm:11char), supports native Windows local image paths convertFileSrc. onError tries next source, lazy images. Never fetch unrelated placeholder. Need integrate and verify.
   - MusicLibrary.tsx imports SongArtwork and replaced inline row image/fallback with component (applies Favorites too); old art helper may now unused (tsconfig noUnused? remove if error).
   - MusicDiscover.tsx recommendation prefs now tracks.filter(isLibraryTrack); musicPreferences.ts splits confident comma/semicolon/feat/with credits (does NOT split &/y bands), weights saved tracks2 and favorites6, preserving artist pin/library separation. User says 'preferencias', likely Favorites/recommendations; improve shared art without auto-pinning artists.
   - Need CSS .song-artwork size/image fit; perhaps integrate mini GlobalPlayer/queue for consistent covers, but do not invent covers for local files lacking metadata.

7. Analytics changes in progress:
   - AnalyticsDrawer.tsx edge right offset now shared min(580px,calc(100% -16px)) to match actual CSS panel width; prior inline min(50vw,680px) caused circled gap in screenshot.
   - Edge button class analytics-edge-handle + aria-label, panel data-open.
   - Still need simplify glow/blur edge handle, enhance tasks status chart and flow layout. Existing FlowSVG already per-course stacked status gauges (not old Sankey). Preserve truthful counts.
   - USER wants lateral more blurred: apply scoped backdrop only data-open=true and SchedulePeek open, bounded ~14..18px respecting opacity; no full app perpetual filters.

## NOT YET IMPLEMENTED latest requests
8. Course planner task linking:
   - PlannedSession interface AppContext.tsx:354 currently NO taskId. Add optional taskId.
   - CourseSessionDraft in cursos/CourseSessionDialog.tsx lacks taskId. Can add optional field and useAppSlice(['tasks']) inside dialog filtering same course; PlanSelectDropdown options, permit existing linked expired/completed with label, prevent invalid NEW links (taskLinkUnavailable). Add course tasks selector.
   - Cursos.tsx:7323 passes initialValue from planEdit state; include taskId from plannedSessions.find(id===planEditId)?.taskId; onSave payload spreads draft already, normalize empty to undefined. Editing should preserve unrelated fields.
   - CourseSessionPreview.tsx currently only group/topic/materials; useAppSlice(['tasks','setFocusedTaskId','setNavigateTo']) lightweight inside preview; show linked task title + deadline relative/overdue/completed and action to actual task detail. Missing/deleted task explicit, no stale links. Props can stay unchanged.
   - CourseSessionDialog focus trap currently selects button/input only; new select should be included.
9. Monthly planner sessions:
   - Planificacion.tsx month cell ~1270 renders events/tasks but omitted sessions. getPlannedSessionsForDate(iso) already correct recurrence helpers; use its rows as distinct session blocks, stop propagation and setSelectedItem({type:'plansession',session:s}). Current cell fixed130px, 3 events+3 tasks overflows; compact shared preview count and +more totals should include sessions. Daily drawer already receives sessions.
10. Native notifications action buttons:
   - src-tauri/src/native_notifications.rs TargetKind enum Task/Event/Session/Study/Tasks/Settings/Music/Downloads; target.kind label maps, one add_button(label,'open'), activation emits target to main. Adding new kind Studybreak/Studynext/Habits is easiest, IDs optional for these, validated enum. Need action vs body click distinction: body click should only navigate; explicit action button executes. Could add target.action optional enum and on_activated only set action in emitted target when clicked action, body 'open'/empty clears action. Must not run state mutations on toast-dismiss/X.
   - TS NotificationTarget in lib/notifications.ts same enum. notifySessionComplete -> currently default study, notifyBreakOver -> default study. Add explicit action descriptors/buttons.
   - NotificationNavigation.tsx uses useAppSnapshot, listen notification-open, routes study to estudio, session/event to flujo. Need pending action + dispatch to Estudio, action valid only if current state permits; no duplicate timer sessions. Ideally route a stable event/ref handler to existing Estudio handleEvalAndStartRest() (line202) and existing useTimer toggle (need inspect hooks/useTimer and Estudio timer controls). Must not duplicate session logging. Existing handleEvalAndStartRest calls incrementPomodoroSessions/setIsRest(true)/setIsTimerActive(true)/sessionTime0 (only pomodoro), closes evaluation/prompts. Break complete effect line440..470 already sets isRest=false/sessionTime0/timerActive=false, so 'start session' uses useTimer.toggle when no existing active session, valid stale notification guard.
11. Habits (latest big new scope):
   - Improve current style slightly, keep recognizable. Optional water and exercise modes: water amount, exercise minutes fill illustration/progress, persisted via existing habits logs/model, no destructive migration.
   - Predict user end-of-day from local activity patterns by weekday, remind1..2h before if habits unrecorded; no global surveillance or continuous per-pointer writes. Opt-in settings in Habits, safe fallback when insufficient history, explain confidence. Bounded local history, minute-level check, pause hidden/unmounted? Reminder must work App-level when habits not open but app running, no guarantee app closed. Reuse notification dedup + habits target/button.
12. Playlist links/import/UX (latest big scope):
   - Music Downloads pasting public Deezer/Spotify/YouTube Music playlist URLs should detect metadata/songs, preview full list then create own playlist preserving title/cover. Real providers/private links may require auth; do NOT invent catalog data or bypass access/DRM. Inspect existing native extractor, musicCollection and playlist modules before implementing. Primary official docs browse required if new APIs.
   - Improve MusicPlaylists aesthetics (no left bars, proper like/add buttons), persistent drag-and-drop order with whole card/row drag and no handle icon. Preserve IDs, artist-vs-library separation, explicit confirmation of imports, guard duplicates/no wrong tracks. Needs real/public provider test where possible and controlled fixtures, no user private keys.

## Remaining delivery steps
- Finish pending CSS/features above; run tsc, focused native tests if Rust notifications updated (CARGO_INCREMENTAL=0), browser real App fixtures for settings ALL7 categories, command creation/open links/courses and shortcut conflicts, readonly schedule, notes no-title mosaic/edit/save/reload/responsive, newevent/session/monthly, habit reminder/model, music artwork+playlist import/reorder, algorithm tests.
- No need redo all old 6.26.2 features; preserve previous Bruno migration and artists separate library rules.
- Write docs/APHEKA-6.26.5.md, finalizer script verifies reports/build/version/hash, AGENTS summary. Final build script same existing wrapper (already created) redirected release/build-6.26.5.log, must freeze product sources during ~12min build. Check source/resources stable via package-final. Versioned copy release/APHEKA_6.26.5_Instalador_x64.exe plus metadata docs/APHEKA-release-6.26.5.json.
- Git commit explicit own files, never add . or unrelated. No push. Final concise Spanish installer link, tested scope, and exactly 5 good future ideas as requested. Do not claim absolute zero bugs or all hardware tested.
