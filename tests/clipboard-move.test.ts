import { describe, expect, it } from "vitest";
import {
  moveTandaToCollection,
  moveTrackToCollection,
} from "../app/src/shared/clipboard-move";

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

  it("does not duplicate a track when target already contains it", () => {
    const collections = [
      { id: "general", name: "General", trackIds: ["a"], tandaIds: [] },
      { id: "other", name: "Other", trackIds: ["a", "b"], tandaIds: [] },
    ];
    const updated = moveTrackToCollection(collections, "a", "other", []);
    const other = updated.find((item) => item.id === "other");
    expect(other?.trackIds).toEqual(["b", "a"]);
  });

  it("does nothing if the target is protected", () => {
    const collections = [
      { id: "general", name: "General", trackIds: ["a"], tandaIds: [] },
      { id: "new", name: "New", trackIds: ["a"], tandaIds: [] },
    ];
    const updated = moveTrackToCollection(collections, "a", "new", ["new"]);
    expect(updated).toEqual(collections);
  });

  it("moves a tanda into target collection and removes from others", () => {
    const collections = [
      { id: "general", name: "General", trackIds: [], tandaIds: ["t1"] },
      { id: "favourites", name: "Favourites", trackIds: [], tandaIds: ["t1", "t2"] },
    ];
    const updated = moveTandaToCollection(collections, "t1", "favourites", []);
    const general = updated.find((item) => item.id === "general");
    const favourites = updated.find((item) => item.id === "favourites");
    expect(general?.tandaIds).toEqual([]);
    expect(favourites?.tandaIds).toEqual(["t2", "t1"]);
  });

  it("does nothing for protected tanda target", () => {
    const collections = [
      { id: "general", name: "General", trackIds: [], tandaIds: ["t1"] },
      { id: "new", name: "New", trackIds: [], tandaIds: [] },
    ];
    const updated = moveTandaToCollection(collections, "t1", "new", ["new"]);
    expect(updated).toEqual(collections);
  });
});
