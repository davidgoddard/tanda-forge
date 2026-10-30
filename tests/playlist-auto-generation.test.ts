import { describe, expect, it } from "vitest";
import {
  findExactOrderedTandaMatch,
  scoreTandaTrackCohesion,
} from "../app/src/shared/playlist-auto-generation";

const seed = {
  artist: "Carlos Di Sarli",
  singer: "Roberto Rufino",
  instrumental: false,
  year: 1941,
  bpm: 62,
};

describe("scoreTandaTrackCohesion", () => {
  it("strongly prefers the same orchestra and vocal character", () => {
    const coherent = scoreTandaTrackCohesion(seed, {
      ...seed,
      year: 1942,
      bpm: 63,
    });
    const otherOrchestra = scoreTandaTrackCohesion(seed, {
      ...seed,
      artist: "Anibal Troilo",
    });
    const instrumental = scoreTandaTrackCohesion(seed, {
      ...seed,
      instrumental: true,
      singer: "",
    });
    expect(coherent).toBeLessThan(otherOrchestra);
    expect(coherent).toBeLessThan(instrumental);
  });

  it("uses nearby year and tempo to rank otherwise compatible tracks", () => {
    const near = scoreTandaTrackCohesion(seed, { ...seed, year: 1943, bpm: 64 });
    const far = scoreTandaTrackCohesion(seed, { ...seed, year: 1955, bpm: 78 });
    expect(near).toBeLessThan(far);
  });

  it("penalizes different named singers without rejecting missing metadata", () => {
    const sameSinger = scoreTandaTrackCohesion(seed, { ...seed });
    const unknownSinger = scoreTandaTrackCohesion(seed, { ...seed, singer: "" });
    const otherSinger = scoreTandaTrackCohesion(seed, { ...seed, singer: "Jorge Duran" });
    expect(sameSinger).toBeLessThan(unknownSinger);
    expect(unknownSinger).toBeLessThan(otherSinger);
  });
});

describe("findExactOrderedTandaMatch", () => {
  const saved = [
    { id: "same", tracks: ["one", "two", "three", null] },
    { id: "different-order", tracks: ["three", "two", "one"] },
  ];

  it("returns a saved tanda with the same tracks in the same order", () => {
    expect(findExactOrderedTandaMatch(
      ["one", "two", "three"],
      saved,
      (tanda) => tanda.tracks,
    )?.id).toBe("same");
  });

  it("does not accept the same tracks in another order", () => {
    expect(findExactOrderedTandaMatch(
      ["one", "three", "two"],
      saved,
      (tanda) => tanda.tracks,
    )).toBeNull();
  });
});
