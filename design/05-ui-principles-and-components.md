# UI Principles and Components

This document defines the user interface principles and core UI components
for Tanda Forge. Its purpose is to ensure consistency, safety, and clarity
across all screens and devices.

The UI is treated as a *control surface for a live musical instrument*,
not as a generic media application.

Requirement identifiers: All requirement bullets and rule lists in this
document are identified as `UI-<section>.R<n>` in order under each section.
Sub-bullets use `UI-<section>.R<n>.<letter>`.

---

## UI-001 — Mode-Aware UI Design

The system operates in explicit modes (FR-060):

- UI-001.R0: Supported modes include Preparation Mode, Live/Performance Mode, Edit
  Mode, and Maintenance / Recovery Mode (FR-086).

### Rules
- UI-001.R1: The current mode must always be visible.
- UI-001.R2: Mode changes must be explicit.
- UI-001.R3: UI affordances must change with mode.
- UI-001.R4: Unsafe actions must be impossible in Performance Mode, not merely discouraged.
  UI-001.R4.a: Free-browsing track click actions are disabled in Live mode except
  for headphone preview and the guarded one-off playback flow defined in
  UI-001.R4.c.
  UI-001.R4.b: Playlist tanda-start click is allowed in Live mode only when the
  main output is idle; this is a guarded start action rather than free browsing.
  UI-001.R4.c: When main output is idle in Live mode, clicking a track must open
  an in-app confirmation prompt before a one-off ad-hoc playback starts.

---

## UI-002 — Safety Over Convenience

In Performance Mode:
- UI-002.R1: No action may immediately change playback unless triggered via dedicated controls.
- UI-002.R2: Clicking or tapping arbitrary content (tracks, tandas) must not
  start playback, except for the guarded idle-only playlist tanda-start behavior
  defined in UI-001.R4.b and the guarded confirmed one-off track playback flow
  defined in UI-001.R4.c.
- UI-002.R3: Destructive or disruptive actions must be disabled or gated.
  UI-002.R3.a: Any allowed destructive action must present a clear warning and confirmation.
  UI-002.R3.b: Confirmation dialogs must use the app-styled in-app modal system
  (no native OS/Electron confirmation popups).

In Preparation Mode:
- UI-002.R4: Speed and exploration are prioritized.
- UI-002.R5: Immediate preview playback is allowed.

In Edit Mode:
- UI-002.R6: Clicking tracks plays them and opens the track editor for quick edits.

---

## UI-003 — Consistent Visual Language

The UI must use a consistent visual grammar:

- UI-003.R1: Tracks always look like tracks.
- UI-003.R2: Tandas always look like tandas.
- UI-003.R3: Cortinas are visually distinct from tanda tracks.
- UI-003.R4: Playback state is never ambiguous.

UI-003.R5: Icons, colors, and layout must convey meaning before text.

UI-003.R6: The UI must support both light and dark themes with a single-toggle control
available from the main screen.

UI-003.R7: All text and controls must meet WCAG AA contrast requirements in both themes.
UI-003.R7.a: Collection tabs/chips must remain high-contrast in dark mode.

UI-003.R8: The main screen defaults to fullscreen for live use.
UI-003.R9: The top bar includes a fullscreen toggle for quick access.
UI-003.R10: Status messages (errors, updates, warnings) are shown in the footer.
UI-003.R11: Control padding scales down on smaller viewports; padding yields before
overall control size.

---

## UI-004 — Language-Minimal Design

The UI should minimize reliance on written language.

- UI-004.R1: Icons are preferred over text where meaning is clear.
- UI-004.R2: Text is reserved for:
  - UI-004.R2.a: Song metadata.
  - UI-004.R2.b: User-defined labels.
  - UI-004.R2.c: Configuration descriptions.
- UI-004.R3: Core workflows must remain usable regardless of UI language.
- UI-004.R4: This supports international use and external documentation translation.

---

## UI-005 — Multi-Client Awareness

The UI may be open on multiple devices simultaneously.

Rules:
- UI-005.R1: Playback state is authoritative and shared.
- UI-005.R2: Visual progress indicators may be locally simulated.
- UI-005.R3: UI must tolerate brief desynchronization without confusion.

UI-005.R4: Read-only clients (e.g. display boards) must never present control affordances.

---

## UI-006 — Headless Operation

The system must not require any connected client in order to operate.

Rules:
- UI-006.R1: Playback must function with zero active UI clients.
- UI-006.R2: A saved playlist may be marked as "auto play".
- UI-006.R3: On startup, if an auto-play playlist is configured and the system is healthy,
  playback begins automatically.
- UI-006.R4: UI clients may connect or disconnect at any time without affecting playback.

UI-006.R5: The UI is a control and observation surface, not a prerequisite for operation.

---

## Core UI Components

The following components are mandatory and reusable across the system.

---

## UI-009 — Settings Panel

Settings are grouped into tabs (Library, System, etc.) and are accessible from
the main screen without leaving the playback context.

Rules:
- UI-009.R1: Missing library roots trigger a visible banner with a shortcut to
  the Library setup view in Settings rather than to unrelated diagnostics.
