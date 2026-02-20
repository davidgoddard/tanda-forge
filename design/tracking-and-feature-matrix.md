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
| FR-001.2 | Background analysis | Yes | Partial | Done: tags, silence offsets, loudness (loudnorm) with tolerant parsing of malformed output. Missing: batch queue persistence, retry policy, analysis scheduling. |
| FR-001.3 | Progress + resume + deletion handling | Yes | Partial | Done: progress, skip unchanged, deletion cleanup. Missing: resumable job state across app restarts. |
| FR-002 | Loudness normalization | Yes | Partial | Done: store loudness/gain, apply on preview/main, derive gain from loudness when explicit gain is missing, support capped runtime gain boost, add bounded drift-correction when gain+loudness disagree, and log playback normalization decisions for diagnostics. Missing: configurable reference loudness, cortina level handling. |
| FR-011 | Tanda management | Yes | Partial | Done: tanda designer UI, save/delete to DB, search tab, legacy tandas import without full scan (library.dat + cortinas.dat), waveform PNG reuse, and metadata overrides. Missing: export, advanced validation rules. |
| FR-020 | Playlist structure | Yes | Partial | Done: playlist UI, start/resume/stop, active tanda expansion, live-mode locking, auto-save/restore, cortina slots and playback integration, in-playlist tanda editor for ad-hoc creation, target-mark replacement and cross-swap with warnings, clear-options modal (clear vs clear+autofill), expected end-time control (overnight-safe), and auto-fill cortina pre-assignment for all required cortina rows when cortinas are enabled. Missing: save/export flows. |
| FR-021 | Rule-based playlists | Yes | Partial | Done: sequence/style-map guided auto-fill with fallback ad-hoc tanda synthesis and title de-duplication. Missing: user-configurable generation weights/constraints and save/export flows. |
| FR-022 | Auto DJ / auto play | Yes | No | Missing: auto-play playlist flagging and unattended playback mode. |
| FR-062 | Edit mode | Yes | Yes | Done: Edit mode added; clicking tracks plays and opens editor; playlist clicks avoid auto-start in edit. |
| FR-030 | Cortina handling | Yes | Partial | Done: separate cortina roots, set naming incl. Default, playlist set selection, queue shuffle/refill, playback between tandas + start/end, picker modal, play-all/stop-now controls with duration feedback. Missing: dedicated volume override. |
| FR-040 | Gaps & overlaps | Yes | Partial | Done: configurable gaps between tracks, before tandas, before cortinas, stop fade, cortina duration with live-mode handling. Missing: overlap rules, negative-gap fades. |
| FR-050 | Playback state machine | Yes | Partial | Done: sequential renderer playback with resume state, start/end trims applied. Missing: deterministic engine, multi-client state sync, scheduling visibility. |
| FR-056 | Close safety | Yes | Yes | Done: warn on close when audio is playing, allow cancel. |
| FR-089 | Search fundamentals | Yes | Yes | Done: track/tanda search tabs, scoped actions, context menus, and S shortcut. |
| FR-090 | Search scope and fields | Yes | Partial | Done: track/tanda search, track fields incl. notes, style filters, numeric year/BPM handling. Missing: rating/instrumental filters in tanda search. |
| FR-091 | Fuzzy, fault-tolerant search | Yes | Partial | Done: trigram/token fuzzy scoring, token edit-distance bonus, implicit token parsing (year/tempo/style/text), quoted-phrase boost, auto lookup-vs-similarity ranking profiles (including short orchestra-like query preference), proximity scoring for year/tempo with missing-metadata fallback, deterministic component tie-break ranking, configurable min score, numeric query handling. Missing: configurable accent-sensitive toggle. |
| FR-092 | Similarity search shortcuts | Yes | Partial | Done: track/tanda S actions populate track search; track-editor field-level S shortcuts append field values to the current search query with token de-duplication. Missing: weighting controls and UI to tune similarity sources. |
| FR-093 | Ranking and ordering | Yes | Partial | Done: relevance scoring with trigram + edit-distance bonus, default score ordering on non-empty queries, stable ordering, sortable columns, jump index for filtered queries, and weighted priority favoring style/artist/singer/BPM/year/notes over title-only matches. Missing: configurable relevance weighting. |
| FR-095 | Tokenization and ignored phrases | Yes | Partial | Done: artist normalization rules. Missing: configurable ignore list and nickname mapping. |
| FR-094 | Alias metadata | Yes | No | Missing: alias dataset ingestion and usage. |
| FR-096 | Incremental loading + virtualization | Yes | Partial | Done: lazy paging + bidirectional scroll. Missing: DOM windowing/virtualization. |
| FR-097 | Jump index + jumping | Yes | Partial | Done: index + jump with filtered track search support. Missing: tanda jump index. |

