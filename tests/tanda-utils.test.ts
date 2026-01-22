import { describe, expect, it } from "vitest";
import {
  deriveInstrumental,
  effectiveDurationMs,
  sumEffectiveDurationMs,
  summarizeTandaTracks,
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
  });
});
