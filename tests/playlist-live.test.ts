import { describe, expect, it } from "vitest";
import {
  computeCortinaStartOffsetMs,
  computeElapsedMsForEntry,
  computeTimelineTotalMs,
} from "../app/src/shared/playlist-live";

describe("playlist live timing helpers", () => {
  it("computes elapsed time within an entry", () => {
    const elapsed = computeElapsedMsForEntry({
      offsetMs: 0,
      trackDurationsMs: [180000, 120000, 180000],
      trackIndex: 1,
      gapBetweenTracksMs: 2000,
      progressMs: 30000,
    });
    expect(elapsed).toBe(180000 + 2000 + 30000);
  });

  it("computes cortina start offsets", () => {
    const offset = computeCortinaStartOffsetMs(100000, 4000, 2000, 40000, 2000);
    expect(offset).toBe(100000 - 48000);
  });

  it("computes total timeline duration", () => {
    const total = computeTimelineTotalMs(
      [0, 64000],
      [
        { index: 0, durationMs: 60000, trackDurationsMs: [60000] },
        { index: 1, durationMs: 60000, trackDurationsMs: [60000] },
      ],
    );
    expect(total).toBe(124000);
  });
});
