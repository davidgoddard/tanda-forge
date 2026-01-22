# Tanda Player 2

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
- Install `ffmpeg`/`ffprobe` in your system `PATH` (the app will fall back to that).

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
