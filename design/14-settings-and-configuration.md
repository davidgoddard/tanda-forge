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

## Diagnostics

- Scan issues are shown under the Diagnostics tab.
- Errors are persistent across scans until resolved or cleared by a new scan.

## Professional DJ Expectations

- Settings must never interrupt playback.
- Missing resources are communicated clearly with specific next actions.
- The UI prioritizes clarity and low cognitive load in live contexts.
