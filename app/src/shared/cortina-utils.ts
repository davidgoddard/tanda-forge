export const DEFAULT_CORTINA_SET_ID = "__default__";

export const getCortinaSetName = (
  relativePath: string,
  rootLabel?: string | null,
  rootPath?: string | null,
) => {
  const normalized = (relativePath || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length > 1) {
    return parts[0];
  }
  if (parts.length === 1) {
    return DEFAULT_CORTINA_SET_ID;
  }
  if (rootLabel && rootLabel.trim().length > 0) {
    return rootLabel.trim();
  }
  if (rootPath && rootPath.trim().length > 0) {
    const trimmed = rootPath.trim();
    const segments = trimmed.split(/[/\\]/).filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : DEFAULT_CORTINA_SET_ID;
  }
  return DEFAULT_CORTINA_SET_ID;
};
