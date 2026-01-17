# Functional Requirements

---

## FR-001 — Music Library Discovery

### FR-001.1 USB Scanning
- The system scans mounted USB storage for audio files.
- Added, removed, and changed files are detected incrementally where possible.
- File identity must be stable across rescans (e.g. path + content hash).

### FR-001.2 Background Analysis (Per Track)
During discovery or re-analysis, the system performs background tasks:

- Extract metadata using FFmpeg/ffprobe (ID3, etc.).
- Detect leading and trailing silence to determine:
  - Start offset
  - End trim
  - Effective musical duration
- Compute loudness/gain metadata for playback normalization.

Analysis:
- Must not block the UI (NFR-002).
- Must be resumable and repeatable.
- Must persist results for reuse at runtime (NFR-003).

---

## FR-002 — Loudness and Gain Handling

### FR-002.1 Goals
- Achieve consistent perceived loudness across tracks.
- Avoid modifying original audio files (NFR-001).
- Prevent clipping.

### FR-002.2 Requirements
- Loudness analysis is computed once per track and cached.
- Playback applies gain adjustments dynamically.
- A configurable reference loudness is used.
- Cortinas have their own configurable playback level.
- DJs may adjust overall playback levels without recomputing analysis.

---

## FR-011 — Tanda Management

- DJs can create, edit, reorder, and delete tandas.
- Tandas reference tracks by stable ID.
- Invalid tandas (missing tracks) are detected and surfaced.
- Editing a tanda must be fast and low-friction.

---

## FR-020 — Playlist Structure

### FR-020.1 Playlist Definition
- DJs may define playlist structure symbolically (e.g. `3T-3T-3W-3M`).
- Symbols map to DJ-defined musical styles.
- Structure and content are separable.

### FR-020.2 Live Editing
- Tandas may be reordered during playback.
- Cortinas may be enabled, disabled, or replaced at any tanda boundary.

---

## FR-021 — Rule-Based Playlists

The system must support playlists defined by rules rather than fixed content.

A rule-based playlist may specify:
- Tanda style sequence (e.g. 3T-3T-3W-3M)
- Whether tandas are constructed from:
  - Individual tracks
  - Predefined user tandas
- Similarity constraints for tanda construction
- Exclusion rules:
  - Do not repeat tracks
  - Avoid tracks used in previous playlists

Behavior:
- Each generation produces a different playlist.
- Generated playlists may be:
  - Played directly
  - Converted into an absolute playlist
  - Have individual tandas saved permanently

---

## FR-022 — Auto DJ / Auto Play Mode

The system must support unattended playback.

Rules:
- A playlist may be marked as "auto play".
- On startup, the system automatically plays the auto-play playlist if configured.
- Rule-based playlists are regenerated at each run.
- Auto DJ behavior must never repeat tracks within a single playlist.

Use cases include:
- Practicas
- Background playback
- Unattended events

---

## FR-023 — Context-Aware Search Feedback

When viewing search results in the context of a playlist, the system must display:

- Whether tracks or tandas are already used in the playlist
- Whether tracks were used in recent playlists
- Artist/orchestra usage density indicators

The purpose is to nudge exploration, not enforce limits.

---

## FR-024 — Artist Exploration Tools

The system may provide tools to support musical exploration, including:

- Counts of existing tandas per artist
- Counts of untanda'd tracks per artist
- Quick creation of new tandas based on artist selection

These tools are advisory and must not interrupt primary workflows.

---

## FR-030 — Cortina Handling

### FR-030.1 Cortina Sources
- Cortinas are loaded from a designated folder on USB media.
- Subfolders represent cortina groups.
- All cortina tracks are searchable at runtime.

### FR-030.2 Runtime Selection
- DJs may replace a cortina immediately before it plays.
- UI provides search and browse across all cortina tracks.
- Selection takes effect without disrupting playback state.

### FR-030.3 Playback Rules
- Cortinas play for a defined duration.
- Cortinas are faded out by the system.
- Cortinas play at a separate volume level from tanda tracks.

---

## FR-040 — Gaps, Silence, and Overlap Rules

### FR-040.1 Configurable Timing
For each playlist, DJs may configure timing values for:
- Between tracks within a tanda
- Before the first track of a tanda
- After the last track of a tanda
- Before a cortina
- After a cortina

### FR-040.2 Silence and Overlap
- Positive gap values represent silence.
- Zero represents immediate transition.
- Negative values represent overlap.

For overlaps:
- The next track starts before the previous ends.
- System-defined fade-in and fade-out curves are applied.
- Fade behavior is consistent and predictable.

### FR-040.3 Enforcement
- Timing is enforced using stored track start/end metadata.
- Original files are never altered.

