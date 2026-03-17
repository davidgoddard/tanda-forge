import { describe, expect, it, vi } from "vitest";
import { createSettingsPlaylistController } from "../app/src/renderer/controllers/settings-playlist-controller";

class FakeInput extends EventTarget {
  value = "";
  checked = false;
}

describe("settings playlist controller", () => {
  it("resets and persists the last-tanda toggle", () => {
    const toggle = new FakeInput() as unknown as HTMLInputElement;
    const storage = new Map<string, string>();
    const resetPlaylistLastTandaState = vi.fn();
    const updateExternalDisplay = vi.fn();

    const controller = createSettingsPlaylistController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
      elements: {
        playlistLastTandaToggle: toggle,
      },
      keys: {
        playlistLastTanda: "last",
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
        updateExternalDisplay,
        onCortinaSetChanged: async () => {},
        onCortinaDurationChanged: () => {},
        onPlaylistStartTimeChanged: () => {},
      },
    });

    controller.initialize();
    expect(resetPlaylistLastTandaState).toHaveBeenCalled();
    expect(toggle.checked).toBe(false);

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    expect(storage.get("last")).toBe("1");
    expect(updateExternalDisplay).toHaveBeenCalled();
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
