import { shouldUseCompressionSource } from "../../shared/audio-compression.js";

export type OutputChannel = "main" | "headphone";

export type PlaybackState<TTrack> = {
  active?: HTMLAudioElement;
  compressedActive?: HTMLAudioElement;
  currentTrackId?: string;
  track?: TTrack;
  appliedGainDb?: number | null;
  isCortinaPlayback?: boolean;
  usingCompressedSource?: boolean;
  activeSourcePath?: string;
  originalSourcePath?: string;
  compressedSourcePath?: string;
  wetCompensationGain?: number;
  wetCompensationReferenceRatio?: number;
};

export type CompressionConfig = {
  enabled: boolean;
  depth: number;
};

export type TrackLike = {
  id: string;
  full_path: string;
  title?: string | null;
  artist?: string | null;
  loudness_db?: number | null;
};

export type OutputRoutingResult = {
  requestedDeviceId: string | null;
  appliedDeviceId: string | null;
  method: "default" | "setSinkId" | "selectAudioOutput" | "unsupported" | "failed";
  error: string | null;
  attemptedDeviceIds: string[];
};

export type PlaybackCompressionDeps<
  TTrack extends TrackLike,
  TConfig extends CompressionConfig,
> = {
  getAudioDynamicsConfig: () => TConfig;
  requestCompressedSource: (track: TTrack, config: TConfig) => Promise<string | null>;
  setStatus: (message: string) => void;
  translate: (key: string) => string;
  isCompressionRequestedForChannel: (channel: OutputChannel, options?: { isCortinaPlayback?: boolean }) => boolean;
  stopCompressedCompanion: (state: PlaybackState<TTrack>) => Promise<void>;
  ensureAudioDspRuntime: (audio: HTMLAudioElement) => void;
  releaseAudioDspRuntime: (audio: HTMLAudioElement) => Promise<void>;
  applyOutputDevice: (audio: HTMLAudioElement, deviceId: string | null) => Promise<OutputRoutingResult>;
  applyDynamicLevelToMain: () => void;
  updateNowPlayingDisplay: () => void;
  resolveOutputDeviceIdForMain: () => string | null;
  shouldUseAudioDspForMainOutput: (deviceId: string | null) => boolean;
  appMode: () => "prep" | "live" | "edit";
  playlistState: () => { status: string; index: number; trackIndex: number };
  logPlaybackDiagnostic?: (payload: unknown) => void;
};

export const createPlaybackCompressionController = <
  TTrack extends TrackLike,
  TConfig extends CompressionConfig,
>(
  deps: PlaybackCompressionDeps<TTrack, TConfig>,
) => {
  const resolvePlaybackSource = async (
    channel: OutputChannel,
    track: TTrack | null,
    originalPath: string,
    options?: { isCortinaPlayback?: boolean },
  ) => {
    if (!track || !deps.isCompressionRequestedForChannel(channel, options)) {
      return { filePath: originalPath, compressed: false };
    }
    const config = deps.getAudioDynamicsConfig();
    const compressed = await deps.requestCompressedSource(track, config);
    if (compressed) {
      return { filePath: compressed, compressed: true };
    }
    deps.setStatus(deps.translate("statusDspBypassedOutput"));
    return { filePath: originalPath, compressed: false };
  };

  const ensureMainCompressedCompanion = async (
    state: PlaybackState<TTrack>,
    track: TTrack | null,
  ) => {
    if (!state.active || !track) {
      return;
    }
    const config = deps.getAudioDynamicsConfig();
    if (
      !shouldUseCompressionSource({
        channel: "main",
        isCortinaPlayback: Boolean(state.isCortinaPlayback),
        enabled: config.enabled,
        depthPercent: config.depth,
      })
    ) {
      return;
    }
    const compressedPath = await deps.requestCompressedSource(track, config);
    if (!compressedPath) {
      return;
    }
    if (!state.active || state.currentTrackId !== track.id) {
      return;
    }
    if (state.compressedActive && state.activeSourcePath === compressedPath) {
      deps.applyDynamicLevelToMain();
      return;
    }

    await deps.stopCompressedCompanion(state);
    const wet = new Audio();
    wet.loop = false;
    const requestedOutputDeviceId = deps.resolveOutputDeviceIdForMain();
    if (deps.shouldUseAudioDspForMainOutput(requestedOutputDeviceId)) {
      deps.ensureAudioDspRuntime(wet);
    }
    const preAttachRouting = await deps.applyOutputDevice(wet, requestedOutputDeviceId);
    wet.src = compressedPath;
    const postAttachRouting = await deps.applyOutputDevice(wet, requestedOutputDeviceId);
    const outputRouting =
      postAttachRouting.appliedDeviceId || !preAttachRouting.appliedDeviceId
        ? postAttachRouting
        : preAttachRouting;
    if (requestedOutputDeviceId && !outputRouting.appliedDeviceId) {
      await deps.releaseAudioDspRuntime(wet);
      return;
    }
    wet.addEventListener(
      "loadedmetadata",
      () => {
        if (!state.active) {
          return;
        }
        const duration = Number.isFinite(wet.duration) ? wet.duration : state.active.currentTime ?? 0;
        wet.currentTime = Math.min(state.active.currentTime ?? 0, duration);
      },
      { once: true },
    );
    if (state.active.paused) {
      await wet.play().catch(() => undefined);
      wet.pause();
    } else {
      await wet.play().catch(() => undefined);
    }
    if (!state.active || state.currentTrackId !== track.id) {
      wet.pause();
      wet.currentTime = 0;
      await deps.releaseAudioDspRuntime(wet);
      return;
    }
    state.compressedActive = wet;
    state.usingCompressedSource = true;
    state.activeSourcePath = compressedPath;
    state.compressedSourcePath = compressedPath;
    state.originalSourcePath = state.track?.full_path ?? state.originalSourcePath;
    state.wetCompensationGain = 1;
    state.wetCompensationReferenceRatio = undefined;
    deps.applyDynamicLevelToMain();
    deps.updateNowPlayingDisplay();

    const playlist = deps.playlistState();
    deps.logPlaybackDiagnostic?.({
      channel: "main",
      mode: deps.appMode(),
      trackId: track.id,
      title: track.title ?? "",
      artist: track.artist ?? "",
      playlistStatus: playlist.status,
      playlistIndex: playlist.index,
      trackIndex: playlist.trackIndex,
      gainSource: "none",
      gainDb: state.appliedGainDb ?? null,
      loudnessDb: track.loudness_db ?? null,
      linearGain: state.active.volume,
      correctionDb: 0,
      driftDb: 0,
      targetLoudnessDb: -16,
      expectedOutputLoudnessDb: null,
      requestedOutputDeviceId,
      appliedOutputDeviceId: outputRouting.appliedDeviceId,
      outputRouteMethod: outputRouting.method,
      outputRouteError: outputRouting.error,
      attemptedOutputDeviceIds: [
        ...preAttachRouting.attemptedDeviceIds,
        ...postAttachRouting.attemptedDeviceIds,
      ],
    });
  };

  return {
    resolvePlaybackSource,
    ensureMainCompressedCompanion,
  };
};
