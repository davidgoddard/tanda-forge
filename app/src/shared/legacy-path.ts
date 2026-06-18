export const normalizeLegacyPath = (input: string) =>
  input.replace(/\\/g, "/").replace(/^\/+/, "");

export const normalizeLegacyRelativeForMatch = (input: string) =>
  normalizeLegacyPath(input)
    .normalize("NFKC")
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "")
    .toLowerCase();

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

export const resolveLegacyPathMatch = (
  legacyPath: string,
  rootPath: string,
  actualRelativePaths: readonly string[],
) => {
  const candidateRelativePath = mapLegacyPathToRelative(legacyPath, rootPath);
  const normalizedCandidate = normalizeLegacyRelativeForMatch(candidateRelativePath);
  if (!normalizedCandidate) {
    return null;
  }
  const directMatches = actualRelativePaths.filter(
    (relativePath) =>
      normalizeLegacyRelativeForMatch(relativePath) === normalizedCandidate,
  );
  if (directMatches.length === 1) {
    return directMatches[0];
  }
  if (directMatches.length > 1) {
    return null;
  }
  const suffixMatches = actualRelativePaths.filter((relativePath) => {
    const normalizedRelativePath = normalizeLegacyRelativeForMatch(relativePath);
    return (
      normalizedRelativePath.endsWith(`/${normalizedCandidate}`) ||
      normalizedCandidate.endsWith(`/${normalizedRelativePath}`)
    );
  });
  return suffixMatches.length === 1 ? suffixMatches[0] : null;
};
