## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.1` (from `package.json`)

### What I was doing last
- Implemented cortina-specific display-board behavior in renderer:
  - added cortina display phases (`about`, `playing`, `after`) around
    pre-cortina gap, cortina playback, and immediate post-cortina gap
  - external display now shows `Cortina` + localized `This tanda: {style}` during
    those phases
  - when there is no active track and no cortina phase, no idle payload is sent,
    so the display keeps previous text
- Enhanced abstract display background animation (`display.css`) with subtle
  animated color layers and drifting shapes (still low-distraction).
- Kept highlight clipping fixes (stable scrollbar gutter + insets) from prior pass.
- Updated design/docs:
  - `design/05-ui-principles-and-components.md` (UI-060 requirements)
  - `design/14-settings-and-configuration.md` (background roots + interval)
  - `design/tracking-and-feature-matrix.md` (UI-060 now Partial, with notes)
  - `docs/dialogue.md` updated with this request/response
- Re-ran verification: `npm test` and `npm run build` both pass.
- Follow-up fixes:
  - cortina truncation now always fades out (`Math.max(180ms, configured fade)`)
    unless user interaction enables full-song cortina playback
  - reduced per-tick UI work in now-playing highlighting: only clears previous
    active track rows and marks current active track rows, rather than scanning
    all `.list-row[data-track-id]` elements each update
  - display window is now frameless (top banner removed) for edge-to-edge
    projector output
  - frameless display window is now draggable by setting the display body as a
    drag region (`-webkit-app-region: drag`)
  - display board now supports explicit display mode payloads; cortina mode
    centers content and scales the "Cortina" headline aggressively to fill the
    screen while keeping the "This tanda" line readable
  - renderer performance pass:
    - external display updates are deduplicated (no IPC send when payload unchanged)
    - abstract display background animation disabled (static fallback)
    - waveform progress/playhead use short transitions and now-playing refresh
      tick reduced to 200ms for smoother motion
  - display window click-to-close added with drag guards (small movement + short
    click threshold required)
  - display drag/click interaction refined:
    - body remains clickable for close behavior
    - dedicated top drag strip added for window repositioning
  - list-row visual fixes:
    - playing highlight now uses inset stroke only (no horizontal margins)
      to avoid apparent row-height collapse and right-edge clipping
    - list scrollbar gutter changed to `stable` and row right-padding increased
      to keep menu/headphone controls clear of scrollbar
    - playlist mismatch warning badge moved fully inside row bounds
  - adjusted mismatch warning badge again: now anchored outside-left of tanda row
    to avoid covering right-side menu actions
  - refined mismatch badge visibility:
    - pushed badge farther outside row on the left
    - added playlist list left padding so outside-left badge remains fully visible
    - set playlist row container `overflow-x: visible` to prevent left-side badge clipping
    - tuned badge left offset for cleaner outside-border placement
  - clipboard `New` collection UX: tanda row menu now hides remove (`R`) action
    when `New` is the active collection, avoiding no-op/remove-block interactions
  - tanda row menus no longer include edit (`E`) action; this removes duplicate
    behavior where click/`T` already opens tanda editing flows
  - fixed playlist tanda-track `Search similar` action:
    - playlist `search-track` now resolves track IDs from expanded
      `.tanda-detail-line` rows, not just row-level track rows
    - this enables `S` to work for any track shown inside playlist tanda details
  - search-similar query quality:
    - added shared `dedupeQueryTokens` helper in `app/src/shared/search-query.ts`
    - track/tanda Search Similar query builders now dedupe repeated tokens
      before populating the search box to avoid weighting bias from duplicates
    - added unit tests in `tests/search-query.test.ts` for token deduplication
  - removed non-functional Track Editor Cancel button:
    - deleted `#track-editor-cancel` from `app/src/renderer/index.html`
    - removed renderer query/listener wiring for the deleted button
      in `app/src/renderer/renderer.ts`
  - playlist tanda menu behavior adjusted:
    - removed menu-level `E` expand action for playlist context
      (`tanda-toggle` no longer rendered in playlist row menus)
    - restored `T` edit/send behavior in playlist context by adding
      `tanda-edit` action back to playlist row menus
    - added playlist click handling for `tanda-edit` to open tanda editor
      in playlist-hosted designer flow (`openTandaInDesigner(..., \"playlist-tab\")`)
  - duplicate warning jump-to-playlist UX:
    - duplicate status icon inside warning menu button is now clickable
      (`.duplicate-jump`)
    - click resolves first matching playlist occurrence (track duplicate or
      tanda duplicate by full/partial track overlap)
    - app switches to Playlist tab, scrolls matched row into view, and applies
      temporary highlight (`.jump-highlight`)
    - duplicate icon carries localized hint text (`duplicateJumpHint`)
  - search panel density cleanup:
    - removed redundant inline search result count row (`#search-count`)
      from `app/src/renderer/index.html` because tab labels already show counts
    - removed obsolete search count display wiring in
      `app/src/renderer/renderer.ts`
    - removed unused `.result-count` style in `app/src/renderer/styles.css`
  - playlist guidance text updated:
    - revised `playlistHint` i18n copy (all supported languages) to clarify:
      1) mark a playlist slot for replacement from tanda menu
      2) replacement can come from Clipboard or Search
      3) without marked slot, sent tracks/tandas go to the first free slot
  - track editor close control by mode:
    - added `#track-editor-close` button back to modal footer
    - close button is shown in non-Edit modes (prep/live) and hidden in Edit mode
      via `updateTrackEditorPresentation`
    - close button handler now dismisses the editor and clears tap/editor state
  - search responsiveness improvement:
    - `refreshSearch()` now starts track-page loading immediately and runs
      count, jump-index, and tanda-search updates in parallel
    - this removes the prior serial wait (`count -> jump index -> tracks -> tandas`)
      and makes `S` actions populate visible track results faster
  - display ambient orb sizing:
    - increased generated orb size to ~2x previous scale by doubling
      `randomOrbConfig().size` in `app/src/renderer/display.js`
  - search scoring relevance tuning:
    - updated `scoreTrackAgainstQuery` in
      `app/src/main/library/fuzzy-search.ts` with prioritized weighting:
      artist (0.35) > title (0.30) > year (0.15) ~= bpm (0.15) > other (0.05)
    - scoring now uses phrase-in-query matching per field and normalizes by
      active weights (missing components do not unfairly cap max score)
    - kept typo resilience by blending with reduced legacy fuzzy score
      (`max(prioritized, legacy * 0.9)`)
    - added regression test in `tests/library-search.test.ts` for exact match
      ordering against partial artist matches
  - playlist metadata refresh after tanda save:
    - in `handleTandaAction` (`tanda-save`), added `renderPlaylist()` after
      save success so title/style/summary edits made in tanda editor are
      immediately reflected in playlist rows
  - cortina duration cutoff robustness:
    - in `waitForCortina`, duration cutoff now falls back to 20s when duration
      is invalid/non-positive, preventing indefinite waits/full playback
    - in `playCortina`, configured duration now resolves to an enforced
      `effectiveDurationMs` with the same fallback before waiting
    - expected behavior in prep/live: cortina fades at cutoff unless user hits
      Play-to-end (full) during cortina playback
  - cortina cutoff enforcement at audio layer:
    - extended `playOnChannel` options with `maxDurationSeconds` and
      `isCortinaPlayback`
    - playback `timeupdate` now enforces effective end as min(track trim, cortina cap)
      and skips cap only when `cortinaAllowFull` is enabled by user action
    - `playCortina` now passes configured duration cap into `playOnChannel`
      and avoids duplicate fade when audio already auto-paused at cutoff
  - display fallback background upgraded with low-cost ambient motion:
    - two alternating gradient orbs with randomized position/size/color
    - long fade transitions (12s cadence) to avoid CPU-heavy continuous animation
    - image-folder mode remains unchanged (cross-fade between images)
  - duplicate icon UX:
    - duplicate tooltip now includes reason text
    - full tanda duplicates show whole-tanda message
    - partial tanda duplicates list matching track labels
    - track duplicates show matching track label
  - display fallback ambient tuning:
    - increased orb saturation and opacity for stronger color presence
    - kept low-cost timer-driven transitions
    - both ambient orbs now remain visible concurrently with staggered updates
  - track editor visual contrast improved:
    - stronger border and larger rounding on `#track-editor .modal-card`
    - enhanced elevation/shadow
    - slightly stronger modal backdrop when track editor is open
  - display ambient orb behavior tuned:
    - orb base opacity set to 0 to avoid pop-in
    - reconfiguration now fades in from zero using frame-staged updates
    - saturation/lightness/alpha ranges increased for stronger color presence
  - popup opacity pass:
    - settings panel backgrounds changed to fully opaque colors
    - dark-theme track editor modal surface switched to opaque `var(--panel-solid)`
  - track editor modal now includes an in-header waveform mirror:
    - separate waveform container rendered to the right of the "Edit track" title
    - shares waveform image/load/progress/playhead state with main now-playing waveform
    - supports seek interaction directly inside editor modal
    - editor-header drag logic excludes waveform hits to avoid interaction conflicts
- Re-ran verification again: `npm test` and `npm run build` both pass.

### Commands to run
- Install: `npm install`
- Tests: `npm test`
- Build: `npm run build`
- Run: `npm start`
- Optional ffmpeg fetch: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`

### Known failing tests
- None.

### Immediate next 3 tasks
1) Validate cortina fade behavior in real playback with both modes:
   truncated-by-duration and user full-play override.
2) Profile renderer hotspots (`renderPlaylist`, search list rendering) and add
   visible-tab dirty-flag rendering to defer expensive list rebuilds when hidden.
3) Tune display text sizing/contrast for projector readability and long artist/title wrapping.
