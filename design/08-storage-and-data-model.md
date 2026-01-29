# Storage and Data Model

Requirement identifiers: All requirement bullets in this document are
identified as `DATA-<section>.R<n>` in order under each section. Sub-bullets use
`.<letter>` suffixes.

## DATA-001 — Storage Stack

- DATA-001.R1: Local-only storage, no network dependency.
- DATA-001.R2: Primary store: SQLite database in the app data directory.
- DATA-001.R3: Large blobs (waveforms, cached previews) stored as files referenced by DB.

## DATA-002 — App Data Locations

- DATA-002.R1: macOS: `~/Library/Application Support/Tanda Player 2/`
- DATA-002.R2: Windows: `%APPDATA%\\Tanda Player 2\\`
- DATA-002.R3: Linux: `~/.config/Tanda Player 2/`

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
- DATA-004.R2.h: `title`, `artist`, `artist_summary`, `album`, `album_artist`, `year`, `genre`
- DATA-004.R2.i: `bpm` (user-derived tempo estimate)
- DATA-004.R2.j: `duration_ms` (from analysis)
- DATA-004.R2.k: `start_offset_ms`
- DATA-004.R2.l: `end_trim_ms`
- DATA-004.R2.m: `loudness_db`
- DATA-004.R2.n: `gain_db`
- DATA-004.R2.o: `tag_error`
- DATA-004.R2.p: `analysis_error`
- DATA-004.R2.q: `tag_json`
- DATA-004.R2.r: `analysis_json`
- DATA-004.R2.s: `last_scanned_at`
- DATA-004.R2.t: `created_at`, `updated_at`

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
- DATA-005.R3: `artist_summary` is normalized for display in tanda summaries.
- DATA-005.R4: `genre` is normalized on scan to prevent case-duplicate styles.
- DATA-005.R5: Artist normalization is based on legacy `similar.js` noise removal and
  abbreviation expansion to yield a consistent primary artist string.
- DATA-005.R6: Missing roots set `last_seen_at` and mark tracks as unavailable.
- DATA-005.R7: Deleting a track in the filesystem does not delete historical usage records.
- DATA-005.R8: Resume logic uses `file_size` and `file_mtime_ms` to skip unchanged files.
- DATA-005.R9: Missing tracks are removed from the database, and dependent tandas/playlists
  are marked invalid.
- DATA-005.R10: Tag-derived styles are only persisted if they match a defined system style;
  otherwise `genre` remains empty.

## DATA-006 — Migrations

- DATA-006.R1: No versioned migration system yet.
- DATA-006.R2: Schema changes are applied with best-effort `alter table` statements in
  `app/src/main/db.ts`.

## DATA-007 — Legacy Import

- DATA-007.R1: The app must support importing legacy Tanda Player USB data files.
- DATA-007.R2: Import reconstructs tandas and playlists and reuses any compatible track data.
- DATA-007.R3: File references are matched against the new library roots by relative path
  and content hash where available.
- DATA-007.R4: Unmatched items are surfaced as missing and can be resolved by the user.
