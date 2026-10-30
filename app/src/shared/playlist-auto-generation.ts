export type TandaGenerationTrackTraits = {
  artist: string;
  singer: string;
  instrumental: boolean | null;
  year: number | null;
  bpm: number | null;
};

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