- UI-009.R2: Destructive settings (e.g. database reset) require explicit confirmation.
- UI-009.R3: Diagnostic information (scan issues) lives in a Diagnostics tab.
- UI-009.R3.a: Diagnostics include playback-leveling logs so gain/loudness
  decisions can be reviewed without leaving the app.
- UI-009.R3.b: The Library settings tab includes a one-click readiness verification
  action in the Library setup flow that reports pass/warn/fail plus data-readiness
  counts (duration, loudness/gain, informational zero-trim results, analysis
  errors, waveforms, and compressed-cache eligible/ready/missing totals). A
  valid zero-trim result must not block readiness, while a missing required
  compressed companion must be visible whenever it blocks readiness.
- UI-009.R3.c: The Library settings tab includes a visual setup flow that shows
  the normal root -> analysis -> verify path plus the optional legacy-migration
  branch rejoining before analysis.
- UI-009.R3.d: Each Library setup-flow step can be expanded/collapsed from the
  left-hand timeline, and the right-hand guidance panel mirrors the selected
  step by showing the actual related settings sections rather than duplicate
  proxy controls. Default state is roots-expanded only when no music root
  exists; otherwise all steps start collapsed.
- UI-009.R3.d.b: Clicking the left-hand step marker itself must also expand that
  step, matching the visual affordance of the marker. Marker clicks are
  expand-only and do not collapse an already open step.
- UI-009.R3.d.c: Completed-step tick graphics must remain visually centered
  within the circular marker button after any interaction/accessibility changes.
- UI-009.R3.d.a: That default roots expansion is applied only on entry to the
  Settings workflow; once the roots step is open it remains open during folder
  additions until the user explicitly collapses it via the timeline toggle or
  the in-panel completion action.
- UI-009.R3.e: The optional legacy-style review step includes an explicit
  completion action so the workflow can advance before legacy import.
- UI-009.R3.e.a: Activating that completion action scrolls the Settings view
  back to the top of the Library workflow so the user can immediately see the
  updated step state and next actions after reviewing a long style list.
- UI-009.R3.f: In the Library setup flow, single-purpose review actions such as
  `Show legacy styles` remain compact content-width controls rather than
  full-width bars so they read as buttons and are easy to spot.
- UI-009.R3.f.a: The roots panel includes a `Done configuring roots` action so
  operators can collapse that section after adding folders without using the
  left-hand step toggle.
- UI-009.R4: Playlist and System settings use multi-column layout on wide screens,
  collapsing to a single column on narrow screens.
- UI-009.R5: Display-board controls live in a dedicated Display Board settings tab.
- UI-009.R6: The playlist `Remaining Tandas` number field remains editable while
  the stop-after-N-tandas toggle is off, so DJs can set the count before
  enabling the feature and avoid transient display-board countdown flashes.
- UI-009.R7: The Library tab includes a dedicated manual `Re-parse Stored Metadata`
  card that rebuilds title, artist, artist-summary, and singer fields from
  stored scan tags without rerunning audio analysis, waveform generation, or
  compressed-cache work.

## UI-009b — Audience Display Board

- UI-009b.R1: The main track title uses the largest display text.
- UI-009b.R2: The normalized orchestra/artist line is smaller than the title.
- UI-009b.R2.a: The artist line should sit visually close to the title size
  while remaining clearly secondary.
- UI-009b.R3: When singer metadata is present, a third line appears below the
  artist in a smaller size again, prefixed by a localized noun label such as
  `Singer:`.
- UI-009b.R4: The progress text shows a short localized playing label plus the
  track position within the tanda, such as `Playing 2/4`.
- UI-009b.R5: Tanda guidance text uses short localized labels and may wrap onto
  two lines, with style on the first line and the related artist on the second.
- UI-009b.R6: The final-tanda countdown line is shown only when more than one
  tanda remains; once the actual final tanda starts, the board shows only the
  final warning text.

### UI-009a — Jump Index Bar

- UI-009a.R1: The jump index is presented as a horizontal bar above long lists.
- UI-009a.R2: It reflects the active sort column and updates when sort changes.
- UI-009a.R3: Jumping loads the list near that prefix and supports scrolling upward/downward
  with lazy paging.

## UI-010 — Track Row Component

Represents a single track.

Must display:
- UI-010.R4: Track title + artist on the first line.
- UI-010.R5: Secondary line with year plus any available metadata (album, genre, BPM, notes).
- UI-010.R6: Headphone preview icon (FR-061).
- UI-010.R7: Action controls for adding to clipboard/tanda where applicable.
- UI-010.R8: Action controls use compact, language-aware glyphs/letters with tooltips.
- UI-010.R9: Edit action (pencil or similar) to open the track editor.

Optional indicators:
- UI-010.R10: BPM.
- UI-010.R11: Rating.
- UI-010.R12: Similarity glyphs (see UI-030).

