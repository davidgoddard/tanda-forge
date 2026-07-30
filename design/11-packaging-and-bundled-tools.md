# Packaging and Bundled Tools

## Electron Packaging

- PKG-ELEC-001: Use `electron-builder` or equivalent (planned).
- PKG-ELEC-002: Target: macOS first, then Windows and Linux.
- PKG-ELEC-003: App is fully offline; no runtime network dependency.

## Bundled FFmpeg/ffprobe

- PKG-FFM-001: Binaries are placed under `app/resources/ffmpeg/<platform>/`.
- PKG-FFM-002: The main process resolves the correct binary at runtime.
- PKG-FFM-003: Licensing requirements are documented and included in the app bundle.
- PKG-FFM-004: Packaged builds resolve binaries from `process.resourcesPath/ffmpeg/<platform>/`.
- PKG-FFM-005: Use `scripts/fetch-ffmpeg.sh` to download binaries for macOS, Windows, and Linux.
- PKG-FFM-006: Release CI must stage the platform FFmpeg/ffprobe payload before
  packaging and must fail macOS package verification when either packaged tool
  is missing or not executable.
- PKG-FFM-007: The platform fetch script must create each temporary extraction
  directory before invoking archive tools so clean CI runners can stage the
  payload without relying on pre-existing temporary folders.

## Release Delivery

- PKG-REL-001: Releases publish manual-download installables only.
- PKG-REL-002: Published GitHub release assets are limited to platform-usable
  deliverables:
  - macOS: `.dmg` per supported architecture
  - Windows: `.exe`
  - Linux: `.AppImage` and `.deb`
- PKG-REL-003: Updater metadata and differential-update helper artifacts are not
  published as release assets.

## Filesystem Permissions

- PKG-FS-001: The app requests access only to user-selected folders and removable media.
- PKG-FS-002: All data is stored under the app data directory.
