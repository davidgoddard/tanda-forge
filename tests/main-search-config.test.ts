import { describe, expect, it } from "vitest";
import {
  buildStyleWhere,
  getPrefixForTrack,
  getSortKeyForTrack,
  matchesPrefix,
  normalizeSearchConfig,
} from "../app/src/main/search-config";

describe("search-config", () => {
  it("buildStyleWhere defaults to music root constraint", () => {
    expect(buildStyleWhere([])).toEqual({
      whereSql: "where r.kind = 'music'",
      values: [],
    });
  });

  it("buildStyleWhere appends genre placeholders for style filters", () => {
    expect(buildStyleWhere(["Tango", "Milonga"])).toEqual({
      whereSql: "where r.kind = 'music' and t.genre in (?, ?)",
      values: ["Tango", "Milonga"],
    });
  });

  it("uses artist_summary over artist for artist sorting", () => {
    const sortKey = getSortKeyForTrack("artist", {
      artist: "Juan D'Arienzo",
      artist_summary: "D'Arienzo",
    });
    expect(sortKey).toBe("D'ARIENZO");
  });

  it("derives track prefix from normalized sort key", () => {
    const prefix = getPrefixForTrack("title", {
      title: "  El Flete  ",
    });
    expect(prefix).toBe("E");
  });

  it("matches 0-9 and # prefix buckets", () => {
    expect(matchesPrefix("0-9", "1942")).toBe(true);
    expect(matchesPrefix("0-9", "Troilo")).toBe(false);
    expect(matchesPrefix("#", "¡Misterio!")).toBe(true);
    expect(matchesPrefix("#", "Canaro")).toBe(false);
  });

  it("clamps and defaults fuzzy search config values", () => {
    expect(normalizeSearchConfig({ minScore: 2, bpmRange: 40 })).toEqual({
      minScore: 1,
      bpmRange: 20,
    });
    expect(normalizeSearchConfig({ minScore: -1, bpmRange: -1 })).toEqual({
      minScore: 0,
      bpmRange: 0,
    });
    expect(normalizeSearchConfig({})).toEqual({
      minScore: 0.25,
      bpmRange: 5,
    });
  });
});
