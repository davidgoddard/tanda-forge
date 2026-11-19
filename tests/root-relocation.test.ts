import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { describe, expect, it } from "vitest";
import {
  copyMusicRootFiles,
  copyMergedRootFiles,
  planMusicRootRelocation,
  planSelectedRootRelocation,
} from "../app/src/main/library/root-relocation";

describe("music-root relocation planning", () => {
  it("places each current root beneath the consolidated destination", () => {
    const plan = planMusicRootRelocation(
      [
        { id: "one", path: path.resolve("/music/Golden Age"), label: "Golden Age" },
        { id: "two", path: path.resolve("/archive/Later"), label: "Later" },
      ],
      path.resolve("/new-library"),
    );
    expect(plan.map(({ folderName, targetPath }) => ({ folderName, targetPath }))).toEqual([
      { folderName: "Golden Age", targetPath: path.resolve("/new-library/Golden Age") },
      { folderName: "Later", targetPath: path.resolve("/new-library/Later") },
    ]);
  });

  it("rejects destinations inside a current root", () => {
    expect(() => planMusicRootRelocation(
      [{ id: "one", path: path.resolve("/music"), label: "Music" }],
      path.resolve("/music/moved"),
    )).toThrow(/outside every current music folder/);
  });

  it("gives same-named roots unique destination folders", () => {
    const plan = planMusicRootRelocation(
      [
        { id: "one", path: path.resolve("/first/music"), label: "Music" },
        { id: "two", path: path.resolve("/second/music"), label: "Music" },
      ],
      path.resolve("/new-library"),
    );
    expect(plan.map((item) => item.folderName)).toEqual(["music", "music-2"]);
    expect(plan.map((item) => item.targetPath)).toEqual([
      path.resolve("/new-library/music"),
      path.resolve("/new-library/music-2"),
    ]);
  });

  it("allows nested configured roots to be planned independently", () => {
    const plan = planMusicRootRelocation(
      [
        { id: "one", path: path.resolve("/music"), label: "Music" },
        { id: "two", path: path.resolve("/music/archive"), label: "Archive" },
      ],
      path.resolve("/new-library"),
    );
    expect(plan.map((item) => item.folderName)).toEqual(["music", "archive"]);
  });

  it("copies nested files and reports file-level progress", async () => {
    const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tanda-relocation-"));
    const source = path.join(temporaryRoot, "source");
    const target = path.join(temporaryRoot, "target");
    await fs.promises.mkdir(path.join(source, "nested"), { recursive: true });
    await fs.promises.writeFile(path.join(source, "one.mp3"), "one");
    await fs.promises.writeFile(path.join(source, "nested", "two.mp3"), "two");
    const progress: Array<{ stage: string; completed: number; total: number }> = [];
    try {
      const count = await copyMusicRootFiles([{ source, target }], (event) => {
        progress.push(event);
      });
      expect(count).toBe(2);
      expect(await fs.promises.readFile(path.join(target, "nested", "two.mp3"), "utf8"))
        .toBe("two");
      expect(progress.at(-1)).toMatchObject({ stage: "copying", completed: 2, total: 2 });
    } finally {
      await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("can copy a nested selected root separately without duplicating it in its parent", async () => {
    const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tanda-nested-"));
    const source = path.join(temporaryRoot, "source");
    const nested = path.join(source, "music");
    const parentTarget = path.join(temporaryRoot, "images-target");
    const nestedTarget = path.join(temporaryRoot, "music-target");
    await fs.promises.mkdir(nested, { recursive: true });
    await fs.promises.writeFile(path.join(source, "background.jpg"), "image");
    await fs.promises.writeFile(path.join(nested, "track.mp3"), "track");
    try {
      await copyMusicRootFiles([
        { source, target: parentTarget, excludedSourcePaths: [nested] },
        { source: nested, target: nestedTarget },
      ]);
      expect(fs.existsSync(path.join(parentTarget, "music"))).toBe(false);
      expect(await fs.promises.readFile(path.join(nestedTarget, "track.mp3"), "utf8"))
        .toBe("track");
    } finally {
      await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("keeps selected source types in separate category and root folders", () => {
    const destination = path.resolve("/relocated");
    const plan = planSelectedRootRelocation([
      { id: "music-a", kind: "music", path: path.resolve("/a/music"), label: "music" },
      { id: "music-b", kind: "music", path: path.resolve("/b/music"), label: "music" },
      { id: "cortina", kind: "cortina", path: path.resolve("/c/music"), label: "music" },
      { id: "images", kind: "background", path: path.resolve("/d/images"), label: "images" },
    ], destination);
    expect(plan.map((item) => item.targetPath)).toEqual([
      path.join(destination, "Music", "music"),
      path.join(destination, "Music", "music-2"),
      path.join(destination, "Cortinas", "music"),
      path.join(destination, "Images", "images"),
    ]);
  });

  it("merges root trees and renames only colliding files", async () => {
    const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tanda-merge-"));
    const first = path.join(temporaryRoot, "first");
    const second = path.join(temporaryRoot, "second");
    const categoryPath = path.join(temporaryRoot, "destination", "Music");
    await fs.promises.mkdir(path.join(first, "album"), { recursive: true });
    await fs.promises.mkdir(path.join(second, "album"), { recursive: true });
    await fs.promises.writeFile(path.join(first, "album", "track.mp3"), "first");
    await fs.promises.writeFile(path.join(second, "album", "track.mp3"), "second");
    await fs.promises.writeFile(path.join(second, "album", "other.mp3"), "other");
    try {
      const result = await copyMergedRootFiles([
        { id: "first", kind: "music", path: first, label: "first", categoryPath,
          folderName: "first", targetPath: path.join(categoryPath, "first") },
        { id: "second", kind: "music", path: second, label: "second", categoryPath,
          folderName: "second", targetPath: path.join(categoryPath, "second") },
      ]);
      expect(result.entries.map((entry) => entry.destinationRelativePath)).toEqual([
        path.join("album", "track.mp3"),
        path.join("album", "other.mp3"),
        path.join("album", "track-1.mp3"),
      ]);
      expect(await fs.promises.readFile(path.join(categoryPath, "album", "track.mp3"), "utf8"))
        .toBe("first");
      expect(await fs.promises.readFile(path.join(categoryPath, "album", "track-1.mp3"), "utf8"))
        .toBe("second");
    } finally {
      await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
