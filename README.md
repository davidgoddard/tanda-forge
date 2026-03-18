# Tanda Forge

<img src="images/user-guide/tandaforge_icon_1024.png" width="300px">

## User Guide

See [User Guide](docs/user-guide.md)

## Note

This app uses `ffmpeg` / `ffprobe` for analysis, waveform generation, and compressed-cache rendering. It now resolves those tools in this order:

- bundled app binaries
- user-configured custom tools folder
- system `PATH`

So end users do not normally need to install ffmpeg separately or patch files into the installed app folder.

## Background

Tanda Forge is a desktop app for Argentine Tango DJs who want a fast, safe, and flexible tanda preparation and live playback app.

It evolved from the original Raspberry Pi Tanda Player and focuses on practical live DJ workflows: building tandas, managing playlists, cueing audio, and adapting quickly during a milonga.

This project is a collaboration between David Goddard (design and requirements) and ChatGPT Codex (implementation, tests, and documentation).

![Main screen layout](images/user-guide/01-main-layout.png)
![Display screen layout](images/user-guide/02-display-board.png)

## Why should DJs use it

- Build, save and edit tandas quickly from tracks or existing tandas.
- Use modes of operation; one for preparation, one live performance, and one for metadata editing (titles, artists etc.).
- Keep playlists diverse with built-in analysis and collection tools.
- Dual audio - main output + headphones.
- Normalize playback levels and trim silence automatically.
- Control cortinas globally or per slot, with fade behavior and manual override.
- Show dancer-facing display content on a second screen.
- Support live performances with prepared collections, confirmed one-off Live playback from Search/Clipboard/Collections, and a stop/resume flow that pauses the playlist after a tanda and later resumes where it left off.
- Cleanly end a session using a single tick-box and get automatic stop after playlist and final 'farewell' cortina.
- Help dancers hear music over the chatter without use of a volume control.

## Core features

- Multilingual UI (song metadata remains user data).
- Light/dark themes.
- Dual output routing (main + headphones).
- Playback normalization
- Live compression/limiter control for dynamic-range reduction on main output.
- Automatic silence trim with configurable padding.
- Playlist timing estimates and tanda sequencing tools.
- Legacy import from classic Tanda Player data.
- Built-in and user collections (for example: `New`, `Top`, `Least`, `Available`, custom sets).
- Playlist diversity graphs (artist/orchestra, year, tempo).
- "Current tanda is last tanda" flow for clean session ending.

See the user guide for more information on the features.

## Download and install

### Choose the correct release artifact

- macOS Intel: `...-mac-x64.dmg` or `...-mac-x64.zip`
- macOS Apple Silicon: `...-mac-arm64.dmg` or `...-mac-arm64.zip`
- Windows: `...-win-x64.exe`
- Linux: `...-linux-x64.AppImage` or `...-linux-x64.deb`

If you install the wrong macOS architecture, macOS will reject launch.

### macOS Gatekeeper (unsigned builds)

For first launch:

1. Move **Tanda Forge.app** to Applications.
2. Right-click app -> **Open** -> **Open**.
3. If blocked: **System Settings -> Privacy & Security -> Open Anyway**.

## ffmpeg / ffprobe

The app requires `ffmpeg` and `ffprobe` for analysis and waveform generation.

### End users

The normal expectation is that releases include bundled binaries. If a particular machine cannot use those, go to:

- `Settings -> Diagnostics`

and use:

- `Choose FFmpeg tools folder`

to point the app at a folder containing:

- `ffmpeg` and `ffprobe`
- or `ffmpeg.exe` and `ffprobe.exe` on Windows

If neither bundled binaries nor a custom tools folder are available, the app falls back to `PATH`.

### Release/build inputs

Bundled binaries should be staged at:

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

### PATH fallback

If `ffmpeg` and `ffprobe` are available in `PATH`, the app uses those automatically as the last fallback.

## First-time setup

### 1) Library

Settings -> **Library**

1. Define musical style labels 
2. Map sub-styles as necessary
3. If importing legacy data, pick legacy styles and map as necessary
4. Add Music folders.
5. Add Cortina folders (optional).
6. Add Background folders (optional).
7. Add images folders (optional).
8. Import legacy data (optional, if detected - System is ready to use with some limitations).
9. Scan music/cortinas. This builds or refreshes the library database, analysis, and waveform cache. Re-running a scan skips unchanged files, so adding new songs normally just means rescanning the relevant root.
10. If compression will be used, optionally precompute compressed versions of tracks. This takes a long time.
11. If needed, use `Verify cached files` to prune broken waveform/compressed cache files without deleting the valid ones.
12. `Erase Database` clears the database only. `Erase Cached Files` clears the waveform/compressed caches.

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
- Sequence rules - for example: "3T 3T 3W 3T 3T 3M" - defines preferred size and styles for the playlist
  - Supports grouped alternatives, e.g. `(2C 3M)`
  - Sequence validation checks syntax and that style letters exist in configured style families
- Cortina timing and behavior
- Gap controls
  - Positive values add silence before the next item
  - `0` means immediate transition
  - Negative values create overlap/crossfade; for example `-2` means about a two-second mix

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

## Music Styles

The system is given a number of single letter styles such as **T** or **W** or **M**.  Each one has a name such as "Tango". Then zero or more sub-styles can be added such as "Alternative", "Contemporary", "Traditional".  The system allows tandas that match any of the sub-styles or the
main style name as valid for a playlist position marked with the single letter such as "T".

The style names are shown as search filter buttons and all matching tracks and tandas are then shown in the search results and the clipboard.

## Compression use case (for noisy rooms)

At the start of a tanda, floors can be chatty while the first phrases of a song are often quieter.
In that situation, DJs usually do **not** want to turn the venue amplifier up, because louder sections
later in the same song or tanda can then become too loud.

Use the app's compression control instead:

- raise quieter passages so dancers can hear musical detail sooner,
- keep louder peaks constrained with the limiter,
- maintain safer and more consistent overall room level.

Typical practical flow:

1. Raise compression for the current song only when needed.
2. As room chatter falls, gradually reduce compression depth back toward normal.
3. Keep amplifier/master venue gain unchanged.

Notes:

- Each new song or cortina starts with the compression mix back at `0%`.
- The app also returns the mix to `0%` in roughly the last 20 seconds of the
  item so natural fade-outs are not lifted.

## Legacy import

If legacy Tanda Player files are present (for example `config.js`, `tandas.dat`, `library.dat`), import can:

- recreate tandas,
- apply curated metadata,
- preserve prior organization while upgrading to desktop workflow.

### Style families before legacy import

Set up style families first so playlist letters, track styles, and legacy values all align.

- In **Settings -> Library -> Style Families**, define rows by:
  - **Code** (playlist letter, e.g. `T`, `W`, `M`)
  - **Base style** (e.g. `Tango`)
  - **Sub-styles** (optional comma list, e.g. `Nuevo, Traditional`)
- This drives:
  - playlist sequence matching (letters resolve from this family map),
  - search style pills (base style),
  - track editor style picker (base + sub-style values like `Tango - Nuevo`).

To inspect legacy style values in advance:

- In **Settings -> Library -> Style Families**, click **Show legacy styles**.
- You will see a mapping table with distinct style values from `library.dat`, counts, and current mapping status.
- For each row:
  - select an existing style from the dropdown to map that legacy value as an alias, or
  - fill **Code / Base style / Alias** and click **Add as new style** to create and map in one step.

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
