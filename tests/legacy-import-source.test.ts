import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  detectLegacyFromRoots,
  getLegacySourceIdentity,
  getLegacyTandaId,
  orderLegacyRootsForSource,
} from "../app/src/main/legacy-import.js";

const tempPaths: string[] = [];

afterEach(() => {
  while (tempPaths.length > 0) {
    fs.rmSync(tempPaths.pop()!, { recursive: true, force: true });
  }
});

const writeLegacyRoot = (name: string) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), `tanda-legacy-${name}-`));
  const music = path.join(parent, "music");
  fs.mkdirSync(music);
  for (const fileName of ["config.js", "library.dat", "tandas.dat"]) {
    fs.writeFileSync(path.join(parent, fileName), "{}");
  }
  tempPaths.push(parent);
  return { parent, music };
};

describe("legacy import source identity", () => {
  it("is stable for the same source and distinct for another collection", () => {
    const first = getLegacySourceIdentity("/collections/A");
    expect(getLegacySourceIdentity("/collections/A")).toEqual(first);
    expect(getLegacySourceIdentity("/collections/B").sourceId).not.toBe(first.sourceId);
    expect(first.sourcePath).toBe(path.resolve("/collections/A"));
  });

  it("prefers music roots belonging to the imported collection", () => {
    const ordered = orderLegacyRootsForSource([
      { id: "b", kind: "music", path: "/collections/B/music", label: "B" },
      { id: "a", kind: "music", path: "/collections/A/music", label: "A" },
    ], "/collections/A");
    expect(ordered.map((root) => root.id)).toEqual(["a", "b"]);
  });

  it("reuses tanda identities on reimport without colliding across sources", () => {
    const sourceA = getLegacySourceIdentity("/collections/A").sourceId;
    const sourceB = getLegacySourceIdentity("/collections/B").sourceId;
    expect(getLegacyTandaId(sourceA, 2)).toBe(getLegacyTandaId(sourceA, 2));
    expect(getLegacyTandaId(sourceA, 2)).not.toBe(getLegacyTandaId(sourceB, 2));
  });

  it("prefers the most recently configured collection when several roots contain legacy data", () => {
    const older = writeLegacyRoot("older");
    const newer = writeLegacyRoot("newer");

    const detected = detectLegacyFromRoots([
      {
        id: "older",
        kind: "music",
        path: older.music,
        label: "Older",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "newer",
        kind: "music",
        path: newer.music,
        label: "Newer",
        createdAt: "2026-10-26T00:00:00.000Z",
      },
    ]);

    expect(detected?.rootPath).toBe(newer.parent);
  });
});
