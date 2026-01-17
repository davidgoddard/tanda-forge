# Audio Playback and Timing Model

---

## FR-050 — Playback Engine Overview

Playback must be deterministic, predictable, and robust under live conditions.
The playback engine operates as a state machine rather than a simple queue.

---

## FR-051 — Playback Units

The engine schedules and plays the following units:
- Silence
- Track (with offset, trim, gain)
- Cortina (with duration, gain, fade-out)

Each unit has a known start time, end time, and transition behavior.

---

## FR-052 — Track Playback

For each track:
- Playback begins at the computed start offset.
- Playback ends at the computed end trim.
- Gain adjustment is applied at runtime.
- No fades are applied unless overlap rules require them (FR-040).

---

## FR-053 — Cortina Playback

For each cortina:
- Track is selected from the current cortina group or overridden manually.
- Playback starts at track start offset.
- Playback ends at the DJ-defined duration.
- Fade-out is applied using system-defined curves.
- Cortina gain is applied independently.

---

## FR-054 — Overlap and Fades

When a negative gap is defined:
- The next unit begins before the current unit ends.
- Fade-out of the current unit and fade-in of the next unit overlap.
- Fade curves are system-defined, not per-track.

---

## FR-055 — Playback State Visibility

The playback engine must expose:
- Current unit
- Next scheduled unit
- Remaining time
- Pending overrides (e.g. cortina replacement)

This state is consumed by the UI and must remain consistent across clients.
