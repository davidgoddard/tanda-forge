export const shouldContinueAfterEndCortina = (
  currentIndex: number,
  playlistLength: number,
  hasPlayableByIndex?: boolean[],
) => {
  if (!(playlistLength > currentIndex)) {
    return false;
  }
  if (!hasPlayableByIndex) {
    return true;
  }
  return hasPlayableByIndex
    .slice(Math.max(0, currentIndex))
    .some((isPlayable) => isPlayable);
};

export const shouldInsertCortinaBeforeTanda = (
  cortinasEnabled: boolean,
  currentIndex: number,
  currentTrackIndex: number,
  isResumeWithOffset: boolean,
  continuedFromEndCortina: boolean,
) =>
  cortinasEnabled &&
  currentTrackIndex === 0 &&
  currentIndex > 0 &&
  !isResumeWithOffset &&
  !continuedFromEndCortina;

export const shouldSkipLeadInCortinaForSelectedStart = (
  suppressLeadInCortinaForSelectedStart: boolean,
  isResume: boolean,
  currentIndex: number,
  currentTrackIndex: number,
  selectedStartIndex: number | null,
) =>
  suppressLeadInCortinaForSelectedStart &&
  isResume &&
  currentTrackIndex === 0 &&
  selectedStartIndex !== null &&
  currentIndex === selectedStartIndex;

export const shouldTreatClickStartAsIdle = (
  playbackStatus: "idle" | "paused" | "playing",
  isMainChannelActivelyPlaying: boolean,
) =>
  playbackStatus === "idle" ||
  (!isMainChannelActivelyPlaying && playbackStatus !== "playing");

export const shouldStartPlaylistFromClick = (
  appMode: "prep" | "live" | "edit",
  isMainChannelActivelyPlaying: boolean,
) => {
  if (appMode === "prep") {
    return true;
  }
  if (appMode === "live") {
    return !isMainChannelActivelyPlaying;
  }
  return false;
};

export const shouldPlayStandaloneTrackFromClick = (
  appMode: "prep" | "live" | "edit",
  isMainChannelActivelyPlaying: boolean,
) => appMode === "live" && !isMainChannelActivelyPlaying;

export const shouldEnablePlaylistStop = (
  playbackStatus: "idle" | "paused" | "playing",
  isMainChannelActivelyPlaying: boolean,
) => playbackStatus === "playing" || isMainChannelActivelyPlaying;

export const shouldEnablePlaylistStart = (
  playbackStatus: "idle" | "paused" | "playing",
  isMainChannelActivelyPlaying: boolean,
  hasItems: boolean,
  hasResume: boolean,
) => {
  if (playbackStatus === "playing" || isMainChannelActivelyPlaying) {
    return false;
  }
  if (playbackStatus === "paused") {
    return hasResume;
  }
  return hasItems;
};

export const shouldPreservePausedPerformanceResumeOnStop = (
  playbackStatus: "idle" | "paused" | "playing",
  hasResume: boolean,
  pausedForPerformanceStop: boolean,
  isMainChannelActivelyPlaying: boolean,
) =>
  playbackStatus === "paused" &&
  hasResume &&
  pausedForPerformanceStop &&
  isMainChannelActivelyPlaying;

export const shouldUseOverlapForGapMs = (gapMs: number) => gapMs < 0;

export const resolveOverlapFadeMs = (gapMs: number) =>
  shouldUseOverlapForGapMs(gapMs) ? Math.abs(gapMs) : 0;

export const resolveScheduledTransitionTimeSeconds = (
  playbackEndSeconds: number | null,
  playbackStartSeconds: number,
  gapMs: number,
) => {
  if (!playbackEndSeconds || gapMs >= 0) {
    return null;
  }
  return Math.max(playbackStartSeconds, playbackEndSeconds + gapMs / 1000);
};

export const shouldStopAfterMarkedLastTanda = (
  itemKind: "track" | "tanda",
  markedLast: boolean,
) => itemKind === "tanda" && markedLast;

export const shouldPauseAfterMarkedPerformanceStop = (
  itemKind: "track" | "tanda",
  markedForPerformanceStop: boolean,
) => itemKind === "tanda" && markedForPerformanceStop;

export const resolveContinuationIndexAfterEndCortina = (
  currentIndex: number,
  playedThroughIndex: number,
  hasPlayableByIndex: boolean[],
) => {
  const start = Math.max(0, playedThroughIndex + 1);
  for (let index = start; index < hasPlayableByIndex.length; index += 1) {
    if (hasPlayableByIndex[index]) {
      return index;
    }
  }
  return currentIndex;
};

export type PlaylistTrackSource =
  | { kind: "track"; trackId: string }
  | { kind: "tanda"; trackIds: string[] };

export const findPlaylistPositionForTrack = (
  items: PlaylistTrackSource[],
  wantedTrackId: string,
) => {
  if (!wantedTrackId) {
    return null;
  }
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    if (item.kind === "track") {
      if (item.trackId === wantedTrackId) {
        return { itemIndex, trackIndex: 0 };
      }
      continue;
    }
    const trackIndex = item.trackIds.indexOf(wantedTrackId);
    if (trackIndex >= 0) {
      return { itemIndex, trackIndex };
    }
  }
  return null;
};
