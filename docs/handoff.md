## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.0` (from `package.json`)

### What I was doing last
- Aligned expanded tanda rows so the style badge and action menu stay top-aligned
  with the summary line when the track list is visible.
- Updated UI specs to capture the expanded-alignment requirement.

### Commands to run
- Install: `npm install`
- Tests: `npm test`
- Build: `npm run build`
- Run: `npm start`
- Optional ffmpeg fetch: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`

### Known failing tests
- None (all tests passing as of last run).

### Immediate next 3 tasks
1) Confirm expanded tanda alignment looks correct in the playlist and search.
2) Continue closing remaining spec gaps (playlist persistence, cortinas, waveform UX).
3) Audit open UI/UX tweaks reported by the user and prioritize fixes.
