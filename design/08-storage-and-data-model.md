# Storage and Data Model

Requirement identifiers: All requirement bullets in this document are
identified as `DATA-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## DATA-001 — Storage Stack

- DATA-001.R1: Local-only storage, no network dependency.
- DATA-001.R2: Primary store: SQLite database in the configured data root.
- DATA-001.R3: Large blobs (waveforms, cached previews) stored as files referenced by DB.
- DATA-001.R4: User-approved trim overrides and diagnostic acknowledgements are
  stored separately from measured analysis. An acknowledgement is keyed to the
  current duration/trim issue signature so changed evidence returns for review.

## DATA-002 — Data Root Locations

- DATA-002.R1: The app has a configurable data root that contains the SQLite database,
  waveform cache, compressed-audio cache, and diagnostics logs.
- DATA-002.R2: By default, the data root is the platform user-data location returned
  by Electron.
- DATA-002.R3: If the user selects a custom data location, the app stores its data
  in a `_tp_data` folder inside the selected directory.
- DATA-002.R4: `TANDA_DATA_ROOT` may override the data root for development or
  controlled deployments.
- DATA-002.R5: Platform user-data examples remain relevant only as defaults:
  macOS `~/Library/Application Support/<app>/`, Windows `%APPDATA%\\<app>\\`,
  Linux `~/.config/<app>/`.

## DATA-003 — Database Files

- DATA-003.R1: `tanda-player.db` (primary SQLite)
- DATA-003.R2: `tanda-player.db-wal` / `tanda-player.db-shm`

## DATA-004 — Identity Model

### Library Root

Represents a scan scope. A root can be a USB volume or local folder.

Fields:
- DATA-004.R1.a: `id` (UUID)
- DATA-004.R1.b: `kind` (`music` | `cortina`)
- DATA-004.R1.c: `path` (absolute path)
- DATA-004.R1.d: `label` (user-friendly name)
- DATA-004.R1.e: `created_at` (timestamp)
- DATA-004.R1.f: `last_scan_started_at`
- DATA-004.R1.g: `last_scan_completed_at`
- DATA-004.R1.h: `last_scan_error`

### Track

Tracks are immutable and identified by stable IDs.

Fields:
- DATA-004.R2.a: `id` (UUID)
- DATA-004.R2.b: `root_id` (FK to library_root)
- DATA-004.R2.c: `relative_path` (path within the root)
- DATA-004.R2.d: `full_path` (absolute path)
- DATA-004.R2.e: `file_size` (bytes)
- DATA-004.R2.f: `file_mtime_ms` (last modified time, ms)
- DATA-004.R2.g: `file_hash` (content hash; stable across moves)
- DATA-004.R2.h: `title`, `artist`, `artist_summary`, `singer`, `album`, `year`, `genre`
- DATA-004.R2.i: `notes` (user-authored free text)
- DATA-004.R2.j: `bpm` (user-derived tempo estimate)
- DATA-004.R2.k: `duration_ms` (from analysis)
- DATA-004.R2.l: `start_offset_ms`
- DATA-004.R2.m: `end_trim_ms`
- DATA-004.R2.n: `loudness_db`
- DATA-004.R2.o: `gain_db`
- DATA-004.R2.p: `tag_error`
- DATA-004.R2.q: `analysis_error`
- DATA-004.R2.r: `tag_json`
- DATA-004.R2.s: `analysis_json`
- DATA-004.R2.t: `last_scanned_at`
- DATA-004.R2.u: `created_at`, `updated_at`
- DATA-004.R2.v: Album artist is not stored or used; only album title is retained.

### Tanda

Fields:
- DATA-004.R3.a: `id` (UUID)
- DATA-004.R3.b: `name`
- DATA-004.R3.c: `instrumental` (bool, derived; true only if all tracks are instrumental; missing flags count as false)
- DATA-004.R3.d: `rating` (optional)
- DATA-004.R3.e: `total_duration_ms` (derived, sum of effective track durations)
- DATA-004.R3.f: `slot_count` (number of slots in the tanda)
- DATA-004.R3.g: `invalid` (bool)
- DATA-004.R3.h: `updated_at`

### Tanda Style

Fields:
- DATA-004.R4.a: `tanda_id` (FK)
- DATA-004.R4.b: `style_name` (string)

### Tanda Track

Fields:
- DATA-004.R5.a: `tanda_id` (FK)
- DATA-004.R5.b: `track_id` (FK)
- DATA-004.R5.c: `position` (0-based)

### Playlist

Fields:
- DATA-004.R6.a: `id` (UUID)
- DATA-004.R6.b: `name`
- DATA-004.R6.c: `invalid` (bool)
- DATA-004.R6.d: `updated_at`

### Playlist Item

Fields:
- DATA-004.R7.a: `playlist_id` (FK)
- DATA-004.R7.b: `tanda_id` (FK)

## DATA-005 — Scanning and Integrity Rules

- DATA-005.R1: Track identity is `root_id + relative_path + file_hash`.
- DATA-005.R2: `file_hash` is computed when a file changes and stored.
- DATA-005.R3: `artist_summary` is normalized for display in tanda summaries while
  preserving the source artist name's Unicode accents and diacritics.
- DATA-005.R3.a: Stored-metadata refresh compares the regenerated summary with the
  persisted `artist_summary` value so normalization-rule changes repair existing rows.
- DATA-005.R3.b: Display-facing tanda aggregation derives its artist label from the
  full source `artist` value before falling back to `artist_summary`, preventing a
  stale or historically lossy normalized field from degrading Unicode spelling.
- DATA-005.R3.c: When a saved tanda name is accent-insensitively identical to its
  single summarized artist, display summaries use the artist's current accented
  spelling without changing descriptive or multi-artist tanda names.
- DATA-005.R4: `genre` is normalized on scan to prevent case-duplicate styles.
- DATA-005.R5: Artist normalization is based on legacy `similar.js` noise removal and
  abbreviation expansion to yield a consistent primary artist string.
- DATA-005.R6: Missing or unavailable roots are surfaced to the UI as root-level
  availability problems during startup and scan/use-time checks.
- DATA-005.R7: Deleting a track in the filesystem does not delete historical usage records.
- DATA-005.R8: Resume logic uses `file_size` and `file_mtime_ms` to skip unchanged files.
- DATA-005.R9: Missing tracks are removed from the database, and dependent tandas/playlists
  are marked invalid.
- DATA-005.R10: Tag-derived styles are only persisted if they match a defined system style;
  otherwise `genre` remains empty.
- DATA-005.R11: If singer metadata is missing, infer singer from artist strings that
  include markers such as "canta", "con", "with", `feat.`, `ft.`, or
  `featuring`.
- DATA-005.R11.a: As a fallback, explicit guest-credit markers in titles may be
  used to infer singer values when the artist field does not carry the credit.
- DATA-005.R12: `tracks.deleted_at` is a persistent logical-deletion timestamp.
  Active-library queries exclude tombstoned tracks, normal rescans preserve the
  tombstone while the source file remains, and dependent tandas/playlists are
  marked invalid at deletion time.

## DATA-006 — Local UI State

- DATA-006.R1: The current playlist is stored in local UI storage for fast recovery.
- DATA-006.R2: Playlist slots persist as references to track IDs or tanda IDs, plus mismatch flags.
- DATA-006.R3: The single unnamed playlist auto-restores on app launch.
- DATA-006.R4: Some renderer-local preferences still use browser `localStorage`;
  this is current implementation, not the desired long-term persistence endpoint
  for all non-trivial settings.

## DATA-007 — Migrations

- DATA-007.R1: Database-wide structural migrations use SQLite `user_version` and
  run automatically and transactionally during database initialization.
- DATA-007.R2: Search schema version 3 creates and populates token/prefix FTS5
  indexes, normalized boundary-aware bigram/trigram tables for tracks and tanda
  names, a denormalized tanda FTS5 index, and supporting relational indexes.
  Existing tracks and tandas are indexed on the first start after upgrade.
- DATA-007.R3: Database triggers maintain track and tanda search documents after
  inserts, metadata updates, relationship/style changes and deletions, so scan,
  import and editor write paths cannot leave the indexes stale.
- DATA-007.R4: Search-index migration failure must roll back without preventing
  application startup. Search then uses the compatible full-library path and
  the migration is retried on a later start.
- DATA-007.R5: Older additive columns still use the established idempotent
  `alter table` compatibility statements in `app/src/main/db.ts`; new structural
  migrations must use the versioned transaction mechanism.

## DATA-008 — Legacy Import

- DATA-008.R1: The app must support importing legacy Tanda Player USB data files.
- DATA-008.R2: Import reconstructs tandas and playlists and reuses any compatible track data.
- DATA-008.R3: File references are matched against the new library roots by
  normalized relative path, with tolerant handling for slash/case/Unicode
  differences and unique suffix matches when needed.
- DATA-008.R4: Unmatched items are surfaced as missing and can be resolved by the user.

## DATA-009 — Search Projection

- DATA-009.R1: `track_search_fts` indexes normalized title, artist, singer,
  notes and supporting metadata with Unicode tokenization, diacritic removal and
  two-to-four-character prefixes.
- DATA-009.R2: `track_search_ngrams` stores deduplicated N=2 and N=3 grams after
  search normalization and per-token padding. Bigrams use one boundary marker
  and trigrams use two markers at each end; trigram coverage has twice the
  candidate weight of bigram coverage.
- DATA-009.R3: `tanda_search_fts` denormalizes tanda name, styles and current
  child-track metadata for indexed candidate selection without loading every
  tanda detail.
- DATA-009.R4: Indexed search is two-stage: SQLite retrieves candidates and the
  existing field-aware scorer applies final thresholds and ordering. Broad
  exact-token result sets remain complete; fuzzy expansion is bounded.
- DATA-009.R5: A minimum normalized coverage gate and bounded candidate count
  protect performance and reject incidental common bigrams. Mixed boundary
  n-grams preserve recall when a substitution destroys most ordinary trigrams,
  such as `anibel` versus `Aníbal`, without a full-library scan.
- DATA-009.R6: N-gram storage is a recall index, not a result set. Candidate
  evidence below `0.75` is discarded before detailed scoring; final lookup
  quality gates independently prevent incidental short metadata fragments from
  producing large displayed result sets.
- DATA-009.R7: N-gram rows retain their normalized source token. Candidate
  evidence groups by track/tanda and source token, never across a concatenated
  metadata document, and applies a source/query token-length coverage gate.
  Multi-token queries evaluate fuzzy candidates once per query token; duplicate
  qualifying source tokens collapse to the best evidence per result.
