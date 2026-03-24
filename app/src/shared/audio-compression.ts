export type CompressionRenderProfile = {
  mode: "upward" | "track-leveler";
  liftThresholdDb: number;
  maxLiftDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  gateThresholdDb: number;
  limiterCeilingDb: number;
  limiterReleaseMs: number;
};

export const DEFAULT_COMPRESSION_RENDER_PROFILE: CompressionRenderProfile = {
  mode: "track-leveler",
  liftThresholdDb: -60,
  maxLiftDb: 15,
  ratio: 5,
  attackMs: 35,
  releaseMs: 3000,
  gateThresholdDb: -65,
  limiterCeilingDb: -1,
  limiterReleaseMs: 260,
};

export const shouldUseCompressionSource = (params: {
  channel: "main" | "headphone";
  isCortinaPlayback: boolean;
  enabled: boolean;
  depthPercent: number;
}) => {
  if (params.channel !== "main") {
    return false;
  }
  if (!params.enabled) {
    return false;
  }
  return params.depthPercent > 0;
};

export const shouldWarmCompressionInBackground = (params: {
  channel: "main" | "headphone";
  fromPlaylist: boolean;
  compressionRequested: boolean;
}) =>
  params.channel === "main" &&
  !params.fromPlaylist &&
  params.compressionRequested;

export const isCompressionControlLockedForPrep = (params: {
  appMode: "prep" | "live" | "edit";
  isMainPlaying: boolean;
  usingCompressedSource: boolean;
}) => false;

export const COMPRESSION_TAIL_RESET_LEAD_SECONDS = 20;

export const shouldResetCompressionMixForNewTrack = (params: {
  channel: "main" | "headphone";
  nextTrackId: string;
  previousTrackId?: string;
}) => params.channel === "main" && params.previousTrackId !== params.nextTrackId;

export const shouldAutoResetCompressionMixNearEnd = (params: {
  enabled: boolean;
  depthPercent: number;
  currentTimeSeconds: number;
  startAtSeconds: number;
  effectiveEndSeconds: number | null;
  leadSeconds?: number;
}) => {
  if (!params.enabled || params.depthPercent <= 0 || params.effectiveEndSeconds === null) {
    return false;
  }
  const leadSeconds = params.leadSeconds ?? COMPRESSION_TAIL_RESET_LEAD_SECONDS;
  const resetThresholdSeconds = Math.max(
    params.startAtSeconds,
    params.effectiveEndSeconds - Math.max(0, leadSeconds),
  );
  return params.currentTimeSeconds >= resetThresholdSeconds;
};

export type CompressionProofState =
  | "disabled"
  | "zero_mix"
  | "headphone_bypass"
  | "rendered"
  | "fallback_original";

export const resolveCompressionProofState = (params: {
  enabled: boolean;
  depthPercent: number;
  channel: "main" | "headphone" | null;
  isCortinaPlayback: boolean;
  usingCompressedSource: boolean;
}): CompressionProofState => {
  if (!params.enabled) {
    return "disabled";
  }
  if (params.depthPercent <= 0) {
    return "zero_mix";
  }
  if (params.channel === "headphone") {
    return "headphone_bypass";
  }
  if (params.usingCompressedSource) {
    return "rendered";
  }
  return "fallback_original";
};
