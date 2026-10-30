export type TandaGenerationTrackTraits = {
  artist: string;
  singer: string;
  instrumental: boolean | null;
  year: number | null;
  bpm: number | null;
};

export type TandaGenerationPhase =
  | "strict"
  | "same-artist-relaxed"
  | "mixed-cohesive"
  | "style-only";

export const TANDA_GENERATION_PHASES: TandaGenerationPhase[] = [
  "strict",
  "same-artist-relaxed",
  "mixed-cohesive",
  "style-only",
];

export const getTandaGenerationPhaseRules = (phase: TandaGenerationPhase) => ({
  requireSameArtist: phase === "strict" || phase === "same-artist-relaxed",
  matchYearAndBpm: phase === "strict" || phase === "mixed-cohesive",
  matchVocalCharacter: phase === "strict" || phase === "mixed-cohesive",
});

const normalized = (value: string) => value.trim().toLocaleLowerCase();

export const scoreTandaTrackCohesion = (
  seed: TandaGenerationTrackTraits,
  candidate: TandaGenerationTrackTraits,
  candidateArtistUsage = 0,
) => {
  let score = Math.max(0, candidateArtistUsage) * 5;
  if (normalized(seed.artist) !== normalized(candidate.artist)) score += 100;
  if (seed.instrumental === null || candidate.instrumental === null) {
    score += 5;
  } else if (seed.instrumental !== candidate.instrumental) {
    score += 40;
  }
  const seedSinger = normalized(seed.singer);
  const candidateSinger = normalized(candidate.singer);
  if (seedSinger && candidateSinger) {
    if (seedSinger !== candidateSinger) score += 20;
  } else if (seedSinger || candidateSinger) {
    score += 2;
  }
  score += seed.year !== null && candidate.year !== null
    ? Math.min(20, Math.abs(seed.year - candidate.year) / 2)
    : 3;
  score += seed.bpm !== null && candidate.bpm !== null
    ? Math.min(20, Math.abs(seed.bpm - candidate.bpm) / 2)
    : 3;
  return score;
};

const orderedTrackIds = (trackIds: (string | null)[]) =>
  trackIds.filter((trackId): trackId is string => Boolean(trackId));

export const findExactOrderedTandaMatch = <T>(
  generatedTrackIds: (string | null)[],
  savedTandas: T[],
  getTrackIds: (tanda: T) => (string | null)[],
) => {
  const generated = orderedTrackIds(generatedTrackIds);
  return savedTandas.find((tanda) => {
    const saved = orderedTrackIds(getTrackIds(tanda));
    return saved.length === generated.length
      && saved.every((trackId, index) => trackId === generated[index]);
  }) ?? null;
};

export const groupGenerationSeedsByArtist = <T>(params: {
  items: T[];
  getArtistKey: (item: T) => string;
  getTitleKey: (item: T) => string;
  getArtistUsage: (artistKey: string) => number;
  targetCount: number;
  requireViableSingleArtist: boolean;
  getTieBreaker?: () => number;
}) => {
  const groups = new Map<string, T[]>();
  params.items.forEach((item) => {
    const artist = params.getArtistKey(item);
    const key = artist || `\u0000${groups.size}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  const tieBreaker = params.getTieBreaker ?? Math.random;
  return Array.from(groups.entries())
    .filter(([artist, items]) => {
      if (!params.requireViableSingleArtist) return true;
      if (!artist || artist.startsWith("\u0000")) return false;
      return new Set(items.map(params.getTitleKey)).size >= params.targetCount;
    })
    .map(([artist, items]) => ({
      artist,
      items: items
        .map((item) => ({ item, tie: tieBreaker() }))
        .sort((left, right) => left.tie - right.tie)
        .map(({ item }) => item),
      usage: params.getArtistUsage(artist),
      tie: tieBreaker(),
    }))
    .sort((left, right) => left.usage - right.usage || left.tie - right.tie)
    .map(({ items }) => items);
};

export const filterForArtistDiversity = <T>(params: {
  items: T[];
  getArtistKeys: (item: T) => string[];
  getArtistUsage: (artistKey: string) => number;
}) => {
  if (params.items.length === 0) return [];
  const ranked = params.items.map((item) => {
    const artists = Array.from(new Set(params.getArtistKeys(item).filter(Boolean)));
    return {
      item,
      repeatedArtists: artists.length === 0
        ? Number.POSITIVE_INFINITY
        : artists.filter((artist) => params.getArtistUsage(artist) > 0).length,
      artistCount: artists.length || Number.POSITIVE_INFINITY,
    };
  });
  const fewestRepeated = Math.min(...ranked.map((entry) => entry.repeatedArtists));
  const repeatFiltered = ranked.filter(
    (entry) => entry.repeatedArtists === fewestRepeated,
  );
  const fewestArtists = Math.min(...repeatFiltered.map((entry) => entry.artistCount));
  return repeatFiltered
    .filter((entry) => entry.artistCount === fewestArtists)
    .map((entry) => entry.item);
};
