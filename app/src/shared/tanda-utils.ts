export type TrackDurationFields = {
  duration_ms: number;
  start_offset_ms: number;
  end_trim_ms: number;
  instrumental?: boolean | null;
};

export const effectiveDurationMs = (
  track: TrackDurationFields | null,
): number => {
  if (!track) {
    return 0;
  }
  const trimmed =
    track.duration_ms - track.start_offset_ms - track.end_trim_ms;
  return Math.max(0, trimmed);
};

export const sumEffectiveDurationMs = (
  tracks: (TrackDurationFields | null)[],
): number => tracks.reduce((sum, track) => sum + effectiveDurationMs(track), 0);

export const deriveInstrumental = (
  tracks: (TrackDurationFields | null)[],
): boolean => {
  const populated = tracks.filter(Boolean) as TrackDurationFields[];
  if (populated.length === 0) {
    return false;
  }
  return populated.every((track) => track.instrumental === true);
};

export type TandaSummaryTrack = {
  artist?: string | null;
  year?: string | null;
  instrumental?: boolean | null;
};

export const summarizeTandaTracks = (tracks: (TandaSummaryTrack | null)[]) => {
  const artistCounts = new Map<string, number>();
  const years = new Set<string>();
  const populated = tracks.filter(Boolean) as TandaSummaryTrack[];
  populated.forEach((track) => {
    const artist = track.artist?.trim();
    if (artist) {
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    }
    const year = track.year?.trim();
    if (year) {
      years.add(year);
    }
  });
  const artists = Array.from(artistCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const yearList = Array.from(years).sort((a, b) => a.localeCompare(b));
  const instrumental =
    populated.length > 0 &&
    populated.every((track) => track.instrumental === true);
  return {
    artists,
    years: yearList,
    instrumental,
  };
};
