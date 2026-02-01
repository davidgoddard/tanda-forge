import { describe, expect, it } from "vitest";
import { computeTandaStartOffsetsMs } from "../app/src/shared/playlist-timing";

describe("playlist timing", () => {
  it("computes offsets without cortinas", () => {
    const offsets = computeTandaStartOffsetsMs({
      tandaDurationsMs: [60000, 60000],
      gapBeforeTandaMs: 4000,
      gapBeforeCortinaMs: 0,
      cortinaDurationMs: 0,
      cortinaFadeMs: 0,
      cortinaEnabled: false,
    });
    expect(offsets).toEqual([0, 64000]);
  });

  it("computes offsets with cortinas", () => {
    const offsets = computeTandaStartOffsetsMs({
      tandaDurationsMs: [60000, 60000],
      gapBeforeTandaMs: 4000,
      gapBeforeCortinaMs: 2000,
      cortinaDurationMs: 40000,
      cortinaFadeMs: 2000,
      cortinaEnabled: true,
    });
    expect(offsets).toEqual([48000, 156000]);
  });
});
