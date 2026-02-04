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
