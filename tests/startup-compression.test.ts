import { describe, expect, it, vi } from "vitest";
import { runStartupCompression } from "../app/src/main/library/startup-compression";

describe("startup compression", () => {
  it.each([false, undefined])("skips rendering and progress when enabled is %s", async (enabled) => {
    const precompute = vi.fn();
    const result = await runStartupCompression(enabled, precompute);
    expect(precompute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ rendered: 0, failed: 0, errors: [] });
  });

  it("runs compression and preserves its results when enabled", async () => {
    const result = {
      rendered: 2, cached: 1, failed: 0, eligible: 3, ready: 3,
      missing: 0, invalidSource: 0, missingTracks: [], errors: [],
    };
    const precompute = vi.fn(async () => result);
    expect(await runStartupCompression(true, precompute)).toBe(result);
    expect(precompute).toHaveBeenCalledOnce();
  });
});
