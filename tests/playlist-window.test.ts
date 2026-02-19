import { describe, expect, it } from "vitest";
import {
  computePlaylistWindowMinutes,
  parseClockMinutes,
} from "../app/src/shared/playlist-window";

describe("playlist window helpers", () => {
  it("parses valid clock values", () => {
    expect(parseClockMinutes("20:15", 1200)).toBe(1215);
    expect(parseClockMinutes("03:05", 1200)).toBe(185);
  });

  it("falls back for invalid clock values", () => {
    expect(parseClockMinutes("", 1200)).toBe(1200);
    expect(parseClockMinutes("99:99", 1200)).toBe(1439);
    expect(parseClockMinutes("bad", 1200)).toBe(1200);
  });

  it("computes same-day playlist windows", () => {
    expect(computePlaylistWindowMinutes(20 * 60, 23 * 60)).toBe(180);
  });

  it("computes overnight playlist windows", () => {
    expect(computePlaylistWindowMinutes(22 * 60 + 30, 2 * 60)).toBe(210);
  });

  it("treats equal start and end as full-day window", () => {
    expect(computePlaylistWindowMinutes(20 * 60, 20 * 60)).toBe(24 * 60);
  });
});
