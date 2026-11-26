export type PlaylistTimingInput = {
  tandaDurationsMs: number[];
  gapBeforeTandaMs: number;
  gapBeforeCortinaMs: number;
  cortinaDurationMs: number;
  cortinaFadeMs: number;
  cortinaEnabled: boolean;
  cortinaCounts?: number[];
};

export const computeTandaStartOffsetsMs = ({
  tandaDurationsMs,
  gapBeforeTandaMs,
  gapBeforeCortinaMs,
  cortinaDurationMs,
  cortinaFadeMs,
  cortinaEnabled,
  cortinaCounts,
}: PlaylistTimingInput) => {
  const offsets: number[] = [];
  let offsetMs = 0;
  tandaDurationsMs.forEach((duration, index) => {
    const count = cortinaEnabled ? Math.max(0, cortinaCounts?.[index] ?? 1) : 0;
    if (count > 0) {
      offsetMs += gapBeforeCortinaMs + count * (cortinaDurationMs + cortinaFadeMs);
      offsetMs += gapBeforeTandaMs;
    } else if (index > 0) {
      offsetMs += gapBeforeTandaMs;
    }
    offsets.push(offsetMs);
    offsetMs += duration;
  });
  return offsets;
};
