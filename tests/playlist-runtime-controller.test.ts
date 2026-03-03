import { describe, expect, it } from "vitest";
import { createPlaylistRuntimeController } from "../app/src/renderer/controllers/playlist-runtime-controller";

describe("playlist runtime controller", () => {
  it("starts playback when idle", () => {
    const calls: string[] = [];
    let playback = {
      status: "idle" as const,
      currentIndex: 0,
      currentTrackIndex: 0,
      activeTrackId: null,
      activeTandaId: null,
      resume: null,
      liveBaseStartMs: null,
    };
    const controller = createPlaylistRuntimeController({
      getPlaylistPlayback: () => playback,
      setPlaylistPlayback: (next) => {
        playback = { ...playback, ...next };
      },
      runPlaylistPlayback: async (resume) => {
        calls.push(resume ? "resume" : "start");
      },
      getMainPlayback: () => ({}),
      setMainPlayback: () => {},
      getStopFadeSeconds: () => 0,
      fadeOutAudio: async () => {},
      releaseAudioDspRuntime: async () => {},
      stopCompressedCompanion: async () => {},
      setCortinaDisplayPhase: () => {},
      renderPlaylist: () => {},
    });

    controller.startPlaylistPlayback();
    expect(calls).toEqual(["start"]);
  });
});
