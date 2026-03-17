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
| FR-001.1 | Library root scanning | Yes | Yes | Done: recursive scan, root availability checks, startup/use-time missing-root surfacing, and deletions. Mount/unmount event tracking is no longer required scope. |
| FR-001.2 | Background analysis | Yes | Partial | Done: tags, silence offsets, loudness (loudnorm) with tolerant parsing of malformed output, and scan reuse guard that forces re-analysis for provisional legacy-import metadata. Missing: batch queue persistence, retry policy, analysis scheduling. |
| FR-001.3 | Progress + resume + deletion handling | Yes | Yes | Done: progress, skip unchanged scan work, deletion cleanup, and restart-safe reruns that reuse finished cache work while retrying incomplete outputs. Persisted in-flight job queues are not required scope. |
| FR-002 | Loudness normalization | Yes | Yes | Done: store loudness/gain, apply on preview/main, derive gain from loudness when explicit gain is missing, use a fixed playback reference loudness, support capped runtime gain boost, apply dedicated cortina level scaling, add bounded drift-correction when gain+loudness disagree, and log playback normalization decisions for diagnostics. |
| FR-011 | Tanda management | Yes | Partial | Done: tanda designer UI, save/delete to DB, search tab, legacy tandas import without full scan (library.dat + cortinas.dat), waveform PNG reuse, and metadata overrides. Future idea: optional tanda export/import for manual external editing. |
| FR-020 | Playlist structure | Yes | Partial | Done: playlist UI, start/resume/stop, active tanda expansion, live-mode locking, auto-save/restore, cortina slots and playback integration, in-playlist tanda editor for ad-hoc creation, target-mark replacement and cross-swap with warnings, clear-options modal (clear vs clear+autofill), expected end-time control (overnight-safe), and auto-fill cortina pre-assignment for all required cortina rows when cortinas are enabled. Missing: save/export flows. |
| FR-021 | Rule-based playlists | Yes | Partial | Done: sequence/style-map guided auto-fill with fallback ad-hoc tanda synthesis and title de-duplication. Missing: user-configurable generation weights/constraints and save/export flows. |
| FR-022 | Auto DJ / auto play | Deferred | No | No longer relevant for the current product scope; intentionally deferred. |
| FR-062 | Edit mode | Yes | Yes | Done: Edit mode added; clicking tracks plays and opens editor; playlist clicks avoid auto-start in edit. |
| FR-030 | Cortina handling | Yes | Yes | Done: separate cortina roots, set naming incl. Default, playlist set selection, queue shuffle/refill, playback between tandas + start/end, picker modal, play-all/stop-now controls with duration feedback, and dedicated cortina playback level control. |
| FR-040 | Gaps & overlaps | Yes | Yes | Done: configurable positive/zero/negative gaps between tracks, before tandas, before cortinas, overlap/crossfade scheduling across track and cortina boundaries, stop fade, and cortina duration with live-mode handling. |
| FR-050 | Playback state machine | Yes | Partial | Done: renderer-owned sequential playback with resume state, start/end trims applied, playlist-click start from the selected playlist track in Preparation mode even during active main playback, guarded playlist-click start in Live mode when idle, natural continuation through the remaining sequence, and scheduled cortina/tanda gap handling. Missing: multi-client sync, richer scheduling visibility, and continued refactor toward smaller playback modules. |
| FR-056 | Close safety | Yes | Yes | Done: warn on close when audio is playing, allow cancel. |
| FR-089 | Search fundamentals | Yes | Yes | Done: track/tanda search tabs, scoped actions, context menus, and S shortcut. |
| FR-090 | Search scope and fields | Yes | Partial | Done: track/tanda search, track fields incl. notes, style filters, numeric year/BPM handling, and music-root-only track corpus (cortina-root tracks excluded from track search/tanda-building lists). Missing: rating/instrumental filters in tanda search. |
| FR-091 | Fuzzy, fault-tolerant search | Yes | Partial | Done: trigram/token fuzzy scoring, token edit-distance bonus, implicit token parsing (year/tempo/text), quoted-phrase boost, lookup-vs-similarity ranking profiles (numeric intent triggers similarity), proximity scoring for year/tempo with missing-metadata fallback, deterministic component tie-break ranking, configurable min score, numeric query handling, and alias-expanded artist/orchestra matching using canonical+variant metadata. Missing: configurable accent-sensitive toggle. |
| FR-092 | Similarity search shortcuts | Yes | Partial | Done: track/tanda S actions populate track search; track-editor field-level S shortcuts append field values to the current search query with token de-duplication. Missing: weighting controls and UI to tune similarity sources. |
| FR-093 | Ranking and ordering | Yes | Partial | Done: relevance scoring with trigram + edit-distance bonus, default score ordering on non-empty queries, stable ordering, sortable columns, jump index for filtered queries, and weighted priority favoring style/artist/singer/BPM/year/notes over title-only matches. Missing: configurable relevance weighting. |
| FR-095 | Tokenization and ignored phrases | Yes | Partial | Done: artist normalization rules. Missing: configurable ignore list and nickname mapping. |
| FR-094 | Alias metadata | Yes | Yes | Done: seeded alias dataset and registry editing UI; alias/canonical matching used in search ranking and orchestra grouping; user-edited orchestra alias registry persists in local application storage by design. |
| FR-096 | Incremental loading + virtualization | Yes | Partial | Done: lazy paging + bidirectional scroll. Missing: DOM windowing/virtualization. |
| FR-097 | Jump index + jumping | Yes | Yes | Done: index + jump with filtered track search support. Tanda jump index is no longer required scope. |

