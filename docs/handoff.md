## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.0` (from `package.json`)

### What I was doing last
- Implemented the requested UI tweaks (waveform alignment, playlist/clipboard actions, mismatch warning tooltips).
- Discussed the next UX change: named clipboard collections with merge vs tab behavior (no code yet).

### Commands to run
- Install: `npm install`
- Tests: `npm test`
- Build: `npm run build`
- Run: `npm start`
- Optional ffmpeg fetch: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`

### Known failing tests
- None (all tests passing as of last run).

### Immediate next 3 tasks
1) Decide on the clipboard collections UX pattern (tabs only vs active + include others).
2) Update design docs for clipboard collections and persistence once the UX is chosen.
3) Implement collections: data model, UI controls, add/remove flow, and persistence.
