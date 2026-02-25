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
