import { describe, expect, it } from "vitest";
import { matchesRating, normalizeRatingFilter, type RatingFilter } from "../app/src/shared/rating-filter";
import { buildRatingWhere, trackRatingSql, getRatingSnapshot } from "../app/src/main/library/rating-filter";
import { buildStyleWhere } from "../app/src/main/search-config";
import { buildTandaSearchWhere } from "../app/src/main/library/tandas";
import { fetchSearchCandidates } from "../app/src/main/library/search";

const filter = (mode: RatingFilter["mode"], stars = 3): RatingFilter => ({ mode, stars });

describe("rating filter", () => {
  it.each([
    ["any", [0, 1, 2, 3, 4, 5]],
    ["unrated", [0]],
    ["atLeast", [3, 4, 5]],
    ["exactly", [3]],
    ["atMost", [1, 2, 3]],
  ] as const)("matches %s without conflating unrated with low ratings", (mode, expected) => {
    expect([0, 1, 2, 3, 4, 5].filter((rating) => matchesRating(rating, filter(mode)))).toEqual(expected);
  });

  it("handles no membership as unrated and supports one/five star boundaries", () => {
    expect(matchesRating(undefined, filter("unrated"))).toBe(true);
    expect(matchesRating(null, filter("atMost"))).toBe(false);
    expect(matchesRating(1, filter("atMost", 1))).toBe(true);
    expect(matchesRating(5, filter("atLeast", 5))).toBe(true);
    expect(matchesRating(4, filter("atLeast", 5))).toBe(false);
  });

  it("normalizes malformed input and restricts comparison operators", () => {
    expect(normalizeRatingFilter({ mode: "bad", stars: 3 } as any)).toEqual(filter("any", 1));
    expect(normalizeRatingFilter(filter("exactly", NaN))).toEqual(filter("exactly", 1));
    expect(normalizeRatingFilter(filter("exactly", 9))).toEqual(filter("exactly", 5));
    expect(normalizeRatingFilter(filter("exactly", -1))).toEqual(filter("exactly", 1));
    expect(buildRatingWhere("rating", { mode: "OR 1=1", stars: 3 } as any).sql).toBe("");
  });

  it("uses global MAX membership for tracks before applying comparison", () => {
    expect(trackRatingSql).toContain("max(rated.rating)");
    expect(trackRatingSql).toContain("rated_tt.track_id = t.id");
    const result = buildStyleWhere(["Tango"], filter("atMost"));
    expect(result.whereSql).toContain(`${trackRatingSql} <= ?`);
    expect(result.whereSql).toContain(`${trackRatingSql} >= 1`);
    expect(result.values).toEqual(["Tango", 3]);
  });

  it("filters fuzzy candidates in SQL before scoring and pagination", () => {
    let query = "";
    let args: unknown[] = [];
    const db = { prepare: (sql: string) => { query = sql; return { all: (...values: unknown[]) => { args = values; return []; } }; } };
    fetchSearchCandidates(db as any, ["Vals"], filter("exactly", 5));
    expect(query).toContain(`${trackRatingSql} = ?`);
    expect(args).toEqual(["Vals", 5]);
  });

  it("compares tanda ratings directly while preserving size and validity filters", () => {
    const result = buildTandaSearchWhere({ query: "", styles: [], size: 3, rating: filter("unrated") });
    expect(result.whereSql).toContain("coalesce(tandas.rating, 0) = 0");
    expect(result.whereSql).toContain("coalesce(tandas.invalid, 0) = 0");
    expect(result.values).toEqual([3]);
  });

  it("refreshes the collection snapshot on each request instead of caching ratings", () => {
    let rating = 5;
    const db = { prepare: (sql: string) => ({ all: () => [{ id: sql.includes("group by") ? "track" : "tanda", rating }] }) };
    expect(getRatingSnapshot(db as any).tracks[0].rating).toBe(5);
    rating = 2;
    expect(getRatingSnapshot(db as any).tracks[0].rating).toBe(2);
  });
});
