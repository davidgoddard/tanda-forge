import fs from "fs";
import type Database from "better-sqlite3";

export type DeleteTrackResult = {
  ok: boolean;
  fileRemoved: boolean;
  fileRemovalError?: string;
};

export type DeletedTrackRow = {
  id: string;
  title: string;
  artist: string;
  deleted_at: string;
};

export const listDeletedTracks = (db: Database.Database): DeletedTrackRow[] =>
  db.prepare(
    `select id, coalesce(title, '') as title, coalesce(artist, '') as artist, deleted_at
     from tracks
     where deleted_at is not null
     order by lower(coalesce(artist, '')), lower(coalesce(title, '')), id`,
  ).all() as DeletedTrackRow[];

export const restoreDeletedTracks = (db: Database.Database, trackIds: string[]) => {
  const ids = [...new Set(trackIds.filter((id) => typeof id === "string" && id.trim()))];
  if (ids.length === 0) return { restored: 0 };
  const placeholders = ids.map(() => "?").join(", ");
  const now = new Date().toISOString();
  let restored = 0;
  db.transaction(() => {
    const result = db.prepare(
      `update tracks set deleted_at = null, updated_at = ?
       where deleted_at is not null and id in (${placeholders})`,
    ).run(now, ...ids);
    restored = result.changes;
    db.prepare(
      `update tandas set invalid = 0, updated_at = ?
       where id in (select tanda_id from tanda_tracks where track_id in (${placeholders}))
         and not exists (
           select 1 from tanda_tracks tt
           left join tracks t on t.id = tt.track_id
           where tt.tanda_id = tandas.id and (t.id is null or t.deleted_at is not null)
         )`,
    ).run(now, ...ids);
    db.prepare(
      `update playlists set invalid = 0, updated_at = ?
       where id in (
         select pi.playlist_id from playlist_items pi
         join tanda_tracks tt on tt.tanda_id = pi.tanda_id
         where tt.track_id in (${placeholders})
       )
       and not exists (
         select 1 from playlist_items invalid_pi
         left join tandas invalid_t on invalid_t.id = invalid_pi.tanda_id
         where invalid_pi.playlist_id = playlists.id
           and (invalid_t.id is null or coalesce(invalid_t.invalid, 0) != 0)
       )`,
    ).run(now, ...ids);
  })();
  return { restored };
};

export const logicallyDeleteTrack = async (
  db: Database.Database,
  trackId: string,
  removeFile: boolean,
): Promise<DeleteTrackResult> => {
  const track = db
    .prepare("select full_path from tracks where id = ? and deleted_at is null")
    .get(trackId) as { full_path: string } | undefined;
  if (!track) return { ok: false, fileRemoved: false };

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare("update tracks set deleted_at = ?, updated_at = ? where id = ?").run(now, now, trackId);
    db.prepare(
      `update tandas set invalid = 1, updated_at = ?
       where id in (select tanda_id from tanda_tracks where track_id = ?)`,
    ).run(now, trackId);
    db.prepare(
      `update playlists set invalid = 1, updated_at = ?
       where id in (
         select pi.playlist_id from playlist_items pi
         join tanda_tracks tt on tt.tanda_id = pi.tanda_id
         where tt.track_id = ?
       )`,
    ).run(now, trackId);
  })();

  if (!removeFile) return { ok: true, fileRemoved: false };
  try {
    await fs.promises.unlink(track.full_path);
    return { ok: true, fileRemoved: true };
  } catch (error) {
    return {
      ok: true,
      fileRemoved: false,
      fileRemovalError: error instanceof Error ? error.message : "File removal failed",
    };
  }
};
