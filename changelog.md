# Changelog

User-facing changes for each release. Every app upgrade adds a new entry here.

List shared (all platforms) changes first — either as bullets directly under
`## vX.Y.Z` or under thematic `###` headings (e.g. FOCUS MODE, SETTINGS).
Then add platform-only notes under headings **only when needed**:

`#### Windows` / `#### macOS` / `#### Linux`

(Optional `### BY PLATFORM` scaffold is fine; do **not** use a `#### DESKTOP`
layer — shared desktop notes belong in the main section.)

Bullets use `- **Short title.** Longer description.`

Store What’s new (`scripts/changelog-to-store-whats-new.js`) always uses the
fixed intro (`Hi folks,` / `This update comes with some helpful improvements!`)
plus filtered bullets plus sign-off — never a custom headline blockquote.

- `--platform windows` — shared + `#### Windows`
- `--platform macos` — shared + `#### macOS`
- `--platform linux` — shared + `#### Linux`
- Always skips `Version:` lines and release-engineering bullets

## v2.8.0

### BRANDING

- **Meet Digital Habits: To-Do!** Renamed from **ReDD To-Do** as part of
  the move from the Reduce Digital Distraction (ReDD) Project to
  **Centre for Digital Habits** ([digitalhabits.org](https://digitalhabits.org)).

- **Version:** 2.8.0 (macOS and Windows).

## v2.7.9

### TASK MENUS

- **Smarter task menus.** Task option menus open above the ellipsis when they’d
  be cut off by the window edge or sticky footer, and stay readable over the
  add-task bar.

### DONE SECTION

- **Done chevron.** The Done section uses a rotating chevron (right when
  collapsed, down when expanded), with consistent spacing under the add-task
  bar in both states.

- **Version:** 2.7.9 (macOS and Windows).

## v2.7.8

### OPENING PAGE

- **Opening page.** Minor UI layout improvements on the EULA / opening screen
  (clearer attribution copy, no italics, slightly smaller footer type).

- **Version:** 2.7.8 (macOS and Windows).

## v2.7.7

### SETTINGS & BRANDING

- **Centre for Digital Habits.** EULA, footer, About, and Help links now point
  to digitalhabits.org and Centre for Digital Habits (same not-for-profit, new
  name).
- **Settings feedback.** Settings now includes a footer with links to open a
  GitHub issue or email the team.

### FOCUS MODE

- **Focus mode task switcher.** Switch between open tasks across lists without
  leaving focus mode — search by name, and use list tabs to browse other to-do
  lists.

### SYNC & FAVOURITES

- **Basecamp sync.** Syncing now pulls all pages of Basecamp to-dos and section
  groups, so longer lists are no longer truncated.
- **Favourites.** Adding a favourited task that isn’t on a local list parks it
  on a local Favourites list instead of dropping the favourite.

- **Version:** 2.7.7 (macOS and Windows).

## v2.7.6

### FOCUS MODE

- **Complete from focus mode.** When you finish a task from the focus panel, it
  now animates from its place in the task list into Done — not from the corner
  of the window.
- **Faster task completion.** The slide-into-Done animation starts right after
  the 🎉 appears, so you can complete several tasks in quick succession without
  waiting.

### BY PLATFORM

#### macOS

- **Focus mode reliability.** Completing tasks, tracking time, and editing
  notes in the focus panel no longer get lost when you quit or close the app.
  The focus window now saves changes without overwriting updates from the main
  window.
- **Basecamp connect (Mac App Store).** Connecting to Basecamp now works in the
  sandboxed Mac App Store build — Connect opens your browser, sign-in completes,
  and the app updates sync state correctly.
- **External links (Mac App Store).** Help menu links, Reminders privacy
  settings, and other in-app links that open in your browser now work reliably
  in the Mac App Store build.

- **Version:** 2.7.6 (macOS and Windows).

## v2.7.5

### SETTINGS

- **Backup export/import.** Settings backup now uses native save/open file
  dialogs on macOS and Windows, so export and import work reliably in the
  desktop app.
- **Zoom in Settings.** UI zoom controls moved from the footer into Settings →
  General (80–150%, default 100%). Keyboard shortcuts and the Window menu still
  work.

- **Version:** 2.7.5 (macOS and Windows).

## v2.7.4

- **Meet ReDD To-Do.** Enkelt: To-Do & Floating Task Pin has a new name — same
  calm todo app you love, now called ReDD To-Do. Your tasks, lists, planner
  data, and settings carry over — nothing else changes.

- **Version:** 2.7.4 (macOS and Windows).
