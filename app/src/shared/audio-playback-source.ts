const playbackCompatibilityCheckExtensions = new Set([".aif", ".aiff", ".m4a"]);

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
  playbackCompatibilityCheckExtensions.has(getLowercaseExtension(filePath));

export const shouldWarmPlaybackTranscode = (filePath: string) => {
  const extension = getLowercaseExtension(filePath);
  return extension === ".aif" || extension === ".aiff";
};

export const requiresCodecAwarePlaybackTranscode = (
  filePath: string,
  codecName: string | null,
) => {
  const extension = getLowercaseExtension(filePath);
  if (extension === ".aif" || extension === ".aiff") {
    return true;
  }
  if (extension === ".m4a") {
    // An unavailable probe must fail safe: FFmpeg can still create the compatible
    // WAV, whereas passing an unsupported ALAC stream to Chromium cannot play.
    return codecName === null || codecName.trim().toLowerCase() === "alac";
  }
  return false;
};
