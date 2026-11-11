import type Database from "better-sqlite3";

export const SEARCH_SCHEMA_VERSION = 3;
export const NGRAM_EVIDENCE_FLOOR = 0.75;

export const normalizeIndexedSearchText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const generateBoundaryNgrams = (value: unknown, size: 2 | 3) => {
  const grams = new Set<string>();
  normalizeIndexedSearchText(value).split(" ").filter(Boolean).forEach((token) => {
    const boundary = size === 2 ? "^" : "^^";
    const endBoundary = size === 2 ? "$" : "$$";
    const padded = `${boundary}${token}${endBoundary}`;
    for (let index = 0; index <= padded.length - size; index += 1) {
      grams.add(padded.slice(index, index + size));
    }
  });
  return [...grams];
};

const generateTokenBoundaryNgrams = (value: unknown, size: 2 | 3) => {
  const entries = new Map<string, { token: string; gram: string }>();
  normalizeIndexedSearchText(value).split(" ").filter(Boolean).forEach((token) => {
    generateBoundaryNgrams(token, size).forEach((gram) => {
      entries.set(`${token}\u0000${gram}`, { token, gram });
    });
  });
  return [...entries.values()];
};

const TRACK_SEARCH_VALUES = `
  new.id,
  search_normalize(coalesce(new.title, '')),
  search_normalize(coalesce(new.artist_summary, '') || ' ' || coalesce(new.artist, '')),
  search_normalize(coalesce(new.singer, '')),
  search_normalize(coalesce(new.notes, '')),
  search_normalize(coalesce(new.album, '') || ' ' || coalesce(new.album_artist, '') || ' ' ||
    coalesce(new.genre, '') || ' ' || coalesce(new.year, '') || ' ' ||
    coalesce(cast(round(new.bpm) as text), ''))`;

const TRACK_SEARCH_TEXT_NEW = `
  coalesce(new.title, '') || ' ' || coalesce(new.artist_summary, '') || ' ' ||
    coalesce(new.artist, '') || ' ' || coalesce(new.singer, '') || ' ' ||
    coalesce(new.notes, '') || ' ' || coalesce(new.album, '') || ' ' ||
    coalesce(new.album_artist, '') || ' ' || coalesce(new.genre, '') || ' ' ||
    coalesce(new.year, '') || ' ' || coalesce(cast(round(new.bpm) as text), '')`;

const TRACK_SEARCH_TEXT = `
  coalesce(title, '') || ' ' || coalesce(artist_summary, '') || ' ' ||
  coalesce(artist, '') || ' ' || coalesce(singer, '') || ' ' ||
  coalesce(notes, '') || ' ' || coalesce(album, '') || ' ' ||
  coalesce(album_artist, '') || ' ' || coalesce(genre, '') || ' ' ||
  coalesce(year, '') || ' ' || coalesce(cast(round(bpm) as text), '')`;

const createTrackSearchSchema = (database: Database.Database) => {
  database.exec(`
    drop trigger if exists track_search_insert;
    drop trigger if exists track_search_update;
    drop trigger if exists track_search_delete;
    drop table if exists track_search_trigram;
    create virtual table if not exists track_search_fts using fts5(
      track_id unindexed,
      title,
      artist,
      singer,
      notes,
      supporting,
      tokenize = 'unicode61 remove_diacritics 2',
      prefix = '2 3 4'
    );
    create trigger track_search_insert after insert on tracks begin
      insert into track_search_fts(track_id, title, artist, singer, notes, supporting)
      values (${TRACK_SEARCH_VALUES});
    end;
    create trigger track_search_update after update of
      title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm
      on tracks begin
      delete from track_search_fts where track_id = old.id;
      insert into track_search_fts(track_id, title, artist, singer, notes, supporting)
      values (${TRACK_SEARCH_VALUES});
    end;
    create trigger track_search_delete after delete on tracks begin
      delete from track_search_fts where track_id = old.id;
    end;
  `);
};

