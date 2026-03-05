import { describe, expect, it } from "vitest";
import {
  computeSearchDiversityStats,
  type SearchDiversityDbRow,
} from "../app/src/shared/search-diversity";

describe("computeSearchDiversityStats", () => {
  it("aggregates per tanda style and artist and builds year/tempo buckets", () => {
    const rows: SearchDiversityDbRow[] = [
      {
        tanda_id: "td1",
        tanda_style: "Tango",
        artist_summary: "Francisco Canaro",
        artist: "Francisco Canaro",
        genre: "Tango",
        year: "1937",
        bpm: 62,
      },
      {
        tanda_id: "td1",
        tanda_style: "Tango",
        artist_summary: "Francisco Canaro",
        artist: "Francisco Canaro",
        genre: "Tango",
        year: "1938",
        bpm: 63,
      },
      {
        tanda_id: "td2",
        tanda_style: "",
        artist_summary: "",
        artist: "Osvaldo Pugliese",
        genre: "Waltz",
        year: "1940",
        bpm: 60,
      },
    ];
    const stats = computeSearchDiversityStats(rows);
    expect(stats.orchestraRows[0]?.artist).toBe("Francisco Canaro");
    expect(stats.orchestraRows[0]?.styles.Tango).toBe(1);
    expect(stats.orchestraRows[1]?.artist).toBe("Osvaldo Pugliese");
    expect(stats.orchestraRows[1]?.styles.Waltz).toBe(1);
    expect(stats.yearBuckets).toEqual([
      [1937, 1],
      [1938, 1],
      [1940, 1],
    ]);
    expect(stats.tempoBuckets).toEqual([
      [60, 1],
      [62, 1],
      [63, 1],
    ]);
    expect(stats.styleBuckets[0]).toEqual(["Tango", 1]);
    expect(stats.styleBuckets[1]).toEqual(["Waltz", 1]);
  });
});
