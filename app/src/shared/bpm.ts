export type BpmPreference = "prefer-user" | "derived-only";
export type BpmConfig = { enabled: boolean; preference: BpmPreference; configured: boolean; paused: boolean };
export type BpmTrack = {
  user_bpm: number | null; derived_bpm: number | null; bpm_override: number | null;
  bpm: number | null; bpm_error: string | null; bpm_analysis_key: string | null;
};
export type BpmStatus = BpmConfig & { total: number; completed: number; failed: number; running: boolean; suspended: boolean; revision: number };
/** Audio evidence may be fractional; application BPM values are whole numbers. */
export const roundBpm = (value: number | null | undefined): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
};
export const effectiveBpm = (config: BpmConfig, user: number | null, derived: number | null, correction: number | null) =>
  roundBpm(!config.enabled ? user : correction ?? (config.preference === "prefer-user" ? user ?? derived : derived));
