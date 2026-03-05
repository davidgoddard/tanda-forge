# Audio Pipeline

Requirement identifiers: All requirement bullets in this document are
identified as `AUD-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## AUD-001 — Overview

The main process owns audio analysis and cache rendering orchestration. Runtime
playlist playback control is renderer-driven. Original source audio files are
never modified on disk.

## AUD-002 — Analysis Pipeline

- AUD-002.R1: Use bundled `ffprobe` to extract container and tag metadata.
- AUD-002.R2: Use `ffmpeg` to compute:
  - AUD-002.R2.a: Loudness (EBU R128 integrated).
  - AUD-002.R2.b: Leading/trailing silence offsets.
- AUD-002.R2.c: Waveform PNG previews.
- AUD-002.R3: Store results in SQLite for reuse at playback time.

AUD-002.R4: Loudness analysis uses `loudnorm` with a target integrated loudness of -16 LUFS
and stores both the measured loudness and gain offset.

- AUD-002.R5: Loudness JSON parsing must tolerate FFmpeg banners/extra output and extract
  the most recent valid JSON block without aborting the scan.
- AUD-002.R6: Tag JSON parsing must tolerate stray output and extract valid JSON blocks
  without failing the overall scan.
- AUD-002.R7: Analysis must be resilient to malformed or partial FFmpeg output; JSON
  parser failures should not abort scanning, and errors should be sanitized before
  surfacing to users.
- AUD-002.R8: Legacy-imported metadata rows are provisional and must be forced
  through real analysis on the next scan pass before they are treated as reusable.
- AUD-002.R9: Per-track scan execution may run analysis and waveform generation
  concurrently; failures are isolated and logged independently.

## AUD-003 — Playback Pipeline

- AUD-003.R1: Playback engine schedules tracks with gaps or overlaps per playlist rules.
- AUD-003.R2: Gain is applied at playback time based on stored loudness.
- AUD-003.R2.a: If explicit gain is missing, playback gain is derived from stored loudness
  relative to the -16 LUFS target.
- AUD-003.R2.b: Runtime gain supports attenuation and controlled boost
  (capped linear gain) so imported legacy loudness/gain data can still normalize audibly.
- AUD-003.R2.c: When both explicit gain and loudness exist, runtime applies a bounded
  drift correction toward target loudness to reduce residual loudness mismatches.
- AUD-003.R2.d: Playback gain decisions (source, computed gain, measured loudness,
  applied linear gain) are logged for diagnostics and post-event review.
- AUD-003.R2.e: When only legacy `gain_db` is available (no measured loudness),
  per-track gain step changes are guarded between consecutive plays to reduce
  abrupt perceived loudness jumps.
- AUD-003.R3: Cortinas use a separate level and fade policy.
- AUD-003.R4: Preview playback (headphones) is independent of main output.
- AUD-003.R5: Per-element output routing uses media-element sink assignment
  (`setSinkId`) without routing playback through a shared WebAudio destination,
  so main and headphone channels can target different devices reliably.
- AUD-003.R6: Dynamic-range compression uses offline-rendered companion audio
  files plus runtime wet/dry mix on the main output channel.
- AUD-003.R7: Companion files may be precomputed in bulk from Library settings,
  or generated/prefetched on demand during playback workflows.

## AUD-004 — Output Routing

- AUD-004.R1: Users assign audio outputs for main and headphone channels in Settings.
- AUD-004.R2: If only one output is available, it is used as main and headphones are hidden.

## AUD-005 — Timing Rules

- AUD-005.R1: All timing is computed in milliseconds using analyzed start/end offsets.
- AUD-005.R2: Negative gaps represent overlap and require fade-in/out curves.
- AUD-005.R3: Playback state machine is deterministic and restartable.
- AUD-005.R4: When per-track analyzed durations are unavailable, timeline/start-time
  estimation must fall back to tanda-level stored duration metadata instead of collapsing
  to zero-length entries.

## AUD-006 — Output Device Control

- AUD-006.R1: Default output is the OS default device.
- AUD-006.R2: Optional device selection is exposed (planned).
- AUD-006.R3: Headphone preview output is supported if OS provides a distinct device.
- AUD-006.R4: Output-route application must be validated when users choose a
  non-default device; failed sink assignment must be surfaced in status/diagnostics
  and must not silently fall back headphone preview onto the main/default output.
- AUD-006.R5: If explicit sink routing fails for either main or headphone channel,
  playback must fail fast for that channel (with user-visible diagnostics) rather
  than silently playing on the OS default output.

## AUD-007 — Failure Modes

- AUD-007.R1: Missing track: skip and mark item invalid; do not crash playback.
- AUD-007.R2: Analysis failure: mark track as unanalyzed and retry later.
- AUD-007.R3: Playback normalization decisions are logged (gain source, applied gain,
  loudness, and correction) for diagnostics and tuning.
- AUD-007.R4: Companion-render failures fall back to original playback and
  expose failure details in diagnostics/status.
