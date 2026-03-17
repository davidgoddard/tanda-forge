import { describe, expect, it, vi } from "vitest";
import { createSettingsGeneralController } from "../app/src/renderer/controllers/settings-general-controller";

class FakeInput extends EventTarget {
  value = "";
}

describe("settings general controller", () => {
  it("persists language changes and invokes the language callback", () => {
    const languageSelect = new FakeInput() as unknown as HTMLSelectElement;
    const storage = new Map<string, string>();
    const applyLanguageChange = vi.fn();

    const controller = createSettingsGeneralController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
        removeItem: (key) => void storage.delete(key),
      },
      elements: {
        languageSelect,
      },
      keys: {
        language: "lang",
        mode: "mode",
        headphoneOutput: "hp",
        headphoneOutputLabel: "hp-label",
        headphoneOutputGroup: "hp-group",
      },
      readers: {
        getLanguage: () => "en",
        getAppMode: () => "prep",
        getMainOutputValue: () => "main-1",
      },
      actions: {
        applyLanguageChange,
        applyModeChange: () => {},
        verifyOutputSelection: async () => true,
        ensureAudioOutputs: async () => {},
        renderAllLists: () => {},
      },
    });

    controller.initialize();
    expect(languageSelect.value).toBe("en");

    languageSelect.value = "fr";
    languageSelect.dispatchEvent(new Event("change"));

    expect(storage.get("lang")).toBe("fr");
    expect(applyLanguageChange).toHaveBeenCalledWith("fr");
  });

  it("clears headphone selection when it matches the main output", async () => {
    const mainOutputSelect = new FakeInput() as unknown as HTMLSelectElement;
    const headphoneOutputSelect = new FakeInput() as unknown as HTMLSelectElement;
    mainOutputSelect.value = "main-1";
    headphoneOutputSelect.value = "main-1";
    const storage = new Map<string, string>([
      ["hp", "main-1"],
      ["hp-label", "Main"],
      ["hp-group", "group-1"],
    ]);
    const ensureAudioOutputs = vi.fn(async () => {});
    const renderAllLists = vi.fn();

    const controller = createSettingsGeneralController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
        removeItem: (key) => void storage.delete(key),
      },
      elements: {
        mainOutputSelect,
        headphoneOutputSelect,
      },
      keys: {
        language: "lang",
        mode: "mode",
        headphoneOutput: "hp",
        headphoneOutputLabel: "hp-label",
        headphoneOutputGroup: "hp-group",
      },
      readers: {
        getLanguage: () => "en",
        getAppMode: () => "prep",
        getMainOutputValue: () => mainOutputSelect.value,
      },
      actions: {
        applyLanguageChange: () => {},
        applyModeChange: () => {},
        verifyOutputSelection: async () => true,
        ensureAudioOutputs,
        renderAllLists,
      },
    });

    controller.initialize();
    mainOutputSelect.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(renderAllLists).toHaveBeenCalled());

    expect(storage.has("hp")).toBe(false);
    expect(storage.has("hp-label")).toBe(false);
    expect(storage.has("hp-group")).toBe(false);
    expect(ensureAudioOutputs).toHaveBeenCalled();
    expect(renderAllLists).toHaveBeenCalled();
  });
});
