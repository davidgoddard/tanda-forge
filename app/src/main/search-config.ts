import type { RatingFilter } from "../shared/rating-filter";
import { buildRatingWhere, trackRatingSql } from "./library/rating-filter";
import type { SortColumn } from "./library/query";

export const buildSearchVisibilityWhere = (trackAlias = "t") => `
  and not exists (select 1 from hidden_tracks h where h.track_id = ${trackAlias}.id)
  and not exists (
    select 1
    from audio_similarity_confirmed_members search_member
    join audio_similarity_confirmed_groups search_group
      on search_group.id = search_member.group_id
    where search_member.track_id = ${trackAlias}.id
      and search_group.relationship_type in ('identical', 'same-recording')
      and coalesce(
        search_group.preferred_track_id,
        (select min(representative.track_id)
         from audio_similarity_confirmed_members representative
         where representative.group_id = search_group.id)
      ) <> ${trackAlias}.id
  )`;

export const buildStyleWhere = (styles: string[], rating?: RatingFilter) => {
  const condition = buildRatingWhere(trackRatingSql, rating);
  let whereSql = `where r.kind = 'music' and t.deleted_at is null${buildSearchVisibilityWhere()}`;
  const values: unknown[] = [];
  if (styles?.length) {
    whereSql += ` and t.genre in (${styles.map(() => "?").join(", ")})`;
    values.push(...styles);
  }
  if (condition.sql) {
    whereSql += ` and ${condition.sql}`;
    values.push(...condition.values);
  }
  return { whereSql, values };
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
    : 0.19;
  const bpmRange = Number.isFinite(params.bpmRange)
    ? Math.min(20, Math.max(0, params.bpmRange ?? 0))
    : 5;
  return { minScore, bpmRange };
};
