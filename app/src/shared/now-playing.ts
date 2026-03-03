export const resolveBaseDurationSeconds = (params: {
  audioDurationSeconds: number;
  baseDurationMs: number;
}) => {
  const { audioDurationSeconds, baseDurationMs } = params;
  if (audioDurationSeconds > 0 && Number.isFinite(audioDurationSeconds)) {
    return audioDurationSeconds;
  }
  if (baseDurationMs > 0 && Number.isFinite(baseDurationMs)) {
    return baseDurationMs / 1000;
  }
  return 0;
};

export const resolveEffectiveDurationSeconds = (params: {
  baseDurationSeconds: number;
  startOffsetMs: number;
  endTrimMs: number;
}) => {
  if (params.baseDurationSeconds <= 0 || !Number.isFinite(params.baseDurationSeconds)) {
    return 0;
  }
  return Math.max(
    0,
    params.baseDurationSeconds - params.startOffsetMs / 1000 - params.endTrimMs / 1000,
  );
};

export const resolveDisplayDurationSeconds = (params: {
  effectiveDurationSeconds: number;
  cortinaPlaying: boolean;
  cortinaAllowFull: boolean;
  hasTrack: boolean;
  channel: "main" | "headphone";
  cortinaDurationSeconds: number;
}) => {
  if (
    params.cortinaPlaying &&
    params.channel === "main" &&
    params.hasTrack &&
    !params.cortinaAllowFull
  ) {
    return Math.min(params.effectiveDurationSeconds, params.cortinaDurationSeconds);
  }
  return params.effectiveDurationSeconds;
};

export const resolveClampedCurrentSeconds = (params: {
  currentTimeSeconds: number;
  startOffsetMs: number;
  displayDurationSeconds: number;
}) => {
  const current = Math.max(0, params.currentTimeSeconds - params.startOffsetMs / 1000);
  if (params.displayDurationSeconds <= 0) {
    return current;
  }
  return Math.min(current, params.displayDurationSeconds);
};

export const resolveProgressRatio = (params: {
  currentTimeSeconds: number;
  durationSeconds: number;
}) => {
  if (params.durationSeconds <= 0 || !Number.isFinite(params.durationSeconds)) {
    return 0;
  }
  return Math.min(1, Math.max(0, params.currentTimeSeconds / params.durationSeconds));
};

export const resolveWaveformSeekTargetSeconds = (params: {
  ratio: number;
  baseDurationMs: number;
  activeAudioDurationSeconds: number;
}) => {
  const durationSeconds = resolveBaseDurationSeconds({
    audioDurationSeconds: params.activeAudioDurationSeconds,
    baseDurationMs: params.baseDurationMs,
  });
  if (durationSeconds <= 0 || !Number.isFinite(durationSeconds)) {
    return null;
  }
  const safeRatio = Math.min(1, Math.max(0, params.ratio));
  return safeRatio * durationSeconds;
};

export const toDisplayStyleLabel = (style: string | null | undefined) => {
  if (!style) {
    return "";
  }
  const trimmed = style.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};
