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
  - cortina cutoff fade reliability:
    - extended `playOnChannel` with `autoStopFadeMs` to control fade length when
      auto-stopping at effective cutoff
    - cortina playback now passes `autoStopFadeMs = max(2000ms, stop-fade setting)`
      so capped cortina always fades out (prep/live) instead of abrupt stop
    - non-cortina early trim behavior remains quick (default ~140ms) as before
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
  - display readability and ambient intensity tuning:
    - increased display typography scale for projector readability:
      `display-title`, `display-artist`, `display-progress`, `display-next`
      now use larger `vmin` values and wider max widths
    - reduced dark overlay strength so ambient color remains visible
    - strengthened base swirl gradients and saturation
    - increased ambient orb baseline size/opacity and reduced blur for clearer
      color presence
    - expanded randomized orb color/size ranges in `display.js`:
      higher saturation/lightness/alpha and larger orb size distribution
  - display background source split by playback mode:
    - `backgrounds:list` IPC now accepts optional group
      (`images` or `cortina_images`) and scans only that subfolder under each
      configured background root
    - preload/shared API updated: `listBackgroundImages(group?)`
    - display window now keeps separate normal and cortina image pools/queues
    - mode behavior:
      - `normal` (including idle): rotates images from `images`
      - `cortina`: selects a background from `cortina_images` and keeps it
        fixed for the cortina duration (rotation timer paused)
      - when leaving cortina, normal rotation resumes from `images`
  - display image/gradient mode toggle:
    - added System setting `display-use-images` (checkbox) to choose whether
      display uses background images or gradients
    - i18n key added across supported languages (`displayUseImages`)
    - persisted in localStorage (`tanda-display-use-images`), default enabled
    - `DisplayUpdatePayload` extended with `useBackgroundImages`
    - display renderer now:
      - ignores image pools and renders gradient background when disabled
      - uses normal/cortina image pools when enabled
    - `updateExternalDisplay` now sends config-only idle payload so changing
      this setting applies immediately even when nothing is playing
  - display typography scaling/readability pass:
    - increased normal-mode text scale significantly for distance viewing:
      title, artist, progress, and next-tanda now use larger `clamp(...)`
      values with `vmin` scaling
    - increased cortina text scale similarly for projector-friendly readability
    - reduced display content padding and expanded text width constraints to
      use more screen real estate
    - tightened line-height/margins to keep larger text uncluttered
  - theme system expansion and default:
    - fresh install default theme now `dark-alt` (blue dark)
    - theme cycle expanded to:
      `dark-alt -> dark-red -> dark-green -> dark -> light -> light-alt`
    - added new palettes:
      - `theme-dark-red`
      - `theme-dark-green`
      - `theme-light-alt`
    - extended dark-specific component styling selectors (tab bars, cards,
      playing rows, settings panel, track editor modal) to cover new dark themes
  - display readability + image dim control:
    - increased display text scale again for large-screen readability
      (normal + cortina modes)
    - added System setting `display-image-dim` (%), persisted in
      `tanda-display-image-dim`
    - extended `DisplayUpdatePayload` with `imageDimOpacity`
    - display renderer now applies configurable overlay darkness when image
      backgrounds are active, improving text contrast over bright photos
  - focus/background smoothness:
    - disabled `webPreferences.backgroundThrottling` for both the main window
      and display window in `main.ts`
    - this reduces timer/animation/audio scheduling jumps after app focus loss
      and return (occlusion/background throttle behavior)
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

### Latest update
- Display board/config UX refinement:
  - restored additional display text safe padding in `display.css` so large
    headings no longer sit tightly on window edges
  - added display base font-size control (`display-base-font-size`, %) in
    Settings > Display Board, persisted via `tanda-display-font-scale`
  - `DisplayUpdatePayload` now carries `fontScale`; display renderer applies it
    through `--display-font-scale` for title/artist/progress/next/cortina text
- Settings IA update:
  - added new Settings tab: `Display Board`
  - moved display controls from System into Display Board tab:
    rotation interval, use images, image darken, base font size
  - kept background folder selection in Library tab per requirement
- Theme and styling consistency:
  - added new `theme-dark-classic` palette (dark + gold text/accent)
  - theme cycle now includes `dark-classic`
  - tab active styling switched to per-theme variables (`--tab-active-*`),
    fixing green-mode tab coloring parity with blue mode
  - unified panel input styling (`text/number/time/search/select/textarea`) so
    New Collection input matches rounded control style in all themes
- Documentation updates:
  - `design/14-settings-and-configuration.md` updated with Display Board tab
    requirements (`CFG-DSP-001..005`)
  - `design/05-ui-principles-and-components.md` updated (`UI-009.R5`,
    `UI-060.R11`, `UI-060.R12`)
  - `design/tracking-and-feature-matrix.md` updated for config/display status
- Verification:
  - `npm test` (24 files, 90 tests) passed
  - `npm run build` passed

### Latest update
- Display-board cortina end-state fix:
  - when playback becomes idle immediately after cortina, display now preserves
    cortina mode (centered "Cortina" headline) instead of falling back to
    normal top-left layout with stale text
  - the hold is cleared automatically when normal track playback resumes
- Playlist mismatch/sequence fixes:
  - style matching in `playlist-sequence.ts` now canonicalizes word order so
    equivalent phrases (e.g. "Tango Nuevo" vs "Nuevo Tango") validate equally
  - playlist mismatch flags are recomputed from current sequence/style-map on
    every playlist render and on settings edits to prevent stale warning badges
  - tanda sequence shorthand no longer uses first-letter fallback for unmapped
    styles; unmapped now renders as `?` to avoid misleading warnings such as
    "3m vs 3m" when style compatibility actually failed
- Tests and build:
  - updated `tests/playlist-sequence.test.ts` for canonicalized style-map output
  - verified `npm test` (24 files, 91 tests) and `npm run build` both pass

### Latest update
- Display image dim behavior:
  - switched display board image darkening overlay from directional gradient to
    uniform full-frame opacity so centered cortina text receives equal contrast
    across the entire screen
  - updated in `app/src/renderer/display.css` (`.bg-overlay` now uses a flat
    rgba overlay driven by existing dim control)
- Verification:
  - `npm test` passed (24 files, 91 tests)
  - `npm run build` passed

