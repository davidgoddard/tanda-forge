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

const scorePhraseInQuery = (phrase: string, query: string) => {
  const normalizedPhrase = normalizeSearchText(phrase);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedPhrase || !normalizedQuery) {
    return 0;
  }
  const trigramScore = scoreText(normalizedPhrase, normalizedQuery);
  const tokenScore = bestTokenSimilarity(normalizedPhrase, [normalizedQuery]);
  return Math.max(trigramScore, tokenScore);
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
  return 1;
};

const isNumericQuery = (query: string) => /^\d+$/.test(query.trim());

const YEAR_MIN = 1900;
const YEAR_MAX = new Date().getFullYear() + 1;
const STOPWORDS = new Set(["orquesta", "orchestra", "tipica", "tipico"]);

type SearchMode = "lookup" | "similarity";
type StyleToken = "" | "tango" | "milonga" | "waltz";

type ParsedQuery = {
  mode: SearchMode;
  textTokens: string[];
  phraseTokens: string[];
  hasQuotedPhrase: boolean;
  yearTokens: number[];
  tempoTokens: number[];
  styleTokens: StyleToken[];
};

const normalizeStyleToken = (token: string): StyleToken => {
  const normalized = normalizeSearchText(token);
  if (!normalized) {
    return "";
  }
  if (normalized === "tango") {
    return "tango";
  }
  if (normalized === "milonga") {
    return "milonga";
  }
  if (
    normalized === "vals" ||
    normalized === "valz" ||
    normalized === "waltz" ||
    normalized === "walz"
  ) {
    return "waltz";
  }
  return "";
};

const extractQuotedPhrases = (query: string) => {
  const phrases: string[] = [];
  const stripped = query.replace(/"([^"]+)"/g, (_full, group: string) => {
    const normalized = normalizeSearchText(group);
    if (normalized) {
      phrases.push(normalized);
    }
    return " ";
  });
  return { phrases, stripped };
};

const parseQuery = (query: string): ParsedQuery => {
  const { phrases, stripped } = extractQuotedPhrases(query);
  const normalized = normalizeSearchText(stripped);
  if (!normalized) {
    return {
      mode: "lookup",
      textTokens: [],
      phraseTokens: phrases,
      hasQuotedPhrase: phrases.length > 0,
      yearTokens: [],
      tempoTokens: [],
      styleTokens: [],
    };
  }
  const tokens = normalized.split(" ").filter(Boolean);
  const yearTokens: number[] = [];
  const tempoTokens: number[] = [];
  const styleTokens: StyleToken[] = [];
  const textTokens: string[] = [];
  tokens.forEach((token) => {
    if (STOPWORDS.has(token)) {
      return;
    }
    const style = normalizeStyleToken(token);
    if (style) {
      styleTokens.push(style);
      return;
    }
    if (/^\d{4}$/.test(token)) {
      const year = Number.parseInt(token, 10);
      if (year >= YEAR_MIN && year <= YEAR_MAX) {
        yearTokens.push(year);
        return;
      }
    }
    if (/^\d{2,3}$/.test(token)) {
      tempoTokens.push(Number.parseInt(token, 10));
      return;
    }
    textTokens.push(token);
  });
  const hasSimilarityIntent =
    yearTokens.length > 0 || tempoTokens.length > 0 || styleTokens.length > 0;
  const mode: SearchMode = hasSimilarityIntent || textTokens.length === 2
    ? "similarity"
    : "lookup";
  return {
    mode,
    textTokens,
    phraseTokens: phrases,
    hasQuotedPhrase: phrases.length > 0,
    yearTokens,
    tempoTokens,
    styleTokens,
  };
};

const scoreYearProximity = (diff: number) => {
  if (diff <= 0) {
    return 1;
  }
  if (diff === 1) {
    return 0.9;
  }
  if (diff === 2) {
    return 0.8;
  }
  if (diff <= 3) {
    return 0.65;
  }
  if (diff <= 5) {
    return 0.45;
  }
  if (diff <= 10) {
    return 0.2;
  }
  return 0;
};

const scoreTempoProximity = (diff: number) => {
  if (diff <= 0) {
    return 1;
  }
  if (diff === 1) {
    return 0.95;
  }
  if (diff === 2) {
    return 0.9;
  }
  if (diff <= 4) {
    return 0.8;
  }
  if (diff <= 6) {
    return 0.65;
  }
  if (diff <= 8) {
    return 0.5;
  }
  if (diff <= 10) {
    return 0.35;
  }
  return 0;
};

const scoreYearIntent = (queryYears: number[], yearField: string) => {
  const years = extractYears(yearField);
  if (queryYears.length === 0) {
    return null;
  }
  if (years.length === 0) {
    return 0.35;
  }
  let best = 0;
  queryYears.forEach((queryYear) => {
    years.forEach((candidate) => {
      const score = scoreYearProximity(Math.abs(candidate - queryYear));
      if (score > best) {
        best = score;
      }
    });
  });
  return best;
};

