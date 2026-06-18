export type LegacyOverride = {
  title?: string;
  artist?: string;
  singer?: string;
  album?: string;
  year?: string;
  genre?: string;
  bpm?: number | null;
  notes?: string;
  instrumental?: boolean | null;
  durationMs?: number;
  startOffsetMs?: number;
  endTrimMs?: number;
  loudnessDb?: number | null;
  gainDb?: number | null;
};

type PersistedLegacyOverrides = Record<string, Record<string, LegacyOverride>>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const sanitizeOverride = (value: unknown): LegacyOverride | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const copyString = (key: string) => {
    const raw = input[key];
    if (typeof raw === "string") {
      out[key] = raw;
    }
  };
  copyString("title");
  copyString("artist");
  copyString("singer");
  copyString("album");
  copyString("year");
  copyString("genre");
  copyString("notes");
  const instrumental = input.instrumental;
  if (typeof instrumental === "boolean" || instrumental === null) {
    out.instrumental = instrumental;
  }
  const copyNullableNumber = (key: string) => {
    const raw = input[key];
    if (raw === null) {
      out[key] = null;
      return;
    }
    if (isFiniteNumber(raw)) {
      out[key] = raw;
    }
  };
  copyNullableNumber("bpm");
  copyNullableNumber("durationMs");
  copyNullableNumber("startOffsetMs");
  copyNullableNumber("endTrimMs");
  copyNullableNumber("loudnessDb");
  copyNullableNumber("gainDb");
  return Object.keys(out).length > 0 ? (out as LegacyOverride) : null;
};

export const serializeLegacyOverrides = (
  overrides: Map<string, Map<string, LegacyOverride>>,
) => {
  const data: PersistedLegacyOverrides = {};
  overrides.forEach((rootEntries, rootId) => {
    if (!rootId) {
      return;
    }
    const row: Record<string, LegacyOverride> = {};
    rootEntries.forEach((override, relativePath) => {
      if (!relativePath || !override) {
        return;
      }
      const clean = sanitizeOverride(override);
      if (clean) {
        row[relativePath] = clean;
      }
    });
    if (Object.keys(row).length > 0) {
      data[rootId] = row;
    }
  });
  return JSON.stringify(data);
};

export const deserializeLegacyOverrides = (
  raw: string | null | undefined,
) => {
  if (!raw) {
    return new Map<string, Map<string, LegacyOverride>>();
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Map<string, Map<string, LegacyOverride>>();
  }
  if (!parsed || typeof parsed !== "object") {
    return new Map<string, Map<string, LegacyOverride>>();
  }
  const output = new Map<string, Map<string, LegacyOverride>>();
  const rootEntries = parsed as Record<string, unknown>;
  Object.entries(rootEntries).forEach(([rootId, rootValue]) => {
    if (!rootId || !rootValue || typeof rootValue !== "object") {
      return;
    }
    const nested = new Map<string, LegacyOverride>();
    Object.entries(rootValue as Record<string, unknown>).forEach(
      ([relativePath, overrideValue]) => {
        if (!relativePath) {
          return;
        }
        const clean = sanitizeOverride(overrideValue);
        if (clean) {
          nested.set(relativePath, clean);
        }
      },
    );
    if (nested.size > 0) {
      output.set(rootId, nested);
    }
  });
  return output;
};
