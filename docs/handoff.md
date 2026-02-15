## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.1` (from `package.json`)

### What I was doing last
- Added a second dark theme and updated the theme toggle to cycle
  light → dark → dark-alt → light.
- Strengthened dark-mode active collection styling so the selected collection
  is more obvious.
- Made Tanda Designer “Done” always enabled and renamed to “Close”.
- Added a quick trim-end fade so early trims avoid clicks but still end fast.
- Removed the clipboard collection remove button (clear dialog now handles it).
- Ensured macOS quits fully when the last window closes.
- Added macOS dock icon override and packaged icons into `extraResources`.
- Added CI verification of macOS build architecture using `file`.
- Updated README with macOS arch-selection guidance.
- Tests not re-run after these edits.

### Commands to run
- Install: `npm install`
- Tests: `npm test`
- Build: `npm run build`
- Run: `npm start`
- Optional ffmpeg fetch: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`

### Known failing tests
- None (all tests passing as of last run).

### Immediate next 3 tasks
1) Verify the macOS arm64 and x64 release assets report the correct arch
   (no Rosetta prompt on Apple Silicon for arm64).
2) Sanity-check the new theme cycle and active-collection highlight in dark modes.
3) Confirm “Close” in Tanda Designer dismisses even when locked.
