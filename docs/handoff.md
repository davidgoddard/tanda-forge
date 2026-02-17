## Handoff

### Current branch / version
- Branch: `main`
- Version: `0.1.1` (from `package.json`)

### What I was doing last
- Reworked legacy import to avoid full scans: imports `library.dat`/`cortinas.dat`,
  verifies file existence, loads waveform `.png` files, and reports missing files.
- Moved clipboard clear button into its own toolbar (away from the filter).
- Removed fade-in on transitions; only fast fade-out remains.
- Simplified expanded tanda summaries (name/year/bpm/duration only) and hid
  unknown years.
- Moved track editor Cancel button into the footer with Reset/Save.
- Randomized cortina assignments when switching cortina sets in playlist config.
- Separated playlist-origin tandas from the Tanda Designer list so playlist
  edits don’t clutter the designer tab.
- Boosted search scoring for exact artist/year/BPM matches.
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
1) Sanity-check legacy import: no scan, missing file list, waveform `.png` load.
2) Verify playlist-origin tandas don’t appear in the designer list, and playlist
   edits still open/close correctly.
3) Confirm cortina re-assignment and no fade-in on playback starts.
