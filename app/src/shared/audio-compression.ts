export const shouldUseCompressionSource = (params: {
  channel: "main" | "headphone";
  isCortinaPlayback: boolean;
  enabled: boolean;
  depthPercent: number;
}) => {
  if (params.channel !== "main") {
    return false;
  }
  if (!params.enabled) {
    return false;
  }
  return params.depthPercent > 0;
};

export const isCompressionControlLockedForPrep = (params: {
  appMode: "prep" | "live" | "edit";
  isMainPlaying: boolean;
  usingCompressedSource: boolean;
}) => false;

export type CompressionProofState =
  | "disabled"
  | "zero_mix"
  | "headphone_bypass"
  | "rendered"
  | "fallback_original";

export const resolveCompressionProofState = (params: {
  enabled: boolean;
  depthPercent: number;
  channel: "main" | "headphone" | null;
  isCortinaPlayback: boolean;
  usingCompressedSource: boolean;
}): CompressionProofState => {
  if (!params.enabled) {
    return "disabled";
  }
  if (params.depthPercent <= 0) {
    return "zero_mix";
  }
  if (params.channel === "headphone") {
    return "headphone_bypass";
  }
  if (params.usingCompressedSource) {
    return "rendered";
  }
  return "fallback_original";
};
