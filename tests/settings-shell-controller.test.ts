import { describe, expect, it, vi } from "vitest";
import { createSettingsShellController } from "../app/src/renderer/controllers/settings-shell-controller";

class FakeButton extends EventTarget {
  dataset: Record<string, string> = {};
}

class FakeBody {
  className = "";
  classList = {
    contains: (token: string) => this.className.split(/\s+/).includes(token),
    toggle: (token: string, force?: boolean) => {
      const current = new Set(this.className.split(/\s+/).filter(Boolean));
      const shouldHave = force ?? !current.has(token);
      if (shouldHave) {
        current.add(token);
      } else {
        current.delete(token);
      }
      this.className = Array.from(current).join(" ");
    },
  };
}

describe("settings shell controller", () => {
  it("applies the saved theme and cycles to the next theme", () => {
    const storage = new Map<string, string>([["tanda-theme", "dark-red"]]);
    const themeToggle = new FakeButton() as unknown as HTMLButtonElement;
    const body = new FakeBody() as unknown as HTMLElement;

    const controller = createSettingsShellController({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
      body,
      elements: {
        themeToggle,
        tabButtons: [],
        tabPanels: [],
      },
      actions: {
        setSettingsOpen: async () => {},
        activateSettingsTab: () => {},
        toggleFullscreen: async () => {},
        openDisplay: async () => {},
        updateExternalDisplay: () => {},
        setStatus: () => {},
      },
      labels: {
        fullscreenUnavailable: "unavailable",
        fullscreenFailed: "failed",
        fullscreenFailedDetail: (message) => `failed:${message}`,
        noApi: "no api",
      },
    });

    controller.initialize();
    expect(storage.get("tanda-theme")).toBe("dark-red");
    expect((body as unknown as FakeBody).classList.contains("theme-dark-red")).toBe(true);

    themeToggle.dispatchEvent(new Event("click"));

    expect(storage.get("tanda-theme")).toBe("dark-green");
    expect((body as unknown as FakeBody).classList.contains("theme-dark-green")).toBe(true);
  });

  it("opens diagnostics from shortcuts and activates the diagnostics tab", async () => {
    const openDiagnosticsMain = new FakeButton() as unknown as HTMLElement;
    const setSettingsOpen = vi.fn(async () => {});
    const activateSettingsTab = vi.fn();

    const controller = createSettingsShellController({
      storage: {
        getItem: () => null,
        setItem: () => {},
      },
      body: new FakeBody() as unknown as HTMLElement,
      elements: {
        openDiagnosticsMain,
        tabButtons: [],
        tabPanels: [],
      },
      actions: {
        setSettingsOpen,
        activateSettingsTab,
        toggleFullscreen: async () => {},
        openDisplay: async () => {},
        updateExternalDisplay: () => {},
        setStatus: () => {},
      },
      labels: {
        fullscreenUnavailable: "unavailable",
        fullscreenFailed: "failed",
        fullscreenFailedDetail: (message) => `failed:${message}`,
        noApi: "no api",
      },
    });

    controller.initialize();
    openDiagnosticsMain.dispatchEvent(new Event("click"));
    await Promise.resolve();

    expect(setSettingsOpen).toHaveBeenCalledWith(true);
    expect(activateSettingsTab).toHaveBeenCalledWith("diagnostics");
  });

  it("reports fullscreen errors through status updates", async () => {
    const fullscreenToggle = new FakeButton() as unknown as HTMLButtonElement;
    const setStatus = vi.fn();

    const controller = createSettingsShellController({
      storage: {
        getItem: () => null,
        setItem: () => {},
      },
      body: new FakeBody() as unknown as HTMLElement,
      elements: {
        fullscreenToggle,
        tabButtons: [],
        tabPanels: [],
      },
      actions: {
        setSettingsOpen: async () => {},
        activateSettingsTab: () => {},
        toggleFullscreen: async () => {
          throw new Error("boom");
        },
        openDisplay: async () => {},
        updateExternalDisplay: () => {},
        setStatus,
      },
      labels: {
        fullscreenUnavailable: "unavailable",
        fullscreenFailed: "failed",
        fullscreenFailedDetail: (message) => `failed:${message}`,
        noApi: "no api",
      },
    });

    controller.initialize();
    fullscreenToggle.dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(setStatus).toHaveBeenCalledWith("failed:boom"));
  });
});
