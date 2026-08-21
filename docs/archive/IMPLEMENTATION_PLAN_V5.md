# OWA Studio Implementation Plan V5
*Ultra-professional refactoring with all design skills, design.md, agent.md guidelines*

## Prerequisites Met
- ✅ Build succeeds with 0 errors
- ✅ 4 design skills applied (vercel-react-best-practices, web-design-guidelines, frontend-design, remotion-best-practices)
- ✅ Left sidebar with diagonal cut, collapse functionality
- ✅ Two-column layout base system
- ✅ Design system in index.css

## Execution Order
1. **Inicio View** (First priority)
2. **Tareas View** (Second)
3. **Notas View** (Third)
4. **Estudio View** (Fourth)
5. **Música View** (Fifth)
6. **Planificación View** (Sixth)
7. **Cursos View** (Seventh)
8. **Ajustes View** (Eighth)
9. **Tauri 2.0 Floating Timer** (Ninth)
10. **Final Validation** (Build + Lint + Typecheck)

---

## 1. Inicio View Refactoring
### Requirements
- 30 blocks: minimal size, reduced, not too large
- Pomodoro/Cronometro: right side of blocks, switch based on last activated
- Other blocks: better organization below
- Time/Minutes: much larger than current
- Date: prominent display
- Remove "Hola Avery" and phrase, replace with "Hola MaxCB" small above/below time
- Enfoque block: move below Pomodoro/Cronometro
- Responsive to all screen sizes
- Timer synced with real Enfoque timer
- Remove courses/materias from Inicio
- Remove bottom navigation bar from Inicio

### Technical Steps
1. Redesign grid layout for Inicio:
   - Top section: Large time + date + "Hola MaxCB" small
   - Middle section: 30 minimal blocks (left) + Pomodoro/Cronometro + Enfoque (right)
   - Bottom section: Other organized blocks
2. Implement last-activated timer switch logic
3. Add responsive breakpoints for all screen sizes
4. Sync timer with Enfoque module
5. Remove unnecessary elements as requested

---

## 2. Tareas View Refactoring
### Requirements
- Robust task management with pending/completed states
- No single-click completion: border animation on click, then confirm
- Task fields: Name, Course, Important/Urgent flags
- Expandable right panel for: Subtasks, Text, Files (any type), Delivery date
- Task display: Name, Course, Remaining days ("Faltan x días", "Mañana", "Contratiempo" if overdue)
- Important/Urgent flags: hidden in main view, appear in right expandable panel
- Right panel shows: Files, Studied time, Subtasks, Other data
- Check type: Simple (single check, no subtasks) or Progressive (3 levels, subtasks allowed)
- Simple check: No subtasks, but allows files, no view filters
- Progressive check: 3 levels, subtasks, appears in views
- View modes:
  - Level view
  - Block view (Urgent+Important, Important only, Urgent only, Neither)
  - Kanban view (functional)
- Favorites appear first, recent notes below

### Technical Steps
1. Add task type (simple/progressive) to data model
2. Implement border animation on task click
3. Create expandable right panel component
4. Add file upload (any type) with path storage
5. Implement day calculation logic (remaining/overdue)
6. Create 3 view mode components
7. Add subtask system for progressive tasks
8. Sync with courses data

---

## 3. Notas View Refactoring
### Requirements
- Left sticky sidebar: Folders, no "Recent Notes"
- Notes display as book-style blocks with spine (bookshelf aesthetic)
- Click opens full note in main area
- Note options: Pin, Move folder, Delete, Upload to folder
- Rich text editor: Full toolbar (headers, spacing, numbering, bullets, line breaks, images (expand on click), quotes, bold, italic, code, etc.)
- Auto-save like Word/Google Docs on every movement
- Folders: Auto-created per course, manual folders with color picker + name
- Notes: Favorites first, then recent, then all
- Create note: Auto-save, assign to folder

### Technical Steps
1. Create left folder sidebar component
2. Implement book-style note card component
3. Add rich text editor (use TipTap or Slate for React)
4. Implement auto-save with debounce
5. Add folder management (create, edit, delete, color picker)
6. Auto-create course folders on course creation
7. Add note options dropdown
8. Image expand on click functionality

---

## 4. Estudio View Refactoring
### Requirements
- Large timer top left center: Only Pomodoro/Cronometro options
- Remove shortcuts and music from top
- Better timer type selector placement
- Session metrics: Studied time, concentration (calculated from pauses: total session time - pause time)
- Remove "Sessions" text, replace with "Historial"
- Sync with tasks: Link task to timer, blocks changing timer type/switching tasks during session
- Task link: Shows task name + course, starts session, syncs time with task/course study time
- Unlink button: Only works when paused
- Remove recommended sounds section
- "Today's Goal" above session metrics
- "Consejo" removed, "Estado" below timer
- Timer buttons: Play/Pause, Reset (no complete, session must finish naturally or cronometro runs full duration)
- Bottom: Unlink course button (functional)

### Technical Steps
1. Redesign Estudio layout with large centered timer
2. Implement concentration calculation logic
3. Add task linking system with sync
4. Block timer type change/task switch during active session
5. Add session historial component
6. Fix button functionality (play/pause/reset/unlink)
7. Remove unnecessary sections as requested

---

