import Database from "better-sqlite3";
import { TrackRow } from "../../shared/types";
import { filterAndScoreTracks } from "./fuzzy-search";

export type SearchFilters = {
  query: string;
  styles: string[];
  minScore: number;
  bpmRange: number;
};

const buildStyleWhere = (styles: string[]) => {
  if (!styles.length) {
    return { whereSql: "", values: [] as unknown[] };
  }
  const placeholders = styles.map(() => "?").join(", ");
  return {
    whereSql: `where genre in (${placeholders})`,
    values: [...styles],
  };
};

const selectTrackSql = `select id, full_path, relative_path, title, artist, artist_summary, singer, album,\n  year, genre, bpm, notes, duration_ms, start_offset_ms, end_trim_ms, analysis_json,\n  loudness_db, gain_db, tag_error, analysis_error\nfrom tracks`;

export const fetchSearchCandidates = (db: Database.Database, styles: string[]) => {
  const { whereSql, values } = buildStyleWhere(styles);
  return db.prepare(`${selectTrackSql} ${whereSql}`).all(...values) as TrackRow[];
};

export const fuzzySearchTracks = (
  db: Database.Database,
  filters: SearchFilters,
  limit: number,
  offset: number,
  sortBy: string,
  sortDir: "asc" | "desc",
) => {
  const candidates = fetchSearchCandidates(db, filters.styles);
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
  const candidates = fetchSearchCandidates(db, filters.styles);
  const scored = filterAndScoreTracks(candidates, {
    query: filters.query,
    minScore: filters.minScore,
    bpmRange: filters.bpmRange,
  });
  return scored.length;
};
