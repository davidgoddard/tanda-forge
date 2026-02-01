export type PlaylistTimingInput = {
  tandaDurationsMs: number[];
  gapBeforeTandaMs: number;
  gapBeforeCortinaMs: number;
  cortinaDurationMs: number;
  cortinaFadeMs: number;
  cortinaEnabled: boolean;
};

export const computeTandaStartOffsetsMs = ({
  tandaDurationsMs,
  gapBeforeTandaMs,
  gapBeforeCortinaMs,
  cortinaDurationMs,
  cortinaFadeMs,
  cortinaEnabled,
}: PlaylistTimingInput) => {
  const offsets: number[] = [];
  let offsetMs = 0;
  tandaDurationsMs.forEach((duration, index) => {
    if (index === 0) {
      if (cortinaEnabled) {
        offsetMs += gapBeforeCortinaMs + cortinaDurationMs + cortinaFadeMs;
        offsetMs += gapBeforeTandaMs;
      }
    } else if (cortinaEnabled) {
      offsetMs += gapBeforeCortinaMs + cortinaDurationMs + cortinaFadeMs;
      offsetMs += gapBeforeTandaMs;
    } else {
      offsetMs += gapBeforeTandaMs;
    }
    offsets.push(offsetMs);
    offsetMs += duration;
  });
  return offsets;
};
