import { describe, expect, it, vi } from "vitest";
import { createSettingsPlaylistController } from "../app/src/renderer/controllers/settings-playlist-controller";

class FakeInput extends EventTarget {
  value = "";
  checked = false;
}

describe("settings playlist controller", () => {
  it("resets and persists the last-tanda toggle", () => {
    const toggle = new FakeInput() as unknown as HTMLInputElement;
    const countInput = new FakeInput() as unknown as HTMLInputElement;
    const performanceToggle = new FakeInput() as unknown as HTMLInputElement;
    const storage = new Map<string, string>();
    const resetPlaylistLastTandaState = vi.fn();
    const resetPlaylistPerformanceStopState = vi.fn();
    const onPlaylistLastTandaChanged = vi.fn();
    const updateExternalDisplay = vi.fn();

    const controller = createSettingsPlaylistController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
      elements: {
        playlistLastTandaToggle: toggle,
        playlistLastTandaCountInput: countInput,
        playlistPerformanceStopToggle: performanceToggle,
      },
      keys: {
        playlistLastTanda: "last",
        playlistLastTandaCount: "last-count",
        playlistPerformanceStop: "performance",
        cortinaSet: "cset",
        cortinaDuration: "cdur",
        displayBackgroundInterval: "dbi",
        displayUseImages: "dui",
        displayImageDim: "did",
        displayFontScale: "dfs",
        displayCortinaFontScale: "dcfs",
        displayEdgePadding: "dep",
        playlistStartTime: "pst",
        playlistEndTime: "pet",
        playlistArtistRepeatGapMinutes: "parg",
      },
      readers: {
        getPlaylistLastTandaCount: () => 1,
        getCortinaSet: () => "",
        getCortinaDuration: () => 40,
        getDisplayBackgroundIntervalSec: () => 20,
        getDisplayUseBackgroundImages: () => true,
        getDisplayImageDimOpacity: () => 0.35,
        getDisplayFontScale: () => 1,
        getDisplayCortinaFontScale: () => 1,
        getDisplayEdgePaddingVmin: () => 5,
        getPlaylistStartTimeInput: () => "20:00",
        getPlaylistEndTimeInput: () => "03:00",
        getPlaylistArtistRepeatGapMinutes: () => 30,
      },
      actions: {
        resetPlaylistLastTandaState,
        resetPlaylistPerformanceStopState,
        onPlaylistLastTandaChanged,
        updateExternalDisplay,
        onCortinaSetChanged: async () => {},
        onCortinaDurationChanged: () => {},
        onPlaylistStartTimeChanged: () => {},
      },
    });

    controller.initialize();
    expect(resetPlaylistLastTandaState).toHaveBeenCalled();
    expect(resetPlaylistPerformanceStopState).toHaveBeenCalled();
    expect(toggle.checked).toBe(false);
    expect(countInput.value).toBe("1");
    expect(performanceToggle.checked).toBe(false);

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    expect(storage.get("last")).toBe("1");
    expect(storage.get("performance")).toBe("0");
    expect(onPlaylistLastTandaChanged).toHaveBeenCalled();
    expect(updateExternalDisplay).toHaveBeenCalled();
  });

  it("makes performance stop mutually exclusive with last-tanda", () => {
    const toggle = new FakeInput() as unknown as HTMLInputElement;
    const countInput = new FakeInput() as unknown as HTMLInputElement;
    const performanceToggle = new FakeInput() as unknown as HTMLInputElement;
    const storage = new Map<string, string>();

    const controller = createSettingsPlaylistController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
      elements: {
        playlistLastTandaToggle: toggle,
        playlistLastTandaCountInput: countInput,
        playlistPerformanceStopToggle: performanceToggle,
      },
      keys: {
        playlistLastTanda: "last",
        playlistLastTandaCount: "last-count",
        playlistPerformanceStop: "performance",
        cortinaSet: "cset",
        cortinaDuration: "cdur",
        displayBackgroundInterval: "dbi",
        displayUseImages: "dui",
        displayImageDim: "did",
        displayFontScale: "dfs",
        displayCortinaFontScale: "dcfs",
        displayEdgePadding: "dep",
        playlistStartTime: "pst",
        playlistEndTime: "pet",
        playlistArtistRepeatGapMinutes: "parg",
      },
      readers: {
        getPlaylistLastTandaCount: () => 1,
        getCortinaSet: () => "",
        getCortinaDuration: () => 40,
        getDisplayBackgroundIntervalSec: () => 20,
        getDisplayUseBackgroundImages: () => true,
        getDisplayImageDimOpacity: () => 0.35,
        getDisplayFontScale: () => 1,
        getDisplayCortinaFontScale: () => 1,
        getDisplayEdgePaddingVmin: () => 5,
        getPlaylistStartTimeInput: () => "20:00",
        getPlaylistEndTimeInput: () => "03:00",
        getPlaylistArtistRepeatGapMinutes: () => 30,
      },
      actions: {
        resetPlaylistLastTandaState: () => {},
        resetPlaylistPerformanceStopState: () => {},
        onPlaylistLastTandaChanged: () => {},
        updateExternalDisplay: () => {},
        onCortinaSetChanged: async () => {},
        onCortinaDurationChanged: () => {},
        onPlaylistStartTimeChanged: () => {},
      },
    });

    controller.initialize();
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    performanceToggle.checked = true;
    performanceToggle.dispatchEvent(new Event("change"));

    expect(toggle.checked).toBe(false);
    expect(storage.get("last")).toBe("0");
    expect(storage.get("performance")).toBe("1");
  });

  it("clamps and persists the last-tanda count input", () => {
    const countInput = new FakeInput() as unknown as HTMLInputElement;
    const storage = new Map<string, string>();
    const onPlaylistLastTandaChanged = vi.fn();

    const controller = createSettingsPlaylistController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
      elements: {
        playlistLastTandaCountInput: countInput,
      },
      keys: {
        playlistLastTanda: "last",
        playlistLastTandaCount: "last-count",
        playlistPerformanceStop: "performance",
        cortinaSet: "cset",
        cortinaDuration: "cdur",
        displayBackgroundInterval: "dbi",
        displayUseImages: "dui",
        displayImageDim: "did",
        displayFontScale: "dfs",
        displayCortinaFontScale: "dcfs",
        displayEdgePadding: "dep",
        playlistStartTime: "pst",
        playlistEndTime: "pet",
        playlistArtistRepeatGapMinutes: "parg",
      },
      readers: {
        getPlaylistLastTandaCount: () => 1,
        getCortinaSet: () => "",
        getCortinaDuration: () => 40,
        getDisplayBackgroundIntervalSec: () => 20,
        getDisplayUseBackgroundImages: () => true,
        getDisplayImageDimOpacity: () => 0.35,
        getDisplayFontScale: () => 1,
        getDisplayCortinaFontScale: () => 1,
        getDisplayEdgePaddingVmin: () => 5,
        getPlaylistStartTimeInput: () => "20:00",
        getPlaylistEndTimeInput: () => "03:00",
        getPlaylistArtistRepeatGapMinutes: () => 30,
      },
      actions: {
        resetPlaylistLastTandaState: () => {},
        resetPlaylistPerformanceStopState: () => {},
        onPlaylistLastTandaChanged,
        updateExternalDisplay: () => {},
        onCortinaSetChanged: async () => {},
        onCortinaDurationChanged: () => {},
        onPlaylistStartTimeChanged: () => {},
      },
    });

    controller.initialize();
    countInput.value = "12";
    countInput.dispatchEvent(new Event("change"));

    expect(storage.get("last-count")).toBe("4");
    expect(countInput.value).toBe("4");
    expect(onPlaylistLastTandaChanged).toHaveBeenCalled();
  });

  it("clamps display interval and persists it", () => {
    const input = new FakeInput() as unknown as HTMLInputElement;
    const storage = new Map<string, string>();
    const updateExternalDisplay = vi.fn();

    const controller = createSettingsPlaylistController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
      elements: {
        displayBackgroundIntervalInput: input,
      },
      keys: {
        playlistLastTanda: "last",
        playlistLastTandaCount: "last-count",
        playlistPerformanceStop: "performance",
        cortinaSet: "cset",
        cortinaDuration: "cdur",
        displayBackgroundInterval: "dbi",
        displayUseImages: "dui",
        displayImageDim: "did",
        displayFontScale: "dfs",
        displayCortinaFontScale: "dcfs",
        displayEdgePadding: "dep",
        playlistStartTime: "pst",
        playlistEndTime: "pet",
        playlistArtistRepeatGapMinutes: "parg",
      },
      readers: {
        getPlaylistLastTandaCount: () => 1,
        getCortinaSet: () => "",
        getCortinaDuration: () => 40,
        getDisplayBackgroundIntervalSec: () => 20,
        getDisplayUseBackgroundImages: () => true,
        getDisplayImageDimOpacity: () => 0.35,
        getDisplayFontScale: () => 1,
        getDisplayCortinaFontScale: () => 1,
        getDisplayEdgePaddingVmin: () => 5,
        getPlaylistStartTimeInput: () => "20:00",
        getPlaylistEndTimeInput: () => "03:00",
        getPlaylistArtistRepeatGapMinutes: () => 30,
      },
      actions: {
        resetPlaylistLastTandaState: () => {},
        resetPlaylistPerformanceStopState: () => {},
        onPlaylistLastTandaChanged: () => {},
        updateExternalDisplay,
        onCortinaSetChanged: async () => {},
        onCortinaDurationChanged: () => {},
        onPlaylistStartTimeChanged: () => {},
      },
    });

    controller.initialize();
    expect(input.value).toBe("20");

    input.value = "999";
    input.dispatchEvent(new Event("change"));

    expect(storage.get("dbi")).toBe("600");
    expect(input.value).toBe("600");
    expect(updateExternalDisplay).toHaveBeenCalled();
  });
});
