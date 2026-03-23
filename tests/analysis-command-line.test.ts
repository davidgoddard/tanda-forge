import { describe, expect, it } from "vitest";

import {
  SILENCE_DETECT_NOISE_DB,
  buildCommandLine,
  buildSilenceDetectFilter,
  deriveTrimOffsetsFromSilence,
  parseSilenceDetectOutput,
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

  it("parses multiple silence sections from ffmpeg output", () => {
    expect(
      parseSilenceDetectOutput(
        "[silencedetect] silence_start: 0\n[silencedetect] silence_end: 0.42 | silence_duration: 0.42\n[silencedetect] silence_start: 198.1\n[silencedetect] silence_end: 201.0 | silence_duration: 2.9\n",
      ),
    ).toEqual({
      silenceStarts: [0, 198.1],
      silenceEnds: [0.42, 201.0],
    });
  });

  it("trims only from truly trailing silence, not an earlier quiet passage", () => {
    expect(
      deriveTrimOffsetsFromSilence(220000, [0, 20.2, 218.7], [0.5, 21.1, 220.0]),
    ).toEqual({
      startOffsetMs: 500,
      endTrimMs: 1300,
    });
  });

  it("does not shorten the track when the last silence ends well before the file end", () => {
    expect(
      deriveTrimOffsetsFromSilence(220000, [0, 20.2], [0.5, 21.1]),
    ).toEqual({
      startOffsetMs: 500,
      endTrimMs: 0,
    });
  });
});
