# Electron Architecture and Folder Structure

## Overview

Tanda Player 2 is delivered as a desktop Electron app. The app runs entirely
offline and accesses local media via USB volumes or user-selected folders.
TypeScript is used for main, preload, and renderer code.

Requirement identifiers: All requirement bullets in this document are
identified as `ARCH-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## Process Model

- ARCH-001.R1: Main process owns the local data service, library scanning, audio
  analysis, and playback control.
- ARCH-001.R2: Preload exposes a minimal, typed API to the renderer via
  `contextBridge`.
- ARCH-001.R3: Renderer handles UI and interaction logic with no direct filesystem
  access.

## Bundled Media Tools

- ARCH-002.R1: FFmpeg/ffprobe are bundled with the app and invoked by the main
  process.
- ARCH-002.R2: The main process resolves the correct binary for the platform at
  runtime.

## Local Storage

- ARCH-003.R1: Library roots (USB and/or local folders) are configured per user.
- ARCH-003.R2: Metadata and analysis results are stored in the app data directory.
- ARCH-003.R3: Missing/unmounted roots are tracked and surfaced to the UI.

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
