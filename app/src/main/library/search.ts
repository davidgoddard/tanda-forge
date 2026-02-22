import Database from "better-sqlite3";
import { TrackRow } from "../../shared/types";
import { filterAndScoreTracks } from "./fuzzy-search";

export type SearchFilters = {
  query: string;
  styles: string[];
  minScore: number;
  bpmRange: number;
};

const selectTrackSql = `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer, t.album,\n  t.year, t.genre, t.bpm, t.notes, t.instrumental, t.duration_ms, t.start_offset_ms, t.end_trim_ms, t.analysis_json,\n  t.loudness_db, t.gain_db, t.tag_error, t.analysis_error\nfrom tracks t\njoin library_roots r on r.id = t.root_id\nwhere r.kind = 'music'`;

export const fetchSearchCandidates = (db: Database.Database, styles: string[]) => {
  if (!styles.length) {
    return db.prepare(selectTrackSql).all() as TrackRow[];
  }
  const placeholders = styles.map(() => "?").join(", ");
  return db
    .prepare(`${selectTrackSql} and t.genre in (${placeholders})`)
    .all(...styles) as TrackRow[];
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
