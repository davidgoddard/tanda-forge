# Audio Pipeline

## Overview

The main process owns audio analysis and playback control. Audio files are never
modified on disk.

## Analysis Pipeline

- Use bundled `ffprobe` to extract container and tag metadata.
- Use `ffmpeg` to compute:
  - Loudness (EBU R128 integrated)
  - Leading/trailing silence offsets
- Store results in SQLite for reuse at playback time.

Loudness analysis uses `loudnorm` with a target integrated loudness of -16 LUFS
and stores both the measured loudness and gain offset.

## Playback Pipeline

- Playback engine schedules tracks with gaps or overlaps per playlist rules.
- Gain is applied at playback time based on stored loudness.
- Cortinas use a separate level and fade policy.
- Preview playback (headphones) is independent of main output.

## Output Routing

- Users assign audio outputs for main and headphone channels in Settings.
- If only one output is available, it is used as main and headphones are hidden.

## Timing Rules

- All timing is computed in milliseconds using analyzed start/end offsets.
- Negative gaps represent overlap and require fade-in/out curves.
- Playback state machine is deterministic and restartable.

## Output Device Control

- Default output is the OS default device.
- Optional device selection is exposed (planned).
- Headphone preview output is supported if OS provides a distinct device.

## Failure Modes

- Missing track: skip and mark item invalid; do not crash playback.
- Analysis failure: mark track as unanalyzed and retry later.
