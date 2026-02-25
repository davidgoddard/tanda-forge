import { describe, expect, it } from "vitest";
import { computeScaledPercent } from "../app/src/shared/chart-scale";

describe("computeScaledPercent", () => {
  it("scales max value to 100 percent by default", () => {
    expect(computeScaledPercent(50, 50)).toBe(100);
  });

  it("applies minimum percent for positive values", () => {
    expect(computeScaledPercent(1, 100, { minPercent: 4 })).toBe(4);
  });

  it("returns zero for invalid or non-positive values", () => {
    expect(computeScaledPercent(0, 100)).toBe(0);
    expect(computeScaledPercent(-2, 100)).toBe(0);
    expect(computeScaledPercent(10, 0)).toBe(0);
  });
});
