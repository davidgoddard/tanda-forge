export const computeFadeDurationMs = (
  preferredFadeMs: number,
  remainingMs: number,
) => {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 0;
  }
  const preferred = Number.isFinite(preferredFadeMs)
    ? Math.max(80, Math.round(preferredFadeMs))
    : 80;
  if (remainingMs >= preferred) {
    return preferred;
  }
  if (remainingMs >= 80) {
    return Math.round(remainingMs);
  }
  // Still perform a short fade instead of hard-cutting at the end boundary.
  return 80;
};

/** Constant attenuation in dB avoids the accelerating tail of an amplitude ramp.
 * Finish 60 dB below the starting level before setting exact silence.
 */
export const computeCortinaFadeLevel = (startLevel: number, progress: number) => {
  if (!Number.isFinite(startLevel) || startLevel <= 0) return 0;
  if (!Number.isFinite(progress)) return 0;
  const fraction = Math.max(0, Math.min(1, progress));
  if (fraction === 1) return 0;
  return startLevel * Math.pow(10, (-60 * fraction) / 20);
};