### Latest update
- Duplicate indicator/menu interaction:
  - clicking duplicate icon now performs two actions together:
    1) jumps/highlights matching playlist duplicate
    2) opens the source row's standard context menu so normal actions remain
       available (send to playlist, send to clipboard, open designer, etc.)
  - implemented in `handleDuplicateJump` by opening source row menu after jump
    instead of closing menus
- Verification:
  - `npm test` passed (24 files, 91 tests)
  - `npm run build` passed

### Latest update
- Display board typography controls:
  - added independent cortina font-size setting in Display Board tab:
    `display-cortina-font-size` (%)
  - persisted in localStorage key `tanda-display-cortina-font-scale`
  - display update payload extended with `cortinaFontScale`
  - display renderer now applies separate CSS variables:
    - normal text: `--display-font-scale`
    - cortina text: `--display-cortina-font-scale`
  - enables tuning cortina headline size without affecting normal title/artist
- Verification:
  - `npm test` passed (24 files, 91 tests)
  - `npm run build` passed

### Latest update
- Search-similar responsiveness:
  - `runSearchQuery` now paints input/tab state immediately and defers heavy
    `refreshSearch()` work to the next event-loop tick
  - added pending-timer cancellation so repeated quick actions do not stack
    redundant refresh operations
  - improves perceived latency when invoking search-similar from tanda track
    menus in clipboard/search contexts
- Verification:
  - `npm test` passed (24 files, 91 tests)
  - `npm run build` passed

### Latest update
- Playlist clear + auto-fill:
  - added new playlist setting `playlist-end-time` (`tanda-playlist-end-time`)
  - added overnight-safe playlist window helpers in `app/src/shared/playlist-window.ts`
    with tests in `tests/playlist-window.test.ts`
  - replaced single confirm on playlist clear with options modal:
    - clear playlist
    - clear and auto-fill playlist
  - implemented auto-fill engine:
    - prioritizes saved tandas that satisfy current sequence/style rule
    - scores candidates for artist/year/BPM variety
    - blocks duplicate track titles in the generated playlist
    - falls back to generated ad-hoc tandas from similar tracks with progressively
      relaxed matching constraints
    - stops when projected timeline reaches configured expected end window
- Documentation updates:
  - `design/14-settings-and-configuration.md` (CFG-PL-006.b/006.c, CFG-PL-010..013)
  - `design/05-ui-principles-and-components.md` (UI-014 clear/autofill rules)
  - `design/tracking-and-feature-matrix.md` (FR/UI status + notes)
  - `docs/user-guide.md` (clear/autofill usage and end-time guidance)
- Verification:
  - `npm test` passed (25 files, 96 tests)
  - `npm run build` passed

### Latest update
- Playlist row action styling + duplicate indicator behavior:
  - when a row menu is open, `.row-actions` now renders as one shared capsule so
    the headphone button appears integrated with the visible menu controls
  - removed nested row-menu chrome while open to avoid double borders/shadows
  - added playlist-internal duplicate counting:
    - track rows show duplicate icon only when the same track appears more than once
    - tanda rows show:
      - `full` when the full tanda track-set repeats
      - `partial` when one or more tanda tracks repeat elsewhere
  - playlist duplicate icon is informational (non-jump); search/clipboard keep
    jump-to-playlist behavior
- Verification:
  - `npm test` passed (25 files, 96 tests)
  - `npm run build` passed

### Latest update
- Search-similar latency follow-up:
  - `runSearchQuery` now defers tab-activation DOM updates to
    `requestAnimationFrame` so input text paints before expensive updates
  - optimized menu closing:
    - `closeRowMenus` uses `openRowMenuId` to close one known row directly
      instead of scanning all open rows
    - `closeDetailMenus` closes a single open detail menu row
  - reworked `refreshSearch` execution order:
    - prioritize first-page track load and render
    - defer count/jump/tanda updates as follow-up tasks
    - guard with `searchRefreshVersion` so stale refresh work is skipped
- Verification:
  - `npm test` passed (25 files, 96 tests)
  - `npm run build` passed

### Latest update
- Track editor search-similar workflow:
  - added field-level localized `S` buttons in `#track-editor` for title, artist,
    singer, vocal, album, year, style, notes, and BPM
  - each button appends its field value to the existing search query using
    `appendQueryTokens(...)` and runs search immediately
  - query append is additive and token-deduped for rapid chaining workflows
- Track editor presentation:
  - editor now always uses non-modal in-place presentation (same behavior as edit mode)
    instead of centered modal behavior in prep/live
- Similarity ranking refinements:
  - `buildTrackSearchQuery(...)` now emits tokens in priority order:
    style -> artist -> singer/instrumental -> BPM -> year -> notes -> title
  - `scoreTrackAgainstQuery(...)` weights now favor style/artist/singer + BPM/year
    and reduce title-only dominance
- Documentation updates:
  - `design/05-ui-principles-and-components.md` (UI-010a.R17-R19)
  - `design/tracking-and-feature-matrix.md` (FR-092/FR-093 notes, UI-010a row)
  - `docs/user-guide.md` (track editor field-level `S` workflow)
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Autofill crash fix:
  - fixed null-year crash in playlist clear+auto-fill path
  - `yearValue(track)` in `app/src/renderer/renderer.ts` now guards against
    null/undefined/non-string year values before calling `.match(/\d{4}/)`
  - prevents runtime error: `Cannot read properties of null (reading 'match')`
    during `scoreAutofillTanda`
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Clipboard tanda menu action restored:
  - restored `T` (edit/open tanda) action in clipboard tanda context menus
  - change in `app/src/renderer/renderer.ts` (`renderTandaRow`, clipboard branch)
  - action routes through existing `tanda-edit` handler to open in Tanda Designer
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- New collection track-menu behavior:
  - removed `R` (remove from clipboard) action from track menus when active
    clipboard collection is `New`
  - remove action remains available for other clipboard collections
  - implemented in `app/src/renderer/renderer.ts` (`renderTrackRow`)
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Clipboard tanda -> designer render fix:
  - fixed case where collection tanda opened via `T` switched to Tanda Designer
    but did not render the tanda
  - cause: existing draft kept `origin: "playlist"`, which is intentionally
    filtered out from the designer list
  - fix in `app/src/renderer/renderer.ts` (`ensureTandaDraft`): when opening
    with origin `designer`, existing non-designer drafts are promoted to
    `origin: "designer"`
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Search count/results mismatch fix:
  - fixed case where search tab showed non-zero count but no rendered track row
  - `refreshSearch` now uses one search-parameter snapshot for page load, count,
    and jump-index calls to prevent mixed-query state
  - reset stale `searchState.total` before loading new results
  - tab count now refreshes immediately after count fetch
  - defensive retry: if `total > 0` but first page is empty, reload page 0 once