const createTrackNgramSchema = (database: Database.Database) => {
  database.exec(`
    drop table if exists track_search_ngrams;
    create table track_search_ngrams (
      track_id text not null,
      source_token text not null,
      size integer not null,
      gram text not null,
      primary key (track_id, source_token, size, gram)
    ) without rowid;
    create index if not exists idx_track_search_ngrams_lookup
      on track_search_ngrams (size, gram, track_id, source_token);
    drop trigger if exists track_ngram_insert;
    drop trigger if exists track_ngram_update;
    drop trigger if exists track_ngram_delete;
    create trigger track_ngram_insert after insert on tracks begin
      insert or ignore into track_search_ngrams(track_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 2, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(${TRACK_SEARCH_TEXT_NEW}, 2));
      insert or ignore into track_search_ngrams(track_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 3, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(${TRACK_SEARCH_TEXT_NEW}, 3));
    end;
    create trigger track_ngram_update after update of
      title, artist, artist_summary, singer, notes, album, album_artist, genre, year, bpm
      on tracks begin
      delete from track_search_ngrams where track_id = old.id;
      insert or ignore into track_search_ngrams(track_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 2, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(${TRACK_SEARCH_TEXT_NEW}, 2));
      insert or ignore into track_search_ngrams(track_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 3, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(${TRACK_SEARCH_TEXT_NEW}, 3));
    end;
    create trigger track_ngram_delete after delete on tracks begin
      delete from track_search_ngrams where track_id = old.id;
    end;
  `);
};

const tandaSearchSelect = (whereSql: string) => `
  select tandas.id,
    search_normalize(coalesce(tandas.name, '')),
    search_normalize(coalesce((
      select group_concat(
        coalesce(tracks.title, '') || ' ' || coalesce(tracks.artist_summary, '') || ' ' ||
        coalesce(tracks.artist, '') || ' ' || coalesce(tracks.singer, '') || ' ' ||
        coalesce(tracks.album, '') || ' ' || coalesce(tracks.genre, '') || ' ' ||
        coalesce(tracks.year, '') || ' ' || coalesce(tracks.notes, '') || ' ' ||
        coalesce(cast(round(tracks.bpm) as text), ''), ' '
      )
      from tanda_tracks
      join tracks on tracks.id = tanda_tracks.track_id
      where tanda_tracks.tanda_id = tandas.id
    ), '')),
    search_normalize(coalesce((
      select group_concat(tanda_styles.style_name, ' ')
      from tanda_styles where tanda_styles.tanda_id = tandas.id
    ), ''))
  from tandas ${whereSql}`;

