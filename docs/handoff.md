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
- Generated two tango-themed icon options as 1024x1024 PNGs for review:
  `build/icons/options/option3.png` (vinyl + bandoneon) and
  `build/icons/options/option4.png` (shield badge).
- Added `build/icons/options/option5.png` with a large stylized T above a
  bandoneon fan.
- Generated final icon assets from the plain bandoneon option and stored them
  in `app/resources/icons/` (png/ico/icns plus size variants). Icon options
  moved to `docs/assets/icon-options/`.
- Updated release artifact naming to include platform/arch so Intel mac DMGs
  are clearly labeled.
- Updated README download section with new artifact naming and detailed macOS
  Gatekeeper steps.
- Guarded main-process close/close-response/fullscreen handlers against
  destroyed windows to avoid "Object has been destroyed" crashes during quit.
- Replaced close confirmation `window.confirm` prompts with a custom in-app
  confirm modal to avoid native NSAlert crashes in dev mode.
- Skipped close-intercept logic entirely when running in dev (`app.isPackaged`
  false) to avoid Electron SIGSEGV on quit.
- Forced dev close to call `app.exit(0)` on window close or IPC close to bypass
  Electron crash during shutdown.
- Avoided touching destroyed webContents by caching window id in close handlers.
- Split GitHub Actions mac builds: macos-13 builds x64 only, macos-14 builds
  arm64 only, to ensure Intel DMGs are actually x64.
- Tests/build green (`npm test`, `npm run build`).
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
1) Verify macOS Intel DMG now installs on Intel hardware (x64 build from macos-13).
2) Verify release assets are named with platform/arch and Intel DMG installs.
3) Verify AirPlay outputs list shows expected device(s) and duplicates are gone.
