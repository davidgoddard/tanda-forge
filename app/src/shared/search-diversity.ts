import { normalizeStyleName } from "./tanda-utils";

export type SearchDiversityDbRow = {
  tanda_id: string;
  tanda_style: string | null;
  artist_summary: string | null;
  artist: string | null;
  genre: string | null;
  year: string | null;
  bpm: number | null;
};

export type SearchDiversityStats = {
  orchestraRows: Array<{ artist: string; total: number; styles: Record<string, number> }>;
  yearBuckets: Array<[number, number]>;
  tempoBuckets: Array<[number, number]>;
  styleBuckets: Array<[string, number]>;
};

const extractYearValue = (value: string | null) => {
  if (!value) {
    return null;
  }
  const match = value.match(/\d{4}/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const computeSearchDiversityStats = (
  rows: SearchDiversityDbRow[],
): SearchDiversityStats => {
  const perTanda = new Map<
    string,
    { style: string; tracks: Omit<SearchDiversityDbRow, "tanda_id" | "tanda_style">[] }
  >();
  rows.forEach((row) => {
    const existing = perTanda.get(row.tanda_id);
    const normalizedTandaStyle = normalizeStyleName(row.tanda_style ?? "");
    const trackInfo = {
      artist_summary: row.artist_summary,
      artist: row.artist,
      genre: row.genre,
      year: row.year,
      bpm: row.bpm,
    };
    if (existing) {
      existing.tracks.push(trackInfo);
      if (!existing.style && normalizedTandaStyle) {
        existing.style = normalizedTandaStyle;
      }
      return;
    }
    perTanda.set(row.tanda_id, {
      style: normalizedTandaStyle,
      tracks: [trackInfo],
    });
  });

  const orchestraStyleCounts = new Map<string, Map<string, number>>();
  const styleCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  const tempoCounts = new Map<number, number>();

  perTanda.forEach((tanda) => {
    const style =
      tanda.style ||
      tanda.tracks
        .map((track) => normalizeStyleName(track.genre ?? ""))
        .find(Boolean) ||
      "unknown";
    styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);

    const artists = new Set<string>();
    tanda.tracks.forEach((track) => {
      const artist =
        track.artist_summary?.trim() ||
        track.artist?.trim() ||
        "Unknown";
      artists.add(artist);
      const year = extractYearValue(track.year ?? null);
      if (year !== null) {
        yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      }
      if (track.bpm !== null && track.bpm !== undefined && Number.isFinite(track.bpm)) {
        const bpm = Math.round(track.bpm);
        tempoCounts.set(bpm, (tempoCounts.get(bpm) ?? 0) + 1);
      }
    });

    artists.forEach((artist) => {
      const map = orchestraStyleCounts.get(artist) ?? new Map<string, number>();
      map.set(style, (map.get(style) ?? 0) + 1);
      orchestraStyleCounts.set(artist, map);
    });
  });

  const orchestraRows = Array.from(orchestraStyleCounts.entries())
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

  const yearBuckets = Array.from(yearCounts.entries()).sort((a, b) => a[0] - b[0]);
  const tempoBuckets = Array.from(tempoCounts.entries()).sort((a, b) => a[0] - b[0]);
  const styleBuckets = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1]);

  return {
    orchestraRows,
    yearBuckets,
    tempoBuckets,
    styleBuckets,
  };
};
