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

| FR ID | Description | Spec’d | Implemented |
|------|------------|:------:|:-----------:|
| FR-001.1 | Library root scanning | Yes | Partial |
| FR-001.2 | Background analysis | Yes | Partial |
| FR-001.3 | Progress + resume + deletion handling | Yes | Partial |
| FR-002 | Loudness normalization | Yes | Partial |
| FR-011 | Tanda management | Yes | No |
| FR-020 | Playlist structure | Yes | No |
| FR-030 | Cortina handling | Yes | Partial |
| FR-040 | Gaps & overlaps | Yes | No |
| FR-050 | Playback state machine | Yes | No |
| FR-096 | Incremental loading + virtualization | Yes | Partial |
| FR-097 | Jump index + jumping | Yes | Partial |

---

## Next Planned Documents

- `04-resilience-and-persistence.md`
- `05-ui-principles-and-components.md`
- `06-search-and-similarity.md`
