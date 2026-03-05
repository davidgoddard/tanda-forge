import { normalizeStyleName } from "./tanda-utils";

export type ParsedStyleDefinition = {
  canonical: string;
  aliases: string[];
};

export const mergeStyleAliases = (
  existingAliases: string[],
  incomingAliases: string[],
) => {
  const merged: string[] = [];
  const seen = new Set<string>();
  [...existingAliases, ...incomingAliases].forEach((alias) => {
    const normalized = normalizeStyleName(alias);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(normalized);
  });
  return merged;
};

export const parseStyleDefinition = (input: string): ParsedStyleDefinition => {
  const tokens = input
    .split(/[;/]+/)
    .map((token) => normalizeStyleName(token))
    .filter(Boolean);
  const canonical = tokens[0] ?? "";
  if (!canonical) {
    return { canonical: "", aliases: [] };
  }
  const aliases = Array.from(
    new Set(
      tokens
        .slice(1)
        .filter((alias) => alias.toLowerCase() !== canonical.toLowerCase()),
    ),
  );
  return { canonical, aliases };
};
