export type TrackSearchSource = {
  title?: string | null;
  artist?: string | null;
  artist_summary?: string | null;
  singer?: string | null;
  album?: string | null;
  year?: string | null;
  genre?: string | null;
  bpm?: number | null;
  notes?: string | null;
  instrumental?: boolean | null;
};

const pushIf = (items: string[], value?: string | null) => {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    items.push(trimmed);
  }
};

const normalizeTokenKey = (token: string) => {
  const lowered = token.toLowerCase();
  const stripped = lowered.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  return stripped || lowered;
};

export const dedupeQueryTokens = (query: string) => {
  const tokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const seen = new Set<string>();
  const unique: string[] = [];
  tokens.forEach((token) => {
    const key = normalizeTokenKey(token);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(token);
  });
  return unique.join(" ").trim();
};

export const appendQueryTokens = (currentQuery: string, fragment: string) => {
  const merged = `${currentQuery.trim()} ${fragment.trim()}`.trim();
  return dedupeQueryTokens(merged);
};

export const buildTrackSearchQuery = (track: TrackSearchSource) => {
  const parts: string[] = [];
  // Priority order for similarity hints: style, artist, singer/instrumental,
  // BPM, year, notes, then title.
  pushIf(parts, track.genre);
  pushIf(parts, track.artist_summary);
  pushIf(parts, track.artist);
  if (track.singer && track.singer.trim().length > 0) {
    pushIf(parts, track.singer);
  } else if (track.instrumental === true) {
    parts.push("instrumental");
  }
  if (track.bpm !== null && track.bpm !== undefined && track.bpm > 0) {
    parts.push(`${Math.round(track.bpm)}`);
  }
  pushIf(parts, track.year);
  pushIf(parts, track.notes);
  pushIf(parts, track.title);
  pushIf(parts, track.album);
  return parts.join(" ").trim();
};
