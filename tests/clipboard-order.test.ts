import { describe, expect, it } from "vitest";
import { reorderClipboardCollections } from "../app/src/shared/clipboard-order";

describe("clipboard collection order", () => {
  it("reorders collections when moving between non-pinned items", () => {
    const result = reorderClipboardCollections(
      [{ id: "general" }, { id: "a" }, { id: "b" }, { id: "c" }],
      "c",
      "a",
      ["general", "new"],
    );
    expect(result.map((item) => item.id)).toEqual([
      "general",
      "c",
      "a",
      "b",
    ]);
  });

  it("ignores moves involving the pinned collection", () => {
    const result = reorderClipboardCollections(
      [{ id: "general" }, { id: "new" }, { id: "a" }, { id: "b" }],
      "general",
      "a",
      ["general", "new"],
    );
    expect(result.map((item) => item.id)).toEqual([
      "general",
      "new",
      "a",
      "b",
    ]);
  });

  it("ignores moves involving the new collection", () => {
    const result = reorderClipboardCollections(
      [{ id: "general" }, { id: "new" }, { id: "a" }],
      "a",
      "new",
      ["general", "new"],
    );
    expect(result.map((item) => item.id)).toEqual([
      "general",
      "new",
      "a",
    ]);
  });
});