## 5. Música View Refactoring
### Requirements
- Right sidebar: Playlists (Spotify-style interface)
- Create playlist: Upload cover, name
- Main view: Player top, Favorites above all
- Remove ambient sounds section
- Upload from gallery (local files)
- YouTube integration: Paste URL (playlist/song), auto-detect cover + audio, save to localStorage
- Playlist view: Cover + name, blurred background matching cover
- Add song to playlist: Choose from uploaded, computer, or YouTube
- Song views: List view (name, duration, favorite, 3-dot menu: edit, delete, add to other playlist)
- Edit song: Name, cover
- Ultra-functional UI/UX

### Technical Steps
1. Create right playlist sidebar
2. Implement localStorage for YouTube downloads
3. Add YouTube URL parser (use youtube-dl or similar library, or API)
4. Create Spotify-style player component
5. Add song upload from local/YouTube
6. Implement playlist management (create, edit, delete, add songs)
7. Song list view with 3-dot menu
8. Favorites system

---

## 6. Planificación View Refactoring
### Requirements
- Top: Events, Next event data
- Below: Spaced calendar, synced daily with system date, never fails
- View modes: Daily, Weekly, Monthly (all functional)
- Weekly summary: Weekly study time, past events removed after 3 days
- Daily view: Select date, blocks show events in time range (e.g., 8-11am blocks from 8 to 11)
- Monthly view: Select date, add tags
- Create event: Start/end time, all-day option, name, details, files (copy path, open in explorer; PDF opens in-app viewer)
- Multiple file uploads allowed
- Link to course/task
- Event overlap: Show side-by-side in same time block
- Click event: Right sidebar with details, edit, delete
- Google Calendar-style functionality, no errors

### Technical Steps
1. Implement 3 view modes (daily/weekly/monthly)
2. Add calendar sync with system date
3. Create event creation form with all fields
4. PDF viewer integration (use react-pdf)
5. Event overlap logic for daily view
6. Right sidebar event detail/edit component
7. File upload with path storage
8. Course/task linking for events

---

## 7. Cursos View Refactoring
### Requirements
- Collapsible course list: Expand/collapse, reorder via drag
- Add/Delete course button in list
- Add course: Edit name, upload cover, or choose color if no cover
- Course view: Expand below or open in main area
- Course summary: Study time (from linked tasks), Number of notes, no other data
- Below summary: Course tasks (synced with Tareas view: progress updates, completion, deletion)
- Add task from course view, syncs to Tareas
- Course notes: Preview, add note (links to Notas view)
- Course resources: Add resource, preview in-app, functional
- Focus section: Link tasks to session (only when Enfoque session active, blocked otherwise)
- Course review: Techniques (flashcards, practice tests, etc.) functional, productive
- Remove unnecessary sections, add 3-dot menu: Edit, Delete
- Each course has its own section, robust logic

### Technical Steps
1. Create collapsible course list with drag reorder
2. Course summary component with study time/notes count
3. Sync tasks/notes between Cursos and Tareas/Notas
4. Add focus section with task linking
5. Implement review techniques (flashcards, etc.)
6. Resource preview system
7. 3-dot menu for edit/delete
8. Robust data sync across modules

---

## 8. Ajustes View Refactoring
### Requirements
- Change name, profile photo
- Visual theme: Light/Dark/System (functional)
- App color: Change primary color (multiple options)
- Data management: Export/Import data (functional)
- Daily goal time setting
- Timer config: Pomodoro time, sessions, short/long break (functional, synced)
- Notifications: Functional
- Remove "MaxCB Enfoque" from top bar, remove web description
- Ultra-functional UI

### Technical Steps
1. Theme switcher (light/dark/system) with CSS custom properties
2. Primary color picker
3. Data export/import (JSON format)
4. Timer config form with validation
5. Notification permission request
6. Profile photo upload
7. Daily goal setting
8. Remove unnecessary elements

---

## 9. Tauri 2.0 Floating Timer
### Requirements
- External floating window (not inside app, separate native window)
- Always on top
- Synced with Enfoque timer (runs in background always)
- Syncs with weekly study time, per course, daily, etc.
- Top: Color indicator (green = rest, red = focus, etc.)
- Rectangular/square shape
- Button to toggle window border (native Windows border)
- Draggable from any part of the window
- Ultra-aesthetic design
- Syncs with all study time metrics

### Technical Steps
1. Configure Tauri 2.0 to create external floating window
2. Implement always-on-top flag
3. Sync timer state with main app via Tauri events
4. Background timer logic (runs even when app is closed)
5. Color indicator based on timer state
6. Draggable window implementation
7. Border toggle button
8. Sync with all study metrics

---

## 10. Final Validation
1. Run `npm run build` → 0 errors
2. Run `npm run lint` → 0 errors
3. Run `npm run typecheck` → 0 errors
4. Test all functionality manually
5. Verify responsive design on all screen sizes
6. Check accessibility (aria-labels, focus-visible, reduced-motion)

---

## Skills Applied
- vercel-react-best-practices: Eliminate waterfalls, optimize re-renders, useMemo/useCallback
- web-design-guidelines: Accessibility, focus states, reduced motion, semantic HTML
- frontend-design: Professional UI, spacing, typography, visual hierarchy
- remotion-best-practices: Smooth animations, transitions
- design.md: Follow all design guidelines
- agent.md: Follow all agent instructions

## Notes
- All data stored in localStorage or Tauri store (persistent)
- No external databases, all local
- Every component must be typed with TypeScript
- All CSS uses design system variables from index.css
- All animations use `cubic-bezier(0.16, 1, 0.3, 1)` for smoothness
- All interactive elements have `:focus-visible` outlines
- All animations respect `prefers-reduced-motion`

Let's execute step by step, starting with Inicio View.