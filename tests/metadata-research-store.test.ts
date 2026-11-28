import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { ensureBpmSchema } from "../app/src/main/bpm/store";
import { encodeResearchCsv, researchBaseColumns, researchResultColumns } from "../app/src/main/library/metadata-research-csv";
import {
  applyResearch, ensureResearchSchema, listResearchRows, listResearchTracks,
  needsResearch, recordResearchExport, reviewResearchRows, stageResearchCsv, undoResearch,
} from "../app/src/main/library/metadata-research-store";

let db: Database.Database;
afterEach(() => db?.close());
const nativeSqliteAvailable = (() => {
  try {
    new Database(":memory:").close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ERR_DLOPEN_FAILED") throw error;
    return false;
  }
})();

function setup() {
  db = new Database(":memory:");
  db.exec(`
    create table tracks (id text primary key, root_id text, title text, artist text,
      artist_summary text, singer text, album text, year text, genre text, bpm real,
      duration_ms integer, instrumental integer, deleted_at text, updated_at text);
    create table library_roots (id text primary key, kind text);
    create table hidden_tracks (track_id text);
    create table styles (name text, normalized text);
    create table style_aliases (style_name text, alias_normalized text);
    insert into library_roots values ('music','music');
    insert into styles values ('Tango','tango');
    insert into tracks (id,root_id,title,singer,genre,year,duration_ms,updated_at)
      values ('id1','music','Adiós','Ángel','Tango','1940',200000,'original'),
             ('id2','music','Segundo',null,null,null,300000,'original');
    pragma user_version = 3;
  `);
  ensureBpmSchema(db);
  ensureResearchSchema(db);
  ensureResearchSchema(db);
  return db;
}

const result = (rows: Array<Record<string, string | number | null>>) =>
  encodeResearchCsv([...researchBaseColumns, ...researchResultColumns], rows);
const title = (id: string) => db.prepare("select title from tracks where id=?").pluck().get(id);

