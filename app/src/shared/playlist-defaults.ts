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
  if (rule.code === "*" || rule.code === "ANY") {
    return [] as string[];
  }
  return [...(styleMap[rule.code] ?? [])];
};
