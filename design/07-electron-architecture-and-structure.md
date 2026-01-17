# Electron Architecture and Folder Structure

## Overview

Tanda Player 2 is delivered as a desktop Electron app. The app runs entirely
offline and accesses local media via USB volumes or user-selected folders.
TypeScript is used for main, preload, and renderer code.

## Process Model

- Main process: owns the local data service, library scanning, audio analysis,
  and playback control.
- Preload: exposes a minimal, typed API to the renderer via `contextBridge`.
- Renderer: UI and interaction logic; no direct filesystem access.

## Bundled Media Tools

- FFmpeg/ffprobe are bundled with the app and invoked by the main process.
- The main process resolves the correct binary for the platform at runtime.

## Local Storage

- Library roots (USB and/or local folders) are configured per user.
- Metadata and analysis results are stored in the app data directory.
- Missing/unmounted roots are tracked and surfaced to the UI.

## Proposed Folder Structure

```
app/
  resources/
    ffmpeg/                 # Bundled binaries per platform
  src/
    main/
      main.ts               # Electron main entry
      library/
        scan.ts             # Library discovery
        analysis.ts         # FFmpeg/ffprobe integration
      playback/
        engine.ts           # Playback state machine
    preload/
      preload.ts            # contextBridge API
    renderer/
      index.html
      renderer.ts
      styles.css
    shared/
      types.ts              # Shared types and IPC contracts
```
