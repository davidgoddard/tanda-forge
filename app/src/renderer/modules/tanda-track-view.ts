export const buildTandaTrackLabel = (
  trackLabel: string,
  bpm: number | null | undefined,
) => {
  const bpmLabel =
    typeof bpm === "number" && Number.isFinite(bpm) && bpm > 0
      ? `${Math.round(bpm)} bpm`
      : "";
  return bpmLabel ? `${trackLabel} · ${bpmLabel}` : trackLabel;
};
