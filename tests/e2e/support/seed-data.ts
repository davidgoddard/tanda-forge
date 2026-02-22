import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export type SeedKind = "empty" | "full";

type SeedContext = {
  dataRoot: string;
  musicRoot: string;
  cortinaRoot: string;
  backgroundRoot: string;
};

const nowIso = () => new Date().toISOString();

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeFile = (filePath: string) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, "");
};

const createSchema = (db: Database.Database) => {
  db.exec(`
    create table if not exists library_roots (
      id text primary key,
      kind text not null,
      path text not null unique,
      label text not null,
      created_at text not null,
      last_scan_started_at text,
      last_scan_completed_at text,
      last_scan_error text
    );
    create table if not exists tracks (
      id text primary key,
      root_id text not null,
      relative_path text not null,
      full_path text not null,
      file_hash text not null,
      file_size integer,
      file_mtime_ms integer,
      title text,
      artist text,
      artist_summary text,
      album text,
      album_artist text,
      singer text,
      year text,
      genre text,
      bpm real,
      notes text,
      instrumental integer,
      duration_ms integer,
      start_offset_ms integer,
      end_trim_ms integer,
      loudness_db real,
      gain_db real,
      tag_error text,
      analysis_error text,
      tag_json text,
      analysis_json text,
      created_at text not null,
      updated_at text not null,
      last_scanned_at text,
      unique (root_id, relative_path)
    );
    create table if not exists styles (
      name text primary key,
      normalized text not null unique
    );
    create table if not exists tandas (
      id text primary key,
      name text not null,
      rating integer default 0,
      instrumental integer default 0,
      total_duration_ms integer default 0,
      slot_count integer default 0,
      invalid integer default 0,
      updated_at text not null
    );
    create table if not exists tanda_tracks (
      tanda_id text not null,
      track_id text not null,
      position integer not null
    );
    create table if not exists tanda_styles (
      tanda_id text not null,
      style_name text not null
    );
    create table if not exists playlists (
      id text primary key,
      name text not null,
      invalid integer default 0,
      updated_at text not null
    );
    create table if not exists playlist_items (
      playlist_id text not null,
      tanda_id text not null
    );
  `);
};

const insertRoots = (db: Database.Database, ctx: SeedContext) => {
  const createdAt = nowIso();
  const insertRoot = db.prepare(`
    insert into library_roots (id, kind, path, label, created_at)
    values (@id, @kind, @path, @label, @created_at)
  `);
  insertRoot.run({
    id: "root-music",
    kind: "music",
    path: ctx.musicRoot,
    label: "music",
    created_at: createdAt,
  });
  insertRoot.run({
    id: "root-cortina",
    kind: "cortina",
    path: ctx.cortinaRoot,
    label: "cortinas",
    created_at: createdAt,
  });
  insertRoot.run({
    id: "root-background",
    kind: "background",
    path: ctx.backgroundRoot,
    label: "backgrounds",
    created_at: createdAt,
  });
};

const insertStyles = (db: Database.Database) => {
  const stmt = db.prepare("insert into styles (name, normalized) values (?, ?)");
  stmt.run("Tango", "tango");
  stmt.run("Milonga", "milonga");
  stmt.run("Waltz", "waltz");
};

type SeedTrack = {
  id: string;
  rootId: string;
  relativePath: string;
  title: string;
  artist: string;
  album: string;
  singer?: string;
  year: string;
  genre: string;
  bpm: number;
  notes?: string;
  instrumental?: 0 | 1;
  durationMs?: number;
};

