import Database from "better-sqlite3";
import { getDataRoot } from "./data-location";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;
let dbPath: string | null = null;

const createSchema = (database: Database.Database) => {
  database.exec(`
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
    create table if not exists style_aliases (
      style_name text not null,
      alias text not null,
      alias_normalized text not null unique
    );

    create index if not exists idx_tracks_root on tracks (root_id);
    create index if not exists idx_style_aliases_style_name on style_aliases (style_name);

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

    create table if not exists app_state (
      key text primary key,
      value text not null,
      updated_at text not null
    );

    create index if not exists idx_tanda_tracks_tanda on tanda_tracks (tanda_id);
    create index if not exists idx_tanda_tracks_track on tanda_tracks (track_id);
    create index if not exists idx_tanda_styles_tanda on tanda_styles (tanda_id);
    create index if not exists idx_playlist_items_playlist on playlist_items (playlist_id);
  `);
};

export const initDb = () => {
  if (db) {
    return db;
  }

  dbPath = path.join(getDataRoot(), "tanda-player.db");
  db = new Database(dbPath);
  createSchema(db);
  try {
    db.exec("alter table library_roots add column last_scan_started_at text");
  } catch {}
  try {
    db.exec("alter table library_roots add column last_scan_completed_at text");
  } catch {}
  try {
    db.exec("alter table library_roots add column last_scan_error text");
  } catch {}
  try {
    db.exec("alter table tracks add column file_size integer");
  } catch {}
  try {
    db.exec("alter table tracks add column file_mtime_ms integer");
  } catch {}
  try {
    db.exec("alter table tracks add column artist_summary text");
  } catch {}
  try {
    db.exec("alter table tracks add column singer text");
  } catch {}
  try {
    db.exec("alter table tracks add column bpm real");
  } catch {}
  try {
    db.exec("alter table tracks add column notes text");
  } catch {}
  try {
    db.exec("alter table tracks add column instrumental integer");
  } catch {}
  try {
    db.exec(
      "create table if not exists styles (name text primary key, normalized text not null unique)",
    );
  } catch {}
  try {
    db.exec(
      "create table if not exists style_aliases (style_name text not null, alias text not null, alias_normalized text not null unique)",
    );
  } catch {}
  try {
    db.exec("alter table tracks add column loudness_db real");
  } catch {}
  try {
    db.exec("alter table tracks add column gain_db real");
  } catch {}
  try {
    db.exec("alter table tracks add column tag_error text");
  } catch {}
  try {
    db.exec("alter table tracks add column analysis_error text");
  } catch {}
  try {
    db.exec("alter table tracks add column last_scanned_at text");
  } catch {}
  try {
    db.exec("alter table tandas add column rating integer");
  } catch {}
  try {
    db.exec("alter table tandas add column instrumental integer");
  } catch {}
  try {
    db.exec("alter table tandas add column total_duration_ms integer");
  } catch {}
  try {
    db.exec("alter table tandas add column slot_count integer");
  } catch {}
  try {
    db.exec("alter table tanda_tracks add column position integer");
  } catch {}
  try {
    db.exec(
      "create table if not exists tanda_styles (tanda_id text not null, style_name text not null)",
    );
  } catch {}
  try {
    db.exec(
      "create table if not exists app_state (key text primary key, value text not null, updated_at text not null)",
    );
  } catch {}
  try {
    db.exec("create index if not exists idx_tanda_tracks_tanda on tanda_tracks (tanda_id)");
  } catch {}
  try {
    db.exec("create index if not exists idx_tanda_tracks_track on tanda_tracks (track_id)");
  } catch {}
  try {
    db.exec("create index if not exists idx_tanda_styles_tanda on tanda_styles (tanda_id)");
  } catch {}
  try {
    db.exec("create index if not exists idx_playlist_items_playlist on playlist_items (playlist_id)");
  } catch {}
  try {
    db.exec("create index if not exists idx_style_aliases_style_name on style_aliases (style_name)");
  } catch {}
  return db;
};

export const reopenDb = () => {
  if (db) {
    db.close();
    db = null;
  }
  return initDb();
};

export const closeDb = () => {
  if (db) {
    db.close();
    db = null;
  }
};

export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
};

export const resetDb = () => {
  closeDb();
  if (dbPath) {
    try {
      fs.unlinkSync(dbPath);
    } catch {}
    try {
      fs.unlinkSync(`${dbPath}-wal`);
    } catch {}
    try {
      fs.unlinkSync(`${dbPath}-shm`);
    } catch {}
  }
  return initDb();
};
