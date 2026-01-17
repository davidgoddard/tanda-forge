export type TrackAnalysis = {
  durationMs: number;
  loudnessDb: number;
  startOffsetMs: number;
  endTrimMs: number;
};

export const analyzeTrack = async (_filePath: string): Promise<TrackAnalysis> => {
  // Placeholder for ffmpeg/ffprobe invocation.
  return {
    durationMs: 0,
    loudnessDb: 0,
    startOffsetMs: 0,
    endTrimMs: 0,
  };
};
