export type ComparableTanda = {
  name: string;
  styles: string[];
  rating: number;
  trackSlots: (string | null)[];
};

const normalizedStyles = (styles: string[]) =>
  styles.map((style) => style.trim().toLocaleLowerCase()).sort();

const populatedTrackSlots = (trackSlots: (string | null)[]) =>
  trackSlots.filter((trackId): trackId is string => Boolean(trackId));

export const tandaContentsMatch = (left: ComparableTanda, right: ComparableTanda) =>
  left.name === right.name &&
  left.rating === right.rating &&
  JSON.stringify(normalizedStyles(left.styles)) ===
    JSON.stringify(normalizedStyles(right.styles)) &&
  JSON.stringify(populatedTrackSlots(left.trackSlots)) ===
    JSON.stringify(populatedTrackSlots(right.trackSlots));
