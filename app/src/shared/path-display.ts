export const basenameForDisplay = (filePath: string): string => {
  const normalized = filePath.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!normalized) {
    return "";
  }
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
};
