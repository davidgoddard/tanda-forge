import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  hasUsableWaveformPng,
  readUsableWaveformDataUrl,
} from "../app/src/main/library/analysis";

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

  it("reads only an existing usable waveform without generating a missing one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-waveform-read-"));
    const missing = path.join(dir, "missing.png");
    const usable = path.join(dir, "usable.png");
    const content = Buffer.alloc(101, 7);
    fs.writeFileSync(usable, content);

    expect(readUsableWaveformDataUrl(missing)).toBeNull();
    expect(fs.existsSync(missing)).toBe(false);
    expect(readUsableWaveformDataUrl(usable)).toBe(
      `data:image/png;base64,${content.toString("base64")}`,
    );
  });
});
