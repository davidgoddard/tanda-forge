import { describe, expect, it } from "vitest";

import { buildCommandLine } from "../app/src/main/library/analysis";

describe("buildCommandLine", () => {
  it("quotes arguments with spaces and apostrophes for shell reuse", () => {
    expect(
      buildCommandLine("/usr/local/bin/ffmpeg", [
        "-i",
        "/tmp/O'Connor Test/input song.mp3",
        "-af",
        "acompressor=threshold=-32dB:ratio=4",
        "/tmp/output file.wav",
      ]),
    ).toBe(
      "/usr/local/bin/ffmpeg -i '/tmp/O'\\''Connor Test/input song.mp3' -af acompressor=threshold=-32dB:ratio=4 '/tmp/output file.wav'",
    );
  });
});