Behavior:
- UI-010.R13: In Preparation Mode, clicking plays preview.
- UI-010.R14: In Performance Mode, clicking selects only.
- UI-010.R14.a: In Edit Mode, clicking plays and opens the track editor automatically.
- UI-010.R15: Headphone icon toggles preview playback regardless of mode, when available.
- UI-010.R16: Headphone icon is hidden when no secondary output is configured.
- UI-010.R17: Search list rows are draggable into clipboard or playlist.
- UI-010.R18: Clipboard tracks are unique; adding a track that already exists is ignored.
- UI-010.R19: Active playback rows are visually highlighted in lists.
- UI-010.R20: Track actions are grouped in a context menu revealed by a "..." button on the right; the headphone preview stays visible when available.
- UI-010.R21: Track rows include a search (S) action that launches a similarity search for related tracks.

## UI-010a — Track Editor Modal

Tracks can be edited via an in-app modal editor.

Fields:
- UI-010a.R1: Title.
- UI-010a.R2: Artist.
- UI-010a.R2.a: Singer.
- UI-010a.R3: Album.
- UI-010a.R4: Album artist is not collected or displayed.
- UI-010a.R5: Year.
- UI-010a.R6: Style.
- UI-010a.R7: Notes (user-authored).
- UI-010a.R8: BPM (tap-tempo derived).

Tap Tempo:
- UI-010a.R9: First tap always resets the tap series.
- UI-010a.R10: If more than 3 seconds elapse without a tap, the series resets automatically.
- UI-010a.R11: BPM is computed from the average interval and rounded for display.

Controls:
- UI-010a.R12: Save persists the edits to the database.
- UI-010a.R13: Reset restores the original values for the current edit session.
- UI-010a.R14: Close dismisses the editor without applying additional edits.
- UI-010a.R15: The editor surface is opaque to keep the form readable over long lists.
- UI-010a.R16: In Edit mode, the editor is non-modal and updates in place as
  different tracks are clicked.
- UI-010a.R17: The track editor is non-modal in all modes and opens in the
  fixed in-place editor position (not centered modal overlay).
- UI-010a.R18: Each editable metadata field exposes a localized search-similar
  shortcut (`S`) that appends that field value to the current Search query.
- UI-010a.R19: Field-level search shortcuts are additive and de-duplicated so
  repeated clicks build composite queries without repeated tokens.
- UI-010a.R20: Unsaved-change confirmation appears only when the current form
  differs from the values displayed to the user; display-only normalization
  (for example rounded BPM presentation) must not trigger a discard warning on
  untouched tracks.
- UI-010a.R20.a: After a save leaves the editor open, the unsaved-change
  baseline must be refreshed from the values currently shown in the form so
  switching to another track does not immediately prompt for unchanged edits.

### UI-011 — Tanda Row Component

Represents a single tanda in search, clipboard, or playlist lists.

Collapsed view:
- UI-011.R1: Tanda name.
- UI-011.R2: Style badge (single-letter or multi-letter indicator to the left, e.g. `T/W`).
- UI-011.R3: Artist summary with counts (e.g. `Di Sarli(3), Troilo(1)`).
- UI-011.R4: Instrumental flag (or "Sung" if vocals are present).
- UI-011.R5: Years list (unique, comma-separated).

Expanded view:
- UI-011.R6: Summary shows name, style(s), instrumental flag, year range, and duration.
- UI-011.R7: Artist summary is omitted in expanded view.
- UI-011.R8: Shows the list of tracks with artist/title/year and duration.

Behavior:
- UI-011.R9: Expand/collapse is explicit and does not trigger playback.
- UI-011.R10: Clipboard tandas offer a "P" action to add to playlist.
- UI-011.R11: Search tandas offer a "C" action to add to clipboard.
- UI-011.R12: Search style filters mirror the selected tanda styles but remain editable and
  do not mutate the tanda until a track is added.
- UI-011.R13: Clipboard tandas include a remove control (R) that removes them from the
  active collection.
- UI-011.R14: Tanda action buttons are grouped on the far right edge to keep the summary readable.
  UI-011.R14.a: Action buttons use consistent sizing across contexts.
- UI-011.R14.b: The summary wraps only within the middle column between the style badge
  and action menu; badge and menu stay top-aligned.
- UI-011.R15: The style badge is the left-most visual element and is vertically centered
  alongside the summary text.
- UI-011.R16: In Preparation mode, clicking a track within a tanda plays that track.
- UI-011.R16.a: If headphones are available, tanda track lines expose a headphone
  preview control consistent with track rows.
- UI-011.R17: The tanda edit action (T) opens the tanda in the Tanda Designer for editing.
- UI-011.R18: The expand/collapse action uses a distinct control (E) separate from editing.
- UI-011.R19: In the playlist view, each tanda track line offers a send-to-clipboard
  action that clears the slot and places the track into the General collection.
- UI-011.R20: Tanda summaries may wrap, but never under the style badge or action buttons.
- UI-011.R21: Tanda actions are grouped in a context menu revealed by a "..." button on the right.
- UI-011.R22: When expanded, the style badge and action menu remain aligned with the summary line (top-aligned).
- UI-011.R23: Tanda rows include a search (S) action that launches a similarity search for related tracks.
- UI-011.R24: Tanda track action buttons align to the far right edge of the tanda row.
- UI-011.R25: In expanded search results, tanda track detail menus include a localized
  search action (label uses the current language) to launch a similar-track search.

---

## UI-014 — Three-Column Workspace

