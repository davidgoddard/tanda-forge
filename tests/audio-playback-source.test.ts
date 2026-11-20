import { describe, expect, it } from "vitest";
import {
  requiresCodecAwarePlaybackTranscode,
  requiresPlaybackTranscode,
  shouldWarmPlaybackTranscode,
} from "../app/src/shared/audio-playback-source";

describe("audio playback source helpers", () => {
  it("requires transparent playback transcode for AIFF variants", () => {
    expect(requiresPlaybackTranscode("/music/track.aiff")).toBe(true);
    expect(requiresPlaybackTranscode("/music/track.AIF")).toBe(true);
    expect(requiresPlaybackTranscode("C:\\music\\track.aif")).toBe(true);
    expect(requiresPlaybackTranscode("C:\\music\\track.AIFF")).toBe(true);
    expect(requiresPlaybackTranscode("/music/track.m4a")).toBe(true);
    expect(requiresPlaybackTranscode("/music/track.wav")).toBe(false);
    expect(requiresPlaybackTranscode("/music/track.mp3")).toBe(false);
  });

  it("transcodes ALAC-in-M4A without unnecessarily converting AAC", () => {
    expect(requiresCodecAwarePlaybackTranscode("/music/track.m4a", "alac")).toBe(true);
    expect(requiresCodecAwarePlaybackTranscode("/music/track.M4A", "ALAC")).toBe(true);
    expect(requiresCodecAwarePlaybackTranscode("/music/track.m4a", "aac")).toBe(false);
    expect(requiresCodecAwarePlaybackTranscode("/music/track.m4a", null)).toBe(true);
    expect(requiresCodecAwarePlaybackTranscode("/music/track.aiff", null)).toBe(true);
    expect(requiresCodecAwarePlaybackTranscode("/music/track.mp3", "alac")).toBe(false);
  });

  it("keeps M4A conversion on demand instead of warming it at startup", () => {
    expect(shouldWarmPlaybackTranscode("/music/track.aiff")).toBe(true);
    expect(shouldWarmPlaybackTranscode("/music/track.AIF")).toBe(true);
    expect(shouldWarmPlaybackTranscode("/music/track.m4a")).toBe(false);
  });
});
