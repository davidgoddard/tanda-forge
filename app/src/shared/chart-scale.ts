const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const computeScaledPercent = (
  value: number,
  maxValue: number,
  options?: {
    minPercent?: number;
    maxPercent?: number;
  },
) => {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0 || value <= 0) {
    return 0;
  }
  const minPercent = options?.minPercent ?? 0;
  const maxPercent = options?.maxPercent ?? 100;
  if (maxPercent <= 0 || maxPercent < minPercent) {
    return 0;
  }
  const ratio = clamp(value / maxValue, 0, 1);
  const scaled = Math.round(ratio * maxPercent);
  return clamp(Math.max(minPercent, scaled), minPercent, maxPercent);
};
