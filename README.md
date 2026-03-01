# Tanda Player Lite

Tanda Player Lite is a desktop app for tango DJs who want fast, safe, and flexible tanda preparation and live playback.

It evolved from the original Raspberry Pi Tanda Player and focuses on practical live DJ workflows: building tandas, managing playlists, cueing audio, and adapting quickly during a milonga.

This project is a collaboration between David Goddard (design and requirements) and ChatGPT Codex (implementation, tests, and documentation).

![Main screen layout](images/user-guide/01-main-layout.png)
![Display screen layout](images/user-guide/02-display-board.png)

## Why should DJs use it

- Build and edit tandas quickly from tracks or existing tandas.
- Use one workflow for preparation, one for live performance, and one for metadata editing.
- Keep playlists diverse with built-in analysis and collection tools.
- Route audio for cueing (main output + headphones).
- Normalize playback levels and trim silence automatically.
- Control cortinas globally or per slot, with fade behavior and manual override.
- Show dancer-facing display content on a second screen.

## Core features

- Multilingual UI (song metadata remains user data).
- Light/dark themes.
- Dual output routing (main + headphones).
- Playback normalization and diagnostic logging.
- Live compression/limiter control for dynamic-range reduction on main output.
- Automatic silence trim with configurable padding.
- Playlist timing estimates and tanda sequencing tools.
- Legacy import from classic Tanda Player data.
- Built-in and user collections (for example: `New`, `Top`, `Least`, `Available`, custom sets).
- Playlist diversity graphs (artist/orchestra, year, tempo).
- "Current tanda is last tanda" flow for clean session ending.

## Download and install

### Choose the correct release artifact

- macOS Intel: `...-mac-x64.dmg` or `...-mac-x64.zip`
- macOS Apple Silicon: `...-mac-arm64.dmg` or `...-mac-arm64.zip`
- Windows: `...-win-x64.exe`
- Linux: `...-linux-x64.AppImage` or `...-linux-x64.deb`

If you install the wrong macOS architecture, macOS will reject launch.

### macOS Gatekeeper (unsigned builds)

For first launch:

1. Move **Tanda Player Lite.app** to Applications.
2. Right-click app -> **Open** -> **Open**.
3. If blocked: **System Settings -> Privacy & Security -> Open Anyway**.

## ffmpeg / ffprobe

The app requires `ffmpeg` and `ffprobe` for analysis and waveform generation.

### Option A: bundled binaries (recommended)

Place binaries at:

- `app/resources/ffmpeg/darwin/ffmpeg`
- `app/resources/ffmpeg/darwin/ffprobe`
- `app/resources/ffmpeg/win32/ffmpeg.exe`
- `app/resources/ffmpeg/win32/ffprobe.exe`
- `app/resources/ffmpeg/linux/ffmpeg`
- `app/resources/ffmpeg/linux/ffprobe`

Helper script:

```bash
scripts/fetch-ffmpeg.sh [macos|windows|linux|all]
```

### Option B: system PATH fallback

If `ffmpeg` and `ffprobe` are available in `PATH`, the app uses those automatically.

## First-time setup

### 1) Library

Settings -> **Library**

1. Add Music folders.
2. Add Cortina folders (optional).
3. Add Background folders (optional).
4. Import legacy data (optional, if detected).
5. Scan music/cortinas.

### 2) System

Settings -> **System**

- Language
- Main and Headphones outputs
- Styles
- Search/scoring settings
- Collection limits
- Counts/defaults
- Compressor/limiter settings

### 3) Playlist

Settings -> **Playlist**

- Start/end timing
- Sequence rules
- Cortina timing and behavior
- Gap controls

## Typical workflow

1. Search tracks or tandas.
2. Stage candidates in Clipboard collections.
3. Build/refine tandas in Tanda Designer.
4. Send tandas/tracks into the Playlist.
5. Cue with headphones and run live playback.

## Modes

- **Preparation**: unrestricted workflow and rapid auditioning.
- **Live**: safer operation during performance.
- **Edit**: metadata editing optimized for repeated updates.

## Compression use case (for noisy rooms)

At the start of a tanda, floors can be chatty while the first phrases of a song are often quieter.
In that situation, DJs usually do **not** want to turn the venue amplifier up, because louder sections
later in the same song or tanda can then become too loud.

Use the app's compression control instead:

- raise quieter passages so dancers can hear musical detail sooner,
- keep louder peaks constrained with the limiter,
- maintain safer and more consistent overall room level.

Typical practical flow:

1. Start the tanda with compression depth increased.
2. As room chatter falls, gradually reduce compression depth back toward normal.
3. Keep amplifier/master venue gain unchanged.

## Legacy import

If legacy files are present (for example `config.js`, `tandas.dat`, `library.dat`), import can:

- recreate tandas,
- apply curated metadata,
- preserve prior organization while upgrading to desktop workflow.

### Legacy import vs scan (what wins)

Legacy import writes track rows directly, including any available legacy
`loudness_db` / `gain_db`, so playback normalization can work immediately
without an immediate scan.

If you run a scan afterward:

- Track analysis values are recalculated with `ffmpeg`/`ffprobe` and overwrite
  imported legacy analysis fields (`duration`, trim offsets, `loudness_db`,
  `gain_db`, analysis JSON/error).
- Tag-derived metadata is refreshed from file tags (with legacy overrides applied
  when present in the scan context).
- `bpm` and free-text notes are generally preserved unless explicitly changed.

Why this happens:

- Legacy-imported rows are marked as `legacy_import_pending_scan` and tagged with
  `analysis_json.source = "legacy-import"`.
- The scanner treats that marker as "do not reuse old analysis" and performs a
  full analysis pass to normalize behavior with current tooling.

Practical guidance:

- Import only: fastest way to get started, keeps legacy analysis values.
- Import + scan: recommended when you want fresh waveform/analysis consistency
  from current `ffmpeg` processing.

## Development

### Prerequisites

- Node.js `>=22.12.0`
- npm

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Tests

```bash
npm test
npm run test:coverage
npm run test:e2e
```

Note: Playwright Electron tests require a valid GUI session and can fail in headless/sandboxed environments.

## Project structure (high level)

- `app/src/main`: Electron main process, IPC, DB and scan orchestration
- `app/src/preload`: safe renderer bridge
- `app/src/renderer`: UI, interactions, workflow logic
- `app/src/shared`: domain logic and utilities
- `tests`: unit and E2E coverage
- `docs`: handoff, dialogue, and user guidance

## Troubleshooting

- Wrong mac architecture build: install matching `x64` or `arm64` artifact.
- App blocked on macOS: use **Open Anyway** path above.
- No analysis/waveform: verify `ffmpeg`/`ffprobe` availability.
- Audio routing confusion: confirm output devices in Settings -> System and check diagnostics logs.
