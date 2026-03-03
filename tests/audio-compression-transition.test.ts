import { describe, expect, it } from "vitest";
import {
  initialCompressionPlaybackState,
  reduceCompressionPlaybackState,
  resolveCompressionMixState,
} from "../app/src/shared/audio-compression-transition";

describe("compression playback transitions", () => {
  it("keeps slider at zero until render is ready", () => {
    const started = reduceCompressionPlaybackState(initialCompressionPlaybackState(), {
      type: "track_started",
      trackId: "t1",
      outputPath: "/music/a.mp3",
      depthPercent: 80,
    });

    const duringRender = resolveCompressionMixState(started);
    expect(duringRender.sliderEnabled).toBe(false);
    expect(duringRender.displayedDepthPercent).toBe(0);

    const ready = reduceCompressionPlaybackState(started, {
      type: "render_succeeded",
      compressedPath: "/cache/a.wav",
    });
    const afterRender = resolveCompressionMixState(ready);
    expect(afterRender.sliderEnabled).toBe(true);
    expect(afterRender.displayedDepthPercent).toBe(80);
    expect(afterRender.useCompressedPlayback).toBe(true);
  });

  it("drops to original mix when depth becomes zero", () => {
    const ready = reduceCompressionPlaybackState(
      reduceCompressionPlaybackState(initialCompressionPlaybackState(), {
        type: "track_started",
        trackId: "t1",
        outputPath: "/music/a.mp3",
        depthPercent: 50,
      }),
      { type: "render_succeeded", compressedPath: "/cache/a.wav" },
    );

    const zero = reduceCompressionPlaybackState(ready, {
      type: "depth_changed",
      depthPercent: 0,
    });

    const resolved = resolveCompressionMixState(zero);
    expect(resolved.sliderEnabled).toBe(true);
    expect(resolved.displayedDepthPercent).toBe(0);
    expect(resolved.useCompressedPlayback).toBe(false);
  });

  it("clears runtime state when stopped", () => {
    const running = reduceCompressionPlaybackState(initialCompressionPlaybackState(), {
      type: "track_started",
      trackId: "t9",
      outputPath: "/music/z.mp3",
      depthPercent: 100,
    });
    const stopped = reduceCompressionPlaybackState(running, { type: "stopped" });
    expect(stopped).toEqual(initialCompressionPlaybackState());
  });
});
