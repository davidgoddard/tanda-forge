export type UpwardDynamicsParams = {
  liftThresholdDb: number;
  maxLiftDb: number;
  upwardRatio: number;
  gateThresholdDb: number;
};

export type DynamicsMixConfig = {
  enabled: boolean;
  depthPercent: number;
};

export type DynamicsMixGains = {
  wet: number;
  dry: number;
};

export type DynamicsFrameState = {
  detectorDb: number;
  peakDb: number;
  liftDb: number;
};

export type DynamicsFrameConfig = {
  liftThresholdDb: number;
  maxLiftDb: number;
  upwardRatio: number;
  gateThresholdDb: number;
  attackMs: number;
  releaseMs: number;
};

export type TrackLevelerFrameState = {
  detectorDb: number;
  peakDb: number;
  meanDb: number;
  liftDb: number;
};

export type TrackLevelerFrameConfig = {
  maxLiftDb: number;
  upwardRatio: number;
  gateThresholdDb: number;
  limiterCeilingDb: number;
  attackMs: number;
  releaseMs: number;
};

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const depthPercentToMix = (depthPercent: number) => {
  const normalized = clampNumber(depthPercent / 100, 0, 1);
  if (normalized <= 0) {
    return 0;
  }
  // Expand low-end resolution so low percentages remain meaningful.
  return Math.pow(normalized, 0.55);
};

export const computeParallelMixGains = (
  config: DynamicsMixConfig,
): DynamicsMixGains => {
  if (!config.enabled) {
    return { wet: 0, dry: 1 };
  }
  const wet = depthPercentToMix(config.depthPercent);
  // Energy-safe linear crossfade: dry+wet remains predictable (<= 1.0).
  const dry = 1 - wet;
  return {
    wet: clampNumber(wet, 0, 1),
    dry: clampNumber(dry, 0, 1),
  };
};

export const shouldShowDynamicsOverlay = (enabled: boolean, depthPercent: number) => {
  if (!enabled) {
    return false;
  }
  return clampNumber(depthPercent, 0, 100) > 0;
};

export const summarizeWaveform = (
  samples: Float32Array,
  barCount: number,
): number[] => {
  const bars = new Array(Math.max(0, Math.floor(barCount))).fill(0);
  if (bars.length === 0 || samples.length === 0) {
    return bars;
  }
  const maxIndex = bars.length - 1;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.abs(samples[i] ?? 0);
    const index = Math.min(maxIndex, Math.floor((i * bars.length) / samples.length));
    bars[index] = Math.max(bars[index] ?? 0, sample);
  }
  return bars.map((value) => clampNumber(value, 0, 1));
};

export const updateWaveformTimelinePeak = (
  bins: Float32Array,
  progressRatio: number,
  samplePeak: number,
) => {
  if (bins.length === 0) {
    return -1;
  }
  const ratio = clampNumber(progressRatio, 0, 1);
  const index = Math.min(
    bins.length - 1,
    Math.max(0, Math.floor(ratio * bins.length)),
  );
  const peak = clampNumber(samplePeak, 0, 1);
  bins[index] = Math.max(bins[index] ?? 0, peak);
  return index;
};

export const dbToLinear = (db: number) => {
  if (!Number.isFinite(db)) {
    return 0;
  }
  return Math.pow(10, db / 20);
};

export const linearToDb = (linear: number, floorDb = -120) => {
  if (!Number.isFinite(linear) || linear <= 0) {
    return floorDb;
  }
  return 20 * Math.log10(linear);
};

export const computeUpwardLiftDb = (
  inputLevelDb: number,
  params: UpwardDynamicsParams,
) => {
  if (!Number.isFinite(inputLevelDb)) {
    return 0;
  }
  const gateThresholdDb = clampNumber(params.gateThresholdDb, -120, 0);
  if (inputLevelDb <= gateThresholdDb) {
    return 0;
  }
  const liftThresholdDb = clampNumber(params.liftThresholdDb, -80, 0);
  if (inputLevelDb >= liftThresholdDb) {
    return 0;
  }
  const maxLiftDb = clampNumber(params.maxLiftDb, 0, 60);
  const upwardRatio = clampNumber(params.upwardRatio, 1, 24);
  const belowThresholdDb = liftThresholdDb - inputLevelDb;
  const liftDb = belowThresholdDb * (1 - 1 / upwardRatio);
  return clampNumber(liftDb, 0, maxLiftDb);
};

