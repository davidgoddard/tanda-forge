# Tracking and Feature Matrix

This document tracks legacy features, TP2 functional requirements,
and implementation status to prevent drift.

---

## Legacy Feature Tracking

| Legacy ID | Feature | Decision | Notes |
|---------|--------|----------|------|
| LF-003 | Wi-Fi hotspot fallback | KEEP | Required for venue environments |
| LF-007 | Duplicate song detection | EVOLVE (later) | Audio fingerprinting preferred |
| LF-012 | Playlist import/export | EVOLVE (later) | Emergency interoperability |
| LF-014 | Print playlists | KEEP | CSS-only print layout |
| LF-018 | Display boards | KEEP | Read-only remote endpoint |
| LF-025 | Lighting integration | DROP | Separate project |
| LF-026 | Dancer preferences | DROP | Out of scope |
| LF-028 | Database repair | EVOLVE | Reframed as resilience + snapshots |

---

## Functional Requirement Coverage

| FR ID | Description | Spec’d | Implemented | Notes |
|------|------------|:------:|:-----------:|------|
| FR-001.1 | Library root scanning | Yes | Partial | Done: recursive scan, root availability, deletions. Missing: mount/unmount tracking, `last_seen_at`, root change events. |
| FR-001.2 | Background analysis | Yes | Partial | Done: tags, silence offsets, loudness (loudnorm). Missing: batch queue persistence, retry policy, analysis scheduling. |
| FR-001.3 | Progress + resume + deletion handling | Yes | Partial | Done: progress, skip unchanged, deletion cleanup. Missing: resumable job state across app restarts. |
| FR-002 | Loudness normalization | Yes | Partial | Done: store loudness/gain and apply to preview/main. Missing: configurable reference loudness, cortina level handling. |
| FR-011 | Tanda management | Yes | Partial | Done: tanda designer UI, save/delete to DB, search tab. Missing: import/export, advanced validation rules. |
| FR-020 | Playlist structure | Yes | Partial | Done: playlist UI, start/resume/stop, active tanda expansion, live-mode locking. Missing: persistence, rule-based generation, cortina integration. |
| FR-030 | Cortina handling | Yes | Partial | Done: separate cortina roots. Missing: grouping, search, playback rules, volume override. |
| FR-040 | Gaps & overlaps | Yes | Partial | Done: configurable gaps between tracks and before tandas. Missing: overlap rules, cortina timing, negative-gap fades. |
| FR-050 | Playback state machine | Yes | Partial | Done: sequential renderer playback with resume state. Missing: deterministic engine, multi-client state sync, scheduling visibility. |
| FR-096 | Incremental loading + virtualization | Yes | Partial | Done: lazy paging + bidirectional scroll. Missing: DOM windowing/virtualization. |
| FR-097 | Jump index + jumping | Yes | Partial | Done: index + jump with filtered track search support. Missing: tanda jump index. |

---

## Next Planned Documents

- `04-resilience-and-persistence.md`
- `05-ui-principles-and-components.md`
- `06-search-and-similarity.md`
