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
- FR-052.R2.a: The player must stop at the trimmed end so trailing silence does not
  extend inter-track gaps.
- FR-052.R3: Gain adjustment is applied at runtime.
- FR-052.R3.a: If a track has no explicit gain value, runtime gain is derived
  from measured loudness against the -16 LUFS target.
- FR-052.R3.b: Runtime gain supports controlled positive gain (capped) so quiet
  tracks can still be normalized upward.
- FR-052.R4: No fades are applied unless overlap rules require them (FR-040).

FR-052.R5: Preview playback (headphones) is independent of playlist playback and does not
change the main output state.
FR-052.R6: In Preparation mode, clicking a track inside the playlist starts
playback from that track position and continues naturally through the remaining
playlist sequence.
FR-052.R6.a: In Preparation mode, playlist-click start does not play a lead-in
cortina before the selected starting track; the selected track starts
immediately. Live mode retains lead-in cortina behavior when starting at the
first track of a tanda.
FR-052.R6.b: Switching between Preparation and Live modes during active
playlist playback must not interrupt runtime progression; when the current
track ends, playlist playback continues to the next track/tanda as normal.

---

## FR-053 — Cortina Playback

For each cortina:
- FR-053.R1: Track is selected from the current cortina group or overridden manually.
- FR-053.R2: Playback starts at track start offset.
- FR-053.R3: Playback ends at the DJ-defined duration.
- FR-053.R4: Fade-out is applied using system-defined curves.
- FR-053.R5: Cortina gain is applied independently.
- FR-053.R6: When cortinas are enabled, a cortina plays before the first tanda
  and after the final tanda in the playlist.
- FR-053.R7: A pre-cortina delay is applied after a tanda ends and before the next
  cortina starts (when configured); there is no pre-cortina delay before the
  first cortina when starting a playlist.
- FR-053.R8: After a cortina fades out, the pre-tanda delay is applied before the
  next tanda starts (when configured).

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

## FR-056 — Close Safety

FR-056.R1: If audio is playing, app-close requests must warn the user and allow cancel.

---

## Current Implementation Notes (Electron)

Playlist playback currently runs in the renderer as a sequential loop on the
main output channel. Start/resume/stop are supported; stop fades out over a
configurable duration, and resume uses in-memory position only.

Gaps are scheduled and applied for:
- between tracks within tandas,
- before tandas,
- before cortinas, and
- after cortinas (before the next tanda).

When cortinas are enabled, the playlist flow includes:
- a lead-in cortina before the first tanda,
- cortinas between tandas,
- a final cortina after the last tanda.

Preparation-mode playlist track click starts playback immediately from the
selected track (no lead-in cortina). Live mode retains guarded start behavior.

Compression uses pre-rendered companion audio for main-channel playback, with a
runtime wet/dry mix slider in the now-playing strip. Companion files are
prefetched for upcoming playlist items and can be bulk precomputed from
Settings -> Library.

Played tandas are locked and muted in Live mode while playback state is active.
Track start offsets and end trims are applied to playback and reflected in
display durations and waveform seeking.
