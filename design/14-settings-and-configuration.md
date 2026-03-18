# Settings and Configuration

## Overview

Configuration is accessed via a dedicated Settings panel that overlays the main
screen. Settings are grouped into tabs by concept (Library, Playlist, Display
Board, Diagnostics, System).

## Navigation and Layout

- CFG-NAV-001: Settings are accessible from the main screen via a single entry point.
- CFG-NAV-002: Tabs are used for top-level sections; the app avoids deep navigation trees.
- CFG-NAV-003: Critical information (e.g. missing music folders) surfaces as a banner with a
  shortcut into Settings.
- CFG-NAV-004: A light/dark theme toggle is available from the main screen.
- CFG-LAYOUT-001: System, Playlist, and Display Board settings use a multi-column
  layout on wide screens and collapse to a single column on smaller windows.

## Library Configuration

- CFG-LIB-001: Users can add one or more Music roots and one or more Cortina roots.
- CFG-LIB-010: Users can optionally add one or more Background roots used by the
  external display board image rotation.
- CFG-LIB-002: Each root shows availability status (connected/missing).
- CFG-LIB-003: Changes to roots are applied immediately and do not require a restart.
- CFG-LIB-004: Library scanning is initiated from the Library tab.
- CFG-LIB-005: Scan progress is shown in the Library tab, with a shortcut to Diagnostics
  beside the scan-issue count. The main screen remains uncluttered for day-to-day use.
- CFG-LIB-006: Separate scan actions exist for Music and Cortinas. Only one scan runs at a
  time; attempts to start another scan report that a scan is already in progress.
- CFG-LIB-007: If legacy Tanda Player files (`config.js`, `tandas.dat`, `library.dat`,
  `cortinas.dat`) are detected when adding roots or changing the data location, the UI
  exposes a legacy import action.
- CFG-LIB-008: Legacy import replaces existing tandas and applies any available
  legacy track metadata in preference to tag/analysis data when fields are non-empty.
- CFG-LIB-008.a: During legacy tanda import, any legacy tanda name equal to
  `Auto Generated Tanda` or `Saved Auto-Generated Tanda` (case-insensitive, trimmed)
  is rewritten to a blank name so the app can use dynamic artist-summary rendering
  instead of the low-value legacy label. Matching is resilient to quote/dash/spacing
  variations of those labels.
- CFG-LIB-009: Legacy import does not perform a full rescan; it validates file existence,
  derives trims from legacy analysis fields, and reuses legacy waveform PNGs when present.
- CFG-LIB-011: Style families are configured in the Library tab before import/scan workflows.
- CFG-LIB-011.a: Each family row defines a playlist code letter, a base style, and optional sub-styles.
- CFG-LIB-011.b: Legacy style mapping table supports mapping each legacy style to an existing style or creating a new family/style from that row.
- CFG-LIB-011.c: Legacy style preview/import style extraction uses legacy `library.dat` classifier fields only (`classifiers.style`, `classifiers.sub-style`/`classifiers.subStyle`) and does not infer styles from ID3/tag genre values.
- CFG-LIB-011.d: Legacy style rows with no classifier style/sub-style are shown as `?` in the legacy style preview.
- CFG-LIB-011.e: Legacy style mappings selected in the UI are persisted per legacy root and automatically re-applied on later imports, so users do not need to remap each time.
- CFG-LIB-012: Library tab section order is: library roots first, style families + legacy style mapper second, legacy import third, and scan/progress controls at the bottom.

## System Configuration

- CFG-SYS-001: Destructive actions (e.g. Erase Database) require a confirmation dialog.
- CFG-SYS-002: The dialog explains the consequences and cannot be bypassed.
- CFG-SYS-003: Users can select their preferred UI language.
- CFG-SYS-003.a: Supported languages include English, Spanish, French, German,
  Portuguese, Italian, and Icelandic.
- CFG-SYS-004: Users assign output devices for main and headphone playback.
- CFG-SYS-005: Output selection persists across sessions and reuses the preferred device
  when available (matching by device ID, label, or group); it falls back gracefully
  without overwriting the stored preference if the device is missing.
- CFG-SYS-005.a: Output enumeration de-duplicates repeated OS-reported endpoints
  (for example repeated AirPlay routes with the same group/label) while preserving
  distinct physical outputs so main and headphone routing can remain independent.
- CFG-SYS-006: Headphone output is disabled if it matches the main output or no secondary
  device is present.
- CFG-SYS-007: Output changes update the main UI immediately (headphone controls shown/hidden).
- CFG-SYS-008: Users can configure the default new tanda size (placeholder count).
- CFG-SYS-009: The default size also acts as the minimum size threshold for save warnings.
- CFG-SYS-010: Users can configure the size of the system "New" clipboard
  collection (most recent music tracks).
- CFG-SYS-011: New installs include default styles (Tango, Milonga, Waltz/Vals).
- CFG-SYS-012: If the user changes language and has only default styles, those defaults
  are rewritten in the new language without altering custom styles.
- CFG-SYS-013: Users can configure the minimum fuzzy-search score required for a match.
- CFG-SYS-014: Users can configure the BPM search tolerance range for numeric BPM queries.
- CFG-SYS-015: Users can choose the data storage location for the application.
- CFG-SYS-015.a: When a custom location is chosen, data is stored in a `_tp_data`
  folder within the selected directory.
- CFG-SYS-015.b: Changing the data location starts with a fresh database and does
  not migrate existing data automatically.
- CFG-SYS-016: Users can configure the external display background rotation
  interval in seconds.

## Display Board Configuration

