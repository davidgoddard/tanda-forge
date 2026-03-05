import { describe, expect, it } from "vitest";
import { computeSearchDiversityStats } from "../app/src/main/search-diversity";

describe("main search diversity aggregation", () => {
  it("builds orchestra, year, tempo and style buckets from db rows", () => {
    const tracksRows = [
      {
        id: "t1",
        artist_summary: "Francisco Canaro",
        artist: "Canaro",
        genre: "Tango",
        year: "1937",
        bpm: 62,
      },
      {
        id: "t2",
        artist_summary: "Francisco Canaro",
        artist: "Canaro",
        genre: "Tango",
        year: "1938",
        bpm: 63,
      },
      {
        id: "t3",
        artist_summary: "",
        artist: "Pugliese",
        genre: "Waltz",
        year: "1940",
        bpm: 60,
      },
    ];
    const tandaStylesRows = [
      { tanda_id: "td1", style_name: "Tango" },
      { tanda_id: "td2", style_name: "Waltz" },
    ];
    const tandaTracksRows = [
      { tanda_id: "td1", track_id: "t1" },
      { tanda_id: "td1", track_id: "t2" },
      { tanda_id: "td2", track_id: "t3" },
    ];

    const db = {
      prepare: (sql: string) => {
        if (sql.includes("from tracks t")) {
          return { iterate: () => tracksRows.values() };
        }
        if (sql.includes("from tanda_styles")) {
          return { iterate: () => tandaStylesRows.values() };
        }
        return { iterate: () => tandaTracksRows.values() };
      },
    } as unknown as Parameters<typeof computeSearchDiversityStats>[0];

    const stats = computeSearchDiversityStats(db);
    expect(stats.orchestraRows[0]?.artist).toBe("Francisco Canaro");
    expect(stats.orchestraRows[0]?.styles.Tango).toBe(1);
    expect(stats.orchestraRows[1]?.artist).toBe("Pugliese");
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
    expect(stats.styleBuckets).toEqual([
      ["Tango", 1],
      ["Waltz", 1],
    ]);
  });
});
