import type { SequenceEntry, StyleMap } from "./playlist-sequence.js";

export const getDefaultSlotSize = (
  rule: SequenceEntry | null,
  fallbackSize: number,
) => {
  if (rule && Number.isFinite(rule.count) && rule.count > 0) {
    return rule.count;
  }
  return fallbackSize;
};

export const getDefaultStylesForRule = (
  rule: SequenceEntry | null,
  styleMap: StyleMap,
) => {
  if (!rule) {
    return [] as string[];
  }
  const alternatives =
    rule.alternatives && rule.alternatives.length > 0
      ? rule.alternatives
      : [{ count: rule.count, code: rule.code }];
  const styles = alternatives.flatMap((alternative) => {
    if (alternative.code === "*" || alternative.code === "ANY") {
      return [] as string[];
    }
    return styleMap[alternative.code] ?? [];
  });
  return Array.from(new Set(styles));
};