The main workspace uses three columns:
- UI-014.R1: Left: search input, style filters, and results (tabs for tracks/tandas).
- UI-014.R2: Middle: clipboard/scratch pad with track/tanda tabs.
- UI-014.R3: Right: tabbed panel with Playlist and Tanda Designer views.

Interactions:
- UI-014.R4: Search results provide add buttons and drag-and-drop into clipboard/playlist.
- UI-014.R5: Clicking a clipboard item then a playlist slot swaps the two.
- UI-014.R6: Clipboard tandas can be selected and swapped into playlist slots.
- UI-014.R7: Playlist tandas include a send-to-clipboard control (no remove-only action).
- UI-014.R8: Clicking a track row plays it (Preparation mode only).
- UI-014.R9: Search includes a submit control and displays result counts.
- UI-014.R10: Track/tanda tabs stretch to fill the column width.
- UI-014.R11: Workspace fills the available screen space between a slim header and footer.
- UI-014.R12: Adding tracks to tandas is explicit (T button or drag/drop), not via click.
- UI-014.R13: Removing a clipboard track is explicit (R button).
- UI-014.R14: Track/tanda tab labels show entry counts.
- UI-014.R15: When items are added to clipboard or playlist, the corresponding tab becomes
  active so the DJ can see the result immediately.
- UI-014.R16: Lists scroll within their column while tab bars remain visible.
- UI-014.R17: Playlist tandas include a "Send to clipboard" action that clears the slot.
- UI-014.R18: Adding a tanda to the playlist targets the first available empty slot.
- UI-014.R19: Playlist tracks include a "Send to clipboard" action that clears the slot.
- UI-014.R20: Clipboard tracks/tandas can only be added to the playlist when at least one empty slot exists.
- UI-014.R21: The current playlist auto-restores on app launch.
- UI-014.R22: Clearing the playlist opens explicit options (clear only, or clear + auto-fill).
- UI-014.R23: Adding a track to the playlist creates a new tanda in the first empty slot,
  pre-sized to the sequence slot (or default size) and seeded with the track.
- UI-014.R24: Clicking an empty playlist slot creates a new tanda seeded with the slot’s
  sequence style(s) and focuses the Tanda Designer for continued editing.
- UI-014.R25: A Clear button next to the Playlist header can clear all playlist items
  while preserving playlist configuration; it is disabled in Live mode.
- UI-014.R26: Playlist auto-fill uses sequence/style rules and stops when projected
  timeline reaches the configured expected end time.
- UI-014.R27: The centered app-title block includes a subtitle showing the live
  application version from the packaged app metadata in the form
  `Version: {version} © David Goddard 2026`.
- UI-014.R28: On app startup, when the GitHub releases endpoint is reachable and
  reports a newer version/tag than the packaged app version, the renderer shows
  an in-app modal popup with the new version number and an action to open the
  repository releases page in the user's default browser.

## UI-015 — Now Playing Strip

The main screen includes a horizontal strip directly below the header that
summarizes the currently playing track.

Requirements:
- UI-015.R1: Shows artist and title.
- UI-015.R2: Shows elapsed time and total duration.
- UI-015.R3: Headphone playback overrides the main output display while active.
- UI-015.R4: Displays the active output (main vs headphones).
- UI-015.R5: Displays a waveform image with a moving playhead and shaded progress.
- UI-015.R6: In Preparation mode, clicking the waveform seeks within the current track.
- UI-015.R7: In Live mode, the waveform is display-only; seeking is disabled.
- UI-015.R8: When a waveform is missing or still generating, show a placeholder instead
  of hiding the waveform area.
- UI-015.R9: The now-playing label, track metadata, and waveform share a single row, with
  the waveform expanding to fill remaining width.
- UI-015.R10: The playhead must reflect the raw playback position over the full
  waveform (including leading/trailing silence), while the time display uses the
  trimmed effective duration.
- UI-015.R11: Clicking the now-playing strip stops only the active channel (main or
  headphones) in Preparation or Edit mode; if headphones are overriding the
  display, it must not stop main playback.
- UI-015.R12: The waveform container uses a fixed height so showing/hiding the
  waveform does not change the now-playing layout height.

## UI-016 — Tanda Designer Panel

The playlist column includes a Tanda Designer tab for creating and editing tandas.

Layout and behavior:
- UI-016.R1: Presents a default empty tanda with the configured placeholder count.
- UI-016.R2: On startup, the active tanda is a fresh draft; saved tandas are not mutated
  unless explicitly edited and saved. The designer does not preload all saved
  tandas; they are opened on demand from search/clipboard.
- UI-016.R3: Allows adding additional empty tandas via an Add button.

---

## UI-050.a — Library Setup Guidance

The Library tab must present setup and recovery actions as a guided workflow, not
just a maintenance toolbox.

Requirements:
- UI-050.a.R1: The recommended complete setup path is visually separated from
  manual maintenance actions.
- UI-050.a.R2: The startup-flow card shows concise human-readable guidance,
  including that rerunning the flow is safe after interruption or shutdown.
- UI-050.a.R3: The startup-flow phase line marks all finished phases with a
  completed state, including the final `Done` step.
