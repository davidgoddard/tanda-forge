/** Legacy imports may use a lone question mark to represent absent metadata. */
export const visibleTrackMetadata = (value: string | null | undefined) => {
  const text = value?.trim() ?? "";
  return text === "?" ? "" : text;
};

export const buildTrackSecondaryText = (track: {
  year?: string | null;
  album?: string | null;
  genre?: string | null;
  bpm?: number | null;
  notes?: string | null;
}) => [
  track.year,
  track.album,
  track.genre,
  track.bpm != null && Number.isFinite(track.bpm) && track.bpm > 0
    ? `${Math.round(track.bpm)} bpm` : "",
  track.notes,
].map(visibleTrackMetadata).filter(Boolean).join(" · ");
