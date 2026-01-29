# Audio Playback and Timing Model

Requirement identifiers: All requirement bullets in this document are
identified as `FR-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

---

## FR-050 — Playback Engine Overview

FR-050.R1: Playback must be deterministic, predictable, and robust under live conditions.
FR-050.R2: The playback engine operates as a state machine rather than a simple queue.

---

## FR-051 — Playback Units

The engine schedules and plays the following units:
- FR-051.R1: Silence
- FR-051.R2: Track (with offset, trim, gain)
- FR-051.R3: Cortina (with duration, gain, fade-out)

FR-051.R4: Each unit has a known start time, end time, and transition behavior.

---

## FR-052 — Track Playback

For each track:
- FR-052.R1: Playback begins at the computed start offset.
- FR-052.R2: Playback ends at the computed end trim.
- FR-052.R3: Gain adjustment is applied at runtime.
- FR-052.R4: No fades are applied unless overlap rules require them (FR-040).

FR-052.R5: Preview playback (headphones) is independent of playlist playback and does not
change the main output state.

---

## FR-053 — Cortina Playback

For each cortina:
- FR-053.R1: Track is selected from the current cortina group or overridden manually.
- FR-053.R2: Playback starts at track start offset.
- FR-053.R3: Playback ends at the DJ-defined duration.
- FR-053.R4: Fade-out is applied using system-defined curves.
- FR-053.R5: Cortina gain is applied independently.

---

## FR-054 — Overlap and Fades

When a negative gap is defined:
- FR-054.R1: The next unit begins before the current unit ends.
- FR-054.R2: Fade-out of the current unit and fade-in of the next unit overlap.
- FR-054.R3: Fade curves are system-defined, not per-track.

---

## FR-055 — Playback State Visibility

The playback engine must expose:
- FR-055.R1: Current unit
- FR-055.R2: Next scheduled unit
- FR-055.R3: Remaining time
- FR-055.R4: Pending overrides (e.g. cortina replacement)

FR-055.R5: This state is consumed by the UI and must remain consistent across clients.

---

## Current Implementation Notes (Electron)

Playlist playback currently runs in the renderer as a sequential loop on the
main output channel. Start/resume/stop are supported; stop fades out over a
configurable duration, and resume uses in-memory position only. Gaps are applied
between tracks within a tanda and before each tanda. Cortina gaps are stored
but not scheduled yet. Played tandas are locked and muted in Live mode while
playback state is active. Track start offsets and end trims are applied to
playback and reflected in display durations and waveform seeking.
