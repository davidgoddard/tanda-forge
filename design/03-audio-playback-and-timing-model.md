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
FR-052.R6.c: In Preparation mode, clicking a playlist track while another main
track is already playing immediately restarts playlist playback from the newly
selected track position.
FR-052.R6.a: In Preparation mode, playlist-click start does not play a lead-in
cortina before the selected starting track; the selected track starts
immediately. Live mode retains lead-in cortina behavior when starting at the
first track of a tanda.
FR-052.R6.b: Switching between Preparation and Live modes during active
playlist playback must not interrupt runtime progression; when the current
track ends, playlist playback continues to the next track/tanda as normal.
FR-052.R7: Source formats that Chromium cannot play directly, including AIFF
and AIF, must be converted on demand to a renderer-compatible WAV cache before
playback while preserving the original source file unchanged.

---

## FR-053 — Cortina Playback

For each cortina:
- FR-053.R1: Track is selected from the current cortina group or overridden manually.
- FR-053.R2: Playback starts at track start offset.
- FR-053.R3: Playback ends at the DJ-defined duration.
- FR-053.R3.a: The configured cortina-duration timer starts when cortina playback starts.
- FR-053.R3.b: If the timer expires, fade-out starts immediately and is timed to
  complete at the configured cortina-duration cutoff.
- FR-053.R3.c: While that timer is still active, the DJ may either stop the
  cortina immediately with a fade from the current position or cancel the timer
  and let the cortina continue to its natural trimmed end.
- FR-053.R4: Fade-out is applied using system-defined curves.
- FR-053.R5: Cortina gain is applied independently.
- FR-053.R6: When cortinas are enabled, a cortina plays before the first tanda
  and after the final tanda in the playlist.
- FR-053.R7: A pre-cortina delay is applied after a tanda ends and before the next
  cortina starts (when configured); there is no pre-cortina delay before the
  first cortina when starting a playlist.
- FR-053.R8: After a cortina fades out, the pre-tanda delay is applied before the
  next tanda starts (when configured).
- FR-053.R9: During a playing cortina, a manual "Play" override must cancel the
  configured-duration fade path even if that fade has already started, so the
  cortina continues to its natural trimmed end or until a later manual stop.

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

Preparation-mode playlist track click always starts playback immediately from
the selected track (no lead-in cortina), even when another playlist track is
already playing. Live mode retains guarded start behavior and may still use the
lead-in cortina when starting from a tanda summary or a playlist track click.
Confirmed one-off playback in Live mode applies to direct track clicks from
Search and Clipboard while main output is idle; playlist track clicks continue
to follow normal playlist start behavior.

For live performances, the playlist can be marked to pause after the current
tanda and its following cortina. That stop point preserves a resumable next
item and the exact cortina used there, so pressing Playlist `Play` later
replays that cortina and then continues into the next tanda/item.

Compression uses pre-rendered companion audio for main-channel playback, with a
runtime wet/dry mix slider in the now-playing strip. Companion files are
prefetched for upcoming playlist items and can be bulk precomputed from
Settings -> Library. The slider resets to `0%` whenever a new main-output item
starts (track or cortina), and playback automatically returns the mix to `0%`
for the final ~20 seconds before the effective end so natural fades are left
unaltered.

Played tandas are locked and muted in Live mode while playback state is active.
Track start offsets and end trims are applied to playback and reflected in
display durations and waveform seeking.

AIFF/AIF source files are scanned as normal library tracks. At playback time the
renderer asks the main process for a transparent WAV compatibility render from
the original file, caches it under the active data root, and then plays that WAV
through the same output-routing, gain, trim, and display pipeline as other
tracks.
