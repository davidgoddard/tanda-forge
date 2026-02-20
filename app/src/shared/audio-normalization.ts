const DEFAULT_MAX_LINEAR_GAIN = 2;
const MIN_GAIN_DB = -36;
const MAX_GAIN_DB = 12;

export const DEFAULT_TARGET_LOUDNESS_DB = -16;
const DRIFT_CORRECTION_THRESHOLD_DB = 1.5;
const DRIFT_CORRECTION_FACTOR = 0.6;

const toFiniteNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const resolvePlaybackGainDb = (
  gainDb: number | null | undefined,
  loudnessDb: number | null | undefined,
  targetLoudnessDb = DEFAULT_TARGET_LOUDNESS_DB,
) => {
  return resolvePlaybackNormalization(gainDb, loudnessDb, targetLoudnessDb).gainDb;
};

export type PlaybackNormalizationDecision = {
  gainDb: number | null;
  source: "gain" | "loudness" | "none";
  correctionDb: number;
  driftDb: number;
  loudnessDb: number | null;
  targetLoudnessDb: number;
};

export const resolvePlaybackNormalization = (
  gainDb: number | null | undefined,
  loudnessDb: number | null | undefined,
  targetLoudnessDb = DEFAULT_TARGET_LOUDNESS_DB,
): PlaybackNormalizationDecision => {
  const directGain = toFiniteNumber(gainDb);
  const loudness = toFiniteNumber(loudnessDb);
  if (directGain !== null) {
    if (loudness === null) {
      return {
        gainDb: clamp(directGain, MIN_GAIN_DB, MAX_GAIN_DB),
        source: "gain",
        correctionDb: 0,
        driftDb: 0,
        loudnessDb: null,
        targetLoudnessDb,
      };
    }
    const expectedLoudness = loudness + directGain;
    const driftDb = targetLoudnessDb - expectedLoudness;
    const correctionDb =
      Math.abs(driftDb) >= DRIFT_CORRECTION_THRESHOLD_DB
        ? driftDb * DRIFT_CORRECTION_FACTOR
        : 0;
    return {
      gainDb: clamp(directGain + correctionDb, MIN_GAIN_DB, MAX_GAIN_DB),
      source: "gain",
      correctionDb,
      driftDb,
      loudnessDb: loudness,
      targetLoudnessDb,
    };
  }
  if (loudness === null) {
    return {
      gainDb: null,
      source: "none",
      correctionDb: 0,
      driftDb: 0,
      loudnessDb: null,
      targetLoudnessDb,
    };
  }
  return {
    gainDb: clamp(targetLoudnessDb - loudness, MIN_GAIN_DB, MAX_GAIN_DB),
    source: "loudness",
    correctionDb: 0,
    driftDb: 0,
    loudnessDb: loudness,
    targetLoudnessDb,
  };
};

export const gainDbToLinear = (
  gainDb: number | null | undefined,
  maxLinearGain = DEFAULT_MAX_LINEAR_GAIN,
) => {
  const resolved = toFiniteNumber(gainDb);
  if (resolved === null) {
    return 1;
  }
  const maxGain = Number.isFinite(maxLinearGain) && maxLinearGain > 0 ? maxLinearGain : 1;
  return clamp(Math.pow(10, resolved / 20), 0, maxGain);
};
