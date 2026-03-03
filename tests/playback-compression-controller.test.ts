import { describe, expect, it } from "vitest";
import { createPlaybackCompressionController } from "../app/src/renderer/controllers/playback-compression-controller";

describe("playback compression controller", () => {
  it("returns original path when compression is not requested", async () => {
    const controller = createPlaybackCompressionController({
      getAudioDynamicsConfig: () => ({ enabled: true, depth: 50 }),
      requestCompressedSource: async () => "/tmp/compressed.wav",
      setStatus: () => {},
      translate: (key) => key,
      isCompressionRequestedForChannel: () => false,
      stopCompressedCompanion: async () => {},
      ensureAudioDspRuntime: () => {},
      releaseAudioDspRuntime: async () => {},
      applyOutputDevice: async () => ({
        requestedDeviceId: null,
        appliedDeviceId: null,
        method: "default",
        error: null,
        attemptedDeviceIds: [],
      }),
      applyDynamicLevelToMain: () => {},
      updateNowPlayingDisplay: () => {},
      resolveOutputDeviceIdForMain: () => null,
      appMode: () => "prep",
      playlistState: () => ({ status: "idle", index: 0, trackIndex: 0 }),
    });

    const result = await controller.resolvePlaybackSource(
      "main",
      { id: "t1", full_path: "/a.mp3" },
      "/a.mp3",
    );
    expect(result.filePath).toBe("/a.mp3");
    expect(result.compressed).toBe(false);
  });
});
