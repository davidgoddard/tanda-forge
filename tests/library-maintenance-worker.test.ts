import fs from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initDb, closeDb } from "../app/src/main/db";
import type { LegacyImportResult } from "../app/src/main/legacy-import";

const require = createRequire(import.meta.url);
// Exercise the shipped CommonJS worker, not a mocked Worker implementation.
let runLibraryMaintenance: (data: Record<string, unknown>, progress: (value: number) => void) => Promise<any>;
// The installed native addon targets Electron; probing it under host Node can segfault.
const nativeSqliteAvailable = Boolean(process.versions.electron);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-maintenance-test-"));
const music = path.join(directory, "music");
const cortina = path.join(directory, "cortinas");
let db: ReturnType<typeof initDb>;
const roots = [{ id: "music", kind: "music", path: music, label: "Music" },
  { id: "cortina", kind: "cortina", path: cortina, label: "Cortinas" }];
const progress: number[] = [];
const run = (operation: string, extra = {}) => runLibraryMaintenance({
  operation, filename: db.name, roots, rootPath: directory, rootId: "music", ...extra,
}, (value: number) => progress.push(value));

const previousDataRoot = process.env.TANDA_DATA_ROOT;
afterAll(() => {
  closeDb();
  if (previousDataRoot === undefined) delete process.env.TANDA_DATA_ROOT;
  else process.env.TANDA_DATA_ROOT = previousDataRoot;
  fs.rmSync(directory, { recursive: true, force: true });
});

describe.runIf(nativeSqliteAvailable)("library maintenance worker", () => {
beforeAll(() => {
  const compiled = path.join(directory, "compiled");
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.main.json", "--outDir", compiled], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
  fs.symlinkSync(path.resolve("node_modules"), path.join(directory, "node_modules"), "dir");
  ({ runLibraryMaintenance } = require(path.join(compiled, "main/library/maintenance.js")));
  process.env.TANDA_DATA_ROOT = directory;
  db = initDb(directory);
  db.pragma("journal_mode = WAL");
  fs.mkdirSync(music);
  fs.mkdirSync(cortina);
  fs.writeFileSync(path.join(cortina, "break.mp3"), "fixture");
  fs.writeFileSync(path.join(directory, "cortinas.dat"), JSON.stringify({ "cortinas/break.mp3": { track: { title: "Break" } } }));
  db.prepare("insert into library_roots(id,kind,path,label,created_at) values ('cortina','cortina',?,'Cortinas','now')").run(cortina);
  const entries: Record<string, unknown> = {};
  for (let i = 0; i < 120; i++) {
    fs.writeFileSync(path.join(music, `${i}.mp3`), "fixture");
    entries[`music/${i}.mp3`] = { track: { title: `Track ${i}`, artist: "Orchestra" }, classifiers: { style: "Tango" } };
  }
  fs.writeFileSync(path.join(directory, "config.js"), "{}");
  fs.writeFileSync(path.join(directory, "library.dat"), JSON.stringify(entries));
  fs.writeFileSync(path.join(directory, "tandas.dat"), JSON.stringify([{ label: "Test", tracks: ["music/0.mp3", "music/1.mp3"] }]));
  db.prepare("insert into library_roots(id,kind,path,label,created_at) values ('music','music',?,'Music','now')").run(music);
}, 30000);

it("imports, reimports, removes and imports again while the host event loop stays responsive", async () => {
  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  try {
    const first = await run("import") as LegacyImportResult;
    expect(first.tracksAdded).toBe(121);
    expect(first.tandasImported).toBe(1);
    expect(ticks).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(100);
    expect(progress.some(value => value > 15 && value < 99)).toBe(true);
    expect(first.overridesByRootId).toBeInstanceOf(Map);
    const repeat = await run("import");
    expect(repeat.tracksAdded).toBe(0);
    expect(repeat.tracksUpdated).toBe(121);
    const preview = await run("preview");
    expect(preview.trackCount).toBe(120);
    expect((await run("remove")).removed).toBe(true);
    expect(db.prepare("select count(*) from tracks").pluck().get()).toBe(1);
    expect(db.prepare("select invalid from tandas").pluck().get()).toBe(1);
    db.prepare("insert into library_roots(id,kind,path,label,created_at) values ('music','music',?,'Music','now')").run(music);
    expect((await run("import")).tracksAdded).toBe(120);
    expect(db.prepare("select count(*) from tandas").pluck().get()).toBe(1);
  } finally { clearInterval(timer); }
}, 30000);

it("rolls back a failed import and reports failure instead of 100%", async () => {
  db.exec("create trigger fail_import before update on tracks when new.title = 'Track 10' begin select raise(abort, 'fixture failure'); end");
  const before = db.prepare("select updated_at from tracks order by id").all();
  progress.length = 0;
  await expect(run("import")).rejects.toThrow("fixture failure");
  expect(progress).not.toContain(100);
  expect(db.prepare("select updated_at from tracks order by id").all()).toEqual(before);
  db.exec("drop trigger fail_import");
  expect((await run("import")).tracksUpdated).toBe(121);
}, 30000);

});
