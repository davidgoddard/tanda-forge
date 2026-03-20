import { describe, expect, it } from "vitest";

import {
  SILENCE_DETECT_NOISE_DB,
  buildCommandLine,
  buildSilenceDetectFilter,
} from "../app/src/main/library/analysis";

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

  it("uses a conservative silence threshold for end-trim detection", () => {
    expect(SILENCE_DETECT_NOISE_DB).toBe(-40);
    expect(buildSilenceDetectFilter()).toBe("silencedetect=noise=-40dB:d=0.2");
  });
});
