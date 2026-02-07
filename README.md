# Tanda Player Lite

Electron-based DJ tool for managing tango tandas, playlists, and playback.

## Quick start

1) Install dependencies:

```bash
npm install
```

2) Provide ffmpeg/ffprobe binaries (see below).

3) Build and run:

```bash
npm run build
npm start
```

## ffmpeg/ffprobe setup

The app expects platform binaries in the following folders:

- `app/resources/ffmpeg/darwin/ffmpeg`
- `app/resources/ffmpeg/darwin/ffprobe`
- `app/resources/ffmpeg/win32/ffmpeg.exe`
- `app/resources/ffmpeg/win32/ffprobe.exe`
- `app/resources/ffmpeg/linux/ffmpeg`
- `app/resources/ffmpeg/linux/ffprobe`

These binaries are intentionally excluded from git to keep the repo small. You can:

- Download platform binaries and place them in the folders above, or
- Use the helper script: `scripts/fetch-ffmpeg.sh [macos|windows|linux|all]`, or
- Install `ffmpeg`/`ffprobe` in your system `PATH` (the app will fall back to that).

## Packaging and distribution (GitHub Releases)

Recommended approach: publish packaged builds to GitHub Releases.

1) Install dependencies:

```bash
npm install
```

2) Ensure ffmpeg binaries are present (see above). The `build.extraResources`
   section in `package.json` will bundle `app/resources/ffmpeg` into the app.

3) Build the app bundles with Electron Builder:

```bash
npm run package
```

Or target a specific OS:

```bash
npx electron-builder --mac
npx electron-builder --win
npx electron-builder --linux
```

Artifacts will appear in `dist/` (do not commit to git). Upload the resulting
installers to GitHub Releases.

Notes:
- If you prefer, add a `package` script in `package.json` that runs
  `electron-builder` so it’s consistent for the team.
- Packaging should be done on the target OS (macOS for `.dmg`, Windows for
  `.exe`, Linux for `.AppImage`/`.deb`).

## End-user install and run

From GitHub Releases, download the installer for your platform:

- macOS: open the `.dmg`, drag the app to Applications, then launch it.
- Windows: run the `.exe` installer, then launch the app from the Start Menu.
- Linux: run the `.AppImage` (make executable) or install the `.deb`.

First-run checklist:
1) Open Settings → Library and add your Music/Cortina folders.
2) Scan Library.
3) Set audio outputs in Settings → System if you want headphones preview.

## Notes

- The app runs fullscreen by default.
- Settings and scan progress live inside the app; use the Settings button.

## Repository size and hygiene

This repo intentionally excludes large generated files and binaries.

Do not commit:
- `node_modules/`
- `dist/`
- `tmp/` or `.git/tmp/`
- `app/resources/ffmpeg/` binaries

If you accidentally commit a large temp folder (for example `tmp/clean.git`),
remove it from the index and rewrite history before pushing:

```bash
git rm -r --cached tmp/clean.git
git commit -m "Remove tmp/clean.git"
```

If GitHub still warns about large files, use a history rewrite tool (e.g.
`git filter-repo`) to purge the folder from all commits.

After removing large folders, run:

```bash
git gc --prune=now --aggressive
```
