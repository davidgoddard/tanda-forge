export const tandaCompletionCombinationKey = (trackIds: string[]) =>
  [...new Set(trackIds)].sort((left, right) => left.localeCompare(right)).join("\u001f");

export const getTandaCompletionAnchors = (params: {
  trackSlots: (string | null)[];
  manualTrackIds?: string[];
  generatedTrackIds?: string[];
  preferredSize: number;
}) => {
  const tracks = params.trackSlots.filter((id): id is string => Boolean(id));
  const suggestions = new Set(params.generatedTrackIds);
  const manual = new Set(params.manualTrackIds);
  if (tracks.some((id) => manual.has(id)) && tracks.some((id) => suggestions.has(id))) {
    return tracks.filter((id) => manual.has(id) || !suggestions.has(id));
  }
  return tracks.length < Math.max(1, params.preferredSize) ? tracks : [];
};
