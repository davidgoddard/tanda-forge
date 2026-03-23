import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildCompressedCacheKey } from "../app/src/main/library/compression-cache";

describe("compressed cache key", () => {
  it("does not vary with playback depth percent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-compression-key-"));
    const filePath = path.join(dir, "track.wav");
    fs.writeFileSync(filePath, Buffer.alloc(64));
    const stat = fs.statSync(filePath);

    const lowDepth = buildCompressedCacheKey(filePath, stat, {
      loudnessDb: -18,
      depthPercent: 25,
      mode: "upward",
      liftThresholdDb: -24,
      maxLiftDb: 8,
      ratio: 4,
      attackMs: 5,
      releaseMs: 250,
      gateThresholdDb: -50,
      limiterCeilingDb: -1,
      limiterReleaseMs: 150,
    });
    const highDepth = buildCompressedCacheKey(filePath, stat, {
      loudnessDb: -18,
      depthPercent: 100,
      mode: "upward",
      liftThresholdDb: -24,
      maxLiftDb: 8,
      ratio: 4,
      attackMs: 5,
      releaseMs: 250,
      gateThresholdDb: -50,
      limiterCeilingDb: -1,
      limiterReleaseMs: 150,
    });

    expect(lowDepth).toBe(highDepth);
  });
});
