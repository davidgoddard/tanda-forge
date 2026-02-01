export const computeTrimmedEnd = (
  durationSeconds: number,
  startAtSeconds: number,
  endTrimSeconds: number,
) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }
  const trimmedEnd = Math.max(0, durationSeconds - Math.max(0, endTrimSeconds));
  const startAt = Math.max(0, startAtSeconds);
  return Math.max(startAt, trimmedEnd);
};