const insertTracks = (db: Database.Database, ctx: SeedContext) => {
  const createdAt = nowIso();
  const stmt = db.prepare(`
    insert into tracks (
      id, root_id, relative_path, full_path, file_hash, file_size, file_mtime_ms,
      title, artist, artist_summary, album, album_artist, singer, year, genre, bpm,
      notes, instrumental, duration_ms, start_offset_ms, end_trim_ms, loudness_db,
      gain_db, tag_error, analysis_error, tag_json, analysis_json, created_at, updated_at, last_scanned_at
    ) values (
      @id, @root_id, @relative_path, @full_path, @file_hash, @file_size, @file_mtime_ms,
      @title, @artist, @artist_summary, @album, @album_artist, @singer, @year, @genre, @bpm,
      @notes, @instrumental, @duration_ms, @start_offset_ms, @end_trim_ms, @loudness_db,
      @gain_db, '', '', '{}', '{}', @created_at, @updated_at, @last_scanned_at
    )
  `);

  const tracks: SeedTrack[] = [
    {
      id: "t1",
      rootId: "root-music",
      relativePath: "tango/alberto-uno.mp3",
      title: "Alberto Gomez Tango Uno",
      artist: "Alberto Gomez",
      album: "Tango Seeds",
      year: "1938",
      genre: "Tango",
      bpm: 66,
      notes: "seed tango one",
      instrumental: 1,
    },
    {
      id: "t2",
      rootId: "root-music",
      relativePath: "tango/alberto-dos.mp3",
      title: "Alberto Gomez Tango Dos",
      artist: "Alberto Gomez",
      album: "Tango Seeds",
      year: "1939",
      genre: "Tango",
      bpm: 67,
      notes: "seed tango two",
      instrumental: 1,
    },
    {
      id: "t3",
      rootId: "root-music",
      relativePath: "milonga/milonga-prueba.mp3",
      title: "Milonga de Prueba",
      artist: "Carlos Di Sarli",
      album: "Milonga Seeds",
      year: "1940",
      genre: "Milonga",
      bpm: 72,
      notes: "seed milonga",
      instrumental: 0,
    },
    {
      id: "t4",
      rootId: "root-music",
      relativePath: "waltz/vals-prueba.mp3",
      title: "Vals de Prueba",
      artist: "Rodolfo Biagi",
      album: "Waltz Seeds",
      year: "1941",
      genre: "Waltz",
      bpm: 60,
      notes: "seed waltz",
      instrumental: 0,
    },
    {
      id: "t5",
      rootId: "root-music",
      relativePath: "tango/darienzo-busqueda.mp3",
      title: "Busqueda Artistica",
      artist: "Juan D'Arienzo",
      album: "Search Cases",
      year: "1941",
      genre: "Tango",
      bpm: 64,
      notes: "search similar",
      instrumental: 0,
    },
    {
      id: "t6",
      rootId: "root-music",
      relativePath: "milonga/milonga-rapida.mp3",
      title: "Milonga Rapida",
      artist: "Francisco Canaro",
      album: "Milonga Seeds",
      year: "1942",
      genre: "Milonga",
      bpm: 74,
      notes: "fast milonga",
      instrumental: 1,
    },
    {
      id: "t7",
      rootId: "root-music",
      relativePath: "milonga/milonga-lenta.mp3",
      title: "Milonga Lenta",
      artist: "Francisco Canaro",
      album: "Milonga Seeds",
      year: "1943",
      genre: "Milonga",
      bpm: 70,
      notes: "slow milonga",
      instrumental: 0,
    },
    {
      id: "t8",
      rootId: "root-music",
      relativePath: "waltz/waltz-needle.mp3",
      title: "Needle Waltz",
      artist: "Osvaldo Pugliese",
      album: "Waltz Seeds",
      year: "1943",
      genre: "Waltz",
      bpm: 62,
      notes: "needle waltz",
      instrumental: 1,
    },
    {
      id: "t9",
      rootId: "root-music",
      relativePath: "waltz/waltz-night.mp3",
      title: "Night Waltz",
      artist: "Osvaldo Pugliese",
      album: "Waltz Seeds",
      year: "1944",
      genre: "Waltz",
      bpm: 63,
      notes: "night waltz",
      instrumental: 0,
    },
    {
      id: "t10",
      rootId: "root-music",
      relativePath: "tango/notes-case.mp3",
      title: "Find Me By Notes",
      artist: "Anibal Troilo",
      album: "Search Cases",
      year: "1942",
      genre: "Tango",
      bpm: 65,
      notes: "rare violin phrase",
      instrumental: 0,
    },
    {
      id: "t11",
      rootId: "root-music",
      relativePath: "tango/year-case.mp3",
      title: "Year 1943 Test",
      artist: "Anibal Troilo",
      album: "Search Cases",
      year: "1943",
      genre: "Tango",
      bpm: 65,
      notes: "year specific",
      instrumental: 1,
    },
    {
      id: "t12",
      rootId: "root-music",
      relativePath: "tango/tempo-case.mp3",
      title: "Tempo 72 Test",
      artist: "Ricardo Tanturi",
      album: "Search Cases",
      year: "1942",
      genre: "Tango",
      bpm: 72,
      notes: "tempo specific",
      instrumental: 0,
    },
    {
      id: "c1",
      rootId: "root-cortina",
      relativePath: "default/cortina-only.mp3",
      title: "CORTINA ONLY TRACK",
      artist: "Cortina Artist",
      album: "Cortina Set",
      year: "1950",
      genre: "Cortina",
      bpm: 120,
      notes: "cortina only",
      instrumental: 1,
      durationMs: 25000,
    },
  ];

  for (const track of tracks) {
    const baseRoot = track.rootId === "root-cortina" ? ctx.cortinaRoot : ctx.musicRoot;
    const fullPath = path.join(baseRoot, track.relativePath);
    writeFile(fullPath);
    const stat = fs.statSync(fullPath);
    stmt.run({
      id: track.id,
      root_id: track.rootId,
      relative_path: track.relativePath,
      full_path: fullPath,
      file_hash: `hash-${track.id}`,
      file_size: stat.size,
      file_mtime_ms: stat.mtimeMs,
      title: track.title,
      artist: track.artist,
      artist_summary: track.artist,
      album: track.album,
      album_artist: track.artist,
      singer: track.singer ?? "",
      year: track.year,
      genre: track.genre,
      bpm: track.bpm,
      notes: track.notes ?? "",
      instrumental: track.instrumental ?? 0,
      duration_ms: track.durationMs ?? 180000,
      start_offset_ms: 0,
      end_trim_ms: 0,
      loudness_db: -14.5,
      gain_db: -1.5,
      created_at: createdAt,
      updated_at: createdAt,
      last_scanned_at: createdAt,
    });
  }
};

