const DAY_MINUTES = 24 * 60;

export const parseClockMinutes = (raw: string, fallbackMinutes: number) => {
  const value = raw.trim();
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return fallbackMinutes;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return fallbackMinutes;
  }
  const clampedHours = Math.min(23, Math.max(0, hours));
  const clampedMinutes = Math.min(59, Math.max(0, minutes));
  return clampedHours * 60 + clampedMinutes;
};

export const computePlaylistWindowMinutes = (
  startMinutes: number,
  endMinutes: number,
) => {
  const normalizedStart = ((startMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const normalizedEnd = ((endMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const diff = normalizedEnd - normalizedStart;
  return diff > 0 ? diff : diff + DAY_MINUTES;
};
