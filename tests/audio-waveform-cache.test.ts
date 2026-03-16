import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { hasUsableWaveformPng } from "../app/src/main/library/analysis";

describe("waveform cache helpers", () => {
  it("accepts only non-trivial waveform png files as usable", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-waveform-cache-"));
    const missing = path.join(dir, "missing.png");
    const tiny = path.join(dir, "tiny.png");
    const usable = path.join(dir, "usable.png");

    fs.writeFileSync(tiny, Buffer.alloc(100));
    fs.writeFileSync(usable, Buffer.alloc(101));

    expect(hasUsableWaveformPng(missing)).toBe(false);
    expect(hasUsableWaveformPng(tiny)).toBe(false);
    expect(hasUsableWaveformPng(usable)).toBe(true);
  });
});
