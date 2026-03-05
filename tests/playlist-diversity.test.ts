import { describe, expect, it } from "vitest";

import {
  aggregateOrchestraDurations,
  areArtistsGapSatisfied,
  buildAdaptiveNumericDistribution,
  buildAdaptiveStyleNumericDistribution,
  collectEligibleArtistGroups,
  collectEligibleArtistStyleGroups,
  isTandaArtistStyleAvailable,
  isArtistGapSatisfied,
  normalizeArtistGroupKey,
} from "../app/src/shared/playlist-diversity.js";

describe("normalizeArtistGroupKey", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeArtistGroupKey("  Di Sarli  ")).toBe("di sarli");
  });

  it("handles nullish values", () => {
    expect(normalizeArtistGroupKey(undefined)).toBe("");
    expect(normalizeArtistGroupKey(null)).toBe("");
  });
});

describe("isArtistGapSatisfied", () => {
  it("allows artists with no previous play", () => {
    expect(
      isArtistGapSatisfied({
        artist: "di sarli",
        currentTotalMs: 60_000,
        repeatGapMs: 30_000,
        artistLastPlayedAtMs: new Map(),
      }),
    ).toBe(true);
  });

  it("rejects artists inside the repeat gap window", () => {
    expect(
      isArtistGapSatisfied({
        artist: "di sarli",
        currentTotalMs: 60_000,
        repeatGapMs: 30_000,
        artistLastPlayedAtMs: new Map([["di sarli", 45_000]]),
      }),
    ).toBe(false);
  });
});

describe("areArtistsGapSatisfied", () => {
  it("requires every artist in the candidate to satisfy the gap", () => {
    const ok = areArtistsGapSatisfied({
      items: [{ artist: "di sarli" }, { artist: "troilo" }],
      getArtistKey: (item) => item.artist,
      currentTotalMs: 60_000,
      repeatGapMs: 30_000,
      artistLastPlayedAtMs: new Map([["di sarli", 20_000]]),
    });
    expect(ok).toBe(true);
    const blocked = areArtistsGapSatisfied({
      items: [{ artist: "di sarli" }, { artist: "troilo" }],
      getArtistKey: (item) => item.artist,
      currentTotalMs: 60_000,
      repeatGapMs: 30_000,
      artistLastPlayedAtMs: new Map([["di sarli", 45_000]]),
    });
    expect(blocked).toBe(false);
  });
});

describe("collectEligibleArtistGroups", () => {
  it("returns groups with at least the required number of distinct titles", () => {
    const groups = collectEligibleArtistGroups({
      items: [
        { artist: "di sarli", title: "A" },
        { artist: "di sarli", title: "B" },
        { artist: "di sarli", title: "B" },
        { artist: "troilo", title: "A" },
      ],
      usedGroups: new Set<string>(),
      requiredCount: 2,
      getArtistGroupKey: (item) => item.artist,
      getTitleKey: (item) => item.title,
    });
    expect(Array.from(groups)).toEqual(["di sarli"]);
  });

  it("excludes groups already present in playlist usage", () => {
    const groups = collectEligibleArtistGroups({
      items: [
        { artist: "di sarli", title: "A" },
        { artist: "di sarli", title: "B" },
        { artist: "troilo", title: "A" },
        { artist: "troilo", title: "B" },
      ],
      usedGroups: new Set(["di sarli"]),
      requiredCount: 2,
      getArtistGroupKey: (item) => item.artist,
      getTitleKey: (item) => item.title,
    });
    expect(Array.from(groups)).toEqual(["troilo"]);
  });
});

describe("collectEligibleArtistStyleGroups", () => {
  it("keeps alternative styles available for the same artist", () => {
    const groups = collectEligibleArtistStyleGroups({
      items: [
        { artist: "d'arienzo", style: "tango", title: "A" },
        { artist: "d'arienzo", style: "tango", title: "B" },
        { artist: "d'arienzo", style: "waltz", title: "C" },
        { artist: "d'arienzo", style: "waltz", title: "D" },
      ],
      usedGroups: new Set(["d'arienzo|tango"]),
      requiredCount: 2,
      getArtistGroupKey: (item) => item.artist,
      getStyleKey: (item) => item.style,
      getTitleKey: (item) => item.title,
    });
    expect(Array.from(groups)).toEqual(["d'arienzo|waltz"]);
  });

  it("requires distinct titles inside each artist+style group", () => {
    const groups = collectEligibleArtistStyleGroups({
      items: [
        { artist: "troilo", style: "milonga", title: "A" },
        { artist: "troilo", style: "milonga", title: "A" },
        { artist: "troilo", style: "milonga", title: "B" },
      ],
      usedGroups: new Set<string>(),
      requiredCount: 2,
      getArtistGroupKey: (item) => item.artist,
      getStyleKey: (item) => item.style,
      getTitleKey: (item) => item.title,
    });
    expect(Array.from(groups)).toEqual(["troilo|milonga"]);
  });
});