- UI-050.a.R3.a: The startup-flow card includes a unified progress area that
  mirrors scan and compressed-cache progress inside the recommended one-stop
  setup card, so users do not need to inspect manual sections while setup runs.
- UI-050.a.R3.b: The startup-flow card may show a clearly labeled rough
  remaining-time estimate for the active step only, and should wait until enough
  progress is available before showing a numeric value.
- UI-050.a.R4: Manual actions such as legacy import, scans, cache tools, and
  backup/restore each include short plain-language summaries describing when they
  should be used.
- UI-050.a.R5: All manual setup and maintenance actions are visually grouped
  within a shared outer container so they read as optional/manual tools.
- UI-050.a.R6: Background system export shows a live checklist of the managed
  items being copied, using the same circular left-hand markers as the guided
  setup workflow so completed export steps are obvious at a glance.
- UI-016.R4: Each tanda has Save and Delete actions.
- UI-016.R5: Tandas are selectable; the selected tanda is the target for incoming tracks.
- UI-016.R6: Tracks can be added from search/clipboard via the add action or drag/drop.
- UI-016.R6.a: Adding a track to the active tanda brings the Tanda Designer tab into focus.
- UI-016.R7: Tracks can be reordered via drag/drop and up/down controls.
- UI-016.R8: Tracks can be sent back to the clipboard, leaving a placeholder.
- UI-016.R9: A "+" control adds another placeholder to extend tanda length.
- UI-016.R10: Saving a tanda removes empty slots; if it falls below the minimum size, the
  user must confirm the save.
- UI-016.R11: Derived properties are displayed and auto-updated:
  - UI-016.R11.a: Styles (one or more).
  - UI-016.R11.b: Instrumental (true only if all tracks are instrumental).
  - UI-016.R11.c: Total duration (sum of effective track durations).
  - UI-016.R11.d: Track count.
  - UI-016.R11.e: Rating (0–5 stars).
- UI-016.R11.f: Name.
- UI-016.R11.g: The tanda style list is the union of styles present in its tracks
  (normalized against the system style list) and updates as tracks are added or removed.
- UI-016.R12: A Done action replaces the active draft with a fresh empty tanda.
- UI-016.R15: The Tanda Designer shows only in-progress draft tandas that contain tracks
  plus at most one empty template; the template is always listed first.
- UI-016.R16: Clearing while Tanda Designer is active resets non-playlist drafts
  to one fresh empty template and preserves playlist-origin drafts.

Filtering:
- UI-016.R13: When a tanda is selected, the clipboard (and search results, when enabled)
  are filtered to the tanda's style(s).
- UI-016.R14: Style filtering applies immediately on tanda selection to prevent mismatches.

---

## UI-017 — Tanda Summary Component (Planned)

Represents a tanda as a first-class object.

Must display:
- UI-017.R1: Tanda name or identifier.
- UI-017.R2: Style.
- UI-017.R3: Track count.
- UI-017.R4: Track list (expandable).
- UI-017.R5: Derived attributes:
  - UI-017.R5.a: Instrumental / vocal.
  - UI-017.R5.b: Single artist / mixed.
  - UI-017.R5.c: Single year / mixed.
  - UI-017.R5.d: BPM range.
- UI-017.R6: Rating (1–5 stars).

Behavior:
- UI-017.R7: Can be dragged as a unit.
- UI-017.R8: Selection never plays audio directly in Performance Mode.

---

## UI-012 — Playlist Timeline Component

Represents the current playlist.

Must show:
- UI-012.R1: Ordered tandas.
- UI-012.R2: Optional cortinas between tandas.
- UI-012.R3: Current playback position.
- UI-012.R4: Next upcoming items.

Behavior:
- UI-012.R5: Reordering allowed subject to mode rules.
- UI-012.R6: Current and next items are visually emphasized.
- UI-012.R7: Timeline reflects authoritative playback state.
- UI-012.R8: While a tanda is playing, it expands and highlights the active track.
- UI-012.R9: Once a tanda finishes, it collapses automatically.
- UI-012.R9.a: When cortinas are enabled, cortina rows appear in the playlist
  before the first tanda, between tandas, and after the final tanda.
- UI-012.R9.b: Clicking a cortina row opens the cortina picker to replace the
  upcoming cortina.
- UI-012.R9.c: Playlist cortina assignments persist with the saved playlist,
  whether they were auto-planned or manually replaced. They are restored on
  startup when the active cortina set is still the same. If the cortina set
  changes, those persisted slot assignments are dropped and replacement
  cortinas are re-planned from the new set, while newly added playlist slots
  continue to draw from the current cortina set.
- UI-012.R10: In Live mode, played tandas are visually muted and their slots are locked
  against edits, swaps, or drops while playback is active.
- UI-012.R11: In Preparation mode, clicking a playlist track starts playback from that
  track even if another main track is already playing.
- UI-012.R11.a: In Preparation mode, playlist-click playback starts immediately
  on the selected track with no lead-in cortina, even when the selected track
  is the first track in a tanda.
- UI-012.R11.b: In Live mode, clicking a playlist track while main output is
  idle starts playlist playback from that track using normal playlist rules.
  If the selected track is the first track of a tanda and a lead-in cortina
  applies, that cortina still plays first.