const createTandaSearchSchema = (database: Database.Database) => {
  database.exec(`
    create virtual table if not exists tanda_search_fts using fts5(
      tanda_id unindexed,
      name,
      track_text,
      styles,
      tokenize = 'unicode61 remove_diacritics 2',
      prefix = '2 3 4'
    );
    drop table if exists tanda_name_ngrams;
    create table tanda_name_ngrams (
      tanda_id text not null,
      source_token text not null,
      size integer not null,
      gram text not null,
      primary key (tanda_id, source_token, size, gram)
    ) without rowid;
    create index if not exists idx_tanda_name_ngrams_lookup
      on tanda_name_ngrams (size, gram, tanda_id, source_token);
    drop trigger if exists tanda_name_ngram_insert;
    drop trigger if exists tanda_name_ngram_update;
    drop trigger if exists tanda_name_ngram_delete;
    create trigger tanda_name_ngram_insert after insert on tandas begin
      insert or ignore into tanda_name_ngrams(tanda_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 2, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(new.name, 2));
      insert or ignore into tanda_name_ngrams(tanda_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 3, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(new.name, 3));
    end;
    create trigger tanda_name_ngram_update after update of name on tandas begin
      delete from tanda_name_ngrams where tanda_id = old.id;
      insert or ignore into tanda_name_ngrams(tanda_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 2, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(new.name, 2));
      insert or ignore into tanda_name_ngrams(tanda_id, source_token, size, gram)
        select new.id, json_extract(value, '$.token'), 3, json_extract(value, '$.gram')
        from json_each(search_token_ngrams(new.name, 3));
    end;
    create trigger tanda_name_ngram_delete after delete on tandas begin
      delete from tanda_name_ngrams where tanda_id = old.id;
    end;

    create trigger if not exists tanda_search_insert after insert on tandas begin
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect("where tandas.id = new.id")};
    end;
    create trigger if not exists tanda_search_update after update of name on tandas begin
      delete from tanda_search_fts where tanda_id = old.id;
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect("where tandas.id = new.id")};
    end;
    create trigger if not exists tanda_search_delete after delete on tandas begin
      delete from tanda_search_fts where tanda_id = old.id;
    end;
    create trigger if not exists tanda_track_search_insert after insert on tanda_tracks begin
      delete from tanda_search_fts where tanda_id = new.tanda_id;
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect("where tandas.id = new.tanda_id")};
    end;
    create trigger if not exists tanda_track_search_delete after delete on tanda_tracks begin
      delete from tanda_search_fts where tanda_id = old.tanda_id;
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect("where tandas.id = old.tanda_id")};
    end;
    create trigger if not exists tanda_style_search_insert after insert on tanda_styles begin
      delete from tanda_search_fts where tanda_id = new.tanda_id;
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect("where tandas.id = new.tanda_id")};
    end;
    create trigger if not exists tanda_style_search_delete after delete on tanda_styles begin
      delete from tanda_search_fts where tanda_id = old.tanda_id;
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect("where tandas.id = old.tanda_id")};
    end;
    create trigger if not exists track_tanda_search_update after update of
      title, artist, artist_summary, singer, notes, album, genre, year, bpm
      on tracks begin
      delete from tanda_search_fts where tanda_id in (
        select tanda_id from tanda_tracks where track_id = new.id
      );
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect(`where exists (
        select 1 from tanda_tracks where tanda_tracks.tanda_id = tandas.id
          and tanda_tracks.track_id = new.id
      )`)};
    end;
    create trigger if not exists track_tanda_search_insert after insert on tracks begin
      delete from tanda_search_fts where tanda_id in (
        select tanda_id from tanda_tracks where track_id = new.id
      );
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect(`where exists (
        select 1 from tanda_tracks where tanda_tracks.tanda_id = tandas.id
          and tanda_tracks.track_id = new.id
      )`)};
    end;
    create trigger if not exists track_tanda_search_delete after delete on tracks begin
      delete from tanda_search_fts where tanda_id in (
        select tanda_id from tanda_tracks where track_id = old.id
      );
      insert into tanda_search_fts(tanda_id, name, track_text, styles)
      ${tandaSearchSelect(`where exists (
        select 1 from tanda_tracks where tanda_tracks.tanda_id = tandas.id
          and tanda_tracks.track_id = old.id
      )`)};
    end;
  `);
};

const rebuildTrackSearchIndex = (database: Database.Database) => {
  database.exec(`
    delete from track_search_fts;
    insert into track_search_fts(track_id, title, artist, singer, notes, supporting)
      select id,
        search_normalize(coalesce(title, '')),
        search_normalize(coalesce(artist_summary, '') || ' ' || coalesce(artist, '')),
        search_normalize(coalesce(singer, '')),
        search_normalize(coalesce(notes, '')),
        search_normalize(coalesce(album, '') || ' ' || coalesce(album_artist, '') || ' ' ||
          coalesce(genre, '') || ' ' || coalesce(year, '') || ' ' ||
          coalesce(cast(round(bpm) as text), ''))
      from tracks;
    delete from track_search_ngrams;
    insert or ignore into track_search_ngrams(track_id, source_token, size, gram)
      select tracks.id, json_extract(grams.value, '$.token'), 2,
        json_extract(grams.value, '$.gram')
      from tracks join json_each(search_token_ngrams(${TRACK_SEARCH_TEXT}, 2)) grams;
    insert or ignore into track_search_ngrams(track_id, source_token, size, gram)
      select tracks.id, json_extract(grams.value, '$.token'), 3,
        json_extract(grams.value, '$.gram')
      from tracks join json_each(search_token_ngrams(${TRACK_SEARCH_TEXT}, 3)) grams;
  `);
};

const rebuildTandaSearchIndex = (database: Database.Database) => {
  database.exec(`
    delete from tanda_search_fts;
    delete from tanda_name_ngrams;
    insert or ignore into tanda_name_ngrams(tanda_id, source_token, size, gram)
      select tandas.id, json_extract(grams.value, '$.token'), 2,
        json_extract(grams.value, '$.gram')
      from tandas join json_each(search_token_ngrams(tandas.name, 2)) grams;
    insert or ignore into tanda_name_ngrams(tanda_id, source_token, size, gram)
      select tandas.id, json_extract(grams.value, '$.token'), 3,
        json_extract(grams.value, '$.gram')
      from tandas join json_each(search_token_ngrams(tandas.name, 3)) grams;
  `);
  database.prepare(`
    insert into tanda_search_fts(tanda_id, name, track_text, styles)
    ${tandaSearchSelect("")}
  `).run();
};

