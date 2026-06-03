import type Database from "better-sqlite3";
import { effectiveDurationMs } from "../../shared/tanda-utils";
import { ORCHESTRA_SEED_DATA } from "../../shared/orchestra-seed";
import {
  buildOrchestraAliasIndex,
  convertSeedToRegistry,
  normalizeOrchestraText,
} from "../../shared/orchestra-registry";
import { parseScopedSearchQuery } from "./fuzzy-search";

type TandaSearchParams = {
  query: string;
  styles: string[];
  size: number | null;
};

const ORCHESTRA_REGISTRY = convertSeedToRegistry(ORCHESTRA_SEED_DATA);
const ORCHESTRA_ALIAS_INDEX = buildOrchestraAliasIndex(ORCHESTRA_REGISTRY);
const ORCHESTRA_BY_ID = new Map(
  ORCHESTRA_REGISTRY.map((entry) => [entry.id, entry]),
);

const resolveArtistScopedCandidates = (artistQuery: string) => {
  const trimmed = artistQuery.trim();
  if (!trimmed) {
    return [] as string[];
  }
  const normalized = normalizeOrchestraText(trimmed);
  if (!normalized) {
    return [trimmed];
  }
  const direct = ORCHESTRA_ALIAS_INDEX.get(normalized);
  if (!direct) {
    return [trimmed];
  }
  const entry = ORCHESTRA_BY_ID.get(direct);
  if (!entry) {
    return [trimmed];
  }
  return [entry.canonical, ...entry.aliases]
    .map((value) => value.trim())
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
};

export type TandaSavePayload = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  track_slots: (string | null)[];
};

export type TandaDetail = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  slot_count: number;
  track_slots: (string | null)[];
    tracks: {
      id: string;
      title: string;
      artist: string;
      artist_summary: string;
      singer: string;
      album: string;
      genre: string;
      year: string;
      notes: string;
    full_path: string;
    instrumental: boolean | null;
    duration_ms: number;
    start_offset_ms: number;
    end_trim_ms: number;
    loudness_db: number | null;
    gain_db: number | null;
  }[];
};

export type TandaSearchRow = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  slot_count: number;
  track_count: number;
};

export const buildTandaSearchWhere = (params: TandaSearchParams) => {
  const scoped = parseScopedSearchQuery(params.query ?? "");
  const query = scoped.query.trim();
  const queryTokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const where: string[] = [];
  const values: unknown[] = [];

  if (query) {
    if (scoped.scope === "artist") {
      const candidates = resolveArtistScopedCandidates(query);
      if (candidates.length > 0) {
        const artistConditions = candidates
          .map(() => "(lower(coalesce(t.artist_summary, '')) like ? or lower(coalesce(t.artist, '')) like ?)")
          .join(" or ");
        where.push(
          `exists (
            select 1 from tanda_tracks tt
            join tracks t on t.id = tt.track_id
            where tt.tanda_id = tandas.id
              and (${artistConditions})
          )`,
        );
        candidates.forEach((candidate) => {
          const like = `%${candidate.toLowerCase()}%`;
          values.push(like, like);
        });
      }
    } else {
      const tokenPredicates = queryTokens.map(
        () => `(lower(coalesce(tandas.name, '')) like ?
          or exists (
            select 1 from tanda_tracks tt
            join tracks t on t.id = tt.track_id
            where tt.tanda_id = tandas.id
              and (
                lower(coalesce(t.title, '')) like ?
                or lower(coalesce(t.artist_summary, '')) like ?
                or lower(coalesce(t.artist, '')) like ?
                or lower(coalesce(t.singer, '')) like ?
                or lower(coalesce(t.album, '')) like ?
                or lower(coalesce(t.year, '')) like ?
                or lower(coalesce(t.genre, '')) like ?
                or lower(coalesce(t.notes, '')) like ?
                or cast(round(t.bpm) as text) like ?
              )
          ))`,
      );
      where.push(tokenPredicates.join(" and "));
      queryTokens.forEach((token) => {
        const like = `%${token.toLowerCase()}%`;
        values.push(like, like, like, like, like, like, like, like, like, like);
      });
    }
  }

  if (params.styles.length > 0) {
    const placeholders = params.styles.map(() => "?").join(", ");
    where.push(
      `exists (
        select 1 from tanda_styles ts
        where ts.tanda_id = tandas.id and ts.style_name in (${placeholders})
      )`,
    );
    values.push(...params.styles);
  }

  if (params.size && Number.isFinite(params.size) && params.size >= 1) {
    where.push("coalesce(tandas.slot_count, 0) = ?");
    values.push(params.size);
  }

  return {
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    values,
  };
};

