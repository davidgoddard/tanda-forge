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

- `library:pickRoot(kind): string | null`
- `library:addRoot(kind, path): LibraryRoot`
- `library:listRoots(): LibraryRoot[]`
- `library:scanAll(): ScanSummary`
- `library:listTracks(): TrackRow[]`
- `library:scanProgress` (event stream)

### Tracks

- `tracks:listPage(params): TrackRow[]`
- `tracks:jumpToPrefix(params): { offset: number }`
- `tracks:getJumpIndex(params): string[]`
- `tracks:search(params): TrackRow[]`
- `tracks:searchCount(params): number`
- `tracks:searchJumpIndex(params): string[]`
- `tracks:searchJumpToPrefix(params): { offset: number }`
- `tracks:getStyles(): string[]`

### Tandas

- `tandas:list(): TandaDetail[]`
- `tandas:save(payload): TandaDetail`
- `tandas:delete(id): { ok: boolean }`
- `tandas:search(params): TandaSearchRow[]`

### App

- `app:resetDatabase(): { ok: boolean }`
- `app:close(): void`
- `app:logClientError(payload): void`

## Versioning

- IPC contracts are defined in `app/src/shared/types.ts`.
- Breaking changes require updating all renderer and main-process handlers.
