import { describe, expect, it } from "vitest";
import { computeTapTempoBpm } from "../app/src/renderer/modules/track-editor-view";

describe("track editor tap tempo", () => {
  it("returns rounded bpm from tap intervals", () => {
    expect(computeTapTempoBpm([0, 500, 1000])).toBe(120);
  });

  it("returns null for insufficient taps", () => {
    expect(computeTapTempoBpm([100])).toBeNull();
  });
});
