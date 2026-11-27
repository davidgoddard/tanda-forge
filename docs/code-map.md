# Tanda Forge code map

Use the row matching the reported behavior, then search the listed files for the
relevant identifier. Paths are relative to `app/src/renderer/` unless stated.

| Area | Purpose and primary code | State / IPC / constraints | Focused tests |
| --- | --- | --- | --- |
| Renderer composition | Startup and cross-feature wiring: `renderer.ts`; DOM bindings: `modules/renderer-elements.ts`; lifecycle: `controllers/app-runtime-controller.ts` | Preload contract in `app/src/preload/preload.ts`; keep initialization order | controller tests; renderer type check; affected E2E workflow |
| Search and filters | Query/tab coordination: `controllers/search-controller.ts`, `modules/search-view.ts`; main search: `app/src/main/library/search.ts` | Renderer UI store and exact-tanda state | `search-controller.test.ts`, `library-search.test.ts`, `search-index.test.ts` |
| Playlist | Interaction/render/runtime controllers and `modules/playlist-view.ts`; remaining sequencing in `renderer.ts` | Persisted format: `app/src/shared/playlist-storage.ts`; live locks and timing are safety-critical | playlist controller/view/flow/storage tests; `tests/e2e/workflows.e2e.ts` |
| Tanda designer | Generate/Complete: `controllers/tanda-designer-generation.ts`; rows: `modules/tanda-track-view.ts`; draft ownership and shared candidate selection: `renderer.ts` | Playlist-hosted drafts and saved masters must retain IDs | `tanda-designer-generation.test.ts`, designer/completion tests, workflow E2E |
| Tanda presentation | Summaries, artist sorting and expanded track details: `modules/tanda-presentation.ts` | Reads the current track cache and effective durations through callbacks | tanda utility tests and search, clipboard and playlist workflow E2E |
| Cortina picker | `controllers/cortina-picker-controller.ts`; cortina planning/playback remains in `renderer.ts` | Reads cortinas through preload; selection state is controller-private; live edit locks remain renderer-owned | `cortina-picker.test.ts`, `cortina-picker-style.test.ts`; cortina workflow E2E |
| Track editor | `modules/track-editor-view.ts`, `track-editor-path.ts`; coordination in `renderer.ts` | Saves via preload; preserve metadata and compressed-source hints | track-editor tests; workflow E2E |
| Clipboard | `controllers/library-list-interactions-controller.ts`, `modules/clipboard-view.ts`; shared move/order/clear helpers | Collection state in renderer feature store | clipboard and controller tests; workflow E2E |
| Similarity | `controllers/audio-similarity-controller.ts`, `state/audio-similarity-index.ts`; main service under `app/src/main/audio-similarity/` | Controller owns report/poll/audition state; use live index getters | audio-similarity controller/index/service/UI tests |
| Playback and display | Web Audio graph, gain and metering: `modules/web-audio-runtime.ts`; channel coordination and routing: `renderer.ts`; compression: `controllers/playback-compression-controller.ts`; playback/display/waveform modules | Safety-critical timing, routing and playlist progression; IPC display payload | audio, now-playing, display and playlist-flow tests; playback E2E |
| Settings and diagnostics | `controllers/settings-*-controller.ts`, `diagnostics-track-review-controller.ts` | Settings persisted through preload/local storage; use live state accessors | corresponding settings/diagnostics tests |
| Statistics and styles | `controllers/statistics-controller.ts`, `style-settings-controller.ts`; chart/style view modules | Controllers must observe replaced playlist/family state | statistics, diversity, style-family and mapping tests |
| Library and imports | `app/src/main/library/`, `app/src/main/legacy-import.ts`, `modules/library-workflow.ts` | SQLite/filesystem operations are high risk and transactional | library, root, transfer and legacy-import tests; workflow E2E |
| BPM and analysis | `controllers/bpm-controller.ts`, `app/src/main/bpm/`, `app/src/shared/bpm.ts` | Worker and playback permission; see `docs/bpm-measurement.md` | BPM unit tests and `tests/e2e/bpm.e2e.ts` |
| IPC and shared contracts | `app/src/main/main.ts`, `app/src/preload/preload.ts`, `app/src/shared/types.ts` | Maintain context isolation and typed public interfaces | main/preload/domain tests; both type checks |
| Packaging and FFmpeg | `.github/workflows/release.yml`, `scripts/fetch-ffmpeg.sh`, `docs/release-packaging.md` | Immutable assets/digests; platform package integrity | `fetch-ffmpeg-script.test.ts`; build/package CI |
