export type RatingFilter = {
  mode: "any" | "unrated" | "atLeast" | "exactly" | "atMost";
  stars: number;
};

export type RatingSnapshot = {
  tracks: { id: string; rating: number }[];
  tandas: { id: string; rating: number }[];
};

export const normalizeRatingFilter = (input?: RatingFilter | null): RatingFilter => {
  const mode = input?.mode;
  if (!mode || !["any", "unrated", "atLeast", "exactly", "atMost"].includes(mode)) {
    return { mode: "any", stars: 1 };
  }
  const stars = Number.isFinite(input?.stars)
    ? Math.max(1, Math.min(5, Math.floor(input!.stars)))
    : 1;
  return { mode, stars };
};

export const matchesRating = (rating: number | null | undefined, input?: RatingFilter) => {
  const { mode, stars } = normalizeRatingFilter(input);
  const value = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating!)) : 0;
  if (mode === "any") return true;
  if (mode === "unrated") return value === 0;
  if (value < 1) return false;
  if (mode === "atLeast") return value >= stars;
  if (mode === "atMost") return value <= stars;
  return value === stars;
};