- Files:
  - `app/src/renderer/renderer.ts`
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Tanda Designer empty-draft replacement behavior:
  - in `openTandaInDesigner`, when opening into designer context (not playlist),
    if the designer currently has exactly one draft and it is empty, opening a
    non-empty tanda now removes that empty draft first
  - result: sending a tanda to designer replaces the lone default empty card
    instead of showing both
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Tanda Designer empty replacement robustness:
  - updated `openTandaInDesigner` empty-draft cleanup logic
  - previous behavior only replaced when exactly one empty designer draft existed
  - new behavior: when opening a non-empty tanda into designer context and there
    are no non-empty designer drafts yet, remove *all* empty designer drafts
    before opening the incoming tanda
  - prevents hidden/extra empty placeholders from causing appended off-screen
    drafts in designer view
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Popup contrast/accessibility pass:
  - improved modal backdrops (`.modal`, `.confirm-modal`) with darker overlay and
    subtle blur for stronger foreground focus
  - increased popup surface contrast (`.modal-card`, `.confirm-dialog`) using
    near-solid backgrounds, stronger borders, and deeper elevation shadows
  - improved popup action button contrast in `.confirm-actions button`
- Files:
  - `app/src/renderer/styles.css`
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Tanda Designer empty replacement fix for collection-send path:
  - fixed `openTandaInDesigner` so it resolves an incoming tanda even when the
    handler passes no explicit `source`
  - cleanup check now runs against this resolved incoming tanda, so default empty
    designer drafts are removed before opening a non-empty tanda from collections
  - prevents the empty draft from being left above the incoming tanda in the
    Tanda Designer
- Files:
  - `app/src/renderer/renderer.ts`
- Verification:
  - `npm test` passed (25 files, 100 tests)
  - `npm run build` passed

### Latest update
- Playlist auto-fill cortina assignment:
  - when auto-fill completes and cortinas are enabled, all missing cortina rows
    are now proactively assigned using normal cortina planning (`ensureCortinaPlans`)
    before final playlist render
  - added shared helper `getUnassignedCortinaRowIndices` to centralize detection
    of missing cortina rows and used it in playlist rendering path as well
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/cortina-plan.ts`
  - `tests/cortina-plan.test.ts`
  - `design/05-ui-principles-and-components.md` (UI-012.R15)
  - `design/tracking-and-feature-matrix.md` (FR-020 note update)
- Verification:
  - `npm test` passed (25 files, 102 tests)
  - `npm run build` passed

### Latest update
- Headphone icon active-state + track-row border consistency:
  - headphone preview buttons now carry a `data-track-id` and reflect active
    playback state for the headphone channel until stopped or superseded
  - implemented centralized indicator updates via
    `updateHeadphoneButtonIndicators()` (invoked during now-playing updates and
    after explicit headphone actions)
  - applied to track rows, tanda detail lines, and cortina rows/results
  - removed asymmetric left inset accent from `.list-row.playing` styles (all
    theme variants) to eliminate the thicker left-edge appearance
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/renderer/styles.css`
- Verification:
  - `npm test` passed (25 files, 102 tests)
  - `npm run build` passed

### Latest update
- Cortina auto-fill/render reliability + editor workflow fixes:
  - serialized cortina plan loading via `cortinaPlanPromise` so concurrent
    `ensureCortinaPlans` calls await in-flight work instead of returning early;
    addresses intermittent missing cortina rows after auto-fill
  - display board now disables image dim overlay in cortina image mode
  - track editor now warns on unsaved changes before switching tracks and
    updates to the newly clicked track when editor is open
  - fixed non-modal track editor visibility CSS so close reliably hides the modal
  - opening Settings closes track editor first (with dirty-check confirmation)
  - button hover now enforces foreground color for better contrast in bright-hover states
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/renderer/display.js`
  - `app/src/renderer/styles.css`
- Verification:
  - `npm test` passed (25 files, 102 tests)
  - `npm run build` passed

### Latest update
- Display-board cortina layering refinement:
  - added dedicated cortina background layers (`.bg-cortina-a/.bg-cortina-b`)
    above the dim overlay so cortina images are never darkened by image opacity
  - kept normal rotating image layers below the dim overlay
  - updated mode-switch logic so dim overlay remains tied to normal-background
    image behavior while cortina backgrounds transition independently
- Files:
  - `app/src/renderer/display.html`
  - `app/src/renderer/display.css`
  - `app/src/renderer/display.js`
- Verification:
  - `npm test` passed (25 files, 102 tests)
  - `npm run build` passed

### Latest update
- Display-board CPU reduction in image mode:
  - gradient/orb background transitions now run only when image mode is not in use
  - when `useBackgroundImages` is enabled and any image sources exist (normal or
    cortina), the swirl/ambient timers are disabled
  - if the active mode has no image source, the board keeps static image layers
    and still does not re-enable gradient animation
  - background rotation timer no longer loops when the active source list is empty
- Files:
  - `app/src/renderer/display.js`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 108 tests)
  - `npm run build` passed

### Latest update
- Legacy gain + runtime normalization hardening:
  - playback gain now resolves from explicit `gain_db`; if missing, it derives
    from `loudness_db` using the -16 LUFS target
  - runtime gain now supports capped positive gain (up to 2x) via Web Audio
    `GainNode` routing when available, preserving attenuation behavior and
    enabling audible normalization for quieter tracks
  - retained safe fallback to `HTMLAudioElement.volume` when Web Audio binding
    is unavailable
  - legacy import parsing now accepts numeric strings for `analysis.gain` and
    `analysis.meanGain`, and derives gain from loudness when legacy gain is absent
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/audio-normalization.ts`
  - `app/src/main/legacy-import.ts`
  - `tests/audio-normalization.test.ts`
  - `tests/legacy-import-gain.test.ts`
  - `design/03-audio-playback-and-timing-model.md` (FR-052.R3.a, FR-052.R3.b)
  - `design/10-audio-pipeline.md` (AUD-003.R2.a, AUD-003.R2.b)
  - `design/tracking-and-feature-matrix.md` (FR-002 note update)
  - `docs/dialogue.md`
- Verification:
  - `npm test` passed (27 files, 108 tests)
  - `npm run build` passed

