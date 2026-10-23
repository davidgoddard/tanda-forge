# Audio Similarity v0.4.0 Implementation Plan

Branch: `audio-similarity-v0.4.0`

Target application version: `0.4.0`

This task list delivers the planned requirements in
`features/audio-similarity/requirements.md`. Checkmarks record verified work,
not merely code written.

## Phase 0 — Baseline and release identity

- [x] Create a dedicated feature branch.
- [x] Preserve the standalone analysis experiment and measured baseline.
- [x] Set application/package version to `0.4.0`.
- [x] Confirm the pre-integration full test suite and production build.

## Phase 1 — Persistent domain model

- [x] Add versioned schema for analysis runs, per-track features, candidate
  groups/edges, confirmed flat groups, rejections, and global hidden state.
- [x] Add defensive migrations and indexes.
- [x] Implement group approval, partial approval/splitting, withdrawal,
  rejection, reconsideration, and persisted decision semantics.
- [x] Implement confirmed-equivalence lookup shared by UI and playlist logic.
- [x] Add unit tests for migrations and all decision transitions.

## Phase 2 — Integrated analysis service

- [x] Port the proven fixed-bin envelope/chroma/transition algorithm into the
  built application.
- [x] Decode stored silence-trimmed audio through the supported FFmpeg resolver.
- [x] Add incremental stale-feature detection using file identity and algorithm
  version.
- [x] Add bounded background execution, progress, cancellation, retry, and
  per-track failures without compromising playback.
- [x] Persist candidate groups while preserving DJ decisions.
- [x] Add focused algorithm, service, cancellation, and failure tests.

## Phase 3 — Typed application API

- [x] Add shared request/result types for status, generation, groups, decisions,
  metadata replication, hiding, usage, and replacement.
- [x] Add namespaced main-process handlers and preload bridge methods.
- [x] Validate all input and return defensive, user-actionable errors.
- [ ] Add API/controller tests.

## Phase 4 — Full-page report and auditioning

- [x] Add the Settings → Library entry button and full-page in-app report with a
  clear return action.
- [x] Implement empty, running, failed, stale, and completed states plus generate
  and regenerate actions.
- [x] Reproduce the static demo's searchable confidence-ranked flat group cards.
- [x] Add confirm, reject, partial member selection, split preview, withdrawal,
  and reconsideration controls.
- [x] Add one-at-a-time auditioning with a shared normalised group cursor and
  reset-to-start action using normal preview routing and effective trims.
- [x] Add i18n strings for every visible control/status in every language map.
- [ ] Add accessibility, controller, rendering, and workflow tests.

## Phase 5 — Metadata and provenance workflow

- [x] Add the wide comparison table with sticky attribute and track headers.
- [x] Show title, artist, album, path, neutral file-type lozenge, and all required
  editable/context fields without inferring quality.
- [x] Implement click-to-replicate with destination/value preview, confirmation,
  protected-field enforcement, and recovery/undo behaviour.
- [ ] Add metadata workflow tests.

## Phase 6 — Tanda and playlist usage/replacement

- [x] Show all tanda, saved-playlist, and current-playlist references per member.
- [x] Implement per-tanda replacement with affected-context preview.
- [x] Implement explicit selected-reference bulk replacement.
- [x] Provide tanda-context auditioning without mutating live playback state.
- [x] Recompute dependent duration/validity/readiness state defensively.
- [ ] Add replacement and playback-isolation tests.

## Phase 7 — System-wide hiding

- [x] Add reversible global hide/restore actions and explicit management view.
- [x] Exclude hidden tracks from every library/search, clipboard suggestion,
  tanda construction, recommendation, playlist choice, and auto-fill path.
- [x] Preserve existing references, expose their consequences, and prevent
  hidden-track leakage through fallback paths.
- [ ] Add query, selection, auto-fill, and restore tests.

## Phase 8 — Duplicate equivalence throughout the app

- [x] Extend duplicate indexes from exact track IDs to confirmed flat groups.
- [x] Update search/library/clipboard/tanda/playlist full and partial indicators.
- [x] Keep manual addition uninterrupted; show overlap only after insertion.
- [x] Add press-and-hold duplicate focus with release/cancel restoration and a
  keyboard equivalent.
- [x] Make auto-fill exclude confirmed same-composition groups and respect
  rejections/withdrawals.
- [ ] Add equivalence, indicator, interaction, and auto-fill tests.

## Phase 9 — Lifecycle, transfer, and release verification

- [x] Include analysis state, decisions, and hiding in backup/restore/reset/data
  relocation and track/root deletion lifecycles.
- [x] Add integrity/readiness reporting and algorithm-version invalidation.
- [x] Update user guide, technical design, feature matrix, dialogue, and handoff.
- [ ] Run labelled/known-result regression checks including the accepted 2,259-
  track baseline where locally available.
- [x] Run all unit tests, production build, and relevant Electron E2E workflows.
- [ ] Review the final diff for generated artifacts, large binaries, and local
  paths before declaring v0.4.0 complete.