---

## UI Requirement Coverage

| UI ID | Description | Spec’d | Implemented | Notes |
|------|------------|:------:|:-----------:|------|
| UI-014 | Three-column workspace | Yes | Partial | Done: search/clipboard/playlist columns, tabs, counts, add actions, playlist send-to-clipboard for tracks/tandas, first-free slot insertion, auto-restore playlist, track-to-playlist creates tanda with in-playlist editor, empty-slot click creates styled tanda, playlist clear options (clear vs clear+autofill), expected-end-time aware auto-fill, clipboard filter, tab focus on add, and target-mark swap actions. Missing: broader polish around add/send workflows and tab-focus consistency. |
| UI-012 | Playlist timeline | Yes | Partial | Done: active tanda expansion, active track highlight, estimated start times, idle auto-centering of the current tanda during playback, fallback to tanda stored duration when per-track analysis duration is missing, auto-fill placeholder tandas (required size/style) with mismatch warnings using 9-minute assumed duration for end-time projection when required material is unavailable, context-sensitive Playlist `Clear` behavior (playlist view: modal options; designer view: immediate designer reset), prep-mode playlist-click start that begins immediately on the selected track without a lead-in cortina and then continues through the remaining playlist sequence, and guarded Live-mode playlist click-start when idle. Missing: next-up visualization and multi-client state sync. |
| UI-082 | Clipboard collections | Yes | Yes | Done: active collection tabs, include chips, local persistence, add/remove collections, system "New" collection with configurable size, `Available` smart collection keyed by canonical artist+style groups (alias-aware), clipboard tanda click selects only (edit via T or drag/drop), drag track to collection lozenge moves it, row-menu `M` action for tracks+tandas with target picker/direct behavior, read-only smart-source copy semantics, and multi-collection clear dialog with optional empty-collection cleanup (excluding General/New). |
| UI-015 | Now Playing strip | Yes | Yes | Done: single-row layout for label + metadata + waveform, artist/title, duration, waveform preview, seek in prep mode only, and waveform placeholder while generating. |
| UI-016 | Tanda Designer | Yes | Partial | Done: draft editing, placeholders, save/delete, add slot, Done action, filtering, up/down controls, in-playlist editor view for ad-hoc tandas, separation of playlist-origin drafts from the designer list, and startup reset to one empty designer template without preloading saved tandas. Missing: drag/drop reordering and further workflow polish. |
| UI-017 | Tanda Summary (planned) | Yes | Partial | Done: shared summary format with artists, vocal status, years, BPM range, duration, rating display. Missing: dedicated summary config UI. |
| UI-020 | Cortina selector | Yes | Partial | Done: fixed-size cortina picker modal with set selection/search and playlist rows show selected/playing cortina titles. Missing: keyboard shortcuts and audition workflow. |
| UI-030 | Similarity visualization | Yes | No | Planned; not implemented. |
| UI-040 | Waveform preview | Yes | Partial | Done: waveform display, placeholder on load, click-to-seek, on-demand caching, scan-time generation, diagnostics panel, explicit PNG encoder, resilient FFmpeg invocation. Missing: centralized retry policy for failed waveform generation. |
| UI-050 | Configuration panel | Yes | Yes | Done: Library/System/Playlist/Display Board tabs, diagnostics paths, waveform test, playback-leveling diagnostics log viewer, data-readiness summary for missing duration/loudness/trim/errors/waveforms, legacy-section readiness verification button with pass/warn/fail result, and cache-management actions. Gain-target controls and generic UI-visibility toggles are no longer required scope. |
| UI-010a | Track editor form | Yes | Partial | Done: non-modal in-place editor, waveform strip, tap tempo, save/reset/close, and per-field localized S shortcuts that append to search. Missing: field-level keyboard shortcut map and advanced validation hints. |
| UI-060 | Display board UI | Yes | Partial | Done: separate display window, top-right launcher, fullscreen support, now-playing metadata, randomized background-image rotation with abstract animated fallback, cortina-focused headline mode, user-configurable base font scaling, larger artist typography, and suppression of next-tanda text when playlist playback is not active. Missing: dedicated display-window controls panel (monitor targeting/preview). |
| UI-070 | Playlist integrity enforcement | Yes | Partial | Done: style mismatch warnings, count confirmation, mismatch badges, swap warnings when style/count changes. Missing: search-and-replace enforcement hooks. |
| UI-080 | Scratch pad | Yes | Partial | Done: clipboard tabs and add/remove. Missing: explicit cross-playlist drag/drop from playlist into scratch pad. |
| UI-083 | Style families | Yes | Yes | Done: Library-tab style family editor (code/base/sub-styles), sequence code resolution from families, base-style pills with family-aware filtering, grouped track-editor style picker, legacy per-row style mapping actions, and variant selection via right-click/long-press with relabeled active pills and exact filtering. |

---

## Notes

- Several planned UI components remain documented for future implementation.

## Next Discussion Shortlist (Not Fully Implemented)

The following items are still Partial or No in the matrix above:

- FR-001.2: background analysis persistence and scheduling refinements.
- FR-021: rule-based playlists (weights/constraints tuning and export still pending).
- FR-050: continued playback refactor, scheduling visibility, and multi-client sync.
- FR-090 to FR-097: remaining search filters and ranking refinements.
- UI-012: next-up visualization and multi-client sync.
- UI-016: drag/drop reordering + workflow polish.
- UI-020: cortina keyboard shortcuts + audition workflow.
- UI-030: similarity visualization.
- UI-040: waveform generation retry policy.
