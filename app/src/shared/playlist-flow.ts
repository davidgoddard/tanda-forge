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
