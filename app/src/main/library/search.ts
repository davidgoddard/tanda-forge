import type { RatingFilter } from "../../shared/rating-filter";
import { buildRatingWhere, trackRatingSql } from "./rating-filter";
import Database from "better-sqlite3";
import { TrackRow } from "../../shared/types";
import { filterAndScoreTracks } from "./fuzzy-search";
import { buildSearchVisibilityWhere } from "../search-config";
import { findIndexedTrackCandidateIds } from "./search-index";

export type SearchFilters = {
  rating?: RatingFilter;
  query: string;
  styles: string[];
  minScore: number;
  bpmRange: number;
};

type ScoredTrack = ReturnType<typeof filterAndScoreTracks>[number];
type CachedSearch = {
  changeCount: number;
  key: string;
  rows: ScoredTrack[];
};

const scoredSearchCache = new WeakMap<Database.Database, Map<string, CachedSearch>>();

const getDatabaseChangeCount = (db: Database.Database) =>
  Number(db.prepare("select total_changes() as count").pluck().get() ?? 0);

const buildSearchCacheKey = (
  filters: SearchFilters,
  sortBy = "score",
  sortDir: "asc" | "desc" = "desc",
) => JSON.stringify({
  query: filters.query,
  styles: filters.styles,
  rating: filters.rating ?? null,
  minScore: filters.minScore,
  bpmRange: filters.bpmRange,
  sortBy,
  sortDir,
});

const selectTrackSql = `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer, t.album,\n  t.album_artist, t.year, t.genre, t.bpm, t.notes, t.instrumental, t.duration_ms, t.start_offset_ms, t.end_trim_ms,\n  t.analysis_json, t.loudness_db, t.gain_db, t.tag_error, t.analysis_error\nfrom tracks t\njoin library_roots r on r.id = t.root_id\nwhere r.kind = 'music' and t.deleted_at is null${buildSearchVisibilityWhere()}`;

export const findSearchCandidateIds = (
  db: Database.Database,
  filters: SearchFilters,
) => {
  const trimmed = filters.query.trim();
  if (/^\d{2,3}$/.test(trimmed)) {
    const bpm = Number.parseInt(trimmed, 10);
    return (db.prepare(
      `select id from tracks where bpm between ? and ?`,
    ).all(bpm - filters.bpmRange, bpm + filters.bpmRange) as Array<{ id: string }>)
      .map((row) => row.id);
  }
  const remainingText = trimmed
    .replace(/\binstrumental\s*:\s*(?:true|false)\b/gi, " ")
    .trim();
  if (!remainingText) return null;
  return findIndexedTrackCandidateIds(db, remainingText);
};

export const fetchSearchCandidates = (
  db: Database.Database,
  styles: string[],
  rating?: RatingFilter,
  candidateIds?: string[] | null,
) => {
  const condition = buildRatingWhere(trackRatingSql, rating);
  const styleSql = styles.length ? ` and t.genre in (${styles.map(() => "?").join(", ")})` : "";
  const ratingSql = condition.sql ? ` and ${condition.sql}` : "";
  if (candidateIds && candidateIds.length === 0) return [];
  const candidateSql = candidateIds
    ? " and t.id in (select value from json_each(?))"
    : "";
  return db.prepare(`${selectTrackSql}${styleSql}${ratingSql}${candidateSql}`)
    .all(
      ...styles,
      ...condition.values,
      ...(candidateIds ? [JSON.stringify(candidateIds)] : []),
    ) as TrackRow[];
};

export const getScoredSearchTracks = (
  db: Database.Database,
  filters: SearchFilters,
  sortBy = "score",
  sortDir: "asc" | "desc" = "desc",
) => {
  const key = buildSearchCacheKey(filters, sortBy, sortDir);
  const changeCount = getDatabaseChangeCount(db);
  let cache = scoredSearchCache.get(db);
  if (!cache) {
    cache = new Map();
    scoredSearchCache.set(db, cache);
  }
  const cached = cache.get(key);
  if (cached?.changeCount === changeCount) {
    return cached.rows;
  }
  const rows = filterAndScoreTracks(
    fetchSearchCandidates(
      db,
      filters.styles,
      filters.rating,
      findSearchCandidateIds(db, filters),
    ),
    {
      query: filters.query,
      minScore: filters.minScore,
      bpmRange: filters.bpmRange,
      sortBy,
      sortDir,
    },
  );
  if (cached?.changeCount !== undefined && cached.changeCount !== changeCount) {
    cache.clear();
  }
  cache.set(key, { changeCount, key, rows });
  if (cache.size > 8) {
    cache.delete(cache.keys().next().value as string);
  }
  return rows;
};

export const fuzzySearchTracks = (
  db: Database.Database,
  filters: SearchFilters,
  limit: number,
  offset: number,
  sortBy: string,
  sortDir: "asc" | "desc",
) => {
  const scored = getScoredSearchTracks(db, filters, sortBy, sortDir);
  const total = scored.length;
  const page = scored.slice(offset, offset + limit).map((entry) => entry.track);
  return { total, page };
};

export const countFuzzyTracks = (
  db: Database.Database,
  filters: SearchFilters,
  sortBy = "score",
  sortDir: "asc" | "desc" = "desc",
) => {
  return getScoredSearchTracks(db, filters, sortBy, sortDir).length;
};
