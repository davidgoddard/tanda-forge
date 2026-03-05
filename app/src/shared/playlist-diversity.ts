export const normalizeArtistGroupKey = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

export const isArtistGapSatisfied = (params: {
  artist: string;
  currentTotalMs: number;
  repeatGapMs: number;
  artistLastPlayedAtMs: Map<string, number>;
}) => {
  const { artist, currentTotalMs, repeatGapMs, artistLastPlayedAtMs } = params;
  if (!artist || repeatGapMs <= 0) {
    return true;
  }
  const last = artistLastPlayedAtMs.get(artist);
  return last === undefined || currentTotalMs - last >= repeatGapMs;
};

export const areArtistsGapSatisfied = <T>(params: {
  items: T[];
  getArtistKey: (item: T) => string;
  currentTotalMs: number;
  repeatGapMs: number;
  artistLastPlayedAtMs: Map<string, number>;
}) => {
  const { items, getArtistKey, currentTotalMs, repeatGapMs, artistLastPlayedAtMs } =
    params;
  return items.every((item) =>
    isArtistGapSatisfied({
      artist: getArtistKey(item),
      currentTotalMs,
      repeatGapMs,
      artistLastPlayedAtMs,
    }),
  );
};

export const collectEligibleArtistGroups = <T>(params: {
  items: T[];
  usedGroups: Set<string>;
  requiredCount: number;
  getArtistGroupKey: (item: T) => string;
  getTitleKey: (item: T) => string;
}) => {
  const { items, usedGroups, requiredCount, getArtistGroupKey, getTitleKey } = params;
  const grouped = new Map<string, Set<string>>();
  items.forEach((item) => {
    const group = normalizeArtistGroupKey(getArtistGroupKey(item));
    if (!group || usedGroups.has(group)) {
      return;
    }
    const title = getTitleKey(item).trim();
    if (!title) {
      return;
    }
    const titles = grouped.get(group) ?? new Set<string>();
    titles.add(title);
    grouped.set(group, titles);
  });
  return new Set(
    Array.from(grouped.entries())
      .filter(([, titles]) => titles.size >= requiredCount)
      .map(([group]) => group),
  );
};

export const collectEligibleArtistStyleGroups = <T>(params: {
  items: T[];
  usedGroups: Set<string>;
  requiredCount: number;
  getArtistGroupKey: (item: T) => string;
  getStyleKey: (item: T) => string;
  getTitleKey: (item: T) => string;
}) => {
  const {
    items,
    usedGroups,
    requiredCount,
    getArtistGroupKey,
    getStyleKey,
    getTitleKey,
  } = params;
  const grouped = new Map<string, Set<string>>();
  items.forEach((item) => {
    const artist = normalizeArtistGroupKey(getArtistGroupKey(item));
    const style = getStyleKey(item).trim().toLowerCase();
    if (!artist || !style) {
      return;
    }
    const group = `${artist}|${style}`;
    if (usedGroups.has(group)) {
      return;
    }
    const title = getTitleKey(item).trim();
    if (!title) {
      return;
    }
    const titles = grouped.get(group) ?? new Set<string>();
    titles.add(title);
    grouped.set(group, titles);
  });
  return new Set(
    Array.from(grouped.entries())
      .filter(([, titles]) => titles.size >= requiredCount)
      .map(([group]) => group),
  );
};

export const isTandaArtistStyleAvailable = (params: {
  artistGroup: string;
  styleGroup: string;
  trackCount: number;
  requiredCount: number;
  usedGroups: Set<string>;
}) => {
  const {
    artistGroup,
    styleGroup,
    trackCount,
    requiredCount,
    usedGroups,
  } = params;
  if (!artistGroup || !styleGroup) {
    return false;
  }
  if (trackCount !== requiredCount) {
    return false;
  }
  return !usedGroups.has(`${artistGroup}|${styleGroup}`);
};

