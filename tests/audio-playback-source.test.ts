import { describe, expect, it } from "vitest";
import { requiresPlaybackTranscode } from "../app/src/shared/audio-playback-source";

describe("audio playback source helpers", () => {
  it("requires transparent playback transcode for AIFF variants", () => {
    expect(requiresPlaybackTranscode("/music/track.aiff")).toBe(true);
    expect(requiresPlaybackTranscode("/music/track.AIF")).toBe(true);
    expect(requiresPlaybackTranscode("C:\\music\\track.aif")).toBe(true);
    expect(requiresPlaybackTranscode("C:\\music\\track.AIFF")).toBe(true);
    expect(requiresPlaybackTranscode("/music/track.wav")).toBe(false);
    expect(requiresPlaybackTranscode("/music/track.mp3")).toBe(false);
  });
});