- UI-012.R11.c: In Live mode, clicking a tanda summary while main output is idle
  starts playlist playback from that tanda, preserving normal cortina behavior.
- UI-012.R11.d: In Live mode, clicking a track in Search or Clipboard while
  main output is idle must open a confirmation prompt and, if confirmed, play
  that track as a one-off standalone item with no automatic run-on into the
  playlist.
- UI-012.R12: If main output is playing, playlist clicks are ignored in Live mode.
- UI-012.R13: Each tanda row shows its total duration and an estimated start time based on
  the configured playlist start time and gap settings.
- UI-012.R14: When playback is active and the playlist is taller than the viewport, the
  current tanda auto-centers after a period of user inactivity (about two minutes).
  Any user interaction pauses auto-centering until the idle window elapses again.
- UI-012.R15: When using playlist auto-fill with cortinas enabled, all required
  cortina rows (start, between tandas, end) are pre-assigned from the selected
  cortina set using the same planning rules as manual playlist editing.
- UI-012.R16: If auto-fill cannot satisfy a required slot (style/count constraints),
  it inserts an empty placeholder tanda with the required slot size and intended
  style, marks it as mismatched for manual completion, and continues expected-end-time
  projection using an assumed 9-minute duration for that placeholder.
- UI-012.R17: The Playlist header `Clear` action is context-sensitive by active
  right-column tab: in Playlist view it shows playlist clear options (`clear` /
  `clear + auto-fill`), and in Tanda Designer view it clears designer drafts
  immediately without a confirmation modal.
- UI-012.R18: Playlist diversity year and BPM distribution charts must use
  container-fit column sizing so bars scale to fill available chart width
  without requiring horizontal scrolling.
- UI-012.R19: The playlist footer must provide a second guarded stop-point toggle
  for live performances. When enabled for the current tanda, playback pauses
  after that tanda and its following cortina. The DJ can then play confirmed
  one-off tracks while the playlist remains resumable.
- UI-012.R19.a: Resuming from that performance stop must replay the same cortina
  that was used at the pause point before continuing into the next playlist item.
- UI-012.R19.b: Enabling the live-performance stop toggle during a tanda that is
  already playing still applies to that currently active tanda and must pause
  after its following cortina.

---

## UI-013 — Playback Control Component

Dedicated playback controls.

Must include:
- UI-013.R1: Start playlist.
- UI-013.R2: Stop playlist.
- UI-013.R3: Pause / resume (if supported).
- UI-013.R4: Volume control (authoritative).

Rules:
- UI-013.R5: In Performance Mode, this component is the primary playback control.
- UI-013.R5.a: The only direct content-click exception is guarded playlist
  track click-start when the main output is idle (UI-012.R11 / UI-012.R12).
- UI-013.R6: Changes must be reflected across all connected clients.
- UI-013.R7: Start resets playback to the top of the playlist.
- UI-013.R8: Resume continues from the last stopped track position.
- UI-013.R9: Stop applies a configurable fade-out and preserves resume position.
- UI-013.R10: Controls live in the playlist column header for immediate access.

---

## UI-020 — Cortina Selector Component

Allows selection or replacement of cortinas.

Features:
- UI-020.R1: Search across all cortina tracks.
- UI-020.R2: Grouped by cortina folder.
- UI-020.R3: Preview via headphone output.
- UI-020.R4: Replace-at-boundary semantics.
 - UI-020.R4.a: The picker defaults to the playlist’s current set but includes an
   "Any" option to search across all sets without changing the playlist default.
 - UI-020.R4.b: Results are ordered by title then artist.

UI-020.R5: Must be usable up to the moment a cortina plays.
UI-020.R6: In Live mode, previously played cortinas cannot be replaced.
UI-020.R7: Playlist cortina rows show the selected/playing cortina title and artist
when available.
UI-020.R8: The cortina picker modal uses a fixed size; results scroll within
the modal body without resizing the window as filters change.
UI-020.R9: Cortina rows align their label column with tanda style badges, and show
the title/artist to the right of the label area.

---

## UI-030 — Similarity Visualization Component

Provides visual indicators of musical similarity.

Description:
- UI-030.R1: Tracks may be associated with multiple musical properties.
- UI-030.R2: Each property is mapped to a color.
- UI-030.R3: Property value is represented via lightness or intensity.

Rendering:
- UI-030.R4: Each track shows a compact block or strip per property.
- UI-030.R5: Similar tracks appear visually similar.
- UI-030.R6: Outliers are immediately visible.

Rules:
- UI-030.R7: Visualization must not imply “wrongness”.
- UI-030.R8: Differences are informational, not errors.

Source of properties:
- UI-030.R9: Manual (initial implementation).
- UI-030.R10: Derived (future ML-based vectorization).

UI-030.R11: The visual abstraction must remain stable even if the data source changes.

---

## UI-040 — Waveform Preview Component

Optional component for track preview.

Features:
- UI-040.R1: Displays full-track waveform.
- UI-040.R2: Indicates playback position.
- UI-040.R3: Allows click-to-seek.

Rules:
- UI-040.R4: Enabled only in Preparation Mode.
- UI-040.R5: In Performance Mode, waveform display remains visible but is
  non-interactive.
