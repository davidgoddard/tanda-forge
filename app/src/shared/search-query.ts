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

export const buildTrackSearchQuery = (track: TrackSearchSource) => {
  const parts: string[] = [];
  pushIf(parts, track.artist_summary);
  pushIf(parts, track.artist);
  pushIf(parts, track.singer);
  pushIf(parts, track.title);
  pushIf(parts, track.album);
  pushIf(parts, track.year);
  pushIf(parts, track.genre);
  pushIf(parts, track.notes);
  if (track.bpm !== null && track.bpm !== undefined && track.bpm > 0) {
    parts.push(`${Math.round(track.bpm)}`);
  }
  return parts.join(" ").trim();
};
