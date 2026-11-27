# Tanda Forge — current handoff

Updated 2026-11-27. Read this briefing first, then only the feature files needed
for the request. It replaces the accumulated chronological handoff; its exact
previous contents are preserved in [the handoff archive](archive/handoff-through-2026-11-26.md).
Search that archive only when historical context is needed; do not read it in full.

## Current state

- Electron/TypeScript desktop application for library preparation, tanda design,
  playlists and live Argentine tango events. Package version is 0.5.6.
- Main owns SQLite, local files, scanning, analysis, caches and diagnostics.
  Preload exposes the typed API; renderer owns UI and live sequencing/playback.
- `app/src/main/main.ts`, `app/src/preload/preload.ts` and
  `app/src/shared/types.ts` connect the processes. Renderer startup/composition
  remains in `app/src/renderer/renderer.ts`.
- Main includes multiple ordered cortinas per playlist position, compatibility
  with old single-cortina data, and the physical-end marked-last farewell fix.
- Recent behavior includes exact-track/recording-alias Find Tandas, saved tanda
  style labels, BPM analysis with playback-safe permission, ALAC playable-WAV
  fallback, and transactional library maintenance/root operations.
- Separate style-analysis integration was last recorded on
  `feature/style-analysis-integration`; do not assume it is part of main.
- No new user-visible behavior is intended by the current refactoring batch.

## Working constraints

- Preserve live playback, audio routing, source files and stored track/tanda IDs.
  Keep existing guards against playback during library maintenance.
- Use locale maps for UI strings: `app/src/renderer/locales/` and `i18n.ts`.
- Preserve unrelated working-tree changes. Do not commit/push without a request.
- Incremental fixes use focused tests/builds; documentation reconciliation and
  full preflight belong at a commit/push/release checkpoint (see `AGENTS.md`).
- The current environment could not launch Electron. The user ran all 81
  end-to-end tests successfully after the latest cortina picker extraction; ask
  the user to rerun E2E at later significant milestones instead of retrying here.
- Do not change FFmpeg pins or perform unrelated release verification.

## Find the code for a fix

The maintained navigation table now lives in `docs/code-map.md`. Paths below are
relative to `app/src/renderer/` unless stated otherwise.
Start with the listed feature module and its unit tests. Use a narrow symbol
search in `renderer.ts` only for its wiring or remaining shared playback state.
Do not load the whole renderer, stylesheet, handoff archive or dialogue history.

| Request area | First source files | Focused tests under `tests/` |
| --- | --- | --- |
| Confirmation, save/delete choices, clear dialogs | `modules/confirmation-dialog.ts`, `choice-dialogs.ts`, `clear-dialogs.ts` | `renderer-dialogs.test.ts`, `tanda-deletion.test.ts` |
| Shell element IDs | `modules/renderer-elements.ts`, `index.html` | affected feature tests; renderer type check |
| Similarity report, metadata/relationships, audition | `controllers/audio-similarity-controller.ts` | `audio-similarity-controller.test.ts`, `audio-similarity-ui.test.ts` |
| Confirmed/hidden similarity lookups | `state/audio-similarity-index.ts` | `audio-similarity-index.test.ts` |
| Similarity analysis/storage | `app/src/main/audio-similarity/`, `app/src/shared/audio-similarity.ts` | `audio-similarity-algorithm.test.ts`, `audio-similarity-service.test.ts` |
| Playlist statistics and library diversity | `controllers/statistics-controller.ts`, `modules/statistics-charts.ts` | `statistics-controller.test.ts`, `playlist-diversity.test.ts`, `chart-scale.test.ts` |
| Style families and legacy style mapping UI | `controllers/style-settings-controller.ts`, `modules/style-family-view.ts` | `style-settings-controller.test.ts`, `style-families.test.ts`, `legacy-style-mappings.test.ts` |
| Diagnostic track review/audition/deletion | `controllers/diagnostics-track-review-controller.ts` | `settings-diagnostics-controller.test.ts`, affected review checks |
| Other diagnostics settings | `controllers/settings-diagnostics-controller.ts`, `app/src/main/diagnostics.ts` | `settings-diagnostics-controller.test.ts`, `main-diagnostics.test.ts` |
| Search/query/tab behavior | `controllers/search-controller.ts`, `modules/search-view.ts`, `app/src/main/library/search.ts` | search controller and search tests |
| Playlist interactions/rendering | `controllers/playlist-interactions-controller.ts`, `playlist-runtime-controller.ts`, `modules/playlist-view.ts` | corresponding controller tests, `playlist-view.test.ts` |
| Clipboard/list interactions | `controllers/library-list-interactions-controller.ts`, `modules/clipboard-view.ts` | corresponding controller tests, clipboard tests |
| Track editor | `modules/track-editor-view.ts`, `track-editor-path.ts`; remaining coordination in `renderer.ts` | track-editor tests |
| Tanda rows/designer | `modules/tanda-track-view.ts`; remaining designer logic in `renderer.ts` | `tanda-track-menu.test.ts`, `tanda-designer-playlist-action.test.ts` |
| Cortina picker | `controllers/cortina-picker-controller.ts`; planning/playback remains in `renderer.ts` | `cortina-picker.test.ts`, `cortina-picker-style.test.ts` |
| BPM | `controllers/bpm-controller.ts`, `app/src/main/bpm/`, `app/src/shared/bpm.ts` | BPM tests; `docs/bpm-measurement.md` |
| Display board | `modules/display-view.ts`, `display.js`, `display.css` | display/now-playing tests |
| Compression/output routing | `controllers/playback-compression-controller.ts`, `modules/playback-view.ts`; audio runtime in `renderer.ts` | compression/output/normalization tests |
| General/library/playlist settings | `controllers/settings-*-controller.ts` | corresponding settings controller tests |
| Library maintenance, imports, root moves | `app/src/main/library/`, `app/src/main/legacy-import.ts`, `modules/library-workflow.ts` | matching library/legacy tests |
| UI state and domain types | `state/feature-store.ts`, `domain.ts`, `app/src/shared/state/renderer-ui-store.ts` | `renderer-ui-store.test.ts`, feature-store tests |