- UI-040.R6: Uses derived waveform artifacts if available.
- UI-040.R7: Waveform PNGs are generated during library scan for instant playback.

---

## UI-050 — Configuration Panel

Centralized configuration UI.

Must allow adjustment of:
- UI-050.R1: Playback timing, level, diagnostics, and operational settings used
  by the app.
- UI-050.R2: Fade durations.
- UI-050.R3: Gap defaults.
- UI-050.R4: Diagnostics, cache-management, and operational visibility needed
  for setup and live readiness.

Rules:
- UI-050.R5: Configuration changes must be explicit.
- UI-050.R6: Risky changes should be labeled clearly.
- UI-050.R7: Changes affecting live playback must require confirmation.
- UI-050.R8: Library settings must expose a guided startup/recovery control
  that runs scan, waveform generation, and compressed-cache preparation in a
  clear order without destructive migration steps.
- UI-050.R9: The guided startup/recovery UI must summarize the combined result
  so the user can see whether metadata, waveforms, and compressed files were prepared.
- UI-050.R10: Library settings must expose full-system export/import actions for
  the application data root, with explicit confirmation before import.
- UI-050.R11: Library settings must expose a dedicated tandas-only export action.
- UI-050.R12: Playlist settings must expose playlist save/import actions with
  plain-language guidance on the limitations of standard playlist formats such
  as `m3u` and `m3u8`.
- UI-050.R13: Diagnostics must surface suspicious track-length anomalies,
  including unusually short raw durations and tracks where trims remove a large
  amount of the FFmpeg-reported duration.

---

## UI-060 — Display Board UI

Read-only UI for audience-facing displays.

Features:
- UI-060.R1: Current track / tanda.
- UI-060.R2: Next upcoming item.
- UI-060.R3: Optional background imagery.
- UI-060.R7: During cortina lead-in, playback, and immediate post-cortina gap,
  the display headline shows "Cortina" and secondary line shows "This tanda: {style}".
- UI-060.R8: Between tracks, the display must retain the last non-empty now-playing
  text instead of showing an "idle" placeholder.
- UI-060.R9: When no background images are available, use a subtle animated abstract
  background with slow color/shape motion that preserves text readability.
- UI-060.R10: In cortina mode, content is centered and the "Cortina" headline is
  rendered as large as possible while still fitting on screen.
- UI-060.R11: Display-board text supports a configurable base font scale (%) from
  Settings > Display Board.
- UI-060.R12: Display content preserves an inner safe margin so large headings do
  not sit hard against screen edges.
- UI-060.R13: Cortina-mode typography supports an independent font scale (%)
  configured in Settings > Display Board.
- UI-060.R14.a: The playlist footer marked-last control is presented as
  `Remaining Tandas` followed by a numeric field supporting integer values
  `0` through `4` and defaulting to `1`.
- UI-060.R14.b: When that control is enabled, the configured value is interpreted
  relative to the currently playing tanda: `0` stops after the current tanda,
  `1` stops after the next tanda, and so on. Each completed tanda decrements the
  countdown until playback ends.
- UI-060.R14.c: When the marked-last countdown is active:
  - lead-in cortinas before a remaining tanda stay normal ("Cortina" + "This tanda: {style}"),
  - that lead-in cortina subline includes the localized artist summary for the
    upcoming tanda on its own next line (`This tanda: {style}` followed by `{artist}`),
  - while tracks of a counted-down tanda are playing, the bottom-right display
    adds a localized countdown line such as "Last two tandas",
  - while tracks of the actual final tanda are playing, that countdown line sits
    above the localized "This is the last tanda" message,
  - the final cortina after the stop-triggering tanda shows only the farewell
    headline (localized equivalent of "That's all folks") with no secondary line.
- UI-060.R15: After the final cortina of a marked-last tanda ends and playback
  stops, the display remains on the farewell cortina state (does not revert to
  generic "Cortina" idle text) until superseded by later playback/display updates.
- UI-060.R16: The display board reflects main-output playback only. Headphone
  preview must never replace or populate the audience-facing title or artist
  shown on the display board. If main output is idle, headphone-only preview
  must not appear there.
- UI-060.R16.a: During normal track playback, the bottom-right "Next tanda"
  text includes both the next tanda style and a localized artist summary:
  `Next tanda: {style} from {artist}`. If the next tanda contains more than one
  distinct normalized artist, the artist portion uses the localized equivalent
  of `Various artists`. The next-tanda area should prefer staying on one line by
  using a smaller font and near-full available width while remaining right-aligned.
- UI-060.R17: When the playlist is paused at the live-performance stop point,
  the marked tanda's track phase and its final cortina must suppress the
  bottom-right tanda text entirely instead of showing either "Next tanda" or
  "This is the last tanda".

Rules:
- UI-060.R4: No control affordances.
- UI-060.R5: Must work on low-power devices.
- UI-060.R6: Must tolerate network interruptions gracefully.

---

## UI-070 — Playlist Integrity Enforcement

The UI must actively prevent DJs from breaking their own defined playlist rules.

