export type AutoCenterState = {
  lastInteractionAt: number;
  now: number;
  idleMs: number;
  playbackStatus: "idle" | "playing" | "paused";
  activeTab: "playlist-tab" | "tanda-designer-tab";
};

export const shouldAutoCenterPlaylist = (state: AutoCenterState) => {
  if (state.playbackStatus !== "playing") {
    return false;
  }
  if (state.activeTab !== "playlist-tab") {
    return false;
  }
  if (state.idleMs <= 0) {
    return false;
  }
  return state.now - state.lastInteractionAt >= state.idleMs;
};
