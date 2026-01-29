# Audio Pipeline

Requirement identifiers: All requirement bullets in this document are
identified as `AUD-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## AUD-001 — Overview

The main process owns audio analysis and playback control. Audio files are never
modified on disk.

## AUD-002 — Analysis Pipeline

- AUD-002.R1: Use bundled `ffprobe` to extract container and tag metadata.
- AUD-002.R2: Use `ffmpeg` to compute:
  - AUD-002.R2.a: Loudness (EBU R128 integrated).
  - AUD-002.R2.b: Leading/trailing silence offsets.
- AUD-002.R3: Store results in SQLite for reuse at playback time.

AUD-002.R4: Loudness analysis uses `loudnorm` with a target integrated loudness of -16 LUFS
and stores both the measured loudness and gain offset.

## AUD-003 — Playback Pipeline

- AUD-003.R1: Playback engine schedules tracks with gaps or overlaps per playlist rules.
- AUD-003.R2: Gain is applied at playback time based on stored loudness.
- AUD-003.R3: Cortinas use a separate level and fade policy.
- AUD-003.R4: Preview playback (headphones) is independent of main output.

## AUD-004 — Output Routing

- AUD-004.R1: Users assign audio outputs for main and headphone channels in Settings.
- AUD-004.R2: If only one output is available, it is used as main and headphones are hidden.

## AUD-005 — Timing Rules

- AUD-005.R1: All timing is computed in milliseconds using analyzed start/end offsets.
- AUD-005.R2: Negative gaps represent overlap and require fade-in/out curves.
- AUD-005.R3: Playback state machine is deterministic and restartable.

## AUD-006 — Output Device Control

- AUD-006.R1: Default output is the OS default device.
- AUD-006.R2: Optional device selection is exposed (planned).
- AUD-006.R3: Headphone preview output is supported if OS provides a distinct device.

## AUD-007 — Failure Modes

- AUD-007.R1: Missing track: skip and mark item invalid; do not crash playback.
- AUD-007.R2: Analysis failure: mark track as unanalyzed and retry later.
