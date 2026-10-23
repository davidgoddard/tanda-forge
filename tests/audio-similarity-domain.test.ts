import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { describe, expect, it } from "vitest";
import {
  approveCandidateSubset,
  buildConfirmedAudioSimilarityLookup,
  confirmAudioSimilarityGroup,
  detachTrackFromConfirmedAudioSimilarityGroup,
  ensureAudioSimilaritySchema,
  getAudioSimilarityIntegrity,
  listConfirmedAudioSimilarityGroups,
  reconsiderAudioSimilarityPair,
  rejectAudioSimilarityPair,
  replicateAudioSimilarityMetadata,
  replaceAudioSimilarityTandaTrack,
  replaceAudioSimilarityTandaReferences,
  setTrackHidden,
  undoAudioSimilarityMetadata,
  withdrawConfirmedAudioSimilarityGroup,
} from "../app/src/main/audio-similarity/store";
import { getAudioSimilarityStatus } from "../app/src/main/audio-similarity/service";
import { AUDIO_SIMILARITY_ALGORITHM_VERSION } from "../app/src/shared/audio-similarity";

const sqlValue = (value: unknown) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

const bindSql = (sql: string, values: unknown[]) => {
  let index = 0;
  return sql.replace(/\?/g, () => sqlValue(values[index++]));
};

type CliDatabase = ReturnType<typeof createDatabase>;

const createDatabase = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-similarity-test-"));
  const file = path.join(directory, "test.db");
  const execute = (sql: string) => execFileSync("sqlite3", ["-json", file, sql], {
    encoding: "utf8",
  }).trim();
  const database = {
    exec: (sql: string) => { execute(sql); },
    prepare: (sql: string) => ({
      all: (...values: unknown[]) => {
        const output = execute(bindSql(sql, values));
        return output ? JSON.parse(output) : [];
      },
      get: (...values: unknown[]) => {
        const output = execute(bindSql(sql, values));
        return output ? JSON.parse(output)[0] : undefined;
      },
      run: (...values: unknown[]) => {
        const output = execute(`${bindSql(sql, values)}; select changes() as changes;`);
        return output ? JSON.parse(output).at(-1) : { changes: 0 };
      },
    }),
    transaction: <T>(operation: () => T) => () => operation(),
    close: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
  database.exec(`
    create table library_roots (id text primary key, kind text not null);
    create table tracks (
      id text primary key, root_id text not null, full_path text not null,
      relative_path text, file_hash text not null, file_size integer,
      file_mtime_ms integer, title text, artist text, artist_summary text,
      singer text, album text, year text, genre text, bpm real, notes text,
      instrumental integer, duration_ms integer, start_offset_ms integer,
      end_trim_ms integer, deleted_at text, updated_at text
    );
    create table tandas (
      id text primary key, name text not null, slot_count integer default 0,
      total_duration_ms integer default 0, invalid integer default 0,
      updated_at text
    );
    create table tanda_tracks (tanda_id text, track_id text, position integer);
    create table playlists (id text primary key, name text, updated_at text);
    create table playlist_items (playlist_id text, tanda_id text);
    insert into library_roots values ('root', 'music');
  `);
  ensureAudioSimilaritySchema(database as never);
  return database;
};

const addTrack = (
  database: CliDatabase,
  id: string,
  overrides: Record<string, unknown> = {},
) => {
  const row = {
    id,
    fullPath: `/music/${id}.flac`,
    fileHash: `hash-${id}`,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    durationMs: 180_000,
    startOffsetMs: 1_000,
    endTrimMs: 2_000,
    ...overrides,
  };
  database.prepare(`insert into tracks
    (id, root_id, full_path, relative_path, file_hash, file_size, file_mtime_ms,
     title, artist, duration_ms, start_offset_ms, end_trim_ms, updated_at)
    values (?, 'root', ?, ?, ?, 100, 200, ?, ?, ?, ?, ?, 'now')`).run(
      row.id, row.fullPath, `${id}.flac`, row.fileHash, row.title, row.artist,
      row.durationMs, row.startOffsetMs, row.endTrimMs,
    );
};

