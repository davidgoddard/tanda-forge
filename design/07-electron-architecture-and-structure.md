# Electron Architecture and Folder Structure

- ARC-LGT-001: The sandboxed renderer may connect only to the optional local
  Lighting controller at `http://127.0.0.1:8080`; the Content Security Policy
  explicitly permits that endpoint without opening unrestricted networking.

## Overview

Tanda Forge is delivered as a desktop Electron app. The app runs entirely
offline and accesses local media via USB volumes or user-selected folders.
TypeScript is used for main, preload, and renderer code.

Requirement identifiers: All requirement bullets in this document are
identified as `ARCH-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## Process Model

- ARCH-001.R1: Main process owns the local data service, library scanning, audio
  analysis, cache generation, and filesystem-backed diagnostics.
- ARCH-001.R2: Preload exposes a minimal, typed API to the renderer via
  `contextBridge`.
- ARCH-001.R3: Renderer handles UI, interaction logic, and the current
  playback/sequencing control flow with no direct filesystem access.

## Bundled Media Tools

- ARCH-002.R1: FFmpeg/ffprobe are bundled with the app and invoked by the main
  process.
- ARCH-002.R2: The main process resolves the correct binary for the platform at
  runtime.
- ARCH-002.R3: When a library track requires both core audio analysis and a
  waveform, the scanner uses one FFmpeg decode with separate filter branches
  for silence/loudness and waveform generation. Scans use bounded cross-track
  concurrency. Existing complete analysis remains reusable across application
  upgrades unless its analysis pipeline version changes.

## Local Storage

- ARCH-003.R1: Library roots (USB and/or local folders) are configured per user.
- ARCH-003.R2: Metadata and analysis results are stored in the app data directory.
- ARCH-003.R3: Missing roots are surfaced to the UI through availability checks.
- ARCH-003.R4: Some renderer-local preferences still use local browser storage,
  but long-term persistence should trend toward the shared application data store.

## Current Folder Structure Direction

```
app/
  resources/
    ffmpeg/                 # Bundled binaries per platform
  src/
    main/
      main.ts               # Electron main entry
      ipc/                  # Domain classification and guarded registration
      library/
        scan.ts             # Library discovery
        analysis.ts         # FFmpeg/ffprobe integration
    preload/
      preload.ts            # contextBridge API
    renderer/
      index.html
      renderer.ts
      styles.css
      controllers/          # Localized orchestration
      modules/              # Localized view/helper logic
      state/                # Focused, DOM-independent feature stores
      locales/              # One explicit translation map per locale
      domain.ts             # Shared renderer-domain contracts
    shared/
      types.ts              # Shared types and IPC contracts
```

- ARCH-004.R1: Renderer feature boundaries use the concrete contracts in
  `renderer/domain.ts`; controller dependency APIs must not erase tracks,
  tandas, playlist items, validation results, or playback results to `any`.
- ARCH-004.R2: New stateful renderer slices use focused playlist, playback,
  tanda-editor, or clipboard stores whose transitions can be tested without a
  mounted DOM. A single catch-all renderer store is not introduced.
- ARCH-004.R3: Locale source maps remain separate and explicit. Runtime English
  fallback is permitted, but source-map inheritance must not conceal missing
  locale keys from completeness tests.
