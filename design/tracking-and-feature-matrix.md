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
| FR-001 | Library discovery & analysis | ✅ | ⬜ |
| FR-002 | Loudness normalization | ✅ | ⬜ |
| FR-011 | Tanda management | ✅ | ⬜ |
| FR-020 | Playlist structure | ✅ | ⬜ |
| FR-030 | Cortinas | ✅ | ⬜ |
| FR-040 | Gaps & overlaps | ✅ | ⬜ |
| FR-050 | Playback state machine | ✅ | ⬜ |

---

## Next Planned Documents

- `04-resilience-and-persistence.md`
- `05-ui-principles-and-components.md`
- `06-search-and-similarity.md`
