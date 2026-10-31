import { describe, expect, it } from "vitest";
import {
  findExactOrderedTandaMatch,
  filterForArtistDiversity,
  getTandaGenerationPhaseRules,
  groupGenerationSeedsByArtist,
  scoreTandaTrackCohesion,
  TANDA_GENERATION_PHASES,
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

describe("tanda generation relaxation order", () => {
  it("tries relaxed single-orchestra construction before any mixed phase", () => {
    expect(TANDA_GENERATION_PHASES).toEqual([
      "strict",
      "same-artist-relaxed",
      "mixed-cohesive",
      "style-only",
    ]);
    expect(getTandaGenerationPhaseRules("same-artist-relaxed")).toMatchObject({
      requireSameArtist: true,
      matchYearAndBpm: false,
      matchVocalCharacter: false,
    });
    expect(getTandaGenerationPhaseRules("mixed-cohesive").requireSameArtist).toBe(false);
  });
});

describe("filterForArtistDiversity", () => {
  const candidates = [
    { id: "repeat", artists: ["D'Arienzo"] },
    { id: "unused-mixed", artists: ["Troilo", "Fresedo"] },
    { id: "unused-pure", artists: ["Di Sarli"] },
  ];

  it("rejects repeated orchestras while an unused option exists", () => {
    expect(filterForArtistDiversity({
      items: candidates,
      getArtistKeys: (candidate) => candidate.artists,
      getArtistUsage: (artist) => artist === "D'Arienzo" ? 1 : 0,
    }).map((candidate) => candidate.id)).toEqual(["unused-pure"]);
  });

  it("prefers fewer orchestras among equally unused candidates", () => {
    expect(filterForArtistDiversity({
      items: candidates.slice(1),
      getArtistKeys: (candidate) => candidate.artists,
      getArtistUsage: () => 0,
    }).map((candidate) => candidate.id)).toEqual(["unused-pure"]);
  });
});

describe("groupGenerationSeedsByArtist", () => {
  const tracks = [
    { id: "d1", artist: "D'Arienzo", title: "A" },
    { id: "d2", artist: "D'Arienzo", title: "B" },
    { id: "d3", artist: "D'Arienzo", title: "C" },
    { id: "t1", artist: "Troilo", title: "D" },
    { id: "t2", artist: "Troilo", title: "E" },
    { id: "t3", artist: "Troilo", title: "F" },
    { id: "f1", artist: "Fresedo", title: "G" },
  ];

  it("places unused viable orchestras before already-used orchestras", () => {
    const groups = groupGenerationSeedsByArtist({
      items: tracks,
      getArtistKey: (track) => track.artist,
      getTitleKey: (track) => track.title,
      getArtistUsage: (artist) => artist === "D'Arienzo" ? 3 : 0,
      targetCount: 3,
      requireViableSingleArtist: true,
      getTieBreaker: () => 0,
    });
    expect(groups.map((group) => group[0]?.artist)).toEqual(["Troilo", "D'Arienzo"]);
  });

  it("excludes orchestras that cannot fill a single-orchestra tanda", () => {
    const groups = groupGenerationSeedsByArtist({
      items: tracks,
      getArtistKey: (track) => track.artist,
      getTitleKey: (track) => track.title,
      getArtistUsage: () => 0,
      targetCount: 3,
      requireViableSingleArtist: true,
      getTieBreaker: () => 0,
    });
    expect(groups.flat().some((track) => track.artist === "Fresedo")).toBe(false);
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
