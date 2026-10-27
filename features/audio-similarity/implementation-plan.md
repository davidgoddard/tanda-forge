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
- [x] Implement direct click-to-replicate with protected-field enforcement and
  a window-scoped, session-only undo stack.
- [x] Add metadata workflow tests.

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
- [x] Add press-and-hold duplicate focus with a keyboard equivalent, persistent
  Show-all dismissal, and the scheduled collapsed layout used by playlist
  filtering.
- [x] Show a live effective-audio playhead on the playing playlist track.
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

## Phase 10 — Release-completion interaction improvements

- [x] Pulse the exact playlist track reached through direct or confirmed-
  equivalent duplicate navigation.
- [x] Centralise similarity-preview button state and reset it on stop, end,
  error, replacement, and report navigation.
- [x] Present affected tandas as ordered playback-oriented tanda cards with
  compact current/alternative recording comparison and per-position replacement.
- [x] Offer confirmed, available recording alternatives before adding from
  Search or Clipboard to a new or existing tanda.
- [x] Preserve stable, visible identities for tandas imported from multiple
  legacy sources and make reimport non-destructive and idempotent.
- [ ] Complete full regression and release-corpus verification.

## Phase 11 — Group review clarity

- [x] Replace the group-level elected radio with persisted confirmed-member
  checkboxes and partial matched counts.
- [x] Add persistent group collapse/expand state, strong group colour
  distinction, and an in-heading Confirmed Match tag.
- [x] Rebuild the open metadata comparison after a successful copy.
- [x] Replace affected-tanda action buttons with a checked current-recording
  radio list that refreshes after replacement.
- [x] Complete post-change full regression verification.

## Phase 12 — Relationship and compact-summary refinement

- [x] Keep metadata and affected-tanda controls compact and inline.
- [x] Summarize relevant metadata differences on the group card.
- [x] Add same-orchestra/different-performance as a distinct persisted class.
- [x] Add DJ-confirmed identical groups with an explicitly elected master and
  silently resolve only that relationship class during tanda assignment.
- [x] Keep other recordings and performances selectable and composition-linked
  tracks active for duplicate protection.
- [x] Run unit/build preflight and the focused Electron similarity workflow.

## Phase 13 — Visual shared audition

- [x] Reuse cached library waveform images in each candidate track row.
- [x] Add pointer and keyboard controls for the shared relative offset.
- [x] Synchronize group playheads, percentage text, active preview seeking, and
  subsequent preview start positions.
- [x] List distinct candidate titles in the persistent group heading.
- [x] Prompt for the required master during identical confirmation when none
  was elected inline.
- [x] Replace the add-to-tanda alternative cards with a radio table, standard
  headphone audition controls, and footer Apply/Cancel actions.
- [x] Canonically order candidate edge IDs before database insertion.
- [x] Complete post-change verification.

## Phase 14 — Similarity review integration polish

- [x] Move hidden-track management below visible report groups.
- [x] Stop main output before every similarity audition path.
- [x] Shorten candidate rejection actions to localized **No match** labels.
- [x] Open the normal track editor from metadata comparison columns and refresh
  the report after saving.
- [x] Audit similarity vocabulary across all seven languages and complete the
  Icelandic translations.
- [x] Align lazy overlays and selection states with application theme variables.
- [x] Relax metadata and affected-tanda spacing, and retain metadata comparison
  behind the normal editor until explicitly closed.
- [x] Bound affected-tanda overlays to the viewport with an internally scrolling
  body, scroll press-and-hold duplicate focus to the first exact playlist use,
  and loosen the exact-track highlight outline.
- [x] Complete post-change full and focused Electron verification.