export const buildAdaptiveNumericDistribution = (
  counts: Map<number, number>,
  maxDensePoints = 30,
  histogramBuckets = 30,
) => {
  if (counts.size === 0) {
    return [] as { label: string; value: number }[];
  }
  const keys = Array.from(counts.keys()).sort((a, b) => a - b);
  const min = keys[0] ?? 0;
  const max = keys[keys.length - 1] ?? 0;
  const span = max - min + 1;
  if (span <= maxDensePoints) {
    const rows: { label: string; value: number }[] = [];
    for (let value = min; value <= max; value += 1) {
      rows.push({
        label: value.toString(),
        value: counts.get(value) ?? 0,
      });
    }
    return rows;
  }
  const bucketCount = Math.max(1, histogramBuckets);
  const bucketWidth = span / bucketCount;
  const rows: { label: string; value: number }[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const start = Math.floor(min + index * bucketWidth);
    const nextStart = Math.floor(min + (index + 1) * bucketWidth);
    const end = index === bucketCount - 1 ? max : Math.max(start, nextStart - 1);
    let value = 0;
    for (let point = start; point <= end; point += 1) {
      value += counts.get(point) ?? 0;
    }
    rows.push({
      label: start === end ? `${start}` : `${start}-${end}`,
      value,
    });
  }
  return rows;
};

const mergeStyleCounts = (
  target: Record<string, number>,
  source: Record<string, number> | undefined,
) => {
  if (!source) {
    return target;
  }
  Object.entries(source).forEach(([style, value]) => {
    if (!style || !Number.isFinite(value) || value <= 0) {
      return;
    }
    target[style] = (target[style] ?? 0) + value;
  });
  return target;
};

export const buildAdaptiveStyleNumericDistribution = (
  counts: Map<number, Record<string, number>>,
  maxDensePoints = 30,
  histogramBuckets = 30,
) => {
  if (counts.size === 0) {
    return [] as { label: string; value: number; styleValues: Record<string, number> }[];
  }
  const keys = Array.from(counts.keys()).sort((a, b) => a - b);
  const min = keys[0] ?? 0;
  const max = keys[keys.length - 1] ?? 0;
  const span = max - min + 1;
  if (span <= maxDensePoints) {
    const rows: { label: string; value: number; styleValues: Record<string, number> }[] = [];
    for (let bucket = min; bucket <= max; bucket += 1) {
      const styleValues = { ...(counts.get(bucket) ?? {}) };
      const value = Object.values(styleValues).reduce((sum, current) => sum + current, 0);
      rows.push({
        label: bucket.toString(),
        value,
        styleValues,
      });
    }
    return rows;
  }
  const bucketCount = Math.max(1, histogramBuckets);
  const bucketWidth = span / bucketCount;
  const rows: { label: string; value: number; styleValues: Record<string, number> }[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const start = Math.floor(min + index * bucketWidth);
    const nextStart = Math.floor(min + (index + 1) * bucketWidth);
    const end = index === bucketCount - 1 ? max : Math.max(start, nextStart - 1);
    const styleValues: Record<string, number> = {};
    for (let point = start; point <= end; point += 1) {
      mergeStyleCounts(styleValues, counts.get(point));
    }
    const value = Object.values(styleValues).reduce((sum, current) => sum + current, 0);
    rows.push({
      label: start === end ? `${start}` : `${start}-${end}`,
      value,
      styleValues,
    });
  }
  return rows;
};

export type OrchestraDurationEntry = {
  artist: string;
  seconds: number;
  style: string;
  tandaId: string | null;
};

export type OrchestraDurationRow = {
  label: string;
  totalSeconds: number;
  tandaCount: number;
  styleSeconds: Record<string, number>;
};

export const aggregateOrchestraDurations = (
  entries: OrchestraDurationEntry[],
) => {
  const byArtist = new Map<
    string,
    { totalSeconds: number; styleSeconds: Map<string, number>; tandaIds: Set<string> }
  >();
  entries.forEach((entry) => {
    const artist = entry.artist.trim();
    if (!artist || !Number.isFinite(entry.seconds) || entry.seconds <= 0) {
      return;
    }
    const style = entry.style.trim() || "unknown";
    const bucket = byArtist.get(artist) ?? {
      totalSeconds: 0,
      styleSeconds: new Map<string, number>(),
      tandaIds: new Set<string>(),
    };
    bucket.totalSeconds += entry.seconds;
    bucket.styleSeconds.set(style, (bucket.styleSeconds.get(style) ?? 0) + entry.seconds);
    if (entry.tandaId) {
      bucket.tandaIds.add(entry.tandaId);
    }
    byArtist.set(artist, bucket);
  });
  return Array.from(byArtist.entries())
    .map(([label, value]) => ({
      label,
      totalSeconds: value.totalSeconds,
      tandaCount: value.tandaIds.size,
      styleSeconds: Object.fromEntries(value.styleSeconds.entries()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
