## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.0` (from `package.json`)

### What I was doing last
- Updated now-playing cortina duration display: shows configured cortina length by
  default and switches to full track duration when "play all" is selected.
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
