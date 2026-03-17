import { describe, expect, it, vi } from "vitest";
import { createSettingsSearchAudioController } from "../app/src/renderer/controllers/settings-search-audio-controller";

class FakeInput extends EventTarget {
  value = "";
  checked = false;
}

const createDeps = () => {
  const storage = new Map<string, string>();
  return {
    storage,
    deps: {
      storage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
      },
      elements: {},
      keys: {
        tandaDefaultSize: "tanda-default-size",
        clipboardNewLimit: "clip-limit",
        searchMinScore: "search-min",
        tandaSearchSize: "tanda-search-size",
        searchBpmRange: "search-bpm",
        trimPadding: "trim-padding",
        gapBetweenTracks: "gap-between",
        gapBeforeTanda: "gap-before-tanda",
        gapBeforeCortina: "gap-before-cortina",
        stopFade: "stop-fade",
        cortinaLevelPercent: "cortina-level",
        dynamicsEnabled: "dyn-enabled",
        dynamicsLiftThreshold: "dyn-lift",
        dynamicsMaxLift: "dyn-max",
        dynamicsRatio: "dyn-ratio",
        dynamicsAttack: "dyn-attack",
        dynamicsRelease: "dyn-release",
        dynamicsGateThreshold: "dyn-gate",
        dynamicsLimiterCeiling: "dyn-ceiling",
        dynamicsLimiterRelease: "dyn-limiter-release",
        dynamicsRamp: "dyn-ramp",
      },
      readers: {
        getDefaultTandaSize: () => 4,
        getNewCollectionLimit: () => 10,
        getSearchMinScore: () => 0.2,
        getSearchBpmRange: () => 4,
        getTrimPaddingSeconds: () => 1.5,
        getGapBetweenTracks: () => 2,
        getGapBeforeTanda: () => 5,
        getGapBeforeCortina: () => 4,
        getStopFadeSeconds: () => 3,
        getCortinaLevelPercent: () => 100,
        getAudioDynamicsConfig: () => ({
          enabled: false,
          liftThresholdDb: -32,
          maxLiftDb: 8,
          ratio: 4,
          attackMs: 5,
          releaseMs: 250,
          gateThresholdDb: -60,
          limiterCeilingDb: -1,
          limiterReleaseMs: 150,
          rampMs: 250,
        }),
      },
      actions: {
        refreshSearch: vi.fn(),
        renderClipboard: vi.fn(),
        refreshNewCollectionTracks: vi.fn(),
        renderTandaSearchResults: vi.fn(),
        renderPlaylist: vi.fn(),
        updateNowPlayingDisplay: vi.fn(),
        setMainCompressionDepthPercent: vi.fn(),
        scheduleCompressionPrefetch: vi.fn(),
        syncDynamicsRuntimeForActivePlayback: vi.fn(),
        normalizeTandaSearchSizeInput: (raw: string) => raw.trim() || "4",
      },
    },
  };
};

describe("settings search/audio controller", () => {
  it("persists and clamps the clipboard new limit", () => {
    const { storage, deps } = createDeps();
    const input = new FakeInput() as unknown as HTMLInputElement;
    deps.elements.clipboardNewLimitInput = input;

    createSettingsSearchAudioController(deps).initialize();
    expect(input.value).toBe("10");

    input.value = "999";
    input.dispatchEvent(new Event("change"));

    expect(storage.get("clip-limit")).toBe("500");
    expect(input.value).toBe("500");
    expect(deps.actions.refreshNewCollectionTracks).toHaveBeenCalled();
  });

  it("persists tanda search size and supports finalize normalization", () => {
    const { storage, deps } = createDeps();
    const input = new FakeInput() as unknown as HTMLInputElement;
    deps.elements.searchTandaSizeInput = input;

    createSettingsSearchAudioController(deps).initialize();
    expect(input.value).toBe("4");

    input.value = "11";
    input.dispatchEvent(new Event("input"));
    expect(storage.get("tanda-search-size")).toBe("10");
    expect(input.value).toBe("10");

    input.value = "bad";
    input.dispatchEvent(new Event("blur"));
    expect(storage.get("tanda-search-size")).toBe("bad");
    expect(input.value).toBe("bad");
  });

  it("toggles dynamics and resets mix depth", () => {
    const { storage, deps } = createDeps();
    const input = new FakeInput() as unknown as HTMLInputElement;
    deps.elements.audioDynamicsEnabledInput = input;

    createSettingsSearchAudioController(deps).initialize();
    input.checked = true;
    input.dispatchEvent(new Event("change"));

    expect(storage.get("dyn-enabled")).toBe("1");
    expect(deps.actions.setMainCompressionDepthPercent).toHaveBeenCalledWith(0);
    expect(deps.actions.scheduleCompressionPrefetch).toHaveBeenCalled();
  });
});
