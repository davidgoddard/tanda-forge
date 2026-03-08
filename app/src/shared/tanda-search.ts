import {
  collectStylesFromTracks,
  normalizeStyleName,
  summarizeArtistName,
  summarizeTandaTracks,
  type TrackStyleFields,
  type TandaSummaryTrack,
} from "./tanda-utils.js";
import type { TrackSearchSource } from "./search-query.js";

type TandaSearchTrack = TrackSearchSource &
  TrackStyleFields & {
    instrumental?: boolean | null;
  };

const extractYearTokens = (value?: string | null) => {
  if (!value) {
    return [];
  }
  return Array.from(value.matchAll(/\b\d{4}\b/g)).map((match) => match[0]);
};

const uniqueLimited = (values: string[], limit: number) => {
  const unique = Array.from(new Set(values.filter((value) => value.length > 0)));
  return unique.slice(0, limit);
};

export const buildTandaSearchQuery = (params: {
  name?: string | null;
  tracks: TandaSearchTrack[];
}) => {
  const summaryTracks: TandaSummaryTrack[] = params.tracks.map((track) => ({
    artist:
      track.artist_summary ||
      (track.artist ? summarizeArtistName(track.artist) : ""),
    year: track.year,
    instrumental: track.instrumental ?? null,
  }));
  const summary = summarizeTandaTracks(summaryTracks);
  const artists = summary.artists.slice(0, 3).map((artist) => artist.name);
  const years = uniqueLimited(
    params.tracks.flatMap((track) => extractYearTokens(track.year)),
    3,
  );
  const bpms = uniqueLimited(
    params.tracks
      .map((track) => (track.bpm && track.bpm > 0 ? `${Math.round(track.bpm)}` : ""))
      .filter(Boolean),
    2,
  );
  const name = params.name ? params.name.trim() : "";
  return [...artists, ...years, ...bpms, name].filter(Boolean).join(" ");
};

export const resolveTandaSearchStyles = (params: {
  tandaStyles?: string[] | null;
  tracks: TandaSearchTrack[];
  availableStyles: string[];
}) => {
  const normalizedAvailable = new Map<string, string>();
  params.availableStyles.forEach((style) => {
    const normalized = normalizeStyleName(style);
    if (normalized) {
      normalizedAvailable.set(normalized, style);
    }
  });
  const explicit =
    params.tandaStyles?.map((style) => normalizeStyleName(style)) ?? [];
  const matchedExplicit = explicit
    .map((style) => normalizedAvailable.get(style))
    .filter(Boolean) as string[];
  if (matchedExplicit.length > 0) {
    return matchedExplicit;
  }
  if (params.availableStyles.length === 0) {
    return params.tandaStyles?.filter((style) => style.trim().length > 0) ?? [];
  }
  return collectStylesFromTracks(params.tracks, params.availableStyles);
};

export const resolveTrackSearchStyles = (params: {
  trackStyle?: string | null;
  availableStyles: string[];
}) => {
  const normalized = normalizeStyleName(params.trackStyle ?? "");
  if (!normalized) {
    return [] as string[];
  }
  const matched = params.availableStyles.find(
    (style) => normalizeStyleName(style) === normalized,
  );
  return [matched ?? normalized];
};