Rules:
- UI-070.R1: Drag-and-drop operations must respect playlist structure constraints.
- UI-070.R2: A tanda of one style must not be droppable into a position requiring another style.
- UI-070.R3: Count mismatches prompt a confirmation before allowing the drop.
- UI-070.R4: Invalid style targets must be visibly indicated and rejected.
- UI-070.R5: Style mismatch attempts trigger a pulsing warning with an Allow Anyway action.
- UI-070.R5.a: The warning includes a dismiss control so the DJ can clear it.
- UI-070.R5.b: Warning text must state the expected slot rule and the tanda's label.
- UI-070.R6: Overridden tandas display a visible mismatch badge in the playlist.
- UI-070.R7: Search-and-replace operations must respect the same constraints.

It must be difficult to accidentally construct an invalid playlist.

---

## UI-080 — Scratch Pad Component

The Scratch Pad is a temporary holding area for tracks and tandas during playlist
editing and tanda construction.

Purpose:
- UI-080.R1: Provide a simple dumping ground for search results.
- UI-080.R2: Reduce cognitive load during long-distance rearrangements.

Behavior:
- UI-080.R3: Items may be dragged from search results or the playlist into the scratch pad.
- UI-080.R4: Items in the scratch pad can be added to the playlist or the active tanda.

Rules:
- UI-080.R5: The scratch pad does not enforce playlist structure.
- UI-080.R6: The playlist must still guard against invalid gaps or mismatched styles.

---

## UI-082 — Clipboard Collections

The clipboard supports named collections for quick access sets.

Behavior:
- UI-082.R1: A single active collection is the destination for add/remove actions.
- UI-082.R2: Additional collections can be included for view-only merging.
- UI-082.R3: Included collections do not change the active collection target.
- UI-082.R4: Collections persist across app restarts.
- UI-082.R5: Collections are named and removable, but at least one must always exist.
- UI-082.R7: Sending a playlist item to the clipboard switches focus to the General collection only.
- UI-082.R8: Clicking a clipboard tanda selects it but does not open the Tanda Designer;
  editing requires the T menu action or drag/drop into the designer.
- UI-082.R9: Tracks can be moved between clipboard collections by dragging a
  clipboard track onto a collection lozenge (context tab).
- UI-082.R10: Named collections (except General) are draggable to reorder the
  collection tabs; General is fixed in place and not draggable.
- UI-082.R11: A Clear button next to the Clipboard header clears only the General
  collection (tracks and tandas); named collections are unaffected.
- UI-082.R12: The system provides a "New" collection populated with the most
  recently added music tracks (no cortinas).
- UI-082.R13: The New collection is read-only and cannot be removed or reordered.
- UI-082.R14: The size of the New collection is configurable in System settings.
- UI-082.R15: The system provides an `Available` smart collection keyed by
  canonical `artist + style` groups:
  - UI-082.R15.a: Once a playlist uses a canonical artist in a specific style,
    only that same artist+style group is excluded from `Available`.
  - UI-082.R15.b: Other styles for the same canonical artist remain eligible.
  - UI-082.R15.c: Canonical artist matching must use orchestra alias/variant
    resolution (e.g., D'Arienzo variants resolve to the same canonical artist).
  - UI-082.R15.d: Tanda availability must be evaluated from tanda-level style
    metadata when track-level style tags are missing or inconsistent, provided
    tanda size and artist+style usage constraints are satisfied.
- UI-082.R16: Clipboard track and tanda row menus include `M` (move collection).
- UI-082.R17: `M` target selection excludes the currently active collection.
- UI-082.R18: If exactly one target remains, `M` applies directly without showing
  a picker.
- UI-082.R19: If multiple targets remain, `M` opens a target picker pop-up.
- UI-082.R20: In read-only smart collections (`New`, `Top`, `Least`,
  `Available`), `M` performs copy-to-target semantics (source remains smart).
- UI-082.R21: In writable collections, `M` performs true move semantics.

---

## UI-081 — Scratch Pad Auto-Targeting

Reserved for future playlist replacement workflows. Not used in the current
three-column layout.

---

## UI-083 — Style Families

Style setup must support playlist letters, search filtering, legacy mapping, and
track tagging from one workflow.

Behavior:
- UI-083.R1: Library settings present style-family setup before root scan/import actions.
- UI-083.R2: Family rows include code letter, base style, and optional sub-styles.
- UI-083.R3: Search style pills show base styles; selecting a base applies all styles in that family.
- UI-083.R4: Track editor style picker presents grouped base/sub-style options and stores the selected concrete style string.
- UI-083.R5: Legacy style table supports per-row mapping to an existing style or creating a new family/style.
- UI-083.R6: Base style pills support variant selection via right-click or long-press.
- UI-083.R7: Selecting a variant relabels the pill (e.g. `T - Nuevo`) and applies
  exact filtering for that variant.
- UI-083.R8: Clicking an active variant pill toggles it off and restores base-style
  filtering behavior.

---

## UI Design Summary

The UI must:
- UI-090.R1: Prevent accidental failure.
- UI-090.R2: Reward deliberate action.
- UI-090.R3: Make musical structure visible.
- UI-090.R4: Remain usable under pressure.
- UI-090.R5: Stay consistent across screens and time.

UI-090.R6: If a UI element behaves differently in different contexts,
it must look different.

