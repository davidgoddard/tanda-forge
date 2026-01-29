import { TrackRow } from "../../shared/types";

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeSearchText = (value: string) =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeNgramText = (value: string) =>
  normalizeSearchText(value).replace(/\s+/g, "");

const getTrigrams = (value: string) => {
  const text = normalizeNgramText(value);
  if (!text) {
    return [] as string[];
  }
  if (text.length < 3) {
    return [text];
  }
  const grams: string[] = [];
  for (let i = 0; i <= text.length - 3; i += 1) {
    grams.push(text.slice(i, i + 3));
  }
  return grams;
};

const scoreText = (query: string, candidate: string) => {
  const normalizedQuery = normalizeNgramText(query);
  const normalizedCandidate = normalizeNgramText(candidate);
  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }
  if (normalizedQuery.length < 3) {
    return normalizedCandidate.includes(normalizedQuery) ? 1 : 0;
  }
  const queryGrams = getTrigrams(normalizedQuery);
  const candidateGrams = new Set(getTrigrams(normalizedCandidate));
  if (queryGrams.length === 0 || candidateGrams.size === 0) {
    return 0;
  }
  let matches = 0;
  queryGrams.forEach((gram) => {
    if (candidateGrams.has(gram)) {
      matches += 1;
    }
  });
  return matches / queryGrams.length;
};

const getTokens = (value: string) =>
  normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const levenshtein = (left: string, right: string) => {
  const a = left;
  const b = right;
  if (a === b) {
    return 0;
  }
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) {
    return bLen;
  }
  if (bLen === 0) {
    return aLen;
  }
  const row = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j += 1) {
    row[j] = j;
  }
  for (let i = 1; i <= aLen; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= bLen; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + cost,
      );
      prev = temp;
    }
  }
  return row[bLen];
};

const bestTokenSimilarity = (query: string, fields: string[]) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 0;
  }
  const queryTokens = getTokens(normalizedQuery);
  const queryTarget = queryTokens.join("");
  const queryLength = queryTarget.length;
  if (queryLength === 0) {
    return 0;
  }
  let best = 0;
  fields.forEach((field) => {
    getTokens(field).forEach((token) => {
      if (!token) {
        return;
      }
      const distance = levenshtein(queryTarget, token);
      const denom = Math.max(queryLength, token.length, 1);
      const similarity = 1 - distance / denom;
      if (similarity > best) {
        best = similarity;
      }
    });
  });
  return best;
};

const extractYears = (value: string) => {
  const years = Array.from(value.matchAll(/\d{4}/g)).map((match) =>
    Number.parseInt(match[0], 10),
  );
  return years.filter((year) => Number.isFinite(year));
};

const scoreYearMatch = (queryYear: number, yearField: string) => {
  const years = extractYears(yearField);
  if (years.length === 0) {
    return 0;
  }
  if (years.includes(queryYear)) {
    return 1;
  }
  const min = Math.min(...years);
  const max = Math.max(...years);
  return queryYear >= min && queryYear <= max ? 0.85 : 0;
};

const scoreBpmMatch = (queryBpm: number, trackBpm: number | null, range: number) => {
  if (!trackBpm || range <= 0) {
    return 0;
  }
  const diff = Math.abs(trackBpm - queryBpm);
  if (diff > range) {
    return 0;
  }
  const denom = range === 0 ? 1 : range;
  return Math.max(0, 1 - diff / denom);
};

const isNumericQuery = (query: string) => /^\d+$/.test(query.trim());

export type FuzzySearchConfig = {
  query: string;
  minScore: number;
  bpmRange: number;
};

export const buildTrackSearchText = (track: TrackRow) =>
  [
    track.title,
    track.artist_summary,
    track.artist,
    track.album,
    track.album_artist,
    track.genre,
    track.year,
  ]
    .filter(Boolean)
    .join(" ");

export const scoreTrackAgainstQuery = (
  query: string,
  track: TrackRow,
  bpmRange: number,
) => {
  const trimmed = query.trim();
  if (!trimmed) {
    return 1;
  }
  if (isNumericQuery(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10);
    if (trimmed.length === 4) {
      return scoreYearMatch(numeric, track.year ?? "");
    }
    return scoreBpmMatch(numeric, track.bpm, bpmRange);
  }
  const fields = [
    track.title,
    track.artist_summary,
    track.artist,
    track.album,
    track.album_artist,
    track.genre,
    track.year,
  ].filter(Boolean) as string[];
  const combined = fields.join(" ");
  const baseScore = Math.max(
    scoreText(trimmed, combined),
    ...fields.map((field) => scoreText(trimmed, field)),
  );
  const tokenBonus = bestTokenSimilarity(trimmed, fields) * 0.2;
  return Math.min(1, baseScore + tokenBonus);
};

export const filterAndScoreTracks = (
  tracks: TrackRow[],
  config: FuzzySearchConfig,
) => {
  const scored = tracks
    .map((track) => ({
      track,
      score: scoreTrackAgainstQuery(config.query, track, config.bpmRange),
    }))
    .filter((entry) => entry.score >= config.minScore);
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.track.title || "").localeCompare(b.track.title || "");
  });
  return scored;
};

export const normalizeSearchQuery = (query: string) => normalizeSearchText(query);
