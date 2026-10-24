import path from "path";
import { describe, expect, it } from "vitest";

import {
  getLegacySourceIdentity,
  getLegacyTandaId,
  orderLegacyRootsForSource,
} from "../app/src/main/legacy-import.js";

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
});