describe.runIf(nativeSqliteAvailable)("metadata research persistence", () => {
  it("stages and bulk approves 1,000 tracks without changing library metadata before apply", () => {
    setup();
    const insert = db.prepare(`insert into tracks (id,root_id,title,updated_at) values (?,'music','Original','original')`);
    db.transaction(() => {
      for (let i = 0; i < 998; i++) insert.run(`bulk-${i}`);
    })();
    const { batch } = stageResearchCsv(db, result(listResearchTracks(db).map((track) => ({
      ...track, suggested_title: "Updated", confidence: "High",
    }))));
    reviewResearchRows(db, listResearchRows(db).map(({ line }) => ({
      batch, line, state: "approved", values: { title: "Updated" },
    })));
    expect(title("bulk-100")).toBe("Original");
    expect(applyResearch(db)).toEqual({ tracks: 1000, fields: 1000 });
    expect(title("bulk-100")).toBe("Updated");
    expect(undoResearch(db, batch)).toBe(1000);
    expect(title("bulk-100")).toBe("Original");
  });

  it("requires an explicit decision when the research flags an ambiguous recording", () => {
    setup();
    const track = listResearchTracks(db)[0];
    const { batch } = stageResearchCsv(db, result([{ ...track, suggested_title: "Candidate", review_status: "ambiguous" }]));
    const edit = { batch, line: 2, state: "approved" as const, values: { title: "Candidate" } };
    expect(() => reviewResearchRows(db, [edit])).toThrow("Resolve the recording-match warning");
    reviewResearchRows(db, [{ ...edit, resolved: true }]);
    expect(applyResearch(db).tracks).toBe(1);
  });

  it("stages without editing tracks, persists decisions, applies only checked fields and records undo", () => {
    setup();
    const track = listResearchTracks(db).find(({ id }) => id === "id1")!;
    const csv = result([{ ...track, suggested_title: "Adiós, muchachos", suggested_artist: "D’Agostino", confidence: "High" }]);
    const { batch } = stageResearchCsv(db, csv);
    expect(stageResearchCsv(db, csv)).toEqual({ batch, duplicate: true });
    expect(title(track.id)).toBe("Adiós");
    reviewResearchRows(db, [{ batch, line: 2, state: "pending", values: { title: "Manual draft" } }]);
    expect(listResearchRows(db)[0].draft).toEqual({ title: "Manual draft" });
    expect(() => reviewResearchRows(db, [{ batch, line: 2, state: "approved", values: { title: "" } }])).toThrow("Invalid title");
    reviewResearchRows(db, [{ batch, line: 2, state: "approved", values: { title: "Manual correction" } }]);
    expect(applyResearch(db)).toEqual({ tracks: 1, fields: 1 });
    expect(title(track.id)).toBe("Manual correction");
    expect(db.prepare("select artist from tracks where id='id1'").pluck().get()).toBeNull();
    expect(listResearchRows(db)[0]).toMatchObject({
      state: "applied", snapshot: { title: "Adiós" }, after: { title: "Manual correction" },
      original: { confidence: "High" },
    });
    expect(undoResearch(db, batch, 2)).toBe(1);
    expect(title(track.id)).toBe("Adiós");
    expect(listResearchRows(db)[0].state).toBe("undone");
  });

  it("rejects unknown IDs, duplicate IDs and invalid metadata while keeping valid rows reviewable", () => {
    setup();
    const tracks = listResearchTracks(db);
    const first = tracks.find(({ id }) => id === "id1")!;
    const second = tracks.find(({ id }) => id === "id2")!;
    const { batch } = stageResearchCsv(db, result([
      { ...first, suggested_title: "Valid" },
      { ...second, suggested_genre: "Made-up genre", recording_date: "1940-02-31" },
      { ...second, suggested_bpm: -5, confidence: "maybe" },
      { ...second, id: "unknown", recording_year: 9999 },
    ]));
    const rows = listResearchRows(db);
    expect(rows.find(({ line }) => line === 3)?.issues).toEqual(expect.arrayContaining(["Duplicate track ID", "Invalid genre", "Invalid recording date"]));
    expect(rows.find(({ line }) => line === 4)?.issues).toEqual(expect.arrayContaining(["Duplicate track ID", "Invalid confidence", "Invalid bpm"]));
    expect(rows.find(({ line }) => line === 5)?.issues).toEqual(expect.arrayContaining(["Unknown track ID", "Invalid year"]));
    expect(() => reviewResearchRows(db, [{ batch, line: 3, state: "approved", values: { title: "Blocked" } }])).toThrow();
    reviewResearchRows(db, [{ batch, line: 2, state: "approved", values: { title: "Valid" } }]);
    expect(applyResearch(db)).toEqual({ tracks: 1, fields: 1 });
  });

  it("rolls back an entire approved batch on a late conflict and protects later edits during undo", () => {
    setup();
    const tracks = listResearchTracks(db);
    const { batch } = stageResearchCsv(db, result(tracks.map((track) => ({ ...track, suggested_title: "New title" }))));
    reviewResearchRows(db, listResearchRows(db).map(({ line }) => ({ batch, line, state: "approved", values: { title: "New title" } })));
    db.prepare("update tracks set title='Later edit' where id=?").run(tracks[0].id);
    expect(() => applyResearch(db)).toThrow("Track changed since review");
    expect(title(tracks[1].id)).toBe(tracks[1].title);
    expect(listResearchRows(db).every(({ state }) => state === "approved")).toBe(true);
    reviewResearchRows(db, [{ batch, line: 2, state: "pending", recheck: true }]);
    reviewResearchRows(db, [{ batch, line: 2, state: "approved", values: { title: "Re-reviewed" } }]);
    expect(applyResearch(db).tracks).toBe(2);
    db.prepare("update tracks set title='Second edit' where id=?").run(tracks[0].id);
    expect(() => undoResearch(db, batch)).toThrow("Track changed since applying research");
    expect(title(tracks[1].id)).toBe("New title");
  });

  it("preserves a known singer for unknown vocals and only clears it by explicit approval", () => {
    setup();
    const track = listResearchTracks(db).find(({ id }) => id === "id1")!;
    const { batch } = stageResearchCsv(db, result([{ ...track, vocal_status: "unknown" }]));
    expect(listResearchRows(db)[0].proposed).toEqual({});
    expect(() => reviewResearchRows(db, [{ batch, line: 2, state: "approved", values: { singer: null } }])).toThrow();
    reviewResearchRows(db, [{ batch, line: 2, state: "rejected" }]);
    const confirmed = stageResearchCsv(db, result([{ ...track, vocal_status: "instrumental" }]));
    reviewResearchRows(db, [{ batch: confirmed.batch, line: 2, state: "approved", values: { singer: null, instrumental: 1 } }]);
    expect(applyResearch(db).fields).toBe(2);
    const current = listResearchTracks(db).find(({ id }) => id === track.id)!;
    expect(current).toMatchObject({ singer: null, instrumental: 1 });
    expect(needsResearch(current)).toBe(false);
    recordResearchExport(db, "export-batch", [track.id]);
    expect(listResearchTracks(db).find(({ id }) => id === track.id)).toMatchObject({ exported: 1, completed: 1 });
  });
});