export const smoothToward = (
  currentValue: number,
  targetValue: number,
  attackMs: number,
  releaseMs: number,
  frameMs: number,
) => {
  if (!Number.isFinite(currentValue)) {
    return targetValue;
  }
  if (!Number.isFinite(targetValue)) {
    return currentValue;
  }
  const delta = targetValue - currentValue;
  if (Math.abs(delta) <= 1e-6) {
    return targetValue;
  }
  const attack = clampNumber(attackMs, 1, 5_000);
  const release = clampNumber(releaseMs, 1, 10_000);
  const tauMs = delta > 0 ? attack : release;
  const dtMs = clampNumber(frameMs, 1, 1_000);
  const alpha = 1 - Math.exp(-dtMs / tauMs);
  return currentValue + delta * alpha;
};

export const computeDynamicsFrame = (
  state: DynamicsFrameState,
  inputDb: number,
  frameMs: number,
  config: DynamicsFrameConfig,
): DynamicsFrameState => {
  const detectorDb = smoothToward(state.detectorDb, inputDb, 80, 220, frameMs);
  // Hold the peak anchor for much longer so quiet passages are lifted toward
  // previously loud program material instead of drifting back down too quickly.
  const peakAttackMs = 6;
  const quietProgram = detectorDb <= config.liftThresholdDb - 3;
  const peakReleaseMs = quietProgram
    ? 60000
    : clampNumber(Math.max(config.releaseMs * 18, 9000), 3000, 20000);
  let peakDb = smoothToward(state.peakDb, detectorDb, peakAttackMs, peakReleaseMs, frameMs);
  peakDb = Math.max(peakDb, detectorDb);
  const relativeInputDb = detectorDb - peakDb;
  // Upward target: pull quieter program toward the held peak.
  // Higher ratios imply a tighter target gap to the peak.
  const targetRelativeDb = clampNumber(-(3 / Math.max(1, config.upwardRatio)), -10, -0.1);
  const relativeTargetLiftDb =
    detectorDb <= config.gateThresholdDb
      ? 0
      : relativeInputDb >= -1.5
        ? 0
        : clampNumber(targetRelativeDb - relativeInputDb, 0, config.maxLiftDb);
  const liftDb = smoothToward(
    state.liftDb,
    relativeTargetLiftDb,
    config.attackMs,
    config.releaseMs,
    frameMs,
  );
  return {
    detectorDb,
    peakDb,
    liftDb,
  };
};

export const computeTrackLevelerFrame = (
  state: TrackLevelerFrameState,
  inputDb: number,
  frameMs: number,
  config: TrackLevelerFrameConfig,
): TrackLevelerFrameState => {
  const detectorDb = smoothToward(state.detectorDb, inputDb, 40, 120, frameMs);
  // Fast peak follower provides transient/crest awareness for anti-spike damping.
  let peakDb = smoothToward(state.peakDb, inputDb, 3, 700, frameMs);
  peakDb = Math.max(peakDb, inputDb);
  const quietProgram = detectorDb <= config.gateThresholdDb;
  // Track "mean" follows upward reasonably quickly, but decays very slowly.
  const meanDb = smoothToward(state.meanDb, detectorDb, 2200, quietProgram ? 120000 : 30000, frameMs);
  // Keep cross-track normalization as baseline: no positive long-term bias.
  // Lift only when the local window falls below the track-relative mean.
  const targetDb = meanDb;
  const rawTargetLiftDb = quietProgram
    ? 0
    : clampNumber(targetDb - detectorDb, 0, config.maxLiftDb);
  const crestDb = Math.max(0, peakDb - detectorDb);
  // As crest factor rises, back off lift to avoid boosting into imminent peaks.
  const crestDamp = clampNumber((crestDb - 3) / 10, 0, 1);
  const dampedLiftDb = rawTargetLiftDb * (1 - 0.85 * crestDamp);
  // Hard lift cap by recent-peak headroom to reduce beat-slam overshoot.
  const allowedLiftByHeadroom = clampNumber(
    config.limiterCeilingDb - peakDb - 1,
    0,
    config.maxLiftDb,
  );
  const targetLiftDb = Math.min(dampedLiftDb, allowedLiftByHeadroom);
  const effectiveAttackMs = Math.max(15, config.attackMs);
  const effectiveReleaseMs = Math.max(450, config.releaseMs);
  const liftDb = smoothToward(
    state.liftDb,
    targetLiftDb,
    effectiveAttackMs,
    effectiveReleaseMs,
    frameMs,
  );
  return {
    detectorDb,
    peakDb,
    meanDb,
    liftDb,
  };
};
