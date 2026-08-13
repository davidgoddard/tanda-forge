import type { SortColumn } from "./library/query";

export const buildStyleWhere = (styles: string[]) => {
  const base = "where r.kind = 'music' and t.deleted_at is null";
  if (!styles || styles.length === 0) {
    return { whereSql: base, values: [] as unknown[] };
  }
  const placeholders = styles.map(() => "?").join(", ");
  return {
    whereSql: `${base} and t.genre in (${placeholders})`,
    values: [...styles],
  };
};

export const getSortKeyForTrack = (sortBy: string, track: { [key: string]: unknown }) => {
  if (sortBy === "artist") {
    const artistSummary = track.artist_summary as string | undefined;
    const artist = track.artist as string | undefined;
    return (artistSummary || artist || "").toUpperCase();
  }
  const value = track[sortBy] as string | number | undefined | null;
  return `${value ?? ""}`.toUpperCase();
};

export const getPrefixForTrack = (sortBy: string, track: { [key: string]: unknown }) => {
  const key = getSortKeyForTrack(sortBy, track).trim();
  return key ? key.slice(0, 1) : "";
};

export type SearchSortColumn = SortColumn | "score";

export const matchesPrefix = (prefix: string, key: string) => {
  const upper = key.toUpperCase();
  if (!upper) {
    return false;
  }
  if (prefix === "0-9") {
    return /^[0-9]/.test(upper);
  }
  if (prefix === "#") {
    return /^[^A-Z0-9]/.test(upper);
  }
  return upper.startsWith(prefix);
};

export const normalizeSearchConfig = (params: {
  minScore?: number;
  bpmRange?: number;
}) => {
  const minScore = Number.isFinite(params.minScore)
    ? Math.min(1, Math.max(0, params.minScore ?? 0))
    : 0.25;
  const bpmRange = Number.isFinite(params.bpmRange)
    ? Math.min(20, Math.max(0, params.bpmRange ?? 0))
    : 5;
  return { minScore, bpmRange };
};
