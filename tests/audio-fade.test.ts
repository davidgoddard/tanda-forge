import { describe, expect, it } from "vitest";
import { computeFadeDurationMs } from "../app/src/shared/audio-fade";

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
