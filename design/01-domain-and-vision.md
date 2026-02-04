# Tanda Player Lite — Domain and Vision

## Purpose

Tanda Player Lite is a music playback and preparation system designed specifically
for DJs playing milongas, where the primary unit of musical intent is the tanda,
not the individual track.

Requirement identifiers: All requirement bullets in this document are
identified as `DV-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

The system exists to support:

- DV-001.R1: Long-term music curation and tanda construction.
- DV-001.R2: Flexible event preparation.
- DV-001.R3: Reliable, low-risk live DJing.
- DV-001.R4: Consistent sound levels and predictable timing on the dance floor.

This is not a general-purpose music player.

---

## Core Domain Concepts

### Track
A Track is a single audio file stored in a library root (USB volume or local folder).

Tracks:
- DV-002.R1: Are immutable on disk (NFR-001).
- DV-002.R2: Have derived and DJ-assigned metadata (FR-001, FR-010).
- DV-002.R3: May appear in multiple tandas.
- DV-002.R4: Have audio analysis metadata used at playback time (FR-002, FR-003).

---

### Tanda
A Tanda is an ordered group of tracks intended to be played consecutively
as a single musical experience.

A Tanda:
- DV-003.R1: Has a musical style (extensible; not hard-coded) (FR-011).
- DV-003.R2: Is curated for internal musical coherence.
- DV-003.R3: Is the primary object DJs search for, edit, reorder, and play.
- DV-003.R4: May be marked invalid if required tracks are missing (FR-012).

---

### Playlist
A Playlist represents the structure and content of a specific event
(e.g. a milonga).

A Playlist:
- DV-004.R1: Is an ordered sequence of tandas (FR-020).
- DV-004.R2: May include optional cortinas between tandas (FR-030).
- DV-004.R3: Has configurable timing rules (FR-040).
- DV-004.R4: May be modified during live playback, subject to mode safety rules (FR-060).

---

### Cortina
A Cortina is incidental music played between tandas to clear the floor.

Cortinas:
- DV-005.R1: Are optional (FR-030).
- DV-005.R2: Are sourced from designated folders on USB media (FR-031).
- DV-005.R3: Are grouped by folder name (e.g. “Jazz”, “Salsa”).
- DV-005.R4: May be selected or replaced at the last moment during an event (FR-032).
- DV-005.R5: Play at a different volume than tanda tracks (FR-033).
- DV-005.R6: Play for a defined duration and are faded out by the system (FR-034).

---

## DJ Workflows

The system explicitly supports two operating modes (FR-060):

### Preparation Mode
- DV-006.R1: Scanning and maintaining a music library (FR-001).
- DV-006.R2: Classifying and enriching track metadata (FR-010).
- DV-006.R3: Constructing, editing, and refining tandas (FR-011).
- DV-006.R4: Defining playlist structures (FR-020).
- DV-006.R5: Safe, immediate preview playback (FR-061).

### Performance Mode
- DV-007.R1: Deterministic playback using a state machine (FR-050).
- DV-007.R2: Minimal cognitive load and accidental-change prevention (NFR-010).
- DV-007.R3: Safe last-second adjustments (e.g. cortina changes) (FR-032).
- DV-007.R4: Clear visibility of what is playing and what is next (FR-070).

The UI, defaults, and safeguards differ between these modes.
