import { describe, expect, it, vi } from "vitest";
import {
  activateSettingsTab,
  pulseSettingsSection,
  resolveOutputModeValue,
} from "../app/src/renderer/modules/settings-view";

class FakeClassList {
  private readonly values = new Set<string>();

  add(value: string) {
    this.values.add(value);
  }

  remove(value: string) {
    this.values.delete(value);
  }

  toggle(value: string, force?: boolean) {
    if (force === undefined) {
      if (this.values.has(value)) {
        this.values.delete(value);
        return false;
      }
      this.values.add(value);
      return true;
    }
    if (force) {
      this.values.add(value);
      return true;
    }
    this.values.delete(value);
    return false;
  }

  contains(value: string) {
    return this.values.has(value);
  }
}

class FakeElement {
  dataset: Record<string, string> = {};
  classList = new FakeClassList();
  get offsetWidth() {
    return 0;
  }
}

describe("settings view helpers", () => {
  it("resolves live and edit modes", () => {
    expect(resolveOutputModeValue("live")).toBe("live");
    expect(resolveOutputModeValue("edit")).toBe("edit");
  });

  it("falls back to prep for unknown values", () => {
    expect(resolveOutputModeValue("weird")).toBe("prep");
  });

  it("activates only the requested settings tab", () => {
    const tabA = new FakeElement();
    const tabB = new FakeElement();
    const panelA = new FakeElement();
    const panelB = new FakeElement();
    tabA.dataset.tab = "library";
    tabB.dataset.tab = "system";
    panelA.dataset.tab = "library";
    panelB.dataset.tab = "system";

    activateSettingsTab([tabA, tabB], [panelA, panelB], "system");

    expect(tabA.classList.contains("active")).toBe(false);
    expect(tabB.classList.contains("active")).toBe(true);
    expect(panelA.classList.contains("active")).toBe(false);
    expect(panelB.classList.contains("active")).toBe(true);
  });

  it("pulses the requested settings section", () => {
    vi.useFakeTimers();
    const section = new FakeElement();
    (globalThis as { window?: typeof globalThis }).window = globalThis;

    pulseSettingsSection(section as unknown as HTMLElement, 100);
    expect(section.classList.contains("section-pulse")).toBe(true);

    vi.advanceTimersByTime(100);
    expect(section.classList.contains("section-pulse")).toBe(false);
    vi.useRealTimers();
  });
});
