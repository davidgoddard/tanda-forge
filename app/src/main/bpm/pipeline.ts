export type AudioAnalysisResult = {
  bpm?: number | null;
  warnings?: string[];
  style?: string | null;
  styleError?: string | null;
  error?: string;
};
/** A single bounded PCM buffer feeds both engines; style always uses acoustic tempo. */
export const analyzeAudio = async (
  decode: () => Promise<Float32Array>,
  tempo: (pcm: Float32Array) => { bpm: number | null; warnings: string[] },
  style?: (pcm: Float32Array, bpm: number | null) => { style: string },
): Promise<AudioAnalysisResult> => {
  try {
    const pcm = await decode();
    const result: AudioAnalysisResult = tempo(pcm);
    if (style) {
      try { result.style = style(pcm,result.bpm ?? null).style; }
      catch(error) {
        result.style = null;
        result.styleError = error instanceof Error ? error.message : String(error);
      }
    }
    return result;
  } catch(error) { return {error:error instanceof Error ? error.message : String(error)}; }
};
