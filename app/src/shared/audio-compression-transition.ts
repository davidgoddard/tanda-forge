export type CompressionRenderState =
  | "idle"
  | "rendering"
  | "ready"
  | "failed";

export type CompressionPlaybackState = {
  trackId: string | null;
  depthPercent: number;
  renderState: CompressionRenderState;
  compressedPath: string | null;
  outputPath: string | null;
};

export type CompressionPlaybackEvent =
  | { type: "track_started"; trackId: string; outputPath: string; depthPercent: number }
  | { type: "depth_changed"; depthPercent: number }
  | { type: "render_started" }
  | { type: "render_succeeded"; compressedPath: string }
  | { type: "render_failed" }
  | { type: "stopped" };

export const initialCompressionPlaybackState = (): CompressionPlaybackState => ({
  trackId: null,
  depthPercent: 0,
  renderState: "idle",
  compressedPath: null,
  outputPath: null,
});

export const reduceCompressionPlaybackState = (
  state: CompressionPlaybackState,
  event: CompressionPlaybackEvent,
): CompressionPlaybackState => {
  switch (event.type) {
    case "track_started":
      return {
        trackId: event.trackId,
        depthPercent: event.depthPercent,
        renderState: event.depthPercent > 0 ? "rendering" : "idle",
        compressedPath: null,
        outputPath: event.outputPath,
      };
    case "depth_changed": {
      const nextDepth = Math.max(0, Math.min(100, event.depthPercent));
      if (nextDepth <= 0 && state.renderState !== "ready") {
        return { ...state, depthPercent: nextDepth, renderState: "idle" };
      }
      if (nextDepth > 0 && state.renderState === "idle") {
        return { ...state, depthPercent: nextDepth, renderState: "rendering" };
      }
      return { ...state, depthPercent: nextDepth };
    }
    case "render_started":
      return { ...state, renderState: "rendering" };
    case "render_succeeded":
      return {
        ...state,
        renderState: "ready",
        compressedPath: event.compressedPath,
      };
    case "render_failed":
      return { ...state, renderState: "failed", compressedPath: null };
    case "stopped":
      return initialCompressionPlaybackState();
    default: {
      const unknownEvent: never = event;
      return unknownEvent;
    }
  }
};

export const resolveCompressionMixState = (state: CompressionPlaybackState) => {
  const ready = state.renderState === "ready" && Boolean(state.compressedPath);
  const depth = Math.max(0, Math.min(100, state.depthPercent));
  return {
    sliderEnabled: ready,
    displayedDepthPercent: ready ? depth : 0,
    useCompressedPlayback: ready && depth > 0,
  };
};
