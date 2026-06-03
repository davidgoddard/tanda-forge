# Functional Requirements

Requirement identifiers: All requirement bullets in this document are
identified as `FR-<section>.R<n>` in order under each section. Sub-bullets use
`FR-<section>.R<n>.<letter>`.

---

## FR-001 — Music Library Discovery

### FR-001.1 Library Root Scanning
- FR-001.1.R1: The system scans configured library roots for audio files.
- FR-001.1.R2: Library roots may be mounted USB volumes or user-selected local folders.
- FR-001.1.R3: The system flags missing or unavailable roots on startup and during use.
- FR-001.1.R4: Added, removed, and changed files are detected incrementally where possible.
- FR-001.1.R5: File identity must be stable across rescans (e.g. path + content hash).

### FR-001.2 Background Analysis (Per Track)
During discovery or re-analysis, the system performs background tasks:

- FR-001.2.R1: Extract metadata using bundled FFmpeg/ffprobe (ID3, etc.).
- FR-001.2.R2: Capture UTF-8 filenames and normalize tags (title, artist, album, year).
- FR-001.2.R3: Detect leading and trailing silence to determine:
  - FR-001.2.R3.a: Start offset.
  - FR-001.2.R3.b: End trim.
  - FR-001.2.R3.c: Effective musical duration.
- FR-001.2.R4: Compute loudness/gain metadata for playback normalization.

Analysis:
- FR-001.2.R5: Must not block the UI (NFR-002).
- FR-001.2.R6: Must be repeatable and restart-safe; reruns must skip unchanged
  files and reuse completed derived outputs where possible.
- FR-001.2.R7: Must persist results for reuse at runtime (NFR-003).
- FR-001.2.R8: Tag-derived styles are applied only when they match a known system style;
  otherwise the stored style remains blank.
- FR-001.2.R9: Analysis must tolerate malformed FFmpeg/ffprobe output; parsing
  failures must be sanitized and never abort a scan.
- FR-001.2.R10: Per-track scan work may run independent analysis and waveform
  generation in parallel; a failure in one step must not cancel the other step,
  and all failures must be logged for diagnostics.

### FR-001.3 Progress and Resume
- FR-001.3.R1: Scanning must report progress continuously (current, total, current file).
- FR-001.3.R2: If scanning is interrupted, the next scan resumes by skipping unchanged files.
- FR-001.3.R3: The UI must surface errors encountered during scanning and analysis.
- FR-001.3.R4: Missing tracks are removed from the database on scan completion.
- FR-001.3.R5: Tandas and playlists that reference missing tracks are marked invalid.

### FR-001.4 Guided Setup and Recovery
- FR-001.4.R1: The system must provide a single guided library-setup flow for
  configured roots.
- FR-001.4.R2: Legacy migration must be exposed as a separate explicit action,
  not folded into the resumable guided setup flow, because it may replace
  existing tanda data.
- FR-001.4.R3: The guided flow must scan music and cortina roots, ensure
  waveform PNGs are available, and bulk-render compressed companion files.
- FR-001.4.R4: The guided flow must remain valid after a database reset so a
  user can rebuild a complete working library without manual step ordering.
- FR-001.4.R5: Combined scan/precompute failures must be surfaced to the user
  without aborting unrelated successful work.
- FR-001.4.R6: Normal library rescans must import newly discovered files, remove missing files, and preserve stored editable metadata for already known tracks unless an explicit migration override applies.

### FR-001.5 System Backup and Restore
- FR-001.5.R1: The system must export the full application data root as a
  portable backup.
- FR-001.5.R2: Exported backups must include the database, derived caches,
  diagnostics logs, and persisted application state stored under the data root.
- FR-001.5.R3: The system must restore a previously exported backup into the
  active data root.
- FR-001.5.R4: Importing a system backup must require explicit confirmation
  because it replaces current application data.

---

## FR-002 — Loudness and Gain Handling

### FR-002.1 Goals
- FR-002.1.R1: Achieve consistent perceived loudness across tracks.
- FR-002.1.R2: Avoid modifying original audio files (NFR-001).
- FR-002.1.R3: Prevent clipping.

