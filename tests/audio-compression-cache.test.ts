import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildCompressedRenderTempPath,
  hasUsableCompressedRender,
} from "../app/src/main/library/analysis";

describe("compressed render cache helpers", () => {
  it("derives a temp path beside the final cache target", () => {
    expect(buildCompressedRenderTempPath("/tmp/cache/output.wav")).toMatch(
      /\/tmp\/cache\/output\.wav\.\d+\.tmp\.wav$/,
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
});
