# Music-aware Lighting Integration

Status: implemented for the first DMX-only milestone on the `music-aware-lighting` branch.

## Requirements

- **MAL-TF-001:** Only an explicitly attached main-output `HTMLAudioElement` publishes playback. Headphone/cue playback never calls the publisher.
- **MAL-TF-002:** Each play occurrence has a unique session ID and monotonically increasing sequence. Reusing the same active element for pause/resume preserves its session.
- **MAL-TF-003:** Events contain schema version, tango/cortina kind, absolute original source path, effective media position, duration, rate, state, and send time. They contain no queue or next-track data.
- **MAL-TF-004:** Start, play, pause, seek, rate change, stop, and end publish immediately; playing state is refreshed every 750 ms.
- **MAL-TF-005:** Delivery uses the existing optional loopback Lighting connection, with at most one active request and one latest queued snapshot. Requests time out after 500 ms; throttled failures never fail playback.
- **MAL-TF-006:** Cortina events are identified as `cortina`, allowing Lighting to preserve its higher-priority lights-up behavior without analysing them as tango music.

## Contract

Events are posted to `http://127.0.0.1:8080/api/playback` as schema version 1. `positionSeconds` is the browser media element's actual time, so configured silence trimming and seeks are reflected. `path` is the original library path rather than an optional compressed companion/cache path.

Lighting and Tanda Forge must run on the same machine for this first version. No path translation or remote file access is attempted.
