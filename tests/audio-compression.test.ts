import { describe, expect, it } from "vitest";
import {
  COMPRESSION_TAIL_RESET_LEAD_SECONDS,
  isCompressionControlLockedForPrep,
  resolveCompressionProofState,
  shouldAutoResetCompressionMixNearEnd,
  shouldResetCompressionMixForNewTrack,
  shouldWarmCompressionInBackground,
  shouldUseCompressionSource,
} from "../app/src/shared/audio-compression";

describe("audio compression helpers", () => {
  it("uses compressed source on main channel when enabled and depth > 0, including cortinas", () => {
    expect(
      shouldUseCompressionSource({
        channel: "headphone",
        isCortinaPlayback: false,
        enabled: true,
        depthPercent: 100,
      }),
    ).toBe(false);
    expect(
      shouldUseCompressionSource({
        channel: "main",
        isCortinaPlayback: true,
        enabled: true,
        depthPercent: 100,
      }),
    ).toBe(true);
    expect(
      shouldUseCompressionSource({
        channel: "main",
        isCortinaPlayback: false,
        enabled: false,
        depthPercent: 100,
      }),
    ).toBe(false);
    expect(
      shouldUseCompressionSource({
        channel: "main",
        isCortinaPlayback: false,
        enabled: true,
        depthPercent: 0,
      }),
    ).toBe(false);
    expect(
      shouldUseCompressionSource({
        channel: "main",
        isCortinaPlayback: false,
        enabled: true,
        depthPercent: 35,
      }),
    ).toBe(true);
  });

  it("does not lock control in prep mode", () => {
    expect(
      isCompressionControlLockedForPrep({
        appMode: "live",
        isMainPlaying: true,
        usingCompressedSource: false,
      }),
    ).toBe(false);
    expect(
      isCompressionControlLockedForPrep({
        appMode: "prep",
        isMainPlaying: false,
        usingCompressedSource: false,
      }),
    ).toBe(false);
    expect(
      isCompressionControlLockedForPrep({
        appMode: "prep",
        isMainPlaying: true,
        usingCompressedSource: true,
      }),
    ).toBe(false);
    expect(
      isCompressionControlLockedForPrep({
        appMode: "prep",
        isMainPlaying: true,
        usingCompressedSource: false,
      }),
    ).toBe(false);
  });

  it("warms non-playlist main compression in the background without blocking click-start", () => {
    expect(
      shouldWarmCompressionInBackground({
        channel: "main",
        fromPlaylist: false,
        compressionRequested: true,
      }),
    ).toBe(true);
    expect(
      shouldWarmCompressionInBackground({
        channel: "main",
        fromPlaylist: true,
        compressionRequested: true,
      }),
    ).toBe(false);
    expect(
      shouldWarmCompressionInBackground({
        channel: "headphone",
        fromPlaylist: false,
        compressionRequested: true,
      }),
    ).toBe(false);
    expect(
      shouldWarmCompressionInBackground({
        channel: "main",
        fromPlaylist: false,
        compressionRequested: false,
      }),
    ).toBe(false);
  });

  it("resets mix for each new main track but not headphone or same-track restarts", () => {
    expect(
      shouldResetCompressionMixForNewTrack({
        channel: "main",
        previousTrackId: "track-1",
        nextTrackId: "track-2",
      }),
    ).toBe(true);
    expect(
      shouldResetCompressionMixForNewTrack({
        channel: "main",
        previousTrackId: "track-1",
        nextTrackId: "track-1",
      }),
    ).toBe(false);
    expect(
      shouldResetCompressionMixForNewTrack({
        channel: "headphone",
        previousTrackId: "track-1",
        nextTrackId: "track-2",
      }),
    ).toBe(false);
  });

  it("auto-resets mix near the effective playback end", () => {
    expect(
      shouldAutoResetCompressionMixNearEnd({
        enabled: true,
        depthPercent: 40,
        currentTimeSeconds: 101,
        startAtSeconds: 0,
        effectiveEndSeconds: 120,
      }),
    ).toBe(true);
    expect(
      shouldAutoResetCompressionMixNearEnd({
        enabled: true,
        depthPercent: 40,
        currentTimeSeconds: 99,
        startAtSeconds: 0,
        effectiveEndSeconds: 120,
      }),
    ).toBe(false);
    expect(
      shouldAutoResetCompressionMixNearEnd({
        enabled: true,
        depthPercent: 40,
        currentTimeSeconds: 12,
        startAtSeconds: 12,
        effectiveEndSeconds: 24,
        leadSeconds: COMPRESSION_TAIL_RESET_LEAD_SECONDS,
      }),
    ).toBe(true);
    expect(
      shouldAutoResetCompressionMixNearEnd({
        enabled: false,
        depthPercent: 40,
        currentTimeSeconds: 101,
        startAtSeconds: 0,
        effectiveEndSeconds: 120,
      }),
    ).toBe(false);
  });

  it("resolves proof state for now-playing compression source", () => {
    expect(
      resolveCompressionProofState({
        enabled: false,
        depthPercent: 80,
        channel: "main",
        isCortinaPlayback: false,
        usingCompressedSource: true,
      }),
    ).toBe("disabled");
    expect(
      resolveCompressionProofState({
        enabled: true,
        depthPercent: 0,
        channel: "main",
        isCortinaPlayback: false,
        usingCompressedSource: true,
      }),
    ).toBe("zero_mix");
    expect(
      resolveCompressionProofState({
        enabled: true,
        depthPercent: 50,
        channel: "headphone",
        isCortinaPlayback: false,
        usingCompressedSource: true,
      }),
    ).toBe("headphone_bypass");
    expect(
      resolveCompressionProofState({
        enabled: true,
        depthPercent: 50,
        channel: "main",
        isCortinaPlayback: false,
        usingCompressedSource: true,
      }),
    ).toBe("rendered");
    expect(
      resolveCompressionProofState({
        enabled: true,
        depthPercent: 50,
        channel: "main",
        isCortinaPlayback: false,
        usingCompressedSource: false,
      }),
    ).toBe("fallback_original");
  });
});
