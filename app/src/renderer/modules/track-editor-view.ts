export const computeTapTempoBpm = (taps: number[]) => {
  if (taps.length < 2) {
    return null;
  }
  const elapsed = taps[taps.length - 1] - taps[0];
  const intervals = taps.length - 1;
  if (elapsed <= 0 || intervals <= 0) {
    return null;
  }
  const bpm = 60000 / (elapsed / intervals);
  if (!Number.isFinite(bpm) || bpm <= 0) {
    return null;
  }
  return Math.round(bpm);
};

export const formatTrackEditorBpm = (bpm: number | null | undefined) =>
  bpm !== null && bpm !== undefined ? `${Math.round(bpm)}` : "";

export const trackEditorBpmDiffers = (
  originalBpm: number | null | undefined,
  draftBpmText: string | null | undefined,
) => formatTrackEditorBpm(originalBpm) !== (draftBpmText?.trim() ?? "");
