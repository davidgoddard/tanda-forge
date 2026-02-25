import { describe, expect, it } from "vitest";
import { normalizePlaylistItems } from "../app/src/shared/playlist-normalize";

describe("normalizePlaylistItems", () => {
  it("preserves leading empty slots for sequence alignment", () => {
    expect(normalizePlaylistItems([null, "a", "b", null])).toEqual([
      null,
      "a",
      "b",
      null,
    ]);
  });

  it("collapses duplicated leading empty slots to a single placeholder", () => {
    expect(normalizePlaylistItems([null, null, "a", "b", null])).toEqual([
      null,
      "a",
      "b",
      null,
    ]);
  });

  it("keeps internal empty slots and enforces one trailing empty slot", () => {
    expect(normalizePlaylistItems(["a", null, "b", null, null])).toEqual([
      "a",
      null,
      "b",
      null,
    ]);
  });

  it("returns a single empty slot when playlist is fully empty", () => {
    expect(normalizePlaylistItems([null, null, null])).toEqual([null]);
  });
});
