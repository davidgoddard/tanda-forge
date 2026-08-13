# IPC and API Contracts

Requirement identifiers: All requirement bullets in this document are
identified as `IPC-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## IPC-001 — Principles

- IPC-001.R1: Renderer has no direct filesystem access.
- IPC-001.R2: All data access and device IO runs in the main process.
- IPC-001.R3: IPC is typed and versioned.

## IPC-002 — IPC Shape

- IPC-002.R1: `request/response` for commands and queries.
- IPC-002.R2: `events` for background updates (scan progress, playback state).

## IPC-003 — Core Channels

### Library

- IPC-003.R1.a: `library:pickRoot(kind): string | null`
- IPC-003.R1.b: `library:addRoot(kind, path): LibraryRoot`
- IPC-003.R1.c: `library:listRoots(): LibraryRoot[]`
- IPC-003.R1.d: `library:scanAll(): ScanSummary`
- IPC-003.R1.e: `library:runStartupFlow(params): StartupFlowSummary`
- IPC-003.R1.f: `library:listTracks(): TrackRow[]`
- IPC-003.R1.g: `library:scanProgress` (event stream)

### Tracks

- IPC-003.R2.a: `tracks:listPage(params): TrackRow[]`
- IPC-003.R2.b: `tracks:jumpToPrefix(params): { offset: number }`
- IPC-003.R2.c: `tracks:getJumpIndex(params): string[]`
- IPC-003.R2.d: `tracks:search(params): TrackRow[]`
- IPC-003.R2.e: `tracks:searchCount(params): number`
- IPC-003.R2.f: `tracks:searchJumpIndex(params): string[]`
- IPC-003.R2.g: `tracks:searchJumpToPrefix(params): { offset: number }`
- IPC-003.R2.h: `tracks:getStyles(): string[]`
- IPC-003.R2.i: `tracks:getByIds(ids): TrackRow[]`
- IPC-003.R2.j: `tracks:delete({ id, removeFile }): { ok, fileRemoved, fileRemovalError? }`
- IPC-003.R2.k: `tracks:listDeleted(): DeletedTrackRow[]`
- IPC-003.R2.l: `tracks:restoreDeleted(ids): { restored: number }`

### Tandas

- IPC-003.R3.a: `tandas:list(): TandaDetail[]`
- IPC-003.R3.b: `tandas:getByIds(ids): TandaDetail[]`
- IPC-003.R3.c: `tandas:save(payload): TandaDetail`
- IPC-003.R3.d: `tandas:delete(id): { ok: boolean }`
- IPC-003.R3.e: `tandas:search(params): TandaSearchRow[]`

### Styles

- IPC-003.R4.a: `styles:list(): string[]`
- IPC-003.R4.b: `styles:add(name): { ok: boolean }`
- IPC-003.R4.c: `styles:remove(name): { ok: boolean }`
- IPC-003.R4.d: `styles:replaceDefaults(payload): { ok: boolean }`

### App

- IPC-003.R5.a: `app:resetDatabase(): { ok: boolean }`
- IPC-003.R5.b: `app:exportSystemData(): { ok, cancelled?, path, error? }`
- IPC-003.R5.c: `app:importSystemData(): { ok, cancelled?, path, error? }`
- IPC-003.R5.d: `app:exportTandasData(): { ok, cancelled?, path, error? }`
- IPC-003.R5.e: `app:exportPlaylistData(manifest): { ok, cancelled?, path, error? }`
- IPC-003.R5.f: `app:importPlaylistData(): { ok, cancelled?, path, format?, state?, warnings?, error? }`
- IPC-003.R5.g: `app:close(): void`
- IPC-003.R5.h: `app:logClientError(payload): void`
- IPC-003.R5.i: `diagnostics:getDataReadiness(): { totalTracks, missingDuration, missingLoudness, missingTrimSignals, analysisErrors, missingWaveforms }`
- IPC-003.R5.j: `app:getReleaseUpdateInfo(): { currentVersion, latestVersion, releasesUrl } | null`
- IPC-003.R5.k: `app:openReleasePage(url?): { ok, error? }`

## IPC-004 — Versioning

- IPC-004.R1: IPC contracts are defined in `app/src/shared/types.ts`.
- IPC-004.R2: Breaking changes require updating all renderer and main-process handlers.
