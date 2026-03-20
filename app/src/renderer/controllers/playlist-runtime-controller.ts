export type PlaylistPlaybackState = {
  status: "idle" | "playing" | "paused";
  currentIndex: number;
  currentTrackIndex: number;
  activeTrackId: string | null;
  activeTandaId: string | null;
  resume: {
    itemIndex: number;
    trackIndex: number;
    trackId: string;
    resumeTime: number;
  } | null;
  liveBaseStartMs: number | null;
};

export type PlaylistRuntimeControllerDeps = {
  getPlaylistPlayback: () => PlaylistPlaybackState;
  setPlaylistPlayback: (next: Partial<PlaylistPlaybackState>) => void;
  runPlaylistPlayback: (resume: boolean) => Promise<void>;
  getMainPlayback: () => {
    active?: HTMLAudioElement;
    currentTrackId?: string;
    track?: unknown;
    appliedGainDb?: number | null;
    isCortinaPlayback?: boolean;
    usingCompressedSource?: boolean;
    activeSourcePath?: string;
    originalSourcePath?: string;
    compressedSourcePath?: string;
  };
  setMainPlayback: (next: Partial<ReturnType<PlaylistRuntimeControllerDeps["getMainPlayback"]>>) => void;
  getStopFadeSeconds: () => number;
  fadeOutAudio: (audio: HTMLAudioElement, durationMs: number) => Promise<boolean | void>;
  releaseAudioDspRuntime: (audio: HTMLAudioElement) => Promise<void>;
  stopCompressedCompanion: () => Promise<void>;
  setCortinaDisplayPhase: (phase: "none" | "about" | "playing" | "after") => void;
  renderPlaylist: () => void;
};

export const createPlaylistRuntimeController = (deps: PlaylistRuntimeControllerDeps) => {
  const startPlaylistPlayback = () => {
    const playback = deps.getPlaylistPlayback();
    if (playback.status === "playing") {
      return;
    }
    deps.setPlaylistPlayback({ resume: null });
    void deps.runPlaylistPlayback(false);
  };

  const resumePlaylistPlayback = () => {
    const playback = deps.getPlaylistPlayback();
    if (playback.status !== "paused" || !playback.resume) {
      return;
    }
    void deps.runPlaylistPlayback(true);
  };

  const stopPlaylistPlayback = async () => {
    const playback = deps.getPlaylistPlayback();
    if (playback.status !== "playing") {
      return;
    }
    deps.setPlaylistPlayback({ status: "paused", liveBaseStartMs: null });

    const main = deps.getMainPlayback();
    const active = main.active;
    if (active && main.currentTrackId) {
      deps.setPlaylistPlayback({
        resume: {
          itemIndex: playback.currentIndex,
          trackIndex: playback.currentTrackIndex,
          trackId: main.currentTrackId,
          resumeTime: active.currentTime ?? 0,
        },
      });
      const durationMs = deps.getStopFadeSeconds() * 1000;
      if (durationMs > 0) {
        await deps.fadeOutAudio(active, durationMs);
      }
      active.pause();
      await deps.releaseAudioDspRuntime(active);
    }

    await deps.stopCompressedCompanion();
    deps.setMainPlayback({
      active: undefined,
      currentTrackId: undefined,
      track: undefined,
      appliedGainDb: null,
      isCortinaPlayback: false,
      usingCompressedSource: false,
      activeSourcePath: undefined,
      originalSourcePath: undefined,
      compressedSourcePath: undefined,
    });

    deps.setCortinaDisplayPhase("none");
    deps.setPlaylistPlayback({
      activeTrackId: null,
      activeTandaId: null,
    });
    deps.renderPlaylist();
  };

  return {
    startPlaylistPlayback,
    resumePlaylistPlayback,
    stopPlaylistPlayback,
  };
};
