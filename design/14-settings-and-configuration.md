# Settings and Configuration

## Overview

Configuration is accessed via a dedicated Settings panel that overlays the main
screen. Settings are grouped into tabs by concept (Library, Diagnostics, System,
Lighting, Network, etc.).

## Navigation and Layout

- CFG-NAV-001: Settings are accessible from the main screen via a single entry point.
- CFG-NAV-002: Tabs are used for top-level sections; the app avoids deep navigation trees.
- CFG-NAV-003: Critical information (e.g. missing music folders) surfaces as a banner with a
  shortcut into Settings.
- CFG-NAV-004: A light/dark theme toggle is available from the main screen.

## Library Configuration

- CFG-LIB-001: Users can add one or more Music roots and one or more Cortina roots.
- CFG-LIB-002: Each root shows availability status (connected/missing).
- CFG-LIB-003: Changes to roots are applied immediately and do not require a restart.
- CFG-LIB-004: Library scanning is initiated from the Library tab.
- CFG-LIB-005: Scan progress is shown in the Library tab, with a shortcut to Diagnostics
  beside the scan-issue count. The main screen remains uncluttered for day-to-day use.

## System Configuration

- CFG-SYS-001: Destructive actions (e.g. Erase Database) require a confirmation dialog.
- CFG-SYS-002: The dialog explains the consequences and cannot be bypassed.
- CFG-SYS-003: Users can select their preferred UI language.
- CFG-SYS-004: Users assign output devices for main and headphone playback.
- CFG-SYS-005: Output selection persists across sessions and degrades gracefully if devices
  are missing.
- CFG-SYS-006: Headphone output is disabled if it matches the main output or no secondary
  device is present.
- CFG-SYS-007: Output changes update the main UI immediately (headphone controls shown/hidden).
- CFG-SYS-008: Users can configure the default new tanda size (placeholder count).
- CFG-SYS-009: The default size also acts as the minimum size threshold for save warnings.
- CFG-SYS-010: The system provides a managed list of musical styles for official tagging.
- CFG-SYS-011: New installs include default styles (Tango, Milonga, Waltz/Vals).
- CFG-SYS-012: If the user changes language and has only default styles, those defaults
  are rewritten in the new language without altering custom styles.
- CFG-SYS-013: Users can configure the minimum fuzzy-search score required for a match.
- CFG-SYS-014: Users can configure the BPM search tolerance range for numeric BPM queries.

## Playlist Configuration

- CFG-PL-001: Users can configure timing gaps for playlist playback:
  - CFG-PL-001a: Gap between tracks within a tanda.
  - CFG-PL-001b: Gap before each tanda.
  - CFG-PL-001c: Gap before cortina (stored for future cortina playback).
- CFG-PL-002: Users can configure the stop fade duration for live playlist playback.
- CFG-PL-003: A tanda sequence string (e.g. `3t 3t 3w`) defines slot expectations.
- CFG-PL-004: A style mapping table connects sequence letters (e.g. `T`) to allowed styles.
- CFG-PL-005: Style mismatches prompt an explicit override warning; count mismatches prompt a
  confirmation before allowing the tanda into the slot.

## Library Utilities

- CFG-LIB-006: The Erase Database action is located in the Library tab alongside scanning.

## Diagnostics

- CFG-DIAG-001: Scan issues are shown under the Diagnostics tab.
- CFG-DIAG-002: Errors are persistent across scans until resolved or cleared by a new scan.
- CFG-DIAG-003: A "View scan issues" link in progress areas jumps directly to Diagnostics.
- CFG-DIAG-004: Diagnostics list the resolved user data, waveforms, ffmpeg, and ffprobe
  paths for troubleshooting.
- CFG-DIAG-005: Diagnostics provide a "Generate waveform for current track" action to
  validate waveform tooling.

## Professional DJ Expectations

- CFG-DJ-001: Settings must never interrupt playback.
- CFG-DJ-002: Missing resources are communicated clearly with specific next actions.
- CFG-DJ-003: The UI prioritizes clarity and low cognitive load in live contexts.
