import { describe, expect, it, vi } from "vitest";
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
      shouldUseAudioDspForMainOutput: () => true,
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

  it("does not attach dsp runtime for compressed companion on non-default outputs", async () => {
    const ensureAudioDspRuntime = vi.fn();
    const originalAudio = globalThis.Audio;
    class FakeAudio extends EventTarget {
      loop = false;
      paused = true;
      currentTime = 0;
      duration = 0;
      src = "";
      async play() {
        this.paused = false;
      }
      pause() {
        this.paused = true;
      }
      addEventListener = EventTarget.prototype.addEventListener;
    }
    Object.assign(globalThis, { Audio: FakeAudio as unknown as typeof Audio });
    const controller = createPlaybackCompressionController({
      getAudioDynamicsConfig: () => ({ enabled: true, depth: 50 }),
      requestCompressedSource: async () => "/tmp/compressed.wav",
      setStatus: () => {},
      translate: (key) => key,
      isCompressionRequestedForChannel: () => true,
      stopCompressedCompanion: async () => {},
      ensureAudioDspRuntime,
      releaseAudioDspRuntime: async () => {},
      applyOutputDevice: async (_audio, deviceId) => ({
        requestedDeviceId: deviceId,
        appliedDeviceId: deviceId,
        method: "setSinkId",
        error: null,
        attemptedDeviceIds: deviceId ? [deviceId] : [],
      }),
      applyDynamicLevelToMain: () => {},
      updateNowPlayingDisplay: () => {},
      resolveOutputDeviceIdForMain: () => "dragonfly-id",
      shouldUseAudioDspForMainOutput: () => false,
      appMode: () => "prep",
      playlistState: () => ({ status: "idle", index: 0, trackIndex: 0 }),
    });

    try {
      const state = {
        active: { paused: true, currentTime: 0 } as unknown as HTMLAudioElement,
        currentTrackId: "t1",
        track: { id: "t1", full_path: "/a.mp3", loudness_db: -16 },
        appliedGainDb: 0,
        isCortinaPlayback: false,
      };

      await controller.ensureMainCompressedCompanion(state, state.track);

      expect(ensureAudioDspRuntime).not.toHaveBeenCalled();
    } finally {
      Object.assign(globalThis, { Audio: originalAudio });
    }
  });
});
