## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.0` (from `package.json`)

### What I was doing last
- Moved app close/fullscreen IPC handlers out of `createWindow` and into
  `registerIpc` with per-window close state map to avoid duplicate handler
  registration (fixes main-process JS error).
- Tightened audio output dedupe to label-only to reduce duplicate AirPlay
  entries.
- Tests/build not run after these changes.

### Commands to run
- Install: `npm install`
- Tests: `npm test`
- Build: `npm run build`
- Run: `npm start`
- Optional ffmpeg fetch: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`

### Known failing tests
- None (all tests passing as of last run).

### Immediate next 3 tasks
1) Verify AirPlay outputs list shows expected device(s) and duplicates are gone.
2) Re-test close confirmation flow while playback is active (ensure app quits).
3) Run `npm test` + `npm run build` to confirm build health.