## Refactoring boundaries

- Dialog state is private to dialog factories. Translation remains live through
  the supplied `t` function; callers supply current collections and library roots.
- Static DOM lookups are queried once through `queryRendererElements`; returned
  bindings retain nullable DOM types and existing renderer initialization order.
- Similarity owns its report, poll timer, audition and metadata-undo state.
  Index getters expose the latest maps after reload; never snapshot those maps
  in renderer wiring. The pure index builder preserves existing group precedence.
- Similarity and diagnostic auditions call the existing renderer stop/routing
  callbacks. Playback internals have not been moved into those feature modules.
- Statistics and style settings read mutable application state through explicit
  accessor properties. Replacing playlists/families must remain observable;
  do not destructure those properties into stale construction-time snapshots.
- Statistics charts are separated from report queries and playlist-filter actions.
- Feature factories are composed before `init()`; they do not start report loads
  or background polls just by being constructed.
- The cortina picker owns modal state, results, selection and autofill wiring;
  renderer retains cortina planning, live edit locks and playback.
- `renderer.ts` still owns substantial playback, designer, cortina planning, clipboard and
  startup coordination. Continue extracting bounded features, not arbitrary line
  ranges or an untyped shared context object. Keep each fix local where possible.

## Requirements and history

- Requirements/design: `design/02-functional-requirements.md`,
  `05-ui-principles-and-components.md`, `07-electron-architecture-and-structure.md`,
  and the domain-specific design files. Search relevant identifiers/headings.
- Feature status: `design/tracking-and-feature-matrix.md`.
- Audio behavior: `design/03-audio-playback-and-timing-model.md`,
  `design/10-audio-pipeline.md`.
- Data/settings/imports: `design/08-storage-and-data-model.md`,
  `design/13-legacy-data-reference.md`, `design/14-settings-and-configuration.md`.
- User guide: `docs/user-guide.md`; significant decision history:
  `docs/dialogue.md`. These are references, not mandatory full-file reads.
- Historical release notes and old verification results remain in the archive.
  They do not establish verification of the current uncommitted batch.

## Verification and remaining work

- The user confirmed E2E passed after the designer Generate/Complete and Web
  Audio runtime extractions, and reported audio working in a manual check.
- Tanda summaries, sorting and expanded track details now live in
  `modules/tanda-presentation.ts`. The user confirmed all 81 E2E tests passed
  after this extraction.

- Latest milestone: 136 unit files / 798 tests passed (1 file / 8 tests skipped)
  and the production build passed after the cortina picker extraction. The
  focused picker tests also passed. The concise runner reported only Vite's
  existing CJS deprecation warning.
- The user ran all 81 E2E tests successfully after this extraction. Electron
  still cannot launch in the agent environment, so this is user-supplied evidence.
- Compared 39 extracted function bodies with the baseline: 37 preserve syntax
  apart from dependency access; the two intentional structural changes delegate
  index building and separate duplicate-focus event registration.
- Last recorded release verification: 130 unit files / 779 tests and production
  build passed using Electron's matching SQLite runtime with two workers.
- Known environment issue: plain host-Node preflight can SIGSEGV in search-index
  tests when the SQLite native module targets Electron. Use the matching runtime
  when required; do not treat a crash as passing or change tests to hide it.
- This batch does not constitute a release checkpoint. Relevant end-to-end
  workflows, packaging and FFmpeg integrity checks remain necessary for release.