---

## UI Requirement Coverage

| UI ID | Description | Spec’d | Implemented | Notes |
|------|------------|:------:|:-----------:|------|
| UI-014 | Three-column workspace | Yes | Partial | Done: search/clipboard/playlist columns, tabs, counts, add actions, playlist send-to-clipboard for tracks/tandas, first-free slot insertion, auto-restore playlist, track-to-playlist creates tanda with in-playlist editor, empty-slot click creates styled tanda, playlist clear options (clear vs clear+autofill), expected-end-time aware auto-fill, clipboard filter, tab focus on add, and target-mark swap actions. Missing: verify send-to-clipboard reliability and add-to-tanda tab focus (reported unreliable). |
| UI-012 | Playlist timeline | Yes | Partial | Done: active tanda expansion, active track highlight, estimated start times, and idle auto-centering of the current tanda during playback. Missing: next-up visualization and multi-client state sync. |
| UI-082 | Clipboard collections | Yes | Yes | Done: active collection tabs, include chips, local persistence, add/remove collections, system "New" collection with configurable size, clipboard tanda click selects only (edit via T or drag/drop), drag track to collection lozenge moves it, multi-collection clear dialog with optional empty-collection cleanup (excluding General/New). |
| UI-015 | Now Playing strip | Yes | Yes | Done: single-row layout for label + metadata + waveform, artist/title, duration, waveform preview, seek in prep mode only, and waveform placeholder while generating. |
| UI-016 | Tanda Designer | Yes | Partial | Done: draft editing, placeholders, save/delete, add slot, Done action, filtering, up/down controls, in-playlist editor view for ad-hoc tandas, and separation of playlist-origin drafts from the designer list. Missing: drag/drop reordering; send-to-clipboard action reliability (reported). |
| UI-017 | Tanda Summary (planned) | Yes | Partial | Done: shared summary format with artists, vocal status, years, BPM range, duration, rating display. Missing: dedicated summary config UI. |
| UI-020 | Cortina selector | Yes | Partial | Done: fixed-size cortina picker modal with set selection/search and playlist rows show selected/playing cortina titles. Missing: keyboard shortcuts and audition workflow. |
| UI-030 | Similarity visualization | Yes | No | Planned; not implemented. |
| UI-040 | Waveform preview | Yes | Partial | Done: waveform display, placeholder on load, click-to-seek, on-demand caching, scan-time generation, diagnostics panel, explicit PNG encoder, resilient FFmpeg invocation. Missing: centralized retry policy for failed waveform generation. |
| UI-050 | Configuration panel | Yes | Partial | Done: Library/System/Playlist/Display Board tabs, diagnostics paths, waveform test, and playback-leveling diagnostics log viewer. Missing: gain target controls and UI visibility toggles. |
| UI-010a | Track editor form | Yes | Partial | Done: non-modal in-place editor, waveform strip, tap tempo, save/reset/close, and per-field localized S shortcuts that append to search. Missing: field-level keyboard shortcut map and advanced validation hints. |
| UI-060 | Display board UI | Yes | Partial | Done: separate display window, top-right launcher, fullscreen support, now-playing metadata, randomized background-image rotation with abstract animated fallback, cortina-focused headline mode, user-configurable base font scaling, larger artist typography, and suppression of next-tanda text when playlist playback is not active. Missing: dedicated display-window controls panel (monitor targeting/preview). |
| UI-070 | Playlist integrity enforcement | Yes | Partial | Done: style mismatch warnings, count confirmation, mismatch badges, swap warnings when style/count changes. Missing: search-and-replace enforcement hooks. |
| UI-080 | Scratch pad | Yes | Partial | Done: clipboard tabs and add/remove. Missing: explicit cross-playlist drag/drop from playlist into scratch pad. |

---

## Notes

- Several planned UI components remain documented for future implementation.

## Next Discussion Shortlist (Not Fully Implemented)

The following items are still Partial or No in the matrix above:

- FR-001.1, FR-001.2, FR-001.3: background analysis persistence and mount/change tracking.
- FR-002: configurable loudness targets and cortina-level handling.
- FR-021, FR-022: rule-based playlists and auto-play mode (weights/constraints tuning and export still pending).
- FR-030: dedicated cortina volume override.
- FR-040: overlap and negative-gap fade rules.
- FR-050: deterministic playback engine and multi-client sync.
- FR-090 to FR-097: remaining search filters, alias metadata, and tanda jump index.
- UI-012: next-up visualization and multi-client sync.
- UI-016: drag/drop reordering + reliability polish.
- UI-020: cortina keyboard shortcuts + audition workflow.
- UI-030: similarity visualization.
- UI-040: waveform generation retry policy.
- UI-050: gain target controls + UI visibility toggles.
