import { describe, expect, it } from "vitest";
import {
  computeTapTempoBpm,
  formatTrackEditorBpm,
  trackEditorBpmDiffers,
} from "../app/src/renderer/modules/track-editor-view";

describe("track editor tap tempo", () => {
  it("returns rounded bpm from tap intervals", () => {
    expect(computeTapTempoBpm([0, 500, 1000])).toBe(120);
  });

  it("returns null for insufficient taps", () => {
    expect(computeTapTempoBpm([100])).toBeNull();
  });

  it("formats bpm the same way the editor field displays it", () => {
    expect(formatTrackEditorBpm(65.4)).toBe("65");
    expect(formatTrackEditorBpm(65.6)).toBe("66");
    expect(formatTrackEditorBpm(null)).toBe("");
  });

  it("does not mark untouched rounded bpm values as dirty", () => {
    expect(trackEditorBpmDiffers(65.4, "65")).toBe(false);
    expect(trackEditorBpmDiffers(65.6, "66")).toBe(false);
    expect(trackEditorBpmDiffers(65.4, "66")).toBe(true);
    expect(trackEditorBpmDiffers(null, "")).toBe(false);
  });
});
