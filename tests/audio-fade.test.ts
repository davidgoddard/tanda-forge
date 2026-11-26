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
  it("attenuates by equal decibel steps across the fade, including its tail", () => {
    for (const start of [0.2, 1, 2]) {
      const levels = [0, 0.2, 0.4, 0.6, 0.8].map((t) => computeCortinaFadeLevel(start, t));
      expect(levels[0]).toBe(start);
      for (let i = 1; i < levels.length; i += 1) {
        expect(20 * Math.log10(levels[i] / levels[i - 1])).toBeCloseTo(-12, 10);
      }
      expect(computeCortinaFadeLevel(start, 0.9999) / start).toBeLessThan(0.00101);
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
