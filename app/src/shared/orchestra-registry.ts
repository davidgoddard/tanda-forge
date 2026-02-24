import type { OrchestraSeedEntry } from "./orchestra-seed.js";

export type OrchestraRegistryEntry = {
  id: string;
  canonical: string;
  aliases: string[];
  related: string[];
};

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const ORCHESTRA_STOP_WORDS = [
  "orquesta",
  "orchestra",
  "tipica",
  "tipico",
  "tipica",
  "tipica",
  "tango",
  "de",
  "del",
  "la",
  "los",
  "las",
  "y",
  "su",
];

export const normalizeOrchestraText = (value: string) => {
  const cleaned = stripDiacritics(value)
    .toLowerCase()
    .replace(/['`´]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split(" ")
    .filter((token) => token && !ORCHESTRA_STOP_WORDS.includes(token))
    .join(" ")
    .trim();
};

const slugify = (value: string) =>
  normalizeOrchestraText(value)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .trim();

export const normalizeRegistryEntry = (
  entry: Partial<OrchestraRegistryEntry> & { canonical: string },
): OrchestraRegistryEntry => {
  const canonical = entry.canonical.trim();
  const aliases = Array.from(
    new Set(
      (entry.aliases ?? [])
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0 && alias !== canonical),
    ),
  );
  const related = Array.from(
    new Set((entry.related ?? []).map((item) => item.trim()).filter(Boolean)),
  );
  return {
    id:
      entry.id?.trim() ||
      slugify(canonical) ||
      `orq-${Math.random().toString(36).slice(2, 10)}`,
    canonical,
    aliases,
    related,
  };
};

export const convertSeedToRegistry = (seed: OrchestraSeedEntry[]) =>
  seed.map((entry) =>
    normalizeRegistryEntry({
      canonical: entry.canonical,
      aliases: entry.aliases,
      related: entry.related ?? [],
    }),
  );

export const buildOrchestraAliasIndex = (
  entries: OrchestraRegistryEntry[],
) => {
  const index = new Map<string, string>();
  entries.forEach((entry) => {
    const values = [entry.canonical, ...entry.aliases];
    values.forEach((value) => {
      const key = normalizeOrchestraText(value);
      if (key) {
        index.set(key, entry.id);
      }
    });
  });
  return index;
};

export const resolveOrchestraCanonical = (params: {
  rawArtist: string;
  entries: OrchestraRegistryEntry[];
  aliasIndex: Map<string, string>;
}) => {
  const { rawArtist, entries, aliasIndex } = params;
  const key = normalizeOrchestraText(rawArtist);
  if (!key) {
    return null;
  }
  const id = aliasIndex.get(key);
  if (!id) {
    return null;
  }
  return entries.find((entry) => entry.id === id)?.canonical ?? null;
};
