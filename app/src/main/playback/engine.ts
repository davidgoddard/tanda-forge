export type PlaybackState = "idle" | "playing" | "paused" | "stopping";

export const createPlaybackEngine = () => {
  let state: PlaybackState = "idle";

  return {
    getState: () => state,
    setState: (next: PlaybackState) => {
      state = next;
    },
  };
};
