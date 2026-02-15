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
1) Verify macOS arm64 CI build is actually arm64 (check `file` output in logs).
2) Verify the arm64 DMG runs on Apple Silicon without Rosetta prompt.
3) Sanity-check theme cycling and Tanda Designer Close behavior.
