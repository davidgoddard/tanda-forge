import { TrackRow } from "../../shared/types";
import { ORCHESTRA_SEED_DATA } from "../../shared/orchestra-seed";
import {
  buildOrchestraAliasIndex,
  convertSeedToRegistry,
  normalizeOrchestraText,
} from "../../shared/orchestra-registry";

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
  const normalizedQueryWords = getTokens(query);
  const normalizedCandidateWords = getTokens(candidate);
  const normalizedQuery = normalizeNgramText(query);
  const normalizedCandidate = normalizeNgramText(candidate);
  if (
    !normalizedQuery ||
    !normalizedCandidate ||
    normalizedQueryWords.length === 0 ||
    normalizedCandidateWords.length === 0
  ) {
    return 0;
  }
  if (normalizedQuery.length < 3) {
    if (normalizedQueryWords.length === 1) {
      return normalizedCandidateWords.includes(normalizedQueryWords[0]!) ? 1 : 0;
    }
    return normalizeSearchText(candidate).includes(normalizeSearchText(query)) ? 1 : 0;
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

const containsWholePhrase = (haystack: string, needle: string) => {
  if (!haystack || !needle) {
    return false;
  }
  return ` ${haystack} `.includes(` ${needle} `);
};

const resolveOrchestraEntryForArtistField = (value: string) => {
  const normalized = normalizeOrchestraText(value);
  if (!normalized) {
    return null;
  }
  const direct = ORCHESTRA_ALIAS_INDEX.get(normalized);
  if (direct) {
    return ORCHESTRA_BY_ID.get(direct) ?? null;
  }
  for (const entry of ORCHESTRA_REGISTRY) {
    const keys = [entry.canonical, ...entry.aliases]
      .map((candidate) => normalizeOrchestraText(candidate))
      .filter(Boolean);
    if (keys.some((key) => containsWholePhrase(normalized, key))) {
      return entry;
    }
  }
  return null;
};

const buildArtistFieldWithAliases = (artistField: string) => {
  if (!artistField) {
    return "";
  }
  const cached = ARTIST_FIELD_VARIANT_CACHE.get(artistField);
  if (cached !== undefined) {
    return cached;
  }
  const entry = resolveOrchestraEntryForArtistField(artistField);
  if (!entry) {
    ARTIST_FIELD_VARIANT_CACHE.set(artistField, artistField);
    return artistField;
  }
  const expanded = [artistField, entry.canonical, ...entry.aliases]
    .filter(Boolean)
    .join(" ");
  ARTIST_FIELD_VARIANT_CACHE.set(artistField, expanded);
  return expanded;
};

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
const ORCHESTRA_REGISTRY = convertSeedToRegistry(ORCHESTRA_SEED_DATA);
const ORCHESTRA_ALIAS_INDEX = buildOrchestraAliasIndex(ORCHESTRA_REGISTRY);
const ORCHESTRA_BY_ID = new Map(
  ORCHESTRA_REGISTRY.map((entry) => [entry.id, entry]),
);
const ARTIST_FIELD_VARIANT_CACHE = new Map<string, string>();

type SearchMode = "lookup" | "similarity";
type SearchScope = "all" | "artist";
type ScopedSearchQuery = {
  scope: SearchScope;
  query: string;
};

type ParsedQuery = {
  mode: SearchMode;
  textTokens: string[];
  phraseTokens: string[];
  hasQuotedPhrase: boolean;
  yearTokens: number[];
  tempoTokens: number[];
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

export const parseScopedSearchQuery = (query: string): ScopedSearchQuery => {
  const trimmed = query.trim();
  const match = trimmed.match(/^([a-z][a-z0-9_-]*)\s*:\s*(.*)$/i);
  if (!match) {
    return { scope: "all", query: trimmed };
  }
  const label = normalizeSearchText(match[1] ?? "");
  const scopedValue = (match[2] ?? "").trim();
  if (label === "artist") {
    return { scope: "artist", query: scopedValue };
  }
  return { scope: "all", query: trimmed };
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
    };
  }
  const tokens = normalized.split(" ").filter(Boolean);
  const yearTokens: number[] = [];
  const tempoTokens: number[] = [];
  const textTokens: string[] = [];
  tokens.forEach((token) => {
    if (STOPWORDS.has(token)) {
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
  const hasSimilarityIntent = yearTokens.length > 0 || tempoTokens.length > 0;
  const mode: SearchMode = hasSimilarityIntent ? "similarity" : "lookup";
  return {
    mode,
    textTokens,
    phraseTokens: phrases,
    hasQuotedPhrase: phrases.length > 0,
    yearTokens,
    tempoTokens,
  };
};

const scoreArtistScopedQuery = (query: string, track: TrackRow): ScoreBreakdown => {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      score: 1,
      mode: "lookup",
      artistScore: 0,
      titleScore: 0,
      yearScore: null,
      tempoScore: null,
      notesScore: null,
      textMatchedTerms: 0,
      textUnmatchedFieldTokens: 0,
    };
  }
  const artistField = [track.artist_summary || "", track.artist || ""]
    .filter(Boolean)
    .join(" ");
  const expandedArtistField = buildArtistFieldWithAliases(artistField);
  const queryEntry = resolveOrchestraEntryForArtistField(trimmed);
  let artistScore = 0;
  if (queryEntry) {
    const normalizedExpanded = normalizeOrchestraText(expandedArtistField);
    const keys = [queryEntry.canonical, ...queryEntry.aliases]
      .map((value) => normalizeOrchestraText(value))
      .filter(Boolean);
    artistScore = keys.some((key) => containsWholePhrase(normalizedExpanded, key)) ? 1 : 0;
  } else {
    const { phrases, stripped } = extractQuotedPhrases(trimmed);
    const textTokens = normalizeSearchText(stripped)
      .split(" ")
      .filter((token) => token.length > 0 && !STOPWORDS.has(token));
    const terms = [...phrases, ...textTokens];
    const termScore = scoreTermsAgainstField(terms, expandedArtistField) ?? 0;
    const fieldScore = scoreFieldText(trimmed, expandedArtistField);
    artistScore = Math.max(termScore, fieldScore);
  }
    return {
      score: artistScore,
      mode: "lookup",
      artistScore,
      titleScore: 0,
      yearScore: null,
      tempoScore: null,
      notesScore: null,
      textMatchedTerms: 0,
      textUnmatchedFieldTokens: 0,
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

const scoreFieldText = (queryText: string, candidateField: string) =>
  Math.max(
    scoreText(queryText, candidateField),
    bestTokenSimilarity(queryText, [candidateField]),
  );

const scoreTokenPair = (queryToken: string, candidateToken: string) => {
  if (queryToken.length <= 4 || candidateToken.length <= 4) {
    if (queryToken === candidateToken) {
      return 1;
    }
    if (queryToken.length >= 5 && queryToken.includes(candidateToken)) {
      return candidateToken.length / queryToken.length;
    }
    if (candidateToken.length >= 5 && candidateToken.includes(queryToken)) {
      return queryToken.length / candidateToken.length;
    }
    return 0;
  }
  const similarity = Math.max(
    scoreText(queryToken, candidateToken),
    bestTokenSimilarity(queryToken, [candidateToken]),
  );
  return similarity >= 0.55 ? similarity : 0;
};

type TokenMatchMetrics = {
  matchedCount: number;
  unmatchedFieldTokens: number;
  averageSimilarity: number;
  queryCoverage: number;
  fieldPurity: number;
  score: number;
};

const buildTokenMatchMetrics = (
  queryTokens: string[],
  field: string,
  options?: { ignoreStopwords?: boolean },
): TokenMatchMetrics | null => {
  if (queryTokens.length === 0 || !field) {
    return null;
  }
  const fieldTokens = Array.from(new Set(
    getTokens(field).filter((token) =>
      options?.ignoreStopwords ? !STOPWORDS.has(token) : true,
    ),
  ),
  );
  if (fieldTokens.length === 0) {
    return {
      matchedCount: 0,
      unmatchedFieldTokens: 0,
      averageSimilarity: 0,
      queryCoverage: 0,
      fieldPurity: 0,
      score: 0,
    };
  }
  const uniqueQueryTokens = Array.from(new Set(queryTokens));
  const candidates: Array<{ queryIndex: number; fieldIndex: number; similarity: number }> = [];
  uniqueQueryTokens.forEach((queryToken, queryIndex) => {
    fieldTokens.forEach((candidateToken, fieldIndex) => {
      const similarity = scoreTokenPair(queryToken, candidateToken);
      if (similarity > 0) {
        candidates.push({ queryIndex, fieldIndex, similarity });
      }
    });
  });
  candidates.sort((left, right) => right.similarity - left.similarity);
  const usedQueries = new Set<number>();
  const usedFields = new Set<number>();
  let matchedCount = 0;
  let similarityTotal = 0;
  candidates.forEach((candidate) => {
    if (usedQueries.has(candidate.queryIndex) || usedFields.has(candidate.fieldIndex)) {
      return;
    }
    usedQueries.add(candidate.queryIndex);
    usedFields.add(candidate.fieldIndex);
    matchedCount += 1;
    similarityTotal += candidate.similarity;
  });
  const averageSimilarity = matchedCount > 0 ? similarityTotal / matchedCount : 0;
  const queryCoverage = matchedCount / uniqueQueryTokens.length;
  const fieldPurity = matchedCount / fieldTokens.length;
  return {
    matchedCount,
    unmatchedFieldTokens: Math.max(0, fieldTokens.length - matchedCount),
    averageSimilarity,
    queryCoverage,
    fieldPurity,
    score: queryCoverage * fieldPurity * averageSimilarity,
  };
};

const scoreQueryTokensAgainstField = (
  queryTokens: string[],
  field: string,
  options?: { ignoreStopwords?: boolean },
) => {
  return buildTokenMatchMetrics(queryTokens, field, options)?.score ?? null;
};

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

type ScoreBreakdown = {
  score: number;
  mode: SearchMode;
  artistScore: number;
  titleScore: number;
  yearScore: number | null;
  tempoScore: number | null;
  notesScore: number | null;
  textMatchedTerms: number;
  textUnmatchedFieldTokens: number;
};

type SearchTrackRow = TrackRow & {
  album_artist?: string | null;
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
    (track as SearchTrackRow).album_artist,
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
  const searchTrack = track as SearchTrackRow;
  const scoped = parseScopedSearchQuery(query);
  const trimmed = scoped.query.trim();
  if (!trimmed) {
    return {
      score: 1,
      mode: "lookup",
      artistScore: 0,
      titleScore: 0,
      yearScore: null,
      tempoScore: null,
      notesScore: null,
      textMatchedTerms: 0,
      textUnmatchedFieldTokens: 0,
    };
  }
  if (scoped.scope === "artist") {
    return scoreArtistScopedQuery(trimmed, track);
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
      yearScore: trimmed.length === 4 ? score : null,
      tempoScore: trimmed.length === 4 ? null : score,
      notesScore: null,
      textMatchedTerms: 0,
      textUnmatchedFieldTokens: 0,
    };
  }
  const parsed = parseQuery(trimmed);
  const components: Array<{ score: number; weight: number }> = [];
  const lookupWeights = {
    title: 0.3,
    artist: 0.42,
    singer: 0.28,
    year: 0.1,
    tempo: 0.05,
    notes: 0.3,
    supporting: 0.08,
  };
  const similarityWeights = {
    artist: 0.4,
    singer: 0.18,
    tempo: 0.16,
    year: 0.16,
    title: 0.04,
    notes: 0.02,
    supporting: 0.02,
  };
  const weights = parsed.mode === "similarity" ? similarityWeights : lookupWeights;
  const textTerms = [...parsed.phraseTokens, ...parsed.textTokens];
  const queryCoverageTokens = Array.from(
    new Set(
      textTerms.flatMap((term) => getTokens(term)).filter((token) => token.length > 0),
    ),
  );
  const artistField = [
    track.artist_summary || "",
    track.artist || "",
    track.singer || "",
  ]
    .filter(Boolean)
    .join(" ");
  const expandedArtistField = buildArtistFieldWithAliases(artistField);
  const titleField = track.title || "";
  const singerField = track.singer || "";
  const artistTermScore = scoreTermsAgainstField(textTerms, expandedArtistField);
  const singerTermScore = scoreTermsAgainstField(textTerms, singerField);
  const titleTermScore = scoreTermsAgainstField(textTerms, titleField);
  const titleCoverageMetrics = buildTokenMatchMetrics(queryCoverageTokens, titleField);
  const artistCoverageScore = scoreQueryTokensAgainstField(queryCoverageTokens, artistField, {
    ignoreStopwords: true,
  });
  const singerCoverageScore = scoreQueryTokensAgainstField(queryCoverageTokens, singerField, {
    ignoreStopwords: true,
  });
  const titleCoverageScore = scoreQueryTokensAgainstField(queryCoverageTokens, titleField);
  const phraseBoost = parsed.hasQuotedPhrase && parsed.phraseTokens.length > 0
    ? Math.max(
        ...parsed.phraseTokens.map((phrase) =>
          Math.max(
            scorePhraseInQuery(phrase, titleField),
            scorePhraseInQuery(phrase, expandedArtistField),
          )
        ),
      )
    : 0;
  const allowWholeFieldBackstop = queryCoverageTokens.length <= 1;
  const applyFieldScore = (coverageScore: number | null, termScore: number | null) => {
    if (termScore === null) {
      return 0;
    }
    if (allowWholeFieldBackstop) {
      return Math.max(coverageScore ?? 0, termScore);
    }
    return coverageScore ?? 0;
  };
  const artistScore = artistTermScore === null
    ? 0
    : Math.min(
        1,
        applyFieldScore(artistCoverageScore, artistTermScore) +
          (parsed.mode === "similarity" ? 0.05 * phraseBoost : 0),
      );
  const titleScore = titleTermScore === null
    ? 0
    : Math.min(
        1,
        applyFieldScore(titleCoverageScore, titleTermScore) +
          (parsed.mode === "lookup" ? 0.15 * phraseBoost : 0),
      );
  const singerScore = singerTermScore === null
    ? 0
    : Math.min(
        1,
        Math.max(
          applyFieldScore(singerCoverageScore, singerTermScore),
          parsed.hasQuotedPhrase && parsed.phraseTokens.length > 0
            ? Math.max(...parsed.phraseTokens.map((phrase) => scorePhraseInQuery(phrase, singerField)))
            : 0,
        ),
      );
  if (textTerms.length > 0) {
    components.push({ score: artistScore, weight: weights.artist });
    components.push({ score: singerScore, weight: weights.singer });
    components.push({ score: titleScore, weight: weights.title });
  }
  const yearScore = scoreYearIntent(parsed.yearTokens, track.year ?? "");
  if (yearScore !== null) {
    components.push({ score: yearScore, weight: weights.year });
  }
  const tempoScore = scoreTempoIntent(parsed.tempoTokens, track.bpm);
  if (tempoScore !== null) {
    components.push({ score: tempoScore, weight: weights.tempo });
  }
  const notesField = track.notes || "";
  const supportingField = [track.album || "", searchTrack.album_artist || "", track.genre || ""]
    .filter(Boolean)
    .join(" ");
  const notesScoreBase = scoreTermsAgainstField(textTerms, notesField);
  const supportingScoreBase = scoreTermsAgainstField(textTerms, supportingField);
  const combinedTextField = [titleField, expandedArtistField, notesField, supportingField].filter(Boolean).join(" ");
  const combinedTextMetrics = buildTokenMatchMetrics(queryCoverageTokens, combinedTextField);
  const notesCoverageScore = scoreQueryTokensAgainstField(queryCoverageTokens, notesField);
  const supportingCoverageScore = scoreQueryTokensAgainstField(
    queryCoverageTokens,
    supportingField,
  );
  const notesPhraseBoost = parsed.hasQuotedPhrase && parsed.phraseTokens.length > 0
    ? Math.max(...parsed.phraseTokens.map((phrase) => scorePhraseInQuery(phrase, track.notes || "")))
    : 0;
  const notesScore = notesScoreBase === null
    ? null
    : Math.min(
        1,
        applyFieldScore(notesCoverageScore, notesScoreBase) +
          (parsed.mode === "lookup" ? 0.2 * notesPhraseBoost : 0),
      );
  if (notesScore !== null && weights.notes > 0) {
    components.push({ score: notesScore, weight: weights.notes });
  }
  const supportingScore = supportingScoreBase === null
    ? null
    : applyFieldScore(supportingCoverageScore, supportingScoreBase);
  if (supportingScore !== null && weights.supporting > 0) {
    components.push({ score: supportingScore, weight: weights.supporting });
  }
  if (
    textTerms.length > 0 &&
    queryCoverageTokens.length <= 1 &&
    artistScore <= 0 &&
    titleScore <= 0 &&
    (notesScore ?? 0) > 0
  ) {
    components.length = 0;
    components.push({ score: notesScore ?? 0, weight: 1 });
  }
  if (components.length === 0) {
    const fields = [
      track.title,
      track.artist_summary,
      track.artist,
      track.singer,
      track.album,
      searchTrack.album_artist,
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
      yearScore,
      tempoScore,
      notesScore,
      textMatchedTerms: combinedTextMetrics?.matchedCount ?? 0,
      textUnmatchedFieldTokens: combinedTextMetrics?.unmatchedFieldTokens ?? 0,
    };
  }
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weighted = totalWeight <= 0
    ? 0
    : components.reduce((sum, component) => sum + component.score * component.weight, 0) /
      totalWeight;
  const titleCoverageBoost = parsed.mode === "similarity" &&
      parsed.textTokens.length >= 2 &&
      (parsed.yearTokens.length > 0 || parsed.tempoTokens.length > 0) &&
      (titleCoverageMetrics?.queryCoverage ?? 0) >= 0.999
    ? Math.max(titleScore, tempoScore ?? 0, yearScore ?? 0)
    : 0;
  const lookupTokenCoverage =
    parsed.mode === "lookup" && queryCoverageTokens.length > 0
      ? combinedTextMetrics?.queryCoverage ?? 0
      : 1;
  const lookupCrossFieldCoverageBoost =
    parsed.mode === "lookup" &&
    queryCoverageTokens.length >= 2 &&
    [artistScore, singerScore, titleScore, notesScore ?? 0]
      .filter((score) => score > 0).length >= 2 &&
    (combinedTextMetrics?.queryCoverage ?? 0) >= 0.999
      ? 0.3 * (combinedTextMetrics?.averageSimilarity ?? 0)
      : 0;
  const rawScore = Math.max(weighted, titleCoverageBoost);
  return {
    score: Math.min(
      1,
      Math.max(0, rawScore * lookupTokenCoverage, lookupCrossFieldCoverageBoost),
    ),
    mode: parsed.mode,
    artistScore,
    titleScore,
    yearScore,
    tempoScore,
    notesScore,
    textMatchedTerms: combinedTextMetrics?.matchedCount ?? 0,
    textUnmatchedFieldTokens: combinedTextMetrics?.unmatchedFieldTokens ?? 0,
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
      if (b.breakdown.textMatchedTerms !== a.breakdown.textMatchedTerms) {
        return b.breakdown.textMatchedTerms - a.breakdown.textMatchedTerms;
      }
      if (b.breakdown.score !== a.breakdown.score) {
        return b.breakdown.score - a.breakdown.score;
      }
      if (a.breakdown.textUnmatchedFieldTokens !== b.breakdown.textUnmatchedFieldTokens) {
        return a.breakdown.textUnmatchedFieldTokens - b.breakdown.textUnmatchedFieldTokens;
      }
      if (b.breakdown.artistScore !== a.breakdown.artistScore) {
        return b.breakdown.artistScore - a.breakdown.artistScore;
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

export const normalizeSearchQuery = (query: string) => {
  const scoped = parseScopedSearchQuery(query);
  return normalizeSearchText(scoped.query);
};
