import { describe, expect, it } from "vitest";

import { resolveCollectionForClipboardWrite } from "../app/src/shared/clipboard-target";

describe("resolveCollectionForClipboardWrite", () => {
  it("keeps non-new active collection", () => {
    const result = resolveCollectionForClipboardWrite("favorites", "general");
    expect(result).toEqual({
      targetCollectionId: "favorites",
      nextActiveCollectionId: "favorites",
      switchedFromNew: false,
    });
  });

  it("switches new to general", () => {
    const result = resolveCollectionForClipboardWrite("new", "general");
    expect(result).toEqual({
      targetCollectionId: "general",
      nextActiveCollectionId: "general",
      switchedFromNew: true,
    });
  });

  it("returns null target when there is no active collection", () => {
    const result = resolveCollectionForClipboardWrite(null, "general");
    expect(result).toEqual({
      targetCollectionId: null,
      nextActiveCollectionId: null,
      switchedFromNew: false,
    });
  });

  it("does not switch if general collection is missing", () => {
    const result = resolveCollectionForClipboardWrite("new", null);
    expect(result).toEqual({
      targetCollectionId: null,
      nextActiveCollectionId: "new",
      switchedFromNew: false,
    });
  });
});