### Latest update
- Unified popup styling (no native confirm dialogs):
  - replaced renderer-native `window.confirm(...)` usages with the in-app
    styled confirm modal (`showConfirmModal`) and action-confirm flow
    (`showAlertAction`) across:
    - playlist sequence mismatch confirmations
    - tanda save/delete confirmations
    - data-location change + legacy import confirmations
    - track editor unsaved-change confirmations
  - reset-database confirmation now happens in renderer (styled modal), and
    main-process `app:resetDatabase` no longer opens Electron native message boxes
  - added localized `confirmEraseDatabase` string in all supported languages
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/main/main.ts`
  - `design/05-ui-principles-and-components.md` (UI-002.R3.b)
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 108 tests)
  - `npm run build` passed

### Latest update
- Display-board typography tuning:
  - increased normal-mode artist line font size to be much closer to title scale
  - reduced playing-progress line font size slightly to preserve visual hierarchy
- Files:
  - `app/src/renderer/display.css`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 108 tests)
  - `npm run build` passed

### Latest update
- Prep/playback continuity, search ranking overhaul, and diagnostics logging:
  - prep-mode playlist track clicks now start playback from the clicked track
    and continue naturally through remaining playlist entries
  - display-board "Next tanda" text is now suppressed unless playlist playback
    is actively running/paused with resumable state
  - fuzzy search now uses implicit token parsing from one query box:
    - 4-digit year intent, 2-3 digit tempo intent, style token intent, remaining text intent
    - automatic lookup vs similarity ranking profiles
    - year/tempo proximity curves plus missing-metadata fallback scores
    - query-aware weight renormalization
  - added playback-leveling diagnostics:
    - main process writes JSONL playback-gain decisions to `playback-diagnostics.log`
    - diagnostic log files now rotate/truncate automatically when exceeding size limits
    - diagnostics tab now shows playback log path and a viewer for recent log lines
  - display-board typography adjusted again for readability:
    - artist text increased toward title scale
    - playing-progress text reduced slightly
- Files:
  - `app/src/main/library/fuzzy-search.ts`
  - `tests/library-search.test.ts`
  - `app/src/main/main.ts`
  - `app/src/preload/preload.ts`
  - `app/src/shared/types.ts`
  - `app/src/renderer/renderer.ts`
  - `app/src/renderer/index.html`
  - `app/src/renderer/styles.css`
  - `app/src/renderer/display.css`
  - `tests/audio-normalization.test.ts`
  - `design/03-audio-playback-and-timing-model.md` (FR-052.R6)
  - `design/05-ui-principles-and-components.md` (UI-009.R3.a)
  - `design/06-search-and-similarity.md` (FR-091.4.R1-R9)
  - `design/10-audio-pipeline.md` (AUD-003.R2.c)
  - `design/tracking-and-feature-matrix.md` (FR-091/UI-050/UI-060 notes)
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 110 tests)
  - `npm run build` passed

### Latest update
- Search-similar query narrowing:
  - "Search similar" query generation from a track now excludes `title` and `album`
  - retained fields: style, artist/artist_summary, singer (or instrumental),
    BPM, year, and notes
  - implemented via a dedicated helper so non-similarity text contexts can still
    use the broader track query builder
- Files:
  - `app/src/shared/search-query.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/search-query.test.ts`
  - `design/06-search-and-similarity.md` (FR-090.2.R11)
  - `docs/dialogue.md`
  - `docs/handoff.md`

### Latest update
- Search-similar style-pill control:
  - track "Search similar" now applies track style via style pills (global
    style filtering) rather than inserting style as query text
  - similarity query text now excludes style and includes only artist/summary,
    singer/instrumental, BPM, year, and notes
  - consolidated behavior through `runSearchForTrack(...)` for all track
    search-similar entry points (search/clipboard/playlist/tanda detail rows)
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/search-query.ts`
  - `tests/search-query.test.ts`
  - `design/06-search-and-similarity.md` (FR-090.2.R11 wording)
  - `docs/dialogue.md`
  - `docs/handoff.md`

### Latest update
- Legacy gain-only loudness jump guard:
  - from diagnostics logs, consecutive tracks with `gain_db` only (no `loudness_db`)
    were showing large gain deltas and audible loudness jumps
  - added `applyGainStepGuard(...)` to cap per-track gain step changes between
    consecutive plays (bounded dB step) for legacy gain-only scenarios
  - renderer playback now applies this guard before converting dB to linear gain
    and logs the applied correction in diagnostics
- Files:
  - `app/src/shared/audio-normalization.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/audio-normalization.test.ts`
  - `design/10-audio-pipeline.md` (AUD-003.R2.e)
  - `docs/dialogue.md`
  - `docs/handoff.md`

### Latest update
- Normalization algorithm + diagnostics improvements:
  - switched runtime gain resolution to `resolvePlaybackNormalization(...)`
    with bounded drift correction when explicit gain and loudness indicate a
    significant residual mismatch to target
  - retained existing fallback behavior: explicit gain first, then loudness-derived
    gain when explicit gain is absent
  - enriched playback diagnostics logging with correction and target-matching
    fields (`correctionDb`, `driftDb`, `targetLoudnessDb`,
    `expectedOutputLoudnessDb`)
- Files:
  - `app/src/shared/audio-normalization.ts`
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/types.ts`
  - `app/src/main/main.ts`
  - `tests/audio-normalization.test.ts`
  - `design/10-audio-pipeline.md` (AUD-003.R2.c, AUD-007.R3)
  - `design/tracking-and-feature-matrix.md` (FR-002 notes)
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 112 tests)
  - `npm run build` passed

### Latest update
- Preparation-mode track clicks now resume playlist flow from the clicked track when that track exists in the playlist:
  - Added shared helper `findPlaylistPositionForTrack(...)` to locate a track inside mixed playlist rows (single track rows and tanda rows).
  - Updated renderer prep-mode track playback path to call `startPlaylistFrom(...)` for playlist-present tracks so playback naturally continues through remaining playlist items after natural track end.
- Files:
  - `app/src/shared/playlist-flow.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/playlist-flow.test.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 115 tests)
  - `npm run build` passed

### Latest update
- Search parsing/scoring/ranking refinements (single-box smart parsing + stronger DJ-oriented ranking):
  - Added quoted phrase extraction in query parsing and phrase-aware lookup boosts.
  - Tightened implicit year parsing range to modern recordings (`1900..current+1`).
  - Kept numeric token parsing for year/tempo intent; style token intent unchanged.
  - Added auto-profile tweak: two-token text-only queries use similarity profile to favor tanda-building behavior.
  - Updated profile weights and introduced low-weight notes/album signal in similarity mode.
  - Added deterministic tie-breaks under score sort: artist, style, tempo, year, then title.
