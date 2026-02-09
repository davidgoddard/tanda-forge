## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.0` (from `package.json`)

### What I was doing last
- Switched CI to upload release assets via GitHub Action instead of relying on
  electron-builder publish (fixes missing assets).
- Tests and build are green (npm test, npm run build).

### Commands to run
- Install: `npm install`
- Tests: `npm test`
- Build: `npm run build`
- Run: `npm start`
- Optional ffmpeg fetch: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`

### Known failing tests
- None (all tests passing as of last run).

### Immediate next 3 tasks
1) Verify removing a track from a playlist tanda no longer changes clipboard tandas.
2) Capture screenshots for the user guide placeholders.
3) Continue UI polish backlog (button sizing, menus, waveform layout tweaks).
