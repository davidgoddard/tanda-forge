export type BpmPreference = "prefer-user" | "derived-only" | "default-only";
export type BpmConfig = { enabled: boolean; preference: BpmPreference; configured: boolean; paused: boolean };
export type BpmTrack = {
  // Historical name: user_bpm holds imported/previously combined metadata.
  // New manual entries and tapped tempos are stored in bpm_override.
  user_bpm: number | null; derived_bpm: number | null; bpm_override: number | null;
  bpm_override_active?: number;
  bpm: number | null; bpm_error: string | null; bpm_analysis_key: string | null;
};
export type BpmStatus = BpmConfig & { total: number; completed: number; failed: number; running: boolean; suspended: boolean; revision: number };
/** Audio evidence may be fractional; application BPM values are whole numbers. */
export const roundBpm = (value: number | null | undefined): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
};
/** user_bpm is the historical imported/entered field; bpm_override is an explicit editor value. */
export const effectiveBpm = (config: BpmConfig, imported: number | null, derived: number | null, user: number | null, manualActive = true) =>
  roundBpm(resolveAnalysisValue(config, imported, derived, user, manualActive));
export const resolveAnalysisValue = <T>(config: BpmConfig, imported: T | null, derived: T | null, user: T | null, manualActive = true): T | null =>
  config.preference === "derived-only" ? (manualActive ? user ?? derived : derived) : config.preference === "prefer-user"
    ? user ?? derived ?? imported : user ?? imported ?? derived;
export const analysisValueSource = <T>(config: BpmConfig, imported: T | null, derived: T | null, user: T | null, manualActive = true) => {
  if (config.preference === "derived-only") return manualActive && user != null ? "user" : derived == null ? "none" : "derived";
  if (user != null) return "user";
  if (config.preference === "prefer-user" && derived != null) return "derived";
  return imported != null ? "imported" : derived != null ? "derived" : "none";
};