### FR-002.2 Requirements
- FR-002.2.R1: Loudness analysis is computed once per track and cached.
- FR-002.2.R2: Playback applies gain adjustments dynamically.
- FR-002.2.R3: A fixed reference loudness is used for playback normalization.
- FR-002.2.R4: Cortinas have their own configurable playback level.
- FR-002.2.R5: DJs may adjust overall playback levels without recomputing analysis.
- FR-002.2.R6: Gain is applied during preview playback and main output playback.
- FR-002.2.R7: Compression support uses an offline-rendered companion file and
  a runtime wet/dry mix control on the main channel.
- FR-002.2.R8: Compression processing applies to the main output path only;
  headphone preview remains uncompressed.
- FR-002.2.R9: The compression mix control defaults to 0% on startup.
- FR-002.2.R10: The compression mix control resets to 0% whenever a new main
  playback item starts, including cortinas, so compression must be enabled
  deliberately per item by the DJ.
- FR-002.2.R11: During main playback, the compression mix is automatically
  returned to 0% in the last ~20 seconds before the effective playback end so
  fade-outs are not level-corrected.

---

## FR-011 — Tanda Management

- FR-011.R1: DJs can create, edit, reorder, and delete tandas.
- FR-011.R2: Tandas reference tracks by stable ID.
- FR-011.R3: Invalid tandas (missing tracks) are detected and surfaced.
- FR-011.R4: Editing a tanda must be fast and low-friction.
- FR-011.R5: Tanda editing supports:
  - FR-011.R5.a: Default empty tanda sized by a system configuration value.
  - FR-011.R5.b: Extending tanda length with additional placeholders.
  - FR-011.R5.c: Reordering tracks within the tanda.
  - FR-011.R5.d: Removing tracks back to the clipboard.
  - FR-011.R5.e: Derived fields (total duration, instrumental flag) updated live.
- FR-011.R6: Tanda styles may be one or more styles.
- FR-011.R7: Style filtering for search/clipboard updates immediately when a tanda is selected.
- FR-011.R8: Tracks without an instrumental flag are treated as non-instrumental.
- FR-011.R9: DJs may export saved tandas as a portable JSON file containing tanda metadata and track path references.

---

## FR-020 — Playlist Structure

### FR-020.1 Playlist Definition
- FR-020.1.R1: DJs may define playlist structure symbolically (e.g. `3T-3T-3W-3M`).
- FR-020.1.R2: Symbols map to DJ-defined musical styles.
- FR-020.1.R3: Structure and content are separable.

### FR-020.2 Live Editing
- FR-020.2.R1: Tandas may be reordered during playback.
- FR-020.2.R2: Cortinas may be enabled, disabled, or replaced at any tanda boundary.

### FR-020.3 Persistence
- FR-020.3.R1: The current playlist auto-saves after edits.
- FR-020.3.R2: The playlist reloads on app start and restores its slots.
- FR-020.3.R3: Only a single unnamed playlist is required for now.
- FR-020.3.R4: DJs may manually save the current playlist as a portable JSON file.
- FR-020.3.R5: DJs may import a previously saved portable playlist file.
- FR-020.3.R6: Imported playlist files must restore playlist items, tanda snapshots, and compatible cortina assignments when matching local tracks can be found.
- FR-020.3.R7: DJs may manually save or import the current playlist in grouped `m3u` / `m3u8` form for cross-machine interchange when the same relative music layout exists.

---

## FR-021 — Rule-Based Playlists

- FR-021.R1: The system must support playlists defined by rules rather than fixed content.

- FR-021.R2: A rule-based playlist may specify a tanda style sequence (e.g. 3T-3T-3W-3M).
- FR-021.R3: A rule-based playlist may specify whether tandas are constructed from:
  - FR-021.R3.a: Individual tracks.
  - FR-021.R3.b: Predefined user tandas.
- FR-021.R4: A rule-based playlist may specify similarity constraints for tanda construction.
- FR-021.R5: A rule-based playlist may specify exclusion rules:
  - FR-021.R5.a: Do not repeat tracks.
  - FR-021.R5.b: Avoid tracks used in previous playlists.

