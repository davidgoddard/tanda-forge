import type Database from "better-sqlite3";

export const listUnstyledTrackIds = (db: Database.Database): string[] =>
  (db.prepare(
    `select t.id
     from tracks t
     join library_roots r on r.id = t.root_id
     where r.kind = 'music'
       and t.deleted_at is null
       and coalesce(trim(t.genre), '') in ('', '?')
       and not exists (select 1 from hidden_tracks h where h.track_id = t.id)
     order by coalesce(t.artist, ''), coalesce(t.title, ''), t.id`,
  ).all() as Array<{ id: string }>).map((row) => row.id);
