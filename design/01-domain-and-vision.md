# Tanda Player 2 — Domain and Vision

## Purpose

Tanda Player 2 is a music playback and preparation system designed specifically
for DJs playing milongas, where the primary unit of musical intent is the tanda,
not the individual track.

The system exists to support:

- Long-term music curation and tanda construction
- Flexible event preparation
- Reliable, low-risk live DJing
- Consistent sound levels and predictable timing on the dance floor

This is not a general-purpose music player.

---

## Core Domain Concepts

### Track
A Track is a single audio file stored on removable media (typically USB).

Tracks:
- Are immutable on disk (NFR-001)
- Have derived and DJ-assigned metadata (FR-001, FR-010)
- May appear in multiple tandas
- Have audio analysis metadata used at playback time (FR-002, FR-003)

---

### Tanda
A Tanda is an ordered group of tracks intended to be played consecutively
as a single musical experience.

A Tanda:
- Has a musical style (extensible; not hard-coded) (FR-011)
- Is curated for internal musical coherence
- Is the primary object DJs search for, edit, reorder, and play
- May be marked invalid if required tracks are missing (FR-012)

---

### Playlist
A Playlist represents the structure and content of a specific event
(e.g. a milonga).

A Playlist:
- Is an ordered sequence of tandas (FR-020)
- May include optional cortinas between tandas (FR-030)
- Has configurable timing rules (FR-040)
- May be modified during live playback, subject to mode safety rules (FR-060)

---

### Cortina
A Cortina is incidental music played between tandas to clear the floor.

Cortinas:
- Are optional (FR-030)
- Are sourced from designated folders on USB media (FR-031)
- Are grouped by folder name (e.g. “Jazz”, “Salsa”)
- May be selected or replaced at the last moment during an event (FR-032)
- Play at a different volume than tanda tracks (FR-033)
- Play for a defined duration and are faded out by the system (FR-034)

---

## DJ Workflows

The system explicitly supports two operating modes (FR-060):

### Preparation Mode
- Scanning and maintaining a music library (FR-001)
- Classifying and enriching track metadata (FR-010)
- Constructing, editing, and refining tandas (FR-011)
- Defining playlist structures (FR-020)
- Safe, immediate preview playback (FR-061)

### Performance Mode
- Deterministic playback using a state machine (FR-050)
- Minimal cognitive load and accidental-change prevention (NFR-010)
- Safe last-second adjustments (e.g. cortina changes) (FR-032)
- Clear visibility of what is playing and what is next (FR-070)

The UI, defaults, and safeguards differ between these modes.
