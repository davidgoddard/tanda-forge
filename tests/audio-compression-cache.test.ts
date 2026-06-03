import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildCompressedRenderTempPath,
  buildPlayableRenderTempPath,
  hasUsableCompressedRender,
} from "../app/src/main/library/analysis";
import { buildCompressedCachePath } from "../app/src/main/library/compression-cache";
import { buildPlayableCachePath } from "../app/src/main/library/playable-cache";

describe("compressed render cache helpers", () => {
  it("derives a temp path beside the final cache target", () => {
    expect(buildCompressedRenderTempPath("/tmp/cache/output.wav")).toMatch(
      /\/tmp\/cache\/output\.wav\.\d+\.tmp\.wav$/,
    );
    expect(buildPlayableRenderTempPath("/tmp/cache/playable.wav")).toMatch(
      /\/tmp\/cache\/playable\.wav\.\d+\.tmp\.wav$/,
    );
  });

  it("accepts only non-empty rendered wav files as usable cache entries", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-compression-cache-"));
    const missing = path.join(dir, "missing.wav");
    const empty = path.join(dir, "empty.wav");
    const tiny = path.join(dir, "tiny.wav");
    const valid = path.join(dir, "valid.wav");

    fs.writeFileSync(empty, "");
    fs.writeFileSync(tiny, Buffer.alloc(44));
    fs.writeFileSync(valid, Buffer.alloc(45));

    expect(hasUsableCompressedRender(missing)).toBe(false);
    expect(hasUsableCompressedRender(empty)).toBe(false);
    expect(hasUsableCompressedRender(tiny)).toBe(false);
    expect(hasUsableCompressedRender(valid)).toBe(true);
  });

  it("builds a stable cache output path for a track/config pair", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-compression-cache-key-"));
    const filePath = path.join(dir, "track.wav");
    fs.writeFileSync(filePath, Buffer.alloc(64));
    const stat = fs.statSync(filePath);

    const cachePath = buildCompressedCachePath(dir, filePath, stat, {
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

    expect(cachePath).toMatch(/\.wav$/);
    expect(path.dirname(cachePath)).toBe(dir);
  });

  it("builds a stable playable cache output path for a track", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-playable-cache-key-"));
    const filePath = path.join(dir, "track.aiff");
    fs.writeFileSync(filePath, Buffer.alloc(64));
    const stat = fs.statSync(filePath);

    const cachePath = buildPlayableCachePath(dir, filePath, stat);

    expect(cachePath).toMatch(/\.wav$/);
    expect(path.dirname(cachePath)).toBe(dir);
  });
});
