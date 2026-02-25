export const normalizePlaylistItems = <T>(items: (T | null)[]) => {
  const normalized = [...items];
  const hasAnyFilled = normalized.some((item) => item !== null);
  if (!hasAnyFilled) {
    return [null] as (T | null)[];
  }

  while (normalized.length > 1 && normalized[0] === null && normalized[1] === null) {
    normalized.shift();
  }

  while (
    normalized.length > 1 &&
    normalized[normalized.length - 1] === null &&
    normalized[normalized.length - 2] === null
  ) {
    normalized.pop();
  }
  if (normalized[normalized.length - 1] !== null) {
    normalized.push(null);
  }
  return normalized;
};
