import type Database from "better-sqlite3";
import { normalizeStyleName } from "../shared/tanda-utils";

export type SearchDiversityStatsPayload = {
  orchestraRows: Array<{ artist: string; total: number; styles: Record<string, number> }>;
  availableOrchestraRows: Array<{
    artist: string;
    trackCount: number;
    styles: Record<string, number>;
    yearCount: number;
    tempoCount: number;
  }>;
  yearBuckets: Array<[number, number]>;
  yearStyleBuckets: Array<[number, Array<[string, number]>]>;
  tempoBuckets: Array<[number, number]>;
  tempoStyleBuckets: Array<[number, Array<[string, number]>]>;
  styleBuckets: Array<[string, number]>;
  availableYearBuckets: Array<[number, number]>;
  availableTempoBuckets: Array<[number, number]>;
  availableStyleBuckets: Array<[string, number]>;
};

export const EMPTY_SEARCH_DIVERSITY_STATS: SearchDiversityStatsPayload = {
  orchestraRows: [],
  availableOrchestraRows: [],
  yearBuckets: [],
  yearStyleBuckets: [],
  tempoBuckets: [],
  tempoStyleBuckets: [],
  styleBuckets: [],
  availableYearBuckets: [],
  availableTempoBuckets: [],
  availableStyleBuckets: [],
};

