const playbackTranscodeExtensions = new Set([".aif", ".aiff"]);

const getLowercaseExtension = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return fileName.slice(lastDot).toLowerCase();
};

export const requiresPlaybackTranscode = (filePath: string) =>
  playbackTranscodeExtensions.has(getLowercaseExtension(filePath));
