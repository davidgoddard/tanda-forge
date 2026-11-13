import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureSearchSchema,
  findIndexedTandaCandidateIds,
  findIndexedTrackCandidateIds,
  generateBoundaryNgrams,
  NGRAM_EVIDENCE_FLOOR,
  registerSearchSqlFunctions,
  SEARCH_SCHEMA_VERSION,
} from "../app/src/main/library/search-index";
import { findSearchCandidateIds } from "../app/src/main/library/search";

const openDatabases: Database.Database[] = [];
const nativeSqliteAvailable = (() => {
  try {
    const probe = new Database(":memory:");
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

const createDatabase = () => {
  const db = new Database(":memory:");
  openDatabases.push(db);
  registerSearchSqlFunctions(db);
  db.exec(`
    create table tracks (
      id text primary key, title text, artist text, artist_summary text, singer text,
      notes text, album text, album_artist text, genre text, year text, bpm real,
      deleted_at text, updated_at text
    );
    create table tandas (id text primary key, name text, invalid integer default 0, updated_at text);
    create table tanda_tracks (tanda_id text, track_id text, position integer);
    create table tanda_styles (tanda_id text, style_name text);
  `);
  return db;
};

afterEach(() => {
  openDatabases.splice(0).forEach((db) => db.close());
});

describe.runIf(nativeSqliteAvailable)("versioned search schema", () => {
  it("migrates existing rows automatically and remains idempotent", () => {
    const db = createDatabase();
    db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "calo", "Al compás del corazón", "Miguel Caló", "Miguel Caló", "Raúl Berón",
      "warm transfer", "Golden Years", "", "Tango", "1942", 64,
    );
    db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "troilo", "Toda mi vida", "Aníbal Troilo", "Aníbal Troilo", "Francisco Fiorentino",
      "", "", "", "Tango", "1941", 63,
    );
    db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "cumparsita", "La Cumparsita", "Rodolfo Biagi", "Rodolfo Biagi", "",
      "", "", "", "Tango", "1942", 65,
    );
    db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "ciudadano-variant", "El distinguido ciuidadano (1932)", "Osvaldo Fresedo", "Osvaldo Fresedo", "",
      "", "", "", "Tango", "1933", 62,
    );
    db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "scattered", "Cum pas ita", "Unrelated Orchestra", "", "",
      "", "", "", "Tango", "1942", 65,
    );
    db.prepare("insert into tandas (id, name) values (?, ?)").run("t1", "Calo favourites");
    db.prepare("insert into tanda_tracks values (?, ?, ?)").run("t1", "calo", 0);
    db.prepare("insert into tanda_tracks values (?, ?, ?)").run("t1", "troilo", 1);
    db.prepare("insert into tanda_tracks values (?, ?, ?)").run("t1", "cumparsita", 2);
    db.prepare("insert into tanda_styles values (?, ?)").run("t1", "Tango");

    expect(ensureSearchSchema(db)).toEqual({ migrated: true, version: SEARCH_SCHEMA_VERSION });
    expect(db.pragma("user_version", { simple: true })).toBe(SEARCH_SCHEMA_VERSION);
    expect(findIndexedTrackCandidateIds(db, "Miguel Calo")).toContain("calo");
    expect(findIndexedTrackCandidateIds(db, "compaz corazon")).toContain("calo");
    expect(findIndexedTrackCandidateIds(db, "anibel")).toContain("troilo");
    expect(findIndexedTrackCandidateIds(db, "anbal")).toContain("troilo");
    expect(findIndexedTrackCandidateIds(db, "aniabl")).toContain("troilo");
    expect(findIndexedTrackCandidateIds(db, "cumpasita")).toContain("cumparsita");
    expect(findIndexedTrackCandidateIds(db, "cumpasita")).not.toContain("scattered");
    expect(findIndexedTrackCandidateIds(db, "El distinguido ciudadano"))
      .toContain("ciudadano-variant");
    expect(findIndexedTandaCandidateIds(db, "Raul Beron")).toContain("t1");
    expect(findIndexedTandaCandidateIds(db, "anibel")).toContain("t1");
    expect(findIndexedTandaCandidateIds(db, "Calu")).toContain("t1");
    expect(findIndexedTandaCandidateIds(db, "cumpasita")).toContain("t1");
    expect(findSearchCandidateIds(db, {
      query: "63",
      styles: [],
      minScore: 0.19,
      bpmRange: 5,
    })).toContain("calo");
    const indexes = db.prepare(
      "select name from sqlite_master where type = 'index' and name like 'idx_%'",
    ).pluck().all() as string[];
    expect(indexes).toEqual(expect.arrayContaining([
      "idx_tracks_active_genre",
      "idx_tracks_active_bpm",
      "idx_tandas_valid_updated",
      "idx_tanda_tracks_tanda_position",
    ]));
    expect(ensureSearchSchema(db)).toEqual({ migrated: false, version: SEARCH_SCHEMA_VERSION });
  });

  it("upgrades a version-2 gram index to source-token-local evidence", () => {
    const db = createDatabase();
    db.exec(`
      create table track_search_ngrams (
        track_id text not null, size integer not null, gram text not null,
        primary key (track_id, size, gram)
      ) without rowid;
      create table tanda_name_ngrams (
        tanda_id text not null, size integer not null, gram text not null,
        primary key (tanda_id, size, gram)
      ) without rowid;
      pragma user_version = 2;
    `);
    expect(ensureSearchSchema(db)).toEqual({ migrated: true, version: SEARCH_SCHEMA_VERSION });
    const columns = db.prepare("pragma table_info(track_search_ngrams)").all() as Array<{
      name: string;
    }>;
    expect(columns.map((column) => column.name)).toContain("source_token");
  });

  it("keeps track and tanda documents synchronized through database triggers", () => {
    const db = createDatabase();
    ensureSearchSchema(db);
    db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "track", "Ancient melody", "Carlos Di Sarli", "Carlos Di Sarli", "", "", "", "", "Tango", "1940", 62,
    );
    db.prepare("insert into tandas (id, name) values (?, ?)").run("tanda", "Evening tanda");
    db.prepare("insert into tanda_tracks values (?, ?, ?)").run("tanda", "track", 0);
    expect(findIndexedTrackCandidateIds(db, "Ancient melody")).toContain("track");
    expect(findIndexedTandaCandidateIds(db, "Ancient melody")).toContain("tanda");

    db.prepare("update tracks set title = ? where id = ?").run("Modern rhythm", "track");
    expect(findIndexedTrackCandidateIds(db, "Modern rhythm")).toContain("track");
    expect(findIndexedTrackCandidateIds(db, "Ancient melody")).not.toContain("track");
    expect(findIndexedTandaCandidateIds(db, "Modern rhythm")).toContain("tanda");
    db.prepare("update tandas set name = ? where id = ?").run("Midnight tanda", "tanda");
    expect(findIndexedTandaCandidateIds(db, "Midnigt")).toContain("tanda");

    db.prepare("delete from tanda_tracks where tanda_id = ? and track_id = ?").run("tanda", "track");
    expect(findIndexedTandaCandidateIds(db, "Modern rhythm")).not.toContain("tanda");
  });

  it("indexes repeated metadata tokens during an outer replace upsert", () => {
    const db = createDatabase();
    ensureSearchSchema(db);
    expect(() => db.prepare(`insert or replace into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "repeat", "Tango Tango", "Same Orchestra", "Same Orchestra", "", "", "", "", "Tango", "1940", 62,
    )).not.toThrow();
    expect(findIndexedTrackCandidateIds(db, "Same Orchestra")).toContain("repeat");
  });

  it("bounds fuzzy candidate work as the library grows", () => {
    const db = createDatabase();
    const insert = db.prepare(`insert into tracks
      (id, title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const populate = db.transaction(() => {
      for (let index = 0; index < 7000; index += 1) {
        insert.run(
          `bulk-${index}`, `Catalog entry ${index}`, "Unrelated Orchestra", "Unrelated Orchestra",
          "", "", "", "", "Tango", "1940", 60,
        );
      }
      insert.run(
        "target", "Al compás del corazón", "Miguel Caló", "Miguel Caló",
        "Raúl Berón", "", "", "", "Tango", "1942", 64,
      );
    });
    populate();
    ensureSearchSchema(db);

    const candidates = findIndexedTrackCandidateIds(db, "Miguel Calo") ?? [];
    expect(candidates).toContain("target");
    expect(candidates.length).toBeLessThanOrEqual(1001);
  });

  it("upgrades search schema 1 from trigram FTS to boundary n-grams", () => {
    const db = createDatabase();
    db.exec(`
      create virtual table track_search_trigram using fts5(
        track_id unindexed, search_text, tokenize = 'trigram'
      );
      pragma user_version = 1;
    `);
    expect(ensureSearchSchema(db)).toEqual({ migrated: true, version: SEARCH_SCHEMA_VERSION });
    expect(db.prepare(
      "select count(*) from sqlite_master where name = 'track_search_trigram'",
    ).pluck().get()).toBe(0);
    expect(db.prepare(
      "select count(*) from sqlite_master where name = 'track_search_ngrams'",
    ).pluck().get()).toBe(1);
  });
});

describe("boundary n-gram generation", () => {
  it("normalizes Spanish accents before applying N-1 boundary markers", () => {
    expect(generateBoundaryNgrams("Áníbal", 2)).toEqual([
      "^a", "an", "ni", "ib", "ba", "al", "l$",
    ]);
    expect(generateBoundaryNgrams("Áníbal", 3)).toEqual([
      "^^a", "^an", "ani", "nib", "iba", "bal", "al$", "l$$",
    ]);
    expect(generateBoundaryNgrams("Peña", 2)).toEqual(
      generateBoundaryNgrams("pena", 2),
    );
  });

  it("uses a substantive normalized evidence cutoff", () => {
    expect(NGRAM_EVIDENCE_FLOOR).toBeGreaterThanOrEqual(0.75);
  });
});