- Tests added/updated:
  - `tests/library-search.test.ts` includes coverage for short-query similarity preference and quoted phrase lookup boost.
- Docs updated:
  - `design/06-search-and-similarity.md` (FR-091.4.R10-R12)
  - `design/tracking-and-feature-matrix.md` (FR-091 row notes)
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 117 tests)
  - `npm run build` passed

### Latest update
- External display `Next tanda` suppression in prep/random playback:
  - Added `shouldShowDisplayNextTanda(...)` in `app/src/shared/playlist-live.ts`.
  - Renderer now gates next-tanda computation to only active playlist playback (`playing`).
  - This prevents `Next tanda` text appearing during prep-mode one-off/random track playback.
- Files:
  - `app/src/shared/playlist-live.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/playlist-live.test.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (27 files, 118 tests)
  - `npm run build` passed

### Latest update
- Regression stabilization + diagnostics readiness:
  - Fixed tanda draft hydration so `tandas:list` results are loaded into drafts/cache correctly (restoring tanda visibility after legacy import).
  - Legacy import completion now refreshes tanda drafts, New collection tracks/tandas, and cortina set lists before re-render.
  - Cortina set listing now falls back to filesystem folder discovery when track-derived set names are empty.
  - Scan reuse guard now forces re-analysis for incomplete/provisional rows, including legacy-import placeholder analysis payloads.
  - Legacy import track rows are marked `legacy_import_pending_scan` to ensure first scan computes real trim/loudness analysis.
  - Playlist timeline/tanda duration now falls back to tanda `total_duration_ms` when per-track analyzed duration is missing, preventing collapsed identical start times.
  - Added diagnostics data-readiness summary (`diagnostics:getDataReadiness`) and settings-panel renderer block showing missing duration/loudness/trim/errors/waveforms.
- Files:
  - `app/src/main/library/scan.ts`
  - `app/src/main/legacy-import.ts`
  - `tests/scan-reuse-analysis.test.ts`
  - `app/src/main/main.ts`
  - `app/src/preload/preload.ts`
  - `app/src/shared/types.ts`
  - `app/src/renderer/renderer.ts`
  - `app/src/renderer/index.html`
  - `design/09-ipc-and-api.md` (IPC-003.R5.d)
  - `design/10-audio-pipeline.md` (AUD-002.R8, AUD-005.R4)
  - `design/12-testing-and-quality.md` (TQ-GATE-003, TQ-GATE-004)
  - `design/tracking-and-feature-matrix.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (28 files, 124 tests)
  - `npm run build` passed

### Latest update
- Diagnostics/i18n hardening:
  - optimized `diagnostics:getDataReadiness` waveform counting by pre-indexing `.png` files in the waveform directory once per request;
  - added missing data-readiness i18n keys for ES/FR/DE/PT/IT maps to keep diagnostics labels localized.
- Files:
  - `app/src/main/main.ts`
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (28 files, 124 tests)
  - `npm run build` passed

### Latest update
- Legacy-import page readiness verification control:
  - Added a `Verify library readiness` button and result panel to Library settings > Legacy Import.
  - Button executes readiness evaluation and shows localized pass/warn/fail plus counts for duration/loudness/trim/errors/waveforms.
  - Added shared evaluator `evaluateDataReadiness(...)` and unit coverage.
  - Added UI requirement entry `UI-009.R3.b` and updated feature matrix notes.
- Files:
  - `app/src/renderer/index.html`
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/data-readiness.ts`
  - `tests/data-readiness.test.ts`
  - `design/05-ui-principles-and-components.md` (UI-009.R3.b)
  - `design/tracking-and-feature-matrix.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Loudness analysis fix for readiness `missing loudness+gain` growth:
  - Root cause: loudnorm JSON extraction path used FFmpeg `-v error`, which can suppress the loudnorm info block and leave `loudness_db`/`gain_db` unset.
  - Fix: changed loudness analysis invocation to `-v info -nostats` so loudnorm JSON is emitted and parsed.
- Files:
  - `app/src/main/library/analysis.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Reset cleanup parity fix:
  - `app:resetDatabase` now clears diagnostics artifacts in addition to SQLite state:
    - playback diagnostics log
    - renderer error log
    - waveform cache directory
  - This aligns Erase Database with user expectation of a clean state.
- Files:
  - `app/src/main/main.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Search/filter clear-button accessibility tweak:
  - Increased clear icon hit target/size for search inputs via `::-webkit-search-cancel-button` styling.
  - Added extra right padding for search inputs so the larger clear control stays easy to hit without overlapping text.
- Files:
  - `app/src/renderer/styles.css`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Search clear-button alignment refinement:
  - Reduced search input right padding and set a small right margin on the cancel control so the larger clear icon sits closer to the right edge.
- Files:
  - `app/src/renderer/styles.css`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Playlist auto-fill placeholder fallback behavior:
  - When auto-fill cannot find a valid tanda for a required slot, it now inserts a placeholder tanda with the slot's required style and slot size (empty track slots), which is surfaced as a mismatch warning for manual completion.
  - Placeholder tandas use an assumed duration of 9 minutes so expected-end-time auto-fill can continue projecting toward target window instead of stopping immediately.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Search-to-clipboard write-path consistency fix:
  - `C` actions from Search now work even when New collection is active.
  - Track and tanda clipboard add handlers now use writable-target resolution (fallback to General when New is active), matching existing drag/drop and active-collection add paths.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Playlist tanda delete consistency fix:
  - Deleting a tanda from the editor now removes matching tanda entries from playlist slots as well (not just drafts/database).
  - Also removes that tanda from clipboard collection references and clears related selection/open-target state to prevent stale UI entries.
  - Refreshes New collection after delete and re-renders playlist/clipboard/search views.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Playlist target swap robustness:
  - Added defensive playlist row index resolution for mark/swap actions (`data-index` fallback to tandaId lookup).
  - Replaced silent early-return on invalid swap/mark state with explicit `statusPlaylistSwapInvalid` feedback.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Audio output routing robustness:
  - Changed output-device deduplication in renderer from label-based to `deviceId`-based keying (with group fallback), preventing distinct outputs with similar labels from being collapsed into one selection.
  - This improves reliability of assigning separate main/headphone outputs.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- GitHub Release workflow finalization-race fix:
  - Root cause: release asset publishing ran inside each matrix build leg, so multiple jobs concurrently invoked `softprops/action-gh-release@v2` against the same release/tag and collided during finalization.
  - Refactor: matrix `build` job now only builds/packages and uploads per-target artifacts; single `publish-release` job (after all builds) downloads merged artifacts and publishes release assets once.
  - Added `fail_on_unmatched_files: true` to release upload step to fail fast on missing expected outputs.
  - Preserved `workflow_dispatch` behavior via a dedicated post-build artifact aggregation job.
