export const resolveCompressionSliderUiState = (params: {
  enabled: boolean;
  storedDepthPercent: number;
  isMainActive: boolean;
  hasMainTrack: boolean;
  compressedReady: boolean;
  prepLock: boolean;
}) => {
  const waitingForCompressedCompanion =
    params.enabled &&
    params.storedDepthPercent > 0 &&
    params.isMainActive &&
    params.hasMainTrack &&
    !params.compressedReady;
  const displayedDepthPercent = waitingForCompressedCompanion
    ? 0
    : params.storedDepthPercent;
  return {
    displayedDepthPercent,
    disabled: params.prepLock || waitingForCompressedCompanion,
  };
};
