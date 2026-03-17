import { describe, expect, it, vi } from "vitest";
import { createSettingsCatalogController } from "../app/src/renderer/controllers/settings-catalog-controller";

class FakeInput extends EventTarget {
  value = "";
}

describe("settings catalog controller", () => {
  it("updates orchestra filter text from the filter input", () => {
    const orchestraFilterInput = new FakeInput() as unknown as HTMLInputElement;
    const setOrchestraFilter = vi.fn();

    const controller = createSettingsCatalogController({
      elements: {
        orchestraFilterInput,
      },
      actions: {
        addOrchestraEntry: () => {},
        resetOrchestraRegistry: async () => {},
        saveOrchestraRegistry: () => {},
        setOrchestraFilter,
        addStyleFamily: async () => false,
      },
    });

    controller.initialize();
    orchestraFilterInput.value = "troilo";
    orchestraFilterInput.dispatchEvent(new Event("input"));

    expect(setOrchestraFilter).toHaveBeenCalledWith("troilo");
  });

  it("calls addStyleFamily on button click and enter key", () => {
    const styleFamilyAddBtn = new FakeInput() as unknown as HTMLButtonElement;
    const styleFamilyCodeInput = new FakeInput() as unknown as HTMLInputElement;
    const addStyleFamily = vi.fn(async () => true);

    const controller = createSettingsCatalogController({
      elements: {
        styleFamilyAddBtn,
        styleFamilyCodeInput,
      },
      actions: {
        addOrchestraEntry: () => {},
        resetOrchestraRegistry: async () => {},
        saveOrchestraRegistry: () => {},
        setOrchestraFilter: () => {},
        addStyleFamily,
      },
    });

    controller.initialize();
    styleFamilyAddBtn.dispatchEvent(new Event("click"));
    const enterEvent = new Event("keydown", { bubbles: true });
    Object.defineProperty(enterEvent, "key", { value: "Enter" });
    styleFamilyCodeInput.dispatchEvent(enterEvent);

    expect(addStyleFamily).toHaveBeenCalledTimes(2);
  });
});
