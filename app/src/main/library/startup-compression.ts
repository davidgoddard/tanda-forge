export const runStartupCompression = async <T> (
  enabled: boolean | undefined,
  precompute: () => Promise<T>,
) => {
  if (enabled === true) {
    return precompute();
  }
  return {
    rendered: 0,
    cached: 0,
    failed: 0,
    eligible: 0,
    ready: 0,
    missing: 0,
    invalidSource: 0,
    missingTracks: [],
    errors: [],
  };
};
