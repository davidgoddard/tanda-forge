import { describe, expect, it } from "vitest";
import { computeTrimmedEnd } from "../app/src/shared/audio-trim";

describe("computeTrimmedEnd", () => {
  it("returns null for invalid durations", () => {
    expect(computeTrimmedEnd(0, 0, 0)).toBeNull();
    expect(computeTrimmedEnd(-1, 0, 0)).toBeNull();
    expect(computeTrimmedEnd(Number.NaN, 0, 0)).toBeNull();
  });

  it("trims from the end and honors start offset", () => {
    expect(computeTrimmedEnd(100, 0, 5)).toBe(95);
    expect(computeTrimmedEnd(100, 10, 5)).toBe(95);
    expect(computeTrimmedEnd(100, 98, 5)).toBe(98);
  });

  it("clamps end trim to non-negative", () => {
    expect(computeTrimmedEnd(10, 0, -5)).toBe(10);
  });
});