describe("audio similarity persistence", () => {
  it("defines every persistent lifecycle and decision table", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/src/main/audio-similarity/store.ts"),
      "utf8",
    );
    for (const table of [
      "audio_similarity_runs",
      "audio_similarity_features",
      "audio_similarity_failures",
      "audio_similarity_candidate_groups",
      "audio_similarity_candidate_members",
      "audio_similarity_candidate_edges",
      "audio_similarity_confirmed_groups",
      "audio_similarity_confirmed_members",
      "audio_similarity_rejections",
      "hidden_tracks",
    ]) {
      expect(source).toContain(`create table if not exists ${table}`);
    }
  });

  it("wires the full-page report and excludes hidden tracks from selection queries", () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/index.html"), "utf8",
    );
    const search = fs.readFileSync(
      path.join(process.cwd(), "app/src/main/library/search.ts"), "utf8",
    );
    const tandas = fs.readFileSync(
      path.join(process.cwd(), "app/src/main/library/tandas.ts"), "utf8",
    );
    expect(html).toContain('id="open-audio-similarity"');
    expect(html).toContain('id="audio-similarity-page"');
    expect(search).toContain("not exists (select 1 from hidden_tracks");
    expect(tandas).toContain("join hidden_tracks");
  });

  it("builds symmetric, group-wide equivalence without linking other groups", () => {
    const lookup = buildConfirmedAudioSimilarityLookup([
      {
        id: "group-one",
        relationshipType: "same-composition",
        preferredTrackId: null,
        trackIds: ["a", "b", "c"],
      },
      {
        id: "group-two",
        relationshipType: "same-recording",
        preferredTrackId: "d",
        trackIds: ["d", "e"],
      },
    ]);

    expect([...lookup.get("a")!]).toEqual(["a", "b", "c"]);
    expect([...lookup.get("c")!]).toEqual(["a", "b", "c"]);
    expect(lookup.get("a")!.has("d")).toBe(false);
    expect([...lookup.get("e")!]).toEqual(["d", "e"]);
  });

  it("runs schema migration repeatedly and creates the required indexes", () => {
    const database = createDatabase();
    expect(() => ensureAudioSimilaritySchema(database as never)).not.toThrow();
    const indexes = database.prepare(
      "select name from sqlite_master where type = 'index' and name like 'idx_audio_%'",
    ).all() as Array<{ name: string }>;
    expect(indexes.map((row) => row.name).sort()).toEqual(expect.arrayContaining([
      "idx_audio_candidate_groups_run",
      "idx_audio_candidate_members_track",
      "idx_audio_confirmed_members_group",
      "idx_audio_failures_run",
      "idx_audio_features_version",
    ]));
    database.close();
  });

  it("supports approval, partial rejection, detachment, reconsideration, and withdrawal", () => {
    const database = createDatabase();
    ["a", "b", "c", "d"].forEach((id) => addTrack(database, id));

    const firstGroup = approveCandidateSubset(
      database as never, ["a", "b", "c"], ["a", "b"], "same-composition",
    );
    expect(listConfirmedAudioSimilarityGroups(database as never)).toEqual([
      { id: firstGroup, relationshipType: "same-composition", preferredTrackId: null, trackIds: ["a", "b"] },
    ]);
    expect(database.prepare("select left_track_id, right_track_id from audio_similarity_rejections order by 1, 2").all())
      .toEqual([{ left_track_id: "a", right_track_id: "c" }, { left_track_id: "b", right_track_id: "c" }]);

    reconsiderAudioSimilarityPair(database as never, "c", "a");
    expect(database.prepare("select count(*) as count from audio_similarity_rejections").get())
      .toEqual({ count: 1 });

    const secondGroup = confirmAudioSimilarityGroup(database as never, ["a", "b", "c"], "same-recording");
    detachTrackFromConfirmedAudioSimilarityGroup(database as never, secondGroup, "c", true);
    expect(listConfirmedAudioSimilarityGroups(database as never)[0].trackIds).toEqual(["a", "b"]);
    expect(database.prepare("select count(*) as count from audio_similarity_rejections").get())
      .toEqual({ count: 2 });

    rejectAudioSimilarityPair(database as never, "a", "d");
    expect(database.prepare("select count(*) as count from audio_similarity_rejections").get())
      .toEqual({ count: 3 });
    withdrawConfirmedAudioSimilarityGroup(database as never, secondGroup);
    expect(listConfirmedAudioSimilarityGroups(database as never)).toEqual([]);
    database.close();
  });

  it("hides reversibly and protects non-replicable metadata fields", () => {
    const database = createDatabase();
    addTrack(database, "source", { title: "Canonical title" });
    addTrack(database, "target", { title: "Old title" });

    setTrackHidden(database as never, "target", true);
    expect(database.prepare("select track_id from hidden_tracks").all())
      .toEqual([{ track_id: "target" }]);
    setTrackHidden(database as never, "target", false);
    expect(database.prepare("select track_id from hidden_tracks").all()).toEqual([]);

    const mutation = replicateAudioSimilarityMetadata(
      database as never, "source", ["target"], "title",
    );
    expect(mutation).toMatchObject({
      updated: 1,
      conflicts: [],
      changes: [{ trackId: "target", field: "title", oldValue: "Old title", newValue: "Canonical title" }],
    });
    expect(database.prepare("select title from tracks where id = 'target'").get())
      .toEqual({ title: "Canonical title" });
    expect(undoAudioSimilarityMetadata(database as never, mutation.changes)).toMatchObject({
      updated: 1,
      conflicts: [],
    });
    expect(database.prepare("select title from tracks where id = 'target'").get())
      .toEqual({ title: "Old title" });
    expect(() => replicateAudioSimilarityMetadata(
      database as never, "source", ["target"], "full_path" as never,
    )).toThrow("cannot be replicated");
    database.close();
  });

  it("replaces one tanda position and recomputes its dependent summary", () => {
    const database = createDatabase();
    addTrack(database, "old", { durationMs: 100_000, startOffsetMs: 1_000, endTrimMs: 1_000 });
    addTrack(database, "other", { durationMs: 120_000, startOffsetMs: 0, endTrimMs: 2_000 });
    addTrack(database, "replacement", { durationMs: 150_000, startOffsetMs: 5_000, endTrimMs: 5_000 });
    database.exec(`
      insert into tandas values ('tanda', 'Tanda', 2, 0, 1, 'old');
      insert into tanda_tracks values ('tanda', 'old', 0), ('tanda', 'other', 1);
    `);

    replaceAudioSimilarityTandaTrack(database as never, "tanda", 0, "replacement");
    expect(database.prepare("select track_id from tanda_tracks where tanda_id = 'tanda' order by position").all())
      .toEqual([{ track_id: "replacement" }, { track_id: "other" }]);
    expect(database.prepare("select slot_count, total_duration_ms, invalid from tandas where id = 'tanda'").get())
      .toEqual({ slot_count: 2, total_duration_ms: 258_000, invalid: 0 });
    database.close();
  });

  it("validates every selected tanda use before applying a bulk replacement", () => {
    const database = createDatabase();
    addTrack(database, "old");
    addTrack(database, "replacement");
    database.exec(`
      insert into tandas values ('one', 'One', 1, 0, 0, 'old');
      insert into tandas values ('two', 'Two', 1, 0, 0, 'old');
      insert into tanda_tracks values ('one', 'old', 0), ('two', 'old', 0);
    `);
    expect(() => replaceAudioSimilarityTandaReferences(database as never, [
      { tandaId: "one", position: 0 },
      { tandaId: "missing", position: 0 },
    ], "replacement")).toThrow("no longer available");
    expect(database.prepare("select track_id from tanda_tracks order by tanda_id").all())
      .toEqual([{ track_id: "old" }, { track_id: "old" }]);

    expect(replaceAudioSimilarityTandaReferences(database as never, [
      { tandaId: "one", position: 0 },
      { tandaId: "two", position: 0 },
    ], "replacement")).toEqual({ updated: 2 });
    expect(database.prepare("select track_id from tanda_tracks order by tanda_id").all())
      .toEqual([{ track_id: "replacement" }, { track_id: "replacement" }]);
    database.close();
  });

  it("counts missing, changed, and algorithm-version-stale features", () => {
    const database = createDatabase();
    ["missing", "changed", "old-version", "fresh"].forEach((id) => addTrack(database, id));
    const insert = database.prepare(`insert into audio_similarity_features
      (track_id, algorithm_version, file_hash, file_size, file_mtime_ms,
       effective_duration_ms, envelope_json, chroma_json, transition_json,
       coarse_json, updated_at) values (?, ?, ?, 100, 200, 1, '[]', '[]', '[]', '[]', 'now')`);
    insert.run("changed", AUDIO_SIMILARITY_ALGORITHM_VERSION, "wrong-hash");
    insert.run("old-version", AUDIO_SIMILARITY_ALGORITHM_VERSION - 1, "hash-old-version");
    insert.run("fresh", AUDIO_SIMILARITY_ALGORITHM_VERSION, "hash-fresh");

    expect(getAudioSimilarityStatus(database as never).staleTracks).toBe(3);
    expect(getAudioSimilarityIntegrity(database as never)).toMatchObject({
      algorithmVersion: AUDIO_SIMILARITY_ALGORITHM_VERSION,
      activeTracks: 4,
      readyTracks: 1,
      staleTracks: 3,
      orphanedFeatures: 0,
      orphanedConfirmedMembers: 0,
      healthy: false,
    });
    database.prepare(`insert into audio_similarity_features
      (track_id, algorithm_version, file_hash, effective_duration_ms,
       envelope_json, chroma_json, transition_json, coarse_json, updated_at)
      values ('removed', ?, 'removed', 1, '[]', '[]', '[]', '[]', 'now')`)
      .run(AUDIO_SIMILARITY_ALGORITHM_VERSION);
    database.prepare(`insert into audio_similarity_confirmed_groups
      (id, relationship_type, created_at, updated_at)
      values ('orphan-group', 'same-recording', 'now', 'now')`).run();
    database.prepare(`insert into audio_similarity_confirmed_members
      (group_id, track_id) values ('orphan-group', 'removed')`).run();
    expect(getAudioSimilarityIntegrity(database as never)).toMatchObject({
      orphanedFeatures: 1,
      orphanedConfirmedMembers: 1,
      healthy: false,
    });
    database.close();
  });
});
