import { computeTandaStartOffsetsMs } from "./playlist-timing.js";

export type TimelineEntry = {
  index: number;
  durationMs: number;
  trackDurationsMs: number[];
};

type TimelineConfig = {
  gapBeforeTandaMs: number;
  gapBeforeCortinaMs: number;
  cortinaDurationMs: number;
  cortinaFadeMs: number;
  cortinaEnabled: boolean;
};

export const computeTimelineOffsetsMs = (
  entries: TimelineEntry[],
  config: TimelineConfig,
) =>
  computeTandaStartOffsetsMs({
    tandaDurationsMs: entries.map((entry) => entry.durationMs),
    gapBeforeTandaMs: config.gapBeforeTandaMs,
    gapBeforeCortinaMs: config.gapBeforeCortinaMs,
    cortinaDurationMs: config.cortinaDurationMs,
    cortinaFadeMs: config.cortinaFadeMs,
    cortinaEnabled: config.cortinaEnabled,
  });

export const computeElapsedMsForEntry = (params: {
  offsetMs: number;
  trackDurationsMs: number[];
  trackIndex: number;
  gapBetweenTracksMs: number;
  progressMs: number;
}) => {
  const trackIndex = Math.max(
    0,
    Math.min(params.trackIndex, params.trackDurationsMs.length - 1),
  );
  const priorDurations = params.trackDurationsMs
    .slice(0, trackIndex)
    .reduce((total, value) => total + value, 0);
  const gaps = trackIndex * params.gapBetweenTracksMs;
  const progress = Math.max(0, params.progressMs);
  return params.offsetMs + priorDurations + gaps + progress;
};

export const computeCortinaStartOffsetMs = (
  offsetMs: number,
  gapBeforeTandaMs: number,
  gapBeforeCortinaMs: number,
  cortinaDurationMs: number,
  cortinaFadeMs: number,
) =>
  offsetMs -
  (gapBeforeTandaMs + gapBeforeCortinaMs + cortinaDurationMs + cortinaFadeMs);

export const computeTimelineTotalMs = (
  offsets: number[],
  entries: TimelineEntry[],
) => {
  if (offsets.length === 0 || entries.length === 0) {
    return 0;
  }
  const lastIndex = Math.min(offsets.length, entries.length) - 1;
  return offsets[lastIndex] + entries[lastIndex].durationMs;
};

export const getMinutesOfDayFromMs = (ms: number) => {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
};

export const shouldShowDisplayNextTanda = (
  playlistStatus: "idle" | "playing" | "paused",
) => playlistStatus === "playing";

type PlaylistLockContext = {
  liveMode: boolean;
  playbackStatus: "idle" | "playing" | "paused";
  playedThroughIndex: number;
  currentIndex: number;
};

export const isPlaylistIndexLockedDuringLive = (
  context: PlaylistLockContext,
  index: number,
) => {
  if (!context.liveMode || context.playbackStatus !== "playing") {
    return false;
  }
  if (index <= context.playedThroughIndex) {
    return true;
  }
  return index === context.currentIndex;
};

export const isPlaylistTandaSlotLockedDuringLive = (
  context: PlaylistLockContext & { currentTrackIndex: number },
  playlistIndex: number,
  slotIndex: number,
) => {
  if (!context.liveMode || context.playbackStatus !== "playing") {
    return false;
  }
  if (playlistIndex <= context.playedThroughIndex) {
    return true;
  }
  if (playlistIndex < context.currentIndex) {
    return true;
  }
  if (playlistIndex > context.currentIndex) {
    return false;
  }
  const currentTrackIndex = Math.max(-1, context.currentTrackIndex);
  return slotIndex <= currentTrackIndex;
};