describe("isTandaArtistStyleAvailable", () => {
  it("allows tanda when artist+style group is unused and size matches", () => {
    expect(
      isTandaArtistStyleAvailable({
        artistGroup: "d'arienzo",
        styleGroup: "tango",
        trackCount: 3,
        requiredCount: 3,
        usedGroups: new Set(["d'arienzo|waltz"]),
      }),
    ).toBe(true);
  });

  it("blocks tanda when same artist+style group is already used", () => {
    expect(
      isTandaArtistStyleAvailable({
        artistGroup: "d'arienzo",
        styleGroup: "tango",
        trackCount: 3,
        requiredCount: 3,
        usedGroups: new Set(["d'arienzo|tango"]),
      }),
    ).toBe(false);
  });
});

describe("buildAdaptiveNumericDistribution", () => {
  it("fills missing numeric buckets between min and max when range is small", () => {
    const rows = buildAdaptiveNumericDistribution(
      new Map([[1931, 2], [1933, 1]]),
      30,
      30,
    );
    expect(rows).toEqual([
      { label: "1931", value: 2 },
      { label: "1932", value: 0 },
      { label: "1933", value: 1 },
    ]);
  });

  it("switches to histogram mode when range exceeds threshold", () => {
    const rows = buildAdaptiveNumericDistribution(
      new Map([
        [1900, 1],
        [1930, 2],
        [1960, 3],
      ]),
      30,
      3,
    );
    expect(rows).toEqual([
      { label: "1900-1919", value: 1 },
      { label: "1920-1939", value: 2 },
      { label: "1940-1960", value: 3 },
    ]);
  });

  it("returns empty rows for empty input", () => {
    expect(buildAdaptiveNumericDistribution(new Map())).toEqual([]);
  });
});

describe("buildAdaptiveStyleNumericDistribution", () => {
  it("fills missing dense buckets and preserves per-style values", () => {
    const rows = buildAdaptiveStyleNumericDistribution(
      new Map([
        [60, { tango: 2 }],
        [62, { tango: 1, milonga: 3 }],
      ]),
      30,
      30,
    );
    expect(rows).toEqual([
      { label: "60", value: 2, styleValues: { tango: 2 } },
      { label: "61", value: 0, styleValues: {} },
      { label: "62", value: 4, styleValues: { tango: 1, milonga: 3 } },
    ]);
  });

  it("switches to histogram mode and merges style totals", () => {
    const rows = buildAdaptiveStyleNumericDistribution(
      new Map([
        [100, { tango: 2 }],
        [130, { milonga: 3 }],
        [160, { tango: 1, vals: 4 }],
      ]),
      30,
      3,
    );
    expect(rows).toEqual([
      { label: "100-119", value: 2, styleValues: { tango: 2 } },
      { label: "120-139", value: 3, styleValues: { milonga: 3 } },
      { label: "140-160", value: 5, styleValues: { tango: 1, vals: 4 } },
    ]);
  });
});

describe("aggregateOrchestraDurations", () => {
  it("aggregates total/style seconds and unique tanda count per artist", () => {
    const rows = aggregateOrchestraDurations([
      {
        artist: "Di Sarli",
        seconds: 180,
        style: "tango",
        tandaId: "t1",
      },
      {
        artist: "Di Sarli",
        seconds: 170,
        style: "vals",
        tandaId: "t1",
      },
      {
        artist: "Di Sarli",
        seconds: 160,
        style: "tango",
        tandaId: "t2",
      },
      {
        artist: "Troilo",
        seconds: 200,
        style: "milonga",
        tandaId: "t3",
      },
      {
        artist: "Troilo",
        seconds: 120,
        style: "milonga",
        tandaId: null,
      },
    ]);
    expect(rows).toEqual([
      {
        label: "Di Sarli",
        totalSeconds: 510,
        tandaCount: 2,
        styleSeconds: { tango: 340, vals: 170 },
      },
      {
        label: "Troilo",
        totalSeconds: 320,
        tandaCount: 1,
        styleSeconds: { milonga: 320 },
      },
    ]);
  });
});