const insertTandas = (db: Database.Database) => {
  const updatedAt = nowIso();
  const insertTanda = db.prepare(`
    insert into tandas (
      id, name, rating, instrumental, total_duration_ms, slot_count, invalid, updated_at
    ) values (?, ?, ?, ?, ?, ?, 0, ?)
  `);
  const insertTrack = db.prepare(
    "insert into tanda_tracks (tanda_id, track_id, position) values (?, ?, ?)",
  );
  const insertStyle = db.prepare(
    "insert into tanda_styles (tanda_id, style_name) values (?, ?)",
  );

  const tandas = [
    { id: "td1", name: "Tango Trio", rating: 4, instrumental: 0, tracks: ["t1", "t2", "t5"], style: "Tango" },
    { id: "td2", name: "Milonga Trio", rating: 3, instrumental: 0, tracks: ["t3", "t6", "t7"], style: "Milonga" },
    { id: "td3", name: "Waltz Trio", rating: 5, instrumental: 0, tracks: ["t4", "t8", "t9"], style: "Waltz" },
    { id: "td4", name: "Tango Four", rating: 2, instrumental: 0, tracks: ["t10", "t11", "t1", "t2"], style: "Tango" },
  ] as const;

  tandas.forEach((tanda) => {
    insertTanda.run(
      tanda.id,
      tanda.name,
      tanda.rating,
      tanda.instrumental,
      tanda.tracks.length * 180000,
      tanda.tracks.length,
      updatedAt,
    );
    tanda.tracks.forEach((trackId, index) => {
      insertTrack.run(tanda.id, trackId, index);
    });
    insertStyle.run(tanda.id, tanda.style);
  });
};

export const seedDataRoot = (dataRoot: string, kind: SeedKind) => {
  ensureDir(dataRoot);
  const ctx: SeedContext = {
    dataRoot,
    musicRoot: path.join(dataRoot, "music"),
    cortinaRoot: path.join(dataRoot, "cortinas"),
    backgroundRoot: path.join(dataRoot, "backgrounds"),
  };
  ensureDir(ctx.musicRoot);
  ensureDir(ctx.cortinaRoot);
  ensureDir(ctx.backgroundRoot);

  const dbPath = path.join(dataRoot, "tanda-player.db");
  const db = new Database(dbPath);
  createSchema(db);

  if (kind === "full") {
    insertRoots(db, ctx);
    insertStyles(db);
    insertTracks(db, ctx);
    insertTandas(db);
  }
  db.close();
  return ctx;
};
