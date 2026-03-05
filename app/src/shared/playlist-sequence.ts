import { normalizeStyleName } from "./tanda-utils.js";

export type SequenceEntry = {
  count: number;
  code: string;
  alternatives: Array<{ count: number; code: string }>;
};

export type StyleMap = Record<string, string[]>;

export type SequenceValidation = {
  ok: boolean;
  reason?: "count" | "style";
};

export type SequenceParseValidation = {
  ok: boolean;
  message?: string;
};

export type SequenceCodeValidation = {
  ok: boolean;
  unknownCodes: string[];
};

const canonicalizeStyle = (input: string) => {
  const normalized = normalizeStyleName(input);
  if (!normalized) {
    return "";
  }
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(" ");
};

const parseSequenceToken = (token: string) => {
  const match = token.match(/^(\d+)\s*([a-zA-Z]+)$/);
  if (!match) {
    return null;
  }
  const count = Number.parseInt(match[1], 10);
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  return { count, code: match[2].toUpperCase() };
};

const tokenizeSequence = (input: string) => {
  const tokens: string[] = [];
  let current = "";
  for (const char of input) {
    if (char === "(" || char === ")") {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      tokens.push(char);
      current = "";
      continue;
    }
    if (/\s/.test(char)) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    tokens.push(current.trim());
  }
  return tokens;
};

const normalizeSequenceEntry = (alternatives: Array<{ count: number; code: string }>) => {
  const primary = alternatives[0] ?? { count: 0, code: "?" };
  return {
    count: primary.count,
    code: primary.code,
    alternatives,
  };
};

const parseSequenceInternal = (input: string) => {
  const entries: SequenceEntry[] = [];
  const tokens = tokenizeSequence(input);
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === ")") {
      return { entries, error: `Unexpected ')' at token ${index + 1}.` };
    }
    if (token === "(") {
      index += 1;
      const alternatives: Array<{ count: number; code: string }> = [];
      while (index < tokens.length && tokens[index] !== ")") {
        if (tokens[index] === "(") {
          return { entries, error: `Nested '(' is not allowed at token ${index + 1}.` };
        }
        const parsed = parseSequenceToken(tokens[index]);
        if (!parsed) {
          return {
            entries,
            error: `Invalid sequence term '${tokens[index]}' inside group.`,
          };
        }
        alternatives.push(parsed);
        index += 1;
      }
      if (index >= tokens.length || tokens[index] !== ")") {
        return { entries, error: "Missing closing ')' in sequence." };
      }
      if (alternatives.length === 0) {
        return { entries, error: "Empty group '()' is not allowed." };
      }
      entries.push(normalizeSequenceEntry(alternatives));
      index += 1;
      continue;
    }
    const parsed = parseSequenceToken(token);
    if (!parsed) {
      return { entries, error: `Invalid sequence term '${token}'.` };
    }
    entries.push(normalizeSequenceEntry([parsed]));
    index += 1;
  }
  return { entries, error: null as string | null };
};

export const validateSequenceSyntax = (input: string): SequenceParseValidation => {
  if (!input.trim()) {
    return { ok: true };
  }
  const result = parseSequenceInternal(input);
  if (result.error) {
    return { ok: false, message: result.error };
  }
  return { ok: true };
};

export const parseSequence = (input: string): SequenceEntry[] => {
  if (!input) {
    return [];
  }
  const result = parseSequenceInternal(input);
  return result.error ? [] : result.entries;
};

export const validateSequenceCodes = (
  sequence: SequenceEntry[],
  knownCodes: Iterable<string>,
): SequenceCodeValidation => {
  const known = new Set(
    Array.from(knownCodes)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  );
  const unknown = new Set<string>();
  sequence.forEach((entry) => {
    const alternatives =
      entry.alternatives && entry.alternatives.length > 0
        ? entry.alternatives
        : [{ count: entry.count, code: entry.code }];
    alternatives.forEach((alternative) => {
      const code = alternative.code.trim().toUpperCase();
      if (!code) {
        return;
      }
      if (!known.has(code)) {
        unknown.add(code);
      }
    });
  });
  return {
    ok: unknown.size === 0,
    unknownCodes: Array.from(unknown).sort((left, right) => left.localeCompare(right)),
  };
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
        .map((value) => canonicalizeStyle(value))
        .filter(Boolean);
      if (styles.length > 0) {
        map[key] = Array.from(new Set(styles));
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

export const formatSequenceRule = (rule: SequenceEntry) => {
  if (!rule.alternatives || rule.alternatives.length === 0) {
    return `${rule.count}${rule.code.toLowerCase()}`;
  }
  if (rule.alternatives.length === 1) {
    const only = rule.alternatives[0];
    return `${only.count}${only.code.toLowerCase()}`;
  }
  return `(${rule.alternatives
    .map((entry) => `${entry.count}${entry.code.toLowerCase()}`)
    .join(" ")})`;
};

export const validateTandaForRule = (
  trackCount: number,
  styles: string[],
  rule: SequenceEntry,
  styleMap: StyleMap,
): SequenceValidation => {
  const normalizedStyles = styles
    .map((style) => canonicalizeStyle(style))
    .filter(Boolean);
  let anyCountMatch = false;
  for (const alternative of rule.alternatives) {
    if (alternative.count > 0 && trackCount !== alternative.count) {
      continue;
    }
    anyCountMatch = true;
    const mapped = (styleMap[alternative.code] ?? [])
      .map((style) => canonicalizeStyle(style))
      .filter(Boolean);
    if (mapped.length === 0 || normalizedStyles.length === 0) {
      return { ok: true };
    }
    const matches = normalizedStyles.some((style) => mapped.includes(style));
    if (matches) {
      return { ok: true };
    }
  }
  if (anyCountMatch) {
    return { ok: false, reason: "style" };
  }
  return { ok: false, reason: "count" };
};
