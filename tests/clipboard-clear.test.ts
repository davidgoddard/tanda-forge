import { describe, expect, it } from "vitest";
import { applyClipboardClear, resolveClipboardSelectionAfterClear } from "../app/src/shared/clipboard-clear";

describe("selection after clearing clipboard collections", () => {
  const collections = ["other", "general"].map((id) => ({
    id, name: id, trackIds: [], tandaIds: [],
  }));

  it("falls back to General and drops removed collection IDs", () => {
    expect(resolveClipboardSelectionAfterClear(collections, ["removed"], "removed", ["other", "removed"]))
      .toEqual({ activeCollectionId: "general", includedCollectionIds: ["other"], clearRowSelection: true });
  });

  it("clears row selection only when the active collection was cleared or is General", () => {
    expect(resolveClipboardSelectionAfterClear(collections, ["other"], "other", []).clearRowSelection).toBe(true);
    expect(resolveClipboardSelectionAfterClear(collections, ["general"], "other", []).clearRowSelection).toBe(false);
  });
});

describe("applyClipboardClear", () => {
  it("clears selected collections and keeps protected ones", () => {
    const collections = [
      { id: "general", name: "General", trackIds: ["t1"], tandaIds: ["a1"] },
      { id: "new", name: "New", trackIds: ["t2"], tandaIds: [] },
      { id: "fav", name: "Favs", trackIds: ["t3"], tandaIds: ["a2"] },
    ];
    const result = applyClipboardClear(collections, {
      selectedIds: ["general", "fav"],
      removeEmpty: true,
      protectedIds: ["general", "new"],
    });
    const general = result.collections.find((c) => c.id === "general");
    const fav = result.collections.find((c) => c.id === "fav");
    const preservedNew = result.collections.find((c) => c.id === "new");
    expect(general?.trackIds).toEqual([]);
    expect(general?.tandaIds).toEqual([]);
    expect(fav).toBeUndefined();
    expect(preservedNew?.trackIds).toEqual(["t2"]);
    expect(result.removedIds).toEqual(["fav"]);
  });

  it("does not remove empty collections when removeEmpty is false", () => {
    const collections = [
      { id: "general", name: "General", trackIds: [], tandaIds: [] },
      { id: "fav", name: "Favs", trackIds: [], tandaIds: [] },
    ];
    const result = applyClipboardClear(collections, {
      selectedIds: ["fav"],
      removeEmpty: false,
      protectedIds: ["general"],
    });
    expect(result.collections.length).toBe(2);
    expect(result.removedIds).toEqual([]);
  });
});