Behavior:
- FR-021.R6: Each generation produces a different playlist.
- FR-021.R7: Generated playlists may be played directly.
- FR-021.R8: Generated playlists may be converted into an absolute playlist.
- FR-021.R9: Generated playlists may have individual tandas saved permanently.
- FR-021.R10: Standard playlist files such as `m3u`/`m3u8` may be imported as track-only sources into the current playlist.
- FR-021.R11: Grouped `m3u` / `m3u8` import may treat contiguous `group-title` or `EXTGRP` sections as tandas.
- FR-021.R12: Standard playlist import/export may discard full tanda metadata, playlist rules, and explicit cortina planning when those concepts are not represented by the source format.
- FR-021.R14: System backup export/import must transfer only app-managed data entries and must not overwrite Electron runtime cache directories under the active data root.

---

## FR-022 — Auto DJ / Auto Play Mode

This requirement set is no longer relevant for the current product scope and is
intentionally deferred.

---

## FR-023 — Context-Aware Search Feedback

- FR-023.R1: When viewing search results in the context of a playlist, the system must display:
  - FR-023.R1.a: Whether tracks or tandas are already used in the playlist.
  - FR-023.R1.b: Whether tracks were used in recent playlists.
  - FR-023.R1.c: Artist/orchestra usage density indicators.
- FR-023.R2: The purpose is to nudge exploration, not enforce limits.

---

## FR-024 — Artist Exploration Tools

- FR-024.R1: The system may provide tools to support musical exploration, including:
  - FR-024.R1.a: Counts of existing tandas per artist.
  - FR-024.R1.b: Counts of untanda'd tracks per artist.
  - FR-024.R1.c: Quick creation of new tandas based on artist selection.
- FR-024.R2: These tools are advisory and must not interrupt primary workflows.

---

## FR-030 — Cortina Handling

### FR-030.1 Cortina Sources
- FR-030.1.R1: Cortinas are loaded from designated library roots (USB or local folders).
- FR-030.1.R2: Subfolders represent cortina groups.
- FR-030.1.R3: All cortina tracks are searchable at runtime.

### FR-030.2 Runtime Selection
- FR-030.2.R1: DJs may replace a cortina immediately before it plays.
- FR-030.2.R2: UI provides search and browse across all cortina tracks.
- FR-030.2.R3: Selection takes effect without disrupting playback state.

### FR-030.3 Playback Rules
- FR-030.3.R1: Cortinas play for a defined duration.
- FR-030.3.R2: Cortinas are faded out by the system.
- FR-030.3.R3: Cortinas play at a separate volume level from tanda tracks.

---

## FR-062 — Edit Mode

- FR-062.R1: Add an Edit mode alongside Preparation and Live modes.
- FR-062.R2: In Edit mode, clicking a track plays it and opens the track editor
  automatically for metadata edits.
- FR-062.R3: Edit mode does not auto-start playlist playback; it focuses on
  per-track review and correction.
- FR-062.R4: Track notes are editable and stored as part of the track metadata.

---

## FR-040 — Gaps, Silence, and Overlap Rules

### FR-040.1 Configurable Timing
For each playlist, DJs may configure timing values for:
- FR-040.1.R1: Between tracks within a tanda.
- FR-040.1.R2: Before the first track of a tanda.
- FR-040.1.R3: After the last track of a tanda.
- FR-040.1.R4: Before a cortina.
- FR-040.1.R5: After a cortina.

### FR-040.2 Silence and Overlap
- FR-040.2.R1: Positive gap values represent silence.
- FR-040.2.R2: Zero represents immediate transition.
- FR-040.2.R3: Negative values represent overlap.

For overlaps:
- FR-040.2.R4: The next track starts before the previous ends.
- FR-040.2.R5: System-defined fade-in and fade-out curves are applied.
- FR-040.2.R6: Fade behavior is consistent and predictable.

### FR-040.3 Enforcement
- FR-040.3.R1: Timing is enforced using stored track start/end metadata.
- FR-040.3.R2: Original files are never altered.