const createLibraryPerformanceIndexes = (database: Database.Database) => {
  database.exec(`
    create index if not exists idx_tracks_active_genre on tracks (deleted_at, genre);
    create index if not exists idx_tracks_active_bpm on tracks (deleted_at, bpm);
    create index if not exists idx_tracks_active_year on tracks (deleted_at, year);
    create index if not exists idx_tracks_updated_at on tracks (updated_at);
    create index if not exists idx_tandas_valid_updated on tandas (invalid, updated_at desc);
    create index if not exists idx_tanda_tracks_tanda_position
      on tanda_tracks (tanda_id, position);
    create index if not exists idx_tanda_styles_style_tanda
      on tanda_styles (style_name, tanda_id);
  `);
};

export const registerSearchSqlFunctions = (database: Database.Database) => {
  database.function("search_normalize", { deterministic: true }, normalizeIndexedSearchText);
  database.function("search_ngrams", { deterministic: true }, (value: unknown, size: number) =>
    JSON.stringify(generateBoundaryNgrams(value, size === 2 ? 2 : 3)));
  database.function("search_token_ngrams", { deterministic: true },
    (value: unknown, size: number) =>
      JSON.stringify(generateTokenBoundaryNgrams(value, size === 2 ? 2 : 3)));
};

export const ensureSearchSchema = (database: Database.Database) => {
  const currentVersion = Number(database.pragma("user_version", { simple: true }) ?? 0);
  if (currentVersion >= SEARCH_SCHEMA_VERSION) {
    return { migrated: false, version: currentVersion };
  }
  const migrate = database.transaction(() => {
    createTrackSearchSchema(database);
    createTrackNgramSchema(database);
    createTandaSearchSchema(database);
    createLibraryPerformanceIndexes(database);
    rebuildTrackSearchIndex(database);
    rebuildTandaSearchIndex(database);
    database.pragma(`user_version = ${SEARCH_SCHEMA_VERSION}`);
  });
  try {
    migrate();
    return { migrated: true, version: SEARCH_SCHEMA_VERSION };
  } catch (error) {
    return {
      migrated: false,
      version: currentVersion,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const findIndexedTandaCandidateIds = (
  database: Database.Database,
  query: string,
  fuzzyLimit = 1000,
): string[] | null => {
  const normalized = normalizeIndexedSearchText(query);
  if (!normalized) return null;
  try {
    const ids = new Set<string>();
    const tokens = normalized.split(" ").filter(Boolean);
    const exactQuery = tokens.map((token) => `${quoteFtsTerm(token)}*`).join(" AND ");
    if (exactQuery) {
      const rows = database.prepare(
        `select tanda_id from tanda_search_fts where tanda_search_fts match ?`,
      ).all(exactQuery) as Array<{ tanda_id: string }>;
      rows.forEach((row) => ids.add(row.tanda_id));
    }
    if (tokens.length === 1) {
      const trackIds = tokens.flatMap((token) =>
        findBoundaryNgramCandidates(database, token, fuzzyLimit));
      if (trackIds.length > 0) {
        const rows = database.prepare(
          `select distinct tanda_id from tanda_tracks
           where track_id in (select value from json_each(?))`,
        ).all(JSON.stringify(trackIds)) as Array<{ tanda_id: string }>;
        rows.forEach((row) => ids.add(row.tanda_id));
      }
      tokens.flatMap((token) =>
        findBoundaryNgramCandidatesForTandaNames(database, token, fuzzyLimit))
        .forEach((tandaId) => ids.add(tandaId));
    }
    return [...ids];
  } catch {
    return null;
  }
};

const quoteFtsTerm = (term: string) => `"${term.replace(/"/g, '""')}"`;

const buildWordMatchQuery = (normalizedQuery: string) => {
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.map((token) => `${quoteFtsTerm(token)}*`).join(" OR ");
};

const findBoundaryNgramCandidates = (
  database: Database.Database,
  queryToken: string,
  fuzzyLimit: number,
) => {
  if (queryToken.length < 3) return [];
  const bigrams = generateBoundaryNgrams(queryToken, 2);
  const trigrams = generateBoundaryNgrams(queryToken, 3);
  const queryGrams = [
    ...bigrams.map((gram) => ({ size: 2, gram, weight: 1 / Math.max(1, bigrams.length) })),
    ...trigrams.map((gram) => ({ size: 3, gram, weight: 2 / Math.max(1, trigrams.length) })),
  ];
  return (database.prepare(
    `with token_matches as (
       select ngram_index.track_id, ngram_index.source_token,
              sum(cast(json_extract(query.value, '$.weight') as real)) as evidence
       from track_search_ngrams ngram_index
       join json_each(?) query
         on ngram_index.size = cast(json_extract(query.value, '$.size') as integer)
        and ngram_index.gram = json_extract(query.value, '$.gram')
       group by ngram_index.track_id, ngram_index.source_token
       having (sum(case when ngram_index.size = 3 then 1 else 0 end) >= 1
           or sum(case when ngram_index.size = 2 then 1 else 0 end) >= 2)
          and min(length(ngram_index.source_token), length(?)) * 1.0 /
            max(length(ngram_index.source_token), length(?)) >= 0.75
          and sum(cast(json_extract(query.value, '$.weight') as real)) >= ${NGRAM_EVIDENCE_FLOOR}
     )
     select track_id, max(evidence) as evidence from token_matches
     group by track_id order by evidence desc, track_id limit ?`,
  ).all(JSON.stringify(queryGrams), queryToken, queryToken, fuzzyLimit) as Array<{ track_id: string }>)
    .map((row) => row.track_id);
};

const findBoundaryNgramCandidatesForTandaNames = (
  database: Database.Database,
  queryToken: string,
  fuzzyLimit: number,
) => {
  const bigrams = generateBoundaryNgrams(queryToken, 2);
  const trigrams = generateBoundaryNgrams(queryToken, 3);
  const queryGrams = [
    ...bigrams.map((gram) => ({ size: 2, gram, weight: 1 / Math.max(1, bigrams.length) })),
    ...trigrams.map((gram) => ({ size: 3, gram, weight: 2 / Math.max(1, trigrams.length) })),
  ];
  return (database.prepare(
    `with token_matches as (
       select ngram_index.tanda_id, ngram_index.source_token,
              sum(cast(json_extract(query.value, '$.weight') as real)) as evidence
       from tanda_name_ngrams ngram_index
       join json_each(?) query
         on ngram_index.size = cast(json_extract(query.value, '$.size') as integer)
        and ngram_index.gram = json_extract(query.value, '$.gram')
       group by ngram_index.tanda_id, ngram_index.source_token
       having (sum(case when ngram_index.size = 3 then 1 else 0 end) >= 1
           or sum(case when ngram_index.size = 2 then 1 else 0 end) >= 2)
          and min(length(ngram_index.source_token), length(?)) * 1.0 /
            max(length(ngram_index.source_token), length(?)) >= 0.75
          and sum(cast(json_extract(query.value, '$.weight') as real)) >= ${NGRAM_EVIDENCE_FLOOR}
     )
     select tanda_id, max(evidence) as evidence from token_matches
     group by tanda_id order by evidence desc, tanda_id limit ?`,
  ).all(JSON.stringify(queryGrams), queryToken, queryToken, fuzzyLimit) as Array<{ tanda_id: string }>)
    .map((row) => row.tanda_id);
};

export const findIndexedTrackCandidateIds = (
  database: Database.Database,
  query: string,
  fuzzyLimit = 1000,
): string[] | null => {
  const normalized = normalizeIndexedSearchText(query);
  if (!normalized) return null;
  try {
    const ids = new Set<string>();
    const wordQuery = buildWordMatchQuery(normalized);
    if (wordQuery) {
      const rows = database.prepare(
        `select track_id from track_search_fts where track_search_fts match ?`,
      ).all(wordQuery) as Array<{ track_id: string }>;
      rows.forEach((row) => ids.add(row.track_id));
    }
    normalized.split(" ").filter(Boolean).flatMap((token) =>
      findBoundaryNgramCandidates(database, token, fuzzyLimit))
      .forEach((trackId) => ids.add(trackId));
    return [...ids];
  } catch {
    // Older or externally-created databases remain searchable if FTS5 is unavailable.
    return null;
  }
};
