import { describe, expect, it } from "vitest";
import { computeFadeDurationMs, computeCortinaFadeLevel } from "../app/src/shared/audio-fade";

describe("computeFadeDurationMs", () => {
  it("uses preferred duration when enough time remains", () => {
    expect(computeFadeDurationMs(400, 1000)).toBe(400);
  });

  it("uses remaining duration when less than preferred but still usable", () => {
    expect(computeFadeDurationMs(400, 180)).toBe(180);
  });

  it("uses a short minimum fade instead of hard cut for tiny remaining windows", () => {
    expect(computeFadeDurationMs(400, 20)).toBe(80);
  });

  it("returns zero when no time remains", () => {
    expect(computeFadeDurationMs(400, 0)).toBe(0);
  });
});

describe("cortina fade level", () => {
  it("eases into and out of the fade and reaches exact silence", () => {
    for (const start of [0.2, 1, 2]) {
      expect(computeCortinaFadeLevel(start, 0)).toBe(start);
      expect(computeCortinaFadeLevel(start, 0.01) / start).toBeGreaterThan(0.999);
      expect(computeCortinaFadeLevel(start, 0.25) / start).toBeCloseTo(0.853553, 6);
      expect(computeCortinaFadeLevel(start, 0.5) / start).toBeCloseTo(0.5, 10);
      expect(computeCortinaFadeLevel(start, 0.75) / start).toBeCloseTo(0.146447, 6);
      expect(computeCortinaFadeLevel(start, 0.99) / start).toBeLessThan(0.001);
      expect(computeCortinaFadeLevel(start, 1)).toBe(0);
    }
  });

  it("clamps progress and handles silent or invalid inputs safely", () => {
    expect(computeCortinaFadeLevel(0.5, -1)).toBe(0.5);
    expect(computeCortinaFadeLevel(0.5, 2)).toBe(0);
    for (const level of [0, -1, NaN, Infinity]) {
      expect(computeCortinaFadeLevel(level, 0.5)).toBe(0);
    }
    expect(computeCortinaFadeLevel(1, NaN)).toBe(0);
  });
});
