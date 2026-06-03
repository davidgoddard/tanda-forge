import path from "path";

const playbackTranscodeExtensions = new Set([".aif", ".aiff"]);

export const requiresPlaybackTranscode = (filePath: string) =>
  playbackTranscodeExtensions.has(path.extname(filePath).toLowerCase());
