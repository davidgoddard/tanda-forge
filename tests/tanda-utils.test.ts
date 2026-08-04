import { describe, expect, it } from "vitest";
import {
  collectStylesFromTracks,
  buildTandaArtistSortKey,
  deriveInstrumental,
  effectiveDurationMs,
  sumEffectiveDurationMs,
  summarizeTandaTracks,
  normalizeStyleName,
  summarizeArtistName,
  extractArtistCandidates,
  extractSingerName,
} from "../app/src/shared/tanda-utils";

describe("tanda utils", () => {
  it("calculates effective duration with trims", () => {
    expect(
      effectiveDurationMs({ duration_ms: 200000, start_offset_ms: 5000, end_trim_ms: 3000 }),
    ).toBe(192000);
  });

  it("returns zero for null track", () => {
    expect(effectiveDurationMs(null)).toBe(0);
  });

  it("sums effective durations", () => {
    const total = sumEffectiveDurationMs([
      { duration_ms: 120000, start_offset_ms: 0, end_trim_ms: 0 },
      { duration_ms: 180000, start_offset_ms: 5000, end_trim_ms: 5000 },
    ]);
    expect(total).toBe(290000);
  });

  it("derives instrumental only when all tracks are instrumental", () => {
    expect(
      deriveInstrumental([
        { duration_ms: 1, start_offset_ms: 0, end_trim_ms: 0, instrumental: true },
        { duration_ms: 1, start_offset_ms: 0, end_trim_ms: 0, instrumental: true },
      ]),
    ).toBe(true);
    expect(
      deriveInstrumental([
        { duration_ms: 1, start_offset_ms: 0, end_trim_ms: 0, instrumental: true },
        { duration_ms: 1, start_offset_ms: 0, end_trim_ms: 0 },
      ]),
    ).toBe(false);
    expect(deriveInstrumental([])).toBe(false);
  });

  it("summarizes artists and years", () => {
    const summary = summarizeTandaTracks([
      { artist: "Di Sarli", year: "1941", instrumental: true },
      { artist: "Di Sarli", year: "1940", instrumental: true },
      { artist: "Troilo", year: "1940", instrumental: true },
    ]);
    expect(summary.artists).toEqual([
      { name: "Di Sarli", count: 2 },
      { name: "Troilo", count: 1 },
    ]);
    expect(summary.years).toEqual(["1940", "1941"]);
    expect(summary.instrumental).toBe(true);
    expect(summary.instrumentalStatus).toBe("instrumental");
  });

  it("builds artist sort keys from summary data", () => {
    const summary = summarizeTandaTracks([
      { artist: "Di Sarli", year: "1941", instrumental: true },
      { artist: "Di Sarli", year: "1940", instrumental: true },
      { artist: "Troilo", year: "1940", instrumental: true },
    ]);
    expect(buildTandaArtistSortKey(summary, "Unknown")).toBe("di sarli, troilo");
    const emptySummary = summarizeTandaTracks([]);
    expect(buildTandaArtistSortKey(emptySummary, "Unknown")).toBe("unknown");
  });

  it("normalizes artist names for summaries", () => {
    expect(summarizeArtistName("Carlos Di Sarli y su orquesta tipica")).toBe(
      "Carlos Di Sarli",
    );
    expect(summarizeArtistName("Anibal Troilo and his orchestra")).toBe(
      "Anibal Troilo",
    );
    expect(summarizeArtistName("Juan D'Arienzo")).toBe("Juan D'Arienzo");
    expect(summarizeArtistName("Miguel Caló Y Su Orquesta Típica")).toBe(
      "Miguel Caló",
    );
    expect(summarizeArtistName("Aníbal Troilo and his orchestra")).toBe(
      "Aníbal Troilo",
    );
    expect(summarizeArtistName("Alfredo De Angelis, Dante/ Martel")).toBe(
      "Alfredo De Angelis",
    );
    expect(summarizeArtistName("Alfredo De Angelis canta Dante/Martel")).toBe(
      "Alfredo De Angelis",
    );
    expect(
      extractArtistCandidates("D'Agostino, Angel y su orquesta tipica"),
    ).toContain("Angel D'Agostino");
  });

  it("extracts singer names from markers", () => {
    expect(extractSingerName("Francisco Canaro con Ada Falcon")).toBe(
      "Ada Falcon",
    );
    expect(extractSingerName("Anibal Troilo with Fiorentino")).toBe(
      "Fiorentino",
    );
    expect(extractSingerName("Julio De Caro canta Ada Falcon")).toBe(
      "Ada Falcon",
    );
    expect(extractSingerName("Alfredo De Angelis cant Oscar Larroca")).toBe(
      "Oscar Larroca",
    );
    expect(extractSingerName("Orquesta Tipica Andariega feat. Marisol Martinez")).toBe(
      "Marisol Martinez",
    );
    expect(
      extractSingerName("Orquesta Tipica Andariega featuring Marisol Martinez"),
    ).toBe("Marisol Martinez");
    expect(extractSingerName("Francisco Canaro canta Arenas/ Lucero")).toBe(
      "Arenas / Lucero",
    );
    expect(
      extractSingerName("Orquesta Tipica Andariega", "Vida mia feat. Marisol Martinez"),
    ).toBe("Marisol Martinez");
    expect(
      extractSingerName("Carlos Di Sarli", "Mala Suerte (Canta ERNESTO FAMA)"),
    ).toBe("Ernesto Fama");
    expect(
      extractSingerName("Orquesta Misteriosa", "Tango Featuring Ricardo 'Ricardito' Reveira"),
    ).toBe("Ricardo 'Ricardito' Reveira");
    expect(extractSingerName("Di Sarli with his orchestra")).toBe("");
    expect(extractSingerName("Francisco Canaro con canto")).toBe("");
  });

  it("normalizes style names", () => {
    expect(normalizeStyleName("tango waltz")).toBe("Tango Waltz");
    expect(normalizeStyleName(["MILONGA", "Tango"])).toBe("Milonga");
    expect(normalizeStyleName("Tango / Vals")).toBe("Tango");
  });

  it("collects unique styles from tracks using available styles", () => {
    const styles = collectStylesFromTracks(
      [
        { genre: "Tango" },
        { genre: "Waltz" },
        { genre: "tango" },
        { genre: "Milonga" },
        { genre: "Unknown" },
      ],
      ["Tango", "Waltz"],
    );
    expect(styles.sort()).toEqual(["Tango", "Waltz"]);
  });
});