export const computeSearchDiversityStats = (
  db: Database.Database,
): SearchDiversityStatsPayload => {
  const parseYear = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    const match = value.match(/\d{4}/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[0], 10);
    return Number.isFinite(year) ? year : null;
  };
  const resolveArtist = (artistSummary: string | null, artist: string | null) =>
    artistSummary?.trim() || artist?.trim() || "Unknown";

  const trackMeta = new Map<
    string,
    { artist: string; style: string; year: number | null; tempo: number | null }
  >();
  const availableYearCountMap = new Map<number, number>();
  const availableTempoCountMap = new Map<number, number>();
  const availableStyleCountMap = new Map<string, number>();
  const availableOrchestraMap = new Map<
    string,
    {
      styles: Map<string, number>;
      yearSet: Set<number>;
      tempoSet: Set<number>;
      trackCount: number;
    }
  >();
  for (const row of db
    .prepare(
      `select t.id as id, t.artist_summary as artist_summary, t.artist as artist, t.genre as genre, t.year as year, t.bpm as bpm
       from tracks t
       join library_roots r on r.id = t.root_id
       where r.kind = 'music'`,
    )
    .iterate() as Iterable<{
    id: string;
    artist_summary: string | null;
    artist: string | null;
    genre: string | null;
    year: string | null;
    bpm: number | null;
  }>) {
    const style = normalizeStyleName(row.genre ?? "");
    const year = parseYear(row.year);
    const tempo = Number.isFinite(row.bpm) && row.bpm !== null ? Math.round(row.bpm) : null;
    trackMeta.set(row.id, {
      artist: resolveArtist(row.artist_summary, row.artist),
      style,
      year,
      tempo,
    });
    const orchestraEntry =
      availableOrchestraMap.get(resolveArtist(row.artist_summary, row.artist)) ?? {
        styles: new Map<string, number>(),
        yearSet: new Set<number>(),
        tempoSet: new Set<number>(),
        trackCount: 0,
      };
    orchestraEntry.trackCount += 1;
    if (style) {
      orchestraEntry.styles.set(style, (orchestraEntry.styles.get(style) ?? 0) + 1);
      availableStyleCountMap.set(style, (availableStyleCountMap.get(style) ?? 0) + 1);
    }
    if (year !== null) {
      availableYearCountMap.set(year, (availableYearCountMap.get(year) ?? 0) + 1);
      orchestraEntry.yearSet.add(year);
    }
    if (tempo !== null) {
      availableTempoCountMap.set(tempo, (availableTempoCountMap.get(tempo) ?? 0) + 1);
      orchestraEntry.tempoSet.add(tempo);
    }
    availableOrchestraMap.set(resolveArtist(row.artist_summary, row.artist), orchestraEntry);
  }

  const tandaStyleMap = new Map<string, string>();
  for (const row of db
    .prepare(
      `select tanda_id, style_name from tanda_styles order by tanda_id asc, rowid asc`,
    )
    .iterate() as Iterable<{ tanda_id: string; style_name: string | null }>) {
    if (tandaStyleMap.has(row.tanda_id)) {
      continue;
    }
    const style = normalizeStyleName(row.style_name ?? "");
    if (style) {
      tandaStyleMap.set(row.tanda_id, style);
    }
  }

  const tandaArtists = new Map<string, Set<string>>();
  const tandaFallbackStyle = new Map<string, string>();
  const tandaYearCountMap = new Map<number, number>();
  const tandaYearStyleCountMap = new Map<number, Map<string, number>>();
  const tandaTempoCountMap = new Map<number, number>();
  const tandaTempoStyleCountMap = new Map<number, Map<string, number>>();
  for (const row of db
    .prepare(`select tanda_id, track_id from tanda_tracks`)
    .iterate() as Iterable<{ tanda_id: string; track_id: string }>) {
    const meta = trackMeta.get(row.track_id);
    if (!meta) {
      continue;
    }
    const artists = tandaArtists.get(row.tanda_id) ?? new Set<string>();
    artists.add(meta.artist);
    tandaArtists.set(row.tanda_id, artists);
    if (!tandaFallbackStyle.has(row.tanda_id) && meta.style) {
      tandaFallbackStyle.set(row.tanda_id, meta.style);
    }
    if (meta.year !== null) {
      tandaYearCountMap.set(meta.year, (tandaYearCountMap.get(meta.year) ?? 0) + 1);
      const style =
        normalizeStyleName(tandaStyleMap.get(row.tanda_id) ?? "") ||
        normalizeStyleName(tandaFallbackStyle.get(row.tanda_id) ?? "") ||
        meta.style ||
        "unknown";
      const yearStyleMap = tandaYearStyleCountMap.get(meta.year) ?? new Map<string, number>();
      yearStyleMap.set(style, (yearStyleMap.get(style) ?? 0) + 1);
      tandaYearStyleCountMap.set(meta.year, yearStyleMap);
    }
    if (meta.tempo !== null) {
      tandaTempoCountMap.set(meta.tempo, (tandaTempoCountMap.get(meta.tempo) ?? 0) + 1);
      const style =
        normalizeStyleName(tandaStyleMap.get(row.tanda_id) ?? "") ||
        normalizeStyleName(tandaFallbackStyle.get(row.tanda_id) ?? "") ||
        meta.style ||
        "unknown";
      const styleMap = tandaTempoStyleCountMap.get(meta.tempo) ?? new Map<string, number>();
      styleMap.set(style, (styleMap.get(style) ?? 0) + 1);
      tandaTempoStyleCountMap.set(meta.tempo, styleMap);
    }
  }

  const orchestraStyleMap = new Map<string, Map<string, number>>();
  const styleCounts = new Map<string, number>();
  tandaArtists.forEach((artists, tandaId) => {
    const style =
      tandaStyleMap.get(tandaId) ?? tandaFallbackStyle.get(tandaId) ?? "unknown";
    styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
    artists.forEach((artist) => {
      const styleMap = orchestraStyleMap.get(artist) ?? new Map<string, number>();
      styleMap.set(style, (styleMap.get(style) ?? 0) + 1);
      orchestraStyleMap.set(artist, styleMap);
    });
  });

  const orchestraRows = Array.from(orchestraStyleMap.entries())
    .map(([artist, styles]) => {
      const styleObject = Object.fromEntries(styles.entries());
      const total = Object.values(styleObject).reduce((sum, value) => sum + value, 0);
      return { artist, total, styles: styleObject };
    })
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total;
      }
      return left.artist.localeCompare(right.artist);
    });

  const availableOrchestraRows = Array.from(availableOrchestraMap.entries())
    .map(([artist, entry]) => ({
      artist,
      trackCount: entry.trackCount,
      styles: Object.fromEntries(entry.styles.entries()),
      yearCount: entry.yearSet.size,
      tempoCount: entry.tempoSet.size,
    }))
    .sort((left, right) => {
      if (right.trackCount !== left.trackCount) {
        return right.trackCount - left.trackCount;
      }
      return left.artist.localeCompare(right.artist);
    });

  const yearBuckets = Array.from(tandaYearCountMap.entries()).sort((a, b) => a[0] - b[0]);
  const yearStyleBucketPairs = Array.from(tandaYearStyleCountMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, styleMap]) => [
      year,
      Array.from(styleMap.entries()).sort((left, right) => right[1] - left[1]),
    ] as [number, Array<[string, number]>]);
  const styleBuckets = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1]);
  const tempoBucketPairs = Array.from(tandaTempoCountMap.entries()).sort((a, b) => a[0] - b[0]);
  const tempoStyleBucketPairs = Array.from(tandaTempoStyleCountMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([tempo, styleMap]) => [
      tempo,
      Array.from(styleMap.entries()).sort((left, right) => right[1] - left[1]),
    ] as [number, Array<[string, number]>]);

  return {
    orchestraRows,
    availableOrchestraRows,
    yearBuckets,
    yearStyleBuckets: yearStyleBucketPairs,
    tempoBuckets: tempoBucketPairs,
    tempoStyleBuckets: tempoStyleBucketPairs,
    styleBuckets,
    availableYearBuckets: Array.from(availableYearCountMap.entries()).sort((a, b) => a[0] - b[0]),
    availableTempoBuckets: Array.from(availableTempoCountMap.entries()).sort((a, b) => a[0] - b[0]),
    availableStyleBuckets: Array.from(availableStyleCountMap.entries()).sort((a, b) => b[1] - a[1]),
  };
};
