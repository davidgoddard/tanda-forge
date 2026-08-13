import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import {
  listDeletedTracks,
  logicallyDeleteTrack,
  restoreDeletedTracks,
} from "../app/src/main/library/track-deletion";

const makeDb = () => {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    prepare: (sql: string) => ({
      get: () => ({ full_path: "/music/song.mp3" }),
      all: () => [{ id: "track-1", title: "Song", artist: "Artist", deleted_at: "now" }],
      run: (...args: unknown[]) => { calls.push({ sql, args }); return { changes: 1 }; },
    }),
    transaction: (work: () => void) => work,
  };
  return { db: db as never, calls };
};

describe("logical track deletion", () => {
  it("tombstones the track and invalidates dependent tandas and playlists", async () => {
    const { db, calls } = makeDb();
    expect(await logicallyDeleteTrack(db, "track-1", false)).toEqual({ ok: true, fileRemoved: false });
    expect(calls.map((call) => call.sql)).toEqual(expect.arrayContaining([
      expect.stringContaining("update tracks set deleted_at"),
      expect.stringContaining("update tandas set invalid = 1"),
      expect.stringContaining("update playlists set invalid = 1"),
    ]));
  });

  it("keeps the logical deletion when optional file removal fails", async () => {
    const { db } = makeDb();
    vi.spyOn(fs.promises, "unlink").mockRejectedValueOnce(new Error("EACCES"));
    await expect(logicallyDeleteTrack(db, "track-1", true)).resolves.toEqual({
      ok: true, fileRemoved: false, fileRemovalError: "EACCES",
    });
  });

  it("lists tombstoned tracks and restores selected IDs", () => {
    const { db, calls } = makeDb();
    expect(listDeletedTracks(db)).toEqual([
      { id: "track-1", title: "Song", artist: "Artist", deleted_at: "now" },
    ]);
    expect(restoreDeletedTracks(db, ["track-1", "track-1"])).toEqual({ restored: 1 });
    expect(calls.map((call) => call.sql)).toEqual(expect.arrayContaining([
      expect.stringContaining("set deleted_at = null"),
      expect.stringContaining("update tandas set invalid = 0"),
      expect.stringContaining("update playlists set invalid = 0"),
    ]));
  });
});