- Files:
  - `.github/workflows/release.yml`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Release asset duplication fix in GitHub workflow:
  - Symptom: `softprops/action-gh-release@v2` reported `Not Found` on release asset update after showing duplicate upload attempts for mac blockmap files.
  - Root cause: overlapping file globs (`dist/**/*.blockmap` plus explicit mac blockmap globs) matched the same assets multiple times in one publish step.
  - Fix: replaced release upload `files` list with non-overlapping, platform-specific patterns so each asset is uploaded exactly once.
- Files:
  - `.github/workflows/release.yml`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Release asset publish hardening for duplicate-upload failures:
  - Symptom persisted: duplicate mac blockmap upload attempts and `Not Found` update failure in `softprops/action-gh-release@v2`.
  - Likely cause: downloaded artifact layout introduced repeated matches of same asset basenames.
  - Fix: added a pre-upload normalization step that copies all releasable files into `release-assets/` by basename, ignores identical duplicates, and fails fast on conflicting duplicate basenames.
  - Release upload now targets only `release-assets/*` platform patterns, ensuring each asset name is submitted once.
- Files:
  - `.github/workflows/release.yml`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (29 files, 127 tests)
  - `npm run build` passed

### Latest update
- Audio output routing regression fix (duplicate outputs + split routing reliability):
  - Symptom: settings output selectors showed repeated AirPlay entries and main/headphone routing could not be reliably separated.
  - Root cause: renderer de-duplication by raw `deviceId` allowed many OS-exposed duplicates to remain in the list; stored-device fallback matching (`label || group`) could also pick the wrong endpoint when labels repeat.
  - Fixes:
    - Added shared audio-output helpers (`app/src/shared/audio-outputs.ts`) to normalize/de-duplicate outputs by stable metadata (group+label with fallbacks), preserving distinct devices while collapsing duplicate endpoints.
    - Updated renderer enumeration to use the helper and store `AudioOutputDevice` snapshots.
    - Updated stored output resolution order to: explicit id, exact group+label, group, then label.
    - Avoided disabling headphone capability globally when selected headphone device equals selected main device; now only the conflicting headphone selection is cleared.
  - Added tests covering duplicate AirPlay collapse, same-label-different-group preservation, and exact metadata matching.
  - Design docs updated to codify output de-duplication expectation.
- Files:
  - `app/src/shared/audio-outputs.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/audio-outputs.test.ts`
  - `design/14-settings-and-configuration.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 130 tests)
  - `npm run build` passed

### Latest update
- Audio output routing enforcement + diagnostics hardening:
  - Symptom: main/headphone selections were distinct in UI, but headphone playback still emerged on main speakers.
  - Changes:
    - Added Electron default-session permission handlers for speaker selection / audio routing paths.
    - Upgraded renderer output routing (`setSinkId`) to return structured result metadata, with `selectAudioOutput` fallback when available.
    - Added selection-time verification (probe audio element) before persisting chosen non-default output IDs.
    - Added fail-safe behavior: if headphone route cannot be applied to selected device, headphone playback request is rejected instead of silently playing on default output.
    - Extended playback diagnostics payload with output-route fields: requested/applied device ID, route method, route error.
  - Requirement update: `design/10-audio-pipeline.md` `AUD-006.R4`.
- Files:
  - `app/src/main/main.ts`
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/types.ts`
  - `design/10-audio-pipeline.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 130 tests)
  - `npm run build` passed

### Latest update
- Headphone routing stale-device fix:
  - Evidence from diagnostics: `requestedOutputDeviceId` routed to a stale ID and failed (`appliedOutputDeviceId:null`, abort error) while UI showed a different selected output.
  - Root cause: resolved output IDs shown in UI were not always persisted back into localStorage when stored IDs existed but had drifted/changed.
  - Fix: `ensureAudioOutputs` now persists resolved current main/headphone device IDs whenever they differ from stored IDs, and clears stale headphone storage when unresolved/colliding.
  - Outcome: playback now uses the same concrete device IDs presented in output selectors.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 130 tests)
  - `npm run build` passed

### Latest update
- Diagnostics log reset control + output-grant refinement:
  - Added a user-facing `Clear diagnostics logs` button in Settings > Diagnostics.
  - Added IPC API `diagnostics:clearLogs` and preload/shared bridge method to delete playback/renderer log files on demand.
  - Added diagnostics result messages for clear success/failure in the playback-log panel.
  - Audio-routing refinement: output selection verification now requests device grant via `selectAudioOutput` (when available) during user-driven selection, then probes sink assignment and persists the granted ID.
  - This supports cleaner repro workflows and improves sink-ID reliability across sessions.
- Files:
  - `app/src/renderer/index.html`
  - `app/src/renderer/renderer.ts`
  - `app/src/main/main.ts`
  - `app/src/preload/preload.ts`
  - `app/src/shared/types.ts`
  - `design/14-settings-and-configuration.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 130 tests)
  - `npm run build` passed

### Latest update
- Live output-ID resolution hardening for headphone sink routing:
  - Symptom persisted: playback diagnostic showed `requestedOutputDeviceId` set but `appliedOutputDeviceId:null` with aborted sink assignment.
  - Change: playback now resolves channel output IDs from live selector choices first and only then from stored IDs, constrained to currently enumerated outputs.
  - Added shared helper `chooseAvailableOutputDeviceId(...)` and tests.
  - Resolved IDs are persisted immediately so UI and routing state stay aligned.
- Files:
  - `app/src/shared/audio-outputs.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/audio-outputs.test.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 131 tests)
  - `npm run build` passed

### Latest update
- Main-channel output fallback bug fix:
  - Symptom: when main sink assignment failed, audio still played via OS default output (e.g., Bluetooth), contradicting selected main output.
  - Root cause: fail-fast handling existed for headphone route failures but main-channel failures still continued playback.
  - Fix: sink-route failures now fail fast on both channels when a non-default output is requested, with explicit status and diagnostics; no silent fallback to OS default.
  - Requirement update: `design/10-audio-pipeline.md` `AUD-006.R5`.
- Files:
  - `app/src/renderer/renderer.ts`
  - `design/10-audio-pipeline.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 131 tests)
  - `npm run build` passed