const scoreTempoIntent = (
  queryTempos: number[],
  trackBpm: number | null,
) => {
  if (queryTempos.length === 0) {
    return null;
  }
  if (trackBpm === null || trackBpm === undefined || !Number.isFinite(trackBpm)) {
    return 0.25;
  }
  let best = 0;
  queryTempos.forEach((queryTempo) => {
    const score = scoreTempoProximity(Math.abs(trackBpm - queryTempo));
    if (score > best) {
      best = score;
    }
  });
  return best;
};

const scoreStyleIntent = (
  queryStyles: StyleToken[],
  styleField: string,
) => {
  if (queryStyles.length === 0) {
    return null;
  }
  const styleTokens = getTokens(styleField);
  if (styleTokens.length === 0) {
    return 0.3;
  }
  const canonicalTrackStyles = new Set(
    styleTokens
      .map((token) => normalizeStyleToken(token))
      .filter(Boolean),
  );
  if (canonicalTrackStyles.size === 0) {
    return 0;
  }
  return queryStyles.some((queryStyle) => canonicalTrackStyles.has(queryStyle))
    ? 1
    : 0;
};

const scoreFieldText = (queryText: string, candidateField: string) =>
  Math.max(
    scoreText(queryText, candidateField),
    bestTokenSimilarity(queryText, [candidateField]),
  );

const scoreTermsAgainstField = (terms: string[], field: string) => {
  if (terms.length === 0 || !field) {
    return null;
  }
  const values = terms.map((term) => scoreFieldText(term, field));
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

const scoreNotesText = (terms: string[], track: TrackRow) => {
  const notesField = [track.notes || "", track.album || "", track.genre || ""]
    .filter(Boolean)
    .join(" ");
  return scoreTermsAgainstField(terms, notesField);
};

type ScoreBreakdown = {
  score: number;
  mode: SearchMode;
  artistScore: number;
  titleScore: number;
  styleScore: number | null;
  yearScore: number | null;
  tempoScore: number | null;
  notesScore: number | null;
};

export type FuzzySearchConfig = {
  query: string;
  minScore: number;
  bpmRange: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export const buildTrackSearchText = (track: TrackRow) =>
  [
    track.title,
    track.artist_summary,
    track.artist,
    track.singer,
    track.album,
    track.genre,
    track.year,
    track.notes,
  ]
    .filter(Boolean)
    .join(" ");

export const scoreTrackAgainstQuery = (
  query: string,
  track: TrackRow,
  bpmRange: number,
) => {
  return scoreTrackWithBreakdown(query, track, bpmRange).score;
};

const scoreTrackWithBreakdown = (
  query: string,
  track: TrackRow,
  bpmRange: number,
): ScoreBreakdown => {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      score: 1,
      mode: "lookup",
      artistScore: 0,
      titleScore: 0,
      styleScore: null,
      yearScore: null,
      tempoScore: null,
      notesScore: null,
    };
  }
  if (isNumericQuery(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10);
    const score = trimmed.length === 4
      ? scoreYearMatch(numeric, track.year ?? "")
      : scoreBpmMatch(numeric, track.bpm, bpmRange);
    return {
      score,
      mode: "similarity",
      artistScore: 0,
      titleScore: 0,
      styleScore: null,
      yearScore: trimmed.length === 4 ? score : null,
      tempoScore: trimmed.length === 4 ? null : score,
      notesScore: null,
    };
  }
  const parsed = parseQuery(trimmed);
  const components: Array<{ score: number; weight: number }> = [];
  const lookupWeights = {
    title: 0.46,
    artist: 0.36,
    year: 0.1,
    tempo: 0.05,
    style: 0.03,
    notes: 0,
  };
  const similarityWeights = {
    artist: 0.4,
    style: 0.22,
    tempo: 0.16,
    year: 0.16,
    title: 0.04,
    notes: 0.02,
  };
  const weights = parsed.mode === "similarity" ? similarityWeights : lookupWeights;
  const textTerms = [...parsed.phraseTokens, ...parsed.textTokens];
  const artistField = [
    track.artist_summary || "",
    track.artist || "",
    track.singer || "",
  ]
    .filter(Boolean)
    .join(" ");
  const titleField = track.title || "";
  const artistTermScore = scoreTermsAgainstField(textTerms, artistField);
  const titleTermScore = scoreTermsAgainstField(textTerms, titleField);
  const phraseBoost = parsed.hasQuotedPhrase && parsed.phraseTokens.length > 0
    ? Math.max(
        ...parsed.phraseTokens.map((phrase) =>
          Math.max(
            scorePhraseInQuery(phrase, titleField),
            scorePhraseInQuery(phrase, artistField),
          )
        ),
      )
    : 0;
  const artistScore = artistTermScore === null
    ? 0
    : Math.min(1, artistTermScore + (parsed.mode === "similarity" ? 0.05 * phraseBoost : 0));
  const titleScore = titleTermScore === null
    ? 0
    : Math.min(1, titleTermScore + (parsed.mode === "lookup" ? 0.15 * phraseBoost : 0));
  if (textTerms.length > 0) {
    components.push({ score: artistScore, weight: weights.artist });
    components.push({ score: titleScore, weight: weights.title });
  }
  const styleScore = scoreStyleIntent(parsed.styleTokens, track.genre || "");
  if (styleScore !== null) {
    components.push({ score: styleScore, weight: weights.style });
  }
  const yearScore = scoreYearIntent(parsed.yearTokens, track.year ?? "");
  if (yearScore !== null) {
    components.push({ score: yearScore, weight: weights.year });
  }
  const tempoScore = scoreTempoIntent(parsed.tempoTokens, track.bpm);
  if (tempoScore !== null) {
    components.push({ score: tempoScore, weight: weights.tempo });
  }
  const notesScore = scoreNotesText(textTerms, track);
  if (notesScore !== null && weights.notes > 0) {
    components.push({ score: notesScore, weight: weights.notes });
  }
  if (components.length === 0) {
    const fields = [
      track.title,
      track.artist_summary,
      track.artist,
      track.singer,
      track.album,
      track.genre,
      track.year,
      track.notes,
    ].filter(Boolean) as string[];
    const fallbackScore = fields.length === 0
      ? 0
      : Math.max(
          scoreText(trimmed, fields.join(" ")),
          ...fields.map((field) => scoreText(trimmed, field)),
        );
    return {
      score: fallbackScore,
      mode: parsed.mode,
      artistScore,
      titleScore,
      styleScore,
      yearScore,
      tempoScore,
      notesScore,
    };
  }
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weighted = totalWeight <= 0
    ? 0
    : components.reduce((sum, component) => sum + component.score * component.weight, 0) /
      totalWeight;
  return {
    score: Math.min(1, Math.max(0, weighted)),
    mode: parsed.mode,
    artistScore,
    titleScore,
    styleScore,
    yearScore,
    tempoScore,
    notesScore,
  };
};