export const listTandas = (db: Database.Database): TandaDetail[] => {
  const rows = db
    .prepare(
      `select id, name, rating, instrumental, total_duration_ms, slot_count
       from tandas
       order by updated_at desc`,
    )
    .all() as {
    id: string;
    name: string;
    rating: number | null;
    instrumental: number | null;
    total_duration_ms: number | null;
    slot_count: number | null;
  }[];
  return rows
    .map((row) => loadTandaDetail(db, row.id))
    .filter((row): row is TandaDetail => row !== null);
};

export const listRecentTandaIds = (
  db: Database.Database,
  limit: number,
): string[] => {
  const rows = db
    .prepare(
      `select id
       from tandas
       order by updated_at desc
       limit ?`,
    )
    .all(limit) as { id: string }[];
  return rows.map((row) => row.id);
};

export const getTandasByIds = (
  db: Database.Database,
  ids: string[],
): TandaDetail[] => {
  const filteredIds = ids.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  if (filteredIds.length === 0) {
    return [];
  }
  return filteredIds
    .map((id) => loadTandaDetail(db, id))
    .filter((row): row is TandaDetail => row !== null);
};

export const searchTandas = (
  db: Database.Database,
  params: TandaSearchParams,
): TandaSearchRow[] => {
  const { whereSql, values } = buildTandaSearchWhere(params);
  const rows = db
    .prepare(
      `select tandas.id, tandas.name, tandas.rating, tandas.instrumental, tandas.total_duration_ms, tandas.slot_count
       from tandas
       ${whereSql}
       order by tandas.updated_at desc`,
    )
    .all(...values) as {
    id: string;
    name: string;
    rating: number | null;
    instrumental: number | null;
    total_duration_ms: number | null;
    slot_count: number | null;
  }[];
  return rows.map((row) => {
    const styles = db
      .prepare(
        "select style_name from tanda_styles where tanda_id = ? order by style_name",
      )
      .all(row.id)
      .map((style) => (style as { style_name: string }).style_name);
    const trackCount = db
      .prepare("select count(*) as count from tanda_tracks where tanda_id = ?")
      .get(row.id) as { count: number };
    return {
      id: row.id,
      name: row.name,
      styles,
      rating: row.rating ?? 0,
      instrumental: Boolean(row.instrumental),
      total_duration_ms: row.total_duration_ms ?? 0,
      slot_count: row.slot_count ?? trackCount.count,
      track_count: trackCount.count,
    };
  });
};

export const saveTanda = (
  db: Database.Database,
  payload: TandaSavePayload,
): TandaDetail => {
  const now = new Date().toISOString();
  const slotCount = payload.track_slots.length;
  const trackIds = payload.track_slots.filter(Boolean) as string[];
  const trackRows = trackIds.length
    ? (db
        .prepare(
      `select id, title, artist, artist_summary, album, genre, year, notes, full_path,
            singer, instrumental, duration_ms, start_offset_ms, end_trim_ms, loudness_db, gain_db
           from tracks where id in (${trackIds.map(() => "?").join(", ")})`,
        )
        .all(...trackIds) as TandaDetail["tracks"])
    : [];
  const trackMap = new Map(trackRows.map((track) => [track.id, track]));
  const computedDuration = payload.track_slots.reduce((sum, trackId) => {
    if (!trackId) {
      return sum;
    }
    const track = trackMap.get(trackId);
    return sum + effectiveDurationMs(track ?? null);
  }, 0);

  const transactional = db.transaction(() => {
    db.prepare(
      `insert into tandas (id, name, rating, instrumental, total_duration_ms, slot_count, invalid, updated_at)
       values (?, ?, ?, ?, ?, ?, 0, ?)
       on conflict(id) do update set
         name = excluded.name,
         rating = excluded.rating,
         instrumental = excluded.instrumental,
         total_duration_ms = excluded.total_duration_ms,
         slot_count = excluded.slot_count,
         updated_at = excluded.updated_at`,
    ).run(
      payload.id,
      payload.name,
      payload.rating,
      payload.instrumental ? 1 : 0,
      computedDuration,
      slotCount,
      now,
    );

    db.prepare("delete from tanda_tracks where tanda_id = ?").run(payload.id);
    db.prepare("delete from tanda_styles where tanda_id = ?").run(payload.id);

    payload.track_slots.forEach((trackId, index) => {
      if (!trackId) {
        return;
      }
      db.prepare(
        "insert into tanda_tracks (tanda_id, track_id, position) values (?, ?, ?)",
      ).run(payload.id, trackId, index);
    });

    payload.styles.forEach((style) => {
      db.prepare(
        "insert into tanda_styles (tanda_id, style_name) values (?, ?)",
      ).run(payload.id, style);
    });
  });

  transactional();
  const result = loadTandaDetail(db, payload.id);
  if (!result) {
    throw new Error(`Failed to load tanda ${payload.id} after save.`);
  }
  return result;
};