### Latest update
- Audio output routing review + candidate fallback implementation:
  - Findings:
    - `AbortError` persisted for both channels even with selected outputs.
    - Existing UI dedupe can choose a representative device ID that is not routable, while alternate raw IDs for the same physical endpoint may still work.
  - Fix:
    - Added grouped candidate fallback during sink routing: for a selected output, attempt the selected ID plus alternate raw IDs sharing endpoint identity (group+label) before failing.
    - Maintains clean deduped UI while improving real-world routing reliability on macOS/Bluetooth/AirPlay endpoint variants.
  - Added helper + tests:
    - `getOutputCandidateIds(...)` in shared audio-output utilities.
- Files:
  - `app/src/shared/audio-outputs.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/audio-outputs.test.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Routing-order correction for repeated `AbortError` on both outputs:
  - Updated output routing flow to request/select output grant first (`selectAudioOutput` when present), then apply sink via `setSinkId`.
  - Routing now tries a bounded ordered candidate set (granted ID first, then grouped endpoint candidates) before declaring failure.
  - Added richer diagnostics field `attemptedOutputDeviceIds` to confirm exactly which IDs were attempted during routing.
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/types.ts`
  - `app/src/main/main.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Added hardware-level audio output probe in Diagnostics:
  - New action: `Run audio output probe` (Settings > Diagnostics).
  - Behavior: enumerates audio output devices and attempts `setSinkId` per device from a user gesture context; reports PASS/FAIL for each endpoint with label/group/id and error message.
  - Purpose: establish objective, repeatable on-machine evidence of routing capability independent of playlist/playback flow.
  - Requirement update: `design/14-settings-and-configuration.md` `CFG-DIAG-007`.
- Files:
  - `app/src/renderer/index.html`
  - `app/src/renderer/renderer.ts`
  - `design/14-settings-and-configuration.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Probe-driven playback routing correction:
  - Evidence: Diagnostics output probe passed for all outputs, proving device-level `setSinkId` support is available.
  - Conclusion: failures are playback-flow-specific rather than hardware/device capability.
  - Fix:
    - Removed `selectAudioOutput` from playback-time routing (kept for explicit user selection path).
    - Added bounded retry loop for `setSinkId` on playback routing candidates to reduce transient `AbortError` failures.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Playback sink-order correction:
  - Evidence: output probe (fresh `Audio` -> `setSinkId`) passed all devices, while playback route failed.
  - Root cause hypothesis: playback assigned `src` before sink routing, diverging from probe flow.
  - Fix: moved playback sink assignment earlier so routing is applied before `src` assignment.
  - Goal: align playback behavior with proven probe success path.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Dual-phase sink routing to address route non-stick after source attach:
  - Symptom: diagnostics showed successful sink assignment IDs but audible output still collapsed to one physical device.
  - Fix: playback now applies sink twice per play request:
    1) pre-attach (`Audio` created, before `src`),
    2) post-attach (after `src` assignment).
  - Effective route uses post-attach success when available; diagnostics include attempted IDs from both phases.
- Files:
  - `app/src/renderer/renderer.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Root-cause fix: shared WebAudio graph collapsing per-output routing
  - Symptom: diagnostics showed successful `setSinkId` for distinct main/headphone IDs, but audible output still went to one physical device.
  - Root cause: playback path connected media elements to a shared `AudioContext` destination (`createMediaElementSource -> gain -> context.destination`), which undermined per-element sink routing.
  - Fix: removed shared-context gain-node routing from playback path and use media-element volume control for runtime levels so `setSinkId` remains effective per element/channel.
  - Requirement update: `design/10-audio-pipeline.md` `AUD-003.R5`.
- Files:
  - `app/src/renderer/renderer.ts`
  - `design/10-audio-pipeline.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Permanent repo-size cleanup and history rewrite:
  - Removed tracked legacy and generated artifacts from current tree:
    - `design/legacy/*`
    - `dist/*`
  - Updated ignore rules:
    - added `design/legacy/` to `.gitignore` (existing `tmp/` and `dist/` already present).
  - Committed cleanup snapshot, then rewrote history with:
    - `git filter-repo --force --path tmp --path dist --path design/legacy --invert-paths`
  - Re-added `origin` remote after filter-repo (it is removed by design).
  - Post-rewrite repository pack reduced to ~606.71 KiB (`git count-objects -vH`).
- Files:
  - `.gitignore`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (30 files, 132 tests)
  - `npm run build` passed

### Latest update
- Music-only track corpus and Tanda Designer clear-flow hardening:
  - Search/listing enforcement:
    - track search/list/jump SQL paths now join `library_roots` and enforce
      `r.kind = 'music'` so cortina-root tracks do not appear in track search
      results, paging/jump flows, or tanda-building candidate lists.
    - fuzzy candidate retrieval now sources only music-root tracks.
  - Playlist header `Clear` behavior is now tab-context aware:
    - if Playlist tab is active: existing clear modal flow remains
      (`clear` / `clear + auto-fill`).
    - if Tanda Designer tab is active: clears designer drafts immediately with
      no modal, preserves playlist-origin drafts, and leaves one fresh empty
      template selected.
  - Tanda Designer startup behavior:
    - stopped preloading all saved tandas into drafts; designer now starts with
      one empty template (plus any playlist-origin drafts only).
  - Added unit coverage for music-only search candidate filtering without
    native sqlite dependency.