- CFG-DSP-001: Display-board controls live in a dedicated "Display Board" settings tab.
- CFG-DSP-002: Users can enable/disable background-image usage for the display board.
- CFG-DSP-003: Users can configure display-image darkening percentage.
- CFG-DSP-004: Users can configure display background rotation interval in seconds.
- CFG-DSP-005: Users can configure a base display font-size scale (%), applied to all
  display-board text for venue-distance readability.
- CFG-DSP-006: Users can configure an independent cortina font-size scale (%) so
  cortina headline sizing can be tuned separately from normal title/artist text.
- CFG-DSP-007: Display-board text sizing must remain responsive to the actual
  display window size. User-configured font scales act as base multipliers, but
  the rendered text must expand and contract with the window and shrink further
  if needed to fit.
- CFG-DSP-008: Title, artist, and lower-right tanda text should prefer up to
  two visible lines each; when text still does not fit, the display may shrink
  it further and then truncate with an ellipsis.

## Playlist Configuration

- CFG-PL-001: Users can configure timing gaps for playlist playback:
  - CFG-PL-001a: Gap between tracks within a tanda.
  - CFG-PL-001b: Gap before each tanda.
  - CFG-PL-001c: Gap before cortina (stored for future cortina playback).
  - CFG-PL-001d: Gap values may be negative to request overlap/crossfade instead
    of silence.
  - CFG-PL-001e: Negative values are applied between tracks and across
    track/cortina boundaries using the absolute gap value as the overlap fade
    duration.
- CFG-PL-002: Users can configure the stop fade duration for live playlist playback.
- CFG-PL-003: A tanda sequence string (e.g. `3t 3t 3w`) defines slot expectations.
- CFG-PL-003.a: Sequence syntax supports grouped alternatives with per-option size/style,
  e.g. `(2c 3m)` meaning a slot accepts either 2-C or 3-M.
- CFG-PL-003.b: Sequence input is syntax-validated in the UI (e.g. unmatched parentheses,
  invalid terms) and invalid input is not persisted.
- CFG-PL-003.c: Sequence letter codes must resolve to configured style-family letters;
  unknown codes are flagged and not persisted.
- CFG-PL-004: Sequence letters are resolved via Library style families (code->base/sub-styles), not a Playlist-tab text map.
- CFG-PL-005: Style mismatches prompt an explicit override warning; count mismatches prompt a
  confirmation before allowing the tanda into the slot.
- CFG-PL-006: A playlist start time (default 20:00) is configurable and used when
  displaying estimated start times for tandas.
- CFG-PL-006.a: Default playlist start time is 20:00 (8pm).
- CFG-PL-006.b: A playlist expected end time is configurable and is used by
  auto-fill to determine stop point.
- CFG-PL-006.c: End-time calculations support overnight sessions (end time on
  the following day).
- CFG-PL-007: If cortina tracks exist directly under the cortina root (no subfolder),
  they appear as a localized "Default" cortina set.
- CFG-PL-008: Default cortina duration is 40 seconds unless the user changes it.
- CFG-PL-009: Cortina set selection includes a localized "None" option to disable cortinas.
- CFG-PL-010: Playlist Clear opens an options dialog with:
  - CFG-PL-010.a: Clear playlist only.
  - CFG-PL-010.b: Clear and auto-fill playlist.
- CFG-PL-011: Auto-fill follows the configured sequence/style map and keeps adding
  tandas until projected playback reaches the configured end window.
- CFG-PL-012: Auto-fill prioritizes saved tandas and avoids duplicate track titles.
- CFG-PL-013: If no suitable tanda exists, auto-fill builds an ad-hoc tanda from
  similar tracks using progressively relaxed constraints.

## Library Utilities

- CFG-LIB-006: The Erase Database action is located in the Library tab alongside scanning.
- CFG-LIB-012: Library tab includes a one-click precompute action for compressed
  companion cache generation (tracks + cortinas).
- CFG-LIB-013: Precompute reports progress and summary counts (processed,
  rendered, skipped, failed) and must not block other UI navigation.

## Diagnostics

- CFG-DIAG-001: Scan issues are shown under the Diagnostics tab.
- CFG-DIAG-002: Errors are persistent across scans until resolved or cleared by a new scan.
- CFG-DIAG-003: A "View scan issues" link in progress areas jumps directly to Diagnostics.
- CFG-DIAG-004: Diagnostics list the resolved user data, waveforms, ffmpeg, and ffprobe
  paths for troubleshooting.
- CFG-DIAG-004.a: Diagnostics also list the compressed-audio cache path.
- CFG-DIAG-004.b: Diagnostics show whether ffmpeg/ffprobe were resolved from bundled
  app resources, a user-configured custom tools folder, or the system PATH.
- CFG-DIAG-004.c: Users can configure an optional custom FFmpeg tools folder in
  Diagnostics. Resolution order is bundled binaries first, then the custom tools
  folder, then the system PATH.
- CFG-DIAG-005: Diagnostics provide a "Generate waveform for current track" action to
  validate waveform tooling.
- CFG-DIAG-005.a: The Library tab separates scan actions from derived-cache actions so
  optional cache generation cannot be mistaken for required scanning.
- CFG-DIAG-005.b: Users can verify cached waveform/compressed files and prune unusable
  entries without deleting the database.
- CFG-DIAG-005.c: Users can erase derived caches separately from erasing the database.
- CFG-DIAG-006: Diagnostics provide an explicit "Clear diagnostics logs" action so
  users can reset playback/renderer log history before reproducing an issue.
- CFG-DIAG-007: Diagnostics provide an "Audio output probe" action that runs
  per-device sink-routing checks and reports pass/fail by output label/group/id.

## Professional DJ Expectations

- CFG-DJ-001: Settings must never interrupt playback.
- CFG-DJ-002: Missing resources are communicated clearly with specific next actions.
- CFG-DJ-003: The UI prioritizes clarity and low cognitive load in live contexts.
