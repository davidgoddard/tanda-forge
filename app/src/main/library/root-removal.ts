import type Database from "better-sqlite3";

export type RootRemovalPreview = {
  rootId: string;
  kind: "music" | "cortina" | "background";
  path: string;
  label: string;
  trackCount: number;
  tandaCount: number;
  playlistCount: number;
};

export type RootRemovalResult = RootRemovalPreview & {
  removed: boolean;
};

const loadRootPreview = (
  db: Database.Database,
  rootId: string,
): RootRemovalPreview | null => {
  const root = db
    .prepare("select id, kind, path, label from library_roots where id = ?")
    .get(rootId) as
    | { id: string; kind: "music" | "cortina" | "background"; path: string; label: string }
    | undefined;
  if (!root) {
    return null;
  }
  const trackCount =
    ((db.prepare("select count(*) as count from tracks where root_id = ?").get(rootId) as
      | { count: number }
      | undefined)?.count ?? 0);
  const tandaCount =
    ((db
      .prepare(
        `select count(distinct tt.tanda_id) as count
         from tanda_tracks tt
         join tracks t on t.id = tt.track_id
         where t.root_id = ?`,
      )
      .get(rootId) as { count: number } | undefined)?.count ?? 0);
  const playlistCount =
    ((db
      .prepare(
        `select count(distinct pi.playlist_id) as count
         from playlist_items pi
         join tanda_tracks tt on tt.tanda_id = pi.tanda_id
         join tracks t on t.id = tt.track_id
         where t.root_id = ?`,
      )
      .get(rootId) as { count: number } | undefined)?.count ?? 0);
  return {
    rootId: root.id,
    kind: root.kind,
    path: root.path,
    label: root.label,
    trackCount,
    tandaCount,
    playlistCount,
  };
};

export const getRootRemovalPreview = (
  db: Database.Database,
  rootId: string,
) => loadRootPreview(db, rootId);

export const removeLibraryRoot = (
  db: Database.Database,
  rootId: string,
): RootRemovalResult | null => {
  const preview = loadRootPreview(db, rootId);
  if (!preview) {
    return null;
  }

  const run = db.transaction(() => {
    db.prepare("delete from tracks where root_id = ?").run(rootId);

    const invalidTandaIds = (
      db
        .prepare(
          `select distinct tanda_id as id
           from tanda_tracks
           where track_id not in (select id from tracks)`,
        )
        .all() as Array<{ id: string }>
    ).map((row) => row.id);

    if (invalidTandaIds.length > 0) {
      const placeholders = invalidTandaIds.map(() => "?").join(", ");
      db.prepare(`update tandas set invalid = 1 where id in (${placeholders})`).run(
        ...invalidTandaIds,
      );
      db.prepare(
        `update playlists set invalid = 1
         where id in (
           select playlist_id from playlist_items
           where tanda_id in (${placeholders})
         )`,
      ).run(...invalidTandaIds);
    }

    db.prepare("delete from library_roots where id = ?").run(rootId);
  });

  run();
  return {
    ...preview,
    removed: true,
  };
};
