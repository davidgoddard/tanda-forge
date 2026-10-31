export const tandaCompletionCombinationKey = (trackIds: string[]) =>
  [...new Set(trackIds)].sort((left, right) => left.localeCompare(right)).join("\u001f");

export const isUserStartedIncompleteTanda = (params: {
  trackSlots: (string | null)[];
  manualTrackIds?: string[];
  preferredSize: number;
}) => {
  const populated = params.trackSlots.filter(Boolean).length;
  return (params.manualTrackIds?.length ?? 0) > 0
    && populated > 0
    && populated < Math.max(1, params.preferredSize);
};
