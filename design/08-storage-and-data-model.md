# Storage and Data Model

## Storage Stack

- Local-only storage, no network dependency.
- Primary store: SQLite database in the app data directory.
- Large blobs (waveforms, cached previews) stored as files referenced by DB.

## App Data Locations

- macOS: `~/Library/Application Support/Tanda Player 2/`
- Windows: `%APPDATA%\\Tanda Player 2\\`
- Linux: `~/.config/Tanda Player 2/`

## Database Files

- `tanda-player.db` (primary SQLite)
- `tanda-player.db-wal` / `tanda-player.db-shm`

## Identity Model

### Library Root

Represents a scan scope. A root can be a USB volume or local folder.

Fields:
- `id` (UUID)
- `kind` (`music` | `cortina`)
- `path` (absolute path)
- `label` (user-friendly name)
- `created_at` (timestamp)
- `last_scan_started_at`
- `last_scan_completed_at`
- `last_scan_error`

### Track

Tracks are immutable and identified by stable IDs.

Fields:
- `id` (UUID)
- `root_id` (FK to library_root)
- `relative_path` (path within the root)
- `full_path` (absolute path)
- `file_size` (bytes)
- `file_mtime_ms` (last modified time, ms)
- `file_hash` (content hash; stable across moves)
- `title`, `artist`, `album`, `album_artist`, `year`, `genre`
- `duration_ms` (from analysis)
- `start_offset_ms`
- `end_trim_ms`
- `loudness_db`
- `gain_db`
- `tag_error`
- `analysis_error`
- `tag_json`
- `analysis_json`
- `last_scanned_at`
- `created_at`, `updated_at`

### Tanda

Fields:
- `id` (UUID)
- `name`
- `instrumental` (bool, derived; true only if all tracks are instrumental; missing flags count as false)
- `rating` (optional)
- `total_duration_ms` (derived, sum of effective track durations)
- `slot_count` (number of slots in the tanda)
- `invalid` (bool)
- `updated_at`

### Tanda Style

Fields:
- `tanda_id` (FK)
- `style_name` (string)

### Tanda Track

Fields:
- `tanda_id` (FK)
- `track_id` (FK)
- `position` (0-based)

### Playlist

Fields:
- `id` (UUID)
- `name`
- `invalid` (bool)
- `updated_at`

### Playlist Item

Fields:
- `playlist_id` (FK)
- `tanda_id` (FK)

## Scanning and Integrity Rules

- Track identity is `root_id + relative_path + file_hash`.
- `file_hash` is computed when a file changes and stored.
- Missing roots set `last_seen_at` and mark tracks as unavailable.
- Deleting a track in the filesystem does not delete historical usage records.
- Resume logic uses `file_size` and `file_mtime_ms` to skip unchanged files.
- Missing tracks are removed from the database, and dependent tandas/playlists
  are marked invalid.

## Migrations

- No versioned migration system yet.
- Schema changes are applied with best-effort `alter table` statements in
  `app/src/main/db.ts`.

## Legacy Import

- The app must support importing legacy Tanda Player USB data files.
- Import reconstructs tandas and playlists and reuses any compatible track data.
- File references are matched against the new library roots by relative path
  and content hash where available.
- Unmatched items are surfaced as missing and can be resolved by the user.
