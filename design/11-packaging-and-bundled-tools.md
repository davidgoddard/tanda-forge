# Packaging and Bundled Tools

## Electron Packaging

- Use `electron-builder` or equivalent (planned).
- Target: macOS first, then Windows and Linux.
- App is fully offline; no runtime network dependency.

## Bundled FFmpeg/ffprobe

- Binaries are placed under `app/resources/ffmpeg/<platform>/`.
- The main process resolves the correct binary at runtime.
- Licensing requirements are documented and included in the app bundle.

## Update Policy

- Auto-update is optional and can be disabled by default.
- When enabled, updates must not block playback or library access.

## Filesystem Permissions

- The app requests access only to user-selected folders and removable media.
- All data is stored under the app data directory.
