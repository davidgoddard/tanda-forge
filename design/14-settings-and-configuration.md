# Settings and Configuration

## Overview

Configuration is accessed via a dedicated Settings panel that overlays the main
screen. Settings are grouped into tabs by concept (Library, Diagnostics, System,
Lighting, Network, etc.).

## Navigation and Layout

- Settings are accessible from the main screen via a single entry point.
- Tabs are used for top-level sections; the app avoids deep navigation trees.
- Critical information (e.g. missing music folders) surfaces as a banner with a
  shortcut into Settings.
- A light/dark theme toggle is available from the main screen.

## Library Configuration

- Users can add one or more Music roots and one or more Cortina roots.
- Each root shows availability status (connected/missing).
- Changes to roots are applied immediately and do not require a restart.
- Library scanning is initiated from the Library tab.
- Scan progress is mirrored on the main screen and the Library tab, with a
  shortcut to Diagnostics beside the scan-issue count.

## System Configuration

- Destructive actions (e.g. Erase Database) require a confirmation dialog.
- The dialog explains the consequences and cannot be bypassed.
- Users can select their preferred UI language.
- Users assign output devices for main and headphone playback.
- Output selection persists across sessions and degrades gracefully if devices
  are missing.
- Headphone output is disabled if it matches the main output or no secondary
  device is present.
- Output changes update the main UI immediately (headphone controls shown/hidden).
- Users can configure the default new tanda size (placeholder count).
- The default size also acts as the minimum size threshold for save warnings.

## Playlist Configuration

- Users can configure timing gaps for playlist playback:
  - Gap between tracks within a tanda.
  - Gap before each tanda.
  - Gap before cortina (stored for future cortina playback).
- Users can configure the stop fade duration for live playlist playback.
- A tanda sequence string (e.g. `3t 3t 3w`) defines slot expectations.
- A style mapping table connects sequence letters (e.g. `T`) to allowed styles.
- Style mismatches are rejected; count mismatches prompt a confirmation before
  allowing the tanda into the slot.

## Library Utilities

- The Erase Database action is located in the Library tab alongside scanning.

## Diagnostics

- Scan issues are shown under the Diagnostics tab.
- Errors are persistent across scans until resolved or cleared by a new scan.
- A "View scan issues" link in progress areas jumps directly to Diagnostics.

## Professional DJ Expectations

- Settings must never interrupt playback.
- Missing resources are communicated clearly with specific next actions.
- The UI prioritizes clarity and low cognitive load in live contexts.
