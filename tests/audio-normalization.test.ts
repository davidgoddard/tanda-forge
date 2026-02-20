import { describe, expect, it } from "vitest";
import {
  gainDbToLinear,
  resolvePlaybackNormalization,
  resolvePlaybackGainDb,
} from "../app/src/shared/audio-normalization";

describe("resolvePlaybackGainDb", () => {
  it("applies drift correction to explicit gain when loudness drifts from target", () => {
    expect(resolvePlaybackGainDb(-3.2, -20)).toBeCloseTo(1.12, 2);
  });

  it("falls back to loudness-derived gain when direct gain is missing", () => {
    expect(resolvePlaybackGainDb(null, -20)).toBeCloseTo(4);
    expect(resolvePlaybackGainDb(undefined, -10)).toBeCloseTo(-6);
  });

  it("returns null when neither value is usable", () => {
    expect(resolvePlaybackGainDb(null, null)).toBeNull();
  });
});

describe("resolvePlaybackNormalization", () => {
  it("reports source and correction diagnostics", () => {
    const result = resolvePlaybackNormalization(-3.2, -20);
    expect(result.source).toBe("gain");
    expect(result.correctionDb).toBeCloseTo(4.32, 2);
    expect(result.driftDb).toBeCloseTo(7.2, 2);
    expect(result.gainDb).toBeCloseTo(1.12, 2);
  });

  it("reports loudness fallback source", () => {
    const result = resolvePlaybackNormalization(undefined, -18);
    expect(result.source).toBe("loudness");
    expect(result.gainDb).toBeCloseTo(2);
    expect(result.correctionDb).toBe(0);
  });
});

describe("gainDbToLinear", () => {
  it("converts db values to linear gain", () => {
    expect(gainDbToLinear(0)).toBeCloseTo(1);
    expect(gainDbToLinear(-6)).toBeCloseTo(0.5011, 3);
  });

  it("caps the maximum linear gain", () => {
    expect(gainDbToLinear(12, 2)).toBeCloseTo(2);
  });
});
