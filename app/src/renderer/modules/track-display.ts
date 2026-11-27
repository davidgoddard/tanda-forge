export const displayTrackInfo = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "?" ? "" : trimmed;
};

export const buildTrackPrimaryLabel = (track: {
  title?: string | null;
  artist?: string | null;
}) => {
  const title = displayTrackInfo(track.title);
  const artist = displayTrackInfo(track.artist);
  return [title, artist].filter(Boolean).join(" — ");
};

export const buildTrackSecondaryLabel = (values: Array<string | null | undefined>) =>
  values.map(displayTrackInfo).filter(Boolean).join(" · ");