export const deleteTanda = (db: Database.Database, id: string) => {
  const transactional = db.transaction(() => {
    db.prepare("delete from tanda_tracks where tanda_id = ?").run(id);
    db.prepare("delete from tanda_styles where tanda_id = ?").run(id);
    db.prepare("delete from tandas where id = ?").run(id);
  });
  transactional();
};

const loadTandaDetail = (
  db: Database.Database,
  tandaId: string,
): TandaDetail | null => {
  const row = db
    .prepare(
      `select id, name, rating, instrumental, total_duration_ms, slot_count
       from tandas where id = ?`,
    )
    .get(tandaId) as {
    id: string;
    name: string;
    rating: number | null;
    instrumental: number | null;
    total_duration_ms: number | null;
    slot_count: number | null;
  } | undefined;
  if (!row) {
    return null;
  }

  const styles = db
    .prepare(
      "select style_name from tanda_styles where tanda_id = ? order by style_name",
    )
    .all(tandaId)
    .map((style) => (style as { style_name: string }).style_name);

  const trackRows = db
    .prepare(
      `select tt.track_id, tt.position, t.title, t.artist, t.artist_summary, t.album,
              t.genre, t.year, t.bpm, t.notes, t.full_path, t.relative_path, t.singer, t.instrumental, t.duration_ms, t.start_offset_ms,
              t.end_trim_ms, t.loudness_db, t.gain_db
       from tanda_tracks tt
       join tracks t on t.id = tt.track_id
       where tt.tanda_id = ?
       order by tt.position`,
    )
    .all(tandaId) as {
    track_id: string;
    position: number;
    title: string;
    artist: string;
    artist_summary: string;
    album: string;
    singer: string;
    genre: string;
    year: string;
    bpm: number | null;
    notes: string;
    full_path: string;
    relative_path: string;
    instrumental: number | null;
    duration_ms: number;
    start_offset_ms: number;
    end_trim_ms: number;
    loudness_db: number | null;
    gain_db: number | null;
  }[];

  const slotCount = Math.max(
    row.slot_count ?? 0,
    trackRows.length > 0
      ? Math.max(...trackRows.map((track) => track.position)) + 1
      : 0,
  );
  const slots = Array.from({ length: slotCount }, () => null as string | null);
  trackRows.forEach((track) => {
    slots[track.position] = track.track_id;
  });

  const tracks = trackRows.map((track) => ({
    id: track.track_id,
    title: track.title,
    artist: track.artist,
    artist_summary: track.artist_summary,
    album: track.album,
    singer: track.singer,
    genre: track.genre,
    year: track.year,
    bpm: track.bpm,
    notes: track.notes,
    full_path: track.full_path,
    relative_path: track.relative_path,
    instrumental: track.instrumental === null ? null : Boolean(track.instrumental),
    duration_ms: track.duration_ms,
    start_offset_ms: track.start_offset_ms,
    end_trim_ms: track.end_trim_ms,
    loudness_db: track.loudness_db,
    gain_db: track.gain_db,
  }));

  return {
    id: row.id,
    name: row.name,
    styles,
    rating: row.rating ?? 0,
    instrumental: Boolean(row.instrumental),
    total_duration_ms: row.total_duration_ms ?? 0,
    slot_count: slotCount,
    track_slots: slots,
    tracks,
  };
};
