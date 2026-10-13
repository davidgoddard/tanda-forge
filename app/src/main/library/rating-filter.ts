import type Database from "better-sqlite3";
import { normalizeRatingFilter, type RatingFilter, type RatingSnapshot } from "../../shared/rating-filter";

// Membership is global, independent of the selected collection or other filters.
export const trackRatingSql = `coalesce((select max(rated.rating)
  from tanda_tracks rated_tt join tandas rated on rated.id = rated_tt.tanda_id
  where rated_tt.track_id = t.id), 0)`;

export const buildRatingWhere = (expression: string, input?: RatingFilter) => {
  const { mode, stars } = normalizeRatingFilter(input);
  if (mode === "any") return { sql: "", values: [] as number[] };
  if (mode === "unrated") return { sql: `${expression} = 0`, values: [] as number[] };
  const operator = mode === "atLeast" ? ">=" : mode === "atMost" ? "<=" : "=";
  return { sql: `(${expression} >= 1 and ${expression} ${operator} ?)`, values: [stars] };
};

export const getRatingSnapshot = (db: Database.Database): RatingSnapshot => ({
  tracks: db.prepare(`select tt.track_id as id, coalesce(max(tandas.rating), 0) as rating
    from tanda_tracks tt join tandas on tandas.id = tt.tanda_id
    group by tt.track_id`).all() as RatingSnapshot["tracks"],
  tandas: db.prepare("select id, coalesce(rating, 0) as rating from tandas").all() as RatingSnapshot["tandas"],
});
