# Outstanding Work Worksheet

This worksheet reflects the current state after the recent spec-alignment pass.

It now focuses only on work that still appears to be outstanding, risky, or
stale.

Use the item types as follows:

- `Spec behind code`: the app behavior has moved on and the docs should be
  updated again.
- `Code behind spec`: still-desired product behavior that is not yet fully
  implemented.
- `Quality risk`: structural or ownership issue likely to keep causing
  regressions, confusion, or slow delivery.

## A. Spec Behind Code

| ID | Area | Type | Current Reality | Spec / Doc Mismatch | Suggested Update |
|---|---|---|---|---|---|
| A-01 | Storage/data-root model | Resolved | The app uses a configurable data root, and custom locations are normalized under `_tp_data` via [data-location.ts](/Users/david/Projects/TandaPlayer2026/app/src/main/data-location.ts#L1). | The storage doc had still described fixed platform app-data locations as the primary model. | Resolved: [08-storage-and-data-model.md](/Users/david/Projects/TandaPlayer2026/design/08-storage-and-data-model.md#L1) now treats the configurable data root as canonical and platform paths as defaults only. |
| A-02 | Data-availability model | Resolved | Current behavior is: missing roots are surfaced clearly, missing files are removed during scan cleanup, and the app does not maintain a `last_seen_at` availability ledger. | The data model doc still mentioned `last_seen_at` and unavailable-track marking as if that were the active design. | Resolved: the storage/data doc now matches the actual root/file-availability strategy in use. |
| A-03 | Matrix notes vs current test coverage | Resolved | Several previously fragile flows now have passing E2E coverage, including tanda-detail send-to-clipboard and playlist/clipboard click-start flows. | The matrix still carried stale “reported unreliable” notes for `UI-014` and `UI-016`. | Resolved: stale bug-history notes were replaced with the actual remaining gaps only. |

## B. Code Behind Spec

| ID | Area | Type | What Spec Says | Current Code State | Suggested Next Step |
|---|---|---|---|---|---|
| B-01 | Tanda export/import | Future idea | Optional manual export/import remains desirable later. | There is still no general tanda export flow beyond legacy import. | Keep as a later Library-tab feature: export tandas/playlists to JSON for manual editing and possible future re-import. |
| B-02 | Tanda Designer drag/drop | Code behind spec | The designer/UI docs still imply richer tanda editing ergonomics than the current up/down-button approach. | [tracking-and-feature-matrix.md](/Users/david/Projects/TandaPlayer2026/design/tracking-and-feature-matrix.md#L60) still marks drag/drop reordering as missing. | Decide whether drag/drop still matters enough to keep in scope; if yes, treat it as a separate UI enhancement after the refactor work. |
| B-03 | Similarity visualization | Code behind spec | [05-ui-principles-and-components.md](/Users/david/Projects/TandaPlayer2026/design/05-ui-principles-and-components.md#L360) still defines a dedicated similarity visualization area. | Matrix still shows `UI-030` as planned/no implementation. | Either explicitly defer/remove it from active scope, or promote it into a real future feature with tighter requirements. |

## C. Quality Risks

| ID | Area | Type | Evidence | Risk | Suggested Action |
|---|---|---|---|---|---|
| C-01 | Renderer monolith | Quality risk | [renderer.ts](/Users/david/Projects/TandaPlayer2026/app/src/renderer/renderer.ts#L1) is still about 16k LOC even after recent extractions. | Playback and mode behavior remain easy to break because too many responsibilities still converge in one file. | Continue phased extraction, with playback/event-routing, settings persistence wiring, and modal orchestration as the next seams. |
| C-02 | Main-process monolith | Quality risk | [main.ts](/Users/david/Projects/TandaPlayer2026/app/src/main/main.ts#L1) is still about 2.2k LOC and owns IPC wiring, diagnostics, cache maintenance, scan orchestration, waveform generation, and compression precompute. | Refactor pressure is now shifting from renderer only to main-process orchestration as well. | Start extracting cohesive main-process services/controllers so `main.ts` becomes mostly Electron bootstrapping and IPC registration. |
| C-03 | Fragmented persistence ownership | Quality risk | State is still split across SQLite, filesystem caches, configurable data root, and many renderer `localStorage` keys in [renderer.ts](/Users/david/Projects/TandaPlayer2026/app/src/renderer/renderer.ts#L847). | Machine portability is weaker than desired, and it is hard to tell which settings are app data versus browser-local UI state. | Produce a persistence ownership map, then migrate non-trivial user settings/preferences toward the shared data store where appropriate. |
| C-04 | Event-routing complexity | Quality risk | Search/clipboard/playlist/tanda interactions still depend on many branch-heavy handlers in [renderer.ts](/Users/david/Projects/TandaPlayer2026/app/src/renderer/renderer.ts#L7000). | Mode-specific click behavior has already produced repeated regressions and E2E churn. | Continue moving click-intent and playback-start rules into pure helpers/reducers with targeted unit + E2E coverage. |
| C-05 | Matrix/doc trustworthiness | Quality risk | The matrix is better than before, but it still mixes future ideas, real gaps, and stale bug-history notes. | Planning becomes noisy again unless the matrix is kept aligned with the clarified scope. | Do a focused matrix cleanup pass after this worksheet refresh, then treat it as a maintained status page rather than a historical notes dump. |

## D. Recommended Triage Order

The current highest-value order looks like this:

1. Continue the renderer refactor workstream:
   `C-01`, `C-04`.
2. Start the matching main-process extraction work:
   `C-02`.
3. Clarify persistence ownership and portability:
   `C-03`.
4. Keep future product ideas clearly separated from active engineering work:
   `B-01`, `B-02`, `B-03`, plus `C-05`.

## E. Working Notes

The biggest remaining engineering problem is still concentration of business
logic in `renderer.ts`, but the next review also shows that `main.ts` is now a
meaningful secondary refactor target.

The biggest remaining documentation problem is no longer high-level product
direction; it is keeping the matrix and lower-level storage/persistence docs in
sync as refactoring continues.
