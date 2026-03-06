export const normalizeLegacyPath = (input: string) =>
  input.replace(/\\/g, "/").replace(/^\/+/, "");

export const mapLegacyPathToRelative = (legacyPath: string, rootPath: string) => {
  const normalized = normalizeLegacyPath(legacyPath);
  const rootNormalized = normalizeLegacyPath(rootPath);
  const rootBase = rootNormalized.split("/").filter(Boolean).pop() ?? "";
  const baseLower = rootBase.toLowerCase();
  const lower = normalized.toLowerCase();

  if (baseLower && lower.startsWith(`${baseLower}/`)) {
    return normalized.slice(rootBase.length + 1);
  }
  if (baseLower === "music" && lower.startsWith("music/")) {
    return normalized.slice("music/".length);
  }
  if ((baseLower === "cortinas" || baseLower === "cortina") && lower.startsWith("cortinas/")) {
    return normalized.slice("cortinas/".length);
  }
  if (baseLower === "cortinas" && lower.startsWith("cortina/")) {
    return normalized.slice("cortina/".length);
  }
  return normalized;
};
