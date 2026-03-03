type TrackEditorPathLinesParams = {
  originalPath: string;
  compressionEnabled: boolean;
  compressedPath: string | null;
  compressedLabel: string;
  pendingLabel: string;
};

export const resolveTrackEditorPathLines = (
  params: TrackEditorPathLinesParams,
) => {
  const originalLine = params.originalPath.trim();
  if (!params.compressionEnabled) {
    return { originalLine, compressedLine: "" };
  }
  const value = params.compressedPath?.trim() || params.pendingLabel;
  return {
    originalLine,
    compressedLine: `${params.compressedLabel} ${value}`,
  };
};
