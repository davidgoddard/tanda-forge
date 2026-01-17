# IPC and API Contracts

## Principles

- Renderer has no direct filesystem access.
- All data access and device IO runs in the main process.
- IPC is typed and versioned.

## IPC Shape

- `request/response` for commands and queries.
- `events` for background updates (scan progress, playback state).

## Core Channels

### Library

- `library.listRoots(): LibraryRoot[]`
- `library.addRoot(path, kind): LibraryRoot`
- `library.removeRoot(id): void`
- `library.scan(id): ScanSummary`
- `library.onScanProgress(callback): void`

### Tracks

- `tracks.search(query, filters, paging): Track[]`
- `tracks.get(id): TrackDetail`
- `tracks.updateMetadata(id, patch): void`

### Tandas

- `tandas.list(): Tanda[]`
- `tandas.get(id): TandaDetail`
- `tandas.create(payload): Tanda`
- `tandas.update(id, patch): void`
- `tandas.delete(id): void`

### Playlists

- `playlists.list(): Playlist[]`
- `playlists.get(id): PlaylistDetail`
- `playlists.create(payload): Playlist`
- `playlists.update(id, patch): void`
- `playlists.delete(id): void`

### Playback

- `playback.getState(): PlaybackState`
- `playback.play(itemId): void`
- `playback.pause(): void`
- `playback.stop(): void`
- `playback.next(): void`
- `playback.prev(): void`
- `playback.onStateChanged(callback): void`
- `playback.onPosition(callback): void`

## Versioning

- IPC contracts are versioned in `app/src/shared/types.ts`.
- Breaking changes must increment a `contractVersion` constant.
