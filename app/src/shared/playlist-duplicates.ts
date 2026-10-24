export type PlaylistDuplicateSource =
  | { kind: "track"; trackId: string }
  | { kind: "tanda"; trackIds: string[] };

export type PlaylistDuplicateIndex = {
  trackIds: Set<string>;
  tandaKeys: Set<string>;
};

const normalizeTrackIds = (trackIds: string[]) =>
  Array.from(new Set(trackIds.filter(Boolean))).sort();

const buildTandaKey = (trackIds: string[]) => {
  const normalized = normalizeTrackIds(trackIds);
  if (normalized.length === 0) {
    return "";
  }
  return normalized.join("|");
};

export const buildPlaylistDuplicateIndex = (
  items: PlaylistDuplicateSource[],
  equivalentTrackIds: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): PlaylistDuplicateIndex => {
  const trackIds = new Set<string>();
  const tandaKeys = new Set<string>();
  items.forEach((item) => {
    if (item.kind === "track") {
      (equivalentTrackIds.get(item.trackId) ?? new Set([item.trackId]))
        .forEach((trackId) => trackIds.add(trackId));
      return;
    }
    const key = buildTandaKey(item.trackIds);
    if (!key) {
      return;
    }
    item.trackIds.forEach((trackId) => {
      if (trackId) {
        trackIds.add(trackId);
        equivalentTrackIds.get(trackId)?.forEach((equivalent) => trackIds.add(equivalent));
      }
    });
    tandaKeys.add(key);
  });
  return { trackIds, tandaKeys };
};

export const getDuplicateStatusForTrack = (
  trackId: string,
  index: PlaylistDuplicateIndex,
) => (index.trackIds.has(trackId) ? "full" : null);

export const getDuplicateStatusForTanda = (
  trackIds: string[],
  index: PlaylistDuplicateIndex,
) => {
  const key = buildTandaKey(trackIds);
  if (!key) {
    return null;
  }
  if (index.tandaKeys.has(key)) {
    return "full";
  }
  if (trackIds.some((trackId) => index.trackIds.has(trackId))) {
    return "partial";
  }
  return null;
};