export const filterAndScoreTracks = (
  tracks: TrackRow[],
  config: FuzzySearchConfig,
) => {
  const scored = tracks
    .map((track) => ({
      track,
      breakdown: scoreTrackWithBreakdown(config.query, track, config.bpmRange),
    }))
    .filter((entry) => entry.breakdown.score >= config.minScore)
    .map((entry) => ({ track: entry.track, score: entry.breakdown.score, breakdown: entry.breakdown }));
  const sortBy = config.sortBy?.toLowerCase() ?? "score";
  const sortDir = config.sortDir ?? "desc";
  const direction = sortDir === "desc" ? -1 : 1;
  const getSortValue = (track: TrackRow) => {
    switch (sortBy) {
      case "title":
        return track.title ?? "";
      case "artist":
        return track.artist_summary || track.artist || "";
      case "album":
        return track.album ?? "";
      case "year":
        return track.year ?? "";
      default:
        return "";
    }
  };
  scored.sort((a, b) => {
    if (sortBy === "score") {
      if (b.breakdown.score !== a.breakdown.score) {
        return b.breakdown.score - a.breakdown.score;
      }
      if (b.breakdown.artistScore !== a.breakdown.artistScore) {
        return b.breakdown.artistScore - a.breakdown.artistScore;
      }
      const leftStyle = a.breakdown.styleScore ?? -1;
      const rightStyle = b.breakdown.styleScore ?? -1;
      if (rightStyle !== leftStyle) {
        return rightStyle - leftStyle;
      }
      const leftTempo = a.breakdown.tempoScore ?? -1;
      const rightTempo = b.breakdown.tempoScore ?? -1;
      if (rightTempo !== leftTempo) {
        return rightTempo - leftTempo;
      }
      const leftYear = a.breakdown.yearScore ?? -1;
      const rightYear = b.breakdown.yearScore ?? -1;
      if (rightYear !== leftYear) {
        return rightYear - leftYear;
      }
      if (b.breakdown.titleScore !== a.breakdown.titleScore) {
        return b.breakdown.titleScore - a.breakdown.titleScore;
      }
    } else {
      const left = getSortValue(a.track);
      const right = getSortValue(b.track);
      if (sortBy === "year") {
        const leftNum = Number.parseInt(left, 10);
        const rightNum = Number.parseInt(right, 10);
        if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
          return (leftNum - rightNum) * direction;
        }
      }
      const cmp = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) {
        return cmp * direction;
      }
    }
    if (b.breakdown.score !== a.breakdown.score) {
      return b.breakdown.score - a.breakdown.score;
    }
    return (a.track.title || "").localeCompare(b.track.title || "");
  });
  return scored.map((entry) => ({ track: entry.track, score: entry.breakdown.score }));
};

export const normalizeSearchQuery = (query: string) => normalizeSearchText(query);
