# UI Principles and Components

This document defines the user interface principles and core UI components
for Tanda Player Lite. Its purpose is to ensure consistency, safety, and clarity
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
  UI-001.R4.a: Track click actions are disabled in Live mode except for headphone preview.

---

## UI-002 — Safety Over Convenience

In Performance Mode:
- UI-002.R1: No action may immediately change playback unless triggered via dedicated controls.
- UI-002.R2: Clicking or tapping content (tracks, tandas) must not start playback.
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
- UI-009.R1: Missing library roots trigger a visible banner with a shortcut to Settings.
- UI-009.R2: Destructive settings (e.g. database reset) require explicit confirmation.
- UI-009.R3: Diagnostic information (scan issues) lives in a Diagnostics tab.
- UI-009.R3.a: Diagnostics include playback-leveling logs so gain/loudness
  decisions can be reviewed without leaving the app.
- UI-009.R3.b: The Library settings tab includes a one-click readiness verification
  action near Legacy Import that reports pass/warn/fail plus data-readiness counts
  (duration, loudness/gain, trim signals, analysis errors, waveforms).
- UI-009.R4: Playlist and System settings use multi-column layout on wide screens,
  collapsing to a single column on narrow screens.
- UI-009.R5: Display-board controls live in a dedicated Display Board settings tab.

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
- UI-010a.R14: Cancel closes without changes.
- UI-010a.R15: The editor surface is opaque to keep the form readable over long lists.
- UI-010a.R16: In Edit mode, the editor is non-modal and updates in place as
  different tracks are clicked.
- UI-010a.R17: The track editor is non-modal in all modes and opens in the
  fixed in-place editor position (not centered modal overlay).
- UI-010a.R18: Each editable metadata field exposes a localized search-similar
  shortcut (`S`) that appends that field value to the current Search query.
- UI-010a.R19: Field-level search shortcuts are additive and de-duplicated so
  repeated clicks build composite queries without repeated tokens.

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
- UI-012.R10: In Live mode, played tandas are visually muted and their slots are locked
  against edits, swaps, or drops while playback is active.
- UI-012.R11: If no main output is playing, clicking a playlist track starts playback from
  that track (prep or live mode).
- UI-012.R11.a: In Preparation mode, playlist-click playback starts immediately
  on the selected track with no lead-in cortina, even when the selected track
  is the first track in a tanda.
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

---

## UI-013 — Playback Control Component

Dedicated playback controls.

Must include:
- UI-013.R1: Start playlist.
- UI-013.R2: Stop playlist.
- UI-013.R3: Pause / resume (if supported).
- UI-013.R4: Volume control (authoritative).

Rules:
- UI-013.R5: Only this component may initiate playback in Performance Mode.
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
- UI-040.R5: Disabled entirely in Performance Mode.
- UI-040.R6: Uses derived waveform artifacts if available.
- UI-040.R7: Waveform PNGs are generated during library scan for instant playback.

---

## UI-050 — Configuration Panel

Centralized configuration UI.

Must allow adjustment of:
- UI-050.R1: Gain targets.
- UI-050.R2: Fade durations.
- UI-050.R3: Gap defaults.
- UI-050.R4: UI visibility toggles.

Rules:
- UI-050.R5: Configuration changes must be explicit.
- UI-050.R6: Risky changes should be labeled clearly.
- UI-050.R7: Changes affecting live playback must require confirmation.

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
- UI-082.R6 (Planned): Items already in a collection can be added to additional collections without removing them from the active collection.
- UI-082.R7: Sending a playlist item to the clipboard switches focus to the General collection only.
- UI-082.R8: Clicking a clipboard tanda selects it but does not open the Tanda Designer;
  editing requires the T menu action or drag/drop into the designer.
- UI-082.R9: Tracks can be moved between clipboard collections by dragging a
  clipboard track onto a collection lozenge (context tab).
- UI-082.R8: Named collections (except General) are draggable to reorder the
  collection tabs; General is fixed in place and not draggable.
- UI-082.R9: A Clear button next to the Clipboard header clears only the General
  collection (tracks and tandas); named collections are unaffected.
- UI-082.R10: The system provides a "New" collection populated with the most
  recently added music tracks (no cortinas).
- UI-082.R11: The New collection is read-only and cannot be removed or reordered.
- UI-082.R12: The size of the New collection is configurable in System settings.
- UI-082.R13: The system provides an `Available` smart collection keyed by
  canonical `artist + style` groups:
  - UI-082.R13.a: Once a playlist uses a canonical artist in a specific style,
    only that same artist+style group is excluded from `Available`.
  - UI-082.R13.b: Other styles for the same canonical artist remain eligible.
  - UI-082.R13.c: Canonical artist matching must use orchestra alias/variant
    resolution (e.g., D'Arienzo variants resolve to the same canonical artist).
  - UI-082.R13.d: Tanda availability must be evaluated from tanda-level style
    metadata when track-level style tags are missing or inconsistent, provided
    tanda size and artist+style usage constraints are satisfied.

---

## UI-081 — Scratch Pad Auto-Targeting

Reserved for future playlist replacement workflows. Not used in the current
three-column layout.

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

