import { describe, expect, it } from "vitest";
import { moveTrackToCollection } from "../app/src/shared/clipboard-move";

describe("moveTrackToCollection", () => {
  it("moves a track into the target collection and removes from others", () => {
    const collections = [
      { id: "general", name: "General", trackIds: ["a"], tandaIds: [] },
      { id: "other", name: "Other", trackIds: ["a", "b"], tandaIds: [] },
    ];
    const updated = moveTrackToCollection(collections, "a", "general", []);
    const general = updated.find((item) => item.id === "general");
    const other = updated.find((item) => item.id === "other");
    expect(general?.trackIds).toEqual(["a"]);
    expect(other?.trackIds).toEqual(["b"]);
  });

  it("does nothing if the target is protected", () => {
    const collections = [
      { id: "general", name: "General", trackIds: ["a"], tandaIds: [] },
      { id: "new", name: "New", trackIds: ["a"], tandaIds: [] },
    ];
    const updated = moveTrackToCollection(collections, "a", "new", ["new"]);
    expect(updated).toEqual(collections);
  });
});
