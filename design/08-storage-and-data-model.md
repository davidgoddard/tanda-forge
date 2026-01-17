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
- `kind` (`usb` | `folder`)
- `path` (absolute path)
- `label` (user-friendly name)
- `last_seen_at` (timestamp)

### Track

Tracks are immutable and identified by stable IDs.

Fields:
- `id` (UUID)
- `root_id` (FK to library_root)
- `relative_path` (path within the root)
- `file_hash` (content hash; stable across moves)
- `duration_ms` (from analysis)
- `start_offset_ms`
- `end_trim_ms`
- `loudness_db`
- `created_at`, `updated_at`

### Metadata

Parsed and user-supplied metadata is stored separately to avoid re-parsing.

Fields:
- `track_id` (FK)
- `title`, `artist`, `album`, `year`, `genre`
- `album_artist` (optional)
- `date` (original release date, optional)
- `grouping` (optional)
- `comment` (optional)
- `composer` (optional)
- `bpm`, `key`
- `notes` (free text)

### Tanda

Fields:
- `id` (UUID)
- `name`
- `style_id` (FK to style)
- `instrumental` (bool)
- `rating` (optional)
- `notes`
- `created_at`, `updated_at`

### Tanda Track

Fields:
- `tanda_id` (FK)
- `track_id` (FK)
- `position` (1-based)

### Playlist

Fields:
- `id` (UUID)
- `name`
- `structure` (symbolic pattern, e.g. `3T-3T-3W-3M`)
- `is_rule_based` (bool)
- `auto_play` (bool)
- `track_spacing_s`
- `pre_cortina_spacing_s`
- `post_cortina_spacing_s`
- `auto_dj_cortina_duration_s`
- `start_time_s` (seconds from midnight)
- `end_time_s` (seconds from midnight)
- `created_at`, `updated_at`

### Playlist Item

Fields:
- `playlist_id` (FK)
- `tanda_id` (FK)
- `position` (1-based)
- `cortina_id` (nullable)

### Cortina

Fields:
- `id` (UUID)
- `track_id` (FK)
- `group_name` (folder label)

### Style

Fields:
- `id` (UUID)
- `name` (e.g. Tango, Vals, Milonga)

## Scanning and Integrity Rules

- Track identity is `root_id + relative_path + file_hash`.
- `file_hash` is computed once per file and stored.
- Missing roots set `last_seen_at` and mark tracks as unavailable.
- Deleting a track in the filesystem does not delete historical usage records.

## Migrations

- SQLite migrations are versioned and stored in `app/resources/migrations/`.
- On startup, the main process applies pending migrations.

## Legacy Import

- The app must support importing legacy Tanda Player USB data files.
- Import reconstructs tandas and playlists and reuses any compatible track data.
- File references are matched against the new library roots by relative path
  and content hash where available.
- Unmatched items are surfaced as missing and can be resolved by the user.
