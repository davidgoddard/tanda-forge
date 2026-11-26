import type { BpmConfig, BpmStatus } from "./bpm";
export type StyleConfig = BpmConfig;
export type StyleStatus = BpmStatus;
export type StyleTrack = {
  imported_style: string | null;
  user_style_active?: number;
  user_style: string | null;
  derived_style: string | null;
  genre: string | null;
  style_error: string | null;
  style_analysis_key: string | null;
};

/** A legacy unknown marker is not a deliberate style choice. */
export const normalizeStyleValue = (value: string | null | undefined): string | null => {
  const text = value?.trim() ?? "";
  return !text || text === "?" ? null : text;
};
