import type { RatingFilter } from "../../shared/rating-filter";
import { buildRatingWhere, trackRatingSql } from "./rating-filter";
import Database from "better-sqlite3";
import { TrackRow } from "../../shared/types";
import { filterAndScoreTracks } from "./fuzzy-search";

export type SearchFilters = {
  rating?: RatingFilter;
  query: string;
  styles: string[];
  minScore: number;
  bpmRange: number;
};

const selectTrackSql = `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer, t.album,\n  t.album_artist, t.year, t.genre, t.bpm, t.notes, t.instrumental, t.duration_ms, t.start_offset_ms, t.end_trim_ms,\n  t.analysis_json, t.loudness_db, t.gain_db, t.tag_error, t.analysis_error\nfrom tracks t\njoin library_roots r on r.id = t.root_id\nwhere r.kind = 'music' and t.deleted_at is null\n  and not exists (select 1 from hidden_tracks h where h.track_id = t.id)`;

export const fetchSearchCandidates = (db: Database.Database, styles: string[], rating?: RatingFilter) => {
  const condition = buildRatingWhere(trackRatingSql, rating);
  const styleSql = styles.length ? ` and t.genre in (${styles.map(() => "?").join(", ")})` : "";
  const ratingSql = condition.sql ? ` and ${condition.sql}` : "";
  return db.prepare(`${selectTrackSql}${styleSql}${ratingSql}`)
    .all(...styles, ...condition.values) as TrackRow[];
};

export const fuzzySearchTracks = (
  db: Database.Database,
  filters: SearchFilters,
  limit: number,
  offset: number,
  sortBy: string,
  sortDir: "asc" | "desc",
) => {
  const candidates = fetchSearchCandidates(db, filters.styles, filters.rating);
  const scored = filterAndScoreTracks(candidates, {
    query: filters.query,
    minScore: filters.minScore,
    bpmRange: filters.bpmRange,
    sortBy,
    sortDir,
  });
  const total = scored.length;
  const page = scored.slice(offset, offset + limit).map((entry) => entry.track);
  return { total, page };
};

export const countFuzzyTracks = (db: Database.Database, filters: SearchFilters) => {
  const candidates = fetchSearchCandidates(db, filters.styles, filters.rating);
  const scored = filterAndScoreTracks(candidates, {
    query: filters.query,
    minScore: filters.minScore,
    bpmRange: filters.bpmRange,
  });
  return scored.length;
};