- Files:
  - `app/src/main/library/search.ts`
  - `app/src/main/main.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/library-search-candidates.test.ts`
  - `design/05-ui-principles-and-components.md` (`UI-012.R17`, `UI-016.R16`)
  - `design/06-search-and-similarity.md` (`FR-090.1.R4`)
  - `design/tracking-and-feature-matrix.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (31 files, 133 tests)
  - `npm run build` passed

### Latest update
- Prep-mode playlist-click lead-in behavior split from Live mode:
  - Updated playlist run flow so prep-mode click-to-start from playlist begins
    immediately on the selected track (no lead-in cortina), including when the
    selected track is the first track in a tanda.
  - Live mode behavior is unchanged: lead-in cortina still applies for
    first-track tanda starts.
  - Added shared decision helper:
    - `shouldSkipLeadInCortinaForSelectedStart(...)`
  - Wired helper into renderer playback loop to skip only the selected-start
    lead-in in prep mode while preserving normal between-tanda cortina flow.
- Files:
  - `app/src/shared/playlist-flow.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/playlist-flow.test.ts`
  - `design/03-audio-playback-and-timing-model.md` (`FR-052.R6.a`)
  - `design/05-ui-principles-and-components.md` (`UI-012.R11.a`)
  - `design/tracking-and-feature-matrix.md`
  - `docs/dialogue.md`
  - `docs/handoff.md`

### Latest update
- Live-mode lead-in cortina reliability fix for playlist-click starts:
  - Symptom: in some live-mode starts, first-track tanda clicks could bypass
    lead-in cortina despite configured cortinas.
  - Fix: moved mode decision from implicit global-state checks to explicit
    per-click playback option:
    - `suppressLeadInCortinaForSelectedStart` is passed from `startPlaylistFrom`
      and consumed inside `runPlaylistPlayback`.
    - prep-mode clicks set this flag true (immediate start).
    - live-mode clicks set this flag false (lead-in cortina preserved).
  - Updated helper signature to consume the explicit flag and refreshed tests.
- Files:
  - `app/src/renderer/renderer.ts`
  - `app/src/shared/playlist-flow.ts`
  - `tests/playlist-flow.test.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`

### Latest update
- Mode-switch regression fix for playlist click-start lead-in handling:
  - Symptom: after switching between prep/live, both modes could start first
    track immediately because click-start was keyed only to `playlistPlayback.status`
    (`paused` treated as non-idle), skipping live lead-in cortina.
  - Fix:
    - added shared helper `shouldTreatClickStartAsIdle(...)` to classify click
      starts using both playback status and active main-channel audio state.
    - updated `startPlaylistFrom` to compute `wasIdle` from helper and use that
      for `startFromIdle` / initial-gap options.
  - Effect:
    - Live mode first-track click starts once again run lead-in cortina even
      after mode switches/paused states.
    - Prep mode immediate-start behavior remains unchanged.
- Files:
  - `app/src/shared/playlist-flow.ts`
  - `app/src/renderer/renderer.ts`
  - `tests/playlist-flow.test.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (31 files, 137 tests)
  - `npm run build` passed

### Latest update
- Playwright Electron E2E workflow suite (20 scenarios):
  - Added deterministic seeded fixture data + launcher harness for Electron UI
    workflows:
    - `tests/e2e/support/seed-data.ts`
    - `tests/e2e/support/electron-app.ts`
  - Added Playwright config:
    - `playwright.config.ts` (`tests/e2e/*.e2e.ts`)
  - Added 20 end-to-end UI scenarios:
    - `tests/e2e/workflows.e2e.ts`
    - coverage includes initial setup visibility, settings/config interactions,
      search variants (text/year/bpm/style), tanda search tab, clipboard flows,
      playlist flows, track/tanda row-menu actions, and clear behaviors.
  - Added test-environment path overrides to keep E2E runs isolated and
    reproducible:
    - data root override in `app/src/main/data-location.ts` via `TANDA_DATA_ROOT`
    - userData override in `app/src/main/main.ts` via `TANDA_USER_DATA_ROOT`
  - Added E2E testing design entries:
    - `design/12-testing-and-quality.md` (`TQ-TYPE-004`, `TQ-TOOL-004`)
  - Added npm script:
    - `package.json` -> `test:e2e`
- Notes:
  - In this sandbox, installing `@playwright/test` did not complete (install
    command hangs), so E2E execution could not be validated here.
  - Existing unit/build verification succeeded.
- Verification:
  - `npm test` passed (31 files, 137 tests)
  - `npm run build` passed

### Latest update
- Fixed playlist-hosted tanda editor action regression:
  - Symptom: clicking track-level controls in playlist-hosted tanda editor (reported on `tanda-up`) could close/exit editor due to unintended playlist-level click handling.
  - Fix: added event-isolation guard in playlist click handler to ignore clicks originating inside `#playlist-tanda-editor` so editor actions are processed only by `handleTandaAction`.
- Added E2E regression coverage:
  - `tests/e2e/workflows.e2e.ts` new scenario `21 - playlist-hosted tanda editor move buttons reorder without closing editor`.
  - Scenario checks: up/down reorder keeps editor open, remove sends to clipboard, add-back to active tanda works, and close (`tanda-done`) hides editor.
- Files:
  - `app/src/renderer/renderer.ts`
  - `tests/e2e/workflows.e2e.ts`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (31 files, 137 tests)
  - `npm run build` passed
  - `npx playwright test ... -g "21 - ..."` could not be fully validated in this environment due Electron launch failure (`Process failed to launch`).

### Latest update
- Resolved `electron-builder` / Node engine drift caused by `npx` in install scripts:
  - Symptom: `npm install` prompted and fetched latest `electron-builder@26.x`, which pulled `@electron/rebuild@4` + `node-abi@4` requiring Node >=22.12, producing EBADENGINE on Node 20.
  - Fix:
    - switched scripts from `npx electron-builder ...` to local `electron-builder ...` binaries;
    - pinned dev dependency `electron-builder` to `24.13.3` so installs are deterministic and compatible with current Node 20 setup.
- Files:
  - `package.json`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (31 files, 137 tests)
  - `npm run build` passed
- Environment note:
  - In this sandbox, dependency refresh could not be completed due blocked npm registry access (`ENOTFOUND registry.npmjs.org`). Run `npm install` locally to materialize the pinned builder version in `node_modules`/lockfile.

### Latest update
- Release pipeline hardening for artifact correctness:
  - Enforced local builder in CI packaging to avoid implicit upgrades:
    - `npx --no-install electron-builder ...` for all matrix targets.
  - Added per-platform package integrity checks before artifact upload:
    - macOS: verify `.dmg` with `hdiutil verify`; verify `.zip` with `unzip -t`.
    - Windows: require `.exe` and `.exe.blockmap` to exist and be non-empty.
    - Linux: require `.AppImage` and `.deb` to exist/non-empty; validate AppImage is ELF (`file`), validate `.deb` metadata (`dpkg-deb --info`).
- File:
  - `.github/workflows/release.yml`
  - `docs/dialogue.md`
  - `docs/handoff.md`
- Verification:
  - `npm test` passed (31 files, 137 tests)
  - `npm run build` passed
