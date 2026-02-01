import { normalizeStyleName } from "./tanda-utils.js";

export type SequenceEntry = {
  count: number;
  code: string;
};

export type StyleMap = Record<string, string[]>;

export type SequenceValidation = {
  ok: boolean;
  reason?: "count" | "style";
};

export const parseSequence = (input: string): SequenceEntry[] => {
  if (!input) {
    return [];
  }
  return input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^(\d+)\s*([a-zA-Z*]+)$/);
      if (!match) {
        return null;
      }
      const count = Number.parseInt(match[1], 10);
      if (!Number.isFinite(count) || count <= 0) {
        return null;
      }
      return { count, code: match[2].toUpperCase() } as SequenceEntry;
    })
    .filter(Boolean) as SequenceEntry[];
};

export const parseStyleMap = (input: string): StyleMap => {
  const map: StyleMap = {};
  if (!input) {
    return map;
  }
  input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/[:=]/);
      if (parts.length < 2) {
        return;
      }
      const key = parts[0]?.trim().toUpperCase();
      if (!key) {
        return;
      }
      const styles = parts
        .slice(1)
        .join("=")
        .split(/[;,]/)
        .map((value) => normalizeStyleName(value))
        .filter(Boolean);
      if (styles.length > 0) {
        map[key] = styles;
      }
    });
  return map;
};

export const getSequenceRule = (
  sequence: SequenceEntry[],
  index: number,
): SequenceEntry | null => {
  if (sequence.length === 0 || index < 0) {
    return null;
  }
  const wrappedIndex = index % sequence.length;
  return sequence[wrappedIndex] ?? null;
};

export const validateTandaForRule = (
  trackCount: number,
  styles: string[],
  rule: SequenceEntry,
  styleMap: StyleMap,
): SequenceValidation => {
  if (rule.count > 0 && trackCount !== rule.count) {
    return { ok: false, reason: "count" };
  }
  if (rule.code === "*" || rule.code === "ANY") {
    return { ok: true };
  }
  const mapped = styleMap[rule.code] ?? [];
  if (mapped.length === 0) {
    return { ok: true };
  }
  const normalizedStyles = styles.map((style) => normalizeStyleName(style));
  const matches = normalizedStyles.some((style) => mapped.includes(style));
  if (!matches) {
    return { ok: false, reason: "style" };
  }
  return { ok: true };
};
