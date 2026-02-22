export const shouldContinueAfterEndCortina = (
  currentIndex: number,
  playlistLength: number,
) => playlistLength > currentIndex;

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
  startFromIdle: boolean,
  currentIndex: number,
  currentTrackIndex: number,
  selectedStartIndex: number | null,
) =>
  suppressLeadInCortinaForSelectedStart &&
  isResume &&
  startFromIdle &&
  currentTrackIndex === 0 &&
  selectedStartIndex !== null &&
  currentIndex === selectedStartIndex;

export const shouldTreatClickStartAsIdle = (
  playbackStatus: "idle" | "paused" | "playing",
  isMainChannelActivelyPlaying: boolean,
) =>
  playbackStatus === "idle" ||
  (!isMainChannelActivelyPlaying && playbackStatus !== "playing");

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
